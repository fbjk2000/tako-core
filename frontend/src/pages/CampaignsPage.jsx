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
import { toast } from 'sonner';
import axios from 'axios';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Plus, Mail, Send, Zap, Eye, MousePointer, RefreshCw, Check, ExternalLink, Users, Radio } from 'lucide-react';

const CampaignsPage = () => {
  const { token } = useAuth();
  const [campaigns, setCampaigns] = useState([]);
  const { t } = useT();
  const [loading, setLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isAIDraftOpen, setIsAIDraftOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [newCampaign, setNewCampaign] = useState({
    name: '',
    subject: '',
    content: '',
    channel_type: 'email'
  });

  // Kit.com states
  const [kitAccount, setKitAccount] = useState(null);
  const [kitForms, setKitForms] = useState([]);
  const [kitTags, setKitTags] = useState([]);
  const [kitSubscribers, setKitSubscribers] = useState(null);
  const [kitLoading, setKitLoading] = useState(false);
  const [leadMagnetSubscribers, setLeadMagnetSubscribers] = useState([]);

  const headers = token ? { Authorization: `Bearer ${token}` } : {};

  useEffect(() => {
    if (!token) return;
    fetchCampaigns();
    fetchKitData();
    fetchLeadMagnetSubscribers();
  }, [token]);

  const fetchCampaigns = async () => {
    try {
      const response = await axios.get(`${API}/campaigns`, {
        headers,
        withCredentials: true
      });
      setCampaigns(response.data);
    } catch (error) {
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

  const fetchLeadMagnetSubscribers = async () => {
    try {
      const response = await axios.get(`${API}/lead-magnet/subscribers`, {
        headers,
        withCredentials: true
      });
      setLeadMagnetSubscribers(response.data.subscribers || []);
    } catch (error) {
      console.error('Failed to fetch lead magnet subscribers');
    }
  };

  const handleAddCampaign = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/campaigns`, newCampaign, { headers, withCredentials: true });
      toast.success('Campaign created successfully');
      setIsAddDialogOpen(false);
      setNewCampaign({ name: '', subject: '', content: '', channel_type: 'email' });
      fetchCampaigns();
    } catch (error) {
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
      const response = await axios.post(`${API}/ai/draft-email`, {
        purpose: 'introduction'
      }, { headers, withCredentials: true });
      
      setNewCampaign({
        ...newCampaign,
        subject: response.data.subject,
        content: response.data.content
      });
      setIsAIDraftOpen(false);
      toast.success('AI draft generated');
    } catch (error) {
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

  return (
    <DashboardLayout>
      <div className="space-y-6" data-testid="campaigns-page">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900" data-testid="campaigns-title">Email Campaigns</h1>
            <p className="text-slate-600 mt-1">Create and manage email marketing campaigns</p>
          </div>
          <div className="flex gap-3">
            <Dialog open={isAIDraftOpen} onOpenChange={setIsAIDraftOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" data-testid="ai-draft-btn">
                  <Zap className="w-4 h-4 mr-2" />
                  AI Draft
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Generate Email with AI</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <p className="text-sm text-slate-600">
                    Let AI help you draft a professional email for your campaign.
                  </p>
                  <Button
                    onClick={handleAIDraft}
                    disabled={aiLoading}
                    className="w-full bg-[#0EA5A0] hover:bg-teal-700"
                    data-testid="generate-ai-btn"
                  >
                    {aiLoading ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <Zap className="w-4 h-4 mr-2" />
                        Generate Introduction Email
                      </>
                    )}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-[#0EA5A0] hover:bg-teal-700" data-testid="create-campaign-btn">
                  <Plus className="w-4 h-4 mr-2" />
                  New Campaign
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Create Email Campaign</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleAddCampaign} className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label>Campaign Name *</Label>
                    <Input
                      value={newCampaign.name}
                      onChange={(e) => setNewCampaign({ ...newCampaign, name: e.target.value })}
                      placeholder="e.g., Q1 Newsletter"
                      required
                      data-testid="campaign-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Channel</Label>
                    <Select value={newCampaign.channel_type} onValueChange={v => setNewCampaign({ ...newCampaign, channel_type: v })}>
                      <SelectTrigger data-testid="campaign-channel">
                        <SelectValue />
                      </SelectTrigger>
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
                        <Input
                          value={newCampaign.subject}
                          onChange={(e) => setNewCampaign({ ...newCampaign, subject: e.target.value })}
                          placeholder="Your email subject"
                          required
                          data-testid="campaign-subject"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Email Content *</Label>
                        <Textarea
                          value={newCampaign.content}
                          onChange={(e) => setNewCampaign({ ...newCampaign, content: e.target.value })}
                          placeholder="Write your email content..."
                          rows={6}
                          required
                          data-testid="campaign-content"
                        />
                      </div>
                    </>
                  ) : (
                    <div className="rounded-lg bg-[#0EA5A0]/5 border border-[#0EA5A0]/20 p-4 space-y-2">
                      <div className="flex items-center gap-2 text-[#0EA5A0] font-medium text-sm">
                        <Radio className="w-4 h-4" />
                        Social Listener Campaign
                      </div>
                      <p className="text-xs text-slate-600">
                        This campaign type uses a <strong>Listener</strong> instead of a recipient list.
                        After creating, go to <strong>Listeners</strong> in the sidebar to configure keywords,
                        sources, and polling cadence.
                      </p>
                      <p className="text-xs text-slate-400">Subject and content are not used for social campaigns.</p>
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

        {/* Tabs for Campaigns and Kit.com */}
        <Tabs defaultValue="campaigns" className="space-y-6">
          <TabsList data-testid="campaigns-tabs">
            <TabsTrigger value="campaigns">{ t('campaigns.title') }</TabsTrigger>
            <TabsTrigger value="kit">Kit.com (Optional)</TabsTrigger>
            <TabsTrigger value="subscribers">Lead Magnet Subscribers</TabsTrigger>
          </TabsList>

          {/* Campaigns Tab */}
          <TabsContent value="campaigns" className="space-y-6">
            {/* Email Integration Banner */}
            <Card className="bg-emerald-50 border-emerald-100" data-testid="email-connected-banner">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                      <Check className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-emerald-900">Email Sending Ready</p>
                      <p className="text-sm text-emerald-700">Campaigns sent via Resend (tako.software){kitAccount?.status === 'active' ? ' + Kit.com' : ''}</p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={fetchKitData} disabled={kitLoading}>
                    <RefreshCw className={`w-4 h-4 mr-2 ${kitLoading ? 'animate-spin' : ''}`} />
                    Sync
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Campaigns List */}
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-8 h-8 border-2 border-[#0EA5A0] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : campaigns.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Mail className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-600 mb-4">No campaigns yet</p>
                  <Button
                    onClick={() => setIsAddDialogOpen(true)}
                    className="bg-[#0EA5A0] hover:bg-teal-700"
                  >
                    Create your first campaign
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4" data-testid="campaigns-list">
                {campaigns.map((campaign, index) => (
                  <Card key={campaign.campaign_id} className="hover:shadow-md transition-shadow" data-testid={`campaign-card-${index}`}>
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="font-semibold text-slate-900 truncate">{campaign.name}</h3>
                            <span className={`text-xs px-2 py-1 rounded-full capitalize ${getStatusColor(campaign.status)}`}>
                              {campaign.status}
                            </span>
                            {campaign.channel_type && campaign.channel_type !== 'email' && (
                              <span className="text-xs px-2 py-1 rounded-full bg-[#0EA5A0]/10 text-[#0EA5A0] capitalize flex items-center gap-1">
                                <Radio className="w-3 h-3" />{campaign.channel_type}
                              </span>
                            )}
                          </div>
                          {campaign.channel_type === 'email' || !campaign.channel_type
                            ? <p className="text-sm text-slate-600 mb-2">Subject: {campaign.subject}</p>
                            : <p className="text-sm text-slate-500 mb-2">Social listener campaign — configure in Listeners</p>
                          }
                          <p className="text-sm text-slate-500 line-clamp-2">{campaign.content}</p>
                        </div>
                        <div className="flex items-center gap-4 ml-4">
                          <div className="flex items-center gap-6 text-sm text-slate-500">
                            <div className="text-center">
                              <div className="flex items-center gap-1">
                                <Send className="w-4 h-4" />
                                <span className="font-semibold">{campaign.sent_count}</span>
                              </div>
                              <span className="text-xs">Sent</span>
                            </div>
                            <div className="text-center">
                              <div className="flex items-center gap-1">
                                <Eye className="w-4 h-4" />
                                <span className="font-semibold">{campaign.open_count}</span>
                              </div>
                              <span className="text-xs">Opens</span>
                            </div>
                            <div className="text-center">
                              <div className="flex items-center gap-1">
                                <MousePointer className="w-4 h-4" />
                                <span className="font-semibold">{campaign.click_count}</span>
                              </div>
                              <span className="text-xs">Clicks</span>
                            </div>
                          </div>
                          {campaign.status === 'draft' && (
                            <Button
                              size="sm"
                              className="bg-[#0EA5A0] hover:bg-teal-700"
                              onClick={() => handleSendCampaign(campaign.campaign_id)}
                              data-testid={`send-campaign-${index}`}
                            >
                              <Send className="w-4 h-4 mr-2" />
                              Send Campaign
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

          {/* Kit.com Integration Tab */}
          <TabsContent value="kit" className="space-y-6">
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Account Info */}
              <Card data-testid="kit-account-card">
                <CardHeader>
                  <CardTitle className="text-lg">Account</CardTitle>
                  <CardDescription>Your Kit.com account details</CardDescription>
                </CardHeader>
                <CardContent>
                  {kitLoading ? (
                    <div className="animate-pulse space-y-2">
                      <div className="h-4 bg-slate-200 rounded w-3/4"></div>
                      <div className="h-4 bg-slate-200 rounded w-1/2"></div>
                    </div>
                  ) : kitAccount ? (
                    <div className="space-y-2">
                      <p className="text-sm"><span className="text-slate-500">Name:</span> {kitAccount.name}</p>
                      <p className="text-sm"><span className="text-slate-500">Plan:</span> {kitAccount.plan_type || 'Active'}</p>
                      <a
                        href="https://app.kit.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-[#0EA5A0] hover:text-teal-700 flex items-center gap-1 mt-4"
                      >
                        Open Kit.com Dashboard <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">Loading account data...</p>
                  )}
                </CardContent>
              </Card>

              {/* Forms */}
              <Card data-testid="kit-forms-card">
                <CardHeader>
                  <CardTitle className="text-lg">Forms</CardTitle>
                  <CardDescription>{kitForms.length} forms available</CardDescription>
                </CardHeader>
                <CardContent>
                  {kitForms.length > 0 ? (
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {kitForms.map((form) => (
                        <div key={form.id} className="flex items-center justify-between text-sm p-2 bg-slate-50 rounded">
                          <span className="truncate">{form.name}</span>
                          <span className="text-slate-500 text-xs">{form.subscribers_count || 0}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">No forms found</p>
                  )}
                </CardContent>
              </Card>

              {/* Tags */}
              <Card data-testid="kit-tags-card">
                <CardHeader>
                  <CardTitle className="text-lg">Tags</CardTitle>
                  <CardDescription>{kitTags.length} tags created</CardDescription>
                </CardHeader>
                <CardContent>
                  {kitTags.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {kitTags.slice(0, 10).map((tag) => (
                        <span key={tag.id} className="text-xs px-2 py-1 bg-teal-100 text-teal-700 rounded-full">
                          {tag.name}
                        </span>
                      ))}
                      {kitTags.length > 10 && (
                        <span className="text-xs text-slate-500">+{kitTags.length - 10} more</span>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">No tags found</p>
                  )}
                </CardContent>
              </Card>

              {/* Subscribers Count */}
              <Card data-testid="kit-subscribers-card">
                <CardHeader>
                  <CardTitle className="text-lg">Subscribers</CardTitle>
                  <CardDescription>Total Kit.com subscribers</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-teal-100 rounded-xl flex items-center justify-center">
                      <Users className="w-6 h-6 text-[#0EA5A0]" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-slate-900">
                        {kitSubscribers?.total_subscribers || '—'}
                      </p>
                      <p className="text-sm text-slate-500">total subscribers</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Lead Magnet Subscribers Tab */}
          <TabsContent value="subscribers" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Lead Magnet Subscribers</CardTitle>
                    <CardDescription>
                      People who downloaded the LinkedIn Lead Generation Guide
                    </CardDescription>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-[#0EA5A0]">{leadMagnetSubscribers.length}</p>
                    <p className="text-sm text-slate-500">total downloads</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {leadMagnetSubscribers.length === 0 ? (
                  <div className="text-center py-8">
                    <Mail className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                    <p className="text-slate-600">No subscribers yet</p>
                    <p className="text-sm text-slate-500 mt-1">
                      Share your landing page to start collecting leads
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full" data-testid="subscribers-table">
                      <thead>
                        <tr className="border-b border-slate-200">
                          <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">Email</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">Name</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">Source</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">Kit Synced</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {leadMagnetSubscribers.map((sub, index) => (
                          <tr key={index} className="border-b border-slate-100 hover:bg-slate-50">
                            <td className="py-3 px-4 text-sm text-slate-900">{sub.email}</td>
                            <td className="py-3 px-4 text-sm text-slate-600">{sub.first_name || '—'}</td>
                            <td className="py-3 px-4">
                              <span className="text-xs px-2 py-1 bg-teal-100 text-teal-700 rounded-full">
                                {sub.source || 'lead_magnet'}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              {sub.kit_synced ? (
                                <Check className="w-4 h-4 text-emerald-500" />
                              ) : (
                                <span className="text-xs text-slate-400">Pending</span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-sm text-slate-500">
                              {new Date(sub.subscribed_at).toLocaleDateString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default CampaignsPage;
