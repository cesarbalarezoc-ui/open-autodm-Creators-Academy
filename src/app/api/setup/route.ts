/**
 * Setup Wizard API.
 * Only authorized administrators can read or modify global Meta settings.
 */

import { z } from 'zod';
import { getAuthenticatedUser, unauthorized } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/service';
import { getMetaSettings, saveMetaSettings } from '@/lib/settings';
import { randomToken } from '@/lib/crypto';
import { getAppUrl, getEnv, isAdminUser } from '@/lib/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SaveSetupSchema = z.object({
  metaAppId: z.string().regex(/^\d{5,25}$/, 'Meta App ID must be numeric'),
  metaAppSecret: z.string().regex(/^[0-9a-f]{32}$/i, 'Meta App Secret must be 32 hex characters'),
  metaFbAppSecret: z
    .string()
    .regex(/^[0-9a-f]{32}$/i, 'Facebook App Secret must be 32 hex characters')
    .optional()
    .or(z.literal('').transform(() => undefined)),
});

function forbidden(): Response {
  return Response.json(
    { error: 'Administrator access required' },
    { status: 403 }
  );
}

function cronSnippet(appUrl: string): string {
  return `-- Run this ONCE in your Supabase project's SQL Editor.
-- It makes Supabase call your deployment every minute to process
-- queued/delayed DM jobs and auto-refresh Instagram tokens.
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'open-autodm-process-jobs',
  '* * * * *',
  $$
  select net.http_post(
    url := '${appUrl}/api/cron/process-jobs',
    headers := jsonb_build_object('Authorization', 'Bearer YOUR_CRON_SECRET'),
    timeout_milliseconds := 55000
  );
  $$
);`;
}

export async function GET(request: Request): Promise<Response> {
  const user = await getAuthenticatedUser(request);
  if (!user) return unauthorized();

  // Only explicitly configured administrators may read global Meta settings.
  if (!isAdminUser(user.id)) return forbidden();

  try {
    getEnv();

    const settings = await getMetaSettings();
    const appUrl = getAppUrl(request);

    const db = createServiceClient();
    const { data: row, error } = await db
      .from('app_settings')
      .select('meta_app_id, webhook_verify_token, setup_completed')
      .eq('id', 1)
      .maybeSingle();

    if (error) {
      console.error('[api:setup] Failed to read app settings');
      return Response.json({ error: 'Failed to read setup settings' }, { status: 500 });
    }

    return Response.json({
      configured: !!settings,
      metaAppId: row?.meta_app_id ?? null,
      webhookVerifyToken: row?.webhook_verify_token ?? null,
      webhookUrl: `${appUrl}/api/webhook`,
      oauthRedirectUri: `${appUrl}/api/instagram/callback`,
      appUrl,
      cronSnippet: cronSnippet(appUrl),
    });
  } catch {
    console.error('[api:setup] Failed to load setup configuration');
    return Response.json({ error: 'Failed to load setup configuration' }, { status: 500 });
  }
}

export async function POST(request: Request): Promise<Response> {
  const user = await getAuthenticatedUser(request);
  if (!user) return unauthorized();

  // Only explicitly configured administrators may modify global Meta settings.
  if (!isAdminUser(user.id)) return forbidden();

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = SaveSetupSchema.safeParse(body);

  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join('; ');

    return Response.json(
      { error: `Validation failed - ${detail}` },
      { status: 400 }
    );
  }

  try {
    getEnv();

    const db = createServiceClient();
    const { data: existing, error: readError } = await db
      .from('app_settings')
      .select('webhook_verify_token')
      .eq('id', 1)
      .maybeSingle();

    if (readError) {
      console.error('[api:setup] Failed to read existing verification token');
      return Response.json({ error: 'Failed to read setup settings' }, { status: 500 });
    }

    const verifyToken =
      (existing?.webhook_verify_token as string | null) ?? randomToken(16);

    await saveMetaSettings({
      metaAppId: parsed.data.metaAppId,
      metaAppSecret: parsed.data.metaAppSecret,
      metaFbAppSecret: parsed.data.metaFbAppSecret ?? null,
      webhookVerifyToken: verifyToken,
    });

    const appUrl = getAppUrl(request);

    return Response.json({
      success: true,
      webhookVerifyToken: verifyToken,
      webhookUrl: `${appUrl}/api/webhook`,
      oauthRedirectUri: `${appUrl}/api/instagram/callback`,
    });
  } catch {
    console.error('[api:setup] Failed to save Meta settings');

    return Response.json(
      { error: 'Failed to save setup configuration' },
      { status: 500 }
    );
  }
}