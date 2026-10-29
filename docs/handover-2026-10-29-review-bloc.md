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

| Member | Email | Workouts this month |
| --- | --- | --- |
| **Tariq** (admin) | `review.tariq@joinfero.app` | 14 — cleared |
| Hana | `review.hana@joinfero.app` | 10 |
| Noah | `review.noah@joinfero.app` | 7 |
| Eli | `review.eli@joinfero.app` | 4 |
| Leo | `review.leo@joinfero.app` | 2 |

37 workout logs, each on a distinct day per member, across Gym, Run, Pilates
and Padel. The standings match the marketing site's cast and the sandbox demo
Bloc, so the website, the screenshots and the review environment all tell the
same story.

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
| Bloc, members, logs | 1 Bloc, 5 members, **37** logs; standings 14/10/7/4/2 |
| Founder dashboard `accounts` | **`{total: 48, newLast30Days: 0}`** — the real numbers |
| Profiles in the database | 53 total, 5 review, **48 real** — so the dashboard is excluding correctly |
| `app_daily_activity` review rows | **0** |
| `npm run lint`, `npm run build` | clean |
| API module loads with the new env var | yes — `normalizeEmailAddress` is a hoisted declaration, as the founder set beside it already proves |
| Deployment of `9ea8448` | success; live site 200 |

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
