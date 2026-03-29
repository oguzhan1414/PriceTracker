import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';
import { usePageSeo } from '../../lib/seo';
import '../../styles/pages/PublicPages.css';

type PublicPageLayoutProps = {
    badge: string;
    title: string;
    subtitle: string;
    seoPath: string;
    seoDescription?: string;
    seoNoIndex?: boolean;
    seoKeywords?: string[];
    children: ReactNode;
};

const PublicPageLayout = ({
    badge,
    title,
    subtitle,
    seoPath,
    seoDescription,
    seoNoIndex,
    seoKeywords,
    children,
}: PublicPageLayoutProps) => {
    usePageSeo({
        title,
        description: seoDescription || subtitle,
        path: seoPath,
        noindex: seoNoIndex,
        keywords: seoKeywords,
    });

    return (
        <div className="public-page-shell">
            <div className="public-page-bg" aria-hidden="true" />
            <main className="public-page-card">
                <Link to="/" className="public-page-back">Back to Home</Link>
                <span className="public-page-badge">{badge}</span>
                <h1>{title}</h1>
                <p className="public-page-subtitle">{subtitle}</p>
                <div className="public-page-content">{children}</div>
            </main>
        </div>
    );
};

export default PublicPageLayout;
