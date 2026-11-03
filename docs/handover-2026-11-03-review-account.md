# 3 November 2026 — the App Store review account

**What this session is for:** the founder created the mailbox Apple's reviewer
will sign in with, `feroappreview@gmail.com`, and asked to have it wired into
Fero. That means three things, in this order: keep it out of the numbers, create
the Fero account, join it to the review Bloc.

Live at the start of the session: `98ea2ae`, the same commit as `origin/main`
and as this checkout.

---

## 1. Why the order matters

The 29–30 October work took the five seeded `review.%@joinfero.app` accounts out
of the founder dashboard, by two separate mechanisms:

- **At the API** — `ANALYTICS_EXCLUDED_EMAILS`, a Vercel Production variable, so
  `recordCanonicalDailyAppActivity` never writes a row for them.
- **In the database** — `read_ante_core_founder_dashboard` resolves the excluded
  Blocs and profiles from the `review.%@joinfero.app` email prefix.

Apple's reviewer matches neither. It is an ordinary Gmail address. Had the
account been created first, the day it signed in would have been counted as a
real active user, and the signup as a real signup — the exact failure of
29 October, where the variable was added minutes after the build that needed it.

So both exclusions were widened **before** the account existed.

## 2. The API side

`ANALYTICS_EXCLUDED_EMAILS` (Vercel, Production) now carries six addresses: the
five seeded ones and `feroappreview@gmail.com`. Set with `vercel env add
--value`; `printf | vercel env add` does not deliver the value, and because
Production variables are sensitive, `vercel env pull` returns them empty — so
this cannot be verified by reading it back. It is verified behaviourally in §5.

Builds capture environment at build time, so this needed a redeploy to take
effect. The commit in §4 is that redeploy.

## 3. The database side

`supabase/migrations/20261103230000_review_bloc_members_leave_the_dashboard.sql`,
applied to production at 22:5x UTC on 3 November through the Management API
query endpoint.

One block changes. `v_excluded_profile_ids` was the `review.%@joinfero.app`
prefix set; it is now the union of that set and everyone holding membership in
an excluded Bloc:

```sql
select array_agg(distinct id) into v_excluded_profile_ids
from (
  select p.id from ante_core.profiles p where p.email like 'review.%@joinfero.app'
  union
  select bm.profile_id from ante_core.bloc_members bm where bm.bloc_id = any(v_excluded_bloc_ids)
) s;
```

The reviewer is therefore covered by being **in Sunday Warriors**, not by being
named — so no future review mailbox needs an edit here. Everything else in the
function is byte-for-byte `20261030120000`; the diff is eleven lines in one
place and nothing else.

The workout side already worked this way (excluded by Bloc, not by author) and
was not touched.

**Verified as a no-op today**, which is the correct result: the only members of
Sunday Warriors right now are the five accounts the prefix already caught.
Dashboard before and after the migration, identical:

| | today | week | month | allTime |
| --- | --- | --- | --- | --- |
| activeUsers | 18 | 21 | 28 | — |
| workoutUploads | 11 | 23 | 33 | 2081 |

Accounts 48 total, 0 new in 30 days, before and after.

**Rollback** is one statement: re-run `20261030120000`.

## 4. The account

Created 3 November 22:54 UTC, through the app's own API rather than by writing
rows — the app dual-writes blob and canonical, and a hand-written account is a
member the app cannot properly see.

| Step | Result |
| --- | --- |
| admin create user, email confirmed | 200 |
| `auth-sync` | 200 |
| `upsert-profile` displayName `Fero Review` | 200 |
| `join-group` inviteCode `FQ1GXF` | 200 |

Sunday Warriors now has six members: Tariq, Hana, Noah, Eli, Leo, Fero Review.

The reviewer's readable state was diffed against Tariq's and is **identical**
for October: counts Tariq 14, Hana 13, Noah 13, Eli 12, Leo 12, nobody excused,
target 12 — everyone clear, no fines, which was the requirement.

## 5. The exclusion, verified behaviourally

The account hit the live API four times before anything was checked. Afterwards:

```
email                      display_name  activity_rows  blocs
feroappreview@gmail.com    Fero Review   0              1
```

**Zero activity rows.** That is the proof the 29 October failure did not repeat;
reading the variable back is not possible, so this is the only honest check.

### One thing the first migration missed

`activeUsers` and `workoutUploads` held steady, but `accounts` moved **48 → 49**
and `newLast30Days` **0 → 1**. The two account counts were written by
`20261029140000`, before `v_excluded_profile_ids` existed, and still carried
their own inline `email not like 'review.%@joinfero.app'` — so widening the
variable did not reach them.

Fixed by `20261103234500_account_counts_use_the_excluded_set.sql`, applied to
production immediately. Both counts now use `v_excluded_profile_ids` like the
other nine reads, and the prefix is no longer spelled out in two places.

Every dashboard number now matches the pre-session snapshot exactly:

| | today | week | month | allTime |
| --- | --- | --- | --- | --- |
| activeUsers | 18 | 21 | 28 | — |
| workoutUploads | 11 | 23 | 33 | 2081 |

Accounts 48 total, 0 new in 30 days — unchanged from before the account existed.

## 6. Found, not fixed: November is empty

Sunday Warriors has **zero logs in November**, for all six members. October's
history is intact and reads well, but the current month a reviewer opens into is
blank. Left alone deliberately — it is a change the founder has not asked for.

## 7. Commits

| Commit | What | Live? |
| --- | --- | --- |
| `ef41588` | excluded profiles resolved from Bloc membership, plus this handover | live |
| _(pending)_ | the two account counts use the excluded set | — |

Both migrations were applied to production directly; the commits record them.

## 8. Open

- **November is empty** (§6) — the founder's call.
- Whether the review mailbox receives the sign-in code. A code was sent to it
  from the live project; the founder confirms the inbox.
- TestFlight build 12 is still behind `main`.
- The review video.
