import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate, useNavigationType } from 'react-router-dom';
import axios from 'axios';
import { Toaster } from './components/ui/sonner';
import { toast } from 'sonner';
import enLocale from './locales/en.json';
import deLocale from './locales/de.json';
import { safeInternalPath } from './utils/safeRedirect';

// Pages
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import DashboardPage from './pages/DashboardPage';
import LeadsPage from './pages/LeadsPage';
import DealsPage from './pages/DealsPage';
import TasksPage from './pages/TasksPage';
import CompaniesPage from './pages/CompaniesPage';
import CampaignsPage from './pages/CampaignsPage';
import SettingsPage from './pages/SettingsPage';
import AdminPage from './pages/AdminPage';
import PricingPage from './pages/PricingPage';
import SupportPage from './pages/SupportPage';
import PipelineReportPage from './pages/PipelineReportPage';
import SubscriptionSuccessPage from './pages/SubscriptionSuccessPage';
import ChatPage from './pages/ChatPage';
import CallsPage from './pages/CallsPage';
import ContactsPage from './pages/ContactsPage';
import ProjectsPage from './pages/ProjectsPage';
import CalendarPage from './pages/CalendarPage';
import BookingPage, { PublicBookingPage } from './pages/BookingPage';
import CapturePage from './pages/CapturePage';
import FilesPage from './pages/FilesPage';
import ListenersPage from './pages/ListenersPage';
import { ForgotPasswordPage, ResetPasswordPage } from './pages/PasswordResetPages';
import LegalPage from './pages/LegalPage';
import DPAPage from './pages/DPAPage';
import VerifyEmailPage from './pages/VerifyEmailPage';
import SetupOrgPage from './pages/SetupOrgPage';
import PartnerDashboardPage from './pages/PartnerDashboardPage';
import DownloadPage from './pages/DownloadPage';
/* PLATFORM_BEGIN */
import ChangelogPage from './pages/ChangelogPage';
/* PLATFORM_END */

import './App.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

// ---------- FOLLOWUPS #16: error monitoring -------------------------------
// Sentry is a soft dependency on the frontend too. When REACT_APP_SENTRY_DSN
// is set at build time, we dynamically import @sentry/react and init. No DSN
// or no package → stays a no-op so dev builds don't need the SDK installed.
//
// Set REACT_APP_SENTRY_DSN and REACT_APP_ENVIRONMENT at build time (CRA
// inlines these). ErrorBoundary below catches rendering errors regardless;
// Sentry just records them when it's available.
if (process.env.REACT_APP_SENTRY_DSN) {
  import('@sentry/react')
    .then((Sentry) => {
      Sentry.init({
        dsn: process.env.REACT_APP_SENTRY_DSN,
        environment: process.env.REACT_APP_ENVIRONMENT || 'production',
        // Deliberately no performance tracing on the frontend (per spec).
        tracesSampleRate: 0,
      });
    })
    .catch((e) => {
      // eslint-disable-next-line no-console
      console.warn('[sentry] init skipped — @sentry/react not installed', e);
    });
}

