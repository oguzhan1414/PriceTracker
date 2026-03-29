import PublicPageLayout from './PublicPageLayout';

const About = () => {
    return (
        <PublicPageLayout
            badge="ABOUT"
            title="Built To Track Prices With Clarity"
            subtitle="PriceTracker is designed for people who want to decide faster, avoid noise, and never miss meaningful price movement."
            seoPath="/about"
            seoKeywords={['about pricetracker', 'price tracking platform', 'marketplace tracking']}
        >
            <div className="public-kpi-row">
                <div className="public-kpi">
                    <span>3+</span>
                    <p>Active marketplace integrations</p>
                </div>
                <div className="public-kpi">
                    <span>24/7</span>
                    <p>Continuous tracking and checks</p>
                </div>
                <div className="public-kpi">
                    <span>1 Goal</span>
                    <p>Clear, actionable price signals</p>
                </div>
            </div>

            <section className="public-section">
                <h2>What We Solve</h2>
                <p>
                    Most shopping decisions fail not because users lack data, but because they receive too much irrelevant data
                    at the wrong time. PriceTracker narrows the signal to what matters: actual movement, meaningful thresholds,
                    and timely context.
                </p>
                <p>
                    Instead of manually refreshing product pages, users set a target and let the platform monitor in the
                    background. This saves time, reduces decision fatigue, and increases confidence before purchase.
                </p>
            </section>

            <section className="public-section">
                <h2>How PriceTracker Works</h2>
                <ol>
                    <li>Add product links to your watchlist and optionally define target prices.</li>
                    <li>Our scheduler checks supported marketplaces and updates your dashboard data.</li>
                    <li>You receive alerts when conditions are met and can verify trend direction before buying.</li>
                </ol>
            </section>

            <section className="public-section">
                <h2>Product Principles</h2>
                <div className="public-grid">
                    <article className="public-card">
                        <h3>Signal Over Noise</h3>
                        <p>We prioritize useful movement and practical thresholds instead of overwhelming feeds.</p>
                    </article>
                    <article className="public-card">
                        <h3>Reliable By Default</h3>
                        <p>Monitoring, notifications, and state updates are designed with stability first.</p>
                    </article>
                    <article className="public-card">
                        <h3>Transparent Limits</h3>
                        <p>Plan capabilities are clear so users know exactly what to expect from free and premium tiers.</p>
                    </article>
                    <article className="public-card">
                        <h3>Continuous Iteration</h3>
                        <p>We refine data quality, performance, and UX in short cycles based on real user feedback.</p>
                    </article>
                </div>
            </section>

            <div className="public-callout">
                <strong>Roadmap Focus</strong>
                <p>
                    Near-term priorities include stronger trend intelligence, cleaner marketplace normalization, and smoother
                    onboarding for first-time users.
                </p>
            </div>
        </PublicPageLayout>
    );
};

export default About;
