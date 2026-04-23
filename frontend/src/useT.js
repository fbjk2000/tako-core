import en from './locales/en.json';
import de from './locales/de.json';

const translations = { en, de };

// Walk a dotted i18n key ("partners.joinTitle") through a nested dict
// and return the leaf string, or undefined if any segment is missing.
// Returning undefined (rather than the key) is deliberate — callers want
// to distinguish "missing" from "found a valid empty string".
const lookup = (dict, key) => {
  const parts = key.split('.');
  let val = dict;
  for (const p of parts) {
    val = val?.[p];
  }
  return typeof val === 'string' ? val : undefined;
};

export function useT() {
  const lang = localStorage.getItem('tako_lang') || 'en';
  const strings = translations[lang] || translations.en;

  // Resolution order: active locale → English → raw key.
  // Falling back to English before the raw key means a missing German
  // translation still shows a real sentence to the user (far better than
  // leaking "partners.joinTitle" into the UI). The raw-key return is the
  // final safety net for truly unknown keys and also lets callers rely on
  // `t('x') || 'fallback'` when needed.
  const t = (key) => {
    const primary = lookup(strings, key);
    if (primary !== undefined) return primary;
    if (lang !== 'en') {
      const fallback = lookup(translations.en, key);
      if (fallback !== undefined) return fallback;
    }
    return key;
  };

  return { t, lang };
}
