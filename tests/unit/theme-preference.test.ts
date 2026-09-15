import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveThemePreference } from '../../src/lib/dayNightTheme.ts';

function localHour(hour: number) {
  const date = new Date();
  date.setHours(hour, 0, 0, 0);
  return date;
}

test('manual appearance preferences override automatic behavior', () => {
  assert.equal(resolveThemePreference('dark', localHour(12), false), 'dark');
  assert.equal(resolveThemePreference('light', localHour(22), true), 'light');
});

test('device appearance follows the system preference', () => {
  assert.equal(resolveThemePreference('system', localHour(12), true), 'dark');
  assert.equal(resolveThemePreference('system', localHour(22), false), 'light');
});

test('automatic appearance follows local day and night hours', () => {
  assert.equal(resolveThemePreference('auto', localHour(12), true), 'light');
  assert.equal(resolveThemePreference('auto', localHour(22), false), 'dark');
});
