import { useT } from '../useT';
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useAuth, API } from '../App';
import { useParams } from 'react-router-dom';
import DashboardLayout from '../components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Switch } from '../components/ui/switch';
import { Badge } from '../components/ui/badge';
import { toast } from 'sonner';
import axios from 'axios';
import { Camera, Upload, CheckSquare, Users, Zap, Mail, X, SwitchCamera } from 'lucide-react';

const CapturePage = () => {
  const { token, user } = useAuth();
  const { eventName: urlEvent } = useParams();
  const { t } = useT();
  const [eventName, setEventName] = useState(urlEvent || '');
  const [autoEmail, setAutoEmail] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [result, setResult] = useState(null);
  const [preview, setPreview] = useState(null);
  const fileRef = useRef(null);
  const cameraRef = useRef(null);

  // Live camera state
  const [cameraActive, setCameraActive] = useState(false);
  const [facingMode, setFacingMode] = useState('environment');
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  }, []);

  const startCamera = useCallback(async (facing) => {
    // Stop any existing stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing || facingMode, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setCameraActive(true);
    } catch (err) {
      console.error('Camera access denied:', err);
      // Fallback: open file picker with camera hint (mobile)
      if (cameraRef.current) cameraRef.current.click();
    }
  }, [facingMode]);

  const toggleFacing = useCallback(() => {
    const next = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(next);
    if (cameraActive) startCamera(next);
  }, [facingMode, cameraActive, startCamera]);

  // Cleanup camera on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const takeSnapshot = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], 'capture.jpg', { type: 'image/jpeg' });
        setPreview(URL.createObjectURL(blob));
        stopCamera();
        handleCapture(file);
      }
    }, 'image/jpeg', 0.92);
  }, [stopCamera]);

  const handleCapture = async (file) => {
    if (!file || !token) return;
    setCapturing(true);
    setResult(null);

    const formData = new FormData();
    formData.append('file', file);

    const params = new URLSearchParams();
    params.set('event_name', eventName || 'General');
    params.set('auto_email', autoEmail);

    try {
      const res = await axios.post(`${API}/capture?${params}`, formData, {
        headers: { Authorization: `Bearer ${token}` },
        withCredentials: true,
        timeout: 60000
      });
      setResult(res.data);
      toast.success(res.data.message || 'Lead captured!');
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.detail || 'Capture failed');
    } finally {
      setCapturing(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setPreview(URL.createObjectURL(file));
      handleCapture(file);
    }
  };

  const reset = () => {
    setResult(null);
    setPreview(null);
    if (fileRef.current) fileRef.current.value = '';
    if (cameraRef.current) cameraRef.current.value = '';
  };

  if (!token) {
    return <DashboardLayout><div className="p-6"><p className="text-slate-500">Loading...</p></div></DashboardLayout>;
  }

  return (
    <DashboardLayout>
      <div className="p-6 max-w-lg mx-auto space-y-6" data-testid="capture-page">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Lead Capture</h1>
          <p className="text-slate-500 text-sm mt-1">Snap a business card, create a lead instantly</p>
        </div>

        {/* Event Name */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <div>
              <Label>Event / Conference Name</Label>
              <Input value={eventName} onChange={e => setEventName(e.target.value)} placeholder="Web Summit 2026, DMEXCO, etc." data-testid="event-name" />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-700">Auto send follow-up email</p>
                <p className="text-xs text-slate-500">Send a "great meeting you" email immediately</p>
              </div>
              <Switch checked={autoEmail} onCheckedChange={setAutoEmail} data-testid="auto-email-toggle" />
            </div>
          </CardContent>
        </Card>

        {/* Live Camera View */}
        {cameraActive && !result && (
          <Card className="overflow-hidden">
            <CardContent className="p-0 relative">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full rounded-lg"
                style={{ maxHeight: '400px', objectFit: 'cover' }}
              />
              <canvas ref={canvasRef} className="hidden" />
              <div className="absolute bottom-4 left-0 right-0 flex items-center justify-center gap-4">
                <Button
                  size="icon"
                  variant="secondary"
                  className="w-10 h-10 rounded-full bg-white/80 backdrop-blur"
                  onClick={toggleFacing}
                >
                  <SwitchCamera className="w-5 h-5" />
                </Button>
                <Button
                  className="w-16 h-16 rounded-full bg-white border-4 border-[#0EA5A0] hover:bg-slate-100"
                  onClick={takeSnapshot}
                >
                  <div className="w-12 h-12 rounded-full bg-[#0EA5A0]" />
                </Button>
                <Button
                  size="icon"
                  variant="secondary"
                  className="w-10 h-10 rounded-full bg-white/80 backdrop-blur"
                  onClick={stopCamera}
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Capture Buttons */}
        {!result && !cameraActive && (
          <div className="space-y-3">
            <Button className="w-full h-16 bg-[#0EA5A0] hover:bg-[#0B8C88] text-white text-lg" onClick={() => startCamera()} disabled={capturing} data-testid="camera-btn">
              {capturing ? (
                <span className="flex items-center gap-2"><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> Processing...</span>
              ) : (
                <span className="flex items-center gap-2"><Camera className="w-6 h-6" /> Open Camera</span>
              )}
            </Button>
            <Button variant="outline" className="w-full h-12" onClick={() => fileRef.current?.click()} disabled={capturing}>
              <Upload className="w-5 h-5 mr-2" /> Upload Image
            </Button>
            <input ref={cameraRef} type="file" accept="image/*" capture="environment" onChange={handleFileChange} className="hidden" />
            <input ref={fileRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
          </div>
        )}

        {/* Preview */}
        {preview && capturing && (
          <Card>
            <CardContent className="p-4">
              <img src={preview} alt="Card" className="w-full rounded-lg" />
              <div className="flex items-center gap-2 mt-3 text-sm text-[#0EA5A0]">
                <div className="w-4 h-4 border-2 border-[#0EA5A0] border-t-transparent rounded-full animate-spin" />
                Extracting contact info with AI...
              </div>
            </CardContent>
          </Card>
        )}

        {/* Result */}
        {result && (
          <Card className="border-emerald-200 bg-emerald-50/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2 text-emerald-800">
                <CheckSquare className="w-5 h-5" /> Lead Captured
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {preview && <img src={preview} alt="Card" className="w-full rounded-lg mb-3" />}

              <div className="grid grid-cols-2 gap-2">
                {result.extracted?.first_name && (
                  <div className="bg-white rounded-lg p-2"><p className="text-[10px] text-slate-500">Name</p><p className="text-sm font-medium">{result.extracted.first_name} {result.extracted.last_name}</p></div>
                )}
                {result.extracted?.company && (
                  <div className="bg-white rounded-lg p-2"><p className="text-[10px] text-slate-500">Company</p><p className="text-sm font-medium">{result.extracted.company}</p></div>
                )}
                {result.extracted?.email && (
                  <div className="bg-white rounded-lg p-2"><p className="text-[10px] text-slate-500">Email</p><p className="text-sm font-medium">{result.extracted.email}</p></div>
                )}
                {result.extracted?.phone && (
                  <div className="bg-white rounded-lg p-2"><p className="text-[10px] text-slate-500">Phone</p><p className="text-sm font-medium">{result.extracted.phone}</p></div>
                )}
                {result.extracted?.job_title && (
                  <div className="bg-white rounded-lg p-2"><p className="text-[10px] text-slate-500">Title</p><p className="text-sm font-medium">{result.extracted.job_title}</p></div>
                )}
              </div>

              <div className="flex gap-2 flex-wrap">
                <Badge className="bg-[#0EA5A0] text-white">{result.event}</Badge>
                {result.follow_up === 'email_sent' && <Badge className="bg-emerald-100 text-emerald-700"><Mail className="w-3 h-3 mr-1" />Email sent</Badge>}
                {result.follow_up === 'task_created' && <Badge className="bg-amber-100 text-amber-700"><CheckSquare className="w-3 h-3 mr-1" />Task created</Badge>}
                {result.enrichment && <Badge className="bg-teal-100 text-teal-700"><Zap className="w-3 h-3 mr-1" />Enriched</Badge>}
              </div>

              {result.enrichment?.recommended_approach && (
                <div className="bg-white rounded-lg p-2">
                  <p className="text-[10px] text-slate-500">AI Recommendation</p>
                  <p className="text-xs text-slate-700">{result.enrichment.recommended_approach}</p>
                </div>
              )}

              <Button className="w-full bg-[#0EA5A0] hover:bg-[#0B8C88] text-white" onClick={reset} data-testid="capture-another">
                <Camera className="w-4 h-4 mr-2" /> Capture Another Card
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};

export default CapturePage;
