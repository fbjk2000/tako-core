import { useT } from '../useT';
import React, { useState, useEffect, useMemo } from 'react';
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
import { ChevronLeft, ChevronRight, Plus, X, Clock, Users } from 'lucide-react';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const ALL_HOURS = Array.from({ length: 24 }, (_, i) => i); // 0-23

const CalendarPage = () => {
  const { token } = useAuth();
  const navigate = useNavigate();
  const { t } = useT();
  const [events, setEvents] = useState([]);
  const [teamEvents, setTeamEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState('week');
  const [showCreate, setShowCreate] = useState(false);
  const [showTeam, setShowTeam] = useState(false);
  const [hourStart, setHourStart] = useState(7);
  const [hourEnd, setHourEnd] = useState(22);
  const HOURS = ALL_HOURS.slice(hourStart, hourEnd);
  const [newEvent, setNewEvent] = useState({ title: '', date: '', end_date: '', notes: '', location: '', invitees: '', blocks_booking: true, linked_type: '', linked_id: '' });
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [editingEvent, setEditingEvent] = useState(false);
  const [editEventData, setEditEventData] = useState({});
  const [inviteEmails, setInviteEmails] = useState('');
  const [googleConnected, setGoogleConnected] = useState(false);
  const [linkableEntities, setLinkableEntities] = useState({ leads: [], contacts: [], companies: [], deals: [], projects: [], campaigns: [] });

  const getCfg = () => ({ headers: { Authorization: `Bearer ${token}` }, withCredentials: true });

  useEffect(() => {
    if (!token) { setLoading(false); return; }
    const cfg = getCfg();
    Promise.allSettled([
      axios.get(`${API}/calendar/events`, cfg).then(r => setEvents(r.data || [])),
      axios.get(`${API}/calendar/google/events`, cfg).then(r => { if (Array.isArray(r.data)) setEvents(prev => [...prev, ...r.data]); }),
      axios.get(`${API}/calendar/google/status`, cfg).then(r => setGoogleConnected(r.data.connected)),
      Promise.allSettled([
        axios.get(`${API}/leads`, cfg), axios.get(`${API}/contacts`, cfg), axios.get(`${API}/companies`, cfg),
        axios.get(`${API}/deals`, cfg), axios.get(`${API}/projects`, cfg), axios.get(`${API}/campaigns`, cfg)
      ]).then(results => {
        const [leads, contacts, companies, deals, projects, campaigns] = results.map(r => r.status === 'fulfilled' ? r.value.data || [] : []);
        setLinkableEntities({ leads, contacts, companies, deals, projects, campaigns });
      })
    ]).finally(() => setLoading(false));
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!token || !showTeam) return;
    axios.get(`${API}/calendar/team-events`, getCfg()).then(r => setTeamEvents(r.data || [])).catch(err => console.error(err));
  }, [token, showTeam]); // eslint-disable-line react-hooks/exhaustive-deps

  const reloadEvents = async () => {
    try {
      const cfg = getCfg();
      const [tako, google] = await Promise.allSettled([axios.get(`${API}/calendar/events`, cfg), axios.get(`${API}/calendar/google/events`, cfg)]);
      setEvents([...(tako.status === 'fulfilled' ? tako.value.data || [] : []), ...(google.status === 'fulfilled' && Array.isArray(google.value.data) ? google.value.data : [])]);
    } catch (err) { console.error(err); }
  };

  const handleCreateEvent = async () => {
    if (!newEvent.title || !newEvent.date) return;
    try {
      const params = new URLSearchParams({ title: newEvent.title, date: new Date(newEvent.date).toISOString() });
      if (newEvent.end_date) params.set('end_date', new Date(newEvent.end_date).toISOString());
      if (newEvent.notes) params.set('notes', newEvent.notes);
      if (newEvent.location) params.set('location', newEvent.location);
      if (newEvent.invitees) params.set('invitee_emails', newEvent.invitees);
      params.set('blocks_booking', newEvent.blocks_booking !== false);
      if (newEvent.linked_type && newEvent.linked_type !== 'none' && newEvent.linked_id && newEvent.linked_id !== 'none') { params.set('linked_type', newEvent.linked_type); params.set('linked_id', newEvent.linked_id); }
      await axios.post(`${API}/calendar/events?${params}`, {}, getCfg());
      toast.success('Event created');
      setShowCreate(false);
      setNewEvent({ title: '', date: '', end_date: '', notes: '', location: '', invitees: '', blocks_booking: true, linked_type: '', linked_id: '' });
      reloadEvents();
    } catch (err) { console.error(err); toast.error('Failed to create event'); }
  };

  const handleDeleteEvent = async (id) => { try { await axios.delete(`${API}/calendar/events/${id}`, getCfg()); toast.success('Deleted'); reloadEvents(); setSelectedEvent(null); } catch (err) { console.error(err); } };

  const handleSaveEvent = async () => {
    if (!selectedEvent) return;
    try { const res = await axios.put(`${API}/calendar/events/${selectedEvent.id}`, editEventData, getCfg()); toast.success('Updated'); setEditingEvent(false); setSelectedEvent(res.data); reloadEvents(); } catch (err) { console.error(err); toast.error('Failed'); }
  };

  const handleInvite = async () => {
    if (!selectedEvent || !inviteEmails.trim()) return;
    const emails = inviteEmails.split(',').map(e => e.trim()).filter(e => e.includes('@'));
    if (!emails.length) return;
    try { await axios.post(`${API}/calendar/events/${selectedEvent.id}/invite`, emails, getCfg()); toast.success('Invitations sent'); setInviteEmails(''); setSelectedEvent(prev => ({ ...prev, invitees: [...(prev.invitees || []), ...emails] })); } catch (err) { console.error(err); toast.error('Failed'); }
  };

  const openEventDetail = (evt) => { setSelectedEvent(evt); setEditEventData({ title: evt.title, date: evt.date || '', end_date: evt.end_date || '', notes: evt.notes || '' }); setEditingEvent(false); setInviteEmails(''); };

  const connectGoogle = async () => { try { const r = await axios.get(`${API}/calendar/google/auth-url`, getCfg()); window.location.href = r.data.auth_url; } catch (e) { toast.error('Failed'); } };

  // Calendar helpers
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = (new Date(year, month, 1).getDay() + 6) % 7;

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const prevWeek = () => setCurrentDate(new Date(currentDate.getTime() - 7 * 86400000));
  const nextWeek = () => setCurrentDate(new Date(currentDate.getTime() + 7 * 86400000));
  const goToday = () => setCurrentDate(new Date());

  const isToday = (d) => d.toDateString() === new Date().toDateString();
  const getWeekDays = () => {
    const start = new Date(currentDate);
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
    return Array.from({ length: 7 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d; });
  };
  const weekDays = useMemo(() => getWeekDays(), [currentDate]);

  const allEvents = useMemo(() => [...events, ...(showTeam ? teamEvents : [])], [events, teamEvents, showTeam]);

  const getEventsForDay = (day) => {
    const ds = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
    return allEvents.filter(e => { try { return e.date?.substring(0, 10) === ds; } catch { return false; } });
  };

  const getEventPosition = (evt) => {
    try {
      const d = new Date(evt.date);
      const startMin = d.getHours() * 60 + d.getMinutes();
      let durationMin = 60;
      if (evt.end_date) {
        const ed = new Date(evt.end_date);
        durationMin = Math.max(15, (ed.getTime() - d.getTime()) / 60000);
        // Cap multi-day events to end of visible day
        if (durationMin > 960) durationMin = (hourEnd * 60) - startMin;
      }
      const top = ((startMin - hourStart * 60) / 60) * 64;
      const height = Math.max(20, (durationMin / 60) * 64);
      return { top: Math.max(0, top), height, startMin, durationMin };
    } catch { return { top: 0, height: 32, startMin: 0, durationMin: 60 }; }
  };

  const formatTime = (iso) => { try { return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }); } catch { return ''; } };

  const typeColors = { call: '#7C3AED', task: '#f59e0b', deal: '#6366f1', event: '#3B0764', google: '#4285f4', team: '#94a3b8' };

  return (
    <DashboardLayout>
      <div className="p-6 space-y-4" data-testid="calendar-page">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{ t('calendar.title') }</h1>
            <p className="text-slate-500 text-sm mt-1">{ t('calendar.subtitle') }</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 mr-2">
              <Users className="w-4 h-4 text-slate-400" />
              <span className="text-xs text-slate-500">Team</span>
              <Switch checked={showTeam} onCheckedChange={setShowTeam} data-testid="show-team-toggle" />
            </div>
            <select value={hourStart} onChange={e => setHourStart(parseInt(e.target.value))} className="text-xs border border-slate-200 rounded px-1.5 py-1">
              {Array.from({length:12}, (_,i) => <option key={i} value={i}>{String(i).padStart(2,'0')}:00</option>)}
            </select>
            <span className="text-xs text-slate-400 self-center">to</span>
            <select value={hourEnd} onChange={e => setHourEnd(parseInt(e.target.value))} className="text-xs border border-slate-200 rounded px-1.5 py-1">
              {Array.from({length:12}, (_,i) => <option key={i+12} value={i+12}>{String(i+12).padStart(2,'0')}:00</option>)}
            </select>
            <div className="flex border border-slate-200 rounded-lg overflow-hidden">
              <button onClick={() => setView('month')} className={`px-3 py-1.5 text-sm ${view === 'month' ? 'bg-[#3B0764] text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>{ t('calendar.month') }</button>
              <button onClick={() => setView('week')} className={`px-3 py-1.5 text-sm ${view === 'week' ? 'bg-[#3B0764] text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>{ t('calendar.week') }</button>
            </div>
            {!googleConnected ? (
              <Button variant="outline" size="sm" onClick={connectGoogle}><svg className="w-4 h-4 mr-1" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>Google</Button>
            ) : <Badge className="bg-blue-100 text-blue-700 text-xs">Google</Badge>}
            <Button className="bg-[#3B0764] hover:bg-[#2e0550] text-white" onClick={() => setShowCreate(true)} data-testid="new-event-btn"><Plus className="w-4 h-4 mr-1" /> { t('calendar.newEvent') }</Button>
          </div>
        </div>

        {/* Nav */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={view === 'month' ? prevMonth : prevWeek}><ChevronLeft className="w-4 h-4" /></Button>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={view === 'month' ? nextMonth : nextWeek}><ChevronRight className="w-4 h-4" /></Button>
            <Button variant="ghost" size="sm" onClick={goToday}>{ t('calendar.today') }</Button>
          </div>
          <h2 className="text-lg font-semibold text-slate-900" style={{ fontFamily: "'Syne', sans-serif" }}>
            {view === 'month' ? `${MONTHS[month]} ${year}` : `${weekDays[0].toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} \u2013 ${weekDays[6].toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`}
          </h2>
          <div className="flex gap-3 text-xs text-slate-500">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#7C3AED]" />Calls</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400" />Tasks</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#3B0764]" />Events</span>
            {showTeam && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-400" />Team</span>}
            {googleConnected && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" />Google</span>}
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-[#3B0764] border-t-transparent rounded-full animate-spin" /></div>
        ) : view === 'month' ? (
          /* Month View */
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
                    <div key={day} className={`min-h-[90px] border-r border-b p-1 hover:bg-slate-50 cursor-pointer ${isToday(dayDate) ? 'bg-purple-50/50' : ''}`}
                      onClick={() => { const dt = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}T09:00`; setNewEvent({...newEvent, date: dt, end_date: `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}T10:00`}); setShowCreate(true); }}>
                      <div className={`text-xs font-medium mb-1 w-6 h-6 flex items-center justify-center rounded-full ${isToday(dayDate) ? 'bg-[#3B0764] text-white' : 'text-slate-700'}`}>{day}</div>
                      <div className="space-y-0.5">
                        {dayEvents.slice(0, 3).map(evt => (
                          <div key={evt.id} className="text-[10px] px-1 py-0.5 rounded truncate cursor-pointer" style={{ backgroundColor: (typeColors[evt.type] || '#64748b') + '18', color: typeColors[evt.type] || '#64748b' }}
                            onClick={(e) => { e.stopPropagation(); evt.type === 'event' || evt.type === 'team' ? openEventDetail(evt) : navigate(evt.entity_type === 'lead' ? `/leads?detail=${evt.entity_id}` : '/tasks'); }}>
                            {formatTime(evt.date)} {evt.title}
                          </div>
                        ))}
                        {dayEvents.length > 3 && <div className="text-[10px] text-slate-400 pl-1">+{dayEvents.length - 3} more</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ) : (
          /* Week View with Time Grid */
          <Card>
            <CardContent className="p-0 overflow-hidden">
              {/* Day headers */}
              <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b sticky top-0 z-10 bg-white">
                <div className="py-2 border-r" />
                {weekDays.map((d, i) => (
                  <div key={i} className={`py-2 text-center border-r last:border-r-0 ${isToday(d) ? 'bg-[#3B0764]/5' : ''}`}>
                    <div className="text-xs text-slate-500">{DAYS[i]}</div>
                    <div className={`text-lg font-semibold ${isToday(d) ? 'text-[#3B0764]' : 'text-slate-900'}`}>{d.getDate()}</div>
                  </div>
                ))}
              </div>
              {/* Time grid with overlay events */}
              <div className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 280px)' }}>
                <div className="grid grid-cols-[60px_repeat(7,1fr)]" style={{ position: 'relative' }}>
                  {/* Grid lines */}
                  {HOURS.map(hour => (
                    <React.Fragment key={hour}>
                      <div className="h-16 border-r border-b flex items-start justify-end pr-2 pt-0.5">
                        <span className="text-[10px] text-slate-400">{String(hour).padStart(2, '0')}:00</span>
                      </div>
                      {weekDays.map((d, di) => (
                        <div key={`${hour}-${di}`} className={`h-16 border-r border-b last:border-r-0 ${isToday(d) ? 'bg-[#3B0764]/[0.02]' : ''}`}
                          onClick={() => { const dt = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}T${String(hour).padStart(2,'0')}:00`; const et = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}T${String(hour+1).padStart(2,'0')}:00`; setNewEvent({...newEvent, date: dt, end_date: et}); setShowCreate(true); }} />
                      ))}
                    </React.Fragment>
                  ))}
                  {/* Event overlays per day column */}
                  {weekDays.map((d, di) => {
                    const dayEvents = getEventsForDay(d);
                    return dayEvents.map(evt => {
                      const pos = getEventPosition(evt);
                      const colStart = di + 2; // grid column (1-indexed, +1 for time label col)
                      return (
                        <div key={`${evt.id}-${di}`} className="rounded px-1.5 py-0.5 cursor-pointer overflow-hidden hover:opacity-90 transition-opacity z-10"
                          style={{ position: 'absolute', top: `${pos.top}px`, height: `${pos.height}px`, left: `calc(60px + ${(di / 7) * 100}% * 7 / 7)`, width: `calc((100% - 60px) / 7 - 4px)`, marginLeft: `calc(${di} * (100% - 60px) / 7 + 2px)`, backgroundColor: (typeColors[evt.type] || '#3B0764') + '20', borderLeft: `3px solid ${typeColors[evt.type] || '#3B0764'}` }}
                          onClick={(e) => { e.stopPropagation(); evt.type === 'event' || evt.type === 'team' ? openEventDetail(evt) : navigate(evt.entity_type === 'lead' ? `/leads?detail=${evt.entity_id}` : '/tasks'); }}>
                          <p className="text-[10px] font-medium truncate" style={{ color: typeColors[evt.type] || '#3B0764' }}>{evt.title}</p>
                          <p className="text-[9px] text-slate-500">{formatTime(evt.date)}{evt.end_date ? ` \u2013 ${formatTime(evt.end_date)}` : ''}</p>
                          {pos.height > 50 && evt.location && <p className="text-[9px] text-slate-400 truncate">{evt.location}</p>}
                          {pos.height > 40 && evt.blocks_booking === false && <span className="text-[8px] bg-slate-200 text-slate-500 px-1 rounded">non-blocking</span>}
                        </div>
                      );
                    });
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Create Event Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{ t('forms.newEvent') }</DialogTitle></DialogHeader>
          <div className="space-y-3 pt-2">
            <div><Label>Title *</Label><Input value={newEvent.title} onChange={e => setNewEvent({ ...newEvent, title: e.target.value })} placeholder="Meeting, deadline..." data-testid="event-title" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Start *</Label><Input type="datetime-local" value={newEvent.date} onChange={e => setNewEvent({ ...newEvent, date: e.target.value })} data-testid="event-date" /></div>
              <div><Label>End</Label><Input type="datetime-local" value={newEvent.end_date} onChange={e => setNewEvent({ ...newEvent, end_date: e.target.value })} data-testid="event-end-date" /></div>
            </div>
            <div><Label>Location</Label><Input value={newEvent.location} onChange={e => setNewEvent({ ...newEvent, location: e.target.value })} placeholder="Office, Zoom link, address..." /></div>
            <div><Label>Notes</Label><Input value={newEvent.notes} onChange={e => setNewEvent({ ...newEvent, notes: e.target.value })} placeholder="Optional details" /></div>
            <div><Label>Invite (emails, comma separated)</Label><Input value={newEvent.invitees} onChange={e => setNewEvent({ ...newEvent, invitees: e.target.value })} placeholder="anna@company.com, bob@team.com" /></div>
            <div className="flex items-center justify-between py-1">
              <div><p className="text-sm font-medium text-slate-700">Blocks bookings</p><p className="text-[10px] text-slate-400">When on, this event prevents booking slots during this time</p></div>
              <Switch checked={newEvent.blocks_booking !== false} onCheckedChange={v => setNewEvent({...newEvent, blocks_booking: v})} />
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
                    <SelectTrigger className="text-xs"><SelectValue placeholder="Select..." /></SelectTrigger>
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
            <Button onClick={handleCreateEvent} className="w-full bg-[#3B0764] hover:bg-[#2e0550] text-white" data-testid="create-event-submit"><Plus className="w-4 h-4 mr-2" /> Create Event</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Event Detail / Edit / Invite Dialog */}
      <Dialog open={!!selectedEvent} onOpenChange={() => { setSelectedEvent(null); setEditingEvent(false); }}>
        <DialogContent className="max-w-md">
          {selectedEvent && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: typeColors[selectedEvent.type] || '#3B0764' }} />
                    <span>{editingEvent ? 'Edit Event' : selectedEvent.title}</span>
                  </div>
                  {!editingEvent && selectedEvent.type === 'event' && <Button size="sm" variant="outline" onClick={() => setEditingEvent(true)}>{t('common.edit')}</Button>}
                </DialogTitle>
              </DialogHeader>
              {editingEvent ? (
                <div className="space-y-3 pt-2">
                  <div><Label>Title</Label><Input value={editEventData.title || ''} onChange={e => setEditEventData({...editEventData, title: e.target.value})} /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Start</Label><Input type="datetime-local" value={editEventData.date ? editEventData.date.slice(0, 16) : ''} onChange={e => setEditEventData({...editEventData, date: e.target.value})} /></div>
                    <div><Label>End</Label><Input type="datetime-local" value={editEventData.end_date ? editEventData.end_date.slice(0, 16) : ''} onChange={e => setEditEventData({...editEventData, end_date: e.target.value})} /></div>
                  </div>
                  <div><Label>Notes</Label><Input value={editEventData.notes || ''} onChange={e => setEditEventData({...editEventData, notes: e.target.value})} /></div>
                  <div className="flex gap-2"><Button onClick={handleSaveEvent} className="bg-[#3B0764] text-white">{t('common.save')}</Button><Button variant="outline" onClick={() => setEditingEvent(false)}>{t('common.cancel')}</Button></div>
                </div>
              ) : (
                <div className="space-y-3 pt-2">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-50 rounded-lg p-3"><p className="text-xs text-slate-500">Start</p><p className="text-sm font-medium">{selectedEvent.date ? new Date(selectedEvent.date).toLocaleString() : '-'}</p></div>
                    <div className="bg-slate-50 rounded-lg p-3"><p className="text-xs text-slate-500">End</p><p className="text-sm font-medium">{selectedEvent.end_date ? new Date(selectedEvent.end_date).toLocaleString() : '-'}</p></div>
                  </div>
                  {selectedEvent.notes && <div className="bg-slate-50 rounded-lg p-3"><p className="text-xs text-slate-500 mb-1">Notes</p><p className="text-sm text-slate-700">{selectedEvent.notes}</p></div>}
                  {selectedEvent.member_name && <Badge variant="secondary">{selectedEvent.member_name}</Badge>}
                  {selectedEvent.invitees?.length > 0 && <div><p className="text-xs text-slate-500 mb-1">Invitees</p><div className="flex flex-wrap gap-1">{selectedEvent.invitees.map((e, i) => <Badge key={i} variant="outline" className="text-xs">{e}</Badge>)}</div></div>}
                  {selectedEvent.type === 'event' && (
                    <div className="border-t pt-3 space-y-2">
                      <p className="text-xs font-medium text-slate-700">Invite people</p>
                      <div className="flex gap-2"><Input value={inviteEmails} onChange={e => setInviteEmails(e.target.value)} placeholder="email@example.com" className="text-xs h-8" /><Button size="sm" className="h-8 bg-[#3B0764] text-white" onClick={handleInvite}>Send</Button></div>
                    </div>
                  )}
                  {selectedEvent.type === 'event' && <Button variant="outline" size="sm" className="text-red-500" onClick={() => handleDeleteEvent(selectedEvent.id)}><X className="w-3.5 h-3.5 mr-1" />{t('common.delete')}</Button>}
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
