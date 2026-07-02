# Production Release Audit — 2026-07-01

This document is the exact audit for moving the current local-preview work into
live production.

It answers three questions:

1. what app code belongs in the release
2. what live database SQL is required for settlement confirmations
3. what local-only preview/testing behavior must stay disabled in production

---

## 1. Simple Version

To push this work live safely:

1. ship the app code
2. make sure live Supabase has the required settlement-confirmation SQL
3. make sure preview-only flags are off in production
4. test the real signed-in flow on a production-like preview deploy
5. then deploy live

The main thing to avoid is shipping a messy mixed diff that includes:

- app/UI work
- settlement backend work
- unrelated migration/tooling work
- local preview helpers

Those need to be separated conceptually even if they currently live in one
workspace.

---

## 2. What Belongs In The Production Release

These are the core app files that belong in the release:

- [index.html](/Users/opera_user/Documents/Codex%20Space/Lift%20Log/index.html)
- [api/lift-log.js](/Users/opera_user/Documents/Codex%20Space/Lift%20Log/api/lift-log.js)
- [.env.example](/Users/opera_user/Documents/Codex%20Space/Lift%20Log/.env.example)

These are the files that matter to the live product behavior:

- UI and interaction changes
- Today / History / Results / Week's MVP / block switcher behavior
- settlement-confirmation API behavior
- production env surface

### Current release-relevant changes in those files

#### `index.html`

Contains:

- Today screen redesign/polish
- leaderboard styling and interaction changes
- Results copy/state changes
- Week's MVP modal changes
- block switcher preview state changes
- settlement reminder UI
- local-dev preview gates

#### `api/lift-log.js`

Contains:

- current Supabase-backed app state path
- settlement confirmation read/write behavior
- local preview auth flag exposure
- local dev impersonation support

#### `.env.example`

