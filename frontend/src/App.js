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
import PartnerDashboardPage from './pages/PartnerDashboardPage';

import './App.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

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
  const [token, setToken] = useState(() => localStorage.getItem('token'));

  const login = async (email, password) => {
    const response = await axios.post(`${API}/auth/login`, { email, password });
    const { token: newToken, ...userData } = response.data;
    localStorage.setItem('token', newToken);
    setToken(newToken);
    setUser(userData);
    return userData;
  };

  const register = async (data) => {
    const response = await axios.post(`${API}/auth/register`, data);
    const { token: newToken, ...userData } = response.data;
    localStorage.setItem('token', newToken);
    setToken(newToken);
    setUser(userData);
    return userData;
  };

  const logout = async () => {
    try {
      await axios.post(`${API}/auth/logout`, {}, { withCredentials: true });
    } catch (e) {
      console.error('Logout error:', e);
    }
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  };

  const checkAuth = async () => {
    const storedToken = localStorage.getItem('token');
    
    try {
      if (storedToken) {
        const response = await axios.get(`${API}/auth/me`, {
          withCredentials: true,
          headers: { Authorization: `Bearer ${storedToken}` }
        });
        setUser(response.data);
        setToken(storedToken);
        return;
      }

      // No token — try cookie-based auth (for Google OAuth sessions)
      const response = await axios.get(`${API}/auth/me`, { withCredentials: true });
      setUser(response.data);
    } catch (e) {
      if (storedToken && e.response && e.response.status === 401) {
        localStorage.removeItem('token');
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
          localStorage.setItem('token', token);
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
          localStorage.removeItem('token');
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
      <Route path="/support" element={<SupportPage />} />
      <Route path="/book/:userId" element={<PublicBookingPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
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
      <Route path="/privacy" element={<LegalPage />} />
      <Route path="/terms" element={<LegalPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ScrollToTop />
        <AppRouter />
        <Toaster position="top-right" />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
