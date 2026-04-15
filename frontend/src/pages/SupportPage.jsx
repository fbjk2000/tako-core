import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../App';
import { useT } from '../useT';
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
const buildChecklist = (t) => [
  {
    group: t('support.checklistOrgSetup'),
    items: [
      { id: 'invite_team', label: t('support.inviteTeamLabel'), detail: t('support.inviteTeamDetail'), href: '/settings' },
      { id: 'custom_stages', label: t('support.customStagesLabel'), detail: t('support.customStagesDetail'), href: '/settings' },
      { id: 'custom_task_steps', label: t('support.customTaskStepsLabel'), detail: t('support.customTaskStepsDetail'), href: '/settings' },
    ]
  },
  {
    group: t('support.checklistImportData'),
    items: [
      { id: 'import_leads', label: t('support.importLeadsLabel'), detail: t('support.importLeadsDetail'), href: '/leads' },
      { id: 'import_contacts', label: t('support.importContactsLabel'), detail: t('support.importContactsDetail'), href: '/contacts' },
      { id: 'create_deals', label: t('support.createDealsLabel'), detail: t('support.createDealsDetail'), href: '/deals' },
    ]
  },
  {
    group: t('support.checklistIntegrations'),
    items: [
      { id: 'ai_key', label: t('support.aiKeyLabel'), detail: t('support.aiKeyDetail'), href: '/settings?tab=integrations' },
      { id: 'resend', label: t('support.resendLabel'), detail: t('support.resendDetail'), href: '/settings?tab=integrations' },
      { id: 'twilio', label: t('support.twilioLabel'), detail: t('support.twilioDetail'), href: '/settings?tab=integrations' },
      { id: 'google_cal', label: t('support.googleCalLabel'), detail: t('support.googleCalDetail'), href: '/settings?tab=integrations' },
    ]
  },
  {
    group: t('support.checklistCampaigns'),
    items: [
      { id: 'first_campaign', label: t('support.firstCampaignLabel'), detail: t('support.firstCampaignDetail'), href: '/campaigns' },
      { id: 'first_listener', label: t('support.firstListenerLabel'), detail: t('support.firstListenerDetail'), href: '/listeners' },
    ]
  },
  {
    group: t('support.checklistApi'),
    items: [
      { id: 'api_key', label: t('support.apiKeyLabel'), detail: t('support.apiKeyDetail'), href: '/settings?tab=api' },
    ]
  },
  {
    group: t('support.checklistDecisions'),
    items: [
      { id: 'meta_app', label: t('support.metaAppLabel'), detail: t('support.metaAppDetail'), href: null },
      { id: 'chrome_ext', label: t('support.chromeExtLabel'), detail: t('support.chromeExtDetail'), href: null },
      { id: 'token_enc', label: t('support.tokenEncLabel'), detail: t('support.tokenEncDetail'), href: null },
      { id: 'stripe_live', label: t('support.stripeLiveLabel'), detail: t('support.stripeLiveDetail'), href: null },
    ]
  },
];

const buildQuickStart = (t) => [
  { step: 1, title: t('support.qs1Title'), body: t('support.qs1Body'), icon: <Building className="w-5 h-5" /> },
  { step: 2, title: t('support.qs2Title'), body: t('support.qs2Body'), icon: <Users className="w-5 h-5" /> },
  { step: 3, title: t('support.qs3Title'), body: t('support.qs3Body'), icon: <Target className="w-5 h-5" /> },
  { step: 4, title: t('support.qs4Title'), body: t('support.qs4Body'), icon: <Settings className="w-5 h-5" /> },
  { step: 5, title: t('support.qs5Title'), body: t('support.qs5Body'), icon: <Megaphone className="w-5 h-5" /> },
  { step: 6, title: t('support.qs6Title'), body: t('support.qs6Body'), icon: <Radio className="w-5 h-5" /> },
];

