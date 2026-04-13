import { useT } from '../useT';
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth, API } from '../App';
import DashboardLayout from '../components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Calendar } from '../components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover';
import { Badge } from '../components/ui/badge';
import { toast } from 'sonner';
import axios from 'axios';
import {
  Phone,
  PhoneCall,
  PhoneOff,
  Clock,
  Search,
  Sparkles,
  ChevronRight,
  ArrowUpRight,
  TrendingUp,
  Mic,
  User,
  AlertCircle,
  CalendarDays,
  Bell,
  X,
  Edit2,
  Trash2,
  CalendarPlus,
  MapPin
} from 'lucide-react';

const CallsPage = () => {
  const { token } = useAuth();
  const [calls, setCalls] = useState([]);
  const { t } = useT();
  const [leads, setLeads] = useState([]);
  const [stats, setStats] = useState(null);
  const [scheduledCalls, setScheduledCalls] = useState([]);
  const [upcomingCalls, setUpcomingCalls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('history');

  // Call dialog
  const [showCallDialog, setShowCallDialog] = useState(false);
  const [selectedLead, setSelectedLead] = useState(null);
  const [callMessage, setCallMessage] = useState('Thank you for your interest');
  const [calling, setCalling] = useState(false);

  // Schedule dialog
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [schedLead, setSchedLead] = useState(null);
  const [schedDate, setSchedDate] = useState(null);
  const [schedTime, setSchedTime] = useState('10:00');
  const [schedNotes, setSchedNotes] = useState('');
  const [schedReminder, setSchedReminder] = useState('15');
  const [scheduling, setScheduling] = useState(false);

  // Edit schedule dialog
  const [editingSchedule, setEditingSchedule] = useState(null);
  const [editDate, setEditDate] = useState(null);
  const [editTime, setEditTime] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editReminder, setEditReminder] = useState('15');

  // Call detail
  const [selectedCall, setSelectedCall] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [twilioConfigured, setTwilioConfigured] = useState(true);

  const headers = token ? { Authorization: `Bearer ${token}` } : {};

  const fetchCalls = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/calls`, { headers });
      setCalls(res.data);
    } catch (err) {
      if (err.response?.status === 503) setTwilioConfigured(false);
    }
  }, [token]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/calls/stats/overview`, { headers });
      setStats(res.data);
    } catch (err) { console.error(err); }
  }, [token]);

  const fetchLeads = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/leads`, { headers });
      setLeads(res.data);
    } catch (err) { console.error(err); }
  }, [token]);

  const fetchScheduled = useCallback(async () => {
    try {
      const [schedRes, upRes] = await Promise.all([
        axios.get(`${API}/calls/scheduled?status=scheduled`, { headers }),
        axios.get(`${API}/calls/scheduled/upcoming`, { headers })
      ]);
      setScheduledCalls(schedRes.data);
      setUpcomingCalls(upRes.data);
    } catch (err) { console.error(err); }
  }, [token]);

  const checkReminders = useCallback(async () => {
    try {
      await axios.post(`${API}/calls/scheduled/check-reminders`, {}, { headers });
    } catch (err) { console.error(err); }
  }, [token]);

  useEffect(() => {
    Promise.all([fetchCalls(), fetchStats(), fetchLeads(), fetchScheduled()]).finally(() => setLoading(false));
  }, [fetchCalls, fetchStats, fetchLeads, fetchScheduled]);

  // Check reminders every 60 seconds
  useEffect(() => {
    checkReminders();
    const interval = setInterval(checkReminders, 60000);
    return () => clearInterval(interval);
  }, [checkReminders]);

  const initiateCall = async () => {
    if (!selectedLead) return;
    setCalling(true);
    try {
      const res = await axios.post(`${API}/calls/initiate`, {
        lead_id: selectedLead, message: callMessage
      }, { headers });
      toast.success(`Call initiated to ${res.data.to}`);
      setShowCallDialog(false);
      setSelectedLead(null);
      fetchCalls();
      fetchStats();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to initiate call');
    } finally { setCalling(false); }
  };

  const scheduleCall = async () => {
    if (!schedLead || !schedDate) return;
    setScheduling(true);
    try {
      const [hours, mins] = schedTime.split(':');
      const dt = new Date(schedDate);
      dt.setHours(parseInt(hours), parseInt(mins), 0, 0);
      const res = await axios.post(`${API}/calls/schedule`, {
        lead_id: schedLead,
        scheduled_at: dt.toISOString(),
        notes: schedNotes || null,
        reminder_minutes: parseInt(schedReminder)
      }, { headers });
      toast.success(`Call scheduled with ${res.data.lead_name}`);
      setShowScheduleDialog(false);
      resetScheduleForm();
      fetchScheduled();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to schedule call');
    } finally { setScheduling(false); }
  };

  const updateSchedule = async () => {
    if (!editingSchedule) return;
    try {
      const updates = { notes: editNotes, reminder_minutes: parseInt(editReminder) };
      if (editDate && editTime) {
        const [h, m] = editTime.split(':');
        const dt = new Date(editDate);
        dt.setHours(parseInt(h), parseInt(m), 0, 0);
        updates.scheduled_at = dt.toISOString();
      }
      await axios.put(`${API}/calls/scheduled/${editingSchedule.schedule_id}`, updates, { headers });
      toast.success('Schedule updated');
      setEditingSchedule(null);
      fetchScheduled();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to update');
    }
  };

  const cancelSchedule = async (id) => {
    try {
      await axios.delete(`${API}/calls/scheduled/${id}`, { headers });
      toast.success('Call cancelled');
      fetchScheduled();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to cancel');
    }
  };

  const markComplete = async (id) => {
    try {
      await axios.put(`${API}/calls/scheduled/${id}`, { status: 'completed' }, { headers });
      toast.success('Marked as completed');
      fetchScheduled();
    } catch (err) { console.error(err); }
  };

  const analyzeCall = async (callId) => {
    setAnalyzing(true);
    try {
      const res = await axios.post(`${API}/calls/${callId}/analyze`, {}, { headers });
      toast.success('Call analysis complete');
      setSelectedCall({ ...selectedCall, ai_analysis: res.data.analysis });
      fetchCalls();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Analysis failed');
    } finally { setAnalyzing(false); }
  };

  const resetScheduleForm = () => {
    setSchedLead(null);
    setSchedDate(null);
    setSchedTime('10:00');
    setSchedNotes('');
    setSchedReminder('15');
  };

  const openEditSchedule = (sc) => {
    setEditingSchedule(sc);
    const dt = new Date(sc.scheduled_at);
    setEditDate(dt);
    setEditTime(`${dt.getHours().toString().padStart(2, '0')}:${dt.getMinutes().toString().padStart(2, '0')}`);
    setEditNotes(sc.notes || '');
    setEditReminder(String(sc.reminder_minutes || 15));
  };

  const formatDuration = (s) => {
    if (!s) return '0:00';
    return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
  };

  const formatDateTime = (iso) => {
    const d = new Date(iso);
    return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const isToday = (iso) => {
    const d = new Date(iso);
    const now = new Date();
    return d.toDateString() === now.toDateString();
  };

  const isTomorrow = (iso) => {
    const d = new Date(iso);
    const tmr = new Date();
    tmr.setDate(tmr.getDate() + 1);
    return d.toDateString() === tmr.toDateString();
  };

  const getDayLabel = (iso) => {
    if (isToday(iso)) return 'Today';
    if (isTomorrow(iso)) return 'Tomorrow';
    return new Date(iso).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const statusColors = {
    completed: 'bg-emerald-100 text-emerald-700',
    'in-progress': 'bg-blue-100 text-blue-700',
    ringing: 'bg-amber-100 text-amber-700',
    queued: 'bg-slate-100 text-slate-600',
    initiated: 'bg-blue-100 text-blue-700',
    failed: 'bg-red-100 text-red-700',
  };

  const filteredCalls = calls.filter(c =>
    c.lead_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.to_number?.includes(searchQuery)
  );

  const filteredScheduled = scheduledCalls.filter(sc =>
    sc.lead_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const leadsWithPhone = leads.filter(l => l.phone);
  const timeSlots = Array.from({ length: 28 }, (_, i) => {
    const h = Math.floor(i / 2) + 7;
    const m = i % 2 === 0 ? '00' : '30';
    return `${h.toString().padStart(2, '0')}:${m}`;
  });

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6" data-testid="calls-page">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900" data-testid="calls-page-title">Calls</h1>
            <p className="text-slate-500 text-sm mt-1">Outbound calling, scheduling & AI analysis</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => setShowScheduleDialog(true)} variant="outline" data-testid="schedule-call-btn">
              <CalendarPlus className="w-4 h-4 mr-2" /> Schedule Call
            </Button>
            <Button onClick={() => setShowCallDialog(true)} className="bg-[#0EA5A0] hover:bg-teal-700" data-testid="new-call-btn">
              <Phone className="w-4 h-4 mr-2" /> Call Now
            </Button>
          </div>
        </div>

        {!twilioConfigured && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3" data-testid="twilio-not-configured">
            <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
            <div>
              <p className="font-medium text-amber-800">Twilio not configured</p>
              <p className="text-sm text-amber-600 mt-1">Add your Twilio credentials to enable outbound calling. Scheduling still works.</p>
            </div>
          </div>
        )}

        {/* Upcoming Calls Banner */}
        {upcomingCalls.length > 0 && (
          <Card className="border-[#0EA5A0]/20 bg-teal-50/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Bell className="w-4 h-4 text-[#0EA5A0]" />
                <span className="font-semibold text-sm text-slate-800">Upcoming Calls</span>
                <Badge variant="secondary" className="ml-1">{upcomingCalls.length}</Badge>
              </div>
              <div className="flex gap-3 overflow-x-auto pb-1">
                {upcomingCalls.slice(0, 5).map(sc => (
                  <div key={sc.schedule_id} className="flex-shrink-0 bg-white rounded-lg p-3 border border-slate-100 min-w-[200px]" data-testid={`upcoming-${sc.schedule_id}`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${isToday(sc.scheduled_at) ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                        {getDayLabel(sc.scheduled_at)}
                      </span>
                      <span className="text-xs text-slate-500">
                        {new Date(sc.scheduled_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="font-medium text-sm text-slate-900 truncate">{sc.lead_name}</p>
                    {sc.lead_company && <p className="text-xs text-slate-500 truncate">{sc.lead_company}</p>}
                    {sc.notes && <p className="text-xs text-slate-400 truncate mt-1">{sc.notes}</p>}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            {[
              { label: 'Total Calls', value: stats.total_calls, icon: <Phone className="w-5 h-5 text-[#0EA5A0]" />, bg: 'bg-teal-100', testId: 'stat-total-calls' },
              { label: 'Completed', value: stats.completed_calls, icon: <PhoneCall className="w-5 h-5 text-emerald-600" />, bg: 'bg-emerald-100', testId: 'stat-completed' },
              { label: 'Avg Duration', value: formatDuration(Math.round(stats.avg_duration_seconds)), icon: <Clock className="w-5 h-5 text-blue-600" />, bg: 'bg-blue-100', testId: 'stat-avg-duration' },
              { label: 'AI Analyzed', value: stats.analyzed_calls, icon: <Sparkles className="w-5 h-5 text-amber-600" />, bg: 'bg-amber-100', testId: 'stat-analyzed' },
              { label: 'Scheduled', value: scheduledCalls.length, icon: <CalendarDays className="w-5 h-5 text-teal-600" />, bg: 'bg-teal-100', testId: 'stat-scheduled' },
            ].map(s => (
              <Card key={s.label}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg ${s.bg} flex items-center justify-center`}>{s.icon}</div>
                    <div>
                      <p className="text-2xl font-bold text-slate-900" data-testid={s.testId}>{s.value}</p>
                      <p className="text-xs text-slate-500">{s.label}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input placeholder={t('common.search')} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" data-testid="calls-search" />
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="history" data-testid="tab-history">
              Call History {calls.length > 0 && <Badge variant="secondary" className="ml-1.5 text-xs">{calls.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="scheduled" data-testid="tab-scheduled">
              Scheduled {scheduledCalls.length > 0 && <Badge variant="secondary" className="ml-1.5 text-xs">{scheduledCalls.length}</Badge>}
            </TabsTrigger>
          </TabsList>

          {/* Call History Tab */}
          <TabsContent value="history">
            <Card>
              <CardContent className="pt-4">
                {loading ? (
                  <div className="flex justify-center py-12">
                    <div className="w-6 h-6 border-2 border-[#0EA5A0] border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : filteredCalls.length === 0 ? (
                  <div className="text-center py-12 text-slate-500">
                    <Phone className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                    <p className="font-medium">No calls yet</p>
                    <p className="text-sm mt-1">Start making outbound calls to your leads</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredCalls.map(call => (
                      <div key={call.call_id} className="flex items-center justify-between p-3 rounded-lg border border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors" onClick={() => setSelectedCall(call)} data-testid={`call-row-${call.call_id}`}>
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                            {call.status === 'completed' ? <PhoneCall className="w-4 h-4 text-emerald-600" /> : call.status === 'failed' ? <PhoneOff className="w-4 h-4 text-red-500" /> : <Phone className="w-4 h-4 text-slate-500" />}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-slate-900 text-sm truncate">{call.lead_name || 'Unknown'}</p>
                            <p className="text-xs text-slate-500">{call.to_number}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 shrink-0">
                          <span className={`text-xs px-2 py-1 rounded-full ${statusColors[call.status] || 'bg-slate-100 text-slate-600'}`}>{call.status}</span>
                          <span className="text-xs text-slate-500 w-12 text-right">{formatDuration(call.duration)}</span>
                          {call.recording_url && <Mic className="w-4 h-4 text-[#0EA5A0]" />}
                          {call.ai_analysis && <Sparkles className="w-4 h-4 text-amber-500" />}
                          <ChevronRight className="w-4 h-4 text-slate-300" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Scheduled Tab */}
          <TabsContent value="scheduled">
            <Card>
              <CardContent className="pt-4">
                {filteredScheduled.length === 0 ? (
                  <div className="text-center py-12 text-slate-500">
                    <CalendarDays className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                    <p className="font-medium">No scheduled calls</p>
                    <p className="text-sm mt-1">Schedule calls with your leads to stay organized</p>
                    <Button onClick={() => setShowScheduleDialog(true)} className="mt-4 bg-[#0EA5A0] hover:bg-teal-700" data-testid="schedule-empty-btn">
                      <CalendarPlus className="w-4 h-4 mr-2" /> Schedule a Call
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredScheduled.map(sc => {
                      const isPast = new Date(sc.scheduled_at) < new Date();
                      return (
                        <div key={sc.schedule_id} className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${isPast ? 'border-amber-200 bg-amber-50/50' : 'border-slate-100 hover:bg-slate-50'}`} data-testid={`sched-row-${sc.schedule_id}`}>
                          <div className="flex items-center gap-3 min-w-0">
                            <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${isToday(sc.scheduled_at) ? 'bg-red-100' : 'bg-teal-100'}`}>
                              <CalendarDays className={`w-4 h-4 ${isToday(sc.scheduled_at) ? 'text-red-600' : 'text-[#0EA5A0]'}`} />
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium text-slate-900 text-sm truncate">{sc.lead_name}</p>
                              <div className="flex items-center gap-2 text-xs text-slate-500">
                                <span className={`font-medium ${isToday(sc.scheduled_at) ? 'text-red-600' : ''}`}>{getDayLabel(sc.scheduled_at)}</span>
                                <span>{new Date(sc.scheduled_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</span>
                                {sc.lead_company && <span className="truncate">| {sc.lead_company}</span>}
                              </div>
                              {sc.notes && <p className="text-xs text-slate-400 truncate mt-0.5">{sc.notes}</p>}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {sc.reminder_sent && <Bell className="w-3.5 h-3.5 text-amber-500" title="Reminder sent" />}
                            {isPast && (
                              <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => markComplete(sc.schedule_id)} data-testid={`complete-${sc.schedule_id}`}>
                                Done
                              </Button>
                            )}
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openEditSchedule(sc)}>
                              <Edit2 className="w-3.5 h-3.5 text-slate-400" />
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => cancelSchedule(sc.schedule_id)}>
                              <Trash2 className="w-3.5 h-3.5 text-slate-400 hover:text-red-500" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Schedule Call Dialog */}
        <Dialog open={showScheduleDialog} onOpenChange={(open) => { setShowScheduleDialog(open); if (!open) resetScheduleForm(); }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><CalendarPlus className="w-5 h-5 text-[#0EA5A0]" /> Schedule Call</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1.5 block">Lead</label>
                <Select value={schedLead || ''} onValueChange={setSchedLead}>
                  <SelectTrigger data-testid="sched-lead-select"><SelectValue placeholder="Select a lead" /></SelectTrigger>
                  <SelectContent>
                    {leads.map(l => (
                      <SelectItem key={l.lead_id} value={l.lead_id}>
                        {l.first_name} {l.last_name} {l.phone ? `(${l.phone})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1.5 block">Date</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal" data-testid="sched-date-btn">
                      <CalendarDays className="w-4 h-4 mr-2 text-slate-400" />
                      {schedDate ? schedDate.toLocaleDateString(undefined, { weekday: 'short', month: 'long', day: 'numeric' }) : 'Pick a date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={schedDate} onSelect={setSchedDate} disabled={(d) => d < new Date(new Date().setHours(0,0,0,0))} initialFocus />
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1.5 block">Time</label>
                <Select value={schedTime} onValueChange={setSchedTime}>
                  <SelectTrigger data-testid="sched-time-select"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {timeSlots.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1.5 block">Reminder</label>
                <Select value={schedReminder} onValueChange={setSchedReminder}>
                  <SelectTrigger data-testid="sched-reminder-select"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">5 min before</SelectItem>
                    <SelectItem value="15">15 min before</SelectItem>
                    <SelectItem value="30">30 min before</SelectItem>
                    <SelectItem value="60">1 hour before</SelectItem>
                    <SelectItem value="1440">1 day before</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1.5 block">Notes (optional)</label>
                <Textarea value={schedNotes} onChange={(e) => setSchedNotes(e.target.value)} placeholder="Talking points, goals..." rows={2} data-testid="sched-notes" />
              </div>
              <Button onClick={scheduleCall} disabled={!schedLead || !schedDate || scheduling} className="w-full bg-[#0EA5A0] hover:bg-teal-700" data-testid="confirm-schedule-btn">
                {scheduling ? <span className="flex items-center gap-2"><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Scheduling...</span> :
                  <span className="flex items-center gap-2"><CalendarPlus className="w-4 h-4" /> Schedule Call</span>}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit Schedule Dialog */}
        <Dialog open={!!editingSchedule} onOpenChange={() => setEditingSchedule(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><Edit2 className="w-5 h-5 text-[#0EA5A0]" /> Edit Schedule</DialogTitle>
            </DialogHeader>
            {editingSchedule && (
              <div className="space-y-4 pt-2">
                <div className="bg-slate-50 rounded-lg p-3">
                  <p className="font-medium text-sm">{editingSchedule.lead_name}</p>
                  {editingSchedule.lead_phone && <p className="text-xs text-slate-500">{editingSchedule.lead_phone}</p>}
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-1.5 block">Date</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left font-normal">
                        <CalendarDays className="w-4 h-4 mr-2 text-slate-400" />
                        {editDate ? editDate.toLocaleDateString(undefined, { weekday: 'short', month: 'long', day: 'numeric' }) : 'Pick a date'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={editDate} onSelect={setEditDate} disabled={(d) => d < new Date(new Date().setHours(0,0,0,0))} initialFocus />
                    </PopoverContent>
                  </Popover>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-1.5 block">Time</label>
                  <Select value={editTime} onValueChange={setEditTime}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{timeSlots.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-1.5 block">Reminder</label>
                  <Select value={editReminder} onValueChange={setEditReminder}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5">5 min before</SelectItem>
                      <SelectItem value="15">15 min before</SelectItem>
                      <SelectItem value="30">30 min before</SelectItem>
                      <SelectItem value="60">1 hour before</SelectItem>
                      <SelectItem value="1440">1 day before</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-1.5 block">Notes</label>
                  <Textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)} placeholder="Talking points, goals..." rows={2} />
                </div>
                <Button onClick={updateSchedule} className="w-full bg-[#0EA5A0] hover:bg-teal-700">
                  Save Changes
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Immediate Call Dialog */}
        <Dialog open={showCallDialog} onOpenChange={setShowCallDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>{ t('calls.newCall') }</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1.5 block">Select Lead</label>
                <Select value={selectedLead || ''} onValueChange={setSelectedLead}>
                  <SelectTrigger data-testid="call-lead-select"><SelectValue placeholder="Choose a lead with phone number" /></SelectTrigger>
                  <SelectContent>
                    {leadsWithPhone.map(l => (
                      <SelectItem key={l.lead_id} value={l.lead_id}>
                        <span className="flex items-center gap-2"><User className="w-3 h-3" /> {l.first_name} {l.last_name} — {l.phone}</span>
                      </SelectItem>
                    ))}
                    {leadsWithPhone.length === 0 && <div className="p-3 text-sm text-slate-500 text-center">No leads with phone numbers</div>}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1.5 block">Opening Message</label>
                <Input value={callMessage} onChange={(e) => setCallMessage(e.target.value)} placeholder="Message to play when call connects" data-testid="call-message-input" />
              </div>
              <Button onClick={initiateCall} disabled={!selectedLead || calling} className="w-full bg-[#0EA5A0] hover:bg-teal-700" data-testid="initiate-call-btn">
                {calling ? <span className="flex items-center gap-2"><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Calling...</span> :
                  <span className="flex items-center gap-2"><Phone className="w-4 h-4" /> Make Call</span>}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Call Detail Dialog */}
        <Dialog open={!!selectedCall} onOpenChange={() => setSelectedCall(null)}>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            {selectedCall && (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2"><PhoneCall className="w-5 h-5 text-[#0EA5A0]" /> Call Details</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: 'Lead', value: selectedCall.lead_name || 'Unknown' },
                      { label: 'Phone', value: selectedCall.to_number },
                      { label: 'Duration', value: formatDuration(selectedCall.duration) },
                      { label: 'Status', value: selectedCall.status, badge: true },
                      { label: 'Called By', value: selectedCall.initiated_by_name },
                      { label: 'Date', value: new Date(selectedCall.created_at).toLocaleString() },
                    ].map(item => (
                      <div key={item.label} className="bg-slate-50 rounded-lg p-3">
                        <p className="text-xs text-slate-500">{item.label}</p>
                        {item.badge ? <span className={`text-xs px-2 py-1 rounded-full ${statusColors[item.value] || 'bg-slate-100'}`}>{item.value}</span> : <p className="font-medium text-sm">{item.value}</p>}
                      </div>
                    ))}
                  </div>
                  {selectedCall.recording_url && (
                    <div className="bg-teal-50 rounded-lg p-4 border border-teal-100">
                      <p className="text-sm font-medium text-teal-900 mb-2 flex items-center gap-2"><Mic className="w-4 h-4" /> Recording</p>
                      <audio controls className="w-full" data-testid="call-recording-player"><source src={`${selectedCall.recording_url}.mp3`} type="audio/mpeg" /></audio>
                    </div>
                  )}
                  {/* Transcription */}
                  {selectedCall.transcription && (
                    <div className="bg-blue-50 rounded-lg p-4 border border-blue-100 space-y-2" data-testid="call-transcription">
                      <p className="text-sm font-medium text-blue-900 flex items-center gap-2"><Mic className="w-4 h-4" /> Transcription</p>
                      <p className="text-sm text-slate-700">{selectedCall.transcription.transcript_summary}</p>
                      {selectedCall.transcription.key_points?.length > 0 && (
                        <div><p className="text-xs font-medium text-blue-700 mb-1">Key Points</p>
                          <ul className="space-y-1">{selectedCall.transcription.key_points.map((p, i) => <li key={i} className="text-xs text-slate-600">- {p}</li>)}</ul>
                        </div>
                      )}
                      {selectedCall.transcription.action_items?.length > 0 && (
                        <div><p className="text-xs font-medium text-emerald-700 mb-1">Follow-up Tasks (auto-created)</p>
                          <ul className="space-y-1">{selectedCall.transcription.action_items.map((a, i) => <li key={i} className="text-xs text-slate-600">- {a.title} ({a.priority})</li>)}</ul>
                        </div>
                      )}
                    </div>
                  )}
                  {selectedCall.ai_analysis ? (
                    <div className="bg-amber-50 rounded-lg p-4 border border-amber-100 space-y-3" data-testid="call-analysis">
                      <p className="text-sm font-medium text-amber-900 flex items-center gap-2"><Sparkles className="w-4 h-4" /> AI Analysis <span className="ml-auto text-lg font-bold">{selectedCall.ai_analysis.score}/10</span></p>
                      <p className="text-sm text-slate-700">{selectedCall.ai_analysis.summary}</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <p className="text-xs font-medium text-emerald-700 mb-1">Strengths</p>
                          <ul className="space-y-1">{selectedCall.ai_analysis.strengths?.map((s, i) => <li key={i} className="text-xs text-slate-600 flex items-start gap-1"><TrendingUp className="w-3 h-3 text-emerald-500 mt-0.5 shrink-0" /> {s}</li>)}</ul>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-orange-700 mb-1">Improvements</p>
                          <ul className="space-y-1">{selectedCall.ai_analysis.improvements?.map((s, i) => <li key={i} className="text-xs text-slate-600 flex items-start gap-1"><ArrowUpRight className="w-3 h-3 text-orange-500 mt-0.5 shrink-0" /> {s}</li>)}</ul>
                        </div>
                      </div>
                      {selectedCall.ai_analysis.next_steps && (
                        <div>
                          <p className="text-xs font-medium text-blue-700 mb-1">Next Steps</p>
                          <ul className="space-y-1">{selectedCall.ai_analysis.next_steps?.map((s, i) => <li key={i} className="text-xs text-slate-600">- {s}</li>)}</ul>
                        </div>
                      )}
                    </div>
                  ) : selectedCall.recording_url ? (
                    <div className="space-y-2">
                      <Button onClick={() => analyzeCall(selectedCall.call_id)} disabled={analyzing} className="w-full bg-amber-500 hover:bg-amber-600 text-white" data-testid="analyze-call-btn">
                        {analyzing ? <span className="flex items-center gap-2"><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Analyzing...</span> :
                          <span className="flex items-center gap-2"><Sparkles className="w-4 h-4" /> Analyze with AI</span>}
                      </Button>
                      <Button onClick={async () => {
                        try {
                          const res = await axios.post(`${API}/calls/${selectedCall.call_id}/transcribe`, {}, { headers });
                          toast.success(`Transcribed! ${res.data.tasks_created} follow-up tasks created`);
                          setSelectedCall(prev => ({ ...prev, transcription: res.data.transcription }));
                          fetchCalls();
                        } catch (e) { toast.error(e.response?.data?.detail || 'Transcription failed'); }
                      }} className="w-full bg-blue-500 hover:bg-blue-600 text-white" data-testid="transcribe-call-btn">
                        <span className="flex items-center gap-2"><Mic className="w-4 h-4" /> Transcribe + Create Follow-ups</span>
                      </Button>
                    </div>
                  ) : null}
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default CallsPage;
