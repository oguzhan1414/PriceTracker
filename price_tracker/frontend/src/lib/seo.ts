import { useEffect } from 'react';

export type SeoConfig = {
    title: string;
    description: string;
    path?: string;
    keywords?: string[];
    image?: string;
    type?: 'website' | 'article';
    noindex?: boolean;
    structuredData?: Record<string, unknown> | Array<Record<string, unknown>>;
};

const SITE_NAME = 'PriceTracker';
const SITE_URL = (import.meta.env.VITE_SITE_URL as string | undefined) || 'https://pricetracker.app';
const DEFAULT_IMAGE = `${SITE_URL}/favicon.svg`;

const upsertMeta = (selector: string, attrs: Record<string, string>, content: string) => {
    let el = document.head.querySelector<HTMLMetaElement>(selector);
    if (!el) {
        el = document.createElement('meta');
        Object.entries(attrs).forEach(([k, v]) => el?.setAttribute(k, v));
        document.head.appendChild(el);
    }
    el.setAttribute('content', content);
};

const upsertCanonical = (href: string) => {
    let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) {
        link = document.createElement('link');
        link.setAttribute('rel', 'canonical');
        document.head.appendChild(link);
    }
    link.setAttribute('href', href);
};

const upsertJsonLd = (payload?: SeoConfig['structuredData']) => {
    const id = 'seo-jsonld';
    const existing = document.getElementById(id);
    if (!payload) {
        existing?.remove();
        return;
    }

    const script = existing || document.createElement('script');
    script.setAttribute('type', 'application/ld+json');
    script.setAttribute('id', id);
    script.textContent = JSON.stringify(payload);
    if (!existing) {
        document.head.appendChild(script);
    }
};

export const usePageSeo = ({
    title,
    description,
    path = '/',
    keywords = [],
    image = DEFAULT_IMAGE,
    type = 'website',
    noindex = false,
    structuredData,
}: SeoConfig) => {
    useEffect(() => {
        const normalizedTitle = title.includes(SITE_NAME) ? title : `${title} | ${SITE_NAME}`;
        const canonical = `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;
        const robots = noindex ? 'noindex,nofollow' : 'index,follow';

        document.title = normalizedTitle;
        upsertMeta('meta[name="description"]', { name: 'description' }, description);
        upsertMeta('meta[name="robots"]', { name: 'robots' }, robots);
        if (keywords.length > 0) {
            upsertMeta('meta[name="keywords"]', { name: 'keywords' }, keywords.join(', '));
        }

        upsertMeta('meta[property="og:title"]', { property: 'og:title' }, normalizedTitle);
        upsertMeta('meta[property="og:description"]', { property: 'og:description' }, description);
        upsertMeta('meta[property="og:type"]', { property: 'og:type' }, type);
        upsertMeta('meta[property="og:url"]', { property: 'og:url' }, canonical);
        upsertMeta('meta[property="og:image"]', { property: 'og:image' }, image);
        upsertMeta('meta[property="og:site_name"]', { property: 'og:site_name' }, SITE_NAME);

        upsertMeta('meta[name="twitter:card"]', { name: 'twitter:card' }, 'summary_large_image');
        upsertMeta('meta[name="twitter:title"]', { name: 'twitter:title' }, normalizedTitle);
        upsertMeta('meta[name="twitter:description"]', { name: 'twitter:description' }, description);
        upsertMeta('meta[name="twitter:image"]', { name: 'twitter:image' }, image);

        upsertCanonical(canonical);
        upsertJsonLd(structuredData);
    }, [description, image, keywords, noindex, path, structuredData, title, type]);
};
