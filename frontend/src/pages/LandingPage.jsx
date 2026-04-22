import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';

// ─── i18n data ────────────────────────────────────────────────────────────────

const AGENTS_DATA = [
  { id: 'pipeline', angle: 201 },
  { id: 'leads',    angle: 127 },
  { id: 'email',    angle: 90  },
  { id: 'calling',  angle: 164 },
  { id: 'calendar', angle: 339 },
  { id: 'research', angle: 53  },
  { id: 'analytics',angle: 16  },
  { id: 'projects', angle: 302 },
];

const AGENTS_I18N = {
  en: [
    { name:'Pipeline', sub:'Visual deal flow', id:'pipeline', angle:201, cardTitle:'Pipeline Management', cardDesc:'Drag deals between stages. Kanban and list views. Lost deals excluded from forecasts automatically. Always know where every deal stands.', outcome:'→ Clear forecast, zero guesswork' },
    { name:'Lead Scoring', sub:'AI-ranked 1–100', id:'leads', angle:127, cardTitle:'AI Lead Scoring', cardDesc:'Every lead ranked 1 to 100 based on fit, engagement, and conversion signals. Your reps call the right people first — every time.', outcome:'→ Higher conversion, less wasted effort' },
    { name:'Email', sub:'AI-drafted outreach', id:'email', angle:90, cardTitle:'AI Email Drafting', cardDesc:'Generate personalised outreach in seconds. Choose tone, context, and purpose. One click to send. Follow-ups queued automatically.', outcome:'→ 3× more outreach, same headcount' },
    { name:'Calling', sub:'Record & transcribe', id:'calling', angle:164, cardTitle:'Outbound Calling', cardDesc:'Call leads directly from the CRM. Every call recorded, transcribed by AI, and turned into action items. No notes, no missed follow-ups.', outcome:'→ Full call history, automatic follow-up' },
    { name:'Calendar', sub:'Smart scheduling', id:'calendar', angle:339, cardTitle:'Calendar & Booking', cardDesc:'Built-in calendar with Google Calendar sync. Share your booking link. Confirmations and reminders sent automatically. No scheduling ping-pong.', outcome:'→ Meetings booked without the back-and-forth' },
    { name:'Research', sub:'Prospect intelligence', id:'research', angle:53, cardTitle:'Prospect Intelligence', cardDesc:'Real-time research on companies and contacts. Funding rounds, hiring signals, tech stack, recent news — all surfaced before the call.', outcome:'→ Walk into every call prepared' },
    { name:'Analytics', sub:'Reports & forecasts', id:'analytics', angle:16, cardTitle:'Analytics & Reporting', cardDesc:"Real-time dashboards, custom reports, and predictive forecasts. See what's working, what's stalling, and where to intervene.", outcome:'→ Data-driven decisions, not gut feelings' },
    { name:'Projects', sub:'Team task boards', id:'projects', angle:302, cardTitle:'Team Projects', cardDesc:'Group tasks under deals. Track progress across your team. Every project gets its own chat channel for real-time coordination.', outcome:'→ Nothing falls through the cracks' },
  ],
  de: [
    { name:'Pipeline', sub:'Visueller Deal-Fluss', id:'pipeline', angle:201, cardTitle:'Pipeline-Management', cardDesc:'Deals per Drag & Drop zwischen Phasen verschieben. Kanban- und Listenansicht. Verlorene Deals automatisch aus Prognosen ausgeschlossen.', outcome:'→ Klare Prognose, keine Ungewissheit' },
    { name:'Lead-Scoring', sub:'KI-Ranking 1–100', id:'leads', angle:127, cardTitle:'KI-Lead-Scoring', cardDesc:'Jeder Lead wird auf einer Skala von 1 bis 100 bewertet — basierend auf Fit, Engagement und Conversion-Signalen. Ihre Vertriebsmitarbeiter rufen zuerst die richtigen Personen an.', outcome:'→ Höhere Conversion, weniger Streuverlust' },
    { name:'E-Mail', sub:'KI-verfasste Ansprache', id:'email', angle:90, cardTitle:'KI-E-Mail-Erstellung', cardDesc:'Personalisierte Ansprachen in Sekunden generieren. Ton, Kontext und Zweck wählen. Ein Klick zum Senden. Follow-ups automatisch in der Warteschlange.', outcome:'→ 3× mehr Outreach, gleiche Kapazität' },
    { name:'Anrufen', sub:'Aufzeichnen & transkribieren', id:'calling', angle:164, cardTitle:'Outbound-Telefonie', cardDesc:'Leads direkt aus dem CRM anrufen. Jeder Anruf wird aufgezeichnet, von KI transkribiert und in To-dos umgewandelt. Keine Notizen, keine verpassten Follow-ups.', outcome:'→ Vollständige Anrufhistorie, automatisches Follow-up' },
    { name:'Kalender', sub:'Intelligente Terminplanung', id:'calendar', angle:339, cardTitle:'Kalender & Buchung', cardDesc:'Integrierter Kalender mit Google-Calendar-Sync. Buchungslink teilen. Bestätigungen und Erinnerungen werden automatisch versendet.', outcome:'→ Meetings ohne Hin-und-her buchen' },
    { name:'Recherche', sub:'Interessenten-Insights', id:'research', angle:53, cardTitle:'Interessenten-Intelligenz', cardDesc:'Echtzeit-Recherche zu Unternehmen und Kontakten. Finanzierungsrunden, Einstellungssignale, Tech-Stack, aktuelle Nachrichten — alles vor dem Anruf verfügbar.', outcome:'→ Bestens vorbereitet in jeden Anruf' },
    { name:'Analytics', sub:'Berichte & Prognosen', id:'analytics', angle:16, cardTitle:'Analytics & Reporting', cardDesc:'Echtzeit-Dashboards, benutzerdefinierte Berichte und prädiktive Prognosen. Sehen Sie, was funktioniert, was stockt und wo Sie eingreifen müssen.', outcome:'→ Datenbasierte Entscheidungen statt Bauchgefühl' },
    { name:'Projekte', sub:'Team-Aufgabenboards', id:'projects', angle:302, cardTitle:'Team-Projekte', cardDesc:'Aufgaben unter Deals gruppieren. Fortschritt im gesamten Team verfolgen. Jedes Projekt bekommt einen eigenen Chat-Kanal für die Abstimmung in Echtzeit.', outcome:'→ Nichts geht mehr verloren' },
  ],
};

const OUTCOMES_I18N = {
  en: [
    { number: '8', stat: 'AI agents per user', desc: 'Each handles a different part of your sales process — from prospecting to closing.' },
    { number: '3×', stat: 'More outreach capacity', desc: 'AI drafts emails, scores leads, and books meetings. Your reps sell more with the same hours.' },
    { number: '100%', stat: 'Your data, your control', desc: 'Self-hosted on your infrastructure. Full source code. No US cloud dependency. No vendor lock-in.' },
  ],
  de: [
    { number: '8', stat: 'KI-Agenten pro Nutzer', desc: 'Jeder übernimmt einen anderen Teil Ihres Vertriebsprozesses — von der Akquise bis zum Abschluss.' },
    { number: '3×', stat: 'Mehr Outreach-Kapazität', desc: 'KI entwirft E-Mails, bewertet Leads und bucht Meetings. Ihre Vertriebsmitarbeiter verkaufen mehr in derselben Zeit.' },
    { number: '100%', stat: 'Ihre Daten, Ihre Kontrolle', desc: 'Selbst gehostet auf Ihrer Infrastruktur. Vollständiger Quellcode. Keine US-Cloud-Abhängigkeit. Kein Vendor-Lock-in.' },
  ],
};

const VALUE_I18N = {
  en: [
    { bold: 'Spend less time updating CRM', desc: '— agents log calls, emails, and deal changes as they happen.' },
    { bold: 'Follow up faster', desc: '— AI queues the next action so nothing sits idle.' },
    { bold: 'Prepare calls better', desc: '— prospect research is surfaced before you dial.' },
    { bold: 'Keep pipeline cleaner', desc: '— stale deals flagged, stages updated, forecasts accurate.' },
    { bold: 'Reduce dropped leads', desc: '— scoring and alerts ensure hot leads get attention immediately.' },
    { bold: 'Work with more consistency', desc: '— every rep follows the same process, powered by the same agents.' },
  ],
  de: [
    { bold: 'Weniger Zeit mit CRM-Pflege', desc: '— Agenten protokollieren Anrufe, E-Mails und Deal-Änderungen automatisch.' },
    { bold: 'Schneller nachfassen', desc: '— KI stellt die nächste Aktion in die Warteschlange, damit nichts liegen bleibt.' },
    { bold: 'Anrufe besser vorbereiten', desc: '— Interessenten-Recherche wird vor dem Wählen angezeigt.' },
    { bold: 'Pipeline sauber halten', desc: '— veraltete Deals markiert, Phasen aktualisiert, Prognosen korrekt.' },
    { bold: 'Weniger verlorene Leads', desc: '— Scoring und Benachrichtigungen sorgen dafür, dass heiße Leads sofort Aufmerksamkeit erhalten.' },
    { bold: 'Konsistenter arbeiten', desc: '— jeder Vertriebsmitarbeiter folgt demselben Prozess, unterstützt von denselben Agenten.' },
  ],
};

