import { useMemo, useState } from 'react';
import { ExternalLink, Trash2, Bell, BellOff, Plus, TrendingUp, TrendingDown, Minus, Clock, Zap, Edit2, Info } from 'lucide-react';
import { AreaChart, Area, ResponsiveContainer, Tooltip } from 'recharts';
import { useAuth } from '../../auth/AuthContext';
import { useTrackedItems } from '../../hooks/useTrackedItems';
import { useToast } from '../../ui/ToastContext';
import './Watchlist.css';

const FALLBACK_IMAGE = 'https://placehold.co/400x400/0f172a/38bdf8?text=Image';

const formatCurrency = (value: number | null | undefined, currencyCode: string = 'TRY', locale: string, isTr: boolean) => {
    if (value == null) return isTr ? 'Bekleniyor' : 'Pending';
    return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: currencyCode,
        maximumFractionDigits: 0,
    }).format(value);
};

const formatRelativeTime = (iso?: string | null, isTr = false) => {
    if (!iso) return isTr ? 'Henuz guncellenmedi' : 'Not updated yet';
    let dateStr = iso;
    if (!dateStr.endsWith('Z') && !dateStr.includes('+')) {
        dateStr += 'Z';
    }
    const diffMs = Date.now() - new Date(dateStr).getTime();
    if (Number.isNaN(diffMs) || diffMs < 0) return isTr ? 'Az once' : 'Recently';
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return isTr ? 'Az once' : 'Recently';
    if (mins < 60) return isTr ? `${mins} dk once` : `${mins} min ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return isTr ? `${hours} sa once` : `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return isTr ? `${days} gun once` : `${days}d ago`;
};

const humanizeReason = (reason?: string | null, isTr = false) => {
    if (!reason) return isTr ? 'Son degerlendirme yok.' : 'No recent evaluation.';
    switch (reason) {
        case 'alerts_disabled':
            return isTr ? 'Bu urun icin alarmlar kapali.' : 'Alerts are disabled for this item.';
        case 'condition_not_met':
            return isTr ? 'Hedef/onemli dusus kosulu bekleniyor.' : 'Waiting for target/significant drop condition.';
        case 'reminder_not_due':
            return isTr ? 'Urun hedefte ancak hatirlatma suresi henuz dolmadi.' : 'Product is in deal range but reminder window has not elapsed yet.';
        case 'no_notification_channel_enabled':
            return isTr ? 'Etkin bir bildirim kanali yok.' : 'No notification channel is enabled.';
        case 'user_inactive_or_missing':
            return isTr ? 'Kullanici kaydi pasif veya bulunamadi.' : 'User record is inactive or missing.';
        case 'target_due':
            return isTr ? 'Hedef kosulu saglandi.' : 'Target condition matched.';
        case 'significant_drop':
            return isTr ? 'Onemli dusus kosulu saglandi.' : 'Significant drop condition matched.';
        case 'target_or_significant_drop':
            return isTr ? 'Hedef/onemli dusus kosulu saglandi.' : 'Target/significant drop condition matched.';
        default:
            return reason;
    }
};

const formatStatusLabel = (status?: string | null) => {
    if (!status) return 'PENDING';
    if (status === 'unknown') return 'PENDING';
    return status.toUpperCase();
};

const formatStatusCompact = (status?: string | null) => {
    const resolved = status === 'unknown' || !status ? 'pending' : status;
    if (resolved === 'pending') return 'PEND';
    if (resolved === 'skipped') return 'SKIP';
    if (resolved === 'error') return 'ERR';
    if (resolved === 'sent') return 'SENT';
    return 'PEND';
};

// Mock sparkline data - will come from database later
const sparklineData = (seed: string) => {
    let val = 50;
    return Array.from({ length: 20 }).map((_, i) => {
        const drift = ((seed.charCodeAt(i % seed.length) || 0) % 7) - 3;
        val = Math.max(15, Math.min(92, val + drift));
        return { value: val };
    });
};

