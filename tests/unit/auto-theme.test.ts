import assert from 'node:assert/strict';
import test from 'node:test';
import { DAY_START_HOUR, NIGHT_START_HOUR, themeForHour } from '../../src/lib/autoTheme.ts';

test('automatic theme uses light during the day and dark at night', () => {
  assert.equal(themeForHour(0), 'dark');
  assert.equal(themeForHour(DAY_START_HOUR - 1), 'dark');
  assert.equal(themeForHour(DAY_START_HOUR), 'light');
  assert.equal(themeForHour(12), 'light');
  assert.equal(themeForHour(NIGHT_START_HOUR - 1), 'light');
  assert.equal(themeForHour(NIGHT_START_HOUR), 'dark');
  assert.equal(themeForHour(23), 'dark');
});
