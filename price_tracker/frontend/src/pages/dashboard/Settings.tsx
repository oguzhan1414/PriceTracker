import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    User,
    Bell,
    Smartphone,
    CreditCard,
    Mail,
    Save,
    Globe,
    CheckCircle,
    ChevronRight,
    Clock,
    MessageCircle,
} from 'lucide-react';
import { useToast } from '../../ui/ToastContext';
import { useAuth } from '../../auth/AuthContext';
import {
    paymentApi,
    telegramApi,
    type PaymentConfigResponse,
    type PaymentSubscriptionResponse,
    type TelegramLinkStartResponse,
} from '../../lib/api';
import './Settings.css';

type SettingsTab = 'profile' | 'notifications' | 'billing' | 'preferences';
type UiLanguage = 'en' | 'tr';

const I18N: Record<UiLanguage, any> = {
    en: {
        headerBadge: 'CONFIGURATION',
        headerTitleLeft: 'Account',
        headerTitleRight: 'Settings',
        headerDescription: 'Manage your account details, notifications, subscription, and language preferences.',
        tabs: {
            profile: { label: 'Profile', description: 'Edit your account name' },
            notifications: { label: 'Notifications', description: 'Manage alert delivery options' },
            billing: { label: 'Plan & Billing', description: 'Subscription and checkout settings' },
            preferences: { label: 'Preferences', description: 'Language and regional options' },
        },
        overview: {
            currentPlan: 'Current Plan',
            language: 'Interface',
            emailAlerts: 'Email Alerts',
            telegram: 'Telegram',
            connected: 'Connected',
            notConnected: 'Not connected',
            premiumOnly: 'Premium only',
            enabled: 'Enabled',
            disabled: 'Disabled',
        },
        profile: {
            title: 'Profile',
            subtitle: 'You can only change your display name. Email is fixed.',
            active: 'Active Account',
            guest: 'Guest',
            noEmail: 'No email found',
            fallbackName: 'User',
            fullNameLabel: 'Full Name',
            fullNamePlaceholder: 'Enter your name',
            emailLabel: 'Email Address (read only)',
            save: 'Save Name',
        },
        notifications: {
            title: 'Alert Preferences',
            subtitle: 'Choose how and when you want to be notified.',
            channels: 'Notification Channels',
            email: 'Email Notifications',
            push: 'Push Notifications',
            save: 'Save Notification Settings',
        },
        telegram: {
            title: 'Telegram Connection',
            copyAllowed: 'To receive Telegram alerts, connect your bot session once and keep your alerts active.',
            copyPremium: 'Telegram notifications are available on Premium plan. Upgrade to unlock Telegram delivery.',
            step1: 'Click Connect to Telegram.',
            step2: 'Bot opens with a secure one-time code.',
            step3: 'Press Start in Telegram, then return here and refresh status.',
            statusTitle: 'Connection Status',
            premiumRequired: 'Premium plan required',
            connected: 'Connected and ready',
            notConnected: 'Not connected yet',
            refresh: 'Refresh Status',
            openBot: 'Open Telegram Bot',
            connectBot: 'Connect to Telegram',
            connecting: 'Preparing secure link...',
            disconnect: 'Disconnect Telegram',
            secureCodeTitle: 'Manual fallback command',
            secureCodeHint: 'If Telegram did not open, copy and send this command to the bot:',
            secureCodeExpires: 'Code expires at',
            upgrade: 'Upgrade to Premium',
        },
        billing: {
            title: 'Plan & Billing',
            subtitle: 'Manage your subscription and continue checkout securely.',
            bannerTitle: 'Choose your plan',
            bannerDesc: 'Compare Free and Premium, then continue to secure checkout.',
            bannerBtn: 'Open Checkout',
            freeName: 'Starter',
            premiumName: 'Pro',
            currentPlan: 'Current Plan',
            downgradeUnavailable: 'Downgrade unavailable',
            upgradePremium: 'Upgrade to Premium',
            provider: 'Provider',
            interval: 'Interval',
            monthly: 'Monthly',
            yearly: 'Yearly',
            startCheckout: 'Start Secure Checkout',
            redirecting: 'Redirecting...',
            openDedicated: 'Open Dedicated Checkout Page',
            sandboxTag: 'Sandbox Mode',
            sandboxFallback: 'Payments are currently in sandbox/test mode. Use only test card information.',
            statusPrefix: 'Subscription status:',
            freeMonthly: '/month',
            paidMonth: '/month',
            paidYear: '/year',
            freeFeatures: (limit: number) => [
                `Up to ${limit} tracked products`,
                'Email notifications',
                'Daily checks',
            ],
            premiumFeatures: [
                'Unlimited product tracking',
                'Telegram alerts',
                'Priority support',
            ],
            currentFreeFeatures: (limit: number) => [
                `Up to ${limit} tracked products`,
                'Email notifications',
                'Daily price checks',
                'Dashboard access',
            ],
            currentPremiumFeatures: [
                'Unlimited product tracking',
                'Telegram notifications',
                'Faster updates and richer insights',
                'Priority support',
            ],
        },
        preferences: {
            title: 'Preferences',
            subtitle: 'Choose your interface language.',
            language: 'Language',
            note: 'Default language is English. Switch to Turkish if you prefer.',
            interfaceLanguage: 'Interface Language',
            persistenceInfo: 'This preference is saved to your account.',
            saveLanguage: 'Save Language',
        },
        common: {
            saving: 'Saving...',
            free: 'FREE',
            premium: 'PREMIUM',
            plan: 'PLAN',
            inactive: 'inactive',
        },
        toast: {
            paymentCanceled: 'Payment was canceled. You can retry anytime.',
            paymentActivated: 'Payment completed! Premium plan is now active.',
            paymentVerifyFail: 'Payment verification failed. Please contact support.',
            paymentRefreshing: 'Payment completed. Subscription status is refreshing.',
            nameSaved: 'Name updated successfully.',
            profileSaveFail: 'Profile could not be updated',
            notificationsSaved: 'Notification preferences saved.',
            notificationsSaveFail: 'Notification preferences could not be saved',
            languageSavedEn: 'Language preference saved as English.',
            languageSavedTr: 'Dil tercihi Turkce olarak kaydedildi.',
            languageSaveFail: 'Language preference could not be saved',
            paymentsDisabled: 'Payments are currently disabled.',
            redirectingCheckout: 'Redirecting to secure checkout...',
            checkoutMissing: 'Checkout URL is missing',
            checkoutStartFail: 'Failed to start checkout',
            telegramLinkReady: 'Telegram link generated. Continue in Telegram and press Start.',
            telegramLinkStartFail: 'Failed to create Telegram link',
            telegramDisconnected: 'Telegram connection removed.',
            telegramDisconnectFail: 'Failed to disconnect Telegram',
        },
    },
    tr: {
        headerBadge: 'AYARLAR',
        headerTitleLeft: 'Hesap',
        headerTitleRight: 'Ayarlari',
        headerDescription: 'Hesap bilgilerini, bildirim ayarlarini, aboneligini ve dil tercihlerini yonet.',
        tabs: {
            profile: { label: 'Profil', description: 'Hesap adini duzenle' },
            notifications: { label: 'Bildirimler', description: 'Bildirim kanallarini yonet' },
            billing: { label: 'Plan ve Odeme', description: 'Abonelik ve odeme ayarlari' },
            preferences: { label: 'Tercihler', description: 'Dil ve bolge ayarlari' },
        },
        overview: {
            currentPlan: 'Mevcut Plan',
            language: 'Arayuz',
            emailAlerts: 'E-posta Alarmlari',
            telegram: 'Telegram',
            connected: 'Bagli',
            notConnected: 'Bagli degil',
            premiumOnly: 'Premium gerekli',
            enabled: 'Acik',
            disabled: 'Kapali',
        },
        profile: {
            title: 'Profil',
            subtitle: 'Sadece gorunen adini degistirebilirsin. E-posta sabittir.',
            active: 'Aktif Hesap',
            guest: 'Misafir',
            noEmail: 'E-posta bulunamadi',
            fallbackName: 'Kullanici',
            fullNameLabel: 'Ad Soyad',
            fullNamePlaceholder: 'Adini gir',
            emailLabel: 'E-posta (salt okunur)',
            save: 'Adi Kaydet',
        },
        notifications: {
            title: 'Bildirim Tercihleri',
            subtitle: 'Ne zaman ve nasil bildirim almak istedigini sec.',
            channels: 'Bildirim Kanallari',
            email: 'E-posta Bildirimleri',
            push: 'Push Bildirimleri',
            save: 'Bildirim Ayarlarini Kaydet',
        },
        telegram: {
            title: 'Telegram Baglantisi',
            copyAllowed: 'Telegram bildirimi almak icin bot baglantini bir kez kur ve alarmlari acik tut.',
            copyPremium: 'Telegram bildirimleri Premium planda aciktir. Etkinlestirmek icin yukseltebilirsin.',
            step1: 'Telegrama Baglan dugmesine tikla.',
            step2: 'Bot guvenli tek kullanimlik kod ile acilir.',
            step3: 'Telegramda Starta bas, sonra buraya donup durumu yenile.',
            statusTitle: 'Baglanti Durumu',
            premiumRequired: 'Premium plan gerekli',
            connected: 'Bagli ve hazir',
            notConnected: 'Henuz bagli degil',
            refresh: 'Durumu Yenile',
            openBot: 'Telegram Botunu Ac',
            connectBot: 'Telegrama Baglan',
            connecting: 'Guvenli baglanti hazirlaniyor...',
            disconnect: 'Telegram Baglantisini Kaldir',
            secureCodeTitle: 'Manuel komut',
            secureCodeHint: 'Telegram otomatik acilmazsa bu komutu kopyalayip bota gonder:',
            secureCodeExpires: 'Kod gecerlilik bitisi',
            upgrade: 'Premiuma Yukselt',
        },
        billing: {
            title: 'Plan ve Odeme',
            subtitle: 'Aboneligini yonet ve guvenli odeme ile devam et.',
            bannerTitle: 'Planini sec',
            bannerDesc: 'Free ve Premium farklarini karsilastir, sonra guvenli odemeye gec.',
            bannerBtn: 'Checkout Ac',
            freeName: 'Baslangic',
            premiumName: 'Pro',
            currentPlan: 'Mevcut Plan',
            downgradeUnavailable: 'Dusurme su an yok',
            upgradePremium: 'Premiuma Yukselt',
            provider: 'Saglayici',
            interval: 'Periyot',
            monthly: 'Aylik',
            yearly: 'Yillik',
            startCheckout: 'Guvenli Odemeyi Baslat',
            redirecting: 'Yonlendiriliyor...',
            openDedicated: 'Ayrik Checkout Sayfasini Ac',
            sandboxTag: 'Sandbox Modu',
            sandboxFallback: 'Odemeler su anda test/sandbox modunda. Lutfen sadece test kart bilgileri kullanin.',
            statusPrefix: 'Abonelik durumu:',
            freeMonthly: '/ay',
            paidMonth: '/ay',
            paidYear: '/yil',
            freeFeatures: (limit: number) => [
                `En fazla ${limit} urun takibi`,
                'E-posta bildirimleri',
                'Gunluk kontrol',
            ],
            premiumFeatures: [
                'Limitsiz urun takibi',
                'Telegram bildirimleri',
                'Oncelikli destek',
            ],
            currentFreeFeatures: (limit: number) => [
                `En fazla ${limit} urun takibi`,
                'E-posta bildirimleri',
                'Gunluk fiyat kontrolu',
                'Dashboard erisimi',
            ],
            currentPremiumFeatures: [
                'Limitsiz urun takibi',
                'Telegram bildirimleri',
                'Daha hizli guncelleme ve gelismis icgoruler',
                'Oncelikli destek',
            ],
        },
        preferences: {
            title: 'Tercihler',
            subtitle: 'Arayuz dilini sec.',
            language: 'Dil',
            note: 'Varsayilan dil Ingilizce. Istersen Turkceye gec.',
            interfaceLanguage: 'Arayuz Dili',
            persistenceInfo: 'Bu tercih hesabina kaydedilir.',
            saveLanguage: 'Dili Kaydet',
        },
        common: {
            saving: 'Kaydediliyor...',
            free: 'FREE',
            premium: 'PREMIUM',
            plan: 'PLAN',
            inactive: 'pasif',
        },
        toast: {
            paymentCanceled: 'Odeme iptal edildi. Diledigin zaman tekrar deneyebilirsin.',
            paymentActivated: 'Odeme tamamlandi! Premium planin aktif edildi.',
            paymentVerifyFail: 'Odeme dogrulamasi basarisiz. Lutfen destek ile iletisime gec.',
            paymentRefreshing: 'Odeme tamamlandi. Abonelik durumu yenileniyor.',
            nameSaved: 'Isim basariyla guncellendi.',
            profileSaveFail: 'Profil guncellenemedi',
            notificationsSaved: 'Bildirim tercihleri kaydedildi.',
            notificationsSaveFail: 'Bildirim tercihleri kaydedilemedi',
            languageSavedEn: 'Language preference saved as English.',
            languageSavedTr: 'Dil tercihi Turkce olarak kaydedildi.',
            languageSaveFail: 'Dil tercihi kaydedilemedi',
            paymentsDisabled: 'Odemeler su anda devre disi.',
            redirectingCheckout: 'Guvenli odemeye yonlendiriliyor...',
            checkoutMissing: 'Checkout URL bulunamadi',
            checkoutStartFail: 'Checkout baslatilamadi',
            telegramLinkReady: 'Telegram baglanti linki olusturuldu. Telegramda Starta basarak tamamlayabilirsin.',
            telegramLinkStartFail: 'Telegram baglanti linki olusturulamadi',
            telegramDisconnected: 'Telegram baglantisi kaldirildi.',
            telegramDisconnectFail: 'Telegram baglantisi kaldirilamadi',
        },
    },
};

