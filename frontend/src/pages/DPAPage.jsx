import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { Shield, FileText, ArrowLeft, AlertCircle, Download, CheckCircle2 } from 'lucide-react';
import { API } from '../App';

/**
 * Public DPA page.
 *
 * The DPA documents themselves live under backend/static/legal/ and are
 * served by /api/legal/dpa/download/{lang}. This page pulls metadata +
 * subprocessor inventory from GET /api/legal/dpa (so the list can be
 * updated backend-side without a redeploy), shows the English and German
 * versions as switchable tabs, and offers download buttons plus a clear
 * subprocessor table — the shape procurement teams expect during GDPR
 * vendor evaluation.
 */

const TABS = [
  { code: 'en', label: 'English' },
  { code: 'de', label: 'Deutsch' },
];

const COPY = {
  en: {
    heading: 'Data Processing Agreement',
    subheading: 'GDPR Art. 28 · Auftragsverarbeitungsvertrag',
    intro:
      'This agreement governs how TAKO (operated by Fintery Ltd) processes personal data on behalf of customers who use the TAKO CRM. It satisfies the requirements of Article 28 of the General Data Protection Regulation (GDPR).',
    downloadHeading: 'Download the agreement',
    downloadBody:
      'Download, sign, and return the agreement to privacy@tako.software. A countersigned copy will be returned to you for your records.',
    downloadButton: 'Download English version',
    subHeading: 'Subprocessors',
    subBody:
      'The third parties below process personal data on our behalf to deliver TAKO. Customers are notified at least 30 days in advance of any material change to this list.',
    cols: { name: 'Company', purpose: 'Purpose', location: 'Location', safeguard: 'Safeguard' },
    contactHeading: 'Questions',
    contactBody: 'Data protection enquiries — including subprocessor changes and signed DPA requests — go to',
    version: (v) => `Version ${v}`,
  },
  de: {
    heading: 'Auftragsverarbeitungsvertrag',
    subheading: 'DSGVO Art. 28 · Data Processing Agreement',
    intro:
      'Dieser Vertrag regelt, wie TAKO (betrieben von Fintery Ltd) personenbezogene Daten im Auftrag von Kunden verarbeitet, die das TAKO CRM nutzen. Er erfüllt die Anforderungen von Artikel 28 der Datenschutz-Grundverordnung (DSGVO).',
    downloadHeading: 'Vertrag herunterladen',
    downloadBody:
      'Bitte laden Sie den Vertrag herunter, unterschreiben Sie ihn und senden Sie ihn an privacy@tako.software zurück. Sie erhalten eine gegengezeichnete Kopie für Ihre Unterlagen.',
    downloadButton: 'Deutsche Version herunterladen',
    subHeading: 'Unterauftragsverarbeiter',
    subBody:
      'Die unten genannten Drittanbieter verarbeiten personenbezogene Daten in unserem Auftrag, um TAKO bereitzustellen. Änderungen an dieser Liste werden mindestens 30 Tage im Voraus angekündigt.',
    cols: { name: 'Unternehmen', purpose: 'Zweck', location: 'Standort', safeguard: 'Garantie' },
    contactHeading: 'Fragen',
    contactBody: 'Anfragen zum Datenschutz — inklusive Änderungen an Unterauftragsverarbeitern und gegengezeichneten AVV-Exemplaren — richten Sie an',
    version: (v) => `Version ${v}`,
  },
};

