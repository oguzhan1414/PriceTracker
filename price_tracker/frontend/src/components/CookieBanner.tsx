import { Link } from 'react-router-dom';
import { useCookieConsent } from '../consent/CookieConsentContext';
import '../styles/ui/CookieBanner.css';

const CookieBanner = () => {
    const { consent, acceptCookies, rejectCookies } = useCookieConsent();

    if (consent !== null) {
        return null;
    }

    return (
        <div className="cookie-banner" role="dialog" aria-live="polite" aria-label="Cookie preferences">
            <div className="cookie-banner-content">
                <strong>Cookie Preferences</strong>
                <p>
                    We use essential cookies for secure login and app functionality. Optional cookies help remember login email
                    and dashboard preferences on this device.
                </p>
                <p className="cookie-banner-meta">
                    See <Link to="/privacy">Privacy Policy</Link> for details.
                </p>
            </div>
            <div className="cookie-banner-actions">
                <button type="button" className="cookie-btn secondary" onClick={rejectCookies}>
                    Reject Optional
                </button>
                <button type="button" className="cookie-btn primary" onClick={acceptCookies}>
                    Accept All
                </button>
            </div>
        </div>
    );
};

export default CookieBanner;
