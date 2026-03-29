import { createContext, useCallback, useContext, useMemo, useState } from 'react';

type ToastKind = 'success' | 'error' | 'info';

type ToastItem = {
    id: number;
    type: ToastKind;
    message: string;
};

type ToastContextType = {
    showToast: (type: ToastKind, message: string) => void;
};

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider = ({ children }: { children: React.ReactNode }) => {
    const [toasts, setToasts] = useState<ToastItem[]>([]);

    const showToast = useCallback((type: ToastKind, message: string) => {
        const id = Date.now() + Math.floor(Math.random() * 1000);
        setToasts((prev) => [...prev, { id, type, message }]);

        window.setTimeout(() => {
            setToasts((prev) => prev.filter((item) => item.id !== id));
        }, 3200);
    }, []);

    const value = useMemo(() => ({ showToast }), [showToast]);

    return (
        <ToastContext.Provider value={value}>
            {children}
            <div className="global-toast-stack" aria-live="polite" aria-atomic="true">
                {toasts.map((toast) => (
                    <div key={toast.id} className={`global-toast ${toast.type}`} role="status">
                        {toast.message}
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
};

export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
};
