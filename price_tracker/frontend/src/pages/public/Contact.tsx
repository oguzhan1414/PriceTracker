import PublicPageLayout from './PublicPageLayout';

const Contact = () => {
    return (
        <PublicPageLayout
            badge="CONTACT"
            title="Reach The PriceTracker Team"
            subtitle="Support, bug reports, and business questions are handled through focused channels for faster turnaround."
            seoPath="/contact"
            seoKeywords={['contact pricetracker', 'support', 'bug report']}
        >
            <section className="public-section">
                <h2>Primary Channels</h2>
                <div className="public-grid">
                    <article className="public-card">
                        <h3>Product Support</h3>
                        <p><strong>support@pricetracker.app</strong></p>
                        <p>Best for account issues, dashboard behavior, notification problems, and checkout errors.</p>
                    </article>
                    <article className="public-card">
                        <h3>General Inquiries</h3>
                        <p><strong>hello@pricetracker.app</strong></p>
                        <p>Use for partnerships, integration requests, and non-urgent product questions.</p>
                    </article>
                    <article className="public-card">
                        <h3>Security & Abuse</h3>
                        <p><strong>security@pricetracker.app</strong></p>
                        <p>For vulnerability disclosure, suspicious activity reports, and account abuse incidents.</p>
                    </article>
                </div>
            </section>

            <section className="public-section">
                <h2>Expected Response Time</h2>
                <ul>
                    <li>Normal support requests: within 1-2 business days</li>
                    <li>Urgent account access issues: same business day when possible</li>
                    <li>Security reports: initial acknowledgment within 24 hours</li>
                </ul>
            </section>

            <section className="public-section">
                <h2>How To Get Faster Help</h2>
                <ol>
                    <li>Include the email tied to your account.</li>
                    <li>Add clear reproduction steps and expected vs actual behavior.</li>
                    <li>Attach screenshots when UI state is relevant.</li>
                    <li>For payment issues, include provider and approximate timestamp.</li>
                </ol>
            </section>

            <div className="public-callout">
                <strong>Note</strong>
                <p>
                    During sandbox payment period, billing support can validate flow behavior but cannot process real charge
                    disputes because no live charging is active yet.
                </p>
            </div>
        </PublicPageLayout>
    );
};

export default Contact;
