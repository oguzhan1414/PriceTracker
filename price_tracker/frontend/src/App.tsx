import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ProtectedRoute, PublicOnlyRoute } from './auth/RouteGuards';
import CookieBanner from './components/CookieBanner';
import './App.css';

const Home = lazy(() => import('./pages/Home'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Overview = lazy(() => import('./pages/dashboard/Overview'));
const Watchlist = lazy(() => import('./pages/dashboard/Watchlist'));
const Deals = lazy(() => import('./pages/dashboard/Deals'));
const Settings = lazy(() => import('./pages/dashboard/Settings'));
const PaymentSuccess = lazy(() => import('./pages/PaymentSuccess'));
const PaymentCheckout = lazy(() => import('./pages/PaymentCheckout'));
const About = lazy(() => import('./pages/public/About'));
const Contact = lazy(() => import('./pages/public/Contact'));
const Terms = lazy(() => import('./pages/public/Terms'));
const Privacy = lazy(() => import('./pages/public/Privacy'));
const Status = lazy(() => import('./pages/public/Status'));

const RouteLoader = () => (
  <div className="route-loader" role="status" aria-live="polite">
    Loading...
  </div>
);

function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<RouteLoader />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/about" element={<About />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/status" element={<Status />} />
          <Route element={<PublicOnlyRoute />}>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
          </Route>
          {/* Payment result routes do not require auth (provider redirects). */}
          <Route path="/payment/success" element={<PaymentSuccess />} />
          <Route path="/payment/cancel" element={<PaymentSuccess />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/payment/checkout" element={<PaymentCheckout />} />
            <Route path="/dashboard" element={<Dashboard />}>
              <Route index element={<Overview />} />
              <Route path="watchlist" element={<Watchlist />} />
              <Route path="deals" element={<Deals />} />
              <Route path="settings" element={<Settings />} />
            </Route>
          </Route>
        </Routes>
      </Suspense>
      <CookieBanner />
    </BrowserRouter>
  );
}

export default App;