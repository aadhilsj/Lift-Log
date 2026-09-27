# RLS migration — what it does, how to rehearse it, when to apply it

From Deveen, answering §1, §2 and §7 of `handover-2026-09-22-for-deveen-active.md`.

Migration: `supabase/migrations/20260926120000_enable_rls_on_server_only_tables.sql`

## Plain-English summary

Your inventory came back **not exposed**, which is the good outcome — nothing
is leaking today. This migration adds the missing lock anyway, so that a future
mistake cannot open those tables. It is additive, it changes no data, and it is
reversible in one line per table.

**It will not break the app**, and the reason is worth stating because it is
the whole basis for doing this safely rather than nervously: turning on RLS
with no policies blocks browsers, but neither path the app uses is affected.
The server's key (`service_role`) carries `BYPASSRLS`. The 22 functions over
these tables are `SECURITY DEFINER` and run as the table owner, and an owner is
exempt from its own table's RLS. The migration deliberately does **not** set
`FORCE ROW LEVEL SECURITY`, which is the one setting that would remove that
exemption and break them.

## What it changes

**1. The seven tables from your inventory** — RLS on, no policies.

**2. The eighth table you found (§2.1)**, `backup_bloc_message_solo_note_2026_09_18`
— included rather than dropped. Enabling RLS is additive and reversible;
dropping is neither, and whether you still want that backup is your call to
make on its own. The statement is guarded, so if you drop it first this
migration still applies cleanly.

**3. The fifteen projection tables (§2.2)** — browser grants revoked, RLS left on.

Your read of these was right and it is the most useful thing the inventory
turned up. They are safe *today*, but only because RLS is holding on its own.
They carry Supabase's default full grants to `anon` and `authenticated` —
including INSERT, UPDATE, DELETE and TRUNCATE — so RLS is a single point of
failure on tables nothing has used since 9 June. Revoking the grants means
switching RLS off on one of them would no longer be enough to expose it.

**Not dropping them.** They hold ~280 rows and dropping is irreversible. That
deserves its own decision with a backup rather than riding along inside a
security migration. Recommended as a follow-up once this has settled — and at
that point the three `supabase/lift-log-*projection*.sql` files should go too.

## Rehearse on staging first

Staging is restored from the 23 September backup, so it predates the four
24 September migrations. That does not matter here — none of them touched these
tables, and your §8 check confirmed the same eight tables still have RLS off.

1. Apply the migration to **staging**.
2. Run the two verification queries from the bottom of the migration file. Both
   should return **zero rows**.
3. Exercise the app against staging, because the queries only prove the locks
   moved — they do not prove nothing broke:
   - Bloc Stream: read, send a message, react, unread count clears
   - Workout comments: read, post, react
   - Solo mode: raise a request, review it
   - Sign in from signed-out, and bootstrap
   - Log a workout, and delete one
4. If all of that works, it is ready for production.

**The Stream and comments checks are the ones that matter.** Those tables are
where a mistake would show, and they are exactly what Supabase's generic
"enable RLS" button would have broken.

## When to apply to production

**Agreed: 2 or 3 October, after the month close.** Your sequencing call, and I
agree with it — a database change has no business landing next to the first
real canonical rollover. Same reasoning as holding Wave B.

Before applying: a fresh backup, and the rollback line to hand (it is in the
migration header). Applying takes seconds and locks nothing meaningfully; it is
`alter table`, not a rewrite.

## One correction to the inventory doc

You were right that my Step 4 read any `200` as an incident. A `200` with an
**empty array** is RLS denying rows, which is the system working. Only a `200`
**with rows** is a leak. The three projection-table `200`s you saw were the
safe kind. I have not edited the original doc — this note is the correction,
and it is worth carrying into any future version of that check.

## Not run, and why it is fine

You skipped the Step 4 calls with a signed-in bearer token. Agreed that it
would not change the result: the `406` is PostgREST rejecting the schema
profile because `ante_core` is not exposed, and that happens before the role is
considered. No need to run it.

## What this unblocks

This was the last technical blocker for App Store submission. After the
rehearsal passes and it is applied on 2–3 October, the remaining blob work
(Wave B, then the `left_at` redesign) is migration housekeeping rather than
anything that gates the submission.
