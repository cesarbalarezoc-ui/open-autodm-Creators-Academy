/**
 * Instagram OAuth helpers.
 *
 * Supports the legacy Instagram Business Login and legacy Facebook Login
 * flows, plus the current Instagram API with Unified Login flow.
 * OAuth state is signed and includes the selected authentication method.
 */

import { SignJWT, jwtVerify } from 'jose';
import { getEnv } from '@/lib/env';
import { randomToken } from '@/lib/crypto';
import type {
    IgShortLivedTokenResponse,
    IgLongLivedTokenResponse,
    IgUserProfile,
} from '@/lib/types';

export type InstagramAuthMethod = 'instagram_login' | 'unified_login' | 'instagram_unified_login';

const IG_OAUTH_URL = 'https://www.instagram.com/oauth/authorize';
const IG_TOKEN_URL = 'https://api.instagram.com/oauth/access_token';
const IG_LONG_LIVED_URL = 'https://graph.instagram.com/access_token';
const IG_GRAPH_BASE = 'https://graph.instagram.com';
const META_UNIFIED_GRAPH_BASE = 'https://graph.facebook.com/v27.0';

export const REQUIRED_SCOPES = [
    'instagram_business_basic',
    'instagram_business_manage_messages',
    'instagram_business_manage_comments',
].join(',');

function stateSecret(): Uint8Array {
    return new TextEncoder().encode(
        `state:${getEnv().TOKEN_ENCRYPTION_KEY}`
    );
}

/**
 * Creates a signed OAuth state containing the user and authentication method.
 */
export async function signOAuthState(
    userId: string,
    authMethod: InstagramAuthMethod = 'instagram_login'
): Promise<string> {
    return new SignJWT({
        userId,
        authMethod,
        nonce: randomToken(8),
    })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('10m')
        .sign(stateSecret());
}

/**
 * Verifies OAuth state and retrieves its trusted authentication method.
 */
export async function verifyOAuthState(
    token: string
): Promise<{
    userId: string;
    authMethod: InstagramAuthMethod;
}> {
    const { payload } = await jwtVerify(token, stateSecret());

    if (typeof payload.userId !== 'string') {
        throw new Error('Invalid OAuth state payload');
    }

    const savedMethod = payload.authMethod;
    let authMethod: InstagramAuthMethod;
    if (
        savedMethod === 'unified_login' ||
        savedMethod === 'instagram_unified_login' ||
        savedMethod === 'instagram_login'
    ) {
        authMethod = savedMethod;
    } else if (savedMethod === undefined) {
        authMethod = 'instagram_login';
    } else {
        throw new Error('Invalid OAuth authentication method');
    }

    return {
        userId: payload.userId,
        authMethod,
    };
}

/**
 * Builds the existing Instagram Business Login URL.
 */
export function buildOAuthUrl(
    appId: string,
    redirectUri: string,
    state: string
): string {
    const params = new URLSearchParams({
        client_id: appId,
        redirect_uri: redirectUri,
        scope: REQUIRED_SCOPES,
        response_type: 'code',
        state,
    });

    return `${IG_OAUTH_URL}?${params.toString()}`;
}

/**
 * Builds the Meta Login for Business URL for Instagram API with Unified Login.
 * Clients can choose Instagram login in Meta's dialog.
 */
export function buildInstagramUnifiedLoginUrl(
    appId: string,
    configId: string,
    redirectUri: string,
    state: string
): string {
    const params = new URLSearchParams({
        client_id: appId,
        config_id: configId,
        redirect_uri: redirectUri,
        response_type: 'code',
        display: 'popup',
        prompt: 'login',
        state,
    });

    return 'https://www.facebook.com/dialog/oauth?' + params.toString();
}

export interface InstagramUnifiedTokenResponse {
    access_token: string;
    token_type?: string;
    expires_in?: number;
}

export interface InstagramUnifiedAccount {
    id: string;
    username: string;
}

export interface InstagramUnifiedIdentity {
    clientBusinessId: string;
    systemUserId: string;
}

/**
 * Exchanges the authorization code for a Business Integration System User token.
 * This request stays server-side and uses the Meta App Secret.
 */
export async function exchangeInstagramUnifiedCode(
    code: string,
    appId: string,
    appSecret: string
): Promise<InstagramUnifiedTokenResponse> {
    const params = new URLSearchParams({
        client_id: appId,
        client_secret: appSecret,
        code,
    });

    const res = await fetch(
        META_UNIFIED_GRAPH_BASE + '/oauth/access_token?' + params.toString(),
        {
            signal: AbortSignal.timeout(20_000),
            cache: 'no-store',
        }
    );

    const payload = await res.json().catch(() => ({})) as
        InstagramUnifiedTokenResponse & { error?: { message?: string } };

    if (!res.ok) {
        throw new Error(
            'Instagram Unified Login token exchange failed: ' +
            res.status + ' ' +
            (payload.error?.message ?? 'Meta rejected the authorization code')
        );
    }

    if (!payload.access_token) {
        throw new Error('Instagram Unified Login returned no access token');
    }

    return payload;
}

