import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../App';
import DashboardLayout from '../components/layout/DashboardLayout';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../components/ui/accordion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { toast } from 'sonner';
import axios from 'axios';
import {
  HelpCircle, BookOpen, Mail, FileText, ArrowLeft, Send,
  Users, Target, CheckSquare, BarChart3, Zap, Building, Shield,
  Clock, TrendingUp, Award, Lightbulb, Radio, Megaphone,
  MapPin, Check, Circle, ChevronRight, FolderOpen, Calendar,
  Phone, Key, Settings, ExternalLink
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL + '/api';
const CHECKLIST_KEY = 'tako_onboarding_checklist';

// ─── Onboarding checklist definition ────────────────────────────────────────
const CHECKLIST = [
  {
    group: 'Organisation Setup',
    items: [
      { id: 'invite_team', label: 'Invite your team members', detail: 'Settings → Organisation → Team → Invite', href: '/settings' },
      { id: 'custom_stages', label: 'Customise deal pipeline stages', detail: 'Settings → Organisation → Pipeline Stages', href: '/settings' },
      { id: 'custom_task_steps', label: 'Customise task steps', detail: 'Settings → Organisation → Task Steps', href: '/settings' },
    ]
  },
  {
    group: 'Import Your Data',
    items: [
      { id: 'import_leads', label: 'Import leads via CSV', detail: 'Leads → Import CSV — supports LinkedIn exports', href: '/leads' },
      { id: 'import_contacts', label: 'Import or convert contacts', detail: 'Contacts → Import CSV, or convert qualified leads', href: '/contacts' },
      { id: 'create_deals', label: 'Create your first deals', detail: 'Deals → New Deal — link to a lead or contact', href: '/deals' },
    ]
  },
  {
    group: 'Integrations',
    items: [
      { id: 'ai_key', label: 'Connect an AI key (Anthropic)', detail: 'Settings → Integrations → AI / LLM', href: '/settings?tab=integrations' },
      { id: 'resend', label: 'Connect Resend for email sending', detail: 'Settings → Integrations → Email', href: '/settings?tab=integrations' },
      { id: 'twilio', label: 'Connect Twilio for calling', detail: 'Settings → Integrations → Calling', href: '/settings?tab=integrations' },
      { id: 'google_cal', label: 'Connect Google Calendar', detail: 'Settings → Integrations → Google Calendar', href: '/settings?tab=integrations' },
    ]
  },
  {
    group: 'Campaigns & Listeners',
    items: [
      { id: 'first_campaign', label: 'Create your first campaign', detail: 'Campaigns → New Campaign — choose Email, Facebook, or LinkedIn', href: '/campaigns' },
      { id: 'first_listener', label: 'Set up a social Listener', detail: 'Listeners → New Listener — requires a social campaign + Meta app credentials', href: '/listeners' },
    ]
  },
  {
    group: 'API & Webhooks',
    items: [
      { id: 'api_key', label: 'Generate an API key', detail: 'Settings → API & Webhooks — for n8n, Zapier, or custom integrations', href: '/settings?tab=api' },
    ]
  },
  {
    group: 'Decisions Needed (Admin)',
    items: [
      { id: 'meta_app', label: 'Configure Meta app for Facebook Listeners', detail: 'Requires META_APP_ID + META_APP_SECRET in backend .env. Meta app review (Page Public Content Access) takes several weeks — start early.', href: null },
      { id: 'chrome_ext', label: 'Build & publish Chrome extension', detail: 'Separate tako-chrome-extension repo. Needed for passive social listening via the browser. Device-code pairing is ready on the backend.', href: null },
      { id: 'token_enc', label: 'Encrypt OAuth tokens at rest', detail: 'Meta + Google OAuth tokens are stored in MongoDB. Add encryption before going to production with real user OAuth sessions.', href: null },
      { id: 'stripe_live', label: 'Switch Stripe to live mode', detail: 'Backend uses STRIPE_API_KEY — confirm it is the live key in production .env.', href: null },
    ]
  },
];

const QUICK_START = [
  { step: 1, title: 'Create your organisation', body: 'Sign up, then go to Settings → Organisation to fill in your company name and invite your first team members.', icon: <Building className="w-5 h-5" /> },
  { step: 2, title: 'Import your leads', body: 'Head to Leads → Import CSV. You can export directly from LinkedIn Connections and upload here. Manual entry works too.', icon: <Users className="w-5 h-5" /> },
  { step: 3, title: 'Build your pipeline', body: 'Go to Deals and drag leads through your pipeline stages. Customise the stages in Settings → Organisation to match your sales process.', icon: <Target className="w-5 h-5" /> },
  { step: 4, title: 'Connect your tools', body: 'Settings → Integrations. Add your Anthropic key for AI features, Resend for email, Twilio for calling, and Google Calendar for scheduling.', icon: <Settings className="w-5 h-5" /> },
  { step: 5, title: 'Run your first campaign', body: 'Campaigns → New Campaign. Choose Email for a direct send via Resend, or choose Facebook/LinkedIn to set up a social Listener.', icon: <Megaphone className="w-5 h-5" /> },
  { step: 6, title: 'Monitor with Listeners', body: 'Listeners → New Listener. Pick a social campaign, set your keywords and persona, and let the AI classify incoming hits and generate tasks.', icon: <Radio className="w-5 h-5" /> },
];

// ─── FAQ ────────────────────────────────────────────────────────────────────
const faqs = [
  {
    category: 'Getting Started',
    questions: [
      {
        q: 'How do I create an account?',
        a: 'Click "Get Started Free" on the homepage and sign up with your email, or use Sign in with Google for instant access. You\'ll be prompted to create or join an organisation on first login.'
      },
      {
        q: 'Is there a free tier?',
        a: 'Yes — TAKO is free for up to 3 users. You only pay when you add more team members. No credit card required to get started.'
      },
      {
        q: 'How do I invite team members?',
        a: 'Go to Settings → Organisation → Team. You can invite by email, share an invite link, or bulk-import via CSV. Invited users choose their own password on first sign-in.'
      },
      {
        q: 'Can I import my existing contacts?',
        a: 'Yes. Go to Leads → Import CSV (or Contacts → Import CSV). We accept standard CSVs with columns for first name, last name, email, phone, company, job title, and LinkedIn URL. LinkedIn exports work directly.'
      },
    ]
  },
  {
    category: 'Features & Functionality',
    questions: [
      {
        q: 'How does AI lead scoring work?',
        a: 'TAKO uses Claude (Anthropic) to analyse a lead\'s profile — job title, company, engagement history, and notes — and assigns a score from 1–100. Higher scores indicate higher conversion likelihood. Click "AI Score" on any lead card to run it. Your org needs an Anthropic API key configured in Settings → Integrations (or use the platform key if you\'re on the internal team).'
      },
      {
        q: 'Can I customise the deal and task stages?',
        a: 'Yes — fully. Go to Settings → Organisation → Pipeline Stages to add, rename, or remove deal stages. Task Steps work the same way. Changes apply immediately across the Kanban boards.'
      },
      {
        q: 'What channels do Campaigns support?',
        a: 'Email (via Resend + optional Kit.com), Facebook, Instagram, and LinkedIn. Email campaigns send directly. Social campaigns are paired with a Listener — the Listener monitors groups and pages for keyword matches and buying signals, then creates tasks for your team to act on manually.'
      },
      {
        q: 'What are Listeners?',
        a: 'Listeners are AI agents that monitor social channels (Facebook groups and pages in v1) for posts matching your keywords and persona. They classify hits as buying signals, complaints, questions, or mentions using Claude, and automatically create tasks for high-confidence matches. Configure them in the Listeners section of the sidebar.'
      },
      {
        q: 'How does the Chrome extension fit in?',
        a: 'The Chrome extension (separate repo, coming soon) lets TAKO passively ingest posts from pages you\'re browsing in your own logged-in Facebook session. It pairs with your TAKO account via a one-time device code shown in Listeners → Pair Extension. No automated actions — read-only by design.'
      },
      {
        q: 'What email integrations are supported?',
        a: 'Resend is the primary email provider (set RESEND_API_KEY in Settings → Integrations). Kit.com is optional for list management and automation — connect it with your Kit API key and secret. Both can run simultaneously; Resend handles transactional and bulk sends, Kit handles subscriber lists.'
      },
      {
        q: 'How does calling work?',
        a: 'TAKO uses Twilio for outbound and inbound calls. Add your Twilio SID, auth token, and phone number in Settings → Integrations → Calling. You can then call directly from a lead or contact record. Inbound calls are auto-greeted and voicemails are recorded and attached to the caller\'s record.'
      },
    ]
  },
  {
    category: 'AI Features',
    questions: [
      {
        q: 'Which AI model does TAKO use?',
        a: 'All AI features run on Anthropic\'s Claude (claude-sonnet-4-20250514). This covers lead scoring, lead enrichment, email drafting, call analysis, file summarisation, smart search, and social hit classification.'
      },
      {
        q: 'Do I need my own Anthropic API key?',
        a: 'Internal team members (fintery.com, tako.software, aios.dev, unyted.world, openclaw.com, floriankrueger.com domains) use the platform key automatically. All other organisations must add their own Anthropic API key in Settings → Integrations → AI / LLM.'
      },
      {
        q: 'What can AI do with uploaded files?',
        a: 'When you upload a PDF, DOCX, or image to Files (linked to any entity), TAKO automatically extracts the text, summarises it with Claude, and suggests follow-up tasks. PDFs up to 30 pages are supported. Click "Create Tasks from Suggestions" to turn AI recommendations into real tasks.'
      },
    ]
  },
  {
    category: 'Billing & Pricing',
    questions: [
      {
        q: 'How much does TAKO cost?',
        a: 'Free for up to 3 users. €15/user/month for additional team members. Annual billing saves 20% (€12/user/month). You can also pay with UNYT tokens on Arbitrum for an additional 5% discount.'
      },
      {
        q: 'What payment methods are accepted?',
        a: 'Credit/debit cards via Stripe, and UNYT tokens (Arbitrum) via MetaMask. Crypto payments receive an additional 5% discount.'
      },
      {
        q: 'Can I get a refund?',
        a: 'Yes — 30-day money-back guarantee. Email support@tako.software within 30 days of purchase.'
      },
    ]
  },
  {
    category: 'Security & Privacy',
    questions: [
      {
        q: 'Is my data secure?',
        a: 'Yes. All traffic uses TLS. Data is stored in a MongoDB instance on a dedicated VPS. We never share your data with third parties. GDPR-compliant — data stored in Europe.'
      },
      {
        q: 'Can I export my data?',
        a: 'Leads and contacts can be exported via CSV. For a full data export (all collections), contact support@tako.software.'
      },
      {
        q: 'Who can access my organisation\'s data?',
        a: 'Only members you invite. Admins can manage roles (member, admin, owner) and remove members at any time from Settings → Organisation.'
      },
    ]
  }
];

// ─── Training modules ────────────────────────────────────────────────────────
const trainingModules = [
  {
    title: 'Dashboard',
    icon: <BarChart3 className="w-6 h-6" />,
    description: 'Your command centre for sales and marketing.',
    steps: [
      'Key metrics at a glance: Total Leads, Active Deals, Open Tasks, Pipeline Value',
      'Recent Leads shows your newest prospects with AI scores',
      'Recent Tasks displays your team\'s current to-dos',
      'Quick-add buttons to create leads or deals without leaving the dashboard'
    ]
  },
  {
    title: 'Lead Management',
    icon: <Users className="w-6 h-6" />,
    description: 'Capture, score, and nurture your prospects.',
    steps: [
      'Add leads manually or import via CSV — LinkedIn exports work directly',
      'Filter by status: New, Contacted, Qualified, Unqualified',
      'Click AI Score to get an instant 1–100 quality score from Claude',
      'AI Enrich fills in company info, tech stack, and a recommended sales approach',
      'Business card capture: scan a card with your camera to auto-create a lead'
    ]
  },
  {
    title: 'Deal Pipeline',
    icon: <Target className="w-6 h-6" />,
    description: 'Visual Kanban to track every opportunity.',
    steps: [
      'Drag deals between stages or use the stage dropdown on each card',
      'Customise stages in Settings → Organisation → Pipeline Stages',
      'Link deals to a lead, contact, or company for full context',
      'Lost deals are automatically excluded from the active pipeline value'
    ]
  },
  {
    title: 'Tasks & Projects',
    icon: <CheckSquare className="w-6 h-6" />,
    description: 'Keep your team organised and accountable.',
    steps: [
      'Kanban and list views — switch with the toggle in the top right',
      'Filter by stage, priority, project, due date, owner, or search by name',
      'Subtasks (checklists), comments, and activity history per task',
      'Group tasks under Projects — each project gets its own chat channel',
      'Listener-created tasks show an "FB — [Group name]" source badge'
    ]
  },
  {
    title: 'Campaigns',
    icon: <Megaphone className="w-6 h-6" />,
    description: 'Reach your audience across email and social.',
    steps: [
      'Email campaigns send via Resend (primary) or Kit.com (subscriber lists)',
      'Social campaigns (Facebook, Instagram, LinkedIn) are paired with a Listener',
      'Use AI Draft to generate a professional introduction email in one click',
      'Track sent, open, and click rates for email campaigns'
    ]
  },
  {
    title: 'Listeners',
    icon: <Radio className="w-6 h-6" />,
    description: 'AI agents that monitor social channels for buying signals.',
    steps: [
      'Create a Listener on any social campaign — set keywords, persona, and cadence',
      'Click "Discover Groups" to let the AI find relevant Facebook groups — review and approve sources',
      'Hits are classified by Claude: buying signal, complaint, question, mention, or noise',
      'High-confidence hits auto-create tasks; lower-confidence hits queue for manual review',
      'Generate a digest report at any time for an AI summary of recent activity'
    ]
  },
  {
    title: 'AI Features',
    icon: <Zap className="w-6 h-6" />,
    description: 'Claude-powered intelligence throughout the platform.',
    steps: [
      'Lead Scoring & Enrichment: 1–100 quality score + company research + sales approach',
      'Email Drafting: personalised sales emails with tone and purpose selection',
      'File Analysis: upload a PDF or DOCX and get a summary + suggested follow-up tasks',
      'Call Analysis: AI feedback on recorded calls — strengths, improvements, next steps',
      'Smart Search: ask questions in plain English to find anything across your CRM'
    ]
  },
  {
    title: 'Calendar & Scheduling',
    icon: <Calendar className="w-6 h-6" />,
    description: 'Never miss a meeting or follow-up.',
    steps: [
      'Month and week views showing scheduled calls, task due dates, and deal close dates',
      'Create custom events and link them to any entity (lead, deal, contact)',
      'Connect Google Calendar in Settings → Integrations for two-way sync',
      'Public booking page (/book/your-id) lets prospects book directly into your calendar'
    ]
  },
];

const salesMethodologies = [
  { name: 'SPIN Selling', best_for: 'Complex B2B, long cycles', description: 'Situation, Problem, Implication, Need-payoff questions to uncover real needs.', when_to_use: 'High-value solutions requiring deep discovery.', in_tako: 'Log SPIN questions in lead notes. Create a task for each stage of the conversation.' },
  { name: 'Challenger Sale', best_for: 'Disruptive or new-category products', description: 'Teach, tailor, take control. Challenge assumptions with insight-led messages.', when_to_use: 'When your product changes how customers think about a problem.', in_tako: 'Use AI email drafting for insight-driven outreach. Track "teaching moments" in deal notes.' },
  { name: 'Solution Selling', best_for: 'Service businesses and consultancies', description: 'Focus on solving specific pain points rather than pitching features.', when_to_use: 'When customers have named problems that map cleanly to your offer.', in_tako: 'Document pain points in lead Contact fields. Move deals based on solution fit score.' },
  { name: 'MEDDIC', best_for: 'Enterprise deals, multiple stakeholders', description: 'Metrics, Economic Buyer, Decision Criteria, Decision Process, Identify Pain, Champion.', when_to_use: 'Complex approvals with procurement, legal, and multiple sign-offs.', in_tako: 'Use Companies to map all stakeholders. Track MEDDIC fields in deal notes.' },
  { name: 'Value Selling', best_for: 'Premium products with clear ROI', description: 'Demonstrate return rather than competing on price.', when_to_use: 'When you cost more but deliver measurably superior results.', in_tako: 'Document ROI metrics in deal notes. Use pipeline value to forecast business case conversations.' },
];

// ─── Component ───────────────────────────────────────────────────────────────
const SupportPage = () => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const defaultTab = searchParams.get('tab') || 'onboarding';

  const [contactForm, setContactForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [sending, setSending] = useState(false);

  // Checklist state — persisted in localStorage
  const [checked, setChecked] = useState(() => {
    try { return JSON.parse(localStorage.getItem(CHECKLIST_KEY) || '{}'); } catch { return {}; }
  });

  const toggle = (id) => {
    const next = { ...checked, [id]: !checked[id] };
    setChecked(next);
    localStorage.setItem(CHECKLIST_KEY, JSON.stringify(next));
  };

  const totalItems = CHECKLIST.reduce((acc, g) => acc + g.items.length, 0);
  const doneItems = Object.values(checked).filter(Boolean).length;
  const pct = Math.round((doneItems / totalItems) * 100);

  const handleContactSubmit = async (e) => {
    e.preventDefault();
    setSending(true);
    try {
      await axios.post(`${API}/support/contact`, contactForm);
    } catch {}
    toast.success("Message received! We'll get back to you soon.");
    setContactForm({ name: '', email: '', subject: '', message: '' });
    setSending(false);
  };

  const supportContent = (
    <div className={user ? 'p-6' : 'min-h-screen bg-slate-50'}>

      {/* Public header */}
      {!user && (
        <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-[#0EA5A0] rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">T</span>
              </div>
              <span className="text-xl font-semibold text-slate-900">TAKO</span>
            </Link>
            <div className="flex items-center gap-4">
              <Link to="/"><Button variant="ghost" size="sm"><ArrowLeft className="w-4 h-4 mr-2" />Back</Button></Link>
              <Link to="/login"><Button className="bg-[#0EA5A0] hover:bg-teal-700" size="sm">Sign In</Button></Link>
            </div>
          </div>
        </header>
      )}

      {/* Hero */}
      <section className="bg-gradient-to-r from-[#0EA5A0] to-teal-600 py-12 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-3xl font-bold text-white mb-2" data-testid="support-title">How Can We Help?</h1>
          <p className="text-teal-100">Onboarding guide, feature training, FAQs, and contact.</p>
        </div>
      </section>

      <main className="max-w-7xl mx-auto px-6 py-10">
        <Tabs defaultValue={defaultTab} className="space-y-8">
          <TabsList className="grid w-full grid-cols-5 max-w-2xl mx-auto" data-testid="support-tabs">
            <TabsTrigger value="onboarding" className="flex items-center gap-1.5 text-xs sm:text-sm"><CheckSquare className="w-4 h-4" />Start</TabsTrigger>
            <TabsTrigger value="faq" className="flex items-center gap-1.5 text-xs sm:text-sm"><HelpCircle className="w-4 h-4" />FAQ</TabsTrigger>
            <TabsTrigger value="training" className="flex items-center gap-1.5 text-xs sm:text-sm"><BookOpen className="w-4 h-4" />Training</TabsTrigger>
            <TabsTrigger value="contact" className="flex items-center gap-1.5 text-xs sm:text-sm"><Mail className="w-4 h-4" />Contact</TabsTrigger>
            <TabsTrigger value="legal" className="flex items-center gap-1.5 text-xs sm:text-sm"><FileText className="w-4 h-4" />Legal</TabsTrigger>
          </TabsList>

          {/* ── ONBOARDING TAB ───────────────────────────────────── */}
          <TabsContent value="onboarding" className="space-y-10">

            {/* Quick Start */}
            <div>
              <h2 className="text-2xl font-bold text-slate-900 mb-1">Getting Started with TAKO</h2>
              <p className="text-slate-500 text-sm mb-6">Follow these six steps to go from zero to running your first campaign.</p>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {QUICK_START.map(s => (
                  <Card key={s.step} className="relative overflow-hidden">
                    <CardContent className="p-5">
                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-full bg-[#0EA5A0]/10 text-[#0EA5A0] flex items-center justify-center shrink-0 font-bold text-sm">{s.step}</div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[#0EA5A0]">{s.icon}</span>
                            <p className="font-semibold text-slate-900 text-sm">{s.title}</p>
                          </div>
                          <p className="text-xs text-slate-500 leading-relaxed">{s.body}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            {/* Setup Checklist */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">Setup Checklist</h2>
                  <p className="text-slate-500 text-sm mt-0.5">Track what's done and what still needs a decision.</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-[#0EA5A0]">{pct}%</p>
                  <p className="text-xs text-slate-400">{doneItems}/{totalItems} complete</p>
                </div>
              </div>

              {/* Progress bar */}
              <div className="w-full h-2 bg-slate-100 rounded-full mb-6">
                <div className="h-2 bg-[#0EA5A0] rounded-full transition-all duration-300" style={{ width: `${pct}%` }} />
              </div>

              <div className="space-y-6">
                {CHECKLIST.map(group => (
                  <div key={group.group}>
                    <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">{group.group}</h3>
                    <div className="space-y-2">
                      {group.items.map(item => (
                        <div
                          key={item.id}
                          className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${checked[item.id] ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-200 hover:border-slate-300'}`}
                          onClick={() => toggle(item.id)}
                        >
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors ${checked[item.id] ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300'}`}>
                            {checked[item.id] && <Check className="w-3 h-3 text-white" />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className={`text-sm font-medium ${checked[item.id] ? 'line-through text-slate-400' : 'text-slate-900'}`}>{item.label}</p>
                            <p className="text-xs text-slate-400 mt-0.5">{item.detail}</p>
                          </div>
                          {item.href && (
                            <Link to={item.href} onClick={e => e.stopPropagation()} className="shrink-0 text-[#0EA5A0] hover:text-teal-700">
                              <ChevronRight className="w-4 h-4" />
                            </Link>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>

          {/* ── FAQ TAB ──────────────────────────────────────────── */}
          <TabsContent value="faq">
            <div className="max-w-4xl mx-auto">
              <h2 className="text-2xl font-bold text-slate-900 mb-6">Frequently Asked Questions</h2>
              {faqs.map((cat, idx) => (
                <div key={idx} className="mb-8">
                  <h3 className="text-base font-semibold text-[#0EA5A0] mb-3">{cat.category}</h3>
                  <Accordion type="single" collapsible className="space-y-2">
                    {cat.questions.map((item, qIdx) => (
                      <AccordionItem key={qIdx} value={`${idx}-${qIdx}`} className="bg-white rounded-lg border border-slate-200">
                        <AccordionTrigger className="px-4 py-3 hover:no-underline">
                          <span className="text-left font-medium text-slate-900 text-sm">{item.q}</span>
                        </AccordionTrigger>
                        <AccordionContent className="px-4 pb-4 text-slate-600 text-sm leading-relaxed">
                          {item.a}
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </div>
              ))}
            </div>
          </TabsContent>

          {/* ── TRAINING TAB ─────────────────────────────────────── */}
          <TabsContent value="training">
            <div className="space-y-12">
              <div>
                <h2 className="text-2xl font-bold text-slate-900 mb-1">Feature Training</h2>
                <p className="text-slate-500 text-sm mb-6">A module for each area of the platform.</p>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {trainingModules.map((mod, idx) => (
                    <Card key={idx} className="hover:shadow-lg transition-shadow" data-testid={`training-module-${idx}`}>
                      <CardHeader>
                        <div className="w-11 h-11 bg-teal-50 rounded-xl flex items-center justify-center text-[#0EA5A0] mb-2">
                          {mod.icon}
                        </div>
                        <CardTitle className="text-base">{mod.title}</CardTitle>
                        <CardDescription className="text-xs">{mod.description}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <ul className="space-y-2">
                          {mod.steps.map((step, sIdx) => (
                            <li key={sIdx} className="flex items-start gap-2 text-xs text-slate-600">
                              <span className="w-4 h-4 rounded-full bg-teal-50 text-[#0EA5A0] flex items-center justify-center shrink-0 text-[10px] font-bold mt-0.5">{sIdx + 1}</span>
                              {step}
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>

              {/* Sales methodologies */}
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <TrendingUp className="w-7 h-7 text-[#0EA5A0]" />
                  <h2 className="text-2xl font-bold text-slate-900">Sales Methodologies</h2>
                </div>
                <p className="text-slate-500 text-sm mb-6">How to apply proven sales frameworks inside TAKO.</p>
                <div className="grid md:grid-cols-2 gap-5">
                  {salesMethodologies.map((m, idx) => (
                    <Card key={idx} className="border-l-4 border-l-[#0EA5A0]" data-testid={`methodology-${idx}`}>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base flex items-center gap-2">
                          <Award className="w-4 h-4 text-[#0EA5A0]" />{m.name}
                        </CardTitle>
                        <span className="text-xs text-emerald-700 font-medium bg-emerald-50 px-2 py-0.5 rounded-full w-fit">Best for: {m.best_for}</span>
                      </CardHeader>
                      <CardContent className="space-y-2 pt-0">
                        <p className="text-xs text-slate-600">{m.description}</p>
                        <div className="p-2.5 bg-amber-50 rounded-lg">
                          <p className="text-xs font-medium text-amber-800 flex items-center gap-1.5 mb-0.5"><Clock className="w-3.5 h-3.5" />When to use</p>
                          <p className="text-xs text-amber-700">{m.when_to_use}</p>
                        </div>
                        <div className="p-2.5 bg-teal-50 rounded-lg">
                          <p className="text-xs font-medium text-teal-800 flex items-center gap-1.5 mb-0.5"><Lightbulb className="w-3.5 h-3.5" />In TAKO</p>
                          <p className="text-xs text-teal-700">{m.in_tako}</p>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </div>
          </TabsContent>

          {/* ── CONTACT TAB ──────────────────────────────────────── */}
          <TabsContent value="contact">
            <div className="max-w-4xl mx-auto grid md:grid-cols-2 gap-8">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base"><Mail className="w-4 h-4 text-[#0EA5A0]" />Send Us a Message</CardTitle>
                  <CardDescription>We typically respond within 24 hours</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleContactSubmit} className="space-y-4">
                    <div className="space-y-1.5"><Label>Your Name *</Label><Input value={contactForm.name} onChange={e => setContactForm({ ...contactForm, name: e.target.value })} required data-testid="contact-name" /></div>
                    <div className="space-y-1.5"><Label>Email *</Label><Input type="email" value={contactForm.email} onChange={e => setContactForm({ ...contactForm, email: e.target.value })} required data-testid="contact-email" /></div>
                    <div className="space-y-1.5"><Label>Subject *</Label><Input value={contactForm.subject} onChange={e => setContactForm({ ...contactForm, subject: e.target.value })} required data-testid="contact-subject" /></div>
                    <div className="space-y-1.5"><Label>Message *</Label><Textarea value={contactForm.message} onChange={e => setContactForm({ ...contactForm, message: e.target.value })} rows={5} required data-testid="contact-message" /></div>
                    <Button type="submit" className="w-full bg-[#0EA5A0] hover:bg-teal-700" disabled={sending} data-testid="contact-submit">
                      {sending ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><Send className="w-4 h-4 mr-2" />Send Message</>}
                    </Button>
                  </form>
                </CardContent>
              </Card>

              <div className="space-y-5">
                <Card>
                  <CardContent className="p-5 space-y-4">
                    <h3 className="font-semibold text-slate-900">Contact Information</h3>
                    <div className="flex items-start gap-3">
                      <Mail className="w-4 h-4 text-[#0EA5A0] mt-0.5 shrink-0" />
                      <div><p className="text-sm font-medium">Email</p><a href="mailto:support@tako.software" className="text-sm text-[#0EA5A0]">support@tako.software</a></div>
                    </div>
                    <div className="flex items-start gap-3">
                      <MapPin className="w-4 h-4 text-[#0EA5A0] mt-0.5 shrink-0" />
                      <div><p className="text-sm font-medium">Address</p><p className="text-xs text-slate-500">Fintery Ltd., Canbury Works Units 6 & 7, Canbury Business Park, Elm Crescent, Kingston upon Thames KT2 6HJ, UK</p></div>
                    </div>
                    <div className="flex items-start gap-3">
                      <Clock className="w-4 h-4 text-[#0EA5A0] mt-0.5 shrink-0" />
                      <div><p className="text-sm font-medium">Hours</p><p className="text-xs text-slate-500">Mon–Fri 9:00–18:00 GMT</p></div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-teal-50 border-teal-100">
                  <CardContent className="p-5">
                    <h3 className="font-semibold text-slate-900 mb-1">Urgent Issue?</h3>
                    <p className="text-sm text-teal-700 mb-3">Email us with "URGENT" in the subject for priority response.</p>
                    <a href="mailto:support@tako.software?subject=URGENT:">
                      <Button variant="outline" size="sm" className="border-teal-300 text-teal-700 hover:bg-teal-100"><Mail className="w-3.5 h-3.5 mr-2" />Send Urgent Request</Button>
                    </a>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* ── LEGAL TAB ────────────────────────────────────────── */}
          <TabsContent value="legal">
            <div className="max-w-4xl mx-auto space-y-6">
              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Building className="w-4 h-4 text-[#0EA5A0]" />Company Information</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-2 gap-6 text-sm text-slate-600">
                    <div><p className="font-semibold text-slate-900 mb-1">Legal Entity</p><p><strong>Fintery Ltd.</strong><br />Registered in England & Wales</p></div>
                    <div><p className="font-semibold text-slate-900 mb-1">Registered Address</p><p>Canbury Works, Units 6 & 7<br />Canbury Business Park, Elm Crescent<br />Kingston upon Thames, Surrey KT2 6HJ, UK</p></div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2 text-base"><FileText className="w-4 h-4 text-[#0EA5A0]" />Terms of Service</CardTitle></CardHeader>
                <CardContent className="text-sm text-slate-600 space-y-4">
                  <p className="text-xs text-slate-400">Last updated: April 2026</p>
                  <div><p className="font-semibold text-slate-900">1. Acceptance</p><p>By using TAKO you agree to these terms. If you do not agree, do not use the service.</p></div>
                  <div><p className="font-semibold text-slate-900">2. Description</p><p>TAKO is a multi-channel CRM with lead management, deal tracking, task management, email and social campaigns, AI-powered insights, and social listening.</p></div>
                  <div><p className="font-semibold text-slate-900">3. User Accounts</p><p>You are responsible for keeping your credentials confidential. Notify us immediately of any unauthorised access.</p></div>
                  <div><p className="font-semibold text-slate-900">4. Acceptable Use</p><p>Do not use TAKO for any unlawful purpose or in violation of applicable laws including GDPR. The social Listener is read-only — automated posting, commenting, or DMing on social networks is prohibited.</p></div>
                  <div><p className="font-semibold text-slate-900">5. Payment</p><p>Subscriptions are billed monthly or annually. Refunds are available within 30 days. Contact support@tako.software.</p></div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Shield className="w-4 h-4 text-[#0EA5A0]" />Privacy Policy</CardTitle></CardHeader>
                <CardContent className="text-sm text-slate-600 space-y-4">
                  <p className="text-xs text-slate-400">Last updated: April 2026</p>
                  <div><p className="font-semibold text-slate-900">Data We Collect</p><p>Name, email, organisation details, and any data you input (leads, deals, tasks, files). Usage data to improve the service. OAuth tokens for connected integrations (Google, Meta).</p></div>
                  <div><p className="font-semibold text-slate-900">How We Use It</p><p>To provide and improve our services, communicate with you, and maintain security. We do not sell your data.</p></div>
                  <div><p className="font-semibold text-slate-900">Storage & Security</p><p>Data is stored in encrypted MongoDB databases on European infrastructure. TLS in transit, access controls, regular audits.</p></div>
                  <div><p className="font-semibold text-slate-900">Your Rights (GDPR)</p><p>Access, correct, delete, or export your data at any time. Email support@tako.software.</p></div>
                  <div><p className="font-semibold text-slate-900">Social Listener Data</p><p>Post text captured by Listeners is retained for 90 days by default (configurable per organisation). All ingested data belongs to your organisation and is never used to train AI models.</p></div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-base">Cookie Policy</CardTitle></CardHeader>
                <CardContent className="text-sm text-slate-600">
                  We use essential cookies for authentication and session management. Analytics cookies help us understand platform usage. Manage cookie preferences in your browser settings.
                </CardContent>
              </Card>

              <Card className="border-amber-200 bg-amber-50">
                <CardHeader><CardTitle className="text-amber-800 text-base">Disclaimer</CardTitle></CardHeader>
                <CardContent className="text-amber-700 text-sm space-y-2">
                  <p>TAKO is provided "as is" without warranties. We do not guarantee uninterrupted or error-free service.</p>
                  <p>AI-generated content (scores, email drafts, hit classifications) is provided as suggestions. Users are responsible for reviewing and approving all communications before acting on them.</p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

        </Tabs>
      </main>

      {!user && (
        <footer className="bg-slate-900 py-8 px-6 mt-8">
          <div className="max-w-7xl mx-auto text-center">
            <p className="text-slate-400 text-sm">© {new Date().getFullYear()} TAKO by Fintery Ltd. All rights reserved.</p>
            <p className="text-slate-500 text-xs mt-1">Canbury Works Units 6 & 7, Canbury Business Park, Elm Crescent, Kingston upon Thames KT2 6HJ, UK</p>
          </div>
        </footer>
      )}
    </div>
  );

  return user ? <DashboardLayout>{supportContent}</DashboardLayout> : supportContent;
};

export default SupportPage;
