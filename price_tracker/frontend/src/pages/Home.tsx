import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';
import '../styles/pages/Home.css';

import { ArrowRight, CheckCircle2, Zap } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { marketingApi } from '../lib/api';
import { usePageSeo } from '../lib/seo';
// Mock Data matching the image style
const activeObservationProducts = [
  { 
      id: 1, 
      name: 'Sony WH-1000X M5', 
      category: 'ELECTRONICS • AMAZON', 
      price: '$349.00', 
      oldPrice: '$450.00',
      trend: 'down', 
      change: '-24%',
      image: 'https://images.unsplash.com/photo-1618366712010-f4ae9c647dcb?q=80&w=2576&auto=format&fit=crop', // Headphone image
      history: [450, 455, 440, 420, 430, 410, 390, 400, 380, 360, 349] // Price dropping with fluctuation
  },
  { 
      id: 2, 
      name: 'Ultra Watch Pro', 
      category: 'WEARABLES • BESTBUY', 
      price: '$799.00', 
      oldPrice: '$700.00',
      trend: 'up',
      change: '+12%', // Price increasing
      image: 'https://images.unsplash.com/photo-1546868871-7041f2a55e12?q=80&w=2664&auto=format&fit=crop', // Watch image
      history: [700, 690, 710, 705, 730, 725, 750, 740, 770, 785, 799] // Price rising with fluctuation
  },
  { 
      id: 3, 
      name: 'Nomad Classic', 
      category: 'ACCESSORIES • NOMAD', 
      price: '$85.00', 
      oldPrice: null,
      trend: 'flat', 
      change: 'Stable',
      image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?q=80&w=2598&auto=format&fit=crop', // Product image
      history: [85, 85, 85, 85, 85, 85, 85, 85, 85] 
  },
];

const featuredProduct = {
    name: 'VaporFly 3 Obsidian',
    category: 'FOOTWEAR • NIKE',
    desc: 'The highest observation of technical footwear performance is currently at its 30-day low.',
    price: '$212.50',
    oldPrice: '$250.00',
    change: '-15%',
    image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?q=80&w=2670&auto=format&fit=crop', // White sneaker
    history: [250, 248, 245, 240, 242, 235, 230, 225, 228, 220, 212.5]
};

const cameraProduct = {
    name: 'Fujifilm X100V',
    category: 'PHOTOGRAPHY • B&H',
    price: '$1,399',
    stock: 'In Stock',
    image: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?q=80&w=2528&auto=format&fit=crop'
};

