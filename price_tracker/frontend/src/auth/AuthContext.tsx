import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { authApi, type User } from '../lib/api';

const SESSION_EXPIRED_EVENT = 'auth:session-expired';

type AuthContextType = {
    user: User | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    login: (email: string, password: string) => Promise<void>;
    register: (email: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
    refreshMe: (options?: { force?: boolean }) => Promise<void>;
    updateProfile: (payload: { full_name?: string; push_notifications?: boolean; email_notifications?: boolean; language?: 'en' | 'tr' }) => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const refreshMe = useCallback(async (options?: { force?: boolean }) => {
        try {
            const me = await authApi.me(options);
            setUser(me);
        } catch {
            setUser(null);
        }
    }, []);

    useEffect(() => {
        const init = async () => {
            await refreshMe({ force: true });
            setIsLoading(false);
        };
        void init();
    }, [refreshMe]);

    useEffect(() => {
        const handleSessionExpired = () => {
            // YENİ EKLENEN KISIM: Oturum kendiliğinden (hata vererek) düşerse kasayı temizle!
            localStorage.removeItem('access_token');
            localStorage.removeItem('refresh_token');
            setUser(null);
        };

        window.addEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
        return () => {
            window.removeEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
        };
    }, []);

    const login = useCallback(async (email: string, password: string) => {
        await authApi.login(email, password);
        const me = await authApi.me({ force: true });
        setUser(me);
    }, []);

    const register = useCallback(async (email: string, password: string) => {
        await authApi.register(email, password);
    }, []);

    const logout = useCallback(async () => {
        try {
            await authApi.logout();
        } finally {
            setUser(null);
        }
    }, []);

    const updateProfile = useCallback(async (payload: { full_name?: string; push_notifications?: boolean; email_notifications?: boolean; language?: 'en' | 'tr' }) => {
        const response = await authApi.updateProfile(payload);
        setUser(response.user);
    }, []);

    const value = useMemo<AuthContextType>(
        () => ({
            user,
            isAuthenticated: Boolean(user),
            isLoading,
            login,
            register,
            logout,
            refreshMe,
            updateProfile,
        }),
        [user, isLoading, login, register, logout, refreshMe, updateProfile]
    );

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};