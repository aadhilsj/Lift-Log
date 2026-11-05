# Answers to §14 questions 6, 7 and 8

From Deveen, closing out
`handover-2026-10-29-for-deveen-active.md` §14. Questions 1–5 were answered on
3 November with three branches; these are the three that were still open.

## Q6 — Migration history has diverged. Which side is authoritative?

**Neither, because they are not tracking the same thing.** Production is
authoritative for *state* — what is actually in the database. The repo is
authoritative for *intent* — what we meant to do and can review. Picking a
winner would throw away one of those.

What diverged is only the **ledger**, not the content: `apply_migration` stamps
the server's own timestamp while repo files carry hand-written ones, so the same
change is recorded under two version numbers. The 23 October cap migration is
`20261023100000` here and `20261023065455` there.

So the fix is to reconcile the ledger, not to replay anything:

1. **Never run `supabase db push` on this project** until this is done. It would
   attempt ~25 migrations whose content is already live. Some are
   `create or replace` and harmless; others are not. Worth a line in CLAUDE.md
   §4 so it is a rule rather than a memory.
2. For each repo migration whose content is already live under a different
   server timestamp, tell the ledger so:
   `supabase migration repair --status applied <version>`. That is the tool
   built for exactly this, and it changes no data.
3. Anything genuinely unapplied: apply normally.
4. Verify `supabase migration list` shows no divergence.

**The forward rule matters more than the cleanup**, or it diverges again next
week. CLAUDE.md already says DDL goes through `apply_migration` with a matching
file in `supabase/migrations/`. One line is missing: **after applying, rename
the repo file to the timestamp the server assigned.** Then the two ledgers
cannot drift, because there is only ever one timestamp per change.

I have not run the repair. It is a production operation on your side, and it
wants the two `migration list` outputs side by side first.

## Q7 — Prorated target can exceed the full target

**Decided: clamp on read. Not recompute on write.** Implemented in this branch,
one line in `getEffectiveTargetForMonth`, with 10 checks in
`npm run test:prorated-clamp`.

Proration means "you joined part-way through, so you owe less". A prorated
target *above* the full one is not a smaller share of anything, so clamping is
not a policy choice — it is arithmetic that had come adrift.

Your suggested fix was recompute-on-change **and** clamp. I took the clamp and
declined the recompute, because:

- **Clamping needs no migration and repairs existing rows.** Active divas' 12
  against a target of 11 reads as 11 from the next refresh, with nothing
  written.
- **Recomputing moves a target under a member mid-month.** Someone working to
  10 finds it is now 12 because an admin changed a Bloc setting. That is a new
  class of "my target changed" confusion, traded for a bug nobody was harmed
  by.
- **Clamping is already correct in both directions.** Lower the full target and
  everyone converges down, which nobody can be hurt by. Raise it and the
  prorated share stays put, which is right — joining late should not
  retroactively cost more.

If you want recompute-on-change as well, it is a separate decision with a
migration and a backfill behind it, and I would rather it not ride along with a
correctness fix.

## Q8 — The lazy month close

**The read path already persists.** `fetchReadableCurrentState` calls
`persistState(..., "auto-rollover-read", { rolloverOnly: true })` as soon as it
sees a pending rollover, so a Bloc rolls the first time *anyone reads it*.

So "lazy" is not quite the diagnosis. The gap is narrower and worse: **a Bloc
nobody opens never gets read, so it never rolls.** Dormant Blocs are exactly
the ones with no one to notice, and on 1 October that state lasted hours and
hid real settlements.

**Shape: sweep it from the cron that already exists.** `vercel.json` runs
`/api/cron-purge-app-daily-activity` daily at 03:00 with `CRON_SECRET` auth.
Add a rollover sweep beside it: find Blocs whose `lastMonth` is behind their
own local month, and roll them.

Why this rather than anything cleverer:

- **It reuses the rollover path**, including per-Bloc isolation and the
  skip-on-unverifiable rule, rather than reimplementing month close in a second
  place. A second implementation of that logic is how 1 October happens again.
- **The work is bounded and idempotent.** Blocs already rolled are skipped by
  the same check the read path uses.
- **Worst case becomes a day, not indefinite.** Blocs roll at their own 3am
  across time zones, so a daily sweep catches each within 24h.
- **Skips already surface.** They are recorded to `ante_core.system_events` and
  shown on the founder dashboard, which is what caught 1 October.

Not built in this branch. It is a new cron behaviour touching the write path,
and I would rather it land on its own, after the scoped-reads migration settles
— not stacked behind two other unreviewed changes a few days after a month
close.

**One caveat worth recording.** A sweep makes dormant Blocs roll unattended,
which is the point, but it also means month close can now run with nobody
watching. The skip events are the safety net, so whoever builds it should check
the founder dashboard the morning after the first sweep rather than assuming
silence is success. That is the same lesson as 1 October.
