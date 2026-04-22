import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { useAuth, API } from '../App';
import { useT } from '../useT';
import DashboardLayout from '../components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Badge } from '../components/ui/badge';
import { Copy, Download, ExternalLink, Handshake, Sparkles, Clock, CheckCircle } from 'lucide-react';

// Anonymize a customer email so partners can see which sale is which without
// leaking the full buyer identity. "floriankrueger@example.com" → "flo***@example.com".
const anonEmail = (email) => {
  if (!email || typeof email !== 'string') return '—';
  const [local, domain] = email.split('@');
  if (!local || !domain) return '—';
  return `${local.slice(0, 3)}***@${domain}`;
};

const fmtMoney = (n) =>
  `€${Number(n || 0).toLocaleString('en-IE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtDate = (iso) => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-IE', { year: 'numeric', month: 'short', day: '2-digit' });
  } catch {
    return '—';
  }
};

const PartnerDashboardPage = () => {
  const { t } = useT();
  const { user, token } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading]   = useState(true);
  const [partner, setPartner]   = useState(null);   // null when not enrolled
  const [recentSales, setRecentSales] = useState([]);
  const [submitting, setSubmitting]   = useState(false);

  // Agency application form state
  const [agencyForm, setAgencyForm] = useState({
    company_name: '',
    company_website: '',
    application_text: '',
    estimated_annual_referrals: '',
  });

  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};

  const fetchMe = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/partners/me`, { headers: authHeaders, withCredentials: true });
      if (res.data?.enrolled) {
        setPartner(res.data.partner);
        setRecentSales(res.data.recent_sales || []);
      } else {
        setPartner(null);
        setRecentSales([]);
      }
    } catch (err) {
      toast.error(t('partners.loadError') || 'Could not load partner profile');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (!user) {
      navigate('/login?redirect=/partners');
      return;
    }
    fetchMe();
  }, [user, fetchMe, navigate]);

  // ── Actions ────────────────────────────────────────────────────────────────
  const registerAsReferral = async () => {
    setSubmitting(true);
    try {
      await axios.post(`${API}/partners/register`, {}, { headers: authHeaders, withCredentials: true });
      toast.success(t('partners.registered') || 'You are now a referral partner.');
      await fetchMe();
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Registration failed');
    } finally {
      setSubmitting(false);
    }
  };

  const submitAgencyApplication = async (e) => {
    e.preventDefault();
    if (!agencyForm.company_name.trim() || !agencyForm.application_text.trim()) {
      toast.error(t('partners.agencyFormIncomplete') || 'Company name and description are required.');
      return;
    }
    setSubmitting(true);
    try {
      await axios.post(
        `${API}/partners/apply-agency`,
        {
          company_name: agencyForm.company_name.trim(),
          company_website: agencyForm.company_website.trim() || null,
          application_text: agencyForm.application_text.trim(),
          estimated_annual_referrals: agencyForm.estimated_annual_referrals
            ? parseInt(agencyForm.estimated_annual_referrals, 10)
            : null,
        },
        { headers: authHeaders, withCredentials: true }
      );
      toast.success(t('partners.agencySubmitted') || 'Agency application submitted for review.');
      await fetchMe();
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Application failed');
    } finally {
      setSubmitting(false);
    }
  };

  const copyLink = async () => {
    if (!partner?.referral_link) return;
    try {
      await navigator.clipboard.writeText(partner.referral_link);
      toast.success(t('partners.linkCopied') || 'Referral link copied');
    } catch {
      toast.error('Copy failed');
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <DashboardLayout>
        <div className="max-w-5xl mx-auto p-8 text-slate-500">{t('common.loading') || 'Loading…'}</div>
      </DashboardLayout>
    );
  }

  // ---- Not enrolled: show join panel with two paths ------------------------
  if (!partner) {
    return (
      <DashboardLayout>
        <div className="max-w-4xl mx-auto p-6 sm:p-8 space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{t('partners.joinTitle') || 'Join the TAKO Partner Programme'}</h1>
            <p className="text-slate-600 mt-2">
              {t('partners.joinSubtitle') || 'Earn €500 for every TAKO sale you refer. Pick the path that fits how you work.'}
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {/* Referral Partner */}
            <Card className="border-slate-200">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-[#0EA5A0]" />
                  <CardTitle className="text-lg">{t('partners.referralTitle') || 'Referral Partner'}</CardTitle>
                </div>
                <CardDescription>
                  {t('partners.referralDesc') || 'Open to anyone. Get your referral link and earn €500 per completed sale.'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <ul className="text-sm text-slate-700 space-y-2">
                  <li className="flex gap-2"><CheckCircle className="w-4 h-4 text-[#0EA5A0] mt-0.5" />{t('partners.bulletAuto') || 'Auto-approved — start immediately'}</li>
                  <li className="flex gap-2"><CheckCircle className="w-4 h-4 text-[#0EA5A0] mt-0.5" />{t('partners.bulletFlat') || '€500 flat commission per sale'}</li>
                  <li className="flex gap-2"><CheckCircle className="w-4 h-4 text-[#0EA5A0] mt-0.5" />{t('partners.bulletNoMin') || 'No minimum referrals required'}</li>
                </ul>
                <Button
                  className="w-full bg-[#0EA5A0] hover:bg-teal-700 text-white"
                  onClick={registerAsReferral}
                  disabled={submitting}
                >
                  {t('partners.becomeReferralCta') || 'Become a Referral Partner'}
                </Button>
              </CardContent>
            </Card>

            {/* Agency Partner */}
            <Card className="border-slate-200">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Handshake className="w-5 h-5 text-[#0F0A1E]" />
                  <CardTitle className="text-lg">{t('partners.agencyTitle') || 'Agency Partner'}</CardTitle>
                </div>
                <CardDescription>
                  {t('partners.agencyDesc') || 'For agencies, consultancies, and fractional sales leaders who deliver onboarding. Admin-approved.'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={submitAgencyApplication} className="space-y-3">
                  <div>
                    <Label htmlFor="company_name">{t('partners.companyName') || 'Company name'}</Label>
                    <Input
                      id="company_name"
                      value={agencyForm.company_name}
                      onChange={(e) => setAgencyForm({ ...agencyForm, company_name: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="company_website">{t('partners.website') || 'Website (optional)'}</Label>
                    <Input
                      id="company_website"
                      type="url"
                      placeholder="https://"
                      value={agencyForm.company_website}
                      onChange={(e) => setAgencyForm({ ...agencyForm, company_website: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="application_text">{t('partners.howRecommend') || 'How will you recommend TAKO?'}</Label>
                    <Textarea
                      id="application_text"
                      rows={3}
                      value={agencyForm.application_text}
                      onChange={(e) => setAgencyForm({ ...agencyForm, application_text: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="estimated_annual_referrals">
                      {t('partners.estimatedReferrals') || 'Estimated annual referrals (optional)'}
                    </Label>
                    <Input
                      id="estimated_annual_referrals"
                      type="number"
                      min={0}
                      value={agencyForm.estimated_annual_referrals}
                      onChange={(e) => setAgencyForm({ ...agencyForm, estimated_annual_referrals: e.target.value })}
                    />
                  </div>
                  <Button
                    type="submit"
                    className="w-full bg-[#0F0A1E] hover:bg-slate-800 text-white"
                    disabled={submitting}
                  >
                    {t('partners.applyAgencyCta') || 'Submit Agency Application'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>

          <p className="text-xs text-slate-500">
            {t('partners.noDiscountNote') || 'The buyer pays full price. Your commission comes from TAKO\u2019s margin — no customer discount applies.'}
          </p>
        </div>
      </DashboardLayout>
    );
  }

  // ---- Enrolled: dashboard -------------------------------------------------
  const isAgency = partner.partner_type === 'agency';
  const isPending = partner.status === 'pending_approval';
  const isSuspended = partner.status === 'suspended';

  const licenseSales = recentSales.filter((s) => s.sale_type === 'license');
  const onboardingSales = recentSales.filter((s) => s.sale_type === 'onboarding');

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto p-6 sm:p-8 space-y-6">
        {/* ── Header ── */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{t('partners.dashboardTitle') || 'Partner Dashboard'}</h1>
            <div className="flex items-center gap-2 mt-2">
              <Badge
                className={isAgency ? 'bg-[#0F0A1E] text-white' : 'bg-[#0EA5A0] text-white'}
              >
                {isAgency ? (t('partners.agencyTitle') || 'Agency Partner') : (t('partners.referralTitle') || 'Referral Partner')}
              </Badge>
              {isPending && (
                <Badge variant="outline" className="border-amber-400 text-amber-700">
                  <Clock className="w-3 h-3 mr-1" />
                  {t('partners.pendingApproval') || 'Pending approval'}
                </Badge>
              )}
              {isSuspended && (
                <Badge variant="outline" className="border-red-400 text-red-700">
                  {t('partners.suspended') || 'Suspended'}
                </Badge>
              )}
            </div>
          </div>
        </div>

        {isPending && (
          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="pt-6 text-sm text-amber-900">
              {t('partners.pendingNote') ||
                'Your agency partner application is under review. You can still earn referral commissions while you wait.'}
            </CardContent>
          </Card>
        )}

        {/* ── Referral link ── */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">
              {t('partners.yourLink') || 'Your referral link'}
            </CardTitle>
            <CardDescription>
              {t('partners.yourLinkDesc') || 'Share this link. You earn €500 for every TAKO sale that closes through it.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2 items-center">
              <Input
                value={partner.referral_link || ''}
                readOnly
                className="font-mono text-sm"
              />
              <Button onClick={copyLink} variant="outline" size="sm">
                <Copy className="w-4 h-4 mr-1" />
                {t('partners.copy') || 'Copy'}
              </Button>
            </div>
            <p className="text-xs text-slate-500">
              {t('partners.codeLabel') || 'Referral code'}: <code className="font-mono">{partner.referral_code}</code>
            </p>
          </CardContent>
        </Card>

        {/* ── Stats ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <p className="text-2xl font-bold text-slate-900">{partner.total_referrals || 0}</p>
              <p className="text-xs text-slate-500 mt-1">{t('partners.totalReferrals') || 'Total referrals'}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-2xl font-bold text-emerald-600">{fmtMoney(partner.total_earned)}</p>
              <p className="text-xs text-slate-500 mt-1">{t('partners.totalEarned') || 'Total earned'}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-2xl font-bold text-amber-600">{fmtMoney(partner.pending_balance)}</p>
              <p className="text-xs text-slate-500 mt-1">{t('partners.pendingBalance') || 'Pending payout'}</p>
            </CardContent>
          </Card>
        </div>

        {/* ── Recent referral sales ── */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">
              {t('partners.recentSales') || 'Referral sales'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {licenseSales.length === 0 ? (
              <p className="text-sm text-slate-500">
                {t('partners.noSalesYet') || 'No referral sales yet. Share your link to get started.'}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs text-slate-500 uppercase border-b border-slate-200">
                    <tr>
                      <th className="py-2 pr-4">{t('partners.date') || 'Date'}</th>
                      <th className="py-2 pr-4">{t('partners.customer') || 'Customer'}</th>
                      <th className="py-2 pr-4">{t('partners.method') || 'Method'}</th>
                      <th className="py-2 pr-4">{t('partners.status') || 'Status'}</th>
                      <th className="py-2 pr-4 text-right">{t('partners.commission') || 'Commission'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {licenseSales.map((s) => (
                      <tr key={s.sale_id} className="border-b border-slate-100">
                        <td className="py-3 pr-4 text-slate-600">{fmtDate(s.created_at)}</td>
                        <td className="py-3 pr-4 text-slate-800">{anonEmail(s.customer_email)}</td>
                        <td className="py-3 pr-4 text-slate-600 uppercase text-xs">{s.payment_method}</td>
                        <td className="py-3 pr-4">
                          <Badge variant="outline" className={
                            s.status === 'paid'
                              ? 'border-emerald-400 text-emerald-700'
                              : 'border-amber-400 text-amber-700'
                          }>
                            {s.status}
                          </Badge>
                        </td>
                        <td className="py-3 pr-4 text-right font-medium text-slate-900">
                          {fmtMoney(s.commission_amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Agency-only: onboarding deliveries + badge ── */}
        {isAgency && (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-semibold">
                  {t('partners.onboardingDeliveries') || 'Onboarding deliveries'}
                </CardTitle>
                <CardDescription>
                  {t('partners.onboardingDesc') ||
                    'Onboarding is sold offline. TAKO logs the €750 commission here once the package is paid for and delivered.'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {onboardingSales.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    {t('partners.noOnboardingsYet') || 'No onboarding deliveries logged yet.'}
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="text-left text-xs text-slate-500 uppercase border-b border-slate-200">
                        <tr>
                          <th className="py-2 pr-4">{t('partners.date') || 'Date'}</th>
                          <th className="py-2 pr-4">{t('partners.customer') || 'Customer'}</th>
                          <th className="py-2 pr-4">{t('partners.status') || 'Status'}</th>
                          <th className="py-2 pr-4 text-right">{t('partners.commission') || 'Commission'}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {onboardingSales.map((s) => (
                          <tr key={s.sale_id} className="border-b border-slate-100">
                            <td className="py-3 pr-4 text-slate-600">{fmtDate(s.created_at)}</td>
                            <td className="py-3 pr-4 text-slate-800">{anonEmail(s.customer_email)}</td>
                            <td className="py-3 pr-4">
                              <Badge variant="outline" className={
                                s.status === 'paid'
                                  ? 'border-emerald-400 text-emerald-700'
                                  : 'border-amber-400 text-amber-700'
                              }>
                                {s.status}
                              </Badge>
                            </td>
                            <td className="py-3 pr-4 text-right font-medium text-slate-900">
                              {fmtMoney(s.commission_amount)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base font-semibold">
                  {t('partners.badgeTitle') || 'TAKO Partner badge'}
                </CardTitle>
                <CardDescription>
                  {t('partners.badgeDesc') || 'Download and display on your website or signature.'}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex items-center gap-4 flex-wrap">
                <img
                  src="/assets/partner-badge.svg"
                  alt="TAKO Certified Partner"
                  className="w-24 h-24 rounded-lg border border-slate-200 bg-white"
                />
                <div className="flex flex-col gap-2">
                  <a href="/assets/partner-badge.svg" download>
                    <Button variant="outline" size="sm">
                      <Download className="w-4 h-4 mr-1" />
                      {t('partners.downloadSvg') || 'Download SVG'}
                    </Button>
                  </a>
                  <a href="/assets/partner-badge.svg" target="_blank" rel="noopener noreferrer">
                    <Button variant="ghost" size="sm" className="text-slate-500">
                      <ExternalLink className="w-4 h-4 mr-1" />
                      {t('partners.previewBadge') || 'Preview'}
                    </Button>
                  </a>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {/* ── Upsell referral-only partners to apply as agency ── */}
        {!isAgency && !isPending && (
          <Card className="border-dashed border-slate-300 bg-slate-50">
            <CardContent className="pt-6 text-sm text-slate-700">
              <p className="font-medium text-slate-900 mb-1">
                {t('partners.upsellTitle') || 'Deliver onboarding? Become an Agency Partner.'}
              </p>
              <p className="text-slate-600 mb-3">
                {t('partners.upsellDesc') ||
                  'Same €500 per sale, plus €750 per onboarding delivered. Requires admin approval.'}
              </p>
              <form onSubmit={submitAgencyApplication} className="space-y-3">
                <Input
                  placeholder={t('partners.companyName') || 'Company name'}
                  value={agencyForm.company_name}
                  onChange={(e) => setAgencyForm({ ...agencyForm, company_name: e.target.value })}
                  required
                />
                <Input
                  type="url"
                  placeholder={t('partners.website') || 'Website (optional)'}
                  value={agencyForm.company_website}
                  onChange={(e) => setAgencyForm({ ...agencyForm, company_website: e.target.value })}
                />
                <Textarea
                  rows={3}
                  placeholder={t('partners.howRecommend') || 'How will you recommend TAKO?'}
                  value={agencyForm.application_text}
                  onChange={(e) => setAgencyForm({ ...agencyForm, application_text: e.target.value })}
                  required
                />
                <Button type="submit" className="bg-[#0F0A1E] hover:bg-slate-800 text-white" disabled={submitting}>
                  {t('partners.applyAgencyCta') || 'Submit Agency Application'}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};

export default PartnerDashboardPage;
