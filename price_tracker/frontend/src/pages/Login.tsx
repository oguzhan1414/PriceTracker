import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import '../styles/pages/Auth.css';
import { useAuth } from '../auth/AuthContext';
import { useToast } from '../ui/ToastContext';
import { useCookieConsent, REMEMBERED_EMAIL_KEY } from '../consent/CookieConsentContext';
import { usePageSeo } from '../lib/seo';

const SESSION_EXPIRED_FLAG_KEY = 'auth:session-expired:notify';

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [rememberOnDevice, setRememberOnDevice] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showSessionBanner, setShowSessionBanner] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();
    const { login } = useAuth();
    const { showToast } = useToast();
    const { canUseOptionalStorage } = useCookieConsent();

    usePageSeo({
        title: 'Sign In',
        description: 'Sign in to your PriceTracker account to manage watchlists, alerts, and dashboard insights.',
        path: '/login',
        noindex: true,
    });

    const fromLocation = (location.state as { from?: { pathname?: string; search?: string; hash?: string } })?.from;
    const fromPath = fromLocation?.pathname
        ? `${fromLocation.pathname}${fromLocation.search || ''}${fromLocation.hash || ''}`
        : '/dashboard';
    const safeFromPath = fromPath.startsWith('/login') || fromPath.startsWith('/register') ? '/dashboard' : fromPath;

    useEffect(() => {
        const shouldNotify = sessionStorage.getItem(SESSION_EXPIRED_FLAG_KEY) === '1';
        if (!shouldNotify) {
            return;
        }

        sessionStorage.removeItem(SESSION_EXPIRED_FLAG_KEY);
        setShowSessionBanner(true);
        showToast('info', 'Your session expired. Please sign in again.');
    }, [showToast]);

    useEffect(() => {
        if (!canUseOptionalStorage) {
            setRememberOnDevice(false);
            return;
        }

        const remembered = localStorage.getItem(REMEMBERED_EMAIL_KEY);
        if (remembered) {
            setEmail(remembered);
            setRememberOnDevice(true);
        }
    }, [canUseOptionalStorage]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            await login(email, password);
            if (canUseOptionalStorage && rememberOnDevice) {
                localStorage.setItem(REMEMBERED_EMAIL_KEY, email.trim());
            } else {
                localStorage.removeItem(REMEMBERED_EMAIL_KEY);
            }
            showToast('success', 'Login successful. Welcome back.');
            navigate(safeFromPath, { replace: true });
        } catch (err) {
            showToast('error', err instanceof Error ? err.message : 'Login failed');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="auth-container">
            <div className="auth-card">
                <div className="auth-header">
                    <Link to="/" className="auth-logo">PRICETRACKER</Link>
                    <h2 className="auth-title">Welcome back</h2>
                    <p className="auth-subtitle">Enter your credentials to access the observatory.</p>
                </div>

                <form className="auth-form" onSubmit={handleSubmit}>
                    {showSessionBanner && (
                        <div className="auth-session-banner" role="status" aria-live="polite">
                            Session expired. Please sign in again to continue.
                        </div>
                    )}
                    <div className="form-group">
                        <label htmlFor="email">Email</label>
                        <input 
                            type="email" 
                            id="email" 
                            placeholder="name@example.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label htmlFor="password">Password</label>
                        <input 
                            type="password" 
                            id="password" 
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>

                    <label className="auth-consent-row">
                        <input
                            type="checkbox"
                            checked={rememberOnDevice}
                            onChange={(e) => setRememberOnDevice(e.target.checked)}
                            disabled={!canUseOptionalStorage}
                        />
                        <span>
                            Remember login email on this device
                            {!canUseOptionalStorage ? ' (enable optional cookies first)' : ''}
                        </span>
                    </label>

                    <button type="submit" className="auth-btn" disabled={isSubmitting}>
                        {isSubmitting ? 'Signing in...' : 'Sign In'}
                    </button>
                </form>

                <div className="auth-footer">
                    Don't have an account? 
                    <Link to="/register" className="auth-link">Sign up</Link>
                </div>
            </div>
        </div>
    );
};

export default Login;