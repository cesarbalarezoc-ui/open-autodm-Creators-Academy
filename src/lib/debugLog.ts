
/**
 * Debug event logger.
 * Confirms database writes and never stores access tokens or secrets.
 */

import { createServiceClient } from '@/lib/supabase/service';

export type DebugLevel = 'info' | 'warn' | 'error';
export type DebugStatus = 'ok' | 'error' | 'skipped' | 'processing';

export async function debugLog(
  service: 'webhook' | 'worker' | 'instagram' | 'oauth' | 'cron',
  level: DebugLevel,
  eventType: string,
  status: DebugStatus,
  message: string,
  metadata: Record<string, unknown> = {}
): Promise<void> {
  try {
    const db = createServiceClient();

    const { error } = await db.from('debug_events').insert({
      service,
      level,
      event_type: eventType,
      status,
      message,
      metadata,
    });

    if (error) {
      console.error('[debugLog] Database insert failed:', error.message);
    }
  } catch (err) {
    console.error(
      '[debugLog] Unexpected error:',
      err instanceof Error ? err.message : String(err)
    );
  }
}