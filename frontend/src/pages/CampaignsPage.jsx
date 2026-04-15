import { useT } from '../useT';
import React, { useState, useEffect } from 'react';
import { useAuth, API } from '../App';
import DashboardLayout from '../components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { toast } from 'sonner';
import axios from 'axios';
import { Plus, Mail, Send, Zap, Eye, MousePointer, RefreshCw, Check, ExternalLink, Users, Radio, Megaphone } from 'lucide-react';

const channelIcon = (type) => {
  if (!type || type === 'email') return <Mail className="w-3.5 h-3.5" />;
  return <Radio className="w-3.5 h-3.5" />;
};

const CampaignsPage = () => {
  const { token } = useAuth();
  const [campaigns, setCampaigns] = useState([]);
  const { t } = useT();
  const [loading, setLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isAIDraftOpen, setIsAIDraftOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [newCampaign, setNewCampaign] = useState({
    name: '', subject: '', content: '', channel_type: 'email'
  });

  // Kit.com states
  const [kitAccount, setKitAccount] = useState(null);
  const [kitForms, setKitForms] = useState([]);
  const [kitTags, setKitTags] = useState([]);
  const [kitSubscribers, setKitSubscribers] = useState(null);
  const [kitLoading, setKitLoading] = useState(false);

  const headers = token ? { Authorization: `Bearer ${token}` } : {};

  useEffect(() => {
    if (!token) return;
    fetchCampaigns();
    fetchKitData();
  }, [token]); // eslint-disable-line

  const fetchCampaigns = async () => {
    try {
      const response = await axios.get(`${API}/campaigns`, { headers, withCredentials: true });
      setCampaigns(response.data);
    } catch {
      toast.error('Failed to fetch campaigns');
    } finally {
      setLoading(false);
    }
  };

  const fetchKitData = async () => {
    setKitLoading(true);
    try {
      const [accountRes, formsRes, tagsRes, subscribersRes] = await Promise.all([
        axios.get(`${API}/kit/account`, { headers, withCredentials: true }).catch(() => null),
        axios.get(`${API}/kit/forms`, { headers, withCredentials: true }).catch(() => null),
        axios.get(`${API}/kit/tags`, { headers, withCredentials: true }).catch(() => null),
        axios.get(`${API}/kit/subscribers`, { headers, withCredentials: true }).catch(() => null)
      ]);
      if (accountRes) setKitAccount(accountRes.data);
      if (formsRes) setKitForms(formsRes.data.forms || []);
      if (tagsRes) setKitTags(tagsRes.data.tags || []);
      if (subscribersRes) setKitSubscribers(subscribersRes.data);
    } catch (error) {
      console.error('Kit.com fetch error:', error);
    } finally {
      setKitLoading(false);
    }
  };

  const handleAddCampaign = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/campaigns`, newCampaign, { headers, withCredentials: true });
      toast.success('Campaign created');
      setIsAddDialogOpen(false);
      setNewCampaign({ name: '', subject: '', content: '', channel_type: 'email' });
      fetchCampaigns();
    } catch {
      toast.error('Failed to create campaign');
    }
  };

  const handleSendCampaign = async (campaignId) => {
    try {
      const res = await axios.post(`${API}/campaigns/${campaignId}/send`, {}, { headers, withCredentials: true });
      toast.success(res.data.message || 'Campaign sent!');
      fetchCampaigns();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to send campaign');
    }
  };

  const handleAIDraft = async () => {
    setAiLoading(true);
    try {
      const response = await axios.post(`${API}/ai/draft-email`, { purpose: 'introduction' }, { headers, withCredentials: true });
      setNewCampaign({ ...newCampaign, subject: response.data.subject, content: response.data.content });
      setIsAIDraftOpen(false);
      toast.success('AI draft generated');
    } catch {
      toast.error('Failed to generate AI draft');
    } finally {
      setAiLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'sent': return 'bg-emerald-100 text-emerald-700';
      case 'scheduled': return 'bg-teal-100 text-teal-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  const isEmail = (c) => !c.channel_type || c.channel_type === 'email';

  return (
    <DashboardLayout>
      <div className="space-y-6" data-testid="campaigns-page">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2" data-testid="campaigns-title">
              <Megaphone className="w-6 h-6 text-[#0EA5A0]" /> Campaigns
            </h1>
            <p className="text-slate-500 text-sm mt-1">Reach your audience across email and social channels</p>
          </div>
          <div className="flex gap-3">
            {/* AI Draft — email only, shown when dialog is open on email channel */}
            <Dialog open={isAIDraftOpen} onOpenChange={setIsAIDraftOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" data-testid="ai-draft-btn">
                  <Zap className="w-4 h-4 mr-2" /> AI Draft
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Generate Email with AI</DialogTitle></DialogHeader>
                <div className="space-y-4 pt-4">
                  <p className="text-sm text-slate-600">Let AI draft a professional introduction email for your campaign.</p>
                  <Button onClick={handleAIDraft} disabled={aiLoading} className="w-full bg-[#0EA5A0] hover:bg-teal-700" data-testid="generate-ai-btn">
                    {aiLoading
                      ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      : <><Zap className="w-4 h-4 mr-2" />Generate Introduction Email</>}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-[#0EA5A0] hover:bg-teal-700" data-testid="create-campaign-btn">
                  <Plus className="w-4 h-4 mr-2" /> New Campaign
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader><DialogTitle>Create Campaign</DialogTitle></DialogHeader>
                <form onSubmit={handleAddCampaign} className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label>Campaign Name *</Label>
                    <Input value={newCampaign.name} onChange={e => setNewCampaign({ ...newCampaign, name: e.target.value })} placeholder="e.g., Q2 Outreach" required data-testid="campaign-name" />
                  </div>
                  <div className="space-y-2">
                    <Label>Channel</Label>
                    <Select value={newCampaign.channel_type} onValueChange={v => setNewCampaign({ ...newCampaign, channel_type: v })}>
                      <SelectTrigger data-testid="campaign-channel"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="email"><span className="flex items-center gap-2"><Mail className="w-3.5 h-3.5" />Email</span></SelectItem>
                        <SelectItem value="facebook"><span className="flex items-center gap-2"><Radio className="w-3.5 h-3.5" />Facebook</span></SelectItem>
                        <SelectItem value="instagram"><span className="flex items-center gap-2"><Radio className="w-3.5 h-3.5" />Instagram</span></SelectItem>
                        <SelectItem value="linkedin"><span className="flex items-center gap-2"><Radio className="w-3.5 h-3.5" />LinkedIn</span></SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {newCampaign.channel_type === 'email' ? (
                    <>
                      <div className="space-y-2">
                        <Label>Subject Line *</Label>
                        <Input value={newCampaign.subject} onChange={e => setNewCampaign({ ...newCampaign, subject: e.target.value })} placeholder="Your email subject" required data-testid="campaign-subject" />
                      </div>
                      <div className="space-y-2">
                        <Label>Email Content *</Label>
                        <Textarea value={newCampaign.content} onChange={e => setNewCampaign({ ...newCampaign, content: e.target.value })} placeholder="Write your email content..." rows={6} required data-testid="campaign-content" />
                      </div>
                    </>
                  ) : (
                    <div className="rounded-lg bg-[#0EA5A0]/5 border border-[#0EA5A0]/20 p-4 space-y-2">
                      <div className="flex items-center gap-2 text-[#0EA5A0] font-medium text-sm">
                        <Radio className="w-4 h-4" /> Social Listener Campaign
                      </div>
                      <p className="text-xs text-slate-600">
                        This campaign uses a <strong>Listener</strong> to monitor social channels.
                        After creating, go to <strong>Listeners</strong> in the sidebar to configure keywords, sources, and polling cadence.
                      </p>
                    </div>
                  )}

                  <Button type="submit" className="w-full bg-[#0EA5A0] hover:bg-teal-700" data-testid="submit-campaign-btn">
                    Create Campaign
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="campaigns" className="space-y-6">
          <TabsList data-testid="campaigns-tabs">
            <TabsTrigger value="campaigns">All Campaigns</TabsTrigger>
            <TabsTrigger value="kit">Kit.com</TabsTrigger>
          </TabsList>

          {/* Campaigns Tab */}
          <TabsContent value="campaigns" className="space-y-4">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-8 h-8 border-2 border-[#0EA5A0] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : campaigns.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Megaphone className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-600 mb-1">No campaigns yet</p>
                  <p className="text-sm text-slate-400 mb-4">Create an email campaign or connect a social channel via Listeners</p>
                  <Button onClick={() => setIsAddDialogOpen(true)} className="bg-[#0EA5A0] hover:bg-teal-700">
                    Create your first campaign
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4" data-testid="campaigns-list">
                {campaigns.map((campaign, index) => (
                  <Card key={campaign.campaign_id} className="hover:shadow-md transition-shadow" data-testid={`campaign-card-${index}`}>
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3 min-w-0 flex-1">
                          <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center shrink-0 mt-0.5">
                            {isEmail(campaign) ? <Mail className="w-4 h-4 text-slate-500" /> : <Radio className="w-4 h-4 text-[#0EA5A0]" />}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-0.5">
                              <h3 className="font-semibold text-slate-900 truncate">{campaign.name}</h3>
                              <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${getStatusColor(campaign.status)}`}>{campaign.status}</span>
                              {campaign.channel_type && campaign.channel_type !== 'email' && (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-[#0EA5A0]/10 text-[#0EA5A0] capitalize">{campaign.channel_type}</span>
                              )}
                            </div>
                            {isEmail(campaign)
                              ? <p className="text-sm text-slate-500 truncate">{campaign.subject}</p>
                              : <p className="text-sm text-slate-400">Social listener campaign — configure in Listeners</p>
                            }
                          </div>
                        </div>

                        <div className="flex items-center gap-4 shrink-0">
                          {isEmail(campaign) && (
                            <div className="hidden sm:flex items-center gap-5 text-sm text-slate-400">
                              <div className="text-center">
                                <div className="flex items-center gap-1 justify-center">
                                  <Send className="w-3.5 h-3.5" />
                                  <span className="font-semibold text-slate-700">{campaign.sent_count || 0}</span>
                                </div>
                                <span className="text-xs">Sent</span>
                              </div>
                              <div className="text-center">
                                <div className="flex items-center gap-1 justify-center">
                                  <Eye className="w-3.5 h-3.5" />
                                  <span className="font-semibold text-slate-700">{campaign.open_count || 0}</span>
                                </div>
                                <span className="text-xs">Opens</span>
                              </div>
                              <div className="text-center">
                                <div className="flex items-center gap-1 justify-center">
                                  <MousePointer className="w-3.5 h-3.5" />
                                  <span className="font-semibold text-slate-700">{campaign.click_count || 0}</span>
                                </div>
                                <span className="text-xs">Clicks</span>
                              </div>
                            </div>
                          )}
                          {campaign.status === 'draft' && isEmail(campaign) && (
                            <Button size="sm" className="bg-[#0EA5A0] hover:bg-teal-700" onClick={() => handleSendCampaign(campaign.campaign_id)} data-testid={`send-campaign-${index}`}>
                              <Send className="w-3.5 h-3.5 mr-1.5" /> Send
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Kit.com Tab */}
          <TabsContent value="kit" className="space-y-6">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-500">Kit.com is used for email list management and automation.</p>
              <Button variant="outline" size="sm" onClick={fetchKitData} disabled={kitLoading}>
                <RefreshCw className={`w-4 h-4 mr-2 ${kitLoading ? 'animate-spin' : ''}`} /> Sync
              </Button>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              <Card data-testid="kit-account-card">
                <CardHeader>
                  <CardTitle className="text-base">Account</CardTitle>
                  <CardDescription>Your Kit.com account</CardDescription>
                </CardHeader>
                <CardContent>
                  {kitLoading ? (
                    <div className="animate-pulse space-y-2"><div className="h-4 bg-slate-200 rounded w-3/4" /><div className="h-4 bg-slate-200 rounded w-1/2" /></div>
                  ) : kitAccount ? (
                    <div className="space-y-2">
                      <p className="text-sm"><span className="text-slate-500">Name:</span> {kitAccount.name}</p>
                      <p className="text-sm"><span className="text-slate-500">Plan:</span> {kitAccount.plan_type || 'Active'}</p>
                      <a href="https://app.kit.com" target="_blank" rel="noopener noreferrer" className="text-sm text-[#0EA5A0] hover:text-teal-700 flex items-center gap-1 mt-4">
                        Open Kit.com <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-400">No Kit.com account connected. Add your API key in Settings → Integrations.</p>
                  )}
                </CardContent>
              </Card>

              <Card data-testid="kit-subscribers-card">
                <CardHeader>
                  <CardTitle className="text-base">Subscribers</CardTitle>
                  <CardDescription>Total Kit.com subscribers</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-teal-50 rounded-xl flex items-center justify-center">
                      <Users className="w-6 h-6 text-[#0EA5A0]" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-slate-900">{kitSubscribers?.total_subscribers || '—'}</p>
                      <p className="text-sm text-slate-500">total subscribers</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card data-testid="kit-forms-card">
                <CardHeader>
                  <CardTitle className="text-base">Forms</CardTitle>
                  <CardDescription>{kitForms.length} forms</CardDescription>
                </CardHeader>
                <CardContent>
                  {kitForms.length > 0 ? (
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {kitForms.map(form => (
                        <div key={form.id} className="flex items-center justify-between text-sm p-2 bg-slate-50 rounded">
                          <span className="truncate">{form.name}</span>
                          <span className="text-slate-400 text-xs">{form.subscribers_count || 0}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-400">No forms found</p>
                  )}
                </CardContent>
              </Card>

              {kitTags.length > 0 && (
                <Card data-testid="kit-tags-card">
                  <CardHeader>
                    <CardTitle className="text-base">Tags</CardTitle>
                    <CardDescription>{kitTags.length} tags</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {kitTags.slice(0, 12).map(tag => (
                        <span key={tag.id} className="text-xs px-2 py-1 bg-teal-50 text-teal-700 rounded-full">{tag.name}</span>
                      ))}
                      {kitTags.length > 12 && <span className="text-xs text-slate-400">+{kitTags.length - 12} more</span>}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default CampaignsPage;
