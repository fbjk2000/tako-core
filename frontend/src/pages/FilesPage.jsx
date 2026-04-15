import { useT } from '../useT';
import React, { useState, useEffect, useRef } from 'react';
import { useAuth, API } from '../App';
import DashboardLayout from '../components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { toast } from 'sonner';
import axios from 'axios';
import { Upload, Search, Trash2, Download, Zap, CheckSquare, X } from 'lucide-react';

const FilesPage = () => {
  const { token } = useAuth();
  const { t } = useT();
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [uploading, setUploading] = useState(false);
  const [linkedType, setLinkedType] = useState('none');
  const [linkedId, setLinkedId] = useState('none');
  const [description, setDescription] = useState('');
  const [entities, setEntities] = useState({ leads: [], contacts: [], companies: [], deals: [], projects: [], campaigns: [] });
  const fileRef = useRef(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadOpen, setUploadOpen] = useState(false);

  const getCfg = () => ({ headers: { Authorization: `Bearer ${token}` }, withCredentials: true });

  useEffect(() => {
    if (!token) { setLoading(false); return; }
    fetchFiles();
    fetchEntities();
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchFiles = async () => {
    try { const r = await axios.get(`${API}/files`, getCfg()); setFiles(r.data || []); }
    catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const fetchEntities = async () => {
    try {
      const cfg = getCfg();
      const results = await Promise.allSettled([
        axios.get(`${API}/leads`, cfg), axios.get(`${API}/contacts`, cfg), axios.get(`${API}/companies`, cfg),
        axios.get(`${API}/deals`, cfg), axios.get(`${API}/projects`, cfg), axios.get(`${API}/campaigns`, cfg)
      ]);
      const [leads, contacts, companies, deals, projects, campaigns] = results.map(r => r.status === 'fulfilled' ? r.value.data || [] : []);
      setEntities({ leads, contacts, companies, deals, projects, campaigns });
    } catch (err) { console.error(err); }
  };

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    const params = new URLSearchParams();
    if (linkedType && linkedType !== 'none') params.set('linked_type', linkedType);
    if (linkedId && linkedId !== 'none') params.set('linked_id', linkedId);
    if (description) params.set('description', description);
    try {
      const res = await axios.post(`${API}/files/upload?${params}`, formData, { headers: { Authorization: `Bearer ${token}` }, withCredentials: true, timeout: 60000 });
      toast.success('File uploaded');
      if (res.data.ai_summary) toast.success(`AI: ${res.data.ai_summary.summary?.slice(0, 80)}...`);
      fetchFiles();
      setDescription('');
      setLinkedType('none');
      setLinkedId('none');
      setUploadOpen(false);
      if (fileRef.current) fileRef.current.value = '';
    } catch (err) { console.error(err); toast.error(err.response?.data?.detail || 'Upload failed'); }
    finally { setUploading(false); }
  };

  const handleDelete = async (fileId) => {
    try { await axios.delete(`${API}/files/${fileId}`, getCfg()); toast.success('Deleted'); fetchFiles(); }
    catch (err) { console.error(err); toast.error('Failed'); }
  };

  const handleCreateTasks = async (fileId) => {
    try {
      const res = await axios.post(`${API}/files/${fileId}/create-tasks`, {}, getCfg());
      toast.success(`${res.data.tasks_created} tasks created`);
    } catch (err) { console.error(err); toast.error(err.response?.data?.detail || 'Failed'); }
  };

  const formatSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  const filtered = files.filter(f => f.original_name?.toLowerCase().includes(searchQuery.toLowerCase()) || f.description?.toLowerCase().includes(searchQuery.toLowerCase()));

  const entityOptions = linkedType === 'lead' ? entities.leads.map(l => ({ id: l.lead_id, label: `${l.first_name} ${l.last_name}` }))
    : linkedType === 'contact' ? entities.contacts.map(c => ({ id: c.contact_id, label: `${c.first_name} ${c.last_name}` }))
    : linkedType === 'company' ? entities.companies.map(c => ({ id: c.company_id, label: c.name }))
    : linkedType === 'deal' ? entities.deals.map(d => ({ id: d.deal_id, label: d.name }))
    : linkedType === 'project' ? entities.projects.map(p => ({ id: p.project_id, label: p.name }))
    : linkedType === 'campaign' ? entities.campaigns.map(c => ({ id: c.campaign_id, label: c.name || c.subject }))
    : [];

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6" data-testid="files-page">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Files</h1>
            <p className="text-slate-500 text-sm mt-1">Upload, manage, and link files to your CRM records</p>
          </div>
          {files.length > 0 && (
            <Button className="bg-[#0EA5A0] hover:bg-[#0B8C88] text-white" onClick={() => setUploadOpen(true)} data-testid="upload-file-btn">
              <Upload className="w-4 h-4 mr-2" /> Upload File
            </Button>
          )}
        </div>

        <input ref={fileRef} type="file" onChange={handleUpload} className="hidden" />

        {/* Upload Dialog */}
        <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Upload a file</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 pt-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Link to type</Label>
                  <Select value={linkedType} onValueChange={v => { setLinkedType(v); setLinkedId('none'); }}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="lead">Lead</SelectItem>
                      <SelectItem value="contact">Contact</SelectItem>
                      <SelectItem value="company">Company</SelectItem>
                      <SelectItem value="deal">Deal</SelectItem>
                      <SelectItem value="project">Project</SelectItem>
                      <SelectItem value="campaign">Campaign</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {linkedType !== 'none' && (
                  <div>
                    <Label className="text-xs">Select record</Label>
                    <Select value={linkedId} onValueChange={setLinkedId}>
                      <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {entityOptions.map(e => <SelectItem key={e.id} value={e.id}>{e.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
              <div>
                <Label className="text-xs">Description</Label>
                <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Optional — what's in this file?" />
              </div>
              <Button
                className="w-full bg-[#0EA5A0] hover:bg-[#0B8C88] text-white"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? 'Uploading…' : <><Upload className="w-4 h-4 mr-2" /> Choose file and upload</>}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {files.length > 0 && (
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input placeholder="Search files..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-10" />
          </div>
        )}

        {/* File List */}
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-8 text-center"><div className="w-6 h-6 border-2 border-[#0EA5A0] border-t-transparent rounded-full animate-spin mx-auto" /></div>
            ) : filtered.length === 0 ? (
              <div className="p-10 text-center text-slate-500">
                <Upload className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                <p className="font-medium text-slate-700">
                  {files.length === 0 ? 'No files yet' : 'No files match your search'}
                </p>
                <p className="text-sm mt-1 max-w-md mx-auto">
                  {files.length === 0
                    ? 'Upload PDFs, images or documents and link them to leads, deals, or projects. AI will summarise and suggest follow-up tasks.'
                    : 'Try a different search term.'}
                </p>
                {files.length === 0 && (
                  <Button className="mt-4 bg-[#0EA5A0] hover:bg-[#0B8C88] text-white" onClick={() => setUploadOpen(true)} data-testid="empty-upload-btn">
                    <Upload className="w-4 h-4 mr-2" /> Upload your first file
                  </Button>
                )}
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead><tr className="border-b bg-slate-50">
                  <th className="py-3 px-4 text-left text-xs font-medium text-slate-500">File</th>
                  <th className="py-3 px-4 text-left text-xs font-medium text-slate-500">Linked To</th>
                  <th className="py-3 px-4 text-left text-xs font-medium text-slate-500">Size</th>
                  <th className="py-3 px-4 text-left text-xs font-medium text-slate-500">AI Summary</th>
                  <th className="py-3 px-4 text-left text-xs font-medium text-slate-500">Uploaded</th>
                  <th className="py-3 px-4 w-28"></th>
                </tr></thead>
                <tbody>
                  {filtered.map(f => (
                    <tr key={f.file_id} className="border-b border-slate-50 hover:bg-slate-50 cursor-pointer" onClick={() => setSelectedFile(f)}>
                      <td className="py-3 px-4">
                        <p className="font-medium truncate max-w-[200px]">{f.original_name}</p>
                        {f.description && <p className="text-xs text-slate-400">{f.description}</p>}
                      </td>
                      <td className="py-3 px-4">
                        {f.linked_type ? <Badge variant="secondary" className="text-xs">{f.linked_type}</Badge> : <span className="text-slate-400">-</span>}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-500">{formatSize(f.size)}</td>
                      <td className="py-3 px-4 text-xs text-slate-600 max-w-[200px] truncate">{f.ai_summary?.summary || '-'}</td>
                      <td className="py-3 px-4 text-xs text-slate-400">{f.uploaded_by_name}<br/>{new Date(f.created_at).toLocaleDateString()}</td>
                      <td className="py-3 px-4">
                        <div className="flex gap-1">
                          <a href={`${API}/files/${f.file_id}/download`} target="_blank" rel="noopener noreferrer"><Button variant="ghost" size="sm" className="h-7 w-7 p-0"><Download className="w-3.5 h-3.5" /></Button></a>
                          {f.ai_summary?.follow_ups?.length > 0 && (
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-[#0EA5A0]" onClick={() => handleCreateTasks(f.file_id)} title="Create follow-up tasks"><CheckSquare className="w-3.5 h-3.5" /></Button>
                          )}
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500" onClick={() => handleDelete(f.file_id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>
      {/* File Detail Dialog */}
      <Dialog open={!!selectedFile} onOpenChange={() => setSelectedFile(null)}>
        <DialogContent className="max-w-lg">
          {selectedFile && (
            <>
              <DialogHeader>
                <DialogTitle className="truncate">{selectedFile.original_name}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 pt-2">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-50 rounded-lg p-3"><p className="text-xs text-slate-500">Size</p><p className="text-sm font-medium">{formatSize(selectedFile.size)}</p></div>
                  <div className="bg-slate-50 rounded-lg p-3"><p className="text-xs text-slate-500">Type</p><p className="text-sm font-medium">{selectedFile.content_type || 'Unknown'}</p></div>
                  <div className="bg-slate-50 rounded-lg p-3"><p className="text-xs text-slate-500">Uploaded by</p><p className="text-sm font-medium">{selectedFile.uploaded_by_name}</p></div>
                  <div className="bg-slate-50 rounded-lg p-3"><p className="text-xs text-slate-500">Date</p><p className="text-sm font-medium">{new Date(selectedFile.created_at).toLocaleString()}</p></div>
                </div>
                {selectedFile.linked_type && <div className="bg-slate-50 rounded-lg p-3"><p className="text-xs text-slate-500">Linked to</p><Badge variant="secondary">{selectedFile.linked_type}: {selectedFile.linked_id}</Badge></div>}
                {selectedFile.description && <div className="bg-slate-50 rounded-lg p-3"><p className="text-xs text-slate-500 mb-1">Description</p><p className="text-sm text-slate-700">{selectedFile.description}</p></div>}
                {selectedFile.ai_summary && (
                  <div className="bg-teal-50 rounded-lg p-4 border border-teal-100 space-y-2">
                    <p className="text-sm font-medium text-teal-900 flex items-center gap-1"><Zap className="w-4 h-4" /> AI Summary</p>
                    <p className="text-sm text-slate-700">{selectedFile.ai_summary.summary}</p>
                    {selectedFile.ai_summary.follow_ups?.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-teal-700 mb-1">Suggested follow-ups</p>
                        {selectedFile.ai_summary.follow_ups.map((fu, i) => (
                          <div key={i} className="flex items-center justify-between text-xs py-1 border-b border-teal-100 last:border-0">
                            <span className="text-slate-700">{fu.title}</span>
                            <span className={`px-1.5 py-0.5 rounded ${fu.priority === 'high' ? 'bg-red-100 text-red-700' : fu.priority === 'medium' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>{fu.priority}</span>
                          </div>
                        ))}
                        <Button size="sm" className="mt-2 bg-[#0EA5A0] hover:bg-[#0B8C88] text-white" onClick={() => { handleCreateTasks(selectedFile.file_id); setSelectedFile(null); }}>
                          <CheckSquare className="w-3.5 h-3.5 mr-1" /> Create these tasks
                        </Button>
                      </div>
                    )}
                  </div>
                )}
                <div className="flex gap-2 pt-1">
                  <a href={`${API}/files/${selectedFile.file_id}/download`} target="_blank" rel="noopener noreferrer"><Button variant="outline" size="sm"><Download className="w-3.5 h-3.5 mr-1" /> Download</Button></a>
                  <Button variant="outline" size="sm" className="text-red-500" onClick={() => { handleDelete(selectedFile.file_id); setSelectedFile(null); }}><Trash2 className="w-3.5 h-3.5 mr-1" /> Delete</Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default FilesPage;
