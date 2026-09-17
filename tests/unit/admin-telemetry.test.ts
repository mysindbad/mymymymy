import assert from 'node:assert/strict';
import test from 'node:test';

import { DataValidationError } from '../../server/dal.ts';
import {
  buildServiceEventRow,
  classifyFetchOutcome,
  createServiceEventRecorder,
  isoDay,
  percentile,
  statusFromTelemetry,
  summarizeAiUsage,
  summarizeOutcomes,
  type AdminClientLike,
} from '../../server/admin.ts';

const NEWLINE = String.fromCharCode(10);
const BELL = String.fromCharCode(7);

test('a row is only written for an outbound dependency', () => {
  assert.equal(buildServiceEventRow({ service: 'weather', outcome: 'ok' }).service, 'weather');
  // The app's own responses are visible in the request log; storing them would be
  // a row per page load that tells an operator nothing.
  for (const service of ['api', 'database', 'smtp', 'everything'] as never[]) {
    assert.throws(
      () => buildServiceEventRow({ service, outcome: 'ok' }),
      (error: unknown) => (error as DataValidationError)?.status === 400,
    );
  }
});

test('latency and status class are clamped, never trusted', () => {
  assert.equal(buildServiceEventRow({ service: 'ai', outcome: 'ok', latencyMs: -400 }).latency_ms, 0);
  assert.equal(buildServiceEventRow({ service: 'ai', outcome: 'ok', latencyMs: 1500.7 }).latency_ms, 1501);
  assert.equal(buildServiceEventRow({ service: 'ai', outcome: 'ok', latencyMs: Number.NaN }).latency_ms, 0);
  assert.equal(buildServiceEventRow({ service: 'ai', outcome: 'ok', latencyMs: 9600000 }).latency_ms, 3600000);

  assert.equal(buildServiceEventRow({ service: 'ai', outcome: 'error', statusClass: 503 }).status_class, 503);
  assert.equal(buildServiceEventRow({ service: 'ai', outcome: 'error', statusClass: 404.9 }).status_class, 404);
  for (const statusClass of [0, 7, 99, 600, 100000, null, undefined]) {
    assert.equal(
      buildServiceEventRow({ service: 'ai', outcome: 'error', statusClass: statusClass as never }).status_class,
      null,
      `${statusClass} is not an HTTP status`,
    );
  }
});

test('long or hostile free text is truncated, and credentials inside it are removed', () => {
  const long = buildServiceEventRow({
    service: 'tiles',
    outcome: 'error',
    endpoint: 'https://tiles.example.org/' + 'x'.repeat(300),
    detail: 'upstream said: ' + 'y'.repeat(500),
  });
  assert.equal(long.endpoint?.length, 96, 'an endpoint cannot bloat a row');
  assert.equal(long.detail?.length, 240, 'a detail cannot bloat a row');

  const leaky = buildServiceEventRow({
    service: 'tiles',
    outcome: 'error',
    detail: 'upstream rejected Authorization: Bearer supersecret-token-value for eyJhbGciOiJIUzI1NiJ9.payload.sig',
  });
  assert.ok(!leaky.detail?.includes('supersecret-token-value'), 'a bearer token was stored');
  assert.ok(!leaky.detail?.includes('eyJhbGciOiJIUzI1NiJ9'), 'a JWT was stored');
  assert.ok(leaky.detail?.includes('Bearer [redacted]'));

  // Control characters cannot be used to smuggle a line break (or a log injection) into the row.
  const control = buildServiceEventRow({
    service: 'tiles',
    outcome: 'ok',
    endpoint: 'https://a.example.org/one' + NEWLINE + BELL + 'two',
  });
  assert.equal(control.endpoint, 'https://a.example.org/one' + ' ' + ' ' + 'two');
  assert.ok(!control.endpoint?.includes(NEWLINE));

  assert.equal(buildServiceEventRow({ service: 'tiles', outcome: 'ok', endpoint: '', detail: '' }).endpoint, null);
  assert.equal(buildServiceEventRow({ service: 'tiles', outcome: 'ok', endpoint: '', detail: '' }).detail, null);
});

test('an upstream answer is classified into one of four honest states', () => {
  assert.equal(classifyFetchOutcome(200, false, 12), 'healthy');
  assert.equal(classifyFetchOutcome(301, false, 12), 'healthy');
  assert.equal(classifyFetchOutcome(399, false, 12), 'healthy');
  assert.equal(classifyFetchOutcome(404, false, 12), 'degraded');
  assert.equal(classifyFetchOutcome(429, false, 12), 'degraded');
  assert.equal(classifyFetchOutcome(500, false, 12), 'unavailable');
  assert.equal(classifyFetchOutcome(503, false, null), 'unavailable');
  assert.equal(classifyFetchOutcome(null, false, 5), 'unavailable', 'no answer is not a good answer');
  assert.equal(classifyFetchOutcome(200, true, 5), 'unavailable', 'a request that threw cannot be healthy');
  assert.equal(classifyFetchOutcome(100, false, 5), 'degraded');
});

test('zero observations is unknown, never healthy', () => {
  const empty = statusFromTelemetry({ service: 'weather', ok: 0, failed: 0 });
  assert.equal(empty.status, 'unknown');
  assert.match(empty.detail ?? '', /no requests observed/);

  assert.equal(statusFromTelemetry({ service: 'weather', ok: 41, failed: 0 }).status, 'healthy');
  assert.equal(statusFromTelemetry({ service: 'weather', ok: 3, failed: 1 }).status, 'degraded');
  assert.equal(statusFromTelemetry({ service: 'weather', ok: 1, failed: 1 }).status, 'unavailable');
  assert.equal(statusFromTelemetry({ service: 'weather', ok: 0, failed: 9 }).status, 'unavailable');

  const degraded = statusFromTelemetry({ service: 'ai', ok: 8, failed: 2, lastProblemAt: '2026-09-15T08:00:00.000Z' });
  assert.equal(degraded.key, 'ai');
  assert.equal(degraded.source, 'telemetry');
  assert.equal(degraded.checkedAt, '2026-09-15T08:00:00.000Z', 'the last problem is the timestamp an operator wants');
  assert.match(degraded.detail ?? '', /^8 ok . 2 failed$/);
});

