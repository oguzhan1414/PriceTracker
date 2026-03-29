import { useMemo, useState } from 'react';
import { Tag, TrendingDown, Clock, ExternalLink, Zap, Sparkles, Flame, Percent } from 'lucide-react';
import { AreaChart, Area, ResponsiveContainer, Tooltip } from 'recharts';
import { useTrackedItems } from '../../hooks/useTrackedItems';
import { useAuth } from '../../auth/AuthContext';
import './Deals.css';

const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1595225476474-87563907a212?q=80&w=2671&auto=format&fit=crop';

const formatCurrency = (value: number | null | undefined, locale: string) => {
    if (value == null) return locale === 'tr-TR' ? 'Bekleniyor' : 'Pending';
    return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: 'TRY',
        maximumFractionDigits: 0,
    }).format(value);
};

const sparklineData = (seed: string) => {
    let val = 50;
    return Array.from({ length: 20 }).map((_, i) => {
        const drift = ((seed.charCodeAt(i % seed.length) || 0) % 7) - 3;
        val = Math.max(10, Math.min(90, val + drift));
        return { value: val };
    });
};

const MiniSparkline = ({ data, color }: { data: Array<{ value: number }>; color: string }) => (
    <div className="deals-sparkline">
        <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
                <defs>
                    <linearGradient id={`deals-gradient-${color}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={color} stopOpacity={0.3} />
                        <stop offset="100%" stopColor={color} stopOpacity={0} />
                    </linearGradient>
                </defs>
                <Area type="monotone" dataKey="value" stroke={color} strokeWidth={2} fill={`url(#deals-gradient-${color})`} />
                <Tooltip contentStyle={{ background: '#1e1e2e', border: 'none', borderRadius: 8, fontSize: 12 }} labelStyle={{ color: '#a1a1aa' }} />
            </AreaChart>
        </ResponsiveContainer>
    </div>
);

const UrgencyBadge = ({ urgency, remainingTime }: { urgency: 'critical' | 'high' | 'medium' | 'low'; remainingTime: string }) => {
    const badges = {
        critical: { icon: Flame, color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)' },
        high: { icon: Zap, color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)' },
        medium: { icon: Clock, color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.1)' },
        low: { icon: Clock, color: '#71717a', bg: 'rgba(113, 113, 122, 0.1)' },
    };

    const badge = badges[urgency];
    const Icon = badge.icon;

    return (
        <div className="urgency-badge" style={{ background: badge.bg, color: badge.color }}>
            <Icon size={12} />
            <span>{remainingTime}</span>
        </div>
    );
};

const Deals = () => {
    const { items, isLoading, error } = useTrackedItems();
    const { user } = useAuth();
    const isTr = user?.language === 'tr';
    const locale = isTr ? 'tr-TR' : 'en-US';
    const [activeFilter, setActiveFilter] = useState<'all' | 'new' | 'best'>('all');

    const t = {
        headerBadge: isTr ? 'FIRSAT RADARI' : 'OPPORTUNITY RADAR',
        headerLead: isTr ? 'Aktif' : 'Active',
        headerAccent: isTr ? 'Firsatlar' : 'Deals',
        headerDesc: isTr
            ? 'Firsatlar takip listenize gore otomatik olusur. Hedef fiyat altina dusen urunler onceliklenir.'
            : 'Deals are automatically generated from your watchlist. Products that drop below the target price are prioritized.',
        aiButton: isTr ? 'AI Onerileri' : 'AI Recommendations',
        aiSoon: isTr ? 'Yakinda: onerileri motoru' : 'Coming soon: recommendation engine',
        stats: {
            totalSavings: isTr ? 'TOPLAM TASARRUF' : 'TOTAL SAVINGS',
            totalSavingsSub: isTr ? 'Hedef altina inen urunlerden hesaplanir' : 'Calculated from products below target',
            expiringSoon: isTr ? 'YAKINDA KACABILIR' : 'EXPIRING SOON',
            expiringSoonSub: isTr ? 'Son 24 saatte yakalananlar' : 'Caught in the last 24 hours',
            bestDiscount: isTr ? 'EN IYI INDIRIM' : 'BEST DISCOUNT',
            noData: isTr ? 'Henuz veri yok' : 'No data yet',
            activeDeals: isTr ? 'AKTIF FIRSATLAR' : 'ACTIVE DEALS',
            activeDealsSub: isTr ? 'Takipteki firsatlar' : 'Tracked opportunities',
        },
        hottest: isTr ? 'EN SICAK FIRSAT' : 'HOTTEST DEAL',
        bestNow: isTr ? 'Su Anki En Iyi Firsat' : 'Best Opportunity Right Now',
        off: isTr ? 'INDIRIM' : 'OFF',
        shopNow: isTr ? 'Urunu Ac' : 'Shop Now',
        convertedTitle: isTr ? 'Firsata Donusen Urunler' : 'Products Converted to Deals',
        all: isTr ? 'Tum' : 'All',
        new24h: isTr ? 'Yeni (24s)' : 'New (24h)',
        highestDiscount: isTr ? 'En Yuksek Indirim' : 'Highest Discount',
        loading: isTr ? 'Firsatlar yukleniyor...' : 'Loading deals...',
        table: {
            product: isTr ? 'URUN' : 'PRODUCT',
            price: isTr ? 'FIYAT' : 'PRICE',
            discount: isTr ? 'INDIRIM' : 'DISCOUNT',
            trend: isTr ? 'FIYAT TRENDI' : 'PRICE TREND',
            expires: isTr ? 'SURESI' : 'EXPIRES IN',
            source: isTr ? 'KAYNAK' : 'SOURCE',
            action: isTr ? 'ISLEM' : 'ACTION',
            target: isTr ? 'Hedef:' : 'Target:',
            save: isTr ? 'Tasarruf' : 'Save',
            visit: isTr ? 'Git' : 'Visit',
        },
        emptyTitle: isTr ? 'Henuz firsat yok' : 'No deals yet',
        emptyDesc: isTr
            ? 'Bu sayfa sadece hedef fiyat altina dusen urunleri gosterir. Kirmizi nokta yeni firsati ifade eder.'
            : 'This page shows only products that dropped below the target price. A red dot means a new deal has arrived.',
        urgency: {
            critical: isTr ? 'Cok Sicak' : 'Very Hot',
            high: isTr ? 'Sicak' : 'Hot',
            medium: isTr ? 'Takipte' : 'Watch',
            low: isTr ? 'Normal' : 'Normal',
        },
    };

    const dealsData = useMemo(() => {
        const now = Date.now();
        const mapped = items
            .filter((item) => item.target_price != null && item.product.current_price != null)
            .map((item) => {
                const current = item.product.current_price as number;
                const target = item.target_price as number;
                const discountRate = ((target - current) / target) * 100;
                const absoluteSave = target - current;
                const updatedAt = item.product.last_checked_at || item.created_at;
                const updatedTs = new Date(updatedAt).getTime();
                const isNew = !Number.isNaN(updatedTs) && now - updatedTs <= 24 * 60 * 60 * 1000;

                let urgency: 'critical' | 'high' | 'medium' | 'low' = 'low';
                if (discountRate >= 20) urgency = 'critical';
                else if (discountRate >= 10) urgency = 'high';
                else if (discountRate >= 3) urgency = 'medium';

                return {
                    id: item.tracked_item_id,
                    name: item.product.name || (item.product.source || 'product').toUpperCase(),
                    category: (item.product.source || 'unknown').toUpperCase(),
                    imageUrl: item.product.image_url || null,
                    price: current,
                    oldPrice: target,
                    discount: discountRate,
                    discountAmount: absoluteSave,
                    remainingTime:
                        urgency === 'critical' ? t.urgency.critical
                            : urgency === 'high' ? t.urgency.high
                                : urgency === 'medium' ? t.urgency.medium
                                    : t.urgency.low,
                    source: (item.product.source || 'unknown').toUpperCase(),
                    sourceColor: '#f43f5e',
                    urgency,
                    chartData: sparklineData(item.product.id),
                    url: item.product.original_url || '',
                    isNew,
                };
            })
            .filter((deal) => deal.discount > 0)
            .sort((a, b) => b.discount - a.discount);

        if (activeFilter === 'new') return mapped.filter((d) => d.isNew);
        if (activeFilter === 'best') return mapped.slice(0, 20);
        return mapped;
    }, [activeFilter, items, t.urgency.critical, t.urgency.high, t.urgency.low, t.urgency.medium]);

    const totalSavings = dealsData.reduce((sum, deal) => sum + Math.max(0, deal.discountAmount), 0);
    const expiringSoon = dealsData.filter((d) => d.urgency === 'critical' || d.urgency === 'high').length;
    const bestDeal = dealsData[0];

    return (
        <div className="deals-container dashboard-page">
            <div className="deals-header">
                <div className="header-left">
                    <span className="header-badge">OPPORTUNITY RADAR</span>
                    <h1 className="deals-title">
                        {t.headerLead} <span className="gradient-text">{t.headerAccent}</span>
                    </h1>
                    <p className="deals-description">
                        {t.headerDesc}
                    </p>
                </div>
                <div className="header-right">
                    <button className="ai-deals-btn" onClick={() => window.alert(t.aiSoon)}>
                        <Sparkles size={16} />
                        {t.aiButton}
                    </button>
                </div>
            </div>

            <div className="deals-stats">
                <div className="stat-card">
                    <div className="stat-info">
                        <span className="stat-label">{t.stats.totalSavings}</span>
                        <div className="stat-value">{formatCurrency(totalSavings, locale)}</div>
                        <div className="stat-sub">{t.stats.totalSavingsSub}</div>
                    </div>
                    <div className="stat-icon" style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)' }}>
                        <Tag size={24} color="#10b981" />
                    </div>
                </div>

                <div className="stat-card">
                    <div className="stat-info">
                        <span className="stat-label">{t.stats.expiringSoon}</span>
                        <div className="stat-value">{expiringSoon}</div>
                        <div className="stat-sub">{t.stats.expiringSoonSub}</div>
                    </div>
                    <div className="stat-icon" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)' }}>
                        <Clock size={24} color="#ef4444" />
                    </div>
                </div>

                <div className="stat-card">
                    <div className="stat-info">
                        <span className="stat-label">{t.stats.bestDiscount}</span>
                        <div className="stat-value">{bestDeal ? `${Math.max(0, bestDeal.discount).toFixed(1)}%` : '0%'}</div>
                        <div className="stat-sub">{bestDeal?.name || t.stats.noData}</div>
                    </div>
                    <div className="stat-icon" style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)' }}>
                        <Flame size={24} color="#f59e0b" />
                    </div>
                </div>

                <div className="stat-card">
                    <div className="stat-info">
                        <span className="stat-label">{t.stats.activeDeals}</span>
                        <div className="stat-value">{dealsData.length}</div>
                        <div className="stat-sub">{t.stats.activeDealsSub}</div>
                    </div>
                    <div className="stat-icon" style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)' }}>
                        <Percent size={24} color="#3b82f6" />
                    </div>
                </div>
            </div>

            {bestDeal && (
                <div className="featured-deal">
                    <div className="featured-content">
                        <div className="featured-badge">
                            <Zap size={12} />
                            {t.hottest}
                        </div>
                        <h3>{t.bestNow}</h3>
                        <p className="featured-name">{bestDeal.name}</p>
                        <div className="featured-pricing">
                            <span className="featured-price">{formatCurrency(bestDeal.price, locale)}</span>
                            <span className="featured-old-price">{formatCurrency(bestDeal.oldPrice, locale)}</span>
                            <span className="featured-discount">{Math.max(0, bestDeal.discount).toFixed(1)}% {t.off}</span>
                        </div>
                        <button className="featured-btn" onClick={() => bestDeal.url && window.open(bestDeal.url, '_blank', 'noopener,noreferrer')}>
                            {t.shopNow}
                            <ExternalLink size={14} />
                        </button>
                    </div>
                    <div className="featured-glow"></div>
                </div>
            )}

            <section className="deals-table-section">
                <div className="section-header">
                    <h3>{t.convertedTitle}</h3>
                    <div className="section-filters">
                        <button className={`filter-btn ${activeFilter === 'all' ? 'active' : ''}`} onClick={() => setActiveFilter('all')}>{t.all}</button>
                        <button className={`filter-btn ${activeFilter === 'new' ? 'active' : ''}`} onClick={() => setActiveFilter('new')}>{t.new24h}</button>
                        <button className={`filter-btn ${activeFilter === 'best' ? 'active' : ''}`} onClick={() => setActiveFilter('best')}>{t.highestDiscount}</button>
                    </div>
                </div>

                {isLoading && <p className="deals-description">{t.loading}</p>}
                {error && <p className="deals-description">{error}</p>}

                {!isLoading && dealsData.length > 0 && (
                    <div className="table-wrapper">
                        <table className="deals-table">
                            <thead>
                                <tr>
                                    <th>{t.table.product}</th>
                                    <th>{t.table.price}</th>
                                    <th>{t.table.discount}</th>
                                    <th>{t.table.trend}</th>
                                    <th>{t.table.expires}</th>
                                    <th>{t.table.source}</th>
                                    <th>{t.table.action}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {dealsData.map((deal) => (
                                    <tr key={deal.id} className={`urgency-${deal.urgency}`}>
                                        <td>
                                            <div className="product-cell">
                                                <div className="product-image-wrapper">
                                                    <img src={deal.imageUrl || FALLBACK_IMAGE} alt={deal.name} className="product-image" />
                                                    <div className="source-badge" style={{ backgroundColor: deal.sourceColor }}>
                                                        {deal.source}
                                                    </div>
                                                </div>
                                                <div className="product-info">
                                                    <h4>{deal.name}</h4>
                                                    <span className="product-category">{deal.category}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <div className="price-cell">
                                                <span className="current-price">{formatCurrency(deal.price, locale)}</span>
                                                <span className="old-price">{t.table.target} {formatCurrency(deal.oldPrice, locale)}</span>
                                            </div>
                                        </td>
                                        <td>
                                            <div className="discount-badge">
                                                <TrendingDown size={12} />
                                                <span>{Math.max(0, deal.discount).toFixed(1)}%</span>
                                            </div>
                                            <div className="savings-amount">{t.table.save} {formatCurrency(Math.max(0, deal.discountAmount), locale)}</div>
                                        </td>
                                        <td>
                                            <MiniSparkline data={deal.chartData} color="#f43f5e" />
                                        </td>
                                        <td>
                                            <UrgencyBadge urgency={deal.urgency} remainingTime={deal.remainingTime} />
                                        </td>
                                        <td>
                                            <div className="source-tag" style={{ borderColor: deal.sourceColor, color: deal.sourceColor }}>
                                                {deal.source}
                                            </div>
                                        </td>
                                        <td>
                                            <button className="visit-btn" onClick={() => deal.url && window.open(deal.url, '_blank', 'noopener,noreferrer')}>
                                                <span>{t.table.visit}</span>
                                                <ExternalLink size={14} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>

            {!isLoading && dealsData.length === 0 && (
                <div className="empty-state">
                    <div className="empty-icon">🎯</div>
                    <h3>{t.emptyTitle}</h3>
                    <p>{t.emptyDesc}</p>
                </div>
            )}
        </div>
    );
};

export default Deals;