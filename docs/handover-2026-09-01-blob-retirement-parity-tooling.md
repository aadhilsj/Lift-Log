# Handover — 2026-09-01 blob retirement parity tooling

Branch: `blob_retirement` (rebased onto `main` at `d26db58`, pushed).
Author: Deveen + Claude Code. Read-only against production throughout — no
production writes, no schema changes, no Supabase SQL executed.

## Plain-English summary

We built an automated safety check that compares the old blob with the new
canonical tables and fails loudly if they disagree. We ran it against
production several times: **everything matches — no drift anywhere.** We also
confirmed the mirror-skip flag is already ON in production for reactions,
flags, and delete-log, and it is running clean.

## What is on the branch

| File | What it does |
|---|---|
| `scripts/blob-parity-gate.mjs` | 7 blob-vs-canonical checks, exits non-zero on drift. `npm run parity:gate` |
| `scripts/blob-parity-gate.test.mjs` | Proves the gate catches injected drift (13/13). `npm run parity:gate:test` |
| `scripts/blob-remirror.mjs` | Rollback safety net: copies a wave's fields from canonical back into a stale blob. Dry-run by default; `--apply` is CAS-guarded. Never touches blob-only groups, monthHistory, or lifecycle fields. |
| `scripts/blob-remirror.test.mjs` | Proves each scope touches only its own surface (13/13). |

Nothing else was modified except the two `parity:*` lines in `package.json`.

## Production findings (all verified 2026-08-31/09-01)

1. **Zero drift.** Gate clean at blob revisions 2057, 2086, 2121: workout
   counts, reactions, settlements, season overrides, sort orders. The June
   audit's `monthHistory`/`seasonOverrides` drift no longer exists.
2. **`BLOB_MIRROR_SKIP_ACTIONS` is already enabled in production** for
   `reaction, flag, flag-response, flag-review, delete-log`. Blob current-month
   reactions are therefore empty (264 canonical reactions not mirrored) —
   expected under skip, invisible to users because reads overlay canonical.
   The September rollover will bake empty reactions into the blob's August
   `monthHistory`; the gate will report it as a canonical-ahead warning, not a
   failure. No user data is at risk — canonical has everything.
3. **`canonicalRevisionAvailable: true`** in production (revision clock alive,
   `blocker: null`) per the readiness report. The precondition for expanding
   mirror-skip is met.
4. Blob-only leftovers that vanish at retirement unless deliberately kept:
   groups `op0-yneefj` and `rrrr-nq9r7f` (both Aadhil-only, zero logs).
   Dead blocs with no active members: `test-bwazc0`, `test-bloc-ka2ovu`,
   `test-ux55f8`, `gym-gal-3ipo38`.
5. Two corrections to `docs/canonical-parity-audit-current-phase.md` worth
   folding back: audit area 1's SQL must exclude rejected logs (matches
   `isCountedLog()`), and area 4's pass condition should scope to active blocs.

## Suggested next steps (decisions, not actions taken)

1. Run the gate again after all groups roll over, expect a canonical-ahead
   reaction warning for 2026-08, and treat it as documented-expected.
2. Expand `BLOB_MIRROR_SKIP_ACTIONS` with `add-log,multi-log` (rest of wave B),
   soak 48-72h, gate again; then `update-settings,season-proration-choice`.
3. Hold `join-group / kick-member / leave-bloc / create-group` until
   `leftMemberNames` / `joinedMonthByName` have a canonical home
   (`bloc_members.left_at` redesign).
4. Before anything destructive: test an actual backup restore.

## How to verify any of this

`npm run parity:gate` (needs `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` in
`.env.local`). Reports land in `migration-output/parity-gate/`. The self-tests
run offline with no credentials.