const MiniSparkline = ({ data, color, indexLabel }: { data: Array<{ value: number }>; color: string; indexLabel: string }) => (
    <div className="watchlist-sparkline">
        <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
                <defs>
                    <linearGradient id={`watchlist-gradient-${color}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={color} stopOpacity={0.3} />
                        <stop offset="100%" stopColor={color} stopOpacity={0} />
                    </linearGradient>
                </defs>
                <Area type="monotone" dataKey="value" stroke={color} strokeWidth={2} fill={`url(#watchlist-gradient-${color})`} />
                <Tooltip
                    contentStyle={{ background: '#1e1e2e', border: 'none', borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: '#a1a1aa' }}
                    formatter={(value) => [`${Math.round(value as number)}`, indexLabel]}
                />
            </AreaChart>
        </ResponsiveContainer>
    </div>
);

const Watchlist = () => {
    const { user } = useAuth();
    const { items, notificationContext, isLoading, error, add, remove, update } = useTrackedItems();
    const { showToast } = useToast();
    const isTr = user?.language === 'tr';
    const locale = isTr ? 'tr-TR' : 'en-US';
    const tx = (en: string, tr: string) => (isTr ? tr : en);
    const [alerts, setAlerts] = useState<Record<string, boolean>>({});
    const [activeFilter, setActiveFilter] = useState<'all' | 'alerts' | 'near'>('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [sortBy, setSortBy] = useState<'updated' | 'name' | 'price-asc' | 'price-desc' | 'target-gap'>('updated');

    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [addUrl, setAddUrl] = useState('');
    const [addTarget, setAddTarget] = useState('');
    const [addCurrency, setAddCurrency] = useState('TRY');
    const [isAddSubmitting, setIsAddSubmitting] = useState(false);

    const [editTargetModal, setEditTargetModal] = useState<{ id: string; name: string; target: string } | null>(null);
    const [isEditSubmitting, setIsEditSubmitting] = useState(false);

    const [deleteModal, setDeleteModal] = useState<{ id: string; name: string } | null>(null);
    const [isDeleteSubmitting, setIsDeleteSubmitting] = useState(false);

const rows = useMemo(() => {
    return items.map((item) => {
        const current = item.product.current_price ?? null;
        const target = item.target_price ?? null;
        const source = (item.product.source || 'unknown').toUpperCase();
        
        // Progress toward target
        const progress = current && target && current > 0 
            ? Math.round((target / current) * 100) 
            : 0;
        
        // Difference vs target
        const deltaPercent = current && target && current > 0
            ? ((current - target) / current) * 100
            : 0;
        
        const trend: 'up' | 'down' | 'stable' =
            deltaPercent > 0.4 ? 'up' :
            deltaPercent < -0.4 ? 'down' :
            'stable';

        const color =
            trend === 'up' ? '#ef4444' :
            trend === 'down' ? '#10b981' :
            '#71717a';
        
        const alertState = alerts[item.tracked_item_id] ?? (item.alerts_active ?? true);

        const nearTarget = progress >= 90 && progress < 100;
        const rowNotification = item.notification;
        const rowTelegramAllowed = rowNotification?.telegram_allowed ?? (notificationContext?.telegram_allowed ?? true);
        const telegramConnectedRaw =
            rowNotification?.telegram_connected_raw ??
            rowNotification?.telegram_connected ??
            notificationContext?.telegram_connected_raw ??
            notificationContext?.telegram_connected ??
            false;
        const telegramConnected = rowTelegramAllowed && telegramConnectedRaw;
        const rowStatus = rowNotification?.last_notification_status || 'unknown';
        const hasChecks = Boolean(rowNotification?.last_notification_check_at || rowNotification?.last_notification_at);
        const visualStatus = rowStatus === 'unknown' && !hasChecks ? 'pending' : rowStatus;

        return {
            id: item.tracked_item_id,
            productId: item.product.id,
            name: item.product.name || source,
            category: source,
            imageUrl: item.product.image_url || null,
            current,
            target,
            progress,
            nearTarget,
            trend,
            color,
            deltaPercent,
            updatedAt: item.product.last_checked_at || item.created_at,
            url: item.product.original_url || '',
            currency: item.product.currency || 'TRY',
            alert: alertState,
            notification: {
                ...rowNotification,
                telegram_allowed: rowTelegramAllowed,
                telegram_connected_raw: telegramConnectedRaw,
                telegram_connected: telegramConnected,
                last_notification_status: visualStatus,
            },
        };
    });
}, [
    alerts,
    items,
    notificationContext?.telegram_allowed,
    notificationContext?.telegram_connected,
    notificationContext?.telegram_connected_raw,
]);

    const filteredRows = useMemo(() => {
        let nextRows = [...rows];

        if (activeFilter === 'alerts') {
            nextRows = nextRows.filter((r) => r.alert);
        }
        if (activeFilter === 'near') {
            nextRows = nextRows.filter((r) => r.nearTarget);
        }

        if (searchTerm.trim()) {
            const q = searchTerm.trim().toLowerCase();
            nextRows = nextRows.filter((r) =>
                r.name.toLowerCase().includes(q) ||
                r.category.toLowerCase().includes(q) ||
                r.url.toLowerCase().includes(q)
            );
        }

        nextRows.sort((a, b) => {
            if (sortBy === 'name') return a.name.localeCompare(b.name, locale);
            if (sortBy === 'price-asc') return (a.current ?? Number.POSITIVE_INFINITY) - (b.current ?? Number.POSITIVE_INFINITY);
            if (sortBy === 'price-desc') return (b.current ?? Number.NEGATIVE_INFINITY) - (a.current ?? Number.NEGATIVE_INFINITY);
            if (sortBy === 'target-gap') {
                const gapA = (a.target ?? 0) - (a.current ?? 0);
                const gapB = (b.target ?? 0) - (b.current ?? 0);
                return gapB - gapA;
            }
            return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        });

        return nextRows;
    }, [activeFilter, locale, rows, searchTerm, sortBy]);

    const getTrendIcon = (trend: 'up' | 'down' | 'stable') => {
        if (trend === 'up') return <TrendingUp size={14} className="trend-icon up" />;
        if (trend === 'down') return <TrendingDown size={14} className="trend-icon down" />;
        return <Minus size={14} className="trend-icon stable" />;
    };

    const getPriceChangeColor = (deltaPercent: number) => {
        if (deltaPercent > 0.2) return 'negative';
        if (deltaPercent < -0.2) return 'positive';
        return 'neutral';
    };

    const getNotificationActionHint = (row: {
        alert: boolean;
        target: number | null;
        notification?: {
            telegram_connected?: boolean;
            telegram_allowed?: boolean;
            last_notification_status?: string | null;
            last_notification_reason?: string | null;
            last_notification_error?: string | null;
        };
    }) => {
        if (!row.alert) {
            return {
                label: tx('Enable Alerts', 'Alarmlari Ac'),
                message: tx('Alerts are disabled for this item. Turn alerts on to receive notifications.', 'Bu urun icin alarmlar kapali. Bildirim almak icin alarmlari ac.'),
                redirectToSettings: false,
            };
        }

        const emailEnabled = notificationContext?.email_notifications_enabled ?? true;
        const telegramAllowed = row.notification?.telegram_allowed ?? (notificationContext?.telegram_allowed ?? true);
        const telegramConnected = telegramAllowed && (row.notification?.telegram_connected ?? false);

        if (!emailEnabled && !telegramAllowed) {
            return {
                label: tx('Enable Channel', 'Kanal Ac'),
                message: tx('Email notifications are disabled and Telegram is a Premium feature. Enable email or upgrade your plan.', 'E-posta bildirimleri kapali ve Telegram Premium ozelligi. E-postayi ac veya planini yukselt.'),
                redirectToSettings: true,
            };
        }

        if (!emailEnabled && !telegramConnected) {
            return {
                label: tx('Enable Channel', 'Kanal Ac'),
                message: tx('No notification channel is active. Enable Email Notifications or connect Telegram in Settings.', 'Aktif bildirim kanali yok. E-posta bildirimini ac veya Ayarlardan Telegram bagla.'),
                redirectToSettings: true,
            };
        }

        if (!telegramAllowed) {
            return {
                label: tx('Premium Required', 'Premium Gerekli'),
                message: tx('Telegram notifications are available on Premium plan. Upgrade to enable Telegram alerts.', 'Telegram bildirimleri Premium planda acik. Telegram uyarilari icin planini yukselt.'),
                redirectToSettings: true,
            };
        }

        if (!telegramConnected) {
            return {
                label: tx('Connect Telegram', 'Telegram Bagla'),
                message: tx('Telegram is not connected. You can still get email alerts, but connecting Telegram gives instant push updates.', 'Telegram bagli degil. E-posta alarmlari calisir ama Telegram anlik bildirim saglar.'),
                redirectToSettings: true,
            };
        }

        if (row.target == null) {
            return {
                label: tx('Set Target', 'Hedef Belirle'),
                message: tx('Set a target price to make notification timing clearer and more predictable.', 'Bildirim zamanlamasini netlestirmek icin hedef fiyat belirle.'),
                redirectToSettings: false,
            };
        }

        if (row.notification?.last_notification_error) {
            return {
                label: tx('Retry Setup', 'Kurulumu Tekrarla'),
                message: tx('Last notification attempt failed:', 'Son bildirim denemesi basarisiz:') + ` ${row.notification.last_notification_error}`,
                redirectToSettings: true,
            };
        }

        if (row.notification?.last_notification_reason === 'condition_not_met') {
            return {
                label: tx('Waiting', 'Bekleniyor'),
                message: tx('No issue detected. Current price conditions have not met the notification trigger yet.', 'Sorun yok. Mevcut fiyat kosulu henuz bildirim tetiklemiyor.'),
                redirectToSettings: false,
            };
        }

        return {
            label: tx('Status OK', 'Durum Iyi'),
            message: tx('Notification channels look healthy for this item.', 'Bu urun icin bildirim kanallari saglikli gorunuyor.'),
            redirectToSettings: false,
        };
    };

    const handleToggleAlert = async (id: string, currentAlertState: boolean) => {
        const newState = !currentAlertState;
        // Optimistic UI update
        setAlerts((prev) => ({ ...prev, [id]: newState }));
        
        try {
            await update(id, { alerts_active: newState });
            if (newState) {
                showToast(
                    'success',
                    telegramAllowedInPlan
                        ? tx('Alerts enabled for this item. Available channels will be used.', 'Bu urun icin alarmlar acildi. Uygun kanallar kullanilacak.')
                        : tx('Alerts enabled for this item. Email channel will be used on Free plan.', 'Bu urun icin alarmlar acildi. Free planda e-posta kanali kullanilacak.')
                );
            } else {
                showToast('success', tx('Notifications disabled.', 'Bildirimler kapatildi.'));
            }
        } catch (err) {
            // Revert on error
            setAlerts((prev) => ({ ...prev, [id]: currentAlertState }));
            showToast('error', tx('Failed to update notification status.', 'Bildirim durumu guncellenemedi.'));
        }
    };

    const handleAddSubmit = async () => {
        if (isTrackLimitReached) {
            showToast('error', tx(
                `Free plan allows up to ${maxTrackedItems} active products. Upgrade to Premium for unlimited tracking.`,
                `Free plan en fazla ${maxTrackedItems} aktif urune izin verir. Limitsiz takip icin Premiuma yukseltebilirsin.`
            ));
            return;
        }

        const url = addUrl.trim();
        if (!url) {
            showToast('error', tx('Please enter a product URL.', 'Lutfen bir urun URLsi gir.'));
            return;
        }
        if (!/^https?:\/\//i.test(url)) {
            showToast('error', tx('Start with a valid URL (http/https).', 'Gecerli bir URL ile basla (http/https).'));
            return;
        }

        const parsed = addTarget.trim() ? Number(addTarget.replace(',', '.')) : undefined;
        if (parsed != null && (Number.isNaN(parsed) || parsed <= 0)) {
            showToast('error', tx('Target price must be a positive number.', 'Hedef fiyat pozitif bir sayi olmali.'));
            return;
        }

        setIsAddSubmitting(true);
        const draftUrl = addUrl;
        const draftTarget = addTarget;
        const draftCurrency = addCurrency;
        setIsAddModalOpen(false);
        setAddUrl('');
        setAddTarget('');
        setAddCurrency('TRY');

        try {
            await add(url, parsed, draftCurrency);
            showToast('success', tx('Product added to watchlist successfully.', 'Urun takip listesine eklendi.'));
        } catch (err) {
            setIsAddModalOpen(true);
            setAddUrl(draftUrl);
            setAddTarget(draftTarget);
            setAddCurrency(draftCurrency);
            showToast('error', err instanceof Error ? err.message : tx('Failed to add product', 'Urun eklenemedi'));
        } finally {
            setIsAddSubmitting(false);
        }
    };

    const handleEditTargetSubmit = async () => {
        if (!editTargetModal) return;
        const parsed = Number(editTargetModal.target.replace(',', '.'));
        if (Number.isNaN(parsed) || parsed <= 0) {
            showToast('error', tx('Please enter a valid target price.', 'Lutfen gecerli bir hedef fiyat gir.'));
            return;
        }

        setIsEditSubmitting(true);
        try {
            await update(editTargetModal.id, { target_price: parsed });
            setEditTargetModal(null);
            showToast('success', tx('Target price updated successfully.', 'Hedef fiyat guncellendi.'));
        } catch (err) {
            showToast('error', err instanceof Error ? err.message : tx('Failed to update target price', 'Hedef fiyat guncellenemedi'));
        } finally {
            setIsEditSubmitting(false);
        }
    };

    const handleDeleteSubmit = async () => {
        if (!deleteModal) return;
        setIsDeleteSubmitting(true);
        try {
            await remove(deleteModal.id);
            setDeleteModal(null);
            showToast('success', tx('Product removed from watchlist.', 'Urun takip listesinden kaldirildi.'));
        } catch (err) {
            showToast('error', err instanceof Error ? err.message : tx('Failed to delete product', 'Urun silinemedi'));
        } finally {
            setIsDeleteSubmitting(false);
        }
    };

    const totalValue = rows.reduce((sum, row) => sum + (row.current || 0), 0);
    const totalSavings = rows.reduce((sum, row) => {
        if (row.current == null || row.target == null) return sum;
        return sum + Math.max(0, row.target - row.current);
    }, 0);
    const maxTrackedItems = notificationContext?.max_tracked_items ?? null;
    const currentTrackedItems = notificationContext?.current_tracked_items ?? rows.length;
    const isTrackLimitReached = maxTrackedItems != null && currentTrackedItems >= maxTrackedItems;
    const telegramAllowedInPlan = notificationContext?.telegram_allowed ?? true;

    return (
        <div className="watchlist-container dashboard-page">
            <div className="watchlist-header">
                <div className="header-left">
                    <span className="header-badge">{tx('PERSONAL PORTFOLIO', 'KISISSEL PORTFOY')}</span>
                    <h1 className="watchlist-title">
                        {tx('Active', 'Aktif')} <span className="gradient-text">{tx('Watchlist', 'Takip Listesi')}</span>
                    </h1>
                    <p className="watchlist-description">
                        {tx(
                            'Your tracked assets are synced in real-time. Adjust target prices, manage your portfolio, and monitor buying opportunities instantly.',
                            'Takipteki urunlerin gercek zamanli senkronize olur. Hedef fiyatlarini ayarla, portfoyunu yonet ve firsatlari anlik takip et.'
                        )}
                    </p>
                </div>
                <div className="header-right">
                    <button className="add-asset-btn" onClick={() => setIsAddModalOpen(true)} disabled={isTrackLimitReached}>
                        <Plus size={18} />
                        {isTrackLimitReached ? tx('Limit Reached', 'Limit Doldu') : tx('Add Asset', 'Urun Ekle')}
                        
                    </button>
                </div>
            </div>


            <div className="watchlist-stats">
                <div className="stat-item">
                    <div className="stat-value">{rows.length}</div>
                    <div className="stat-label">{tx('Tracked Assets', 'Takip Edilenler')}</div>
                </div>
                <div className="stat-item">
                    <div className="stat-value">{rows.filter((r) => r.alert).length}</div>
                    <div className="stat-label">{tx('Active Alerts', 'Aktif Alarmlar')}</div>
                </div>
                <div className="stat-item">
                    <div className="stat-value">{formatCurrency(totalValue, 'TRY', locale, isTr)}</div>
                    <div className="stat-label">{tx('Total Value', 'Toplam Deger')}</div>
                </div>
                <div className="stat-item">
                    <div className="stat-value">{formatCurrency(totalSavings, 'TRY', locale, isTr)}</div>
                    <div className="stat-label">{tx('Potential Savings', 'Olasi Tasarruf')}</div>
                </div>
            </div>

            <div className="watchlist-notification-context">
                <div className="context-item">
                    <span className="context-label">Telegram</span>
                    <span className={`context-value ${(notificationContext?.telegram_connected && telegramAllowedInPlan) ? 'ok' : 'warn'}`}>
                        {!telegramAllowedInPlan
                            ? tx('Premium only', 'Sadece Premium')
                            : (notificationContext?.telegram_connected ? tx('Connected', 'Bagli') : tx('Not connected', 'Bagli degil'))}
                    </span>
                </div>
                <div className="context-item">
                    <span className="context-label">{tx('Email Notifications', 'E-posta Bildirimleri')}</span>
                    <span className={`context-value ${notificationContext?.email_notifications_enabled ? 'ok' : 'warn'}`}>
                        {notificationContext?.email_notifications_enabled ? tx('Enabled', 'Acik') : tx('Disabled', 'Kapali')}
                    </span>
                </div>
                <div className="context-item">
                    <span className="context-label">{tx('Plan Usage', 'Plan Kullanimi')}</span>
                    <span className={`context-value ${isTrackLimitReached ? 'warn' : 'ok'}`}>
                        {maxTrackedItems == null
                            ? tx(`${currentTrackedItems} active (unlimited)`, `${currentTrackedItems} aktif (limitsiz)`)
                            : tx(`${currentTrackedItems}/${maxTrackedItems} active`, `${currentTrackedItems}/${maxTrackedItems} aktif`)}
                    </span>
                </div>
                <div className="context-item context-hint">
                    <span className="context-label">{tx('Visibility', 'Gorunurluk')}</span>
                    <span className="context-value">{tx('Each row now shows last notification time, last check, and last error reason.', 'Her satir son bildirim zamani, son kontrol ve son hata nedenini gosterir.')}</span>
                </div>
            </div>

            {isTrackLimitReached && (
                <div className="watchlist-plan-upgrade-note">
                    {tx(
                        `Free plan limit reached (${currentTrackedItems}/${maxTrackedItems}). Upgrade to Premium for unlimited tracking and Telegram notifications.`,
                        `Free plan limiti doldu (${currentTrackedItems}/${maxTrackedItems}). Limitsiz takip ve Telegram bildirimleri icin Premiuma yukselt.`
                    )}
                </div>
            )}

            <section className="watchlist-table-section">
                <div className="section-header">
                    <h3>{tx('Tracked Assets', 'Takip Edilen Urunler')}</h3>
                    <div className="section-filters">
                        <button className={`filter-btn ${activeFilter === 'all' ? 'active' : ''}`} onClick={() => setActiveFilter('all')}>{tx('All', 'Tum')}</button>
                        <button className={`filter-btn ${activeFilter === 'alerts' ? 'active' : ''}`} onClick={() => setActiveFilter('alerts')}>{tx('Alerts On', 'Alarm Acik')}</button>
                        <button className={`filter-btn ${activeFilter === 'near' ? 'active' : ''}`} onClick={() => setActiveFilter('near')}>{tx('Near Target', 'Hedefe Yakin')}</button>
                    </div>
                </div>

                <div className="watchlist-controls">
                    <input
                        className="watchlist-search"
                        placeholder={tx('Search product (name, source, URL)...', 'Urun ara (ad, kaynak, URL)...')}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    <select className="watchlist-sort" value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)}>
                        <option value="updated">{tx('Last updated', 'Son guncellenen')}</option>
                        <option value="name">{tx('By name (A-Z)', 'Isme gore (A-Z)')}</option>
                        <option value="price-asc">{tx('Price ascending', 'Fiyat artan')}</option>
                        <option value="price-desc">{tx('Price descending', 'Fiyat azalan')}</option>
                        <option value="target-gap">{tx('Savings potential', 'Tasarruf potansiyeli')}</option>
                    </select>
                </div>

                {isLoading && <p className="watchlist-description">{tx('Loading watchlist...', 'Takip listesi yukleniyor...')}</p>}
                {error && <p className="watchlist-description">{error}</p>}

                {!isLoading && filteredRows.length > 0 && (
                    <div className="table-wrapper">
                        <table className="watchlist-table">
                            <thead>
                                <tr>
                                    <th>{tx('ASSET', 'URUN')}</th>
                                    <th>{tx('CURRENT PRICE', 'GUNCEL FIYAT')}</th>
                                    <th>{tx('VS TARGET', 'HEDEFE GORE')}</th>
                                    <th>{tx('PRICE TREND', 'FIYAT TRENDI')}</th>
                                    <th>{tx('TARGET', 'HEDEF')}</th>
                                    <th>{tx('PROGRESS', 'ILERLEME')}</th>
                                    <th>{tx('ALERTS', 'ALARMLAR')}</th>
                                    <th>
                                        <div className="notify-header-with-help">
                                            <span>{tx('NOTIFY', 'BILDIRIM')}</span>
                                            <span className="notify-help-trigger" aria-label={tx('Notification status help', 'Bildirim durumu yardimi')}>
                                                <Info size={13} />
                                                <span className="notify-help-tooltip">
                                                    {tx(
                                                        'SENT: Notification was delivered. SKIPPED: Conditions/channel were not suitable. ERROR: Delivery attempt failed. PENDING: Item has not been evaluated yet.',
                                                        'SENT: Bildirim iletildi. SKIPPED: Kosul/kanal uygun degildi. ERROR: Gonderim denemesi basarisiz. PENDING: Urun henuz degerlendirilmedi.'
                                                    )}
                                                </span>
                                            </span>
                                        </div>
                                    </th>
                                    <th>{tx('ACTIONS', 'ISLEMLER')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredRows.map((row) => (
                                    <tr key={row.id}>
                                        <td>
                                            <div className="asset-cell">
                                                <img src={row.imageUrl || FALLBACK_IMAGE} alt={row.name} className="asset-image" />
                                                <div className="asset-info">
                                                    <h4>{row.name}</h4>
                                                    <div className="asset-meta">
                                                        <span className="category-badge">{row.category}</span>
                                                        <span className="update-time">
                                                            <Clock size={10} />
                                                            {formatRelativeTime(row.updatedAt, isTr)}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <div className="price-cell">
                                                <span className="current-price">{formatCurrency(row.current, row.currency, locale, isTr)}</span>
                                            </div>
                                        </td>
                                        <td>
                                            <div className={`price-change ${getPriceChangeColor(row.deltaPercent)}`}>
                                                {getTrendIcon(row.trend)}
                                                <span>{row.deltaPercent >= 0 ? '+' : ''}{row.deltaPercent.toFixed(1)}%</span>
                                            </div>
                                        </td>
                                        <td>
                                            <MiniSparkline data={sparklineData(row.productId)} color={row.color} indexLabel={tx('Price Index', 'Fiyat Endeksi')} />
                                        </td>
                                        <td>
                                            <div className="target-cell">
                                                <span className="target-price">{formatCurrency(row.target, row.currency, locale, isTr)}</span>
                                                {row.nearTarget && (
                                                    <span className="near-target-badge">
                                                        <Zap size={10} />
                                                        {tx('Near', 'Yakin')}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td>
                                            <div className="progress-cell">
                                                <div className="progress-bar">
                                                    <div className={`progress-fill ${row.progress >= 100 ? 'reached' : ''}`} style={{ width: `${Math.min(100, Math.max(0, row.progress))}%` }} />
                                                </div>
                                                <span className="progress-text">{row.progress}%</span>
                                            </div>
                                        </td>
                                        <td>
                                            <button
                                                className={`alert-toggle ${row.alert ? 'active' : ''}`}
                                                title={row.alert ? tx('Disable Notifications', 'Bildirimleri Kapat') : tx('Enable Notifications', 'Bildirimleri Ac')}
                                                onClick={() => handleToggleAlert(row.id, row.alert)}
                                            >
                                                {row.alert ? <Bell size={16} /> : <BellOff size={16} />}
                                            </button>
                                        </td>
                                        <td>
                                            <div className="notify-cell">
                                                {(() => {
                                                    const hint = getNotificationActionHint(row);
                                                    const explainReason = row.notification?.last_notification_error
                                                        ? `${tx('Error', 'Hata')}: ${row.notification.last_notification_error}`
                                                        : humanizeReason(
                                                            row.notification?.last_notification_reason ||
                                                            (row.notification?.last_notification_status === 'pending' ? 'condition_not_met' : undefined),
                                                            isTr,
                                                        );
                                                    return (
                                                        <div className="notify-compact">
                                                            <div className={`notify-pill compact ${row.notification?.last_notification_status || 'unknown'}`} title={formatStatusLabel(row.notification?.last_notification_status)}>
                                                                {formatStatusCompact(row.notification?.last_notification_status)}
                                                            </div>
                                                            <span className="notify-help-trigger row" aria-label={tx('Item notification details', 'Urun bildirim detaylari')}>
                                                                <Info size={13} />
                                                                <span className="notify-help-tooltip notify-row-tooltip">
                                                                    {tx('Telegram', 'Telegram')}: {row.notification?.telegram_connected ? tx('Connected', 'Bagli') : tx('Not connected', 'Bagli degil')}
                                                                    {!row.notification?.telegram_allowed && (
                                                                        <>
                                                                            <br />
                                                                            {tx('Telegram plan access: Premium required', 'Telegram plan erisimi: Premium gerekli')}
                                                                        </>
                                                                    )}
                                                                    <br />
                                                                    {tx('Alerts', 'Alarmlar')}: {row.alert ? tx('Active', 'Aktif') : tx('Disabled', 'Kapali')}
                                                                    <br />
                                                                    {tx('Last sent', 'Son gonderim')}: {row.notification?.last_notification_at ? formatRelativeTime(row.notification?.last_notification_at, isTr) : tx('Not sent yet', 'Henuz gonderilmedi')}
                                                                    <br />
                                                                    {tx('Last check', 'Son kontrol')}: {row.notification?.last_notification_check_at ? formatRelativeTime(row.notification?.last_notification_check_at, isTr) : tx('Awaiting first check', 'Ilk kontrol bekleniyor')}
                                                                    <br />
                                                                    {tx('Reason', 'Neden')}: {explainReason}
                                                                    <br />
                                                                    {tx('Suggested action', 'Onerilen aksiyon')}: {hint.label}
                                                                    <br />
                                                                    {hint.message}
                                                                </span>
                                                            </span>
                                                        </div>
                                                    );
                                                })()}
                                                </div>
                                        </td>
                                        <td>
                                            <div className="action-buttons">
                                                <button
                                                    className="action-btn link"
                                                    title={tx('Open Product Page', 'Urun Sayfasini Ac')}
                                                    onClick={() => window.open(row.url, '_blank', 'noopener,noreferrer')}
                                                >
                                                    <ExternalLink size={16} />
                                                </button>
                                                <button
                                                    className="action-btn edit"
                                                    title={tx('Edit Target', 'Hedefi Duzenle')}
                                                    onClick={() => setEditTargetModal({
                                                        id: row.id,
                                                        name: row.name,
                                                        target: row.target != null ? String(row.target) : '',
                                                    })}
                                                >
                                                    <Edit2 size={16} />
                                                </button>
                                                <button
                                                    className="action-btn delete"
                                                    title={tx('Remove from Watchlist', 'Takipten Kaldir')}
                                                    onClick={() => setDeleteModal({ id: row.id, name: row.name })}
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>

            {!isLoading && rows.length === 0 && (
                <div className="empty-state">
                    <div className="empty-icon">{tx('No items', 'Liste bos')}</div>
                    <h3>{tx('Your watchlist is empty', 'Takip listen su an bos')}</h3>
                    <p>{tx('Start tracking products to get notified about price drops and deals.', 'Fiyat dususleri ve firsatlar icin urun takibine basla.')}</p>
                    <button className="add-asset-btn primary" onClick={() => setIsAddModalOpen(true)} disabled={isTrackLimitReached}>
                        <Plus size={18} />
                        {isTrackLimitReached ? tx('Limit Reached', 'Limit Doldu') : tx('Add Your First Asset', 'Ilk Urununu Ekle')}
                    </button>
                </div>
            )}

            {isAddModalOpen && (
                <div className="watchlist-modal-overlay" role="dialog" aria-modal="true">
                    <div className="watchlist-modal-card">
                        <h3 className="watchlist-modal-title">{tx('Add New Product', 'Yeni Urun Ekle')}</h3>
                        <p className="watchlist-modal-description">{tx('Enter a product link (Amazon, N11, Itopya, Vatan, Newegg, Etsy, Banggood, eBay, etc...) and an optional target price.', 'Desteklenen bir E-Ticaret linki (Amazon, N11, İtopya, Vatan, Trendyol, Banggood, Etsy, Newegg vb.) ve isteğe bağlı hedef fiyat girin.')}</p>

                        <label className="watchlist-modal-label">{tx('Product URL', 'Urun URLsi')}</label>
                        <input
                            className="watchlist-modal-input"
                            placeholder="https://..."
                            value={addUrl}
                            onChange={(e) => setAddUrl(e.target.value)}
                        />

                        <label className="watchlist-modal-label">{tx('Target Price (Optional)', 'Hedef Fiyat (Istege Bagli)')}</label>
                        <input
                            className="watchlist-modal-input"
                            placeholder={tx('E.g: 14999', 'Orn: 14999')}
                            value={addTarget}
                            onChange={(e) => setAddTarget(e.target.value)}
                        />

                        <label className="watchlist-modal-label">{tx('Currency', 'Para Birimi')}</label>
                        <select
                            className="watchlist-modal-input"
                            value={addCurrency}
                            onChange={(e) => setAddCurrency(e.target.value)}
                        >
                            <option value="TRY">TRY (₺)</option>
                            <option value="USD">USD ($)</option>
                            <option value="EUR">EUR (€)</option>
                            <option value="GBP">GBP (£)</option>
                        </select>

                        <div className="watchlist-modal-actions">
                            <button className="watchlist-btn secondary" onClick={() => setIsAddModalOpen(false)} disabled={isAddSubmitting}>{tx('Cancel', 'Iptal')}</button>
                            <button className="watchlist-btn primary" onClick={() => void handleAddSubmit()} disabled={isAddSubmitting}>
                                {isAddSubmitting ? tx('Adding...', 'Ekleniyor...') : tx('Add Product', 'Urun Ekle')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {editTargetModal && (
                <div className="watchlist-modal-overlay" role="dialog" aria-modal="true">
                    <div className="watchlist-modal-card">
                        <h3 className="watchlist-modal-title">{tx('Edit Target Price', 'Hedef Fiyat Duzenle')}</h3>
                        <p className="watchlist-modal-description">{tx('Set a new target price for', 'Icin yeni hedef fiyat belirle')}: {editTargetModal.name}.</p>

                        <label className="watchlist-modal-label">{tx('New Target Price', 'Yeni Hedef Fiyat')}</label>
                        <input
                            className="watchlist-modal-input"
                            value={editTargetModal.target}
                            onChange={(e) => setEditTargetModal((prev) => (prev ? { ...prev, target: e.target.value } : prev))}
                        />

                        <div className="watchlist-modal-actions">
                            <button className="watchlist-btn secondary" onClick={() => setEditTargetModal(null)} disabled={isEditSubmitting}>{tx('Cancel', 'Iptal')}</button>
                            <button className="watchlist-btn primary" onClick={() => void handleEditTargetSubmit()} disabled={isEditSubmitting}>
                                {isEditSubmitting ? tx('Saving...', 'Kaydediliyor...') : tx('Save', 'Kaydet')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {deleteModal && (
                <div className="watchlist-modal-overlay" role="dialog" aria-modal="true">
                    <div className="watchlist-modal-card danger">
                        <h3 className="watchlist-modal-title">{tx('Delete Product', 'Urunu Sil')}</h3>
                        <p className="watchlist-modal-description">
                            <strong>{deleteModal.name}</strong> {tx('will be removed from your watchlist. Are you sure?', 'takip listesinden kaldirilacak. Emin misin?')}
                        </p>

                        <div className="watchlist-modal-actions">
                            <button className="watchlist-btn secondary" onClick={() => setDeleteModal(null)} disabled={isDeleteSubmitting}>{tx('Cancel', 'Iptal')}</button>
                            <button className="watchlist-btn danger" onClick={() => void handleDeleteSubmit()} disabled={isDeleteSubmitting}>
                                {isDeleteSubmitting ? tx('Deleting...', 'Siliniyor...') : tx('Yes, Delete', 'Evet, Sil')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Watchlist;

