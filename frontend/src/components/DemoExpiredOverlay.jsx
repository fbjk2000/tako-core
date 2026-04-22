/**
 * DemoExpiredOverlay — non-dismissable soft-lock shown over the dashboard
 * once the user's 14-day demo has expired (Prompt 9).
 *
 * Rules:
 *   - user.demo_status === 'expired' and the current pathname ISN'T on the
 *     nav allow-list (/pricing, /support, /settings, /legal/*, /download).
 *     The allow-list mirrors the backend write-block middleware so the user
 *     can navigate to pay, contact support, or manage their account even
 *     while locked out of day-to-day CRM work.
 *   - No close button, no click-outside dismiss. The primary CTA is "Get
 *     TAKO" → /pricing; secondary is "Talk to us" → /support.
 *   - Data stays visible behind a translucent backdrop — prospects see what
 *     they'll lose access to if they don't convert, and confirm their data
 *     is still there.
 *
 * This component is platform-only (stripped from the customer distribution).
 */
import React from 'react';
import { useLocation, Link } from 'react-router-dom';
import { Lock } from 'lucide-react';

// Paths the overlay should NOT cover. Keep in sync with the backend
// write-block middleware's _DEMO_WRITE_ALLOWED_PREFIXES — these are the
// pages the locked-out user still needs to reach.
const ALLOW_LIST_PREFIXES = [
  '/pricing',
  '/support',
  '/settings',
  '/legal',
  '/download',
  '/checkout',
];

const DemoExpiredOverlay = ({ user }) => {
  const location = useLocation();
  if (user?.demo_status !== 'expired') return null;

  const path = location.pathname || '';
  if (ALLOW_LIST_PREFIXES.some((prefix) => path.startsWith(prefix))) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="demo-expired-heading"
      data-testid="demo-expired-overlay"
    >
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl border border-slate-200 p-6 md:p-8">
        <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 rounded-full bg-teal-50">
          <Lock className="w-6 h-6 text-[#0EA5A0]" aria-hidden />
        </div>
        <h2
          id="demo-expired-heading"
          className="text-xl md:text-2xl font-semibold text-slate-900 text-center"
        >
          Your 14-day demo has ended
        </h2>
        <p className="text-sm md:text-base text-slate-600 text-center mt-3 leading-relaxed">
          Your data is safe. Purchase TAKO to pick up right where you left off.
        </p>
        <p className="text-sm text-slate-500 text-center mt-2 leading-relaxed">
          Everything you've set up — contacts, deals, campaigns — will be
          waiting for you.
        </p>

        <div className="mt-6 space-y-2">
          <Link
            to="/pricing"
            className="block w-full text-center px-4 py-2.5 rounded-lg bg-[#0EA5A0] hover:bg-teal-700 text-white font-medium transition-colors"
            data-testid="demo-expired-pricing-cta"
          >
            Get TAKO
          </Link>
          <Link
            to="/support"
            className="block w-full text-center px-4 py-2.5 rounded-lg text-[#0EA5A0] hover:bg-teal-50 font-medium transition-colors"
            data-testid="demo-expired-support-link"
          >
            Talk to us
          </Link>
        </div>
      </div>
    </div>
  );
};

export default DemoExpiredOverlay;
