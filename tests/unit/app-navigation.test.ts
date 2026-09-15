import assert from 'node:assert/strict';
import test from 'node:test';
import { destinationVoiceReply, extractDestinationIntent, resolveAppNavigationHelp } from '../../src/lib/appNavigation.ts';

test('assistant resolves add-trip help to the Trips screen', () => {
  const result = resolveAppNavigationHelp("I can't find how to add a trip", 'en');
  assert.ok(result);
  assert.equal(result?.actions[0].target, 'trips');
  assert.equal(result?.actions[0].label, 'Add Trip');
});

test('assistant resolves Arabic account help', () => {
  const result = resolveAppNavigationHelp('أين إعدادات الحساب؟', 'ar');
  assert.ok(result);
  assert.equal(result?.actions[0].target, 'account');
});

test('assistant understands natural Arabic create-trip wording', () => {
  const result = resolveAppNavigationHelp('أريد أنشأ رحلة', 'ar');
  assert.ok(result);
  assert.equal(result?.actions[0].target, 'trips');
  assert.equal(result?.actions[0].label, 'إضافة رحلة');
});

test('assistant keeps Arabic greetings concise instead of sending filler to AI', () => {
  const result = resolveAppNavigationHelp('مرحبا', 'ar');
  assert.ok(result);
  assert.equal(result?.actions.length, 0);
  assert.equal(result?.text, 'مرحباً. كيف أساعدك؟');
});

test('assistant answers Arabic hear-me check directly', () => {
  const result = resolveAppNavigationHelp('هل تسمعني؟', 'ar');
  assert.ok(result);
  assert.equal(result?.actions.length, 0);
  assert.equal(result?.text, 'نعم، أسمعك. ماذا تريد؟');
});

test('voice destination intent stays a choice instead of forcing navigation', () => {
  const destination = extractDestinationIntent('I want to go to Marrakech', 'en');
  assert.equal(destination, 'Marrakech');
  const reply = destinationVoiceReply(destination!, 'en');
  assert.deepEqual(reply.actions.map((action) => action.target), ['explore', 'trips']);
  assert.equal(reply.actions[0].query, 'Marrakech');
});
