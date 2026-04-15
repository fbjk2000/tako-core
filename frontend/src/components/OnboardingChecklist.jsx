import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth, API } from '../App';
import { useT } from '../useT';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import { toast } from 'sonner';
import { Building, Users, Target, Settings, Megaphone, Radio, X, Sparkles, ArrowRight, FolderPlus, Loader2 } from 'lucide-react';

const STORAGE_KEY = 'tako_onboarding_v1';

// Step metadata — human-readable titles/bodies are resolved from i18n keys
// at render time so the checklist follows the active UI language.
const STEPS = [
  { id: 'org', icon: Building, href: '/settings' },
  { id: 'leads', icon: Users, href: '/leads' },
  { id: 'pipeline', icon: Target, href: '/deals' },
  { id: 'integrations', icon: Settings, href: '/settings?tab=integrations' },
  { id: 'campaign', icon: Megaphone, href: '/campaigns' },
  { id: 'listener', icon: Radio, href: '/listeners' },
];

const readState = () => {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); }
  catch { return {}; }
};
const writeState = (s) => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch {} };

const OnboardingChecklist = () => {
  const { token } = useAuth();
  const { t } = useT();
  const initial = readState();
  const [checks, setChecks] = useState(initial.checks || {});
  const [dismissed, setDismissed] = useState(!!initial.dismissed);
  const [copying, setCopying] = useState(false);
  const [copied, setCopied] = useState(!!initial.copied);

  if (dismissed) return null;

  const toggle = (id) => {
    const next = { ...checks, [id]: !checks[id] };
    setChecks(next);
    writeState({ ...readState(), checks: next });
  };

  const dismiss = () => {
    setDismissed(true);
    writeState({ ...readState(), dismissed: true });
  };

  const copyToTasks = async () => {
    if (!token) { toast.error(t('onboarding.signInFirst')); return; }
    if (copying) return;
    setCopying(true);
    const cfg = { headers: { Authorization: `Bearer ${token}` }, withCredentials: true };
    try {
      // 1. Create "Onboarding" project (idempotent: if it already exists, reuse)
      let project = null;
      try {
        const existing = await axios.get(`${API}/projects`, cfg);
        const projectName = t('onboarding.projectName');
        project = (existing.data || []).find(p => p.name === projectName || p.name === 'Onboarding') || null;
      } catch {}
      if (!project) {
        const r = await axios.post(`${API}/projects`, { name: t('onboarding.projectName'), description: t('onboarding.projectDesc'), deal_id: null, members: [] }, cfg);
        project = r.data;
      }

      // 2. Create one task per step
      const projectId = project?.project_id;
      const created = [];
      for (const step of STEPS) {
        try {
          await axios.post(`${API}/tasks`, {
            title: t(`onboarding.steps.${step.id}.title`),
            description: t(`onboarding.steps.${step.id}.body`),
            priority: 'medium',
            project_id: projectId,
          }, cfg);
          created.push(step.id);
        } catch (err) {
          console.error('task create failed', step.id, err);
        }
      }

      setCopied(true);
      writeState({ ...readState(), copied: true });
      toast.success(t('onboarding.addedToast').replace('{count}', created.length));
    } catch (err) {
      console.error(err);
      toast.error(err?.response?.data?.detail || t('onboarding.copyFailed'));
    } finally {
      setCopying(false);
    }
  };

  const doneCount = STEPS.filter(s => checks[s.id]).length;
  const totalCount = STEPS.length;
  const pct = Math.round((doneCount / totalCount) * 100);

  return (
    <Card className="relative border-teal-100 bg-gradient-to-br from-teal-50/60 via-white to-white" data-testid="onboarding-checklist">
      <CardContent className="p-6">
        {/* Header */}
        <div className="flex items-start gap-4 mb-5">
          <div className="w-10 h-10 rounded-xl bg-[#0EA5A0]/10 flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5 text-[#0EA5A0]" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold text-slate-900">{t('onboarding.title')}</h3>
                <p className="text-sm text-slate-600 mt-0.5">{t('onboarding.subtitle')}</p>
              </div>
              <button
                onClick={dismiss}
                className="text-slate-400 hover:text-slate-600 shrink-0"
                title={t('onboarding.dontShow')}
                data-testid="onboarding-dismiss"
                aria-label={t('onboarding.dontShow')}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {/* Progress bar */}
            <div className="mt-3 flex items-center gap-3">
              <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#0EA5A0] transition-all duration-300"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="text-xs text-slate-500 font-medium shrink-0">{doneCount} / {totalCount}</span>
            </div>
          </div>
        </div>

        {/* Steps */}
        <div className="grid md:grid-cols-2 gap-x-4 gap-y-2">
          {STEPS.map((step) => {
            const Icon = step.icon;
            const done = !!checks[step.id];
            return (
              <div key={step.id} className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-slate-50 transition-colors">
                <Checkbox
                  id={`onb-${step.id}`}
                  checked={done}
                  onCheckedChange={() => toggle(step.id)}
                  className="mt-0.5"
                  data-testid={`onboarding-check-${step.id}`}
                />
                <div className="flex-1 min-w-0">
                  <label
                    htmlFor={`onb-${step.id}`}
                    className={`flex items-center gap-2 text-sm font-medium cursor-pointer ${done ? 'text-slate-400 line-through' : 'text-slate-900'}`}
                  >
                    <Icon className={`w-3.5 h-3.5 shrink-0 ${done ? 'text-slate-300' : 'text-[#0EA5A0]'}`} />
                    <span className="truncate">{t(`onboarding.steps.${step.id}.title`)}</span>
                  </label>
                  <p className={`text-xs mt-0.5 ${done ? 'text-slate-400' : 'text-slate-500'}`}>{t(`onboarding.steps.${step.id}.body`)}</p>
                </div>
                {step.href && !done && (
                  <Link to={step.href} className="shrink-0 text-slate-400 hover:text-[#0EA5A0] transition-colors" title="Open">
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer actions */}
        <div className="mt-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-4 border-t border-slate-100">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={copyToTasks}
              disabled={copying || copied}
              data-testid="onboarding-copy-tasks"
            >
              {copying ? (
                <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> {t('onboarding.adding')}</>
              ) : copied ? (
                <><FolderPlus className="w-3.5 h-3.5 mr-1.5" /> {t('onboarding.addedToProject')}</>
              ) : (
                <><FolderPlus className="w-3.5 h-3.5 mr-1.5" /> {t('onboarding.copyAsTasks')}</>
              )}
            </Button>
            <button
              onClick={dismiss}
              className="text-xs text-slate-500 hover:text-slate-700 underline underline-offset-2"
              data-testid="onboarding-dont-show-again"
            >
              {t('onboarding.dontShow')}
            </button>
          </div>
          <Link to="/support" className="text-xs text-[#0EA5A0] hover:underline">
            {t('onboarding.needHelp')}
          </Link>
        </div>
      </CardContent>
    </Card>
  );
};

export default OnboardingChecklist;
