/**
 * Debug panel API - recent automation events.
 * GET    -> newest 200 events (admin only)
 * DELETE -> clear the log (admin only)
 */

import { getAuthenticatedUser, unauthorized } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/service';
import { isAdminUser } from '@/lib/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function forbidden(): Response {
  return Response.json(
    { error: 'Administrator access required' },
    { status: 403 }
  );
}

export async function GET(request: Request): Promise<Response> {
  const user = await getAuthenticatedUser(request);
  if (!user) return unauthorized();

  if (!isAdminUser(user.id)) return forbidden();

  const db = createServiceClient();
  const { data, error } = await db
    .from('debug_events')
    .select('id, created_at, service, level, event_type, status, message, metadata')
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) {
    return Response.json(
      { error: 'Failed to fetch debug events' },
      { status: 500 }
    );
  }

  return Response.json({ events: data ?? [] });
}

export async function DELETE(request: Request): Promise<Response> {
  const user = await getAuthenticatedUser(request);
  if (!user) return unauthorized();

  if (!isAdminUser(user.id)) return forbidden();

  const db = createServiceClient();
  const { error } = await db
    .from('debug_events')
    .delete()
    .gte('created_at', '1970-01-01');

  if (error) {
    return Response.json(
      { error: 'Failed to clear debug events' },
      { status: 500 }
    );
  }

  return Response.json({ success: true });
}