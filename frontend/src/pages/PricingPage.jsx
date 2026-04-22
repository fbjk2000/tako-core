import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth, API } from '../App';
import axios from 'axios';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import {
  Check,
  ChevronDown,
  Shield,
  Sparkles,
  Wallet,
  ExternalLink,
} from 'lucide-react';

// ─── Three payment structures for the same self-hosted product ──────────────
const PLANS = [
  {
    id: 'tako_selfhost_once',
    label: 'Pay Once',
    badge: 'Best Value',
    headline: '€5,000',
    subHeadline: 'one-time',
    subtitle: 'Save €2,200 vs. 24-month plan',
    cta: 'Buy Now',
    elevated: false,
  },
  {
    id: 'tako_selfhost_12mo',
    label: '12 Monthly Payments',
    badge: 'Most Popular',
    headline: '12 × €500',
    subHeadline: 'per month',
    subtitle: '€6,000 total · Own it from day one',
    cta: 'Start Plan',
    elevated: true,
  },
  {
    id: 'tako_selfhost_24mo',
    label: '24 Monthly Payments',
    badge: null,
    headline: '24 × €300',
    subHeadline: 'per month',
    subtitle: '€7,200 total · Lowest monthly commitment',
    cta: 'Start Plan',
    elevated: false,
  },
];

// All three plans deliver the same product; features list once, not per card.
const INCLUDED_FEATURES = [
  'Full source code access',
  'Unlimited users — no per-seat fees, ever',
  'CRM + Pipeline Management',
  'AI Lead Scoring (1–100)',
  'AI Email Drafting',
  'Outbound Calling with AI Transcription',
  'Calendar & Booking (Calendly alternative)',
  'Prospect Intelligence',
  'Analytics & Reporting',
  'Team Projects',
  '12 months maintenance & support included',
  '30-day money-back guarantee',
];

const FAQS = [
  {
    q: 'What exactly do I own?',
    a: 'You get full source code access. Install TAKO on your own server — any Linux VPS, Docker, Kubernetes, or traditional VM. The software is yours. No kill switches, no phone-home license checks, no vendor lock-in.',
  },
  {
    q: 'Are there any per-user fees?',
    a: 'No. Every payment option includes unlimited users. Whether your team is 3 people or 300, the price is the same.',
  },
  {
    q: 'What\u2019s the difference between the three payment options?',
    a: 'Nothing feature-wise — all three give you the exact same product. The one-time payment saves you €2,200 compared to the 24-month plan. The installment options spread the cost but you own the software from day one.',
  },
  {
    q: 'What happens if I stop paying the installment?',
    a: 'You keep the version you have. It continues to run on your server. You won\u2019t receive further updates or support until the plan is completed.',
  },
  {
    q: 'Is there a free trial?',
    a: 'We offer a free sandbox demo with sample data so you can explore TAKO before buying. Plus a 30-day money-back guarantee on all purchases — no questions asked.',
  },
  {
    q: 'What happens after the first year?',
    a: 'You can optionally renew maintenance and support for €999/year. This gets you all new features, major updates, and priority support. If you don\u2019t renew, your TAKO instance keeps running and you still get critical security patches.',
  },
  {
    q: 'Where can I host TAKO?',
    a: 'Anywhere you want. Your own servers, any EU cloud provider, AWS, Hetzner, DigitalOcean — you have the source code and Docker setup. We recommend EU-based hosting for GDPR compliance.',
  },
  {
    q: 'Is VAT included?',
    a: 'No. All prices exclude VAT. VAT is calculated at checkout based on your billing country.',
  },
];

const CHECKOUT_INTENT_KEY = 'tako_checkout_intent';
const ARBITRUM_CHAIN_ID_HEX = '0xa4b1'; // 42161

// ── Partner referral attribution ────────────────────────────────────────────
// Capture ?ref=CODE on first visit, persist in localStorage for 90 days, and
// pass through to backend checkout. Buyer never sees the ref — no discount,
// no acknowledgement. Commission is paid from TAKO's margin.
const REF_STORAGE_KEY = 'tako_ref';
const REF_EXPIRY_DAYS = 90;

