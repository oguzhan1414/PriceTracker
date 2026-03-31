const API_BASE_URL =
    import.meta.env.VITE_API_BASE_URL ||
    `${window.location.protocol}//${window.location.hostname}:8000`;

type ApiRequestOptions = Omit<RequestInit, 'body'> & {
    body?: unknown;
};

const SESSION_EXPIRED_EVENT = 'auth:session-expired';
const SESSION_EXPIRED_FLAG_KEY = 'auth:session-expired:notify';

const AUTH_ME_CACHE_TTL_MS = 10_000;
const PAYMENT_CONFIG_CACHE_TTL_MS = 15_000;
const PAYMENT_SUBSCRIPTION_CACHE_TTL_MS = 10_000;

let lastSessionExpiredEventAt = 0;
const getResponseCache = new Map<string, { expiresAt: number; data: unknown }>();
const getInFlight = new Map<string, Promise<unknown>>();

const getCacheKey = (path: string) => `GET:${path}`;

const invalidateCachedGet = (paths: string[]) => {
    if (paths.length === 0) return;

    for (const path of paths) {
        const key = getCacheKey(path);
        getResponseCache.delete(key);
        getInFlight.delete(key);
    }
};

const primeCachedGet = <T>(path: string, data: T, ttlMs: number) => {
    getResponseCache.set(getCacheKey(path), {
        expiresAt: Date.now() + ttlMs,
        data,
    });
};

function emitSessionExpired() {
    const now = Date.now();
    // Prevent flooding listeners when multiple requests fail at the same time.
    if (now - lastSessionExpiredEventAt < 1500) {
        return;
    }
    lastSessionExpiredEventAt = now;
    sessionStorage.setItem(SESSION_EXPIRED_FLAG_KEY, '1');
    window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
}

async function rawRequest(path: string, options: ApiRequestOptions = {}): Promise<Response> {
    const token = localStorage.getItem("access_token");

    const headers: HeadersInit = {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        ...(options.headers || {}),
    };

    return fetch(`${API_BASE_URL}${path}`, {
        ...options,
        headers,
        credentials: 'include',
        body: options.body ? JSON.stringify(options.body) : undefined,
    });
}

async function tryRefreshToken(): Promise<boolean> {
    try {
        const refreshRes = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
        });
        return refreshRes.ok;
    } catch {
        return false;
    }
}

async function request<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
    let res = await rawRequest(path, options);

    // If access token is expired, try silent refresh once and retry the original request.
    const isAuthRoute =
        path.startsWith('/api/auth/login') ||
        path.startsWith('/api/auth/register') ||
        path.startsWith('/api/auth/refresh') ||
        path.startsWith('/api/auth/logout') ||
        path.startsWith('/api/auth/me');
    if (res.status === 401 && !isAuthRoute) {
        const refreshed = await tryRefreshToken();
        if (refreshed) {
            res = await rawRequest(path, options);
        } else {
            emitSessionExpired();
        }
    }

    if (res.status === 401 && !isAuthRoute) {
        emitSessionExpired();
    }

    let payload: any = null;
    try {
        payload = await res.json();
    } catch {
        payload = null;
    }

    if (!res.ok) {
        const message = payload?.detail || payload?.message || payload?.mesaj || 'An unexpected error occurred';
        throw new Error(message);
    }

    return payload as T;
}

async function requestCachedGet<T>(path: string, ttlMs: number, options?: { force?: boolean }): Promise<T> {
    const key = getCacheKey(path);

    if (!options?.force) {
        const cached = getResponseCache.get(key);
        if (cached && cached.expiresAt > Date.now()) {
            return cached.data as T;
        }

        const inFlight = getInFlight.get(key);
        if (inFlight) {
            return inFlight as Promise<T>;
        }
    }

    const promise = request<T>(path, { method: 'GET' })
        .then((data) => {
            if (ttlMs > 0) {
                primeCachedGet(path, data, ttlMs);
            }
            return data;
        })
        .finally(() => {
            getInFlight.delete(key);
        });

    getInFlight.set(key, promise as Promise<unknown>);
    return promise;
}

