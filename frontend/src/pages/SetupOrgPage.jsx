import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth, API } from '../App';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';
import { Building, Ticket, Loader2 } from 'lucide-react';

/**
 * Org-setup interstitial — FOLLOWUPS #14.
 *
 * Previously, any user who signed up without an invite code or an
 * organization_name was silently auto-joined to whatever org had claimed
 * their email domain first (cross-tenant leak). That path is gone; users
 * now land here with `organization_id === null` and pick explicitly:
 *
 *   - "Create organization" → POST /api/organizations?name=…
 *   - "I have an invite code" → POST /api/organizations/invites/accept?invite_code=…
 *
 * ProtectedRoute forces any authenticated user with no org through this
 * page before they can reach /dashboard or any data-bearing route.
 */
const SetupOrgPage = () => {
  const navigate = useNavigate();
  const { checkAuth, user } = useAuth();
  const [mode, setMode] = useState(null); // 'create' | 'invite' | null
  const [orgName, setOrgName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!orgName.trim() || submitting) return;
    setSubmitting(true);
    try {
      await axios.post(
        `${API}/organizations?name=${encodeURIComponent(orgName.trim())}`,
        {},
        { withCredentials: true }
      );
      // Refresh auth context so user.organization_id is populated before we
      // leave this route — otherwise ProtectedRoute bounces us straight back.
      await checkAuth();
      toast.success('Organization created');
      navigate('/dashboard', { replace: true });
    } catch (err) {
      const detail = err.response?.data?.detail;
      toast.error(typeof detail === 'string' ? detail : 'Could not create organization');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAccept = async (e) => {
    e.preventDefault();
    if (!inviteCode.trim() || submitting) return;
    setSubmitting(true);
    try {
      await axios.post(
        `${API}/organizations/invites/accept?invite_code=${encodeURIComponent(inviteCode.trim())}`,
        {},
        { withCredentials: true }
      );
      await checkAuth();
      toast.success('Joined organization');
      navigate('/dashboard', { replace: true });
    } catch (err) {
      const detail = err.response?.data?.detail;
      toast.error(typeof detail === 'string' ? detail : 'Invalid invitation code');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-xl">Welcome{user?.name ? `, ${user.name.split(' ')[0]}` : ''}</CardTitle>
          <p className="text-sm text-slate-600 mt-1">
            To get started, either create your own organization or join an
            existing one with an invitation code.
          </p>
        </CardHeader>
        <CardContent>
          {mode === null && (
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => setMode('create')}
                className="w-full flex items-center gap-3 p-4 rounded-lg border border-slate-200 hover:border-[#0EA5A0] hover:bg-teal-50 transition-colors text-left"
                data-testid="setup-org-create-btn"
              >
                <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center flex-shrink-0">
                  <Building className="w-5 h-5 text-[#0EA5A0]" />
                </div>
                <div>
                  <p className="font-medium text-slate-900">Create an organization</p>
                  <p className="text-sm text-slate-500">You'll be the owner. Invite teammates later.</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setMode('invite')}
                className="w-full flex items-center gap-3 p-4 rounded-lg border border-slate-200 hover:border-[#0EA5A0] hover:bg-teal-50 transition-colors text-left"
                data-testid="setup-org-invite-btn"
              >
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <Ticket className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="font-medium text-slate-900">I have an invitation code</p>
                  <p className="text-sm text-slate-500">Join a teammate's existing organization.</p>
                </div>
              </button>
            </div>
          )}

          {mode === 'create' && (
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="org-name">Organization name</Label>
                <Input
                  id="org-name"
                  placeholder="Acme Inc."
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  autoFocus
                  data-testid="setup-org-name-input"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setMode(null)}
                  disabled={submitting}
                >
                  Back
                </Button>
                <Button
                  type="submit"
                  disabled={!orgName.trim() || submitting}
                  className="flex-1 bg-[#0EA5A0] hover:bg-teal-700"
                  data-testid="setup-org-create-submit"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create organization'}
                </Button>
              </div>
            </form>
          )}

          {mode === 'invite' && (
            <form onSubmit={handleAccept} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="invite-code">Invitation code</Label>
                <Input
                  id="invite-code"
                  placeholder="Paste the code you received"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  autoFocus
                  data-testid="setup-org-invite-input"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setMode(null)}
                  disabled={submitting}
                >
                  Back
                </Button>
                <Button
                  type="submit"
                  disabled={!inviteCode.trim() || submitting}
                  className="flex-1 bg-[#0EA5A0] hover:bg-teal-700"
                  data-testid="setup-org-invite-submit"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Join organization'}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default SetupOrgPage;
