/**
 * DownloadPage — platform-only page customers land on after paying for a
 * self-hosted TAKO licence. Surfaces the latest packaged distribution and
 * hands off to /api/license/download for a signed URL.
 *
 * This page is stripped from the customer distribution by
 * scripts/build-distribution.sh — customers run their own TAKO instance and
 * don't re-download the product from it.
 */
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Download, CheckCircle2, ShieldCheck, Loader2 } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { useAuth, API } from '../App';

const formatBytes = (bytes) => {
  if (!bytes && bytes !== 0) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let n = bytes;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i += 1;
  }
  return `${n.toFixed(n >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
};

const DownloadPage = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [manifest, setManifest] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState(null);

  // Licence gate: if the user doesn't hold a valid licence, bounce them to
  // /pricing so they can purchase. Wait for auth to resolve first so we
  // don't redirect a legitimate customer who's mid-refresh.
  useEffect(() => {
    if (authLoading) return;
    if (!user) return; // ProtectedRoute handles /login redirect
    const status = user.organization_license_status;
    if (status && !['active', 'completed'].includes(status)) {
      navigate('/pricing', { replace: true });
    }
  }, [authLoading, user, navigate]);

  // Prefetch the manifest on mount so we can render version/size/hash
  // before the user clicks download.
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await axios.post(`${API}/license/download`);
        if (!cancelled) setManifest(res.data);
      } catch (e) {
        if (cancelled) return;
        const status = e?.response?.status;
        const detail = e?.response?.data?.detail;
        if (status === 403) {
          navigate('/pricing', { replace: true });
          return;
        }
        if (status === 503) {
          setError(
            detail ||
              'No distribution package is currently available. Please try again shortly.'
          );
        } else {
          setError(typeof detail === 'string' ? detail : 'Could not load download details.');
        }
      }
    };
    if (!authLoading && user) {
      load();
    }
    return () => {
      cancelled = true;
    };
  }, [authLoading, user, navigate]);

  const triggerDownload = async () => {
    if (downloading) return;
    setDownloading(true);
    try {
      // Always re-request a fresh signed URL — the previously-loaded manifest
      // may have expired (1h TTL), and we want the audit_log entry to reflect
      // the click that actually starts the transfer.
      const res = await axios.post(`${API}/license/download`);
      const signedUrl = res.data.download_url.startsWith('http')
        ? res.data.download_url
        : `${API.replace(/\/api$/, '')}${res.data.download_url}`;
      setManifest(res.data);
      // Trigger browser download. window.location.href would also work,
      // but an <a download> click avoids the nav-spinner flicker.
      const a = document.createElement('a');
      a.href = signedUrl;
      a.download = res.data.filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (e) {
      const detail = e?.response?.data?.detail;
      toast.error(typeof detail === 'string' ? detail : 'Download failed. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-[#0EA5A0]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-semibold text-slate-900 mb-2">Download TAKO CRM</h1>
          <p className="text-slate-600">
            Your package includes the full source code, Docker deployment files, and an installation guide.
          </p>
        </div>

        <Card className="p-6 md:p-8 bg-white shadow-sm">
          {error ? (
            <div className="text-center py-6">
              <p className="text-slate-700 mb-4">{error}</p>
              <a href="mailto:support@tako.software" className="text-[#0EA5A0] hover:underline">
                Contact support@tako.software
              </a>
            </div>
          ) : !manifest ? (
            <div className="flex items-center justify-center py-10 text-slate-500">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              Loading latest build…
            </div>
          ) : (
            <>
              <div className="flex items-start justify-between gap-4 pb-6 border-b border-slate-100">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <CheckCircle2 className="w-5 h-5 text-[#0EA5A0]" />
                    <span className="text-sm font-medium text-slate-700">Latest release</span>
                  </div>
                  <div className="text-2xl font-semibold text-slate-900">
                    TAKO CRM v{manifest.version}
                  </div>
                  <div className="text-sm text-slate-500 mt-1">
                    {manifest.filename} · {formatBytes(manifest.size)}
                  </div>
                </div>
                <Button
                  onClick={triggerDownload}
                  disabled={downloading}
                  className="bg-[#0EA5A0] hover:bg-[#0b8f8b] text-white"
                >
                  {downloading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Preparing…
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4 mr-2" />
                      Download
                    </>
                  )}
                </Button>
              </div>

              <div className="pt-6">
                <div className="flex items-center gap-2 mb-2">
                  <ShieldCheck className="w-4 h-4 text-slate-500" />
                  <span className="text-sm font-medium text-slate-700">Verify your download</span>
                </div>
                <p className="text-sm text-slate-600 mb-2">
                  After downloading, verify the SHA-256 matches:
                </p>
                <code className="block break-all text-xs bg-slate-50 border border-slate-200 rounded px-3 py-2 text-slate-800">
                  {manifest.sha256}
                </code>
                <p className="text-xs text-slate-500 mt-2">
                  <code>shasum -a 256 {manifest.filename}</code>
                </p>
              </div>
            </>
          )}
        </Card>

        <div className="mt-8 text-center text-sm text-slate-500">
          Need help? Email{' '}
          <a href="mailto:support@tako.software" className="text-[#0EA5A0] hover:underline">
            support@tako.software
          </a>
          .
        </div>
      </div>
    </div>
  );
};

export default DownloadPage;
