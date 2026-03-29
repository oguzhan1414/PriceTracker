// src/pages/PaymentSuccess.tsx
// Kullanıcı Stripe/Iyzico checkout'tan döndüğünde bu sayfaya yönlendirilir.
// URL'deki token (Iyzico) veya session_id (Stripe) parametresi yakalanır,
// backend /api/payments/verify endpoint'i çağrılır, abonelik aktifleştirilir.

import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, XCircle, Loader2, CreditCard } from 'lucide-react';
import { paymentApi } from '../lib/api';
import { useAuth } from '../auth/AuthContext';
import { usePageSeo } from '../lib/seo';
import './PaymentSuccess.css';

type VerifyState = 'loading' | 'success' | 'error' | 'canceled';

const PaymentSuccess = () => {
    const navigate = useNavigate();
    const { refreshMe } = useAuth();
    const [state, setState] = useState<VerifyState>('loading');
    const [errorMsg, setErrorMsg] = useState('');
    const [plan, setPlan] = useState('');
    const [interval, setInterval] = useState('');
    const [endDate, setEndDate] = useState('');
    const hasVerified = useRef(false);

    usePageSeo({
        title: 'Payment Result',
        description: 'Payment verification result and subscription activation status.',
        path: window.location.pathname.includes('/payment/cancel') ? '/payment/cancel' : '/payment/success',
        noindex: true,
    });

    useEffect(() => {
        // Strict Mode çift çalışmayı önle
        if (hasVerified.current) return;
        hasVerified.current = true;

        const params = new URLSearchParams(window.location.search);
        const providerParam = (params.get('provider') || '').toLowerCase();
        const sessionId = params.get('session_id');   // Stripe
        const token = params.get('token');             // Iyzico
        const provider = providerParam || (token ? 'iyzico' : (sessionId ? 'stripe' : 'iyzico'));

        // İptal durumu
        if (window.location.pathname.includes('cancel')) {
            setState('canceled');
            return;
        }

        const isCanceled = params.get('payment') === 'cancel';
        if (isCanceled) {
            setState('canceled');
            return;
        }

        if (!provider) {
            setState('error');
            setErrorMsg('Ödeme sağlayıcısı belirlenemedi. Lütfen yeniden deneyin.');
            return;
        }

        if (provider === 'stripe' && !sessionId) {
            setState('error');
            setErrorMsg('Stripe oturum ID\'si eksik.');
            return;
        }

        const verify = async () => {
            try {
                const result = await paymentApi.verify({
                    provider,
                    session_id: sessionId || undefined,
                    token: token || undefined,
                });

                if (result.verified) {
                    setPlan(result.plan || 'pro');
                    setInterval(result.interval || 'monthly');
                    if (result.subscription_end_date) {
                        setEndDate(new Date(result.subscription_end_date).toLocaleDateString('tr-TR', {
                            year: 'numeric', month: 'long', day: 'numeric',
                        }));
                    }
                    setState('success');
                    // Kullanıcı bilgilerini güncelle
                    try {
                        await refreshMe();
                    } catch {
                        // Success state should remain visible even if profile refresh fails.
                    }
                } else {
                    setState('error');
                    setErrorMsg('Ödeme doğrulanamadı. Lütfen destek ile iletişime geçin.');
                }
            } catch (err) {
                const msg = err instanceof Error ? err.message : 'Doğrulama başarısız oldu.';
                setState('error');
                setErrorMsg(msg);
            }
        };

        void verify();
    }, [refreshMe]);

    const goToDashboard = () => navigate('/dashboard');
    const goToBilling = () => navigate('/dashboard/settings', { state: { tab: 'billing' } });
    const retryCheckout = () => navigate('/dashboard/settings');

    return (
        <div className="payment-result-page">
            <div className="payment-result-card">
                {/* Logo / Brand */}
                <div className="payment-brand">
                    <CreditCard size={28} />
                    <span>PriceTracker</span>
                </div>

                {/* Loading */}
                {state === 'loading' && (
                    <div className="payment-state loading-state">
                        <div className="state-icon loading">
                            <Loader2 size={48} className="spin-icon" />
                        </div>
                        <h1>Ödeme Doğrulanıyor</h1>
                        <p>Ödemeniz işleniyor, lütfen bekleyin...</p>
                        <div className="progress-bar">
                            <div className="progress-fill" />
                        </div>
                    </div>
                )}

                {/* Success */}
                {state === 'success' && (
                    <div className="payment-state success-state">
                        <div className="state-icon success">
                            <CheckCircle size={56} />
                        </div>
                        <h1>Ödeme Başarılı! 🎉</h1>
                        <p className="success-subtitle">
                            Pro planınız aktifleştirildi. Tüm özellikler kullanıma hazır!
                        </p>

                        <div className="subscription-details">
                            <div className="detail-row">
                                <span className="detail-label">Plan</span>
                                <span className="detail-value pro-badge">
                                    {plan.toUpperCase()} — {interval === 'yearly' ? 'Yıllık' : 'Aylık'}
                                </span>
                            </div>
                            {endDate && (
                                <div className="detail-row">
                                    <span className="detail-label">Bitiş Tarihi</span>
                                    <span className="detail-value">{endDate}</span>
                                </div>
                            )}
                        </div>

                        <div className="action-buttons">
                            <button className="btn-primary" onClick={goToDashboard}>
                                Dashboard'a Git
                            </button>
                            <button className="btn-secondary" onClick={goToBilling}>
                                Abonelik Detayları
                            </button>
                        </div>
                    </div>
                )}

                {/* Error */}
                {state === 'error' && (
                    <div className="payment-state error-state">
                        <div className="state-icon error">
                            <XCircle size={56} />
                        </div>
                        <h1>Doğrulama Başarısız</h1>
                        <p className="error-message">{errorMsg}</p>
                        <p className="error-help">
                            Ödeme yapıldıysa birkaç dakika bekleyip tekrar deneyin.
                            Sorun devam ederse destek ekibimizle iletişime geçin.
                        </p>
                        <div className="action-buttons">
                            <button className="btn-primary" onClick={retryCheckout}>
                                Tekrar Dene
                            </button>
                            <button className="btn-secondary" onClick={goToDashboard}>
                                Dashboard'a Dön
                            </button>
                        </div>
                    </div>
                )}

                {/* Canceled */}
                {state === 'canceled' && (
                    <div className="payment-state canceled-state">
                        <div className="state-icon canceled">
                            <XCircle size={56} />
                        </div>
                        <h1>Ödeme İptal Edildi</h1>
                        <p>Ödeme işlemi iptal edildi. İstediğiniz zaman tekrar deneyebilirsiniz.</p>
                        <div className="action-buttons">
                            <button className="btn-primary" onClick={retryCheckout}>
                                Tekrar Dene
                            </button>
                            <button className="btn-secondary" onClick={goToDashboard}>
                                Dashboard'a Dön
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PaymentSuccess;
