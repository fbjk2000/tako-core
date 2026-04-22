import React, { useState, useEffect } from 'react';
import { useT } from '../useT';
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
  const { t } = useT();
  const { user, token, checkAuth } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [organization, setOrganization] = useState(null);
  const [orgSettings, setOrgSettings] = useState(null);
  const [members, setMembers] = useState([]);
  const [invoices, setInvoices] = useState([]);
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
  const [profileBaseline, setProfileBaseline] = useState({ name: '', picture: '', timezone: '' });
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
      toast.success(t('settings.aiKeysSaved'));
      fetchAiStatus();
    } catch (error) {
      toast.error(error.response?.data?.detail || t('settings.aiKeysSaveFailed'));
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
      toast.success(t('settings.orgCreateSuccess'));
      await checkAuth();
      fetchOrganization();
      setNewOrgName('');
    } catch (error) {
      toast.error(error.response?.data?.detail || t('settings.orgCreateFailed'));
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
      toast.success(t('settings.dealStagesSaved'));
      setEditingStages(false);
      fetchOrgSettings();
    } catch (error) {
      toast.error(t('settings.dealStagesSaveFailed'));
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
      toast.success(t('settings.inviteLinkGenerated'));
      fetchPendingInvites();
    } catch (error) {
      toast.error(error.response?.data?.detail || t('settings.inviteLinkFailed'));
    } finally {
      setGeneratingLink(false);
    }
  };

  const handleSendEmailInvites = async () => {
    const emails = inviteEmails.split(/[,\n]/).map(e => e.trim()).filter(e => e && e.includes('@'));
    if (emails.length === 0) {
      toast.error(t('settings.invalidEmails'));
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
        toast.success(
          total_sent === 1
            ? t('settings.inviteSentSingle')
            : t('settings.invitesSent').replace('{count}', total_sent)
        );
      }
      if (total_failed > 0) {
        toast.warning(
          total_failed === 1
            ? t('settings.inviteFailedSingle')
            : t('settings.invitesFailed').replace('{count}', total_failed)
        );
      }
      setInviteEmails('');
      fetchPendingInvites();
    } catch (error) {
      toast.error(error.response?.data?.detail || t('settings.inviteSendFailed'));
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
      toast.success(
        t('settings.csvProcessed')
          .replace('{total}', total_sent + total_failed)
          .replace('{sent}', total_sent)
      );
      fetchPendingInvites();
    } catch (error) {
      toast.error(error.response?.data?.detail || t('settings.csvFailed'));
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
      toast.success(t('settings.inviteRevoked'));
      fetchPendingInvites();
    } catch (error) {
      toast.error(t('settings.inviteRevokeFailed'));
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success(t('settings.copiedClipboard'));
  };

  const handleUpdateMemberRole = async (userId, newRole) => {
    try {
      await axios.put(`${API}/organizations/members/${userId}/role?role=${newRole}`, {}, {
        headers,
        withCredentials: true
      });
      toast.success(t('settings.memberRoleUpdated'));
      fetchMembers();
      if (newRole === 'owner') {
        await checkAuth(); // Refresh current user's role
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || t('settings.memberRoleUpdateFailed'));
    }
  };

  const addDealStage = () => {
    const newStage = {
      id: `stage_${Date.now()}`,
      name: t('settings.newStage'),
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
      toast.success(t('settings.taskStepsSaved'));
      setEditingTaskStages(false);
      fetchOrgSettings();
    } catch (error) {
      toast.error(t('settings.taskStepsSaveFailed'));
    }
  };

  const addTaskStage = () => {
    const newStage = {
      id: `stage_${Date.now()}`,
      name: t('settings.newStep')
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

  // Keep profile form in sync with the auth user (and reset the baseline
  // used to detect unsaved changes).
  useEffect(() => {
    if (user) {
      const snapshot = {
        name: user.name || '',
        picture: user.picture || '',
        timezone: user.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/London',
      };
      setProfileForm(snapshot);
      setProfileBaseline(snapshot);
    }
  }, [user]);

  // Dirty check + tab-close guard. We can't reliably block in-app nav under
  // <BrowserRouter> (data-router only), so we at least protect refresh,
  // tab close, and typing a new URL. An inline "Unsaved changes" banner +
  // Discard button covers the in-app case visibly.
  const profileDirty = (
    profileForm.name !== profileBaseline.name ||
    profileForm.picture !== profileBaseline.picture ||
    profileForm.timezone !== profileBaseline.timezone
  );

  useEffect(() => {
    if (!profileDirty) return;
    const handler = (e) => {
      e.preventDefault();
      e.returnValue = ''; // Chrome needs this
      return '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [profileDirty]);

  const discardProfileChanges = () => {
    setProfileForm(profileBaseline);
  };

  const saveProfile = async () => {
    if (!profileForm.name.trim()) { toast.error(t('settings.profileNameEmpty')); return; }
    setSavingProfile(true);
    try {
      await axios.put(`${API}/auth/me`, profileForm, { headers, withCredentials: true });
      await checkAuth();
      // Sync the baseline so the dirty indicator clears immediately;
      // the useEffect on `user` will also reconcile once the auth round-trip
      // returns the canonical server copy.
      setProfileBaseline(profileForm);
      toast.success(t('settings.profileUpdated'));
    } catch (err) {
      toast.error(err?.response?.data?.detail || t('settings.profileUpdateFailed'));
    } finally {
      setSavingProfile(false);
    }
  };

  const changePassword = async () => {
    // Inline validation is handled by disabled button state + helper text;
    // this guard is defense-in-depth.
    if (!pwForm.current_password || !pwForm.new_password) {
      toast.error(t('settings.pwFillBoth'));
      return;
    }
    if (pwForm.new_password.length < 8) {
      toast.error(t('settings.pwTooShort'));
      return;
    }
    if (pwForm.new_password !== pwForm.confirm_password) {
      toast.error(t('settings.pwMismatch'));
      return;
    }
    if (pwForm.new_password === pwForm.current_password) {
      toast.error(t('settings.pwSameAsCurrent'));
      return;
    }
    setSavingPassword(true);
    try {
      // Pass current UI language so the backend sends the security-notice
      // email in the same language the user is using the app in.
      const lang = localStorage.getItem('tako_lang') || 'en';
      await axios.post(`${API}/auth/change-password?lang=${encodeURIComponent(lang)}`, {
        current_password: pwForm.current_password,
        new_password: pwForm.new_password,
      }, { headers, withCredentials: true });
      toast.success(t('settings.pwUpdatedToast'));
      setPwForm({ current_password: '', new_password: '', confirm_password: '' });
      setPwShow({ current: false, next: false, confirm: false });
      setPwJustChanged(true);
      setTimeout(() => setPwJustChanged(false), 5000);
    } catch (err) {
      toast.error(err?.response?.data?.detail || t('settings.passwordUpdateFailed'));
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
      const html = `<html><head><title>${t('settings.invoiceTitle')}</title><style>body{font-family:Arial,sans-serif;padding:20px}@media print{button{display:none}}</style></head><body><button onclick="window.print()" style="margin-bottom:20px;padding:10px 20px;cursor:pointer">${t('settings.printInvoice')}</button><div id="invoice">${sanitized}</div></body></html>`;
      doc.write(html);
      doc.close();
    } catch (error) {
      toast.error(t('settings.invoiceLoadFailed'));
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-4xl" data-testid="settings-page">
        <div>
          <h1 className="text-2xl font-bold text-slate-900" data-testid="settings-title">{t('settings.title')}</h1>
          <p className="text-slate-600 mt-1">{t('settings.pageSubtitle')}</p>
        </div>

        <Tabs defaultValue={defaultTab} className="space-y-6">
          <TabsList className="flex flex-wrap h-auto gap-1 p-1">
            <TabsTrigger value="profile">{t('settings.tabProfile')}</TabsTrigger>
            <TabsTrigger value="organization">{t('settings.tabOrganization')}</TabsTrigger>
            <TabsTrigger value="team">{t('settings.tabTeam')}</TabsTrigger>
            <TabsTrigger value="billing">{t('settings.tabBilling')}</TabsTrigger>
            <TabsTrigger value="integrations">{t('settings.tabIntegrations')}</TabsTrigger>
            <TabsTrigger value="api" data-testid="settings-api-tab">{t('settings.tabApi')}</TabsTrigger>
            <TabsTrigger value="app" data-testid="settings-app-tab">{t('settings.tabMobileApp')}</TabsTrigger>
          </TabsList>

          {/* Profile Tab */}
          <TabsContent value="profile" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <User className="w-5 h-5" />
                  {t('settings.profileCardTitle')}
                </CardTitle>
                <CardDescription>{t('settings.profileCardDesc')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="flex items-center gap-4">
                  {profileForm.picture ? (
                    <img
                      src={profileForm.picture}
                      alt={profileForm.name || user?.name || t('settings.defaultUser')}
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
                      {user?.role || t('settings.roleFallback')}
                    </Badge>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="profile-name">{t('settings.fullName')}</Label>
                    <Input
                      id="profile-name"
                      value={profileForm.name}
                      onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                      placeholder={t('settings.yourName')}
                      data-testid="profile-name-input"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="profile-timezone">{t('settings.timezone')}</Label>
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
                            placeholder={t('settings.timezonePlaceholder')}
                            data-testid="profile-timezone-input"
                            className={profileForm.timezone && !valid ? 'border-amber-400' : ''}
                          />
                          <datalist id="profile-timezone-list">
                            {zones.map((z) => <option key={z} value={z} />)}
                          </datalist>
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <p className="text-xs text-slate-500">
                              {profileForm.timezone && !valid
                                ? <span className="text-amber-600">{t('settings.timezoneNotRecognized')}</span>
                                : <>{t('settings.timezoneIanaHint')} <code>Europe/London</code>, <code>America/New_York</code>.</>}
                            </p>
                            {browserTz && profileForm.timezone !== browserTz && (
                              <button
                                type="button"
                                className="text-xs text-teal-700 hover:underline"
                                onClick={() => setProfileForm({ ...profileForm, timezone: browserTz })}
                              >
                                {t('settings.useCurrentTimezone')} ({browserTz})
                              </button>
                            )}
                          </div>
                        </>
                      );
                    })()}
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="profile-picture">{t('settings.avatarUrl')}</Label>
                    <Input
                      id="profile-picture"
                      value={profileForm.picture}
                      onChange={(e) => setProfileForm({ ...profileForm, picture: e.target.value })}
                      placeholder="https://..."
                      data-testid="profile-picture-input"
                    />
                    <p className="text-xs text-slate-500">{t('settings.avatarHint')}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="text-xs">
                    {profileDirty ? (
                      <span className="inline-flex items-center gap-1.5 text-amber-700">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                        {t('common.unsavedChanges')}
                      </span>
                    ) : (
                      <span className="text-slate-400">{t('common.allChangesSaved')}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {profileDirty && (
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={discardProfileChanges}
                        disabled={savingProfile}
                        data-testid="profile-discard-btn"
                        className="text-slate-500 hover:text-slate-700"
                      >
                        {t('common.discard')}
                      </Button>
                    )}
                    <Button
                      onClick={saveProfile}
                      disabled={savingProfile || !profileDirty}
                      className="bg-[#0EA5A0] hover:bg-[#0B8C88] text-white"
                      data-testid="profile-save-btn"
                    >
                      <Save className="w-4 h-4 mr-2" />
                      {savingProfile ? t('common.saving') : t('common.saveChanges')}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Key className="w-5 h-5" />
                  {t('settings.changePassword')}
                </CardTitle>
                <CardDescription>
                  {t('settings.changePasswordDesc')}
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
                      ? t('settings.pwStrengthWeak')
                      : score === 2
                        ? t('settings.pwStrengthFair')
                        : score === 3
                          ? t('settings.pwStrengthGood')
                          : t('settings.pwStrengthStrong');
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
                          <Label htmlFor="pw-current">{t('settings.currentPassword')}</Label>
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
                              aria-label={pwShow.current ? t('settings.hidePassword') : t('settings.showPassword')}
                            >
                              {pwShow.current ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="pw-new">{t('settings.newPassword')}</Label>
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
                              aria-label={pwShow.next ? t('settings.hidePassword') : t('settings.showPassword')}
                            >
                              {pwShow.next ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="pw-confirm">{t('settings.confirmNewPassword')}</Label>
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
                              aria-label={pwShow.confirm ? t('settings.hidePassword') : t('settings.showPassword')}
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
                            {t('settings.pwStrengthHint')}
                          </p>
                        </div>
                      )}

                      {/* Inline validation messages */}
                      <div className="space-y-1">
                        {tooShort && (
                          <p className="text-xs text-red-600">{t('settings.pwTooShort')}</p>
                        )}
                        {mismatch && (
                          <p className="text-xs text-red-600">{t('settings.pwMismatch')}</p>
                        )}
                        {sameAsCurrent && (
                          <p className="text-xs text-red-600">{t('settings.pwSameAsCurrent')}</p>
                        )}
                        {pwJustChanged && (
                          <p className="text-xs text-emerald-700 flex items-center gap-1.5">
                            <CheckCircle className="w-3.5 h-3.5" />
                            {t('settings.pwUpdatedDetail')}
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
                          {savingPassword ? t('settings.pwUpdating') : t('settings.pwUpdate')}
                        </Button>
                      </div>
                    </>
                  );
                })()}
              </CardContent>
            </Card>

            {/* Partner Programme link card */}
            <Card className="mt-4">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Gift className="w-5 h-5" />
                  {t('settings.partnerProgramme')}
                </CardTitle>
                <CardDescription>{t('settings.partnerProgrammeDesc')}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <p className="text-sm text-slate-600 max-w-lg">
                    {t('settings.partnerProgrammeCta')}
                  </p>
                  <Button
                    className="bg-[#0EA5A0] hover:bg-teal-700"
                    onClick={() => navigate('/partners')}
                    data-testid="open-partner-dashboard-btn"
                  >
                    {t('settings.openPartnerDashboard')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Organization Tab */}
          <TabsContent value="organization">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Building className="w-5 h-5" />
                  {t('settings.orgCardTitle')}
                </CardTitle>
                <CardDescription>{t('settings.orgCardDesc')}</CardDescription>
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
                        <span>{t('settings.orgPlan')} <span className="capitalize font-medium">{organization.subscription_plan || organization.plan || t('settings.orgFreePlan')}</span></span>
                        <span>•</span>
                        <span>{t('settings.orgUsers')} {organization.user_count}/{organization.max_users || organization.max_free_users || 3}</span>
                      </div>
                      {organization.subscription_status === 'active' && (
                        <Badge className="mt-2 bg-emerald-100 text-emerald-700">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          {t('settings.orgActiveSubscription')}
                        </Badge>
                      )}
                    </div>
                    {(!organization.subscription_status || organization.subscription_status !== 'active') && (
                      <div className="p-4 bg-teal-50 border border-indigo-200 rounded-lg">
                        <p className="text-sm text-teal-800 mb-3">
                          {t('settings.orgUpgradePrompt')}
                        </p>
                        <Button
                          className="bg-[#0EA5A0] hover:bg-teal-700"
                          size="sm"
                          onClick={() => navigate('/pricing')}
                        >
                          <Zap className="w-4 h-4 mr-2" />
                          {t('settings.orgUpgrade')}
                        </Button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <p className="text-sm text-slate-600">
                      {t('settings.orgCreatePrompt')}
                    </p>
                    <form onSubmit={handleCreateOrganization} className="flex gap-3">
                      <Input
                        placeholder={t('settings.orgNamePlaceholder')}
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
                            {t('settings.orgCreate')}
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
                    {t('settings.teamMembersTitle')}
                  </CardTitle>
                  <CardDescription>{t('settings.teamMembersDesc')}</CardDescription>
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
                              {member.user_id === user?.user_id && <Badge variant="outline" className="text-xs">{t('settings.youBadge')}</Badge>}
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
                                <SelectItem value="member">{t('settings.roleMember')}</SelectItem>
                                <SelectItem value="admin">{t('settings.roleAdmin')}</SelectItem>
                                <SelectItem value="owner">{t('settings.roleOwner')}</SelectItem>
                              </SelectContent>
                            </Select>
                          ) : (
                            <Badge variant="outline" className="capitalize">{member.role}</Badge>
                          )}
                        </div>
                      </div>
                    ))}
                    {members.length === 0 && (
                      <p className="text-sm text-slate-500 text-center py-4">{t('settings.noTeamMembers')}</p>
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
                      {t('settings.pipelineStagesTitle')}
                    </CardTitle>
                    <CardDescription>{t('settings.pipelineStagesDesc')}</CardDescription>
                  </div>
                  {!editingStages ? (
                    <Button variant="outline" size="sm" onClick={() => setEditingStages(true)}>
                      <Edit className="w-4 h-4 mr-2" />
                      {t('settings.editStages')}
                    </Button>
                  ) : (
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => { setEditingStages(false); setDealStages(orgSettings?.deal_stages || []); }}>
                        {t('common.cancel')}
                      </Button>
                      <Button size="sm" className="bg-[#0EA5A0] hover:bg-teal-700" onClick={handleSaveDealStages}>
                        <Save className="w-4 h-4 mr-2" />
                        {t('common.save')}
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
                        {t('settings.addStage')}
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
                      {t('settings.taskStepsTitle')}
                    </CardTitle>
                    <CardDescription>{t('settings.taskStepsDesc')}</CardDescription>
                  </div>
                  {!editingTaskStages ? (
                    <Button variant="outline" size="sm" onClick={() => setEditingTaskStages(true)}>
                      <Edit className="w-4 h-4 mr-2" />
                      {t('settings.editSteps')}
                    </Button>
                  ) : (
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => { setEditingTaskStages(false); fetchOrgSettings(); }}>
                        {t('common.cancel')}
                      </Button>
                      <Button size="sm" className="bg-[#0EA5A0] hover:bg-teal-700" onClick={handleSaveTaskStages}>
                        <Save className="w-4 h-4 mr-2" />
                        {t('common.save')}
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
                        {t('settings.addStep')}
                      </Button>
                    )}
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
                    {t('settings.inviteTeamTitle')}
                  </CardTitle>
                  <CardDescription>
                    {t('settings.inviteTeamDesc')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Role Selection */}
                  <div className="space-y-2">
                    <Label>{t('settings.inviteAs')}</Label>
                    <Select value={inviteRole} onValueChange={setInviteRole}>
                      <SelectTrigger className="w-[200px]" data-testid="invite-role-select">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="member">{t('settings.roleMember')}</SelectItem>
                        <SelectItem value="admin">{t('settings.roleAdmin')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Method 1: Invite Link */}
                  <div className="p-4 border rounded-lg space-y-3">
                    <div className="flex items-center gap-2">
                      <Link className="w-4 h-4 text-[#0EA5A0]" />
                      <h4 className="font-medium">{t('settings.shareInviteLink')}</h4>
                    </div>
                    <p className="text-sm text-slate-600">{t('settings.shareInviteLinkDesc')}</p>
                    
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
                        {generatingLink ? t('settings.generating') : t('settings.generateInviteLink')}
                      </Button>
                    )}
                    {inviteLink && (
                      <p className="text-xs text-slate-500">
                        {t('settings.expires')} {new Date(inviteLink.expires_at).toLocaleDateString()}
                      </p>
                    )}
                  </div>

                  {/* Method 2: Email Invites */}
                  <div className="p-4 border rounded-lg space-y-3">
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-[#0EA5A0]" />
                      <h4 className="font-medium">{t('settings.sendEmailInvites')}</h4>
                    </div>
                    <p className="text-sm text-slate-600">{t('settings.sendEmailInvitesDesc')}</p>
                    <textarea
                      className="w-full min-h-[100px] p-3 border rounded-lg text-sm resize-none focus:ring-2 focus:ring-[#0EA5A0] focus:border-transparent"
                      placeholder={t('settings.emailInvitesPlaceholder')}
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
                      {sendingInvites ? t('settings.sending') : t('settings.sendInvitations')}
                    </Button>
                  </div>

                  {/* Method 3: CSV Import */}
                  <div className="p-4 border rounded-lg space-y-3">
                    <div className="flex items-center gap-2">
                      <Upload className="w-4 h-4 text-[#0EA5A0]" />
                      <h4 className="font-medium">{t('settings.importFromCsv')}</h4>
                    </div>
                    <p className="text-sm text-slate-600">{t('settings.importFromCsvDesc')}</p>
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
                        {t('settings.chooseCsvFile')}
                      </Button>
                      <span className="text-xs text-slate-500">{t('settings.csvHint')}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Current Team Members */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    {t('settings.teamMembersCount').replace('{count}', members.length)}
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
                      {t('settings.pendingInvitations').replace('{count}', pendingInvites.length)}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {pendingInvites.map((invite) => (
                        <div key={invite.invite_id} className="flex items-center justify-between p-3 border rounded-lg">
                          <div>
                            <p className="font-medium">
                              {invite.type === 'email' ? invite.email : t('settings.inviteLinkLabel')}
                            </p>
                            <p className="text-sm text-slate-500">
                              {t('settings.roleLabel')} {invite.role} •
                              {invite.status === 'expired' ? (
                                <span className="text-red-500 ml-1">{t('settings.statusExpired')}</span>
                              ) : invite.status === 'used' ? (
                                <span className="text-emerald-500 ml-1">{t('settings.statusUsed')}</span>
                              ) : (
                                <span className="text-amber-500 ml-1">{t('settings.statusPending')}</span>
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
                    {t('settings.subscription')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {organization?.subscription_status === 'active' ? (
                    <div className="flex items-center justify-between p-4 bg-emerald-50 rounded-lg">
                      <div>
                        <p className="font-semibold text-emerald-900">{t('settings.proPlanActive')}</p>
                        <p className="text-sm text-emerald-700">
                          {organization.subscription_plan === 'annual' ? t('settings.annualBilling') : t('settings.monthlyBilling')}
                        </p>
                      </div>
                      <Badge className="bg-emerald-600">{t('settings.active')}</Badge>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                      <div>
                        <p className="font-semibold text-slate-900">{t('settings.freePlan')}</p>
                        <p className="text-sm text-slate-500">{t('settings.freePlanUsers')}</p>
                      </div>
                      <Button
                        className="bg-[#0EA5A0] hover:bg-teal-700"
                        onClick={() => navigate('/pricing')}
                      >
                        {t('settings.upgrade')}
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
                    {t('settings.invoices')}
                  </CardTitle>
                  <CardDescription>{t('settings.invoicesDesc')}</CardDescription>
                </CardHeader>
                <CardContent>
                  {invoices.length === 0 ? (
                    <p className="text-center text-slate-500 py-8">{t('settings.noInvoices')}</p>
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
                                <><CheckCircle className="w-3 h-3 mr-1" />{t('settings.paid')}</>
                              ) : (
                                <><Clock className="w-3 h-3 mr-1" />{t('settings.pending')}</>
                              )}
                            </Badge>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => viewInvoice(invoice.invoice_id)}
                            >
                              <ExternalLink className="w-4 h-4 mr-1" />
                              {t('settings.view')}
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
                  {t('settings.aiLlmTitle')}
                </CardTitle>
                <CardDescription>
                  {t('settings.aiLlmDesc')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Status indicator */}
                {(() => {
                  const trial = aiStatus?.trial || {};
                  const source = aiStatus?.source;
                  const provider = aiStatus?.provider === 'anthropic' ? t('settings.providerAnthropic') : t('settings.providerOpenai');
                  const trialExpired = !!trial.ends_at && !trial.active && source !== 'organization' && source !== 'platform';
                  const onTrial = source === 'trial' && trial.active;
                  const sourceLabel = source === 'organization'
                    ? t('settings.sourceYourKey')
                    : source === 'platform'
                      ? t('settings.sourcePlatformKey')
                      : source === 'trial'
                        ? `${t('settings.sourceTrialPrefix')} ${trial.days_remaining} ${trial.days_remaining === 1 ? t('settings.daysLeftSingular') : t('settings.daysLeftPlural')}`
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
                              {t('settings.aiActiveUsing')} {provider} ({sourceLabel})
                            </span>
                          </>
                        ) : (
                          <>
                            <Clock className="w-4 h-4 text-amber-600" />
                            <span className="text-sm font-medium text-amber-700">
                              {trialExpired
                                ? t('settings.trialExpired')
                                : t('settings.aiDisabled')}
                            </span>
                          </>
                        )}
                      </div>
                      {onTrial && (
                        <p className="text-xs text-teal-700/80 mt-1.5">
                          {t('settings.trialCovering')}
                          {trial.ends_at ? ` ${t('settings.trialEnds')} ${new Date(trial.ends_at).toLocaleDateString()}.` : ''}
                          {' '}{t('settings.trialAddKeyAnytime')}
                        </p>
                      )}
                      {trialExpired && (
                        <div className="text-xs text-amber-700/90 mt-2 space-y-2">
                          <p>
                            {t('settings.trialExpiredKeyBody')} <a href="https://console.anthropic.com/" target="_blank" rel="noreferrer" className="underline">console.anthropic.com</a>.
                          </p>
                          <p>
                            {t('settings.trialExpiredSupportHead')} <a href="/support" className="underline font-medium">{t('settings.trialExpiredSupportLink')}</a> {t('settings.trialExpiredSupportTail')}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Anthropic key */}
                <div className="space-y-2">
                  <Label htmlFor="anthropic-key" className="flex items-center gap-2">
                    {t('settings.anthropicApiKey')}
                    <Badge variant="outline" className="text-xs">{t('settings.recommended')}</Badge>
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
                        {showAnthropicKey ? t('settings.hide') : t('settings.show')}
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500">
                    {t('settings.getKeyAt')}{' '}
                    <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener noreferrer" className="text-teal-600 hover:underline">
                      console.anthropic.com <ExternalLink className="w-3 h-3 inline" />
                    </a>
                  </p>
                </div>

                {/* OpenAI key (future) */}
                <div className="space-y-2">
                  <Label htmlFor="openai-key" className="flex items-center gap-2 text-slate-400">
                    {t('settings.openaiApiKey')}
                    <Badge variant="outline" className="text-xs text-slate-400">{t('settings.comingSoon')}</Badge>
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
                  {savingLlm ? t('settings.savingDots') : t('settings.saveAiKeys')}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{t('settings.integrationsTitle')}</CardTitle>
                <CardDescription>{t('settings.integrationsDesc')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 border border-emerald-200 bg-emerald-50/50 rounded-lg flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-slate-900 flex items-center justify-center">
                      <span className="text-white font-bold text-sm">R</span>
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">{t('settings.resendName')}</p>
                      <p className="text-sm text-slate-500">{t('settings.resendDesc')}</p>
                    </div>
                  </div>
                  <Badge className="bg-emerald-100 text-emerald-700">{t('settings.verified')}</Badge>
                </div>
                <div className="p-4 border border-slate-200 rounded-lg flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-slate-900 flex items-center justify-center">
                      <span className="text-white font-bold text-sm">Kit</span>
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">{t('settings.kitName')}</p>
                      <p className="text-sm text-slate-500">{t('settings.kitDesc')}</p>
                    </div>
                  </div>
                  <Badge className="bg-slate-100 text-slate-600">{t('settings.optional')}</Badge>
                </div>
                <div className="p-4 border border-slate-200 rounded-lg flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center">
                      <span className="text-white font-bold text-sm">in</span>
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">{t('settings.linkedinName')}</p>
                      <p className="text-sm text-slate-500">{t('settings.linkedinDesc')}</p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" data-testid="connect-linkedin-btn">{t('settings.connect')}</Button>
                </div>
                <div className="p-4 border border-slate-200 rounded-lg flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center">
                      <svg className="w-7 h-7" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">{t('settings.googleCalName')}</p>
                      <p className="text-sm text-slate-500">{t('settings.googleCalDesc')}</p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={async () => {
                    try {
                      const r = await axios.get(`${API}/calendar/google/auth-url`, { headers: { Authorization: `Bearer ${token}` } });
                      window.location.href = r.data.auth_url;
                    } catch (e) { toast.error(e.response?.data?.detail || t('settings.googleConnectFailed')); }
                  }} data-testid="connect-google-cal-btn">{t('settings.connect')}</Button>
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
                          <p className="font-medium text-slate-900">{t('settings.stripeName')}</p>
                          <p className="text-sm text-slate-500">{t('settings.stripeDesc')}</p>
                        </div>
                      </div>
                      <Badge className="bg-emerald-100 text-emerald-700">{t('settings.connected')}</Badge>
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
                  <CardTitle className="text-lg flex items-center gap-2"><Key className="w-5 h-5" /> {t('settings.apiKeysTitle')}</CardTitle>
                  <CardDescription>{t('settings.apiKeysDesc')}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-2">
                    <Input placeholder={t('settings.apiKeyNamePlaceholder')} value={newKeyName} onChange={(e) => setNewKeyName(e.target.value)} className="max-w-xs" data-testid="api-key-name" />
                    <Button className="bg-[#0EA5A0] hover:bg-teal-700" onClick={async () => {
                      try {
                        const res = await axios.post(`${API}/api-keys?name=${encodeURIComponent(newKeyName || t('settings.defaultKeyName'))}`, {}, { headers: { Authorization: `Bearer ${token}` } });
                        setGeneratedKey(res.data.key);
                        setNewKeyName('');
                        const keysRes = await axios.get(`${API}/api-keys`, { headers: { Authorization: `Bearer ${token}` } });
                        setApiKeys(keysRes.data);
                        toast.success(t('settings.apiKeyCreated'));
                      } catch { toast.error(t('settings.apiKeyCreateFailed')); }
                    }} data-testid="create-api-key">{t('settings.generateKey')}</Button>
                  </div>
                  {generatedKey && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                      <p className="text-xs text-emerald-700 font-medium mb-1">{t('settings.newApiKeyTitle')}</p>
                      <code className="text-sm bg-white p-2 rounded block break-all border" data-testid="generated-key">{generatedKey}</code>
                      <Button size="sm" variant="outline" className="mt-2" onClick={() => { navigator.clipboard.writeText(generatedKey); toast.success(t('settings.copiedShort')); }}>{t('settings.copy')}</Button>
                    </div>
                  )}
                  {apiKeys.length > 0 && (
                    <div className="space-y-2">
                      {apiKeys.map(k => (
                        <div key={k.key_id} className="flex items-center justify-between p-3 border rounded-lg">
                          <div>
                            <p className="font-medium text-sm">{k.name}</p>
                            <p className="text-xs text-slate-500">{k.key_prefix} | {t('settings.keyLastUsed')} {k.last_used ? new Date(k.last_used).toLocaleDateString() : t('settings.keyNeverUsed')}</p>
                          </div>
                          <Button size="sm" variant="ghost" className="text-red-500" onClick={async () => {
                            await axios.delete(`${API}/api-keys/${k.key_id}`, { headers: { Authorization: `Bearer ${token}` } });
                            setApiKeys(prev => prev.filter(x => x.key_id !== k.key_id));
                            toast.success(t('settings.keyRevoked'));
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
                  <CardTitle className="text-lg flex items-center gap-2">{t('settings.webhooksTitle')}</CardTitle>
                  <CardDescription>{t('settings.webhooksDesc')}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-2">
                    <Input placeholder={t('settings.webhookUrlPlaceholder')} value={newWebhookUrl} onChange={(e) => setNewWebhookUrl(e.target.value)} className="flex-1" data-testid="webhook-url" />
                    <Input placeholder={t('settings.webhookNamePlaceholder')} value={newWebhookName} onChange={(e) => setNewWebhookName(e.target.value)} className="w-32" />
                    <Button variant="outline" onClick={async () => {
                      if (!newWebhookUrl) return;
                      try {
                        await axios.post(`${API}/webhooks?url=${encodeURIComponent(newWebhookUrl)}&name=${encodeURIComponent(newWebhookName || t('settings.defaultKeyName'))}&events=lead.created&events=deal.stage_changed&events=contact.created`, {}, { headers: { Authorization: `Bearer ${token}` } });
                        setNewWebhookUrl(''); setNewWebhookName('');
                        const res = await axios.get(`${API}/webhooks`, { headers: { Authorization: `Bearer ${token}` } });
                        setWebhooks(res.data);
                        toast.success(t('settings.webhookRegistered'));
                      } catch (err) { toast.error(err.response?.data?.detail || t('settings.webhookFailed')); }
                    }} data-testid="add-webhook">{t('settings.addWebhook')}</Button>
                  </div>
                  <p className="text-xs text-slate-500">{t('settings.webhookEventsHint')}</p>
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
                        toast.success(t('settings.webhookDeleted'));
                      }}><Trash2 className="w-4 h-4" /></Button>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* API Docs */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">{t('settings.quickStartGuide')}</CardTitle>
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
                <CardTitle>{t('settings.installTakoTitle')}</CardTitle>
                <CardDescription>{t('settings.installTakoDesc')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center gap-4 p-4 bg-teal-50 rounded-lg border border-teal-100">
                  <img src="/icon-192.png" alt="TAKO" className="w-16 h-16 rounded-2xl shadow-md" />
                  <div>
                    <h3 className="font-bold text-slate-900">{t('settings.pwaAppName')}</h3>
                    <p className="text-sm text-slate-500">{t('settings.pwaAppDesc')}</p>
                  </div>
                  <Button
                    className="ml-auto bg-[#0EA5A0] hover:bg-teal-700"
                    data-testid="pwa-install-settings-btn"
                    onClick={() => {
                      if (window.deferredPWAPrompt) {
                        window.deferredPWAPrompt.prompt();
                      } else {
                        toast.success(t('settings.pwaManualHint'));
                      }
                    }}
                  >
                    {t('settings.installApp')}
                  </Button>
                </div>
                <div className="space-y-3">
                  <h4 className="font-medium text-slate-800">{t('settings.howToInstall')}</h4>
                  <div className="grid gap-3 text-sm">
                    <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
                      <span className="font-semibold text-[#0EA5A0] shrink-0">{t('settings.installChrome')}</span>
                      <span className="text-slate-600">{t('settings.installChromeDesc')}</span>
                    </div>
                    <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
                      <span className="font-semibold text-[#0EA5A0] shrink-0">{t('settings.installSafari')}</span>
                      <span className="text-slate-600">{t('settings.installSafariDesc')}</span>
                    </div>
                    <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
                      <span className="font-semibold text-[#0EA5A0] shrink-0">{t('settings.installAndroid')}</span>
                      <span className="text-slate-600">{t('settings.installAndroidDesc')}</span>
                    </div>
                  </div>
                </div>
                <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-100">
                  <p className="text-sm text-emerald-800">
                    <strong>{t('settings.alreadyInstalledTitle')}</strong> {t('settings.alreadyInstalledDesc')}
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
