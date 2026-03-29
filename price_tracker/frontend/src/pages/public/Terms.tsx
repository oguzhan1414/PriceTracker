import PublicPageLayout from './PublicPageLayout';

const Terms = () => {
    return (
        <PublicPageLayout
            badge="LEGAL"
            title="Terms Of Service"
            subtitle="These terms summarize how PriceTracker can be used, what we provide, and how platform safety is maintained."
            seoPath="/terms"
            seoKeywords={['terms of service', 'usage policy', 'pricetracker terms']}
        >
            <section className="public-section">
                <h2>1. Service Scope</h2>
                <p>
                    PriceTracker provides price monitoring, alerts, and dashboard analytics for supported sources. We may add,
                    remove, or modify features to improve reliability or comply with provider constraints.
                </p>
            </section>

            <section className="public-section">
                <h2>2. Account Responsibility</h2>
                <ul>
                    <li>You are responsible for securing your account credentials.</li>
                    <li>You must not attempt unauthorized access to other accounts or internal systems.</li>
                    <li>You must provide accurate account information and keep contact details up to date.</li>
                </ul>
            </section>

            <section className="public-section">
                <h2>3. Acceptable Use</h2>
                <ul>
                    <li>Do not automate abuse, overload requests, or attempt to degrade service availability.</li>
                    <li>Do not use the platform for illegal activity or policy-violating content.</li>
                    <li>Do not reverse-engineer protected components in ways that violate applicable law.</li>
                </ul>
            </section>

            <section className="public-section">
                <h2>4. Plans and Billing</h2>
                <p>
                    Plan capabilities differ by tier and region. At this stage, payment integrations may run in sandbox mode
                    for testing, and real charging behavior can differ when production billing is activated.
                </p>
            </section>

            <section className="public-section">
                <h2>5. Disclaimer</h2>
                <p>
                    Price data may change rapidly due to source-side updates. PriceTracker provides monitoring support and
                    operational insight but does not provide financial advice or purchase guarantees.
                </p>
            </section>

            <div className="public-callout">
                <strong>Document Scope</strong>
                <p>
                    This is a practical product summary for current release. A full legal version can be published as the
                    commercial rollout expands.
                </p>
            </div>
        </PublicPageLayout>
    );
};

export default Terms;
