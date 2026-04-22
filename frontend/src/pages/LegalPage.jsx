import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Shield, FileText, ArrowLeft } from 'lucide-react';

const LegalPage = () => {
  const { pathname } = useLocation();
  const isPrivacy = pathname === '/privacy';

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center">
            <img src="/logo-horizontal.svg" alt="TAKO" className="h-7" />
          </Link>
          <Link to="/">
            <button className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 transition-colors">
              <ArrowLeft className="w-4 h-4" /> Back to Home
            </button>
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12">
        {/* Tab switcher */}
        <div className="flex gap-2 mb-8">
          <Link to="/privacy" className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${isPrivacy ? 'bg-[#0EA5A0] text-white' : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-300'}`}>
            <Shield className="w-4 h-4" /> Privacy Policy
          </Link>
          <Link to="/terms" className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${!isPrivacy ? 'bg-[#0EA5A0] text-white' : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-300'}`}>
            <FileText className="w-4 h-4" /> Terms of Service
          </Link>
        </div>

        {isPrivacy ? <PrivacyPolicy /> : <TermsOfService />}
      </main>

      <footer className="bg-slate-900 py-10 px-6 mt-12">
        <div className="max-w-4xl mx-auto grid gap-8 md:grid-cols-3 text-sm">
          <div>
            <p className="text-slate-200 font-semibold mb-2">Product</p>
            <ul className="space-y-1.5 text-slate-400">
              <li><Link to="/#features" className="hover:text-slate-200">Features</Link></li>
              <li><Link to="/pricing" className="hover:text-slate-200">Pricing</Link></li>
              <li><Link to="/partners" className="hover:text-slate-200">Partners</Link></li>
              <li><Link to="/support" className="hover:text-slate-200">Support</Link></li>
            </ul>
          </div>
          <div>
            <p className="text-slate-200 font-semibold mb-2">Legal</p>
            <ul className="space-y-1.5 text-slate-400">
              <li><Link to="/privacy" className="hover:text-slate-200">Privacy Policy</Link></li>
              <li><Link to="/terms" className="hover:text-slate-200">Terms of Service</Link></li>
              <li><Link to="/legal/dpa" className="hover:text-slate-200">Data Processing Agreement</Link></li>
            </ul>
          </div>
          <div>
            <p className="text-slate-200 font-semibold mb-2">Contact</p>
            <ul className="space-y-1.5 text-slate-400">
              <li><a href="mailto:support@tako.software" className="hover:text-slate-200">support@tako.software</a></li>
              <li className="text-slate-500 text-xs leading-relaxed">Fintery Ltd., Canbury Works Units 6 &amp; 7, Canbury Business Park, Elm Crescent, Kingston upon Thames KT2 6HJ, UK</li>
            </ul>
          </div>
        </div>
        <div className="max-w-4xl mx-auto mt-8 pt-6 border-t border-slate-800 text-center">
          <p className="text-slate-500 text-xs">© {new Date().getFullYear()} TAKO by Fintery Ltd. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

const Section = ({ title, children }) => (
  <div className="mb-6">
    <h3 className="text-base font-semibold text-slate-900 mb-2">{title}</h3>
    <div className="text-sm text-slate-600 leading-relaxed space-y-2">{children}</div>
  </div>
);

const PrivacyPolicy = () => (
  <div>
    <div className="flex items-center gap-3 mb-2">
      <Shield className="w-6 h-6 text-[#0EA5A0]" />
      <h1 className="text-2xl font-bold text-slate-900">Privacy Policy</h1>
    </div>
    <p className="text-sm text-slate-400 mb-8">Last updated: April 2026 · Fintery Ltd., Kingston upon Thames, UK</p>

    <Section title="1. Who We Are">
      <p>TAKO is a customer relationship management (CRM) platform operated by <strong>Fintery Ltd.</strong>, registered in England & Wales. Registered address: Canbury Works, Units 6 & 7, Canbury Business Park, Elm Crescent, Kingston upon Thames, Surrey KT2 6HJ, UK.</p>
      <p>Contact: <a href="mailto:support@tako.software" className="text-[#0EA5A0]">support@tako.software</a></p>
    </Section>

    <Section title="2. Data We Collect">
      <p><strong>Account data:</strong> name, email address, organisation name, profile picture (from Google login).</p>
      <p><strong>CRM data:</strong> any leads, contacts, deals, tasks, notes, files, and campaign content you create or import.</p>
      <p><strong>Integration tokens:</strong> OAuth access tokens for Google Calendar and Meta (Facebook), stored encrypted and used solely to perform the actions you request.</p>
      <p><strong>Social Listener data:</strong> post text, author name, and public URLs from Facebook groups/pages you have authorised the Listener to monitor. Retained for 90 days by default (configurable per organisation).</p>
      <p><strong>Usage data:</strong> server logs, error reports, and feature usage to improve the service. We do not use third-party analytics trackers.</p>
    </Section>

    <Section title="3. How We Use Your Data">
      <p>To provide and operate the TAKO platform — CRM, campaigns, AI features, calling, and social listening.</p>
      <p>To send transactional emails (password resets, invitations, campaign sends you initiate).</p>
      <p>To improve the platform via aggregated, anonymised usage analysis.</p>
      <p><strong>We do not sell your data to third parties. We do not use your data to train AI models.</strong></p>
    </Section>

    <Section title="4. AI Processing">
      <p>TAKO uses Anthropic Claude to power AI features (lead scoring, email drafting, file analysis, social hit classification). Content sent to Claude is processed under Anthropic's API terms and is not used to train their models.</p>
      <p>AI-generated outputs (scores, drafts, classifications) are suggestions only. Users remain responsible for reviewing and approving all communications.</p>
    </Section>

    <Section title="5. Data Storage & Security">
      <p>Data is stored in MongoDB on a dedicated VPS in the European Union. All data in transit is encrypted via TLS 1.3. Access is controlled by role-based permissions within your organisation.</p>
      <p>We implement industry-standard security measures including access controls, encrypted secrets management, and regular dependency updates.</p>
    </Section>

    <Section title="6. Data Sharing">
      <p>We share data only with the following sub-processors, strictly to provide the service:</p>
      <ul className="list-disc pl-5 space-y-1">
        <li><strong>Anthropic</strong> — AI processing (Claude API)</li>
        <li><strong>Resend</strong> — transactional and campaign email delivery</li>
        <li><strong>Twilio</strong> — voice calling</li>
        <li><strong>Stripe</strong> — payment processing</li>
        <li><strong>Google</strong> — authentication and Calendar sync</li>
        <li><strong>Meta</strong> — social listening (read-only, via Facebook API)</li>
      </ul>
    </Section>

    <Section title="7. Your Rights (GDPR)">
      <p>As a data subject under GDPR you have the right to: access your data, correct inaccuracies, request deletion, export your data, and withdraw consent at any time.</p>
      <p>To exercise any of these rights, email <a href="mailto:support@tako.software" className="text-[#0EA5A0]">support@tako.software</a>. We will respond within 30 days.</p>
    </Section>

    <Section title="8. Cookies">
      <p>We use essential cookies only — for authentication (JWT session) and CSRF protection. No advertising or cross-site tracking cookies are used.</p>
    </Section>

    <Section title="9. Changes">
      <p>We may update this policy. Material changes will be notified by email or in-app notice. Continued use after notice constitutes acceptance.</p>
    </Section>
  </div>
);

const TermsOfService = () => (
  <div>
    <div className="flex items-center gap-3 mb-2">
      <FileText className="w-6 h-6 text-[#0EA5A0]" />
      <h1 className="text-2xl font-bold text-slate-900">Terms of Service</h1>
    </div>
    <p className="text-sm text-slate-400 mb-8">Last updated: April 2026 · Fintery Ltd., Kingston upon Thames, UK</p>

    <Section title="1. Acceptance">
      <p>By creating an account or using TAKO you agree to these Terms. If you do not agree, do not use the service. These Terms form a binding agreement between you and <strong>Fintery Ltd.</strong></p>
    </Section>

    <Section title="2. Description of Service">
      <p>TAKO is a multi-channel CRM platform providing lead management, deal tracking, task management, email and social campaigns, AI-powered insights, social listening, team communication, and associated tools.</p>
    </Section>

    <Section title="3. Accounts & Organisations">
      <p>You are responsible for maintaining the confidentiality of your login credentials and for all activity under your account. Notify us immediately at <a href="mailto:support@tako.software" className="text-[#0EA5A0]">support@tako.software</a> of any unauthorised access.</p>
      <p>Each user belongs to one organisation. Admins are responsible for managing member access and permissions within their organisation.</p>
    </Section>

    <Section title="4. Acceptable Use">
      <p>You agree not to use TAKO to:</p>
      <ul className="list-disc pl-5 space-y-1">
        <li>Violate any applicable law or regulation, including GDPR and anti-spam laws.</li>
        <li>Automate any action on social networks (posting, commenting, liking, DMing, friend requests). The social Listener is read-only by design — all actions on social platforms must be performed manually by a human user.</li>
        <li>Scrape, harvest, or collect data from third-party platforms in violation of their terms of service.</li>
        <li>Send unsolicited bulk email (spam).</li>
        <li>Attempt to gain unauthorised access to other organisations' data.</li>
      </ul>
    </Section>

    <Section title="5. AI-Generated Content">
      <p>AI features (lead scores, email drafts, social hit classifications, file summaries) are provided as suggestions. You are solely responsible for reviewing, approving, and taking responsibility for any content or action taken based on AI outputs before acting on them.</p>
    </Section>

    <Section title="6. Payment & Licensing">
      <p>TAKO is licensed as a one-time purchase. You may pay the full price up-front, or select one of the installment plans (12 or 24 equal monthly payments) at checkout. All options grant the same perpetual licence to use, modify, and deploy TAKO on your own infrastructure. Prices are displayed excluding VAT where applicable; VAT is calculated at checkout based on your billing country.</p>
      <p>Each purchase includes 12 months of maintenance and support. After the first year, maintenance may be renewed annually for the published renewal fee. Renewal is optional — the licence itself does not expire.</p>
      <p>Installment plans: if you select a 12- or 24-month installment plan, Stripe collects one payment per month until the plan is complete. If an installment payment fails, we will contact you before suspending access.</p>
      <p>UNYT token payments are processed via MetaMask or UNYT.shop and are final once confirmed on-chain.</p>
      <p>Refunds: we offer a 30-day money-back guarantee on the first purchase. Contact <a href="mailto:support@tako.software" className="text-[#0EA5A0]">support@tako.software</a>.</p>
      <p>We reserve the right to change pricing with 30 days' written notice for new purchases; your existing licence is unaffected.</p>
    </Section>

    <Section title="7. Intellectual Property">
      <p>TAKO and all associated software, design, and content are the property of Fintery Ltd. You retain ownership of all data you input into the platform.</p>
    </Section>

    <Section title="8. Availability & Liability">
      <p>TAKO is provided "as is" without warranty of uninterrupted or error-free operation. We will make reasonable efforts to maintain availability but do not guarantee it.</p>
      <p>To the maximum extent permitted by law, Fintery Ltd. is not liable for indirect, incidental, or consequential damages arising from use of the service.</p>
    </Section>

    <Section title="9. Termination">
      <p>You may close your account at any time from Settings. Closing your account does not revoke a perpetual licence already granted; it stops maintenance and in-app access. We may suspend or terminate accounts that violate these Terms, with notice where reasonably practicable.</p>
    </Section>

    <Section title="10. Governing Law">
      <p>These Terms are governed by the laws of England & Wales. Disputes shall be subject to the exclusive jurisdiction of the courts of England & Wales.</p>
    </Section>

    <Section title="11. Changes">
      <p>We may update these Terms. Material changes will be communicated by email or in-app notice with at least 14 days' notice. Continued use constitutes acceptance.</p>
    </Section>

    <div className="mt-8 p-4 bg-amber-50 border border-amber-200 rounded-lg">
      <p className="text-sm text-amber-800"><strong>Questions?</strong> Email <a href="mailto:support@tako.software" className="text-[#0EA5A0]">support@tako.software</a> or write to Fintery Ltd., Canbury Works Units 6 & 7, Canbury Business Park, Elm Crescent, Kingston upon Thames KT2 6HJ, UK.</p>
    </div>
  </div>
);

export default LegalPage;
