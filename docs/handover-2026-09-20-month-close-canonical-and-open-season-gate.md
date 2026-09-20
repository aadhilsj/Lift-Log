# Handover — 2026-09-20 Month close reads canonical; the gate now sees open seasons

From Deveen. Answers every open item addressed to him in
`docs/handover-2026-09-14-blob-runbook-tasks-1-4-and-log-fixes.md`
(§3 items 1–4, §6, §9).

## Plain-English summary

**Task 5 is unblocked.** The two things it was waiting on are merged and live:
month close now counts workouts from the canonical tables instead of the blob,
and the parity gate can now see current-month logs, which is the safety net the
soak needs. September's activities are also safe — they were going to be lost
when the month closes.

## What merged

| PR | What | State |
|---|---|---|
| [#24](https://github.com/aadhilsj/Lift-Log/pull/24) | Month close counts from canonical | Merged, live |
| [#25](https://github.com/aadhilsj/Lift-Log/pull/25) | Open-season log parity in the gate, env loader fix | Merged (CLI scripts only, no app change) |

Verified after #24 deployed: app and API both HTTP 200, parity gate 9/9 clean at
blob revision 2503.

## Answers to the questions in §6 and §3

**§6.1 — open a PR for `blob/month-close-canonical`.** Done and merged as #24.

**§6.2 / §3 item 4 — does Task 5 still wait on `left_at`?** **No.** `left_at` is
membership lifecycle only (`leftMemberNames`, `joinedMonthByName`); it never
touched month close. With #24 merged, month close reads canonical, and with #25
merged the open-season check exists. **Nothing on our side now blocks Task 5.**

**§3 item 1 — open-season parity check.** Merged in #25. See below for how to
read it during the soak, because the two directions are deliberately different.

**§3 item 2 — gate env loader.** Fixed in #25. `loadEnvFile` now strips
surrounding quotes, so a `vercel env pull` `.env.local` works directly. A value
of `[SENSITIVE]` is treated as absent, so the caller's env var wins and the
error names the real cause instead of `ERR_INVALID_URL`. Your §6.2 workaround
still works and is still the safest way to supply the key.

**§3 item 3 — delete the inert preview `BLOB_MIRROR_SKIP_ACTIONS` on
`codex/create-group-canon`.** Agreed, please delete it. It is dead now that
previews cannot reach production data, and leaving a stale skip list around is
exactly the shape that produced the orphan Blocs.

**§9 — September's activities.** Confirmed saved by #24. The rebuild passes
canonical rows through whole and `fetchAnteCurrentLogs` carries `activity`,
verified on the rebase rather than assumed. The 93 logs that have `activity`
only in canonical will keep it through the 1 October close.

## How to read the new check during the Task 5 soak

`open-season-log-parity` compares current-month logs per group, member and id.
The two directions are **not** symmetrical, on purpose:

- **Phantom — blob has a log canonical does not: FAILS.** This is the 09-09
  delete shape. `assertWorkoutSlotAvailable` counts from blob `group.logs`, so a
  phantom permanently eats one of that member's two daily slots.
  `getDistinctWorkoutCountForDate` does not filter `deletedCurrentLogIds`, so a
  tombstoned phantom still blocks; it is reported with a `tombstoned` flag
  rather than excused. Findings are in cap units — sessions keyed by the log
  id's leading timestamp, counted per member per date across all their Blocs —
  and any member at the cap with a phantom is named in
  `blockedFromLoggingToday`. That field is the actionable one: it lists people
  who cannot log today.
- **Missing — canonical has a log the blob does not: WARNS, never fails.**
  Before wave B this means an `add-log` mirror failed. **During wave B this is
  exactly what the skip list is for and the count will grow.** Because month
  close now rebuilds from canonical, a blob behind on current logs no longer
  corrupts the frozen month. So a soak stays green while the number stays
  visible in the report.

Groups whose blob month and canonical open season disagree are listed in
`groupsNotComparedMidRollover` and not compared; `rollover-liveness` already
owns that condition.

**Production, 2026-09-20 (blob revision 2503):** 9/9 clean, every group
compared, **zero phantoms and zero missing**. That is independent confirmation
that restoring the `delete-log` mirror worked — it matches your 317/317 finding.

## Month close: what changed, and the failure policy

`persistState` rebuilds the closing snapshot from canonical current-log rows
before either store is written (`rebuildClosedMonthSnapshotFromCanonicalLogs`).
Counts (rejected logs excluded), `logsByUser` and settlements are recomputed;
names, excused, solo, training, targets and settings are untouched.

**If canonical logs cannot be read, the Bloc is skipped, not frozen.** It
reverts out of the rollover batch, keeps its old month, retries on the next
read, and surfaces as `rollover_skipped` on the founder dashboard. A season with
zero canonical rows while the blob counted workouts is treated the same way.

This null rule is **deliberately the opposite** of the `fetchAnteBlocs` one, and
both are commented in place so neither gets "fixed" later: an unreadable Bloc
*list* must not skip every Bloc (that recreates the 09-01 stall), but unreadable
*logs* must not freeze money numbers from a store that no longer receives every
write. A wrongly frozen settlement is permanent; a skipped Bloc is retried.

## 1 October — the one thing worth doing on the day

Month close on canonical has **not** been verified against a real production
rollover. The sandbox answers canonical RPCs with `[]`, so the rebuild takes its
"canonical empty" skip there; only the fixture suite and code review cover it.

The rollover is the live proof, and the conditions are favourable: `add-log` and
`multi-log` still mirror to the blob, so the blob is a complete parallel record
while the close runs on canonical.

Please run `npm run parity:gate` after the rollover completes and check:

1. `rollover-liveness` — no Bloc stuck, no unexplained lag.
2. `historical-workout-count-parity` — the frozen September counts agree with
   canonical logs.
3. September's closed month has activities on its logs.
4. `ante_core.system_events` for any `rollover_skipped` rows — a skip is the
   safe outcome, but it means that Bloc needs a look.

If all four are clean, month-close-on-canonical is proven on real data.

## Still on Deveen's plate

- **§3 item 5 — RLS audit** (App Store blocker). Not started. Seven `ante_core`
  tables with RLS disabled; your recommended safe sequence is the right one and
  will be followed — inventory first, one additive migration, test on a restored
  copy, production last with a backup and a rollback plan.
- **§7 — scaling before launch.** Not started. Read and agreed: scoping reads to
  the member's Blocs, then a revision per Bloc, then past months on demand, is
  the right order — the two together are most of the 1.4 MB per refresh and the
  reason one action in one Bloc reloads every open phone. Will confirm
  ownership and sequencing in the next handover.

## How to verify anything here

```
npm run parity:gate:test            # 23/23, offline, no credentials
npm run test:month-close-canonical  # 12 checks, offline
npm run parity:gate                 # live, read-only
```

Reports land in `migration-output/parity-gate/`.
