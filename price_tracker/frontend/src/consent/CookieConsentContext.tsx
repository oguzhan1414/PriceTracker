import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

export type CookieConsentChoice = 'accepted' | 'rejected' | null;

const COOKIE_CONSENT_KEY = 'pt:cookie-consent';
export const REMEMBERED_EMAIL_KEY = 'auth:last-email';
const OPTIONAL_STORAGE_PREFIXES = ['dashboard:deals:last-read-at'];

type CookieConsentContextValue = {
    consent: CookieConsentChoice;
    canUseOptionalStorage: boolean;
    acceptCookies: () => void;
    rejectCookies: () => void;
};

const CookieConsentContext = createContext<CookieConsentContextValue | undefined>(undefined);

const readInitialConsent = (): CookieConsentChoice => {
    try {
        const raw = localStorage.getItem(COOKIE_CONSENT_KEY);
        if (raw === 'accepted' || raw === 'rejected') {
            return raw;
        }
    } catch {
        // Ignore storage read errors.
    }
    return null;
};

const clearOptionalStorage = () => {
    try {
        localStorage.removeItem(REMEMBERED_EMAIL_KEY);
        for (let i = localStorage.length - 1; i >= 0; i -= 1) {
            const key = localStorage.key(i);
            if (!key) continue;
            if (OPTIONAL_STORAGE_PREFIXES.some((prefix) => key.startsWith(prefix))) {
                localStorage.removeItem(key);
            }
        }
    } catch {
        // Ignore storage cleanup errors.
    }
};

export const CookieConsentProvider = ({ children }: { children: ReactNode }) => {
    const [consent, setConsent] = useState<CookieConsentChoice>(() => readInitialConsent());

    useEffect(() => {
        if (!consent) {
            return;
        }
        try {
            localStorage.setItem(COOKIE_CONSENT_KEY, consent);
        } catch {
            // Ignore storage write errors.
        }
    }, [consent]);

    const acceptCookies = useCallback(() => {
        setConsent('accepted');
    }, []);

    const rejectCookies = useCallback(() => {
        clearOptionalStorage();
        setConsent('rejected');
    }, []);

    const value = useMemo<CookieConsentContextValue>(
        () => ({
            consent,
            canUseOptionalStorage: consent === 'accepted',
            acceptCookies,
            rejectCookies,
        }),
        [acceptCookies, consent, rejectCookies],
    );

    return <CookieConsentContext.Provider value={value}>{children}</CookieConsentContext.Provider>;
};

export const useCookieConsent = () => {
    const ctx = useContext(CookieConsentContext);
    if (!ctx) {
        throw new Error('useCookieConsent must be used within CookieConsentProvider');
    }
    return ctx;
};
