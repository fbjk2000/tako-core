import React, { useState, useEffect } from 'react';
import { useAuth, API } from '../App';
import DashboardLayout from '../components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { toast } from 'sonner';
import axios from 'axios';
import {
  Plus, Radio, Eye, FileText, Zap, Pause, Play, Trash2,
  ExternalLink, CheckCircle, XCircle, Clock, AlertTriangle,
  RefreshCw, ChevronRight, Globe, Users, MessageSquare
} from 'lucide-react';

const classificationColors = {
  buying_signal: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  complaint: 'bg-rose-100 text-rose-700 border-rose-200',
  question: 'bg-blue-100 text-blue-700 border-blue-200',
  mention: 'bg-amber-100 text-amber-700 border-amber-200',
  noise: 'bg-slate-100 text-slate-500 border-slate-200',
};

const sentimentIcon = (s) => {
  if (s === 'positive') return <span className="text-emerald-500">▲</span>;
  if (s === 'negative') return <span className="text-rose-500">▼</span>;
  return <span className="text-slate-400">–</span>;
};

const confidenceBadge = (c) => {
  const pct = Math.round((c || 0) * 100);
  const col = pct >= 80 ? 'bg-emerald-100 text-emerald-700' : pct >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500';
  return <span className={`text-xs px-1.5 py-0.5 rounded ${col}`}>{pct}%</span>;
};

