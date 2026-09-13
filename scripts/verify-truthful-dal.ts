import assert from 'node:assert/strict';

delete process.env.SUPABASE_URL;
delete process.env.VITE_SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;
delete process.env.SUPABASE_ANON_KEY;
delete process.env.VITE_SUPABASE_ANON_KEY;

const { createDal } = await import('../server/dal.ts');

type ServiceError = Error & { status?: number; code?: string };

async function expectUnavailable(label: string, action: () => Promise<unknown>) {
  let caught: ServiceError | undefined;
  try {
    await action();
  } catch (error) {
    caught = error as ServiceError;
  }

  assert.ok(caught, `${label} should fail instead of returning seed data`);
  assert.equal(caught.status, 503, `${label} should return service unavailable`);
  assert.equal(caught.code, 'DATA_SERVICE_UNAVAILABLE', `${label} should use the public service-unavailable code`);
}

process.env.NODE_ENV = 'production';
process.env.ALLOW_SEED_FALLBACK = 'true';
delete process.env.VERCEL_ENV;

await expectUnavailable('production places.getAll', () => createDal().places.getAll());
await expectUnavailable('production places.getById', () => createDal().places.getById('seed-id'));
await expectUnavailable('production traces.getSummary', () => createDal().traces.getSummary());
await expectUnavailable('production DAL getSummary', () => createDal().getSummary());

process.env.NODE_ENV = 'development';
process.env.VERCEL_ENV = 'production';
process.env.ALLOW_SEED_FALLBACK = 'true';
await expectUnavailable('Vercel production places.getAll', () => createDal().places.getAll());

delete process.env.VERCEL_ENV;
delete process.env.ALLOW_SEED_FALLBACK;
await expectUnavailable('development without opt-in', () => createDal().places.getAll());

process.env.ALLOW_SEED_FALLBACK = 'true';
const seedPlaces = await createDal().places.getAll();
assert.ok(Array.isArray(seedPlaces), 'explicit development fallback should return an array');
assert.ok(seedPlaces.length > 0, 'explicit development fallback should expose bundled seed data only when opted in');

console.log('Truthful DAL fallback verification passed');