const Settings = () => {
    const navigate = useNavigate();
    const { user, updateProfile, refreshMe } = useAuth();
    const { showToast } = useToast();

    const [activeTab, setActiveTab] = useState<SettingsTab>('profile');

    const [fullName, setFullName] = useState(user?.full_name || '');
    const [emailNotifications, setEmailNotifications] = useState(user?.email_notifications ?? true);
    const [pushNotifications, setPushNotifications] = useState(user?.push_notifications ?? true);
    const [language, setLanguage] = useState<UiLanguage>(user?.language === 'tr' ? 'tr' : 'en');

    const [isSavingProfile, setIsSavingProfile] = useState(false);
    const [isSavingNotifications, setIsSavingNotifications] = useState(false);
    const [isSavingLanguage, setIsSavingLanguage] = useState(false);

    const [paymentConfig, setPaymentConfig] = useState<PaymentConfigResponse | null>(null);
    const [paymentSubscription, setPaymentSubscription] = useState<PaymentSubscriptionResponse | null>(null);
    const [paymentProvider, setPaymentProvider] = useState<'stripe' | 'iyzico'>('stripe');
    const [billingInterval, setBillingInterval] = useState<'monthly' | 'yearly'>('monthly');
    const [isStartingCheckout, setIsStartingCheckout] = useState(false);
    const [telegramLinkSession, setTelegramLinkSession] = useState<TelegramLinkStartResponse | null>(null);
    const [isPreparingTelegramLink, setIsPreparingTelegramLink] = useState(false);
    const [isDisconnectingTelegram, setIsDisconnectingTelegram] = useState(false);

    useEffect(() => {
        setFullName(user?.full_name || '');
        setEmailNotifications(user?.email_notifications ?? true);
        setPushNotifications(user?.push_notifications ?? true);
        setLanguage(user?.language === 'tr' ? 'tr' : 'en');
    }, [user?.full_name, user?.email_notifications, user?.push_notifications, user?.language]);

    useEffect(() => {
        document.documentElement.lang = language;
    }, [language]);

    useEffect(() => {
        const initBilling = async () => {
            try {
                const [config, subscription] = await Promise.all([paymentApi.config(), paymentApi.subscription()]);
                setPaymentConfig(config);
                setPaymentSubscription(subscription);
                if (config.default_provider === 'iyzico') {
                    setPaymentProvider('iyzico');
                }
            } catch {
                setPaymentConfig(null);
                setPaymentSubscription(null);
            }
        };

        void initBilling();
    }, []);

    const t = I18N[language];
    const paymentNotice = paymentConfig?.payment_public_notice || t.billing.sandboxFallback;
    const showPaymentNotice = Boolean(paymentConfig?.sandbox_mode || paymentConfig?.payment_public_notice);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const paymentState = params.get('payment');
        const provider = params.get('provider');
        const sessionId = params.get('session_id');
        const token = params.get('token');

        if (!paymentState && !sessionId && !token) return;

        const handleReturn = async () => {
            if (paymentState === 'cancel') {
                showToast('info', t.toast.paymentCanceled);
            } else if ((sessionId || token) && provider) {
                try {
                    await paymentApi.verify({
                        provider,
                        session_id: sessionId || undefined,
                        token: token || undefined,
                    });
                    showToast('success', t.toast.paymentActivated);
                    await refreshMe();
                    void paymentApi.subscription().then(setPaymentSubscription).catch(() => undefined);
                } catch {
                    showToast('error', t.toast.paymentVerifyFail);
                }
            } else if (paymentState === 'success') {
                showToast('success', t.toast.paymentRefreshing);
                void refreshMe();
                void paymentApi.subscription().then(setPaymentSubscription).catch(() => undefined);
            }
        };

        void handleReturn();

        params.delete('payment');
        params.delete('provider');
        params.delete('session_id');
        params.delete('token');
        const nextQuery = params.toString();
        const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ''}${window.location.hash}`;
        window.history.replaceState({}, '', nextUrl);
    }, [refreshMe, showToast, t.toast.paymentActivated, t.toast.paymentCanceled, t.toast.paymentRefreshing, t.toast.paymentVerifyFail]);

    const avatarText = useMemo(
        () => user?.avatar_initial || fullName.trim().charAt(0).toUpperCase() || user?.email?.trim().charAt(0).toUpperCase() || 'U',
        [user?.avatar_initial, fullName, user?.email]
    );

    const billingPrice = useMemo(() => {
        const locale = language === 'tr' ? 'tr-TR' : 'en-US';
        const currency = paymentConfig?.currency || 'USD';
        const amount = billingInterval === 'monthly'
            ? (paymentConfig?.price_pro_monthly ?? 2.99)
            : (paymentConfig?.price_pro_yearly ?? 29.99);

        try {
            return new Intl.NumberFormat(locale, {
                style: 'currency',
                currency,
                maximumFractionDigits: 2,
            }).format(amount);
        } catch {
            return `${amount.toFixed(2)} ${currency}`;
        }
    }, [billingInterval, language, paymentConfig?.currency, paymentConfig?.price_pro_monthly, paymentConfig?.price_pro_yearly]);

    const telegramCodeExpiryLabel = useMemo(() => {
        if (!telegramLinkSession?.expires_at) {
            return null;
        }

        const locale = language === 'tr' ? 'tr-TR' : 'en-US';
        const date = new Date(telegramLinkSession.expires_at);
        if (Number.isNaN(date.getTime())) {
            return null;
        }
        return date.toLocaleString(locale, {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
        });
    }, [language, telegramLinkSession?.expires_at]);

    const currentPlanKey = (paymentSubscription?.plan || user?.plan || 'free').toLowerCase();
    const isCurrentPremium = currentPlanKey === 'pro' || currentPlanKey === 'premium';
    const freeTrackedLimit = paymentConfig?.features?.max_tracked_items ?? 5;
    const telegramAllowedInPlan = paymentConfig?.features?.telegram_notifications ?? isCurrentPremium;
    const telegramConnectedRaw = Boolean(user?.telegram_chat_id);
    const telegramConnected = telegramAllowedInPlan && telegramConnectedRaw;

    useEffect(() => {
        if (telegramConnectedRaw) {
            setTelegramLinkSession(null);
        }
    }, [telegramConnectedRaw]);

    const profileChanged = fullName.trim() !== (user?.full_name || '').trim();
    const notificationsChanged =
        emailNotifications !== (user?.email_notifications ?? true) ||
        pushNotifications !== (user?.push_notifications ?? true);
    const languageChanged = language !== (user?.language === 'tr' ? 'tr' : 'en');

    const handleProfileSave = async () => {
        try {
            setIsSavingProfile(true);
            await updateProfile({ full_name: fullName.trim() });
            showToast('success', t.toast.nameSaved);
        } catch (error) {
            const message = error instanceof Error ? error.message : t.toast.profileSaveFail;
            showToast('error', message);
        } finally {
            setIsSavingProfile(false);
        }
    };

    const handleNotificationSave = async () => {
        try {
            setIsSavingNotifications(true);
            await updateProfile({
                email_notifications: emailNotifications,
                push_notifications: pushNotifications,
            });
            showToast('success', t.toast.notificationsSaved);
        } catch (error) {
            const message = error instanceof Error ? error.message : t.toast.notificationsSaveFail;
            showToast('error', message);
        } finally {
            setIsSavingNotifications(false);
        }
    };

    const handleLanguageSave = async () => {
        try {
            setIsSavingLanguage(true);
            await updateProfile({ language });
            showToast('success', language === 'tr' ? t.toast.languageSavedTr : t.toast.languageSavedEn);
        } catch (error) {
            const message = error instanceof Error ? error.message : t.toast.languageSaveFail;
            showToast('error', message);
        } finally {
            setIsSavingLanguage(false);
        }
    };

    const handleTelegramConnect = async () => {
        if (!telegramAllowedInPlan) {
            navigate('/payment/checkout');
            return;
        }

        try {
            setIsPreparingTelegramLink(true);
            const session = await telegramApi.startLink();
            setTelegramLinkSession(session);
            window.open(session.start_url, '_blank', 'noopener,noreferrer');
            showToast('info', t.toast.telegramLinkReady);
        } catch (error) {
            const message = error instanceof Error ? error.message : t.toast.telegramLinkStartFail;
            showToast('error', message);
        } finally {
            setIsPreparingTelegramLink(false);
        }
    };

    const handleTelegramDisconnect = async () => {
        try {
            setIsDisconnectingTelegram(true);
            await telegramApi.disconnect();
            await refreshMe({ force: true });
            setTelegramLinkSession(null);
            showToast('success', t.toast.telegramDisconnected);
        } catch (error) {
            const message = error instanceof Error ? error.message : t.toast.telegramDisconnectFail;
            showToast('error', message);
        } finally {
            setIsDisconnectingTelegram(false);
        }
    };

    const startCheckout = async () => {
        if (!paymentConfig?.enabled) {
            showToast('error', t.toast.paymentsDisabled);
            return;
        }

        try {
            setIsStartingCheckout(true);
            const result = await paymentApi.startCheckout({
                provider: paymentProvider,
                plan: 'pro',
                interval: billingInterval,
            });

            if (!result.checkout_url) {
                throw new Error(t.toast.checkoutMissing);
            }

            showToast('info', t.toast.redirectingCheckout);
            window.location.href = result.checkout_url;
        } catch (error) {
            const message = error instanceof Error ? error.message : t.toast.checkoutStartFail;
            showToast('error', message);
        } finally {
            setIsStartingCheckout(false);
        }
    };

    const currentPlanFeatures = isCurrentPremium
        ? t.billing.currentPremiumFeatures
        : t.billing.currentFreeFeatures(freeTrackedLimit);

    const insightCards = useMemo(() => {
        const planLabel = isCurrentPremium ? t.common.premium : t.common.free;
        const languageLabel = language === 'tr' ? 'Turkce' : 'English';
        const emailStatus = emailNotifications ? t.overview.enabled : t.overview.disabled;
        const telegramStatus = !telegramAllowedInPlan
            ? t.overview.premiumOnly
            : (telegramConnected ? t.overview.connected : t.overview.notConnected);

        return [
            {
                id: 'plan',
                icon: CreditCard,
                label: t.overview.currentPlan,
                value: planLabel,
                meta: `${t.billing.statusPrefix} ${paymentSubscription?.subscription_status || user?.subscription_status || t.common.inactive}`,
            },
            {
                id: 'language',
                icon: Globe,
                label: t.overview.language,
                value: languageLabel,
                meta: t.preferences.persistenceInfo,
            },
            {
                id: 'alerts',
                icon: Bell,
                label: t.overview.emailAlerts,
                value: emailStatus,
                meta: t.notifications.subtitle,
            },
            {
                id: 'telegram',
                icon: MessageCircle,
                label: t.overview.telegram,
                value: telegramStatus,
                meta: telegramAllowedInPlan ? t.telegram.copyAllowed : t.telegram.copyPremium,
            },
        ];
    }, [
        emailNotifications,
        isCurrentPremium,
        language,
        paymentSubscription?.subscription_status,
        t,
        telegramAllowedInPlan,
        telegramConnected,
        user?.subscription_status,
    ]);

    const tabs: Array<{ id: SettingsTab; label: string; description: string; icon: typeof User }> = [
        { id: 'profile', label: t.tabs.profile.label, icon: User, description: t.tabs.profile.description },
        { id: 'notifications', label: t.tabs.notifications.label, icon: Bell, description: t.tabs.notifications.description },
        { id: 'billing', label: t.tabs.billing.label, icon: CreditCard, description: t.tabs.billing.description },
        { id: 'preferences', label: t.tabs.preferences.label, icon: Globe, description: t.tabs.preferences.description },
    ];

    return (
        <div className="settings-container dashboard-page">
            <div className="settings-header">
                <span className="header-badge">{t.headerBadge}</span>
                <h1 className="settings-title">
                    {t.headerTitleLeft} <span className="gradient-text">{t.headerTitleRight}</span>
                </h1>
                <p className="settings-description">{t.headerDescription}</p>
            </div>

            <section className="settings-insight-grid">
                {insightCards.map((card) => (
                    <article key={card.id} className="insight-card">
                        <div className="insight-icon">
                            <card.icon size={18} />
                        </div>
                        <div className="insight-body">
                            <span className="insight-label">{card.label}</span>
                            <strong className="insight-value">{card.value}</strong>
                            <p className="insight-meta">{card.meta}</p>
                        </div>
                    </article>
                ))}
            </section>

            <div className="settings-layout">
                <aside className="settings-sidebar">
                    <div className="settings-sidebar-profile">
                        <div className="sidebar-avatar">{avatarText}</div>
                        <div className="sidebar-identity">
                            <strong>{fullName || user?.email || t.profile.fallbackName}</strong>
                            <span>{user?.email || t.profile.noEmail}</span>
                        </div>
                    </div>

                    <nav className="settings-nav">
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`settings-nav-item ${activeTab === tab.id ? 'active' : ''}`}
                            >
                                <div className="nav-icon">
                                    <tab.icon size={18} />
                                </div>
                                <div className="nav-info">
                                    <span className="nav-label">{tab.label}</span>
                                    <span className="nav-description">{tab.description}</span>
                                </div>
                                <ChevronRight size={16} className="nav-arrow" />
                            </button>
                        ))}
                    </nav>
                </aside>

                <main className="settings-content">
                    {activeTab === 'profile' && (
                        <div className="settings-tab">
                            <div className="tab-header">
                                <h2>{t.profile.title}</h2>
                                <p>{t.profile.subtitle}</p>
                            </div>

                            <div className="profile-picture-section">
                                <div className="profile-picture-wrapper">
                                    <div className="profile-picture profile-picture-initial" aria-label="Profile avatar">{avatarText}</div>
                                </div>
                                <div className="profile-info">
                                    <h3>{fullName || user?.email || t.profile.fallbackName}</h3>
                                    <p className="member-badge">
                                        <CheckCircle size={12} />
                                        {user?.email ? t.profile.active : t.profile.guest}
                                    </p>
                                    <p className="location">{user?.email || t.profile.noEmail}</p>
                                </div>
                            </div>

                            <div className="form-grid">
                                <div className="form-group full-width">
                                    <label>{t.profile.fullNameLabel}</label>
                                    <input
                                        type="text"
                                        value={fullName}
                                        onChange={(e) => setFullName(e.target.value)}
                                        placeholder={t.profile.fullNamePlaceholder}
                                    />
                                </div>

                                <div className="form-group full-width">
                                    <label>{t.profile.emailLabel}</label>
                                    <div className="input-with-icon">
                                        <Mail size={16} />
                                        <input type="email" value={user?.email || ''} readOnly />
                                    </div>
                                </div>
                            </div>

                            <div className="form-actions">
                                <button
                                    className="save-btn"
                                    onClick={() => void handleProfileSave()}
                                    disabled={isSavingProfile || !profileChanged}
                                >
                                    <Save size={16} />
                                    {isSavingProfile ? t.common.saving : t.profile.save}
                                </button>
                            </div>
                        </div>
                    )}

                    {activeTab === 'notifications' && (
                        <div className="settings-tab">
                            <div className="tab-header">
                                <h2>{t.notifications.title}</h2>
                                <p>{t.notifications.subtitle}</p>
                            </div>

                            <div className="notification-settings">
                                <div className="notification-channel">
                                    <h3>{t.notifications.channels}</h3>
                                    <div className="channel-options">
                                        <label className="toggle-item">
                                            <span className="toggle-label">
                                                <Mail size={16} />
                                                {t.notifications.email}
                                            </span>
                                            <span className={`toggle-switch ${emailNotifications ? 'active' : ''}`}>
                                                <input
                                                    type="checkbox"
                                                    checked={emailNotifications}
                                                    onChange={(e) => setEmailNotifications(e.target.checked)}
                                                />
                                                <span className="toggle-slider"></span>
                                            </span>
                                        </label>

                                        <label className="toggle-item">
                                            <span className="toggle-label">
                                                <Smartphone size={16} />
                                                {t.notifications.push}
                                            </span>
                                            <span className={`toggle-switch ${pushNotifications ? 'active' : ''}`}>
                                                <input
                                                    type="checkbox"
                                                    checked={pushNotifications}
                                                    onChange={(e) => setPushNotifications(e.target.checked)}
                                                />
                                                <span className="toggle-slider"></span>
                                            </span>
                                        </label>
                                    </div>

                                    <div className="form-actions settings-action-row">
                                        <button
                                            className="save-btn"
                                            onClick={() => void handleNotificationSave()}
                                            disabled={isSavingNotifications || !notificationsChanged}
                                        >
                                            <Save size={16} />
                                            {isSavingNotifications ? t.common.saving : t.notifications.save}
                                        </button>
                                    </div>
                                </div>

                                <div className="notification-channel telegram-setup-section">
                                    <h3 className="telegram-section-title">
                                        <MessageCircle size={20} />
                                        {t.telegram.title}
                                    </h3>

                                    <div className="telegram-section-copy">
                                        <p>{telegramAllowedInPlan ? t.telegram.copyAllowed : t.telegram.copyPremium}</p>
                                        <ol className="telegram-steps">
                                            <li>{t.telegram.step1}</li>
                                            <li>{t.telegram.step2}</li>
                                            <li>{t.telegram.step3}</li>
                                        </ol>
                                    </div>

                                    <div className="telegram-status-card">
                                        <div>
                                            <div className="telegram-status-title">{t.telegram.statusTitle}</div>
                                            <div className={`telegram-status-text ${telegramConnected ? 'ok' : 'warn'}`}>
                                                <span className="telegram-status-dot"></span>
                                                {!telegramAllowedInPlan
                                                    ? t.telegram.premiumRequired
                                                    : (telegramConnected ? t.telegram.connected : t.telegram.notConnected)}
                                            </div>
                                        </div>

                                        <div className="telegram-actions">
                                            <button
                                                type="button"
                                                className="telegram-btn secondary"
                                                onClick={() => void refreshMe({ force: true })}
                                            >
                                                {t.telegram.refresh}
                                            </button>

                                            {telegramAllowedInPlan ? (
                                                <button
                                                    type="button"
                                                    className="telegram-btn"
                                                    onClick={() => void handleTelegramConnect()}
                                                    disabled={isPreparingTelegramLink}
                                                >
                                                    <MessageCircle size={18} />
                                                    {isPreparingTelegramLink
                                                        ? t.telegram.connecting
                                                        : (telegramConnectedRaw ? t.telegram.openBot : t.telegram.connectBot)}
                                                </button>
                                            ) : (
                                                <button
                                                    type="button"
                                                    className="telegram-btn"
                                                    onClick={() => navigate('/payment/checkout')}
                                                >
                                                    {t.telegram.upgrade}
                                                </button>
                                            )}

                                            {telegramConnectedRaw && telegramAllowedInPlan && (
                                                <button
                                                    type="button"
                                                    className="telegram-btn secondary"
                                                    onClick={() => void handleTelegramDisconnect()}
                                                    disabled={isDisconnectingTelegram}
                                                >
                                                    {isDisconnectingTelegram ? t.common.saving : t.telegram.disconnect}
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {!telegramConnectedRaw && telegramAllowedInPlan && telegramLinkSession && (
                                        <div className="telegram-link-code-box">
                                            <div className="telegram-link-code-title">{t.telegram.secureCodeTitle}</div>
                                            <p className="telegram-link-code-hint">{t.telegram.secureCodeHint}</p>
                                            <code className="telegram-link-code-command">{telegramLinkSession.start_command}</code>
                                            {telegramCodeExpiryLabel && (
                                                <p className="telegram-link-code-expiry">
                                                    {t.telegram.secureCodeExpires}: {telegramCodeExpiryLabel}
                                                </p>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'billing' && (
                        <div className="settings-tab">
                            <div className="tab-header">
                                <h2>{t.billing.title}</h2>
                                <p>{t.billing.subtitle}</p>
                            </div>

                            <div className="plan-change-banner">
                                <div>
                                    <h3>{t.billing.bannerTitle}</h3>
                                    <p>{t.billing.bannerDesc}</p>
                                </div>
                                <button className="change-plan-btn" type="button" onClick={() => navigate('/payment/checkout')}>
                                    {t.billing.bannerBtn}
                                </button>
                            </div>

                            {showPaymentNotice && (
                                <div className="billing-sandbox-note" role="note" aria-live="polite">
                                    <strong>{t.billing.sandboxTag}</strong>
                                    <p>{paymentNotice}</p>
                                </div>
                            )}

                            <div className="billing-plan-grid">
                                <article className={`billing-plan-card ${!isCurrentPremium ? 'is-current' : ''}`}>
                                    <div className="billing-plan-head">
                                        <span className="billing-plan-kicker">{t.common.free}</span>
                                        <h4>{t.billing.freeName}</h4>
                                        <div className="billing-plan-price">$0<span>{t.billing.freeMonthly}</span></div>
                                    </div>
                                    <ul className="billing-plan-feature-list">
                                        {t.billing.freeFeatures(freeTrackedLimit).map((feature: string) => (
                                            <li key={feature}><CheckCircle size={14} /> {feature}</li>
                                        ))}
                                    </ul>
                                    <button className="billing-plan-btn ghost" type="button" disabled>
                                        {!isCurrentPremium ? t.billing.currentPlan : t.billing.downgradeUnavailable}
                                    </button>
                                </article>

                                <article className={`billing-plan-card premium ${isCurrentPremium ? 'is-current' : ''}`}>
                                    <div className="billing-plan-head">
                                        <span className="billing-plan-kicker">{t.common.premium}</span>
                                        <h4>{t.billing.premiumName}</h4>
                                        <div className="billing-plan-price">
                                            {billingPrice}
                                            <span>/{billingInterval === 'monthly' ? t.billing.monthly.toLowerCase() : t.billing.yearly.toLowerCase()}</span>
                                        </div>
                                    </div>
                                    <ul className="billing-plan-feature-list">
                                        {t.billing.premiumFeatures.map((feature: string) => (
                                            <li key={feature}><CheckCircle size={14} /> {feature}</li>
                                        ))}
                                    </ul>
                                    <button
                                        className="billing-plan-btn"
                                        type="button"
                                        onClick={() => navigate('/payment/checkout')}
                                        disabled={isCurrentPremium}
                                    >
                                        {isCurrentPremium ? t.billing.currentPlan : t.billing.upgradePremium}
                                    </button>
                                </article>
                            </div>

                            <div className="current-plan">
                                <div className="plan-badge">{(paymentSubscription?.plan || user?.plan || 'free').toUpperCase()} {t.common.plan}</div>
                                <div className="plan-price">
                                    {isCurrentPremium ? billingPrice : '$0'}
                                    <span>/{isCurrentPremium ? (billingInterval === 'monthly' ? t.billing.monthly.toLowerCase() : t.billing.yearly.toLowerCase()) : t.billing.monthly.toLowerCase()}</span>
                                </div>

                                <div className="plan-features">
                                    {currentPlanFeatures.map((feature: string) => (
                                        <div className="feature" key={feature}>
                                            <CheckCircle size={14} />
                                            <span>{feature}</span>
                                        </div>
                                    ))}
                                </div>

                                <div className="plan-next-payment">
                                    <Clock size={14} />
                                    <span>
                                        {t.billing.statusPrefix} <strong>{paymentSubscription?.subscription_status || user?.subscription_status || t.common.inactive}</strong>
                                        {paymentSubscription?.payment_provider ? ` via ${paymentSubscription.payment_provider}` : ''}
                                    </span>
                                </div>

                                <div className="billing-live-controls">
                                    <div className="billing-control-row">
                                        <label>{t.billing.provider}</label>
                                        <select
                                            value={paymentProvider}
                                            onChange={(e) => setPaymentProvider(e.target.value as 'stripe' | 'iyzico')}
                                            className="billing-select"
                                            disabled={!paymentConfig?.enabled || isStartingCheckout}
                                        >
                                            {(paymentConfig?.providers || ['stripe', 'iyzico']).map((provider) => (
                                                <option key={provider} value={provider}>{provider.toUpperCase()}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="billing-control-row">
                                        <label>{t.billing.interval}</label>
                                        <select
                                            value={billingInterval}
                                            onChange={(e) => setBillingInterval(e.target.value as 'monthly' | 'yearly')}
                                            className="billing-select"
                                            disabled={!paymentConfig?.enabled || isStartingCheckout}
                                        >
                                            <option value="monthly">{t.billing.monthly}</option>
                                            <option value="yearly">{t.billing.yearly}</option>
                                        </select>
                                    </div>

                                    <button
                                        className="change-plan-btn"
                                        type="button"
                                        onClick={() => void startCheckout()}
                                        disabled={!paymentConfig?.enabled || isStartingCheckout}
                                    >
                                        {isStartingCheckout ? t.billing.redirecting : t.billing.startCheckout}
                                    </button>

                                    <button
                                        className="edit-btn"
                                        type="button"
                                        onClick={() => navigate('/payment/checkout')}
                                    >
                                        {t.billing.openDedicated}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'preferences' && (
                        <div className="settings-tab">
                            <div className="tab-header">
                                <h2>{t.preferences.title}</h2>
                                <p>{t.preferences.subtitle}</p>
                            </div>

                            <div className="preferences-section">
                                <h3>{t.preferences.language}</h3>
                                <p className="settings-muted-note">{t.preferences.note}</p>

                                <div className="preference-item">
                                    <div className="preference-info">
                                        <div className="preference-icon">
                                            <Globe size={18} />
                                        </div>
                                        <div>
                                            <h4>{t.preferences.interfaceLanguage}</h4>
                                            <p>{t.preferences.persistenceInfo}</p>
                                        </div>
                                    </div>

                                    <select
                                        className="language-select"
                                        value={language}
                                        onChange={(e) => setLanguage(e.target.value as UiLanguage)}
                                    >
                                        <option value="en">English</option>
                                        <option value="tr">Turkce</option>
                                    </select>
                                </div>

                                <div className="form-actions settings-action-row">
                                    <button
                                        className="save-btn"
                                        type="button"
                                        onClick={() => void handleLanguageSave()}
                                        disabled={isSavingLanguage || !languageChanged}
                                    >
                                        <Save size={16} />
                                        {isSavingLanguage ? t.common.saving : t.preferences.saveLanguage}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
};

export default Settings;
