import { useT } from '../useT';
import React, { useState, useEffect } from 'react';
import { useAuth, API } from '../App';
import { useParams } from 'react-router-dom';
import DashboardLayout from '../components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Badge } from '../components/ui/badge';
import { Calendar } from '../components/ui/calendar';
import { toast } from 'sonner';
import axios from 'axios';
import { Clock, CheckSquare, Settings, Copy, Users, X } from 'lucide-react';

const BookingPage = () => {
  const { token, user } = useAuth();
  const { t } = useT();
  const [bookings, setBookings] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [editSettings, setEditSettings] = useState({});

  useEffect(() => {
    if (!token) { setLoading(false); return; }
    
    const load = async () => {
      try {
        const cfg = { headers: { Authorization: `Bearer ${token}` }, withCredentials: true };
        const [bRes, sRes] = await Promise.allSettled([
          axios.get(`${API}/bookings`, cfg),
          axios.get(`${API}/booking/settings`, cfg)
        ]);
        if (bRes.status === 'fulfilled' && Array.isArray(bRes.value.data)) setBookings(bRes.value.data);
        if (sRes.status === 'fulfilled' && sRes.value.data) { setSettings(sRes.value.data); setEditSettings(sRes.value.data); }
      } catch (err) {
        console.error('Bookings load error:', err);
      }
      setLoading(false);
    };
    load();
  }, [token]);

  const saveSettings = async () => {
    if (!token) return;
    try {
      const { user_id, ...data } = editSettings;
      const cfg = { headers: { Authorization: `Bearer ${token}` }, withCredentials: true };
      await axios.put(`${API}/booking/settings`, data, cfg);
      toast.success('Settings saved');
      setShowSettings(false);
      const r = await axios.get(`${API}/booking/settings`, cfg);
      if (r.data) { setSettings(r.data); setEditSettings(r.data); }
    } catch (err) { console.error(err); toast.error('Failed to save'); }
  };

  const bookingLink = (user && user.user_id) ? `${window.location.origin}/book/${user.user_id}` : '';
  
  const copyLink = () => {
    if (!bookingLink) return;
    try { navigator.clipboard.writeText(bookingLink); toast.success('Booking link copied!'); }
    catch (err) { console.error(err); toast.error('Could not copy link'); }
  };

  const statusColors = { confirmed: 'bg-emerald-100 text-emerald-700', cancelled: 'bg-red-100 text-red-600', completed: 'bg-blue-100 text-blue-700' };

  if (!token) {
    return <DashboardLayout><div className="p-6"><p className="text-slate-500">Loading...</p></div></DashboardLayout>;
  }

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6" data-testid="booking-page">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{ t('bookings.title') }</h1>
            <p className="text-slate-500 text-sm mt-1">{ t('bookings.subtitle') }</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowSettings(true)} data-testid="booking-settings-btn"><Settings className="w-4 h-4 mr-1" /> { t('bookings.settings') }</Button>
            <Button variant="outline" onClick={copyLink} data-testid="copy-booking-link"><Copy className="w-4 h-4 mr-1" /> { t('bookings.copyLink') }</Button>
            <Button className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white" onClick={() => { if (user) window.open(`/book/${user.user_id}`, '_blank'); }} data-testid="preview-booking">{ t('bookings.preview') }</Button>
          </div>
        </div>

        {bookingLink && (
          <Card className="bg-purple-50 border-purple-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-purple-900">{ t('bookings.bookingPage') }</p>
                  <p className="text-sm text-purple-700 font-mono mt-1">{bookingLink}</p>
                </div>
                <Button size="sm" variant="outline" onClick={copyLink}><Copy className="w-3.5 h-3.5 mr-1" /> { t('bookings.copyLink') }</Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{ t('bookings.upcoming') }</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-[#7C3AED] border-t-transparent rounded-full animate-spin" /></div>
            ) : bookings.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <Clock className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                <p className="font-medium">{ t('bookings.noBookings') }</p>
                <p className="text-sm mt-1">{ t('bookings.noBookingsDesc') }</p>
              </div>
            ) : (
              <div className="space-y-3">
                {bookings.map(b => (
                  <div key={b.booking_id} className="flex items-center justify-between p-3 border rounded-lg" data-testid={`booking-${b.booking_id}`}>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                        <Users className="w-5 h-5 text-[#7C3AED]" />
                      </div>
                      <div>
                        <p className="font-medium text-slate-900">{b.guest_name || 'Guest'}</p>
                        <p className="text-xs text-slate-500">{b.guest_email || ''}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-sm font-medium">{b.start_time ? new Date(b.start_time).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) : ''}</p>
                        <p className="text-xs text-slate-500">{b.start_time ? new Date(b.start_time).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : ''} ({b.duration || 30}min)</p>
                      </div>
                      <Badge className={statusColors[b.status] || 'bg-slate-100'}>{b.status || 'pending'}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={showSettings} onOpenChange={setShowSettings}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>{ t('bookings.settings') }</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Start Time</Label><Input value={editSettings?.working_hours_start || '09:00'} onChange={e => setEditSettings({...editSettings, working_hours_start: e.target.value})} type="time" /></div>
                <div><Label>End Time</Label><Input value={editSettings?.working_hours_end || '17:00'} onChange={e => setEditSettings({...editSettings, working_hours_end: e.target.value})} type="time" /></div>
              </div>
              <div><Label>Buffer (min)</Label><Input type="number" value={editSettings?.buffer_minutes || 15} onChange={e => setEditSettings({...editSettings, buffer_minutes: parseInt(e.target.value) || 15})} /></div>
              <div><Label>Timezone</Label><Input value={editSettings?.timezone || 'Europe/London'} onChange={e => setEditSettings({...editSettings, timezone: e.target.value})} /></div>
              <div><Label>Welcome Message</Label><Textarea value={editSettings?.welcome_message || ''} onChange={e => setEditSettings({...editSettings, welcome_message: e.target.value})} rows={2} /></div>
              <Button onClick={saveSettings} className="w-full bg-[#7C3AED] hover:bg-[#6D28D9] text-white">{ t('common.save') }</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

// Public Booking Page (no auth required)
export const PublicBookingPage = () => {
  const { userId } = useParams();
  const [selectedDate, setSelectedDate] = useState(null);
  const [slots, setSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [duration, setDuration] = useState(30);
  const [form, setForm] = useState({ name: '', email: '', phone: '', notes: '' });
  const [booked, setBooked] = useState(false);
  const [loading, setLoading] = useState(false);

  const fetchSlots = async (date) => {
    if (!date || !userId) return;
    const dateStr = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
    try {
      const r = await axios.get(`${API}/booking/${userId}/available?date=${dateStr}&duration=${duration}`);
      setSlots(r.data?.slots || []);
    } catch (err) { console.error(err); setSlots([]); }
  };

  const handleDateSelect = (date) => {
    setSelectedDate(date);
    setSelectedSlot(null);
    if (date) fetchSlots(date);
  };

  const handleBook = async () => {
    if (!selectedSlot || !form.name || !form.email) return;
    setLoading(true);
    try {
      await axios.post(`${API}/booking/${userId}/book?name=${encodeURIComponent(form.name)}&email=${encodeURIComponent(form.email)}&start_time=${encodeURIComponent(selectedSlot.start)}&duration=${duration}&notes=${encodeURIComponent(form.notes || '')}&phone=${encodeURIComponent(form.phone || '')}`);
      setBooked(true);
    } catch (e) { toast.error(e.response?.data?.detail || 'Booking failed'); }
    finally { setLoading(false); }
  };

  if (booked) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
            <CheckSquare className="w-8 h-8 text-emerald-600" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Meeting Confirmed!</h2>
          <p className="text-slate-600 mb-4">Check your email for confirmation details and calendar invite.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <Card className="max-w-2xl w-full">
        <CardHeader className="text-center border-b">
          <img src="/logo-horizontal.svg" alt="earnrm" className="h-8 mx-auto mb-3" />
          <CardTitle className="text-xl">Book a Meeting</CardTitle>
          <CardDescription>Select a date and time that works for you</CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium mb-2 block">Duration</Label>
                <div className="flex gap-2">
                  {[15, 30, 60].map(d => (
                    <Button key={d} variant={duration === d ? 'default' : 'outline'} size="sm" onClick={() => { setDuration(d); if (selectedDate) fetchSlots(selectedDate); }}
                      className={duration === d ? 'bg-[#7C3AED]' : ''}>{d} min</Button>
                  ))}
                </div>
              </div>
              <Calendar mode="single" selected={selectedDate} onSelect={handleDateSelect} disabled={(d) => d < new Date(new Date().setHours(0,0,0,0)) || [5,6].includes(d.getDay())} className="rounded-md border" />
            </div>

            <div className="space-y-4">
              {selectedDate ? (
                <>
                  <div>
                    <Label className="text-sm font-medium mb-2 block">
                      {selectedDate.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
                    </Label>
                    {slots.length === 0 ? (
                      <p className="text-sm text-slate-500 py-4">No available slots for this date</p>
                    ) : (
                      <div className="grid grid-cols-3 gap-2 max-h-[200px] overflow-y-auto">
                        {slots.map(s => (
                          <Button key={s.start} variant={selectedSlot?.start === s.start ? 'default' : 'outline'} size="sm"
                            className={selectedSlot?.start === s.start ? 'bg-[#7C3AED]' : ''} onClick={() => setSelectedSlot(s)}>
                            {s.display}
                          </Button>
                        ))}
                      </div>
                    )}
                  </div>
                  {selectedSlot && (
                    <div className="space-y-3 border-t pt-4">
                      <div><Label>Your Name *</Label><Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="John Doe" /></div>
                      <div><Label>Email *</Label><Input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} placeholder="john@example.com" /></div>
                      <div><Label>Phone</Label><Input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} placeholder="+44..." /></div>
                      <div><Label>Notes</Label><Textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} rows={2} placeholder="What would you like to discuss?" /></div>
                      <Button onClick={handleBook} disabled={loading || !form.name || !form.email} className="w-full bg-[#7C3AED] hover:bg-[#6D28D9] text-white">
                        {loading ? 'Booking...' : `Confirm ${duration}min Meeting`}
                      </Button>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm text-slate-500 py-8 text-center">Select a date to see available times</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default BookingPage;
