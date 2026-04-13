import en from './locales/en.json';
import de from './locales/de.json';

const translations = { en, de };

export function useT() {
  const lang = localStorage.getItem('tako_lang') || 'en';
  const strings = translations[lang] || translations.en;
  
  const t = (key) => {
    const parts = key.split('.');
    let val = strings;
    for (const p of parts) {
      val = val?.[p];
    }
    return val || key;
  };
  
  return { t, lang };
}
