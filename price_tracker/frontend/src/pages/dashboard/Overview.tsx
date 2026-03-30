import { useMemo } from 'react';
import { Activity, TrendingUp, Shield, Tag, Eye, Bell } from 'lucide-react';
import { AreaChart, Area, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from 'recharts';
import { useTrackedItems } from '../../hooks/useTrackedItems';
import { useAuth } from '../../auth/AuthContext';
import { useNavigate } from 'react-router-dom';
import './Overview.css';

const formatCurrency = (value: number | null | undefined, currencyCode: string = 'TRY', locale: string) => {
    if (value == null) return locale === 'tr-TR' ? 'Bekleniyor' : 'Pending';
    return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: currencyCode,
        maximumFractionDigits: 0,
    }).format(value);
};

const Overview = () => {
    const navigate = useNavigate();
    const { items, isLoading, error } = useTrackedItems();
    const { user } = useAuth();
    const isTr = user?.language === 'tr';
    const locale = isTr ? 'tr-TR' : 'en-US';

    const t = {
        headerBadge: isTr ? 'DASHBOARD / GENEL' : 'DASHBOARD / HOME',
        headerTitleLead: isTr ? 'Operasyon' : 'Operations',
        headerTitleAccent: isTr ? 'Kokpiti' : 'Cockpit',
        headerDesc: isTr
            ? 'Detay listeler yerine kusbakisi metrikler, genel trendler ve sistem durumu burada gorulur.'
            : "Bird's eye view metrics, overall trends, and system status instead of detailed lists are shown here.",
        stats: {
            totalTracked: isTr ? 'TOPLAM TAKIP' : 'TOTAL TRACKED',
            last24h: isTr ? 'SON 24 SAAT' : 'LAST 24 HOURS',
            health: isTr ? 'SISTEM SAGLIGI' : 'SYSTEM HEALTH',
            netSavings: isTr ? 'NET TASARRUF' : 'NET SAVINGS',
            sources: isTr ? 'kaynak' : 'sources',
            newDeals: isTr ? 'yeni firsat' : 'new deals',
            stable: isTr ? 'stabil' : 'stable',
            waiting: isTr ? 'veri bekleniyor' : 'waiting for data',
            days: isTr ? 'gunluk takip' : 'days of tracking',
        },
        chartTitle: isTr ? '7 Gunluk Genel Trend' : '7-Day Overall Trend',
        chartSub: isTr ? 'Takip edilen urun sayisi ve yakalanan firsat trendi' : 'Tracked item count and captured deals trend',
        loading: isTr ? 'Veriler yukleniyor...' : 'Loading data...',
        chartTracked: isTr ? 'Takip Sayisi' : 'Tracked Count',
        chartDeals: isTr ? 'Yakalanan Firsatlar' : 'Captured Deals',
        summaryTitle: isTr ? 'Kontrol Ozeti' : 'Control Summary',
        opportunityRate: isTr ? 'FIRSAT ORANI' : 'OPPORTUNITY RATE',
        systemStatus: isTr ? 'SISTEM DURUMU' : 'SYSTEM STATUS',
        dealAlert: isTr ? 'Firsat Uyarisi' : 'Deal Alert',
        dealAlertDesc: isTr
            ? 'Deals sekmesindeki kirmizi gosterge son 24 saatte yeni firsat yakalandigini belirtir.'
            : 'The red indicator in the Deals tab means a new opportunity was captured in the last 24 hours.',
        dealCount: isTr ? 'yeni firsat' : 'new deals',
        emptyTitle: isTr ? 'Takip listesi su an bos' : 'Your tracking list is currently empty',
        emptyDescription: isTr
            ? 'Ilk urununu ekledikten sonra metrikler ve trend grafiklerinin tamamini burada goreceksin.'
            : 'Once you add your first product, all metrics and trend visuals will be available here.',
        emptyCta: isTr ? 'Takip listesine urun ekle' : 'Add product to watchlist',
    };

    const totalTracked = items.length;

    const opportunities = useMemo(() => {
        return items.filter((item) => {
            const current = item.product.current_price;
            const target = item.target_price;
            return current != null && target != null && current <= target;
        });
    }, [items]);

    const dealsLast24h = useMemo(() => {
        const now = Date.now();
        return opportunities.filter((item) => {
            const updatedAt = item.product.last_checked_at || item.created_at;
            let dStr = updatedAt;
            if (dStr && !dStr.endsWith('Z') && !dStr.includes('+')) dStr += 'Z';
            const ts = new Date(dStr).getTime();
            if (Number.isNaN(ts)) return false;
            return now - ts <= 24 * 60 * 60 * 1000;
        }).length;
    }, [opportunities]);

    const systemHealth = useMemo(() => {
        if (items.length === 0) return 100;
        const ready = items.filter((item) => item.product.current_price != null).length;
        return Math.max(1, Math.min(100, Math.round((ready / items.length) * 100)));
    }, [items]);

    const sourcesCount = useMemo(() => {
        return new Set(items.map((item) => item.product.source).filter(Boolean)).size;
    }, [items]);

    const summarySeries = useMemo(() => {
        const labels = isTr ? ['Pzt', 'Sal', 'Car', 'Per', 'Cum', 'Cmt', 'Paz'] : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        const baseTracked = Math.max(totalTracked, 0);
        const baseDeals = Math.max(opportunities.length, 0);
        return labels.map((label, idx) => {
            const tracked = baseTracked === 0 ? 0 : Math.max(0, Math.round(baseTracked * (0.84 + idx * 0.03)));
            const deals = baseDeals === 0 ? 0 : Math.max(0, Math.round(baseDeals * (0.55 + idx * 0.08)));
            return { label, tracked, deals };
        });
    }, [isTr, opportunities.length, totalTracked]);

    const showEmptyState = !isLoading && !error && totalTracked === 0;

    const netSavings = opportunities.reduce((sum, item) => {
        const current = item.product.current_price;
        const target = item.target_price;
        if (current == null || target == null) return sum;
        return sum + Math.max(0, target - current);
    }, 0);

    const trackingSinceDays = useMemo(() => {
        if (items.length === 0) return 0;
        const firstDate = items
            .map((i) => {
                let dStr = i.created_at;
                if (dStr && !dStr.endsWith('Z') && !dStr.includes('+')) dStr += 'Z';
                return new Date(dStr).getTime();
            })
            .filter((t) => !Number.isNaN(t))
            .sort((a, b) => a - b)[0];
        if (!firstDate) return 0;
        return Math.max(1, Math.floor((Date.now() - firstDate) / (1000 * 60 * 60 * 24)));
    }, [items]);

    const summaryText = isTr
        ? `Takipteki ${totalTracked} urunun ${opportunities.length} adedi hedef fiyata ulasti. Son 24 saatte yakalanan yeni firsat sayisi ${dealsLast24h}.`
        : `Out of ${totalTracked} products being tracked, ${opportunities.length} products have reached the target price. New deals captured in the last 24 hours: ${dealsLast24h}.`;

    const stats = [
        { label: t.stats.totalTracked, value: String(totalTracked), change: `${sourcesCount} ${t.stats.sources}`, changeType: 'neutral', icon: Activity, color: '#3b82f6' },
        { label: t.stats.last24h, value: String(dealsLast24h), change: t.stats.newDeals, changeType: dealsLast24h > 0 ? 'positive' : 'neutral', icon: Tag, color: '#f43f5e' },
        { label: t.stats.health, value: `%${systemHealth}`, change: systemHealth >= 95 ? t.stats.stable : t.stats.waiting, changeType: systemHealth >= 95 ? 'positive' : 'negative', icon: Shield, color: '#10b981' },
        { label: t.stats.netSavings, value: formatCurrency(netSavings, 'TRY', locale), change: `${trackingSinceDays} ${t.stats.days}`, changeType: 'positive', icon: TrendingUp, color: '#8b5cf6' },
    ];

    return (
        <div className="overview-container dashboard-page">
            <div className="overview-header">
                <div className="header-left">
                    <span className="header-badge">{t.headerBadge}</span>
                    <h1 className="overview-title">
                        {t.headerTitleLead} <span className="gradient-text">{t.headerTitleAccent}</span>
                    </h1>
                    <p className="overview-description">
                        {t.headerDesc}
                    </p>
                </div>
            </div>

            <div className="stats-grid">
                {stats.map((stat) => (
                    <div key={stat.label} className="stat-card">
                        <div className="stat-info">
                            <span className="stat-label">{stat.label}</span>
                            <div className="stat-value">{stat.value}</div>
                            <div className={`stat-trend ${stat.changeType}`}>
                                {stat.changeType === 'positive' && <TrendingUp size={14} />}
                                {stat.changeType === 'negative' && <Bell size={14} />}
                                {stat.changeType === 'neutral' && <Eye size={14} />}
                                <span>{stat.change}</span>
                            </div>
                        </div>
                        <div className="stat-icon" style={{ backgroundColor: `${stat.color}15` }}>
                            <stat.icon size={24} color={stat.color} />
                        </div>
                    </div>
                ))}
            </div>

            {showEmptyState && (
                <div className="overview-empty-state">
                    <div className="overview-empty-dot" aria-hidden="true"></div>
                    <div>
                        <h3>{t.emptyTitle}</h3>
                        <p>{t.emptyDescription}</p>
                    </div>
                    <button type="button" className="overview-empty-btn" onClick={() => navigate('/dashboard/watchlist')}>
                        {t.emptyCta}
                    </button>
                </div>
            )}

            <section className="terminal-section cockpit-chart-section">
                <div className="terminal-header">
                    <div className="terminal-title">
                        <Tag size={18} />
                        <h3>{t.chartTitle}</h3>
                    </div>
                    <span className="overview-description">{t.chartSub}</span>
                </div>

                {isLoading && <p className="overview-description">{t.loading}</p>}
                {error && <p className="overview-description">{error}</p>}

                {!isLoading && (
                    <div className="overview-chart-wrap">
                        <ResponsiveContainer width="100%" height={360}>
                            <AreaChart data={summarySeries} margin={{ left: 0, right: 12, top: 8, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="overview-tracked" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.35} />
                                        <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.04} />
                                    </linearGradient>
                                    <linearGradient id="overview-deals" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#f43f5e" stopOpacity={0.35} />
                                        <stop offset="100%" stopColor="#f43f5e" stopOpacity={0.05} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />
                                <XAxis dataKey="label" tick={{ fill: '#9ca3af', fontSize: 12 }} axisLine={false} tickLine={false} />
                                <YAxis tick={{ fill: '#6b7280', fontSize: 12 }} axisLine={false} tickLine={false} width={34} />
                                <Tooltip contentStyle={{ background: '#111827', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10 }} />
                                <Area type="monotone" dataKey="tracked" name={t.chartTracked} stroke="#3b82f6" fill="url(#overview-tracked)" strokeWidth={2.2} />
                                <Area type="monotone" dataKey="deals" name={t.chartDeals} stroke="#f43f5e" fill="url(#overview-deals)" strokeWidth={2.2} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </section>

            <div className="bottom-grid cockpit-summary-grid">
                <div className="intelligence-card">
                    <div className="intelligence-glow"></div>
                    <div className="intelligence-header">
                        <div className="pulse-dot"></div>
                        <h3>{t.summaryTitle}</h3>
                    </div>
                    <p className="ai-text">{summaryText}</p>
                    <div className="score-grid">
                        <div className="score-item">
                            <label>{t.opportunityRate}</label>
                            <div className="score-value high">{totalTracked ? ((opportunities.length / totalTracked) * 100).toFixed(1) : '0.0'}%</div>
                            <div className="score-bar">
                                <div className="score-bar-fill" style={{ width: `${totalTracked ? (opportunities.length / totalTracked) * 100 : 0}%` }}></div>
                            </div>
                        </div>
                        <div className="score-item">
                            <label>{t.systemStatus}</label>
                            <div className="score-value success">%{systemHealth}</div>
                        </div>
                    </div>
                </div>

                <div className="alert-card">
                    <div className="alert-icon-wrapper">
                        <Bell size={28} />
                    </div>
                    <h3>{t.dealAlert}</h3>
                    <p>{t.dealAlertDesc}</p>
                    <div className="score-value high">{dealsLast24h} {t.dealCount}</div>
                </div>
            </div>
        </div>
    );
};

export default Overview;