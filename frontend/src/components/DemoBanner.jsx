/**
 * DemoBanner — shown at the top of the authenticated layout when the user's
 * organization is an active 14-day demo (Prompt 9).
 *
 * Rendering rules:
 *   - user.is_demo === true AND user.demo_status === 'active'
 *   - Subtle info-level styling (teal), NOT a warning. The goal is to remind
 *     the user they're on a trial without nagging them.
 *
 * Days-remaining math: we floor on the UTC day boundary so "13 days left"
 * doesn't flicker to "12" for an hour in between. If the expiry is today or
 * already past (edge case before the backend transitions the org to
 * expired), we show "0 days" rather than a negative number.
 *
 * This component is platform-only and is stripped from the customer
 * distribution by scripts/build-distribution.sh.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, ArrowRight } from 'lucide-react';

const daysRemaining = (isoExpiresAt) => {
  if (!isoExpiresAt) return null;
  const expires = new Date(isoExpiresAt);
  if (Number.isNaN(expires.valueOf())) return null;
  const now = new Date();
  const ms = expires.getTime() - now.getTime();
  if (ms <= 0) return 0;
  // Round UP to whole days so "23 hours left" reads as "1 day remaining"
  // rather than "0".
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
};

const DemoBanner = ({ user }) => {
  if (!user?.is_demo || user?.demo_status !== 'active') return null;
  const days = daysRemaining(user.demo_expires_at);
  if (days === null) return null;

  const label =
    days === 0
      ? 'Your demo expires today'
      : `Demo — ${days} day${days === 1 ? '' : 's'} remaining`;

  return (
    <div
      className="bg-teal-50 border-b border-teal-100 px-6 py-2"
      data-testid="demo-banner"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 max-w-6xl mx-auto">
        <p className="text-sm text-teal-900 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[#0EA5A0]" aria-hidden />
          <span>{label}</span>
        </p>
        <Link
          to="/pricing"
          className="inline-flex items-center gap-1 text-sm font-medium text-[#0EA5A0] hover:text-teal-700"
          data-testid="demo-banner-cta"
        >
          Get TAKO
          <ArrowRight className="w-3.5 h-3.5" aria-hidden />
        </Link>
      </div>
    </div>
  );
};

export default DemoBanner;
