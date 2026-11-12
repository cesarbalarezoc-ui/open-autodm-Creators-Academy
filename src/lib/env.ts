/**
 * Server-side environment validation.
 */

import { z } from 'zod';

const serverEnvSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20, 'SUPABASE_SERVICE_ROLE_KEY is required'),
  TOKEN_ENCRYPTION_KEY: z
    .string()
    .regex(/^[0-9a-f]{64}$/i, 'TOKEN_ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes)'),
  CRON_SECRET: z.string().min(16, 'CRON_SECRET must be at least 16 characters'),

  // Private administrator allowlist. Comma-separated Supabase user IDs.
  // An empty value means no application user has administrator access.
  ADMIN_USER_IDS: z.string().default(''),
});

const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url('NEXT_PUBLIC_SUPABASE_URL must be a valid URL'),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20, 'NEXT_PUBLIC_SUPABASE_ANON_KEY is required'),
  NEXT_PUBLIC_APP_URL: z.string().url('NEXT_PUBLIC_APP_URL must be a valid URL (no trailing slash)').optional(),
});

type ServerEnv = z.infer<typeof serverEnvSchema> & z.infer<typeof publicEnvSchema>;

let cached: ServerEnv | null = null;

export function getEnv(): ServerEnv {
  if (cached) return cached;

  const serverResult = serverEnvSchema.safeParse({
    SUPABASE_SERVICE_ROLE_KEY: process.env['SUPABASE_SERVICE_ROLE_KEY'],
    TOKEN_ENCRYPTION_KEY: process.env['TOKEN_ENCRYPTION_KEY'],
    CRON_SECRET: process.env['CRON_SECRET'],
    ADMIN_USER_IDS: process.env['ADMIN_USER_IDS'],
  });

  const publicResult = publicEnvSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env['NEXT_PUBLIC_SUPABASE_URL'],
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'],
    NEXT_PUBLIC_APP_URL: process.env['NEXT_PUBLIC_APP_URL'],
  });

  const issues: string[] = [];

  if (!serverResult.success) {
    issues.push(...serverResult.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`));
  }

  if (!publicResult.success) {
    issues.push(...publicResult.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`));
  }

  if (issues.length > 0) {
    throw new Error(
      `[open-autoDM] Invalid or missing environment variables:\n  - ${issues.join('\n  - ')}\n` +
        'See .env.example for the full list and how to generate each value.'
    );
  }

  cached = { ...serverResult.data!, ...publicResult.data! } as ServerEnv;
  return cached;
}

/**
 * Checks whether an authenticated Supabase user is an application administrator.
 * ADMIN_USER_IDS is private server-side configuration, never exposed to the browser.
 */
export function isAdminUser(userId: string): boolean {
  if (!userId) return false;

  const configuredIds = (process.env['ADMIN_USER_IDS'] ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);

  return configuredIds.includes(userId);
}

/**
 * Resolve the deployment's public base URL.
 * Prefers NEXT_PUBLIC_APP_URL; falls back to the incoming request origin.
 */
export function getAppUrl(request?: Request): string {
  const fromEnv = process.env['NEXT_PUBLIC_APP_URL'];
  if (fromEnv) return fromEnv.replace(/\/$/, '');

  if (request) {
    const url = new URL(request.url);
    const proto = request.headers.get('x-forwarded-proto') ?? url.protocol.replace(':', '');
    const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? url.host;
    return `${proto}://${host}`;
  }

  throw new Error('NEXT_PUBLIC_APP_URL is not set and no request context is available');
}
