/**
 * GET /api/instagram/callback
 *
 * Supports:
 * - Instagram Business Login
 * - Facebook Login for Business
 *
 * Identity is obtained exclusively from the signed OAuth state.
 */

import { getMetaSettings } from '@/lib/settings';
import { createServiceClient } from '@/lib/supabase/service';
import {
  verifyOAuthState,
  exchangeCodeForToken,
  exchangeForLongLivedToken,
  getInstagramProfile,
} from '@/lib/instagram/oauth';
import {
  exchangeFacebookCode,
  inspectFacebookUserToken,
  getFacebookPagesWithInstagram,
  subscribeFacebookInstagramWebhooks,
} from '@/lib/instagram/facebook-oauth';
import { subscribeToWebhookFields } from '@/lib/instagram/api';
import { encrypt } from '@/lib/crypto';
import { getAppUrl, getEnv } from '@/lib/env';
import { createLogger } from '@/lib/logger';
import { debugLog } from '@/lib/debugLog';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const logger = createLogger('oauth-callback');

export async function GET(request: Request): Promise<Response> {
  const appUrl = getAppUrl(request);

  const settingsRedirect = (params: string): Response =>
    Response.redirect(`${appUrl}/settings?${params}`, 302);

  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const stateToken = url.searchParams.get('state');
  const oauthError = url.searchParams.get('error');

  if (oauthError) {
    logger.warn({ oauthError }, 'User denied Meta authorization');
    return settingsRedirect('instagram_error=access_denied');
  }

  if (!code || !stateToken) {
    return settingsRedirect('instagram_error=invalid_callback');
  }

  let userId: string;
  let authMethod: 'instagram_login' | 'unified_login';

  try {
    const state = await verifyOAuthState(stateToken);
    userId = state.userId;
    authMethod = state.authMethod;
  } catch {
    logger.warn({}, 'OAuth state JWT verification failed');
    return settingsRedirect('instagram_error=state_mismatch');
  }

  const settings = await getMetaSettings();

  if (!settings) {
    return settingsRedirect('instagram_error=setup_required');
  }

  try {
    const redirectUri = `${appUrl}/api/instagram/callback`;
    const env = getEnv();
    const db = createServiceClient();

    let instagramUserId: string;
    let username: string;
    let name: string | null = null;
    let profilePictureUrl: string | null = null;
    let pageId: string | null = null;
    let pageAccessToken: string;
    let facebookUserTokenEncrypted: string | null = null;
    let facebookUserTokenExpiresAt: string | null = null;
    let tokenType = 'bearer';
    let expiresAt: Date | null = null;

    if (authMethod === 'unified_login') {
      await debugLog(
        'oauth',
        'info',
        'facebook_oauth_exchange',
        'processing',
        'Processing Facebook Login for Business',
        { userId }
      );

      const facebookToken = await exchangeFacebookCode(
        code,
        settings.metaAppId,
        settings.metaAppSecret,
        redirectUri
      );

      const tokenInspection = await inspectFacebookUserToken(
        facebookToken.access_token,
        settings.metaAppId,
        settings.metaAppSecret
      );
      const pageLookup = await getFacebookPagesWithInstagram(
        facebookToken.access_token
      );

      const pages = pageLookup.validPages;

      if (pageLookup.totalPages === 0) {
        const missingPermissions = tokenInspection?.missingPermissions ?? [];
        logger.warn(
          { userId, missingPermissions },
          'Facebook token has no accessible Pages'
        );

        return settingsRedirect(
          missingPermissions.length > 0
            ? 'instagram_error=facebook_permissions_missing'
            : 'instagram_error=no_accessible_facebook_pages'
        );
      }

      if (pageLookup.pagesWithInstagramAccount === 0) {
        return settingsRedirect('instagram_error=no_linked_instagram');
      }

      if (pages.length === 0) {
        return settingsRedirect('instagram_error=facebook_page_token_missing');
      }

      if (pages.length > 1) {
        logger.warn(
          { userId, pageCount: pages.length },
          'Multiple Instagram professional accounts found'
        );

        return settingsRedirect(
          'instagram_error=multiple_instagram_accounts'
        );
      }

      const page = pages[0];

      if (!page) {
        return settingsRedirect('instagram_error=facebook_page_token_missing');
      }

      const instagram = page.instagram_business_account;

      if (!instagram?.id || !page.access_token) {
        return settingsRedirect(
          'instagram_error=facebook_page_token_missing'
        );
      }
      instagramUserId = instagram.id;
      username = instagram.username ?? instagram.id;
      profilePictureUrl = instagram.profile_picture_url ?? null;
      pageId = page.id;
      pageAccessToken = page.access_token;
      tokenType = facebookToken.token_type ?? 'bearer';

      facebookUserTokenEncrypted = encrypt(
        facebookToken.access_token,
        env.TOKEN_ENCRYPTION_KEY
      );

      if (facebookToken.expires_in) {
        facebookUserTokenExpiresAt = new Date(
          Date.now() + facebookToken.expires_in * 1000
        ).toISOString();
      }
    } else {
      await debugLog(
        'oauth',
        'info',
        'instagram_oauth_exchange',
        'processing',
        'Processing Instagram Business Login',
        { userId }
      );

      const shortLived = await exchangeCodeForToken(
        code,
        settings.metaAppId,
        settings.metaAppSecret,
        redirectUri
      );

      const longLived = await exchangeForLongLivedToken(
        shortLived.access_token,
        settings.metaAppSecret
      );

      const profile = await getInstagramProfile(
        longLived.access_token
      );

      instagramUserId = profile.user_id;
      username = profile.username;
      name = profile.name ?? null;
      profilePictureUrl = profile.profile_picture_url ?? null;
      pageAccessToken = longLived.access_token;
      expiresAt = new Date(
        Date.now() + longLived.expires_in * 1000
      );
    }

    const encryptedToken = encrypt(
      pageAccessToken,
      env.TOKEN_ENCRYPTION_KEY
    );

    // Ensure the profile exists before inserting the account.
    const { error: profileError } = await db
      .from('profiles')
      .upsert(
        { id: userId },
        { onConflict: 'id', ignoreDuplicates: true }
      );

    if (profileError) {
      throw profileError;
    }

    const accountData = {
      user_id: userId,
      instagram_user_id: instagramUserId,
      username,
      name,
      profile_picture_url: profilePictureUrl,
      access_token_encrypted: encryptedToken,
      token_expires_at: expiresAt?.toISOString() ?? null,
      auth_method: authMethod,
      token_type: tokenType,
      facebook_page_id: pageId,
      facebook_user_token_encrypted: facebookUserTokenEncrypted,
      facebook_user_token_expires_at: facebookUserTokenExpiresAt,
      is_active: true,
      paused_until: null,
      pause_reason: null,
    };

    const { error: insertError } = await db
      .from('instagram_accounts')
      .insert(accountData);

    if (insertError) {
      if (insertError.code !== '23505') {
        throw insertError;
      }

      const { data: existingAccount, error: lookupError } = await db
        .from('instagram_accounts')
        .select('id, user_id')
        .eq('instagram_user_id', instagramUserId)
        .maybeSingle();

      if (lookupError) {
        throw lookupError;
      }

      if (!existingAccount || existingAccount.user_id !== userId) {
        return settingsRedirect(
          'instagram_error=account_already_connected'
        );
      }

      const { error: updateError } = await db
        .from('instagram_accounts')
        .update(accountData)
        .eq('id', existingAccount.id)
        .eq('user_id', userId);

      if (updateError) {
        throw updateError;
      }
    }

    // Subscribe the account using the appropriate token and API host.
    if (authMethod === 'unified_login') {
      const result = await subscribeFacebookInstagramWebhooks(
        instagramUserId,
        pageAccessToken
      );

      if (!result.ok) {
        logger.warn(
          { userId, instagramUserId, response: result.body },
          'Facebook Instagram webhook subscription failed'
        );
      }
    } else {
      await subscribeToWebhookFields(
        instagramUserId,
        pageAccessToken
      );
    }

    await debugLog(
      'oauth',
      'info',
      'oauth_complete',
      'ok',
      `Instagram @${username} connected using ${authMethod}`,
      { userId }
    );

    logger.info(
      { userId, username, authMethod },
      'Instagram account connected'
    );

    return settingsRedirect('instagram_connected=true');
  } catch (err) {
    const message = describeError(err);

    logger.error(
      { err, userId, authMethod },
      'Instagram OAuth callback failed'
    );

    await debugLog(
      'oauth',
      'error',
      'oauth_failed',
      'error',
      `OAuth exchange failed: ${message.slice(0, 300)}`,
      { userId, authMethod }
    );

    if (message.includes('Unsupported request - method type: get')) {
      return settingsRedirect(
        'instagram_error=test_user_required'
      );
    }

    return settingsRedirect(
      `instagram_error=server_error&debug=${encodeURIComponent(
        message.slice(0, 200)
      )}`
    );
  }
}

function describeError(err: unknown): string {
  if (err instanceof Error) {
    return err.message;
  }

  if (err && typeof err === 'object') {
    const error = err as {
      message?: string;
      details?: string;
      hint?: string;
      code?: string;
    };

    const parts = [
      error.message,
      error.details,
      error.code ? `(code ${error.code})` : null,
    ].filter(Boolean);

    if (parts.length) {
      return parts.join(' - ');
    }

    try {
      return JSON.stringify(err).slice(0, 300);
    } catch {
      // Fall through.
    }
  }

  return String(err);
}