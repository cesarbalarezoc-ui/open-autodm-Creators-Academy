
/**
 * Facebook Login for Business OAuth helpers.
 * Separate from Instagram Business Login.
 */

import { META_API_VERSION } from '@/lib/instagram/api';
import { debugLog } from '@/lib/debugLog';

const FACEBOOK_OAUTH_URL =
  `https://www.facebook.com/${META_API_VERSION}/dialog/oauth`;

const FACEBOOK_GRAPH_BASE =
  `https://graph.facebook.com/${META_API_VERSION}`;

export interface FacebookUserTokenResponse {
  access_token: string;
  token_type?: string;
  expires_in?: number;
}

export interface FacebookInstagramAccount {
  id: string;
  username?: string;
  profile_picture_url?: string;
}

export interface FacebookPage {
  id: string;
  name: string;
  access_token: string;
  instagram_business_account?: FacebookInstagramAccount;
}

interface FacebookPagesResponse {
  data?: FacebookPage[];
  paging?: {
    next?: string;
  };
  error?: {
    message: string;
    type?: string;
    code?: number;
  };
}

interface FacebookTokenResponse {
  access_token?: string;
  token_type?: string;
  expires_in?: number;
  error?: {
    message: string;
    type?: string;
    code?: number;
  };
}

export function buildFacebookOAuthUrl(
  appId: string,
  configId: string,
  redirectUri: string,
  state: string
): string {
  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    config_id: configId,
    response_type: 'code',
    override_default_response_type: 'true',
    state,
  });

  return `${FACEBOOK_OAUTH_URL}?${params.toString()}`;
}

export async function exchangeFacebookCode(
  code: string,
  appId: string,
  appSecret: string,
  redirectUri: string
): Promise<FacebookUserTokenResponse> {
  await debugLog(
    'oauth',
    'info',
    'facebook_token_exchange_started',
    'processing',
    'Starting Facebook authorization code exchange'
  );

  try {
    const params = new URLSearchParams({
      client_id: appId,
      client_secret: appSecret,
      redirect_uri: redirectUri,
      code,
    });

    const response = await fetch(
      `${FACEBOOK_GRAPH_BASE}/oauth/access_token?${params.toString()}`,
      {
        method: 'GET',
        cache: 'no-store',
        signal: AbortSignal.timeout(20_000),
      }
    );

    const data = await response.json() as FacebookTokenResponse;

    if (!response.ok || !data.access_token) {
      await debugLog(
        'oauth',
        'error',
        'facebook_token_exchange',
        'error',
        'Facebook token exchange failed',
        {
          httpStatus: response.status,
          errorCode: data.error?.code ?? null,
          errorType: data.error?.type ?? null,
          errorMessage: data.error?.message ?? response.statusText,
        }
      );

      throw new Error(
        `Facebook token exchange failed: ${
          data.error?.message ?? response.statusText
        }`
      );
    }

    await debugLog(
      'oauth',
      'info',
      'facebook_token_exchange',
      'ok',
      'Facebook token exchange completed',
      {
        tokenType: data.token_type ?? 'bearer',
        expiresIn: data.expires_in ?? null,
      }
    );

    return {
      access_token: data.access_token,
      token_type: data.token_type ?? 'bearer',
      expires_in: data.expires_in,
    };
  } catch (err) {
    await debugLog(
      'oauth',
      'error',
      'facebook_token_exchange_exception',
      'error',
      'Facebook token exchange threw an exception',
      {
        errorMessage: err instanceof Error ? err.message : String(err),
      }
    );

    throw err;
  }
}

export interface FacebookTokenInspection {
  isValid: boolean;
  appIdMatches: boolean;
  tokenType: string | null;
  scopes: string[];
  missingPermissions: string[];
  granularScopes: Array<{
    scope: string;
    targetCount: number | null;
  }>;
}

export async function inspectFacebookUserToken(
  userAccessToken: string,
  appId: string,
  appSecret: string
): Promise<FacebookTokenInspection | null> {
  const requiredPermissions = [
    'pages_show_list',
    'pages_read_engagement',
  ];

  await debugLog(
    'oauth',
    'info',
    'facebook_token_inspection_started',
    'processing',
    'Inspecting Facebook user token permissions'
  );

  try {
    const params = new URLSearchParams({
      input_token: userAccessToken,
      access_token: appId + '|' + appSecret,
    });

    const response = await fetch(
      `${FACEBOOK_GRAPH_BASE}/debug_token?${params.toString()}`,
      {
        method: 'GET',
        cache: 'no-store',
        signal: AbortSignal.timeout(20000),
      }
    );

    const payload = await response.json() as {
      data?: {
        app_id?: string;
        type?: string;
        is_valid?: boolean;
        scopes?: string[];
        granular_scopes?: Array<{
          scope: string;
          target_ids?: Array<string | number> | null;
        }>;
      };
      error?: {
        message?: string;
        type?: string;
        code?: number;
      };
    };

    if (!response.ok || payload.error || !payload.data) {
      await debugLog(
        'oauth',
        'warn',
        'facebook_token_inspection',
        'error',
        'Facebook token inspection failed',
        {
          httpStatus: response.status,
          errorCode: payload.error?.code ?? null,
          errorType: payload.error?.type ?? null,
          errorMessage: payload.error?.message ?? response.statusText,
        }
      );
      return null;
    }

    const token = payload.data;
    const scopes = token.scopes ?? [];

    const inspection: FacebookTokenInspection = {
      isValid: token.is_valid === true,
      appIdMatches: token.app_id === appId,
      tokenType: token.type ?? null,
      scopes,
      missingPermissions: requiredPermissions.filter(
        (permission) => !scopes.includes(permission)
      ),
      granularScopes: (token.granular_scopes ?? []).map((item) => ({
        scope: item.scope,
        targetCount: item.target_ids?.length ?? null,
      })),
    };

    await debugLog(
      'oauth',
      'info',
      'facebook_token_inspection',
      inspection.isValid && inspection.appIdMatches ? 'ok' : 'error',
      'Facebook token inspection completed',
      {
        isValid: inspection.isValid,
        appIdMatches: inspection.appIdMatches,
        tokenType: inspection.tokenType,
        scopes: inspection.scopes,
        missingPermissions: inspection.missingPermissions,
        granularScopes: inspection.granularScopes,
      }
    );

    return inspection;
  } catch (err) {
    await debugLog(
      'oauth',
      'warn',
      'facebook_token_inspection_exception',
      'error',
      'Facebook token inspection threw an exception',
      {
        errorMessage: err instanceof Error ? err.message : String(err),
      }
    );
    return null;
  }
}
export interface FacebookPagesLookupResult {
  validPages: FacebookPage[];
  totalPages: number;
  pagesWithPageToken: number;
  pagesWithInstagramAccount: number;
}