const Home = () => {
    const navigate = useNavigate();
    const { isAuthenticated } = useAuth();
    const [url, setUrl] = useState('');
    const [newsletterEmail, setNewsletterEmail] = useState('');
    const [newsletterMessage, setNewsletterMessage] = useState('');
    const [newsletterStatus, setNewsletterStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
    const [isNewsletterSending, setIsNewsletterSending] = useState(false);
    const FEEDBACK_MAX_LENGTH = 600;

    const handleNewsletterSend = async () => {
        const trimmed = newsletterEmail.trim();
        const message = newsletterMessage.trim();
        if (!trimmed) {
            setNewsletterStatus({ type: 'error', message: 'Please enter your email address.' });
            return;
        }
        if (!/^\S+@\S+\.\S+$/.test(trimmed)) {
            setNewsletterStatus({ type: 'error', message: 'Please enter a valid email address.' });
            return;
        }
        if (!message) {
            setNewsletterStatus({ type: 'error', message: 'Please write your message first.' });
            return;
        }
        if (message.length > FEEDBACK_MAX_LENGTH) {
            setNewsletterStatus({ type: 'error', message: `Please keep your message under ${FEEDBACK_MAX_LENGTH} characters.` });
            return;
        }

        setIsNewsletterSending(true);
        try {
            await marketingApi.sendMail(trimmed, message);
            setNewsletterEmail('');
            setNewsletterMessage('');
            setNewsletterStatus({ type: 'success', message: 'Thanks! Your message has been delivered to our team.' });
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Message could not be delivered.';
            setNewsletterStatus({ type: 'error', message });
        } finally {
            setIsNewsletterSending(false);
        }
    };

    const pricingPlans = [
        {
            key: 'free',
            label: 'Starter',
            name: 'Free Plan',
            subtitle: 'Great for light tracking and trying the platform.',
            why: 'Best for trying core tracking before committing.',
            price: '$0',
            period: '/month',
            features: [
                'Track up to 5 products',
                'Daily price checks',
                'Basic watchlist overview',
            ],
            cta: isAuthenticated ? 'Continue with Free' : 'Create Free Account',
            action: () => navigate(isAuthenticated ? '/dashboard' : '/register'),
            highlight: false,
        },
        {
            key: 'premium',
            label: 'Most Popular',
            name: 'Premium Plan',
            subtitle: 'For users who need speed, depth, and confidence in every deal.',
            why: 'Premium pays for itself when one timely alert catches a major drop.',
            price: '$2.99',
            period: '/month',
            features: [
                'Unlimited tracked products',
                'Faster checks and sharper trend insights',
                'Priority alerts with stronger reliability',
            ],
            cta: 'Upgrade to Premium',
            action: () => navigate(isAuthenticated ? '/payment/checkout' : '/login'),
            highlight: true,
        },
    ];

    usePageSeo({
        title: 'Real-Time Price Tracking and Alerts',
        description: 'Track product prices across marketplaces, set target alerts, and make faster buying decisions with PriceTracker.',
        path: '/',
        keywords: ['price tracker', 'price alert', 'marketplace monitoring', 'shopping deals', 'product watchlist'],
        structuredData: [
            {
                '@context': 'https://schema.org',
                '@type': 'WebSite',
                name: 'PriceTracker',
                url: 'https://pricetracker.app/',
                potentialAction: {
                    '@type': 'SearchAction',
                    target: 'https://pricetracker.app/?q={query}',
                    'query-input': 'required name=query',
                },
            },
            {
                '@context': 'https://schema.org',
                '@type': 'Organization',
                name: 'PriceTracker',
                url: 'https://pricetracker.app/',
                sameAs: ['https://github.com'],
            },
        ],
    });

    return (
        <div className="home-container">
            <Header />
            
            <main>
                {/* Hero Section */}
                <section className="hero-section">
                    <div className="hero-content">
                        <div className="brand-tag">THE DIGITAL OBSERVATORY</div>
                        <h1 className="hero-title">
                            Observe Value.<br />
                            <span className="text-gradient">Capture the Pulse.</span>
                        </h1>
                        <p className="hero-subtitle">
                            Experience high-frequency price tracking with editorial precision. 
                            Monitor global marketplaces through a single, cinematic lens.
                        </p>
                        
                        <div className="hero-input-container">
                            <div className="link-icon-wrapper">
                                <Zap size={16} />
                            </div>
                            <input 
                                type="text" 
                                className="hero-input" 
                                placeholder="Paste product URL here..." 
                                value={url}
                                onChange={(e) => setUrl(e.target.value)}
                            />
                            <button className="start-tracking-btn" onClick={() => navigate(isAuthenticated ? '/dashboard' : '/register')}>
                                Start Tracking
                            </button>
                        </div>
                    </div>
                </section>

                {/* Active Observation Section */}
                <section id="features" className="dashboard-section">
                    <div className="section-header">
                        <div className="header-left">
                            <h2>Active Observation</h2>
                            <p>Real-time fluctuations across your curated observatory.</p>
                        </div>
                    </div>

                    <div className="product-grid-row">
                        {activeObservationProducts.map(product => (
                            <ProductCard key={product.id} product={product} />
                        ))}
                    </div>

                    {/* Featured Row */}
                    <div className="featured-row">
                        {/* Large Featured Card */}
                        <div className="featured-card large">
                            <div className="featured-info">
                                <div className="card-top-row">
                                    <h3 className="product-name">{featuredProduct.name}</h3>
                                    <div className="trend-badge green">{featuredProduct.change}</div>
                                </div>
                                <div className="product-category">{featuredProduct.category}</div>
                                <p className="product-desc">{featuredProduct.desc}</p>
                                <div className="price-row">
                                    <span className="current-price">{featuredProduct.price}</span>
                                    <span className="old-price">{featuredProduct.oldPrice}</span>
                                </div>
                                <div className="mini-chart">
                                     <SimpleSparkline data={featuredProduct.history} color="var(--neon-green)" />
                                </div>
                            </div>
                            <div className="featured-image-wrapper">
                                <img src={featuredProduct.image} alt={featuredProduct.name} />
                            </div>
                        </div>

                        {/* Smaller Side Card */}
                        <div className="featured-card small">
                            <div className="product-image-container small" style={{ height: '180px', marginBottom: '1rem' }}>
                                <img src={cameraProduct.image} alt={cameraProduct.name} style={{ objectFit: 'contain', width: '100%', height: '100%' }} />
                            </div>
                            <div className="card-content" style={{ flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'flex-end', minHeight: 'auto' }}>
                                <div style={{ marginBottom: '1rem' }}>
                                    <h3 className="product-name" style={{ fontSize: '1.5rem', height: 'auto', marginBottom: '0.5rem' }}>{cameraProduct.name}</h3>
                                    <div className="product-category">{cameraProduct.category}</div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', width: '100%' }}>
                                    <span className="current-price" style={{ fontSize: '2rem' }}>{cameraProduct.price}</span>
                                    <span style={{ color: 'var(--neon-green)', fontWeight: 600, fontSize: '0.85rem' }}>
                                        {cameraProduct.stock}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Pricing Section */}
                <section id="pricing" className="pricing-section">
                    <div className="section-header center">
                        <h2>Choose Your Plan</h2>
                        <p>Clear value, transparent pricing, and a simple path to smarter buying decisions.</p>
                    </div>

                    <div className="premium-why-grid">
                        <article className="premium-reason-card">
                            <h3>React Before The Crowd</h3>
                            <p>Premium checks prices more frequently, so you catch meaningful drops while the stock is still available.</p>
                        </article>
                        <article className="premium-reason-card">
                            <h3>See The Trend, Not Noise</h3>
                            <p>Richer insights make price movement easier to interpret, helping you buy at the right moment.</p>
                        </article>
                        <article className="premium-reason-card">
                            <h3>Track Without Limits</h3>
                            <p>Monitor all products you care about in one place with priority alerts and less manual checking.</p>
                        </article>
                    </div>

                    <div className="plan-switch-actions">
                        <button type="button" onClick={() => navigate('/dashboard/settings')}>
                            Manage your plan in settings
                            <ArrowRight size={14} />
                        </button>
                        <button type="button" className="premium-action" onClick={() => navigate(isAuthenticated ? '/payment/checkout' : '/login')}>
                            Go to Premium checkout
                            <ArrowRight size={14} />
                        </button>
                    </div>
                    
                    <div className="pricing-grid">
                        {pricingPlans.map((plan) => (
                            <div key={plan.key} className={`pricing-card ${plan.highlight ? 'highlight' : ''}`}>
                                <div className="tier-top-row">
                                    <span className={`tier-chip ${plan.highlight ? 'highlight' : ''}`}>{plan.label}</span>
                                </div>
                                <h3 className="tier-name">{plan.name}</h3>
                                <p className="tier-subtitle">{plan.subtitle}</p>
                                <p className="tier-why">{plan.why}</p>
                                <div className="tier-price">
                                    {plan.price}<span className="tier-period">{plan.period}</span>
                                </div>
                                <ul className="tier-features">
                                    {plan.features.map((feature, i) => (
                                        <li key={i}>
                                            <CheckCircle2 size={15} />
                                            <span>{feature}</span>
                                        </li>
                                    ))}
                                </ul>
                                <button className="tier-cta" onClick={plan.action}>{plan.cta}</button>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Footer / Newsletter */}
                <section id="feedback" className="newsletter-section">
                    <div className="feedback-card">
                        <div className="feedback-copy">
                            <div className="feedback-kicker">Feedback Channel</div>
                            <h2>Help Us Build A Better Product</h2>
                            <p>
                                Found a bug, have an idea, or want a new feature? Send us a direct note and it will reach our team inbox.
                            </p>
                        </div>

                        <div className="feedback-form-block">
                            <div className="newsletter-form">
                                <input
                                    type="email"
                                    placeholder="Your email address"
                                    value={newsletterEmail}
                                    onChange={(event) => setNewsletterEmail(event.target.value)}
                                />
                            </div>
                            <div className="newsletter-form message">
                                <textarea
                                    placeholder="Write your feedback or bug report"
                                    value={newsletterMessage}
                                    onChange={(event) => setNewsletterMessage(event.target.value)}
                                    maxLength={FEEDBACK_MAX_LENGTH}
                                    rows={4}
                                />
                                <div className="feedback-meta">
                                    <span className={`feedback-counter ${newsletterMessage.length > FEEDBACK_MAX_LENGTH * 0.9 ? 'limit' : ''}`}>
                                        {newsletterMessage.length}/{FEEDBACK_MAX_LENGTH}
                                    </span>
                                    <button type="button" onClick={() => void handleNewsletterSend()} disabled={isNewsletterSending}>
                                        {isNewsletterSending ? 'SENDING...' : 'SEND FEEDBACK'}
                                    </button>
                                </div>
                            </div>
                            {newsletterStatus && (
                                <p className={`newsletter-status ${newsletterStatus.type}`}>{newsletterStatus.message}</p>
                            )}
                        </div>
                    </div>
                </section>

                <Footer />
            </main>
        </div>
    );
};

const ProductCard = ({ product }: { product: any }) => {
    // Determine status based on change string
    const isPriceDrop = product.change.includes('-');
    const isPriceIncrease = product.change.includes('+');

    let badgeColor = 'gray';
    let chartColor = '#52525b'; // Default gray for stable

    if (isPriceDrop) {
        badgeColor = 'green';
        chartColor = 'var(--neon-green)';
    } else if (isPriceIncrease) {
        badgeColor = 'red';
        chartColor = 'var(--neon-red)';
    }

    return (
        <div className="product-card">
            <div className="card-top-badges">
                <span className={`trend-badge ${badgeColor}`}>{product.change}</span>
            </div>
            
            <div className="product-image-container">
                <img src={product.image} alt={product.name} />
            </div>

            <div className="card-content">
                <div className="content-left">
                    <h3 className="product-name">{product.name}</h3>
                    <div className="product-category">{product.category}</div>
                </div>
                <div className="content-right" style={{textAlign: 'right'}}>
                    <div className="current-price">{product.price}</div>
                    {product.oldPrice && <span className="old-price">{product.oldPrice}</span>}
                </div>
            </div>

            <div className="card-chart">
                <SimpleSparkline data={product.history} color={chartColor} />
            </div>
        </div>
    );
};

const SimpleSparkline = ({ data, color, height }: { data: number[], color: string, height?: number }) => {
    const uniqueId = React.useId();
    const gradientId = `sparkline-gradient-${uniqueId}`;

    if (data.length < 2) {
        return <div className="sparkline-wrapper" style={{ height: height || '100%' }} />;
    }

    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;

    const points = data
        .map((value, index) => {
            const x = (index / (data.length - 1)) * 100;
            const y = 100 - ((value - min) / range) * 100;
            return `${x},${y}`;
        })
        .join(' ');

    const areaPoints = `0,100 ${points} 100,100`;

    return (
        <div className="sparkline-wrapper" style={{ height: height || '100%' }}>
            <svg className="sparkline-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                <defs>
                    <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={color} stopOpacity="0.35" />
                        <stop offset="100%" stopColor={color} stopOpacity="0" />
                    </linearGradient>
                </defs>
                <polygon points={areaPoints} fill={`url(#${gradientId})`} />
                <polyline points={points} fill="none" stroke={color} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
            </svg>
        </div>
    );
};

export default Home;