export type User = {
    id: string;
    email: string;
    full_name?: string;
    language?: 'en' | 'tr';
    avatar_initial?: string;
    plan?: string;
    subscription_status?: string;
    payment_provider?: string;
    push_notifications?: boolean;
    email_notifications?: boolean;
    telegram_chat_id?: string;
    telegram_connected_at?: string;
};

export type TelegramLinkStartResponse = {
    message: string;
    bot_username: string;
    start_payload: string;
    start_command: string;
    start_url: string;
    expires_at: string;
    ttl_minutes: number;
};

type LoginResponse = {
    message?: string;
    mesaj: string;
    email: string;
    plan: string;
    access_token?: string;
    refresh_token?: string;
};

export type TrackedProduct = {
    id: string;
    name: string;
    source?: string;
    original_url?: string;
    image_url?: string | null;
    current_price?: number | null;
    currency?: string;
    last_checked_at?: string | null;
    created_at?: string;
};

export type TrackedItem = {
    tracked_item_id: string;
    target_price?: number | null;
    is_active?: boolean;
    alerts_active?: boolean;
    created_at: string;
    notification?: {
        telegram_connected?: boolean;
        telegram_connected_raw?: boolean;
        telegram_allowed?: boolean;
        email_notifications_enabled?: boolean;
        last_notification_at?: string | null;
        last_notification_check_at?: string | null;
        last_notification_status?: 'sent' | 'skipped' | 'error' | string | null;
        last_notification_reason?: string | null;
        last_notification_channel?: string | null;
        last_notification_error?: string | null;
    };
    product: TrackedProduct;
};

export const authApi = {
    register: async (email: string, password: string) => {
        const response = await request<{ message?: string; mesaj: string; id: string }>('/api/auth/register', {
            method: 'POST',
            body: { email, password },
        });
        invalidateCachedGet(['/api/auth/me', '/api/payments/config', '/api/payments/subscription']);
        return response;
    },

    login: async (email: string, password: string) => {
        const response = await request<LoginResponse>('/api/auth/login', {
            method: 'POST',
            body: { email, password },
        });
        if (response.access_token) {
            localStorage.setItem("access_token", response.access_token);
        }
        if (response.refresh_token) {
            localStorage.setItem("refresh_token", response.refresh_token);
        }
        invalidateCachedGet(['/api/auth/me', '/api/payments/config', '/api/payments/subscription']);
        return response;
    },

    me: (options?: { force?: boolean }) => requestCachedGet<User>('/api/auth/me', AUTH_ME_CACHE_TTL_MS, options),

    updateProfile: async (payload: { full_name?: string; push_notifications?: boolean; email_notifications?: boolean; language?: 'en' | 'tr' }) => {
        const response = await request<{ message?: string; mesaj: string; user: User }>('/api/auth/profile', {
            method: 'PATCH',
            body: payload,
        });
        primeCachedGet('/api/auth/me', response.user, AUTH_ME_CACHE_TTL_MS);
        invalidateCachedGet(['/api/payments/config', '/api/payments/subscription']);
        return response;
    },

    logout: async () => {
        const response = await request<{ message?: string; mesaj: string }>('/api/auth/logout', { method: 'POST' });
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        invalidateCachedGet(['/api/auth/me', '/api/payments/config', '/api/payments/subscription']);
        return response;
    },
};
export const telegramApi = {
    startLink: () =>
        request<TelegramLinkStartResponse>('/api/telegram/link/start', {
            method: 'POST',
        }),

    disconnect: async () => {
        const response = await request<{ message?: string; mesaj?: string }>('/api/telegram/link', {
            method: 'DELETE',
        });
        invalidateCachedGet(['/api/auth/me']);
        return response;
    },
};

