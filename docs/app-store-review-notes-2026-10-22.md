# App Review notes — draft, 22 October 2026

Fills the template in `app-store-submission-runbook.md`. **Everything here is
established from the code, the production database or the Vercel environment
and is stated as fact.**

**Revised 6 November 2026.** §1 is now complete and paste-ready — the review
account, the Bloc and the invite code are filled in and there are no
placeholders left, which the runbook requires. Three things in it were also
*wrong* and are corrected: the daily cap (it is two per activity since 22
October, not two per day), the promise that a reviewer would see the settlement
buttons (nothing is owed in the review Bloc, so they are not on screen), and
the `bank` option in §4, which the app never offered. What remains is §5.

---

## 1. The notes themselves

```text
Fero is a private workout-accountability app for invited groups called Blocs.
Members choose a monthly workout target and an accountability penalty. Fero
records workouts, works out the month's result, and records who owes what and
whether it has been settled.

Review account:
- Email: feroappreview@gmail.com
- Password for that mailbox: supplied in the Sign-In Information fields above.
- Sign-in: Fero has no passwords of its own. You enter an email address and we
  email a six-digit code to it. Open the mailbox above to read the code. That
  inbox is monitored for the whole review window; if a code does not arrive,
  contact us and we will re-send.

Seeded Bloc:
- Name: Sunday Warriors
- The review account is already a member, so no second person is needed to
  evaluate the social features. If you ever need to re-join it, the invite
  code is FQ1GXF.
- Six members. Monthly target 12 workouts. Penalty GBP 10.
- October 2026 is a finished month in this Bloc and all five members met the
  target, so no penalty is outstanding. November is in progress.

Recommended test path:
1. Sign in with the review email and the emailed code.
2. You will land on the seeded Bloc's Today screen: the monthly target, the
   member leaderboard and each member's status.
3. Tap the centre + button to log a workout. The count and your status update
   immediately. A photo is optional.
4. Activity shows the Bloc's recent workouts, with reactions and comments.
5. Month shows the Bloc's progress ring for the current month, and October
   behind it as a closed month.
6. Profile shows your own history and a calendar of your workouts.
7. The speech-bubble icon opens the Bloc Stream, a private group chat.
8. The bell opens "For you" - reactions, comments and mentions aimed at you.
9. Profile -> account screen has Privacy, Terms of Use, Support, Blocked
   members, sign out and permanent account deletion.

PENALTY AND SETTLEMENT - WHAT THE BUILD ACTUALLY DOES

Fero never holds, transfers, routes or processes money, and there is no
payment provider in the app. There is no in-app purchase, no subscription, no
wagering credit and no pool. Fero has no payment processing of any kind.

A Bloc agrees a penalty amount among themselves. When a member misses their
monthly target, Fero records that they owe that amount to the other members.
That record is all Fero has.

Settlement confirmations are enabled in this build. Where a member has missed
a target, three controls appear:
- "Claim paid"  - the person who owes marks that they have paid, by hand.
- "Confirm"     - the recipient confirms they received it, by hand.
- "Dispute"     - the recipient says they did not.
None of these move money or check anything. They are three people pressing
buttons about something that happened outside the app. In the review Bloc
every member met October's target, so nothing is owed and these controls are
not currently on screen. To see them, log fewer than 12 workouts in a month.

A member may optionally save their own payment handle (for example a
revolut.me or paypal.me link). Where one exists, Fero can show a "Pay" button
that OPENS THAT THIRD-PARTY APP OR PAGE. Fero does not process the payment,
does not see whether it happened, and never changes settlement status as a
result. Only revolut.me, paypal.me and qr.vipps.no are ever turned into a
link; anything else is shown as plain text to copy. Fero does not ask for or
store bank account details, card numbers or any other financial credential.

Age rating: Fero is 18+. The Terms of Use set 18 as the minimum age, because
the penalty is a real financial commitment between adults.

External services required during review:
- Supabase - database, authentication and image storage
- Email delivery, for the six-digit sign-in code
- Apple Push Notification service
No analytics SDK, no advertising SDK, no third-party tracking.

Permissions:
- Camera        -> only when you choose to take a photo for a workout or your
                   profile. The app is fully usable without it.
- Photo library -> only when you choose an existing photo for the same.
- Notifications -> workout and settlement reminders.
Fero does not request tracking permission and does not track users.

User-generated content:
Members can post workout photos, comments and Stream messages. Report and
Block are available on workout posts, comments, Stream messages and member
profiles. A blocked member cannot interact with the blocker. Reports reach a
moderation queue that we review. Blocked members are listed and can be
unblocked on the account screen.

Data deletion:
Profile -> account screen -> Delete account removes the account and the
member's own content, including uploaded photos.

Non-obvious behaviour:
- Two workouts of the SAME activity per day is a deliberate cap, enforced in
  the database. There is no cap on how many workouts you log in a day: two
  runs plus a gym session plus a padel game is allowed; a third run on the
  same day is not. It is not a bug; Fero rewards consistency rather than
  single long sessions.
- Workout photos are deleted automatically 72 hours after posting, so older
  entries show an activity icon instead of a picture.
```

