/**
 * GET /api/instagram/posts/:accountId
 *
 * Obtiene las publicaciones de Instagram del creador.
 * Incluye paginación mediante cursores y caché temporal.
 */

import { getAuthenticatedUser, unauthorized } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/service';
import { decrypt } from '@/lib/crypto';
import { getEnv } from '@/lib/env';
import { createLogger } from '@/lib/logger';
import { META_API_VERSION, META_UNIFIED_LOGIN_API_VERSION } from '@/lib/instagram/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const logger = createLogger('api:posts');


const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
const CACHE_TTL_MS = 5 * 60_000;
const MAX_CACHE_SIZE = 200;

interface MetaMediaItem {
    id: string;
    media_type: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM';
    thumbnail_url?: string;
    media_url?: string;
    permalink: string;
    timestamp: string;
    caption?: string;
    like_count?: number;
    comments_count?: number;
}

interface MetaMediaResponse {
    data?: MetaMediaItem[];
    paging?: {
        cursors?: {
            before?: string;
            after?: string;
        };
        next?: string;
    };
}

interface PostsPage {
    posts: Array<{
        id: string;
        type: 'reel' | 'image' | 'carousel';
        thumbnail_url: string | null;
        media_url: string | null;
        permalink: string;
        timestamp: string;
        caption: string;
        like_count: number;
        comments_count: number;
    }>;
    nextCursor: string | null;
}

const cache = new Map<string, {
    value: PostsPage;
    at: number;
}>();

type RouteContext = {
    params: Promise<{
        accountId: string;
    }>;
};

function getValidLimit(value: string | null): number {
    if (!value) return DEFAULT_LIMIT;

    const parsed = Number(value);

    if (!Number.isInteger(parsed) || parsed < 1) {
        return DEFAULT_LIMIT;
    }

    return Math.min(parsed, MAX_LIMIT);
}

function cleanCache(): void {
    const now = Date.now();

    for (const [key, entry] of cache.entries()) {
        if (now - entry.at >= CACHE_TTL_MS) {
            cache.delete(key);
        }
    }

    if (cache.size > MAX_CACHE_SIZE) {
        const oldest = [...cache.entries()]
            .sort((a, b) => a[1].at - b[1].at);

        const excess = cache.size - MAX_CACHE_SIZE;

        for (let i = 0; i < excess; i++) {
    const entry = oldest[i];

    if (entry) {
        cache.delete(entry[0]);
    }
}
    }
}

export async function GET(
    request: Request,
    context: RouteContext
): Promise<Response> {

    // 1. AUTENTICACIÓN

    const user = await getAuthenticatedUser(request);

    if (!user) {
        return unauthorized();
    }

    // 2. VALIDAR PARÁMETROS

    const { accountId } = await context.params;

    if (!accountId) {
        return Response.json(
            { error: 'Instagram account ID is required' },
            { status: 400 }
        );
    }

    const url = new URL(request.url);

    const limit = getValidLimit(
        url.searchParams.get('limit')
    );

    const after = url.searchParams.get('after')?.trim() || null;

    // 3. VERIFICAR PROPIEDAD DE LA CUENTA

    const db = createServiceClient();

    const { data: igAccount, error: igError } = await db
        .from('instagram_accounts')
        .select('id, instagram_user_id, access_token_encrypted, auth_method')
        .eq('id', accountId)
        .eq('user_id', user.id)
        .eq('is_active', true)
        .single();

    if (igError || !igAccount) {
        return Response.json(
            { error: 'Instagram account not found' },
            { status: 404 }
        );
    }

    // 4. CONSULTAR CACHÉ

    const authMethod = igAccount.auth_method ?? 'instagram_login';
    const metaGraphBase =
        authMethod === 'instagram_unified_login'
            ? `https://graph.facebook.com/${META_UNIFIED_LOGIN_API_VERSION}`
            : authMethod === 'unified_login'
                ? `https://graph.facebook.com/${META_API_VERSION}`
                : `https://graph.instagram.com/${META_API_VERSION}`;

    cleanCache();

    const cacheKey = `${accountId}:${authMethod}:${limit}:${after ?? 'first'}`;

    const hit = cache.get(cacheKey);

    if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
        return Response.json({
            ...hit.value,
            cached: true
        });
    }

    // 5. DESENCRIPTAR TOKEN

    let accessToken: string;

    try {
        accessToken = decrypt(
            igAccount.access_token_encrypted as string,
            getEnv().TOKEN_ENCRYPTION_KEY
        );
    } catch {
        logger.error(
            { accountId },
            'Failed to decrypt Instagram token'
        );

        return Response.json(
            {
                error: 'Failed to access Instagram account. Please reconnect.'
            },
            { status: 500 }
        );
    }

    // 6. PREPARAR CONSULTA A META

    const fields = [
        'id',
        'media_type',
        'thumbnail_url',
        'media_url',
        'permalink',
        'timestamp',
        'caption',
        'like_count',
        'comments_count'
    ].join(',');

    const mediaUrl = new URL(
        `${metaGraphBase}/${igAccount.instagram_user_id}/media`
    );

    mediaUrl.searchParams.set('fields', fields);
    mediaUrl.searchParams.set('limit', String(limit));

    if (after) {
        mediaUrl.searchParams.set('after', after);
    }

    // 7. CONSULTAR INSTAGRAM

    let metaResponse: MetaMediaResponse;

    try {
        const res = await fetch(mediaUrl.toString(), {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${accessToken}`
            },
            signal: AbortSignal.timeout(20_000),
            cache: 'no-store'
        });

        if (!res.ok) {
            const body = await res.text();

            logger.error(
                {
                    accountId,
                    status: res.status,
                    body: body.slice(0, 300)
                },
                'Meta media fetch failed'
            );

            return Response.json(
                {
                    error: 'Failed to fetch posts from Instagram'
                },
                { status: 502 }
            );
        }

        metaResponse = await res.json() as MetaMediaResponse;

    } catch (err) {

        logger.error(
            { err, accountId },
            'Network error fetching Instagram media'
        );

        return Response.json(
            {
                error: 'Failed to reach Instagram API'
            },
            { status: 502 }
        );
    }

    // 8. TRANSFORMAR PUBLICACIONES

    const posts = (metaResponse.data ?? []).map((item) => ({

        id: item.id,

        type:
            item.media_type === 'VIDEO'
                ? 'reel' as const
                : item.media_type === 'CAROUSEL_ALBUM'
                    ? 'carousel' as const
                    : 'image' as const,

        thumbnail_url:
            item.thumbnail_url ?? item.media_url ?? null,

        media_url:
            item.media_url ?? null,

        permalink: item.permalink,

        timestamp: item.timestamp,

        caption: item.caption ?? '',

        like_count: item.like_count ?? 0,

        comments_count: item.comments_count ?? 0

    }));

    // 9. PAGINACIÓN

    const nextCursor =
        metaResponse.paging?.next &&
        metaResponse.paging?.cursors?.after
            ? metaResponse.paging.cursors.after
            : null;

    const pageData: PostsPage = {
        posts,
        nextCursor
    };

    // 10. GUARDAR EN CACHÉ

    cache.set(cacheKey, {
        value: pageData,
        at: Date.now()
    });

    cleanCache();


    // 11. RESPONDER

    return Response.json({
        ...pageData,
        cached: false
    });
}