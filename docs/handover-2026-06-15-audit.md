# Handover — Audit Snapshot 2026-06-15

This document captures the app, workspace, and canonical migration state as of
June 15, 2026. It is intended as the primary handover note for future chats at
this point in the project timeline.

Update note as of June 23, 2026:
- several read-side slices have landed since this snapshot
- treat the "Completed Read-Side Slices", "Current Read-Side Status", and
  "Best next read-side candidate" sections below as amended by the June 23
  notes in this file

Read alongside:
- `/Users/opera_user/Documents/Codex Space/Lift Log/docs/relational-cutover-plan.md`
- `/Users/opera_user/Documents/Codex Space/Lift Log/docs/canonical-importer-design.md`
- `/Users/opera_user/Documents/Codex Space/Lift Log/docs/canonical-parity-audit-current-phase.md`
- `/Users/opera_user/Documents/Codex Space/Lift Log/docs/handover-2026-06-11-session.md`

Troubleshooting reference:
- `/Users/opera_user/Documents/Codex Space/Lift Log/docs/solved-issues-log.md`
  - canonical place to check and append solved incident notes, device-specific recoveries, and prior troubleshooting outcomes

---

## Branch And Head

- Branch: `codex/membership-safety-fixes`
- Production-verified head at time of audit: `dbfb9d4`
- Commit message:
  - `fix(pacing): correct new bloc creator pace check`

This commit includes the latest pacing/proration fixes that were promoted to
production.

---

## Executive Summary

The migration is now past the riskiest write-path stage.

What is true right now:
- Canonical write coverage is mostly in place for the current product model.
- The two sit-out related write slices were live-verified on June 17, 2026.
- The first read-side cutover is live:
  - profiles overlay
  - bloc settings overlay
- Rich settlement tables are intentionally deferred because the current blob app
  does not have a real "calculate settlement" write event.
- Historical backfill/importer work is still required before broad read cutover
  and blob retirement.

---

## Live App Status

### Production deployment

- Latest production deployment was confirmed on commit `dbfb9d4`
- Deployment state: `READY`
- The production deployment includes:
  - double-proration fix for same-month joiners
  - creator/admin pace-check fix for newly created mid-month blocs
  - friendlier first-day pace-check copy

### What was verified

- Vercel build logs were clean.
- No deployment failure was observed.
- Supabase runtime signals looked healthy:
  - recent reads against blob state
  - recent reads against `read_ante_core_profiles`
  - recent reads against `read_ante_core_blocs`
- No obvious backend error pattern was found in recent Supabase logs.

### Important caveat

A full authenticated browser audit of production was not possible from this
environment because the live deployment is protected behind Vercel auth.

So the production conclusion is:
- deployment health: good
- backend signal health: good
- full UI/browser verification: partially constrained by deployment protection

---

## Local Workspace Status

### Git state

- Current branch: `codex/membership-safety-fixes`
- HEAD: `dbfb9d4ed6f1740029b4586896ef14afc845f7f1`
- No tracked-file dirt was present during the audit.

### Untracked files present

These appear intentional and should be reviewed, not blindly deleted:

- `/Users/opera_user/Documents/Codex Space/Lift Log/docs/handover-2026-06-07-canonical-migration.md`
- `/Users/opera_user/Documents/Codex Space/Lift Log/docs/handover-2026-06-09-session.md`
- `/Users/opera_user/Documents/Codex Space/Lift Log/docs/handover-2026-06-11-session.md`
- `/Users/opera_user/Documents/Codex Space/Lift Log/docs/local-dev.md`
- `/Users/opera_user/Documents/Codex Space/Lift Log/scripts/jsonbin-to-supabase-state.mjs`
- `/Users/opera_user/Documents/Codex Space/Lift Log/scripts/jsonbin-to-supabase.mjs`
- `/Users/opera_user/Documents/Codex Space/Lift Log/scripts/local-dev-server.mjs`
- `/Users/opera_user/Documents/Codex Space/Lift Log/scripts/mobile-qa.mjs`
- `/Users/opera_user/Documents/Codex Space/Lift Log/supabase/schema.sql`
- `/Users/opera_user/Documents/Codex Space/Lift Log/supabase/state-schema.sql`

### Cleanup conclusion

The workspace does not need emergency cleanup. The real question is whether the
untracked migration docs/tooling should be:
- committed
- archived elsewhere
- or deliberately ignored

They look useful, not disposable.

---

## Migration Audit

## Completed Write-Side Slices

These are implemented on the branch and, where applicable, already deployed:

1. Auth/profile safety fix
   - commit: `35df011`

2. Projection retirement / projection RPC path removal
   - commit: `23ebafb`

3. `bloc_members` dual-write
   - commit: `d7f4026`

4. `season_member_status` rollover snapshot
   - commit: `5e564b3`

5. `workout_logs` dual-write
   - commit: `c906568`

6. `workout_reactions` dual-write
   - commit: `7e34781`

7. Normal single-save follow-up for `workout_logs`
   - commit: `233fc61`

8. `season_member_status` settlement sync
   - commit: `03007ec`

9. `season_member_status` excused / sit-out sync
   - commit: `314186f`

10. `season_overrides` canonical write path
   - commit: `ff66a6f`

11. `sit_out_requests` canonical write path
   - commit: `92998e0`

12. `update-settings` -> sync open season settings snapshot
   - commit: `df1071b`

## Completed Read-Side Slices

1. Canonical profiles overlay
   - live before this audit

2. Canonical bloc settings overlay
   - commit: `a2d3bee`

3. Canonical `season_overrides` overlay
   - landed after this audit

4. Canonical current-month logs overlay
   - landed after this audit

