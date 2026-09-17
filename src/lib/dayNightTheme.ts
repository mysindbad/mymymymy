export type DayNightTheme = 'light' | 'dark';
export type ThemePreference = 'auto' | 'system' | 'light' | 'dark';

export const DAY_START_HOUR = 7;
export const NIGHT_START_HOUR = 19;
export const THEME_PREFERENCE_KEY = 'sindbad_theme_preference';
const THEME_CHANGE_EVENT = 'sindbad-theme-preference-change';

export function themeForHour(hour: number): DayNightTheme {
  return hour >= DAY_START_HOUR && hour < NIGHT_START_HOUR ? 'light' : 'dark';
}

function applyTheme(theme: DayNightTheme) {
  const root = document.documentElement;
  root.classList.toggle('dark', theme === 'dark');
  // `theme-dark` is also set on <html> so the pre-bundle stylesheet can paint the
  // right background before React mounts (no white flash at night).
  root.classList.toggle('theme-dark', theme === 'dark');
  root.dataset.theme = theme;
  root.style.colorScheme = theme;

  const themeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (themeColor) themeColor.content = theme === 'dark' ? '#020617' : '#f4f6fa';
}

export function getThemePreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(THEME_PREFERENCE_KEY);
    return stored === 'system' || stored === 'light' || stored === 'dark' || stored === 'auto' ? stored : 'auto';
  } catch {
    return 'auto';
  }
}

export function resolveThemePreference(
  preference: ThemePreference,
  date = new Date(),
  systemPrefersDark = typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-color-scheme: dark)').matches
    : false,
): DayNightTheme {
  if (preference === 'dark') return 'dark';
  if (preference === 'light') return 'light';
  if (preference === 'system') return systemPrefersDark ? 'dark' : 'light';
  return themeForHour(date.getHours());
}

export function applyThemePreference(preference = getThemePreference(), date = new Date()) {
  const theme = resolveThemePreference(preference, date);
  applyTheme(theme);
  document.documentElement.dataset.themePreference = preference;
  return theme;
}

export function setThemePreference(preference: ThemePreference) {
  try { localStorage.setItem(THEME_PREFERENCE_KEY, preference); } catch { /* session theme still works */ }
  applyThemePreference(preference);
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(THEME_CHANGE_EVENT, { detail: preference }));
}

export function applyAutomaticDayNightTheme(date = new Date()) {
  const theme = themeForHour(date.getHours());
  applyTheme(theme);
  return theme;
}

export function startAutomaticDayNightTheme() {
  const refresh = () => applyThemePreference();
  refresh();

  const timer = window.setInterval(refresh, 60_000);
  const media = typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  const onVisibility = () => { if (!document.hidden) refresh(); };
  const onStorage = (event: StorageEvent) => { if (event.key === THEME_PREFERENCE_KEY) refresh(); };
  const onPreferenceChange = () => refresh();

  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('storage', onStorage);
  window.addEventListener(THEME_CHANGE_EVENT, onPreferenceChange);
  media?.addEventListener?.('change', refresh);

  return () => {
    window.clearInterval(timer);
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('storage', onStorage);
    window.removeEventListener(THEME_CHANGE_EVENT, onPreferenceChange);
    media?.removeEventListener?.('change', refresh);
  };
}