**If a demo video is uploaded**, add one line under the first paragraph:
`Review video: <URL>`. Apple's guideline 2.1 asks for a demo *account*, not a
video, so the notes are complete without it.

**Legal URLs for the App Information page:**

| Field | Value |
| --- | --- |
| Privacy Policy URL | `https://www.joinfero.app/privacy/` |
| Terms of Use (EULA) | `https://www.joinfero.app/terms/` |
| Support URL | `https://www.joinfero.app/support/` |

All three returned **200** on 6 November 2026.

---

## 2. Where each claim comes from

| Claim | Evidence |
| --- | --- |
| No payment processing | No payment SDK in `package.json`; `ante_core.settlement_transfers` **0 rows**, `ante_core.payment_methods` **0 rows**, both re-checked 6 Nov; of 54 profiles, 53 have a blank `payment_provider` and one is `revolut` |
| Settlement confirmations are on | `ENABLE_SETTLEMENT_CONFIRMATIONS = true`, Production and Preview, checked in Vercel 22 Oct |
| The fake demo cards are off | `ENABLE_SETTLEMENT_CONFIRMATIONS_PREVIEW = false`, same check |
| Only three hosts become links | `ALLOWED_LINK_HOSTS`, `src/lib/paymentLinks.js:105` |
| Only three providers accepted | `SUPPORTED_PAYMENT_PROVIDERS`, `api/lift-log.js:9332` — revolut, paypal, vipps |
| Legal URLs live | `/privacy/`, `/terms/`, `/support/` on `www.joinfero.app` all **200**, 6 Nov |
| Camera / photo wording | `ios/App/App/Info.plist`, quoted as written |
| Push | `aps-environment: production`, `Release.entitlements` |
| No tracking | No `NSUserTrackingUsageDescription`; no analytics SDK |
| Per-activity cap | `CLAUDE.md` §8 and `handover-2026-10-23-per-activity-cap.md` — two of the *same activity* per day since 22 Oct, enforced atomically in the database |
| 72-hour photo deletion | `shouldKeepLogPhoto`, `api/lift-log.js` |

---

## 3. STILL NEEDED before this can be submitted

**Status, 6 November 2026.** Items 1, 2, 3 and 4 are CLOSED; the history of each
is kept below because the reasoning still matters. What is left is item 5 (the
build) plus the four App Store Connect fields listed in §5.

| | |
| --- | --- |
| 1. Review account | **Closed** — `feroappreview@gmail.com`, a member of Sunday Warriors |
| 2. Seeded Bloc | **Closed** — Sunday Warriors, invite `FQ1GXF`, 6 active members, October closed with no fines, November in progress |
| 3. Review video URL | **Closed as not required** — guideline 2.1 asks for a demo account, not a video. §1 says where to add a URL if one is uploaded |
| 4. `support@joinfero.app` receives mail | **Closed 5 November** — see below |
| 5. Build re-cut from `main` | **Open** — the only remaining code-side item |


