# App Review notes — draft, 22 October 2026

Fills the template in `app-store-submission-runbook.md`. **Everything here is
established from the code, the production database or the Vercel environment
and is stated as fact. The four items in §3 are NOT yet known and must be
filled before submission** — the runbook is explicit that this must not be
pasted with placeholders.

---

## 1. The notes themselves

```text
Fero is a private workout-accountability app for invited groups called Blocs.
Members choose a monthly workout target and an accountability penalty. Fero
records workouts, works out the month's result, and records who owes what and
whether it has been settled.

Review video: [URL]

Review account:
- Email: [SUPPLIED IN APP STORE CONNECT]
- Sign-in: Fero has no passwords. You enter an email address and we email a
  six-digit code. The review account's inbox is monitored for the whole review
  window; if a code does not arrive, contact us and we will re-send.

Seeded Bloc:
- Name: [NAME]
- Invite method: [CODE OR LINK]
- The review account is already a member, so no second person is needed to
  evaluate the social features.

Recommended test path:
1. Sign in with the review email and the emailed code.
2. You will land on the seeded Bloc's Today screen: the monthly target, the
   member leaderboard and each member's status.
3. Tap the centre + button to log a workout. The count and your status update
   immediately. A photo is optional.
4. Activity shows the Bloc's recent workouts, with reactions and comments.
5. Month shows the Bloc's progress ring for the current month.
6. Profile shows your own history and a calendar of your workouts.
7. The speech-bubble icon opens the Bloc Stream, a private group chat.
8. The bell opens "For you" — reactions, comments and mentions aimed at you.
9. Profile -> account screen has Privacy, Support, Blocked members, sign out
   and permanent account deletion.

PENALTY AND SETTLEMENT — WHAT THE BUILD ACTUALLY DOES

Fero never holds, transfers, routes or processes money, and there is no
payment provider in the app. There is no in-app purchase, no subscription, no
wagering credit and no pool.

A Bloc agrees a penalty amount among themselves. When a member misses their
monthly target, Fero records that they owe that amount to the other members.
That record is all Fero has.

Settlement confirmations are ENABLED in this build, so you will see:
- "Claim paid"  - the person who owes marks that they have paid, by hand.
- "Confirm"     - the recipient confirms they received it, by hand.
- "Dispute"     - the recipient says they did not.
None of these move money or check anything. They are three people pressing
buttons about something that happened outside the app.

A member may optionally save their own payment handle (for example a
revolut.me or paypal.me link). Where one exists, Fero can show a "Pay" button
that OPENS THAT THIRD-PARTY APP OR PAGE. Fero does not process the payment,
does not see whether it happened, and never changes settlement status as a
result. Only revolut.me, paypal.me and qr.vipps.no are ever turned into a
link; anything else is shown as plain text to copy.

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
- Two workouts per day is a deliberate cap, enforced in the database. It is
  not a bug; Fero rewards consistency rather than single long sessions.
- Workout photos are deleted automatically 72 hours after posting, so older
  entries show an activity icon instead of a picture.
```

---

## 2. Where each claim comes from

| Claim | Evidence |
| --- | --- |
| No payment processing | No payment SDK in `package.json`; `ante_core.settlement_transfers` has **0 rows** on production; `payment_methods` has **0 rows** |
| Settlement confirmations are on | `ENABLE_SETTLEMENT_CONFIRMATIONS = true`, Production and Preview, checked in Vercel 22 Oct |
| The fake demo cards are off | `ENABLE_SETTLEMENT_CONFIRMATIONS_PREVIEW = false`, same check |
| Only three hosts become links | `ALLOWED_LINK_HOSTS`, `src/lib/paymentLinks.js:105` |
| Camera / photo wording | `ios/App/App/Info.plist`, quoted as written |
| Push | `aps-environment: production`, `Release.entitlements` |
| No tracking | No `NSUserTrackingUsageDescription`; no analytics SDK |
| Two-a-day cap | `CLAUDE.md` §8 — deliberate, enforced atomically |
| 72-hour photo deletion | `shouldKeepLogPhoto`, `api/lift-log.js` |

---

## 3. STILL NEEDED before this can be submitted

1. **The review account** — a real email whose inbox is monitored for the
   whole review window. Fero signs in by emailed code, so if that inbox is
   unreachable from Apple's network the review fails at step one. **Not**
   `@local.test`, **not** code `000000`, **not** the Banana Berry fixture.
2. **The seeded Bloc** — name, invite route, and realistic non-personal
   members, with the review account already a member.
3. **The review video URL.**
4. **Confirmation that `support@joinfero.app` receives mail.** Still never
   tested, and it is the contact address in the notes and on the Support page.
   **Partly answered, 29 October:** the domain *can* receive mail — `joinfero.app`
   has Cloudflare Email Routing MX records (`route1/2/3.mx.cloudflare.net`) and
   an SPF record (`v=spf1 include:_spf.mx.cloudflare.net ~all`). What is still
   unknown is whether the **`support@` address specifically** is mapped to a
   destination inbox. That is a Cloudflare Email Routing setting, or a
   one-minute test: send it a mail and see if it lands.
5. **TestFlight build 12 must be re-cut from `main`.** Found 29 October — see
   below. This is the one that would change what a reviewer sees.

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
| Naming residue in the live bundle (`Firo`, `Anté`, `Ante`, `Lift Log`) | **zero occurrences** |
| PWA manifest name / short name | `Fero` / `Fero` |
| Page title | `Fero` |

### One thing that is NOT a blocker, but is on the runbook

The runbook asks for a **Terms/EULA URL**. There is **no Terms page** —
`public/` holds only `privacy` and `support`, and `/terms`, `/eula` and
`/legal` all return 404.

**Nothing links to it**, in the app or on either legal page, so there is no
broken link for a reviewer to find. Apple requires a Privacy Policy URL and
applies its own standard EULA when a custom one is not supplied, so this does
not block submission. Worth a decision rather than a scramble — Fero's penalty
and settlement mechanic is the kind of thing a custom Terms page would cover.

---

## 4. One thing to decide

`payment_methods.method_type` allows a **`bank`** option, stored as free text,
so a member could save bank account details. **Zero rows today.** Either the
privacy labels and Privacy Policy should cover financial handles, or the
`bank` option should be reconsidered before launch. Not changed.
