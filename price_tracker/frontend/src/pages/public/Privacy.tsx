import PublicPageLayout from './PublicPageLayout';

const Privacy = () => {
    return (
        <PublicPageLayout
            badge="PRIVACY"
            title="Privacy Policy"
            subtitle="Privacy is built around data minimization: we collect what is needed for core functionality and reliability."
            seoPath="/privacy"
            seoKeywords={['privacy policy', 'data processing', 'pricetracker privacy']}
        >
            <section className="public-section">
                <h2>What We Collect</h2>
                <ul>
                    <li>Account data: email, authentication artifacts, and basic profile preferences.</li>
                    <li>Tracking data: watched URLs, target prices, state flags, and notification history.</li>
                    <li>Integration data: optional Telegram chat binding and delivery metadata.</li>
                    <li>Operational telemetry: service logs needed for debugging, abuse prevention, and uptime tracking.</li>
                </ul>
            </section>

            <section className="public-section">
                <h2>Why We Use This Data</h2>
                <div className="public-grid">
                    <article className="public-card">
                        <h3>Core Product Operation</h3>
                        <p>To provide authentication, watchlist management, and alert delivery workflows.</p>
                    </article>
                    <article className="public-card">
                        <h3>Reliability and Security</h3>
                        <p>To detect incidents, prevent abuse, and investigate platform issues quickly.</p>
                    </article>
                    <article className="public-card">
                        <h3>Product Improvement</h3>
                        <p>To understand usage patterns and prioritize impactful performance and UX updates.</p>
                    </article>
                </div>
            </section>

            <section className="public-section">
                <h2>Retention and Protection</h2>
                <p>
                    Data is retained for operational necessity and security monitoring. We apply access controls and least-
                    privilege practices for internal tooling and infrastructure where feasible.
                </p>
            </section>

            <section className="public-section">
                <h2>Your Controls</h2>
                <ul>
                    <li>Update profile preferences from account settings.</li>
                    <li>Disable notification channels where supported.</li>
                    <li>Request account support help for data-related questions.</li>
                </ul>
            </section>

            <div className="public-callout">
                <strong>No Data Sale Policy</strong>
                <p>
                    We do not sell personal data. Data use is limited to delivering and improving the service.
                </p>
            </div>
        </PublicPageLayout>
    );
};

export default Privacy;
