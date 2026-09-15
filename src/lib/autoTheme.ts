export type AppTheme = 'light' | 'dark';

export const DAY_START_HOUR = 7;
export const NIGHT_START_HOUR = 19;

export function themeForHour(hour: number): AppTheme {
  return hour >= DAY_START_HOUR && hour < NIGHT_START_HOUR ? 'light' : 'dark';
}

export function applyAutoTheme(now = new Date()): AppTheme {
  const theme = themeForHour(now.getHours());
  if (typeof document === 'undefined') return theme;

  const root = document.documentElement;
  root.dataset.theme = theme;
  root.classList.toggle('dark', theme === 'dark');
  root.style.colorScheme = theme;

  let themeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (!themeColor) {
    themeColor = document.createElement('meta');
    themeColor.name = 'theme-color';
    document.head.appendChild(themeColor);
  }
  themeColor.content = theme === 'dark' ? '#020617' : '#2563eb';
  return theme;
}

export function startAutoTheme(intervalMs = 60_000) {
  applyAutoTheme();
  if (typeof window === 'undefined') return () => {};
  const interval = window.setInterval(() => applyAutoTheme(), intervalMs);
  const handleVisibility = () => {
    if (!document.hidden) applyAutoTheme();
  };
  document.addEventListener('visibilitychange', handleVisibility);
  return () => {
    window.clearInterval(interval);
    document.removeEventListener('visibilitychange', handleVisibility);
  };
}
