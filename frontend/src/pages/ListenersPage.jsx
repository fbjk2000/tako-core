import React, { useState, useEffect, useMemo } from 'react';
import { useAuth, API } from '../App';
import DashboardLayout from '../components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Switch } from '../components/ui/switch';
import { toast } from 'sonner';
import axios from 'axios';
import {
  Plus, Radar, Facebook, Pause, Play, Archive, RefreshCw,
  ExternalLink, CheckCircle2, CircleSlash, Clock, Sparkles,
  FileText, Search, AlertCircle, Link as LinkIcon
} from 'lucide-react';

// -------- Channel metadata (extensible when Instagram / LinkedIn ship) --------

const CHANNEL_META = {
  facebook: {
    label: 'Facebook',
    icon: Facebook,
    badge: 'bg-blue-100 text-blue-700',
    iconBg: 'bg-blue-50 text-blue-600',
  },
};

const CLASSIFICATION_META = {
  buying_signal: { label: 'Buying signal', color: 'bg-emerald-100 text-emerald-700' },
  question: { label: 'Question', color: 'bg-teal-100 text-teal-700' },
  complaint: { label: 'Complaint', color: 'bg-rose-100 text-rose-700' },
  mention: { label: 'Mention', color: 'bg-slate-100 text-slate-700' },
  noise: { label: 'Noise', color: 'bg-slate-100 text-slate-400' },
};

const SOURCE_STATUS_META = {
  pending_review: { label: 'Pending review', color: 'bg-amber-100 text-amber-700', icon: Clock },
  active: { label: 'Active', color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2 },
  rejected: { label: 'Rejected', color: 'bg-slate-100 text-slate-500', icon: CircleSlash },
};

const DEFAULT_CONFIG = {
  keywords: [],
  negative_keywords: [],
  personas: '',
  languages: ['en'],
  group_allowlist: [],
  group_blocklist: [],
  cadence: 'hourly',
  digest_cadence: 'weekly',
  quiet_hours: null,
  min_confidence: 0.7,
  auto_create_lead_on_buying_signal: false,
  default_assignee_id: null,
};

// Turn "kw1, kw2, kw3" into ["kw1","kw2","kw3"] and back.
const splitCsv = (s) => (s || '').split(',').map(x => x.trim()).filter(Boolean);
const joinCsv = (a) => (a || []).join(', ');

// -------- Main page --------

