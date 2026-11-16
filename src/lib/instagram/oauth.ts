/**
 * Instagram Business Login OAuth helpers.
 *
 * Supports two authentication methods:
 * - instagram_login: Instagram Business Login.
 * - unified_login: Facebook Login for Business.
 *
 * OAuth state is signed and includes the authentication method.
 */

import { SignJWT, jwtVerify } from 'jose';
import { getEnv } from '@/lib/env';
import { randomToken } from '@/lib/crypto';
import type {
    IgShortLivedTokenResponse,
    IgLongLivedTokenResponse,
    IgUserProfile,
} from '@/lib/types';

export type InstagramAuthMethod = 'instagram_login' | 'unified_login';

const IG_OAUTH_URL = 'https://www.instagram.com/oauth/authorize';
const IG_TOKEN_URL = 'https://api.instagram.com/oauth/access_token';
const IG_LONG_LIVED_URL = 'https://graph.instagram.com/access_token';
const IG_GRAPH_BASE = 'https://graph.instagram.com';

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

    const authMethod =
        payload.authMethod === 'unified_login'
            ? 'unified_login'
            : 'instagram_login';

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