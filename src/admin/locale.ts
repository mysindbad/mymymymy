// Language for the admin surface. Kept in its own module so non-React code (the fetch
// layer, the error copy) reads the same value the UI renders, and so the choice survives a
// reload without becoming a security-relevant state.
export type AdminLocale = 'ar' | 'en' | 'fr';

const STORAGE_KEY = 'sindbad-admin-locale';

let current: AdminLocale = 'en';

export function getAdminLocale(): AdminLocale {
  return current;
}

export function setAdminLocale(locale: AdminLocale) {
  current = locale;
  try {
    window.localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    // A blocked storage permission must not break the console; the in-memory value is enough.
  }
}

export function initialAdminLocale(): AdminLocale {
  let stored: string | null = null;
  try {
    stored = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    stored = null;
  }
  if (stored === 'ar' || stored === 'en' || stored === 'fr') return stored;
  const browser = navigator.language?.toLowerCase() ?? '';
  if (browser.startsWith('ar')) return 'ar';
  if (browser.startsWith('fr')) return 'fr';
  return 'en';
}

/** The document element carries direction so tables, focus order and native widgets flip. */
export function applyAdminDocumentLocale(locale: AdminLocale) {
  current = locale;
  const root = document.documentElement;
  root.setAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr');
  root.setAttribute('lang', locale);
}
