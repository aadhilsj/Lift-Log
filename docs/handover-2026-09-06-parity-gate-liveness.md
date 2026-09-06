# Handover — 2026-09-06 parity gate: rollover liveness + isolation awareness

Branch: `blob/gate-rollover-liveness` (from `main` at `eec1be8`).
Read-only against production; changes are CLI scripts only — not part of the
deployed app. Nothing else was modified.

## Plain-English summary

During the Sept 1 rollover failure, our parity check stayed green — the blob
and the canonical tables lagged *together*, so there was no disagreement to
detect. This update teaches the check to also notice when a Bloc is stuck on
an old month, and to correctly ignore Blocs that were skipped on purpose by
the new per-Bloc rollover isolation. A fresh all-clean baseline was taken today.

## Changes

- `scripts/blob-parity-gate.mjs` — new `rollover-liveness` check (runs first):
  1. a blob group with no `ante_core.blocs` row **fails** — this is the exact
     shape that caused the Sept 1 incident, and it would have been caught;
  2. an active Bloc with no open season row **fails**;
  3. an open season behind the Bloc's current month (computed in the Bloc's
     own time zone; month keys are zero-indexed) **passes with a note** if a
     `rollover_skipped` event exists in `ante_core.system_events` within 7
     days (per-Bloc isolation, PR #8 — as requested by
     `docs/rollover-incident-2026-09-01.md` §"For the blob retirement" item 1),
     **warns** inside a 24h grace window (rollover fires lazily on first app
     open), and **fails** past it.
- `scripts/blob-parity-gate.test.mjs` — 5 new scenarios (18/18), including a
  reproduction of the incident shape and proof that a recorded skip is not
  reported as drift.

## Fresh baseline (2026-09-06, blob revision 2239)

All 8 checks pass, zero warnings: 17 blob groups = 17 canonical blocs (no
orphans), 33 closed seasons, 54 active members, all seasons on the current
month, no skip events in the last 7 days.
Pre-incident baselines (revisions 2057/2086/2121) are superseded — production
data changed on 09-01 (orphan deletion, Gregorio correction).

## Two notes for I3 / the incident record

1. **`BLOB_MIRROR_SKIP_ACTIONS` can be read back.** I3 states the Vercel
   Secret is write-only. The live value is however reported by the running
   process via the admin `blob-mirror-dependency-report` action
   (`mirrorSkipRuntime.enabledActions`). Our 2026-09-01 01:10 UTC measurement
   against the production alias returned
   `["reaction","flag","flag-response","flag-review","delete-log"]`,
   `enabled: true`. If production was believed to have the flag unset, that
   belief needs revisiting; re-run the report to confirm current state.
2. The preview-writes-production finding (I3, confirmed 09-03) does not affect
   these scripts — they only run when invoked from a terminal — but it is why
   we recommend holding wave B (`add-log,multi-log`) until I3 is closed and
   this gate is merged, so an expansion is supervised by a check that can
   tell a skipped Bloc from a stuck one.

## How to verify

- `npm run parity:gate:test` — offline, 18/18, no credentials.
- `npm run parity:gate` — read-only against production; report lands in
  `migration-output/parity-gate/`.
