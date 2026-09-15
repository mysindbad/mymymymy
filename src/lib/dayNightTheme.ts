export type DayNightTheme = 'light' | 'dark';

export const DAY_START_HOUR = 7;
export const NIGHT_START_HOUR = 19;

export function themeForHour(hour: number): DayNightTheme {
  return hour >= DAY_START_HOUR && hour < NIGHT_START_HOUR ? 'light' : 'dark';
}

function applyTheme(theme: DayNightTheme) {
  const root = document.documentElement;
  root.classList.toggle('dark', theme === 'dark');
  root.dataset.theme = theme;
  root.style.colorScheme = theme;

  const themeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (themeColor) themeColor.content = theme === 'dark' ? '#020617' : '#2563eb';
}

export function applyAutomaticDayNightTheme(date = new Date()) {
  const theme = themeForHour(date.getHours());
  applyTheme(theme);
  return theme;
}

export function startAutomaticDayNightTheme() {
  applyAutomaticDayNightTheme();
  const refresh = () => applyAutomaticDayNightTheme();
  const timer = window.setInterval(refresh, 60_000);
  document.addEventListener('visibilitychange', refresh);

  return () => {
    window.clearInterval(timer);
    document.removeEventListener('visibilitychange', refresh);
  };
}
