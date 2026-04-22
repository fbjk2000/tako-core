import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Mail, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { API, useAuth } from '../App';

/**
 * Email verification page — FOLLOWUPS #1.
 *
 * Serves two distinct purposes:
 *   1. Landing target for the verification link we email at signup. When the
 *      URL carries ?token=..., we POST it to /auth/verify-email and show the
 *      success state, then bounce to /dashboard.
 *   2. Interstitial for signed-in-but-unverified users. ProtectedRoute
 *      redirects here when user.email_verified === false. The user sees
 *      "check your email" copy with their address plus a rate-limited
 *      resend button.
 *
 * Anonymous access is supported so the email link still works in a fresh
 * browser session (we don't require the user to log in first).
 */
const VerifyEmailPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, checkAuth } = useAuth();

  const tokenFromUrl = new URLSearchParams(location.search).get('token');

  // States: 'pending' (waiting for user action), 'verifying', 'success',
  // 'error'. Token-in-URL starts in 'verifying'; no-token starts in
  // 'pending'.
  const [state, setState] = useState(tokenFromUrl ? 'verifying' : 'pending');
  const [message, setMessage] = useState('');
  const [resending, setResending] = useState(false);
  const [resentAt, setResentAt] = useState(null);

  // On mount: if a token is present, exchange it for the verified-email
  // state immediately. On success, refresh the auth context so the
  // ProtectedRoute gate unlocks, then send them to /dashboard.
  useEffect(() => {
    let cancelled = false;
    if (!tokenFromUrl) return;
    (async () => {
      try {
        await axios.post(`${API}/auth/verify-email`, { token: tokenFromUrl });
        if (cancelled) return;
        setState('success');
        setMessage('Your email address is now verified.');
        // Refresh /auth/me so user.email_verified flips to true in context.
        try { await checkAuth(); } catch (e) { /* non-fatal */ }
        setTimeout(() => {
          if (!cancelled) navigate('/dashboard', { replace: true });
        }, 1800);
      } catch (e) {
        if (cancelled) return;
        setState('error');
        setMessage(
          e?.response?.data?.detail ||
            'This verification link is invalid or has expired. Request a new one below.'
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tokenFromUrl, navigate, checkAuth]);

  const handleResend = async () => {
    if (!user) {
      // The resend endpoint requires auth. If someone landed here anonymous
      // without a token, point them back to login.
      navigate('/login');
      return;
    }
    setResending(true);
    try {
      await axios.post(`${API}/auth/resend-verification`, {});
      setResentAt(new Date());
      setMessage('A fresh verification email is on its way.');
    } catch (e) {
      const detail = e?.response?.data?.detail;
      const msg = typeof detail === 'object' ? detail.message : detail;
      setMessage(msg || 'Could not send a new verification email. Try again in a bit.');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <Link to="/">
            <img src="/logo-horizontal.svg" alt="TAKO" className="h-8" />
          </Link>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-8 shadow-sm">
          {state === 'verifying' && (
            <div className="text-center">
              <Loader2 className="w-12 h-12 text-[#0EA5A0] mx-auto mb-4 animate-spin" />
              <h1 className="text-xl font-semibold text-slate-900 mb-2">Verifying your email…</h1>
              <p className="text-sm text-slate-500">One moment.</p>
            </div>
          )}

          {state === 'success' && (
            <div className="text-center">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
              <h1 className="text-xl font-semibold text-slate-900 mb-2">You're verified</h1>
              <p className="text-sm text-slate-600 mb-6">{message}</p>
              <p className="text-xs text-slate-400">Redirecting to your dashboard…</p>
            </div>
          )}

          {state === 'error' && (
            <div className="text-center">
              <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <h1 className="text-xl font-semibold text-slate-900 mb-2">Verification failed</h1>
              <p className="text-sm text-slate-600 mb-6">{message}</p>
              {user ? (
                <button
                  onClick={handleResend}
                  disabled={resending}
                  className="w-full px-4 py-2.5 rounded-lg bg-[#0EA5A0] text-white text-sm font-medium hover:bg-[#0d938e] disabled:opacity-50"
                >
                  {resending ? 'Sending…' : 'Send a new verification email'}
                </button>
              ) : (
                <Link
                  to="/login"
                  className="inline-block px-4 py-2.5 rounded-lg bg-[#0EA5A0] text-white text-sm font-medium hover:bg-[#0d938e]"
                >
                  Sign in to resend
                </Link>
              )}
            </div>
          )}

          {state === 'pending' && (
            <div>
              <div className="flex justify-center mb-4">
                <div className="w-16 h-16 rounded-full bg-[#0EA5A0]/10 flex items-center justify-center">
                  <Mail className="w-8 h-8 text-[#0EA5A0]" />
                </div>
              </div>
              <h1 className="text-xl font-semibold text-slate-900 mb-2 text-center">
                Check your email
              </h1>
              <p className="text-sm text-slate-600 mb-6 text-center">
                We sent a verification link to{' '}
                <span className="font-medium text-slate-900">
                  {user?.email || 'your inbox'}
                </span>
                . Click the link to activate your account.
              </p>

              {message && (
                <div
                  className={`flex items-start gap-2 text-sm rounded-lg p-3 mb-4 ${
                    resentAt
                      ? 'text-emerald-800 bg-emerald-50 border border-emerald-200'
                      : 'text-amber-800 bg-amber-50 border border-amber-200'
                  }`}
                >
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>{message}</span>
                </div>
              )}

              <button
                onClick={handleResend}
                disabled={resending || !user}
                className="w-full px-4 py-2.5 rounded-lg bg-[#0EA5A0] text-white text-sm font-medium hover:bg-[#0d938e] disabled:opacity-50 mb-3"
              >
                {resending ? 'Sending…' : 'Resend verification email'}
              </button>

              <p className="text-xs text-slate-400 text-center">
                Wrong email? <Link to="/logout" className="text-[#0EA5A0] hover:underline">Sign out</Link>{' '}
                and sign up again with the correct address.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VerifyEmailPage;
