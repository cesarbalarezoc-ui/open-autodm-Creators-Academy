/**
 * GET /api/instagram/connect
 *
 * Supports:
 * - instagram_login: Instagram Business Login (existing flow)
 * - unified_login: Facebook Login for Business (alternative flow)
 *
 * The selected method is stored in the signed OAuth state.
 */

import { getAuthenticatedUser, unauthorized } from '@/lib/auth';
import { getMetaSettings } from '@/lib/settings';
import {
  buildOAuthUrl,
  buildInstagramUnifiedLoginUrl,
  signOAuthState,
} from '@/lib/instagram/oauth';
import {
  buildFacebookOAuthUrl,
} from '@/lib/instagram/facebook-oauth';
import { getAppUrl } from '@/lib/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  const user = await getAuthenticatedUser(request);

  if (!user) {
    return unauthorized();
  }

  const settings = await getMetaSettings();

  if (!settings) {
    return Response.json(
      {
        error: 'setup_required',
        message: 'Complete the Setup Wizard before connecting Instagram.',
      },
      { status: 409 }
    );
  }

  const requestUrl = new URL(request.url);
  const requestedMethod = requestUrl.searchParams.get('method');

  const authMethod =
    requestedMethod === 'instagram_login' || requestedMethod === 'unified_login'
      ? requestedMethod
      : 'instagram_unified_login';

  const redirectUri = `${getAppUrl(request)}/api/instagram/callback`;

  if (authMethod === 'instagram_unified_login') {
    const configId = settings.metaLoginConfigId?.trim();
    if (!configId) {
      return Response.json(
        {
          error: 'meta_login_config_required',
          message: 'Configure the Meta Login Configuration ID before connecting Instagram.',
        },
        { status: 409 }
      );
    }

    if (!settings.metaFbAppSecret) {
      return Response.json(
        {
          error: 'meta_app_secret_required',
          message: 'Save the Meta App Secret from App Settings > Basic in the Setup Wizard.',
        },
        { status: 409 }
      );
    }

    const state = await signOAuthState(user.id, 'instagram_unified_login');
    const url = buildInstagramUnifiedLoginUrl(
      settings.metaAppId,
      configId,
      redirectUri,
      state
    );

    return Response.json({ url, authMethod });
  }

  if (!settings.metaAppSecret) {
    return Response.json(
      {
        error: 'legacy_instagram_secret_required',
        message: 'The classic Instagram App Secret is required only for the legacy connection methods.',
      },
      { status: 409 }
    );
  }

  if (authMethod === 'unified_login') {
    const configId = settings.metaLoginConfigId?.trim();

    if (!configId) {
      return Response.json(
        {
          error: 'facebook_config_required',
          message: 'Configure the Facebook Login for Business Configuration ID first.',
        },
        { status: 409 }
      );
    }

    const state = await signOAuthState(user.id, 'unified_login');

    const url = buildFacebookOAuthUrl(
      settings.metaAppId,
      configId,
      redirectUri,
      state
    );

    return Response.json({ url, authMethod });
  }

  const state = await signOAuthState(user.id, 'instagram_login');

  const url = buildOAuthUrl(
    settings.metaAppId,
    redirectUri,
    state
  );

  return Response.json({ url, authMethod });
}