const PROOF_I18N = {
  en: [
    { quote: '"We replaced three tools with TAKO. Pipeline visibility went from guesswork to real time."', name: 'Marcus W.', role: 'Head of Sales, SaaS (Berlin)' },
    { quote: '"The AI scoring saves us hours every week. We only call leads that actually convert."', name: 'Sophie L.', role: 'Sales Director, Agency (Paris)' },
    { quote: '"Finally a CRM that doesn\'t feel like it was built for a Fortune 500 IT department."', name: 'James R.', role: 'Founder, Consulting (London)' },
  ],
  de: [
    { quote: '"Wir haben drei Tools durch TAKO ersetzt. Die Pipeline-Transparenz wurde von Rätselraten zu Echtzeit."', name: 'Marcus W.', role: 'Head of Sales, SaaS (Berlin)' },
    { quote: '"Das KI-Scoring spart uns jede Woche Stunden. Wir rufen nur noch Leads an, die wirklich konvertieren."', name: 'Sophie L.', role: 'Sales Director, Agency (Paris)' },
    { quote: '"Endlich ein CRM, das sich nicht anfühlt, als wäre es für eine Fortune-500-IT-Abteilung gebaut worden."', name: 'James R.', role: 'Founder, Consulting (London)' },
  ],
};

const EU_I18N = {
  en: [
    { title: 'EU Infrastructure', desc: 'Your data lives in Frankfurt. Enterprise-grade hosting with daily backups and 99.99% uptime SLA. No transatlantic data transfers.' },
    { title: 'GDPR Native', desc: 'Built for compliance from day one. Data Processing Agreements, right to erasure, full audit logs, and transparent data handling — not bolted on.' },
    { title: 'Self-Hostable', desc: 'Deploy TAKO on your own infrastructure. Docker, Kubernetes, or traditional VMs. Your data never leaves your servers if you don\'t want it to.' },
  ],
  de: [
    { title: 'EU-Infrastruktur', desc: 'Ihre Daten liegen in Frankfurt. Enterprise-Hosting mit täglichen Backups und 99,99 % Uptime-SLA. Keine transatlantischen Datenübertragungen.' },
    { title: 'DSGVO-nativ', desc: 'Von Anfang an für Compliance gebaut. Datenverarbeitungsverträge, Recht auf Löschung, vollständige Audit-Logs und transparente Datenverarbeitung — nicht nachträglich hinzugefügt.' },
    { title: 'Selbst hostbar', desc: 'Deployen Sie TAKO auf Ihrer eigenen Infrastruktur. Docker, Kubernetes oder klassische VMs. Ihre Daten verlassen Ihre Server nie, wenn Sie das nicht möchten.' },
  ],
};

// Brief three-column pricing summary shown on the landing page. Full details
// live on /pricing. Prices are EUR only and shared across locales — only the
// text labels differ by language.
const PRICING_SUMMARY_I18N = {
  en: [
    { label: 'Pay Once',             price: '€5,000',    note: 'one-time' },
    { label: '12 Monthly Payments',  price: '12 × €500', note: '€6,000 total' },
    { label: '24 Monthly Payments',  price: '24 × €300', note: '€7,200 total' },
  ],
  de: [
    { label: 'Einmalzahlung',        price: '€5.000',    note: 'einmalig' },
    { label: '12 Monatsraten',       price: '12 × €500', note: '€6.000 gesamt' },
    { label: '24 Monatsraten',       price: '24 × €300', note: '€7.200 gesamt' },
  ],
};

const I18N_EN = {
  navFeatures: 'Features',
  navPricing: 'Pricing',
  navSupport: 'Support',
  navAgents: 'Agents',
  signIn: 'Sign in',
  navCta: 'See Pricing',
  heroBadge: 'The AI-first CRM for European sales teams',
  heroTitle: 'Eight agents.\nOne CRM.\nNo busywork.',
  heroDesc: 'TAKO gives every sales rep a team of eight AI agents — handling pipeline, emails, calls, scoring, research and scheduling. Your team just closes.',
  heroCtaPrimary: 'See Pricing',
  heroCtaSecondary: 'Try the Demo',
  trustGdpr: 'GDPR compliant',
  trustEu: 'EU hosted · Frankfurt',
  trustSoc: 'SOC 2 in progress',
  trustSelfhost: 'Self-hosted · Your server',
  trustUptime: '99.99% uptime SLA',
  outcomesTag: 'By the numbers',
  outcomesTitle: 'Results that move the needle',
  valueTag: 'What changes',
  valueTitle: 'What your team stops doing manually',
  valueDesc: 'TAKO agents run in the background. Your reps stay focused on conversations that close.',
  agentsTag: 'The eight agents',
  agentsTitle: 'Every agent. One platform.',
  archTag: 'Architecture',
  archTitle: 'One brain. Eight arms.',
  archDesc: 'TAKO\'s agent model is designed around how sales actually works — parallel, contextual, and always connected. The octopus isn\'t a metaphor. It\'s the architecture.',
  archNote: 'Each agent learns from your data independently. The orchestration layer connects them — so a lead scored high by one agent gets prioritised in the pipeline, queued for a call, and drafted an email without you lifting a finger. Click any arm to explore that agent.',
  proofTag: 'Social proof',
  proofTitle: 'Built for teams that sell across Europe',
  euTag: 'Data sovereignty',
  euTitle: 'Your data stays in Europe',
  euDesc: 'We built TAKO for European privacy standards — not as an afterthought, but as a foundation.',
  pricingTag: 'Pricing',
  pricingTitle: 'One product. One price. Unlimited users.',
  pricingDesc: 'Full source code. 12 months support included. 30-day money-back guarantee.',
  pricingCta: 'See full pricing →',
  finalTitle: 'Ready to sell smarter?',
  finalDesc: 'Built for European sales teams that want results, not complexity.',
  finalCtaPrimary: 'See Pricing',
  finalCtaSecondary: 'Sign in',
  footerTagline: 'The CRM that runs your marketing and sales. Built for European teams that want results, not complexity.',
  footerCompany: 'Fintery Ltd.',
  footerAddress1: 'Canbury Works, Units 6 and 7, Canbury Business Park',
  footerAddress2: 'Kingston upon Thames, Surrey, KT2 6HJ, UK',
  footerProduct: 'Product',
  footerFeatures: 'Features',
  footerPricing: 'Pricing',
  footerSupport: 'Support',
  footerLegal: 'Legal',
  footerPrivacy: 'Privacy Policy',
  footerTerms: 'Terms of Service',
  footerDPA: 'Data Processing Agreement',
  footerRights: `${new Date().getFullYear()} TAKO by Fintery Ltd. All rights reserved.`,
};

