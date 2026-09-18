# Handover — 2026-09-18: new Solo rules, the Solo sheet, the activity outage, and the App Store audit

**Start here.** Everything in §1 is live in production. §8 is what the next
session picks up.

> **Before anything else:** the shared folder
> `/Users/aadhilsj/Documents/Codex Space/Fero` was left on an old `main`
> (`086c907`), so its copy of this file and every handover is out of date.
> Run `git fetch origin` and read from `origin/main`
> (`git show origin/main:docs/handover-2026-09-18-solo-new-rules.md`), or make
> your own worktree from `origin/main` per `AGENTS.md` §12. Only run
> `git pull` in the shared folder if `git status` there is clean and no other
> agent is working in it. Never switch its branch.

| For | Read |
|---|---|
| The session before this one | `docs/handover-2026-09-18-settings-redesign-and-solo-unlock.md` |
| The founder's Solo decisions | `docs/solo-rules-decisions-2026-09-18.md` |
| App Store work (Codex) | `docs/handover-2026-09-18-app-store-preview-session.md`, including the correction at the top |
| Deveen's open items, 1 October deadline | his handover `docs/handover-2026-09-14-blob-runbook-tasks-1-4-and-log-fixes.md`, §3 and §9–§12 |

---

## Plain-English summary

This session picked up Codex's unfinished Solo work. Solo now gives an automatic
goal of half the Bloc target. Missing it costs the agreed monthly penalty;
reaching it clears the month. A Solo member can never win, and a Solo miss never
raises anyone else's penalty. Tobias (OSI H3) keeps the old rules for September.
The Solo pop-up was then redesigned over four rounds with the founder.

Midway through, the founder noticed every September workout showing as "Sports"
or "Other". The cause was a database function rewritten that morning by the App
Store work. It was fixed in production the same hour. No workout data was lost.

The session ended with an audit of Codex's App Store work. Codex then fixed what
the audit found. App Store readiness is about **55%**.

---

## 1. What went live, in order

All pushed straight to `main` on the founder's word, each deployed and verified
(Vercel success, live bundle containing the change, live page with no console
errors).

| Commit | What |
|---|---|
| `f7356aa` | New Solo rules: automatic half-target goal, a miss pays the agreed penalty, no picker (§2) |
| `789a2e8` | Solo sheet: goal shown as "Half your Bloc's usual 12", one Bloc Admin line |
| `d0ee6e4` | Solo sheet redesign: labelled goal card, intro line, rules as an icon list, approval note last |
| `72124f1` | Solo sheet: Raleway heading, smaller goal card, more spacing (§3) |
| DB, 2026-09-18 | `restore_activity_in_current_logs`, the activity outage fix (§4) |
| `f99d45c` | The same fix saved as a migration on `main` |
| `6a66dff` | Deveen's handover §12 |

---

## 2. The new Solo rules

**Founder decisions (18 Sep):**
- The rules start now, for the rest of September.
- Tobias is the only existing Solo member and stays on the old rules for September.
- The goal is automatic: `ceil(Bloc target × 0.5)`. There is no picker.
- A miss costs the flat base `fineAmount`, even in escalating Blocs, and never
  raises anyone else's escalating fine.
- A Solo member can never be a winner.
- In a month where every regular member misses, a Solo miss is still owed. Who
  receives it is **deliberately undecided**; no payment row is invented.
- Never use gambling language (see memory: no pot, winnings, bets).

**How it works in the code:**
- **The marker.** A new-rules Solo entry is `{ target, rule: "standard_penalty" }`.
  No marker means old rules.
- **From October 2026**, every Solo is on the new rules by month alone
  (`SOLO_STANDARD_PENALTY_FROM = "2026-9"`; month keys are 0-indexed). Only
  September 2026 depends on the marker.
- **Canonical has no rule column.** The marker is carried from the blob through
  every rebuild. Missing any one of these silently reverts a new Solo to the old
  rules:
  - `buildCanonicalWritableStateForGroup`, which runs before every save. Without
    it, the first workout anyone logged would have reverted a new Solo.
  - `fetchReadableCurrentState`
  - `rolloverGroupIfNeeded`
  - `normalizeMonthHistory`
  - `buildCanonicalMonthHistoryForGroup`, which rebuilds a closed month from
    canonical and carries the marker from `blobMonth`
- **The money.** `getStandardSoloMisses` and `addStandardSoloPenalties`,
  mirrored in `api/lift-log.js` and `src/lib/appState.js`. Solo stays out of
  `calcPenalties`; each miss is added afterwards at the flat `fineAmount` and
  split among the regular winners.
- **Used by:**
  - month close (`buildDefaultSettlements`)
  - `buildSettlementMap`
  - `buildSettlementPairsForMonth`, which builds the payment rows
  - MonthPage ("Would owe" and standings)
  - SettlementScreen (Solo miss hero shows "You needed 6")
  - PlayerProfile money totals and the profile Solo note