// ─── FAQ ────────────────────────────────────────────────────────────────────
const buildFaqs = (t) => [
  {
    category: t('support.faqCatGettingStarted'),
    questions: [
      { q: t('support.faqGs1Q'), a: t('support.faqGs1A') },
      { q: t('support.faqGs2Q'), a: t('support.faqGs2A') },
      { q: t('support.faqGs3Q'), a: t('support.faqGs3A') },
      { q: t('support.faqGs4Q'), a: t('support.faqGs4A') },
    ]
  },
  {
    category: t('support.faqCatFeatures'),
    questions: [
      { q: t('support.faqFt1Q'), a: t('support.faqFt1A') },
      { q: t('support.faqFt2Q'), a: t('support.faqFt2A') },
      { q: t('support.faqFt3Q'), a: t('support.faqFt3A') },
      { q: t('support.faqFt4Q'), a: t('support.faqFt4A') },
      { q: t('support.faqFt5Q'), a: t('support.faqFt5A') },
      { q: t('support.faqFt6Q'), a: t('support.faqFt6A') },
      { q: t('support.faqFt7Q'), a: t('support.faqFt7A') },
    ]
  },
  {
    category: t('support.faqCatAi'),
    questions: [
      { q: t('support.faqAi1Q'), a: t('support.faqAi1A') },
      { q: t('support.faqAi2Q'), a: t('support.faqAi2A') },
      { q: t('support.faqAi3Q'), a: t('support.faqAi3A') },
    ]
  },
  {
    category: t('support.faqCatBilling'),
    questions: [
      { q: t('support.faqBl1Q'), a: t('support.faqBl1A') },
      { q: t('support.faqBl2Q'), a: t('support.faqBl2A') },
      { q: t('support.faqBl3Q'), a: t('support.faqBl3A') },
    ]
  },
  {
    category: t('support.faqCatSecurity'),
    questions: [
      { q: t('support.faqSc1Q'), a: t('support.faqSc1A') },
      { q: t('support.faqSc2Q'), a: t('support.faqSc2A') },
      { q: t('support.faqSc3Q'), a: t('support.faqSc3A') },
    ]
  }
];

// ─── Training modules ────────────────────────────────────────────────────────
const buildTrainingModules = (t) => [
  {
    title: t('support.tmDashboardTitle'),
    icon: <BarChart3 className="w-6 h-6" />,
    description: t('support.tmDashboardDesc'),
    steps: [t('support.tmDashboardStep1'), t('support.tmDashboardStep2'), t('support.tmDashboardStep3'), t('support.tmDashboardStep4')]
  },
  {
    title: t('support.tmLeadsTitle'),
    icon: <Users className="w-6 h-6" />,
    description: t('support.tmLeadsDesc'),
    steps: [t('support.tmLeadsStep1'), t('support.tmLeadsStep2'), t('support.tmLeadsStep3'), t('support.tmLeadsStep4'), t('support.tmLeadsStep5')]
  },
  {
    title: t('support.tmDealsTitle'),
    icon: <Target className="w-6 h-6" />,
    description: t('support.tmDealsDesc'),
    steps: [t('support.tmDealsStep1'), t('support.tmDealsStep2'), t('support.tmDealsStep3'), t('support.tmDealsStep4')]
  },
  {
    title: t('support.tmTasksTitle'),
    icon: <CheckSquare className="w-6 h-6" />,
    description: t('support.tmTasksDesc'),
    steps: [t('support.tmTasksStep1'), t('support.tmTasksStep2'), t('support.tmTasksStep3'), t('support.tmTasksStep4'), t('support.tmTasksStep5')]
  },
  {
    title: t('support.tmCampaignsTitle'),
    icon: <Megaphone className="w-6 h-6" />,
    description: t('support.tmCampaignsDesc'),
    steps: [t('support.tmCampaignsStep1'), t('support.tmCampaignsStep2'), t('support.tmCampaignsStep3'), t('support.tmCampaignsStep4')]
  },
  {
    title: t('support.tmListenersTitle'),
    icon: <Radio className="w-6 h-6" />,
    description: t('support.tmListenersDesc'),
    steps: [t('support.tmListenersStep1'), t('support.tmListenersStep2'), t('support.tmListenersStep3'), t('support.tmListenersStep4'), t('support.tmListenersStep5')]
  },
  {
    title: t('support.tmAiTitle'),
    icon: <Zap className="w-6 h-6" />,
    description: t('support.tmAiDesc'),
    steps: [t('support.tmAiStep1'), t('support.tmAiStep2'), t('support.tmAiStep3'), t('support.tmAiStep4'), t('support.tmAiStep5')]
  },
  {
    title: t('support.tmCalendarTitle'),
    icon: <Calendar className="w-6 h-6" />,
    description: t('support.tmCalendarDesc'),
    steps: [t('support.tmCalendarStep1'), t('support.tmCalendarStep2'), t('support.tmCalendarStep3'), t('support.tmCalendarStep4')]
  },
];