const I18N_DE = {
  navFeatures: 'Funktionen',
  navPricing: 'Preise',
  navSupport: 'Support',
  navAgents: 'Agenten',
  signIn: 'Anmelden',
  navCta: 'Preise ansehen',
  heroBadge: 'Das KI-first CRM für europäische Vertriebsteams',
  heroTitle: 'Acht Agenten.\nEin CRM.\nKein Leerlauf.',
  heroDesc: 'TAKO gibt jedem Vertriebsmitarbeiter ein Team aus acht KI-Agenten — für Pipeline, E-Mails, Anrufe, Scoring, Recherche und Terminplanung. Ihr Team schließt nur noch ab.',
  heroCtaPrimary: 'Preise ansehen',
  heroCtaSecondary: 'Demo ausprobieren',
  trustGdpr: 'DSGVO-konform',
  trustEu: 'EU-gehostet · Frankfurt',
  trustSoc: 'SOC 2 in Vorbereitung',
  trustSelfhost: 'Selbst gehostet · Ihr Server',
  trustUptime: '99,99 % Uptime-SLA',
  outcomesTag: 'Zahlen, die überzeugen',
  outcomesTitle: 'Ergebnisse, die wirklich etwas bewegen',
  valueTag: 'Was sich ändert',
  valueTitle: 'Was Ihr Team nicht mehr manuell erledigt',
  valueDesc: 'TAKO-Agenten laufen im Hintergrund. Ihre Vertriebsmitarbeiter konzentrieren sich auf Gespräche, die abschließen.',
  agentsTag: 'Die acht Agenten',
  agentsTitle: 'Jeder Agent. Eine Plattform.',
  archTag: 'Architektur',
  archTitle: 'Ein Gehirn. Acht Arme.',
  archDesc: 'TAKOs Agenten-Modell ist so konzipiert, wie Vertrieb wirklich funktioniert — parallel, kontextuell und immer verbunden. Der Oktopus ist keine Metapher. Es ist die Architektur.',
  archNote: 'Jeder Agent lernt unabhängig aus Ihren Daten. Die Orchestrierungsschicht verbindet sie — ein hoch bewerteter Lead wird automatisch in der Pipeline priorisiert, für einen Anruf eingeplant und erhält einen E-Mail-Entwurf, ohne dass Sie einen Finger rühren. Klicken Sie auf einen Arm, um den jeweiligen Agenten zu erkunden.',
  proofTag: 'Referenzen',
  proofTitle: 'Für Teams gebaut, die in ganz Europa verkaufen',
  euTag: 'Datensouveränität',
  euTitle: 'Ihre Daten bleiben in Europa',
  euDesc: 'Wir haben TAKO für europäische Datenschutzstandards entwickelt — nicht als Nachgedanke, sondern als Grundlage.',
  pricingTag: 'Preise',
  pricingTitle: 'Ein Produkt. Ein Preis. Unbegrenzte Nutzer.',
  pricingDesc: 'Vollständiger Quellcode. 12 Monate Support inklusive. 30-Tage-Geld-zurück-Garantie.',
  pricingCta: 'Vollständige Preise ansehen →',
  finalTitle: 'Bereit, smarter zu verkaufen?',
  finalDesc: 'Für europäische Vertriebsteams, die Ergebnisse wollen, keine Komplexität.',
  finalCtaPrimary: 'Preise ansehen',
  finalCtaSecondary: 'Anmelden',
  footerTagline: 'Das CRM, das Ihr Marketing und Ihren Vertrieb steuert. Für europäische Teams, die Ergebnisse wollen, keine Komplexität.',
  footerCompany: 'Fintery Ltd.',
  footerAddress1: 'Canbury Works, Units 6 and 7, Canbury Business Park',
  footerAddress2: 'Kingston upon Thames, Surrey, KT2 6HJ, UK',
  footerProduct: 'Produkt',
  footerFeatures: 'Funktionen',
  footerPricing: 'Preise',
  footerSupport: 'Support',
  footerLegal: 'Rechtliches',
  footerPrivacy: 'Datenschutz',
  footerTerms: 'Nutzungsbedingungen',
  footerDPA: 'Auftragsverarbeitungsvertrag',
  footerRights: `${new Date().getFullYear()} TAKO by Fintery Ltd. Alle Rechte vorbehalten.`,
};

// ─── Canvas helpers ───────────────────────────────────────────────────────────

function lerp(a, b, t) { return a + (b - a) * t; }
function degToRad(d) { return d * Math.PI / 180; }
function rgba(c, a) { return `rgba(${c.r},${c.g},${c.b},${a})`; }

const C_INK     = { r:12,  g:16,  b:36  };
const C_TEAL    = { r:14,  g:165, b:160 };
const C_SURFACE = { r:245, g:243, b:238 };

function getScrollVis(el) {
  const r = el.getBoundingClientRect(), vh = window.innerHeight;
  // Linear: 0 when section top is at viewport bottom, 1 when section top reaches viewport top.
  // Stays clamped at 1 after scrolling past.
  return Math.min(1, Math.max(0, 1 - r.top / vh));
}

function getArmCurve(cx, cy, headR, agent, armLen, time) {
  const a  = degToRad(agent.angle);
  const sx = cx + Math.cos(a) * headR * 0.82;
  const sy = cy + Math.sin(a) * headR * 0.82;
  const ex = cx + Math.cos(a) * armLen;
  const ey = cy + Math.sin(a) * armLen;
  const pa = a + Math.PI / 2;
  const w  = Math.sin(time * 0.7  + agent.angle * 0.04) * 25;
  const w2 = Math.cos(time * 0.45 + agent.angle * 0.06) * 12;
  return {
    sx, sy,
    midX: (sx + ex) / 2 + Math.cos(pa) * w + Math.sin(pa) * w2,
    midY: (sy + ey) / 2 + Math.sin(pa) * w + Math.cos(pa) * w2,
    ex, ey,
  };
}

function bezierPt(sx, sy, mx, my, ex, ey, t) {
  return {
    x: (1-t)*(1-t)*sx + 2*(1-t)*t*mx + t*t*ex,
    y: (1-t)*(1-t)*sy + 2*(1-t)*t*my + t*t*ey,
  };
}

function drawOctopus(ctx, cW, cH, vis, time) {
  ctx.clearRect(0, 0, cW, cH);

  const cx    = cW / 2;
  const cy    = cH * 0.34;
  const headR = Math.min(cW, cH) * 0.115;
  const armLen = Math.min(cW, cH) * 0.36;

  // ── Arms ──────────────────────────────────────────────────────────────────
  AGENTS_DATA.forEach((agent) => {
    const crv = getArmCurve(cx, cy, headR, agent, armLen, time);

    // Layered glow
    for (let g = 3; g >= 1; g--) {
      ctx.beginPath();
      ctx.moveTo(crv.sx, crv.sy);
      ctx.quadraticCurveTo(crv.midX, crv.midY, crv.ex, crv.ey);
      ctx.strokeStyle = rgba(C_TEAL, vis * 0.06 * g);
      ctx.lineWidth   = g * 6;
      ctx.lineCap     = 'round';
      ctx.stroke();
    }

    // Main arm
    ctx.beginPath();
    ctx.moveTo(crv.sx, crv.sy);
    ctx.quadraticCurveTo(crv.midX, crv.midY, crv.ex, crv.ey);
    ctx.strokeStyle = rgba(C_INK, vis * 0.85);
    ctx.lineWidth   = 3.5;
    ctx.lineCap     = 'round';
    ctx.stroke();

    // Suction cups
    const steps = 9;
    for (let i = 1; i < steps; i++) {
      const tp  = i / steps;
      const pt  = bezierPt(crv.sx, crv.sy, crv.midX, crv.midY, crv.ex, crv.ey, tp);
      const r   = lerp(3.5, 1.2, tp);
      const off = lerp(5, 3, tp);
      const a   = degToRad(agent.angle);
      const pa  = a + Math.PI / 2;
      const ox  = pt.x + Math.cos(pa) * off;
      const oy  = pt.y + Math.sin(pa) * off;

      ctx.beginPath();
      ctx.arc(ox, oy, r, 0, Math.PI * 2);
      ctx.fillStyle = rgba(C_SURFACE, vis * 0.55);
      ctx.fill();
      ctx.strokeStyle = rgba(C_INK, vis * 0.3);
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }

    // Glowing teal tip
    const tip = bezierPt(crv.sx, crv.sy, crv.midX, crv.midY, crv.ex, crv.ey, 1);
    const grd = ctx.createRadialGradient(tip.x, tip.y, 0, tip.x, tip.y, 14);
    grd.addColorStop(0,   rgba(C_TEAL, vis * 0.9));
    grd.addColorStop(0.4, rgba(C_TEAL, vis * 0.4));
    grd.addColorStop(1,   rgba(C_TEAL, 0));
    ctx.beginPath();
    ctx.arc(tip.x, tip.y, 14, 0, Math.PI * 2);
    ctx.fillStyle = grd;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(tip.x, tip.y, 4, 0, Math.PI * 2);
    ctx.fillStyle = rgba(C_TEAL, vis * 0.95);
    ctx.fill();
  });

  // ── Head body ─────────────────────────────────────────────────────────────
  const bodyGrd = ctx.createRadialGradient(cx - headR * 0.15, cy - headR * 0.2, 0, cx, cy, headR * 1.1);
  bodyGrd.addColorStop(0,   rgba({ r:28, g:34, b:64 }, vis));
  bodyGrd.addColorStop(0.6, rgba(C_INK, vis));
  bodyGrd.addColorStop(1,   rgba({ r:8, g:10, b:26 }, vis));

  ctx.beginPath();
  ctx.ellipse(cx, cy, headR * 1.05, headR, 0, 0, Math.PI * 2);
  ctx.fillStyle = bodyGrd;
  ctx.fill();

  // Head lines
  ctx.save();
  ctx.clip();
  for (let i = 0; i < 5; i++) {
    const lx = cx - headR + (i / 4) * headR * 2 * 0.8 + headR * 0.1;
    ctx.beginPath();
    ctx.moveTo(lx, cy - headR * 0.7);
    ctx.lineTo(lx - headR * 0.1, cy + headR * 0.7);
    ctx.strokeStyle = rgba(C_TEAL, vis * 0.06);
    ctx.lineWidth   = 1;
    ctx.stroke();
  }
  ctx.restore();

  // Head outline
  ctx.beginPath();
  ctx.ellipse(cx, cy, headR * 1.05, headR, 0, 0, Math.PI * 2);
  ctx.strokeStyle = rgba(C_TEAL, vis * 0.35);
  ctx.lineWidth   = 1.5;
  ctx.stroke();

  // ── Eyes ─────────────────────────────────────────────────────────────────
  const eyeY  = cy - headR * 0.18;
  const eyeOX = headR * 0.38;
  [-1, 1].forEach(side => {
    const ex2 = cx + side * eyeOX;
    const pupilOffset = Math.sin(time * 0.3) * 1.5;

    // Iris
    ctx.beginPath();
    ctx.arc(ex2, eyeY, headR * 0.15, 0, Math.PI * 2);
    ctx.fillStyle = rgba(C_TEAL, vis * 0.9);
    ctx.fill();

    // Pupil
    ctx.beginPath();
    ctx.ellipse(ex2 + pupilOffset * 0.4, eyeY + pupilOffset * 0.2, headR * 0.065, headR * 0.09, 0, 0, Math.PI * 2);
    ctx.fillStyle = rgba({ r:4, g:6, b:18 }, vis);
    ctx.fill();

    // Glint
    ctx.beginPath();
    ctx.arc(ex2 - headR * 0.05 + pupilOffset * 0.2, eyeY - headR * 0.04, headR * 0.035, 0, Math.PI * 2);
    ctx.fillStyle = rgba(C_SURFACE, vis * 0.85);
    ctx.fill();
  });

  // ── Beak ─────────────────────────────────────────────────────────────────
  const bkY = cy + headR * 0.22;
  ctx.beginPath();
  ctx.moveTo(cx - headR * 0.1, bkY);
  ctx.quadraticCurveTo(cx, bkY + headR * 0.18, cx + headR * 0.1, bkY);
  ctx.quadraticCurveTo(cx, bkY + headR * 0.06, cx - headR * 0.1, bkY);
  ctx.fillStyle   = rgba(C_SURFACE, vis * 0.7);
  ctx.strokeStyle = rgba(C_INK, vis * 0.5);
  ctx.lineWidth   = 1;
  ctx.fill();
  ctx.stroke();
}

