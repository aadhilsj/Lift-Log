# Handover — 11 October 2026 (session 2): the blocking migration, and the app-opens figure

**Status: open.** Claude, operating. This is a live handover, updated as the
session goes.

Second session of 11 October. The first one's two docs
(`handover-2026-10-11-blocking-and-reporting.md` and
`handover-2026-10-11-blocking-pickup-verification.md`) are **not** written into
by this session.

Previous session: `handover-2026-10-11-blocking-pickup-verification.md` (open,
handed on deliberately).

---

## Where we stopped — read this first

1. **The blocking branch's one blocker does not exist.** The migration
   `20261011090000_add_block_interaction_guard.sql` **was already applied to
   production** before this session started. See §2.2. The previous session
   recorded it as unapplied and named it as the one thing that must happen
   before shipping; that is now corrected.
2. Nothing was changed, pushed or deployed by this session. No write SQL ran.
3. The branch `claude/blocking-and-reporting-2026-10-11` is still 8 commits
   ahead of `origin/main`, still unpushed, still not live.

---

## 1. Where things stood at the start

- Live website: `c897ac6`, bundle `index-ktU5fSot.js`, Vercel Production
  success. CI green on the last five runs on `main`. No open PRs.
- TestFlight still build 10.
- The shared checkout at `~/Documents/Codex Space/Lift Log` is **14 commits
  behind `origin/main`**. Everything in this session was read from
  `origin/main`, not from that disk.
- The blocking worktree at `~/Developer/FERO/blocking-2026-10-11` is clean
  (only an untracked `node_modules` symlink).
- A sandbox from the previous session is still up on ports 3000 and 54321
  (PIDs 1681, 1682).

## 2. What happened, in order

### 2.1 Catch-up performed, this handover opened

Read `docs/HANDOVERS.md` §1, `docs/WHATS-LIVE.md`, the 9 October active
handover in full, the 10 October legal-pages handover, and both of today's
blocking docs. Checked the workspace, remote refs, GitHub CI, Vercel
deployments and the live bundle. Nothing changed.

### 2.2 Correction: the block interaction guard is already in production

The founder approved applying the migration. Before applying it, the
before-state was recorded — and the work turns out to be done already.

Read-only checks against production (`bpvvvqjsfwmmfjvvijkd`):

| Check | Result |
| --- | --- |
| Both functions exist in `public`? | **Yes** — `read_ante_core_blockers_of(text)` and `read_ante_core_workout_log_comment_author(uuid)` |
| Do their bodies match the migration file? | **Yes, exactly** — compared via `pg_get_functiondef` against the file, character for character |
| Migration history | **`20261011010106 add_block_interaction_guard`**, applied 11 Oct ~01:01 |
| Grants | `{postgres=X/postgres,service_role=X/postgres}` on both — `anon` and `authenticated` **cannot** execute either |
| Row counts, untouched | `user_blocks` 0, `content_reports` 0, `workout_log_comments` 286, `profiles` 48 |

So the first session of today *did* apply it, and the pickup session that
followed concluded it had not — it checked the worktree's `.env.local` and its
own lack of credentials, but never the production migration history.

**Nothing was applied by this session.** `apply_migration` was not called;
there was nothing to apply. All five queries above are reads.

**What this changes:** the "one thing that must happen before this ships" is
already done. The 404-on-reaction-to-a-comment risk the previous session
described cannot happen, because the function it would 404 on exists. The
deploy-order hazard is gone.

Still open from that session, and still the founder's call: whether to wrap the
author lookup at `api/lift-log.js:10070` the way its sibling is wrapped (now a
belt-and-braces change, not a prerequisite), and whether the branch goes to a
preview or straight to `main`.

Still true: whether a block or a report **persists** has never been proven. The
sandbox answers every RPC `200 []`. It needs production.

### 2.3 Answered: average app opens per day

The founder asked for the all-time daily average. Read
`docs/READ-BEFORE-ANALYSING-FERO-NUMBERS.md` first, per §11, then read the
metric's own definition rather than inventing one: App Opens come from
`ante_core.app_daily_activity.open_count`
(`supabase/migrations/20260924120000_fix_founder_dashboard_metrics.sql:291`),
where returning after 30+ minutes counts as a new open.

**The honest window is 24 September onward.** Before that the table holds one
open per active person per day, backfilled — a floor, not a count. The all-time
average of 25.7/day therefore understates reality and was not quoted as the
answer.

| Window | Opens/day |
| --- | --- |
| 24 Sep – 11 Oct (exact) | **34.6** |
| 24 Sep – 10 Oct (excluding today, still in progress) | **35.1** |
| All time incl. backfilled floor — do not quote | 25.7 |

Supporting figures, same exact window: 622 opens over 18 days; ~21 people open
it on a given day; **1.65 opens per person per day**; 40 of 48 accounts opened
it at least once (83%); DAU/MAU **52%**.

Caveat recorded: the founder counts one open per day only in this metric, so the
true human total is marginally higher.

Observed and deliberately **not** presented as a trend: the last four days
(30, 26, 18, 25) sit below the 24 Sep – 1 Oct run (39–54), with 10 Oct the
lowest in the window at 18 opens from 14 people. Eighteen days is too short,
and the 1 October month close plus the September Recap banner is a plausible
cause of the earlier peak.

---

## 3. Still open

Carried from the 9 October handover and today's first session, unchanged except
where noted:

- **The blocking branch** — verified, unpushed, not live. Migration done (§2.2).
  Two decisions outstanding: the optional hardening, and preview vs `main`.
- **The legal pages need blocking put back.** On 10 October every mention of
  blocking was removed from the Privacy and Support pages because the feature
  did not exist. When this branch ships, that wording has to return.
- **Block/report persistence unproven** — needs production or the restored-copy
  route.
- **TestFlight build 11** — never built; `main` is far past it.
- **1 November month close** — first since the `c9ce86a` fix.
- **Waiting on Deveen:** RLS production rollout unrecorded, `push_devices`
  missing from his migration, `fero-staging` still billing ~$9.68/month.
- `test:auth-edge-flows` and `test:mobile-navigation` broken on `main` too.
- The sandbox cannot close a month; a prorated target can exceed the full
  target; `read_ante_core_logs_for_month` has no test.
- Cleanup candidates: ~40 stale local branches, two August worktrees, the four
  August `.dmg` backups.

## 4. Commits this session

| Commit | What |
| --- | --- |
| *(this one)* | Open the session-2 handover, and record that the migration was already applied |