export async function getFacebookPagesWithInstagram(
  userAccessToken: string
): Promise<FacebookPagesLookupResult> {
  const pages: FacebookPage[] = [];

  await debugLog(
    'oauth',
    'info',
    'facebook_pages_lookup_started',
    'processing',
    'Starting Facebook Pages and Instagram account lookup'
  );

  try {
    const params = new URLSearchParams({
      fields:
        'id,name,access_token,instagram_business_account{id,username,profile_picture_url}',
      limit: '100',
      access_token: userAccessToken,
    });

    let nextUrl: string | null =
      `${FACEBOOK_GRAPH_BASE}/me/accounts?${params.toString()}`;

    let pageNumber = 0;

    while (nextUrl) {
      pageNumber += 1;

      await debugLog(
        'oauth',
        'info',
        'facebook_pages_request_started',
        'processing',
        'Requesting Facebook Pages from Graph API',
        { pageNumber }
      );

      const response = await fetch(nextUrl, {
        method: 'GET',
        cache: 'no-store',
        signal: AbortSignal.timeout(20_000),
      });

      const data = await response.json() as FacebookPagesResponse;

      if (!response.ok || data.error) {
        await debugLog(
          'oauth',
          'error',
          'facebook_pages_lookup',
          'error',
          'Facebook Pages lookup failed',
          {
            httpStatus: response.status,
            errorCode: data.error?.code ?? null,
            errorType: data.error?.type ?? null,
            errorMessage: data.error?.message ?? response.statusText,
            pagesRetrievedBeforeError: pages.length,
          }
        );

        throw new Error(
          `Facebook Pages lookup failed: ${
            data.error?.message ?? response.statusText
          }`
        );
      }

      const receivedPages = data.data ?? [];

      await debugLog(
        'oauth',
        'info',
        'facebook_pages_page_received',
        'ok',
        'Facebook Pages response received',
        {
          httpStatus: response.status,
          pageNumber,
          pageCount: receivedPages.length,
          pagesWithPageToken: receivedPages.filter(
            (page) => Boolean(page.access_token)
          ).length,
          pagesWithInstagramAccount: receivedPages.filter(
            (page) => Boolean(page.instagram_business_account?.id)
          ).length,
        }
      );

      pages.push(...receivedPages);
      nextUrl = data.paging?.next ?? null;
    }

    const pagesWithPageToken = pages.filter(
      (page) => Boolean(page.access_token)
    ).length;

    const pagesWithInstagramAccount = pages.filter(
      (page) => Boolean(page.instagram_business_account?.id)
    ).length;

    const validPages = pages.filter(
      (page) =>
        Boolean(page.id) &&
        Boolean(page.access_token) &&
        Boolean(page.instagram_business_account?.id)
    );

    await debugLog(
      'oauth',
      'info',
      'facebook_pages_lookup',
      'ok',
      'Facebook Pages lookup completed',
      {
        totalPages: pages.length,
        pagesWithPageToken,
        pagesWithInstagramAccount,
        pagesWithBoth: validPages.length,
      }
    );

    return {
      validPages,
      totalPages: pages.length,
      pagesWithPageToken,
      pagesWithInstagramAccount,
    };
  } catch (err) {
    await debugLog(
      'oauth',
      'error',
      'facebook_pages_lookup_exception',
      'error',
      'Facebook Pages lookup threw an exception',
      {
        errorMessage: err instanceof Error ? err.message : String(err),
        pagesRetrievedBeforeError: pages.length,
      }
    );

    throw err;
  }
}
export async function subscribeFacebookInstagramWebhooks(
  instagramUserId: string,
  pageAccessToken: string
): Promise<{ ok: boolean; body: string }> {
  const params = new URLSearchParams({
    subscribed_fields:
      'comments,messages,messaging_postbacks,message_reactions,message_edit',
    access_token: pageAccessToken,
  });

  const response = await fetch(
    `${FACEBOOK_GRAPH_BASE}/${instagramUserId}/subscribed_apps`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
      cache: 'no-store',
      signal: AbortSignal.timeout(20_000),
    }
  );

  const body = await response.text();

  return {
    ok: response.ok,
    body,
  };
}