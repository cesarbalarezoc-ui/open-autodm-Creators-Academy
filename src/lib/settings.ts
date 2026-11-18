/**
 * App settings service - Meta app credentials and Unified Login configuration.
 */

import { createServiceClient } from '@/lib/supabase/service';
import { decrypt, encrypt } from '@/lib/crypto';
import { getEnv } from '@/lib/env';

export interface MetaSettings {
  metaAppId: string;
  metaAppSecret: string | null;
  metaFbAppSecret: string | null;
  metaLoginConfigId: string | null;
  webhookVerifyToken: string;
  setupCompleted: boolean;
}

interface SettingsRow {
  meta_app_id: string | null;
  meta_app_secret_encrypted: string | null;
  meta_fb_app_secret_encrypted: string | null;
  meta_login_config_id: string | null;
  webhook_verify_token: string | null;
  setup_completed: boolean;
}

const CACHE_TTL_MS = 60_000;

let cache: {
  value: MetaSettings | null;
  at: number;
} | null = null;

export async function getMetaSettings(): Promise<MetaSettings | null> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) {
    return cache.value;
  }

  const db = createServiceClient();

  const { data, error } = await db
    .from('app_settings')
    .select(
      'meta_app_id, meta_app_secret_encrypted, meta_fb_app_secret_encrypted, meta_login_config_id, webhook_verify_token, setup_completed'
    )
    .eq('id', 1)
    .maybeSingle<SettingsRow>();

  if (
    error ||
    !data ||
    !data.meta_app_id ||
    (!data.meta_app_secret_encrypted && !data.meta_fb_app_secret_encrypted) ||
    !data.webhook_verify_token
  ) {
    cache = { value: null, at: Date.now() };
    return null;
  }

  const env = getEnv();

  let secret: string | null = null;
  let fbSecret: string | null = null;

  try {
    if (data.meta_app_secret_encrypted) {
      secret = decrypt(
        data.meta_app_secret_encrypted,
        env.TOKEN_ENCRYPTION_KEY
      );
    }

    if (data.meta_fb_app_secret_encrypted) {
      fbSecret = decrypt(
        data.meta_fb_app_secret_encrypted,
        env.TOKEN_ENCRYPTION_KEY
      );
    }
  } catch {
    cache = { value: null, at: Date.now() };
    return null;
  }

  const value: MetaSettings = {
    metaAppId: data.meta_app_id,
    metaAppSecret: secret,
    metaFbAppSecret: fbSecret,
    metaLoginConfigId: data.meta_login_config_id,
    webhookVerifyToken: data.webhook_verify_token,
    setupCompleted: data.setup_completed,
  };

  cache = { value, at: Date.now() };

  return value;
}

export async function saveMetaSettings(input: {
  metaAppId: string;
  metaAppSecret?: string;
  metaFbAppSecret?: string | null;
  metaLoginConfigId?: string | null;
  webhookVerifyToken: string;
}): Promise<void> {
  const env = getEnv();
  const db = createServiceClient();

  const { data: existing, error: readError } = await db
    .from('app_settings')
    .select('meta_app_secret_encrypted, meta_fb_app_secret_encrypted')
    .eq('id', 1)
    .maybeSingle();

  if (readError) {
    throw new Error(`Failed to read existing settings: ${readError.message}`);
  }

  const settingsToSave: Record<string, unknown> = {
    id: 1,
    meta_app_id: input.metaAppId.trim(),
    webhook_verify_token: input.webhookVerifyToken,
    setup_completed: true,
  };

  const appSecret = input.metaAppSecret?.trim();

  if (appSecret) {
    settingsToSave.meta_app_secret_encrypted = encrypt(
      appSecret,
      env.TOKEN_ENCRYPTION_KEY
    );
  } else if (existing?.meta_app_secret_encrypted) {
    settingsToSave.meta_app_secret_encrypted = existing.meta_app_secret_encrypted;
  }

  const fbSecret = input.metaFbAppSecret?.trim();

  if (fbSecret) {
    settingsToSave.meta_fb_app_secret_encrypted = encrypt(
      fbSecret,
      env.TOKEN_ENCRYPTION_KEY
    );
  } else if (existing?.meta_fb_app_secret_encrypted) {
    settingsToSave.meta_fb_app_secret_encrypted = existing.meta_fb_app_secret_encrypted;
  }

  if (
    !settingsToSave.meta_app_secret_encrypted &&
    !settingsToSave.meta_fb_app_secret_encrypted
  ) {
    throw new Error('Meta App Secret from App Settings > Basic is required for initial setup');
  }

  if (input.metaLoginConfigId !== undefined) {
    settingsToSave.meta_login_config_id =
      input.metaLoginConfigId?.trim() || null;
  }

  const { error } = await db
    .from('app_settings')
    .upsert(settingsToSave, { onConflict: 'id' });

  if (error) {
    throw new Error(`Failed to save settings: ${error.message}`);
  }

  cache = null;
}
export function invalidateSettingsCache(): void {
  cache = null;
}