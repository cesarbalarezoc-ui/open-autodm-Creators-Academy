 
-- PROSPECTOR AI - Postgres-native job queue + sliding-window rate limiter
-- Hardened migration for a multi-user Supabase deployment.
--
-- job_queue      -> pending/delayed work. Access is service-role only.
-- dm_rate_events -> per-Instagram-account send events. Access is service-role only.
--
-- IMPORTANT: The default rate limit below is an application-side throttle,
-- not a statement of an official or universal Meta messaging limit. Configure
-- it conservatively and independently verify current Meta policies/limits.

-- -----------------------------------------------------------------------------
-- job_queue
-- -----------------------------------------------------------------------------
CREATE TABLE public.job_queue (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type     TEXT        NOT NULL CHECK (job_type IN ('auto_dm', 'follow_up')),
  payload      JSONB       NOT NULL,
  -- Meta may retry webhooks; a duplicate event must not create another job.
  dedupe_key   TEXT        NOT NULL UNIQUE,
  status       TEXT        NOT NULL DEFAULT 'pending'
                           CHECK (status IN ('pending', 'processing', 'done', 'failed')),
  run_after    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  attempts     INTEGER     NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  max_attempts INTEGER     NOT NULL DEFAULT 3 CHECK (max_attempts BETWEEN 1 AND 20),
  last_error   TEXT,
  locked_at    TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_job_queue_due
  ON public.job_queue (run_after)
  WHERE status = 'pending';
CREATE INDEX idx_job_queue_created_at
  ON public.job_queue (created_at DESC);

CREATE TRIGGER job_queue_updated_at
  BEFORE UPDATE ON public.job_queue
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.job_queue ENABLE ROW LEVEL SECURITY;

-- Explicitly deny direct access to client roles; backend service role only.
REVOKE ALL ON TABLE public.job_queue FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.job_queue TO service_role;

-- -----------------------------------------------------------------------------
-- RPC: atomically claim due jobs
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.claim_due_jobs(p_limit INTEGER DEFAULT 10)
RETURNS SETOF public.job_queue
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Keep a bounded batch size; prevents accidental or abusive unbounded claims.
  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 100 THEN
    RAISE EXCEPTION 'p_limit must be between 1 and 100'
      USING ERRCODE = '22023';
  END IF;

  -- Reclaim processing jobs whose worker died or timed out.
  UPDATE public.job_queue
  SET status = 'pending', locked_at = NULL
  WHERE status = 'processing'
    AND (locked_at IS NULL OR locked_at < NOW() - INTERVAL '10 minutes');

  RETURN QUERY
  UPDATE public.job_queue AS jq
  SET status = 'processing', locked_at = NOW()
  WHERE jq.id IN (
    SELECT q.id
    FROM public.job_queue AS q
    WHERE q.status = 'pending'
      AND q.run_after <= NOW()
    ORDER BY q.run_after ASC
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  )
  RETURNING jq.*;
END;
$$;

-- Functions receive EXECUTE from PUBLIC by default in PostgreSQL. Remove that
-- default and expose this RPC only to the trusted backend service role.
REVOKE ALL ON FUNCTION public.claim_due_jobs(INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_due_jobs(INTEGER) TO service_role;

-- -----------------------------------------------------------------------------
-- dm_rate_events
-- -----------------------------------------------------------------------------
CREATE TABLE public.dm_rate_events (
  id                    BIGINT      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  instagram_account_id  UUID        NOT NULL
                                    REFERENCES public.instagram_accounts(id) ON DELETE CASCADE,
  sent_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_dm_rate_events_window
  ON public.dm_rate_events (instagram_account_id, sent_at DESC);

ALTER TABLE public.dm_rate_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.dm_rate_events FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.dm_rate_events TO service_role;

-- Application-side rolling-window throttle. Not an official Meta limit.
CREATE OR REPLACE FUNCTION public.check_and_record_dm_rate_limit(
  p_account_id UUID,
  p_limit INTEGER DEFAULT 180
)
RETURNS TABLE (allowed BOOLEAN, current_count INTEGER, retry_after_seconds INTEGER)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_count INTEGER;
  v_oldest TIMESTAMPTZ;
BEGIN
  IF p_account_id IS NULL OR p_limit IS NULL OR p_limit < 1 THEN
    RAISE EXCEPTION 'Invalid account ID or rate limit'
      USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(p_account_id::text));

  DELETE FROM public.dm_rate_events
  WHERE instagram_account_id = p_account_id
    AND sent_at < NOW() - INTERVAL '1 hour';

  SELECT COUNT(*) INTO v_count
  FROM public.dm_rate_events
  WHERE instagram_account_id = p_account_id
    AND sent_at > NOW() - INTERVAL '1 hour';

  IF v_count >= p_limit THEN
    SELECT MIN(sent_at) INTO v_oldest
    FROM public.dm_rate_events
    WHERE instagram_account_id = p_account_id
      AND sent_at > NOW() - INTERVAL '1 hour';

    RETURN QUERY SELECT
      false,
      v_count,
      GREATEST(1, CEIL(EXTRACT(EPOCH FROM
        (v_oldest + INTERVAL '1 hour' - NOW())))::INTEGER + 1);
    RETURN;
  END IF;

  INSERT INTO public.dm_rate_events (instagram_account_id)
  VALUES (p_account_id);

  RETURN QUERY SELECT true, v_count + 1, 0;
END;
$$;

REVOKE ALL ON FUNCTION public.check_and_record_dm_rate_limit(UUID, INTEGER)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_and_record_dm_rate_limit(UUID, INTEGER)
  TO service_role;

-- Periodic backend housekeeping.
CREATE OR REPLACE FUNCTION public.cleanup_old_rows()
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM public.debug_events
    WHERE created_at < NOW() - INTERVAL '7 days';

  DELETE FROM public.job_queue
    WHERE status IN ('done', 'failed')
      AND updated_at < NOW() - INTERVAL '7 days';

  DELETE FROM public.dm_rate_events
    WHERE sent_at < NOW() - INTERVAL '2 hours';

  DELETE FROM public.automation_sessions
    WHERE completed = TRUE
      AND last_activity_at < NOW() - INTERVAL '30 days';
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_old_rows()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_old_rows()
  TO service_role;
