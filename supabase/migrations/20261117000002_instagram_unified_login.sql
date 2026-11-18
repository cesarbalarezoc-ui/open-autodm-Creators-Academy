-- Support the Instagram API with Unified Login (Business Integration System User tokens).
-- This flow shares Instagram professional accounts directly; no Facebook Page is required.

ALTER TABLE public.instagram_accounts
    ADD COLUMN IF NOT EXISTS client_business_id TEXT,
    ADD COLUMN IF NOT EXISTS system_user_id TEXT,
    ADD COLUMN IF NOT EXISTS login_config_id TEXT;

-- The earlier constraint only allowed the legacy login methods.
ALTER TABLE public.instagram_accounts
    DROP CONSTRAINT IF EXISTS instagram_accounts_auth_method_check;

ALTER TABLE public.instagram_accounts
    ADD CONSTRAINT instagram_accounts_auth_method_check
    CHECK (
        auth_method IN (
            'instagram_login',
            'unified_login',
            'instagram_unified_login'
        )
    );

COMMENT ON COLUMN public.instagram_accounts.client_business_id IS
    'Client business portfolio ID returned by /me during Instagram API Unified Login.';

COMMENT ON COLUMN public.instagram_accounts.system_user_id IS
    'Business Integration System User ID returned by /me during Instagram API Unified Login.';

COMMENT ON COLUMN public.instagram_accounts.login_config_id IS
    'Meta Login for Business config_id used to connect this Instagram professional account.';
