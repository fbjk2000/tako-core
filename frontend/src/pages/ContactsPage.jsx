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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Switch } from '../components/ui/switch';
import { Badge } from '../components/ui/badge';
import { toast } from 'sonner';
import axios from 'axios';
import {
  Search, Users, Mail, Phone, Building, Linkedin, Globe, MapPin, Edit2,
  Save, Briefcase, Tag, Wand2, Target, DollarSign, Clock, MessageSquare,
  Plus, Upload, Trash2, Filter
} from 'lucide-react';

const ContactsPage = () => {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [contacts, setContacts] = useState([]);
  const { t } = useT();
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [newContact, setNewContact] = useState({ first_name: '', last_name: '', email: '', phone: '', company: '', job_title: '' });
  const [selectedIds, setSelectedIds] = useState([]);
  const [visibleCols, setVisibleCols] = useState({ company: true, email: true, phone: false, job_title: false, decision_maker: true });
  const [showColSettings, setShowColSettings] = useState(false);
  const [selectedContact, setSelectedContact] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState({});
  const [saving, setSaving] = useState(false);
  const [searchParams] = useState(() => new URLSearchParams(window.location.search));

  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const axiosConfig = { headers, withCredentials: true };

  useEffect(() => { fetchContacts(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (!token) return;
    const detailId = searchParams.get('detail');
    if (detailId && contacts.length > 0) {
      const c = contacts.find(x => x.contact_id === detailId);
      if (c) { setSelectedContact(c); setEditData({ ...c }); setEditMode(true); }
    }
  }, [contacts]);

  const fetchContacts = async () => {
    try {
      const res = await axios.get(`${API}/contacts`, axiosConfig);
      setContacts(res.data);
    } catch { toast.error(t('contacts.fetchFailed')); }
    finally { setLoading(false); }
  };

  const handleAddContact = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/contacts`, { ...newContact, source: 'manual' }, axiosConfig);
      toast.success(t('contacts.createSuccess'));
      setShowAddDialog(false);
      setNewContact({ first_name: '', last_name: '', email: '', phone: '', company: '', job_title: '' });
      fetchContacts();
    } catch (err) { toast.error(err.response?.data?.detail || t('contacts.createFailed')); }
  };

  const handleImportCSV = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await axios.post(`${API}/contacts/import-csv`, formData, { headers: { ...headers, 'Content-Type': 'multipart/form-data' }, withCredentials: true });
      toast.success(t('contacts.importSuccess').replace('{count}', res.data.count));
      setShowImportDialog(false);
      fetchContacts();
    } catch { toast.error(t('contacts.importFailed')); }
  };

  const handleBulkDelete = async () => {
    if (!selectedIds.length) return;
    try {
      await axios.post(`${API}/bulk/delete`, { entity_type: 'contact', entity_ids: selectedIds }, axiosConfig);
      toast.success(t('contacts.bulkDeleteSuccess').replace('{count}', selectedIds.length));
      setSelectedIds([]);
      fetchContacts();
    } catch { toast.error(t('contacts.bulkDeleteFailed')); }
  };

  const toggleSelect = (id) => setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const toggleSelectAll = () => setSelectedIds(selectedIds.length === filtered.length ? [] : filtered.map(c => c.contact_id));

  const openDetail = (c) => { setSelectedContact(c); setEditData({ ...c }); setEditMode(false); };

  const handleSave = async () => {
    if (!selectedContact) return;
    setSaving(true);
    try {
      const { contact_id, organization_id, created_by, created_at, _id, ...updates } = editData;
      const res = await axios.put(`${API}/contacts/${selectedContact.contact_id}`, updates, axiosConfig);
      toast.success(t('contacts.updateSuccess'));
      setSelectedContact(res.data);
      setEditData(res.data);
      setEditMode(false);
      fetchContacts();
    } catch (err) { toast.error(err.response?.data?.detail || t('contacts.updateFailed')); }
    finally { setSaving(false); }
  };

  const filtered = contacts.filter(c => {
    const q = searchQuery.toLowerCase();
    return c.first_name?.toLowerCase().includes(q) || c.last_name?.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q) || c.company?.toLowerCase().includes(q);
  });

  const fields = [
    { key: 'first_name', label: t('forms.firstName') }, { key: 'last_name', label: t('forms.lastName') },
    { key: 'email', label: t('forms.email') }, { key: 'phone', label: t('forms.phone') },
    { key: 'company', label: t('forms.company') }, { key: 'job_title', label: t('forms.jobTitle') },
    { key: 'linkedin_url', label: t('contacts.colLinkedin') }, { key: 'website', label: t('forms.website') },
    { key: 'location', label: t('forms.location') }, { key: 'industry', label: t('forms.industry') },
    { key: 'company_size', label: t('forms.companySize') }, { key: 'budget', label: t('contacts.colBudget') },
    { key: 'timeline', label: t('contacts.colTimeline') }, { key: 'preferred_contact_method', label: t('contacts.preferredContact') },
  ];

  const viewFields = [
    { label: t('forms.email'), key: 'email', icon: <Mail className="w-3.5 h-3.5 text-slate-400" /> },
    { label: t('forms.phone'), key: 'phone', icon: <Phone className="w-3.5 h-3.5 text-slate-400" /> },
    { label: t('forms.company'), key: 'company', icon: <Building className="w-3.5 h-3.5 text-slate-400" /> },
    { label: t('forms.jobTitle'), key: 'job_title', icon: <Briefcase className="w-3.5 h-3.5 text-slate-400" /> },
    { label: t('forms.website'), key: 'website', icon: <Globe className="w-3.5 h-3.5 text-slate-400" />, link: true },
    { label: t('contacts.colLinkedin'), key: 'linkedin_url', icon: <Linkedin className="w-3.5 h-3.5 text-slate-400" />, link: true },
    { label: t('forms.location'), key: 'location', icon: <MapPin className="w-3.5 h-3.5 text-slate-400" /> },
    { label: t('forms.industry'), key: 'industry', icon: <Tag className="w-3.5 h-3.5 text-slate-400" /> },
    { label: t('contacts.colBudget'), key: 'budget', icon: <DollarSign className="w-3.5 h-3.5 text-slate-400" /> },
    { label: t('contacts.colTimeline'), key: 'timeline', icon: <Clock className="w-3.5 h-3.5 text-slate-400" /> },
    { label: t('contacts.decisionMaker'), key: 'decision_maker', icon: <Target className="w-3.5 h-3.5 text-slate-400" />, badge: true },
    { label: t('contacts.colAiScore'), key: 'ai_score', icon: null },
  ];

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6" data-testid="contacts-page">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900" data-testid="contacts-title">{t('contacts.title')}</h1>
            <p className="text-slate-500 text-sm mt-1">{t('contacts.subtitle')}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowImportDialog(true)} data-testid="import-contacts-btn">
              <Upload className="w-4 h-4 mr-2" /> {t('contacts.importCsv')}
            </Button>
            <Button className="bg-[#0EA5A0] hover:bg-[#0B8C88]" onClick={() => setShowAddDialog(true)} data-testid="add-contact-btn">
              <Plus className="w-4 h-4 mr-2" /> {t('contacts.addContact')}
            </Button>
          </div>
        </div>

        {/* Bulk actions bar */}
        {selectedIds.length > 0 && (
          <div className="flex items-center gap-3 bg-teal-50 border border-teal-200 rounded-lg p-3">
            <span className="text-sm font-medium text-teal-800">{t('contacts.selectedCount').replace('{count}', selectedIds.length)}</span>
            <Button size="sm" variant="outline" className="text-red-600 border-red-200" onClick={handleBulkDelete}>
              <Trash2 className="w-3.5 h-3.5 mr-1" /> {t('common.delete')}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelectedIds([])}>{t('common.clear')}</Button>
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input placeholder={t('contacts.searchContacts')} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" data-testid="contacts-search" />
          </div>
          <Button size="sm" variant="ghost" onClick={() => setShowColSettings(!showColSettings)} data-testid="contact-col-settings"><Filter className="w-3.5 h-3.5 mr-1" /> {t('contacts.columns')}</Button>
        </div>

        {showColSettings && (
          <Card className="p-3">
            <div className="flex flex-wrap gap-4">
              {[{key:'company',label:t('contacts.colCompany')},{key:'email',label:t('contacts.colEmail')},{key:'phone',label:t('contacts.colPhone')},{key:'job_title',label:t('contacts.colJobTitle')},{key:'decision_maker',label:t('contacts.decisionMaker')}].map(col => (
                <label key={col.key} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={visibleCols[col.key]} onChange={() => setVisibleCols(prev => ({...prev, [col.key]: !prev[col.key]}))} className="accent-[#0EA5A0]" />
                  {col.label}
                </label>
              ))}
            </div>
          </Card>
        )}

        <Card>
          <CardContent className="pt-0">
            {!loading && filtered.length > 0 && (
              <div className="px-4 py-2 border-b border-slate-100 flex items-center gap-3 bg-slate-50 rounded-t-lg">
                <input type="checkbox" checked={selectedIds.length === filtered.length && filtered.length > 0} onChange={toggleSelectAll} className="w-4 h-4 accent-[#0EA5A0]" data-testid="select-all-contacts" />
                <span className="text-xs text-slate-500">{(searchQuery ? t('contacts.selectAllContactsFiltered') : t('contacts.selectAllContacts')).replace('{count}', filtered.length)}</span>
              </div>
            )}
            {loading ? (
              <div className="p-8 text-center"><div className="w-8 h-8 border-2 border-[#0EA5A0] border-t-transparent rounded-full animate-spin mx-auto" /></div>
            ) : filtered.length === 0 ? (
              <div className="p-10 text-center text-slate-500">
                <Users className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                <p className="font-medium text-slate-700">{t('contacts.noContacts')}</p>
                <p className="text-sm mt-1 max-w-md mx-auto">
                  {t('contacts.noContactsBody')}
                </p>
                <div className="mt-4 flex items-center justify-center gap-2">
                  <Button onClick={() => setShowAddDialog(true)} className="bg-[#0EA5A0] hover:bg-[#0B8C88] text-white" data-testid="empty-add-contact">
                    <Plus className="w-4 h-4 mr-2" /> {t('contacts.addContact')}
                  </Button>
                  <Button variant="outline" asChild>
                    <a href="/leads">{t('contacts.goToLeads')}</a>
                  </Button>
                </div>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {filtered.map((c, i) => (
                  <div key={c.contact_id} className="p-4 hover:bg-slate-50 cursor-pointer transition-colors flex items-center gap-3" data-testid={`contact-row-${i}`}>
                    <input type="checkbox" checked={selectedIds.includes(c.contact_id)} onChange={() => toggleSelect(c.contact_id)} onClick={(e) => e.stopPropagation()} className="w-4 h-4 accent-[#0EA5A0] flex-shrink-0" />
                    <div className="flex-1 min-w-0" onClick={() => openDetail(c)}>
                      <div className="flex items-center justify-between gap-3 flex-wrap sm:flex-nowrap">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                          <span className="text-emerald-700 font-medium">{c.first_name?.[0]}{c.last_name?.[0]}</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-slate-900 truncate">{c.first_name} {c.last_name}</p>
                          <div className="flex items-center gap-x-3 gap-y-1 text-sm text-slate-500 mt-0.5 flex-wrap">
                            {visibleCols.company && c.company && <span className="flex items-center gap-1 min-w-0"><Building className="w-3 h-3 flex-shrink-0" /><span className="truncate">{c.company}</span></span>}
                            {visibleCols.email && c.email && <span className="flex items-center gap-1 min-w-0"><Mail className="w-3 h-3 flex-shrink-0" /><span className="truncate">{c.email}</span></span>}
                            {visibleCols.phone && c.phone && <span className="flex items-center gap-1 min-w-0"><Phone className="w-3 h-3 flex-shrink-0" /><span className="truncate">{c.phone}</span></span>}
                            {visibleCols.job_title && c.job_title && <span className="flex items-center gap-1 min-w-0"><Briefcase className="w-3 h-3 flex-shrink-0" /><span className="truncate">{c.job_title}</span></span>}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
                        {visibleCols.decision_maker && c.decision_maker && <Badge className="bg-amber-100 text-amber-700 text-xs">{ t('contacts.decisionMaker') }</Badge>}
                        {c.ai_score && <Badge className="bg-teal-100 text-teal-700 text-xs">{c.ai_score}/100</Badge>}
                      </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Contact Detail Dialog */}
      <Dialog open={!!selectedContact} onOpenChange={() => { setSelectedContact(null); setEditMode(false); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {selectedContact && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                      <span className="text-emerald-700 font-medium text-sm">{selectedContact.first_name?.[0]}{selectedContact.last_name?.[0]}</span>
                    </div>
                    {editMode ? t('contacts.editContact') : `${selectedContact.first_name} ${selectedContact.last_name}`}
                  </span>
                  {!editMode && (
                    <Button size="sm" variant="outline" onClick={() => setEditMode(true)} data-testid="edit-contact-btn">
                      <Edit2 className="w-3.5 h-3.5 mr-1" /> {t('common.edit')}
                    </Button>
                  )}
                </DialogTitle>
              </DialogHeader>

              {editMode ? (
                <div className="grid grid-cols-2 gap-3 pt-2">
                  {fields.map(f => (
                    <div key={f.key}>
                      <Label className="text-xs text-slate-500 mb-1 block">{f.label}</Label>
                      <Input value={editData[f.key] || ''} onChange={(e) => setEditData(prev => ({ ...prev, [f.key]: e.target.value }))} data-testid={`edit-contact-${f.key}`} />
                    </div>
                  ))}
                  <div className="flex items-center gap-3">
                    <Label className="text-xs text-slate-500">{t('contacts.decisionMaker')}</Label>
                    <Switch checked={!!editData.decision_maker} onCheckedChange={(v) => setEditData(prev => ({ ...prev, decision_maker: v }))} data-testid="edit-decision-maker" />
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs text-slate-500 mb-1 block">{t('contacts.painPoints')}</Label>
                    <Textarea value={editData.pain_points || ''} onChange={(e) => setEditData(prev => ({ ...prev, pain_points: e.target.value }))} rows={2} data-testid="edit-pain-points" />
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs text-slate-500 mb-1 block">{t('forms.notes')}</Label>
                    <Textarea value={editData.notes || ''} onChange={(e) => setEditData(prev => ({ ...prev, notes: e.target.value }))} rows={2} />
                  </div>
                  <div className="col-span-2 flex gap-2 pt-2">
                    <Button onClick={handleSave} disabled={saving} className="bg-[#0EA5A0] hover:bg-[#0B8C88]" data-testid="save-contact-btn">
                      {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                      {t('common.saveChanges')}
                    </Button>
                    <Button variant="outline" onClick={() => { setEditMode(false); setEditData({ ...selectedContact }); }}>{t('common.cancel')}</Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4 pt-2">
                  <div className="grid grid-cols-2 gap-3">
                    {viewFields.filter(f => selectedContact[f.key]).map(f => (
                      <div key={f.label} className="bg-slate-50 rounded-lg p-3">
                        <p className="text-xs text-slate-500 flex items-center gap-1">{f.icon}{f.label}</p>
                        {f.badge ? (
                          <Badge className={selectedContact[f.key] ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100'}>{selectedContact[f.key] ? t('common.yes') : t('common.no')}</Badge>
                        ) : f.link ? (
                          <a href={String(selectedContact[f.key]).startsWith('http') ? selectedContact[f.key] : `https://${selectedContact[f.key]}`} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-[#0EA5A0] hover:underline truncate block">{selectedContact[f.key]}</a>
                        ) : (
                          <p className="text-sm font-medium text-slate-900 truncate">{f.key === 'ai_score' ? `${selectedContact[f.key]}/100` : selectedContact[f.key]}</p>
                        )}
                      </div>
                    ))}
                  </div>
                  {selectedContact.pain_points && (
                    <div className="bg-slate-50 rounded-lg p-3"><p className="text-xs text-slate-500 mb-1">{t('contacts.painPoints')}</p><p className="text-sm text-slate-700">{selectedContact.pain_points}</p></div>
                  )}
                  {selectedContact.notes && (
                    <div className="bg-slate-50 rounded-lg p-3"><p className="text-xs text-slate-500 mb-1">{t('forms.notes')}</p><p className="text-sm text-slate-700">{selectedContact.notes}</p></div>
                  )}
                  {selectedContact.enrichment && (
                    <div className="bg-teal-50 rounded-lg p-4 border border-teal-100 space-y-2">
                      <p className="text-sm font-medium text-teal-900 flex items-center gap-1"><Wand2 className="w-4 h-4" /> {t('contacts.aiEnrichment')}</p>
                      {selectedContact.enrichment.recommended_approach && <p className="text-sm text-slate-700">{selectedContact.enrichment.recommended_approach}</p>}
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
                    <Button size="sm" variant="outline" onClick={() => { setSelectedContact(null); navigate(`/deals?create=true&contact_id=${selectedContact.contact_id}`); }}>
                      <Target className="w-3.5 h-3.5 mr-1" /> {t('contacts.addDeal')}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => { setSelectedContact(null); navigate(`/tasks?create=true`); }}>
                      <Clock className="w-3.5 h-3.5 mr-1" /> {t('contacts.addTask')}
                    </Button>
                    {selectedContact.email && (
                      <Button size="sm" variant="outline" onClick={() => { setSelectedContact(null); navigate(`/campaigns`); }}>
                        <Mail className="w-3.5 h-3.5 mr-1" /> {t('contacts.addToCampaign')}
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => navigate(`/chat?type=lead&id=${selectedContact.lead_id || selectedContact.contact_id}`)}>
                      <MessageSquare className="w-3.5 h-3.5 mr-1" /> {t('contacts.discuss')}
                    </Button>
                    {selectedContact.phone && (
                      <Button size="sm" variant="outline" onClick={() => navigate('/calls')}>
                        <Phone className="w-3.5 h-3.5 mr-1" /> {t('contacts.call')}
                      </Button>
                    )}
                    {selectedContact.deal_id && (
                      <Button size="sm" variant="outline" onClick={() => navigate(`/deals?detail=${selectedContact.deal_id}`)}>
                        <Target className="w-3.5 h-3.5 mr-1" /> {t('contacts.viewDeal')}
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Add Contact Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{ t('contacts.addContact') }</DialogTitle></DialogHeader>
          <form onSubmit={handleAddContact} className="space-y-3 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">{t('contacts.firstNameRequired')}</Label><Input value={newContact.first_name} onChange={(e) => setNewContact({ ...newContact, first_name: e.target.value })} required data-testid="new-contact-first" /></div>
              <div><Label className="text-xs">{t('contacts.lastNameLabel')}</Label><Input value={newContact.last_name} onChange={(e) => setNewContact({ ...newContact, last_name: e.target.value })} data-testid="new-contact-last" /></div>
              <div><Label className="text-xs">{t('contacts.emailLabel')}</Label><Input value={newContact.email} onChange={(e) => setNewContact({ ...newContact, email: e.target.value })} data-testid="new-contact-email" /></div>
              <div><Label className="text-xs">{t('contacts.phoneLabel')}</Label><Input value={newContact.phone} onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })} data-testid="new-contact-phone" /></div>
              <div><Label className="text-xs">{t('contacts.companyLabel')}</Label><Input value={newContact.company} onChange={(e) => setNewContact({ ...newContact, company: e.target.value })} /></div>
              <div><Label className="text-xs">{t('contacts.jobTitleLabel')}</Label><Input value={newContact.job_title} onChange={(e) => setNewContact({ ...newContact, job_title: e.target.value })} /></div>
            </div>
            <Button type="submit" className="w-full bg-[#0EA5A0] hover:bg-[#0B8C88]" data-testid="save-new-contact"><Plus className="w-4 h-4 mr-2" /> {t('contacts.createContact')}</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Import CSV Dialog */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{t('contacts.importTitle')}</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="border-2 border-dashed border-slate-200 rounded-lg p-6 text-center">
              <Upload className="w-8 h-8 mx-auto text-slate-400 mb-2" />
              <p className="text-sm text-slate-600 mb-2">{t('contacts.importDesc')}</p>
              <p className="text-xs text-slate-400 mb-3">{t('contacts.importColumns')}</p>
              <input type="file" accept=".csv" onChange={handleImportCSV} className="text-sm" data-testid="import-csv-input" />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default ContactsPage;
