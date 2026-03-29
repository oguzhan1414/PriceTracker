import { FiGithub, FiLinkedin, FiTwitter } from 'react-icons/fi';
import { Link } from 'react-router-dom';
import '../styles/components/Footer.css';

const Footer = () => {
    return (
        <footer className="footer">
            <div className="footer-content">
                <div className="footer-brand">
                    <h2>PRICETRACKER</h2>
                    <p style={{ color: 'var(--text-muted)' }}>The clear lens for a volatile market. Observe, analyze, and act with precision.</p>
                </div>
                
                <div className="footer-links">
                    <div className="footer-column">
                        <h3>Platform</h3>
                        <ul>
                            <li><a href="/#features">Features</a></li>
                            <li><a href="/#pricing">Pricing</a></li>
                            <li><a href="/#feedback">Feedback</a></li>
                            <li><Link to="/status">Status</Link></li>
                        </ul>
                    </div>
                    <div className="footer-column">
                        <h3>Legal</h3>
                        <ul>
                            <li><Link to="/terms">Terms of Service</Link></li>
                            <li><Link to="/privacy">Privacy Policy</Link></li>
                        </ul>
                    </div>
                    <div className="footer-column">
                        <h3>Company</h3>
                        <ul>
                            <li><Link to="/about">About</Link></li>
                            <li><Link to="/contact">Contact</Link></li>
                        </ul>
                    </div>
                </div>
            </div>

            <div className="footer-bottom">
                <div className="footer-copyright">
                    <span style={{ fontWeight: 600 }}>© 2026 PRICETRACKER.</span> THE DIGITAL OBSERVATORY.
                </div>
                <div className="social-links">
                    <a href="https://github.com/oguzhan1414" target="_blank" rel="noreferrer" aria-label="GitHub">
                        <FiGithub size={20} />
                    </a>
                    <a href="https://linkedin.com" target="_blank" rel="noreferrer" aria-label="LinkedIn">
                        <FiLinkedin size={20} />
                    </a>
                    <a href="https://twitter.com" target="_blank" rel="noreferrer" aria-label="Twitter">
                        <FiTwitter size={20} />
                    </a>
                </div>
            </div>
        </footer>
    );
};

export default Footer;