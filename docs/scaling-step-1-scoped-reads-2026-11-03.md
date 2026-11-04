# Scaling Step 1 — scope the reads to the member's own Blocs

From Deveen. Item 4 of the four App Store blockers
(`handover-2026-10-29-for-deveen-active.md` §12), Step 1 of
`scaling-before-launch-2026-09-15.md`.

Migration: `supabase/migrations/20261103120000_scope_readers_to_member_blocs.sql`
**Not applied anywhere.** Schema goes first, then the API change — see the order
at the bottom.

## Plain-English summary

The server reads every Bloc's data on every refresh, then throws away all but
the one or two the member is actually in. This makes it read only theirs.

Nobody will see any difference. The response is identical — the client already
never receives the other Blocs, because `scopeReadableStateForUser` filters them
out after the reading is done. We are deleting wasted work, not changing
behaviour.

## Why this one matters more than the other three

Items 1–3 stop a stall *looking* like data loss. This is the one that stops the
stall.

Measured on production, 25 October:

| Reader | Time | Payload | Cost |
|---|---|---|---|
| `read_ante_core_month_history` | **1.40s** | **1.0 MB** | ~3,820 per-log subqueries |
| `read_ante_core_current_logs` | 0.61s | 304 KB | |
| the other seven readers | ~0.2s each | ~44 KB total | |

Those two are 1.3 MB of a ~2.25 MB refresh and most of its time. The
2026-09-14 statement timeouts named `read_ante_core_month_history` specifically.

The ~3,820 subqueries rebuild reactions and comment counts across 1,910 closed
logs — history that is frozen and cannot change — and they run on every
refresh, for every phone.

A member in 1 of 17 Blocs should trigger roughly 1/17th of that.

## What the migration does

Both readers take `p_legacy_group_keys text[] default null`. Null means every
Bloc, which is exactly today's behaviour, so the rollover path — which has no
member context and must see everything — is unaffected by passing nothing.

A third function, `read_ante_core_member_bloc_keys(auth_user_id)`, is one
indexed lookup so the GET path can resolve the member's Blocs before firing the
readers. Active membership only (`left_at is null`): a member who has left
should not pull that Bloc's history back into their refresh.

**On how the bodies were produced**, because §8.4 of the 2026-09-14 handover
warns about exactly this: they were taken from the newest definition in
`supabase/migrations` — `20260916090000` for `month_history`, `20261016150000`
for `current_logs` — and transformed programmatically. Only the signature and
one `where` line differ. Nothing was retyped, so no column can have been
silently dropped; `activity` and `latest_reaction` are carried through.

**Still worth checking before applying:** the repo is not production. Please
diff each against `pg_get_functiondef` on production first, and if they differ,
say so rather than applying. The line to carry across is:

```sql
and (p_legacy_group_keys is null or b.legacy_group_key = any(p_legacy_group_keys))
```

Each function is dropped and recreated in the same transaction. Postgres treats
a different signature as a different function, so leaving the old zero-argument
version would make an unqualified call ambiguous. Atomic, and invisible to
other sessions until commit.

## The API change — second, not with this

`fetchReadableCurrentState` fires all nine readers in parallel before it knows
who is asking. The GET path does know (`fetchAuthenticatedUser` runs first), so
the change is:

1. Resolve the member's Bloc keys via the new lookup.
2. Pass them to the two scoped readers.
3. Everything else is untouched, including `scopeReadableStateForUser`, which
   stays as the final filter.

It needs a fallback, because a scoped call against a database without the
migration returns `PGRST202`: catch that once, retry unscoped, and remember the
answer so it is not retried per call. That makes code and database
independently rollbackable, in either order.

**Deliberately not in this change.** CLAUDE.md is explicit — *"Schema changes go
first. Apply them before the code that needs them, and make them backward
compatible"* — and `fetchReadableCurrentState` is the bootstrap path for every
read in the app. Writing it before the function exists would mean shipping an
untestable change to the most sensitive function in the codebase. Once the
migration is on production I can verify the scoped path against the real RPC
and measure the saving rather than predicting it.

## Verification

After applying, the unscoped call must be unchanged and the scoped call a
strict subset:

```sql
select jsonb_array_length(public.read_ante_core_month_history())                    as all_seasons;
select jsonb_array_length(public.read_ante_core_month_history(array['<bloc-key>'])) as one_bloc;
select public.read_ante_core_member_bloc_keys('<auth-user-id>'::uuid);
```

And the saving, which is the whole point:

```sql
explain analyze select public.read_ante_core_month_history();
explain analyze select public.read_ante_core_month_history(array['<bloc-key>']);
```

Then the app, unchanged in every respect: Today, Month, History, a Bloc with
several closed months, and a member who belongs to more than one Bloc.

## Order

1. Diff the two bodies against `pg_get_functiondef` on production.
2. Apply the migration. Nothing changes yet — the API still passes no argument.
3. Report back; I land the API change and measure it.
4. Then Step 2, a revision per Bloc, which is what removes the quadratic
   rather than dividing it.

## What this does not fix

It divides the work per refresh. It does not stop **every** phone refreshing
when **any** Bloc changes — that is the single global `revision_clock`, and
Step 2. Until then load still grows with people-online × actions, just with a
much smaller constant.