1. **The review account** — a real email whose inbox is monitored for the
   whole review window. Fero signs in by emailed code, so if that inbox is
   unreachable from Apple's network the review fails at step one. **Not**
   `@local.test`, **not** code `000000`, **not** the Banana Berry fixture.

   **DECIDED 29 October — a dedicated mailbox, not a bypass.** Because Fero has
   no passwords, the reviewer must be able to *read* the code themselves;
   review runs at unpredictable hours over several days, so relaying codes by
   hand is not possible. Two options were weighed:

   | | |
   | --- | --- |
   | **A. A dedicated mailbox** whose address and password go in App Store Connect | **Chosen** |
   | B. A fixed code accepted for that one address | Rejected |

   B was rejected because it means shipping a permanent, deliberate way past
   sign-in: a real hole if the address ever leaks, a thing to explain to
   Apple, and a direct contradiction of this runbook's own line —
   *"No development menu, local OTP bypass, debug identity... is present or
   enabled."* A is no code change, no hole, and the runbook already assumes it:
   *"Store reviewer credentials in App Store Connect and the team password
   manager."* It also survives every future release, which a bypass only does
   by staying in the binary.

   **DONE, 6 November 2026.** The mailbox is `feroappreview@gmail.com`. The
   profile exists in production as display name **Fero Review** and is an
   active member of Sunday Warriors (`left_at` is null), with one November
   workout logged so the account does not read as dormant.

   **TIMING — add it AFTER the 1 November close, not before.** Noticed 30
   October, two days out. Three things collide:

   - Four of the five seeded members miss the target of 12 (Hana 10, Noah 7,
     Eli 4, Leo 2; only Tariq cleared on 14), so the close will produce real
     fines and settlements in this Bloc. **That is a gain** — the runbook asks
     for "a closed-month result/settlement example", and this provides one
     without any further work.
   - A reviewer account joining *now* would be given a small prorated target
     for the two days left and would not meet it, so the close would leave
     **Apple's reviewer owing a fine on their first screen**.
   - After the close, November starts empty. A reviewer landing in November on
     a Bloc seeded only with October activity would see every member on zero
     and an empty leaderboard — an app that looks dead.

   So: create the mailbox now, and on **1 November**, after the close has been
   checked, add the reviewer account and seed a few days of November activity.
   October then sits behind it as a finished month with a settlement example,
   and the current month is alive.
   **The password never comes through chat — it goes straight into App Store
   Connect.**

   **One thing to settle when the address is known:** the dashboard exclusion
   added on 29 October matches `review.%@joinfero.app`. A mailbox on another
   domain will not match it, so that address needs adding to
   `ANALYTICS_EXCLUDED_EMAILS` *and* to the dashboard function, or it will
   count as a real account.
2. **The seeded Bloc** — name, invite route, and realistic non-personal
   members, with the review account already a member.
   **DONE, 6 November 2026**, verified against production:

   | | |
   | --- | --- |
   | Name | Sunday Warriors |
   | Invite code | `FQ1GXF` |
   | Target / penalty | 12 workouts, GBP 10 |
   | Members | 6 active — Tariq, Hana, Noah, Eli, Leo, Fero Review |
   | October 2026 | **closed** 1 November; 14/13/13/12/12 workouts, so all five met the target of 12 |
   | Fines outstanding | **none** — every `settlement_status` on the October season is null |
   | November 2026 | **open**; Tariq 4, Hana 3, Eli 2, Leo 2, Noah 2, Fero Review 1 |

   **One consequence to be aware of, found 6 November:** because nobody missed
   October's target, the settlement controls are **not on screen anywhere in
   this Bloc**. The §1 notes used to promise a reviewer would see them. They
   now describe the mechanic and say plainly that nothing is currently owed,
   and how to produce one. That is the honest version; a reviewer who follows
   the old wording and finds no buttons is the worse outcome.
3. ~~**The review video URL.**~~ **Closed as not required, 6 November.**
   Guideline 2.1 requires a demo account for an app with a login and does not
   ask for a video. §1 carries the one line to add if a URL ever exists.
4. ~~**Confirmation that `support@joinfero.app` receives mail.**~~
   **DONE, 5 November 2026.** Closed end to end, in three parts:
   - The address is a **configured route, not a catch-all**. An SMTP probe of
     `route3.mx.cloudflare.net` returned `250 Ok` for `support@joinfero.app`
     and `550 Address does not exist` for an invented address on the same
     domain. The control case is what makes the first answer meaningful.
   - It forwards to **`fero.support@gmail.com`**, which Cloudflare lists as
     **Verified**. An unverified destination is the silent failure here —
     Cloudflare accepts the mail and then drops it.
   - The founder sent a live test on 5 November and **it arrived in that
     inbox, not in spam.** Forwarded mail is filed as spam more often than
     direct mail, because it reaches Gmail from Cloudflare rather than from
     the original sender, so the folder mattered as much as the arrival.

   Reading the Cloudflare analytics for 4 November: `2 received, 1 delivered,
   1 error` is the SMTP probe above, not a delivery problem — one accepted
   address and one deliberately invalid one.
5. **TestFlight build 12 must be re-cut from `main`.** Found 29 October — see
   below. This is the one that would change what a reviewer sees.

