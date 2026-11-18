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
  getAssignedInstagramAccounts,
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

    const instagramAccounts: Array<{
      id: string;
      username?: string;
      name?: string;
      profile_picture_url?: string;
    }> = [];
    let accessToken: string;
    let tokenType = 'bearer';
    let expiresAt: Date | null = null;

    if (authMethod === 'unified_login') {
      await debugLog(
        'oauth',
        'info',
        'facebook_oauth_exchange',
        'processing',
        'Processing Facebook Login for Business (Unified Login)',
        { userId }
      );

      // Facebook Login for Business uses the Facebook app secret. The returned
      // SUAT is scoped to the business assets explicitly selected in Meta.
      const facebookAppSecret = settings.metaFbAppSecret ?? settings.metaAppSecret;
      const facebookToken = await exchangeFacebookCode(
        code,
        settings.metaAppId,
        facebookAppSecret,
        redirectUri
      );

      const tokenInspection = await inspectFacebookUserToken(
        facebookToken.access_token,
        settings.metaAppId,
        facebookAppSecret
      );

      if (tokenInspection && (!tokenInspection.isValid || !tokenInspection.appIdMatches)) {
        throw new Error('Meta returned an invalid access token or a token for a different app.');
      }

      // Unified Login grants Instagram assets directly. Do not depend on a
      // Facebook Page or /me/accounts for this flow.
      try {
        instagramAccounts.push(
          ...(await getAssignedInstagramAccounts(facebookToken.access_token))
        );
      } catch (assetError) {
        const message = assetError instanceof Error ? assetError.message : String(assetError);
        if (/permission|code 200|code 10/i.test(message)) {
          return settingsRedirect('instagram_error=unified_login_permissions_required');
        }
        throw assetError;
      }

      if (instagramAccounts.length === 0) {
        return settingsRedirect('instagram_error=no_assigned_instagram_accounts');
      }

      accessToken = facebookToken.access_token;
      tokenType = tokenInspection?.tokenType ?? 'SYSTEM_USER';

      // The selected configuration is set to "Never". Keep the database
      // expiry null unless Meta explicitly returns an expiry.
      if (facebookToken.expires_in) {
        expiresAt = new Date(Date.now() + facebookToken.expires_in * 1000);
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

      const profile = await getInstagramProfile(longLived.access_token);

      instagramAccounts.push({
        id: profile.user_id,
        username: profile.username,
        name: profile.name ?? undefined,
        profile_picture_url: profile.profile_picture_url ?? undefined,
      });
      accessToken = longLived.access_token;
      tokenType = longLived.token_type;
      expiresAt = new Date(Date.now() + longLived.expires_in * 1000);
    }

    const encryptedToken = encrypt(
      accessToken,
      env.TOKEN_ENCRYPTION_KEY
    );

    // Ensure the authenticated platform profile exists before saving any
    // connected Instagram assets for this user.
    const { error: profileError } = await db
      .from('profiles')
      .upsert(
        { id: userId },
        { onConflict: 'id', ignoreDuplicates: true }
      );

    if (profileError) {
      throw profileError;
    }

    // A configuration can grant one or more Instagram assets. Save each
    // selected asset under the user from the signed OAuth state, and never
    // transfer an Instagram account already owned by a different platform user.
    for (const instagram of instagramAccounts) {
      const instagramUserId = instagram.id;
      const username = instagram.username ?? instagram.id;

      const accountData = {
        user_id: userId,
        instagram_user_id: instagramUserId,
        username,
        name: instagram.name ?? null,
        profile_picture_url: instagram.profile_picture_url ?? null,
        access_token_encrypted: encryptedToken,
        token_expires_at: expiresAt?.toISOString() ?? null,
        auth_method: authMethod,
        token_type: tokenType,
        facebook_page_id: null,
        facebook_user_token_encrypted: null,
        facebook_user_token_expires_at: null,
        is_active: true,
        paused_until: null,
        pause_reason: null,
      };

      const { data: existingAccount, error: lookupError } = await db
        .from('instagram_accounts')
        .select('id, user_id')
        .eq('instagram_user_id', instagramUserId)
        .maybeSingle();

      if (lookupError) {
        throw lookupError;
      }

      if (existingAccount && existingAccount.user_id !== userId) {
        return settingsRedirect('instagram_error=account_already_connected');
      }

      if (existingAccount) {
        const { error: updateError } = await db
          .from('instagram_accounts')
          .update(accountData)
          .eq('id', existingAccount.id)
          .eq('user_id', userId);

        if (updateError) {
          throw updateError;
        }
      } else {
        const { error: insertError } = await db
          .from('instagram_accounts')
          .insert(accountData);

        if (insertError) {
          // A concurrent OAuth callback may have inserted this account after
          // the lookup. Re-check ownership before updating it.
          if (insertError.code !== '23505') {
            throw insertError;
          }

          const { data: racedAccount, error: raceLookupError } = await db
            .from('instagram_accounts')
            .select('id, user_id')
            .eq('instagram_user_id', instagramUserId)
            .maybeSingle();

          if (raceLookupError) {
            throw raceLookupError;
          }

          if (!racedAccount || racedAccount.user_id !== userId) {
            return settingsRedirect('instagram_error=account_already_connected');
          }

          const { error: raceUpdateError } = await db
            .from('instagram_accounts')
            .update(accountData)
            .eq('id', racedAccount.id)
            .eq('user_id', userId);

          if (raceUpdateError) {
            throw raceUpdateError;
          }
        }
      }

      // Subscribe each selected Instagram account with the token and API
      // host that belong to its authentication method.
      if (authMethod === 'unified_login') {
        const result = await subscribeFacebookInstagramWebhooks(
          instagramUserId,
          accessToken
        );

        if (!result.ok) {
          logger.warn(
            { userId, instagramUserId, response: result.body.slice(0, 300) },
            'Unified Login Instagram webhook subscription failed'
          );
        }
      } else {
        const result = await subscribeToWebhookFields(
          instagramUserId,
          accessToken,
          'instagram_login'
        );

        if (!result.ok) {
          logger.warn(
            { userId, instagramUserId, response: result.body.slice(0, 300) },
            'Instagram webhook subscription failed'
          );
        }
      }

      await debugLog(
        'oauth',
        'info',
        'instagram_asset_connected',
        'ok',
        `Instagram @${username} connected using ${authMethod}`,
        { userId, instagramUserId }
      );
    }

    await debugLog(
      'oauth',
      'info',
      'oauth_complete',
      'ok',
      `${instagramAccounts.length} Instagram account(s) connected using ${authMethod}`,
      { userId, accountCount: instagramAccounts.length }
    );

    logger.info(
      { userId, accountCount: instagramAccounts.length, authMethod },
      'Instagram account(s) connected'
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