- **The server sets the goal.** `applySoloRequest` ignores any target the client
  sends, and both approved and instant Solos are written with the marker. The
  sheet computes the same number from `getEffectiveTargetForMonth`.

**Verified:**
- `npm run test:solo-standard-penalty` (13 checks, new), lint, build and every
  script suite.
- Sandbox, real API, 13/13:
  - an instant Solo on day 5 (fake server date)
  - a late request
  - an exceptional request
  - approve, decline and cancel
  - sit-out clashes both ways
  - the marker surviving other members' saves
- A simulated September close with server and browser clocks on 2 October:
  - Sam (3 of 6) owes Riley £10
  - Riley sees "2 to pay"
  - Jo (old rules) owes nothing
- Production, read-only: no pending Solo requests at ship time. So no old-wording
  request could flip onto the new rules when approved.

---

## 3. The Solo sheet (final design, live at `72124f1`)

Top to bottom:
1. **Heading** in Raleway (`DISPLAY_FONT`), like other sheet headings.
2. **Goal card.** A small "YOUR SOLO GOAL" label, "6 workouts" (18px, Raleway),
   and "Half your Bloc's usual 12".
3. **Intro line, on every sheet.** "Solo is for a heavier month — when you still
   want to keep showing up, but need a lighter goal."
4. **Four rules**, each with a small drawn icon (teal for the good ones, muted
   red for the costs):
   - You keep logging as normal.
   - Reach 6 and you're clear.
   - If you fall short, the agreed monthly penalty applies.
   - You can't receive a reward in a Solo month.
5. **Divider**, with 16px each side.
6. **Approval note**, request sheets only:
   - after the 10th: "After the 10th of the month, your request goes to the
     Bloc Admin for approval."
   - second Solo in three months: "Solo is meant for once every three months,
     so this one goes to the Bloc Admin for approval."
7. **Reason box**, 2 rows.
8. **Buttons.**

**Founder copy choices:**
- "half", not "50%"
- "agreed" monthly penalty, not "standard"
- the admin is mentioned once per sheet

**Fit:** the sheet portals to `document.body`. At 375×667 (iPhone SE) the modal's
max height is 547px:

| Sheet | Height at 375×667 |
|---|---|
| After day 10 | 538px |
| Second Solo in three months | 538px |
| Day 1–10 | 488px |

None scroll. If more is added, re-measure at 375×667 first.

**The profile Solo note** reads "Reach it and you're clear. Fall short and you
pay the standard monthly penalty" for new-rules Solo. It still says "standard",
not "agreed". Tobias's old note is unchanged.

---

## 4. The activity outage (fixed)

**What happened:**
- The App Store migration `20260918100000_add_workout_post_moderation` was
  applied to production at 04:06 UTC.
- It rebuilt `public.read_ante_core_current_logs` from a copy older than the
  activity migration, so the `activity` field was dropped.
- Every current-month workout then reached every phone without its activity,
  and showed only its category (feed, calendars, profiles, stats).
- The data itself was intact in both canonical and the blob throughout.

**Fixed:**
- `supabase/migrations/20260918120000_restore_activity_in_current_logs.sql`, the
  live definition plus one line, was applied by Claude on the founder's instruction.
- Verified: 153 of 401 open-month rows return an activity, exactly matching the
  table. Grants are unchanged (`postgres`, `service_role` only).
- The founder confirmed on the live app that everything came back.

**Why it mattered beyond the display:** Deveen's month close reads the same
function. Left broken until 1 October, September would have closed without
activities.

**Rule for everyone:** before replacing a live function, start from
`pg_get_functiondef` in production and diff against it. Never rebuild from an
older migration file. It is now in the App Store handover's working rules and
Deveen's §12.

**Also checked in the same pass:**
- Manz's Basketball and Tennis were correct everywhere. No backfill was needed.
- One old Bloc Stream comment card (Manz, written 14 Sep, before activities
  existed) still says "Sports". It is the stored card payload, not the log.
  Fixable if the founder asks.

---

## 5. The App Store audit (Codex's work)

**Found, and what Codex did about it** (all verified by Claude on GitHub):

| Finding | Status |
|---|---|
| The activity outage above; the bug was still in two files on the App Store branch | Fixed in `557eb0d` (both files now return `activity`) |
| iOS `Info.plist` had no camera or photo-library explanations. The "Take photo" button would crash the iPhone app | Fixed in `557eb0d` |
| 43 commits existed only on the founder's Mac | Pushed; branch at `cbdb813` |
| Private photo links expired after 15 minutes | Now 24 hours, trade-off commented (`cbdb813`) |
| `test:mobile-navigation` failing | A **test** bug, also flaky on `main`: the finger landed above a one-member leaderboard. Fixed; 5/5 passes. Swipe code is back to matching `main` |
| Readiness overstated (77%) | Codex now says 55%, itemised |