export default function ListenersPage() {
  const { token } = useAuth();
  const [listeners, setListeners] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [selectedListener, setSelectedListener] = useState(null);
  const [tab, setTab] = useState('sources');
  const [sources, setSources] = useState([]);
  const [hits, setHits] = useState([]);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [discovering, setDiscovering] = useState(false);
  const [generatingReport, setGeneratingReport] = useState(false);
  const [newListener, setNewListener] = useState({
    campaign_id: '', channel: 'facebook',
    config: {
      keywords: '', negative_keywords: '', personas: '',
      cadence: 'hourly', digest_cadence: 'daily', min_confidence: 0.7,
    }
  });

  const ax = () => ({ headers: { Authorization: `Bearer ${token}` }, withCredentials: true });

  useEffect(() => { if (!token) return; fetchListeners(); fetchCampaigns(); }, [token]); // eslint-disable-line

  useEffect(() => {
    if (!selectedListener) return;
    fetchSources(); fetchHits(); fetchReports();
  }, [selectedListener]); // eslint-disable-line

  const fetchListeners = async () => {
    try {
      const res = await axios.get(`${API}/listeners`, ax());
      setListeners(res.data || []);
    } catch { toast.error('Failed to load listeners'); }
    finally { setLoading(false); }
  };

  const fetchCampaigns = async () => {
    try {
      const res = await axios.get(`${API}/campaigns`, ax());
      setCampaigns((res.data || []).filter(c => c.channel_type === 'facebook' || c.channel_type === 'instagram' || c.channel_type === 'linkedin'));
    } catch {}
  };

  const fetchSources = async () => {
    if (!selectedListener) return;
    try {
      const res = await axios.get(`${API}/listeners/${selectedListener.listener_id}/sources`, ax());
      setSources(res.data || []);
    } catch {}
  };

  const fetchHits = async () => {
    if (!selectedListener) return;
    try {
      const res = await axios.get(`${API}/listeners/${selectedListener.listener_id}/hits`, ax());
      setHits(res.data || []);
    } catch {}
  };

  const fetchReports = async () => {
    if (!selectedListener) return;
    try {
      const res = await axios.get(`${API}/listeners/${selectedListener.listener_id}/reports`, ax());
      setReports(res.data || []);
    } catch {}
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      const cfg = {
        ...newListener.config,
        keywords: newListener.config.keywords.split(',').map(k => k.trim()).filter(Boolean),
        negative_keywords: newListener.config.negative_keywords.split(',').map(k => k.trim()).filter(Boolean),
        min_confidence: parseFloat(newListener.config.min_confidence),
      };
      await axios.post(`${API}/listeners`, { ...newListener, config: cfg }, ax());
      toast.success('Listener created');
      setIsAddOpen(false);
      setNewListener({ campaign_id: '', channel: 'facebook', config: { keywords: '', negative_keywords: '', personas: '', cadence: 'hourly', digest_cadence: 'daily', min_confidence: 0.7 } });
      fetchListeners();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed to create listener'); }
  };

  const handleToggle = async (listener) => {
    const newStatus = listener.status === 'active' ? 'paused' : 'active';
    try {
      await axios.patch(`${API}/listeners/${listener.listener_id}`, { status: newStatus }, ax());
      toast.success(`Listener ${newStatus}`);
      fetchListeners();
      if (selectedListener?.listener_id === listener.listener_id)
        setSelectedListener({ ...listener, status: newStatus });
    } catch { toast.error('Failed to update listener'); }
  };

  const handleDelete = async (listener) => {
    if (!window.confirm('Delete this listener?')) return;
    try {
      await axios.delete(`${API}/listeners/${listener.listener_id}`, ax());
      toast.success('Listener deleted');
      if (selectedListener?.listener_id === listener.listener_id) setSelectedListener(null);
      fetchListeners();
    } catch { toast.error('Failed'); }
  };

  const handleDiscover = async () => {
    if (!selectedListener) return;
    setDiscovering(true);
    try {
      const res = await axios.post(`${API}/listeners/${selectedListener.listener_id}/discover`, {}, ax());
      toast.success(res.data?.message || 'Discovery started — tasks created for review');
      fetchSources();
    } catch (err) { toast.error(err.response?.data?.detail || 'Discovery failed'); }
    finally { setDiscovering(false); }
  };

  const handleGenerateReport = async () => {
    if (!selectedListener) return;
    setGeneratingReport(true);
    try {
      await axios.post(`${API}/listeners/${selectedListener.listener_id}/reports/generate-now`, {}, ax());
      toast.success('Report generated');
      fetchReports();
    } catch (err) { toast.error(err.response?.data?.detail || 'Report failed'); }
    finally { setGeneratingReport(false); }
  };

  const handleSourceStatus = async (source, status) => {
    try {
      await axios.patch(`${API}/listeners/${selectedListener.listener_id}/sources/${source.source_id}`, { status }, ax());
      fetchSources();
    } catch { toast.error('Failed'); }
  };

  const handleCreateTask = async (hit) => {
    try {
      await axios.post(`${API}/listeners/${selectedListener.listener_id}/hits/${hit.hit_id}/create-task`, {}, ax());
      toast.success('Task created');
      fetchHits();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
  };

  const statusBadge = (status) => {
    if (status === 'active') return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 border text-xs">Active</Badge>;
    if (status === 'paused') return <Badge className="bg-amber-100 text-amber-700 border-amber-200 border text-xs">Paused</Badge>;
    return <Badge className="bg-slate-100 text-slate-500 border text-xs">{status}</Badge>;
  };

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Radio className="w-6 h-6 text-[#0EA5A0]" /> Listeners
            </h1>
            <p className="text-slate-500 text-sm mt-1">Monitor social channels for buying signals and mentions</p>
          </div>
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <Button className="bg-[#0EA5A0] hover:bg-[#0B8C88] text-white">
                <Plus className="w-4 h-4 mr-2" /> New Listener
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Create Listener</DialogTitle></DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4 pt-2">
                <div>
                  <Label>Campaign</Label>
                  <Select value={newListener.campaign_id} onValueChange={v => setNewListener({ ...newListener, campaign_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select a Facebook/social campaign" /></SelectTrigger>
                    <SelectContent>
                      {campaigns.length === 0
                        ? <SelectItem value="_none" disabled>No social campaigns — create one first</SelectItem>
                        : campaigns.map(c => <SelectItem key={c.campaign_id} value={c.campaign_id}>{c.name}</SelectItem>)
                      }
                    </SelectContent>
                  </Select>
                  {campaigns.length === 0 && (
                    <p className="text-xs text-amber-600 mt-1">Create a campaign with channel type "Facebook" first.</p>
                  )}
                </div>
                <div>
                  <Label>Channel</Label>
                  <Select value={newListener.channel} onValueChange={v => setNewListener({ ...newListener, channel: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="facebook">Facebook</SelectItem>
                      <SelectItem value="instagram" disabled>Instagram (coming soon)</SelectItem>
                      <SelectItem value="linkedin" disabled>LinkedIn (coming soon)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Keywords <span className="text-slate-400 font-normal">(comma-separated)</span></Label>
                  <Input value={newListener.config.keywords} onChange={e => setNewListener({ ...newListener, config: { ...newListener.config, keywords: e.target.value } })} placeholder="CRM, sales software, lead management" required />
                </div>
                <div>
                  <Label>Negative Keywords <span className="text-slate-400 font-normal">(optional)</span></Label>
                  <Input value={newListener.config.negative_keywords} onChange={e => setNewListener({ ...newListener, config: { ...newListener.config, negative_keywords: e.target.value } })} placeholder="free, open source, DIY" />
                </div>
                <div>
                  <Label>Persona Description <span className="text-slate-400 font-normal">(helps AI classify)</span></Label>
                  <Input value={newListener.config.personas} onChange={e => setNewListener({ ...newListener, config: { ...newListener.config, personas: e.target.value } })} placeholder="Small business owners looking for a CRM solution" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Poll Cadence</Label>
                    <Select value={newListener.config.cadence} onValueChange={v => setNewListener({ ...newListener, config: { ...newListener.config, cadence: v } })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="15min">Every 15 min</SelectItem>
                        <SelectItem value="hourly">Hourly</SelectItem>
                        <SelectItem value="daily">Daily</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Digest Cadence</Label>
                    <Select value={newListener.config.digest_cadence} onValueChange={v => setNewListener({ ...newListener, config: { ...newListener.config, digest_cadence: v } })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label>Min. Confidence for Auto-Task <span className="text-slate-400 font-normal">({Math.round(newListener.config.min_confidence * 100)}%)</span></Label>
                  <input type="range" min="0.3" max="1" step="0.05" value={newListener.config.min_confidence}
                    onChange={e => setNewListener({ ...newListener, config: { ...newListener.config, min_confidence: parseFloat(e.target.value) } })}
                    className="w-full mt-1" />
                </div>
                <Button type="submit" className="w-full bg-[#0EA5A0] hover:bg-[#0B8C88] text-white">Create Listener</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Listener List */}
          <div className="space-y-3">
            {loading && <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-[#0EA5A0] border-t-transparent rounded-full animate-spin" /></div>}
            {!loading && listeners.length === 0 && (
              <Card className="p-6 text-center text-slate-500">
                <Radio className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                <p className="text-sm">No listeners yet</p>
                <p className="text-xs mt-1">Create one to start monitoring social channels</p>
              </Card>
            )}
            {listeners.map(l => (
              <Card
                key={l.listener_id}
                className={`cursor-pointer transition-shadow hover:shadow-md ${selectedListener?.listener_id === l.listener_id ? 'ring-2 ring-[#0EA5A0]' : ''}`}
                onClick={() => { setSelectedListener(l); setTab('sources'); }}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        {statusBadge(l.status)}
                        <span className="text-xs text-slate-400 capitalize">{l.channel}</span>
                      </div>
                      <p className="font-medium text-sm text-slate-900 truncate">{l.campaign_name || l.campaign_id}</p>
                      <p className="text-xs text-slate-500 mt-1">
                        {(l.config?.keywords || []).slice(0, 3).join(', ')}
                        {(l.config?.keywords || []).length > 3 && ` +${l.config.keywords.length - 3}`}
                      </p>
                      {l.stats && (
                        <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
                          <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{l.stats.hits_total || 0} hits</span>
                          <span className="flex items-center gap-1"><CheckCircle className="w-3 h-3" />{l.stats.tasks_created || 0} tasks</span>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col gap-1 shrink-0">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={e => { e.stopPropagation(); handleToggle(l); }}>
                        {l.status === 'active' ? <Pause className="w-3.5 h-3.5 text-amber-500" /> : <Play className="w-3.5 h-3.5 text-emerald-500" />}
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={e => { e.stopPropagation(); handleDelete(l); }}>
                        <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Detail Panel */}
          <div className="lg:col-span-2">
            {!selectedListener ? (
              <Card className="h-64 flex items-center justify-center text-slate-400">
                <div className="text-center">
                  <ChevronRight className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                  <p className="text-sm">Select a listener to view details</p>
                </div>
              </Card>
            ) : (
              <Card>
                <CardHeader className="pb-3 border-b">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base">{selectedListener.campaign_name || selectedListener.campaign_id}</CardTitle>
                      <p className="text-xs text-slate-500 mt-0.5 capitalize">{selectedListener.channel} · {selectedListener.config?.cadence} polling · {statusBadge(selectedListener.status)}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={handleDiscover} disabled={discovering}>
                        {discovering ? <RefreshCw className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Globe className="w-3.5 h-3.5 mr-1" />}
                        Discover Groups
                      </Button>
                      <Button variant="outline" size="sm" onClick={handleGenerateReport} disabled={generatingReport}>
                        {generatingReport ? <RefreshCw className="w-3.5 h-3.5 mr-1 animate-spin" /> : <FileText className="w-3.5 h-3.5 mr-1" />}
                        Generate Report
                      </Button>
                    </div>
                  </div>
                  {/* Tabs */}
                  <div className="flex gap-1 mt-3">
                    {['sources', 'hits', 'reports'].map(t => (
                      <button key={t} onClick={() => setTab(t)}
                        className={`px-3 py-1.5 text-sm rounded-md capitalize transition-colors ${tab === t ? 'bg-[#0EA5A0] text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
                        {t === 'sources' && <Globe className="w-3.5 h-3.5 inline mr-1" />}
                        {t === 'hits' && <Zap className="w-3.5 h-3.5 inline mr-1" />}
                        {t === 'reports' && <FileText className="w-3.5 h-3.5 inline mr-1" />}
                        {t}
                        {t === 'hits' && hits.length > 0 && <span className="ml-1.5 bg-white/20 text-xs px-1 rounded">{hits.length}</span>}
                      </button>
                    ))}
                  </div>
                </CardHeader>
                <CardContent className="p-0">

                  {/* SOURCES TAB */}
                  {tab === 'sources' && (
                    <div className="divide-y">
                      {sources.length === 0 && (
                        <div className="p-8 text-center text-slate-400">
                          <Globe className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                          <p className="text-sm">No sources yet</p>
                          <p className="text-xs mt-1">Click "Discover Groups" to find relevant Facebook groups</p>
                        </div>
                      )}
                      {sources.map(src => (
                        <div key={src.source_id} className="flex items-center gap-3 px-4 py-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-sm text-slate-900 truncate">{src.name || src.url}</p>
                              {src.status === 'active' && <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" />}
                              {src.status === 'pending_review' && <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
                              {src.status === 'rejected' && <XCircle className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
                            </div>
                            <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-400">
                              <span className="capitalize">{src.type?.replace('_', ' ')}</span>
                              {src.discovered_by && <span>via {src.discovered_by}</span>}
                              {src.url && <a href={src.url} target="_blank" rel="noreferrer" className="text-[#0EA5A0] flex items-center gap-0.5" onClick={e => e.stopPropagation()}>View <ExternalLink className="w-2.5 h-2.5" /></a>}
                            </div>
                          </div>
                          <div className="flex gap-1 shrink-0">
                            {src.status !== 'active' && (
                              <Button variant="outline" size="sm" className="h-7 text-xs text-emerald-600 border-emerald-200" onClick={() => handleSourceStatus(src, 'active')}>
                                <CheckCircle className="w-3 h-3 mr-1" />Approve
                              </Button>
                            )}
                            {src.status === 'active' && (
                              <Button variant="outline" size="sm" className="h-7 text-xs text-rose-600 border-rose-200" onClick={() => handleSourceStatus(src, 'rejected')}>
                                <XCircle className="w-3 h-3 mr-1" />Reject
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* HITS TAB */}
                  {tab === 'hits' && (
                    <div className="divide-y">
                      {hits.length === 0 && (
                        <div className="p-8 text-center text-slate-400">
                          <Zap className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                          <p className="text-sm">No hits yet</p>
                          <p className="text-xs mt-1">Hits appear when the listener detects matching posts</p>
                        </div>
                      )}
                      {hits.map(hit => (
                        <div key={hit.hit_id} className={`px-4 py-3 ${hit.acted_on ? 'opacity-50' : ''}`}>
                          <div className="flex items-start gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap mb-1">
                                <span className={`text-xs px-2 py-0.5 rounded border capitalize ${classificationColors[hit.classification] || classificationColors.noise}`}>
                                  {hit.classification?.replace('_', ' ')}
                                </span>
                                {confidenceBadge(hit.confidence)}
                                {sentimentIcon(hit.sentiment)}
                                {hit.matched_keywords?.map(k => (
                                  <span key={k} className="text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">{k}</span>
                                ))}
                              </div>
                              <p className="text-sm text-slate-800 line-clamp-3">{hit.text}</p>
                              <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-400">
                                {hit.author?.name && <span className="flex items-center gap-1"><Users className="w-3 h-3" />{hit.author.name}</span>}
                                {hit.seen_at && <span>{new Date(hit.seen_at).toLocaleString()}</span>}
                                {hit.url && <a href={hit.url} target="_blank" rel="noreferrer" className="text-[#0EA5A0] flex items-center gap-0.5">Open post <ExternalLink className="w-2.5 h-2.5" /></a>}
                              </div>
                              {hit.suggested_reply && (
                                <div className="mt-2 p-2 bg-slate-50 rounded text-xs text-slate-600 border-l-2 border-[#0EA5A0]">
                                  <span className="font-medium text-[#0EA5A0]">Suggested reply: </span>{hit.suggested_reply}
                                </div>
                              )}
                            </div>
                            <div className="shrink-0">
                              {!hit.acted_on && !hit.related_task_id && (
                                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => handleCreateTask(hit)}>
                                  <CheckCircle className="w-3 h-3 mr-1" />Create Task
                                </Button>
                              )}
                              {hit.related_task_id && <span className="text-xs text-emerald-600 flex items-center gap-1"><CheckCircle className="w-3 h-3" />Task created</span>}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* REPORTS TAB */}
                  {tab === 'reports' && (
                    <div className="divide-y">
                      {reports.length === 0 && (
                        <div className="p-8 text-center text-slate-400">
                          <FileText className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                          <p className="text-sm">No reports yet</p>
                          <p className="text-xs mt-1">Click "Generate Report" for an AI digest of recent activity</p>
                        </div>
                      )}
                      {reports.map(r => (
                        <div key={r.report_id} className="px-4 py-4">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs text-slate-400">{r.generated_at ? new Date(r.generated_at).toLocaleString() : ''}</span>
                                <Badge className="text-xs bg-slate-100 text-slate-600">{r.period || 'custom'}</Badge>
                              </div>
                              <p className="text-sm font-medium text-slate-900 mb-2">{r.summary}</p>
                              {r.top_hits?.length > 0 && (
                                <div className="space-y-1">
                                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Top Hits</p>
                                  {r.top_hits.slice(0, 3).map((h, i) => (
                                    <div key={i} className="flex items-center gap-2 text-xs text-slate-600">
                                      <span className={`w-2 h-2 rounded-full ${h.classification === 'buying_signal' ? 'bg-emerald-400' : 'bg-slate-300'}`} />
                                      <span className="truncate">{h.text}</span>
                                      {h.url && <a href={h.url} target="_blank" rel="noreferrer"><ExternalLink className="w-2.5 h-2.5 text-[#0EA5A0]" /></a>}
                                    </div>
                                  ))}
                                </div>
                              )}
                              {r.recommended_actions?.length > 0 && (
                                <div className="mt-2 space-y-1">
                                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Recommendations</p>
                                  {r.recommended_actions.map((a, i) => (
                                    <p key={i} className="text-xs text-slate-600 flex items-start gap-1">
                                      <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0 mt-0.5" />{a}
                                    </p>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
