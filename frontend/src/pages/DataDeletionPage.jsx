import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API } from '../App';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { CheckCircle2, Clock, AlertCircle, Search } from 'lucide-react';

// Public page (no auth) — the confirmation_code itself is the capability token.
// Linked from Meta's data-deletion callback response and from the privacy policy.
const DataDeletionPage = () => {
  const { confirmationCode } = useParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lookupInput, setLookupInput] = useState('');

  const fetchStatus = async (code) => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get(`${API}/account/data-deletion/${code}`);
      setStatus(res.data);
    } catch (err) {
      if (err.response?.status === 404) {
        setError(
          'We could not find a deletion request with that code. Check the code you pasted, or contact privacy@tako.software.'
        );
      } else {
        setError(err.response?.data?.detail || 'Failed to fetch status. Please try again.');
      }
      setStatus(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (confirmationCode) fetchStatus(confirmationCode);
  }, [confirmationCode]);

  const onLookup = (e) => {
    e.preventDefault();
    const trimmed = lookupInput.trim();
    if (!trimmed) return;
    navigate(`/data-deletion/${trimmed}`);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-xl space-y-6">
        <div className="text-center">
          <a href="https://tako.software" className="inline-block">
            <img src="/logo-horizontal.svg" alt="TAKO" className="h-8 mx-auto" />
          </a>
          <h1 className="text-2xl font-bold text-slate-900 mt-4">Data deletion status</h1>
          <p className="text-sm text-slate-600 mt-1">
            Track the status of a data-deletion request you or Meta initiated.
          </p>
        </div>

        {!confirmationCode && !status && !loading && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Look up a request</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={onLookup} className="space-y-3">
                <Label htmlFor="code-input">Confirmation code</Label>
                <Input
                  id="code-input"
                  value={lookupInput}
                  onChange={(e) => setLookupInput(e.target.value)}
                  placeholder="Paste the code Meta showed you"
                  autoFocus
                />
                <Button type="submit" className="w-full bg-[#0EA5A0] hover:bg-teal-700">
                  <Search className="w-4 h-4 mr-2" /> Look up
                </Button>
              </form>
              <p className="text-xs text-slate-500 mt-4">
                Don't have a code? Request a deletion directly at{' '}
                <a href="mailto:privacy@tako.software" className="text-[#0EA5A0] hover:underline">
                  privacy@tako.software
                </a>
                .
              </p>
            </CardContent>
          </Card>
        )}

        {loading && (
          <Card>
            <CardContent className="py-10 flex justify-center">
              <div className="w-6 h-6 border-2 border-[#0EA5A0] border-t-transparent rounded-full animate-spin" />
            </CardContent>
          </Card>
        )}

        {error && (
          <Card className="border-rose-200 bg-rose-50/50">
            <CardContent className="p-6 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-slate-900">Not found</p>
                <p className="text-sm text-slate-600 mt-1">{error}</p>
                <Button variant="outline" size="sm" className="mt-4" onClick={() => navigate('/data-deletion')}>
                  Try a different code
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {status && (
          <StatusCard status={status} onRefresh={() => fetchStatus(status.confirmation_code)} />
        )}

        <div className="text-center text-xs text-slate-500">
          <a href="https://tako.software/privacy" className="hover:text-[#0EA5A0] hover:underline">
            Privacy policy
          </a>
          <span className="mx-2">·</span>
          <a href="mailto:privacy@tako.software" className="hover:text-[#0EA5A0] hover:underline">
            privacy@tako.software
          </a>
        </div>
      </div>
    </div>
  );
};

const StatusCard = ({ status, onRefresh }) => {
  const { confirmation_code, requested_at, completed_at, summary } = status;
  const isComplete = status.status === 'completed';
  const isFailed = status.status === 'failed';

  const icon = isComplete
    ? <CheckCircle2 className="w-6 h-6 text-emerald-600" />
    : isFailed
      ? <AlertCircle className="w-6 h-6 text-rose-600" />
      : <Clock className="w-6 h-6 text-amber-600" />;

  const headline = isComplete
    ? 'Deletion complete'
    : isFailed
      ? 'Deletion failed — we are investigating'
      : 'Deletion in progress';

  const tone = isComplete
    ? 'border-emerald-200 bg-emerald-50/50'
    : isFailed
      ? 'border-rose-200 bg-rose-50/50'
      : 'border-amber-200 bg-amber-50/50';

  return (
    <Card className={tone}>
      <CardContent className="p-6 space-y-4">
        <div className="flex items-start gap-3">
          {icon}
          <div className="flex-1">
            <p className="font-medium text-slate-900">{headline}</p>
            <p className="text-xs text-slate-500 mt-1">Confirmation code: <span className="font-mono">{confirmation_code}</span></p>
          </div>
          {!isComplete && !isFailed && (
            <Button variant="outline" size="sm" onClick={onRefresh}>Refresh</Button>
          )}
        </div>

        <dl className="grid grid-cols-2 gap-3 text-sm">
          <dt className="text-slate-500">Requested</dt>
          <dd className="text-slate-900">{new Date(requested_at).toLocaleString()}</dd>
          {completed_at && (
            <>
              <dt className="text-slate-500">Completed</dt>
              <dd className="text-slate-900">{new Date(completed_at).toLocaleString()}</dd>
            </>
          )}
          {summary && (
            <>
              <dt className="text-slate-500">Tokens removed</dt>
              <dd className="text-slate-900">{summary.tokens_removed ?? 0}</dd>
              <dt className="text-slate-500">Listeners paused</dt>
              <dd className="text-slate-900">{summary.listeners_paused ?? 0}</dd>
              <dt className="text-slate-500">Workspaces affected</dt>
              <dd className="text-slate-900">{summary.affected_orgs ?? 0}</dd>
            </>
          )}
        </dl>

        {isComplete && (
          <p className="text-sm text-slate-600 pt-2 border-t border-slate-200">
            Your Meta access token and cached Page data have been removed from Tako. Any Listener that
            depended on this connection has been paused. For further removal (e.g., historical post
            content retained under our 90-day policy), email{' '}
            <a href="mailto:privacy@tako.software" className="text-[#0EA5A0] hover:underline">
              privacy@tako.software
            </a>
            .
          </p>
        )}

        {isFailed && (
          <p className="text-sm text-slate-600 pt-2 border-t border-slate-200">
            We recorded the request but encountered an error while processing it. Our team has been
            alerted and will complete the deletion within 24 hours. You may also email{' '}
            <a href="mailto:privacy@tako.software" className="text-[#0EA5A0] hover:underline">
              privacy@tako.software
            </a>{' '}
            referencing the confirmation code above.
          </p>
        )}
      </CardContent>
    </Card>
  );
};

export default DataDeletionPage;