Documents the production env flags:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ADMIN_PIN`
- `ENABLE_SETTLEMENT_CONFIRMATIONS`
- `ENABLE_SETTLEMENT_CONFIRMATIONS_PREVIEW`
- `ENABLE_LOCAL_PREVIEW_AUTH`

---

## 3. What Does Not Need To Be In The Production Release Diff

These should not be treated as required release files for the app deploy:

- `scripts/canonical-to-sql.mjs`
- `scripts/state-to-canonical.mjs`
- `scripts/jsonbin-to-supabase-state.mjs`
- `scripts/jsonbin-to-supabase.mjs`
- `scripts/local-dev-server.mjs`
- `scripts/mobile-qa.mjs`
- handover docs and migration notes
- unrelated SQL drafts not needed for live settlement confirmations

These files can still remain in the repo, but they are not part of the
essential production app runtime path.

Important distinction:

- repo inclusion is fine
- accidental deployment dependency is not

---

## 4. Local-Only Preview / Testing Behavior Audit

Your current phone preview has local-only overrides. That is why it cannot be
treated as identical to production.

### Local-only behavior found in the code

#### Local preview auth

Backend flag:

- `ENABLE_LOCAL_PREVIEW_AUTH`

Code paths:

- [api/lift-log.js](/Users/opera_user/Documents/Codex%20Space/Lift%20Log/api/lift-log.js:27)
- [api/lift-log.js](/Users/opera_user/Documents/Codex%20Space/Lift%20Log/api/lift-log.js:2422)
- [index.html](/Users/opera_user/Documents/Codex%20Space/Lift%20Log/index.html:7459)

Effect:

- local member picker instead of normal email auth

Production rule:

- must be `false`

#### Settlement preview mode

Backend flag:

- `ENABLE_SETTLEMENT_CONFIRMATIONS_PREVIEW`

Code paths:

- [api/lift-log.js](/Users/opera_user/Documents/Codex%20Space/Lift%20Log/api/lift-log.js:26)
- [api/lift-log.js](/Users/opera_user/Documents/Codex%20Space/Lift%20Log/api/lift-log.js:2194)
- [index.html](/Users/opera_user/Documents/Codex%20Space/Lift%20Log/index.html:4805)
- [index.html](/Users/opera_user/Documents/Codex%20Space/Lift%20Log/index.html:4978)

Effect:

- mock settlement reminders can render without the real canonical DB path

Production rule:

- must be `false`

#### Local dev impersonation

Code paths:

- [api/lift-log.js](/Users/opera_user/Documents/Codex%20Space/Lift%20Log/api/lift-log.js:2495)
- [index.html](/Users/opera_user/Documents/Codex%20Space/Lift%20Log/index.html:6541)
- [index.html](/Users/opera_user/Documents/Codex%20Space/Lift%20Log/index.html:7553)

Effect:

- lets local testers act as other bloc members

Production rule:

- safe because it is gated to local-dev request detection
- still needs one final sanity check on preview/live environment before ship

#### Local fake leaderboard comparison rows

Code path:

- [index.html](/Users/opera_user/Documents/Codex%20Space/Lift%20Log/index.html:2457)

Effect:

- `Go To Da Gym` local preview can show hardcoded leaderboard comparisons

Production rule:

- safe only because it is gated by `isLocalDevEnvironment()`
- should still be consciously rechecked before live deploy

#### Local weekly MVP preview data

Code path:

- [index.html](/Users/opera_user/Documents/Codex%20Space/Lift%20Log/index.html:2494)

Effect:

- local preview can fabricate weekly MVP states for visual QA

Production rule:

- safe only because it is gated by `isLocalDevEnvironment()`

### Overall conclusion on local-only behavior

The local preview environment is intentionally not production-like.

That is acceptable for UI iteration, but it means the final release must be
validated on a production-like preview deploy with:

- real auth
- no preview flags
- no local request gating

---

## 5. Settlement Confirmations: Exact Live DB Requirements

If settlement confirmations are going live, production Supabase must have the
following SQL baseline available.

### Required apply order

1. [supabase/canonical-schema.sql](/Users/opera_user/Documents/Codex%20Space/Lift%20Log/supabase/canonical-schema.sql)
2. [supabase/ante-core-profiles-write-rpc.sql](/Users/opera_user/Documents/Codex%20Space/Lift%20Log/supabase/ante-core-profiles-write-rpc.sql)
3. [supabase/ante-core-blocs-write-rpc.sql](/Users/opera_user/Documents/Codex%20Space/Lift%20Log/supabase/ante-core-blocs-write-rpc.sql)
4. [supabase/ante-core-bloc-members-write-rpc.sql](/Users/opera_user/Documents/Codex%20Space/Lift%20Log/supabase/ante-core-bloc-members-write-rpc.sql)
5. [supabase/ante-core-seasons-write-rpc.sql](/Users/opera_user/Documents/Codex%20Space/Lift%20Log/supabase/ante-core-seasons-write-rpc.sql)
6. [supabase/ante-core-settlement-confirmations-schema.sql](/Users/opera_user/Documents/Codex%20Space/Lift%20Log/supabase/ante-core-settlement-confirmations-schema.sql)
7. [supabase/ante-core-settlement-confirmations-read-rpc.sql](/Users/opera_user/Documents/Codex%20Space/Lift%20Log/supabase/ante-core-settlement-confirmations-read-rpc.sql)
8. [supabase/ante-core-settlement-confirmations-write-rpcs.sql](/Users/opera_user/Documents/Codex%20Space/Lift%20Log/supabase/ante-core-settlement-confirmations-write-rpcs.sql)
9. [supabase/ante-core-settlement-confirmations-rls.sql](/Users/opera_user/Documents/Codex%20Space/Lift%20Log/supabase/ante-core-settlement-confirmations-rls.sql)

### Why these are required

The settlement confirmation write path in the API does not work on its own.
Before the claim/confirm/dispute actions can succeed, the server may need to
bootstrap canonical rows for:

- profiles
- blocs
- bloc members
- seasons

Those bootstrap calls rely on the helper write RPCs above.

Without that baseline, the live app will produce errors like:

- `bloc not found`
- `season not found`
- `payer profile not found`
- `receiver profile not found`

Reference:

- [api/lift-log.js](/Users/opera_user/Documents/Codex%20Space/Lift%20Log/api/lift-log.js)
- [docs/settlement-audit-2026-06-29-preview-branch.md](/Users/opera_user/Documents/Codex%20Space/Lift%20Log/docs/settlement-audit-2026-06-29-preview-branch.md)

### Optional but recommended

Also verify the broader read helpers already expected by the app are present in
production, including:

- bloc reads
- profile reads
- bloc member reads
- current logs reads
- current excused/sitout reads
- month history reads

Those are already part of the additive canonical overlay path used by the app.

---

## 6. Production Environment Requirements

Production env should be:

- `SUPABASE_URL=<live project>`
- `SUPABASE_ANON_KEY=<live anon key>`
- `SUPABASE_SERVICE_ROLE_KEY=<live service role key>`
- `ADMIN_PIN=<live pin>`
- `ENABLE_SETTLEMENT_CONFIRMATIONS=true`
- `ENABLE_SETTLEMENT_CONFIRMATIONS_PREVIEW=false`
- `ENABLE_LOCAL_PREVIEW_AUTH=false`

If settlement confirmations are not fully DB-ready yet, do not deploy with
`ENABLE_SETTLEMENT_CONFIRMATIONS=true`.

But current product direction says they do need to go live, so the DB work
should be treated as mandatory before release.

---

## 7. Clean Production-Like Verification Target

Before production deploy, the app should be tested in a preview deployment that
matches live behavior:

- real auth
- no local identity picker
- no settlement preview mode
- no local host gating

### Required flows to test

- sign in
- Today loads
- Activity loads
- Results loads
- History loads
- profile opens from Today
- profile opens from History
- deep-scroll tab switching does not blank the screen
- Week's MVP popover renders correctly
- block switcher renders correctly
- settlement claim works
- settlement confirm works
- settlement dispute works
- reminder cards update correctly
- refresh/reopen keeps settlement UI correct

### Device coverage

Must test at minimum:

- desktop browser
- iPhone Safari
- installed iPhone PWA if that is part of real usage

---

## 8. Workspace Cleanup Strategy

This is the practical cleanup plan before pushing:

### A. Define the release nucleus

Treat these as the release nucleus:

- `index.html`
- `api/lift-log.js`
- `.env.example`

### B. Separate docs from runtime

Docs can be committed if useful, but they should not be confused with runtime
requirements.

### C. Keep migration/tooling changes out of release reasoning

Do not let these broaden the production scope:

- canonical conversion scripts
- historical handover docs
- unrelated migration SQL drafts

### D. Verify no production behavior depends on local-only flags

Re-check:

- no preview env flags enabled
- no localhost-only code path is required for core features

---

## 9. Exact Next Steps

1. prepare a clean release candidate around:
   - `index.html`
   - `api/lift-log.js`
   - `.env.example`
2. verify live DB SQL baseline for settlement confirmations
3. apply any missing SQL to production Supabase
4. create a production-like preview deployment
5. run real signed-in QA there
6. deploy to production
7. run immediate live smoke test

---

## 10. Bottom Line

The path to production is valid, but only if we treat it as:

- app release
- plus required settlement-confirmation SQL baseline
- minus local preview behavior
- minus unrelated migration work

That is the cleanest way to make everything operational, functional, and
visually correct in live production.
