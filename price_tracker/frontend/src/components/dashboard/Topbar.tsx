import { Bell, Settings, ExternalLink, CheckCheck } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { useTrackedItems } from '../../hooks/useTrackedItems';
import { useCookieConsent } from '../../consent/CookieConsentContext';

const DEALS_READ_KEY_PREFIX = 'dashboard:deals:last-read-at';

const formatRelativeTime = (iso: string, isTr: boolean) => {
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

const Topbar = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { items } = useTrackedItems();
    const { canUseOptionalStorage } = useCookieConsent();
    const isTr = user?.language === 'tr';
    const [isNotifyOpen, setIsNotifyOpen] = useState(false);
    const [lastReadAt, setLastReadAt] = useState(0);
    const notifyRef = useRef<HTMLDivElement | null>(null);

    const avatarText = user?.avatar_initial || user?.full_name?.trim().charAt(0).toUpperCase() || user?.email?.trim().charAt(0).toUpperCase() || 'U';
    const readStorageKey = user?.id ? `${DEALS_READ_KEY_PREFIX}:${user.id}` : `${DEALS_READ_KEY_PREFIX}:guest`;

    useEffect(() => {
        if (!canUseOptionalStorage) {
            setLastReadAt(0);
            return;
        }
        const raw = localStorage.getItem(readStorageKey);
        const parsed = raw ? Number(raw) : 0;
        setLastReadAt(Number.isFinite(parsed) ? parsed : 0);
    }, [canUseOptionalStorage, readStorageKey]);

    useEffect(() => {
        const onOutsideClick = (event: MouseEvent) => {
            if (!notifyRef.current) return;
            if (!notifyRef.current.contains(event.target as Node)) {
                setIsNotifyOpen(false);
            }
        };

        document.addEventListener('mousedown', onOutsideClick);
        return () => document.removeEventListener('mousedown', onOutsideClick);
    }, []);

    const deals = useMemo(() => {
        const now = Date.now();
        return items
            .filter((item) => {
                const current = item.product.current_price;
                const target = item.target_price;
                if (current == null || target == null) return false;
                if (current > target) return false;
                const updatedAt = item.product.last_checked_at || item.created_at;
                let dStr = updatedAt;
                if (dStr && !dStr.endsWith('Z') && !dStr.includes('+')) dStr += 'Z';
                const ts = new Date(dStr).getTime();
                if (Number.isNaN(ts)) return false;
                return now - ts <= 24 * 60 * 60 * 1000;
            })
            .map((item) => {
                const updatedAt = item.product.last_checked_at || item.created_at;
                let dStr = updatedAt;
                if (dStr && !dStr.endsWith('Z') && !dStr.includes('+')) dStr += 'Z';
                const ts = new Date(dStr).getTime();
                return {
                    id: item.tracked_item_id,
                    name: item.product.name || (isTr ? 'Urun' : 'Product'),
                    updatedAt,
                    ts,
                };
            })
            .sort((a, b) => b.ts - a.ts);
    }, [isTr, items]);

    const unreadDeals = useMemo(() => deals.filter((deal) => deal.ts > lastReadAt), [deals, lastReadAt]);
    const unreadCount = unreadDeals.length;

    const markAllAsRead = () => {
        const now = Date.now();
        if (canUseOptionalStorage) {
            localStorage.setItem(readStorageKey, String(now));
        }
        setLastReadAt(now);
    };

    const handleBellClick = () => {
        const next = !isNotifyOpen;
        setIsNotifyOpen(next);
        if (next && unreadCount > 0) {
            markAllAsRead();
        }
    };

    return (
        <header className="dashboard-topbar">
            <div className="header-breadcrumbs">
                {isTr ? 'TERMINAL / GENEL BAKIS' : 'TERMINAL / OVERVIEW'}
            </div>

            <div className="topbar-actions">
                <div className="topbar-notify-wrap" ref={notifyRef}>
                    <button
                        className={`action-icon-btn bell-btn ${unreadCount > 0 ? 'has-alert' : ''}`}
                        title={isTr ? 'Bildirimler' : 'Notifications'}
                        onClick={handleBellClick}
                    >
                        <Bell size={20} />
                        {unreadCount > 0 && (
                            <span className="topbar-badge" aria-label={isTr ? `${unreadCount} okunmamis bildirim` : `${unreadCount} unread notifications`}>
                                {unreadCount > 9 ? '9+' : unreadCount}
                            </span>
                        )}
                    </button>

                    {isNotifyOpen && (
                        <div className="topbar-notify-popover" role="dialog" aria-label={isTr ? 'Bildirimler' : 'Notifications'}>
                            <div className="topbar-notify-head">
                                <strong>{isTr ? 'Bildirimler' : 'Notifications'}</strong>
                                <span>{deals.length} {isTr ? 'aktif firsat' : 'active deals'}</span>
                            </div>

                            {deals.length > 0 ? (
                                <ul className="topbar-notify-list">
                                    {deals.slice(0, 4).map((deal) => (
                                        <li key={deal.id}>
                                            <div className="notify-item-title">{deal.name}</div>
                                            <div className="notify-item-meta">
                                                {isTr ? 'Yeni firsat' : 'New opportunity'} · {formatRelativeTime(deal.updatedAt, isTr)}
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="topbar-notify-empty">{isTr ? 'Yeni bildirim yok.' : 'No new notifications.'}</p>
                            )}

                            <div className="topbar-notify-actions">
                                <button
                                    className="topbar-notify-secondary"
                                    type="button"
                                    onClick={() => {
                                        markAllAsRead();
                                        setIsNotifyOpen(false);
                                    }}
                                >
                                    <CheckCheck size={14} />
                                    {isTr ? 'Okundu isaretle' : 'Mark as read'}
                                </button>
                                <button
                                    className="topbar-notify-primary"
                                    type="button"
                                    onClick={() => {
                                        setIsNotifyOpen(false);
                                        navigate('/dashboard/deals');
                                    }}
                                >
                                    {isTr ? 'Deals sayfasina git' : 'Open Deals'}
                                    <ExternalLink size={14} />
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                <button 
                    className="action-icon-btn"
                    title={isTr ? 'Ayarlar' : 'Settings'}
                    onClick={() => navigate('/dashboard/settings')}
                >
                    <Settings size={20} />
                </button>
                <div 
                    className="user-profile" 
                    onClick={() => navigate('/dashboard/settings')}
                    style={{ cursor: 'pointer' }}
                >
                    <span className="user-avatar user-avatar-initial">{avatarText}</span>
                </div>
            </div>
        </header>
    );
};

export default Topbar;