### 3.1 The seeded Bloc needs a decision before it can be built

Checked 29 October, before writing anything.

**The demo Bloc does not help here.** "Sunday Warriors" with Tariq, Hana, Noah,
Eli and Leo (`bf9d4e3`, 20 October) is **sandbox data only** — it exists in
`.sandbox-data/blob.json` and nowhere else. It was staged for screenshots. A
reviewer's device talks to **production**, so it cannot see it.

**So the review Bloc has to be created in the production database.** That is
where the decision is:

1. **Every member needs a real sign-in account.** All **48** production
   profiles have an `auth_user_id`; there is not one account-less profile. So
   seeding five members means creating five real auth users in the live
   project, plus profiles, memberships and a month of workout logs.
2. **They will count in the numbers.** Production currently holds 48 profiles
   and 12 Blocs. Five fake members and a Bloc is a visible fraction of that,
   and `READ-BEFORE-ANALYSING-FERO-NUMBERS.md` already warns how easily these
   counts mislead.
3. **The existing exclusion cannot be reused.** Usage recording skips a member
   via `isFounderDashboardUser` (`api/lift-log.js:6389`), which reads
   `FOUNDER_DASHBOARD_USER_IDS` / `_EMAILS`. That same check **grants founder
   dashboard access** (`:5965`). Adding review accounts to it would hand them
   the founder dashboard. So excluding them needs a **separate** list.

**Recommended shape**, for the founder to accept or change:

- Create the Bloc and its members in production under addresses on a domain he
  controls, so the review account can actually receive its sign-in code.
- Add a new, separate env var for analytics exclusion — deliberately not the
  founder one — and skip those ids in usage recording and the dashboard.
- Keep the Bloc after review rather than deleting it: Apple re-reviews every
  update, and rebuilding it each time is how it goes stale.

**Still needed from the founder either way:** the review account's email
address (item 1 above). The Bloc can be built before it exists and the account
added after, but the runbook requires it to be a member at submission.

### 3.2 The 1 November close is scheduled to be checked

A one-time scheduled task, **`fero-month-close-check-1-nov`**, runs on this Mac
at **08:00 on 1 November** and verifies the close for **every** active Bloc,
not just the review fixture.

**The pre-close snapshot it needs is already captured**
(`migration-output/month-close/before.json`, 30 October): 13 Blocs, 13 open
seasons on `2026-9`, 687 current logs. Without it `--after` refuses to run.

**Two traps were found while setting this up and are handled in the task:**

- `scripts/month-close-check.mjs` **hardcodes `closingKey = "2026-8"`** — the
  September close it was written for. Run bare on 1 November it would compare
  against the wrong month and report confidently. The task passes
  `--month-key 2026-9`.
- Month keys are **zero-indexed**: `2026-9` is October. Checked against all 13
  Blocs, which were all on `2026-9` before the close.

The task also confirms the review Bloc produced **no fines**, and that the
dashboard still reports 48 accounts with the fixture's 64 logs excluded.

### 5, in full: build 12 is 29 commits behind `main`

`claude/testflight-build-12-2026-10-21` was cut on 21 October. `main` has moved
29 commits since, **six of which change app code**:

| Commit | What it changes |
| --- | --- |
| `21f8425` | **The daily cap became two per *activity*, not two per day** |
| `57795b6` | Calendar day badges tell the truth |
| `ca248a2` | **Tapping a calendar day shows the workout instead of starting a delete** |
| `a35d256` | "For you": skeleton on open, and answers that know when they are stale |
| `c4f1543` | Bell and Stream badges match; the comment "···" removed |
| `3c51172` | Four reaction and emoji tweaks |

Two of those matter for review specifically:

- **The cap.** The production database was changed on 23 October to enforce two
  per *activity*. Build 12 carries the **old** client rule, which still thinks
  two per *day*. A reviewer logging a second gym session plus a run would meet
  a client-side limit the server no longer applies. The three places that
  enforce this are documented as needing to agree
  (`handover-2026-10-23-per-activity-cap.md` §3); on build 12 they do not.
- **The calendar tap.** On build 12, a reviewer tapping a day in their own
  calendar gets a **delete confirmation** rather than the workout. That reads
  as a bug.

**So the build must be re-cut from `main` before submission**, not just built
from the existing branch. It needs the Xcode laptop either way.

### Verified already, 29 October — these need no further work

