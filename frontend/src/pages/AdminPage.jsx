import React, { useState, useEffect } from 'react';
import { useAuth, API } from '../App';
import { useT } from '../useT';
import DashboardLayout from '../components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { toast } from 'sonner';
import axios from 'axios';
import {
  Users,
  Building,
  Target,
  TrendingUp,
  DollarSign,
  Tag,
  UserPlus,
  Percent,
  Gift,
  Copy,
  Trash2,
  Edit,
  Check,
  X,
  RefreshCw,
  Layers,
  Settings,
  Mail,
  CreditCard,
  Wallet,
  Save
} from 'lucide-react';

const AdminPage = () => {
  const { token, user } = useAuth();
  const { t } = useT();
  const isSuperAdmin = user?.role === 'super_admin' || user?.role === 'deputy_admin' || user?.email === 'florian@unyted.world';
  const [stats, setStats] = useState(null);
  const [organizations, setOrganizations] = useState([]);
  const [platformSettings, setPlatformSettings] = useState(null);
  const [users, setUsers] = useState([]);
  const [discountCodes, setDiscountCodes] = useState([]);
  const [partners, setPartners] = useState([]);
  const [partnerFilter, setPartnerFilter] = useState('all'); // 'all' | 'referral' | 'agency' | 'pending'
  const [selectedPartner, setSelectedPartner] = useState(null);
  const [partnerDetails, setPartnerDetails] = useState(null);
  const [loading, setLoading] = useState(true);

  // Dialog states
  const [isDiscountDialogOpen, setIsDiscountDialogOpen] = useState(false);
  const [newDiscount, setNewDiscount] = useState({
    code: '',
    discount_percent: 10,
    discount_type: 'percentage',
    max_uses: null,
    valid_until: ''
  });
  const [supportRequests, setSupportRequests] = useState([]);
  // Data Explorer state
  const [explorerCollections, setExplorerCollections] = useState({});
  const [explorerCollection, setExplorerCollection] = useState('');
  const [explorerData, setExplorerData] = useState(null);
  const [explorerSearch, setExplorerSearch] = useState('');
  const [explorerPage, setExplorerPage] = useState(0);
  // Reports
  const [reportOverview, setReportOverview] = useState(null);
  const [reportPerformance, setReportPerformance] = useState([]);
  const [reportForecast, setReportForecast] = useState(null);
  const [reportActivity, setReportActivity] = useState(null);
  // User creation
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [newUser, setNewUser] = useState({ email: '', name: '', password: '', role: 'member', organization_id: '' });
  const [showResetPw, setShowResetPw] = useState(null);
  const [resetPw, setResetPw] = useState('');

  const headers = token ? { Authorization: `Bearer ${token}` } : {};

  useEffect(() => {
    if (!token) return;
    fetchAllData();
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [statsRes, orgsRes, usersRes, discountsRes, partnersRes, settingsRes, supportRes] = await Promise.all([
        axios.get(`${API}/admin/stats`, { headers, withCredentials: true }).catch(() => null),
        axios.get(`${API}/admin/organizations`, { headers, withCredentials: true }).catch(() => null),
        axios.get(`${API}/admin/users`, { headers, withCredentials: true }).catch(() => null),
        axios.get(`${API}/admin/discount-codes`, { headers, withCredentials: true }).catch(() => null),
        axios.get(`${API}/admin/partners`, { headers, withCredentials: true }).catch(() => null),
        axios.get(`${API}/admin/settings`, { headers, withCredentials: true }).catch(() => null),
        axios.get(`${API}/admin/contact-requests`, { headers, withCredentials: true }).catch(() => null)
      ]);

      if (statsRes) setStats(statsRes.data);
      if (orgsRes) setOrganizations(orgsRes.data);
      if (usersRes) setUsers(usersRes.data.users || []);
      if (discountsRes) setDiscountCodes(discountsRes.data.discount_codes || []);
      if (partnersRes) setPartners(partnersRes.data.partners || []);
      if (settingsRes) setPlatformSettings(settingsRes.data);
      if (supportRes) setSupportRequests(supportRes.data.contact_requests || []);
    } catch (error) {
      if (error.response?.status === 403) {
        toast.error(t('admin.superAdminRequired'));
      } else {
        toast.error(t('admin.loadFailed'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateSupportStatus = async (requestId, status) => {
    try {
      await axios.put(`${API}/admin/contact-requests/${requestId}/status?status=${status}`, {}, { headers, withCredentials: true });
      toast.success(t('admin.statusUpdated'));
      fetchAllData();
    } catch { toast.error(t('admin.updateFailed')); }
  };

  const fetchExplorerCollections = async () => {
    try {
      const res = await axios.get(`${API}/admin/data-explorer`, { headers, withCredentials: true });
      setExplorerCollections(res.data.collections || {});
    } catch (err) { console.error(err); }
  };

  const fetchExplorerData = async (coll, page = 0, search = '') => {
    try {
      const params = new URLSearchParams({ skip: page * 50, limit: 50 });
      if (search) params.append('search', search);
      const res = await axios.get(`${API}/admin/data-explorer/${coll}?${params}`, { headers, withCredentials: true });
      setExplorerData(res.data);
    } catch (err) { toast.error(err.response?.data?.detail || t('admin.loadFailedShort')); }
  };

  const handleExploreCollection = (coll) => {
    setExplorerCollection(coll);
    setExplorerPage(0);
    setExplorerSearch('');
    fetchExplorerData(coll, 0, '');
  };

  const fetchReports = async () => {
    try {
      const [ov, perf, fc, act] = await Promise.all([
        axios.get(`${API}/admin/reports/overview`, { headers, withCredentials: true }),
        axios.get(`${API}/admin/reports/user-performance`, { headers, withCredentials: true }),
        axios.get(`${API}/admin/reports/pipeline-forecast`, { headers, withCredentials: true }),
        axios.get(`${API}/admin/reports/activity-log?days=30`, { headers, withCredentials: true })
      ]);
      setReportOverview(ov.data);
      setReportPerformance(perf.data);
      setReportForecast(fc.data);
      setReportActivity(act.data);
    } catch { toast.error(t('admin.reportsLoadFailed')); }
  };

  const handleCreateUser = async () => {
    try {
      await axios.post(`${API}/admin/users/create`, newUser, { headers, withCredentials: true });
      toast.success(t('admin.userCreated'));
      setShowCreateUser(false);
      setNewUser({ email: '', name: '', password: '', role: 'member', organization_id: '' });
      fetchAllData();
    } catch (e) { toast.error(e.response?.data?.detail || t('common.failed')); }
  };

  const handleResetPassword = async (userId) => {
    if (!resetPw) return;
    try {
      await axios.put(`${API}/admin/users/${userId}/password`, { new_password: resetPw }, { headers, withCredentials: true });
      toast.success(t('admin.passwordReset'));
      setShowResetPw(null);
      setResetPw('');
    } catch { toast.error(t('common.failed')); }
  };

  const handleExportCSV = (entity) => {
    window.open(`${API}/admin/reports/export/${entity}`, '_blank');
  };

  const handleUpdateSettings = async (settingKey, value) => {
    try {
      await axios.put(`${API}/admin/settings`, { [settingKey]: value }, { headers, withCredentials: true });
      toast.success(t('admin.settingsUpdated'));
      fetchAllData();
    } catch (error) {
      toast.error(t('admin.settingsUpdateFailed'));
    }
  };

  const handleSaveAllSettings = async (e) => {
    e.preventDefault();
    try {
      await axios.put(`${API}/admin/settings`, platformSettings, { headers, withCredentials: true });
      toast.success(t('admin.settingsSaved'));
    } catch (error) {
      toast.error(t('admin.settingsSaveFailed'));
    }
  };

  const handleCreateDiscount = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/admin/discount-codes`, newDiscount, { headers, withCredentials: true });
      toast.success(t('admin.discountCreated'));
      setIsDiscountDialogOpen(false);
      setNewDiscount({ code: '', discount_percent: 10, discount_type: 'percentage', max_uses: null, valid_until: '' });
      fetchAllData();
    } catch (error) {
      toast.error(error.response?.data?.detail || t('admin.discountCreateFailed'));
    }
  };

  const handleDeleteDiscount = async (codeId) => {
    if (!confirm(t('admin.confirmDeleteDiscount'))) return;
    try {
      await axios.delete(`${API}/admin/discount-codes/${codeId}`, { headers, withCredentials: true });
      toast.success(t('admin.discountDeleted'));
      fetchAllData();
    } catch (error) {
      toast.error(t('admin.discountDeleteFailed'));
    }
  };

  const handleToggleDiscount = async (codeId, currentStatus) => {
    try {
      await axios.put(`${API}/admin/discount-codes/${codeId}`, { is_active: !currentStatus }, { headers, withCredentials: true });
      toast.success(!currentStatus ? t('admin.discountActivated') : t('admin.discountDeactivated'));
      fetchAllData();
    } catch (error) {
      toast.error(t('admin.discountUpdateFailed'));
    }
  };

  const handleApprovePartner = async (partnerId) => {
    try {
      await axios.put(`${API}/admin/partners/${partnerId}/approve`, {}, { headers, withCredentials: true });
      toast.success(t('admin.partnerApproved'));
      fetchAllData();
      if (selectedPartner === partnerId) loadPartnerDetails(partnerId);
    } catch (error) {
      toast.error(error.response?.data?.detail || t('admin.partnerActionFailed'));
    }
  };

  const handleSuspendPartner = async (partnerId) => {
    if (!confirm(t('admin.confirmSuspendPartner'))) return;
    try {
      await axios.put(`${API}/admin/partners/${partnerId}/suspend`, {}, { headers, withCredentials: true });
      toast.success(t('admin.partnerSuspended'));
      fetchAllData();
      if (selectedPartner === partnerId) loadPartnerDetails(partnerId);
    } catch (error) {
      toast.error(error.response?.data?.detail || t('admin.partnerActionFailed'));
    }
  };

  const handleReactivatePartner = async (partnerId) => {
    try {
      await axios.put(`${API}/admin/partners/${partnerId}/reactivate`, {}, { headers, withCredentials: true });
      toast.success(t('admin.partnerReactivated'));
      fetchAllData();
      if (selectedPartner === partnerId) loadPartnerDetails(partnerId);
    } catch (error) {
      toast.error(error.response?.data?.detail || t('admin.partnerActionFailed'));
    }
  };

  const handleMarkOnboarding = async (partnerId) => {
    const customer = prompt(t('admin.onboardingCustomerPrompt') || 'Customer email or org (optional):', '');
    const notes = prompt(t('admin.onboardingNotesPrompt') || 'Notes (optional):', '');
    try {
      await axios.post(
        `${API}/admin/partners/${partnerId}/mark-onboarding`,
        { customer_email: customer || null, notes: notes || null },
        { headers, withCredentials: true }
      );
      toast.success(t('admin.onboardingRecorded'));
      fetchAllData();
      if (selectedPartner === partnerId) loadPartnerDetails(partnerId);
    } catch (error) {
      toast.error(error.response?.data?.detail || t('admin.partnerActionFailed'));
    }
  };

  const handleMarkPaid = async (partnerId, pendingAmount) => {
    const amount = prompt(
      t('admin.payoutPrompt').replace('{amount}', (pendingAmount || 0).toFixed(2)),
      (pendingAmount || 0).toFixed(2)
    );
    if (!amount) return;
    try {
      await axios.post(
        `${API}/admin/partners/${partnerId}/mark-paid?amount=${parseFloat(amount)}`,
        {},
        { headers, withCredentials: true }
      );
      toast.success(t('admin.payoutProcessed'));
      fetchAllData();
      if (selectedPartner === partnerId) loadPartnerDetails(partnerId);
    } catch (error) {
      toast.error(error.response?.data?.detail || t('admin.payoutFailed'));
    }
  };

  const loadPartnerDetails = async (partnerId) => {
    try {
      const res = await axios.get(`${API}/admin/partners/${partnerId}`, { headers, withCredentials: true });
      setSelectedPartner(partnerId);
      setPartnerDetails(res.data);
    } catch (error) {
      toast.error(t('admin.partnerActionFailed'));
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success(t('admin.copiedToClipboard'));
  };

  const handleUpdateUserRole = async (userId, newRole) => {
    try {
      await axios.put(`${API}/admin/users/${userId}/role?role=${newRole}`, {}, { headers, withCredentials: true });
      toast.success(t('admin.userRoleUpdated'));
      fetchAllData();
    } catch (error) {
      toast.error(t('admin.userRoleUpdateFailed'));
    }
  };

  if (!isSuperAdmin) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-24 text-center">
          <div>
            <p className="text-xl font-bold text-slate-900 mb-2">{t('admin.accessDenied')}</p>
            <p className="text-slate-500">{t('admin.accessDeniedDesc')}</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-2 border-[#0EA5A0] border-t-transparent rounded-full animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  const statCards = [
    { title: t('admin.totalUsers'), value: stats?.total_users || 0, icon: <Users className="w-5 h-5" />, color: 'bg-teal-100 text-[#0EA5A0]' },
    { title: t('admin.organizations'), value: stats?.total_organizations || 0, icon: <Building className="w-5 h-5" />, color: 'bg-emerald-100 text-emerald-600' },
    { title: t('admin.revenue'), value: `€${(stats?.total_revenue || 0).toLocaleString()}`, icon: <DollarSign className="w-5 h-5" />, color: 'bg-rose-100 text-rose-600' },
    { title: t('admin.partners'), value: stats?.total_partners || 0, icon: <UserPlus className="w-5 h-5" />, color: 'bg-teal-100 text-teal-600' },
    { title: t('admin.discountCodes'), value: stats?.total_discount_codes || 0, icon: <Tag className="w-5 h-5" />, color: 'bg-amber-100 text-amber-600' },
    { title: t('admin.partnerEarnings'), value: `€${(stats?.total_partner_earnings || 0).toLocaleString()}`, icon: <Gift className="w-5 h-5" />, color: 'bg-cyan-100 text-cyan-600' }
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6" data-testid="admin-page">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900" data-testid="admin-title">{t('admin.title')}</h1>
            <p className="text-slate-600 mt-1">{t('admin.subtitle')}</p>
          </div>
          <Button variant="outline" onClick={fetchAllData} data-testid="refresh-btn">
            <RefreshCw className="w-4 h-4 mr-2" />
            {t('common.refresh')}
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {statCards.map((stat, index) => (
            <Card key={index} data-testid={`admin-stat-${index}`}>
              <CardContent className="p-4">
                <div className={`w-8 h-8 rounded-lg ${stat.color} flex items-center justify-center mb-3`}>
                  {stat.icon}
                </div>
                <p className="text-xl font-bold text-slate-900">{stat.value}</p>
                <p className="text-xs text-slate-500">{stat.title}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Tabs */}
        <Tabs defaultValue="users" className="space-y-6">
          <TabsList data-testid="admin-tabs">
            <TabsTrigger value="users">{t('admin.users')}</TabsTrigger>
            <TabsTrigger value="organizations">{t('admin.organizations')}</TabsTrigger>
            <TabsTrigger value="support" data-testid="admin-support-tab">{t('admin.support')}</TabsTrigger>
            <TabsTrigger value="discounts">{t('admin.discountCodes')}</TabsTrigger>
            <TabsTrigger value="partners">{t('admin.partners')}</TabsTrigger>
            <TabsTrigger value="explorer" data-testid="admin-explorer-tab" onClick={() => { if (!Object.keys(explorerCollections).length) fetchExplorerCollections(); }}>{t('admin.dataExplorer')}</TabsTrigger>
            <TabsTrigger value="reports" data-testid="admin-reports-tab">{t('admin.reports')}</TabsTrigger>
            <TabsTrigger value="settings">{t('admin.settings')}</TabsTrigger>
          </TabsList>

          {/* Users Tab */}
          <TabsContent value="users">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>{t('admin.allUsers')}</CardTitle>
                  <CardDescription>{t('admin.allUsersDesc')}</CardDescription>
                </div>
                <Button className="bg-[#0EA5A0] hover:bg-[#0B8C88] text-white" onClick={() => setShowCreateUser(true)} data-testid="create-user-btn">
                  <UserPlus className="w-4 h-4 mr-2" /> {t('admin.createUser')}
                </Button>
              </CardHeader>
              <CardContent>
                {users.length === 0 ? (
                  <p className="text-center text-slate-500 py-8">{t('admin.noUsers')}</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full" data-testid="users-table">
                      <thead>
                        <tr className="border-b border-slate-200">
                          <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">{t('admin.colUser')}</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">{t('admin.colEmail')}</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">{t('admin.colRole')}</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">{t('admin.colOrganization')}</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">{t('admin.colLastLogin')}</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">{t('admin.colJoined')}</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">{t('admin.colActions')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {users.map((u, index) => (
                          <tr key={u.user_id} className="border-b border-slate-100 hover:bg-slate-50" data-testid={`user-row-${index}`}>
                            <td className="py-3 px-4">
                              <p className="font-medium text-slate-900">{u.name}</p>
                              <p className="text-xs text-slate-500">{u.user_id}</p>
                            </td>
                            <td className="py-3 px-4 text-sm text-slate-600">{u.email}</td>
                            <td className="py-3 px-4">
                              <Select
                                value={u.role || 'member'}
                                onValueChange={(value) => handleUpdateUserRole(u.user_id, value)}
                              >
                                <SelectTrigger className="w-[130px] h-8">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="member">{t('admin.roleMember')}</SelectItem>
                                  <SelectItem value="admin">{t('admin.roleAdmin')}</SelectItem>
                                  <SelectItem value="owner">{t('admin.roleOwner')}</SelectItem>
                                  <SelectItem value="deputy_admin">{t('admin.roleDeputyAdmin')}</SelectItem>
                                  <SelectItem value="support">{t('admin.roleSupport')}</SelectItem>
                                  <SelectItem value="super_admin">{t('admin.roleSuperAdmin')}</SelectItem>
                                </SelectContent>
                              </Select>
                            </td>
                            <td className="py-3 px-4 text-sm text-slate-500">
                              {u.organization_id || '—'}
                            </td>
                            <td className="py-3 px-4 text-xs text-slate-500">
                              {u.last_login ? new Date(u.last_login).toLocaleDateString() : t('admin.never')}
                            </td>
                            <td className="py-3 px-4 text-xs text-slate-500">
                              {u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}
                            </td>
                            <td className="py-3 px-4 flex gap-1">
                              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { setShowResetPw(u.user_id); setResetPw(''); }} data-testid={`reset-pw-${index}`}>{t('admin.resetPw')}</Button>
                              {u.email !== 'florian@unyted.world' && (
                                <Button variant="ghost" size="sm" className="text-red-500 h-7" onClick={async () => {
                                  if (!window.confirm(t('admin.confirmDeleteUser').replace('{name}', u.name))) return;
                                  try { await axios.delete(`${API}/admin/users/${u.user_id}`, { headers, withCredentials: true }); toast.success(t('admin.userDeleted')); fetchAllData(); } catch { toast.error(t('common.failed')); }
                                }} data-testid={`delete-user-${index}`}><Trash2 className="w-3.5 h-3.5" /></Button>
                              )}
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

          {/* Organizations Tab */}
          <TabsContent value="organizations">
            <Card>
              <CardHeader>
                <CardTitle>{t('admin.allOrganizations')}</CardTitle>
                <CardDescription>{t('admin.allOrganizationsDesc')}</CardDescription>
              </CardHeader>
              <CardContent>
                {organizations.length === 0 ? (
                  <p className="text-center text-slate-500 py-8">{t('admin.noOrganizations')}</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full" data-testid="organizations-table">
                      <thead>
                        <tr className="border-b border-slate-200">
                          <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">{t('admin.colOrganization')}</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">{t('admin.colLicence')}</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">{t('admin.users')}</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">{t('admin.colCreated')}</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">{t('admin.colActions')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {organizations.map((org, index) => {
                          const licenceType = org.license_type;
                          const licenceLabelKey = {
                            onetime: 'admin.licenceOnetime',
                            installment_12: 'admin.licence12mo',
                            installment_24: 'admin.licence24mo',
                            unyt: 'admin.licenceUnyt',
                          }[licenceType];
                          const hasLicence = !!licenceType || org.license_status === 'active' || org.license_status === 'completed';
                          return (
                          <tr key={org.organization_id} className="border-b border-slate-100 hover:bg-slate-50" data-testid={`org-row-${index}`}>
                            <td className="py-3 px-4">
                              <p className="font-medium text-slate-900">{org.name}</p>
                              <p className="text-xs text-slate-500">{org.organization_id}</p>
                              {org.email_domain && <p className="text-xs text-teal-600">@{org.email_domain}</p>}
                            </td>
                            <td className="py-3 px-4">
                              <span className={`text-xs px-2 py-1 rounded-full ${
                                hasLicence ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'
                              }`}>
                                {licenceLabelKey ? t(licenceLabelKey) : (hasLicence ? t('admin.licenceActive') : t('admin.licenceNone'))}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-slate-600" data-testid={`org-users-${index}`}>
                              {org.user_count}
                            </td>
                            <td className="py-3 px-4 text-sm text-slate-500">
                              {new Date(org.created_at).toLocaleDateString()}
                            </td>
                            <td className="py-3 px-4">
                              <Button variant="ghost" size="sm" className="text-red-500 h-7" onClick={async () => {
                                if (!window.confirm(t('admin.confirmDeleteOrg').replace('{name}', org.name))) return;
                                try { await axios.delete(`${API}/admin/organizations/${org.organization_id}`, { headers, withCredentials: true }); toast.success(t('admin.organizationDeleted')); fetchAllData(); } catch { toast.error(t('common.failed')); }
                              }} data-testid={`delete-org-${index}`}><Trash2 className="w-3.5 h-3.5" /></Button>
                            </td>
                          </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Support Requests Tab */}
          <TabsContent value="support">
            <Card>
              <CardHeader>
                <CardTitle>{t('admin.supportRequests')}</CardTitle>
                <CardDescription>{t('admin.supportRequestsDesc')}</CardDescription>
              </CardHeader>
              <CardContent>
                {supportRequests.length === 0 ? (
                  <p className="text-center text-slate-500 py-8">{t('admin.noSupportRequests')}</p>
                ) : (
                  <div className="space-y-3">
                    {supportRequests.map((req, i) => (
                      <div key={req.request_id || i} className="border border-slate-200 rounded-lg p-4" data-testid={`support-req-${i}`}>
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-medium text-slate-900">{req.name || t('admin.anonymous')}</p>
                              <span className={`text-xs px-2 py-0.5 rounded-full ${
                                req.status === 'resolved' ? 'bg-emerald-100 text-emerald-700' :
                                req.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                                'bg-amber-100 text-amber-700'
                              }`}>{req.status || 'new'}</span>
                            </div>
                            <p className="text-sm text-slate-500">{req.email}</p>
                            {req.subject && <p className="text-sm font-medium text-slate-700 mt-1">{req.subject}</p>}
                            <p className="text-sm text-slate-600 mt-1">{req.message}</p>
                            <p className="text-xs text-slate-400 mt-2">{req.created_at ? new Date(req.created_at).toLocaleString() : ''}</p>
                          </div>
                          <div className="flex gap-1 ml-3">
                            <Select value={req.status || 'new'} onValueChange={(v) => handleUpdateSupportStatus(req.request_id, v)}>
                              <SelectTrigger className="w-[120px] h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="new">{t('admin.statusNew')}</SelectItem>
                                <SelectItem value="in_progress">{t('admin.statusInProgress')}</SelectItem>
                                <SelectItem value="resolved">{t('admin.statusResolved')}</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Discount Codes Tab */}
          <TabsContent value="discounts">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>{t('admin.discountCodes')}</CardTitle>
                  <CardDescription>{t('admin.discountCodesDesc')}</CardDescription>
                </div>
                <Dialog open={isDiscountDialogOpen} onOpenChange={setIsDiscountDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="bg-[#0EA5A0] hover:bg-teal-700" data-testid="create-discount-btn">
                      <Tag className="w-4 h-4 mr-2" />
                      {t('admin.createCode')}
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{t('admin.createDiscountCode')}</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleCreateDiscount} className="space-y-4 pt-4">
                      <div className="space-y-2">
                        <Label>{t('admin.codeRequired')}</Label>
                        <Input
                          value={newDiscount.code}
                          onChange={(e) => setNewDiscount({ ...newDiscount, code: e.target.value.toUpperCase() })}
                          placeholder={t('admin.codePlaceholder')}
                          required
                          data-testid="discount-code-input"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>{t('admin.discountPercent')}</Label>
                          <Input
                            type="number"
                            value={newDiscount.discount_percent}
                            onChange={(e) => setNewDiscount({ ...newDiscount, discount_percent: parseFloat(e.target.value) })}
                            min={0}
                            max={100}
                            data-testid="discount-percent-input"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>{t('admin.maxUses')}</Label>
                          <Input
                            type="number"
                            value={newDiscount.max_uses || ''}
                            onChange={(e) => setNewDiscount({ ...newDiscount, max_uses: e.target.value ? parseInt(e.target.value) : null })}
                            placeholder={t('admin.unlimited')}
                            data-testid="discount-max-uses"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>{t('admin.validUntil')}</Label>
                        <Input
                          type="date"
                          value={newDiscount.valid_until}
                          onChange={(e) => setNewDiscount({ ...newDiscount, valid_until: e.target.value })}
                          data-testid="discount-valid-until"
                        />
                      </div>
                      <Button type="submit" className="w-full bg-[#0EA5A0] hover:bg-teal-700" data-testid="submit-discount-btn">
                        {t('admin.createDiscountCode')}
                      </Button>
                    </form>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                {discountCodes.length === 0 ? (
                  <p className="text-center text-slate-500 py-8">{t('admin.noDiscountCodes')}</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full" data-testid="discounts-table">
                      <thead>
                        <tr className="border-b border-slate-200">
                          <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">{t('admin.colCode')}</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">{t('admin.colDiscount')}</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">{t('admin.colUses')}</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">{t('admin.colStatus')}</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">{t('admin.colActions')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {discountCodes.map((code, index) => (
                          <tr key={code.code_id} className="border-b border-slate-100 hover:bg-slate-50" data-testid={`discount-row-${index}`}>
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-bold text-slate-900">{code.code}</span>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6"
                                  onClick={() => copyToClipboard(code.code)}
                                >
                                  <Copy className="w-3 h-3" />
                                </Button>
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <span className="text-[#0EA5A0] font-semibold">{code.discount_percent}%</span>
                            </td>
                            <td className="py-3 px-4 text-slate-600">
                              {code.current_uses}/{code.max_uses || '∞'}
                            </td>
                            <td className="py-3 px-4">
                              <button
                                onClick={() => handleToggleDiscount(code.code_id, code.is_active)}
                                className={`text-xs px-2 py-1 rounded-full ${
                                  code.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                                }`}
                              >
                                {code.is_active ? t('admin.active') : t('admin.inactive')}
                              </button>
                            </td>
                            <td className="py-3 px-4">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-rose-600 hover:text-rose-700"
                                onClick={() => handleDeleteDiscount(code.code_id)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
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

          {/* Partners Tab */}
          <TabsContent value="partners">
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Layers className="w-5 h-5" />
                      {t('admin.partnerProgramme')}
                    </CardTitle>
                    <CardDescription>{t('admin.partnersDesc')}</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    {['all', 'referral', 'agency', 'pending'].map((f) => (
                      <Button
                        key={f}
                        variant={partnerFilter === f ? 'default' : 'outline'}
                        size="sm"
                        className={partnerFilter === f ? 'bg-[#0EA5A0] hover:bg-teal-700' : ''}
                        onClick={() => setPartnerFilter(f)}
                        data-testid={`partner-filter-${f}`}
                      >
                        {t(`admin.partnerFilter.${f}`)}
                      </Button>
                    ))}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {/* Commission structure info */}
                <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="p-4 bg-teal-50 rounded-lg">
                    <p className="font-semibold text-[#0EA5A0] text-sm mb-1">{t('admin.tierReferral')}</p>
                    <p className="text-slate-600 text-xs mb-2">{t('admin.tierReferralDesc')}</p>
                    <p className="text-lg font-bold text-slate-900">€500 / {t('admin.perSale')}</p>
                  </div>
                  <div className="p-4 bg-cyan-50 rounded-lg">
                    <p className="font-semibold text-cyan-700 text-sm mb-1">{t('admin.tierAgency')}</p>
                    <p className="text-slate-600 text-xs mb-2">{t('admin.tierAgencyDesc')}</p>
                    <p className="text-lg font-bold text-slate-900">€500 + €750 / {t('admin.perOnboarding')}</p>
                  </div>
                </div>

                {(() => {
                  const filtered = partners.filter((p) => {
                    if (partnerFilter === 'all') return true;
                    if (partnerFilter === 'pending') return p.status === 'pending_approval';
                    return p.partner_type === partnerFilter;
                  });
                  if (!filtered.length) {
                    return <p className="text-center text-slate-500 py-8">{t('admin.noPartners')}</p>;
                  }
                  return (
                    <div className="overflow-x-auto">
                      <table className="w-full" data-testid="partners-table">
                        <thead>
                          <tr className="border-b border-slate-200">
                            <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">{t('admin.colPartner')}</th>
                            <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">{t('admin.colType')}</th>
                            <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">{t('admin.colStatus')}</th>
                            <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">{t('admin.colCode')}</th>
                            <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">{t('admin.colReferrals')}</th>
                            <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">{t('admin.colEarnings')}</th>
                            <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">{t('admin.colPending')}</th>
                            <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">{t('admin.colActions')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filtered.map((p, index) => (
                            <tr key={p.partner_id} className="border-b border-slate-100 hover:bg-slate-50" data-testid={`partner-row-${index}`}>
                              <td className="py-3 px-4">
                                <p className="font-medium text-slate-900">{p.user?.name || p.company_name || t('admin.unknown')}</p>
                                <p className="text-xs text-slate-500">{p.user?.email}</p>
                                {p.company_name && (
                                  <p className="text-xs text-slate-400 italic">{p.company_name}</p>
                                )}
                              </td>
                              <td className="py-3 px-4">
                                <span className={`px-2 py-1 rounded text-xs font-semibold ${p.partner_type === 'agency' ? 'bg-cyan-100 text-cyan-700' : 'bg-teal-100 text-[#0EA5A0]'}`}>
                                  {t(`admin.partnerType.${p.partner_type}`)}
                                </span>
                              </td>
                              <td className="py-3 px-4">
                                <span className={`px-2 py-1 rounded text-xs font-semibold ${p.status === 'active' ? 'bg-emerald-100 text-emerald-700' : p.status === 'pending_approval' ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'}`}>
                                  {t(`admin.partnerStatus.${p.status}`)}
                                </span>
                              </td>
                              <td className="py-3 px-4">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono font-bold text-[#0EA5A0]">{p.referral_code}</span>
                                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyToClipboard(p.referral_code)}>
                                    <Copy className="w-3 h-3" />
                                  </Button>
                                </div>
                              </td>
                              <td className="py-3 px-4 text-slate-600">{p.total_referrals || 0}</td>
                              <td className="py-3 px-4 font-semibold text-emerald-600">€{(p.total_earned || 0).toFixed(2)}</td>
                              <td className="py-3 px-4 font-semibold text-amber-600">€{(p.pending_balance || 0).toFixed(2)}</td>
                              <td className="py-3 px-4">
                                <div className="flex items-center gap-1 flex-wrap">
                                  <Button variant="ghost" size="sm" onClick={() => loadPartnerDetails(p.partner_id)}>
                                    {t('admin.view')}
                                  </Button>
                                  {p.status === 'pending_approval' && (
                                    <Button variant="outline" size="sm" className="text-emerald-700 border-emerald-300" onClick={() => handleApprovePartner(p.partner_id)}>
                                      <Check className="w-3 h-3 mr-1" />{t('admin.approve')}
                                    </Button>
                                  )}
                                  {p.status === 'active' && p.partner_type === 'agency' && (
                                    <Button variant="outline" size="sm" onClick={() => handleMarkOnboarding(p.partner_id)}>
                                      <Gift className="w-3 h-3 mr-1" />{t('admin.logOnboarding')}
                                    </Button>
                                  )}
                                  {(p.pending_balance || 0) > 0 && (
                                    <Button variant="outline" size="sm" onClick={() => handleMarkPaid(p.partner_id, p.pending_balance)}>
                                      <DollarSign className="w-3 h-3 mr-1" />{t('admin.markPaid')}
                                    </Button>
                                  )}
                                  {p.status === 'active' ? (
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-600 hover:text-rose-700" onClick={() => handleSuspendPartner(p.partner_id)}>
                                      <X className="w-4 h-4" />
                                    </Button>
                                  ) : p.status === 'suspended' ? (
                                    <Button variant="ghost" size="sm" onClick={() => handleReactivatePartner(p.partner_id)}>
                                      {t('admin.reactivate')}
                                    </Button>
                                  ) : null}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                })()}

                {/* Partner details drawer */}
                {partnerDetails && (
                  <div className="mt-6 p-4 border border-slate-200 rounded-lg bg-slate-50">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h4 className="font-bold text-slate-900">
                          {partnerDetails.partner?.company_name || partnerDetails.partner?.user?.name || t('admin.partnerDetails')}
                        </h4>
                        <p className="text-xs text-slate-500">{partnerDetails.partner?.user?.email}</p>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => { setSelectedPartner(null); setPartnerDetails(null); }}>
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                    {partnerDetails.partner?.application_text && (
                      <div className="mb-3 p-3 bg-white rounded border border-slate-200">
                        <p className="text-xs text-slate-500 mb-1">{t('admin.applicationNotes')}</p>
                        <p className="text-sm text-slate-700 whitespace-pre-wrap">{partnerDetails.partner.application_text}</p>
                        {partnerDetails.partner.company_website && (
                          <p className="text-xs text-[#0EA5A0] mt-2">{partnerDetails.partner.company_website}</p>
                        )}
                      </div>
                    )}
                    <div>
                      <p className="text-xs text-slate-500 mb-2">{t('admin.recentSales')}</p>
                      {(!partnerDetails.sales || partnerDetails.sales.length === 0) ? (
                        <p className="text-xs text-slate-400">{t('admin.noSales')}</p>
                      ) : (
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-slate-200 text-xs text-slate-500">
                              <th className="text-left py-2">{t('admin.colDate')}</th>
                              <th className="text-left py-2">{t('admin.colSaleType')}</th>
                              <th className="text-left py-2">{t('admin.colCustomer')}</th>
                              <th className="text-right py-2">{t('admin.colCommission')}</th>
                              <th className="text-left py-2">{t('admin.colStatus')}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {partnerDetails.sales.map((s) => (
                              <tr key={s.sale_id} className="border-b border-slate-100">
                                <td className="py-2">{s.created_at ? new Date(s.created_at).toLocaleDateString() : '—'}</td>
                                <td className="py-2">{t(`admin.saleType.${s.sale_type}`)}</td>
                                <td className="py-2 text-slate-600">{s.customer_email || '—'}</td>
                                <td className="py-2 text-right font-semibold text-emerald-600">€{(s.commission_amount || 0).toFixed(2)}</td>
                                <td className="py-2">
                                  <span className={`px-2 py-0.5 rounded text-xs ${s.status === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                    {t(`admin.saleStatus.${s.status}`)}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Data Explorer Tab */}
          <TabsContent value="explorer">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Layers className="w-5 h-5" />
                  {t('admin.dataExplorer')}
                </CardTitle>
                <CardDescription>{t('admin.dataExplorerDesc')}</CardDescription>
              </CardHeader>
              <CardContent>
                {!explorerCollection ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                    {Object.entries(explorerCollections).map(([name, count]) => (
                      <button key={name} onClick={() => handleExploreCollection(name)} className="p-4 border border-slate-200 rounded-lg hover:bg-teal-50 hover:border-[#0EA5A0] transition-colors text-left" data-testid={`explorer-${name}`}>
                        <p className="font-medium text-slate-900 text-sm">{name}</p>
                        <p className="text-xs text-slate-500 mt-1">{t('admin.recordsCount').replace('{count}', count)}</p>
                      </button>
                    ))}
                    {Object.keys(explorerCollections).length === 0 && (
                      <p className="text-slate-500 col-span-full text-center py-8">{t('admin.loadingCollections')}</p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <Button variant="outline" size="sm" onClick={() => { setExplorerCollection(''); setExplorerData(null); }}>
                        <X className="w-3.5 h-3.5 mr-1" /> {t('common.back')}
                      </Button>
                      <span className="font-semibold text-slate-900">{explorerCollection}</span>
                      <span className="text-sm text-slate-500">({t('admin.recordsCount').replace('{count}', explorerData?.total || 0)})</span>
                      <div className="flex-1" />
                      <Input
                        placeholder={t('admin.searchPlaceholder')}
                        value={explorerSearch}
                        onChange={(e) => setExplorerSearch(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { setExplorerPage(0); fetchExplorerData(explorerCollection, 0, explorerSearch); }}}
                        className="w-48 h-8 text-sm"
                        data-testid="explorer-search"
                      />
                      <Button size="sm" onClick={() => { setExplorerPage(0); fetchExplorerData(explorerCollection, 0, explorerSearch); }}>{t('common.search')}</Button>
                    </div>
                    {explorerData?.data?.length > 0 ? (
                      <div className="overflow-x-auto border rounded-lg">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="bg-slate-50">
                              {explorerData.fields.slice(0, 8).map(f => (
                                <th key={f} className="text-left py-2 px-3 font-medium text-slate-600 border-b whitespace-nowrap">{f}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {explorerData.data.map((row, i) => (
                              <tr key={i} className="border-b border-slate-100 hover:bg-slate-50">
                                {explorerData.fields.slice(0, 8).map(f => (
                                  <td key={f} className="py-2 px-3 text-slate-700 max-w-[200px] truncate whitespace-nowrap">
                                    {typeof row[f] === 'object' ? JSON.stringify(row[f])?.slice(0, 50) : String(row[f] ?? '—')}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-center text-slate-500 py-8">{t('admin.noRecords')}</p>
                    )}
                    <div className="flex items-center justify-between">
                      <Button size="sm" variant="outline" disabled={explorerPage === 0} onClick={() => { const p = explorerPage - 1; setExplorerPage(p); fetchExplorerData(explorerCollection, p, explorerSearch); }}>{t('common.previous')}</Button>
                      <span className="text-xs text-slate-500">{t('admin.pageOf').replace('{current}', explorerPage + 1).replace('{total}', Math.ceil((explorerData?.total || 1) / 50))}</span>
                      <Button size="sm" variant="outline" disabled={(explorerPage + 1) * 50 >= (explorerData?.total || 0)} onClick={() => { const p = explorerPage + 1; setExplorerPage(p); fetchExplorerData(explorerCollection, p, explorerSearch); }}>{t('common.next')}</Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Reports Tab */}
          <TabsContent value="reports">
            <div className="space-y-6">
              {!reportOverview ? (
                <Card className="p-8 text-center">
                  <Button className="bg-[#0EA5A0] hover:bg-[#0B8C88] text-white" onClick={fetchReports} data-testid="load-reports-btn">{t('admin.loadReports')}</Button>
                </Card>
              ) : (
                <>
                  {/* Overview Cards */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                      { label: t('admin.totalUsers'), value: reportOverview.total_users },
                      { label: t('admin.pipelineValue'), value: `\u20AC${reportOverview.pipeline_value?.toLocaleString()}` },
                      { label: t('admin.wonRevenue'), value: `\u20AC${reportOverview.won_revenue?.toLocaleString()}` },
                      { label: t('admin.winRate'), value: `${reportOverview.win_rate}%` },
                      { label: t('admin.totalLeads'), value: reportOverview.total_leads },
                      { label: t('admin.contacts'), value: reportOverview.total_contacts },
                      { label: t('admin.dealsWon'), value: reportOverview.deals_won },
                      { label: t('admin.dealsLost'), value: reportOverview.deals_lost },
                    ].map((s, i) => (
                      <Card key={i}><CardContent className="p-4"><p className="text-xs text-slate-500">{s.label}</p><p className="text-2xl font-bold mt-1">{s.value}</p></CardContent></Card>
                    ))}
                  </div>

                  {/* Activity (last 30 days) */}
                  {reportActivity && (
                    <Card>
                      <CardHeader><CardTitle className="text-lg">{t('admin.activityLast30Days')}</CardTitle></CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                          {[
                            { label: t('admin.newSignups'), value: reportActivity.new_signups },
                            { label: t('admin.activeUsers'), value: reportActivity.active_users },
                            { label: t('admin.newLeads'), value: reportActivity.new_leads },
                            { label: t('admin.newDeals'), value: reportActivity.new_deals },
                            { label: t('admin.callsMade'), value: reportActivity.calls_made },
                            { label: t('admin.meetingsBooked'), value: reportActivity.meetings_booked },
                            { label: t('admin.newContacts'), value: reportActivity.new_contacts },
                            { label: t('admin.tasksCreated'), value: reportActivity.new_tasks },
                          ].map((s, i) => (
                            <div key={i} className="bg-slate-50 rounded-lg p-3"><p className="text-xs text-slate-500">{s.label}</p><p className="text-xl font-bold">{s.value}</p></div>
                          ))}
                        </div>
                        {reportActivity.recent_logins?.length > 0 && (
                          <div>
                            <p className="text-sm font-medium text-slate-700 mb-2">{t('admin.recentLogins')}</p>
                            <div className="space-y-1">{reportActivity.recent_logins.slice(0, 10).map((u, i) => (
                              <div key={i} className="flex items-center justify-between text-sm py-1 border-b border-slate-50">
                                <span className="font-medium">{u.name}</span><span className="text-slate-500">{u.email}</span><span className="text-xs text-slate-400">{u.last_login ? new Date(u.last_login).toLocaleString() : ''}</span>
                              </div>
                            ))}</div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}

                  {/* User Performance */}
                  <Card>
                    <CardHeader><CardTitle className="text-lg">{t('admin.userPerformance')}</CardTitle></CardHeader>
                    <CardContent>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead><tr className="border-b">{[t('admin.colUser'), t('admin.colLeads'), t('admin.colDeals'), t('admin.colWon'), t('admin.colRevenue'), t('admin.colTasksDone'), t('admin.colCompletionPct'), t('admin.colLastLogin')].map(h => <th key={h} className="text-left py-2 px-3 text-xs font-medium text-slate-500">{h}</th>)}</tr></thead>
                          <tbody>{reportPerformance.map((u, i) => (
                            <tr key={i} className="border-b border-slate-50 hover:bg-slate-50">
                              <td className="py-2 px-3"><p className="font-medium">{u.name}</p><p className="text-xs text-slate-400">{u.email}</p></td>
                              <td className="py-2 px-3">{u.leads_created}</td>
                              <td className="py-2 px-3">{u.deals_created}</td>
                              <td className="py-2 px-3 font-medium text-emerald-600">{u.deals_won}</td>
                              <td className="py-2 px-3 font-medium">{'\u20AC'}{u.revenue_won?.toLocaleString()}</td>
                              <td className="py-2 px-3">{u.tasks_completed}/{u.tasks_total}</td>
                              <td className="py-2 px-3">{u.task_completion_rate}%</td>
                              <td className="py-2 px-3 text-xs text-slate-400">{u.last_login ? new Date(u.last_login).toLocaleDateString() : t('admin.never')}</td>
                            </tr>
                          ))}</tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Pipeline Forecast */}
                  {reportForecast && (
                    <div className="grid md:grid-cols-2 gap-6">
                      <Card>
                        <CardHeader><CardTitle className="text-lg">{t('admin.forecastByStage')}</CardTitle></CardHeader>
                        <CardContent>
                          {Object.entries(reportForecast.by_stage).map(([stage, data]) => (
                            <div key={stage} className="flex items-center justify-between py-2 border-b border-slate-50">
                              <span className="text-sm font-medium capitalize">{stage}</span>
                              <div className="text-right"><p className="text-sm font-bold">{'\u20AC'}{data.value?.toLocaleString()}</p><p className="text-xs text-slate-400">{t('admin.dealsWeighted').replace('{count}', data.count).replace('{amount}', Math.round(data.weighted).toLocaleString())}</p></div>
                            </div>
                          ))}
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader><CardTitle className="text-lg">{t('admin.forecastByTag')}</CardTitle></CardHeader>
                        <CardContent>
                          {Object.keys(reportForecast.by_tag).length === 0 ? <p className="text-sm text-slate-400 py-4">{t('admin.noTaggedDeals')}</p> :
                            Object.entries(reportForecast.by_tag).map(([tag, data]) => (
                              <div key={tag} className="flex items-center justify-between py-2 border-b border-slate-50">
                                <span className="text-sm font-medium">{tag}</span>
                                <div className="text-right"><p className="text-sm font-bold">{'\u20AC'}{data.value?.toLocaleString()}</p><p className="text-xs text-slate-400">{t('admin.dealsCount').replace('{count}', data.count)}</p></div>
                              </div>
                            ))
                          }
                        </CardContent>
                      </Card>
                    </div>
                  )}

                  {/* Export */}
                  <Card>
                    <CardHeader><CardTitle className="text-lg">{t('admin.exportData')}</CardTitle></CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-2">
                        {['leads', 'contacts', 'deals', 'tasks', 'users', 'companies'].map(e => (
                          <Button key={e} variant="outline" size="sm" onClick={() => handleExportCSV(e)} data-testid={`export-${e}`}>{t('admin.exportEntity').replace('{entity}', e)}</Button>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </>
              )}
            </div>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                  {t('admin.platformSettings')}
                </CardTitle>
                <CardDescription>{t('admin.platformSettingsDesc')}</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSaveAllSettings} className="space-y-6">
                  {/* Support Email */}
                  <div className="space-y-4 border-b pb-6">
                    <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                      <Mail className="w-5 h-5 text-[#0EA5A0]" />
                      {t('admin.supportSettings')}
                    </h3>
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>{t('admin.supportEmail')}</Label>
                        <Input
                          type="email"
                          value={platformSettings?.support_email || ''}
                          onChange={(e) => setPlatformSettings({...platformSettings, support_email: e.target.value})}
                          placeholder="support@tako.software"
                          data-testid="settings-support-email"
                        />
                        <p className="text-xs text-slate-500">{t('admin.supportEmailHint')}</p>
                      </div>
                      <div className="space-y-2">
                        <Label>{t('admin.ukVatRate')}</Label>
                        <Input
                          type="number"
                          value={platformSettings?.vat_rate || 20}
                          onChange={(e) => setPlatformSettings({...platformSettings, vat_rate: parseFloat(e.target.value)})}
                          placeholder="20"
                          data-testid="settings-vat-rate"
                        />
                        <p className="text-xs text-slate-500">{t('admin.vatHint')}</p>
                      </div>
                    </div>
                  </div>

                  {/* Stripe Settings */}
                  <div className="space-y-4 border-b pb-6">
                    <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                      <CreditCard className="w-5 h-5 text-teal-600" />
                      {t('admin.stripeIntegration')}
                    </h3>
                    <div className="space-y-2">
                      <Label>{t('admin.stripeApiKey')}</Label>
                      <Input
                        type="password"
                        value={platformSettings?.stripe_api_key || ''}
                        onChange={(e) => setPlatformSettings({...platformSettings, stripe_api_key: e.target.value})}
                        placeholder="sk_live_..."
                        data-testid="settings-stripe-key"
                      />
                      <p className="text-xs text-slate-500">{t('admin.stripeApiKeyHint')}</p>
                    </div>
                  </div>

                  {/* PayPal Settings */}
                  <div className="space-y-4 border-b pb-6">
                    <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                      <DollarSign className="w-5 h-5 text-blue-600" />
                      {t('admin.paypalIntegration')}
                    </h3>
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>{t('admin.paypalClientId')}</Label>
                        <Input
                          value={platformSettings?.paypal_client_id || ''}
                          onChange={(e) => setPlatformSettings({...platformSettings, paypal_client_id: e.target.value})}
                          placeholder={t('admin.paypalClientIdPlaceholder')}
                          data-testid="settings-paypal-id"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>{t('admin.paypalClientSecret')}</Label>
                        <Input
                          type="password"
                          value={platformSettings?.paypal_client_secret || ''}
                          onChange={(e) => setPlatformSettings({...platformSettings, paypal_client_secret: e.target.value})}
                          placeholder={t('admin.paypalClientSecretPlaceholder')}
                          data-testid="settings-paypal-secret"
                        />
                      </div>
                    </div>
                    <p className="text-xs text-slate-500">{t('admin.paypalHint')}</p>
                  </div>

                  {/* Crypto Settings */}
                  <div className="space-y-4 pb-6">
                    <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                      <Wallet className="w-5 h-5 text-amber-600" />
                      {t('admin.cryptocurrency')}
                    </h3>
                    <div className="space-y-2">
                      <Label>{t('admin.ethWalletAddress')}</Label>
                      <Input
                        value={platformSettings?.crypto_wallet_address || ''}
                        onChange={(e) => setPlatformSettings({...platformSettings, crypto_wallet_address: e.target.value})}
                        placeholder="0x..."
                        data-testid="settings-crypto-wallet"
                      />
                      <p className="text-xs text-slate-500">{t('admin.ethWalletHint')}</p>
                    </div>
                  </div>

                  <Button type="submit" className="bg-[#0EA5A0] hover:bg-teal-700" data-testid="save-settings-btn">
                    <Save className="w-4 h-4 mr-2" />
                    {t('admin.saveAllSettings')}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Create User Dialog */}
      <Dialog open={showCreateUser} onOpenChange={setShowCreateUser}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{t('admin.createUser')}</DialogTitle></DialogHeader>
          <div className="space-y-3 pt-2">
            <div><Label className="text-xs">{t('admin.nameRequired')}</Label><Input value={newUser.name} onChange={e => setNewUser({...newUser, name: e.target.value})} placeholder={t('admin.fullNamePlaceholder')} data-testid="new-user-name" /></div>
            <div><Label className="text-xs">{t('admin.emailRequired')}</Label><Input value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})} placeholder="user@company.com" data-testid="new-user-email" /></div>
            <div><Label className="text-xs">{t('admin.passwordRequired')}</Label><Input type="password" value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} placeholder={t('admin.initialPasswordPlaceholder')} data-testid="new-user-pw" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">{t('admin.colRole')}</Label>
                <Select value={newUser.role} onValueChange={v => setNewUser({...newUser, role: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="member">{t('admin.roleMember')}</SelectItem>
                    <SelectItem value="admin">{t('admin.roleAdmin')}</SelectItem>
                    <SelectItem value="owner">{t('admin.roleOwner')}</SelectItem>
                    <SelectItem value="deputy_admin">{t('admin.roleDeputyAdmin')}</SelectItem>
                    <SelectItem value="support">{t('admin.roleSupport')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">{t('admin.organizationId')}</Label><Input value={newUser.organization_id} onChange={e => setNewUser({...newUser, organization_id: e.target.value})} placeholder={t('admin.organizationIdPlaceholder')} /></div>
            </div>
            <Button onClick={handleCreateUser} className="w-full bg-[#0EA5A0] hover:bg-[#0B8C88] text-white" data-testid="submit-create-user">{t('admin.createUser')}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={!!showResetPw} onOpenChange={() => setShowResetPw(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{t('admin.resetPasswordTitle')}</DialogTitle></DialogHeader>
          <div className="space-y-3 pt-2">
            <div><Label className="text-xs">{t('admin.newPassword')}</Label><Input type="password" value={resetPw} onChange={e => setResetPw(e.target.value)} placeholder={t('admin.newPasswordPlaceholder')} data-testid="reset-pw-input" /></div>
            <Button onClick={() => handleResetPassword(showResetPw)} className="w-full bg-[#0EA5A0] hover:bg-[#0B8C88] text-white" data-testid="submit-reset-pw">{t('admin.resetPasswordTitle')}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default AdminPage;
