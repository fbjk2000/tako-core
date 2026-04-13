import { useT } from '../useT';
import React, { useState, useEffect } from 'react';
import { useAuth, API } from '../App';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { toast } from 'sonner';
import axios from 'axios';
import {
  Plus,
  Search,
  Upload,
  Zap,
  MoreVertical,
  Mail,
  Phone,
  Linkedin,
  Building,
  Filter,
  Sparkles,
  FileText,
  MessageSquare,
  Globe,
  MapPin,
  Edit2,
  Save,
  X,
  Wand2,
  Briefcase,
  Tag,
  Users,
  UserPlus,
  Target,
  CheckSquare
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '../components/ui/dropdown-menu';
import { Textarea } from '../components/ui/textarea';
import { Badge } from '../components/ui/badge';
import { SmartSearch, AIEmailComposer, LeadSummary } from '../components/AIAssistant';

const LeadsPage = () => {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useState(() => new URLSearchParams(window.location.search));
  const [leads, setLeads] = useState([]);
  const { t } = useT();
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [newLead, setNewLead] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    company: '',
    job_title: '',
    linkedin_url: '',
    source: 'manual'
  });

  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const axiosConfig = { headers, withCredentials: true };

  // Lead detail/edit state
  const [selectedLead, setSelectedLead] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState({});
  const [saving, setSaving] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [scoring, setScoring] = useState(null);
  const [showConvertDialog, setShowConvertDialog] = useState(false);
  const [convertLead, setConvertLead] = useState(null);
  // Bulk selection
  const [selectedIds, setSelectedIds] = useState([]);
  // Column visibility
  const [visibleCols, setVisibleCols] = useState({ company: true, email: true, phone: false, job_title: false, source: false, ai_score: true });
  const [showColSettings, setShowColSettings] = useState(false);
  // Email composer (outside dialog to avoid nesting)
  const [emailLeadId, setEmailLeadId] = useState(null);
  const [emailLeadName, setEmailLeadName] = useState('');
  const [convertDealId, setConvertDealId] = useState('none');
  const [converting, setConverting] = useState(false);
  const [deals, setDeals] = useState([]);

  useEffect(() => {
    fetchLeads();
    fetchDeals();
  }, [statusFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-open lead detail from URL param
  useEffect(() => {
    const detailId = searchParams.get('detail');
    if (detailId && leads.length > 0) {
      const lead = leads.find(l => l.lead_id === detailId);
      if (lead) openLeadDetail(lead);
    }
  }, [leads]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchDeals = async () => {
    try {
      const res = await axios.get(`${API}/deals`, { headers, withCredentials: true });
      setDeals(res.data);
    } catch (err) { console.error(err); }
  };

  const fetchLeads = async () => {
    try {
      const params = statusFilter !== 'all' ? { status: statusFilter } : {};
      const response = await axios.get(`${API}/leads`, {
        headers,
        params,
        withCredentials: true
      });
      setLeads(response.data);
    } catch (error) {
      toast.error('Failed to fetch leads');
    } finally {
      setLoading(false);
    }
  };

  const handleAddLead = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/leads`, newLead, { headers, withCredentials: true });
      toast.success('Lead added successfully');
      setIsAddDialogOpen(false);
      setNewLead({
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        company: '',
        job_title: '',
        linkedin_url: '',
        source: 'manual'
      });
      fetchLeads();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to add lead');
    }
  };

  const handleImportCSV = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await axios.post(`${API}/leads/import-csv`, formData, {
        headers: { ...headers, 'Content-Type': 'multipart/form-data' },
        withCredentials: true
      });
      toast.success(`Imported ${response.data.count} leads`);
      setIsImportDialogOpen(false);
      fetchLeads();
    } catch (error) {
      toast.error('Failed to import CSV');
    }
  };

  const handleScoreLead = async (leadId) => {
    setScoring(leadId);
    try {
      const response = await axios.post(`${API}/ai/score-lead/${leadId}`, {}, axiosConfig);
      toast.success(`Lead scored: ${response.data.ai_score}/100`);
      fetchLeads();
      if (selectedLead?.lead_id === leadId) {
        setSelectedLead(prev => ({ ...prev, ai_score: response.data.ai_score }));
      }
    } catch (error) {
      toast.error('Failed to score lead');
    } finally {
      setScoring(null);
    }
  };

  const handleDeleteLead = async (leadId) => {
    try {
      await axios.delete(`${API}/leads/${leadId}`, axiosConfig);
      toast.success('Lead deleted');
      setSelectedLead(null);
      fetchLeads();
    } catch (error) {
      toast.error('Failed to delete lead');
    }
  };

  const handleStatusChange = async (leadId, status) => {
    try {
      await axios.put(`${API}/leads/${leadId}`, { status }, axiosConfig);
      toast.success('Lead status updated');
      fetchLeads();
      // If qualified, suggest conversion
      if (status === 'qualified') {
        const lead = leads.find(l => l.lead_id === leadId);
        if (lead && lead.status !== 'converted') {
          setConvertLead({ ...lead, status: 'qualified' });
          setShowConvertDialog(true);
        }
      }
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  const handleConvertToContact = async () => {
    if (!convertLead) return;
    setConverting(true);
    try {
      const res = await axios.post(
        `${API}/leads/${convertLead.lead_id}/convert-to-contact`,
        null,
        { ...axiosConfig, params: { deal_id: convertDealId !== 'none' ? convertDealId : undefined } }
      );
      toast.success(`${convertLead.first_name} converted to Contact`);
      setShowConvertDialog(false);
      setConvertLead(null);
      setConvertDealId('none');
      fetchLeads();
      navigate(`/contacts?detail=${res.data.contact_id}`);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Conversion failed');
    } finally {
      setConverting(false);
    }
  };

  const openLeadDetail = (lead) => {
    setSelectedLead(lead);
    setEditData({ ...lead });
    setEditMode(false);
  };

  const handleSaveLead = async () => {
    if (!selectedLead) return;
    setSaving(true);
    try {
      const { lead_id, organization_id, created_by, created_at, _id, ...updates } = editData;
      const res = await axios.put(`${API}/leads/${selectedLead.lead_id}`, updates, axiosConfig);
      toast.success('Lead updated');
      setSelectedLead(res.data);
      setEditData(res.data);
      setEditMode(false);
      fetchLeads();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to update');
    } finally {
      setSaving(false);
    }
  };

  const handleEnrichLead = async (leadId) => {
    setEnriching(true);
    try {
      const res = await axios.post(`${API}/ai/enrich-lead/${leadId}`, {}, axiosConfig);
      toast.success('Lead enriched with AI data');
      setSelectedLead(res.data.lead);
      setEditData(res.data.lead);
      fetchLeads();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Enrichment failed');
    } finally {
      setEnriching(false);
    }
  };

  const toggleSelect = (id) => setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const handleBulkDelete = async () => {
    if (!selectedIds.length) return;
    try {
      await axios.post(`${API}/bulk/delete`, { entity_type: 'lead', entity_ids: selectedIds }, axiosConfig);
      toast.success(`Deleted ${selectedIds.length} leads`);
      setSelectedIds([]);
      fetchLeads();
    } catch { toast.error('Failed to delete'); }
  };

  const handleBulkEnrich = async () => {
    if (!selectedIds.length) return;
    toast.info(`Enriching ${selectedIds.length} leads...`);
    try {
      const res = await axios.post(`${API}/bulk/enrich`, { entity_type: 'lead', entity_ids: selectedIds }, axiosConfig);
      toast.success(`Enriched ${res.data.enriched} leads`);
      setSelectedIds([]);
      fetchLeads();
    } catch { toast.error('Enrichment failed'); }
  };

  const filteredLeads = leads.filter(lead => {
    const searchLower = searchQuery.toLowerCase();
    return (
      lead.first_name?.toLowerCase().includes(searchLower) ||
      lead.last_name?.toLowerCase().includes(searchLower) ||
      lead.email?.toLowerCase().includes(searchLower) ||
      lead.company?.toLowerCase().includes(searchLower)
    );
  });

  const statusOptions = [
    { value: 'new', label: 'New', color: 'bg-slate-100 text-slate-700' },
    { value: 'contacted', label: 'Contacted', color: 'bg-teal-100 text-teal-700' },
    { value: 'qualified', label: 'Qualified', color: 'bg-emerald-100 text-emerald-700' },
    { value: 'unqualified', label: 'Unqualified', color: 'bg-rose-100 text-rose-700' },
    { value: 'converted', label: 'Converted', color: 'bg-blue-100 text-blue-700' }
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6" data-testid="leads-page">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900" data-testid="leads-title">Leads</h1>
            <p className="text-slate-600 mt-1">Manage and track your sales leads</p>
          </div>
          <div className="flex flex-wrap gap-3">
            {/* AI Features */}
            <SmartSearch onSelectResult={(type, item) => {
              if (type === 'lead') {
                toast.info(`Selected lead: ${item.first_name} ${item.last_name}`);
              }
            }} />
            <AIEmailComposer />
            
            <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" data-testid="import-csv-btn">
                  <Upload className="w-4 h-4 mr-2" />
                  Import CSV
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Import Leads from CSV</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <p className="text-sm text-slate-600">
                    Upload a CSV file with columns: first_name, last_name, email, phone, company, job_title, linkedin_url
                  </p>
                  <Input
                    type="file"
                    accept=".csv"
                    onChange={handleImportCSV}
                    data-testid="csv-file-input"
                  />
                </div>
              </DialogContent>
            </Dialog>

            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-[#0EA5A0] hover:bg-teal-700" data-testid="add-lead-btn">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Lead
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Add New Lead</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleAddLead} className="space-y-4 pt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="first_name">First Name *</Label>
                      <Input
                        id="first_name"
                        value={newLead.first_name}
                        onChange={(e) => setNewLead({ ...newLead, first_name: e.target.value })}
                        required
                        data-testid="lead-first-name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="last_name">Last Name *</Label>
                      <Input
                        id="last_name"
                        value={newLead.last_name}
                        onChange={(e) => setNewLead({ ...newLead, last_name: e.target.value })}
                        required
                        data-testid="lead-last-name"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lead_email">Email</Label>
                    <Input
                      id="lead_email"
                      type="email"
                      value={newLead.email}
                      onChange={(e) => setNewLead({ ...newLead, email: e.target.value })}
                      data-testid="lead-email"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lead_phone">Phone</Label>
                    <Input
                      id="lead_phone"
                      value={newLead.phone}
                      onChange={(e) => setNewLead({ ...newLead, phone: e.target.value })}
                      data-testid="lead-phone"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lead_company">Company</Label>
                    <Input
                      id="lead_company"
                      value={newLead.company}
                      onChange={(e) => setNewLead({ ...newLead, company: e.target.value })}
                      data-testid="lead-company"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lead_job_title">Job Title</Label>
                    <Input
                      id="lead_job_title"
                      value={newLead.job_title}
                      onChange={(e) => setNewLead({ ...newLead, job_title: e.target.value })}
                      data-testid="lead-job-title"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lead_linkedin">LinkedIn URL</Label>
                    <Input
                      id="lead_linkedin"
                      value={newLead.linkedin_url}
                      onChange={(e) => setNewLead({ ...newLead, linkedin_url: e.target.value })}
                      placeholder="https://linkedin.com/in/..."
                      data-testid="lead-linkedin"
                    />
                  </div>
                  <div className="pt-4">
                    <Button type="submit" className="w-full bg-[#0EA5A0] hover:bg-teal-700" data-testid="submit-lead-btn">
                      Add Lead
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="${t('leads.searchLeads')}"
                  className="pl-10"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  data-testid="search-leads"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]" data-testid="status-filter">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  {statusOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Bulk Actions & Column Settings */}
        <div className="flex items-center justify-between">
          {selectedIds.length > 0 ? (
            <div className="flex items-center gap-3 bg-teal-50 border border-teal-200 rounded-lg p-3 flex-1">
              <span className="text-sm font-medium text-teal-800">{selectedIds.length} selected</span>
              <Button size="sm" variant="outline" onClick={handleBulkEnrich} data-testid="bulk-enrich-btn"><Wand2 className="w-3.5 h-3.5 mr-1" /> Enrich</Button>
              <Button size="sm" variant="outline" className="text-red-600 border-red-200" onClick={handleBulkDelete} data-testid="bulk-delete-btn"><X className="w-3.5 h-3.5 mr-1" />{ t('common.delete') }</Button>
              <Button size="sm" variant="ghost" onClick={() => setSelectedIds([])}>Clear</Button>
            </div>
          ) : <div />}
          <Button size="sm" variant="ghost" onClick={() => setShowColSettings(!showColSettings)} data-testid="column-settings-btn">
            <Filter className="w-3.5 h-3.5 mr-1" /> Columns
          </Button>
        </div>

        {showColSettings && (
          <Card className="p-3">
            <div className="flex flex-wrap gap-4">
              {[{key:'company',label:'Company'},{key:'email',label:'Email'},{key:'phone',label:'Phone'},{key:'job_title',label:'Job Title'},{key:'source',label:'Source'},{key:'ai_score',label:'AI Score'}].map(col => (
                <label key={col.key} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={visibleCols[col.key]} onChange={() => setVisibleCols(prev => ({...prev, [col.key]: !prev[col.key]}))} className="accent-[#0EA5A0]" />
                  {col.label}
                </label>
              ))}
            </div>
          </Card>
        )}

        {/* Leads List */}
        <Card data-testid="leads-list">
          <CardContent className="p-0">
            {!loading && filteredLeads.length > 0 && (
              <div className="px-4 py-2 border-b border-slate-100 flex items-center gap-3 bg-slate-50">
                <input type="checkbox" checked={selectedIds.length === filteredLeads.length && filteredLeads.length > 0} onChange={() => setSelectedIds(selectedIds.length === filteredLeads.length ? [] : filteredLeads.map(l => l.lead_id))} className="w-4 h-4 accent-[#0EA5A0]" data-testid="select-all-leads" />
                <span className="text-xs text-slate-500">Select all {filteredLeads.length} leads{searchQuery || statusFilter !== 'all' ? ' (filtered)' : ''}</span>
              </div>
            )}
            {loading ? (
              <div className="p-8 text-center">
                <div className="w-8 h-8 border-2 border-[#0EA5A0] border-t-transparent rounded-full animate-spin mx-auto" />
              </div>
            ) : filteredLeads.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-slate-600">No leads found</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {filteredLeads.map((lead, index) => (
                  <div
                    key={lead.lead_id}
                    className="p-4 hover:bg-slate-50 transition-colors cursor-pointer"
                    data-testid={`lead-row-${index}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <input type="checkbox" checked={selectedIds.includes(lead.lead_id)} onChange={() => toggleSelect(lead.lead_id)} onClick={(e) => e.stopPropagation()} className="w-4 h-4 accent-[#0EA5A0]" />
                        <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center cursor-pointer" onClick={() => openLeadDetail(lead)}>
                          <span className="text-[#0EA5A0] font-medium">
                            {lead.first_name?.[0]}{lead.last_name?.[0]}
                          </span>
                        </div>
                        <div className="cursor-pointer" onClick={() => openLeadDetail(lead)}>
                          <p className="font-medium text-slate-900">
                            {lead.first_name} {lead.last_name}
                          </p>
                          <div className="flex items-center gap-4 text-sm text-slate-500 mt-1">
                            {visibleCols.company && lead.company && (
                              <span className="flex items-center gap-1"><Building className="w-3 h-3" />{lead.company}</span>
                            )}
                            {visibleCols.email && lead.email && (
                              <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{lead.email}</span>
                            )}
                            {visibleCols.phone && lead.phone && (
                              <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{lead.phone}</span>
                            )}
                            {visibleCols.job_title && lead.job_title && (
                              <span className="flex items-center gap-1"><Briefcase className="w-3 h-3" />{lead.job_title}</span>
                            )}
                            {visibleCols.source && lead.source && (
                              <span className="text-xs bg-slate-100 px-1.5 py-0.5 rounded">{lead.source}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 sm:gap-4" onClick={(e) => e.stopPropagation()}>
                        {visibleCols.ai_score && lead.ai_score && (
                          <div className="flex items-center gap-1 px-2 py-1 bg-amber-50 rounded-full">
                            <Zap className="w-4 h-4 text-amber-500" />
                            <span className="text-sm font-medium text-amber-700">{lead.ai_score}</span>
                          </div>
                        )}

                        {/* AI Action Buttons */}
                        <div className="hidden sm:flex items-center gap-1">
                          <LeadSummary 
                            leadId={lead.lead_id} 
                            leadName={`${lead.first_name} ${lead.last_name}`}
                          />
                          <AIEmailComposer 
                            leadId={lead.lead_id} 
                            leadName={`${lead.first_name} ${lead.last_name}`}
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => navigate(`/chat?type=lead&id=${lead.lead_id}`)}
                            title="Discuss this lead"
                            data-testid={`discuss-lead-${lead.lead_id}`}
                          >
                            <MessageSquare className="w-4 h-4" />
                          </Button>
                        </div>

                        <Select
                          value={lead.status}
                          onValueChange={(value) => handleStatusChange(lead.lead_id, value)}
                        >
                          <SelectTrigger className="w-[130px] h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {statusOptions.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" data-testid={`lead-menu-${index}`}>
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                            <DropdownMenuItem onClick={() => { openLeadDetail(lead); setEditMode(true); }}>
                              <Edit2 className="w-4 h-4 mr-2" />
                              Edit Lead
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => { openLeadDetail(lead); handleEnrichLead(lead.lead_id); }}>
                              <Wand2 className="w-4 h-4 mr-2" />
                              AI Enrich
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleScoreLead(lead.lead_id)}>
                              <Zap className="w-4 h-4 mr-2" />
                              AI Score
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => navigate(`/chat?type=lead&id=${lead.lead_id}`)}>
                              <MessageSquare className="w-4 h-4 mr-2" />
                              Discuss Lead
                            </DropdownMenuItem>
                            {lead.phone && (
                              <DropdownMenuItem onClick={() => navigate(`/calls?lead=${lead.lead_id}`)}>
                                <Phone className="w-4 h-4 mr-2" />
                                Call Lead
                              </DropdownMenuItem>
                            )}
                            {lead.linkedin_url && (
                              <DropdownMenuItem asChild>
                                <a href={lead.linkedin_url} target="_blank" rel="noopener noreferrer">
                                  <Linkedin className="w-4 h-4 mr-2" />
                                  View LinkedIn
                                </a>
                              </DropdownMenuItem>
                            )}
                            {lead.status === 'qualified' && lead.status !== 'converted' && (
                              <DropdownMenuItem onClick={() => { setConvertLead(lead); setShowConvertDialog(true); }}>
                                <Users className="w-4 h-4 mr-2" />
                                Convert to Contact
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              className="text-rose-600"
                              onClick={() => handleDeleteLead(lead.lead_id)}
                            >
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Lead Detail / Edit Dialog */}
      <Dialog open={!!selectedLead} onOpenChange={() => { setSelectedLead(null); setEditMode(false); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {selectedLead && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center">
                      <span className="text-[#0EA5A0] font-medium text-sm">{selectedLead.first_name?.[0]}{selectedLead.last_name?.[0]}</span>
                    </div>
                    {editMode ? 'Edit Lead' : `${selectedLead.first_name} ${selectedLead.last_name}`}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {selectedLead.ai_score && (
                      <Badge className="bg-amber-100 text-amber-700"><Zap className="w-3 h-3 mr-1" />{selectedLead.ai_score}/100</Badge>
                    )}
                    {!editMode && (
                      <>
                        <Button size="sm" variant="outline" onClick={() => setEditMode(true)} data-testid="edit-lead-btn">
                          <Edit2 className="w-3.5 h-3.5 mr-1" /> Edit
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleEnrichLead(selectedLead.lead_id)} disabled={enriching} data-testid="enrich-lead-btn">
                          {enriching ? <div className="w-3.5 h-3.5 border-2 border-teal-500 border-t-transparent rounded-full animate-spin mr-1" /> : <Wand2 className="w-3.5 h-3.5 mr-1" />}
                          Enrich
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleScoreLead(selectedLead.lead_id)} disabled={scoring === selectedLead.lead_id} data-testid="score-lead-btn">
                          {scoring === selectedLead.lead_id ? <div className="w-3.5 h-3.5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mr-1" /> : <Zap className="w-3.5 h-3.5 mr-1" />}
                          Score
                        </Button>
                      </>
                    )}
                  </div>
                </DialogTitle>
              </DialogHeader>

              {editMode ? (
                <div className="grid grid-cols-2 gap-3 pt-2">
                  {[
                    { key: 'first_name', label: 'First Name', icon: null },
                    { key: 'last_name', label: 'Last Name', icon: null },
                    { key: 'email', label: 'Email', icon: Mail },
                    { key: 'phone', label: 'Phone', icon: Phone },
                    { key: 'company', label: 'Company', icon: Building },
                    { key: 'job_title', label: 'Job Title', icon: Briefcase },
                    { key: 'linkedin_url', label: 'LinkedIn URL', icon: Linkedin },
                    { key: 'website', label: 'Website', icon: Globe },
                    { key: 'location', label: 'Location', icon: MapPin },
                    { key: 'industry', label: 'Industry', icon: Tag },
                    { key: 'company_size', label: 'Company Size', icon: Building },
                    { key: 'source', label: 'Source', icon: null },
                  ].map(f => (
                    <div key={f.key}>
                      <Label className="text-xs text-slate-500 mb-1 block">{f.label}</Label>
                      <Input
                        value={editData[f.key] || ''}
                        onChange={(e) => setEditData(prev => ({ ...prev, [f.key]: e.target.value }))}
                        data-testid={`edit-${f.key}`}
                      />
                    </div>
                  ))}
                  <div className="col-span-2">
                    <Label className="text-xs text-slate-500 mb-1 block">Notes</Label>
                    <Textarea
                      value={editData.notes || ''}
                      onChange={(e) => setEditData(prev => ({ ...prev, notes: e.target.value }))}
                      rows={2}
                      data-testid="edit-notes"
                    />
                  </div>
                  <div className="col-span-2 flex gap-2 pt-2">
                    <Button onClick={handleSaveLead} disabled={saving} className="bg-[#0EA5A0] hover:bg-teal-700" data-testid="save-lead-btn">
                      {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                      Save Changes
                    </Button>
                    <Button variant="outline" onClick={() => { setEditMode(false); setEditData({ ...selectedLead }); }}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4 pt-2">
                  {/* Basic Info */}
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: 'Email', value: selectedLead.email, icon: <Mail className="w-3.5 h-3.5 text-slate-400" /> },
                      { label: 'Phone', value: selectedLead.phone, icon: <Phone className="w-3.5 h-3.5 text-slate-400" /> },
                      { label: 'Company', value: selectedLead.company, icon: <Building className="w-3.5 h-3.5 text-slate-400" /> },
                      { label: 'Job Title', value: selectedLead.job_title, icon: <Briefcase className="w-3.5 h-3.5 text-slate-400" /> },
                      { label: 'Website', value: selectedLead.website, icon: <Globe className="w-3.5 h-3.5 text-slate-400" />, link: true },
                      { label: 'LinkedIn', value: selectedLead.linkedin_url, icon: <Linkedin className="w-3.5 h-3.5 text-slate-400" />, link: true },
                      { label: 'Location', value: selectedLead.location, icon: <MapPin className="w-3.5 h-3.5 text-slate-400" /> },
                      { label: 'Industry', value: selectedLead.industry, icon: <Tag className="w-3.5 h-3.5 text-slate-400" /> },
                      { label: 'Company Size', value: selectedLead.company_size, icon: <Building className="w-3.5 h-3.5 text-slate-400" /> },
                      { label: 'Source', value: selectedLead.source, icon: <Filter className="w-3.5 h-3.5 text-slate-400" /> },
                      { label: 'Status', value: selectedLead.status },
                      { label: 'AI Score', value: selectedLead.ai_score ? `${selectedLead.ai_score}/100` : 'Not scored' },
                    ].filter(f => f.value).map(f => (
                      <div key={f.label} className="bg-slate-50 rounded-lg p-3">
                        <p className="text-xs text-slate-500 flex items-center gap-1">{f.icon}{f.label}</p>
                        {f.link ? (
                          <a href={f.value.startsWith('http') ? f.value : `https://${f.value}`} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-[#0EA5A0] hover:underline truncate block">{f.value}</a>
                        ) : (
                          <p className="text-sm font-medium text-slate-900 truncate">{f.value}</p>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Company Description */}
                  {selectedLead.company_description && (
                    <div className="bg-slate-50 rounded-lg p-3">
                      <p className="text-xs text-slate-500 mb-1">Company Description</p>
                      <p className="text-sm text-slate-700">{selectedLead.company_description}</p>
                    </div>
                  )}

                  {/* Notes */}
                  {selectedLead.notes && (
                    <div className="bg-slate-50 rounded-lg p-3">
                      <p className="text-xs text-slate-500 mb-1">Notes</p>
                      <p className="text-sm text-slate-700">{selectedLead.notes}</p>
                    </div>
                  )}

                  {/* AI Enrichment Data */}
                  {selectedLead.enrichment && (
                    <div className="bg-teal-50 rounded-lg p-4 border border-teal-100 space-y-2">
                      <p className="text-sm font-medium text-teal-900 flex items-center gap-1"><Wand2 className="w-4 h-4" /> AI Enrichment</p>
                      {selectedLead.enrichment.recommended_approach && (
                        <p className="text-sm text-slate-700"><strong>Approach:</strong> {selectedLead.enrichment.recommended_approach}</p>
                      )}
                      {selectedLead.enrichment.technologies?.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          <span className="text-xs text-slate-500 mr-1">Tech:</span>
                          {selectedLead.enrichment.technologies.map((t, i) => (
                            <Badge key={i} variant="secondary" className="text-xs">{t}</Badge>
                          ))}
                        </div>
                      )}
                      {selectedLead.enrichment.interests?.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          <span className="text-xs text-slate-500 mr-1">Interests:</span>
                          {selectedLead.enrichment.interests.map((t, i) => (
                            <Badge key={i} variant="outline" className="text-xs">{t}</Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Action buttons - cross-linked */}
                  <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
                    {selectedLead.status !== 'converted' && (
                      <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => { setConvertLead(selectedLead); setShowConvertDialog(true); setSelectedLead(null); }} data-testid="convert-from-detail">
                        <UserPlus className="w-3.5 h-3.5 mr-1" /> Convert to Contact
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => handleEnrichLead(selectedLead.lead_id)} disabled={enriching}>
                      {enriching ? <div className="w-3.5 h-3.5 border-2 border-teal-500 border-t-transparent rounded-full animate-spin mr-1" /> : <Wand2 className="w-3.5 h-3.5 mr-1" />} Enrich
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => { setEmailLeadId(selectedLead.lead_id); setEmailLeadName(`${selectedLead.first_name} ${selectedLead.last_name}`); setSelectedLead(null); }}>
                      <Mail className="w-3.5 h-3.5 mr-1" /> Draft Email
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => { setSelectedLead(null); navigate(`/deals?create=true&lead_id=${selectedLead.lead_id}`); }}>
                      <Target className="w-3.5 h-3.5 mr-1" /> Add Deal
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => { setSelectedLead(null); navigate(`/tasks?create=true&lead_id=${selectedLead.lead_id}`); }}>
                      <CheckSquare className="w-3.5 h-3.5 mr-1" /> Add Task
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => navigate(`/chat?type=lead&id=${selectedLead.lead_id}`)}>
                      <MessageSquare className="w-3.5 h-3.5 mr-1" /> Discuss
                    </Button>
                    {selectedLead.phone && (
                      <Button size="sm" variant="outline" onClick={() => navigate(`/calls?lead=${selectedLead.lead_id}`)}>
                        <Phone className="w-3.5 h-3.5 mr-1" /> Call
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Convert to Contact Dialog */}
      <Dialog open={showConvertDialog} onOpenChange={() => { setShowConvertDialog(false); setConvertLead(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><UserPlus className="w-5 h-5 text-[#0EA5A0]" /> Convert Lead to Contact</DialogTitle>
          </DialogHeader>
          {convertLead && (
            <div className="space-y-4 pt-2">
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                <p className="font-medium text-slate-900">{convertLead.first_name} {convertLead.last_name}</p>
                <p className="text-sm text-slate-500">{convertLead.company} {convertLead.job_title && `· ${convertLead.job_title}`}</p>
              </div>
              <p className="text-sm text-slate-600">This will create a Contact with all lead data and mark the lead as converted. You can optionally link a deal.</p>
              <div>
                <Label className="text-sm font-medium text-slate-700 mb-1.5 block">Link to Deal (optional)</Label>
                <Select value={convertDealId} onValueChange={setConvertDealId}>
                  <SelectTrigger data-testid="convert-deal-select"><SelectValue placeholder="No deal linked" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No deal</SelectItem>
                    {deals.map(d => <SelectItem key={d.deal_id} value={d.deal_id}>{d.name} — €{d.value}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleConvertToContact} disabled={converting} className="w-full bg-[#0EA5A0] hover:bg-teal-700" data-testid="confirm-convert-btn">
                {converting ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" /> : <UserPlus className="w-4 h-4 mr-2" />}
                Convert to Contact
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Email Composer - at page level to avoid nested dialog issues */}
      {emailLeadId && (
        <AIEmailComposer leadId={emailLeadId} leadName={emailLeadName} onClose={() => { setEmailLeadId(null); setEmailLeadName(''); }} />
      )}
    </DashboardLayout>
  );
};

export default LeadsPage;