test('percentiles answer null when there is nothing to measure', () => {
  assert.equal(percentile([], 0.5), null);
  assert.equal(percentile([40], 0.95), 40);
  assert.equal(percentile([30, 10, 20], 0.5), 20);
  assert.equal(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 0.95), 10);
  assert.equal(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 0.0), 1);
  const input = [5, 1, 3];
  percentile(input, 0.5);
  assert.deepEqual(input, [5, 1, 3], 'the caller array must not be reordered in place');
});

test('AI usage is counted from the events that exist, and nothing else', () => {
  const now = new Date('2026-09-17T12:00:00.000Z');
  const rows = [
    { endpoint: 'trip-plan', created_at: new Date(now.getTime() - 2 * 3600_000).toISOString() },
    { endpoint: 'trip-plan', created_at: new Date(now.getTime() - 20 * 3600_000).toISOString() },
    { endpoint: 'assistant', created_at: new Date(now.getTime() - 30 * 24 * 3600_000).toISOString() },
    { endpoint: null, created_at: 'not a date' },
  ];
  const usage = summarizeAiUsage(rows, now);

  assert.equal(usage.total7d, 4, 'the count is the rows that were fetched, whatever their timestamps');
  assert.equal(usage.last24h, 2, 'both requests inside the last day count as recent, whichever calendar day they fell on');
  assert.deepEqual(usage.byEndpoint, [{ endpoint: 'trip-plan', count: 2 }, { endpoint: 'assistant', count: 1 }, { endpoint: 'unknown', count: 1 }]);

  // Fourteen buckets are offered so the strip has a stable width; a day with no traffic
  // renders as zero rather than disappearing, and no day is invented as a spike.
  assert.equal(usage.perDay.length, 14);
  assert.equal(usage.perDay.at(-1)!.date, isoDay(now));
  assert.equal(usage.perDay.at(-1)!.count, 1);
  assert.equal(usage.perDay.at(-2)!.count, 1, 'yesterday keeps its own request');
  assert.equal(usage.perDay.filter((day) => day.count === 0).length, 12, 'a month-old request lands in no bucket at all');
  const dates = usage.perDay.map((day) => day.date);
  assert.deepEqual(dates, [...dates].sort(), 'days are ordered oldest to newest');

  const empty = summarizeAiUsage([], now);
  assert.equal(empty.total7d, 0);
  assert.equal(empty.last24h, 0);
  assert.deepEqual(empty.byEndpoint, []);
});

test('outcomes summarise counts and latencies from real rows', () => {
  const summary = summarizeOutcomes([
    { outcome: 'ok', latency_ms: 120 },
    { outcome: 'ok', latency_ms: 400 },
    { outcome: 'error', latency_ms: 900 },
    { outcome: 'rate_limited', latency_ms: 'not a number' },
    { outcome: 'ok' },
  ]);
  assert.equal(summary.total, 5);
  assert.equal(summary.ok, 3);
  assert.equal(summary.failed, 2);
  assert.equal(summary.p50LatencyMs, 400, 'the middle observation, not the fastest one');
  assert.equal(summary.p95LatencyMs, 900);

  const noLatencies = summarizeOutcomes([{ outcome: 'error' }]);
  assert.equal(noLatencies.p50LatencyMs, null);
  assert.equal(noLatencies.p95LatencyMs, null);
  assert.deepEqual(summarizeOutcomes([]), { total: 0, ok: 0, failed: 0, p50LatencyMs: null, p95LatencyMs: null });
});

test('telemetry never changes what a user sees', async () => {
  const written: Array<Record<string, unknown>> = [];
  const client = {
    from: (table: string) => ({
      insert: (values: Record<string, unknown>) => {
        if (table !== 'service_events') throw new Error('unexpected telemetry table ' + table);
        written.push(values);
        // A rejected write must stay invisible to the request that triggered it.
        return { then: () => Promise.reject(new Error('insert failed')) };
      },
    }),
  } as unknown as AdminClientLike;

  const recorder = createServiceEventRecorder(client);
  const row = recorder({ service: 'weather', outcome: 'ok', latencyMs: 42 });
  assert.deepEqual(row, { service: 'weather', outcome: 'ok', endpoint: null, latency_ms: 42, status_class: null, detail: null });
  assert.equal(written.length, 1);

  const rejections: unknown[] = [];
  const capture = (reason: unknown) => rejections.push(reason);
  process.on('unhandledRejection', capture);
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
  process.off('unhandledRejection', capture);
  assert.deepEqual(rejections, [], 'telemetry leaked an unhandled rejection into the process');

  // A client whose insert explodes synchronously is still not allowed to break the request.
  const exploding = {
    from: () => { throw new Error('client is gone'); },
  } as unknown as AdminClientLike;
  assert.deepEqual(createServiceEventRecorder(exploding)({ service: 'ai', outcome: 'error' }), {
    service: 'ai', outcome: 'error', endpoint: null, latency_ms: 0, status_class: null, detail: null,
  });

  // Without a store there is nothing to write to: the recorder says so with null and stays quiet.
  assert.equal(createServiceEventRecorder(null)({ service: 'tiles', outcome: 'unavailable' }), null);
});