export const trackApi = {
    list: () => request<{
        items: TrackedItem[];
        toplam: number;
        notification_context?: {
            telegram_connected?: boolean;
            telegram_connected_raw?: boolean;
            telegram_allowed?: boolean;
            email_notifications_enabled?: boolean;
            plan?: string;
            max_tracked_items?: number | null;
            current_tracked_items?: number;
        };
    }>('/api/track/my-list', {
        method: 'GET',
    }),

    add: (url: string, targetPrice?: number, currency: string = "TRY") =>
        request<{ message?: string; mesaj: string; product_id: string; scraping: boolean }>('/api/track/add', {
            method: 'POST',
            body: {
                url,
                target_price: targetPrice,
                currency,
            },
        }),

    remove: (itemId: string) =>
        request<{ message?: string; mesaj: string }>(`/api/track/remove/${itemId}`, {
            method: 'DELETE',
        }),

    update: (itemId: string, updates: { target_price?: number; is_active?: boolean; alerts_active?: boolean }) =>
        request<{ message?: string; mesaj: string; guncellenen: Record<string, unknown> }>(`/api/track/update/${itemId}`, {
            method: 'PATCH',
            body: updates,
        }),
};

export type MarketingSendMailResponse = {
    message: string;
    sent: boolean;
};

export const marketingApi = {
    sendMail: (email: string, message: string) =>
        request<MarketingSendMailResponse>('/api/marketing/send-mail', {
            method: 'POST',
            body: { email, message },
        }),
};

export type DebugScrapeNowResponse = {
    message: string;
    started_at: string;
    finished_at: string;
    duration_seconds: number;
};

export type DebugNotifyTestResponse = {
    message: string;
    telegram: {
        connected: boolean;
        sent: boolean;
    };
    email: {
        enabled: boolean;
        sent: boolean;
    };
    timestamp: string;
};

export const internalDebugApi = {
    scrapeNow: () => request<DebugScrapeNowResponse>('/api/internal/debug/scrape-now', { method: 'POST' }),
    notifyTest: () => request<DebugNotifyTestResponse>('/api/internal/debug/notify-test', { method: 'POST' }),
};

export type PaymentConfigResponse = {
    enabled: boolean;
    default_provider: string;
    sandbox_mode?: boolean;
    payment_public_notice?: string;
    providers: string[];
    currency: string;
    price_pro_monthly: number;
    price_pro_yearly: number;
    user_plan: string;
    subscription_status: string;
    payment_provider?: string | null;
    features?: {
        max_tracked_items?: number | null;
        telegram_notifications?: boolean;
        current_tracked_items?: number;
    };
};

export type PaymentCheckoutResponse = {
    message: string;
    provider: string;
    checkout_url: string;
    session_id?: string | null;
};

export type PaymentSubscriptionResponse = {
    plan: string;
    subscription_status: string;
    payment_provider?: string | null;
    latest_checkout?: {
        provider?: string | null;
        status?: string | null;
        created_at?: string | null;
    };
};

export type PaymentVerifyResponse = {
    verified: boolean;
    plan: string;
    interval?: string;
    subscription_end_date?: string;
    message: string;
};

export const paymentApi = {
    config: (options?: { force?: boolean }) => requestCachedGet<PaymentConfigResponse>('/api/payments/config', PAYMENT_CONFIG_CACHE_TTL_MS, options),
    subscription: (options?: { force?: boolean }) => requestCachedGet<PaymentSubscriptionResponse>('/api/payments/subscription', PAYMENT_SUBSCRIPTION_CACHE_TTL_MS, options),
    startCheckout: async (payload: { provider: string; plan?: string; interval?: 'monthly' | 'yearly' }) => {
        const response = await request<PaymentCheckoutResponse>('/api/payments/checkout/start', {
            method: 'POST',
            body: payload,
        });
        invalidateCachedGet(['/api/payments/config', '/api/payments/subscription']);
        return response;
    },
    verify: async (payload: { provider: string; session_id?: string; token?: string }) => {
        const response = await request<PaymentVerifyResponse>('/api/payments/verify', {
            method: 'POST',
            body: payload,
        });
        invalidateCachedGet(['/api/payments/config', '/api/payments/subscription', '/api/auth/me']);
        return response;
    },
};

