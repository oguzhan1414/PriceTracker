import { useCallback, useEffect, useState } from 'react';
import { trackApi, type TrackedItem } from '../lib/api';

type TrackedListResponse = {
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
};

const TRACKED_LIST_CACHE_TTL_MS = 15_000;

let inFlightListRequest: Promise<TrackedListResponse> | null = null;
let trackedListCache: TrackedListResponse | null = null;
let trackedListCacheAt = 0;

const setTrackedListCache = (data: TrackedListResponse) => {
    trackedListCache = data;
    trackedListCacheAt = Date.now();
};

const getTrackedListCache = () => trackedListCache;

const hasFreshTrackedListCache = () => {
    if (!trackedListCache) return false;
    return Date.now() - trackedListCacheAt < TRACKED_LIST_CACHE_TTL_MS;
};

const loadTrackedList = async (): Promise<TrackedListResponse> => {
    if (hasFreshTrackedListCache()) {
        return trackedListCache as TrackedListResponse;
    }

    if (inFlightListRequest) {
        return inFlightListRequest;
    }

    inFlightListRequest = trackApi.list().finally(() => {
        inFlightListRequest = null;
    });

    const response = await inFlightListRequest;
    setTrackedListCache(response);
    return response;
};

export const useTrackedItems = () => {
    const cachedSnapshot = getTrackedListCache();
    const [items, setItems] = useState<TrackedItem[]>(cachedSnapshot?.items || []);
    const [notificationContext, setNotificationContext] = useState<{
        telegram_connected?: boolean;
        telegram_connected_raw?: boolean;
        telegram_allowed?: boolean;
        email_notifications_enabled?: boolean;
        plan?: string;
        max_tracked_items?: number | null;
        current_tracked_items?: number;
    } | null>(cachedSnapshot?.notification_context || null);
    const [isLoading, setIsLoading] = useState(!cachedSnapshot);
    const [error, setError] = useState<string | null>(null);

    const applySnapshot = useCallback((snapshot: TrackedListResponse) => {
        setItems(snapshot.items || []);
        setNotificationContext(snapshot.notification_context || null);
    }, []);

    const load = useCallback(async (options?: { force?: boolean }) => {
        setError(null);
        const shouldUseCache = !options?.force && hasFreshTrackedListCache();

        if (shouldUseCache) {
            const snapshot = getTrackedListCache();
            if (snapshot) {
                applySnapshot(snapshot);
                return;
            }
        }

        const res = options?.force ? await trackApi.list() : await loadTrackedList();
        if (options?.force) {
            setTrackedListCache(res);
        }
        applySnapshot(res);
    }, [applySnapshot]);

    useEffect(() => {
        const snapshot = getTrackedListCache();
        if (snapshot) {
            applySnapshot(snapshot);
            setIsLoading(false);
            // Keep data fresh in background after initial paint.
            void load().catch(() => undefined);
            return;
        }

        const init = async () => {
            try {
                await load({ force: true });
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to load tracked items');
            } finally {
                setIsLoading(false);
            }
        };

        void init();
    }, [applySnapshot, load]);

    const add = useCallback(async (url: string, targetPrice?: number) => {
        await trackApi.add(url, targetPrice);
        await load({ force: true });
    }, [load]);

    const remove = useCallback(async (itemId: string) => {
        await trackApi.remove(itemId);
        setItems((prev) => {
            const next = prev.filter((item) => item.tracked_item_id !== itemId);
            const snapshot = getTrackedListCache();
            setNotificationContext((current) => current
                ? {
                    ...current,
                    current_tracked_items: next.length,
                }
                : current);
            if (snapshot) {
                setTrackedListCache({
                    ...snapshot,
                    items: next,
                    toplam: next.length,
                    notification_context: snapshot.notification_context
                        ? {
                            ...snapshot.notification_context,
                            current_tracked_items: next.length,
                        }
                        : snapshot.notification_context,
                });
            }
            return next;
        });
    }, []);

    const update = useCallback(async (itemId: string, updates: { target_price?: number; is_active?: boolean; alerts_active?: boolean }) => {
        await trackApi.update(itemId, updates);
        setItems((prev) => {
            const next = updates.is_active === false
                ? prev.filter((item) => item.tracked_item_id !== itemId)
                : prev.map((item) => {
                    if (item.tracked_item_id !== itemId) {
                        return item;
                    }

                    return {
                        ...item,
                        target_price: updates.target_price ?? item.target_price,
                        is_active: updates.is_active ?? item.is_active,
                        alerts_active: updates.alerts_active ?? item.alerts_active,
                    };
                });

            setNotificationContext((current) => current
                ? {
                    ...current,
                    current_tracked_items: next.length,
                }
                : current);

            const snapshot = getTrackedListCache();
            if (snapshot) {
                setTrackedListCache({
                    ...snapshot,
                    items: next,
                    toplam: next.length,
                    notification_context: snapshot.notification_context
                        ? {
                            ...snapshot.notification_context,
                            current_tracked_items: next.length,
                        }
                        : snapshot.notification_context,
                });
            }

            return next;
        });

        // Keep UI instant, then reconcile in background with server state.
        void load({ force: true }).catch(() => undefined);
    }, [load]);

    return {
        items,
        notificationContext,
        isLoading,
        error,
        refresh: load,
        add,
        remove,
        update,
    };
};

