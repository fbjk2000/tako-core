import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth, API } from '../App';
import { useT } from '../useT';
import axios from 'axios';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Switch } from '../components/ui/switch';
import { Input } from '../components/ui/input';
import {
  Check,
  X,
  ChevronDown,
  ChevronUp,
  Info,
  Zap,
  Shield,
  Users,
  Sparkles,
} from 'lucide-react';

// ─── Pricing constants (mirrors SUBSCRIPTION_PLANS in backend) ───────────────
const PRICES = {
  tako_pro_monthly:  { gbp: 25, eur: 29, usd: 29 },
  tako_pro_annual:   { gbp: 22, eur: 25, usd: 25 },   // per month
  tako_ent_monthly:  { gbp: 45, eur: 49, usd: 55 },
  tako_ent_annual:   { gbp: 39, eur: 45, usd: 49 },   // per month
};
const ANNUAL_TOTAL = {
  tako_pro_annual:   { gbp: 264, eur: 300, usd: 300 },
  tako_ent_annual:   { gbp: 468, eur: 540, usd: 588 },
};
const CURRENCY_SYMBOL = { gbp: '£', eur: '€', usd: '$' };

function detectCurrency() {
  const saved = localStorage.getItem('tako_currency');
  if (saved && ['gbp', 'eur', 'usd'].includes(saved)) return saved;
  const lang = (navigator.language || '').toLowerCase();
  if (lang.startsWith('en-gb')) return 'gbp';
  if (/^(de|fr|it|es|nl|pt|pl|sv|fi|da|nb|el|cs|sk|hu|ro)/.test(lang)) return 'eur';
  return 'usd';
}

// ─── Comparison table data ────────────────────────────────────────────────────
const COMPARISON_ROWS = [
  { label: 'Users',               solo: '1',                    pro: 'Unlimited',          ent: 'Unlimited' },
  { label: 'Pipelines',           solo: '1',                    pro: 'Unlimited',          ent: 'Unlimited' },
  { label: 'Contacts',            solo: '500',                  pro: '10,000',             ent: 'Unlimited' },
  { label: 'AI agents',           solo: 'All 8',                pro: 'All 8',              ent: 'All 8' },
  { label: 'AI tokens/month',     solo: '250 (5,000 trial)',    pro: '5,000/user',         ent: 'Unlimited' },
  { label: 'Token top-ups',       solo: false,                  pro: '£5/1,000',           ent: 'Not needed' },
  { label: 'Call recording',      solo: false,                  pro: true,                 ent: true },
  { label: 'Email sequences',     solo: false,                  pro: true,                 ent: true },
  { label: 'Booking links',       solo: true,                   pro: true,                 ent: true },
  { label: 'Team projects',       solo: false,                  pro: true,                 ent: true },
  { label: 'Reporting',           solo: 'Basic',                pro: 'Full',               ent: 'Full + custom' },
  { label: 'EU data hosting',     solo: true,                   pro: true,                 ent: true },
  { label: 'SSO / SAML',          solo: false,                  pro: false,                ent: true },
  { label: 'Priority support',    solo: false,                  pro: false,                ent: '✓ (4hr SLA)' },
  { label: 'API access',          solo: false,                  pro: 'Standard',           ent: 'Elevated' },
  { label: 'Audit logs',          solo: false,                  pro: false,                ent: true },
  { label: 'Dedicated onboarding',solo: false,                  pro: false,                ent: true },
];

function CellValue({ value }) {
  if (value === true)  return <Check className="w-4 h-4 text-[#0EA5A0] mx-auto" />;
  if (value === false) return <span className="text-slate-300 text-lg leading-none">—</span>;
  return <span className="text-slate-700 text-sm">{value}</span>;
}

// ─── Main component ────────────────────────────────────────────────────────────
const CHECKOUT_INTENT_KEY = 'tako_checkout_intent';

