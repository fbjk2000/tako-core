/**
 * ChangelogPage — public release history at tako.software/changelog.
 *
 * Backed by GET /api/releases (last 20 releases, newest first). Entries are
 * written by the super_admin /api/admin/releases/notify endpoint whenever a
 * new version is tagged. Rendering is intentionally plain — date, version
 * heading, changelog body — so it reads like release notes rather than a
 * marketing page.
 *
 * This file is platform-only. scripts/build-distribution.sh deletes it and
 * strips the /changelog route from App.js.
 */
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { API } from '../App';
import { Card, CardContent } from '../components/ui/card';
import { Loader2 } from 'lucide-react';

const formatDate = (iso) => {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric', month: 'long', day: 'numeric',
    });
  } catch {
    return iso;
  }
};

const ChangelogPage = () => {
  const [releases, setReleases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await axios.get(`${API}/releases`);
        if (!cancelled) setReleases(Array.isArray(res.data) ? res.data : []);
      } catch (e) {
        if (!cancelled) setError('Could not load changelog.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <Link to="/" className="text-sm text-[#0EA5A0] hover:underline">
            ← Back to tako.software
          </Link>
          <h1 className="text-3xl font-semibold text-slate-900 mt-3">
            Changelog
          </h1>
          <p className="text-slate-600 mt-2">
            Release history for TAKO CRM. Customers with active maintenance can
            download the latest version from their{' '}
            <Link to="/download" className="text-[#0EA5A0] hover:underline">
              account
            </Link>.
          </p>
        </div>

        {loading && (
          <div className="flex items-center gap-2 text-slate-500">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading releases…
          </div>
        )}

        {!loading && error && (
          <p className="text-sm text-rose-600" data-testid="changelog-error">
            {error}
          </p>
        )}

        {!loading && !error && releases.length === 0 && (
          <Card>
            <CardContent className="py-10 text-center text-slate-500">
              No releases yet. Check back soon.
            </CardContent>
          </Card>
        )}

        <div className="space-y-4" data-testid="changelog-list">
          {releases.map((r) => (
            <Card key={r.version} data-testid={`changelog-entry-${r.version}`}>
              <CardContent className="py-5">
                <div className="flex items-baseline justify-between gap-4 flex-wrap">
                  <h2 className="text-xl font-semibold text-slate-900">
                    v{r.version}
                  </h2>
                  <span className="text-sm text-slate-500">
                    {formatDate(r.released_at)}
                  </span>
                </div>
                {r.changelog && (
                  <div
                    className="mt-3 text-sm text-slate-700 whitespace-pre-wrap leading-relaxed"
                  >
                    {r.changelog}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ChangelogPage;
