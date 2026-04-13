import React, { useState } from 'react';
import { useAuth, API } from '../App';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Badge } from './ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from './ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { toast } from 'sonner';
import axios from 'axios';
import {
  Sparkles,
  Mail,
  Search,
  FileText,
  Copy,
  Send,
  Loader2,
  User,
  Building,
  Target,
  CheckSquare,
  X,
  Wand2
} from 'lucide-react';

// Smart Search Component
export const SmartSearch = ({ onSelectResult }) => {
  const { token } = useAuth();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const response = await axios.post(`${API}/ai/smart-search?query=${encodeURIComponent(query)}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setResults(response.data);
    } catch (error) {
      toast.error('Search failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2" data-testid="smart-search-btn">
          <Search className="w-4 h-4" />
          <Sparkles className="w-3 h-3 text-[#A100FF]" />
          Smart Search
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[#A100FF]" />
            AI Smart Search
          </DialogTitle>
          <DialogDescription>Search across leads, deals, tasks, and companies using natural language</DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 pt-4">
          <div className="flex gap-2">
            <Input
              placeholder="Try: 'Show me qualified leads from tech companies' or 'High value deals closing this month'"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="flex-1"
              data-testid="smart-search-input"
            />
            <Button onClick={handleSearch} disabled={loading} className="bg-[#A100FF] hover:bg-purple-700">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            </Button>
          </div>

          {results && (
            <div className="space-y-4">
              {/* AI Summary */}
              {results.ai_summary && (
                <div className="p-4 bg-purple-50 rounded-lg border border-purple-100">
                  <div className="flex items-start gap-2">
                    <Sparkles className="w-4 h-4 text-[#A100FF] mt-0.5" />
                    <p className="text-sm text-slate-700">{results.ai_summary}</p>
                  </div>
                </div>
              )}

              {/* Results by category */}
              <div className="grid grid-cols-2 gap-2 text-sm">
                <Badge variant="outline" className="justify-center py-1">
                  <User className="w-3 h-3 mr-1" /> {results.leads?.length || 0} Leads
                </Badge>
                <Badge variant="outline" className="justify-center py-1">
                  <Target className="w-3 h-3 mr-1" /> {results.deals?.length || 0} Deals
                </Badge>
                <Badge variant="outline" className="justify-center py-1">
                  <CheckSquare className="w-3 h-3 mr-1" /> {results.tasks?.length || 0} Tasks
                </Badge>
                <Badge variant="outline" className="justify-center py-1">
                  <Building className="w-3 h-3 mr-1" /> {results.companies?.length || 0} Companies
                </Badge>
              </div>

              {/* Leads Results */}
              {results.leads?.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-slate-700 mb-2">Leads</h4>
                  <div className="space-y-2">
                    {results.leads.map((lead) => (
                      <div key={lead.lead_id} className="p-3 bg-slate-50 rounded-lg hover:bg-slate-100 cursor-pointer transition-colors"
                           onClick={() => { onSelectResult?.('lead', lead); setIsOpen(false); }}>
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-slate-900">{lead.first_name} {lead.last_name}</p>
                            <p className="text-sm text-slate-500">{lead.company} • {lead.job_title}</p>
                          </div>
                          <Badge variant={lead.status === 'qualified' ? 'default' : 'secondary'} className="capitalize">
                            {lead.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Deals Results */}
              {results.deals?.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-slate-700 mb-2">Deals</h4>
                  <div className="space-y-2">
                    {results.deals.map((deal) => (
                      <div key={deal.deal_id} className="p-3 bg-slate-50 rounded-lg hover:bg-slate-100 cursor-pointer transition-colors"
                           onClick={() => { onSelectResult?.('deal', deal); setIsOpen(false); }}>
                        <div className="flex items-center justify-between">
                          <p className="font-medium text-slate-900">{deal.name}</p>
                          <div className="flex items-center gap-2">
                            <span className="text-emerald-600 font-semibold">€{deal.value?.toLocaleString()}</span>
                            <Badge variant="outline" className="capitalize">{deal.stage}</Badge>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tasks Results */}
              {results.tasks?.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-slate-700 mb-2">Tasks</h4>
                  <div className="space-y-2">
                    {results.tasks.map((task) => (
                      <div key={task.task_id} className="p-3 bg-slate-50 rounded-lg hover:bg-slate-100 cursor-pointer transition-colors"
                           onClick={() => { onSelectResult?.('task', task); setIsOpen(false); }}>
                        <div className="flex items-center justify-between">
                          <p className="font-medium text-slate-900">{task.title}</p>
                          <Badge variant={task.status === 'done' ? 'default' : 'secondary'} className="capitalize">
                            {task.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {results.total_count === 0 && (
                <p className="text-center text-slate-500 py-4">No results found. Try different search terms.</p>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

// Email Composer Component
export const AIEmailComposer = ({ leadId, leadName, onClose }) => {
  const { token } = useAuth();
  const [purpose, setPurpose] = useState('introduction');
  const [tone, setTone] = useState('professional');
  const [customContext, setCustomContext] = useState('');
  const [email, setEmail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(!!onClose);

  const handleOpenChange = (open) => {
    setIsOpen(open);
    if (!open && onClose) onClose();
  };

  const generateEmail = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        purpose,
        tone,
        ...(leadId && { lead_id: leadId }),
        ...(customContext && { custom_context: customContext })
      });
      
      const response = await axios.post(`${API}/ai/draft-email?${params}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setEmail(response.data);
      toast.success('Email generated!');
    } catch (error) {
      toast.error('Failed to generate email');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard!');
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      {!onClose && (
        <DialogTrigger asChild>
          <Button variant="outline" className="gap-2" data-testid="ai-email-btn">
            <Mail className="w-4 h-4" />
            <Sparkles className="w-3 h-3 text-[#A100FF]" />
            {leadId ? 'Draft Email' : 'AI Email'}
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="w-5 h-5 text-[#A100FF]" />
            AI Email Composer
            {leadName && <Badge variant="outline">{leadName}</Badge>}
          </DialogTitle>
          <DialogDescription>Generate personalized sales emails with AI assistance</DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 pt-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Email Purpose</Label>
              <Select value={purpose} onValueChange={setPurpose}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="introduction">Introduction</SelectItem>
                  <SelectItem value="follow_up">Follow Up</SelectItem>
                  <SelectItem value="proposal">Proposal</SelectItem>
                  <SelectItem value="meeting_request">Meeting Request</SelectItem>
                  <SelectItem value="check_in">Check In</SelectItem>
                  <SelectItem value="thank_you">Thank You</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tone</Label>
              <Select value={tone} onValueChange={setTone}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="professional">Professional</SelectItem>
                  <SelectItem value="friendly">Friendly</SelectItem>
                  <SelectItem value="casual">Casual</SelectItem>
                  <SelectItem value="formal">Formal</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Additional Context (optional)</Label>
            <Textarea
              placeholder="Add any specific details, offers, or context you want included..."
              value={customContext}
              onChange={(e) => setCustomContext(e.target.value)}
              rows={2}
            />
          </div>

          <Button onClick={generateEmail} disabled={loading} className="w-full bg-[#A100FF] hover:bg-purple-700">
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Generate Email
              </>
            )}
          </Button>

          {email && (
            <div className="space-y-4 pt-4 border-t">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Subject</Label>
                  <Button variant="ghost" size="sm" onClick={() => copyToClipboard(email.subject)}>
                    <Copy className="w-3 h-3 mr-1" /> Copy
                  </Button>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg font-medium">
                  {email.subject}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Email Body</Label>
                  <Button variant="ghost" size="sm" onClick={() => copyToClipboard(email.content)}>
                    <Copy className="w-3 h-3 mr-1" /> Copy
                  </Button>
                </div>
                <div className="p-4 bg-slate-50 rounded-lg whitespace-pre-wrap text-sm">
                  {email.content}
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => copyToClipboard(`Subject: ${email.subject}\n\n${email.content}`)}>
                  <Copy className="w-4 h-4 mr-2" />
                  Copy All
                </Button>
                <Button className="flex-1 bg-[#A100FF] hover:bg-purple-700" onClick={() => window.open(`mailto:?subject=${encodeURIComponent(email.subject)}&body=${encodeURIComponent(email.content)}`)}>
                  <Send className="w-4 h-4 mr-2" />
                  Open in Email Client
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

// Lead Summary Component
export const LeadSummary = ({ leadId, leadName }) => {
  const { token } = useAuth();
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const generateSummary = async () => {
    setLoading(true);
    try {
      const response = await axios.post(`${API}/ai/lead-summary/${leadId}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSummary(response.data);
    } catch (error) {
      toast.error('Failed to generate summary');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { setIsOpen(open); if (open && !summary) generateSummary(); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2" data-testid="lead-summary-btn">
          <FileText className="w-4 h-4" />
          <Sparkles className="w-3 h-3 text-[#A100FF]" />
          AI Summary
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[#A100FF]" />
            AI Lead Summary
            <Badge variant="outline">{leadName}</Badge>
          </DialogTitle>
          <DialogDescription>AI-powered analysis of this lead's profile and activity</DialogDescription>
        </DialogHeader>
        
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-[#A100FF]" />
            <span className="ml-3 text-slate-600">Analyzing lead data...</span>
          </div>
        ) : summary ? (
          <div className="space-y-4 pt-4">
            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
              <div className="p-4 bg-purple-50 rounded-lg text-center">
                <p className="text-2xl font-bold text-[#A100FF]">{summary.deals_count}</p>
                <p className="text-xs text-slate-600">Deals</p>
              </div>
              <div className="p-4 bg-emerald-50 rounded-lg text-center">
                <p className="text-2xl font-bold text-emerald-600">€{summary.total_deal_value?.toLocaleString()}</p>
                <p className="text-xs text-slate-600">Total Value</p>
              </div>
              <div className="p-4 bg-blue-50 rounded-lg text-center">
                <p className="text-2xl font-bold text-blue-600">{summary.tasks_count}</p>
                <p className="text-xs text-slate-600">Tasks</p>
              </div>
            </div>

            {/* AI Summary */}
            <div className="prose prose-sm max-w-none">
              <div className="p-4 bg-slate-50 rounded-lg whitespace-pre-wrap text-sm leading-relaxed">
                {summary.summary}
              </div>
            </div>

            <p className="text-xs text-slate-400 text-right">
              Generated {new Date(summary.generated_at).toLocaleString()}
            </p>
          </div>
        ) : (
          <div className="text-center py-8 text-slate-500">
            Click to generate AI summary
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default { SmartSearch, AIEmailComposer, LeadSummary };
