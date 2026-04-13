import { useT } from '../useT';
import React, { useState, useEffect } from 'react';
import { useAuth, API } from '../App';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Badge } from '../components/ui/badge';
import { toast } from 'sonner';
import axios from 'axios';
import { Plus, MoreVertical, Euro, Calendar, Percent, Tag, Filter, X, Users, MessageSquare, LayoutGrid, List, Trash2, GripVertical, Edit2, Save } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '../components/ui/dropdown-menu';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';

const DealsPage = () => {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const [deals, setDeals] = useState([]);
  const { t } = useT();
  const [members, setMembers] = useState([]);
  const [existingTags, setExistingTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [viewMode, setViewMode] = useState('kanban');
  const [selectedDealIds, setSelectedDealIds] = useState([]);
  const [selectedDeal, setSelectedDeal] = useState(null);
  const [dealEditMode, setDealEditMode] = useState(false);
  const [dealEditData, setDealEditData] = useState({});

  // Auto-open create dialog from cross-link navigation
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('create') === 'true') {
      setIsAddDialogOpen(true);
      const lid = params.get('lead_id');
      const cid = params.get('contact_id');
      if (lid) setNewDeal(prev => ({...prev, lead_id: lid}));
      if (cid) setNewDeal(prev => ({...prev, contact_id: cid}));
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);
  
  // Filter states
  const [filterStage, setFilterStage] = useState('');
  const [filterTag, setFilterTag] = useState('');
  const [filterOwner, setFilterOwner] = useState('');
  
  const [newDeal, setNewDeal] = useState({
    name: '',
    value: 0,
    currency: 'EUR',
    stage: 'lead',
    probability: 20,
    expected_close_date: '',
    tags: [],
    notes: '',
    lead_id: '',
    contact_id: '',
    company_id: '',
    task_title: '',
    task_owner_id: '',
    task_description: '',
    task_due_date: ''
  });
  const [tagInput, setTagInput] = useState('');
  const [availableLeads, setAvailableLeads] = useState([]);
  const [availableContacts, setAvailableContacts] = useState([]);
  const [availableCompanies, setAvailableCompanies] = useState([]);

  const headers = token ? { Authorization: `Bearer ${token}` } : {};

  const stages = [
    { id: 'lead', name: 'Lead', color: 'bg-slate-100 border-slate-300', probability: 10 },
    { id: 'qualified', name: 'Qualified', color: 'bg-teal-50 border-indigo-300', probability: 30 },
    { id: 'proposal', name: 'Proposal', color: 'bg-amber-50 border-amber-300', probability: 50 },
    { id: 'negotiation', name: 'Negotiation', color: 'bg-teal-50 border-teal-300', probability: 70 },
    { id: 'won', name: 'Won', color: 'bg-emerald-50 border-emerald-300', probability: 100 },
    { id: 'lost', name: 'Lost', color: 'bg-rose-50 border-rose-300', probability: 0 }
  ];

  useEffect(() => {
    if (!token) return;
    fetchDeals();
    fetchMembers();
    fetchTags();
    fetchLinkedEntities();
  }, [filterStage, filterTag, filterOwner]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchLinkedEntities = async () => {
    try {
      const [leadsRes, contactsRes, companiesRes] = await Promise.all([
        axios.get(`${API}/leads`, { headers, withCredentials: true }),
        axios.get(`${API}/contacts`, { headers, withCredentials: true }),
        axios.get(`${API}/companies`, { headers, withCredentials: true })
      ]);
      setAvailableLeads(leadsRes.data || []);
      setAvailableContacts(contactsRes.data || []);
      setAvailableCompanies(companiesRes.data || []);
    } catch (err) { console.error(err); }
  };

  const fetchDeals = async () => {
    try {
      let url = `${API}/deals`;
      const params = new URLSearchParams();
      if (filterStage) params.append('stage', filterStage);
      if (filterTag) params.append('tag', filterTag);
      if (filterOwner) params.append('assigned_to', filterOwner);
      if (params.toString()) url += `?${params.toString()}`;
      
      const response = await axios.get(url, {
        headers,
        withCredentials: true
      });
      setDeals(response.data);
    } catch (error) {
      toast.error('Failed to fetch deals');
    } finally {
      setLoading(false);
    }
  };

  const fetchMembers = async () => {
    try {
      const orgRes = await axios.get(`${API}/organizations/current`, { headers, withCredentials: true });
      if (orgRes.data?.organization_id) {
        const membersRes = await axios.get(`${API}/organizations/${orgRes.data.organization_id}/members`, {
          headers,
          withCredentials: true
        });
        setMembers(membersRes.data || []);
      }
    } catch (error) {
      // silent
    }
  };

  const fetchTags = async () => {
    try {
      const response = await axios.get(`${API}/deals/tags`, { headers, withCredentials: true });
      setExistingTags(response.data.tags || []);
    } catch (error) {
      // silent
    }
  };

  const handleAddTag = () => {
    if (tagInput.trim() && !newDeal.tags.includes(tagInput.trim())) {
      setNewDeal({ ...newDeal, tags: [...newDeal.tags, tagInput.trim()] });
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove) => {
    setNewDeal({ ...newDeal, tags: newDeal.tags.filter(t => t !== tagToRemove) });
  };

  const handleAddDeal = async (e) => {
    e.preventDefault();
    
    // Validate mandatory task fields
    if (!newDeal.task_title.trim()) {
      toast.error('Task title is required when creating a deal');
      return;
    }
    if (!newDeal.task_owner_id) {
      toast.error('Task owner is required when creating a deal');
      return;
    }
    
    try {
      const dealData = {
        ...newDeal,
        value: parseFloat(newDeal.value) || 0,
        probability: parseInt(newDeal.probability) || 0,
        lead_id: newDeal.lead_id && newDeal.lead_id !== 'none' ? newDeal.lead_id : null,
        contact_id: newDeal.contact_id && newDeal.contact_id !== 'none' ? newDeal.contact_id : null,
        company_id: newDeal.company_id && newDeal.company_id !== 'none' ? newDeal.company_id : null,
      };
      
      // Remove empty dates
      if (!dealData.expected_close_date) delete dealData.expected_close_date;
      if (!dealData.task_due_date) delete dealData.task_due_date;
      
      await axios.post(`${API}/deals`, dealData, { headers, withCredentials: true });
      toast.success('Deal created with associated task');
      setIsAddDialogOpen(false);
      setNewDeal({
        name: '',
        value: 0,
        currency: 'EUR',
        stage: 'lead',
        probability: 20,
        expected_close_date: '',
        tags: [],
        notes: '',
        lead_id: '',
        contact_id: '',
        company_id: '',
        task_title: '',
        task_owner_id: '',
        task_description: '',
        task_due_date: ''
      });
      fetchDeals();
      fetchTags();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create deal');
    }
  };

  const handleStageChange = async (dealId, newStage) => {
    const stageInfo = stages.find(s => s.id === newStage);
    try {
      await axios.put(`${API}/deals/${dealId}`, { 
        stage: newStage,
        probability: stageInfo?.probability || 0
      }, {
        headers,
        withCredentials: true
      });
      toast.success('Deal stage updated');
      fetchDeals();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update deal');
    }
  };

  const clearFilters = () => {
    setFilterStage('');
    setFilterTag('');
    setFilterOwner('');
  };

  const getStageDeals = (stageId) => deals.filter(deal => deal.stage === stageId);
  const getStageValue = (stageId) => getStageDeals(stageId).reduce((sum, deal) => sum + (deal.value || 0), 0);
  const getWeightedValue = (stageId) => getStageDeals(stageId).reduce((sum, deal) => 
    sum + (deal.value || 0) * ((deal.probability || 0) / 100), 0
  );

  const hasActiveFilters = filterStage || filterTag || filterOwner;

  const handleDeleteDeal = async (dealId) => {
    try {
      await axios.delete(`${API}/deals/${dealId}`, { headers, withCredentials: true });
      toast.success('Deal deleted');
      setSelectedDeal(null);
      fetchDeals();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed to delete deal'); }
  };

  const openDealDetail = (deal) => { setSelectedDeal(deal); setDealEditData({...deal}); setDealEditMode(false); };

  const handleSaveDeal = async () => {
    if (!selectedDeal) return;
    try {
      const { deal_id, organization_id, created_by, created_at, _id, ...updates } = dealEditData;
      const res = await axios.put(`${API}/deals/${selectedDeal.deal_id}`, updates, { headers, withCredentials: true });
      toast.success('Deal updated');
      setSelectedDeal(res.data); setDealEditData(res.data); setDealEditMode(false);
      fetchDeals();
    } catch (err) { console.error(err); toast.error('Failed to update'); }
  };

  const onDragEnd = async (result) => {
    if (!result.destination) return;
    const dealId = result.draggableId;
    const newStage = result.destination.droppableId;
    const oldStage = result.source.droppableId;
    if (newStage === oldStage) return;
    
    // Optimistic update
    setDeals(prev => prev.map(d => d.deal_id === dealId ? { ...d, stage: newStage } : d));
    await handleStageChange(dealId, newStage);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6" data-testid="deals-page">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900" data-testid="deals-title">Deals Pipeline</h1>
            <p className="text-slate-600 mt-1">Track your deals through the sales pipeline</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex border border-slate-200 rounded-lg overflow-hidden">
              <button onClick={() => setViewMode('kanban')} className={`px-3 py-1.5 text-sm flex items-center gap-1 ${viewMode === 'kanban' ? 'bg-[#0EA5A0] text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`} data-testid="kanban-view-btn">
                <LayoutGrid className="w-3.5 h-3.5" /> Kanban
              </button>
              <button onClick={() => setViewMode('list')} className={`px-3 py-1.5 text-sm flex items-center gap-1 ${viewMode === 'list' ? 'bg-[#0EA5A0] text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`} data-testid="list-view-btn">
                <List className="w-3.5 h-3.5" /> List
              </button>
            </div>
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-[#0EA5A0] hover:bg-[#0B8C88]" data-testid="add-deal-btn">
                <Plus className="w-4 h-4 mr-2" />
                New Deal
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{ t('forms.newDeal') }</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleAddDeal} className="space-y-4 pt-4">
                {/* Deal Info Section */}
                <div className="space-y-4 border-b pb-4">
                  <h3 className="font-semibold text-slate-700">Deal Information</h3>
                  <div className="space-y-2">
                    <Label>Deal Name *</Label>
                    <Input
                      value={newDeal.name}
                      onChange={(e) => setNewDeal({ ...newDeal, name: e.target.value })}
                      placeholder="e.g., Enterprise License - Acme Corp"
                      required
                      data-testid="deal-name"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Value</Label>
                      <div className="relative">
                        <Euro className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <Input
                          type="number"
                          value={newDeal.value}
                          onChange={(e) => setNewDeal({ ...newDeal, value: e.target.value })}
                          className="pl-9"
                          data-testid="deal-value"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Probability %</Label>
                      <div className="relative">
                        <Percent className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          value={newDeal.probability}
                          onChange={(e) => setNewDeal({ ...newDeal, probability: e.target.value })}
                          className="pl-9"
                          data-testid="deal-probability"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Stage</Label>
                      <Select
                        value={newDeal.stage}
                        onValueChange={(value) => {
                          const stageInfo = stages.find(s => s.id === value);
                          setNewDeal({ 
                            ...newDeal, 
                            stage: value,
                            probability: stageInfo?.probability || newDeal.probability
                          });
                        }}
                      >
                        <SelectTrigger data-testid="deal-stage">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {stages.slice(0, -1).map((stage) => (
                            <SelectItem key={stage.id} value={stage.id}>
                              {stage.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Expected Close Date</Label>
                      <Input
                        type="date"
                        value={newDeal.expected_close_date}
                        onChange={(e) => setNewDeal({ ...newDeal, expected_close_date: e.target.value })}
                        data-testid="deal-close-date"
                      />
                    </div>
                  </div>
                  
                  {/* Tags */}
                  <div className="space-y-2">
                    <Label>Tags</Label>
                    <div className="flex gap-2">
                      <Input
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        placeholder="Add a tag..."
                        onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                        data-testid="deal-tag-input"
                      />
                      <Button type="button" variant="outline" onClick={handleAddTag}>
                        <Tag className="w-4 h-4" />
                      </Button>
                    </div>
                    {newDeal.tags.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {newDeal.tags.map((tag, idx) => (
                          <Badge key={idx} variant="secondary" className="flex items-center gap-1">
                            {tag}
                            <X className="w-3 h-3 cursor-pointer" onClick={() => handleRemoveTag(tag)} />
                          </Badge>
                        ))}
                      </div>
                    )}
                    {existingTags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        <span className="text-xs text-slate-500">Existing tags:</span>
                        {existingTags.slice(0, 5).map((tag, idx) => (
                          <Badge 
                            key={idx} 
                            variant="outline" 
                            className="text-xs cursor-pointer hover:bg-slate-100"
                            onClick={() => !newDeal.tags.includes(tag) && setNewDeal({...newDeal, tags: [...newDeal.tags, tag]})}
                          >
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Notes</Label>
                    <Input
                      value={newDeal.notes}
                      onChange={(e) => setNewDeal({ ...newDeal, notes: e.target.value })}
                      placeholder="Additional details..."
                      data-testid="deal-notes"
                    />
                  </div>
                </div>

                {/* Link to Entity */}
                <div className="space-y-3 bg-slate-50 p-4 rounded-lg">
                  <h3 className="font-semibold text-slate-800 text-sm">{ t('deals.linkTo') }</h3>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Lead</Label>
                      <Select value={newDeal.lead_id || 'none'} onValueChange={(v) => {
                        setNewDeal({ ...newDeal, lead_id: v === 'none' ? '' : v });
                        if (v !== 'none') setNewDeal(prev => ({ ...prev, lead_id: v, probability: Math.min(prev.probability, 30) }));
                      }}>
                        <SelectTrigger className="h-8 text-xs" data-testid="deal-lead-select"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          {availableLeads.map(l => <SelectItem key={l.lead_id} value={l.lead_id}>{l.first_name} {l.last_name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Contact</Label>
                      <Select value={newDeal.contact_id || 'none'} onValueChange={(v) => setNewDeal({ ...newDeal, contact_id: v === 'none' ? '' : v })}>
                        <SelectTrigger className="h-8 text-xs" data-testid="deal-contact-select"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          {availableContacts.map(c => <SelectItem key={c.contact_id} value={c.contact_id}>{c.first_name} {c.last_name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Company</Label>
                      <Select value={newDeal.company_id || 'none'} onValueChange={(v) => setNewDeal({ ...newDeal, company_id: v === 'none' ? '' : v })}>
                        <SelectTrigger className="h-8 text-xs" data-testid="deal-company-select"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          {availableCompanies.map(c => <SelectItem key={c.company_id} value={c.company_id}>{c.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  {newDeal.lead_id && newDeal.lead_id !== 'none' && (
                    <p className="text-xs text-amber-600 bg-amber-50 p-2 rounded">Linking to a lead suggests a lower probability of closing. Consider 10-30%.</p>
                  )}
                </div>
                
                {/* Mandatory Task Section */}
                <div className="space-y-4 bg-teal-50 p-4 rounded-lg">
                  <h3 className="font-semibold text-teal-900 flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Initial Task (Required)
                  </h3>
                  <p className="text-xs text-teal-700">Every deal must have an initial task and owner</p>
                  
                  <div className="space-y-2">
                    <Label>Task Title *</Label>
                    <Input
                      value={newDeal.task_title}
                      onChange={(e) => setNewDeal({ ...newDeal, task_title: e.target.value })}
                      placeholder="e.g., Initial contact call"
                      required
                      data-testid="task-title"
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Task Owner *</Label>
                      <Select
                        value={newDeal.task_owner_id}
                        onValueChange={(value) => setNewDeal({ ...newDeal, task_owner_id: value })}
                      >
                        <SelectTrigger data-testid="task-owner">
                          <SelectValue placeholder="Select owner" />
                        </SelectTrigger>
                        <SelectContent>
                          {members.length > 0 ? members.map((member) => (
                            <SelectItem key={member.user_id} value={member.user_id}>
                              {member.name}
                            </SelectItem>
                          )) : user?.user_id ? (
                            <SelectItem value={user.user_id}>
                              {user?.name || 'Me'}
                            </SelectItem>
                          ) : (
                            <SelectItem value="self">Me (default)</SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Task Due Date</Label>
                      <Input
                        type="date"
                        value={newDeal.task_due_date}
                        onChange={(e) => setNewDeal({ ...newDeal, task_due_date: e.target.value })}
                        data-testid="task-due-date"
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Task Description</Label>
                    <Input
                      value={newDeal.task_description}
                      onChange={(e) => setNewDeal({ ...newDeal, task_description: e.target.value })}
                      placeholder="What needs to be done?"
                      data-testid="task-description"
                    />
                  </div>
                </div>
                
                <Button type="submit" className="w-full bg-[#0EA5A0] hover:bg-[#0B8C88]" data-testid="submit-deal-btn">
                  Create Deal with Task
                </Button>
              </form>
            </DialogContent>
          </Dialog>
          </div>
        </div>

        {/* Filters */}
        <Card className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-500" />
              <span className="text-sm font-medium text-slate-700">Filters:</span>
            </div>
            
            <Select value={filterStage || "all"} onValueChange={(v) => setFilterStage(v === "all" ? "" : v)}>
              <SelectTrigger className="w-[150px]" data-testid="filter-stage">
                <SelectValue placeholder="All Stages" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Stages</SelectItem>
                {stages.map((stage) => (
                  <SelectItem key={stage.id} value={stage.id}>{stage.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select value={filterTag || "all"} onValueChange={(v) => setFilterTag(v === "all" ? "" : v)}>
              <SelectTrigger className="w-[150px]" data-testid="filter-tag">
                <SelectValue placeholder="All Tags" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Tags</SelectItem>
                {existingTags.map((tag) => (
                  <SelectItem key={tag} value={tag}>{tag}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select value={filterOwner || "all"} onValueChange={(v) => setFilterOwner(v === "all" ? "" : v)}>
              <SelectTrigger className="w-[150px]" data-testid="filter-owner">
                <SelectValue placeholder="All Owners" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Owners</SelectItem>
                {members.map((member) => (
                  <SelectItem key={member.user_id} value={member.user_id}>{member.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} data-testid="clear-filters">
                <X className="w-4 h-4 mr-1" />
                Clear
              </Button>
            )}
          </div>
        </Card>

        {/* Bulk actions */}
        {selectedDealIds.length > 0 && (
          <div className="flex items-center gap-3 bg-teal-50 border border-teal-200 rounded-lg p-3">
            <span className="text-sm font-medium text-teal-800">{selectedDealIds.length} selected</span>
            <Button size="sm" variant="outline" className="text-red-600 border-red-200" onClick={async () => {
              try { await axios.post(`${API}/bulk/delete`, { entity_type: 'deal', entity_ids: selectedDealIds }, { headers, withCredentials: true }); toast.success('Deals deleted'); setSelectedDealIds([]); fetchDeals(); } catch { toast.error('Failed'); }
            }} data-testid="bulk-delete-deals"><Trash2 className="w-3.5 h-3.5 mr-1" /> Delete</Button>
            <Button size="sm" variant="ghost" onClick={() => setSelectedDealIds([])}>Clear</Button>
          </div>
        )}

        {/* Pipeline Board */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-2 border-[#0EA5A0] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : viewMode === 'list' ? (
          /* List View */
          <Card>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-slate-50">
                    <th className="py-3 px-4 text-left w-10"><input type="checkbox" checked={selectedDealIds.length === deals.length && deals.length > 0} onChange={() => setSelectedDealIds(selectedDealIds.length === deals.length ? [] : deals.map(d => d.deal_id))} className="accent-[#0EA5A0]" /></th>
                    <th className="py-3 px-4 text-left text-xs font-medium text-slate-500">Deal</th>
                    <th className="py-3 px-4 text-left text-xs font-medium text-slate-500">Value</th>
                    <th className="py-3 px-4 text-left text-xs font-medium text-slate-500">Stage</th>
                    <th className="py-3 px-4 text-left text-xs font-medium text-slate-500">Probability</th>
                    <th className="py-3 px-4 text-left text-xs font-medium text-slate-500">Tags</th>
                    <th className="py-3 px-4 text-left text-xs font-medium text-slate-500">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {deals.map((deal) => (
                    <tr key={deal.deal_id} className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer" onClick={() => openDealDetail(deal)} data-testid={`deal-list-row-${deal.deal_id}`}>
                      <td className="py-3 px-4"><input type="checkbox" checked={selectedDealIds.includes(deal.deal_id)} onChange={() => setSelectedDealIds(prev => prev.includes(deal.deal_id) ? prev.filter(x => x !== deal.deal_id) : [...prev, deal.deal_id])} className="accent-[#0EA5A0]" /></td>
                      <td className="py-3 px-4">
                        <p className="font-medium text-slate-900">{deal.name}</p>
                        {deal.notes && <p className="text-xs text-slate-500 truncate max-w-[200px]">{deal.notes}</p>}
                      </td>
                      <td className="py-3 px-4 font-medium">€{deal.value?.toLocaleString()}</td>
                      <td className="py-3 px-4">
                        <Select value={deal.stage} onValueChange={(v) => handleStageChange(deal.deal_id, v)}>
                          <SelectTrigger className="w-[120px] h-7 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>{stages.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                        </Select>
                      </td>
                      <td className="py-3 px-4 text-xs">{deal.probability}%</td>
                      <td className="py-3 px-4"><div className="flex gap-1">{deal.tags?.map(t => <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>)}</div></td>
                      <td className="py-3 px-4">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7"><MoreVertical className="w-3 h-3" /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => navigate(`/chat?type=deal&id=${deal.deal_id}`)}><MessageSquare className="w-3 h-3 mr-2" />{ t('leads.discuss') }</DropdownMenuItem>
                            <DropdownMenuItem className="text-red-600" onClick={() => handleDeleteDeal(deal.deal_id)}>{ t('common.delete') }</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {deals.length === 0 && <p className="text-center text-slate-500 py-8">{ t('deals.noDeals') }</p>}
            </CardContent>
          </Card>
        ) : (
          <DragDropContext onDragEnd={onDragEnd}>
            <div className="overflow-x-auto pb-4 -mx-6 px-6" style={{ scrollbarWidth: 'thin' }}>
              <div className="flex gap-4" style={{ minWidth: `${stages.length * 288}px` }}>
                {stages.map((stage) => (
                  <Droppable droppableId={stage.id} key={stage.id}>
                    {(provided, snapshot) => (
                      <div className="w-72 flex-shrink-0" data-testid={`stage-${stage.id}`}>
                        <Card className={`border-t-4 ${stage.color} ${snapshot.isDraggingOver ? 'ring-2 ring-[#0EA5A0]/30' : ''}`}>
                          <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                              <CardTitle className="text-sm font-semibold">{stage.name}</CardTitle>
                              <span className="text-xs bg-slate-100 px-2 py-1 rounded-full">{getStageDeals(stage.id).length}</span>
                            </div>
                            <div>
                              <p className="text-lg font-bold text-slate-900">€{getStageValue(stage.id).toLocaleString()}</p>
                              <p className="text-xs text-slate-500">Weighted: €{getWeightedValue(stage.id).toLocaleString(undefined, {maximumFractionDigits: 0})}</p>
                            </div>
                          </CardHeader>
                          <CardContent
                            ref={provided.innerRef}
                            {...provided.droppableProps}
                            className="space-y-3 min-h-[100px] max-h-[calc(100vh-320px)] overflow-y-auto"
                          >
                            {getStageDeals(stage.id).map((deal, idx) => (
                              <Draggable key={deal.deal_id} draggableId={deal.deal_id} index={idx}>
                                {(provided, snapshot) => (
                                  <div
                                    ref={provided.innerRef}
                                    {...provided.draggableProps}
                                    className={`bg-white rounded-lg border shadow-sm hover:shadow-md transition-shadow ${snapshot.isDragging ? 'shadow-lg ring-2 ring-[#0EA5A0]/20' : ''}`}
                                    data-testid={`deal-card-${deal.deal_id}`}
                                  >
                                    <div className="p-3">
                                      <div className="flex items-start gap-2">
                                        <div {...provided.dragHandleProps} className="mt-1 cursor-grab active:cursor-grabbing">
                                          <GripVertical className="w-4 h-4 text-slate-300" />
                                        </div>
                                        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => openDealDetail(deal)}>
                                          <p className="font-medium text-slate-900 text-sm truncate">{deal.name}</p>
                                          <p className="text-lg font-bold text-[#0EA5A0] mt-1">€{(deal.value || 0).toLocaleString()}</p>
                                          <div className="flex items-center gap-2 mt-1">
                                            <Badge variant={deal.probability >= 70 ? "default" : deal.probability >= 40 ? "secondary" : "outline"} className="text-xs">{deal.probability || 0}%</Badge>
                                            {deal.expected_close_date && (
                                              <span className="flex items-center gap-1 text-xs text-slate-500"><Calendar className="w-3 h-3" />{new Date(deal.expected_close_date).toLocaleDateString()}</span>
                                            )}
                                          </div>
                                          {deal.tags?.length > 0 && (
                                            <div className="flex flex-wrap gap-1 mt-2">{deal.tags.map((t, i) => <Badge key={i} variant="outline" className="text-xs">{t}</Badge>)}</div>
                                          )}
                                          {deal.notes && <p className="text-xs text-slate-500 mt-2 line-clamp-1">{deal.notes}</p>}
                                        </div>
                                        <DropdownMenu>
                                          <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0"><MoreVertical className="w-3.5 h-3.5" /></Button>
                                          </DropdownMenuTrigger>
                                          <DropdownMenuContent align="end">
                                            <DropdownMenuItem onClick={() => navigate(`/chat?type=deal&id=${deal.deal_id}`)}><MessageSquare className="w-3.5 h-3.5 mr-2" />{ t('leads.discuss') }</DropdownMenuItem>
                                            {stages.map(s => (
                                              <DropdownMenuItem key={s.id} onClick={() => handleStageChange(deal.deal_id, s.id)} disabled={s.id === deal.stage}>Move to {s.name}</DropdownMenuItem>
                                            ))}
                                            <DropdownMenuItem className="text-red-600" onClick={() => handleDeleteDeal(deal.deal_id)}><Trash2 className="w-3.5 h-3.5 mr-2" />{ t('common.delete') }</DropdownMenuItem>
                                          </DropdownMenuContent>
                                        </DropdownMenu>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </Draggable>
                            ))}
                            {provided.placeholder}
                            {getStageDeals(stage.id).length === 0 && (
                              <p className="text-center text-sm text-slate-400 py-4">{ t('deals.dropHere') }</p>
                            )}
                          </CardContent>
                        </Card>
                      </div>
                    )}
                  </Droppable>
                ))}
              </div>
            </div>
          </DragDropContext>
        )}
      </div>

      {/* Deal Detail / Edit Dialog */}
      <Dialog open={!!selectedDeal} onOpenChange={() => { setSelectedDeal(null); setDealEditMode(false); }}>
        <DialogContent className="max-w-lg">
          {selectedDeal && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center justify-between">
                  <span>{dealEditMode ? t('forms.editDeal') : selectedDeal.name}</span>
                  {!dealEditMode && <Button size="sm" variant="outline" onClick={() => setDealEditMode(true)} data-testid="edit-deal-btn"><Edit2 className="w-3.5 h-3.5 mr-1" />{t('common.edit')}</Button>}
                </DialogTitle>
              </DialogHeader>
              {dealEditMode ? (
                <div className="space-y-3 pt-2">
                  <div><Label>{t('forms.name')}</Label><Input value={dealEditData.name || ''} onChange={e => setDealEditData({...dealEditData, name: e.target.value})} /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>{t('forms.value')}</Label><Input type="number" value={dealEditData.value || 0} onChange={e => setDealEditData({...dealEditData, value: parseFloat(e.target.value) || 0})} /></div>
                    <div><Label>{t('forms.probability')}</Label><Input type="number" value={dealEditData.probability || 0} onChange={e => setDealEditData({...dealEditData, probability: parseInt(e.target.value) || 0})} /></div>
                  </div>
                  <div><Label>{t('forms.stage')}</Label>
                    <Select value={dealEditData.stage} onValueChange={v => setDealEditData({...dealEditData, stage: v})}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{stages.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div><Label>{t('forms.linkedLead')}</Label>
                      <Select value={dealEditData.lead_id || 'none'} onValueChange={v => setDealEditData({...dealEditData, lead_id: v === 'none' ? null : v})}>
                        <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="none">None</SelectItem>{availableLeads.map(l => <SelectItem key={l.lead_id} value={l.lead_id}>{l.first_name} {l.last_name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div><Label>{t('forms.linkedContact')}</Label>
                      <Select value={dealEditData.contact_id || 'none'} onValueChange={v => setDealEditData({...dealEditData, contact_id: v === 'none' ? null : v})}>
                        <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="none">None</SelectItem>{availableContacts.map(c => <SelectItem key={c.contact_id} value={c.contact_id}>{c.first_name} {c.last_name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div><Label>{t('forms.linkedCompany')}</Label>
                      <Select value={dealEditData.company_id || 'none'} onValueChange={v => setDealEditData({...dealEditData, company_id: v === 'none' ? null : v})}>
                        <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="none">None</SelectItem>{availableCompanies.map(c => <SelectItem key={c.company_id} value={c.company_id}>{c.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div><Label>{t('forms.notes')}</Label><Textarea value={dealEditData.notes || ''} onChange={e => setDealEditData({...dealEditData, notes: e.target.value})} rows={2} /></div>
                  <div className="flex gap-2 pt-2">
                    <Button onClick={handleSaveDeal} className="bg-[#0EA5A0] hover:bg-[#0B8C88] text-white"><Save className="w-4 h-4 mr-2" />{t('common.save')}</Button>
                    <Button variant="outline" onClick={() => { setDealEditMode(false); setDealEditData({...selectedDeal}); }}>{t('common.cancel')}</Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4 pt-2">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-50 rounded-lg p-3"><p className="text-xs text-slate-500">{t('forms.value')}</p><p className="text-lg font-bold text-[#0EA5A0]">{'\u20AC'}{(selectedDeal.value || 0).toLocaleString()}</p></div>
                    <div className="bg-slate-50 rounded-lg p-3"><p className="text-xs text-slate-500">{t('forms.stage')}</p><p className="text-sm font-medium capitalize">{selectedDeal.stage}</p></div>
                    <div className="bg-slate-50 rounded-lg p-3"><p className="text-xs text-slate-500">{t('forms.probability')}</p><p className="text-sm font-medium">{selectedDeal.probability || 0}%</p></div>
                    {selectedDeal.expected_close_date && <div className="bg-slate-50 rounded-lg p-3"><p className="text-xs text-slate-500">{t('forms.expectedCloseDate')}</p><p className="text-sm font-medium">{new Date(selectedDeal.expected_close_date).toLocaleDateString()}</p></div>}
                  </div>
                  {selectedDeal.tags?.length > 0 && <div className="flex gap-1 flex-wrap">{selectedDeal.tags.map((tg, i) => <Badge key={i} variant="secondary" className="text-xs">{tg}</Badge>)}</div>}
                  {selectedDeal.notes && <div className="bg-slate-50 rounded-lg p-3"><p className="text-xs text-slate-500 mb-1">{t('forms.notes')}</p><p className="text-sm text-slate-700">{selectedDeal.notes}</p></div>}
                  <div className="flex gap-2 pt-1">
                    <Button size="sm" variant="outline" onClick={() => { setSelectedDeal(null); navigate(`/chat?type=deal&id=${selectedDeal.deal_id}`); }}><MessageSquare className="w-3.5 h-3.5 mr-1" />{t('leads.discuss')}</Button>
                    <Button size="sm" variant="outline" className="text-red-500" onClick={() => handleDeleteDeal(selectedDeal.deal_id)}><Trash2 className="w-3.5 h-3.5 mr-1" />{t('common.delete')}</Button>
                  </div>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default DealsPage;
