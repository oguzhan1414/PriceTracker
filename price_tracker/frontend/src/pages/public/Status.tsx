import PublicPageLayout from './PublicPageLayout';

const Status = () => {
    return (
        <PublicPageLayout
            badge="SYSTEM STATUS"
            title="Platform Status"
            subtitle="Operational snapshot for API, tracking jobs, notifications, and payment integrations."
            seoPath="/status"
            seoKeywords={['status page', 'uptime', 'service health']}
        >
            <section className="public-section">
                <h2>Current Components</h2>
                <ul className="public-status-list">
                    <li>
                        <span>Core API</span>
                        <span className="status-pill ok">Operational</span>
                    </li>
                    <li>
                        <span>Scheduler & Price Checks</span>
                        <span className="status-pill ok">Operational</span>
                    </li>
                    <li>
                        <span>Email Notifications</span>
                        <span className="status-pill ok">Operational</span>
                    </li>
                    <li>
                        <span>Telegram Alerts</span>
                        <span className="status-pill ok">Operational</span>
                    </li>
                    <li>
                        <span>Payments</span>
                        <span className="status-pill warn">Sandbox Only</span>
                    </li>
                </ul>
            </section>

            <section className="public-section">
                <h2>Reliability Notes</h2>
                <ul>
                    <li>Monitoring jobs run continuously to keep product prices fresh.</li>
                    <li>Alert delivery depends on user channel preferences and account plan features.</li>
                    <li>Temporary provider-side interruptions can delay updates for specific sources.</li>
                </ul>
            </section>

            <section className="public-section">
                <h2>Incident Communication</h2>
                <p>
                    For material incidents, this page is updated first with current impact and mitigation progress. Users can
                    also contact support for account-specific troubleshooting during ongoing events.
                </p>
            </section>

            <div className="public-callout">
                <strong>Payment Rollout Status</strong>
                <p>
                    Payment providers are currently used in test mode. Live charging policy and production billing activation
                    will be announced before public rollout.
                </p>
            </div>
        </PublicPageLayout>
    );
};

export default Status;