**Still open from the audit:**
- **The vertical-drag check was weakened.** Codex replaced it with a static
  "History can scroll" check, but the summary label `leaderboardVerticalScroll`
  still says a drag was tested. On the first TestFlight build, drag up and down
  on the History leaderboard on a real iPhone.
- **Vercel preview access is unconfirmed.** Deveen's §2 Task 4 says
  `SUPABASE_URL` is Production-only, which would stop previews reaching data.
  Nobody has confirmed it in the dashboard. The founder can check: Settings,
  then Environment Variables.
- **The App Store server code is not on `main`.** That covers report, block,
  moderation, `capacitor://` CORS and signed photos. The iOS app calls
  production, so it must be promoted to `main` (founder-approved, tested) before
  submission.
- **Signing every photo on each full state read adds load.** Relevant to
  Deveen's scaling work.

**The founder sent Codex a set of standing notes:**
- start from the live function before any database change
- promote the server code to `main` before submission
- rename the test label and add the real-iPhone scroll check
- tell Deveen about the photo-signing load
- report readiness itemised

**What stands between us and submission:**
- a first archived build installed through TestFlight on a real iPhone
- promoting the App Store server code to `main`
- Deveen's RLS rollout and month-close merge
- launch scaling
- founder items:
  - support email and domain
  - legal pages
  - the account-deletion policy
  - the company or seller entity and the Apple account
  - App Store Connect, the reviewer account and screenshots

---

## 6. For Deveen (already in his handover as §12)

- **His month-close branch** (`origin/blob/month-close-canonical`, `be34784`)
  still merges into today's `main` with no conflicts (`git merge-tree`, nothing
  written). His rebuild keeps `snapshot.solo` and calls `buildDefaultSettlements`,
  so it inherits the new Solo rules. **It still needs to merge before 1 October.**
- **RLS, checked read-only on production:**
  - The seven RLS-disabled `ante_core` tables grant nothing to `anon` or
    `authenticated`, and `anon` has no usage on `ante_core`, so the exposure is
    nil today.
  - Enabling RLS with no policies should not affect the server; it still needs
    his test-copy run.
- **Old tables to clean up.** The `public.lift_log_projection_*` tables grant
  `anon` select and update, but have RLS on with zero policies, so they deny
  everything. They hold stale early data (13 old profiles) and are candidates to
  drop.

---

## 7. Known, not changed

- **The "Furthest behind" card ignores Solo.** It can say "Everyone hit target"
  when a Solo member missed their goal. The founder wants to come back to this
  **before 1 October**.
- **A mid-month joiner can get a Solo goal above their own target.** The goal
  uses the Bloc target, so a joiner with a lower prorated target is affected.
  This is rare.
- **Some money screens were never Solo-aware** (pre-existing):
  - `HistoryPage` money totals
  - `profileStats` "Bloc wins"
  - `getUserMASStreak`
- **The Sit out sheet heading** still uses Outfit, not Raleway.
- **The sandbox starts every joiner on Training Wheels,** which overrides Solo.
  Take members off it before testing Solo money.
- **Tidy-up:** `docs/SCHEMA.md` still does not list `workout_logs.activity`.

---

## 8. What the next session picks up

1. **The "Furthest behind" card and Solo**, before 1 October. Mockup first.
2. **Chase Deveen:** the month-close merge and the RLS rollout (1 October).
3. **App Store (Codex):**
   - the first TestFlight build on a real iPhone
   - the vertical-scroll check on the History leaderboard
   - promoting the server code to `main` when approved
4. **Founder:** confirm the Vercel env scopes. Also the support email, legal
   pages, the account-deletion policy and the seller entity.
5. **Optional:** update the 14 Sep Manz Stream card to Basketball, if the
   founder wants it.

---

## 9. State at handover

| | |
|---|---|
| `main` | this handover's commit, on top of `6a66dff`; production deployed at `72124f1` (later commits are docs and the migration file) |
| App Store branch | `origin/codex/app-store-readiness` at `cbdb813`, Preview only |
| Production database | `restore_activity_in_current_logs` applied; nothing else changed this session |
| Sandbox | stopped by PID; data restored to its seed state |
| This session's worktree | `fero-solo-september` removed after this handover was pushed (its `node_modules` symlink was deleted first; it pointed at `fero-app-store/node_modules`) |
| Untouched | the shared folder `Codex Space/Fero` (still on `main` at `086c907`, behind; not ours to move), `fero-app-store` (Codex), `fero-solo-unlock`, `/private/tmp/fero-settings-request-guards` |
| Deveen's branch | not touched, merged or rebased |
