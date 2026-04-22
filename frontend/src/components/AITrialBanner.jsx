import React, { useState } from 'react';
import { X, Sparkles } from 'lucide-react';
import { useTokenUsage } from '../hooks/useTokenUsage';
import { useAuth } from '../App';

const STORAGE_KEY = 'tako_trial_banner_dismissed_v1';

const AITrialBanner = () => {
  const { token } = useAuth();
  const { usage } = useTokenUsage(token);
  const [dismissed, setDismissed] = useState(() => {
    try { return !!localStorage.getItem(STORAGE_KEY); } catch { return false; }
  });

  if (dismissed || !usage) return null;

  // Show if: on trial AND within last 9 days, OR trial expired AND on free tier
  const showTrialEnding = usage.is_trial && usage.trial_days_remaining != null && usage.trial_days_remaining <= 9;
  const showTokenWall = !usage.can_use && usage.tier === 'free';

  if (!showTrialEnding && !showTokenWall) return null;

  const dismiss = () => {
    setDismissed(true);
    try { localStorage.setItem(STORAGE_KEY, '1'); } catch {}
  };

  return (
    <div className={`rounded-xl border px-4 py-3 flex items-center gap-3 ${
      showTokenWall ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'
    }`}>
      <Sparkles className={`w-4 h-4 shrink-0 ${showTokenWall ? 'text-red-500' : 'text-amber-500'}`} />
      <p className={`text-sm flex-1 ${showTokenWall ? 'text-red-800' : 'text-amber-800'}`}>
        {showTokenWall
          ? <>You've used your <strong>{usage.monthly_limit} AI tokens</strong> this month. <a href="/pricing" className="underline font-semibold">Get TAKO to keep AI on →</a></>
          : <>Your AI trial ends in <strong>{usage.trial_days_remaining} day{usage.trial_days_remaining !== 1 ? 's' : ''}</strong>. <a href="/pricing" className="underline font-semibold">Get TAKO to keep all agents working →</a></>
        }
      </p>
      <button onClick={dismiss} className="shrink-0 text-slate-400 hover:text-slate-600">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

export default AITrialBanner;