const ListenersPage = () => {
  const { token } = useAuth();
  const [listeners, setListeners] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedListener, setSelectedListener] = useState(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const headers = token ? { Authorization: `Bearer ${token}` } : {};

  useEffect(() => {
    if (!token) return;
    Promise.all([fetchListeners(), fetchCampaigns()]).finally(() => setLoading(false));
  }, [token]);

  const fetchListeners = async () => {
    try {
      const res = await axios.get(`${API}/listeners`, { headers, withCredentials: true });
      setListeners(res.data || []);
    } catch (err) {
      toast.error('Failed to load listeners');
    }
  };

  const fetchCampaigns = async () => {
    try {
      const res = await axios.get(`${API}/campaigns`, { headers, withCredentials: true });
      setCampaigns(res.data || []);
    } catch (err) {
      // Non-fatal — user can still see listeners list.
    }
  };

  const campaignName = (campaign_id) => campaigns.find(c => c.campaign_id === campaign_id)?.name || '—';

  const onListenerUpdated = (updated) => {
    setListeners(prev => prev.map(l => l.listener_id === updated.listener_id ? updated : l));
    if (selectedListener?.listener_id === updated.listener_id) setSelectedListener(updated);
  };

  const onListenerCreated = (created) => {
    setListeners(prev => [created, ...prev]);
    setIsCreateOpen(false);
    setSelectedListener(created);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6" data-testid="listeners-page">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900" data-testid="listeners-title">Listeners</h1>
            <p className="text-slate-600 mt-1">
              Monitor social channels for campaign-relevant conversations. Read-only — you always act manually.
            </p>
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => { fetchListeners(); toast.success('Refreshed'); }}
              data-testid="listeners-refresh"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button className="bg-[#0EA5A0] hover:bg-teal-700" data-testid="new-listener-btn">
                  <Plus className="w-4 h-4 mr-2" />
                  New Listener
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Create Listener</DialogTitle>
                </DialogHeader>
                <CreateListenerForm
                  campaigns={campaigns}
                  headers={headers}
                  onCreated={onListenerCreated}
                />
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-2 border-[#0EA5A0] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : listeners.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Radar className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-600 mb-2">No listeners yet</p>
              <p className="text-sm text-slate-500 mb-6">
                Create one to start monitoring Facebook Pages and Groups for a campaign.
              </p>
              <Button onClick={() => setIsCreateOpen(true)} className="bg-[#0EA5A0] hover:bg-teal-700">
                Create your first listener
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4" data-testid="listeners-list">
            {listeners.map((listener) => (
              <ListenerCard
                key={listener.listener_id}
                listener={listener}
                campaignName={campaignName(listener.campaign_id)}
                onOpen={() => setSelectedListener(listener)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Detail dialog */}
      {selectedListener && (
        <ListenerDetailDialog
          listener={selectedListener}
          campaignName={campaignName(selectedListener.campaign_id)}
          headers={headers}
          onClose={() => setSelectedListener(null)}
          onUpdated={onListenerUpdated}
        />
      )}
    </DashboardLayout>
  );
};

// -------- List card --------

const ListenerCard = ({ listener, campaignName, onOpen }) => {
  const channel = CHANNEL_META[listener.channel] || CHANNEL_META.facebook;
  const Icon = channel.icon;
  const stats = listener.stats || {};

  return (
    <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={onOpen} data-testid={`listener-card-${listener.listener_id}`}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${channel.iconBg}`}>
              <Icon className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold text-slate-900 truncate">
                  {campaignName} · {channel.label}
                </h3>
                <StatusBadge status={listener.status} />
              </div>
              <p className="text-sm text-slate-500 truncate">
                {listener.config?.keywords?.length
                  ? `Watching: ${listener.config.keywords.slice(0, 4).join(', ')}${listener.config.keywords.length > 4 ? '…' : ''}`
                  : 'No keywords configured yet'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-6 text-sm text-slate-500 shrink-0">
            <Stat label="Hits" value={stats.hits_total ?? 0} />
            <Stat label="Tasks" value={stats.tasks_created ?? 0} />
            <Stat
              label="Last poll"
              value={stats.last_poll_at ? relTime(stats.last_poll_at) : '—'}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const Stat = ({ label, value }) => (
  <div className="text-center">
    <div className="font-semibold text-slate-900">{value}</div>
    <div className="text-xs">{label}</div>
  </div>
);

const StatusBadge = ({ status }) => {
  const map = {
    active: 'bg-emerald-100 text-emerald-700',
    paused: 'bg-amber-100 text-amber-700',
    archived: 'bg-slate-100 text-slate-500',
  };
  return <span className={`text-xs px-2 py-1 rounded-full capitalize ${map[status] || map.archived}`}>{status}</span>;
};

const relTime = (iso) => {
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  } catch { return '—'; }
};

// -------- Detail dialog with tabs --------

const ListenerDetailDialog = ({ listener, campaignName, headers, onClose, onUpdated }) => {
  const channel = CHANNEL_META[listener.channel] || CHANNEL_META.facebook;

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <channel.icon className="w-5 h-5 text-blue-600" />
            {campaignName} · {channel.label}
            <StatusBadge status={listener.status} />
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="hits" className="mt-2">
          <TabsList>
            <TabsTrigger value="hits" data-testid="tab-hits">Hits</TabsTrigger>
            <TabsTrigger value="sources" data-testid="tab-sources">Sources</TabsTrigger>
            <TabsTrigger value="reports" data-testid="tab-reports">Reports</TabsTrigger>
            <TabsTrigger value="settings" data-testid="tab-settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="hits" className="pt-4">
            <HitsTab listener={listener} headers={headers} />
          </TabsContent>
          <TabsContent value="sources" className="pt-4">
            <SourcesTab listener={listener} headers={headers} onListenerUpdated={onUpdated} />
          </TabsContent>
          <TabsContent value="reports" className="pt-4">
            <ReportsTab listener={listener} headers={headers} />
          </TabsContent>
          <TabsContent value="settings" className="pt-4">
            <SettingsTab
              listener={listener}
              headers={headers}
              onListenerUpdated={onUpdated}
              onClose={onClose}
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

// -------- Hits tab --------

const HitsTab = ({ listener, headers }) => {
  const [hits, setHits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ classification: 'all', acted: 'all' });

  const reload = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filter.classification !== 'all') params.classification = filter.classification;
      if (filter.acted !== 'all') params.acted_on = filter.acted === 'yes';
      params.limit = 100;
      const res = await axios.get(`${API}/listeners/${listener.listener_id}/hits`, {
        headers, withCredentials: true, params,
      });
      setHits(res.data || []);
    } catch (err) {
      toast.error('Failed to load hits');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { reload(); /* eslint-disable-next-line */ }, [filter.classification, filter.acted]);

  const createTask = async (hit) => {
    try {
      const res = await axios.post(
        `${API}/listeners/${listener.listener_id}/hits/${hit.hit_id}/create-task`,
        {},
        { headers, withCredentials: true }
      );
      toast.success(`Task created${res.data.task_id ? ` (${res.data.task_id})` : ''}`);
      reload();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to create task');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <Select value={filter.classification} onValueChange={(v) => setFilter(f => ({ ...f, classification: v }))}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All classifications</SelectItem>
            <SelectItem value="buying_signal">Buying signal</SelectItem>
            <SelectItem value="question">Question</SelectItem>
            <SelectItem value="complaint">Complaint</SelectItem>
            <SelectItem value="mention">Mention</SelectItem>
            <SelectItem value="noise">Noise</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filter.acted} onValueChange={(v) => setFilter(f => ({ ...f, acted: v }))}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All hits</SelectItem>
            <SelectItem value="no">Unactioned</SelectItem>
            <SelectItem value="yes">Acted on</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={reload}>
          <RefreshCw className="w-4 h-4 mr-2" /> Refresh
        </Button>
      </div>

      {loading ? (
        <div className="py-12 flex justify-center">
          <div className="w-6 h-6 border-2 border-[#0EA5A0] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : hits.length === 0 ? (
        <div className="py-12 text-center text-sm text-slate-500">
          <Search className="w-8 h-8 text-slate-300 mx-auto mb-3" />
          No hits yet. Listener will fill this up as it polls its sources.
        </div>
      ) : (
        <div className="space-y-2" data-testid="hits-list">
          {hits.map((hit) => (
            <HitRow key={hit.hit_id} hit={hit} onCreateTask={() => createTask(hit)} />
          ))}
        </div>
      )}
    </div>
  );
};

const HitRow = ({ hit, onCreateTask }) => {
  const cls = CLASSIFICATION_META[hit.classification] || CLASSIFICATION_META.mention;
  return (
    <Card className="hover:shadow-sm transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2 text-sm">
              <span className={`text-xs px-2 py-1 rounded-full ${cls.color}`}>{cls.label}</span>
              {typeof hit.confidence === 'number' && (
                <span className="text-xs text-slate-500">conf {(hit.confidence * 100).toFixed(0)}%</span>
              )}
              {hit.sentiment && (
                <span className="text-xs text-slate-400 capitalize">· {hit.sentiment}</span>
              )}
              <span className="text-xs text-slate-400 ml-auto">{relTime(hit.seen_at)}</span>
            </div>
            <p className="text-sm text-slate-900 font-medium truncate">{hit.author?.name || 'Unknown author'}</p>
            <p className="text-sm text-slate-600 whitespace-pre-wrap line-clamp-3 mt-1">{hit.text}</p>
            {hit.matched_keywords?.length > 0 && (
              <div className="flex gap-1 mt-2 flex-wrap">
                {hit.matched_keywords.slice(0, 6).map((kw, i) => (
                  <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">{kw}</span>
                ))}
              </div>
            )}
            {hit.suggested_reply && (
              <div className="mt-3 p-3 rounded-lg bg-teal-50/50 border border-teal-100 text-sm text-slate-700">
                <div className="text-xs font-medium text-teal-700 mb-1 flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> Suggested reply
                </div>
                {hit.suggested_reply}
              </div>
            )}
          </div>
          <div className="flex flex-col gap-2 shrink-0">
            <a href={hit.url} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm" className="w-full">
                <ExternalLink className="w-3 h-3 mr-2" /> Open on FB
              </Button>
            </a>
            {hit.related_task_id ? (
              <Badge variant="outline" className="justify-center text-xs">Task created</Badge>
            ) : (
              <Button size="sm" className="bg-[#0EA5A0] hover:bg-teal-700" onClick={onCreateTask}>
                Create task
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// -------- Sources tab --------

const SourcesTab = ({ listener, headers, onListenerUpdated }) => {
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [discoverLoading, setDiscoverLoading] = useState(false);
  const [newSource, setNewSource] = useState({ type: 'fb_page', url: '', name: '' });

  const reload = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/listeners/${listener.listener_id}/sources`, { headers, withCredentials: true });
      setSources(res.data || []);
    } catch (err) {
      toast.error('Failed to load sources');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { reload(); /* eslint-disable-next-line */ }, [listener.listener_id]);

  const addSource = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/listeners/${listener.listener_id}/sources`, newSource, { headers, withCredentials: true });
      toast.success('Source added');
      setIsAddOpen(false);
      setNewSource({ type: 'fb_page', url: '', name: '' });
      reload();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to add source');
    }
  };

  const updateStatus = async (source_id, status) => {
    try {
      await axios.patch(
        `${API}/listeners/${listener.listener_id}/sources/${source_id}`,
        { status },
        { headers, withCredentials: true }
      );
      reload();
    } catch (err) {
      toast.error('Failed to update source');
    }
  };

  const deleteSource = async (source_id) => {
    if (!window.confirm('Remove this source?')) return;
    try {
      await axios.delete(`${API}/listeners/${listener.listener_id}/sources/${source_id}`, { headers, withCredentials: true });
      reload();
    } catch (err) {
      toast.error('Failed to delete source');
    }
  };

  const runDiscovery = async () => {
    setDiscoverLoading(true);
    try {
      const res = await axios.post(`${API}/listeners/${listener.listener_id}/discover`, {}, { headers, withCredentials: true });
      toast.success(`Discovered ${res.data?.discovered ?? 0} candidates`);
      reload();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Discovery failed');
    } finally {
      setDiscoverLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="bg-[#0EA5A0] hover:bg-teal-700">
              <Plus className="w-4 h-4 mr-2" /> Add source
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add source</DialogTitle></DialogHeader>
            <form onSubmit={addSource} className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>Type *</Label>
                <Select value={newSource.type} onValueChange={(v) => setNewSource({ ...newSource, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fb_page">Facebook Page</SelectItem>
                    <SelectItem value="fb_group">Facebook Group</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>URL *</Label>
                <Input
                  value={newSource.url}
                  onChange={(e) => setNewSource({ ...newSource, url: e.target.value })}
                  placeholder="https://www.facebook.com/groups/..."
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Name (optional)</Label>
                <Input
                  value={newSource.name}
                  onChange={(e) => setNewSource({ ...newSource, name: e.target.value })}
                  placeholder="Display name shown in Tako"
                />
              </div>
              {newSource.type === 'fb_group' && (
                <p className="text-xs text-slate-500 flex items-start gap-2">
                  <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" />
                  Groups are read via the Tako Chrome extension. Install it (Settings → Integrations) and
                  visit the group once to start ingesting posts. Nothing is posted on your behalf.
                </p>
              )}
              <Button type="submit" className="w-full bg-[#0EA5A0] hover:bg-teal-700">Add source</Button>
            </form>
          </DialogContent>
        </Dialog>

        <Button variant="outline" size="sm" onClick={runDiscovery} disabled={discoverLoading}>
          <Sparkles className={`w-4 h-4 mr-2 ${discoverLoading ? 'animate-pulse' : ''}`} />
          {discoverLoading ? 'Discovering…' : 'Run discovery'}
        </Button>
      </div>

      {loading ? (
        <div className="py-8 flex justify-center">
          <div className="w-6 h-6 border-2 border-[#0EA5A0] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : sources.length === 0 ? (
        <div className="py-8 text-center text-sm text-slate-500">
          No sources yet. Add Pages/Groups manually, or run discovery to generate candidates.
        </div>
      ) : (
        <div className="space-y-2">
          {sources.map((source) => {
            const meta = SOURCE_STATUS_META[source.status] || SOURCE_STATUS_META.pending_review;
            const StatusIcon = meta.icon;
            return (
              <Card key={source.source_id} className="hover:shadow-sm">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    source.type === 'fb_group' ? 'bg-purple-50 text-purple-600' : 'bg-blue-50 text-blue-600'
                  }`}>
                    <Facebook className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-slate-900 truncate">{source.name || source.url}</p>
                      <Badge variant="outline" className="text-[10px]">
                        {source.type === 'fb_group' ? 'Group' : 'Page'}
                      </Badge>
                      {source.discovered_by === 'discover_agent' && (
                        <Badge variant="outline" className="text-[10px] text-teal-700 border-teal-300">
                          AI-suggested
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                      <span className={`px-2 py-0.5 rounded-full flex items-center gap-1 ${meta.color}`}>
                        <StatusIcon className="w-3 h-3" /> {meta.label}
                      </span>
                      {source.last_scanned_at && <span>· scanned {relTime(source.last_scanned_at)}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <a href={source.url} target="_blank" rel="noopener noreferrer">
                      <Button variant="ghost" size="icon" className="h-8 w-8"><LinkIcon className="w-4 h-4" /></Button>
                    </a>
                    {source.status === 'pending_review' && (
                      <>
                        <Button size="sm" variant="outline" onClick={() => updateStatus(source.source_id, 'active')}>
                          Approve
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => updateStatus(source.source_id, 'rejected')}>
                          Reject
                        </Button>
                      </>
                    )}
                    {source.status === 'active' && (
                      <Button size="sm" variant="ghost" onClick={() => updateStatus(source.source_id, 'pending_review')}>
                        Pause
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" className="text-rose-600" onClick={() => deleteSource(source.source_id)}>
                      Remove
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

// -------- Reports tab --------

const ReportsTab = ({ listener, headers }) => {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [openReport, setOpenReport] = useState(null);

  const reload = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/listeners/${listener.listener_id}/reports`, { headers, withCredentials: true });
      setReports(res.data || []);
    } catch (err) {
      toast.error('Failed to load reports');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { reload(); /* eslint-disable-next-line */ }, [listener.listener_id]);

  const generateNow = async () => {
    setGenerating(true);
    try {
      const res = await axios.post(`${API}/listeners/${listener.listener_id}/reports/generate-now?days=7`, {}, { headers, withCredentials: true });
      toast.success('Report generated');
      setOpenReport(res.data);
      reload();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to generate report');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-slate-500">
          Digests summarize recent hits and trends. Delivered on the cadence configured in Settings.
        </p>
        <Button size="sm" variant="outline" onClick={generateNow} disabled={generating}>
          <Sparkles className={`w-4 h-4 mr-2 ${generating ? 'animate-pulse' : ''}`} />
          {generating ? 'Generating…' : 'Generate now (7d)'}
        </Button>
      </div>

      {loading ? (
        <div className="py-8 flex justify-center">
          <div className="w-6 h-6 border-2 border-[#0EA5A0] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : reports.length === 0 ? (
        <div className="py-8 text-center text-sm text-slate-500">
          <FileText className="w-8 h-8 text-slate-300 mx-auto mb-3" />
          No reports yet.
        </div>
      ) : (
        <div className="space-y-2">
          {reports.map((r) => (
            <Card key={r.report_id} className="cursor-pointer hover:shadow-sm" onClick={() => setOpenReport(r)}>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-slate-900">
                    {new Date(r.period_start).toLocaleDateString()} – {new Date(r.period_end).toLocaleDateString()}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    {r.summary?.total_hits ?? 0} hits · {r.summary?.high_confidence_hits ?? 0} high-confidence
                  </p>
                </div>
                <Button variant="ghost" size="sm">Open</Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {openReport && (
        <Dialog open={true} onOpenChange={(o) => !o && setOpenReport(null)}>
          <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                Report · {new Date(openReport.period_start).toLocaleDateString()} – {new Date(openReport.period_end).toLocaleDateString()}
              </DialogTitle>
            </DialogHeader>
            <pre className="whitespace-pre-wrap text-sm text-slate-700 font-sans leading-relaxed">
              {openReport.body_markdown || '(empty)'}
            </pre>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

// -------- Settings tab --------

const SettingsTab = ({ listener, headers, onListenerUpdated, onClose }) => {
  const [config, setConfig] = useState(listener.config || DEFAULT_CONFIG);
  const [keywordsStr, setKeywordsStr] = useState(joinCsv(listener.config?.keywords));
  const [negStr, setNegStr] = useState(joinCsv(listener.config?.negative_keywords));
  const [langStr, setLangStr] = useState(joinCsv(listener.config?.languages) || 'en');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const payload = {
        config: {
          ...config,
          keywords: splitCsv(keywordsStr),
          negative_keywords: splitCsv(negStr),
          languages: splitCsv(langStr),
        },
      };
      const res = await axios.patch(`${API}/listeners/${listener.listener_id}`, payload, { headers, withCredentials: true });
      toast.success('Listener updated');
      onListenerUpdated(res.data);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to update listener');
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (status) => {
    try {
      const res = await axios.patch(`${API}/listeners/${listener.listener_id}`, { status }, { headers, withCredentials: true });
      toast.success(`Listener ${status}`);
      onListenerUpdated(res.data);
    } catch (err) {
      toast.error('Failed to update status');
    }
  };

  const archive = async () => {
    if (!window.confirm('Archive this listener? Polling will stop. You can still view past hits.')) return;
    try {
      await axios.delete(`${API}/listeners/${listener.listener_id}`, { headers, withCredentials: true });
      toast.success('Listener archived');
      onClose();
    } catch (err) {
      toast.error('Failed to archive');
    }
  };

  return (
    <div className="space-y-6">
      {/* Status controls */}
      <div className="flex gap-2">
        {listener.status !== 'active' && (
          <Button size="sm" variant="outline" onClick={() => updateStatus('active')}>
            <Play className="w-4 h-4 mr-2" /> Activate
          </Button>
        )}
        {listener.status === 'active' && (
          <Button size="sm" variant="outline" onClick={() => updateStatus('paused')}>
            <Pause className="w-4 h-4 mr-2" /> Pause
          </Button>
        )}
        {listener.status !== 'archived' && (
          <Button size="sm" variant="ghost" className="text-rose-600" onClick={archive}>
            <Archive className="w-4 h-4 mr-2" /> Archive
          </Button>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-2 md:col-span-2">
          <Label>Keywords *</Label>
          <Input value={keywordsStr} onChange={(e) => setKeywordsStr(e.target.value)} placeholder="crm, sales tool, pipeline" />
          <p className="text-xs text-slate-500">Comma-separated. Case-insensitive.</p>
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label>Negative keywords</Label>
          <Input value={negStr} onChange={(e) => setNegStr(e.target.value)} placeholder="recipe, meme" />
          <p className="text-xs text-slate-500">Hits containing these are dropped before classification.</p>
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label>Target persona</Label>
          <Textarea
            rows={3}
            value={config.personas}
            onChange={(e) => setConfig({ ...config, personas: e.target.value })}
            placeholder="Small-agency founders looking for a lightweight CRM; budget-sensitive; DIY-inclined."
          />
          <p className="text-xs text-slate-500">Used by the classifier to score fit.</p>
        </div>
        <div className="space-y-2">
          <Label>Languages</Label>
          <Input value={langStr} onChange={(e) => setLangStr(e.target.value)} placeholder="en, de" />
        </div>
        <div className="space-y-2">
          <Label>Min confidence for auto-task</Label>
          <Input
            type="number"
            min="0" max="1" step="0.05"
            value={config.min_confidence}
            onChange={(e) => setConfig({ ...config, min_confidence: parseFloat(e.target.value) || 0 })}
          />
        </div>
        <div className="space-y-2">
          <Label>Poll cadence</Label>
          <Select value={config.cadence} onValueChange={(v) => setConfig({ ...config, cadence: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="15min">Every 15 minutes</SelectItem>
              <SelectItem value="hourly">Hourly</SelectItem>
              <SelectItem value="daily">Daily</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Digest cadence</Label>
          <Select value={config.digest_cadence} onValueChange={(v) => setConfig({ ...config, digest_cadence: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">Daily</SelectItem>
              <SelectItem value="weekly">Weekly</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="md:col-span-2 flex items-center justify-between p-3 rounded-lg border">
          <div>
            <p className="text-sm font-medium text-slate-900">Auto-create Lead on buying signal</p>
            <p className="text-xs text-slate-500">Requires a dedupe key; off by default.</p>
          </div>
          <Switch
            checked={!!config.auto_create_lead_on_buying_signal}
            onCheckedChange={(v) => setConfig({ ...config, auto_create_lead_on_buying_signal: v })}
          />
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button className="bg-[#0EA5A0] hover:bg-teal-700" onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save changes'}
        </Button>
      </div>
    </div>
  );
};

// -------- Create listener form --------

const CreateListenerForm = ({ campaigns, headers, onCreated }) => {
  const [campaign_id, setCampaignId] = useState('');
  const [channel, setChannel] = useState('facebook');
  const [keywords, setKeywords] = useState('');
  const [personas, setPersonas] = useState('');
  const [saving, setSaving] = useState(false);

  // Prefer campaigns with channel != email (they're listener-native).
  const availableCampaigns = useMemo(
    () => campaigns.filter(c => !c.channel_type || c.channel_type === 'email' || c.channel_type === channel),
    [campaigns, channel]
  );

  const submit = async (e) => {
    e.preventDefault();
    if (!campaign_id) { toast.error('Pick a campaign'); return; }
    setSaving(true);
    try {
      const payload = {
        campaign_id,
        channel,
        config: {
          ...DEFAULT_CONFIG,
          keywords: splitCsv(keywords),
          personas,
        },
      };
      const res = await axios.post(`${API}/listeners`, payload, { headers, withCredentials: true });
      toast.success('Listener created');
      onCreated(res.data);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to create listener');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4 pt-2">
      <div className="space-y-2">
        <Label>Campaign *</Label>
        <Select value={campaign_id} onValueChange={setCampaignId}>
          <SelectTrigger><SelectValue placeholder="Select a campaign" /></SelectTrigger>
          <SelectContent>
            {availableCampaigns.length === 0 ? (
              <SelectItem value="__none__" disabled>No campaigns yet — create one first</SelectItem>
            ) : availableCampaigns.map(c => (
              <SelectItem key={c.campaign_id} value={c.campaign_id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Channel *</Label>
        <Select value={channel} onValueChange={setChannel}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="facebook">Facebook</SelectItem>
            {/* Instagram / LinkedIn reserved for future phases */}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Keywords *</Label>
        <Input value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder="crm, sales tool, pipeline" required />
        <p className="text-xs text-slate-500">Comma-separated. You can refine later.</p>
      </div>
      <div className="space-y-2">
        <Label>Target persona</Label>
        <Textarea rows={3} value={personas} onChange={(e) => setPersonas(e.target.value)} placeholder="Small-agency founders looking for a lightweight CRM..." />
      </div>
      <Button type="submit" className="w-full bg-[#0EA5A0] hover:bg-teal-700" disabled={saving}>
        {saving ? 'Creating…' : 'Create listener'}
      </Button>
    </form>
  );
};

export default ListenersPage;
