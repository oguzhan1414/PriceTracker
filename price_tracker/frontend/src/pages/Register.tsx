import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import '../styles/pages/Auth.css';
import { useAuth } from '../auth/AuthContext';
import { useToast } from '../ui/ToastContext';
import { useCookieConsent, REMEMBERED_EMAIL_KEY } from '../consent/CookieConsentContext';
import { usePageSeo } from '../lib/seo';

const Register = () => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const navigate = useNavigate();
    const { register } = useAuth();
    const { showToast } = useToast();
    const { canUseOptionalStorage } = useCookieConsent();

    usePageSeo({
        title: 'Create Account',
        description: 'Create your PriceTracker account and start monitoring product prices with custom alerts.',
        path: '/register',
        noindex: true,
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            await register(email, password);
            if (canUseOptionalStorage) {
                localStorage.setItem(REMEMBERED_EMAIL_KEY, email.trim());
            }
            showToast('success', 'Registration successful. You can sign in now.');
            navigate('/login', { replace: true });
        } catch (err) {
            showToast('error', err instanceof Error ? err.message : 'Registration failed');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="auth-container">
            <div className="auth-card">
                <div className="auth-header">
                    <Link to="/" className="auth-logo">PRICETRACKER</Link>
                    <h2 className="auth-title">Create an account</h2>
                    <p className="auth-subtitle">Start tracking prices with editorial precision.</p>
                </div>

                <form className="auth-form" onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label htmlFor="name">Full Name</label>
                        <input 
                            type="text" 
                            id="name" 
                            placeholder="John Doe"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                        />
                    </div>
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
                            placeholder="Create a strong password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>

                    <button type="submit" className="auth-btn" disabled={isSubmitting}>
                        {isSubmitting ? 'Creating...' : 'Create Account'}
                    </button>
                </form>

                <div className="auth-footer">
                    Already have an account? 
                    <Link to="/login" className="auth-link">Sign in</Link>
                </div>
            </div>
        </div>
    );
};

export default Register;