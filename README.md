# My Sindbad

## Google sign-in setup

The app uses Supabase Auth with the PKCE flow and returns to:

```text
https://<your-app-host>/auth/callback
```

To enable Google sign-in:

1. In Supabase, open **Authentication → Providers → Google** and add the Google OAuth client ID and secret.
2. In **Authentication → URL Configuration**, add the exact production callback URL above to the redirect allow list.
3. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in the frontend deployment environment.
4. If the deployment uses a fixed public URL different from the browser origin, set `VITE_AUTH_REDIRECT_URL` to that callback URL.

The callback is exchanged for a session in the browser and then the temporary `/auth/callback` URL is replaced with the app home route.

## Admin Control Center

`/admin` is the operations console for authorized staff. It is a separate lazy-loaded module
(`src/admin/`) with its own layout, density and stylesheet; it reads and writes the same tables the
app uses, so nothing on screen is invented for decoration.

| Route | What it does | Real source |
| --- | --- | --- |
| `/admin` | counts, moderation backlog, distributions by category/source/region, ratings state, recent operational events, measured read latency | `admin_operations_snapshot()` over `places`, `reviews`, `place_checkins`, `traces`, plus the last 8 rows of `admin_audit_events` |
| `/admin/places` | server-side search / filter / sort / paginate; inspector with coordinates, tri-lingual names, photos, rating provenance, curation edits, moderation decision, likely duplicates | `public.places`, `public.reviews`, `admin_place_duplicate_candidates()` |
| `/admin/submissions` | the queue a traveller submission actually lands in (default `pending`), with the submitted evidence, and a recorded moderator action | `places.moderation_*` |
| `/admin/reviews` | review moderation that cannot corrupt aggregates (the SQL trigger recomputes them from approved, non-seed reviews only) | `public.reviews` + `update_place_rating_aggregate()` |
| `/admin/travelers` | profile metadata, language, activity counts, privilege state; presence of location data is reported as a boolean, values are never read | `public.user_profiles` |
| `/admin/administrators` | grant / revoke `admin` and `super_admin`; refuses removing the last super admin | `public.admin_accounts` |
| `/admin/audit-log` | append-only trail: who, which role, action, target, timestamp, changed fields, optional reason | `public.admin_audit_events` |
| `/admin/ai-operations` | request volume, outcomes, measured latency percentiles, configured provider/model *presence*, per-feature status | `public.ai_usage_events` |
| `/admin/service-health` | HEALTHY / DEGRADED / UNAVAILABLE / UNKNOWN per dependency from observed traffic; live probes only when an operator asks | `public.service_events` |
| `/admin/settings` | which backends are wired, counters, and `editable: []` — presence booleans only, never an environment value | server-side configuration presence |

**Authorization is enforced at the database, not in the router.** Each request carries the app's
session bearer; the server resolves `public.admin_role_of(user_id)` (single-flight, five-second
cache), answers `401 TOKEN_MISSING` for anonymous callers and `403 ADMIN_REQUIRED` for accounts
outside the roster, and `403 SUPER_ADMIN_REQUIRED` for role changes by plain admins. Every write is
a `security definer` RPC that re-checks the roster itself and raises `42501`, so a hand-crafted
`fetch` cannot reach a privilege the session does not have. `SUPABASE_SERVICE_ROLE_KEY` is read only
by `server.ts` / `server/admin.ts`; it is never a `VITE_` variable and never appears in the client
bundle, the admin DTOs or the audit log.

**Wiring it to a real project**

1. Apply `supabase/migrations/20260917115914_admin_control_center.sql` — additive only: moderation
   columns with defaults, `admin_accounts`, `admin_audit_events`, `service_events`, and the admin
   RPCs. The three new tables get `enable row level security` with **zero policies**, plus
   `revoke ... from public, anon, authenticated`, so only `service_role` can touch them.
2. Give the server `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (deployment environment, never a
   `VITE_`-prefixed variable).
3. Insert the first operator by SQL. There is deliberately no self-service signup and no development
   bypass:
   `insert into public.admin_accounts (user_id, role) values ('<auth.users uuid>', 'super_admin');`
   Every later administrator is granted from `/admin/administrators`.

If any step is missing the API answers `503 ADMIN_BACKEND_UNAVAILABLE` and the console says so
plainly instead of rendering a sample dashboard.

**Publication is a moderation state, enforced twice.** A place is published exactly when
`places.moderation_status = 'approved'`. Rows that already existed (and anything imported with
`seed_data = true`) were backfilled to `approved` by the column's own default, so the catalogue did
not change overnight; the default for *future* rows is `pending`, and
`enforce_places_submission_state()` rewrites the state for any writer that skips or forges it, while
`lock_moderation_columns()` refuses moderation-column edits from anyone but the moderation RPCs
(error `42501`). Reviews keep the accepted publish-on-write behaviour, with the same column lock,
so a moderated-away review cannot be resurrected by its author.

The same rule is applied twice on purpose: the row-security policies (`places_public_select`,
`places_authenticated_select`, `reviews_public_select`, `reviews_authenticated_select`) bind any
direct PostgREST client, and `server/publication.ts` binds the API server's own reads, which use a
privileged client that RLS does not reach. The one exemption in both places is ownership: a signed-in
account can read *its own* queued submission, because "your record disappeared" is not an honest
answer to moderation. Discovery lists, AI context, trip destinations and route lookups stay
approved-only for everybody.

**Verification is not review traffic's to undo.** `update_place_rating_aggregate()` recomputes
`rating`, `review_count` and `rating_provenance` from approved non-seed reviews, and may move
`trust_level` between `unverified` and `community` - but it never lowers `external` or `official`,
and it never writes `last_verified_at`. Those two columns belong to curation.

**Role cache.** The administrator cache is keyed by `(scope, user id)` — a role is a property of the
account, not of a session — and `invalidateAdminActorCache` drops the affected account's entry inside
the same request that grants or revokes it, so a privilege change never has to wait out the 5-second
window.

**Keyboard, density, direction.** `/` focuses the search field, `j` / `k` move through table rows,
`Enter` opens the selected record, `a` / `n` / `x` approve / request changes / reject inside a place
inspector, `e` copies the identifier, `?` opens the shortcut layer, `Esc` closes the inspector or the
open dialog. Arabic turns the whole console into real RTL, dense tables included; the map surface
stays geographically LTR and never sits above the sticky header. Destructive decisions (reject,
revoke) require typing the affected name; nothing hard-deletes user data, and there is no bulk
"reset" anywhere.

Tests: `tests/unit/admin-*.test.ts` (authz guards, query parsing, service semantics, telemetry,
duplicate ranking) and `tests/e2e/admin.spec.ts` (Playwright, mocked admin API) cover the gate for
anonymous and normal users, permitted access, list/search/pagination, a legitimate mutation, a refused
mutation, destructive confirmation, audit rows, RTL, keyboard focus, secret leakage and console errors.
