import assert from 'node:assert/strict';
import test from 'node:test';

import { DalAuthorizationError } from '../../server/dal.ts';
import { AdminNotConfiguredError, requireAdminActor, resolveAdminRole } from '../../server/admin.ts';

const ADMIN_ID = '8f14e45f-ea2a-4b1a-9d5c-2f7a1e6c3b44';
const CANARY = 'servicerole-canary-must-never-reach-a-client';

type RpcOutcome = { data?: unknown; error?: { code?: string; message?: string } | null };

/**
 * The authorization check is one RPC and nothing else. A stub that would let the code read a
 * table directly instead of asking the database raises, so a regression to "trust the client"
 * or to an unprotected select cannot hide behind a green test.
 */
function stubClient(outcome: RpcOutcome) {
  const calls: Array<{ fn: string; args: Record<string, unknown> }> = [];
  const client = {
    rpc(fn: string, args: Record<string, unknown>) {
      calls.push({ fn, args });
      return Promise.resolve({ data: outcome.data ?? null, error: outcome.error ?? null });
    },
    from() {
      throw new Error('authorization must be resolved by the database, not by a table read');
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
  return { client, calls };
}

test('the role comes from one RPC, scoped to the verified user id', async () => {
  const { client, calls } = stubClient({ data: { admin_role_of: 'admin' } });
  assert.equal(await resolveAdminRole(client, ADMIN_ID), 'admin');
  assert.deepEqual(calls, [{ fn: 'admin_role_of', args: { p_user_id: ADMIN_ID } }]);
});

test('the scalar response shape is understood too', async () => {
  const { client } = stubClient({ data: 'super_admin' });
  assert.equal(await resolveAdminRole(client, ADMIN_ID), 'super_admin');
});

test('no identifier means no role, and no query is made', async () => {
  const { client, calls } = stubClient({ data: { admin_role_of: 'super_admin' } });
  assert.equal(await resolveAdminRole(client, null), null);
  assert.equal(await resolveAdminRole(client, 'not-a-uuid'), null);
  assert.equal(calls.length, 0);
});

test('the database saying "no row" means no access', async () => {
  const { client } = stubClient({ data: null });
  assert.equal(await resolveAdminRole(client, ADMIN_ID), null);
});

test('a role the product does not know fails closed instead of granting read access', async () => {
  const { client } = stubClient({ data: { admin_role_of: 'auditor' } });
  assert.equal(await resolveAdminRole(client, ADMIN_ID), null);
});

test('requireAdminActor separates no session, no admin store, and no role', async () => {
  await assert.rejects(
    () => requireAdminActor({ user: null, client: null, superUser: false }),
    (error: any) => error?.status === 401 && error?.name === 'DalAuthenticationError',
  );

  const { client } = stubClient({ data: { admin_role_of: 'admin' } });
  await assert.rejects(
    () => requireAdminActor({ user: { id: ADMIN_ID }, client: null }),
    (error: unknown) => error instanceof AdminNotConfiguredError && (error as AdminNotConfiguredError).code === 'ADMIN_BACKEND_UNAVAILABLE' && (error as AdminNotConfiguredError).status === 503,
  );

  const nobody = stubClient({ data: null });
  await assert.rejects(
    () => requireAdminActor({ user: { id: ADMIN_ID }, client: nobody.client }),
    (error: any) => error?.status === 403 && error?.code === 'ADMIN_REQUIRED' && error instanceof DalAuthorizationError,
  );

  // The refusal must not tell an attacker which part of the system is broken.
  const refused = await requireAdminActor({ user: { id: ADMIN_ID }, client: nobody.client }).then(
    () => null,
    (error: any) => error as Error,
  );
  assert.ok(refused instanceof Error);
  assert.ok(!/SUPABASE|service_role|admin_accounts/i.test(refused!.message), `lethal detail: ${refused!.message}`);
});

test('an administrator is an administrator, but not for super-admin operations', async () => {
  const admin = stubClient({ data: { admin_role_of: 'admin' } });
  assert.deepEqual(await requireAdminActor({ user: { id: ADMIN_ID }, client: admin.client }), { userId: ADMIN_ID, role: 'admin' });

  await assert.rejects(
    () => requireAdminActor({ user: { id: ADMIN_ID }, client: admin.client, superUser: true }),
    (error: any) => error?.status === 403 && error?.code === 'SUPER_ADMIN_REQUIRED',
  );

  const superAdmin = stubClient({ data: { admin_role_of: 'super_admin' } });
  assert.equal((await requireAdminActor({ user: { id: ADMIN_ID }, client: superAdmin.client, superUser: true })).role, 'super_admin');
});

test('a roster lookup that fails is a real failure, never a silent "not an administrator"', async () => {
  await assert.rejects(
    () => resolveAdminRole(stubClient({ error: { code: '42501', message: 'permission denied for function admin_role_of' } }).client, ADMIN_ID),
    (error: any) => error instanceof DalAuthorizationError && error.status === 403,
  );

  await assert.rejects(
    () => resolveAdminRole(stubClient({ error: { code: 'XX000', message: 'function admin_role_of(uuid) does not exist' } }).client, ADMIN_ID),
    (error: any) => error?.code === 'XX000' && !(error instanceof DalAuthorizationError),
  );
});

// ---------------------------------------------------------------- HTTP surface
// Boots the real app in an environment where the privileged Supabase client cannot be
// created, which is the worst case: every route must still answer on its own terms.

async function startApp() {
  process.env.VERCEL = '1';
  process.env.SUPABASE_SERVICE_ROLE_KEY = CANARY;
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_ANON_KEY;
  const app = (await import('../../server.ts')).default;
  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('no address');
  return {
    base: `http://127.0.0.1:${address.port}`,
    close: () => new Promise<void>((resolve) => { server.close(() => resolve()); }),
  };
}

async function request(base: string, path: string, init?: RequestInit) {
  const response = await fetch(`${base}${path}`, init);
  const text = await response.text();
  let body: Record<string, unknown> = {};
  try {
    body = JSON.parse(text) as Record<string, unknown>;
  } catch {
    body = { raw: text };
  }
  return { status: response.status, body, text, headers: Object.fromEntries(response.headers.entries()) };
}

test('every admin endpoint refuses an unauthenticated caller, reads and writes alike', async (t) => {
  const { base, close } = await startApp();
  t.after(close);

  const reads = [
    '/api/admin/overview',
    '/api/admin/places',
    `/api/admin/places/${ADMIN_ID}`,
    '/api/admin/moderation/queue',
    '/api/admin/reviews',
    '/api/admin/travelers',
    `/api/admin/travelers/${ADMIN_ID}`,
    '/api/admin/administrators',
    '/api/admin/audit-events',
    '/api/admin/service-health',
    '/api/admin/ai-operations',
    '/api/admin/settings',
  ];
  // Each write is sent with the method the real endpoint uses, so "there is no such route"
  // can never be mistaken for "the route refused correctly".
  const writes: Array<[string, string, Record<string, unknown> | undefined]> = [
    [`/api/admin/places/${ADMIN_ID}/moderation`, 'POST', { status: 'approved' }],
    [`/api/admin/places/${ADMIN_ID}`, 'PATCH', { description: 'rewritten by an attacker', rating: 5, seed_data: false }],
    [`/api/admin/reviews/${ADMIN_ID}/moderation`, 'POST', { status: 'rejected' }],
    ['/api/admin/administrators/grant', 'POST', { role: 'super_admin', user_id: ADMIN_ID, reason: 'escalate me' }],
    ['/api/admin/administrators/revoke', 'POST', { user_id: ADMIN_ID, reason: 'lock everyone out' }],
    ['/api/admin/service-health/probes', 'POST', undefined],
  ];

  for (const path of reads) {
    const response = await request(base, path);
    // Refused at the session boundary, with a machine-readable code, and never by the SPA
    // fallback (an HTML answer would mean the route is not actually on the guarded admin router).
    assert.equal(response.status, 401, `${path} answered ${response.status}: ${response.text.slice(0, 80)}`);
    assert.equal(response.body?.code, 'TOKEN_MISSING', `${path} refused without saying why`);
    assert.ok(String(response.headers['content-type'] ?? '').includes('application/json'), `${path} answered without JSON`);
    assert.equal(response.body?.data, undefined, `${path} leaked a payload`);
    assert.ok(!/at .*\.ts:\d+:\d+/.test(response.text), `${path} leaked a stack trace`);
  }

  for (const [path, method, body] of writes) {
    const response = await request(base, path, {
      method,
      headers: { 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    assert.equal(response.status, 401, `${method} ${path} accepted an unauthenticated write (${response.status})`);
    assert.equal(response.body?.code, 'TOKEN_MISSING');
    assert.ok(!response.text.includes(CANARY), `${method} ${path} echoed the service-role secret`);
  }
});

test('a forged bearer token is refused, and no token material comes back', async (t) => {
  const { base, close } = await startApp();
  t.after(close);

  const forged = await request(base, '/api/admin/places', { headers: { Authorization: 'Bearer eyJhbGciOi.forged.token' } });
  assert.equal(forged.status, 401);
  assert.ok(!forged.text.includes('eyJ'), 'the refusal echoed the bearer token');

  const probe = await request(base, '/api/admin/session');
  assert.equal(probe.status, 200, 'the session probe is the one endpoint that must answer for anyone');
  assert.equal(probe.body?.status, 'anonymous');
  assert.equal(probe.body?.isConfigured, false);
  assert.ok(!('role' in probe.body), 'the probe must not advertise a role it did not verify');
  assert.ok(!probe.text.includes(CANARY), 'the service-role secret leaked into a response');
});

test('an unknown admin path does not enumerate the admin surface', async (t) => {
  const { base, close } = await startApp();
  t.after(close);

  // Unknown path, and a known path asked with a method it does not serve, both answer with the
  // same small JSON refusal: parseable by the admin client, and no framework error page.
  for (const [method, path] of [['GET', '/api/admin/definitely-not-a-route'], ['POST', '/api/admin/places'], ['DELETE', `/api/admin/places/${ADMIN_ID}`]] as const) {
    const response = await request(base, path, { method });
    assert.equal(response.status, 404, `${method} ${path} -> ${response.status}`);
    assert.ok(String(response.headers['content-type'] ?? '').includes('application/json'), `${method} ${path} answered with HTML`);
    assert.equal(response.body?.code, 'ADMIN_ROUTE_NOT_FOUND', response.text.slice(0, 120));
    assert.ok(!/cannot\s+get|cannot\s+post|express|at .*\.ts:\d+:\d+/i.test(response.text), `the refusal leaked internals: ${response.text.slice(0, 160)}`);
  }
});

test('the public health endpoint stays public and says nothing about admin capability', async (t) => {
  const { base, close } = await startApp();
  t.after(close);

  const response = await request(base, '/api/health');
  assert.equal(response.status, 200);
  assert.equal(response.body?.status, 'ok');
  assert.ok(!response.text.includes(CANARY));
  assert.ok(!('role' in response.body) && !('admin' in response.body), 'the public payload grew admin fields');
});
