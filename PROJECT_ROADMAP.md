# My Sindbad — Production Upgrade Roadmap

## Project management rule

This file is the persistent source of truth for the upgrade. The deployed production version must remain recoverable. Work is performed incrementally on controlled branches, and each completed phase must update this file with: completed work, validation evidence, open risks, and the next phases.

## Protected production baseline

- Production URL: `https://mymymymy-dusky.vercel.app`
- Verified production revision on 2026-09-14: `ac970ae0f0a0aabefd25427c06165561e90826ca`
- Recovery branch: `production/baseline-20260914`
- Upgrade management branch: `manager/production-upgrade-20260914`
- Do not treat `main` as identical to production unless the production health endpoint reports the same revision.

## Current audit findings

### Deployment / repository
- `main` is ahead of the verified production revision.
- GitHub `main` is not currently protected by required status checks.
- The Production Smoke workflow failed on newer `main` revisions because Vercel never reported the expected SHA.
- Vercel production currently reports revision `ac970ae0f0a0aabefd25427c06165561e90826ca`.
- Repository contains many temporary `audit/*`, `fix/*`, and `chore/*` branches. Do not delete them until merged/unmerged state is verified.
- Temporary/no-op artifacts have existed in the repository and require a controlled cleanup pass.

### Runtime
- Recent Vercel runtime logs include repeated Supabase auth verification failures, generic API handler failures, and temporary Gemini 503 errors.
- The application currently uses Node.js functions on Vercel and a Vite frontend.

### Supabase
- Production project: `qkoscgdegnqcypkjrefn`
- Project status: ACTIVE_HEALTHY.
- Public tables currently include: `ai_usage_events`, `api_rate_limits`, `place_checkins`, `places`, `review_seed_archive`, `reviews`, `traces`, `trip_expenses`, `trips`, and `user_profiles`.
- RLS is enabled on the inspected public tables.
- Leaked password protection is currently disabled and should be reviewed/enabled as part of security hardening.

## Execution phases

### Phase 0 — Production baseline, repository cleanup, and deployment integrity
Status: IN PROGRESS

Goals:
1. Keep the currently deployed version recoverable.
2. Reconcile production revision, `main`, Vercel deployment behavior, and CI status.
3. Classify temporary branches/files before deletion.
4. Remove obsolete/no-op artifacts only after proving they are not runtime dependencies.
5. Establish a clean working branch and release process.
6. Add/repair required CI checks before allowing production promotion.
7. Audit runtime errors before feature work.

Exit criteria:
- Production baseline is preserved.
- Clean repository inventory exists.
- Build/lint/test pipeline is reproducible.
- Deployment SHA can be verified from `/api/health`.
- No production-impacting cleanup is performed without validation.

### Phase 1 — Project Configuration, DevOps, and Testing
Status: PENDING

- Correct package metadata.
- Resolve ENOMEM/build constraints.
- Add Playwright E2E coverage for login, trip creation, saving, expenses, search, GPS, and navigation.
- Enforce lint/test/build checks through GitHub Actions.
- Define controlled production deployment from verified code.

### Phase 2 — Data Architecture and Trust Indicators
Status: PENDING

- Expand data architecture for all 12 regions of Morocco.
- Add source, verification date, and trust-level fields.
- Replace fake/zero ratings with real external provider data where legally and technically available.
- Remove unsupported marketing accuracy claims or calculate them from real data.

### Phase 3 — APIs and Core Services
Status: PENDING

- Real flight integration or truthful route-planning fallback.
- Dynamic Open-Meteo weather by coordinates/city.
- Keep public transit hidden until a real GTFS/provider integration exists.
- Clearly disclose OSRM/public-data navigation limitations and no-live-traffic status.

### Phase 4 — UI/UX, Privacy, and i18n
Status: PENDING

- Morocco-first information architecture.
- GPS consent in Arabic/French and privacy/data-retention controls.
- Delete-my-data workflow.
- Complete Arabic/French/English i18n and prepare Darija architecture.

### Phase 5 — Gemini AI Refinement
Status: PENDING

- Ground itinerary generation in database/external provider evidence.
- Label recommendations as Confirmed / External Source / General Suggestion.
- Make trip building work even when local place data is empty using controlled external fallback.
- Add resilience for Gemini provider errors/rate limits.

## Change policy

- No direct experimental edits to the production baseline.
- No destructive database migration without a migration file and rollback/recovery consideration.
- No branch/file deletion until its merge state and runtime relevance are verified.
- UI changes must not silently remove working behavior.
- Every phase ends with validation plus an update to this roadmap listing the remaining phases.
