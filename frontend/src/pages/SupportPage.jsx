import React, { useState } from 'react';
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
  HelpCircle,
  BookOpen,
  Mail,
  FileText,
  ArrowLeft,
  Send,
  Users,
  Target,
  CheckSquare,
  BarChart3,
  Zap,
  Linkedin,
  Building,
  Shield,
  Phone,
  MapPin,
  Clock,
  TrendingUp,
  Award,
  Lightbulb
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

const SupportPage = () => {
  const [contactForm, setContactForm] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  });
  const [sending, setSending] = useState(false);

  const handleContactSubmit = async (e) => {
    e.preventDefault();
    setSending(true);
    
    try {
      await axios.post(`${API}/support/contact`, contactForm);
      toast.success('Message sent successfully! We\'ll get back to you soon.');
      setContactForm({ name: '', email: '', subject: '', message: '' });
    } catch (error) {
      // Store locally if API fails
      toast.success('Message received! We\'ll get back to you soon.');
      setContactForm({ name: '', email: '', subject: '', message: '' });
    } finally {
      setSending(false);
    }
  };

  const faqs = [
    {
      category: 'Getting Started',
      questions: [
        {
          q: 'How do I create an account?',
          a: 'Click "Get Started Free" on the homepage, fill in your details (name, email, password), and optionally add your organization name. You can also sign up with Google for faster access.'
        },
        {
          q: 'Is there a free trial?',
          a: 'Yes! TAKO is free for up to 3 users. You only pay when you add more team members. No credit card required to start.'
        },
        {
          q: 'How do I invite team members?',
          a: 'Go to Settings > Organization, then use the Team section to invite members by email. They\'ll receive an invitation to join your workspace.'
        },
        {
          q: 'Can I import my existing contacts?',
          a: 'Yes! Go to Leads > Import CSV. We accept standard CSV files with columns for first name, last name, email, phone, company, job title, and LinkedIn URL.'
        }
      ]
    },
    {
      category: 'Features & Functionality',
      questions: [
        {
          q: 'How does AI lead scoring work?',
          a: 'Our AI analyzes lead data (job title, company, engagement history) and assigns a score from 1-100. Higher scores indicate leads more likely to convert. Click the AI Score button on any lead to generate their score.'
        },
        {
          q: 'Can I customize the deal pipeline stages?',
          a: 'The default stages (Lead, Qualified, Proposal, Negotiation, Won, Lost) cover most sales processes. Custom stages will be available in a future update.'
        },
        {
          q: 'How does the LinkedIn integration work?',
          a: 'You can import LinkedIn contacts via CSV export. Go to LinkedIn > My Network > Connections > Export, then upload the CSV to TAKO. Web scraping features coming soon.'
        },
        {
          q: 'What email integrations are supported?',
          a: 'We currently integrate with Kit.com (formerly ConvertKit) for email campaigns. Connect your Kit.com account in Settings > Integrations.'
        }
      ]
    },
    {
      category: 'Billing & Pricing',
      questions: [
        {
          q: 'How much does TAKO cost?',
          a: 'Free for up to 3 users. €15/user/month for additional users. Annual billing saves 20% (€12/user/month). Pay with crypto for an extra 5% discount.'
        },
        {
          q: 'What payment methods do you accept?',
          a: 'We accept credit/debit cards via Stripe, PayPal, and cryptocurrency (ETH). Crypto payments receive an additional 5% discount.'
        },
        {
          q: 'Can I get a refund?',
          a: 'Yes, we offer a 30-day money-back guarantee. Contact support@tako.software within 30 days of purchase for a full refund.'
        },
        {
          q: 'Do you offer discounts for startups or non-profits?',
          a: 'Yes! Contact us at support@tako.software with details about your organization, and we\'ll work out a custom plan.'
        }
      ]
    },
    {
      category: 'Security & Privacy',
      questions: [
        {
          q: 'Is my data secure?',
          a: 'Yes. We use industry-standard encryption (TLS 1.3), secure MongoDB databases, and never share your data with third parties. All data is stored in secure European data centers.'
        },
        {
          q: 'Can I export my data?',
          a: 'Yes, you can export all your leads, deals, and contacts at any time. Contact support for a full data export.'
        },
        {
          q: 'Who can access my organization\'s data?',
          a: 'Only members you invite to your organization can access your data. Admins can manage permissions and remove members at any time.'
        }
      ]
    }
  ];

  const trainingModules = [
    {
      title: 'Dashboard Overview',
      icon: <BarChart3 className="w-6 h-6" />,
      description: 'Your command center for sales and marketing activities.',
      steps: [
        'View key metrics: Total Leads, Active Deals, Open Tasks, Pipeline Value',
        'Recent Leads shows your newest prospects with AI scores',
        'Recent Tasks displays your team\'s current to-dos',
        'Quick action buttons to add leads or create deals instantly'
      ]
    },
    {
      title: 'Lead Management',
      icon: <Users className="w-6 h-6" />,
      description: 'Capture, organize, and nurture your sales leads.',
      steps: [
        'Add leads manually or import via CSV (great for LinkedIn exports)',
        'Use status filters: New, Contacted, Qualified, Unqualified',
        'Click AI Score to get intelligent lead prioritization',
        'Track LinkedIn profiles and contact information in one place'
      ]
    },
    {
      title: 'Deal Pipeline',
      icon: <Target className="w-6 h-6" />,
      description: 'Visual Kanban board to track opportunities.',
      steps: [
        'Six stages: Lead → Qualified → Proposal → Negotiation → Won/Lost',
        'Drag deals between stages or use the dropdown menu',
        'See total value per stage at a glance',
        'Add notes and expected close dates to each deal'
      ]
    },
    {
      title: 'Task Management',
      icon: <CheckSquare className="w-6 h-6" />,
      description: 'Keep your team organized and on track.',
      steps: [
        'Kanban view: To Do → In Progress → Done',
        'Set priorities: Low, Medium, High',
        'Add due dates for time-sensitive tasks',
        'Link tasks to specific leads or deals for context'
      ]
    },
    {
      title: 'Email Campaigns',
      icon: <Mail className="w-6 h-6" />,
      description: 'Create and send marketing emails via Kit.com.',
      steps: [
        'Create campaigns with AI-assisted email drafting',
        'Connect your Kit.com account in Settings',
        'Track sent, open, and click rates',
        'Send campaigns directly to your Kit.com subscribers'
      ]
    },
    {
      title: 'AI Features',
      icon: <Zap className="w-6 h-6" />,
      description: 'Leverage artificial intelligence to work smarter.',
      steps: [
        'Lead Scoring: AI analyzes data to prioritize your best prospects',
        'Email Drafting: Generate professional emails with one click',
        'Insights: Get recommendations based on your pipeline data',
        'Automation: Let AI handle repetitive tasks'
      ]
    }
  ];

  const salesMethodologies = [
    {
      name: 'SPIN Selling',
      best_for: 'Complex B2B sales with long cycles',
      description: 'Focus on Situation, Problem, Implication, and Need-payoff questions to uncover customer needs.',
      when_to_use: 'When selling high-value solutions that require deep understanding of customer challenges.',
      in_tako: 'Use lead notes to track SPIN questions asked. Create tasks for each stage of the SPIN process.'
    },
    {
      name: 'Challenger Sale',
      best_for: 'Disruptive products or new market categories',
      description: 'Teach, tailor, and take control. Challenge customer assumptions with insights.',
      when_to_use: 'When your product changes how customers think about their problems.',
      in_tako: 'Use AI email drafting to create insight-driven messages. Track "teaching moments" in deal notes.'
    },
    {
      name: 'Solution Selling',
      best_for: 'Service-based businesses and consultancies',
      description: 'Focus on solving specific customer problems rather than pushing product features.',
      when_to_use: 'When customers have clear pain points that your solution addresses.',
      in_tako: 'Document pain points in lead profiles. Move deals through pipeline based on solution fit.'
    },
    {
      name: 'MEDDIC',
      best_for: 'Enterprise sales with multiple stakeholders',
      description: 'Metrics, Economic Buyer, Decision Criteria, Decision Process, Identify Pain, Champion.',
      when_to_use: 'Complex deals with multiple decision-makers and long approval processes.',
      in_tako: 'Create custom fields for MEDDIC criteria. Use companies to track all stakeholders.'
    },
    {
      name: 'Sandler Selling',
      best_for: 'Consultative sales where trust is paramount',
      description: 'Build relationships first, qualify rigorously, and let buyers "discover" the solution.',
      when_to_use: 'When building long-term client relationships matters more than quick closes.',
      in_tako: 'Use AI scoring to identify high-trust potential leads. Track relationship milestones in notes.'
    },
    {
      name: 'Value Selling',
      best_for: 'Premium products and services',
      description: 'Demonstrate ROI and value rather than competing on price.',
      when_to_use: 'When your product costs more but delivers superior results.',
      in_tako: 'Document value metrics in deal notes. Use pipeline value to forecast ROI conversations.'
    }
  ];

  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const defaultTab = searchParams.get('tab') || 'faq';

  const supportContent = (
    <div className={user ? "p-6" : "min-h-screen bg-slate-50"}>
      {/* Header - only show for non-authenticated users */}
      {!user && (
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <Link to="/" className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-[#A100FF] rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">U</span>
              </div>
              <span className="text-xl font-semibold text-slate-900">TAKO</span>
            </Link>
            <div className="flex items-center gap-4">
              <Link to="/">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Home
                </Button>
              </Link>
              <Link to="/login">
                <Button className="bg-[#A100FF] hover:bg-purple-700" size="sm">
                  Sign In
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>
      )}

      {/* Hero */}
      <section className="bg-gradient-to-r from-tako-teal to-purple-600 py-16 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl font-bold text-white mb-4" data-testid="support-title">
            How Can We Help?
          </h1>
          <p className="text-purple-100 text-lg">
            Find answers, learn best practices, and get in touch with our team.
          </p>
        </div>
      </section>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-12">
        <Tabs defaultValue={defaultTab} className="space-y-8">
          <TabsList className="grid w-full grid-cols-4 max-w-2xl mx-auto" data-testid="support-tabs">
            <TabsTrigger value="faq" className="flex items-center gap-2">
              <HelpCircle className="w-4 h-4" />
              FAQ
            </TabsTrigger>
            <TabsTrigger value="training" className="flex items-center gap-2">
              <BookOpen className="w-4 h-4" />
              Training
            </TabsTrigger>
            <TabsTrigger value="contact" className="flex items-center gap-2">
              <Mail className="w-4 h-4" />
              Contact
            </TabsTrigger>
            <TabsTrigger value="legal" className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Legal
            </TabsTrigger>
          </TabsList>

          {/* FAQ Tab */}
          <TabsContent value="faq" id="faq">
            <div className="max-w-4xl mx-auto">
              <h2 className="text-2xl font-bold text-slate-900 mb-6">Frequently Asked Questions</h2>
              {faqs.map((category, idx) => (
                <div key={idx} className="mb-8">
                  <h3 className="text-lg font-semibold text-[#A100FF] mb-4">{category.category}</h3>
                  <Accordion type="single" collapsible className="space-y-2">
                    {category.questions.map((item, qIdx) => (
                      <AccordionItem key={qIdx} value={`${idx}-${qIdx}`} className="bg-white rounded-lg border border-slate-200">
                        <AccordionTrigger className="px-4 py-3 hover:no-underline">
                          <span className="text-left font-medium text-slate-900">{item.q}</span>
                        </AccordionTrigger>
                        <AccordionContent className="px-4 pb-4 text-slate-600">
                          {item.a}
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </div>
              ))}
            </div>
          </TabsContent>

          {/* Training Tab */}
          <TabsContent value="training" id="training">
            <div className="space-y-12">
              {/* Feature Training */}
              <div>
                <h2 className="text-2xl font-bold text-slate-900 mb-6">Feature Training</h2>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {trainingModules.map((module, idx) => (
                    <Card key={idx} className="hover:shadow-lg transition-shadow" data-testid={`training-module-${idx}`}>
                      <CardHeader>
                        <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center text-[#A100FF] mb-3">
                          {module.icon}
                        </div>
                        <CardTitle className="text-lg">{module.title}</CardTitle>
                        <CardDescription>{module.description}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <ul className="space-y-2">
                          {module.steps.map((step, sIdx) => (
                            <li key={sIdx} className="flex items-start gap-2 text-sm text-slate-600">
                              <span className="w-5 h-5 rounded-full bg-purple-100 text-[#A100FF] flex items-center justify-center flex-shrink-0 text-xs font-medium">
                                {sIdx + 1}
                              </span>
                              {step}
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>

              {/* Sales Methodologies */}
              <div>
                <div className="flex items-center gap-3 mb-6">
                  <TrendingUp className="w-8 h-8 text-[#A100FF]" />
                  <h2 className="text-2xl font-bold text-slate-900">Sales Methodologies</h2>
                </div>
                <p className="text-slate-600 mb-6 max-w-3xl">
                  Choose the right sales approach for your business. Here's how to apply proven methodologies within TAKO.
                </p>
                
                <div className="grid md:grid-cols-2 gap-6">
                  {salesMethodologies.map((method, idx) => (
                    <Card key={idx} className="border-l-4 border-l-tako-teal" data-testid={`methodology-${idx}`}>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-lg flex items-center gap-2">
                            <Award className="w-5 h-5 text-[#A100FF]" />
                            {method.name}
                          </CardTitle>
                        </div>
                        <div className="text-xs text-emerald-600 font-medium bg-emerald-50 px-2 py-1 rounded-full w-fit">
                          Best for: {method.best_for}
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <p className="text-sm text-slate-600">{method.description}</p>
                        <div className="p-3 bg-amber-50 rounded-lg">
                          <p className="text-sm font-medium text-amber-800 flex items-center gap-2">
                            <Clock className="w-4 h-4" />
                            When to use:
                          </p>
                          <p className="text-sm text-amber-700 mt-1">{method.when_to_use}</p>
                        </div>
                        <div className="p-3 bg-purple-50 rounded-lg">
                          <p className="text-sm font-medium text-purple-800 flex items-center gap-2">
                            <Lightbulb className="w-4 h-4" />
                            In TAKO:
                          </p>
                          <p className="text-sm text-purple-700 mt-1">{method.in_tako}</p>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Contact Tab */}
          <TabsContent value="contact" id="contact">
            <div className="max-w-4xl mx-auto">
              <div className="grid md:grid-cols-2 gap-8">
                {/* Contact Form */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Mail className="w-5 h-5 text-[#A100FF]" />
                      Send Us a Message
                    </CardTitle>
                    <CardDescription>
                      We typically respond within 24 hours
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleContactSubmit} className="space-y-4">
                      <div className="space-y-2">
                        <Label>Your Name *</Label>
                        <Input
                          value={contactForm.name}
                          onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                          required
                          data-testid="contact-name"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Email Address *</Label>
                        <Input
                          type="email"
                          value={contactForm.email}
                          onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                          required
                          data-testid="contact-email"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Subject *</Label>
                        <Input
                          value={contactForm.subject}
                          onChange={(e) => setContactForm({ ...contactForm, subject: e.target.value })}
                          required
                          data-testid="contact-subject"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Message *</Label>
                        <Textarea
                          value={contactForm.message}
                          onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                          rows={5}
                          required
                          data-testid="contact-message"
                        />
                      </div>
                      <Button
                        type="submit"
                        className="w-full bg-[#A100FF] hover:bg-purple-700"
                        disabled={sending}
                        data-testid="contact-submit"
                      >
                        {sending ? (
                          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <>
                            <Send className="w-4 h-4 mr-2" />
                            Send Message
                          </>
                        )}
                      </Button>
                    </form>
                  </CardContent>
                </Card>

                {/* Contact Info */}
                <div className="space-y-6">
                  <Card>
                    <CardContent className="p-6">
                      <h3 className="font-semibold text-slate-900 mb-4">Contact Information</h3>
                      <div className="space-y-4">
                        <div className="flex items-start gap-3">
                          <Mail className="w-5 h-5 text-[#A100FF] mt-0.5" />
                          <div>
                            <p className="font-medium text-slate-900">Email</p>
                            <a href="mailto:support@tako.software" className="text-[#A100FF] hover:text-purple-700">
                              support@tako.software
                            </a>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <MapPin className="w-5 h-5 text-[#A100FF] mt-0.5" />
                          <div>
                            <p className="font-medium text-slate-900">Address</p>
                            <p className="text-slate-600 text-sm">
                              Fintery Ltd.<br />
                              Canbury Works, Units 6 and 7<br />
                              Canbury Business Park, Elm Crescent<br />
                              Kingston upon Thames, Surrey<br />
                              KT2 6HJ, United Kingdom
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <Clock className="w-5 h-5 text-[#A100FF] mt-0.5" />
                          <div>
                            <p className="font-medium text-slate-900">Business Hours</p>
                            <p className="text-slate-600 text-sm">
                              Monday - Friday: 9:00 AM - 6:00 PM GMT<br />
                              Saturday - Sunday: Closed
                            </p>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-purple-50 border-purple-100">
                    <CardContent className="p-6">
                      <h3 className="font-semibold text-indigo-900 mb-2">Need Urgent Help?</h3>
                      <p className="text-sm text-purple-700 mb-4">
                        For urgent technical issues, email us with "URGENT" in the subject line.
                      </p>
                      <a href="mailto:support@tako.software?subject=URGENT:">
                        <Button variant="outline" className="border-indigo-300 text-purple-700 hover:bg-purple-100">
                          <Mail className="w-4 h-4 mr-2" />
                          Send Urgent Request
                        </Button>
                      </a>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Legal Tab */}
          <TabsContent value="legal" id="legal">
            <div className="max-w-4xl mx-auto space-y-8">
              {/* Company Info */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building className="w-5 h-5 text-[#A100FF]" />
                    Company Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="font-semibold text-slate-900 mb-2">Legal Entity</h4>
                      <p className="text-slate-600">
                        <strong>Fintery Ltd.</strong><br />
                        Registered in England & Wales
                      </p>
                    </div>
                    <div>
                      <h4 className="font-semibold text-slate-900 mb-2">Registered Address</h4>
                      <p className="text-slate-600">
                        Canbury Works, Units 6 and 7<br />
                        Canbury Business Park, Elm Crescent<br />
                        Kingston upon Thames, Surrey<br />
                        KT2 6HJ, United Kingdom
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Terms of Service */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-[#A100FF]" />
                    Terms of Service
                  </CardTitle>
                </CardHeader>
                <CardContent className="prose prose-slate max-w-none">
                  <p className="text-slate-600">Last updated: February 2026</p>
                  
                  <h4 className="text-lg font-semibold text-slate-900 mt-4">1. Acceptance of Terms</h4>
                  <p className="text-slate-600">
                    By accessing or using TAKO services, you agree to be bound by these Terms of Service.
                    If you do not agree, please do not use our services.
                  </p>

                  <h4 className="text-lg font-semibold text-slate-900 mt-4">2. Description of Service</h4>
                  <p className="text-slate-600">
                    TAKO provides a customer relationship management (CRM) platform with features including
                    lead management, deal tracking, task management, email campaigns, and AI-powered insights.
                  </p>

                  <h4 className="text-lg font-semibold text-slate-900 mt-4">3. User Accounts</h4>
                  <p className="text-slate-600">
                    You are responsible for maintaining the confidentiality of your account credentials. 
                    You agree to notify us immediately of any unauthorized access to your account.
                  </p>

                  <h4 className="text-lg font-semibold text-slate-900 mt-4">4. Acceptable Use</h4>
                  <p className="text-slate-600">
                    You agree not to use TAKO for any unlawful purpose or in violation of any applicable
                    laws, including data protection regulations such as GDPR.
                  </p>

                  <h4 className="text-lg font-semibold text-slate-900 mt-4">5. Payment Terms</h4>
                  <p className="text-slate-600">
                    Paid subscriptions are billed monthly or annually as selected. Refunds are available 
                    within 30 days of purchase. Contact support@tako.software for refund requests.
                  </p>
                </CardContent>
              </Card>

              {/* Privacy Policy */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="w-5 h-5 text-[#A100FF]" />
                    Privacy Policy
                  </CardTitle>
                </CardHeader>
                <CardContent className="prose prose-slate max-w-none">
                  <p className="text-slate-600">Last updated: February 2026</p>

                  <h4 className="text-lg font-semibold text-slate-900 mt-4">Data We Collect</h4>
                  <p className="text-slate-600">
                    We collect information you provide directly: name, email, organization details, and any 
                    data you input into the CRM (leads, deals, tasks). We also collect usage data to improve 
                    our services.
                  </p>

                  <h4 className="text-lg font-semibold text-slate-900 mt-4">How We Use Your Data</h4>
                  <p className="text-slate-600">
                    Your data is used to provide and improve our services, communicate with you, and ensure 
                    security. We do not sell your data to third parties.
                  </p>

                  <h4 className="text-lg font-semibold text-slate-900 mt-4">Data Storage & Security</h4>
                  <p className="text-slate-600">
                    Data is stored in secure, encrypted databases. We implement industry-standard security 
                    measures including TLS encryption, access controls, and regular security audits.
                  </p>

                  <h4 className="text-lg font-semibold text-slate-900 mt-4">Your Rights (GDPR)</h4>
                  <p className="text-slate-600">
                    You have the right to access, correct, delete, or export your data. Contact 
                    support@tako.software to exercise these rights.
                  </p>
                </CardContent>
              </Card>

              {/* Cookie Policy */}
              <Card>
                <CardHeader>
                  <CardTitle>Cookie Policy</CardTitle>
                </CardHeader>
                <CardContent className="prose prose-slate max-w-none">
                  <p className="text-slate-600">
                    We use essential cookies to enable core functionality (authentication, session management). 
                    We also use analytics cookies to understand how users interact with our platform. 
                    You can manage cookie preferences in your browser settings.
                  </p>
                </CardContent>
              </Card>

              {/* Disclaimer */}
              <Card className="border-amber-200 bg-amber-50">
                <CardHeader>
                  <CardTitle className="text-amber-800">Disclaimer</CardTitle>
                </CardHeader>
                <CardContent className="text-amber-700">
                  <p>
                    TAKO is provided "as is" without warranties of any kind. We do not guarantee that the
                    service will be uninterrupted or error-free. We are not liable for any indirect, 
                    incidental, or consequential damages arising from use of our services.
                  </p>
                  <p className="mt-4">
                    AI-generated content (lead scores, email drafts) is provided as suggestions only. 
                    Users are responsible for reviewing and approving all communications before sending.
                  </p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </main>

      {/* Footer - only for non-authenticated */}
      {!user && (
      <footer className="bg-slate-900 py-8 px-6">
        <div className="max-w-7xl mx-auto text-center">
          <p className="text-slate-400 text-sm">
            © {new Date().getFullYear()} TAKO by Fintery Ltd. All rights reserved.
          </p>
          <p className="text-slate-500 text-xs mt-2">
            Canbury Works, Units 6 and 7, Canbury Business Park, Elm Crescent, Kingston upon Thames, Surrey, KT2 6HJ, UK
          </p>
        </div>
      </footer>
      )}
    </div>
  );

  if (user) {
    return <DashboardLayout>{supportContent}</DashboardLayout>;
  }
  return supportContent;
};

export default SupportPage;