/** Reads the client business portfolio and system-user IDs from /me. */
export async function getInstagramUnifiedIdentity(
    accessToken: string
): Promise<InstagramUnifiedIdentity> {
    const params = new URLSearchParams({
        fields: 'client_business_id',
        access_token: accessToken,
    });

    const res = await fetch(
        META_UNIFIED_GRAPH_BASE + '/me?' + params.toString(),
        {
            signal: AbortSignal.timeout(20_000),
            cache: 'no-store',
        }
    );

    const payload = await res.json().catch(() => ({})) as {
        id?: string;
        client_business_id?: string;
        error?: { message?: string };
    };

    if (!res.ok || !payload.id || !payload.client_business_id) {
        throw new Error(
            'Could not read the client business portfolio from Meta: ' +
            (payload.error?.message ?? ('HTTP ' + res.status))
        );
    }

    return {
        clientBusinessId: payload.client_business_id,
        systemUserId: payload.id,
    };
}

/**
 * Retrieves every Instagram professional account shared through Unified Login.
 * Pagination uses Meta's cursor instead of following a server-provided URL.
 */
export async function getInstagramUnifiedAccounts(
    accessToken: string
): Promise<InstagramUnifiedAccount[]> {
    const accounts: InstagramUnifiedAccount[] = [];
    let after: string | null = null;

    for (let page = 0; page < 25; page += 1) {
        const params = new URLSearchParams({
            fields: 'id,username',
            access_token: accessToken,
        });
        if (after) params.set('after', after);

        const res = await fetch(
            META_UNIFIED_GRAPH_BASE + '/me/assigned_instagram_accounts?' + params.toString(),
            {
                signal: AbortSignal.timeout(20_000),
                cache: 'no-store',
            }
        );

        const payload = await res.json().catch(() => ({})) as {
            data?: Array<{ id?: string; username?: string }>;
            paging?: { cursors?: { after?: string } };
            error?: { message?: string };
        };

        if (!res.ok) {
            throw new Error(
                'Could not retrieve Instagram accounts shared with the app: ' +
                (payload.error?.message ?? ('HTTP ' + res.status))
            );
        }

        for (const item of payload.data ?? []) {
            if (item.id) {
                accounts.push({
                    id: item.id,
                    username: item.username?.trim() || item.id,
                });
            }
        }

        const next = payload.paging?.cursors?.after ?? null;
        if (!next || next === after || (payload.data?.length ?? 0) === 0) {
            break;
        }
        after = next;
    }

    return accounts;
}

/**
 * Exchanges Instagram authorization code for a short-lived token.
 */
export async function exchangeCodeForToken(
    code: string,
    appId: string,
    appSecret: string,
    redirectUri: string
): Promise<IgShortLivedTokenResponse> {
    const form = new FormData();

    form.append('client_id', appId);
    form.append('client_secret', appSecret);
    form.append('grant_type', 'authorization_code');
    form.append('redirect_uri', redirectUri);
    form.append('code', code);

    const res = await fetch(IG_TOKEN_URL, {
        method: 'POST',
        body: form,
        signal: AbortSignal.timeout(20_000),
        cache: 'no-store',
    });

    if (!res.ok) {
        const body = await res.text();

        throw new Error(
            `Instagram token exchange failed: ${res.status} ${body}`
        );
    }

    const json = await res.json() as
        | IgShortLivedTokenResponse
        | { data?: IgShortLivedTokenResponse[] };

    const token =
        'data' in json && Array.isArray(json.data)
            ? json.data[0]
            : json as IgShortLivedTokenResponse;

    if (!token?.access_token) {
        throw new Error('Instagram token exchange returned no access_token');
    }

    return token;
}

/**
 * Exchanges Instagram short-lived token for long-lived token.
 */
export async function exchangeForLongLivedToken(
    shortLivedToken: string,
    appSecret: string
): Promise<IgLongLivedTokenResponse> {
    const params = new URLSearchParams({
        grant_type: 'ig_exchange_token',
        client_secret: appSecret,
        access_token: shortLivedToken,
    });

    const res = await fetch(
        `${IG_LONG_LIVED_URL}?${params.toString()}`,
        {
            signal: AbortSignal.timeout(20_000),
            cache: 'no-store',
        }
    );

    if (!res.ok) {
        const body = await res.text();

        throw new Error(
            `Instagram long-lived token exchange failed: ${res.status} ${body}`
        );
    }

    return await res.json() as IgLongLivedTokenResponse;
}

/**
 * Retrieves the Instagram account profile.
 */
export async function getInstagramProfile(
    accessToken: string
): Promise<IgUserProfile> {
    const fields = 'user_id,username,name,profile_picture_url';

    const params = new URLSearchParams({
        fields,
        access_token: accessToken,
    });

    const res = await fetch(
        `${IG_GRAPH_BASE}/me?${params.toString()}`,
        {
            signal: AbortSignal.timeout(20_000),
            cache: 'no-store',
        }
    );

    if (!res.ok) {
        const body = await res.text();

        throw new Error(
            `Instagram profile fetch failed: ${res.status} ${body}`
        );
    }

    return await res.json() as IgUserProfile;
}

/**
 * Refreshes an Instagram long-lived token.
 */
export async function refreshLongLivedToken(
    currentToken: string
): Promise<
    | { access_token: string; expires_in: number }
    | { error: 'invalid' | 'failed'; status: number; body: string }
> {
    const params = new URLSearchParams({
        grant_type: 'ig_refresh_token',
        access_token: currentToken,
    });

    const res = await fetch(
        `${IG_GRAPH_BASE}/refresh_access_token?${params.toString()}`,
        {
            signal: AbortSignal.timeout(20_000),
            cache: 'no-store',
        }
    );

    if (!res.ok) {
        const body = await res.text();

        return {
            error: res.status === 400 || res.status === 401
                ? 'invalid'
                : 'failed',
            status: res.status,
            body,
        };
    }

    return await res.json() as {
        access_token: string;
        expires_in: number;
    };
}