// Top-level error boundary. Catches exceptions thrown during React render
// so a bad component can't white-screen the whole app. The fallback UI is
// intentionally bare — minimum it needs is "something went wrong" and a
// reload affordance so the user has a way forward.
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error, errorInfo) {
    // eslint-disable-next-line no-console
    console.error('Unhandled error in React tree:', error, errorInfo);
    // If Sentry happened to be loaded by the init above, capture the error.
    try {
      if (window.Sentry && typeof window.Sentry.captureException === 'function') {
        window.Sentry.captureException(error, { extra: errorInfo });
      }
    } catch (e) {
      /* no-op */
    }
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f8fafc',
          padding: '24px',
          fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
        }}>
          <div style={{ maxWidth: 480, textAlign: 'center' }}>
            <h1 style={{ fontSize: 20, fontWeight: 600, color: '#0f172a', marginBottom: 8 }}>
              Something went wrong
            </h1>
            <p style={{ fontSize: 14, color: '#475569', marginBottom: 20 }}>
              The page hit an unexpected error. Reloading usually fixes it — if it keeps happening, contact us at{' '}
              <a href="mailto:support@tako.software" style={{ color: '#0EA5A0' }}>support@tako.software</a>.
            </p>
            <button
              onClick={() => { window.location.reload(); }}
              style={{
                background: '#0EA5A0',
                color: 'white',
                border: 'none',
                padding: '10px 20px',
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Reload page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// ---------- FOLLOWUPS #9: dual-token storage + silent refresh -------------
// Tokens live in localStorage under these keys; the AuthProvider reads them
// on mount and the axios interceptors below keep them current. Exported so
// pages (LoginPage/SignupPage) that receive a token pair from a direct
// axios call can persist them without going through the context.
export const ACCESS_TOKEN_KEY = 'token'; // legacy key — kept for compat
export const REFRESH_TOKEN_KEY = 'refresh_token';

export const saveAuthTokens = ({ access_token, refresh_token, token }) => {
  const access = access_token || token;
  if (access) localStorage.setItem(ACCESS_TOKEN_KEY, access);
  if (refresh_token) localStorage.setItem(REFRESH_TOKEN_KEY, refresh_token);
};

export const clearAuthTokens = () => {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
};

// Request interceptor: attach Bearer header on every request to our API.
// Component-level `headers: { Authorization: ... }` overrides still win
// because they run after this interceptor in the axios request pipeline.
axios.interceptors.request.use((config) => {
  try {
    const url = config.url || '';
    const isOurApi = url.startsWith(API) || url.startsWith('/api');
    if (isOurApi) {
      const hasAuthHeader = !!(config.headers && (config.headers.Authorization || config.headers.authorization));
      if (!hasAuthHeader) {
        const access = localStorage.getItem(ACCESS_TOKEN_KEY);
        if (access) {
          config.headers = config.headers || {};
          config.headers.Authorization = `Bearer ${access}`;
        }
      }
    }
  } catch (e) {
    // never let the interceptor throw
  }
  return config;
});

// Response interceptor: on 401, try a silent refresh exactly once per
// request, dedupe concurrent refreshes, replay the original call with the
// new token. On refresh failure, clear tokens and bounce to /login.
let _refreshInFlight = null;
const _refreshUrl = `${API}/auth/refresh`;
const _authPathsNoRefresh = ['/auth/login', '/auth/register', '/auth/refresh'];

const _runRefresh = async () => {
  const refresh = localStorage.getItem(REFRESH_TOKEN_KEY);
  if (!refresh) throw new Error('no_refresh_token');
  const res = await axios.post(_refreshUrl, { refresh_token: refresh }, {
    // Skip our own interceptor chain for this call — we don't want the
    // (possibly expired) access token attached, and we don't want another
    // 401 here to trigger a nested refresh.
    headers: { 'X-Skip-Auth-Refresh': '1' },
  });
  saveAuthTokens(res.data);
  return res.data.access_token;
};

axios.interceptors.response.use(
  (r) => r,
  async (error) => {
    const status = error?.response?.status;
    const original = error?.config || {};
    const url = original.url || '';

    // Only attempt refresh for 401s on our own API, excluding auth endpoints
    // themselves, and only once per request (tagged via _retriedRefresh).
    const isOurApi = url.startsWith(API) || url.startsWith('/api');
    const isAuthPath = _authPathsNoRefresh.some((p) => url.includes(p));
    const alreadyTried = !!original._retriedRefresh;
    const skipFlag = original.headers && original.headers['X-Skip-Auth-Refresh'];

    if (status === 401 && isOurApi && !isAuthPath && !alreadyTried && !skipFlag) {
      original._retriedRefresh = true;
      try {
        if (!_refreshInFlight) {
          _refreshInFlight = _runRefresh().finally(() => { _refreshInFlight = null; });
        }
        const newAccess = await _refreshInFlight;
        original.headers = original.headers || {};
        original.headers.Authorization = `Bearer ${newAccess}`;
        return axios(original);
      } catch (e) {
        clearAuthTokens();
        if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    }

    return Promise.reject(error);
  }
);

// Capture PWA install prompt
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  window.deferredPWAPrompt = e;
});

// Global axios interceptor: intercept structured 403s (AI trial expired,
// key missing, etc.), surface a rich toast with an action button, and
// normalize the error.response.data.detail to a plain string so existing
// per-page handlers (toast.error(e.response?.data?.detail)) still work.
let _lastStructuredToastAt = 0;
// Interceptor runs at module load — outside any component — so we read
// translations directly from the locale bundles keyed by localStorage.
const _tAxios = (key) => {
  const lang = (typeof localStorage !== 'undefined' && localStorage.getItem('tako_lang')) || 'en';
  const bundle = lang === 'de' ? deLocale : enLocale;
  const parts = key.split('.');
  let val = bundle;
  for (const p of parts) val = val?.[p];
  return val || key;
};
axios.interceptors.response.use(
  (r) => r,
  (error) => {
    try {
      const detail = error?.response?.data?.detail;
      if (detail && typeof detail === 'object' && detail.code) {
        const now = Date.now();
        // Debounce: avoid stacking toasts when multiple AI calls fail in a row.
        if (now - _lastStructuredToastAt > 3000) {
          _lastStructuredToastAt = now;
          // Prefer localized copy from the backend (detail.message_de / action_de)
          // when the user's UI language is German and the backend supplied it.
          const lang = (typeof localStorage !== 'undefined' && localStorage.getItem('tako_lang')) || 'en';
          const localizedMsg = lang === 'de' ? (detail.message_de || detail.message) : detail.message;
          const localizedAction = lang === 'de' ? (detail.action_de || detail.action) : detail.action;
          const msg = localizedMsg || _tAxios('common.actionRequired');
          const desc = localizedAction || undefined;
          const target = detail.settings_url || detail.support_url || null;
          toast.error(msg, {
            description: desc,
            duration: 8000,
            action: target
              ? {
                  label: detail.code === 'ai_trial_expired' ? _tAxios('common.addKey') : _tAxios('common.openSettings'),
                  onClick: () => { window.location.href = target; },
                }
              : undefined,
          });
        }
        // Replace dict with a plain string so existing handlers don't print [object Object].
        const lang = (typeof localStorage !== 'undefined' && localStorage.getItem('tako_lang')) || 'en';
        const flatMsg = lang === 'de' ? (detail.message_de || detail.message) : detail.message;
        const flatAct = lang === 'de' ? (detail.action_de || detail.action) : detail.action;
        error.response.data.detail = [flatMsg, flatAct].filter(Boolean).join(' ');
      }
    } catch (e) {
      // Never let the interceptor itself throw.
    }
    return Promise.reject(error);
  }
);

// Auth Context
const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(() => localStorage.getItem(ACCESS_TOKEN_KEY));

  const login = async (email, password) => {
    const response = await axios.post(`${API}/auth/login`, { email, password });
    // FOLLOWUPS #9: response now carries { access_token, refresh_token, token, ...userData }.
    // `token` is kept as an alias for legacy code paths; new code reads
    // access_token. saveAuthTokens handles both.
    saveAuthTokens(response.data);
    const { access_token, refresh_token, token: legacyToken, expires_in, token_type, ...userData } = response.data;
    setToken(access_token || legacyToken);
    setUser(userData);
    return userData;
  };

  const register = async (data) => {
    const response = await axios.post(`${API}/auth/register`, data);
    saveAuthTokens(response.data);
    const { access_token, refresh_token, token: legacyToken, expires_in, token_type, ...userData } = response.data;
    setToken(access_token || legacyToken);
    setUser(userData);
    return userData;
  };

  const logout = async () => {
    try {
      const refresh = localStorage.getItem(REFRESH_TOKEN_KEY);
      // Pass the refresh token so the server can retire it (FOLLOWUPS #9).
      await axios.post(
        `${API}/auth/logout`,
        refresh ? { refresh_token: refresh } : {},
        { withCredentials: true }
      );
    } catch (e) {
      console.error('Logout error:', e);
    }
    clearAuthTokens();
    setToken(null);
    setUser(null);
  };

  const checkAuth = async () => {
    const storedToken = localStorage.getItem(ACCESS_TOKEN_KEY);

    try {
      if (storedToken) {
        // The request interceptor will attach the Bearer header; if the
        // access token is expired, the response interceptor will silently
        // refresh via the stored refresh token and replay this call.
        const response = await axios.get(`${API}/auth/me`, { withCredentials: true });
        setUser(response.data);
        setToken(localStorage.getItem(ACCESS_TOKEN_KEY));
        return;
      }

      // No token — try cookie-based auth (for Google OAuth sessions)
      const response = await axios.get(`${API}/auth/me`, { withCredentials: true });
      setUser(response.data);
    } catch (e) {
      if (e.response && e.response.status === 401) {
        clearAuthTokens();
        setToken(null);
      }
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  return (
    <AuthContext.Provider value={{ user, setUser, token, loading, login, register, logout, checkAuth }}>
      {children}
    </AuthContext.Provider>
  );
};

// Auth Callback Component
const AuthCallback = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { setUser, checkAuth } = useAuth();
  const hasProcessed = useRef(false);

  useEffect(() => {
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    const processCallback = async () => {
      const params = new URLSearchParams(location.search);
      const token = params.get('token');
      const error = params.get('error');

      if (error) {
        console.error('Auth error:', error);
        navigate('/login', { replace: true });
        return;
      }

      if (token) {
        try {
          // Google OAuth still returns a single long-lived JWT — write it
          // under the canonical access-token key so the request interceptor
          // picks it up. The silent-refresh path only kicks in for users
          // who got the dual-token pair from /auth/login or /auth/register.
          localStorage.setItem(ACCESS_TOKEN_KEY, token);
          const response = await axios.get(`${API}/auth/me`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          setUser(response.data);
          // safeInternalPath guards against any tampered return destination.
          // The two candidates here are hardcoded constants so this is defence-in-depth.
          const rawDest = localStorage.getItem('tako_checkout_intent') ? '/pricing' : '/dashboard';
          navigate(safeInternalPath(rawDest, '/dashboard'), { replace: true });
        } catch (error) {
          console.error('Auth callback error:', error);
          clearAuthTokens();
          navigate('/login', { replace: true });
        }
      } else {
        navigate('/login', { replace: true });
      }
    };

    processCallback();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-tako-teal border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-slate-600">Signing you in...</p>
      </div>
    </div>
  );
};

// Protected Route
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-8 h-8 border-2 border-tako-teal border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // FOLLOWUPS #1: gate on email verification. `email_verified === false`
  // is the only state that blocks — undefined/true both pass (grandfathered
  // users have no field; backend returns True for them).
  if (user.email_verified === false && location.pathname !== '/verify-email') {
    return <Navigate to="/verify-email" state={{ from: location }} replace />;
  }

  // FOLLOWUPS #14: gate on organization membership. Post auto-join removal,
  // users who signed up without an invite code or organization_name land
  // here with organization_id === null. Route them through /setup-org
  // before they can reach any data-bearing page. Both null and undefined
  // block; a real string value passes.
  if (!user.organization_id && location.pathname !== '/setup-org') {
    return <Navigate to="/setup-org" state={{ from: location }} replace />;
  }

  return children;
};

// Scroll manager:
// - On forward navigation (PUSH/REPLACE) → scroll to top (or to the hash
//   target if present).
// - On back/forward navigation (POP) → restore the previous scroll position
//   for that history entry.
// Positions are keyed by `location.key` (unique per history entry), kept in
// memory only (sessionStorage would work too but isn't needed for a SPA).
// Browser-native scroll restoration is disabled so refreshes land at the top
// and we're in full control.
const SCROLL_POSITIONS = new Map();

const ScrollToTop = () => {
  const location = useLocation();
  const { pathname, hash, key } = location;
  const navType = useNavigationType(); // 'POP' | 'PUSH' | 'REPLACE'
  const prevKeyRef = useRef(key);

  useEffect(() => {
    if ('scrollRestoration' in window.history) {
      try { window.history.scrollRestoration = 'manual'; } catch (e) {}
    }
  }, []);

  // Before leaving an entry, stash its scroll position against its key.
  useEffect(() => {
    return () => {
      if (prevKeyRef.current) {
        SCROLL_POSITIONS.set(prevKeyRef.current, window.scrollY);
      }
    };
  }, [key]);

  useEffect(() => {
    prevKeyRef.current = key;

    // Hash anchors always win: let the browser/scroll-margin resolve them.
    if (hash) {
      const el = document.getElementById(hash.slice(1));
      if (el) {
        requestAnimationFrame(() => el.scrollIntoView({ behavior: 'auto', block: 'start' }));
        return;
      }
    }

    if (navType === 'POP') {
      // Back/forward: restore previous position if we have one, else top.
      const saved = SCROLL_POSITIONS.get(key);
      // Wait a frame so the destination page has mounted and measured.
      requestAnimationFrame(() => window.scrollTo(0, typeof saved === 'number' ? saved : 0));
      return;
    }

    window.scrollTo(0, 0);
  }, [pathname, hash, key, navType]);

  return null;
};

// App Router
const AppRouter = () => {
  const location = useLocation();

  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/pricing" element={<PricingPage />} />
      {/* /demo is a placeholder sandbox entry-point referenced from the landing
          hero CTA. Until the dedicated sandbox lands we route visitors into the
          signup flow with a demo flag so nobody sees a broken link. */}
      <Route path="/demo" element={<Navigate to="/signup?demo=1" replace />} />
      <Route path="/support" element={<SupportPage />} />
      <Route path="/book/:userId" element={<PublicBookingPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />
      <Route
        path="/setup-org"
        element={
          <ProtectedRoute>
            <SetupOrgPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/subscription/success"
        element={
          <ProtectedRoute>
            <SubscriptionSuccessPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/leads"
        element={
          <ProtectedRoute>
            <LeadsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/deals"
        element={
          <ProtectedRoute>
            <DealsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/tasks"
        element={
          <ProtectedRoute>
            <TasksPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/companies"
        element={
          <ProtectedRoute>
            <CompaniesPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/campaigns"
        element={
          <ProtectedRoute>
            <CampaignsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <SettingsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin"
        element={
          <ProtectedRoute>
            <AdminPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/pipeline"
        element={
          <ProtectedRoute>
            <PipelineReportPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/chat"
        element={
          <ProtectedRoute>
            <ChatPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/calls"
        element={
          <ProtectedRoute>
            <CallsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/contacts"
        element={
          <ProtectedRoute>
            <ContactsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/projects"
        element={
          <ProtectedRoute>
            <ProjectsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/calendar"
        element={
          <ProtectedRoute>
            <CalendarPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/bookings"
        element={
          <ProtectedRoute>
            <BookingPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/capture"
        element={
          <ProtectedRoute>
            <CapturePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/capture/:eventName"
        element={
          <ProtectedRoute>
            <CapturePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/files"
        element={
          <ProtectedRoute>
            <FilesPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/listeners"
        element={
          <ProtectedRoute>
            <ListenersPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/partners"
        element={
          <ProtectedRoute>
            <PartnerDashboardPage />
          </ProtectedRoute>
        }
      />
      {/* Platform-only: stripped from the self-hosted distribution. Surfaces
          the packaged TAKO build for customers who just paid. */}
      <Route
        path="/download"
        element={
          <ProtectedRoute>
            <DownloadPage />
          </ProtectedRoute>
        }
      />
      <Route path="/privacy" element={<LegalPage />} />
      <Route path="/terms" element={<LegalPage />} />
      <Route path="/legal/dpa" element={<DPAPage />} />
      {/* PLATFORM_BEGIN */}
      {/* Public changelog — tako.software/changelog. Stripped from the
          self-hosted distribution (customer instances don't host a changelog). */}
      <Route path="/changelog" element={<ChangelogPage />} />
      {/* PLATFORM_END */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <ScrollToTop />
          <AppRouter />
          <Toaster position="top-right" />
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
