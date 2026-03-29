import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CreditCard, ShieldCheck, ArrowLeft, Clock3 } from 'lucide-react';
import { paymentApi, type PaymentConfigResponse } from '../lib/api';
import { useToast } from '../ui/ToastContext';
import { usePageSeo } from '../lib/seo';
import './PaymentCheckout.css';

type Provider = 'stripe' | 'iyzico';
type Interval = 'monthly' | 'yearly';

const PaymentCheckout = () => {
    const navigate = useNavigate();
    const { showToast } = useToast();

    const [config, setConfig] = useState<PaymentConfigResponse | null>(null);
    const [provider, setProvider] = useState<Provider>('iyzico');
    const [interval, setInterval] = useState<Interval>('monthly');
    const [isLoading, setIsLoading] = useState(true);
    const [isStarting, setIsStarting] = useState(false);

    usePageSeo({
        title: 'Secure Checkout',
        description: 'Continue to secure provider checkout for PriceTracker plan upgrade.',
        path: '/payment/checkout',
        noindex: true,
    });

    useEffect(() => {
        const load = async () => {
            try {
                const result = await paymentApi.config();
                setConfig(result);
                if (result.default_provider === 'stripe' || result.default_provider === 'iyzico') {
                    setProvider(result.default_provider);
                }
            } catch (error) {
                const message = error instanceof Error ? error.message : 'Payment config could not be loaded';
                showToast('error', message);
            } finally {
                setIsLoading(false);
            }
        };

        void load();
    }, [showToast]);

    const priceLabel = useMemo(() => {
        const amount = interval === 'monthly'
            ? (config?.price_pro_monthly ?? 2.99)
            : (config?.price_pro_yearly ?? 29.99);
        const currency = config?.currency || 'USD';

        try {
            return new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency,
                maximumFractionDigits: 2,
            }).format(amount);
        } catch {
            return `${amount.toFixed(2)} ${currency}`;
        }
    }, [config?.currency, config?.price_pro_monthly, config?.price_pro_yearly, interval]);

    const startCheckout = async () => {
        if (!config?.enabled) {
            showToast('error', 'Payments are disabled on server settings.');
            return;
        }

        try {
            setIsStarting(true);
            const result = await paymentApi.startCheckout({
                provider,
                plan: 'pro',
                interval,
            });

            if (!result.checkout_url) {
                throw new Error('Checkout URL was not returned');
            }

            window.location.href = result.checkout_url;
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Checkout start failed';
            showToast('error', message);
        } finally {
            setIsStarting(false);
        }
    };

    const paymentNotice = config?.payment_public_notice || 'Payments are currently in sandbox/test mode. Use test card information only.';
    const shouldShowSandboxNotice = Boolean(config?.sandbox_mode || config?.payment_public_notice);

    return (
        <div className="payment-checkout-page">
            <div className="checkout-shell">
                <button className="ghost-back" type="button" onClick={() => navigate('/dashboard/settings')}>
                    <ArrowLeft size={16} />
                    Back to Settings
                </button>

                <div className="checkout-card">
                    <div className="checkout-head">
                        <div className="checkout-title-wrap">
                            <span className="checkout-kicker">SECURE CHECKOUT</span>
                            <h1>Upgrade to Pro</h1>
                            <p>Choose provider and interval, then continue on the official payment page.</p>
                        </div>
                        <div className="checkout-icon">
                            <CreditCard size={24} />
                        </div>
                    </div>

                    <div className="checkout-grid">
                        <label className="field-block">
                            <span>Provider</span>
                            <select
                                value={provider}
                                onChange={(e) => setProvider(e.target.value as Provider)}
                                disabled={isLoading || isStarting || !config?.enabled}
                            >
                                {(config?.providers || ['iyzico', 'stripe']).map((item) => (
                                    <option key={item} value={item}>{item.toUpperCase()}</option>
                                ))}
                            </select>
                        </label>

                        <label className="field-block">
                            <span>Interval</span>
                            <select
                                value={interval}
                                onChange={(e) => setInterval(e.target.value as Interval)}
                                disabled={isLoading || isStarting || !config?.enabled}
                            >
                                <option value="monthly">Monthly</option>
                                <option value="yearly">Yearly</option>
                            </select>
                        </label>
                    </div>

                    {shouldShowSandboxNotice && (
                        <div className="checkout-sandbox-notice" role="note" aria-live="polite">
                            <strong>Test Mode</strong>
                            <p>{paymentNotice}</p>
                        </div>
                    )}

                    <div className="price-strip">
                        <div>
                            <span className="price-label">Selected Price</span>
                            <strong>{priceLabel} / {interval === 'monthly' ? 'month' : 'year'}</strong>
                        </div>
                        <span className="status-chip">
                            <Clock3 size={14} />
                            {config?.enabled ? 'Ready' : 'Disabled'}
                        </span>
                    </div>

                    <button
                        className="pay-btn"
                        type="button"
                        onClick={() => void startCheckout()}
                        disabled={isLoading || isStarting || !config?.enabled}
                    >
                        {isStarting ? 'Redirecting...' : `Pay with ${provider.toUpperCase()}`}
                    </button>

                    <div className="checkout-note">
                        <ShieldCheck size={16} />
                        <span>After payment, your plan is verified automatically and activated instantly.</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PaymentCheckout;