const buildSalesMethodologies = (t) => [
  { name: t('support.smSpinName'), best_for: t('support.smSpinBestFor'), description: t('support.smSpinDesc'), when_to_use: t('support.smSpinWhen'), in_tako: t('support.smSpinInTako') },
  { name: t('support.smChallengerName'), best_for: t('support.smChallengerBestFor'), description: t('support.smChallengerDesc'), when_to_use: t('support.smChallengerWhen'), in_tako: t('support.smChallengerInTako') },
  { name: t('support.smSolutionName'), best_for: t('support.smSolutionBestFor'), description: t('support.smSolutionDesc'), when_to_use: t('support.smSolutionWhen'), in_tako: t('support.smSolutionInTako') },
  { name: t('support.smMeddicName'), best_for: t('support.smMeddicBestFor'), description: t('support.smMeddicDesc'), when_to_use: t('support.smMeddicWhen'), in_tako: t('support.smMeddicInTako') },
  { name: t('support.smValueName'), best_for: t('support.smValueBestFor'), description: t('support.smValueDesc'), when_to_use: t('support.smValueWhen'), in_tako: t('support.smValueInTako') },
];

// ─── Component ───────────────────────────────────────────────────────────────
const SupportPage = () => {
  const { user } = useAuth();
  const { t } = useT();
  const [searchParams] = useSearchParams();
  const defaultTab = searchParams.get('tab') || 'onboarding';

  const CHECKLIST = buildChecklist(t);
  const QUICK_START = buildQuickStart(t);
  const faqs = buildFaqs(t);
  const trainingModules = buildTrainingModules(t);
  const salesMethodologies = buildSalesMethodologies(t);

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
    toast.success(t('support.messageReceived'));
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
              <Link to="/"><Button variant="ghost" size="sm"><ArrowLeft className="w-4 h-4 mr-2" />{t('support.back')}</Button></Link>
              <Link to="/login"><Button className="bg-[#0EA5A0] hover:bg-teal-700" size="sm">{t('support.signIn')}</Button></Link>
            </div>
          </div>
        </header>
      )}

      {/* Hero */}
      <section className="bg-gradient-to-r from-[#0EA5A0] to-teal-600 py-12 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-3xl font-bold text-white mb-2" data-testid="support-title">{t('support.heroTitle')}</h1>
          <p className="text-teal-100">{t('support.heroSubtitle')}</p>
        </div>
      </section>

      <main className="max-w-7xl mx-auto px-6 py-10">
        <Tabs defaultValue={defaultTab} className="space-y-8">
          <TabsList className="grid w-full grid-cols-5 max-w-2xl mx-auto" data-testid="support-tabs">
            <TabsTrigger value="onboarding" className="flex items-center gap-1.5 text-xs sm:text-sm"><CheckSquare className="w-4 h-4" />{t('support.tabStart')}</TabsTrigger>
            <TabsTrigger value="faq" className="flex items-center gap-1.5 text-xs sm:text-sm"><HelpCircle className="w-4 h-4" />{t('support.tabFaq')}</TabsTrigger>
            <TabsTrigger value="training" className="flex items-center gap-1.5 text-xs sm:text-sm"><BookOpen className="w-4 h-4" />{t('support.tabTraining')}</TabsTrigger>
            <TabsTrigger value="contact" className="flex items-center gap-1.5 text-xs sm:text-sm"><Mail className="w-4 h-4" />{t('support.tabContact')}</TabsTrigger>
            <TabsTrigger value="legal" className="flex items-center gap-1.5 text-xs sm:text-sm"><FileText className="w-4 h-4" />{t('support.tabLegal')}</TabsTrigger>
          </TabsList>

          {/* ── ONBOARDING TAB ───────────────────────────────────── */}
          <TabsContent value="onboarding" className="space-y-10">

            {/* Quick Start */}
            <div>
              <h2 className="text-2xl font-bold text-slate-900 mb-1">{t('support.onboardingTitle')}</h2>
              <p className="text-slate-500 text-sm mb-6">{t('support.onboardingDesc')}</p>
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
                  <h2 className="text-2xl font-bold text-slate-900">{t('support.setupChecklist')}</h2>
                  <p className="text-slate-500 text-sm mt-0.5">{t('support.setupChecklistDesc')}</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-[#0EA5A0]">{pct}%</p>
                  <p className="text-xs text-slate-400">{t('support.progressComplete').replace('{done}', doneItems).replace('{total}', totalItems)}</p>
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
              <h2 className="text-2xl font-bold text-slate-900 mb-6">{t('support.faqTitle')}</h2>
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
                <h2 className="text-2xl font-bold text-slate-900 mb-1">{t('support.trainingTitle')}</h2>
                <p className="text-slate-500 text-sm mb-6">{t('support.trainingDesc')}</p>
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
                  <h2 className="text-2xl font-bold text-slate-900">{t('support.salesMethodsTitle')}</h2>
                </div>
                <p className="text-slate-500 text-sm mb-6">{t('support.salesMethodsDesc')}</p>
                <div className="grid md:grid-cols-2 gap-5">
                  {salesMethodologies.map((m, idx) => (
                    <Card key={idx} className="border-l-4 border-l-[#0EA5A0]" data-testid={`methodology-${idx}`}>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base flex items-center gap-2">
                          <Award className="w-4 h-4 text-[#0EA5A0]" />{m.name}
                        </CardTitle>
                        <span className="text-xs text-emerald-700 font-medium bg-emerald-50 px-2 py-0.5 rounded-full w-fit">{t('support.bestFor').replace('{value}', m.best_for)}</span>
                      </CardHeader>
                      <CardContent className="space-y-2 pt-0">
                        <p className="text-xs text-slate-600">{m.description}</p>
                        <div className="p-2.5 bg-amber-50 rounded-lg">
                          <p className="text-xs font-medium text-amber-800 flex items-center gap-1.5 mb-0.5"><Clock className="w-3.5 h-3.5" />{t('support.whenToUse')}</p>
                          <p className="text-xs text-amber-700">{m.when_to_use}</p>
                        </div>
                        <div className="p-2.5 bg-teal-50 rounded-lg">
                          <p className="text-xs font-medium text-teal-800 flex items-center gap-1.5 mb-0.5"><Lightbulb className="w-3.5 h-3.5" />{t('support.inTako')}</p>
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
                  <CardTitle className="flex items-center gap-2 text-base"><Mail className="w-4 h-4 text-[#0EA5A0]" />{t('support.sendUsMessage')}</CardTitle>
                  <CardDescription>{t('support.respondIn24h')}</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleContactSubmit} className="space-y-4">
                    <div className="space-y-1.5"><Label>{t('support.contactNameLabel')}</Label><Input value={contactForm.name} onChange={e => setContactForm({ ...contactForm, name: e.target.value })} required data-testid="contact-name" /></div>
                    <div className="space-y-1.5"><Label>{t('support.contactEmailLabel')}</Label><Input type="email" value={contactForm.email} onChange={e => setContactForm({ ...contactForm, email: e.target.value })} required data-testid="contact-email" /></div>
                    <div className="space-y-1.5"><Label>{t('support.contactSubjectLabel')}</Label><Input value={contactForm.subject} onChange={e => setContactForm({ ...contactForm, subject: e.target.value })} required data-testid="contact-subject" /></div>
                    <div className="space-y-1.5"><Label>{t('support.contactMessageLabel')}</Label><Textarea value={contactForm.message} onChange={e => setContactForm({ ...contactForm, message: e.target.value })} rows={5} required data-testid="contact-message" /></div>
                    <Button type="submit" className="w-full bg-[#0EA5A0] hover:bg-teal-700" disabled={sending} data-testid="contact-submit">
                      {sending ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><Send className="w-4 h-4 mr-2" />{t('support.sendMessage')}</>}
                    </Button>
                  </form>
                </CardContent>
              </Card>

              <div className="space-y-5">
                <Card>
                  <CardContent className="p-5 space-y-4">
                    <h3 className="font-semibold text-slate-900">{t('support.contactInfo')}</h3>
                    <div className="flex items-start gap-3">
                      <Mail className="w-4 h-4 text-[#0EA5A0] mt-0.5 shrink-0" />
                      <div><p className="text-sm font-medium">{t('support.emailLabel')}</p><a href="mailto:support@tako.software" className="text-sm text-[#0EA5A0]">support@tako.software</a></div>
                    </div>
                    <div className="flex items-start gap-3">
                      <MapPin className="w-4 h-4 text-[#0EA5A0] mt-0.5 shrink-0" />
                      <div><p className="text-sm font-medium">{t('support.addressLabel')}</p><p className="text-xs text-slate-500">Fintery Ltd., Canbury Works Units 6 & 7, Canbury Business Park, Elm Crescent, Kingston upon Thames KT2 6HJ, UK</p></div>
                    </div>
                    <div className="flex items-start gap-3">
                      <Clock className="w-4 h-4 text-[#0EA5A0] mt-0.5 shrink-0" />
                      <div><p className="text-sm font-medium">{t('support.hoursLabel')}</p><p className="text-xs text-slate-500">{t('support.hoursValue')}</p></div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-teal-50 border-teal-100">
                  <CardContent className="p-5">
                    <h3 className="font-semibold text-slate-900 mb-1">{t('support.urgentTitle')}</h3>
                    <p className="text-sm text-teal-700 mb-3">{t('support.urgentDesc')}</p>
                    <a href="mailto:support@tako.software?subject=URGENT:">
                      <Button variant="outline" size="sm" className="border-teal-300 text-teal-700 hover:bg-teal-100"><Mail className="w-3.5 h-3.5 mr-2" />{t('support.sendUrgent')}</Button>
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
                <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Building className="w-4 h-4 text-[#0EA5A0]" />{t('support.companyInfo')}</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-2 gap-6 text-sm text-slate-600">
                    <div><p className="font-semibold text-slate-900 mb-1">{t('support.legalEntity')}</p><p><strong>Fintery Ltd.</strong><br />{t('support.registeredIn')}</p></div>
                    <div><p className="font-semibold text-slate-900 mb-1">{t('support.registeredAddress')}</p><p>Canbury Works, Units 6 & 7<br />Canbury Business Park, Elm Crescent<br />Kingston upon Thames, Surrey KT2 6HJ, UK</p></div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2 text-base"><FileText className="w-4 h-4 text-[#0EA5A0]" />{t('support.tosTitle')}</CardTitle></CardHeader>
                <CardContent className="text-sm text-slate-600 space-y-4">
                  <p className="text-xs text-slate-400">{t('support.lastUpdated')}</p>
                  <div><p className="font-semibold text-slate-900">{t('support.tos1Title')}</p><p>{t('support.tos1Body')}</p></div>
                  <div><p className="font-semibold text-slate-900">{t('support.tos2Title')}</p><p>{t('support.tos2Body')}</p></div>
                  <div><p className="font-semibold text-slate-900">{t('support.tos3Title')}</p><p>{t('support.tos3Body')}</p></div>
                  <div><p className="font-semibold text-slate-900">{t('support.tos4Title')}</p><p>{t('support.tos4Body')}</p></div>
                  <div><p className="font-semibold text-slate-900">{t('support.tos5Title')}</p><p>{t('support.tos5Body')}</p></div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Shield className="w-4 h-4 text-[#0EA5A0]" />{t('support.privacyTitle')}</CardTitle></CardHeader>
                <CardContent className="text-sm text-slate-600 space-y-4">
                  <p className="text-xs text-slate-400">{t('support.lastUpdated')}</p>
                  <div><p className="font-semibold text-slate-900">{t('support.privacyDataTitle')}</p><p>{t('support.privacyDataBody')}</p></div>
                  <div><p className="font-semibold text-slate-900">{t('support.privacyUseTitle')}</p><p>{t('support.privacyUseBody')}</p></div>
                  <div><p className="font-semibold text-slate-900">{t('support.privacyStorageTitle')}</p><p>{t('support.privacyStorageBody')}</p></div>
                  <div><p className="font-semibold text-slate-900">{t('support.privacyRightsTitle')}</p><p>{t('support.privacyRightsBody')}</p></div>
                  <div><p className="font-semibold text-slate-900">{t('support.privacyListenerTitle')}</p><p>{t('support.privacyListenerBody')}</p></div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-base">{t('support.cookieTitle')}</CardTitle></CardHeader>
                <CardContent className="text-sm text-slate-600">
                  {t('support.cookieBody')}
                </CardContent>
              </Card>

              <Card className="border-amber-200 bg-amber-50">
                <CardHeader><CardTitle className="text-amber-800 text-base">{t('support.disclaimerTitle')}</CardTitle></CardHeader>
                <CardContent className="text-amber-700 text-sm space-y-2">
                  <p>{t('support.disclaimer1')}</p>
                  <p>{t('support.disclaimer2')}</p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

        </Tabs>
      </main>

      {!user && (
        <footer className="bg-slate-900 py-8 px-6 mt-8">
          <div className="max-w-7xl mx-auto text-center">
            <p className="text-slate-400 text-sm">{t('support.footerCopyright').replace('{year}', new Date().getFullYear())}</p>
            <p className="text-slate-500 text-xs mt-1">Canbury Works Units 6 & 7, Canbury Business Park, Elm Crescent, Kingston upon Thames KT2 6HJ, UK</p>
          </div>
        </footer>
      )}
    </div>
  );

  return user ? <DashboardLayout>{supportContent}</DashboardLayout> : supportContent;
};

export default SupportPage;
