ALTER TABLE public.instagram_accounts
ADD COLUMN IF NOT EXISTS facebook_user_token_encrypted TEXT;

ALTER TABLE public.instagram_accounts
ADD COLUMN IF NOT EXISTS facebook_user_token_expires_at TIMESTAMPTZ;