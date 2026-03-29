import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import App from './App.tsx'
import { AuthProvider } from './auth/AuthContext';
import { CookieConsentProvider } from './consent/CookieConsentContext';
import { ToastProvider } from './ui/ToastContext';
import './styles/global.css';
import './styles/veriables.css';
import './styles/ui/Toast.css';
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CookieConsentProvider>
      <AuthProvider>
        <ToastProvider>
          <App />
        </ToastProvider>
      </AuthProvider>
    </CookieConsentProvider>
  </StrictMode>,
)