// ─── Label positioning ────────────────────────────────────────────────────────

// cW / cH are CSS pixel dimensions (canvas.width / dpr, canvas.height / dpr).
// Label positions are in that same coordinate space, matching drawOctopus exactly.
function positionLabels(wrapEl, labelsEl, cssW, cssH, vis) {
  const cx     = cssW / 2;
  const cy     = cssH * 0.34;
  const armLen = Math.min(cssW, cssH) * 0.36;

  // The wrapper div has the same CSS size as the canvas. Scale factor = 1.
  // (The division below keeps the formula robust if the wrapper ever differs.)
  const wR = wrapEl.getBoundingClientRect();
  const scale = cssW > 0 ? wR.width / cssW : 1;

  const LABEL_PUSH = 28; // px beyond arm tip so labels clear the arm stroke
  AGENTS_DATA.forEach((agent, i) => {
    const a  = degToRad(agent.angle);
    const lx = cx + Math.cos(a) * (armLen + LABEL_PUSH);
    const ly = cy + Math.sin(a) * (armLen + LABEL_PUSH);
    const el = labelsEl.children[i];
    if (!el) return;
    el.style.left      = `${lx * scale}px`;
    el.style.top       = `${ly * scale}px`;
    el.style.transform = 'translate(-50%,-50%)';
    vis > 0.35 ? el.classList.add('visible') : el.classList.remove('visible');
  });

  const bk = document.getElementById('beak-hover');
  if (bk) {
    const headR = Math.min(cssW, cssH) * 0.115;
    bk.style.left = `${(cx + headR * 0.05) * scale - 18}px`;
    bk.style.top  = `${(cy + headR * 0.22) * scale - 18}px`;
    vis > 0.5 ? bk.classList.add('visible') : bk.classList.remove('visible');
  }
}

function rebuildOctoLabels(labelsEl, agentsData) {
  labelsEl.innerHTML = '';
  agentsData.forEach(agent => {
    const el      = document.createElement('a');
    el.href       = `#${agent.id}`;
    el.className  = 'agent-label';
    el.innerHTML  = `<div class="al-dot"></div><span class="al-name">${agent.name}</span><span class="al-sub">${agent.sub}</span>`;
    labelsEl.appendChild(el);
  });
}

// ─── CSS ──────────────────────────────────────────────────────────────────────

