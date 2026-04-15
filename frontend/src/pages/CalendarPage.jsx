import { useT } from '../useT';
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useAuth, API } from '../App';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../components/layout/DashboardLayout';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Badge } from '../components/ui/badge';
import { Switch } from '../components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { toast } from 'sonner';
import axios from 'axios';
import {
  ChevronLeft, ChevronRight, Plus, X, Clock, Users, Video, ExternalLink,
  MapPin, AlignLeft, User as UserIcon, RefreshCw, Calendar as CalendarIcon,
} from 'lucide-react';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const ALL_HOURS = Array.from({ length: 24 }, (_, i) => i);

// How often to poll for remote changes while the tab is visible
const POLL_INTERVAL_MS = 30_000;

// Visual height per hour in time-grid views
const HOUR_PX = 64;

const TYPE_COLORS = {
  call: '#0EA5A0',
  task: '#f59e0b',
  deal: '#6366f1',
  event: '#0C1024',
  google: '#4285f4',
  team: '#94a3b8',
};

const CalendarPage = () => {
  const { token } = useAuth();
  const navigate = useNavigate();
  const { t } = useT();

  // Data
  const [events, setEvents] = useState([]);           // combined list (tako + google)
  const [teamEvents, setTeamEvents] = useState([]);
  const [linkableEntities, setLinkableEntities] = useState({ leads: [], contacts: [], companies: [], deals: [], projects: [], campaigns: [] });

  // Loading state
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  // View state
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState('week');           // 'day' | 'week' | 'month'
  const [hourStart, setHourStart] = useState(7);
  const [hourEnd, setHourEnd] = useState(22);
  const HOURS = ALL_HOURS.slice(hourStart, hourEnd);

  // Dialogs
  const [showCreate, setShowCreate] = useState(false);
  const [showTeam, setShowTeam] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [editingEvent, setEditingEvent] = useState(false);
  const [editEventData, setEditEventData] = useState({});
  const [inviteEmails, setInviteEmails] = useState('');

  // Create form
  const [newEvent, setNewEvent] = useState({
    title: '', date: '', end_date: '', notes: '', location: '', invitees: '',
    blocks_booking: true, linked_type: '', linked_id: '',
    destination: 'tako',   // 'tako' | 'google'
    all_day: false,
  });

  // Google connection
  const [googleConnected, setGoogleConnected] = useState(false);

  // Now-indicator ticker (rerender once per minute so the line moves)
  const [nowTick, setNowTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setNowTick(x => x + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const getCfg = useCallback(() => ({
    headers: { Authorization: `Bearer ${token}` },
    withCredentials: true,
  }), [token]);

  // ---- Data loading ---------------------------------------------------------

  // Atomic load: wait for both fetches, then set state once. Avoids the race
  // condition where the google result was appended before the tako result
  // overwrote it.
  const loadAllEvents = useCallback(async () => {
    if (!token) return;
    const cfg = getCfg();
    const [tako, google] = await Promise.allSettled([
      axios.get(`${API}/calendar/events`, cfg),
      axios.get(`${API}/calendar/google/events`, cfg),
    ]);
    const takoList = tako.status === 'fulfilled' && Array.isArray(tako.value.data) ? tako.value.data : [];
    const googleList = google.status === 'fulfilled' && Array.isArray(google.value.data) ? google.value.data : [];
    setEvents([...takoList, ...googleList]);
  }, [token, getCfg]);

  const initialLoad = useCallback(async () => {
    if (!token) { setLoading(false); return; }
    const cfg = getCfg();
    try {
      const [, , statusRes, entities] = await Promise.allSettled([
        // 1 + 2: fetch events atomically via loadAllEvents
        loadAllEvents(),
        Promise.resolve(),
        axios.get(`${API}/calendar/google/status`, cfg),
        Promise.allSettled([
          axios.get(`${API}/leads`, cfg), axios.get(`${API}/contacts`, cfg), axios.get(`${API}/companies`, cfg),
          axios.get(`${API}/deals`, cfg), axios.get(`${API}/projects`, cfg), axios.get(`${API}/campaigns`, cfg),
        ]),
      ]);
      if (statusRes.status === 'fulfilled') setGoogleConnected(!!statusRes.value.data.connected);
      if (entities.status === 'fulfilled') {
        const [leads, contacts, companies, deals, projects, campaigns] = entities.value.map(r => r.status === 'fulfilled' ? r.value.data || [] : []);
        setLinkableEntities({ leads, contacts, companies, deals, projects, campaigns });
      }
    } finally {
      setLoading(false);
    }
  }, [token, getCfg, loadAllEvents]);

  useEffect(() => { initialLoad(); }, [initialLoad]);

  // Team events load
  useEffect(() => {
    if (!token || !showTeam) return;
    axios.get(`${API}/calendar/team-events`, getCfg())
      .then(r => setTeamEvents(r.data || []))
      .catch(err => console.error(err));
  }, [token, showTeam, getCfg]);

  // Polling + visibility: refresh every 30s while the tab is visible, and
  // immediately when the tab regains focus. This gives near-real-time updates
  // without the cost of a WebSocket.
  useEffect(() => {
    if (!token) return;
    let pollId = null;

    const startPolling = () => {
      if (pollId) return;
      pollId = setInterval(() => {
        if (document.visibilityState === 'visible') {
          loadAllEvents().catch(() => { /* soft-fail */ });
        }
      }, POLL_INTERVAL_MS);
    };
    const stopPolling = () => { if (pollId) { clearInterval(pollId); pollId = null; } };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        loadAllEvents().catch(() => {});
        startPolling();
      } else {
        stopPolling();
      }
    };
    const onFocus = () => {
      loadAllEvents().catch(() => {});
    };

    if (document.visibilityState === 'visible') startPolling();
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', onFocus);
    return () => {
      stopPolling();
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', onFocus);
    };
  }, [token, loadAllEvents]);

  // ---- Actions --------------------------------------------------------------

  const manualSync = async () => {
    if (!googleConnected) return;
    setSyncing(true);
    try {
      await axios.post(`${API}/calendar/google/sync`, {}, getCfg());
      await loadAllEvents();
      toast.success('Synced with Google');
    } catch (e) {
      console.error(e);
      toast.error('Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const handleCreateEvent = async () => {
    if (!newEvent.title || !newEvent.date) { toast.error('Title and start time are required'); return; }
    try {
      if (newEvent.destination === 'google') {
        if (!googleConnected) { toast.error('Connect Google Calendar first'); return; }
        const payload = {
          summary: newEvent.title,
          description: newEvent.notes || '',
          location: newEvent.location || '',
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        };
        if (newEvent.all_day) {
          // Expect date-only YYYY-MM-DD
          payload.all_day = true;
          payload.start_date = (newEvent.date || '').slice(0, 10);
          payload.end_date = (newEvent.end_date || newEvent.date || '').slice(0, 10);
        } else {
          payload.start_iso = new Date(newEvent.date).toISOString();
          payload.end_iso = newEvent.end_date
            ? new Date(newEvent.end_date).toISOString()
            : new Date(new Date(newEvent.date).getTime() + 60 * 60_000).toISOString();
        }
        const attendees = (newEvent.invitees || '').split(',').map(s => s.trim()).filter(s => s.includes('@'));
        if (attendees.length) payload.attendees = attendees;
        await axios.post(`${API}/calendar/google/events`, payload, getCfg());
        toast.success('Event created in Google Calendar');
      } else {
        const params = new URLSearchParams({ title: newEvent.title, date: new Date(newEvent.date).toISOString() });
        if (newEvent.end_date) params.set('end_date', new Date(newEvent.end_date).toISOString());
        if (newEvent.notes) params.set('notes', newEvent.notes);
        if (newEvent.location) params.set('location', newEvent.location);
        if (newEvent.invitees) params.set('invitee_emails', newEvent.invitees);
        params.set('blocks_booking', newEvent.blocks_booking !== false);
        if (newEvent.linked_type && newEvent.linked_type !== 'none' && newEvent.linked_id && newEvent.linked_id !== 'none') {
          params.set('linked_type', newEvent.linked_type);
          params.set('linked_id', newEvent.linked_id);
        }
        await axios.post(`${API}/calendar/events?${params}`, {}, getCfg());
        toast.success('Event created');
      }
      setShowCreate(false);
      setNewEvent({ title: '', date: '', end_date: '', notes: '', location: '', invitees: '', blocks_booking: true, linked_type: '', linked_id: '', destination: googleConnected ? newEvent.destination : 'tako', all_day: false });
      loadAllEvents();
    } catch (err) {
      console.error(err);
      toast.error(err?.response?.data?.detail || 'Failed to create event');
    }
  };

  const handleDeleteEvent = async (evt) => {
    if (!evt) return;
    try {
      if (evt.type === 'google') {
        await axios.delete(`${API}/calendar/google/events/${evt.google_id}`, getCfg());
      } else {
        await axios.delete(`${API}/calendar/events/${evt.id}`, getCfg());
      }
      toast.success('Deleted');
      setSelectedEvent(null);
      loadAllEvents();
    } catch (err) {
      console.error(err);
      toast.error(err?.response?.data?.detail || 'Failed to delete');
    }
  };

  const handleSaveEvent = async () => {
    if (!selectedEvent) return;
    try {
      if (selectedEvent.type === 'google') {
        const payload = {
          summary: editEventData.title,
          description: editEventData.notes ?? '',
          location: editEventData.location ?? '',
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        };
        if (selectedEvent.all_day) {
          payload.all_day = true;
          payload.start_date = (editEventData.date || '').slice(0, 10);
          payload.end_date = (editEventData.end_date || editEventData.date || '').slice(0, 10);
        } else {
          payload.start_iso = new Date(editEventData.date).toISOString();
          payload.end_iso = editEventData.end_date
            ? new Date(editEventData.end_date).toISOString()
            : new Date(new Date(editEventData.date).getTime() + 60 * 60_000).toISOString();
        }
        const attendees = (editEventData.invitees_input || '').split(',').map(s => s.trim()).filter(s => s.includes('@'));
        if (attendees.length) payload.attendees = attendees;
        const res = await axios.put(`${API}/calendar/google/events/${selectedEvent.google_id}`, payload, getCfg());
        toast.success('Updated in Google Calendar');
        setEditingEvent(false);
        setSelectedEvent(res.data);
      } else {
        const res = await axios.put(`${API}/calendar/events/${selectedEvent.id}`, editEventData, getCfg());
        toast.success('Updated');
        setEditingEvent(false);
        setSelectedEvent(res.data);
      }
      loadAllEvents();
    } catch (err) {
      console.error(err);
      toast.error(err?.response?.data?.detail || 'Failed to update');
    }
  };

  const handleInvite = async () => {
    if (!selectedEvent || !inviteEmails.trim()) return;
    const emails = inviteEmails.split(',').map(e => e.trim()).filter(e => e.includes('@'));
    if (!emails.length) return;
    try {
      await axios.post(`${API}/calendar/events/${selectedEvent.id}/invite`, emails, getCfg());
      toast.success('Invitations sent');
      setInviteEmails('');
      setSelectedEvent(prev => ({ ...prev, invitees: [...(prev.invitees || []), ...emails] }));
    } catch (err) {
      console.error(err);
      toast.error('Failed');
    }
  };

  const openEventDetail = (evt) => {
    setSelectedEvent(evt);
    setEditEventData({
      title: evt.title || '',
      date: evt.date || '',
      end_date: evt.end_date || '',
      notes: evt.notes || '',
      location: evt.location || '',
      invitees_input: (evt.attendees || []).map(a => a.email).join(', '),
    });
    setEditingEvent(false);
    setInviteEmails('');
  };

  const connectGoogle = async () => {
    try {
      const r = await axios.get(`${API}/calendar/google/auth-url`, getCfg());
      window.location.href = r.data.auth_url;
    } catch (e) {
      toast.error('Failed');
    }
  };

  // ---- Derived data ---------------------------------------------------------

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = (new Date(year, month, 1).getDay() + 6) % 7;

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const prevWeek = () => setCurrentDate(new Date(currentDate.getTime() - 7 * 86400000));
  const nextWeek = () => setCurrentDate(new Date(currentDate.getTime() + 7 * 86400000));
  const prevDay = () => setCurrentDate(new Date(currentDate.getTime() - 86400000));
  const nextDay = () => setCurrentDate(new Date(currentDate.getTime() + 86400000));
  const goToday = () => setCurrentDate(new Date());

  const isToday = (d) => d.toDateString() === new Date().toDateString();
  const getWeekDays = () => {
    const start = new Date(currentDate);
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
    return Array.from({ length: 7 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d; });
  };
  const weekDays = useMemo(() => getWeekDays(), [currentDate]);
  const dayOfWeek = useMemo(() => [currentDate], [currentDate]);

  const allEvents = useMemo(() => [...events, ...(showTeam ? teamEvents : [])], [events, teamEvents, showTeam]);

  // Events that fall on a given day (timed OR all-day that spans this day)
  const getEventsForDay = useCallback((day) => {
    const ds = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
    return allEvents.filter(e => {
      try {
        if (e.all_day) {
          const start = (e.date || '').slice(0, 10);
          const end = (e.end_date || e.date || '').slice(0, 10);
          return start <= ds && ds < (end || start) || start === ds;
        }
        return (e.date || '').slice(0, 10) === ds;
      } catch { return false; }
    });
  }, [allEvents]);

  const splitTimedAndAllDay = useCallback((evts) => {
    const timed = [];
    const allDay = [];
    evts.forEach(e => (e.all_day ? allDay : timed).push(e));
    return { timed, allDay };
  }, []);

  // Compute top/height in px for a timed event in the grid
  const getEventPosition = (evt) => {
    try {
      const d = new Date(evt.date);
      const startMin = d.getHours() * 60 + d.getMinutes();
      let durationMin = 60;
      if (evt.end_date) {
        const ed = new Date(evt.end_date);
        durationMin = Math.max(15, (ed.getTime() - d.getTime()) / 60000);
        if (durationMin > 960) durationMin = (hourEnd * 60) - startMin;
      }
      const top = ((startMin - hourStart * 60) / 60) * HOUR_PX;
      const height = Math.max(20, (durationMin / 60) * HOUR_PX);
      return { top: Math.max(0, top), height, startMin, durationMin };
    } catch {
      return { top: 0, height: 32, startMin: 0, durationMin: 60 };
    }
  };

  // Compute position of the now-indicator line within the visible hour range
  const nowLineTop = useMemo(() => {
    const now = new Date();
    const mins = now.getHours() * 60 + now.getMinutes();
    if (mins < hourStart * 60 || mins > hourEnd * 60) return null;
    return ((mins - hourStart * 60) / 60) * HOUR_PX;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hourStart, hourEnd, nowTick]);

  const formatTime = (iso) => { try { return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }); } catch { return ''; } };

  // Fill create dialog time range for a given day & hour
  const openCreateAtTime = (d, hour) => {
    const dt = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(hour).padStart(2, '0')}:00`;
    const et = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(hour + 1).padStart(2, '0')}:00`;
    setNewEvent(prev => ({
      ...prev,
      date: dt,
      end_date: et,
      destination: googleConnected ? prev.destination : 'tako',
    }));
    setShowCreate(true);
  };

  // ---- Render helpers -------------------------------------------------------

  const renderEventChip = (evt) => {
    const color = TYPE_COLORS[evt.type] || '#64748b';
    return (
      <div
        key={evt.id}
        className="text-[10px] px-1 py-0.5 rounded truncate cursor-pointer flex items-center gap-1"
        style={{ backgroundColor: color + '1a', color }}
        onClick={(e) => {
          e.stopPropagation();
          if (evt.type === 'event' || evt.type === 'google' || evt.type === 'team') {
            openEventDetail(evt);
          } else {
            navigate(evt.entity_type === 'lead' ? `/leads?detail=${evt.entity_id}` : '/tasks');
          }
        }}
      >
        {!evt.all_day && <span>{formatTime(evt.date)}</span>}
        <span className="truncate">{evt.title}</span>
        {evt.hangout_link && <Video className="w-2.5 h-2.5 shrink-0" />}
      </div>
    );
  };

  const renderTimedEvent = (evt, dayIndex, columnCount = 7) => {
    const pos = getEventPosition(evt);
    const color = TYPE_COLORS[evt.type] || '#0C1024';
    const widthPct = 100 / columnCount;
    return (
      <div
        key={`${evt.id}-${dayIndex}`}
        className="rounded px-1.5 py-0.5 cursor-pointer overflow-hidden hover:opacity-90 transition-opacity z-10 shadow-sm"
        style={{
          position: 'absolute',
          top: `${pos.top}px`,
          height: `${pos.height}px`,
          left: `calc(60px + ${dayIndex} * (100% - 60px) / ${columnCount} + 2px)`,
          width: `calc((100% - 60px) / ${columnCount} - 4px)`,
          backgroundColor: color + '1a',
          borderLeft: `3px solid ${color}`,
        }}
        onClick={(e) => {
          e.stopPropagation();
          if (evt.type === 'event' || evt.type === 'google' || evt.type === 'team') {
            openEventDetail(evt);
          } else {
            navigate(evt.entity_type === 'lead' ? `/leads?detail=${evt.entity_id}` : '/tasks');
          }
        }}
      >
        <p className="text-[10px] font-medium truncate flex items-center gap-1" style={{ color }}>
          {evt.hangout_link && <Video className="w-2.5 h-2.5 shrink-0" />}
          <span className="truncate">{evt.title}</span>
        </p>
        <p className="text-[9px] text-slate-500">
          {formatTime(evt.date)}{evt.end_date ? ` – ${formatTime(evt.end_date)}` : ''}
        </p>
        {pos.height > 50 && evt.location && <p className="text-[9px] text-slate-400 truncate">{evt.location}</p>}
      </div>
    );
  };

  const renderAllDayRow = (days) => {
    const hasAllDay = days.some(d => getEventsForDay(d).some(e => e.all_day));
    if (!hasAllDay) return null;
    return (
      <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b bg-slate-50/60">
        <div className="py-1 pr-2 text-right text-[9px] uppercase text-slate-400 border-r flex items-center justify-end">All day</div>
        {days.map((d, i) => {
          const evts = getEventsForDay(d).filter(e => e.all_day);
          return (
            <div key={i} className="py-1 px-1 border-r last:border-r-0 space-y-0.5 min-h-[26px]">
              {evts.map(evt => {
                const color = TYPE_COLORS[evt.type] || '#64748b';
                return (
                  <div
                    key={evt.id}
                    className="text-[10px] px-1.5 py-0.5 rounded truncate cursor-pointer"
                    style={{ backgroundColor: color, color: '#fff' }}
                    onClick={(e) => { e.stopPropagation(); openEventDetail(evt); }}
                  >
                    {evt.title}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    );
  };

  // ---- Render ---------------------------------------------------------------

  return (
    <DashboardLayout>
      <div className="p-6 space-y-4" data-testid="calendar-page">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{t('calendar.title')}</h1>
            <p className="text-slate-500 text-sm mt-1">{t('calendar.subtitle')}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-2 mr-2">
              <Users className="w-4 h-4 text-slate-400" />
              <span className="text-xs text-slate-500">Team</span>
              <Switch checked={showTeam} onCheckedChange={setShowTeam} data-testid="show-team-toggle" />
            </div>
            <select value={hourStart} onChange={e => setHourStart(parseInt(e.target.value))} className="text-xs border border-slate-200 rounded px-1.5 py-1">
              {Array.from({ length: 12 }, (_, i) => <option key={i} value={i}>{String(i).padStart(2, '0')}:00</option>)}
            </select>
            <span className="text-xs text-slate-400 self-center">to</span>
            <select value={hourEnd} onChange={e => setHourEnd(parseInt(e.target.value))} className="text-xs border border-slate-200 rounded px-1.5 py-1">
              {Array.from({ length: 12 }, (_, i) => <option key={i + 12} value={i + 12}>{String(i + 12).padStart(2, '0')}:00</option>)}
            </select>
            <div className="flex border border-slate-200 rounded-lg overflow-hidden">
              <button onClick={() => setView('day')} className={`px-3 py-1.5 text-sm ${view === 'day' ? 'bg-[#0C1024] text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>Day</button>
              <button onClick={() => setView('week')} className={`px-3 py-1.5 text-sm ${view === 'week' ? 'bg-[#0C1024] text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>{t('calendar.week')}</button>
              <button onClick={() => setView('month')} className={`px-3 py-1.5 text-sm ${view === 'month' ? 'bg-[#0C1024] text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>{t('calendar.month')}</button>
            </div>
            {!googleConnected ? (
              <Button variant="outline" size="sm" onClick={connectGoogle}>
                <svg className="w-4 h-4 mr-1" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                Google
              </Button>
            ) : (
              <div className="flex items-center gap-1">
                <Badge className="bg-blue-100 text-blue-700 text-xs">Google</Badge>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={manualSync} title="Sync with Google now" disabled={syncing}>
                  <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            )}
            <Button className="bg-[#0C1024] hover:bg-[#2e0550] text-white" onClick={() => setShowCreate(true)} data-testid="new-event-btn">
              <Plus className="w-4 h-4 mr-1" /> {t('calendar.newEvent')}
            </Button>
          </div>
        </div>

        {/* Nav */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={view === 'month' ? prevMonth : view === 'day' ? prevDay : prevWeek}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={view === 'month' ? nextMonth : view === 'day' ? nextDay : nextWeek}>
              <ChevronRight className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={goToday}>{t('calendar.today')}</Button>
          </div>
          <h2 className="text-lg font-semibold text-slate-900" style={{ fontFamily: "'Syne', sans-serif" }}>
            {view === 'month'
              ? `${MONTHS[month]} ${year}`
              : view === 'day'
              ? currentDate.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
              : `${weekDays[0].toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${weekDays[6].toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`}
          </h2>
          <div className="flex gap-3 text-xs text-slate-500 flex-wrap">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#0EA5A0]" />Calls</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400" />Tasks</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#0C1024]" />Events</span>
            {showTeam && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-400" />Team</span>}
            {googleConnected && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" />Google</span>}
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-[#0C1024] border-t-transparent rounded-full animate-spin" /></div>
        ) : view === 'month' ? (
          /* ==================== MONTH VIEW ==================== */
          <Card>
            <CardContent className="p-0">
              <div className="grid grid-cols-7 border-b">{DAYS.map(d => <div key={d} className="py-2 text-center text-xs font-medium text-slate-500 border-r last:border-r-0">{d}</div>)}</div>
              <div className="grid grid-cols-7">
                {Array.from({ length: firstDayOfWeek }, (_, i) => <div key={`e${i}`} className="min-h-[90px] border-r border-b bg-slate-50/50" />)}
                {Array.from({ length: daysInMonth }, (_, i) => {
                  const day = i + 1;
                  const dayDate = new Date(year, month, day);
                  const dayEvents = getEventsForDay(dayDate);
                  return (
                    <div
                      key={day}
                      className={`min-h-[90px] border-r border-b p-1 hover:bg-slate-50 cursor-pointer ${isToday(dayDate) ? 'bg-teal-50/50' : ''}`}
                      onClick={() => openCreateAtTime(dayDate, 9)}
                    >
                      <div className={`text-xs font-medium mb-1 w-6 h-6 flex items-center justify-center rounded-full ${isToday(dayDate) ? 'bg-[#0C1024] text-white' : 'text-slate-700'}`}>{day}</div>
                      <div className="space-y-0.5">
                        {dayEvents.slice(0, 3).map(renderEventChip)}
                        {dayEvents.length > 3 && <div className="text-[10px] text-slate-400 pl-1">+{dayEvents.length - 3} more</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ) : view === 'day' ? (
          /* ==================== DAY VIEW ==================== */
          <Card>
            <CardContent className="p-0 overflow-hidden">
              <div className="grid grid-cols-[60px_1fr] border-b sticky top-0 z-10 bg-white">
                <div className="py-2 border-r" />
                <div className={`py-2 text-center border-r last:border-r-0 ${isToday(currentDate) ? 'bg-[#0C1024]/5' : ''}`}>
                  <div className="text-xs text-slate-500">{DAYS[(currentDate.getDay() + 6) % 7]}</div>
                  <div className={`text-lg font-semibold ${isToday(currentDate) ? 'text-[#0C1024]' : 'text-slate-900'}`}>{currentDate.getDate()}</div>
                </div>
              </div>
              {/* All-day row (single-day variant) */}
              {(() => {
                const evts = getEventsForDay(currentDate).filter(e => e.all_day);
                if (!evts.length) return null;
                return (
                  <div className="grid grid-cols-[60px_1fr] border-b bg-slate-50/60">
                    <div className="py-1 pr-2 text-right text-[9px] uppercase text-slate-400 border-r flex items-center justify-end">All day</div>
                    <div className="py-1 px-1 space-y-0.5 min-h-[26px]">
                      {evts.map(evt => {
                        const color = TYPE_COLORS[evt.type] || '#64748b';
                        return (
                          <div key={evt.id}
                            className="text-[11px] px-1.5 py-0.5 rounded truncate cursor-pointer"
                            style={{ backgroundColor: color, color: '#fff' }}
                            onClick={() => openEventDetail(evt)}>
                            {evt.title}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
              {/* Time grid */}
              <div className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 320px)' }}>
                <div className="grid grid-cols-[60px_1fr]" style={{ position: 'relative' }}>
                  {HOURS.map(hour => (
                    <React.Fragment key={hour}>
                      <div className="h-16 border-r border-b flex items-start justify-end pr-2 pt-0.5">
                        <span className="text-[10px] text-slate-400">{String(hour).padStart(2, '0')}:00</span>
                      </div>
                      <div
                        className={`h-16 border-r border-b last:border-r-0 ${isToday(currentDate) ? 'bg-[#0C1024]/[0.02]' : ''}`}
                        onClick={() => openCreateAtTime(currentDate, hour)}
                      />
                    </React.Fragment>
                  ))}
                  {/* Timed events */}
                  {getEventsForDay(currentDate).filter(e => !e.all_day).map(evt => renderTimedEvent(evt, 0, 1))}
                  {/* Now-line */}
                  {isToday(currentDate) && nowLineTop != null && (
                    <div className="pointer-events-none absolute z-20" style={{ top: `${nowLineTop}px`, left: '60px', right: 0 }}>
                      <div className="h-px bg-red-500" />
                      <div className="w-2 h-2 bg-red-500 rounded-full -mt-1 -ml-1" />
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          /* ==================== WEEK VIEW ==================== */
          <Card>
            <CardContent className="p-0 overflow-hidden">
              <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b sticky top-0 z-10 bg-white">
                <div className="py-2 border-r" />
                {weekDays.map((d, i) => (
                  <div key={i} className={`py-2 text-center border-r last:border-r-0 ${isToday(d) ? 'bg-[#0C1024]/5' : ''}`}>
                    <div className="text-xs text-slate-500">{DAYS[i]}</div>
                    <div className={`text-lg font-semibold ${isToday(d) ? 'text-[#0C1024]' : 'text-slate-900'}`}>{d.getDate()}</div>
                  </div>
                ))}
              </div>
              {renderAllDayRow(weekDays)}
              <div className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 320px)' }}>
                <div className="grid grid-cols-[60px_repeat(7,1fr)]" style={{ position: 'relative' }}>
                  {HOURS.map(hour => (
                    <React.Fragment key={hour}>
                      <div className="h-16 border-r border-b flex items-start justify-end pr-2 pt-0.5">
                        <span className="text-[10px] text-slate-400">{String(hour).padStart(2, '0')}:00</span>
                      </div>
                      {weekDays.map((d, di) => (
                        <div
                          key={`${hour}-${di}`}
                          className={`h-16 border-r border-b last:border-r-0 ${isToday(d) ? 'bg-[#0C1024]/[0.02]' : ''}`}
                          onClick={() => openCreateAtTime(d, hour)}
                        />
                      ))}
                    </React.Fragment>
                  ))}
                  {/* Timed event overlays */}
                  {weekDays.map((d, di) =>
                    getEventsForDay(d).filter(e => !e.all_day).map(evt => renderTimedEvent(evt, di, 7))
                  )}
                  {/* Now-line — only drawn if today is in the visible week */}
                  {nowLineTop != null && weekDays.some(isToday) && (
                    <div className="pointer-events-none absolute z-20" style={{ top: `${nowLineTop}px`, left: '60px', right: 0 }}>
                      <div className="h-px bg-red-500" />
                      <div className="w-2 h-2 bg-red-500 rounded-full -mt-1 -ml-1" />
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* ==================== CREATE EVENT DIALOG ==================== */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{t('forms.newEvent')}</DialogTitle></DialogHeader>
          <div className="space-y-3 pt-2">
            {googleConnected && (
              <div>
                <Label>Save to</Label>
                <div className="flex gap-2 mt-1">
                  <button
                    type="button"
                    onClick={() => setNewEvent({ ...newEvent, destination: 'tako' })}
                    className={`flex-1 text-xs py-2 rounded-lg border ${newEvent.destination === 'tako' ? 'border-[#0C1024] bg-[#0C1024] text-white' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}
                  >
                    <CalendarIcon className="w-3.5 h-3.5 inline mr-1" /> TAKO
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewEvent({ ...newEvent, destination: 'google' })}
                    className={`flex-1 text-xs py-2 rounded-lg border ${newEvent.destination === 'google' ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}
                  >
                    Google Calendar
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  {newEvent.destination === 'google'
                    ? 'Event will be created in Google Calendar and synced back to TAKO.'
                    : 'Event lives in TAKO — can be linked to leads, contacts, deals.'}
                </p>
              </div>
            )}
            <div><Label>Title *</Label><Input value={newEvent.title} onChange={e => setNewEvent({ ...newEvent, title: e.target.value })} placeholder="Meeting, deadline…" data-testid="event-title" /></div>
            <div className="flex items-center justify-between py-1">
              <Label className="m-0">All day</Label>
              <Switch checked={!!newEvent.all_day} onCheckedChange={v => setNewEvent({ ...newEvent, all_day: v })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Start *</Label>
                <Input
                  type={newEvent.all_day ? 'date' : 'datetime-local'}
                  value={newEvent.all_day ? (newEvent.date || '').slice(0, 10) : newEvent.date}
                  onChange={e => setNewEvent({ ...newEvent, date: e.target.value })}
                  data-testid="event-date"
                />
              </div>
              <div><Label>End</Label>
                <Input
                  type={newEvent.all_day ? 'date' : 'datetime-local'}
                  value={newEvent.all_day ? (newEvent.end_date || '').slice(0, 10) : newEvent.end_date}
                  onChange={e => setNewEvent({ ...newEvent, end_date: e.target.value })}
                  data-testid="event-end-date"
                />
              </div>
            </div>
            <div><Label>Location</Label><Input value={newEvent.location} onChange={e => setNewEvent({ ...newEvent, location: e.target.value })} placeholder="Office, Zoom link, address…" /></div>
            <div><Label>Notes</Label><Input value={newEvent.notes} onChange={e => setNewEvent({ ...newEvent, notes: e.target.value })} placeholder="Optional details" /></div>
            <div><Label>{newEvent.destination === 'google' ? 'Attendees (emails, comma separated)' : 'Invite (emails, comma separated)'}</Label><Input value={newEvent.invitees} onChange={e => setNewEvent({ ...newEvent, invitees: e.target.value })} placeholder="anna@company.com, bob@team.com" /></div>
            {newEvent.destination !== 'google' && (
              <>
                <div className="flex items-center justify-between py-1">
                  <div>
                    <p className="text-sm font-medium text-slate-700">Blocks bookings</p>
                    <p className="text-[10px] text-slate-400">When on, this event prevents booking slots during this time</p>
                  </div>
                  <Switch checked={newEvent.blocks_booking !== false} onCheckedChange={v => setNewEvent({ ...newEvent, blocks_booking: v })} />
                </div>
                <div><Label>Link to</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Select value={newEvent.linked_type || 'none'} onValueChange={v => setNewEvent({ ...newEvent, linked_type: v === 'none' ? '' : v, linked_id: '' })}>
                      <SelectTrigger className="text-xs"><SelectValue placeholder="Type" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        <SelectItem value="lead">Lead</SelectItem><SelectItem value="contact">Contact</SelectItem><SelectItem value="company">Company</SelectItem>
                        <SelectItem value="deal">Deal</SelectItem><SelectItem value="project">Project</SelectItem><SelectItem value="campaign">Campaign</SelectItem>
                      </SelectContent>
                    </Select>
                    {newEvent.linked_type && newEvent.linked_type !== 'none' && (
                      <Select value={newEvent.linked_id || 'none'} onValueChange={v => setNewEvent({ ...newEvent, linked_id: v === 'none' ? '' : v })}>
                        <SelectTrigger className="text-xs"><SelectValue placeholder="Select…" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          {newEvent.linked_type === 'lead' && linkableEntities.leads.map(l => <SelectItem key={l.lead_id} value={l.lead_id}>{l.first_name} {l.last_name}</SelectItem>)}
                          {newEvent.linked_type === 'contact' && linkableEntities.contacts.map(c => <SelectItem key={c.contact_id} value={c.contact_id}>{c.first_name} {c.last_name}</SelectItem>)}
                          {newEvent.linked_type === 'company' && linkableEntities.companies.map(c => <SelectItem key={c.company_id} value={c.company_id}>{c.name}</SelectItem>)}
                          {newEvent.linked_type === 'deal' && linkableEntities.deals.map(d => <SelectItem key={d.deal_id} value={d.deal_id}>{d.name}</SelectItem>)}
                          {newEvent.linked_type === 'project' && linkableEntities.projects.map(p => <SelectItem key={p.project_id} value={p.project_id}>{p.name}</SelectItem>)}
                          {newEvent.linked_type === 'campaign' && linkableEntities.campaigns.map(c => <SelectItem key={c.campaign_id} value={c.campaign_id}>{c.name || c.subject}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </div>
              </>
            )}
            <Button onClick={handleCreateEvent} className="w-full bg-[#0C1024] hover:bg-[#2e0550] text-white" data-testid="create-event-submit">
              <Plus className="w-4 h-4 mr-2" /> Create Event
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ==================== EVENT DETAIL / EDIT DIALOG ==================== */}
      <Dialog open={!!selectedEvent} onOpenChange={() => { setSelectedEvent(null); setEditingEvent(false); }}>
        <DialogContent className="max-w-md">
          {selectedEvent && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: TYPE_COLORS[selectedEvent.type] || '#0C1024' }} />
                    <span className="truncate">{editingEvent ? 'Edit Event' : selectedEvent.title}</span>
                    {selectedEvent.type === 'google' && !editingEvent && (
                      <Badge variant="outline" className="text-[10px] shrink-0">Google</Badge>
                    )}
                  </div>
                  {!editingEvent && (selectedEvent.type === 'event' || selectedEvent.type === 'google') && (
                    <Button size="sm" variant="outline" onClick={() => setEditingEvent(true)}>{t('common.edit')}</Button>
                  )}
                </DialogTitle>
              </DialogHeader>
              {editingEvent ? (
                <div className="space-y-3 pt-2">
                  <div><Label>Title</Label><Input value={editEventData.title || ''} onChange={e => setEditEventData({ ...editEventData, title: e.target.value })} /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Start</Label>
                      <Input
                        type={selectedEvent.all_day ? 'date' : 'datetime-local'}
                        value={selectedEvent.all_day ? (editEventData.date || '').slice(0, 10) : (editEventData.date ? editEventData.date.slice(0, 16) : '')}
                        onChange={e => setEditEventData({ ...editEventData, date: e.target.value })}
                      />
                    </div>
                    <div><Label>End</Label>
                      <Input
                        type={selectedEvent.all_day ? 'date' : 'datetime-local'}
                        value={selectedEvent.all_day ? (editEventData.end_date || '').slice(0, 10) : (editEventData.end_date ? editEventData.end_date.slice(0, 16) : '')}
                        onChange={e => setEditEventData({ ...editEventData, end_date: e.target.value })}
                      />
                    </div>
                  </div>
                  <div><Label>Location</Label><Input value={editEventData.location || ''} onChange={e => setEditEventData({ ...editEventData, location: e.target.value })} /></div>
                  <div><Label>Notes</Label><Input value={editEventData.notes || ''} onChange={e => setEditEventData({ ...editEventData, notes: e.target.value })} /></div>
                  {selectedEvent.type === 'google' && (
                    <div>
                      <Label>Attendees (comma separated emails)</Label>
                      <Input
                        value={editEventData.invitees_input || ''}
                        onChange={e => setEditEventData({ ...editEventData, invitees_input: e.target.value })}
                        placeholder="anna@company.com, bob@team.com"
                      />
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Button onClick={handleSaveEvent} className="bg-[#0C1024] text-white">{t('common.save')}</Button>
                    <Button variant="outline" onClick={() => setEditingEvent(false)}>{t('common.cancel')}</Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3 pt-2">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-50 rounded-lg p-3">
                      <p className="text-xs text-slate-500 flex items-center gap-1"><Clock className="w-3 h-3" />Start</p>
                      <p className="text-sm font-medium">
                        {selectedEvent.date
                          ? (selectedEvent.all_day ? selectedEvent.date.slice(0, 10) : new Date(selectedEvent.date).toLocaleString())
                          : '-'}
                      </p>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-3">
                      <p className="text-xs text-slate-500 flex items-center gap-1"><Clock className="w-3 h-3" />End</p>
                      <p className="text-sm font-medium">
                        {selectedEvent.end_date
                          ? (selectedEvent.all_day ? selectedEvent.end_date.slice(0, 10) : new Date(selectedEvent.end_date).toLocaleString())
                          : '-'}
                      </p>
                    </div>
                  </div>

                  {selectedEvent.location && (
                    <div className="bg-slate-50 rounded-lg p-3">
                      <p className="text-xs text-slate-500 flex items-center gap-1 mb-1"><MapPin className="w-3 h-3" />Location</p>
                      <p className="text-sm text-slate-700 break-words">{selectedEvent.location}</p>
                    </div>
                  )}

                  {selectedEvent.hangout_link && (
                    <a href={selectedEvent.hangout_link} target="_blank" rel="noreferrer" className="flex items-center gap-2 bg-blue-50 hover:bg-blue-100 rounded-lg p-3 transition-colors">
                      <Video className="w-4 h-4 text-blue-600" />
                      <span className="text-sm font-medium text-blue-700">Join Google Meet</span>
                      <ExternalLink className="w-3 h-3 text-blue-400 ml-auto" />
                    </a>
                  )}

                  {selectedEvent.notes && (
                    <div className="bg-slate-50 rounded-lg p-3">
                      <p className="text-xs text-slate-500 flex items-center gap-1 mb-1"><AlignLeft className="w-3 h-3" />Notes</p>
                      <p className="text-sm text-slate-700 whitespace-pre-wrap">{selectedEvent.notes}</p>
                    </div>
                  )}

                  {selectedEvent.organizer?.email && !selectedEvent.organizer.self && (
                    <div className="bg-slate-50 rounded-lg p-3">
                      <p className="text-xs text-slate-500 flex items-center gap-1 mb-1"><UserIcon className="w-3 h-3" />Organizer</p>
                      <p className="text-sm text-slate-700">{selectedEvent.organizer.displayName || selectedEvent.organizer.email}</p>
                    </div>
                  )}

                  {selectedEvent.attendees?.length > 0 && (
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Attendees ({selectedEvent.attendees.length})</p>
                      <div className="space-y-1 max-h-32 overflow-y-auto">
                        {selectedEvent.attendees.map((a, i) => (
                          <div key={i} className="flex items-center justify-between text-xs bg-slate-50 rounded px-2 py-1">
                            <span className="truncate">{a.displayName || a.email}</span>
                            <Badge
                              variant="outline"
                              className={`text-[9px] shrink-0 ${
                                a.responseStatus === 'accepted' ? 'border-green-300 text-green-700' :
                                a.responseStatus === 'declined' ? 'border-red-300 text-red-700' :
                                a.responseStatus === 'tentative' ? 'border-amber-300 text-amber-700' : ''
                              }`}
                            >
                              {a.responseStatus === 'needsAction' ? 'pending' : a.responseStatus}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedEvent.member_name && <Badge variant="secondary">{selectedEvent.member_name}</Badge>}

                  {selectedEvent.invitees?.length > 0 && (
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Invitees</p>
                      <div className="flex flex-wrap gap-1">
                        {selectedEvent.invitees.map((e, i) => <Badge key={i} variant="outline" className="text-xs">{e}</Badge>)}
                      </div>
                    </div>
                  )}

                  {/* TAKO events: invite a new person by email */}
                  {selectedEvent.type === 'event' && (
                    <div className="border-t pt-3 space-y-2">
                      <p className="text-xs font-medium text-slate-700">Invite people</p>
                      <div className="flex gap-2">
                        <Input value={inviteEmails} onChange={e => setInviteEmails(e.target.value)} placeholder="email@example.com" className="text-xs h-8" />
                        <Button size="sm" className="h-8 bg-[#0C1024] text-white" onClick={handleInvite}>Send</Button>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between border-t pt-3">
                    {selectedEvent.html_link && (
                      <a href={selectedEvent.html_link} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                        Open in Google <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                    <div className="ml-auto">
                      {(selectedEvent.type === 'event' || selectedEvent.type === 'google') && (
                        <Button variant="outline" size="sm" className="text-red-500" onClick={() => handleDeleteEvent(selectedEvent)}>
                          <X className="w-3.5 h-3.5 mr-1" />{t('common.delete')}
                        </Button>
                      )}
                    </div>
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

export default CalendarPage;