const PricingPage = () => {
  const { user, token } = useAuth();
  const { t } = useT();
  const location = useLocation();
  const navigate = useNavigate();

  const [billing, setBilling]               = useState('annual');
  const [currency, setCurrency]             = useState(detectCurrency);
  const [couponCode, setCouponCode]         = useState('');
  const [appliedCoupon, setAppliedCoupon]   = useState(null);
  const [couponError, setCouponError]       = useState(null);
  const [couponLoading, setCouponLoading]   = useState(false);
  const [showComparison, setShowComparison] = useState(false);
  const [couponOpen, setCouponOpen]         = useState({ pro: false, ent: false });
  const [countdown, setCountdown]           = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  // Launch Edition countdown — expires 2026-06-30 23:59 BST
  useEffect(() => {
    const end = new Date('2026-06-30T22:59:59Z').getTime();
    const tick = () => {
      const diff = Math.max(0, end - Date.now());
      setCountdown({
        days:    Math.floor(diff / 86400000),
        hours:   Math.floor((diff / 3600000) % 24),
        minutes: Math.floor((diff / 60000) % 60),
        seconds: Math.floor((diff / 1000) % 60),
      });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const padT = (n) => String(n).padStart(2, '0');

  // Persist currency choice
  useEffect(() => {
    localStorage.setItem('tako_currency', currency);
  }, [currency]);

  // Read ?code= param on mount → auto-populate & validate for Pro
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const code = params.get('code');
    if (code) {
      setCouponCode(code.toUpperCase());
      const planId = billing === 'annual' ? 'tako_pro_annual' : 'tako_pro_monthly';
      validateCoupon(code, planId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const validateCoupon = async (code, planId) => {
    setCouponLoading(true);
    setCouponError(null);
    try {
      const res = await axios.post(`${API}/validate-coupon`, {
        code: code.toUpperCase(),
        plan_id: planId,
        currency,
      });
      setAppliedCoupon(res.data);
    } catch (err) {
      setCouponError(err?.response?.data?.detail || 'Code not recognised');
      setAppliedCoupon(null);
    } finally {
      setCouponLoading(false);
    }
  };

  // Derived plan IDs
  const proPlanId = billing === 'annual' ? 'tako_pro_annual' : 'tako_pro_monthly';
  const entPlanId = billing === 'annual' ? 'tako_ent_annual' : 'tako_ent_monthly';

  const proPrice  = PRICES[proPlanId][currency];
  const entPrice  = PRICES[entPlanId][currency];
  const sym       = CURRENCY_SYMBOL[currency];

  /**
   * POST to /api/subscriptions/checkout and redirect to the returned Stripe URL.
   * opts: { currency?: string, couponCode?: string }
   *   currency   — override currency (used when restoring from stored intent)
   *   couponCode — TAKO discount code to apply (sent as discount_code in body)
   */
  const initiateCheckout = async (planId, opts = {}) => {
    setCheckoutLoading(true);
    const effectiveCurrency = opts.currency || currency;

    // Prefer an explicit coupon from opts (intent restore), otherwise use validated state
    const effectiveCoupon = opts.couponCode ||
      (appliedCoupon && appliedCoupon.plan_id === planId ? couponCode : null);

    const payload = {
      plan_id: planId,
      origin_url: window.location.origin,
      currency: effectiveCurrency,
      user_count: 1,
    };
    const normalizedCoupon = (effectiveCoupon || '').trim().toUpperCase();
    if (normalizedCoupon) payload.discount_code = normalizedCoupon;

    const config = { withCredentials: true };
    if (token) config.headers = { Authorization: `Bearer ${token}` };

    try {
      const res = await axios.post(`${API}/subscriptions/checkout`, payload, config);
      // Backend returns { checkout_url, session_id, ... }
      window.location.href = res.data.checkout_url;
      // No setCheckoutLoading(false) here — page navigates away on success
    } catch (err) {
      const msg = err?.response?.data?.detail || 'Could not start checkout. Please try again.';
      toast.error(msg);
      setCheckoutLoading(false);
    }
  };

  // If the user just authenticated and we have a stored intent, trigger checkout.
  useEffect(() => {
    if (!user) return;
    const raw = localStorage.getItem(CHECKOUT_INTENT_KEY);
    if (!raw) return;
    try {
      const intent = JSON.parse(raw);
      localStorage.removeItem(CHECKOUT_INTENT_KEY);
      if (intent.billing) setBilling(intent.billing);
      if (intent.currency) { setCurrency(intent.currency); localStorage.setItem('tako_currency', intent.currency); }
      // couponCode is now forwarded via POST body — no longer a GET-only limitation
      initiateCheckout(intent.planId, {
        currency: intent.currency,
        couponCode: intent.couponCode || null,
      });
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleCheckout = (planId) => {
    if (!user) {
      // Persist intent so it can be restored after the auth flow.
      // couponCode is now included: sent as POST body `discount_code` after auth.
      localStorage.setItem(CHECKOUT_INTENT_KEY, JSON.stringify({
        planId,
        billing,
        currency,
        couponCode: appliedCoupon && appliedCoupon.plan_id === planId ? couponCode : '',
      }));
      navigate('/signup');
      return;
    }
    initiateCheckout(planId);
  };

  return (
    <div className="min-h-screen bg-slate-50">

      {/* ── Page header ── */}
      <header className="py-4 px-6 border-b border-slate-100 bg-white">
        <Link to="/" className="text-sm text-slate-500 hover:text-slate-800 transition-colors">
          ← Back to home
        </Link>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-16">

        {/* ── Section heading ── */}
        <div className="text-center mb-10">
          <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight mb-3">
            One price. Every agent included.
          </h1>
          <p className="text-lg text-slate-500 max-w-xl mx-auto">
            No seat surprises. No AI credits to top up. No US data transfers.
          </p>
        </div>

        {/* ── Billing toggle ── */}
        <div className="flex items-center justify-center gap-3 mb-6" role="group" aria-label="Billing period">
          <button
            type="button"
            aria-pressed={billing === 'monthly'}
            onClick={() => setBilling('monthly')}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0EA5A0] ${
              billing === 'monthly'
                ? 'bg-slate-900 text-white'
                : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-400'
            }`}
          >
            Monthly
          </button>
          <button
            type="button"
            aria-pressed={billing === 'annual'}
            onClick={() => setBilling('annual')}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors flex items-center gap-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0EA5A0] ${
              billing === 'annual'
                ? 'bg-slate-900 text-white'
                : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-400'
            }`}
          >
            Annual
            {billing === 'annual' && (
              <span className="bg-[#0EA5A0] text-white text-xs px-2 py-0.5 rounded-full font-semibold">
                Save up to 15%
              </span>
            )}
          </button>
          {billing === 'annual' && (
            <span className="text-xs text-slate-400 italic">Save up to 15% vs monthly</span>
          )}
        </div>

        {/* ── Currency toggle ── */}
        <div className="flex items-center justify-center gap-2 mb-12" role="group" aria-label="Currency">
          {(['gbp', 'eur', 'usd']).map((c) => (
            <button
              type="button"
              key={c}
              aria-pressed={currency === c}
              aria-label={`${c.toUpperCase()} — ${c === 'gbp' ? 'British Pound' : c === 'eur' ? 'Euro' : 'US Dollar'}`}
              onClick={() => { setCurrency(c); setAppliedCoupon(null); setCouponError(null); }}
              className={`w-9 h-9 rounded-full text-sm font-semibold border transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0EA5A0] ${
                currency === c
                  ? 'bg-[#0EA5A0] text-white border-[#0EA5A0]'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-[#0EA5A0]'
              }`}
            >
              {CURRENCY_SYMBOL[c]}
            </button>
          ))}
        </div>

        {/* ── VAT notice ── */}
        <p className="text-center text-xs text-slate-400 mb-8 -mt-6">
          All prices exclude VAT where applicable. VAT is calculated at checkout based on your billing country.
        </p>

        {/* ── Three pricing cards ── */}
        <div className="grid md:grid-cols-3 gap-6 items-start">

          {/* Solo */}
          <Card className="border-slate-200 bg-white">
            <CardHeader className="pb-4">
              <CardTitle className="text-xl font-bold text-slate-900">Solo</CardTitle>
              <div className="mt-2">
                <span className="text-3xl font-extrabold text-slate-900">{sym}0</span>
                <span className="text-slate-500 text-sm ml-1">forever</span>
              </div>
              <CardDescription className="mt-2 text-slate-600">
                One user. One pipeline. All 8 AI agents for 30 days.
              </CardDescription>
              <p className="text-xs text-slate-400 mt-1">
                Then 250 AI tokens/mo — enough to keep exploring.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <Link to="/signup">
                <Button variant="outline" className="w-full border-slate-300 hover:border-[#0EA5A0] hover:text-[#0EA5A0]">
                  Start free
                </Button>
              </Link>
              <ul className="space-y-2 pt-2">
                {[
                  '1 user',
                  '1 pipeline',
                  '500 contacts',
                  'All 8 AI agents (30-day trial)',
                  'EU data hosting',
                  'Booking links',
                ].map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-slate-600">
                    <Check className="w-4 h-4 text-[#0EA5A0] flex-shrink-0 mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {/* Pro — elevated */}
          <Card className="border-slate-200 bg-white ring-2 ring-[#0EA5A0] shadow-lg scale-[1.03] relative">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <span className="bg-[#0F0A1E] text-white text-xs font-semibold px-3 py-1 rounded-full inline-flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> Most popular
              </span>
            </div>
            <CardHeader className="pb-4 pt-6">
              <CardTitle className="text-xl font-bold text-slate-900">Pro</CardTitle>
              <div className="mt-2">
                {appliedCoupon && appliedCoupon.plan_id === proPlanId ? (
                  <div className="space-y-0.5">
                    <div>
                      <span className="text-xl text-slate-400 line-through mr-2">
                        {sym}{proPrice}
                      </span>
                      <span className="text-3xl font-extrabold text-[#0EA5A0]">
                        {sym}{appliedCoupon.discounted_price}
                      </span>
                      <span className="text-slate-500 text-sm ml-1">/user/mo</span>
                    </div>
                    <p className="text-xs text-emerald-600 font-medium">{appliedCoupon.discount_label}</p>
                  </div>
                ) : (
                  <>
                    <span className="text-3xl font-extrabold text-slate-900">{sym}{proPrice}</span>
                    <span className="text-slate-500 text-sm ml-1">/user/mo</span>
                  </>
                )}
                {billing === 'annual' && (
                  <p className="text-xs text-slate-400 mt-1">
                    billed as {sym}{ANNUAL_TOTAL.tako_pro_annual[currency]}/year
                  </p>
                )}
              </div>
              <CardDescription className="mt-2 text-slate-600">
                Your full sales team. 5,000 AI tokens per rep, per month.
              </CardDescription>
              <p className="text-xs text-slate-400 mt-1">
                Unlimited pipelines. EU-hosted. Everything you need to close.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button
                className="w-full bg-[#0EA5A0] hover:bg-teal-700 text-white"
                onClick={() => handleCheckout(proPlanId)}
                disabled={checkoutLoading}
                aria-label="Subscribe to Pro plan"
              >
                {checkoutLoading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />
                    Redirecting…
                  </span>
                ) : 'Start with Pro'}
              </Button>

              {/* Trust microcopy */}
              <p className="text-center text-xs text-slate-400 !mt-1.5">
                Secure checkout via Stripe · Cancel anytime · <a href="mailto:support@tako.software" className="hover:text-slate-600 underline underline-offset-2">support@tako.software</a>
              </p>

              {/* Coupon toggle */}
              <button
                type="button"
                className="text-xs text-[#0EA5A0] hover:underline w-full text-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0EA5A0] rounded"
                onClick={() => setCouponOpen((prev) => ({ ...prev, pro: !prev.pro }))}
                aria-expanded={couponOpen.pro}
              >
                {couponOpen.pro ? 'Hide code field' : 'Have a code?'}
              </button>

              {couponOpen.pro && (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Input
                      value={couponCode}
                      onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                      placeholder="FOUNDER40"
                      className="flex-1 h-9 text-sm uppercase"
                      aria-label="Discount code"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-9 px-3 border-[#0EA5A0] text-[#0EA5A0] hover:bg-teal-50"
                      disabled={couponLoading || !couponCode.trim()}
                      onClick={() => validateCoupon(couponCode, proPlanId)}
                    >
                      {couponLoading ? '...' : 'Apply'}
                    </Button>
                  </div>
                  {couponError && (
                    <p className="text-red-500 text-xs">{couponError}</p>
                  )}
                  {appliedCoupon && appliedCoupon.plan_id === proPlanId && (
                    <p className="text-emerald-600 text-xs font-medium">
                      ✓ {appliedCoupon.code} — {appliedCoupon.discount_label}
                      {appliedCoupon.duration_label ? ` · ${appliedCoupon.duration_label}` : ''}
                    </p>
                  )}
                </div>
              )}

              <ul className="space-y-2 pt-2">
                {[
                  'Unlimited users',
                  'Unlimited pipelines',
                  '10,000 contacts',
                  'All 8 AI agents',
                  '5,000 tokens/user/mo',
                  'Call recording',
                  'Email sequences',
                  'Booking links',
                  'Team projects',
                  'Full reporting',
                  'EU data hosting',
                ].map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-slate-600">
                    <Check className="w-4 h-4 text-[#0EA5A0] flex-shrink-0 mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {/* Enterprise */}
          <Card className="border-slate-200 bg-white">
            <CardHeader className="pb-4">
              <CardTitle className="text-xl font-bold text-slate-900">Enterprise</CardTitle>
              <div className="mt-2">
                {appliedCoupon && appliedCoupon.plan_id === entPlanId ? (
                  <div className="space-y-0.5">
                    <div>
                      <span className="text-xl text-slate-400 line-through mr-2">
                        {sym}{entPrice}
                      </span>
                      <span className="text-3xl font-extrabold text-[#0EA5A0]">
                        {sym}{appliedCoupon.discounted_price}
                      </span>
                      <span className="text-slate-500 text-sm ml-1">/user/mo</span>
                    </div>
                    <p className="text-xs text-emerald-600 font-medium">{appliedCoupon.discount_label}</p>
                  </div>
                ) : (
                  <>
                    <span className="text-3xl font-extrabold text-slate-900">{sym}{entPrice}</span>
                    <span className="text-slate-500 text-sm ml-1">/user/mo</span>
                  </>
                )}
                {billing === 'annual' && (
                  <p className="text-xs text-slate-400 mt-1">
                    billed as {sym}{ANNUAL_TOTAL.tako_ent_annual[currency]}/year
                  </p>
                )}
              </div>
              <CardDescription className="mt-2 text-slate-600">
                Unlimited AI. SSO. SLAs. A team that knows your name.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Link to="/support?tab=contact">
                <Button variant="outline" className="w-full border-slate-300 hover:border-[#0EA5A0] hover:text-[#0EA5A0]">
                  Talk to sales
                </Button>
              </Link>

              {/* Coupon toggle */}
              <button
                type="button"
                className="text-xs text-[#0EA5A0] hover:underline w-full text-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0EA5A0] rounded"
                onClick={() => setCouponOpen((prev) => ({ ...prev, ent: !prev.ent }))}
                aria-expanded={couponOpen.ent}
              >
                {couponOpen.ent ? 'Hide code field' : 'Have a code?'}
              </button>

              {couponOpen.ent && (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Input
                      value={couponCode}
                      onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                      placeholder="FOUNDER40"
                      className="flex-1 h-9 text-sm uppercase"
                      aria-label="Discount code"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-9 px-3 border-[#0EA5A0] text-[#0EA5A0] hover:bg-teal-50"
                      disabled={couponLoading || !couponCode.trim()}
                      onClick={() => validateCoupon(couponCode, entPlanId)}
                    >
                      {couponLoading ? '...' : 'Apply'}
                    </Button>
                  </div>
                  {couponError && (
                    <p className="text-red-500 text-xs">{couponError}</p>
                  )}
                  {appliedCoupon && appliedCoupon.plan_id === entPlanId && (
                    <p className="text-emerald-600 text-xs font-medium">
                      ✓ {appliedCoupon.code} — {appliedCoupon.discount_label}
                      {appliedCoupon.duration_label ? ` · ${appliedCoupon.duration_label}` : ''}
                    </p>
                  )}
                </div>
              )}

              <ul className="space-y-2 pt-2">
                {[
                  'Everything in Pro',
                  'Unlimited contacts',
                  'Unlimited AI tokens',
                  'SSO / SAML',
                  'Advanced permissions',
                  'Priority support (4hr SLA)',
                  'Custom integrations',
                  'Dedicated onboarding',
                  'API rate limit uplift',
                  'Audit logs',
                  'Custom data retention',
                ].map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-slate-600">
                    <Check className="w-4 h-4 text-[#0EA5A0] flex-shrink-0 mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>

        {/* ── Social proof ── */}
        <p className="text-center text-sm text-slate-400 italic mt-10">
          "TAKO Pro for a 5-person team costs less per month than one Salesforce seat."
        </p>

        {/* ── Collapsible comparison table ── */}
        <div className="mt-12">
          <button
            type="button"
            aria-expanded={showComparison}
            aria-controls="plan-comparison-table"
            onClick={() => setShowComparison((v) => !v)}
            className="flex items-center gap-2 mx-auto text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0EA5A0] rounded"
          >
            Compare all plans
            {showComparison ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {showComparison && (
            <div id="plan-comparison-table" className="mt-6 overflow-x-auto rounded-xl border border-slate-200 bg-white">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left px-4 py-3 text-slate-500 font-medium w-1/2">Feature</th>
                    <th className="text-center px-4 py-3 text-slate-700 font-semibold">Solo</th>
                    <th className="text-center px-4 py-3 text-[#0EA5A0] font-semibold">Pro</th>
                    <th className="text-center px-4 py-3 text-slate-700 font-semibold">Enterprise</th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARISON_ROWS.map((row, i) => (
                    <tr key={row.label} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}>
                      <td className="px-4 py-3 text-slate-600">{row.label}</td>
                      <td className="px-4 py-3 text-center"><CellValue value={row.solo} /></td>
                      <td className="px-4 py-3 text-center"><CellValue value={row.pro} /></td>
                      <td className="px-4 py-3 text-center"><CellValue value={row.ent} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Pricing FAQ ── */}
        <div className="mt-16 max-w-3xl mx-auto">
          <h2 className="text-xl font-bold text-slate-900 mb-5 text-center">Common questions</h2>
          <div className="space-y-2">
            {[
              {
                q: 'Is VAT included in the prices shown?',
                a: 'No. All prices shown exclude VAT. VAT is calculated at checkout based on your billing country and displayed before you confirm payment.',
              },
              {
                q: 'How does annual billing work?',
                a: 'Annual plans are billed as a single payment covering 12 months — you pay upfront and save up to 15% versus monthly. Your access continues until the end of the paid period.',
              },
              {
                q: 'Can I cancel at any time?',
                a: 'Yes. Cancel from Settings at any time. Your access continues until the end of the current billing period with no cancellation fees.',
              },
              {
                q: 'Is there a money-back guarantee?',
                a: 'We offer a 30-day money-back guarantee on your first purchase. Email support@tako.software within 30 days of your first payment.',
              },
              {
                q: 'Where is my data stored?',
                a: 'Primary hosting is on EU-based servers. TAKO is GDPR-compliant. Where subprocessors operate outside the EU, appropriate safeguards (Standard Contractual Clauses or equivalent) are in place.',
              },
              {
                q: 'What does Enterprise onboarding include?',
                a: 'Dedicated onboarding with the TAKO team, priority support with a 4-hour SLA, assistance with custom integrations, and ongoing account management.',
              },
            ].map(({ q, a }) => (
              <details key={q} className="group bg-white border border-slate-200 rounded-xl cursor-pointer open:border-[#0EA5A0]/40">
                <summary className="flex items-center justify-between px-5 py-4 text-sm font-medium text-slate-900 list-none select-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0EA5A0] rounded-xl">
                  {q}
                  <ChevronDown className="w-4 h-4 text-slate-400 transition-transform duration-200 group-open:rotate-180 shrink-0 ml-3" />
                </summary>
                <p className="px-5 pb-4 text-sm text-slate-600 leading-relaxed">{a}</p>
              </details>
            ))}
          </div>
        </div>

        {/* ─────────────────────────────────────────────────────────────────────
            LAUNCH EDITION
            Early-access offer for TAKO's founding cohort.
            Keep this section — it is referenced in launch campaign links.
        ───────────────────────────────────────────────────────────────────── */}
        <section id="launch-edition" className="mt-20 rounded-2xl bg-[#0F0A1E] text-white px-6 sm:px-10 py-12 relative overflow-hidden">
          {/* Background glow */}
          <div className="absolute inset-0 bg-gradient-to-br from-[#0EA5A0]/20 to-transparent pointer-events-none" />

          <div className="relative z-10 grid md:grid-cols-[1.5fr_1fr] gap-8 max-w-4xl mx-auto">
            {/* Left — copy */}
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-5">
                <div className="inline-flex items-center gap-1.5 bg-white/[0.08] rounded-full px-3 py-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#D4A853]" />
                  <span className="text-xs font-bold tracking-wider uppercase text-white/90">Limited time offer</span>
                </div>
                <div className="inline-flex items-center bg-[#D4A853] text-[#0f172a] text-xs font-extrabold tracking-wider uppercase px-3 py-1.5 rounded-full">
                  75% OFF
                </div>
              </div>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mb-1">
                Launch Edition
              </h2>
              <div className="flex items-baseline gap-3 mb-4">
                <span className="text-2xl font-bold text-white">EUR 4,999</span>
                <span className="text-slate-400 line-through">EUR 19,999</span>
                <span className="text-slate-400 text-sm">one-time</span>
              </div>
              <p className="text-slate-300 text-sm leading-relaxed mb-2">
                Get the full TAKO platform with <strong className="text-white">unlimited users</strong>, deployed on <strong className="text-white">your own infrastructure</strong>. One payment. Yours forever.
              </p>
              <p className="text-slate-400 text-sm mb-5">
                Or lock in <strong className="text-white">40% off Pro</strong> for life — use code{' '}
                <code className="bg-white/10 px-1.5 py-0.5 rounded font-mono text-white text-xs">FOUNDER40</code> at checkout.
              </p>
              <div className="flex flex-wrap gap-2 mb-6">
                {['Full source code', 'Unlimited users', 'Self-hosted', 'One-time payment', 'Production-tested'].map(h => (
                  <span key={h} className="inline-flex items-center px-3 py-1.5 rounded-full bg-white/[0.07] text-white/80 text-xs font-semibold border border-white/[0.06]">{h}</span>
                ))}
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <Link to="/support?tab=contact">
                  <Button className="bg-white text-[#0f172a] hover:bg-white/90 font-bold px-6 h-11">
                    Book a Setup Call
                  </Button>
                </Link>
                <button
                  type="button"
                  className="text-slate-400 hover:text-white text-sm underline underline-offset-2 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white rounded"
                  onClick={() => {
                    setCouponCode('FOUNDER40');
                    setCouponOpen({ pro: true, ent: false });
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                >
                  Apply FOUNDER40 to Pro instead
                </button>
              </div>
            </div>

            {/* Right — countdown */}
            <div className="flex flex-col justify-center">
              <p className="text-white/60 text-xs font-bold tracking-wider uppercase text-center mb-3">Offer expires in</p>
              <div className="grid grid-cols-4 gap-2 mb-3">
                {[['days', countdown.days], ['hrs', countdown.hours], ['min', countdown.minutes], ['sec', countdown.seconds]].map(([label, val]) => (
                  <div key={label} className="bg-white/[0.07] border border-white/[0.08] rounded-2xl p-3 text-center backdrop-blur-sm">
                    <span className="block text-white text-2xl font-extrabold tracking-tight">{padT(val)}</span>
                    <small className="block text-white/60 text-[0.68rem] font-bold tracking-wider uppercase mt-1">{label}</small>
                  </div>
                ))}
              </div>
              <p className="text-white/50 text-xs text-center">Ends June 30, 2026 at 23:59 BST</p>
            </div>
          </div>
        </section>

        {/* Trust strip */}
        <div className="mt-12 flex flex-wrap justify-center gap-6 text-sm text-slate-400">
          <span className="flex items-center gap-1.5">
            <Shield className="w-4 h-4 text-emerald-400" /> EU-hosted · GDPR compliant
          </span>
          <span className="flex items-center gap-1.5">
            <Check className="w-4 h-4 text-emerald-400" /> 30-day money-back guarantee
          </span>
          <span className="flex items-center gap-1.5">
            <Check className="w-4 h-4 text-emerald-400" /> Cancel anytime
          </span>
          <span className="flex items-center gap-1.5">
            <Users className="w-4 h-4 text-emerald-400" /> Secure payment via Stripe
          </span>
        </div>

      </main>
    </div>
  );
};

export default PricingPage;
