import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth, API } from '../App';
import { useT } from '../useT';
import axios from 'axios';
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
const PricingPage = () => {
  const { user, token } = useAuth();
  const { t } = useT();
  const location = useLocation();

  const [billing, setBilling]               = useState('annual');
  const [currency, setCurrency]             = useState(detectCurrency);
  const [couponCode, setCouponCode]         = useState('');
  const [appliedCoupon, setAppliedCoupon]   = useState(null);
  const [couponError, setCouponError]       = useState(null);
  const [couponLoading, setCouponLoading]   = useState(false);
  const [showComparison, setShowComparison] = useState(false);
  const [couponOpen, setCouponOpen]         = useState({ pro: false, ent: false });

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

  const handleCheckout = (planId) => {
    if (!user) {
      window.location.href = '/signup';
      return;
    }
    // Stripe checkout — redirect to backend session
    window.location.href = `${API}/subscriptions/checkout?plan_id=${planId}&origin_url=${encodeURIComponent(window.location.origin)}`;
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
        <div className="flex items-center justify-center gap-3 mb-6">
          <button
            onClick={() => setBilling('monthly')}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              billing === 'monthly'
                ? 'bg-slate-900 text-white'
                : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-400'
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setBilling('annual')}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors flex items-center gap-2 ${
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
        <div className="flex items-center justify-center gap-2 mb-12">
          {(['gbp', 'eur', 'usd']).map((c) => (
            <button
              key={c}
              onClick={() => { setCurrency(c); setAppliedCoupon(null); setCouponError(null); }}
              className={`w-9 h-9 rounded-full text-sm font-semibold border transition-colors ${
                currency === c
                  ? 'bg-[#0EA5A0] text-white border-[#0EA5A0]'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-[#0EA5A0]'
              }`}
            >
              {CURRENCY_SYMBOL[c]}
            </button>
          ))}
        </div>

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
              >
                Start with Pro
              </Button>

              {/* Coupon toggle */}
              <button
                className="text-xs text-[#0EA5A0] hover:underline w-full text-center"
                onClick={() => setCouponOpen((prev) => ({ ...prev, pro: !prev.pro }))}
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
              <a href="mailto:sales@tako.software">
                <Button variant="outline" className="w-full border-slate-300 hover:border-[#0EA5A0] hover:text-[#0EA5A0]">
                  Talk to sales
                </Button>
              </a>

              {/* Coupon toggle */}
              <button
                className="text-xs text-[#0EA5A0] hover:underline w-full text-center"
                onClick={() => setCouponOpen((prev) => ({ ...prev, ent: !prev.ent }))}
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
            onClick={() => setShowComparison((v) => !v)}
            className="flex items-center gap-2 mx-auto text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
          >
            Compare all plans
            {showComparison ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {showComparison && (
            <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200 bg-white">
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

        {/* ─────────────────────────────────────────────────────────────────────
            LAUNCH EDITION
            Early-access offer for TAKO's founding cohort.
            Keep this section — it is referenced in launch campaign links.
        ───────────────────────────────────────────────────────────────────── */}
        <section id="launch-edition" className="mt-20 rounded-2xl bg-[#0F0A1E] text-white px-6 sm:px-10 py-12 relative overflow-hidden">
          {/* Background glow */}
          <div className="absolute inset-0 bg-gradient-to-br from-[#0EA5A0]/20 to-transparent pointer-events-none" />

          <div className="relative z-10 max-w-3xl mx-auto text-center">
            <div className="flex flex-wrap items-center justify-center gap-2 mb-4">
              <div className="inline-flex items-center gap-2 bg-[#0EA5A0]/20 text-[#0EA5A0] text-xs font-semibold px-3 py-1 rounded-full">
                <Zap className="w-3 h-3" /> Limited availability
              </div>
              <div className="inline-flex items-center bg-[#D4A853] text-[#0f172a] text-xs font-extrabold tracking-wider uppercase px-3 py-1 rounded-full">
                75% OFF
              </div>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold mb-2">
              Launch Edition — Self-Hosted
            </h2>
            <div className="flex items-baseline justify-center gap-3 mb-3">
              <span className="text-3xl font-extrabold text-white">EUR 4,999</span>
              <span className="text-slate-400 line-through text-lg">EUR 19,999</span>
              <span className="text-slate-400 text-base">one-time</span>
            </div>
            <p className="text-slate-300 mb-2">
              Get the full TAKO platform with <strong className="text-white">unlimited users</strong>, deployed on <strong className="text-white">your own hosting</strong>.
              One payment. No subscriptions. Yours forever.
            </p>
            <p className="text-slate-400 text-sm mb-2">
              Or lock in <strong className="text-white">40% off Pro</strong> for life — use code{' '}
              <code className="bg-white/10 px-2 py-0.5 rounded font-mono text-white">FOUNDER40</code> at checkout.
            </p>
            <p className="text-slate-500 text-xs mb-8">Offer expires June 30, 2026</p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <a href="/#launch-edition">
                <Button className="bg-[#D4A853] hover:bg-[#c49a48] text-[#0f172a] font-bold px-8 h-11">
                  Get Launch Edition — EUR 4,999
                </Button>
              </a>
              <button
                className="text-slate-400 hover:text-white text-sm underline underline-offset-2 transition-colors"
                onClick={() => {
                  setCouponCode('FOUNDER40');
                  setCouponOpen({ pro: true, ent: false });
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
              >
                Apply FOUNDER40 to Pro instead
              </button>
            </div>

            <div className="mt-8 grid grid-cols-4 divide-x divide-white/10 border border-white/10 rounded-xl overflow-hidden">
              {[
                { label: 'Discount', value: '75% off' },
                { label: 'Payment', value: 'One-time' },
                { label: 'Users', value: 'Unlimited' },
                { label: 'Slots left', value: '< 50' },
              ].map((item) => (
                <div key={item.label} className="px-4 py-4 text-center">
                  <p className="text-[#D4A853] font-bold text-lg">{item.value}</p>
                  <p className="text-slate-400 text-xs mt-0.5">{item.label}</p>
                </div>
              ))}
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
