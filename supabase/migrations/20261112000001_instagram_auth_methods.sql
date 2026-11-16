-- Authentication method used by each Instagram account.
ALTER TABLE public.instagram_accounts
ADD COLUMN IF NOT EXISTS auth_method TEXT NOT NULL DEFAULT 'instagram_login';

-- Type of Meta access token.
ALTER TABLE public.instagram_accounts
ADD COLUMN IF NOT EXISTS token_type TEXT;

-- Facebook Page associated with accounts connected through Facebook Login.
ALTER TABLE public.instagram_accounts
ADD COLUMN IF NOT EXISTS facebook_page_id TEXT;

-- Restrict authentication methods to supported internal identifiers.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        JOIN pg_namespace n ON n.oid = t.relnamespace
        WHERE c.conname = 'instagram_accounts_auth_method_check'
          AND t.relname = 'instagram_accounts'
          AND n.nspname = 'public'
    ) THEN
        ALTER TABLE public.instagram_accounts
        ADD CONSTRAINT instagram_accounts_auth_method_check
        CHECK (auth_method IN ('instagram_login', 'unified_login'));
    END IF;
END $$;

COMMENT ON COLUMN public.instagram_accounts.auth_method IS
'Authentication method used to connect this Instagram account.';

COMMENT ON COLUMN public.instagram_accounts.token_type IS
'Meta access token type returned by the authentication flow.';

COMMENT ON COLUMN public.instagram_accounts.facebook_page_id IS
'Facebook Page ID associated with the Instagram account, when applicable.';