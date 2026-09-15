# Blob retirement — Aadhil-side runbook (2026-09-06)

Everything below is Aadhil's half of the blob retirement, ordered, with exact
commands and stop conditions, written so an agent can execute it directly.
Deveen's half (the `left_at` redesign) is a separate branch and is not blocked
by anything here.

**Plain-English summary for Aadhil:** five tasks, in order. 1 and 2 are
read-only checks. 3 proves our backups actually restore. 4 closes the open
incident question. Only task 5 changes anything — it turns off the blob's
copy of workout logs, and only after 1–4 are green.

Standing rules (from CLAUDE.md, they all apply here):
- Aadhil runs all Supabase SQL himself; agents hand him the exact SQL.
- Back up before anything that changes data.
- Say every time whether a thing is on preview or live.
- Stop on any FAIL and record what happened in a comment on the relevant PR
  or a dated doc in `docs/` — do not push through a red check.

---

## Task 1 — Confirm what the mirror-skip flag actually is (read-only, 5 min)

The incident record (I3) assumed `BLOB_MIRROR_SKIP_ACTIONS` cannot be read
back. It can: the running production process reports it.

With `ADMIN_PIN` available in the shell (do not paste the value into any chat
or commit; Aadhil sets it in the terminal himself):

```bash
curl -s -X POST "https://lift-log-nu.vercel.app/api/lift-log" \
  -H "Content-Type: application/json" \
  -d "{\"action\":\"blob-mirror-dependency-report\",\"pin\":\"$ADMIN_PIN\"}" \
  | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{const j=JSON.parse(d);console.log(JSON.stringify(j.mirrorSkipRuntime,null,2))})'
```

- Deveen's measurement on 2026-09-01 01:10 UTC returned
  `enabledActions: ["reaction","flag","flag-response","flag-review","delete-log"]`, `enabled: true`
  against the production alias.
- Record the current output in the incident doc (I3 section) and correct the
  "write-only" claim there.
- If `enabledActions` is empty or different from the above, that changes the
  premises of Task 5 — stop and reconcile with Deveen before proceeding.

## Task 2 — Baseline check of the parity gate (read-only, 5 min)

Requires `.env.local` with `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`
(Aadhil's workspace already has these).

```bash
npm run parity:gate:test   # offline self-test, must print 18/18
npm run parity:gate        # live check, must exit 0
```

The gate now includes the `rollover-liveness` check (merged PR #15): it fails
on any blob group missing from `ante_core.blocs` (the Sept 1 incident shape),
any active Bloc with no open season, and any season stuck >24h behind its
Bloc's local month without a recorded `rollover_skipped` event.

- Last known state: 8/8 clean at blob revision 2239 (2026-09-06).
- Any FAILURE: stop. Post the report JSON from
  `migration-output/parity-gate/` to a new dated doc in `docs/` and do not
  proceed to Task 5.

## Task 3 — Prove a backup restores (read-only for production, ~30 min)

"Backups are on" has never been tested end-to-end. Do not skip this; it is a
precondition for Task 5.

1. In Supabase dashboard (project `bpvvvqjsfwmmfjvvijkd`): Settings →
   Database → Backups. Record the plan tier, whether PITR is enabled, and the
   most recent backup timestamp.
2. Create a NEW scratch Supabase project (free tier is fine) — never restore
   over production.
3. Restore the latest production backup into the scratch project (dashboard
   restore if the plan supports it; otherwise download and `psql` import).
4. Verify in the scratch project, exact SQL:

```sql
select revision, updated_at from public.lift_log_state where id = true;
select count(*) as blocs from ante_core.blocs;
select count(*) as members from ante_core.bloc_members where left_at is null;
select count(*) as logs from ante_core.workout_logs;
```

   Compare against production's current values (same queries there). Counts
   within normal daily movement = pass.
5. Record the result in a dated doc in `docs/` (e.g.
   `backup-restore-verification-2026-09-XX.md`), then delete the scratch
   project.
- If restore is impossible on the current plan: that is a launch blocker to
  fix (upgrade plan or set up scheduled `pg_dump` exports) before Task 5.

## Task 4 — Close I3, or explicitly accept the risk (Aadhil decision)

I3's leading explanation: Bloc deletions on preview deployments (which write
the production database — confirmed 2026-09-03) skipped the blob mirror and
created the orphans. Options, one must be chosen and recorded in the incident
doc:

- **Option A (recommended, config-only):** in Vercel, rescope `SUPABASE_URL`
  and `SUPABASE_SERVICE_ROLE_KEY` to **Production only**, so preview
  deployments cannot reach production data at all. Preview flows that need a
  database use the local sandbox (`npm run sandbox`) instead.
- **Option B:** keep preview pointed at production but delete the stale
  `BLOB_MIRROR_SKIP_ACTIONS` preview-scoped variable (set 2026-07-18 on
  `codex/create-group-canon`) so preview cannot silently skip mirrors.
- Either way: the gate's liveness check now catches any future orphan within
  a day, so residual risk is bounded — but say which option was taken.

## Task 5 — Wave B: stop mirroring workout-log writes to the blob

Only after Tasks 1–4 are green. This is the only step in this runbook that
changes production behavior. It is reversible in ~2 minutes.

1. Fresh backup first (standing rule). Confirm a `lift_log_backups` row or
   dashboard backup from today.
2. In Vercel → Project → Settings → Environment Variables, set the
   **Production** value:

```
BLOB_MIRROR_SKIP_ACTIONS=reaction,flag,flag-response,flag-review,delete-log,add-log,multi-log
```

3. Redeploy (env changes need a redeploy).
4. Immediately after deploy, app-level smoke test on a phone: log a workout,
   log a second workout, delete one — all three must behave normally.
5. Soak 48–72h. Daily: `npm run parity:gate` must stay at exit 0.
   `node scripts/blob-remirror.mjs --scope wave-b` (dry-run, no writes) —
   `log-added`/`log-removed` entries for current-month logs are the skip
   working as designed, not a bug.
6. Rollback if anything looks wrong:
   - Remove `,add-log,multi-log` from the variable, redeploy.
   - Heal the blob's stale window:
     `node scripts/blob-remirror.mjs --scope wave-b --apply` (low-traffic
     moment; it aborts safely if a write races it — re-run).
   - `npm run parity:gate` to confirm, then record what happened.

## Hard boundaries (unchanged)

- **Never add** `join-group`, `kick-member`, `leave-bloc`, `create-group` to
  the skip list — they write blob fields (`leftMemberNames`,
  `joinedMonthByName`) that have no canonical home until Deveen's `left_at`
  work lands.
- Do not touch `public.lift_log_state` itself; table retirement is a later,
  separate phase.
- Empty reactions in blob current-month logs are expected under skip — not a
  bug, do not "fix".

## After wave B

Wave C (`update-settings,season-proration-choice`) follows the same pattern as
Task 5 once wave B has soaked clean. Then the remaining blob dependencies are
the four lifecycle actions (waiting on `left_at`), `meta.revision` on the
client, and the identity/repair paths — tracked in
`docs/handover-2026-09-01-blob-retirement-parity-tooling.md`.
