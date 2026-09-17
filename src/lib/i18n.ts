import { useMemo } from 'react';
import { SupportedLanguage } from '../data/translations';

/**
 * Single localisation helper for the small amount of UI copy that is not in the
 * `TRANSLATIONS` dictionary yet. Keeping it here stops every component from
 * re-declaring its own triple-ternary translator.
 */
export type Localize = (english: string, arabic: string, french: string) => string;

export function createLocalize(language?: string): Localize {
  return (english, arabic, french) => (language === 'ar' ? arabic : language === 'fr' ? french : english);
}

export interface Locale {
  language: SupportedLanguage;
  isArabic: boolean;
  isFrench: boolean;
  direction: 'rtl' | 'ltr';
  t: Localize;
}

export function useLocale(language?: string): Locale {
  return useMemo<Locale>(() => {
    const resolved: SupportedLanguage = language === 'ar' || language === 'fr' ? language : 'en';
    return {
      language: resolved,
      isArabic: resolved === 'ar',
      isFrench: resolved === 'fr',
      direction: resolved === 'ar' ? 'rtl' : 'ltr',
      t: createLocalize(resolved),
    };
  }, [language]);
}

/** `Intl` helpers that must follow the UI language, not the browser default. */
export function formatDate(value: string | undefined, language?: string, options: Intl.DateTimeFormatOptions = { dateStyle: 'medium' }) {
  if (!value) return '—';
  const parsed = Date.parse(value.length === 10 ? `${value}T00:00:00` : value);
  if (Number.isNaN(parsed)) return '—';
  const locale = language === 'ar' ? 'ar-MA' : language === 'fr' ? 'fr-MA' : 'en-GB';
  try {
    return new Intl.DateTimeFormat(locale, options).format(new Date(parsed));
  } catch {
    return value;
  }
}

export function formatCount(value: number, language?: string) {
  try {
    return new Intl.NumberFormat(language === 'ar' ? 'ar-MA' : language === 'fr' ? 'fr-FR' : 'en-US').format(value);
  } catch {
    return String(value);
  }
}

export function formatMoney(amount: number, currency: string, language?: string) {
  if (!Number.isFinite(amount)) return '—';
  try {
    return new Intl.NumberFormat(language === 'ar' ? 'ar-MA' : language === 'fr' ? 'fr-FR' : 'en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: amount >= 1000 ? 0 : 2,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}
