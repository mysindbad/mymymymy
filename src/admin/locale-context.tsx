// Language plumbing for the admin console. The consumer app resolves its language from the
// signed-in profile; an administrator's own preferred reading language is a device preference
// of the person operating the console, so it lives in localStorage and never in user data.
/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { applyAdminDocumentLocale, setAdminLocale, type AdminLocale } from './locale';

export interface AdminLocaleApi {
  language: AdminLocale;
  direction: 'rtl' | 'ltr';
  isArabic: boolean;
  setLanguage: (next: AdminLocale) => void;
  /** English, Arabic, French. Every string in this surface goes through it. */
  t: (english: string, arabic: string, french: string) => string;
  n: (value: number | null | undefined, fractionDigits?: number) => string;
  pct: (value: number | null | undefined) => string;
  date: (value: string | null | undefined) => string;
  time: (value: string | null | undefined) => string;
  dateTime: (value: string | null | undefined) => string;
  relative: (value: string | null | undefined) => string;
}

const AdminLocaleContext = createContext<AdminLocaleApi | null>(null);

const LOCALES: Record<AdminLocale, string> = { ar: 'ar-MA', en: 'en-GB', fr: 'fr-FR' };

function formatter(locale: AdminLocale, options: Intl.DateTimeFormatOptions) {
  try {
    return new Intl.DateTimeFormat(LOCALES[locale], options);
  } catch {
    return new Intl.DateTimeFormat('en-GB', options);
  }
}

export function AdminLocaleProvider({ initial, children }: { initial: AdminLocale; children: ReactNode }) {
  const [language, setLanguageState] = useState<AdminLocale>(initial);

  const setLanguage = useCallback((next: AdminLocale) => {
    setLanguageState(next);
    setAdminLocale(next);
    applyAdminDocumentLocale(next);
  }, []);

  const value = useMemo<AdminLocaleApi>(() => {
    const t: AdminLocaleApi['t'] = (english, arabic, french) => {
      if (language === 'ar') return arabic;
      if (language === 'fr') return french;
      return english;
    };
    const numberFormat = new Intl.NumberFormat(LOCALES[language], { maximumFractionDigits: 1 });
    const dateFmt = formatter(language, { dateStyle: 'medium' });
    const timeFmt = formatter(language, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const dateTimeFmt = formatter(language, { dateStyle: 'medium', timeStyle: 'short' });
    const rtf = new Intl.RelativeTimeFormat(language === 'ar' ? 'ar' : language === 'fr' ? 'fr' : 'en', { numeric: 'auto' });

    return {
      language,
      direction: language === 'ar' ? 'rtl' : 'ltr',
      isArabic: language === 'ar',
      setLanguage,
      t,
      n: (value, fractionDigits) => {
        if (value === null || value === undefined || !Number.isFinite(value)) return '—';
        return new Intl.NumberFormat(LOCALES[language], {
          minimumFractionDigits: 0,
          maximumFractionDigits: fractionDigits ?? 1,
        }).format(value);
      },
      pct: (value) => {
        if (value === null || value === undefined || !Number.isFinite(value)) return '—';
        return `${numberFormat.format(Math.round(value * 10) / 10)}%`;
      },
      date: (value) => {
        if (!value) return '—';
        const at = new Date(value);
        return Number.isNaN(at.getTime()) ? '—' : dateFmt.format(at);
      },
      time: (value) => {
        if (!value) return '—';
        const at = new Date(value);
        return Number.isNaN(at.getTime()) ? '—' : timeFmt.format(at);
      },
      dateTime: (value) => {
        if (!value) return '—';
        const at = new Date(value);
        return Number.isNaN(at.getTime()) ? '—' : dateTimeFmt.format(at);
      },
      relative: (value) => {
        if (!value) return '—';
        const at = new Date(value).getTime();
        if (Number.isNaN(at)) return '—';
        const seconds = Math.round((at - Date.now()) / 1000);
        const minutes = Math.round(seconds / 60);
        const hours = Math.round(minutes / 60);
        const days = Math.round(hours / 24);
        if (Math.abs(seconds) < 60) return rtf.format(seconds, 'second');
        if (Math.abs(minutes) < 60) return rtf.format(minutes, 'minute');
        if (Math.abs(hours) < 36) return rtf.format(hours, 'hour');
        return rtf.format(days, 'day');
      },
    };
  }, [language, setLanguage]);

  return <AdminLocaleContext.Provider value={value}>{children}</AdminLocaleContext.Provider>;
}

export function useAdminLocale(): AdminLocaleApi {
  const context = useContext(AdminLocaleContext);
  if (!context) throw new Error('useAdminLocale must be used inside AdminLocaleProvider');
  return context;
}
