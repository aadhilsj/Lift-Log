# 29 October — the App Store review Bloc, built in production

**Live.** The seeded Bloc App Review needs now exists in the production
database, and the five accounts behind it are kept out of the product numbers.

## 1. What exists now

| | |
| --- | --- |
| Bloc | **Sunday Warriors** |
| Bloc id | `sunday-warriors-yr392c` |
| **Invite code** | **`FQ1GXF`** |
| Target | 12 workouts/month, GBP, fine £10 escalating by £5 |
| Time zone | Europe/Oslo |
| Training Wheels | off |

| Member | Email | Workouts, October | At the close |
| --- | --- | --- | --- |
| **Tariq** (admin) | `review.tariq@joinfero.app` | 14 | clear |
| Hana | `review.hana@joinfero.app` | 13 | clear |
| Noah | `review.noah@joinfero.app` | 13 | clear |
| Eli | `review.eli@joinfero.app` | 12 | clear |
| Leo | `review.leo@joinfero.app` | 12 | clear |

**64 workout logs**, each on a distinct day per member, across Gym, Run,
Pilates and Padel. The cast matches the marketing site and the sandbox demo
Bloc, so the website, the screenshots and the review environment tell the same
story.

### Everybody clears the target, deliberately (30 October)

The Bloc was first seeded at 14/10/7/4/2, which would have fined four of the
five at the 1 November close. **The founder's instruction:** *"I don't want the
reviewer to open up to see any fines... push everybody's workout total to clear
the target."*

So 27 more logs were added — Hana +3, Noah +6, Eli +8, Leo +10 — on October
days each member did not already have, so the two-per-activity-per-day cap was
never in play. The spread above the target was kept (14/13/13/12/12) because
identical totals would look staged.

**Nothing else in this Bloc can produce money.** Checked: no settlement runs,
no settlement confirmations, and no prior months — it was created on 29
October. Missing the monthly target is the only route to a fine here, so
clearing it for everyone is sufficient.

### This needs topping up every month

Once November closes on 1 December the same five are short again, and a
reviewer would see exactly the fines this avoided. **Apple re-reviews every
update**, so this is not a one-off. Either top the Bloc up before each
submission or schedule it. Decide after the first submission is through.

**Why these names:** they reuse the cast already staged for screenshots
(`bf9d4e3`). No real person's name or data is involved.

## 2. How it was built, and why that way

**Through the app's own API**, not by writing rows. Fero dual-writes the legacy
blob and `ante_core`; hand-writing a Bloc into canonical alone would have
produced one the app cannot properly see. The seed drives `auth-sync`,
`upsert-profile`, `create-group`, `join-group` and `add-log` exactly as the
sandbox seed does, so both stores are consistent by construction.

Accounts were created with the Supabase admin API (`email_confirm: true`, so
**no mail was sent to anyone**), then a real session was minted per member via
`admin/generate_link` → `/auth/v1/verify`. The whole chain was proved on a
throwaway account first, which was deleted and confirmed gone before anything
real was created.

**The local OTP bypass is off in production** — `ENABLE_LOCAL_DEV_OTP` is not
set in Vercel at all, in either scope. That is the right posture and it also
satisfies the runbook's "no local OTP bypass" line.

**Backup:** the daily physical backup of 29 October 07:46 UTC was `COMPLETED`
before any of this ran.

## 3. Keeping them out of the numbers

They would otherwise have counted, in two separate places.

### The API side — a NEW exclusion, deliberately

`ANALYTICS_EXCLUDED_EMAILS` (set on Vercel, **Production scope only**) and
`ANALYTICS_EXCLUDED_USER_IDS`. Usage events and daily activity both skip them.

**Not** `FOUNDER_DASHBOARD_EMAILS`, which is the existing exclusion: that same
check **grants founder dashboard access** (`api/lift-log.js`, the
`isFounderDashboardUser` call in `assertFounderDashboardUser`). Adding review
accounts to it would have handed Apple's reviewer the founder dashboard.

A review account is dropped **outright** rather than marked active — the
founder is a real person using the app and stays in Active Users; a reviewer is
not a user.

### The database side

`read_ante_core_founder_dashboard` counted profiles in two lines. Both now
exclude `email not like 'review.%@joinfero.app'`.

**The second one is the one that mattered.** `accountsNewLast30Days` would have
reported **5** on a product that has not launched, where
`READ-BEFORE-ANALYSING-FERO-NUMBERS.md` says flat growth is the plan. It would
have read as growth, and nobody would have had reason to doubt it.