const LP_CSS = `
@import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=IBM+Plex+Mono:wght@400;500&family=Inter:wght@400;500;600;700&display=swap');

.tako-lp {
  --lp-ink:     #0c1024;
  --lp-teal:    #0ea5a0;
  --lp-gold:    #d4a853;
  --lp-surface: #f5f3ee;
  --lp-muted:   rgba(12,16,36,0.55);
  font-family: 'Inter', sans-serif;
  background: var(--lp-surface);
  color: var(--lp-ink);
  overflow-x: hidden;
}

/* Progress bar */
.tako-lp .progress-bar {
  position: fixed;
  top: 0; left: 0;
  height: 3px;
  width: 0%;
  background: linear-gradient(90deg, var(--lp-teal), var(--lp-gold));
  z-index: 9999;
  transition: width 0.1s linear;
}

/* Nav */
.tako-lp nav {
  position: fixed;
  top: 0; left: 0; right: 0;
  z-index: 200;
  background: rgba(245,243,238,0.92);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-bottom: 1px solid rgba(12,16,36,0.07);
}
.tako-lp .nav-inner {
  max-width: 1100px;
  margin: 0 auto;
  padding: 0 1.5rem;
  height: 62px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.tako-lp .nav-logo {
  display: flex;
  align-items: center;
  text-decoration: none;
}
.tako-lp .nav-logo img { height: 28px; }
.tako-lp .nav-links {
  display: flex;
  align-items: center;
  gap: 2rem;
  list-style: none;
  margin: 0; padding: 0;
}
.tako-lp .nav-links a {
  font-size: 0.875rem;
  color: var(--lp-muted);
  text-decoration: none;
  transition: color 0.2s;
}
.tako-lp .nav-links a:hover { color: var(--lp-ink); }
.tako-lp .nav-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}
.tako-lp .lang-btn {
  padding: 0.25rem 0.5rem;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  border-radius: 6px;
  border: 1px solid rgba(12,16,36,0.12);
  background: transparent;
  color: var(--lp-muted);
  cursor: pointer;
  transition: background 0.15s;
}
.tako-lp .lang-btn:hover { background: rgba(12,16,36,0.06); }
.tako-lp .btn-ghost {
  padding: 0.45rem 1rem;
  font-size: 0.875rem;
  color: var(--lp-muted);
  background: transparent;
  border: none;
  cursor: pointer;
  border-radius: 8px;
  text-decoration: none;
  transition: color 0.2s;
}
.tako-lp .btn-ghost:hover { color: var(--lp-ink); }
.tako-lp .btn-p {
  padding: 0.55rem 1.4rem;
  font-size: 0.875rem;
  font-weight: 600;
  background: var(--lp-teal);
  color: #fff;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  text-decoration: none;
  transition: background 0.2s, opacity 0.2s;
  display: inline-flex;
  align-items: center;
}
.tako-lp .btn-p:hover { background: #0b8c88; }
.tako-lp .btn-outline {
  padding: 0.55rem 1.4rem;
  font-size: 0.875rem;
  font-weight: 600;
  background: transparent;
  color: var(--lp-ink);
  border: 1.5px solid rgba(12,16,36,0.18);
  border-radius: 8px;
  cursor: pointer;
  text-decoration: none;
  transition: border-color 0.2s;
  display: inline-flex;
  align-items: center;
}
.tako-lp .btn-outline:hover { border-color: rgba(12,16,36,0.4); }
.tako-lp .hamburger {
  display: none;
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 4px;
  color: var(--lp-ink);
}
@media (max-width: 768px) {
  .tako-lp .nav-links,
  .tako-lp .nav-actions { display: none; }
  .tako-lp .nav-links.active {
    display: flex;
    flex-direction: column;
    position: fixed;
    top: 62px; left: 0; right: 0;
    background: var(--lp-surface);
    padding: 1rem 1.5rem 1.5rem;
    gap: 1.2rem;
    border-bottom: 1px solid rgba(12,16,36,0.07);
    z-index: 199;
    align-items: flex-start;
  }
  .tako-lp .nav-actions.active {
    display: flex;
    position: fixed;
    top: 62px; left: 0; right: 0;
    padding: 0 1.5rem 1.5rem;
    gap: 0.75rem;
    flex-direction: row;
    flex-wrap: wrap;
    z-index: 198;
    margin-top: calc(62px + 3rem);
  }
  .tako-lp .hamburger { display: block; }
}

/* Fixed octopus canvas — above all sections (z:4) but below hero (z:6) */
#octo-fixed {
  position: fixed;
  top: 50%; left: 50%;
  transform: translate(-50%, -50%);
  width: min(780px, 85vw);
  height: min(780px, 85vw);
  pointer-events: none;
  z-index: 5;
}
.tako-lp .octo-labels-wrapper {
  position: fixed;
  top: 50%; left: 50%;
  transform: translate(-50%, -50%);
  width: min(780px, 85vw);
  height: min(780px, 85vw);
  pointer-events: none;
  z-index: 7;
}

/* Agent labels */
.agent-label {
  position: absolute;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-decoration: none;
  opacity: 0;
  transition: opacity 0.6s ease;
  pointer-events: auto;
  background: rgba(245,243,238,0.88);
  padding: 2px 8px 4px;
  border-radius: 8px;
}
.agent-label.visible { opacity: 1; }
.agent-label .al-dot {
  width: 8px; height: 8px;
  border-radius: 50%;
  background: var(--lp-teal);
  margin-bottom: 4px;
  box-shadow: 0 0 8px rgba(14,165,160,0.7);
}
.agent-label .al-name {
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--lp-ink);
  white-space: nowrap;
  font-family: 'IBM Plex Mono', monospace;
}
.agent-label .al-sub {
  font-size: 0.62rem;
  color: var(--lp-muted);
  white-space: nowrap;
  font-family: 'Inter', sans-serif;
}

/* Beak hover */
.beak-hover-zone {
  position: absolute;
  width: 36px; height: 36px;
  pointer-events: auto;
  cursor: pointer;
}
.beak-hover {
  position: absolute;
  width: 36px; height: 36px;
  z-index: 10;
  opacity: 0;
  transition: opacity 0.4s;
}
.beak-hover.visible { opacity: 1; }
.beak-tooltip {
  position: absolute;
  top: -2.8rem; left: 50%;
  transform: translateX(-50%);
  background: var(--lp-ink);
  color: #fff;
  font-size: 0.65rem;
  font-family: 'IBM Plex Mono', monospace;
  padding: 0.3rem 0.6rem;
  border-radius: 6px;
  white-space: nowrap;
  opacity: 0;
  transition: opacity 0.2s;
  pointer-events: none;
}
.beak-hover:hover .beak-tooltip { opacity: 1; }

/* Hero — above canvas (z:5) so ghost octopus hides behind hero content */
.tako-lp .hero {
  position: relative;
  z-index: 6;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  text-align: center;
  padding: 120px 1.5rem 80px;
}
.tako-lp .hero-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  background: rgba(12,16,36,0.05);
  border: 1px solid rgba(12,16,36,0.1);
  border-radius: 99px;
  padding: 0.35rem 1rem;
  font-size: 0.75rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--lp-muted);
  font-weight: 500;
  margin-bottom: 2rem;
}
.tako-lp .hero-badge-dot {
  width: 6px; height: 6px;
  border-radius: 50%;
  background: var(--lp-gold);
}
.tako-lp .hero h1 {
  font-family: 'DM Serif Display', serif;
  font-size: clamp(2.8rem, 7vw, 5.5rem);
  line-height: 1.08;
  letter-spacing: -0.02em;
  color: var(--lp-ink);
  margin-bottom: 1.5rem;
  max-width: 780px;
  white-space: pre-line;
}
.tako-lp .hero h1 em {
  color: var(--lp-teal);
  font-style: normal;
}
.tako-lp .hero p {
  font-size: 1.125rem;
  color: var(--lp-muted);
  max-width: 560px;
  line-height: 1.7;
  margin-bottom: 2.5rem;
}
.tako-lp .hero-ctas {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
  justify-content: center;
}

/* Trust strip */
.tako-lp .trust-strip {
  position: relative;
  z-index: 4;
  border-top: 1px solid rgba(12,16,36,0.07);
  border-bottom: 1px solid rgba(12,16,36,0.07);
  padding: 1.25rem 1.5rem;
  background: rgba(245,243,238,0.7);
}
.tako-lp .trust-inner {
  max-width: 1000px;
  margin: 0 auto;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  align-items: center;
  gap: 1rem 2rem;
}
.tako-lp .trust-item {
  font-size: 0.78rem;
  font-family: 'IBM Plex Mono', monospace;
  color: rgba(12,16,36,0.38);
  white-space: nowrap;
}
.tako-lp .trust-sep {
  width: 1px; height: 14px;
  background: rgba(12,16,36,0.1);
}

/* Sections shared */
.tako-lp section {
  position: relative;
  z-index: 4;
}
.tako-lp .section-inner {
  max-width: 1100px;
  margin: 0 auto;
  padding: 0 1.5rem;
}
.tako-lp .section-tag {
  font-size: 0.7rem;
  font-family: 'IBM Plex Mono', monospace;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--lp-teal);
  font-weight: 500;
  margin-bottom: 0.75rem;
}
.tako-lp .section-title {
  font-family: 'DM Serif Display', serif;
  font-size: clamp(1.8rem, 4vw, 2.8rem);
  letter-spacing: -0.01em;
  line-height: 1.12;
  color: var(--lp-ink);
  margin-bottom: 1rem;
}
.tako-lp .section-desc {
  font-size: 1.05rem;
  color: var(--lp-muted);
  line-height: 1.7;
  max-width: 580px;
}

/* Outcomes */
.tako-lp .outcomes { padding: 6rem 1.5rem; background: var(--lp-surface); }
.tako-lp .outcomes-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px,1fr));
  gap: 2rem;
  margin-top: 3rem;
}
.tako-lp .outcome-card {
  background: #fff;
  border: 1px solid rgba(12,16,36,0.07);
  border-radius: 16px;
  padding: 2rem 1.75rem;
}
.tako-lp .outcome-number {
  font-family: 'DM Serif Display', serif;
  font-size: 3rem;
  color: var(--lp-teal);
  line-height: 1;
  margin-bottom: 0.4rem;
}
.tako-lp .outcome-stat {
  font-size: 0.875rem;
  font-weight: 700;
  color: var(--lp-ink);
  margin-bottom: 0.5rem;
}
.tako-lp .outcome-desc {
  font-size: 0.85rem;
  color: var(--lp-muted);
  line-height: 1.6;
}

/* Value block */
.tako-lp .value-block { padding: 6rem 1.5rem; background: var(--lp-ink); }
.tako-lp .value-block .section-tag { color: var(--lp-gold); }
.tako-lp .value-block .section-title { color: #fff; }
.tako-lp .value-block .section-desc { color: rgba(255,255,255,0.55); }
.tako-lp .value-list {
  margin-top: 3rem;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px,1fr));
  gap: 1.25rem;
}
.tako-lp .value-item {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 1.25rem 1.5rem;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 12px;
}
.tako-lp .value-bullet {
  width: 8px; height: 8px; min-width: 8px;
  border-radius: 50%;
  background: var(--lp-teal);
  margin-top: 6px;
}
.tako-lp .value-text { font-size: 0.875rem; line-height: 1.6; color: rgba(255,255,255,0.75); }
.tako-lp .value-text strong { color: #fff; font-weight: 600; }

/* Agents grid */
.tako-lp .agents { padding: 6rem 1.5rem; background: var(--lp-surface); }
.tako-lp .agents-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px,1fr));
  gap: 1.5rem;
  margin-top: 3rem;
}
.tako-lp .agent-card {
  background: #fff;
  border: 1px solid rgba(12,16,36,0.07);
  border-radius: 16px;
  padding: 1.75rem;
  transition: box-shadow 0.2s, transform 0.2s;
}
.tako-lp .agent-card:hover {
  box-shadow: 0 8px 32px rgba(12,16,36,0.09);
  transform: translateY(-2px);
}
.tako-lp .agent-card-top {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1rem;
}
.tako-lp .agent-dot {
  width: 10px; height: 10px;
  border-radius: 50%;
  background: var(--lp-teal);
  box-shadow: 0 0 8px rgba(14,165,160,0.5);
}
.tako-lp .agent-card-title {
  font-family: 'DM Serif Display', serif;
  font-size: 1.1rem;
  color: var(--lp-ink);
}
.tako-lp .agent-card-desc {
  font-size: 0.85rem;
  color: var(--lp-muted);
  line-height: 1.65;
  margin-bottom: 1rem;
}
.tako-lp .agent-outcome {
  font-size: 0.78rem;
  font-family: 'IBM Plex Mono', monospace;
  color: var(--lp-teal);
  font-weight: 500;
}

/* Architecture — cream background so dark-ink octopus is visible */
.tako-lp .architecture { padding: 6rem 1.5rem 5rem; background: var(--lp-surface); text-align: center; }
.tako-lp .architecture .section-tag { color: var(--lp-teal); }
.tako-lp .architecture .section-title { color: var(--lp-ink); margin: 0 auto 1rem; }
.tako-lp .architecture .section-desc { color: var(--lp-muted); margin: 0 auto; max-width: 620px; }

/* Proof */
.tako-lp .proof { padding: 6rem 1.5rem; background: var(--lp-surface); }
.tako-lp .proof-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px,1fr));
  gap: 1.5rem;
  margin-top: 3rem;
}
.tako-lp .proof-card {
  background: #fff;
  border: 1px solid rgba(12,16,36,0.07);
  border-radius: 16px;
  padding: 2rem;
}
.tako-lp .proof-quote {
  font-size: 0.9rem;
  line-height: 1.7;
  color: var(--lp-ink);
  margin-bottom: 1.5rem;
  font-style: italic;
}
.tako-lp .proof-name { font-size: 0.85rem; font-weight: 700; color: var(--lp-ink); }
.tako-lp .proof-role { font-size: 0.78rem; color: var(--lp-muted); margin-top: 0.2rem; }

/* Europe */
.tako-lp .europe { padding: 6rem 1.5rem; background: var(--lp-ink); }
.tako-lp .europe .section-tag { color: var(--lp-teal); }
.tako-lp .europe .section-title { color: #fff; }
.tako-lp .europe .section-desc { color: rgba(255,255,255,0.55); margin-top: 0.75rem; }
.tako-lp .eu-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px,1fr));
  gap: 1.5rem;
  margin-top: 3rem;
}
.tako-lp .eu-card {
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: 16px;
  padding: 2rem;
}
.tako-lp .eu-card-title { font-size: 1rem; font-weight: 700; color: #fff; margin-bottom: 0.6rem; }
.tako-lp .eu-card-desc { font-size: 0.85rem; color: rgba(255,255,255,0.55); line-height: 1.65; }

/* Pricing */
.tako-lp .pricing { padding: 5rem 1.5rem 2rem; background: var(--lp-surface); text-align: center; }

/* Final CTA */
.tako-lp .final-cta { padding: 7rem 1.5rem; background: var(--lp-ink); text-align: center; }
.tako-lp .final-cta .section-title { color: #fff; margin: 0 auto 1rem; }
.tako-lp .final-cta .section-desc { color: rgba(255,255,255,0.55); margin: 0 auto 2.5rem; }
.tako-lp .final-cta-btns { display: flex; gap: 1rem; flex-wrap: wrap; justify-content: center; }
.tako-lp .btn-gold {
  padding: 0.75rem 2rem;
  font-size: 1rem; font-weight: 700;
  background: var(--lp-gold);
  color: var(--lp-ink);
  border: none; border-radius: 10px;
  cursor: pointer; text-decoration: none;
  display: inline-flex; align-items: center;
  transition: opacity 0.2s;
}
.tako-lp .btn-gold:hover { opacity: 0.9; }
.tako-lp .btn-outline-white {
  padding: 0.75rem 2rem;
  font-size: 1rem; font-weight: 600;
  background: transparent;
  color: #fff;
  border: 1.5px solid rgba(255,255,255,0.22);
  border-radius: 10px;
  cursor: pointer; text-decoration: none;
  display: inline-flex; align-items: center;
  transition: border-color 0.2s;
}
.tako-lp .btn-outline-white:hover { border-color: rgba(255,255,255,0.5); }

/* Footer */
.tako-lp footer {
  background: #080b1a;
  padding: 4rem 1.5rem 2rem;
}
.tako-lp .footer-inner {
  max-width: 1100px;
  margin: 0 auto;
}
.tako-lp .footer-top {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr;
  gap: 3rem;
  padding-bottom: 2.5rem;
  border-bottom: 1px solid rgba(255,255,255,0.05);
  margin-bottom: 2rem;
}
@media (max-width: 640px) {
  .tako-lp .footer-top { grid-template-columns: 1fr; gap: 2rem; }
}
.tako-lp .footer-tagline { font-size: 0.85rem; color: rgba(255,255,255,0.35); line-height: 1.6; margin: 0.75rem 0 1rem; max-width: 320px; }
.tako-lp .footer-address { font-size: 0.75rem; color: rgba(255,255,255,0.25); line-height: 1.7; }
.tako-lp .footer-address strong { color: rgba(255,255,255,0.4); }
.tako-lp .footer-col-title { font-size: 0.7rem; letter-spacing: 0.14em; text-transform: uppercase; color: rgba(255,255,255,0.5); font-weight: 600; margin-bottom: 1rem; }
.tako-lp .footer-links { display: flex; flex-direction: column; gap: 0.6rem; }
.tako-lp .footer-links a, .tako-lp .footer-links span {
  font-size: 0.85rem; color: rgba(255,255,255,0.35);
  text-decoration: none;
  transition: color 0.2s;
}
.tako-lp .footer-links a:hover { color: rgba(255,255,255,0.7); }
.tako-lp .footer-bottom { text-align: center; font-size: 0.75rem; color: rgba(255,255,255,0.2); }

/* Reveal animations */
.tako-lp .tl-reveal {
  opacity: 0;
  transform: translateY(28px);
  transition: opacity 0.65s ease, transform 0.65s ease;
}
.tako-lp .tl-reveal.visible {
  opacity: 1;
  transform: translateY(0);
}

/* Architecture section spacer — keeps the fixed octopus in view while scrolling */
.tako-lp .arch-spacer {
  height: min(680px, 70vw);
  pointer-events: none;
}
@media (max-width: 640px) {
  .tako-lp .arch-spacer { display: none; }
}
.tako-lp .arch-note {
  max-width: 640px;
  margin: 0 auto;
  text-align: center;
  color: var(--lp-muted);
  font-size: 0.95rem;
  line-height: 1.75;
  padding-top: 1rem;
}

/* Hero gets a subtle radial mask so the ghost octopus doesn't distract */
.tako-lp .hero::before {
  content: '';
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse 65% 70% at 50% 55%, var(--lp-surface) 38%, transparent 100%);
  pointer-events: none;
  z-index: 0;
}
.tako-lp .hero > * { position: relative; z-index: 1; }
`;

