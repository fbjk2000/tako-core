import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { Shield, FileText, ArrowLeft, AlertCircle } from 'lucide-react';
import { API } from '../App';

/**
 * Public DPA page — FOLLOWUPS #4.
 *
 * The actual DPA text is being finalised with counsel. Until then this page
 * publishes the subprocessor inventory (GDPR Art. 28 transparency
 * requirement) and a contact address for procurement teams that need the
 * draft agreement. Data is fetched from GET /api/legal/dpa so the list can
 * be updated backend-side without redeploying the frontend.
 */
const DPAPage = () => {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    axios
      .get(`${API}/legal/dpa`)
      .then((res) => {
        if (!cancelled) setData(res.data);
      })
      .catch((err) => {
        if (!cancelled) setError(err?.response?.data?.detail || 'Could not load DPA information.');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center">
            <img src="/logo-horizontal.svg" alt="TAKO" className="h-7" />
          </Link>
          <Link to="/">
            <button className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 transition-colors">
              <ArrowLeft className="w-4 h-4" /> Back to Home
            </button>
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12">
        {/* Tab switcher — mirrors LegalPage so the three legal pages feel like siblings. */}
        <div className="flex gap-2 mb-8 flex-wrap">
          <Link to="/privacy" className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors bg-white border border-slate-200 text-slate-600 hover:border-slate-300">
            <Shield className="w-4 h-4" /> Privacy Policy
          </Link>
          <Link to="/terms" className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors bg-white border border-slate-200 text-slate-600 hover:border-slate-300">
            <FileText className="w-4 h-4" /> Terms of Service
          </Link>
          <Link to="/legal/dpa" className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors bg-[#0EA5A0] text-white">
            <FileText className="w-4 h-4" /> Data Processing Agreement
          </Link>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-8">
          <h1 className="text-2xl font-semibold text-slate-900 mb-1">Data Processing Agreement</h1>
          <p className="text-sm text-slate-500 mb-6">
            GDPR Art. 28 · Auftragsverarbeitungsvertrag
          </p>

          {error && (
            <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3 mb-6">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {data && (
            <>
              <div className="flex items-start gap-2 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-4 mb-8">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium mb-1">Status: {data.status}</p>
                  <p>{data.message}</p>
                </div>
              </div>

              <h2 className="text-lg font-semibold text-slate-900 mb-3">Subprocessors</h2>
              <p className="text-sm text-slate-600 mb-4">
                The third parties below process personal data on our behalf to deliver TAKO.
                Customers are notified at least 30 days in advance of any material change to this list.
              </p>

              <div className="overflow-x-auto">
                <table className="w-full text-sm border border-slate-200 rounded-lg overflow-hidden">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="text-left font-medium text-slate-700 px-4 py-2 border-b border-slate-200">Name</th>
                      <th className="text-left font-medium text-slate-700 px-4 py-2 border-b border-slate-200">Purpose</th>
                      <th className="text-left font-medium text-slate-700 px-4 py-2 border-b border-slate-200">Location</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.subprocessors || []).map((p) => (
                      <tr key={p.name} className="border-b border-slate-100 last:border-0">
                        <td className="px-4 py-2 text-slate-900 font-medium">{p.name}</td>
                        <td className="px-4 py-2 text-slate-600">{p.purpose}</td>
                        <td className="px-4 py-2 text-slate-600">{p.location}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <h2 className="text-lg font-semibold text-slate-900 mt-8 mb-3">Request the DPA</h2>
              <p className="text-sm text-slate-600">
                Email{' '}
                <a
                  href={`mailto:${data.contact_email || 'support@tako.software'}`}
                  className="text-[#0EA5A0] hover:underline"
                >
                  {data.contact_email || 'support@tako.software'}
                </a>{' '}
                with your company name and we'll send you the current draft for review.
              </p>
            </>
          )}

          {!data && !error && (
            <div className="text-sm text-slate-500">Loading…</div>
          )}
        </div>
      </main>

      <footer className="bg-slate-900 py-10 px-6 mt-12">
        <div className="max-w-4xl mx-auto text-center text-xs text-slate-400">
          <p>&copy; {new Date().getFullYear()} TAKO by Fintery Ltd. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default DPAPage;