Excluded by **email prefix**, not a list of ids — the same reasoning as the
`backup_` sweep: a list is correct the day it is written and wrong at the next
account. Any future `review.<name>@joinfero.app` is covered automatically.

### Cleaned up

Seeding itself created **5 `app_daily_activity` rows** before the exclusion
existed. Deleted, scoped to those five accounts only: the table went
**1257 → 1252**, and zero review rows remain.

## 4. Verified

| Check | Result |
| --- | --- |
| Bloc, members, logs | 1 Bloc, 5 members, **64** logs; standings 14/13/13/12/12 |
| Members short of target at the close | **0** |
| Founder dashboard `accounts` | **`{total: 48, newLast30Days: 0}`** — the real numbers |
| Profiles in the database | 53 total, 5 review, **48 real** — so the dashboard is excluding correctly |
| `app_daily_activity` review rows | **0** |
| `npm run lint`, `npm run build` | clean |
| API module loads with the new env var | yes — `normalizeEmailAddress` is a hoisted declaration, as the founder set beside it already proves |
| Deployment of `9ea8448` | success; live site 200 |

## 4a. The fixture is fully out of the dashboard (30 October)

The founder: *"these are fake ones, and it's all going to be deleted as soon as
the App Store review is done... just delete them from the dashboard."*

The 29 October change only took the five accounts out of the two **account**
counts. Their **workouts were still being counted** — the dashboard was
reporting `workoutUploads.today = 37`, every one of them seeded.

`20261030120000` guards all eleven reads: six over `workout_logs`, five over
`app_daily_activity`. Workouts are excluded **by Bloc**, not by author, so a
log the reviewer writes during review is left out too, whatever account it
comes from.

| Metric | Before | After |
| --- | --- | --- |
| `workoutUploads.today` | 37 | **10** |
| `workoutUploads.week` | 151 | **87** |
| `workoutUploads.month` | 522 | **458** |
| `workoutUploads.allTime` | 2086 | **2022** |
| `activeUsers.today` | 17 | **13** |
| `activeUsers.week` | 38 | **34** |
| `activeUsers.month` | 44 | **40** |
| `accounts` | 48 / 0 new | unchanged, already correct |

*(`allTime` 2022 against 2533 real rows is not a discrepancy: the dashboard
counts distinct workouts, and one workout logged to several Blocs is one
workout.)*

### A correction: the env var was not working until today

`ANALYTICS_EXCLUDED_EMAILS` was added on 29 October **minutes before** the
deploy that was supposed to use it, and a Vercel build captures its environment
at build time. So the running build never had it, and the top-up on 30 October
recorded **four more** `app_daily_activity` rows for the review accounts.

Found by noticing `activeUsers` fell by 4 when the Bloc was excluded — rows
that should not have existed at all.

Two things made it hard to see: Production variables are **sensitive** by
default, so `vercel env pull` returns them empty and cannot be used to check a
value; and the first `vercel env add` was piped on stdin, which the CLI did not
take. It is now set with `--value`, and a forced redeploy (`44edd84`) put it in
the running build.

**Verified behaviourally, which is the only honest check here:** a review
account called the live API after the redeploy, and **no activity row was
created**. The four stray rows were deleted. Fixture activity rows: **0**.

## 5. STILL NEEDED before submission

1. **The review account itself.** This Bloc has no reviewer in it yet. It needs
   a real email whose inbox is monitored for the whole review window, added to
   the Bloc with invite code **`FQ1GXF`**. **The founder's to supply.**
2. **The review video URL.**
3. **Proof `support@joinfero.app` receives mail.** The domain can — Cloudflare
   Email Routing MX and SPF records exist — but whether `support@` maps to an
   inbox is unconfirmed. A one-minute test settles it.
4. **TestFlight build 12 must be re-cut from `main`**, not built as it stands.
   See `app-store-review-notes-2026-10-22.md` §5 — it is now well over 29
   commits behind and carries the old two-per-day cap and the calendar delete
   bug.

## 6. Rollback

The Bloc and its accounts can be removed if ever needed: delete the five auth
users (which cascades their profiles and memberships) and the Bloc row. Nothing
else references them. The two code/database changes are independent of it —
re-run `20261029140000` without the two `email not like` clauses, and unset
`ANALYTICS_EXCLUDED_EMAILS`.

## 7. Commits

| What | Commit | Live? |
| --- | --- | --- |
| The exclusion, API and database | `9ea8448` | **yes** |
| Production data: the Bloc itself | n/a — data, not code | **yes** |