const readStoredRef = () => {
  try {
    const raw = localStorage.getItem(REF_STORAGE_KEY);
    if (!raw) return null;
    const { code, expiresAt } = JSON.parse(raw);
    if (!code || !expiresAt) return null;
    if (new Date(expiresAt).getTime() < Date.now()) {
      localStorage.removeItem(REF_STORAGE_KEY);
      return null;
    }
    return String(code).toUpperCase();
  } catch {
    return null;
  }
};

const writeStoredRef = (code) => {
  if (!code) return;
  const expiresAt = new Date(Date.now() + REF_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString();
  try {
    localStorage.setItem(
      REF_STORAGE_KEY,
      JSON.stringify({ code: String(code).toUpperCase(), expiresAt })
    );
  } catch {
    // Storage may be unavailable (private browsing, etc.) — silently skip.
  }
};

// Minimal ERC-20 transfer ABI fragment (no full ethers import needed)
const ERC20_TRANSFER_ABI = [
  {
    name: 'transfer',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
];

const PricingPage = () => {
  const { user, token } = useAuth();
  const navigate = useNavigate();

  const [checkoutLoading, setCheckoutLoading] = useState(null); // holds plan_id when busy
  const [unytLoading, setUnytLoading]         = useState(false);

  // Capture ?ref=CODE on first mount — persists silently for 90 days.
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const incoming = params.get('ref');
      if (incoming && incoming.trim()) {
        writeStoredRef(incoming.trim());
      }
    } catch {
      // ignore — URL parsing failure is non-fatal
    }
  }, []);

  // ── Stripe checkout ────────────────────────────────────────────────────────
  const initiateCheckout = async (planId) => {
    setCheckoutLoading(planId);
    const payload = {
      plan_id:    planId,
      origin_url: window.location.origin,
      currency:   'eur',
      user_count: 1,
    };
    const storedRef = readStoredRef();
    if (storedRef) payload.referral_code = storedRef;

    const config = { withCredentials: true };
    if (token) config.headers = { Authorization: `Bearer ${token}` };

    try {
      const res = await axios.post(`${API}/subscriptions/checkout`, payload, config);
      window.location.href = res.data.checkout_url;
    } catch (err) {
      const msg = err?.response?.data?.detail || 'Could not start checkout. Please try again.';
      toast.error(msg);
      setCheckoutLoading(null);
    }
  };

  // Restore an intent captured before signup
  useEffect(() => {
    if (!user) return;
    const raw = localStorage.getItem(CHECKOUT_INTENT_KEY);
    if (!raw) return;
    try {
      const intent = JSON.parse(raw);
      localStorage.removeItem(CHECKOUT_INTENT_KEY);
      if (intent.planId) initiateCheckout(intent.planId);
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleCheckout = (planId) => {
    if (!user) {
      localStorage.setItem(CHECKOUT_INTENT_KEY, JSON.stringify({ planId }));
      navigate('/signup');
      return;
    }
    initiateCheckout(planId);
  };

  // ── MetaMask / UNYT on Arbitrum ───────────────────────────────────────────
  // Lazily loads ethers so the crypto code path doesn't hit cold-start users.
  const payWithMetaMask = async () => {
    if (typeof window === 'undefined' || !window.ethereum) {
      toast.error('MetaMask is not installed. Please install MetaMask to pay with UNYT.');
      return;
    }
    setUnytLoading(true);
    try {
      // 1. Request wallet connection
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      const wallet   = accounts?.[0];
      if (!wallet) throw new Error('No wallet returned');

      // 2. Ensure Arbitrum One
      try {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: ARBITRUM_CHAIN_ID_HEX }],
        });
      } catch (switchErr) {
        if (switchErr?.code === 4902) {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: ARBITRUM_CHAIN_ID_HEX,
              chainName: 'Arbitrum One',
              rpcUrls: ['https://arb1.arbitrum.io/rpc'],
              nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
              blockExplorerUrls: ['https://arbiscan.io'],
            }],
          });
        } else {
          throw switchErr;
        }
      }

      // 3. Create the UNYT payment order on the backend (gets amount & receiver)
      const storedRef = readStoredRef();
      const orderRes = await axios.post(`${API}/checkout/launch-edition/unyt`, {
        plan_id: 'tako_selfhost_once',
        name:    user?.name || '',
        email:   user?.email || '',
        wallet,
        ...(storedRef ? { referral_code: storedRef } : {}),
      });
      const { deal_id, unyt_amount_wei, receiver, contract } = orderRes.data;

      // 4. Build an ERC-20 transfer transaction via ethers
      const { ethers } = await import('ethers');
      const provider   = new ethers.providers.Web3Provider(window.ethereum);
      const signer     = provider.getSigner();
      const unyt       = new ethers.Contract(contract, ERC20_TRANSFER_ABI, signer);

      const tx = await unyt.transfer(receiver, unyt_amount_wei);
      toast.success('UNYT transaction submitted. Confirming on-chain…');

      // 5. Report the tx hash back — backend will mark deal submitted & queue delivery
      await axios.post(
        `${API}/checkout/launch-edition/unyt/confirm?deal_id=${encodeURIComponent(deal_id)}&tx_hash=${encodeURIComponent(tx.hash)}`
      );
      toast.success('Payment submitted. We\u2019ll be in touch shortly to deliver your source code.');
    } catch (err) {
      const msg = err?.response?.data?.detail || err?.message || 'MetaMask payment failed.';
      toast.error(msg);
    } finally {
      setUnytLoading(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50">
      {/* ── Page header ── */}
      <header className="py-4 px-6 border-b border-slate-100 bg-white">
        <Link to="/" className="text-sm text-slate-500 hover:text-slate-800 transition-colors">
          ← Back to home
        </Link>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-16">
        {/* ── Hero ── */}
        <div className="text-center mb-10">
          <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight mb-3">
            One product. One price. Unlimited users.
          </h1>
          <p className="text-lg text-slate-500 max-w-2xl mx-auto">
            Full source code. Deploy on your own server. Your data never leaves your infrastructure.
          </p>
        </div>

        {/* ── VAT notice ── */}
        <p className="text-center text-xs text-slate-400 mb-8">
          All prices in EUR, excluding VAT. VAT is calculated at checkout based on your billing country.
        </p>

        {/* ── Three payment-option cards ── */}
        <div className="grid md:grid-cols-3 gap-6 items-start">
          {PLANS.map((plan) => (
            <Card
              key={plan.id}
              className={
                plan.elevated
                  ? 'border-slate-200 bg-white ring-2 ring-[#0EA5A0] shadow-lg md:scale-[1.03] relative'
                  : 'border-slate-200 bg-white relative'
              }
            >
              {plan.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className={
                    plan.elevated
                      ? 'bg-[#0F0A1E] text-white text-xs font-semibold px-3 py-1 rounded-full inline-flex items-center gap-1'
                      : 'bg-[#0EA5A0] text-white text-xs font-semibold px-3 py-1 rounded-full inline-flex items-center gap-1'
                  }>
                    {plan.elevated && <Sparkles className="w-3 h-3" />}
                    {plan.badge}
                  </span>
                </div>
              )}
              <CardHeader className="pb-4 pt-6">
                <CardTitle className="text-lg font-bold text-slate-900">{plan.label}</CardTitle>
                <div className="mt-3">
                  <span className="text-3xl font-extrabold text-slate-900">{plan.headline}</span>
                  <span className="text-slate-500 text-sm ml-2">{plan.subHeadline}</span>
                </div>
                <CardDescription className="mt-2 text-slate-600">
                  {plan.subtitle}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button
                  className={
                    plan.elevated
                      ? 'w-full bg-[#0EA5A0] hover:bg-teal-700 text-white'
                      : 'w-full bg-slate-900 hover:bg-slate-800 text-white'
                  }
                  onClick={() => handleCheckout(plan.id)}
                  disabled={checkoutLoading === plan.id}
                  aria-label={`${plan.cta} for ${plan.label}`}
                >
                  {checkoutLoading === plan.id ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />
                      Redirecting…
                    </span>
                  ) : plan.cta}
                </Button>
                <p className="text-center text-xs text-slate-400">
                  Secure checkout via Stripe
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* ── UNYT alternative payment ─────────────────────────────────────── */}
        <div className="mt-10 max-w-2xl mx-auto rounded-xl border border-slate-200 bg-white px-5 py-4">
          <p className="text-sm text-slate-600 mb-3 text-center">
            You can also pay with UNYT tokens via MetaMask or UNYT.shop.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              variant="outline"
              className="flex-1 border-slate-300 hover:border-[#0EA5A0] hover:text-[#0EA5A0]"
              onClick={payWithMetaMask}
              disabled={unytLoading}
              aria-label="Pay with MetaMask using UNYT on Arbitrum"
            >
              {unytLoading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin inline-block" />
                  Connecting wallet…
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Wallet className="w-4 h-4" />
                  Pay with MetaMask
                </span>
              )}
            </Button>
            <a
              href="https://unyt.shop"
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1"
            >
              <Button
                variant="outline"
                className="w-full border-slate-300 hover:border-[#0EA5A0] hover:text-[#0EA5A0]"
              >
                <span className="flex items-center gap-2">
                  Pay via UNYT.shop
                  <ExternalLink className="w-3.5 h-3.5" />
                </span>
              </Button>
            </a>
          </div>
        </div>

        {/* ── What's included ── */}
        <div className="mt-16 max-w-3xl mx-auto">
          <h2 className="text-xl font-bold text-slate-900 mb-5 text-center">{'What\u2019s included'}</h2>
          <ul className="grid sm:grid-cols-2 gap-x-8 gap-y-3 bg-white border border-slate-200 rounded-xl px-6 py-6">
            {INCLUDED_FEATURES.map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm text-slate-700">
                <Check className="w-4 h-4 text-[#0EA5A0] flex-shrink-0 mt-0.5" />
                {f}
              </li>
            ))}
          </ul>
        </div>

        {/* ── After year one ── */}
        <div className="mt-12 max-w-3xl mx-auto">
          <div className="rounded-xl border border-slate-200 bg-white px-6 py-6">
            <h3 className="text-base font-bold text-slate-900 mb-2">Maintenance & Support Renewal</h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Your first year of updates and priority support is included. After that, optionally
              renew for <strong>€999/year</strong> to keep receiving new features, major updates,
              and priority support with a 4-hour SLA. If you choose not to renew, your software
              keeps running — you just {'won\u2019t'} receive new features. Critical security patches
              remain free.
            </p>
          </div>
        </div>

        {/* ── FAQ ── */}
        <div className="mt-16 max-w-3xl mx-auto">
          <h2 className="text-xl font-bold text-slate-900 mb-5 text-center">Common questions</h2>
          <div className="space-y-2">
            {FAQS.map(({ q, a }) => (
              <details
                key={q}
                className="group bg-white border border-slate-200 rounded-xl cursor-pointer open:border-[#0EA5A0]/40"
              >
                <summary className="flex items-center justify-between px-5 py-4 text-sm font-medium text-slate-900 list-none select-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0EA5A0] rounded-xl">
                  {q}
                  <ChevronDown className="w-4 h-4 text-slate-400 transition-transform duration-200 group-open:rotate-180 shrink-0 ml-3" />
                </summary>
                <p className="px-5 pb-4 text-sm text-slate-600 leading-relaxed">{a}</p>
              </details>
            ))}
          </div>
        </div>

        {/* ── Trust strip ── */}
        <div className="mt-12 flex flex-wrap justify-center gap-6 text-sm text-slate-400">
          <span className="flex items-center gap-1.5">
            <Shield className="w-4 h-4 text-emerald-400" /> EU-hosted · GDPR compliant
          </span>
          <span className="flex items-center gap-1.5">
            <Check className="w-4 h-4 text-emerald-400" /> 30-day money-back guarantee
          </span>
          <span className="flex items-center gap-1.5">
            <Check className="w-4 h-4 text-emerald-400" /> Secure payment via Stripe
          </span>
          <span className="flex items-center gap-1.5">
            <Wallet className="w-4 h-4 text-emerald-400" /> UNYT accepted
          </span>
        </div>
      </main>
    </div>
  );
};

export default PricingPage;