const DPAPage = () => {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [lang, setLang] = useState('en');

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

  const t = COPY[lang];
  const doc = data?.documents?.[lang];
  const contact = data?.contact || data?.contact_email || 'privacy@tako.software';

  // Build the download URL. The backend returns a relative /api/... path,
  // which we join with API's origin so downloads work regardless of the
  // deployment's backend host.
  const buildDownloadUrl = (relative) => {
    if (!relative) return null;
    try {
      // API is like "https://host/api" — strip the /api suffix and append the path.
      const origin = API.replace(/\/api\/?$/, '');
      return `${origin}${relative}`;
    } catch {
      return relative;
    }
  };

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
        {/* Sibling-legal-page tabs (Privacy / Terms / DPA). */}
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
          {/* Header — title + status + version. */}
          <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
            <div>
              <h1 className="text-2xl font-semibold text-slate-900 mb-1">{t.heading}</h1>
              <p className="text-sm text-slate-500">{t.subheading}</p>
            </div>
            {data?.status === 'active' && (
              <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-3 py-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Active {data?.version ? `· ${data.version}` : ''}
              </div>
            )}
          </div>

          {error && (
            <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3 mb-6">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {data && (
            <>
              {/* Language tabs. */}
              <div className="flex gap-1 mb-6 border-b border-slate-200">
                {TABS.map((tab) => {
                  const active = tab.code === lang;
                  return (
                    <button
                      key={tab.code}
                      type="button"
                      onClick={() => setLang(tab.code)}
                      className={`px-4 py-2 text-sm font-medium -mb-px border-b-2 transition-colors ${
                        active
                          ? 'border-[#0EA5A0] text-[#0EA5A0]'
                          : 'border-transparent text-slate-500 hover:text-slate-900'
                      }`}
                      data-testid={`dpa-lang-${tab.code}`}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              <p className="text-sm text-slate-700 leading-relaxed mb-8">{t.intro}</p>

              {/* Download block. */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-5 mb-10">
                <h2 className="text-base font-semibold text-slate-900 mb-1">{t.downloadHeading}</h2>
                <p className="text-sm text-slate-600 mb-4">{t.downloadBody}</p>
                {doc && (
                  <a
                    href={buildDownloadUrl(doc.download_url)}
                    target="_blank"
                    rel="noreferrer"
                    download
                    className="inline-flex items-center gap-2 rounded-lg bg-[#0EA5A0] hover:bg-[#0c9691] text-white font-medium text-sm px-4 py-2 transition-colors"
                    data-testid={`dpa-download-${lang}`}
                  >
                    <Download className="w-4 h-4" />
                    {t.downloadButton}
                    <span className="ml-1 text-xs uppercase opacity-80">· {doc.format}</span>
                  </a>
                )}
              </div>

              {/* Subprocessor table. */}
              <h2 className="text-lg font-semibold text-slate-900 mb-2">{t.subHeading}</h2>
              <p className="text-sm text-slate-600 mb-4">{t.subBody}</p>

              <div className="overflow-x-auto">
                <table className="w-full text-sm border border-slate-200 rounded-lg overflow-hidden">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="text-left font-medium text-slate-700 px-4 py-2 border-b border-slate-200">{t.cols.name}</th>
                      <th className="text-left font-medium text-slate-700 px-4 py-2 border-b border-slate-200">{t.cols.purpose}</th>
                      <th className="text-left font-medium text-slate-700 px-4 py-2 border-b border-slate-200">{t.cols.location}</th>
                      <th className="text-left font-medium text-slate-700 px-4 py-2 border-b border-slate-200">{t.cols.safeguard}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.subprocessors || []).map((p) => (
                      <tr key={p.name} className="border-b border-slate-100 last:border-0 align-top">
                        <td className="px-4 py-2 text-slate-900 font-medium">{p.name}</td>
                        <td className="px-4 py-2 text-slate-600">{p.purpose}</td>
                        <td className="px-4 py-2 text-slate-600 whitespace-nowrap">{p.location}</td>
                        <td className="px-4 py-2 text-slate-600">{p.safeguard || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Contact. */}
              <h2 className="text-lg font-semibold text-slate-900 mt-10 mb-2">{t.contactHeading}</h2>
              <p className="text-sm text-slate-600">
                {t.contactBody}{' '}
                <a href={`mailto:${contact}`} className="text-[#0EA5A0] hover:underline">
                  {contact}
                </a>
                .
              </p>

              {data?.version && (
                <p className="text-xs text-slate-400 mt-8">{t.version(data.version)}</p>
              )}
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
