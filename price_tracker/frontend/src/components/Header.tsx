import { useEffect, useState } from 'react';
import '../styles/components/Header.css';

const Header = () => {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setIsScrolled(window.scrollY > 24);
    };

    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header className={`header ${isScrolled ? 'header-scrolled' : ''}`}>
      <div className="header-inner">
        {/* Left Section: Logo */}
        <div className="header-logo">
          <h1>PriceTracker</h1>
        </div>

        {/* Middle Section: Navigation */}
        <nav className="header-nav">
          <a href="#features">Features</a>
          <a href="#pricing">Pricing</a>
          <a href="#feedback">Feedback</a>
        </nav>

        {/* Right Section: Login */}
        <div className="header-auth">
          <a href="/login" className="login-btn">Login</a>
        </div>
      </div>
    </header>
  );
};

export default Header;