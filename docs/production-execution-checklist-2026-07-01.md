# Production Execution Checklist — 2026-07-01

This is the practical release checklist for moving the current preview work to
production.

Use this after the final streak pass is done.

---

## Simple Version

There are only three real buckets here:

1. ship the app changes
2. optionally turn on settlement confirmations if live Supabase is ready
3. keep all local preview helpers out of production behavior

---

## What We Are Shipping

Ship:

- `index.html`
- `api/lift-log.js`
- `.env.example`

These contain the actual product changes:

- Today / History / Results UI polish
- leaderboard behavior and styling
- Week's MVP popover changes
- block switcher copy changes
- mobile bug fixes
- settlement-confirmation app/API support

---

## What Is Not The Production Runtime

Do not treat these as production blockers for the app deploy:

- `scripts/local-dev-server.mjs`
- `scripts/mobile-qa.mjs`
- `scripts/canonical-to-sql.mjs`
- `scripts/state-to-canonical.mjs`
- migration handover docs
- old investigation notes

They can stay in the repo, but they are not the live runtime path.

---

## Production Decision Gate

Before release, decide which of these two releases we are doing:

### Option A — App release only

Includes:

- UI changes
- copy changes
- bug fixes

Does not include:

- live settlement confirmations

Use this if production Supabase is not yet prepared for settlement
confirmations.

### Option B — App release plus live settlement confirmations

Includes:

- everything in Option A
- payer mark-paid flow
- receiver confirm flow
- dispute flow
- live settlement reminder cards

Use this only if the live Supabase SQL baseline is applied first.

---

## Workspace Cleanup Rule

Do not try to "clean the repo" by deleting everything.

The real cleanup is:

1. identify the release nucleus
2. verify local-only behavior is gated
3. verify production env values
4. verify live SQL baseline if settlement confirmations are included

This is a release-scope cleanup, not a repo-rewrite cleanup.

---

## Local-Only Behavior That Must Stay Off In Production

These production env values must be:

```bash
ENABLE_LOCAL_PREVIEW_AUTH=false
ENABLE_SETTLEMENT_CONFIRMATIONS_PREVIEW=false
```

These code paths are allowed to remain because they are local-gated:

- local identity picker
- local member impersonation
- fake comparison leaderboard rows
- fake weekly MVP preview states

But they must be verified on a production-like preview deployment where those
paths are naturally inactive.

---

## Settlement Confirmations: Live Requirements

If settlement confirmations are part of the production release, live Supabase
must have these SQL pieces applied in this order:

1. `supabase/canonical-schema.sql`
2. `supabase/ante-core-profiles-write-rpc.sql`
3. `supabase/ante-core-blocs-write-rpc.sql`
4. `supabase/ante-core-bloc-members-write-rpc.sql`
5. `supabase/ante-core-seasons-write-rpc.sql`
6. `supabase/ante-core-settlement-confirmations-schema.sql`
7. `supabase/ante-core-settlement-confirmations-read-rpc.sql`
8. `supabase/ante-core-settlement-confirmations-write-rpcs.sql`
9. `supabase/ante-core-settlement-confirmations-rls.sql`

Without that baseline, claim / confirm / dispute can fail because the API now
expects the canonical helper layer to exist.

---

## Production Env Checklist

Required:

```bash
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
ADMIN_PIN=...
```

If shipping settlement confirmations live:

```bash
ENABLE_SETTLEMENT_CONFIRMATIONS=true
ENABLE_SETTLEMENT_CONFIRMATIONS_PREVIEW=false
ENABLE_LOCAL_PREVIEW_AUTH=false
```

If not shipping settlement confirmations yet:

```bash
ENABLE_SETTLEMENT_CONFIRMATIONS=false
ENABLE_SETTLEMENT_CONFIRMATIONS_PREVIEW=false
ENABLE_LOCAL_PREVIEW_AUTH=false
```

---

## Release QA Gate

The final verification must not happen on the local phone preview.

It must happen on a production-like preview deploy with:

- real auth
- no local identity picker
- no local impersonation
- no preview settlement mode

Minimum flows to test:

1. Today
2. Activity
3. Results
4. History
5. profile open from Today
6. profile open from History
7. tab switching from deep scroll positions
8. Week's MVP popover
9. settlement confirmations, if enabled

---

## Exact Rollout Order

1. Finish the final streak change.
2. Freeze release scope.
3. Review `index.html`, `api/lift-log.js`, and `.env.example` one last time.
4. Decide Option A or Option B.
5. If Option B, apply the required Supabase SQL first.
6. Set production env values correctly.
7. Create a production-like preview deploy.
8. Run signed-in mobile QA on that preview deploy.
9. If clean, deploy to production.

---

## Recommended Path

The safest path is:

1. finish streak
2. ship the app/UI changes
3. include settlement confirmations only if the live DB baseline is confirmed

That keeps the release narrow and avoids accidentally turning this into a full
architecture migration.

---

## Current Release-Prep Status

Completed on 2026-07-01:

- verified the release nucleus is still:
  - `index.html`
  - `api/lift-log.js`
  - `.env.example`
- verified local-only leaderboard comparison rows are gated behind
  `isLocalDevEnvironment()` and `LEGACY_GROUP_ID`
- verified local weekly MVP preview data is gated behind
  `isLocalDevEnvironment()` and `LEGACY_GROUP_ID`
- verified a production-like local server can run with:
  - `ENABLE_LOCAL_PREVIEW_AUTH=false`
  - `ENABLE_SETTLEMENT_CONFIRMATIONS_PREVIEW=false`
  - `ENABLE_SETTLEMENT_CONFIRMATIONS=true`
- verified the API reports:
  - `enableLocalPreviewAuth: false`
  - `settlementConfirmationsPreviewMode: false`
- fixed `scripts/mobile-qa.mjs` so it no longer falsely reports an in-app
  "today" pass when it is actually still on the public landing

Still required before live production:

1. a real signed-in preview-deploy test
2. confirmation that the live Supabase settlement SQL baseline is applied, if
   settlement confirmations are shipping now
3. final release commit / deploy workflow
