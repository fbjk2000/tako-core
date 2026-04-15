import React, { useState, useEffect } from 'react';
import { useAuth, API } from '../App';
import { useSearchParams, useNavigate } from 'react-router-dom';
import DashboardLayout from '../components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Badge } from '../components/ui/badge';
import { Switch } from '../components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { toast } from 'sonner';
import axios from 'axios';
import { 
  User,
  Building,
  Mail,
  Plus,
  CreditCard, 
  FileText, 
  Download,
  ExternalLink,
  CheckCircle,
  Clock,
  Zap,
  Users,
  Copy,
  Link,
  Gift,
  Layers,
  Edit,
  Trash2,
  Save,
  Crown,
  Send,
  Upload,
  UserPlus,
  X,
  Key,
  CheckSquare,
  Eye,
  EyeOff
} from 'lucide-react';

const SettingsPage = () => {
  const { user, token, checkAuth } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [organization, setOrganization] = useState(null);
  const [orgSettings, setOrgSettings] = useState(null);
  const [members, setMembers] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [affiliateStatus, setAffiliateStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [newOrgName, setNewOrgName] = useState('');
  const [creatingOrg, setCreatingOrg] = useState(false);
  const [apiKeys, setApiKeys] = useState([]);
  const [webhooks, setWebhooks] = useState([]);
  const [newKeyName, setNewKeyName] = useState('');
  const [generatedKey, setGeneratedKey] = useState('');
  const [newWebhookUrl, setNewWebhookUrl] = useState('');
  const [newWebhookName, setNewWebhookName] = useState('');
  const [editingStages, setEditingStages] = useState(false);
  const [dealStages, setDealStages] = useState([]);
  const [editingTaskStages, setEditingTaskStages] = useState(false);
  const [taskStages, setTaskStages] = useState([]);
  const [isPipelineDialogOpen, setIsPipelineDialogOpen] = useState(false);
  const [newPipeline, setNewPipeline] = useState({ name: '', stages: [] });
  
  // LLM / AI integration states
  const [aiStatus, setAiStatus] = useState(null);
  const [llmKeys, setLlmKeys] = useState({ anthropic_api_key: '', openai_api_key: '' });
  const [savingLlm, setSavingLlm] = useState(false);
  const [showAnthropicKey, setShowAnthropicKey] = useState(false);
  const [showOpenaiKey, setShowOpenaiKey] = useState(false);

  // Invitation states
  const [inviteLink, setInviteLink] = useState(null);
  const [inviteEmails, setInviteEmails] = useState('');
  const [inviteRole, setInviteRole] = useState('member');
  const [pendingInvites, setPendingInvites] = useState([]);
  const [sendingInvites, setSendingInvites] = useState(false);
  const [generatingLink, setGeneratingLink] = useState(false);

  // Profile editing
  const [profileForm, setProfileForm] = useState({ name: '', picture: '', timezone: '' });
  const [savingProfile, setSavingProfile] = useState(false);
  const [pwForm, setPwForm] = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [savingPassword, setSavingPassword] = useState(false);
  const [pwShow, setPwShow] = useState({ current: false, next: false, confirm: false });
  const [pwJustChanged, setPwJustChanged] = useState(false);

  const defaultTab = searchParams.get('tab') || 'profile';
  const headers = token ? { Authorization: `Bearer ${token}` } : {};

  useEffect(() => {
    fetchOrganization();
    fetchInvoices();
    fetchAffiliateStatus();
    fetchApiKeysAndWebhooks();
    fetchAiStatus();
    fetchLlmKeys();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (organization) {
      fetchOrgSettings();
      fetchMembers();
      fetchPendingInvites();
    }
  }, [organization]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchOrganization = async () => {
    try {
      const response = await axios.get(`${API}/organizations/current`, {
        headers,
        withCredentials: true
      });
      setOrganization(response.data);
    } catch (error) {
      console.error('Failed to fetch organization');
    } finally {
      setLoading(false);
    }
  };

  const fetchOrgSettings = async () => {
    try {
      const response = await axios.get(`${API}/organizations/settings`, {
        headers,
        withCredentials: true
      });
      setOrgSettings(response.data);
      setDealStages(response.data.deal_stages || []);
      // task stages live in /settings/stages under task_statuses
      try {
        const stagesResp = await axios.get(`${API}/settings/stages`, { headers, withCredentials: true });
        setTaskStages(stagesResp.data.task_statuses || []);
      } catch {}

    } catch (error) {
      console.error('Failed to fetch org settings');
    }
  };

  const fetchAiStatus = async () => {
    try {
      const response = await axios.get(`${API}/settings/ai-status`, { headers });
      setAiStatus(response.data);
    } catch (error) {
      console.error('Failed to fetch AI status');
    }
  };

  const fetchLlmKeys = async () => {
    try {
      const response = await axios.get(`${API}/settings/integrations`, { headers });
      const integrations = response.data?.integrations || {};
      setLlmKeys({
        anthropic_api_key: integrations.anthropic_api_key || '',
        openai_api_key: integrations.openai_api_key || '',
      });
    } catch (error) {
      console.error('Failed to fetch LLM keys');
    }
  };

  const saveLlmKeys = async () => {
    setSavingLlm(true);
    try {
      await axios.put(`${API}/settings/integrations`, llmKeys, { headers });
      toast.success('AI keys saved successfully');
      fetchAiStatus();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save AI keys');
    } finally {
      setSavingLlm(false);
    }
  };

  const fetchMembers = async () => {
    if (!organization?.organization_id) return;
    try {
      const response = await axios.get(`${API}/organizations/${organization.organization_id}/members`, {
        headers,
        withCredentials: true
      });
      setMembers(response.data);
    } catch (error) {
      console.error('Failed to fetch members');
    }
  };

  const fetchPendingInvites = async () => {
    try {
      const response = await axios.get(`${API}/organizations/invites`, {
        headers,
        withCredentials: true
      });
      setPendingInvites(response.data.invites || []);
    } catch (error) {
      console.error('Failed to fetch invites');
    }
  };

  const fetchAffiliateStatus = async () => {
    try {
      const response = await axios.get(`${API}/affiliate/me`, { headers, withCredentials: true });
      setAffiliateStatus(response.data);
    } catch (error) {
      console.error('Failed to fetch affiliate status');
    }
  };

  const fetchApiKeysAndWebhooks = async () => {
    try {
      const [keysRes, whRes] = await Promise.all([
        axios.get(`${API}/api-keys`, { headers, withCredentials: true }).catch(() => null),
        axios.get(`${API}/webhooks`, { headers, withCredentials: true }).catch(() => null)
      ]);
      if (keysRes) setApiKeys(keysRes.data);
      if (whRes) setWebhooks(whRes.data);
    } catch (err) { console.error(err); }
  };

  const fetchInvoices = async () => {
    try {
      const response = await axios.get(`${API}/invoices`, {
        headers,
        withCredentials: true
      });
      setInvoices(response.data.invoices || []);
    } catch (error) {
      console.error('Failed to fetch invoices');
    }
  };

  const handleCreateOrganization = async (e) => {
    e.preventDefault();
    if (!newOrgName.trim()) return;

    setCreatingOrg(true);
    try {
      await axios.post(`${API}/organizations?name=${encodeURIComponent(newOrgName)}`, {}, {
        headers,
        withCredentials: true
      });
      toast.success('Organization created successfully');
      await checkAuth();
      fetchOrganization();
      setNewOrgName('');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create organization');
    } finally {
      setCreatingOrg(false);
    }
  };

  const handleSaveDealStages = async () => {
    try {
      await axios.put(`${API}/organizations/settings`, { deal_stages: dealStages }, {
        headers,
        withCredentials: true
      });
      toast.success('Deal stages saved');
      setEditingStages(false);
      fetchOrgSettings();
    } catch (error) {
      toast.error('Failed to save deal stages');
    }
  };

  const handleToggleAffiliate = async (enabled) => {
    try {
      await axios.put(`${API}/organizations/settings`, { affiliate_enabled: enabled }, {
        headers,
        withCredentials: true
      });
      // Auto-enroll user as affiliate when enabling
      if (enabled && !affiliateStatus?.enrolled) {
        try {
          await axios.post(`${API}/affiliate/enroll`, {}, { headers, withCredentials: true });
          fetchAffiliateStatus();
        } catch (err) { console.error(err); }
      }
      toast.success(enabled ? 'Affiliate program enabled' : 'Affiliate program disabled');
      fetchOrgSettings();
    } catch (error) {
      toast.error('Failed to update affiliate settings');
    }
  };

  const handleEnrollAffiliate = async () => {
    try {
      await axios.post(`${API}/affiliate/enroll`, {}, {
        headers,
        withCredentials: true
      });
      toast.success('Successfully enrolled as affiliate!');
      fetchAffiliateStatus();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to enroll');
    }
  };

  // Invitation handlers
  const handleGenerateInviteLink = async () => {
    setGeneratingLink(true);
    try {
      const response = await axios.post(`${API}/organizations/invites/link?role=${inviteRole}`, {}, {
        headers,
        withCredentials: true
      });
      setInviteLink(response.data);
      toast.success('Invite link generated!');
      fetchPendingInvites();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to generate invite link');
    } finally {
      setGeneratingLink(false);
    }
  };

  const handleSendEmailInvites = async () => {
    const emails = inviteEmails.split(/[,\n]/).map(e => e.trim()).filter(e => e && e.includes('@'));
    if (emails.length === 0) {
      toast.error('Please enter valid email addresses');
      return;
    }

    setSendingInvites(true);
    try {
      const response = await axios.post(`${API}/organizations/invites/email`, {
        emails,
        role: inviteRole
      }, {
        headers,
        withCredentials: true
      });
      
      const { total_sent, total_failed } = response.data;
      if (total_sent > 0) {
        toast.success(`${total_sent} invitation${total_sent > 1 ? 's' : ''} sent`);
      }
      if (total_failed > 0) {
        toast.warning(`${total_failed} invitation${total_failed > 1 ? 's' : ''} could not be sent`);
      }
      setInviteEmails('');
      fetchPendingInvites();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to send invitations');
    } finally {
      setSendingInvites(false);
    }
  };

  const handleCSVUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await axios.post(`${API}/organizations/invites/csv?role=${inviteRole}`, formData, {
        headers: {
          ...headers,
          'Content-Type': 'multipart/form-data'
        },
        withCredentials: true
      });
      
      const { total_sent, total_failed } = response.data;
      toast.success(`Processed ${total_sent + total_failed} emails. ${total_sent} invitations sent.`);
      fetchPendingInvites();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to process CSV');
    }
    
    // Reset file input
    e.target.value = '';
  };

  const handleRevokeInvite = async (inviteId) => {
    try {
      await axios.delete(`${API}/organizations/invites/${inviteId}`, {
        headers,
        withCredentials: true
      });
      toast.success('Invitation revoked');
      fetchPendingInvites();
    } catch (error) {
      toast.error('Failed to revoke invitation');
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard!');
  };

  const handleUnenrollAffiliate = async () => {
    if (!confirm('Are you sure you want to leave the affiliate program?')) return;
    try {
      await axios.post(`${API}/affiliate/unenroll`, {}, {
        headers,
        withCredentials: true
      });
      toast.success('Successfully unenrolled from affiliate program');
      fetchAffiliateStatus();
    } catch (error) {
      toast.error('Failed to unenroll');
    }
  };

  const handleUpdateMemberRole = async (userId, newRole) => {
    try {
      await axios.put(`${API}/organizations/members/${userId}/role?role=${newRole}`, {}, {
        headers,
        withCredentials: true
      });
      toast.success('Member role updated');
      fetchMembers();
      if (newRole === 'owner') {
        await checkAuth(); // Refresh current user's role
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update role');
    }
  };

  const addDealStage = () => {
    const newStage = {
      id: `stage_${Date.now()}`,
      name: 'New Stage',
      order: dealStages.length + 1
    };
    setDealStages([...dealStages, newStage]);
  };

  const removeDealStage = (index) => {
    setDealStages(dealStages.filter((_, i) => i !== index));
  };

  const updateDealStage = (index, field, value) => {
    const updated = [...dealStages];
    updated[index] = { ...updated[index], [field]: value };
    setDealStages(updated);
  };

  const handleSaveTaskStages = async () => {
    try {
      await axios.put(`${API}/settings/stages`, { task_statuses: taskStages }, {
        headers,
        withCredentials: true
      });
      toast.success('Task steps saved');
      setEditingTaskStages(false);
      fetchOrgSettings();
    } catch (error) {
      toast.error('Failed to save task steps');
    }
  };

  const addTaskStage = () => {
    const newStage = {
      id: `stage_${Date.now()}`,
      name: 'New Step'
    };
    setTaskStages([...taskStages, newStage]);
  };

  const removeTaskStage = (index) => {
    if (taskStages.length <= 1) return;
    setTaskStages(taskStages.filter((_, i) => i !== index));
  };

  const updateTaskStage = (index, field, value) => {
    const updated = [...taskStages];
    updated[index] = { ...updated[index], [field]: value };
    setTaskStages(updated);
  };

  // Keep profile form in sync with the auth user
  useEffect(() => {
    if (user) {
      setProfileForm({
        name: user.name || '',
        picture: user.picture || '',
        timezone: user.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/London',
      });
    }
  }, [user]);

  const saveProfile = async () => {
    if (!profileForm.name.trim()) { toast.error('Name cannot be empty'); return; }
    setSavingProfile(true);
    try {
      await axios.put(`${API}/auth/me`, profileForm, { headers, withCredentials: true });
      await checkAuth();
      toast.success('Profile updated');
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Could not update profile');
    } finally {
      setSavingProfile(false);
    }
  };

  const changePassword = async () => {
    // Inline validation is handled by disabled button state + helper text;
    // this guard is defense-in-depth.
    if (!pwForm.current_password || !pwForm.new_password) {
      toast.error('Please fill in both password fields');
      return;
    }
    if (pwForm.new_password.length < 8) {
      toast.error('New password must be at least 8 characters');
      return;
    }
    if (pwForm.new_password !== pwForm.confirm_password) {
      toast.error('New passwords do not match');
      return;
    }
    if (pwForm.new_password === pwForm.current_password) {
      toast.error('New password must be different from current password');
      return;
    }
    setSavingPassword(true);
    try {
      await axios.post(`${API}/auth/change-password`, {
        current_password: pwForm.current_password,
        new_password: pwForm.new_password,
      }, { headers, withCredentials: true });
      toast.success('Password updated');
      setPwForm({ current_password: '', new_password: '', confirm_password: '' });
      setPwShow({ current: false, next: false, confirm: false });
      setPwJustChanged(true);
      setTimeout(() => setPwJustChanged(false), 5000);
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Could not update password');
    } finally {
      setSavingPassword(false);
    }
  };

  const viewInvoice = async (invoiceId) => {
    try {
      const response = await axios.get(`${API}/invoices/${invoiceId}/html`, {
        headers,
        withCredentials: true
      });
      const printWindow = window.open('', '_blank');
      const doc = printWindow.document;
      doc.open();
      const rawHtml = typeof response.data === 'string' ? response.data : '';
      // Sanitize: strip script tags to prevent XSS
      const sanitized = rawHtml.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
      const html = `<html><head><title>Invoice</title><style>body{font-family:Arial,sans-serif;padding:20px}@media print{button{display:none}}</style></head><body><button onclick="window.print()" style="margin-bottom:20px;padding:10px 20px;cursor:pointer">Print Invoice</button><div id="invoice">${sanitized}</div></body></html>`;
      doc.write(html);
      doc.close();
    } catch (error) {
      toast.error('Failed to load invoice');
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-4xl" data-testid="settings-page">
        <div>
          <h1 className="text-2xl font-bold text-slate-900" data-testid="settings-title">Settings</h1>
          <p className="text-slate-600 mt-1">Manage your account, organization, and billing</p>
        </div>

        <Tabs defaultValue={defaultTab} className="space-y-6">
          <TabsList className="flex flex-wrap h-auto gap-1 p-1">
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="organization">Organization</TabsTrigger>
            <TabsTrigger value="team">Team</TabsTrigger>
            <TabsTrigger value="billing">Billing</TabsTrigger>
            <TabsTrigger value="integrations">Integrations</TabsTrigger>
            <TabsTrigger value="api" data-testid="settings-api-tab">API</TabsTrigger>
            <TabsTrigger value="app" data-testid="settings-app-tab">Mobile App</TabsTrigger>
          </TabsList>

          {/* Profile Tab */}
          <TabsContent value="profile" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <User className="w-5 h-5" />
                  Profile
                </CardTitle>
                <CardDescription>Your personal account information</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="flex items-center gap-4">
                  {profileForm.picture ? (
                    <img
                      src={profileForm.picture}
                      alt={profileForm.name || user?.name || 'User'}
                      className="w-16 h-16 rounded-full object-cover"
                      onError={(e) => { e.currentTarget.style.display = 'none'; }}
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-teal-100 flex items-center justify-center">
                      <span className="text-2xl font-semibold text-[#0EA5A0]">
                        {(profileForm.name || user?.name || 'U')[0]?.toUpperCase()}
                      </span>
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-sm text-slate-500 flex items-center gap-1 truncate">
                      <Mail className="w-4 h-4 shrink-0" />
                      <span className="truncate" data-testid="user-email">{user?.email}</span>
                    </p>
                    <Badge variant="outline" className="mt-2 capitalize">
                      {user?.role || 'member'}
                    </Badge>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="profile-name">Full name</Label>
                    <Input
                      id="profile-name"
                      value={profileForm.name}
                      onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                      placeholder="Your name"
                      data-testid="profile-name-input"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="profile-timezone">Timezone</Label>
                    {(() => {
                      // Prefer the native IANA list from the browser; fall back to a curated set.
                      let zones = [];
                      try {
                        if (typeof Intl.supportedValuesOf === 'function') {
                          zones = Intl.supportedValuesOf('timeZone');
                        }
                      } catch (e) { /* ignore */ }
                      if (!zones.length) {
                        zones = [
                          'UTC',
                          'Europe/London','Europe/Berlin','Europe/Paris','Europe/Madrid','Europe/Amsterdam','Europe/Zurich','Europe/Rome','Europe/Athens','Europe/Moscow',
                          'America/New_York','America/Chicago','America/Denver','America/Los_Angeles','America/Phoenix','America/Toronto','America/Mexico_City','America/Sao_Paulo','America/Buenos_Aires',
                          'Asia/Tokyo','Asia/Shanghai','Asia/Hong_Kong','Asia/Singapore','Asia/Seoul','Asia/Dubai','Asia/Kolkata','Asia/Bangkok','Asia/Jakarta',
                          'Australia/Sydney','Australia/Melbourne','Australia/Perth','Pacific/Auckland','Africa/Johannesburg','Africa/Cairo','Africa/Lagos',
                        ];
                      }
                      const browserTz = (() => {
                        try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return ''; }
                      })();
                      const valid = zones.includes(profileForm.timezone);
                      return (
                        <>
                          <Input
                            id="profile-timezone"
                            list="profile-timezone-list"
                            value={profileForm.timezone}
                            onChange={(e) => setProfileForm({ ...profileForm, timezone: e.target.value })}
                            placeholder="Start typing a city or region…"
                            data-testid="profile-timezone-input"
                            className={profileForm.timezone && !valid ? 'border-amber-400' : ''}
                          />
                          <datalist id="profile-timezone-list">
                            {zones.map((z) => <option key={z} value={z} />)}
                          </datalist>
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <p className="text-xs text-slate-500">
                              {profileForm.timezone && !valid
                                ? <span className="text-amber-600">Not a recognized IANA zone — pick from the list.</span>
                                : <>IANA format, e.g. <code>Europe/London</code>, <code>America/New_York</code>.</>}
                            </p>
                            {browserTz && profileForm.timezone !== browserTz && (
                              <button
                                type="button"
                                className="text-xs text-teal-700 hover:underline"
                                onClick={() => setProfileForm({ ...profileForm, timezone: browserTz })}
                              >
                                Use my current timezone ({browserTz})
                              </button>
                            )}
                          </div>
                        </>
                      );
                    })()}
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="profile-picture">Avatar URL</Label>
                    <Input
                      id="profile-picture"
                      value={profileForm.picture}
                      onChange={(e) => setProfileForm({ ...profileForm, picture: e.target.value })}
                      placeholder="https://..."
                      data-testid="profile-picture-input"
                    />
                    <p className="text-xs text-slate-500">Paste a public image URL. Leave blank to use your initials.</p>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button
                    onClick={saveProfile}
                    disabled={savingProfile}
                    className="bg-[#0EA5A0] hover:bg-[#0B8C88] text-white"
                    data-testid="profile-save-btn"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {savingProfile ? 'Saving…' : 'Save changes'}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Key className="w-5 h-5" />
                  Change password
                </CardTitle>
                <CardDescription>
                  If you sign in with Google, you can skip this section.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {(() => {
                  const newPw = pwForm.new_password || '';
                  const confirmPw = pwForm.confirm_password || '';
                  // Lightweight strength scoring — length + character variety.
                  const hasLower = /[a-z]/.test(newPw);
                  const hasUpper = /[A-Z]/.test(newPw);
                  const hasDigit = /\d/.test(newPw);
                  const hasSymbol = /[^A-Za-z0-9]/.test(newPw);
                  const variety = [hasLower, hasUpper, hasDigit, hasSymbol].filter(Boolean).length;
                  let score = 0;
                  if (newPw.length >= 8) score += 1;
                  if (newPw.length >= 12) score += 1;
                  if (variety >= 2) score += 1;
                  if (variety >= 3) score += 1;
                  if (newPw.length >= 16 && variety >= 3) score += 1;
                  const strengthLabel = !newPw
                    ? ''
                    : score <= 1
                      ? 'Weak'
                      : score === 2
                        ? 'Fair'
                        : score === 3
                          ? 'Good'
                          : 'Strong';
                  const strengthColor = score <= 1
                    ? 'bg-red-500'
                    : score === 2
                      ? 'bg-amber-500'
                      : score === 3
                        ? 'bg-teal-500'
                        : 'bg-emerald-500';
                  const strengthPct = Math.min(100, (score / 5) * 100);
                  const tooShort = newPw.length > 0 && newPw.length < 8;
                  const mismatch = confirmPw.length > 0 && confirmPw !== newPw;
                  const sameAsCurrent = newPw.length > 0 && newPw === pwForm.current_password;
                  const canSubmit =
                    !!pwForm.current_password &&
                    newPw.length >= 8 &&
                    confirmPw === newPw &&
                    !sameAsCurrent &&
                    !savingPassword;

                  return (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="space-y-1.5">
                          <Label htmlFor="pw-current">Current password</Label>
                          <div className="relative">
                            <Input
                              id="pw-current"
                              type={pwShow.current ? 'text' : 'password'}
                              value={pwForm.current_password}
                              onChange={(e) => setPwForm({ ...pwForm, current_password: e.target.value })}
                              autoComplete="current-password"
                              data-testid="pw-current-input"
                              className="pr-10"
                            />
                            <button
                              type="button"
                              tabIndex={-1}
                              onClick={() => setPwShow({ ...pwShow, current: !pwShow.current })}
                              className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-slate-600"
                              aria-label={pwShow.current ? 'Hide password' : 'Show password'}
                            >
                              {pwShow.current ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="pw-new">New password</Label>
                          <div className="relative">
                            <Input
                              id="pw-new"
                              type={pwShow.next ? 'text' : 'password'}
                              value={pwForm.new_password}
                              onChange={(e) => setPwForm({ ...pwForm, new_password: e.target.value })}
                              autoComplete="new-password"
                              data-testid="pw-new-input"
                              className="pr-10"
                            />
                            <button
                              type="button"
                              tabIndex={-1}
                              onClick={() => setPwShow({ ...pwShow, next: !pwShow.next })}
                              className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-slate-600"
                              aria-label={pwShow.next ? 'Hide password' : 'Show password'}
                            >
                              {pwShow.next ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="pw-confirm">Confirm new password</Label>
                          <div className="relative">
                            <Input
                              id="pw-confirm"
                              type={pwShow.confirm ? 'text' : 'password'}
                              value={pwForm.confirm_password}
                              onChange={(e) => setPwForm({ ...pwForm, confirm_password: e.target.value })}
                              autoComplete="new-password"
                              data-testid="pw-confirm-input"
                              className={`pr-10 ${mismatch ? 'border-red-400 focus-visible:ring-red-400' : ''}`}
                              onKeyDown={(e) => { if (e.key === 'Enter' && canSubmit) changePassword(); }}
                            />
                            <button
                              type="button"
                              tabIndex={-1}
                              onClick={() => setPwShow({ ...pwShow, confirm: !pwShow.confirm })}
                              className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-slate-600"
                              aria-label={pwShow.confirm ? 'Hide password' : 'Show password'}
                            >
                              {pwShow.confirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Strength meter + inline guidance */}
                      {newPw && (
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-3">
                            <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className={`h-full transition-all ${strengthColor}`}
                                style={{ width: `${strengthPct}%` }}
                              />
                            </div>
                            <span className={`text-xs font-medium ${
                              score <= 1 ? 'text-red-600' : score === 2 ? 'text-amber-600' : score === 3 ? 'text-teal-700' : 'text-emerald-700'
                            }`}>
                              {strengthLabel}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500">
                            Use 12+ characters with a mix of upper/lowercase, numbers, and symbols for best security.
                          </p>
                        </div>
                      )}

                      {/* Inline validation messages */}
                      <div className="space-y-1">
                        {tooShort && (
                          <p className="text-xs text-red-600">New password must be at least 8 characters.</p>
                        )}
                        {mismatch && (
                          <p className="text-xs text-red-600">Passwords don't match.</p>
                        )}
                        {sameAsCurrent && (
                          <p className="text-xs text-red-600">New password must be different from your current password.</p>
                        )}
                        {pwJustChanged && (
                          <p className="text-xs text-emerald-700 flex items-center gap-1.5">
                            <CheckCircle className="w-3.5 h-3.5" />
                            Password updated. You'll stay signed in on this device.
                          </p>
                        )}
                      </div>

                      <div className="flex justify-end">
                        <Button
                          onClick={changePassword}
                          disabled={!canSubmit}
                          variant="outline"
                          data-testid="pw-save-btn"
                        >
                          {savingPassword ? 'Updating…' : 'Update password'}
                        </Button>
                      </div>
                    </>
                  );
                })()}
              </CardContent>
            </Card>

            {/* Affiliate Section */}
            {orgSettings?.affiliate_enabled && (
              <Card className="mt-4">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Gift className="w-5 h-5" />
                    Affiliate Program
                  </CardTitle>
                  <CardDescription>Earn commissions by referring new customers</CardDescription>
                </CardHeader>
                <CardContent>
                  {affiliateStatus?.enrolled ? (
                    <div className="space-y-4">
                      {/* Level and Commission Info */}
                      <div className="p-4 bg-teal-50 border border-teal-200 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Badge className="bg-[#0EA5A0] text-white">{affiliateStatus.level_label || `Level ${affiliateStatus.level}`}</Badge>
                            <span className="text-sm font-medium text-teal-900">Level {affiliateStatus.level}</span>
                          </div>
                          <span className="text-sm font-bold text-teal-900">{affiliateStatus.affiliate?.commission_rate}% commission</span>
                        </div>
                        <p className="text-xs text-teal-700">{affiliateStatus.commission_summary}</p>
                        <p className="text-xs text-teal-600 mt-1">Your link gives new customers <strong>{affiliateStatus.customer_discount} off</strong></p>
                      </div>

                      <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
                        <p className="text-sm font-medium text-emerald-800 mb-2">Your Referral Link</p>
                        <div className="flex items-center gap-2">
                          <Input 
                            value={affiliateStatus.referral_link} 
                            readOnly 
                            className="font-mono text-sm"
                          />
                          <Button 
                            variant="outline" 
                            size="icon"
                            onClick={() => copyToClipboard(affiliateStatus.referral_link)}
                          >
                            <Copy className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-4">
                        <div className="p-3 bg-slate-50 rounded-lg text-center">
                          <p className="text-2xl font-bold text-slate-900">{affiliateStatus.affiliate?.total_referrals || 0}</p>
                          <p className="text-xs text-slate-500">Total Referrals</p>
                        </div>
                        <div className="p-3 bg-slate-50 rounded-lg text-center">
                          <p className="text-2xl font-bold text-emerald-600">€{(affiliateStatus.affiliate?.total_earnings || 0).toFixed(2)}</p>
                          <p className="text-xs text-slate-500">Total Earnings</p>
                        </div>
                        <div className="p-3 bg-slate-50 rounded-lg text-center">
                          <p className="text-2xl font-bold text-amber-600">€{(affiliateStatus.affiliate?.pending_earnings || 0).toFixed(2)}</p>
                          <p className="text-xs text-slate-500">Pending</p>
                        </div>
                      </div>

                      {/* Embed HTML Code */}
                      <div className="border border-slate-200 rounded-lg p-4 space-y-2">
                        <p className="text-sm font-medium text-slate-800">Embed Code for Your Website / CMS</p>
                        <p className="text-xs text-slate-500">Copy and paste this HTML into your website to promote TAKO and earn commissions.</p>
                        <div className="relative">
                          <pre className="bg-slate-900 text-green-400 text-xs p-3 rounded-lg overflow-x-auto max-h-40" data-testid="affiliate-embed-code">{`<a href="${affiliateStatus.referral_link}" target="_blank" rel="noopener noreferrer" style="display:inline-block;text-decoration:none;">
  <div style="background:linear-gradient(135deg,#0EA5A0,#0B8C88);border-radius:12px;padding:24px 32px;text-align:center;max-width:400px;font-family:Inter,sans-serif;">
    <p style="color:#fff;font-size:18px;font-weight:700;margin:0 0 8px;">Try TAKO - Your CRM that pAIs you back</p>
    <p style="color:rgba(255,255,255,0.8);font-size:14px;margin:0 0 16px;">AI-powered lead management, deal pipeline & team collaboration</p>
    <span style="background:#fff;color:#0EA5A0;padding:10px 24px;border-radius:8px;font-weight:600;font-size:14px;">Start Free Trial</span>
  </div>
</a>`}</pre>
                          <Button
                            size="sm"
                            variant="outline"
                            className="absolute top-2 right-2 h-7 text-xs"
                            data-testid="copy-embed-btn"
                            onClick={() => copyToClipboard(`<a href="${affiliateStatus.referral_link}" target="_blank" rel="noopener noreferrer" style="display:inline-block;text-decoration:none;"><div style="background:linear-gradient(135deg,#0EA5A0,#0B8C88);border-radius:12px;padding:24px 32px;text-align:center;max-width:400px;font-family:Inter,sans-serif;"><p style="color:#fff;font-size:18px;font-weight:700;margin:0 0 8px;">Try TAKO - Your CRM that pAIs you back</p><p style="color:rgba(255,255,255,0.8);font-size:14px;margin:0 0 16px;">AI-powered lead management, deal pipeline & team collaboration</p><span style="background:#fff;color:#0EA5A0;padding:10px 24px;border-radius:8px;font-weight:600;font-size:14px;">Start Free Trial</span></div></a>`)}
                          >
                            <Copy className="w-3 h-3 mr-1" /> Copy
                          </Button>
                        </div>
                      </div>

                      {/* Social Media Assets */}
                      <div className="border border-slate-200 rounded-lg p-4 space-y-3">
                        <p className="text-sm font-medium text-slate-800">Social Media Assets</p>
                        <p className="text-xs text-slate-500">Download these images to promote TAKO on your social channels. Pair them with your referral link!</p>
                        <div className="grid grid-cols-3 gap-3">
                          {[
                            { label: 'Banner (1536×1024)', desc: 'Facebook, LinkedIn, X', url: '/assets/social-banner.png' },
                            { label: 'Story (1024×1536)', desc: 'Instagram, TikTok', url: '/assets/social-story.png' },
                            { label: 'Square (1024×1024)', desc: 'Instagram, LinkedIn', url: '/assets/social-square.png' },
                          ].map((asset, i) => (
                            <div key={i} className="border border-slate-100 rounded-lg overflow-hidden">
                              <img src={asset.url} alt={asset.label} className="w-full h-28 object-cover bg-slate-100" />
                              <div className="p-2">
                                <p className="text-xs font-medium text-slate-800 truncate">{asset.label}</p>
                                <p className="text-[10px] text-slate-500">{asset.desc}</p>
                                <a
                                  href={asset.url}
                                  download
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="mt-1.5 flex items-center justify-center gap-1 text-xs text-[#0EA5A0] font-medium hover:underline"
                                  data-testid={`download-asset-${i}`}
                                >
                                  <Download className="w-3 h-3" /> Download
                                </a>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {affiliateStatus.referrals?.length > 0 && (
                        <div>
                          <p className="text-sm font-medium text-slate-700 mb-2">Recent Referrals</p>
                          <div className="space-y-2">
                            {affiliateStatus.referrals.slice(0, 5).map((ref, idx) => (
                              <div key={idx} className="flex items-center justify-between p-2 bg-slate-50 rounded text-sm">
                                <span className="text-slate-600">{ref.referred_user_id}</span>
                                <Badge variant={ref.commission_status === 'paid' ? 'default' : 'secondary'}>
                                  €{ref.commission_amount?.toFixed(2)} - {ref.commission_status}
                                </Badge>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <Button 
                        variant="outline" 
                        className="text-rose-600 border-rose-200"
                        onClick={handleUnenrollAffiliate}
                      >
                        Leave Affiliate Program
                      </Button>
                    </div>
                  ) : (
                    <div className="text-center py-6">
                      <Gift className="w-12 h-12 mx-auto text-indigo-400 mb-3" />
                      <p className="text-slate-600 mb-4">Join our affiliate program and earn 20% commission on referrals!</p>
                      <Button onClick={handleEnrollAffiliate} className="bg-[#0EA5A0] hover:bg-teal-700">
                        <Link className="w-4 h-4 mr-2" />
                        Become an Affiliate
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Organization Tab */}
          <TabsContent value="organization">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Building className="w-5 h-5" />
                  Organization
                </CardTitle>
                <CardDescription>Your team and workspace settings</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="w-6 h-6 border-2 border-[#0EA5A0] border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : organization ? (
                  <div className="space-y-4">
                    <div className="p-4 bg-slate-50 rounded-lg">
                      <p className="font-semibold text-slate-900" data-testid="org-name">{organization.name}</p>
                      <div className="flex items-center gap-4 mt-2 text-sm text-slate-500">
                        <span>Plan: <span className="capitalize font-medium">{organization.subscription_plan || organization.plan || 'free'}</span></span>
                        <span>•</span>
                        <span>Users: {organization.user_count}/{organization.max_users || organization.max_free_users || 3}</span>
                      </div>
                      {organization.subscription_status === 'active' && (
                        <Badge className="mt-2 bg-emerald-100 text-emerald-700">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Active Subscription
                        </Badge>
                      )}
                    </div>
                    {(!organization.subscription_status || organization.subscription_status !== 'active') && (
                      <div className="p-4 bg-teal-50 border border-indigo-200 rounded-lg">
                        <p className="text-sm text-teal-800 mb-3">
                          Upgrade to Pro to add unlimited team members and unlock all features.
                        </p>
                        <Button 
                          className="bg-[#0EA5A0] hover:bg-teal-700" 
                          size="sm"
                          onClick={() => navigate('/pricing')}
                        >
                          <Zap className="w-4 h-4 mr-2" />
                          Upgrade Plan
                        </Button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <p className="text-sm text-slate-600">
                      Create an organization to invite team members and collaborate on leads, deals, and tasks.
                    </p>
                    <form onSubmit={handleCreateOrganization} className="flex gap-3">
                      <Input
                        placeholder="Organization name"
                        value={newOrgName}
                        onChange={(e) => setNewOrgName(e.target.value)}
                        className="flex-1"
                        data-testid="org-name-input"
                      />
                      <Button
                        type="submit"
                        disabled={creatingOrg || !newOrgName.trim()}
                        className="bg-[#0EA5A0] hover:bg-teal-700"
                        data-testid="create-org-btn"
                      >
                        {creatingOrg ? (
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <>
                            <Plus className="w-4 h-4 mr-2" />
                            Create
                          </>
                        )}
                      </Button>
                    </form>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Team Members Section - Only show if organization exists */}
            {organization && (
              <Card className="mt-4">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    Team Members
                  </CardTitle>
                  <CardDescription>Manage your team and transfer ownership</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {members.map((member) => (
                      <div key={member.user_id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          {member.picture ? (
                            <img src={member.picture} alt={member.name} className="w-10 h-10 rounded-full" />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center">
                              <span className="font-semibold text-[#0EA5A0]">{member.name?.[0]?.toUpperCase()}</span>
                            </div>
                          )}
                          <div>
                            <p className="font-medium text-slate-900 flex items-center gap-2">
                              {member.name}
                              {member.role === 'owner' && <Crown className="w-4 h-4 text-amber-500" />}
                              {member.user_id === user?.user_id && <Badge variant="outline" className="text-xs">You</Badge>}
                            </p>
                            <p className="text-sm text-slate-500">{member.email}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {(user?.role === 'owner' || user?.role === 'super_admin') && member.user_id !== user?.user_id ? (
                            <Select 
                              value={member.role} 
                              onValueChange={(value) => handleUpdateMemberRole(member.user_id, value)}
                            >
                              <SelectTrigger className="w-32">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="member">Member</SelectItem>
                                <SelectItem value="admin">Admin</SelectItem>
                                <SelectItem value="owner">Owner</SelectItem>
                              </SelectContent>
                            </Select>
                          ) : (
                            <Badge variant="outline" className="capitalize">{member.role}</Badge>
                          )}
                        </div>
                      </div>
                    ))}
                    {members.length === 0 && (
                      <p className="text-sm text-slate-500 text-center py-4">No team members yet</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Deal Stages Configuration - Only for owner/admin */}
            {organization && (user?.role === 'owner' || user?.role === 'admin' || user?.role === 'super_admin') && (
              <Card className="mt-4">
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Layers className="w-5 h-5" />
                      Pipeline Stages
                    </CardTitle>
                    <CardDescription>Customize your deal pipeline stages</CardDescription>
                  </div>
                  {!editingStages ? (
                    <Button variant="outline" size="sm" onClick={() => setEditingStages(true)}>
                      <Edit className="w-4 h-4 mr-2" />
                      Edit Stages
                    </Button>
                  ) : (
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => { setEditingStages(false); setDealStages(orgSettings?.deal_stages || []); }}>
                        Cancel
                      </Button>
                      <Button size="sm" className="bg-[#0EA5A0] hover:bg-teal-700" onClick={handleSaveDealStages}>
                        <Save className="w-4 h-4 mr-2" />
                        Save
                      </Button>
                    </div>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {dealStages.map((stage, index) => (
                      <div key={stage.id} className="flex items-center gap-2">
                        <span className="w-8 text-sm text-slate-400">{index + 1}.</span>
                        {editingStages ? (
                          <>
                            <Input
                              value={stage.name}
                              onChange={(e) => updateDealStage(index, 'name', e.target.value)}
                              className="flex-1"
                            />
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="text-rose-500"
                              onClick={() => removeDealStage(index)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </>
                        ) : (
                          <div className="flex-1 p-2 bg-slate-50 rounded">
                            <span className="text-slate-700">{stage.name}</span>
                          </div>
                        )}
                      </div>
                    ))}
                    {editingStages && (
                      <Button variant="outline" size="sm" onClick={addDealStage} className="mt-2">
                        <Plus className="w-4 h-4 mr-2" />
                        Add Stage
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Task Steps Configuration - Only for owner/admin */}
            {organization && (user?.role === 'owner' || user?.role === 'admin' || user?.role === 'super_admin') && (
              <Card className="mt-4">
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <CheckSquare className="w-5 h-5" />
                      Task Steps
                    </CardTitle>
                    <CardDescription>Customize your task workflow steps</CardDescription>
                  </div>
                  {!editingTaskStages ? (
                    <Button variant="outline" size="sm" onClick={() => setEditingTaskStages(true)}>
                      <Edit className="w-4 h-4 mr-2" />
                      Edit Steps
                    </Button>
                  ) : (
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => { setEditingTaskStages(false); fetchOrgSettings(); }}>
                        Cancel
                      </Button>
                      <Button size="sm" className="bg-[#0EA5A0] hover:bg-teal-700" onClick={handleSaveTaskStages}>
                        <Save className="w-4 h-4 mr-2" />
                        Save
                      </Button>
                    </div>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {taskStages.map((stage, index) => (
                      <div key={stage.id} className="flex items-center gap-2">
                        <span className="w-8 text-sm text-slate-400">{index + 1}.</span>
                        {editingTaskStages ? (
                          <>
                            <Input
                              value={stage.name}
                              onChange={(e) => updateTaskStage(index, 'name', e.target.value)}
                              className="flex-1"
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-rose-500"
                              onClick={() => removeTaskStage(index)}
                              disabled={taskStages.length <= 1}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </>
                        ) : (
                          <div className="flex-1 p-2 bg-slate-50 rounded">
                            <span className="text-slate-700">{stage.name}</span>
                          </div>
                        )}
                      </div>
                    ))}
                    {editingTaskStages && (
                      <Button variant="outline" size="sm" onClick={addTaskStage} className="mt-2">
                        <Plus className="w-4 h-4 mr-2" />
                        Add Step
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Affiliate Settings - Only for owner/admin */}
            {organization && (user?.role === 'owner' || user?.role === 'admin' || user?.role === 'super_admin') && (
              <Card className="mt-4">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Gift className="w-5 h-5" />
                    Affiliate Program Settings
                  </CardTitle>
                  <CardDescription>Enable affiliates for your organization</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                    <div>
                      <p className="font-medium text-slate-900">Enable Affiliate Program</p>
                      <p className="text-sm text-slate-500">Allow members to earn commissions by referring new customers</p>
                    </div>
                    <Switch 
                      checked={orgSettings?.affiliate_enabled || false}
                      onCheckedChange={handleToggleAffiliate}
                    />
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Team & Invites Tab */}
          <TabsContent value="team">
            <div className="space-y-6">
              {/* Invite New Members */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <UserPlus className="w-5 h-5 text-[#0EA5A0]" />
                    Invite Team Members
                  </CardTitle>
                  <CardDescription>
                    Invite colleagues to join your organization
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Role Selection */}
                  <div className="space-y-2">
                    <Label>Invite as</Label>
                    <Select value={inviteRole} onValueChange={setInviteRole}>
                      <SelectTrigger className="w-[200px]" data-testid="invite-role-select">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="member">Member</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Method 1: Invite Link */}
                  <div className="p-4 border rounded-lg space-y-3">
                    <div className="flex items-center gap-2">
                      <Link className="w-4 h-4 text-[#0EA5A0]" />
                      <h4 className="font-medium">Share Invite Link</h4>
                    </div>
                    <p className="text-sm text-slate-600">Generate a link that anyone can use to join your organization</p>
                    
                    {inviteLink ? (
                      <div className="flex gap-2">
                        <Input 
                          value={inviteLink.invite_link} 
                          readOnly 
                          className="flex-1 bg-slate-50"
                          data-testid="invite-link-input"
                        />
                        <Button 
                          variant="outline" 
                          onClick={() => copyToClipboard(inviteLink.invite_link)}
                          data-testid="copy-invite-link"
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                      </div>
                    ) : (
                      <Button 
                        onClick={handleGenerateInviteLink} 
                        disabled={generatingLink}
                        className="bg-[#0EA5A0] hover:bg-teal-700"
                        data-testid="generate-invite-link"
                      >
                        {generatingLink ? 'Generating...' : 'Generate Invite Link'}
                      </Button>
                    )}
                    {inviteLink && (
                      <p className="text-xs text-slate-500">
                        Expires: {new Date(inviteLink.expires_at).toLocaleDateString()}
                      </p>
                    )}
                  </div>

                  {/* Method 2: Email Invites */}
                  <div className="p-4 border rounded-lg space-y-3">
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-[#0EA5A0]" />
                      <h4 className="font-medium">Send Email Invitations</h4>
                    </div>
                    <p className="text-sm text-slate-600">Enter email addresses (one per line or comma-separated)</p>
                    <textarea
                      className="w-full min-h-[100px] p-3 border rounded-lg text-sm resize-none focus:ring-2 focus:ring-[#0EA5A0] focus:border-transparent"
                      placeholder="email1@example.com&#10;email2@example.com"
                      value={inviteEmails}
                      onChange={(e) => setInviteEmails(e.target.value)}
                      data-testid="invite-emails-input"
                    />
                    <Button 
                      onClick={handleSendEmailInvites}
                      disabled={sendingInvites || !inviteEmails.trim()}
                      className="bg-[#0EA5A0] hover:bg-teal-700"
                      data-testid="send-email-invites"
                    >
                      <Send className="w-4 h-4 mr-2" />
                      {sendingInvites ? 'Sending...' : 'Send Invitations'}
                    </Button>
                  </div>

                  {/* Method 3: CSV Import */}
                  <div className="p-4 border rounded-lg space-y-3">
                    <div className="flex items-center gap-2">
                      <Upload className="w-4 h-4 text-[#0EA5A0]" />
                      <h4 className="font-medium">Import from CSV</h4>
                    </div>
                    <p className="text-sm text-slate-600">Upload a CSV file with an "email" column</p>
                    <div className="flex items-center gap-3">
                      <input
                        type="file"
                        accept=".csv"
                        onChange={handleCSVUpload}
                        className="hidden"
                        id="csv-upload"
                        data-testid="csv-upload-input"
                      />
                      <Button 
                        variant="outline" 
                        onClick={() => document.getElementById('csv-upload').click()}
                        data-testid="csv-upload-btn"
                      >
                        <Upload className="w-4 h-4 mr-2" />
                        Choose CSV File
                      </Button>
                      <span className="text-xs text-slate-500">CSV should have "email" column header</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Current Team Members */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    Team Members ({members.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {members.map((member) => (
                      <div key={member.user_id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-[#0EA5A0]/10 flex items-center justify-center">
                            <span className="text-[#0EA5A0] font-medium">
                              {member.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium">{member.name}</p>
                            <p className="text-sm text-slate-500">{member.email}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={member.role === 'owner' ? 'default' : 'outline'} className={member.role === 'owner' ? 'bg-[#0EA5A0]' : ''}>
                            {member.role === 'owner' && <Crown className="w-3 h-3 mr-1" />}
                            {member.role}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Pending Invitations */}
              {pendingInvites.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Clock className="w-5 h-5" />
                      Pending Invitations ({pendingInvites.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {pendingInvites.map((invite) => (
                        <div key={invite.invite_id} className="flex items-center justify-between p-3 border rounded-lg">
                          <div>
                            <p className="font-medium">
                              {invite.type === 'email' ? invite.email : 'Invite Link'}
                            </p>
                            <p className="text-sm text-slate-500">
                              Role: {invite.role} • 
                              {invite.status === 'expired' ? (
                                <span className="text-red-500 ml-1">Expired</span>
                              ) : invite.status === 'used' ? (
                                <span className="text-emerald-500 ml-1">Used</span>
                              ) : (
                                <span className="text-amber-500 ml-1">Pending</span>
                              )}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            {invite.type === 'link' && invite.status === 'pending' && (
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => copyToClipboard(`${window.location.origin}/signup?invite=${invite.invite_code}`)}
                              >
                                <Copy className="w-4 h-4" />
                              </Button>
                            )}
                            {invite.status === 'pending' && (
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="text-red-500 hover:text-red-700"
                                onClick={() => handleRevokeInvite(invite.invite_id)}
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* Billing Tab */}
          <TabsContent value="billing">
            <div className="space-y-6">
              {/* Subscription Status */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <CreditCard className="w-5 h-5" />
                    Subscription
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {organization?.subscription_status === 'active' ? (
                    <div className="flex items-center justify-between p-4 bg-emerald-50 rounded-lg">
                      <div>
                        <p className="font-semibold text-emerald-900">Pro Plan Active</p>
                        <p className="text-sm text-emerald-700">
                          {organization.subscription_plan === 'annual' ? 'Annual billing' : 'Monthly billing'}
                        </p>
                      </div>
                      <Badge className="bg-emerald-600">Active</Badge>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                      <div>
                        <p className="font-semibold text-slate-900">Free Plan</p>
                        <p className="text-sm text-slate-500">Up to 3 users included</p>
                      </div>
                      <Button 
                        className="bg-[#0EA5A0] hover:bg-teal-700"
                        onClick={() => navigate('/pricing')}
                      >
                        Upgrade
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Invoices */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    Invoices
                  </CardTitle>
                  <CardDescription>View and download your billing history</CardDescription>
                </CardHeader>
                <CardContent>
                  {invoices.length === 0 ? (
                    <p className="text-center text-slate-500 py-8">No invoices yet</p>
                  ) : (
                    <div className="divide-y">
                      {invoices.map((invoice) => (
                        <div key={invoice.invoice_id} className="py-4 flex items-center justify-between">
                          <div>
                            <p className="font-medium text-slate-900">{invoice.invoice_number}</p>
                            <p className="text-sm text-slate-500">
                              {new Date(invoice.invoice_date).toLocaleDateString()} • {invoice.plan_name}
                            </p>
                          </div>
                          <div className="flex items-center gap-4">
                            <span className="font-semibold text-slate-900">
                              €{invoice.total_amount.toFixed(2)}
                            </span>
                            <Badge className={invoice.status === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}>
                              {invoice.status === 'paid' ? (
                                <><CheckCircle className="w-3 h-3 mr-1" />Paid</>
                              ) : (
                                <><Clock className="w-3 h-3 mr-1" />Pending</>
                              )}
                            </Badge>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => viewInvoice(invoice.invoice_id)}
                            >
                              <ExternalLink className="w-4 h-4 mr-1" />
                              View
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Integrations Tab */}
          <TabsContent value="integrations">
            {/* AI / LLM Configuration */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Zap className="w-5 h-5 text-teal-600" />
                  AI / LLM
                </CardTitle>
                <CardDescription>
                  Configure your AI provider to enable smart features like lead scoring, enrichment, chat assistant, and card capture.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Status indicator */}
                {(() => {
                  const trial = aiStatus?.trial || {};
                  const source = aiStatus?.source;
                  const provider = aiStatus?.provider === 'anthropic' ? 'Anthropic Claude' : 'OpenAI';
                  const trialExpired = !!trial.ends_at && !trial.active && source !== 'organization' && source !== 'platform';
                  const onTrial = source === 'trial' && trial.active;
                  const sourceLabel = source === 'organization'
                    ? 'your key'
                    : source === 'platform'
                      ? 'platform key'
                      : source === 'trial'
                        ? `free trial — ${trial.days_remaining} day${trial.days_remaining === 1 ? '' : 's'} left`
                        : '';
                  const toneClass = aiStatus?.ai_available
                    ? (onTrial ? 'border-teal-200 bg-teal-50/50' : 'border-emerald-200 bg-emerald-50/50')
                    : 'border-amber-200 bg-amber-50/50';
                  const textClass = aiStatus?.ai_available
                    ? (onTrial ? 'text-teal-700' : 'text-emerald-700')
                    : 'text-amber-700';
                  return (
                    <div className={`p-3 rounded-lg border ${toneClass}`}>
                      <div className="flex items-center gap-2">
                        {aiStatus?.ai_available ? (
                          <>
                            <CheckCircle className={`w-4 h-4 ${onTrial ? 'text-teal-600' : 'text-emerald-600'}`} />
                            <span className={`text-sm font-medium ${textClass}`}>
                              AI active — using {provider} ({sourceLabel})
                            </span>
                          </>
                        ) : (
                          <>
                            <Clock className="w-4 h-4 text-amber-600" />
                            <span className="text-sm font-medium text-amber-700">
                              {trialExpired
                                ? 'Your 30-day AI trial has ended.'
                                : 'AI features disabled — add an API key below to enable.'}
                            </span>
                          </>
                        )}
                      </div>
                      {onTrial && (
                        <p className="text-xs text-teal-700/80 mt-1.5">
                          We're covering AI costs during your trial.
                          {trial.ends_at ? ` Trial ends ${new Date(trial.ends_at).toLocaleDateString()}.` : ''}
                          {' '}Add your own Anthropic key any time to continue without interruption.
                        </p>
                      )}
                      {trialExpired && (
                        <div className="text-xs text-amber-700/90 mt-2 space-y-2">
                          <p>
                            Add your own Anthropic API key below to keep AI features on —
                            keys start free at <a href="https://console.anthropic.com/" target="_blank" rel="noreferrer" className="underline">console.anthropic.com</a>.
                          </p>
                          <p>
                            Not sure where to start? <a href="/support" className="underline font-medium">Talk to support</a> — we'll walk you through it.
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Anthropic key */}
                <div className="space-y-2">
                  <Label htmlFor="anthropic-key" className="flex items-center gap-2">
                    Anthropic API Key
                    <Badge variant="outline" className="text-xs">Recommended</Badge>
                  </Label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Input
                        id="anthropic-key"
                        type={showAnthropicKey ? 'text' : 'password'}
                        placeholder="sk-ant-api03-..."
                        value={llmKeys.anthropic_api_key === 'connected' ? '' : llmKeys.anthropic_api_key}
                        onChange={(e) => setLlmKeys(prev => ({ ...prev, anthropic_api_key: e.target.value }))}
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                        onClick={() => setShowAnthropicKey(!showAnthropicKey)}
                      >
                        {showAnthropicKey ? 'Hide' : 'Show'}
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500">
                    Get your key at{' '}
                    <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener noreferrer" className="text-teal-600 hover:underline">
                      console.anthropic.com <ExternalLink className="w-3 h-3 inline" />
                    </a>
                  </p>
                </div>

                {/* OpenAI key (future) */}
                <div className="space-y-2">
                  <Label htmlFor="openai-key" className="flex items-center gap-2 text-slate-400">
                    OpenAI API Key
                    <Badge variant="outline" className="text-xs text-slate-400">Coming soon</Badge>
                  </Label>
                  <Input
                    id="openai-key"
                    type={showOpenaiKey ? 'text' : 'password'}
                    placeholder="sk-..."
                    disabled
                    value={llmKeys.openai_api_key === 'connected' ? '' : llmKeys.openai_api_key}
                    onChange={(e) => setLlmKeys(prev => ({ ...prev, openai_api_key: e.target.value }))}
                  />
                </div>

                <Button onClick={saveLlmKeys} disabled={savingLlm} className="bg-teal-600 hover:bg-teal-700">
                  <Save className="w-4 h-4 mr-2" />
                  {savingLlm ? 'Saving...' : 'Save AI Keys'}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Integrations</CardTitle>
                <CardDescription>Connect external services</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 border border-emerald-200 bg-emerald-50/50 rounded-lg flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-slate-900 flex items-center justify-center">
                      <span className="text-white font-bold text-sm">R</span>
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">Resend</p>
                      <p className="text-sm text-slate-500">Transactional & campaign emails (tako.software)</p>
                    </div>
                  </div>
                  <Badge className="bg-emerald-100 text-emerald-700">Verified</Badge>
                </div>
                <div className="p-4 border border-slate-200 rounded-lg flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-slate-900 flex items-center justify-center">
                      <span className="text-white font-bold text-sm">Kit</span>
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">Kit.com (ConvertKit)</p>
                      <p className="text-sm text-slate-500">Email marketing automation</p>
                    </div>
                  </div>
                  <Badge className="bg-slate-100 text-slate-600">Optional</Badge>
                </div>
                <div className="p-4 border border-slate-200 rounded-lg flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center">
                      <span className="text-white font-bold text-sm">in</span>
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">LinkedIn</p>
                      <p className="text-sm text-slate-500">Lead generation & scraping</p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" data-testid="connect-linkedin-btn">Connect</Button>
                </div>
                <div className="p-4 border border-slate-200 rounded-lg flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center">
                      <svg className="w-7 h-7" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">Google Calendar</p>
                      <p className="text-sm text-slate-500">Sync calendar events two-way</p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={async () => {
                    try {
                      const r = await axios.get(`${API}/calendar/google/auth-url`, { headers: { Authorization: `Bearer ${token}` } });
                      window.location.href = r.data.auth_url;
                    } catch (e) { toast.error(e.response?.data?.detail || 'Failed'); }
                  }} data-testid="connect-google-cal-btn">Connect</Button>
                </div>
                {(() => {
                  // Stripe is only relevant for TAKO's own internal/affiliated accounts
                  // (TAKO-controlled domains + a couple of personal addresses).
                  // Regular customers don't connect Stripe from here.
                  const email = (user?.email || '').toLowerCase();
                  const stripeWhitelist = [
                    'fbjk2000@gmail.com',
                    'fbjk2000ai@gmail.com',
                  ];
                  const stripeWhitelistDomains = [
                    'unyted.world',
                    'fintery.com',
                    'floriankrueger.com',
                    'davidaltun.com',
                    'alakai.digital',
                    'aios.institute',
                  ];
                  const stripeVisible = stripeWhitelist.includes(email)
                    || stripeWhitelistDomains.some(d => email.endsWith(`@${d}`));
                  if (!stripeVisible) return null;
                  return (
                    <div className="p-4 border border-slate-200 rounded-lg flex items-center justify-between" data-testid="stripe-integration-row">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-teal-600 flex items-center justify-center">
                          <span className="text-white font-bold text-sm">S</span>
                        </div>
                        <div>
                          <p className="font-medium text-slate-900">Stripe</p>
                          <p className="text-sm text-slate-500">Payment processing (internal)</p>
                        </div>
                      </div>
                      <Badge className="bg-emerald-100 text-emerald-700">Connected</Badge>
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          </TabsContent>

          {/* API & Webhooks Tab */}
          <TabsContent value="api">
            <div className="space-y-6">
              {/* API Keys */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2"><Key className="w-5 h-5" /> API Keys</CardTitle>
                  <CardDescription>Generate API keys for n8n, Notion, or custom integrations</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-2">
                    <Input placeholder="Key name (e.g., n8n Production)" value={newKeyName} onChange={(e) => setNewKeyName(e.target.value)} className="max-w-xs" data-testid="api-key-name" />
                    <Button className="bg-[#0EA5A0] hover:bg-teal-700" onClick={async () => {
                      try {
                        const res = await axios.post(`${API}/api-keys?name=${encodeURIComponent(newKeyName || 'Default')}`, {}, { headers: { Authorization: `Bearer ${token}` } });
                        setGeneratedKey(res.data.key);
                        setNewKeyName('');
                        const keysRes = await axios.get(`${API}/api-keys`, { headers: { Authorization: `Bearer ${token}` } });
                        setApiKeys(keysRes.data);
                        toast.success('API key created');
                      } catch { toast.error('Failed to create key'); }
                    }} data-testid="create-api-key">Generate Key</Button>
                  </div>
                  {generatedKey && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                      <p className="text-xs text-emerald-700 font-medium mb-1">Your new API key (copy now — won't be shown again):</p>
                      <code className="text-sm bg-white p-2 rounded block break-all border" data-testid="generated-key">{generatedKey}</code>
                      <Button size="sm" variant="outline" className="mt-2" onClick={() => { navigator.clipboard.writeText(generatedKey); toast.success('Copied!'); }}>Copy</Button>
                    </div>
                  )}
                  {apiKeys.length > 0 && (
                    <div className="space-y-2">
                      {apiKeys.map(k => (
                        <div key={k.key_id} className="flex items-center justify-between p-3 border rounded-lg">
                          <div>
                            <p className="font-medium text-sm">{k.name}</p>
                            <p className="text-xs text-slate-500">{k.key_prefix} | Last used: {k.last_used ? new Date(k.last_used).toLocaleDateString() : 'Never'}</p>
                          </div>
                          <Button size="sm" variant="ghost" className="text-red-500" onClick={async () => {
                            await axios.delete(`${API}/api-keys/${k.key_id}`, { headers: { Authorization: `Bearer ${token}` } });
                            setApiKeys(prev => prev.filter(x => x.key_id !== k.key_id));
                            toast.success('Key revoked');
                          }}><Trash2 className="w-4 h-4" /></Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Webhooks */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">Webhooks</CardTitle>
                  <CardDescription>Receive real-time notifications when events happen (for n8n, Zapier, etc.)</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-2">
                    <Input placeholder="Webhook URL" value={newWebhookUrl} onChange={(e) => setNewWebhookUrl(e.target.value)} className="flex-1" data-testid="webhook-url" />
                    <Input placeholder="Name" value={newWebhookName} onChange={(e) => setNewWebhookName(e.target.value)} className="w-32" />
                    <Button variant="outline" onClick={async () => {
                      if (!newWebhookUrl) return;
                      try {
                        await axios.post(`${API}/webhooks?url=${encodeURIComponent(newWebhookUrl)}&name=${encodeURIComponent(newWebhookName || 'Default')}&events=lead.created&events=deal.stage_changed&events=contact.created`, {}, { headers: { Authorization: `Bearer ${token}` } });
                        setNewWebhookUrl(''); setNewWebhookName('');
                        const res = await axios.get(`${API}/webhooks`, { headers: { Authorization: `Bearer ${token}` } });
                        setWebhooks(res.data);
                        toast.success('Webhook registered');
                      } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
                    }} data-testid="add-webhook">Add</Button>
                  </div>
                  <p className="text-xs text-slate-500">Events: lead.created, lead.updated, deal.created, deal.stage_changed, contact.created, task.created</p>
                  {webhooks.map(wh => (
                    <div key={wh.webhook_id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium text-sm">{wh.name}</p>
                        <p className="text-xs text-slate-500 truncate max-w-md">{wh.url}</p>
                        <div className="flex gap-1 mt-1">{wh.events?.map(e => <Badge key={e} variant="secondary" className="text-xs">{e}</Badge>)}</div>
                      </div>
                      <Button size="sm" variant="ghost" className="text-red-500" onClick={async () => {
                        await axios.delete(`${API}/webhooks/${wh.webhook_id}`, { headers: { Authorization: `Bearer ${token}` } });
                        setWebhooks(prev => prev.filter(x => x.webhook_id !== wh.webhook_id));
                        toast.success('Webhook deleted');
                      }}><Trash2 className="w-4 h-4" /></Button>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* API Docs */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Quick Start Guide</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="bg-slate-900 text-green-400 p-4 rounded-lg text-xs font-mono space-y-2">
                    <p># n8n.io - Use HTTP Request node</p>
                    <p>GET {API}/v1/leads</p>
                    <p>Header: X-API-Key: tako_your_key_here</p>
                    <p></p>
                    <p># Notion - Sync data via API</p>
                    <p>POST {API}/v1/notion/sync?entity_type=leads</p>
                    <p>Header: X-API-Key: tako_your_key_here</p>
                    <p></p>
                    <p># Webhooks - Register for events</p>
                    <p>POST {API}/webhooks?url=https://your-n8n.com/webhook/xxx&events=lead.created</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Mobile App Tab */}
          <TabsContent value="app">
            <Card>
              <CardHeader>
                <CardTitle>Install TAKO on your device</CardTitle>
                <CardDescription>Get the full CRM experience as an app on your phone, tablet, or desktop</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center gap-4 p-4 bg-teal-50 rounded-lg border border-teal-100">
                  <img src="/icon-192.png" alt="TAKO" className="w-16 h-16 rounded-2xl shadow-md" />
                  <div>
                    <h3 className="font-bold text-slate-900">TAKO PWA</h3>
                    <p className="text-sm text-slate-500">Works on iOS, Android & Desktop</p>
                  </div>
                  <Button
                    className="ml-auto bg-[#0EA5A0] hover:bg-teal-700"
                    data-testid="pwa-install-settings-btn"
                    onClick={() => {
                      if (window.deferredPWAPrompt) {
                        window.deferredPWAPrompt.prompt();
                      } else {
                        toast.success('Use your browser menu to install: Menu → Install App (or Add to Home Screen)');
                      }
                    }}
                  >
                    Install App
                  </Button>
                </div>
                <div className="space-y-3">
                  <h4 className="font-medium text-slate-800">How to install</h4>
                  <div className="grid gap-3 text-sm">
                    <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
                      <span className="font-semibold text-[#0EA5A0] shrink-0">Chrome / Edge</span>
                      <span className="text-slate-600">Click the install icon in the address bar, or go to Menu → Install app</span>
                    </div>
                    <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
                      <span className="font-semibold text-[#0EA5A0] shrink-0">Safari (iOS)</span>
                      <span className="text-slate-600">Tap the Share button → Add to Home Screen</span>
                    </div>
                    <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
                      <span className="font-semibold text-[#0EA5A0] shrink-0">Android</span>
                      <span className="text-slate-600">Tap the "Add to Home Screen" banner, or Menu → Install app</span>
                    </div>
                  </div>
                </div>
                <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-100">
                  <p className="text-sm text-emerald-800">
                    <strong>Already installed?</strong> The app will automatically update when new features are available. You can manage your installed app in your device settings.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default SettingsPage;
