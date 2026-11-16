-- PROSPECTOR AI - Unified Login configuration
-- Stores Meta's Instagram Unified Login configuration ID.

ALTER TABLE public.app_settings
ADD COLUMN IF NOT EXISTS meta_login_config_id TEXT;

COMMENT ON COLUMN public.app_settings.meta_login_config_id IS
'Meta Instagram Unified Login configuration ID.';