5. Canonical current-month excused overlay
   - landed after this audit

6. Canonical current-month sit-out overlay
   - landed after this audit

7. Canonical closed-season `monthHistory` overlay
   - commit: `3d130e7`
   - production-verified on June 23, 2026 after parity checks against
     `season_member_status` and `workout_logs`

## Product / behavior fixes landed during migration

These are not migration slices, but they materially affect current app behavior:

1. Avoid double-prorating same-month joiners
   - commit: `7f80292`

2. Correct new-bloc creator pace check
   - commit: `dbfb9d4`

---

## Verified vs Deferred QA

## Verified / functionally confirmed

- `season_overrides` canonical write path
- `update-settings` season snapshot sync
- bloc settings read overlay
- proration fix for same-month joiners
- creator/admin pace-check fix

## Verified Migration QA

The following previously-deferred migration slices were live-verified on June
17, 2026 using a disposable test bloc and should no longer be treated as
pending:

1. `season_member_status` excused / sit-out sync
   - commit: `314186f`
   - verified in canonical after decline and approval flows

2. `sit_out_requests` canonical write path
   - commit: `92998e0`
   - verified in canonical after decline and approval flows

Reference:
- `/Users/opera_user/Documents/Codex Space/Lift Log/docs/qa-update-2026-06-17-sitout-slices.md`

---

## Settlement Canonicalization Status

The following tables are **not** normal dual-write migration slices from the
current blob app:

- `ante_core.settlement_runs`
- `ante_core.settlement_entries`
- `ante_core.settlement_transfers`

Reason:
- the current app only stores loser paid/unpaid status
- it does not store a discrete settlement calculation event
- it does not store full payout/transfer obligations

Conclusion:
- keep the existing `season_member_status.settlement_status` sync
- treat richer settlement tables as future canonical-first feature work or
  importer/backfill territory

Do not force these into the current dual-write program.

---

## Backfill / Importer Status

Historical backfill is still needed before broad read cutover and blob
retirement.

Expected importer/backfill coverage:
- profiles
- blocs
- bloc_members
- seasons
- season_member_status
- workout_logs
- workout_reactions
- season_overrides
- sit_out_requests

Known historical gaps that still matter:
- workout logs from before dual-write
- workout reactions from before dual-write
- historical season/month parity before canonical writes existed

Important limitation:
- rich settlement payout tables should not be invented from incomplete blob data

Reference:
- `/Users/opera_user/Documents/Codex Space/Lift Log/docs/canonical-importer-design.md`
- `/Users/opera_user/Documents/Codex Space/Lift Log/scripts/state-to-canonical.mjs`

---

## Current Read-Side Status

### Live canonical reads

- profiles overlay
- bloc settings overlay
- `season_overrides` overlay
- current-month logs overlay
- current-month excused overlay
- current-month sit-out overlay
- closed-season `monthHistory` overlay

### Important safety property

`fetchWritableCurrentState` should remain blob-only until cutover is much
further along. That separation is intentional and should be preserved.

### Evaluated and rejected as redundant

- open-season settings overlay from `ante_core.seasons`

Reason:
- it duplicates current settings fields already overlaid from `ante_core.blocs`

### Best next read-side candidate

- importer/backfill readiness and historical parity audit

Why:
- the narrow high-value overlays are already in place
- broader read cutover is now blocked more by historical completeness than by
  another small overlay
- `fetchWritableCurrentState` is still intentionally blob-only, so the next
  useful work is proving canonical history is complete enough for a wider read
  cutover plan

---

## What Is Left To Do

At a high level, the remaining program is:

1. Additional safe read overlays and ordering cutover work
2. Importer/backfill execution and parity validation
3. Wider read cutover only after historical parity improves
4. Blob retirement

### Recommended immediate next step

Audit importer readiness and historical parity:
- verify canonical coverage for historical seasons, member status, logs, and
  reactions
- identify the remaining blob-only read risks after the closed-season
  `monthHistory` overlay
- define the next bounded broad-read cutover candidate only after those gaps are
  explicit

Primary audit reference:
- `/Users/opera_user/Documents/Codex Space/Lift Log/docs/canonical-parity-audit-current-phase.md`

### Recommended medium-term sequence

1. Audit and cleanly classify the untracked migration docs/scripts/sql files
2. Validate importer readiness and historical parity scope
3. Plan the first broader historical read cutover only after importer coverage is clear
4. Keep `fetchWritableCurrentState` blob-only until a deliberate broader cutover
   decision is made

---

## Risks And Watch Items

1. Historical parity is still incomplete
   - especially pre-dual-write logs and reactions

2. Read overlays increase the need to monitor blob/canonical divergence
   - keep overlays narrow and reversible

3. Untracked migration tooling/docs could drift if left unmanaged
   - commit/archive/ignore deliberately rather than letting them accumulate

---

## Short State Snapshot For Future Chats

If a future session needs the fastest possible context:

- Production is on `dbfb9d4`
- Write-side migration is mostly done for the current blob product model
- Read-side migration now includes:
  - profiles
  - bloc settings
  - `season_overrides`
  - current-month logs
  - current-month excused
  - current-month sit-outs
  - closed-season `monthHistory`
- branch-local follow-up slices now also include:
  - canonical `sort_order` writes for blocs and bloc_members
  - guarded canonical `memberOrder` reconstruction with blob fallback
- Sit-out related canonical writes were verified on June 17, 2026
- Rich settlement tables are deferred as non-dual-write work
- Historical importer/backfill is still required
- Closed-season `monthHistory` overlay shipped in commit `3d130e7`
- Best next migration step is importer/parity audit for broader read cutover readiness
