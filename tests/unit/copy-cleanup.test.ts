import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

function source(path: string) {
  return readFileSync(path, 'utf8');
}

test('auth flow no longer contains clipped decorative trip slogans', () => {
  const auth = source('src/components/AuthFlowModal.tsx');
  for (const phrase of [
    'Travel Connect Belong',
    'سافر وتواصل وانتم',
    'سافر وتواصل وانتمِ',
    'Different Ways Same Journey',
    'طرق مختلفة والرحلة واحدة',
  ]) assert.equal(auth.includes(phrase), false, `Auth flow still contains: ${phrase}`);
});

test('location contribution and flight UI avoid implementation-heavy filler', () => {
  const passive = source('src/components/PassiveDataModal.tsx');
  const flights = source('src/components/FlightsModal.tsx');
  for (const phrase of [
    'How the contribution is handled',
    'Current capability',
    'Automatic background trail learning',
    'public live crowd heatmap',
  ]) assert.equal(passive.includes(phrase), false, `Location UI still contains: ${phrase}`);
  for (const phrase of [
    'Prepare your route — live search and fares are not connected yet',
    'No live fares, flight inventory, or seat availability',
  ]) assert.equal(flights.includes(phrase), false, `Flight UI still contains: ${phrase}`);
});