// ─── Component ────────────────────────────────────────────────────────────────

const LandingPage = () => {
  const [lang, setLang] = useState(() => localStorage.getItem('tako_lang') || 'en');
  const [mobileOpen, setMobileOpen] = useState(false);

  const t = lang === 'de' ? I18N_DE : I18N_EN;
  const agents         = AGENTS_I18N[lang];
  const outcomes       = OUTCOMES_I18N[lang];
  const values         = VALUE_I18N[lang];
  const proofs         = PROOF_I18N[lang];
  const euItems        = EU_I18N[lang];
  const pricingSummary = PRICING_SUMMARY_I18N[lang];

  const canvasRef     = useRef(null);
  const labelsContRef = useRef(null);
  const progBarRef    = useRef(null);
  const archRef       = useRef(null);   // architecture section — drives octopus visibility
  const archIntroRef  = useRef(null);   // architecture intro text — upper boundary for octopus
  const spacerRef     = useRef(null);   // arch-spacer div — measured for true centre position
  const archNoteRef   = useRef(null);   // arch-note text — lower boundary for octopus
  const rafRef        = useRef(null);
  const timeRef       = useRef(0);

  const toggleLang = () => {
    const nl = lang === 'en' ? 'de' : 'en';
    localStorage.setItem('tako_lang', nl);
    setLang(nl);
  };

  // ── Inject CSS & Google Fonts ───────────────────────────────────────────────
  useEffect(() => {
    const style = document.createElement('style');
    style.id    = 'tako-lp-styles';
    style.textContent = LP_CSS;
    document.head.appendChild(style);

    const font = document.createElement('link');
    font.id   = 'tako-lp-fonts';
    font.rel  = 'stylesheet';
    font.href = 'https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=IBM+Plex+Mono:wght@400;500&family=Inter:wght@400;500;600;700&display=swap';
    document.head.appendChild(font);

    return () => {
      document.getElementById('tako-lp-styles')?.remove();
      document.getElementById('tako-lp-fonts')?.remove();
    };
  }, []);

  // ── Progress bar ────────────────────────────────────────────────────────────
  useEffect(() => {
    const onScroll = () => {
      if (!progBarRef.current) return;
      const total  = document.documentElement.scrollHeight - window.innerHeight;
      const pct    = total > 0 ? (window.scrollY / total) * 100 : 0;
      progBarRef.current.style.width = `${pct}%`;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // ── Smooth-scroll for hash anchors ─────────────────────────────────────────
  const handleHashClick = (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute('href').slice(1);
    const el = document.getElementById(id);
    if (!el) return;
    e.preventDefault();

    // Agent cards are centred below the sticky nav so the clicked card sits
    // in the optical middle of the viewport. Non-agent hash links (legal,
    // footer, etc.) keep the default top-aligned smooth scroll.
    const agentIds = AGENTS_DATA.map(a => a.id);
    if (agentIds.includes(id)) {
      const navEl = document.querySelector('.tako-lp nav');
      const navBottom = navEl ? navEl.getBoundingClientRect().bottom : 72;
      const VISUAL_TOP_GAP = 12;

      const centerAgentCard = () => {
        const rect = el.getBoundingClientRect();
        const viewportTop = navBottom + VISUAL_TOP_GAP;
        const visibleHeight = Math.max(1, window.innerHeight - viewportTop);
        const desiredCenter = viewportTop + visibleHeight / 2;
        const delta = rect.top + rect.height / 2 - desiredCenter;
        window.scrollBy({ top: delta, behavior: 'smooth' });
      };

      // First smooth move + delayed corrections after reveal transforms settle.
      centerAgentCard();
      window.setTimeout(centerAgentCard, 420);
      window.setTimeout(centerAgentCard, 900);
      return;
    }

    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // ── Intersection observer (reveal) ─────────────────────────────────────────
  useEffect(() => {
    const els = document.querySelectorAll('.tako-lp .tl-reveal');
    const obs = new IntersectionObserver(
      (entries) => entries.forEach(en => {
        if (en.isIntersecting) { en.target.classList.add('visible'); obs.unobserve(en.target); }
      }),
      { threshold: 0.12 }
    );
    els.forEach(el => obs.observe(el));
    return () => obs.disconnect();
  }, [lang]);

  // ── Rebuild agent labels when lang changes ──────────────────────────────────
  useEffect(() => {
    if (!labelsContRef.current) return;
    rebuildOctoLabels(labelsContRef.current, agents);
  }, [lang, agents]);

  // ── Canvas animation loop ───────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;

    const resize = () => {
      const size = Math.min(700, window.innerWidth * 0.76);
      canvas.style.width  = `${size}px`;
      canvas.style.height = `${size}px`;
      canvas.width  = size * dpr;
      canvas.height = size * dpr;
    };
    resize();
    window.addEventListener('resize', resize);

    const ctx = canvas.getContext('2d');

    const loop = (ts) => {
      timeRef.current = ts / 1000;

      const r   = archRef.current ? archRef.current.getBoundingClientRect() : null;
      const vh  = window.innerHeight;

      // CSS-pixel canvas dimensions (needed for both clamp and draw).
      const cssW = canvas.width  / dpr;
      const cssH = canvas.height / dpr;

      // True octopus/label reach from centre is asymmetric because the drawn
      // head is above canvas centre (cy = 34%) and labels are pushed past arm tips.
      // Use geometry-derived top/bottom reach so clamps are accurate.
      const minDim = Math.min(cssW, cssH);
      const cy = cssH * 0.34;
      const armLen = minDim * 0.36;
      const LABEL_PUSH = 28;
      const LABEL_HALF_H = 22;
      const upReach = AGENTS_DATA.reduce((m, a) => Math.max(m, Math.max(0, -Math.sin(degToRad(a.angle)))), 0);
      const downReach = AGENTS_DATA.reduce((m, a) => Math.max(m, Math.max(0, Math.sin(degToRad(a.angle)))), 0);
      const topReach = (cssH / 2 - cy) + upReach * (armLen + LABEL_PUSH) + LABEL_HALF_H;
      const bottomReach = (-cssH / 2 + cy) + downReach * (armLen + LABEL_PUSH) + LABEL_HALF_H;

      // Measure the spacer's real viewport position. Fade tracks the spacer
      // centre (unchanged timing). Motion tracks a lower point in the spacer
      // so the octopus sits low and only lifts near the note text.
      const SPACER_TRACK_RATIO = 0.93;
      const spacerEl   = spacerRef.current;
      const spacerRect = (spacerEl && spacerEl.offsetHeight > 0)
        ? spacerEl.getBoundingClientRect()
        : null;
      const spacerVP = spacerRect
        ? spacerRect.top + spacerRect.height / 2   // centre — drives fade
        : r ? r.top + 660 : vh;                    // mobile / pre-mount fallback
      const spacerMotionVP = spacerRect
        ? spacerRect.top + spacerRect.height * SPACER_TRACK_RATIO   // lower point — drives motion
        : r ? r.top + 760 : vh;                                     // delayed-lift fallback

      // Fade: ghost (0.05) when spacer is below viewport, full (1.0) at vh/2.
      const vis = Math.max(0.05, Math.min(1, 2 - spacerVP / (vh * 0.5)));

      // Head position: hold at a resting centre while spacer approaches,
      // then track the lower anchor out. CSS transform is translate(-50%, -50%)
      // so `top` == visual centre. The octopus is clamped into a "landing box":
      // top boundary is below architecture intro text, bottom boundary is above
      // the note paragraph. This keeps the upper arms out of the heading area.
      const VIEWPORT_GAP = 8;   // px breathing room from viewport bottom
      const NOTE_GAP     = 8;   // px gap between silhouette and note top
      const TOP_GAP      = 10;  // px gap between nav bottom and silhouette top
      const INTRO_GAP    = 26;  // px gap between intro text and silhouette top

      let lowerLimit = vh - bottomReach - VIEWPORT_GAP;
      if (archNoteRef.current) {
        const noteRect  = archNoteRef.current.getBoundingClientRect();
        const noteLimit = noteRect.top - NOTE_GAP - bottomReach;
        lowerLimit = Math.min(lowerLimit, noteLimit);
      }

      const navEl     = document.querySelector('.tako-lp nav');
      const navBottom = navEl ? navEl.getBoundingClientRect().bottom : 72;
      const navTopLimit = navBottom + topReach + TOP_GAP;
      let topLimit = navTopLimit;
      if (archIntroRef.current) {
        const introRect = archIntroRef.current.getBoundingClientRect();
        const introTopLimit = introRect.bottom + INTRO_GAP + topReach;
        topLimit = Math.max(navTopLimit, introTopLimit);
      }

      // Resting point inside the landing box: slightly below midpoint so the
      // silhouette sits in the empty architecture space before lifting out.
      const safeTop = Math.min(topLimit, lowerLimit);
      const RESTING_BALANCE = 0.56;
      const restingCenter   = safeTop + (lowerLimit - safeTop) * RESTING_BALANCE;
      const rawHead         = r ? Math.min(restingCenter, spacerMotionVP) : restingCenter;

      const lowerBounded = Math.min(rawHead, lowerLimit);
      const headPx       = Math.max(safeTop, lowerBounded);

      canvas.style.top = `${headPx}px`;
      const labelsWrap = labelsContRef.current?.parentElement;
      if (labelsWrap) labelsWrap.style.top = `${headPx}px`;

      ctx.save();
      ctx.scale(dpr, dpr);
      drawOctopus(ctx, cssW, cssH, vis, timeRef.current);
      ctx.restore();

      // Labels also receive CSS-pixel dimensions.
      if (labelsContRef.current) {
        positionLabels(canvas, labelsContRef.current, cssW, cssH, vis);
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
    };
  }, []);

  // ─── JSX ────────────────────────────────────────────────────────────────────
  return (
    <div className="tako-lp" onClick={handleHashClick}>

      {/* Progress bar */}
      <div className="progress-bar" ref={progBarRef} />

      {/* Fixed canvas */}
      <canvas id="octo-fixed" ref={canvasRef} />

      {/* Fixed label overlay */}
      <div className="octo-labels-wrapper">
        <div ref={labelsContRef} style={{ position:'relative', width:'100%', height:'100%' }}>
          {/* Beak hover */}
          <div id="beak-hover" className="beak-hover">
            <div className="beak-hover-zone">
              <div className="beak-tooltip">tako.software</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Nav ────────────────────────────────────────────────────────────── */}
      <nav>
        <div className="nav-inner">
          <Link to="/" className="nav-logo">
            <img src="/logo-horizontal.svg" alt="TAKO" />
          </Link>

          <ul className={`nav-links${mobileOpen ? ' active' : ''}`}>
            <li><a href="#outcomes" onClick={() => setMobileOpen(false)}>{t.navFeatures}</a></li>
            <li><a href="#agents"   onClick={() => setMobileOpen(false)}>{t.navAgents}</a></li>
            <li><Link to="/pricing" onClick={() => setMobileOpen(false)}>{t.navPricing}</Link></li>
            <li><Link to="/support" onClick={() => setMobileOpen(false)}>{t.navSupport}</Link></li>
          </ul>

          <div className={`nav-actions${mobileOpen ? ' active' : ''}`}>
            <button className="lang-btn" onClick={toggleLang} data-testid="landing-lang-toggle">
              {lang === 'en' ? 'DE' : 'EN'}
            </button>
            <Link to="/login" className="btn-ghost" onClick={() => setMobileOpen(false)}>{t.signIn}</Link>
            <Link to="/pricing" className="btn-p" data-testid="nav-cta" onClick={() => setMobileOpen(false)}>{t.navCta}</Link>
          </div>

          <button className="hamburger" onClick={() => setMobileOpen(o => !o)} aria-label="Menu" aria-expanded={mobileOpen}>
            {mobileOpen ? (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            ) : (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
            )}
          </button>
        </div>
      </nav>

      {/* ── Hero ───────────────────────────────────────────────────────────── */}
      <section className="hero">
        <div className="hero-badge">
          <span className="hero-badge-dot" />
          {t.heroBadge}
        </div>
        <h1 data-testid="hero-title">
          {t.heroTitle.split('\n').map((line, i, arr) => (
            <span key={i}>{line}{i < arr.length - 1 && <br />}</span>
          ))}
        </h1>
        <p data-testid="hero-description">{t.heroDesc}</p>
        <div className="hero-ctas">
          <Link to="/pricing" className="btn-p" style={{ fontSize:'1rem', padding:'0.75rem 2rem' }} data-testid="hero-cta-primary">
            {t.heroCtaPrimary}
          </Link>
          <Link to="/demo" className="btn-outline" style={{ fontSize:'1rem', padding:'0.75rem 2rem' }} data-testid="hero-cta-secondary">
            {t.heroCtaSecondary}
          </Link>
        </div>
      </section>

      {/* ── Trust strip ────────────────────────────────────────────────────── */}
      <div className="trust-strip">
        <div className="trust-inner">
          <span className="trust-item">{t.trustGdpr}</span>
          <span className="trust-sep" />
          <span className="trust-item">{t.trustEu}</span>
          <span className="trust-sep" />
          <span className="trust-item">{t.trustSoc}</span>
          <span className="trust-sep" />
          <span className="trust-item">{t.trustSelfhost}</span>
          <span className="trust-sep" />
          <span className="trust-item">{t.trustUptime}</span>
        </div>
      </div>

      {/* ── Outcomes ───────────────────────────────────────────────────────── */}
      <section className="outcomes" id="outcomes">
        <div className="section-inner">
          <p className="section-tag tl-reveal">{t.outcomesTag}</p>
          <h2 className="section-title tl-reveal">{t.outcomesTitle}</h2>
          <div className="outcomes-grid">
            {outcomes.map((o, i) => (
              <div key={i} className="outcome-card tl-reveal" style={{ transitionDelay: `${i * 0.08}s` }}>
                <div className="outcome-number">{o.number}</div>
                <div className="outcome-stat">{o.stat}</div>
                <div className="outcome-desc">{o.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Value block ────────────────────────────────────────────────────── */}
      <section className="value-block">
        <div className="section-inner">
          <p className="section-tag tl-reveal">{t.valueTag}</p>
          <h2 className="section-title tl-reveal">{t.valueTitle}</h2>
          <p className="section-desc tl-reveal">{t.valueDesc}</p>
          <div className="value-list">
            {values.map((v, i) => (
              <div key={i} className="value-item tl-reveal" style={{ transitionDelay: `${i * 0.06}s` }}>
                <span className="value-bullet" />
                <span className="value-text">
                  <strong>{v.bold}</strong> {v.desc}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Agents grid ────────────────────────────────────────────────────── */}
      <section className="agents" id="agents">
        <div className="section-inner">
          <p className="section-tag tl-reveal">{t.agentsTag}</p>
          <h2 className="section-title tl-reveal">{t.agentsTitle}</h2>
          <div className="agents-grid">
            {agents.map((agent, i) => (
              <div key={agent.id} id={agent.id} className="agent-card tl-reveal" style={{ transitionDelay: `${i * 0.055}s` }}>
                <div className="agent-card-top">
                  <span className="agent-dot" />
                  <span className="agent-card-title">{agent.cardTitle}</span>
                </div>
                <p className="agent-card-desc">{agent.cardDesc}</p>
                <span className="agent-outcome">{agent.outcome}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Architecture ───────────────────────────────────────────────────── */}
      {/* archRef drives octopus scroll-visibility — keep this section tall   */}
      <section className="architecture" id="architecture" ref={archRef}>
        <div className="section-inner">
          <p className="section-tag tl-reveal">{t.archTag}</p>
          <h2 className="section-title tl-reveal">{t.archTitle}</h2>
          <p className="section-desc tl-reveal" ref={archIntroRef} style={{ maxWidth: '680px', margin: '0 auto 2rem' }}>{t.archDesc}</p>
          {/* Spacer that lets the fixed octopus be fully visible while scrolling */}
          <div className="arch-spacer" ref={spacerRef} />
          <p className="arch-note tl-reveal" ref={archNoteRef}>{t.archNote}</p>
        </div>
      </section>

      {/* ── Proof / Testimonials ───────────────────────────────────────────── */}
      <section className="proof">
        <div className="section-inner">
          <p className="section-tag tl-reveal">{t.proofTag}</p>
          <h2 className="section-title tl-reveal">{t.proofTitle}</h2>
          <div className="proof-grid">
            {proofs.map((p, i) => (
              <div key={i} className="proof-card tl-reveal" style={{ transitionDelay: `${i * 0.1}s` }}>
                <p className="proof-quote">{p.quote}</p>
                <p className="proof-name">{p.name}</p>
                <p className="proof-role">{p.role}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Europe / GDPR ──────────────────────────────────────────────────── */}
      <section className="europe">
        <div className="section-inner">
          <p className="section-tag tl-reveal">{t.euTag}</p>
          <h2 className="section-title tl-reveal">{t.euTitle}</h2>
          <p className="section-desc tl-reveal">{t.euDesc}</p>
          <div className="eu-grid">
            {euItems.map((eu, i) => (
              <div key={i} className="eu-card tl-reveal" style={{ transitionDelay: `${i * 0.1}s` }}>
                <p className="eu-card-title">{eu.title}</p>
                <p className="eu-card-desc">{eu.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing summary ────────────────────────────────────────────────── */}
      {/* Single-product, three payment structures. Full detail on /pricing. */}
      <section className="pricing">
        <div className="section-inner" style={{ maxWidth: '960px' }}>
          <p className="section-tag tl-reveal">{t.pricingTag}</p>
          <h2 className="section-title tl-reveal">{t.pricingTitle}</h2>
          <p className="section-desc tl-reveal" style={{ margin:'0 auto 2.5rem' }}>{t.pricingDesc}</p>

          <div
            className="tl-reveal"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '1rem',
              maxWidth: '820px',
              margin: '0 auto 2rem',
            }}
          >
            {pricingSummary.map((p, i) => (
              <div
                key={i}
                style={{
                  background: '#fff',
                  border: '1px solid rgba(12,16,36,0.08)',
                  borderRadius: '16px',
                  padding: '1.5rem 1.25rem',
                  textAlign: 'center',
                }}
              >
                <p style={{ fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(12,16,36,0.55)', margin: '0 0 0.6rem' }}>
                  {p.label}
                </p>
                <p style={{ fontSize: '1.5rem', fontWeight: 800, color: 'rgb(12,16,36)', margin: '0 0 0.35rem' }}>
                  {p.price}
                </p>
                <p style={{ fontSize: '0.85rem', color: 'rgba(12,16,36,0.6)', margin: 0 }}>
                  {p.note}
                </p>
              </div>
            ))}
          </div>

          <div className="tl-reveal">
            <Link
              to="/pricing"
              className="btn-p"
              style={{ display:'inline-flex', alignItems:'center', gap:'0.5rem', fontSize:'1rem', padding:'0.75rem 2rem' }}
              data-testid="landing-pricing-cta"
            >
              {t.pricingCta}
            </Link>
          </div>
        </div>
      </section>

      {/* ── Final CTA ──────────────────────────────────────────────────────── */}
      <section className="final-cta">
        <div className="section-inner">
          <h2 className="section-title tl-reveal">{t.finalTitle}</h2>
          <p className="section-desc tl-reveal">{t.finalDesc}</p>
          <div className="final-cta-btns tl-reveal">
            <Link to="/pricing" className="btn-gold">{t.finalCtaPrimary}</Link>
            <Link to="/login"   className="btn-outline-white">{t.finalCtaSecondary}</Link>
          </div>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <footer>
        <div className="footer-inner">
          <div className="footer-top">
            <div>
              <img src="/logo-horizontal-reversed.svg" alt="TAKO" style={{ height:'26px' }} />
              <p className="footer-tagline">{t.footerTagline}</p>
              <div className="footer-address">
                <strong>{t.footerCompany}</strong><br />
                {t.footerAddress1}<br />
                {t.footerAddress2}
              </div>
            </div>

            <div>
              <p className="footer-col-title">{t.footerProduct}</p>
              <div className="footer-links">
                <a href="#agents">{t.footerFeatures}</a>
                <Link to="/pricing">{t.footerPricing}</Link>
                <Link to="/support">{t.footerSupport}</Link>
              </div>
            </div>

            <div>
              <p className="footer-col-title">{t.footerLegal}</p>
              <div className="footer-links">
                <Link to="/privacy">{t.footerPrivacy}</Link>
                <Link to="/terms">{t.footerTerms}</Link>
                <Link to="/legal/dpa">{t.footerDPA}</Link>
                <a href="mailto:support@tako.software">support@tako.software</a>
              </div>
            </div>
          </div>

          <div className="footer-bottom">
            <p>{t.footerRights}</p>
          </div>
        </div>
      </footer>

    </div>
  );
};

export default LandingPage;
