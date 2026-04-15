import { useT } from '../useT';
import React, { useState, useEffect } from 'react';
import { useAuth, API } from '../App';
import DashboardLayout from '../components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Badge } from '../components/ui/badge';
import { toast } from 'sonner';
import axios from 'axios';
import { Plus, Search, Building, Upload, Trash2, Edit2, Save, Globe, MapPin, Users, X, Filter } from 'lucide-react';

const CompaniesPage = () => {
  const { token } = useAuth();
  const { t } = useT();
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState({});
  const [newCompany, setNewCompany] = useState({ name: '', industry: '', website: '', size: '', description: '', location: '' });
  const [selectedIds, setSelectedIds] = useState([]);

  const getAx = () => ({ headers: { Authorization: `Bearer ${token}` }, withCredentials: true });

  useEffect(() => {
    if (!token) return;
    fetchCompanies();
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchCompanies = async () => {
    try { const r = await axios.get(`${API}/companies`, getAx()); setCompanies(r.data); }
    catch (err) { console.error(err); toast.error(t('companies.loadFailed')); }
    finally { setLoading(false); }
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/companies`, newCompany, getAx());
      toast.success(t('companies.addSuccess'));
      setShowAdd(false);
      setNewCompany({ name: '', industry: '', website: '', size: '', description: '', location: '' });
      fetchCompanies();
    } catch (err) { console.error(err); toast.error(err.response?.data?.detail || t('companies.addFailed')); }
  };

  const handleSave = async () => {
    if (!selectedCompany) return;
    try {
      const { company_id, organization_id, created_by, created_at, _id, ...updates } = editData;
      const res = await axios.put(`${API}/companies/${selectedCompany.company_id}`, updates, getAx());
      toast.success(t('companies.updateSuccess'));
      setSelectedCompany(res.data); setEditData(res.data); setEditMode(false);
      fetchCompanies();
    } catch (err) { console.error(err); toast.error(t('companies.updateFailed')); }
  };

  const handleDelete = async (id) => {
    try { await axios.delete(`${API}/companies/${id}`, getAx()); toast.success(t('companies.deleteSuccess')); setSelectedCompany(null); fetchCompanies(); }
    catch (err) { console.error(err); toast.error(t('companies.deleteFailed')); }
  };

  const handleBulkDelete = async () => {
    try { await axios.post(`${API}/bulk/delete`, { entity_type: 'company', entity_ids: selectedIds }, getAx()); toast.success(t('companies.bulkDeleteSuccess').replace('{count}', selectedIds.length)); setSelectedIds([]); fetchCompanies(); }
    catch (err) { console.error(err); toast.error(t('companies.deleteFailed')); }
  };

  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await axios.post(`${API}/companies/import-csv`, formData, { headers: { ...headers, 'Content-Type': 'multipart/form-data' }, withCredentials: true });
      toast.success(t('companies.importSuccess').replace('{count}', res.data.count));
      setShowImport(false); fetchCompanies();
    } catch (err) { console.error(err); toast.error(t('companies.importFailed')); }
  };

  const openDetail = (c) => { setSelectedCompany(c); setEditData({ ...c }); setEditMode(false); };
  const toggleSelect = (id) => setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const filtered = companies.filter(c => {
    const q = searchQuery.toLowerCase();
    return c.name?.toLowerCase().includes(q) || c.industry?.toLowerCase().includes(q) || c.website?.toLowerCase().includes(q);
  });

  const fields = [
    { key: 'name', label: t('forms.name'), required: true },
    { key: 'industry', label: t('forms.industry') },
    { key: 'website', label: t('forms.website') },
    { key: 'size', label: t('forms.companySize') },
    { key: 'location', label: t('forms.location') },
  ];

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6" data-testid="companies-page">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{ t('companies.title') }</h1>
            <p className="text-slate-500 text-sm mt-1">{ t('companies.subtitle') }</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowImport(true)}><Upload className="w-4 h-4 mr-2" />{ t('forms.importCsv') }</Button>
            <Button className="bg-[#0EA5A0] hover:bg-[#0B8C88] text-white" onClick={() => setShowAdd(true)} data-testid="add-company-btn"><Plus className="w-4 h-4 mr-2" />{ t('forms.newCompany') }</Button>
          </div>
        </div>

        {selectedIds.length > 0 && (
          <div className="flex items-center gap-3 bg-teal-50 border border-teal-200 rounded-lg p-3">
            <span className="text-sm font-medium text-teal-800">{selectedIds.length} {t('common.selected')}</span>
            <Button size="sm" variant="outline" className="text-red-600 border-red-200" onClick={handleBulkDelete}><Trash2 className="w-3.5 h-3.5 mr-1" />{t('common.delete')}</Button>
            <Button size="sm" variant="ghost" onClick={() => setSelectedIds([])}>{t('common.clear')}</Button>
          </div>
        )}

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input placeholder={t('companies.search')} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
        </div>

        <Card>
          <CardContent className="p-0">
            {!loading && filtered.length > 0 && (
              <div className="px-4 py-2 border-b bg-slate-50 flex items-center gap-3">
                <input type="checkbox" checked={selectedIds.length === filtered.length && filtered.length > 0} onChange={() => setSelectedIds(selectedIds.length === filtered.length ? [] : filtered.map(c => c.company_id))} className="w-4 h-4 accent-[#0EA5A0]" />
                <span className="text-xs text-slate-500">{t('forms.selectAll')} ({filtered.length})</span>
              </div>
            )}
            {loading ? (
              <div className="p-8 text-center"><div className="w-8 h-8 border-2 border-[#0EA5A0] border-t-transparent rounded-full animate-spin mx-auto" /></div>
            ) : filtered.length === 0 ? (
              <div className="p-8 text-center text-slate-500">
                <Building className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                <p className="font-medium">{t('companies.noCompanies')}</p>
                <p className="text-sm mt-1">{t('companies.noCompaniesDesc')}</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead><tr className="border-b bg-slate-50">
                  <th className="py-3 px-4 w-10"></th>
                  <th className="py-3 px-4 text-left text-xs font-medium text-slate-500">{t('forms.name')}</th>
                  <th className="py-3 px-4 text-left text-xs font-medium text-slate-500">{t('forms.industry')}</th>
                  <th className="py-3 px-4 text-left text-xs font-medium text-slate-500">{t('forms.website')}</th>
                  <th className="py-3 px-4 text-left text-xs font-medium text-slate-500">{t('forms.companySize')}</th>
                  <th className="py-3 px-4 text-left text-xs font-medium text-slate-500">{t('forms.location')}</th>
                  <th className="py-3 px-4 w-20"></th>
                </tr></thead>
                <tbody>
                  {filtered.map((c, i) => (
                    <tr key={c.company_id} className="border-b border-slate-50 hover:bg-slate-50 cursor-pointer" data-testid={`company-row-${i}`}>
                      <td className="py-3 px-4" onClick={e => e.stopPropagation()}><input type="checkbox" checked={selectedIds.includes(c.company_id)} onChange={() => toggleSelect(c.company_id)} className="w-4 h-4 accent-[#0EA5A0]" /></td>
                      <td className="py-3 px-4 font-medium" onClick={() => openDetail(c)}>{c.name}</td>
                      <td className="py-3 px-4 text-slate-500" onClick={() => openDetail(c)}>{c.industry || '-'}</td>
                      <td className="py-3 px-4" onClick={() => openDetail(c)}>{c.website ? <a href={c.website.startsWith('http') ? c.website : `https://${c.website}`} target="_blank" rel="noopener noreferrer" className="text-[#0EA5A0] hover:underline" onClick={e => e.stopPropagation()}>{c.website}</a> : '-'}</td>
                      <td className="py-3 px-4 text-slate-500" onClick={() => openDetail(c)}>{c.size || '-'}</td>
                      <td className="py-3 px-4 text-slate-500" onClick={() => openDetail(c)}>{c.location || '-'}</td>
                      <td className="py-3 px-4"><Button variant="ghost" size="sm" className="text-red-500 h-7" onClick={() => handleDelete(c.company_id)}><Trash2 className="w-3.5 h-3.5" /></Button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Add Company */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{t('forms.newCompany')}</DialogTitle></DialogHeader>
          <form onSubmit={handleAdd} className="space-y-3 pt-2">
            {fields.map(f => (
              <div key={f.key}><Label>{f.label} {f.required && '*'}</Label><Input value={newCompany[f.key] || ''} onChange={e => setNewCompany({...newCompany, [f.key]: e.target.value})} required={f.required} /></div>
            ))}
            <div><Label>{t('forms.description')}</Label><Textarea value={newCompany.description} onChange={e => setNewCompany({...newCompany, description: e.target.value})} rows={2} /></div>
            <Button type="submit" className="w-full bg-[#0EA5A0] hover:bg-[#0B8C88] text-white">{t('forms.createCompany')}</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Import CSV */}
      <Dialog open={showImport} onOpenChange={setShowImport}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{t('forms.importCsv')}</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="border-2 border-dashed border-slate-200 rounded-lg p-6 text-center">
              <Upload className="w-8 h-8 mx-auto text-slate-400 mb-2" />
              <p className="text-sm text-slate-600 mb-2">{t('companies.uploadCsvFile')}</p>
              <p className="text-xs text-slate-400 mb-3">{t('companies.importColumns')}</p>
              <input type="file" accept=".csv" onChange={handleImport} className="text-sm" />
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Detail / Edit */}
      <Dialog open={!!selectedCompany} onOpenChange={() => { setSelectedCompany(null); setEditMode(false); }}>
        <DialogContent className="max-w-lg">
          {selectedCompany && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center justify-between">
                  <span>{editMode ? t('forms.editCompany') : selectedCompany.name}</span>
                  {!editMode && <Button size="sm" variant="outline" onClick={() => setEditMode(true)}><Edit2 className="w-3.5 h-3.5 mr-1" />{t('common.edit')}</Button>}
                </DialogTitle>
              </DialogHeader>
              {editMode ? (
                <div className="space-y-3 pt-2">
                  {fields.map(f => (
                    <div key={f.key}><Label className="text-xs">{f.label}</Label><Input value={editData[f.key] || ''} onChange={e => setEditData({...editData, [f.key]: e.target.value})} /></div>
                  ))}
                  <div><Label className="text-xs">{t('forms.description')}</Label><Textarea value={editData.description || ''} onChange={e => setEditData({...editData, description: e.target.value})} rows={2} /></div>
                  <div className="flex gap-2 pt-2">
                    <Button onClick={handleSave} className="bg-[#0EA5A0] hover:bg-[#0B8C88] text-white"><Save className="w-4 h-4 mr-2" />{t('forms.saveChanges')}</Button>
                    <Button variant="outline" onClick={() => { setEditMode(false); setEditData({...selectedCompany}); }}>{t('common.cancel')}</Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4 pt-2">
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: t('forms.industry'), value: selectedCompany.industry, icon: <Building className="w-3.5 h-3.5 text-slate-400" /> },
                      { label: t('forms.website'), value: selectedCompany.website, icon: <Globe className="w-3.5 h-3.5 text-slate-400" />, link: true },
                      { label: t('forms.companySize'), value: selectedCompany.size, icon: <Users className="w-3.5 h-3.5 text-slate-400" /> },
                      { label: t('forms.location'), value: selectedCompany.location, icon: <MapPin className="w-3.5 h-3.5 text-slate-400" /> },
                    ].filter(f => f.value).map(f => (
                      <div key={f.label} className="bg-slate-50 rounded-lg p-3">
                        <p className="text-xs text-slate-500 flex items-center gap-1">{f.icon}{f.label}</p>
                        {f.link ? <a href={f.value.startsWith('http') ? f.value : `https://${f.value}`} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-[#0EA5A0] hover:underline truncate block">{f.value}</a>
                          : <p className="text-sm font-medium text-slate-900">{f.value}</p>}
                      </div>
                    ))}
                  </div>
                  {selectedCompany.description && (
                    <div className="bg-slate-50 rounded-lg p-3"><p className="text-xs text-slate-500 mb-1">{t('forms.description')}</p><p className="text-sm text-slate-700">{selectedCompany.description}</p></div>
                  )}
                  <Button size="sm" variant="outline" className="text-red-500" onClick={() => handleDelete(selectedCompany.company_id)}><Trash2 className="w-3.5 h-3.5 mr-1" />{t('common.delete')}</Button>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default CompaniesPage;
