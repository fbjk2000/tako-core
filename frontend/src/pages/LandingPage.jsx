import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { toast } from 'sonner';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

const LaunchEdition = () => {
  const [time, setTime] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', email: '' });
  const [loading, setLoading] = useState(false);
  const [payMethod, setPayMethod] = useState('stripe');
  const [unytStatus, setUnytStatus] = useState('');

  useEffect(() => {
    const end = new Date("2026-06-30T22:59:59Z").getTime();
    const update = () => {
      const diff = Math.max(0, end - Date.now());
      setTime({
        days: Math.floor(diff / 86400000),
        hours: Math.floor((diff / 3600000) % 24),
        minutes: Math.floor((diff / 60000) % 60),
        seconds: Math.floor((diff / 1000) % 60)
      });
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);

  const pad = (n) => String(n).padStart(2, '0');

  const handleCheckout = async () => {
    if (!form.email) { toast.error('Please enter your email'); return; }
    setLoading(true);
    
    if (payMethod === 'unyt') {
      try {
        if (!window.ethereum) { toast.error('Please install MetaMask or another Web3 wallet'); setLoading(false); return; }
        
        const { ethers } = await import('ethers');
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        await provider.send('eth_requestAccounts', []);
        
        // Switch to Arbitrum
        try {
          await provider.send('wallet_switchEthereumChain', [{ chainId: '0xa4b1' }]);
        } catch (switchErr) {
          if (switchErr.code === 4902) {
            await provider.send('wallet_addEthereumChain', [{
              chainId: '0xa4b1', chainName: 'Arbitrum One',
              nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
              rpcUrls: ['https://arb1.arbitrum.io/rpc'], blockExplorerUrls: ['https://arbiscan.io']
            }]);
          }
        }
        
        const signer = provider.getSigner();
        const wallet = await signer.getAddress();
        
        // Create order
        const orderRes = await axios.post(`${API}/checkout/launch-edition/unyt`, { name: form.name, email: form.email, wallet });
        const order = orderRes.data;
        
        setUnytStatus(`Sending ${order.unyt_amount.toLocaleString()} UNYT...`);
        
        // Send ERC-20 transfer
        const erc20Abi = ['function transfer(address to, uint256 amount) returns (bool)'];
        const contract = new ethers.Contract(order.contract, erc20Abi, signer);
        const tx = await contract.transfer(order.receiver, order.unyt_amount_wei);
        
        setUnytStatus('Transaction sent. Waiting for confirmation...');
        await tx.wait();
        
        // Confirm with backend
        await axios.post(`${API}/checkout/launch-edition/unyt/confirm?deal_id=${order.deal_id}&tx_hash=${tx.hash}`);
        toast.success('Payment confirmed! We will be in touch about your Launch Edition setup.');
        setUnytStatus('');
        setShowForm(false);
      } catch (err) {
        console.error(err);
        toast.error(err.reason || err.message || 'Transaction failed');
        setUnytStatus('');
      }
      setLoading(false);
      return;
    }
    
    // Stripe checkout
    try {
      const res = await axios.post(`${API}/checkout/launch-edition`, {
        origin_url: window.location.origin, name: form.name, email: form.email
      });
      window.location.href = res.data.checkout_url;
    } catch (e) { toast.error(e.response?.data?.detail || 'Checkout failed'); setLoading(false); }
  };

  return (
    <section className="py-16 px-6">
      <div className="max-w-5xl mx-auto">
        <div className="rounded-3xl overflow-hidden" style={{ background: 'radial-gradient(circle at top right, rgba(99,102,241,0.12), transparent 28%), linear-gradient(180deg, #0f172a 0%, #111827 100%)', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 20px 50px rgba(2,6,23,0.22)' }}>
          <div className="grid md:grid-cols-[1.5fr_0.95fr] gap-8 p-8 md:p-10">
            {/* Left */}
            <div>
              <div className="inline-flex items-center gap-2 bg-white/[0.08] rounded-full px-3 py-1.5 mb-6">
                <span className="w-1.5 h-1.5 rounded-full bg-[#D4A853]" />
                <span className="text-xs font-bold tracking-wider uppercase text-white/90">Limited time offer</span>
              </div>
              <h3 className="text-4xl md:text-5xl font-extrabold text-white tracking-tight mb-1" style={{ fontFamily: "'Syne'" }}>Launch Edition</h3>
              <p className="text-white text-xl font-bold mb-4">EUR 4,999 <span className="text-white/70 font-medium text-base ml-1">one-time</span></p>
              <p className="text-white/90 text-base leading-relaxed mb-3">
                Get the existing earnrm app with <strong>unlimited users</strong> and deploy it on <strong>your own hosting</strong>.
              </p>
              <p className="text-white/70 text-sm leading-relaxed mb-5">
                Save 2 to 3 months of setup and iteration, reduce unnecessary AI credit spend, and launch faster with a proven CRM foundation shaped by real implementation experience.
              </p>
              <div className="flex flex-wrap gap-2">
                {['Unlimited users', 'Self-hosted', 'One-time payment', 'Proven CRM foundation'].map(h => (
                  <span key={h} className="inline-flex items-center px-3 py-2 rounded-full bg-white/[0.07] text-white/90 text-sm font-semibold border border-white/[0.06]">{h}</span>
                ))}
              </div>
            </div>
            {/* Right */}
            <div className="flex flex-col justify-center">
              <p className="text-white/70 text-xs font-bold tracking-wider uppercase text-center mb-3">Offer expires in</p>
              <div className="grid grid-cols-4 gap-2 mb-3">
                {[['days', time.days], ['hours', time.hours], ['minutes', time.minutes], ['seconds', time.seconds]].map(([label, val]) => (
                  <div key={label} className="bg-white/[0.07] border border-white/[0.08] rounded-2xl p-3 text-center backdrop-blur-sm">
                    <span className="block text-white text-2xl font-extrabold tracking-tight">{pad(val)}</span>
                    <small className="block text-white/60 text-[0.68rem] font-bold tracking-wider uppercase mt-1">{label}</small>
                  </div>
                ))}
              </div>
              <p className="text-white/70 text-sm text-center mb-4">Ends June 30, 2026 at 23:59 BST</p>
              {!showForm ? (
                <button onClick={() => setShowForm(true)} className="w-full min-h-[52px] rounded-xl bg-white text-[#0f172a] font-bold text-base py-3 hover:opacity-95 transition-opacity shadow-lg" data-testid="launch-edition-cta">
                  Book a Setup Call
                </button>
              ) : (
                <div className="space-y-2">
                  <Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Your name" className="bg-white/10 border-white/10 text-white placeholder:text-white/40" />
                  <Input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} placeholder="Your email" required className="bg-white/10 border-white/10 text-white placeholder:text-white/40" />
                  <div className="flex gap-2 pt-1">
                    <button onClick={() => setPayMethod('stripe')} className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${payMethod === 'stripe' ? 'bg-white text-[#0f172a]' : 'bg-white/10 text-white/70 hover:bg-white/15'}`}>Card / Bank</button>
                    <button onClick={() => setPayMethod('unyt')} className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${payMethod === 'unyt' ? 'bg-[#D4A853] text-[#0f172a]' : 'bg-white/10 text-white/70 hover:bg-white/15'}`}>Pay with UNYT</button>
                  </div>
                  {payMethod === 'unyt' && <p className="text-xs text-white/50 text-center">9,998 UNYT at EUR 0.50 per token via Arbitrum</p>}
                  {unytStatus && <p className="text-xs text-[#D4A853] text-center animate-pulse">{unytStatus}</p>}
                  <button onClick={handleCheckout} disabled={loading} className={`w-full min-h-[52px] rounded-xl font-bold text-base py-3 hover:opacity-95 transition-opacity shadow-lg disabled:opacity-50 ${payMethod === 'unyt' ? 'bg-[#D4A853] text-[#0f172a]' : 'bg-white text-[#0f172a]'}`} data-testid="launch-checkout-btn">
                    {loading ? 'Processing...' : payMethod === 'unyt' ? 'Connect Wallet and Pay' : 'Proceed to Checkout (EUR 4,999)'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

const LandingPage = () => {
  const { t, i18n } = useTranslation();
  const toggleLang = () => { const nl = i18n.language === 'en' ? 'de' : 'en'; i18n.changeLanguage(nl); localStorage.setItem('earnrm_lang', nl); };
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showLeadMagnet, setShowLeadMagnet] = useState(false);
  const [leadMagnetEmail, setLeadMagnetEmail] = useState('');
  const [leadMagnetName, setLeadMagnetName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [downloadReady, setDownloadReady] = useState(false);

  // Handle Launch Edition return from Stripe
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('launch') === 'success') {
      const sessionId = params.get('session_id');
      const dealId = params.get('deal_id');
      if (sessionId && dealId) {
        axios.get(`${API}/checkout/launch-edition/verify?session_id=${sessionId}&deal_id=${dealId}`)
          .then(res => {
            if (res.data.status === 'paid') toast.success('Payment confirmed! We will be in touch about your Launch Edition setup.');
            else toast.info('Payment is being processed. We will confirm shortly.');
          })
          .catch(() => toast.info('We received your order. Confirmation coming soon.'));
      }
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const handleLeadMagnetSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const response = await axios.post(`${API}/lead-magnet/subscribe`, { email: leadMagnetEmail, first_name: leadMagnetName, source: 'linkedin_guide' });
      if (response.data.success) { setDownloadReady(true); toast.success('Your guide is ready.'); }
    } catch { toast.error('Something went wrong.'); }
    finally { setSubmitting(false); }
  };

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = 'https://customer-assets.emergentagent.com/job_bf31783e-7e9c-47ad-b065-3e62a7895ee8/artifacts/7c9fmulw_EarnRM_LinkedIn_Lead_Generation_Playbook_Agency_Edition.pdf';
    a.download = 'EarnRM_LinkedIn_Lead_Generation_Playbook.pdf';
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast.success('Guide downloaded.');
    setShowLeadMagnet(false);
    setDownloadReady(false);
  };

  const features = [
    { title: t('landing.feat1Title'), desc: t('landing.feat1Desc'), accent: '#D4A853' },
    { title: t('landing.feat2Title'), desc: t('landing.feat2Desc'), accent: '#7C3AED' },
    { title: t('landing.feat3Title'), desc: t('landing.feat3Desc'), accent: '#3B0764' },
    { title: t('landing.feat4Title'), desc: t('landing.feat4Desc'), accent: '#D4A853' },
    { title: t('landing.feat5Title'), desc: t('landing.feat5Desc'), accent: '#7C3AED' },
    { title: t('landing.feat6Title'), desc: t('landing.feat6Desc'), accent: '#3B0764' },
  ];

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif" }} className="bg-[#FAFAF8] text-[#0F0A1E]">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#FAFAF8]/95 backdrop-blur-sm border-b border-[#0F0A1E]/5">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center">
            <img src="/logo-horizontal.svg" alt="earnrm" className="h-7" data-testid="nav-logo" />
          </Link>
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm text-[#0F0A1E]/60 hover:text-[#0F0A1E] transition-colors">{t('landing.footerFeatures')}</a>
            <a href="#product" className="text-sm text-[#0F0A1E]/60 hover:text-[#0F0A1E] transition-colors">{t('landing.footerProduct')}</a>
            <a href="#pricing" className="text-sm text-[#0F0A1E]/60 hover:text-[#0F0A1E] transition-colors">{t('landing.footerPricing')}</a>
            <Link to="/support" className="text-sm text-[#0F0A1E]/60 hover:text-[#0F0A1E] transition-colors">{t('common.support')}</Link>
          </div>
          <div className="hidden md:flex items-center gap-3">
            <button onClick={toggleLang} className="px-2 py-1 text-xs font-semibold rounded bg-[#0F0A1E]/5 hover:bg-[#0F0A1E]/10 text-[#0F0A1E]/60" data-testid="landing-lang-toggle">{i18n.language === 'en' ? 'DE' : 'EN'}</button>
            <Link to="/login"><Button variant="ghost" className="text-sm h-9 text-[#0F0A1E]/70 hover:text-[#0F0A1E]">{t('common.signIn')}</Button></Link>
            <Link to="/signup"><Button className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-sm h-9 px-5 rounded-lg" data-testid="nav-cta">{t('common.startFree')}</Button></Link>
          </div>
          <button className="md:hidden" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} data-testid="mobile-menu-btn">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth={2} d={mobileMenuOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} /></svg>
          </button>
        </div>
        {mobileMenuOpen && (
          <div className="md:hidden bg-[#FAFAF8] border-t border-[#0F0A1E]/5 p-4 space-y-3">
            <a href="#features" className="block text-sm py-2" onClick={() => setMobileMenuOpen(false)}>Features</a>
            <a href="#pricing" className="block text-sm py-2" onClick={() => setMobileMenuOpen(false)}>Pricing</a>
            <Link to="/login" className="block text-sm py-2" onClick={() => setMobileMenuOpen(false)}>Sign in</Link>
            <Link to="/signup"><Button className="w-full bg-[#7C3AED] text-white rounded-lg">Start free</Button></Link>
          </div>
        )}
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 bg-[#3B0764]/5 border border-[#3B0764]/10 rounded-full px-4 py-1.5 mb-8">
              <span className="w-1.5 h-1.5 rounded-full bg-[#D4A853]" />
              <span className="text-xs tracking-widest uppercase text-[#3B0764]/70 font-medium" style={{ fontFamily: "'DM Sans', sans-serif" }}>{t('landing.badge')}</span>
            </div>
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.05] mb-6" style={{ fontFamily: "'Syne', sans-serif" }} data-testid="hero-title">
              {t('landing.heroTitle1')}<br />
              <span className="text-[#7C3AED]">{t('landing.heroTitle2')}</span>
            </h1>
            <p className="text-lg md:text-xl text-[#0F0A1E]/60 leading-relaxed max-w-xl mb-10" data-testid="hero-description">
              {t('landing.heroDesc')}
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Link to="/signup">
                <Button className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white h-12 px-8 rounded-lg text-base font-medium" data-testid="hero-cta-primary">
                  {t('landing.startTrial')}
                </Button>
              </Link>
              <Button variant="outline" className="h-12 px-8 rounded-lg text-base border-[#0F0A1E]/15 text-[#0F0A1E]/70 hover:border-[#0F0A1E]/30" onClick={() => setShowLeadMagnet(true)} data-testid="hero-cta-guide">
                {t('landing.getPlaybook')}
              </Button>
            </div>
          </div>

          {/* Product Preview */}
          <div className="mt-16 bg-[#0F0A1E] rounded-2xl p-2 shadow-2xl shadow-[#3B0764]/10" id="product" data-testid="hero-image">
            <div className="bg-[#1a1230] rounded-xl p-6 md:p-8">
              <div className="grid grid-cols-4 gap-4 mb-6">
                {[{ label: 'Active Leads', value: '284', change: '+12%' }, { label: 'Pipeline Value', value: '428,500', change: '+8%', prefix: '\u20AC' }, { label: 'Win Rate', value: '34%', change: '+3pp' }, { label: 'Avg. Deal Size', value: '18,200', prefix: '\u20AC', change: '+5%' }].map((s, i) => (
                  <div key={i} className="bg-[#0F0A1E]/50 rounded-lg p-4 border border-white/5">
                    <p className="text-white/40 text-xs mb-1" style={{ fontFamily: "'DM Sans'" }}>{s.label}</p>
                    <p className="text-white text-xl font-semibold" style={{ fontFamily: "'Syne'" }}>{s.prefix || ''}{s.value}</p>
                    <span className="text-[#D4A853] text-xs font-medium">{s.change}</span>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-6 gap-3">
                {['Lead', 'Qualified', 'Proposal', 'Negotiation', 'Won'].map((stage, i) => (
                  <div key={i} className="bg-[#0F0A1E]/40 rounded-lg p-3 border border-white/5">
                    <p className="text-white/50 text-xs mb-2">{stage}</p>
                    {[1, 2].map(j => (
                      <div key={j} className="bg-white/5 rounded p-2 mb-2">
                        <div className="h-2 bg-white/20 rounded w-3/4 mb-1" />
                        <div className="h-1.5 bg-white/10 rounded w-1/2" />
                      </div>
                    ))}
                  </div>
                ))}
                <div className="bg-[#D4A853]/10 rounded-lg p-3 border border-[#D4A853]/20">
                  <p className="text-[#D4A853] text-xs mb-2 font-medium">Revenue</p>
                  <p className="text-[#D4A853] text-lg font-bold" style={{ fontFamily: "'Syne'" }}>{'€'}186k</p>
                  <p className="text-[#D4A853]/60 text-xs">this quarter</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trust Strip */}
      <section className="py-12 border-y border-[#0F0A1E]/5">
        <div className="max-w-5xl mx-auto px-6">
          <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-4 text-[#0F0A1E]/30 text-sm">
            <span>{t('landing.trustGdpr')}</span>
            <span className="w-px h-4 bg-[#0F0A1E]/10" />
            <span>{t('landing.trustEu')}</span>
            <span className="w-px h-4 bg-[#0F0A1E]/10" />
            <span>{t('landing.trustSoc')}</span>
            <span className="w-px h-4 bg-[#0F0A1E]/10" />
            <span>{t('landing.trustStripe')}</span>
            <span className="w-px h-4 bg-[#0F0A1E]/10" />
            <span>{t('landing.trustUptime')}</span>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24 px-6" id="features">
        <div className="max-w-5xl mx-auto">
          <div className="max-w-2xl mb-16">
            <p className="text-xs tracking-[0.2em] uppercase font-semibold text-[#7C3AED] mb-4">{t('landing.featuresTag')}</p>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4" style={{ fontFamily: "'Syne'" }}>
              Everything a sales team needs. Nothing it does not.
            </h2>
            <p className="text-[#0F0A1E]/60 text-lg">
              {t('landing.featuresDesc')}
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f, i) => (
              <div key={i} className="bg-white rounded-xl p-6 border border-[#0F0A1E]/5 hover:border-[#0F0A1E]/10 transition-colors" data-testid={`feature-${i}`}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-4" style={{ backgroundColor: f.accent + '15' }}>
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: f.accent }} />
                </div>
                <h3 className="text-base font-semibold mb-2" style={{ fontFamily: "'Syne'" }}>{f.title}</h3>
                <p className="text-sm text-[#0F0A1E]/60 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Social Proof */}
      <section className="py-24 px-6 bg-[#0F0A1E]">
        <div className="max-w-5xl mx-auto">
          <p className="text-xs tracking-[0.2em] uppercase font-semibold text-[#D4A853] mb-4">{t('landing.proofTag')}</p>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white mb-12" style={{ fontFamily: "'Syne'" }}>
            Built for teams that sell across Europe
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { quote: "We replaced three tools with earnrm. Pipeline visibility went from guesswork to real time.", name: "Marcus W.", role: "Head of Sales, SaaS (Berlin)" },
              { quote: "The AI scoring saves us hours every week. We only call leads that actually convert.", name: "Sophie L.", role: "Sales Director, Agency (Paris)" },
              { quote: "Finally a CRM that does not feel like it was built for a Fortune 500 IT department.", name: "James R.", role: "Founder, Consulting (London)" }
            ].map((t, i) => (
              <div key={i} className="bg-white/5 rounded-xl p-6 border border-white/5">
                <p className="text-white/80 text-sm leading-relaxed mb-6">"{t.quote}"</p>
                <div>
                  <p className="text-white text-sm font-medium">{t.name}</p>
                  <p className="text-white/40 text-xs">{t.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-24 px-6" id="pricing">
        <div className="max-w-5xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <p className="text-xs tracking-[0.2em] uppercase font-semibold text-[#7C3AED] mb-4">Pricing</p>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4" style={{ fontFamily: "'Syne'" }}>
              Simple, fair pricing
            </h2>
            <p className="text-[#0F0A1E]/60 text-lg">{t('landing.pricingDesc')}</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {[
              { plan: 'Free', price: '0', desc: 'For individuals getting started', features: ['Up to 3 users', '100 leads', 'Basic pipeline', 'Team chat'], cta: 'Start free', primary: false },
              { plan: 'Pro', price: '15', desc: 'For growing sales teams', features: ['Unlimited users', 'Unlimited leads', 'AI scoring and enrichment', 'Outbound calling', 'Calendar booking', 'Priority support'], cta: 'Start free trial', primary: true },
              { plan: 'Enterprise', price: 'Custom', desc: 'For organisations with complex needs', features: ['Everything in Pro', 'Custom integrations', 'Dedicated account manager', 'SSO and audit logs', 'SLA guarantee'], cta: 'Talk to sales', primary: false },
            ].map((p, i) => (
              <div key={i} className={`rounded-xl p-6 border ${p.primary ? 'bg-[#3B0764] border-[#3B0764] text-white' : 'bg-white border-[#0F0A1E]/5'}`} data-testid={`pricing-${p.plan.toLowerCase()}`}>
                <p className={`text-sm font-medium mb-1 ${p.primary ? 'text-[#D4A853]' : 'text-[#7C3AED]'}`}>{p.plan}</p>
                <div className="flex items-baseline gap-1 mb-2">
                  {p.price !== 'Custom' ? (
                    <>
                      <span className="text-4xl font-bold" style={{ fontFamily: "'Syne'" }}>{'\u20AC'}{p.price}</span>
                      <span className={`text-sm ${p.primary ? 'text-white/60' : 'text-[#0F0A1E]/40'}`}>/user/month</span>
                    </>
                  ) : (
                    <span className="text-4xl font-bold" style={{ fontFamily: "'Syne'" }}>Custom</span>
                  )}
                </div>
                <p className={`text-sm mb-6 ${p.primary ? 'text-white/60' : 'text-[#0F0A1E]/50'}`}>{p.desc}</p>
                <ul className="space-y-2.5 mb-6">
                  {p.features.map((f, j) => (
                    <li key={j} className={`text-sm flex items-start gap-2 ${p.primary ? 'text-white/80' : 'text-[#0F0A1E]/70'}`}>
                      <svg className={`w-4 h-4 mt-0.5 shrink-0 ${p.primary ? 'text-[#D4A853]' : 'text-[#7C3AED]'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                      {f}
                    </li>
                  ))}
                </ul>
                <Link to={p.plan === 'Enterprise' ? '/support?tab=contact' : '/signup'}>
                  <Button className={`w-full h-10 rounded-lg text-sm ${p.primary ? 'bg-[#D4A853] hover:bg-[#c49a48] text-[#0F0A1E] font-medium' : 'bg-[#0F0A1E]/5 hover:bg-[#0F0A1E]/10 text-[#0F0A1E]'}`}>
                    {p.cta}
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Launch Edition */}
      <LaunchEdition />

      {/* Final CTA */}
      <section className="py-24 px-6 bg-[#3B0764]">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white mb-4" style={{ fontFamily: "'Syne'" }}>
            Ready to sell smarter?
          </h2>
          <p className="text-white/60 text-lg mb-8 max-w-xl mx-auto">
            Join hundreds of European sales teams using earnrm to close more deals with less effort.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/signup">
              <Button className="bg-[#D4A853] hover:bg-[#c49a48] text-[#0F0A1E] h-12 px-8 rounded-lg text-base font-medium">
                Start free trial
              </Button>
            </Link>
            <Link to="/login">
              <Button variant="outline" className="h-12 px-8 rounded-lg text-base border-white/20 text-white hover:bg-white/5">
                Sign in
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 bg-[#0F0A1E]">
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div className="md:col-span-2">
              <img src="/logo-horizontal-reversed.svg" alt="earnrm" className="h-6 mb-4" />
              <p className="text-white/40 text-sm mb-4 max-w-xs">
                The CRM that runs your marketing and sales. Built for European teams that want results, not complexity.
              </p>
              <div className="text-xs text-white/30">
                <p className="font-medium text-white/40">Finerty Ltd.</p>
                <p>Canbury Works, Units 6 and 7, Canbury Business Park</p>
                <p>Kingston upon Thames, Surrey, KT2 6HJ, UK</p>
              </div>
            </div>
            <div>
              <h4 className="text-white/60 text-xs tracking-[0.15em] uppercase font-medium mb-4">Product</h4>
              <div className="space-y-2 text-sm">
                <a href="#features" className="block text-white/40 hover:text-white/70 transition-colors">Features</a>
                <a href="#pricing" className="block text-white/40 hover:text-white/70 transition-colors">Pricing</a>
                <Link to="/support" className="block text-white/40 hover:text-white/70 transition-colors">Support</Link>
                <button onClick={() => setShowLeadMagnet(true)} className="block text-white/40 hover:text-white/70 transition-colors text-left">Free Guide</button>
              </div>
            </div>
            <div>
              <h4 className="text-white/60 text-xs tracking-[0.15em] uppercase font-medium mb-4">Legal</h4>
              <div className="space-y-2 text-sm">
                <a href="#" className="block text-white/40 hover:text-white/70 transition-colors">Privacy Policy</a>
                <a href="#" className="block text-white/40 hover:text-white/70 transition-colors">Terms of Service</a>
                <a href="mailto:support@earnrm.com" className="block text-white/40 hover:text-white/70 transition-colors">support@earnrm.com</a>
              </div>
            </div>
          </div>
          <div className="border-t border-white/5 pt-6 text-center">
            <p className="text-white/30 text-xs">{new Date().getFullYear()} earnrm by Finerty Ltd. All rights reserved.</p>
          </div>
        </div>
      </footer>

      {/* Lead Magnet Dialog */}
      <Dialog open={showLeadMagnet} onOpenChange={setShowLeadMagnet}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "'Syne'" }}>Get the LinkedIn Lead Generation Playbook</DialogTitle>
          </DialogHeader>
          {downloadReady ? (
            <div className="text-center py-4">
              <p className="text-[#0F0A1E]/70 mb-4">Your guide is ready to download.</p>
              <Button onClick={handleDownload} className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white rounded-lg">Download PDF</Button>
            </div>
          ) : (
            <form onSubmit={handleLeadMagnetSubmit} className="space-y-4 pt-2">
              <div>
                <label className="text-sm text-[#0F0A1E]/60 mb-1 block">First name</label>
                <Input value={leadMagnetName} onChange={(e) => setLeadMagnetName(e.target.value)} required placeholder="Your name" />
              </div>
              <div>
                <label className="text-sm text-[#0F0A1E]/60 mb-1 block">Work email</label>
                <Input type="email" value={leadMagnetEmail} onChange={(e) => setLeadMagnetEmail(e.target.value)} required placeholder="you@company.com" />
              </div>
              <Button type="submit" disabled={submitting} className="w-full bg-[#7C3AED] hover:bg-[#6D28D9] text-white rounded-lg">
                {submitting ? 'Sending...' : 'Get the playbook'}
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LandingPage;