| Check | Result |
| --- | --- |
| Privacy Policy URL public | `https://www.joinfero.app/privacy` → **200** |
| Support URL public | `https://www.joinfero.app/support` → **200** |
| Support page names the contact | `support@joinfero.app` |
| That contact actually receives mail | **yes** — routes to `fero.support@gmail.com` (Verified), live test arrived 5 Nov, not in spam |
| Naming residue in the live bundle (`Firo`, `Anté`, `Ante`, `Lift Log`) | **zero occurrences** |
| PWA manifest name / short name | `Fero` / `Fero` |
| Page title | `Fero` |

### The Terms/EULA URL the runbook asks for now exists

Written and shipped 5 November 2026; the paragraph that used to sit here said
there was no Terms page, which was true then and is not now.

`https://www.joinfero.app/terms/` returns **200** (re-checked 6 November), and
so do `/privacy/` and `/support/`. It matches the other two legal pages
exactly — same stylesheet, wordmark and footer — and both of those now link to
it, so there is no orphan page.

Two things in it bear on the submission:

- It states **"Fero does not process, hold, transfer, collect or refund any
  payment"** in those words, which is the same claim the review notes make.
- It sets the minimum age at **18**, which is why the App Store Connect age
  questionnaire must be answered **18+**. DietBet and HealthyWage, the two
  closest comparables with a money-at-stake mechanic, are both 18+.

---

## 4. The `bank` option — corrected, 6 November 2026

**The entry that used to sit here was wrong and is withdrawn.** It said
`payment_methods.method_type` allowed a `bank` option "stored as free text, so
a member could save bank account details". That is not what the code does, and
the error was repeated out of this file into a conversation with the founder
before it was checked.

What is actually true, each line checked on 6 November:

| Claim | Reality |
| --- | --- |
| "stored as free text" | It is a Postgres **enum**, `ante_core.payment_method_type`, values `revolut, wise, paypal, bank, other`. Free text cannot be stored in it at all |
| "a member could save bank account details" | **No.** The app offers exactly three providers — `PAYMENT_PROVIDERS` in `src/lib/paymentLinks.js` is Revolut, PayPal, Vipps — and the API rejects anything else: `SUPPORTED_PAYMENT_PROVIDERS = new Set(["revolut", "paypal", "vipps"])`, `api/lift-log.js:9332`. There is no UI, and no API path, that accepts `bank` |
| Which tables use the enum | `payment_methods.method_type` and `settlement_transfers.recipient_payment_method_type`. **Both tables hold 0 rows**, and nothing in `api/` writes to either — they are dormant from the canonical-schema plan |
| Where handles really live | `ante_core.profiles.payment_provider` / `payment_handle`. Of 54 profiles, **53 are blank and one is `revolut`** |

**So there is nothing to remove, and the database type is being left alone.**
Dropping a value from a Postgres enum means recreating the type and re-pointing
two live columns at it; the rollback is not one statement. Spending that risk
on a value no code path can produce, in two empty tables, is not a trade worth
making. Apple's privacy questionnaire asks what the app **collects**, and the
app collects no financial data, so the labels are correct as they stand and
this was never a rejection risk.

Two unused enum values, `wise` and `bank`, remain defined and unreachable. That
is a tidy-up for whenever `payment_methods` is actually brought into use, not a
pre-launch task.

---

## 5. What is actually left before submission

Four fields to type into App Store Connect, and one build decision.

| | Where | Value |
| --- | --- | --- |
| 1 | App Information → Privacy Policy URL | `https://www.joinfero.app/privacy/` |
| 2 | App Information → **Terms of Use (EULA)** | `https://www.joinfero.app/terms/` |
| 3 | Age rating questionnaire | answer so it lands on **18+** |
| 4 | App Review Information → Notes, plus Sign-In Information | the §1 block; email `feroappreview@gmail.com`, mailbox password typed straight into Apple, never into a chat |

**The build decision.** Build 12 is uploaded and installed on the founder's
phone. Three changes have landed on `main` since it was cut and are live on the
web app but not in that binary:

- the sign-in email says Fero, not the old product name
- the offline notice turns green and says "Connected" when it recovers, and
  every outage is recorded
- the iOS keyboard accessory bar is removed *(on the branch, not yet merged)*

None of these is a rejection risk. Cutting build 13 is a judgement call about
what the reviewer should see, not a blocker. If build 13 is cut, it must carry
`CURRENT_PROJECT_VERSION = 13` and `main` must be merged into the branch first
— see `docs/build-12-xcode-handoff.md` §7a.
