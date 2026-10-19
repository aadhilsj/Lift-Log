# What's live, right now

**This file is the answer to "what's on the website vs what's on my phone".**
Update it whenever something ships. Same filename forever — never date it, never
fork it. If it disagrees with a handover, this file wins.

Last updated: **19 October 2026** — a **skipped Bloc is no longer shown an
empty month**, at `1c23241` (merged `75400bd`). When a Bloc's month close is
skipped, the canonical side opens the new season while the blob correctly keeps
the old month. Until this fix, the read path saw canonical as ahead and
replaced the Bloc's real logs with the new month's empty ones, and reported the
new month as current — so members of a skipped Bloc were shown a wiped month.
That is the "StavanGang looked like it had reset" symptom. The read path now
overlays only when canonical and the blob are on the **same** month. The blob
was never corrupted by this; only what members were shown.

It also means a skipped Bloc **looks** skipped rather than looking rolled over,
so the fault is visible instead of showing only on the founder dashboard.

Also on 18 October: `npm run test:month-close-canonical` now pins the
**1 October shape** — fed the closing month's logs it freezes with the closing
month's counts; fed the new month's empty logs it refuses and names the month
it could not verify. Five cases in total, including the skipped-Bloc window and
a year boundary. Nothing in CI covered this before.

**Verified live at `99de67f`:** Production deployment of 19 October 10:28 UTC
state `success`; the live site returns HTTP 200 and loads with no console
errors. Both changes are **API and test-script side**, not the client bundle,
so there is no bundle string to grep for them.

**Not verified:** the fix has never been exercised against a Bloc that really
skipped its close. **1 November** is the first full month close since it
landed, and the order for that morning is the founder dashboard first, then
`scripts/month-close-check.mjs --after`, then `npm run parity:gate`.

Before that, at `2b54000`: the **newest emoji badges the row**. A reaction row
in "For you" is badged with the emoji used **most
recently**, not the one the most people chose. Two people pressing 💪 no longer
drown out the 🔥 that came after them. Where that cannot be worked out — an
older server, or canonical out of reach — it falls back to the emoji the most
people chose, exactly as before, and a workout with no reactions still produces
no row.

**Verified live at `2b54000`:** Production deployment `7121675219` success; the
live bundle `index-DFG4EIT-.js` carries `latestReaction`; the live site loads
with no console errors.

> **Both canonical log readers changed in production on 16 October:**
> `read_ante_core_current_logs` and `read_ante_core_logs_for_month` now also
> return `latest_reaction` — one emoji and its timestamp, beside the existing
> `reactions`, which is byte-for-byte unchanged. One extra subquery per log on
> the primary key's leading column, on a 1,919-row table, so it is not a
> read-volume concern. Read-only; `anon` and `authenticated` cannot execute
> either. Rollback is the two `create or replace` statements without that key.

Before that, at `5ebd5f5`:
A row names the **activity** you logged ("your Padel Log"), not the category —
every racket and ball sport used to read "your Sports Log", and Sports has not
been loggable for a long time. **Your own comments are not counted**: a reply
of your own on your own workout is not news to you, and a log whose only
comments are yours shows no row at all. Rows **expire after five weeks**, money
excepted — a debt is still a debt. Tapping a **mention** now lands on that
message in the Stream and gives it a brief glimmer.

Before that, at `a6280a3`:
"For you" is a full screen, and a row now reads **who, then what, then which
workout**: the member's face badged with the emoji they used, what they said,
and the workout's own photo on the right while it still exists — photos are
deleted after 72 hours, so the activity icon is the normal case.

It covers **reactions, comments and Stream mentions**. A comment row says who
wrote the newest comment and quotes a line of it ("Sam and 2 others
commented…"), and **opens the comment thread**. A mention quotes the message
and opens the Stream. Rows are grouped **Today / This week / Earlier**.

Money sits at the top in both directions, under a heading that depends on what
is there: **"Needs you"** when all you have is something to pay, **"Settling
up"** as soon as anything is owed to you. Only money you owe keeps the bell
lit.

**Verified live at `5ebd5f5`:** Production deployment `7109481996` success;
the live bundle `index-DraxXqb-.js` carries the glimmer's outline, the
`your ${activity} Log` template and the five-week threshold, and no longer
contains "your Sports Log"; CI green; the live site loads with no console
errors.

> **Two database functions applied to production on 16 October:**
> `read_ante_core_workout_log_latest_comments` — the newest comment for a set
> of logs in one call, then replaced the same day to **leave out the viewer's
> own comments**. Read-only; `anon` and `authenticated` cannot execute it.
> Rollback is a single `drop function`. The comment text and the mentions are
> fetched **only when the centre is opened**, two batched calls, so this screen
> adds nothing to the per-refresh read volume.

**Still not built:** @mentions inside a comment thread.

**Not verified:** the newest-emoji badge has only been seen against a sandbox
fixture, never against a real reaction timestamp on live data.

**Verified live at `a6280a3`:** Production deployment `7109250746` success; the
live bundle `index-OVZJQPmf.js` contains "mentioned you in the Bloc Stream",
`log-latest-comments` and the bundling copy; CI green; the live site loads with
no console errors. **Not yet opened against live data or on a real iPhone**,
and the new function's results have never been drawn from real comments.

Before that, on 16 October at `5f86d45`.
"For you" is a **full screen**, in the app's own background, and a bug it
shipped with on its first deploy is fixed: after opening the centre and tapping
a row, every tab — Today, Activity and Month — sat about **62px below its own
top** and would not scroll back up, because `scrollIntoView` had scrolled the
in-Bloc shell (`height:100dvh; overflow:hidden`, still programmatically
scrollable) and nothing put it back. The same trap as the sideways displacement
fixed in `ebf9de5`, one level further up the tree. The feed now scrolls its own
page container by hand and touches nothing above it.
It has opened a box saying "Notifications are coming soon" since it was wired
up; it now opens **"For you"**: who reacted to your own workouts, how many
comments they got, and money you owe or are owed. A count sits on the bell and
clears when you open the panel — except money you owe, which stays. Tapping a
row takes you to that workout in the Activity feed, which scrolls to it and
glows it for a moment.

Three things it does **not** do, and all three have been asked for:
a comment row lands on the workout rather than on the comment thread; it cannot
say **who** commented (the API can tell it — `log-comments-list` — but it must
be batched); and it does not know about **@mentions** in the Bloc Stream (the
mentions are already stored on the message, so this is reachable too).

**The settlement-note prompt is deliberately not in it.** The version on
`feat/settlement-note` stores that note in `localStorage` only, so nobody else
in the Bloc would ever see it, while the row says "Your Bloc will see it". It
needs a real save first.

"Seen" is **per browser**, not per person: Fero still has no server-side read
state, so the count does not follow you between devices and resets if site data
is cleared.

**Verified live at `5f86d45`:** Production deployment `7108771686` success;
the live bundle `index-DD4tOGBK.js` carries the app's own background token and
the page-container scroll, and **contains no `scrollIntoView` at all**; CI
green; the live site loads with no console errors.

**Verified live at `a6d7bab`, the first deploy:** Production deployment `7108411190` success;
live bundle `index-CGGcHe4P.js` contains "For you", "Needs you" and
`fero_notifications_seen_v1`, and no longer contains "Notifications are coming
soon"; CI green; the live site loads with no console errors. **Not yet opened
against live data or on a real iPhone.** Details:
`docs/handover-2026-10-15-session-catch-up.md`.

Before that, on 15 October 2026 — a page can no longer be **left sitting off
to one side**, at `ebf9de5`. Tapping a member's slice on the Month ring used to
push the whole page about 149px to the left and strand it there; it read as a
blank screen. The four in-Bloc pages live side by side in one track four
screens wide, and a hidden overflow is still scrollable, so focusing a button
let the browser scroll the track — while the swipe code, which moves pages with
transforms, never knew. The track now refuses to scroll. This was never only
the Month ring: any focusable thing near the edge of any of the four pages
could do it.

Before that, on 15 October, the **profile header became a card**, at
`abc568f`. 

Before that, on 12 October, **blocking and reporting went live**.

> **One regression, shipped and fixed the same day.** The blocking work blanked
> the Bloc Stream for any Bloc that had messages (an empty Stream was fine,
> which is why the sandbox check missed it). Fixed in `58c713c` and verified in
> the live bundle. Vercel did not auto-deploy that commit and it is not yet
> known whether automatic deploys have recovered — check before relying on a
> push going live.
 You can report a member or their content, and block a
member, from the four places that show other people's content: the Activity
Feed, the Bloc Stream, a comment thread and a member's profile. Every one of
those pop-ups is centred, not a bottom sheet. Blocked people are listed under
**Safety -> Blocked** on the account screen, where a block can be undone.
Reports reach a queue on the founder dashboard. Blocking is **one-way for
seeing** — you stop seeing them, they carry on seeing you, because a Bloc
shares one leaderboard — but a server-side guard stops a blocked member
commenting on or reacting to the blocker's workouts. This covers Apple
guideline 1.2, which needs a filter, reporting, blocking and published contact
details before an app with user content can ship.

> **Block and report persistence is proven — on `fero-staging`, not production.**
> A real block and a real report were written, read back both ways, guard-railed
> and undone against a full practice copy of the data, then cleaned up. Staging
> is back to zero and production was never written to. What is still unproven is
> the API path joining the app to those functions in one run.

Also on 12 October: the **Profile tab, Month and All Time can delete your own
workout** from their calendars. Until now only the profile reached from Today
could; everywhere else the tap silently opened the read-only workout detail
popup instead. Reported by a member. And the **Privacy and Support pages
describe blocking again**, having had every mention stripped on 10 October when
the feature did not exist. Details:
`docs/handover-2026-10-11-blocking-migration-session-2.md`.

TestFlight remains on build 10, so **none of this is on the phone app**.

Before that, on 10 October 2026 — **the Privacy Policy and Support pages are
live** at `joinfero.app/privacy` and `joinfero.app/support` (and on
`lift-log-nu.vercel.app`), with and without a trailing slash. They had been 404
since they were written on 27 September, because they were never merged to
`main`. Four claims were corrected first: the Support page's account-deletion
directions pointed at a screen that has no delete button, both pages promised
member blocking that does not exist outside the unmerged
`codex/app-store-readiness` branch, reporting was described more broadly than
the app allows, and the pages asked for a typeface the app never loads. These
are static pages; the app is untouched, so there is nothing here for TestFlight
to catch up on. Details: `docs/handover-2026-10-10-legal-pages-publish.md`.

> **`support@joinfero.app` is unconfirmed.** Both pages name it as the only
> support channel, and nobody has verified that mail sent there arrives in a
> mailbox someone reads. No test email was sent.

Before that, on 10 October, the website's **All Time** leaderboard and
member-name awards now show only people who currently belong to that Bloc.
Former members' workout history, month totals, and activity mix are preserved.
Abhishek has left Go To Da Gym and Aki Jain 2000 has left Ctrl Alt De-feat;
their workout records remain, and no removal message was posted to either
stream. TestFlight remains on build 10, so this website change is **not on the
phone app yet**. Details: `docs/handover-2026-10-10-all-time-members.md`.

Before that, on 9 October 2026, the website gained the **Profile tab**:
the fifth tab is your own profile in the Bloc, and History moved inside Month
as a **Month | All Time** toggle. Before that, 2 October's Today redesign,
reordered ended-month screen, centred pop-ups and new share stickers are live.
TestFlight remains on build 10, so **none of October's work is on the phone app
yet**. Details: `docs/handover-2026-10-09-session-catch-up.md` and
`docs/handover-2026-10-01-session-laptop-sync.md`.

> **Emoji sheet: no bottom band.** The 30 September review predicted one in
> the installed iOS PWA; the founder checked on his phone on 1 October and the
> sheet is fine. See `docs/handover-2026-10-01-session-laptop-sync.md` §2.2.

> **The native build is the product now.** Decided 30 September: TestFlight is
> what goes to the App Store, and the PWA is where members happen to be today.
> Where the web cannot do something, build it for native rather than scoping it
> down. See "Where the two builds diverge" below. This **reverses the intent**
> of the old "no deliberate fork" note — but not the mechanism. Still one
> codebase; native-only behaviour is a runtime gate, never a branch.

---

## The three places

| | Website (PWA) | TestFlight (phone) |
| --- | --- | --- |
| **At commit** | **`5ebd5f5`** | `77fe4d8` (build 10) |
| The bell opens "For you" — full screen: reactions, comments (with the text), Stream mentions and money; rows expire at five weeks | ✅ | ❌ |
| A page can no longer be scrolled off to one side (the stuck Month ring) | ✅ | ❌ |
| Profile header is a card; back is a chevron in the Bloc header; the `...` in the card corner; the net figure on the workout counter | ✅ | ❌ |
| Report and Block on the activity feed, Bloc Stream, comments and member profiles; Blocked list on the account screen; report queue on the founder dashboard | ✅ | ❌ |
| Press and hold a workout or a Stream message for its menu, instead of a `...` | ✅ | ❌ |
| Your own workout deletes from the Profile tab, Month and All Time calendars, not only from Today | ✅ | ❌ |
| Privacy Policy and Support pages at `/privacy` and `/support` | ✅ | n/a — web pages, not part of the app |
| Fifth tab is **Profile** (your photo in the tab, tap it to change it); History is inside Month as **Month \| All Time** | ✅ | ❌ |
| Profile header: photo left, name over the This Bloc / All Blocs buttons; the month is a one-tap pill; the month as a ring | ✅ | ❌ |
| All Time: no heading, three awards, top-3 leaderboard with the full table one tap away; Bloc details half the height | ✅ | ❌ |
| All Time: current members only in the leaderboard and member-name awards; historical totals remain | ✅ | ❌ |
| In a Bloc, the account screen opens from anywhere (it used to render only inside an open comment thread) | ✅ | ❌ |
| Today: "N to go" / "Week's MVP" pills replace the four stat cards; silver "Your September Recap" banner | ✅ | ❌ |
| Ended month: Recap → result card → calendar + "Share your month" → awards → Bloc ring → records → money | ✅ | ❌ |
| Ended month: brighter result colours, periwinkle Sat out, a mark when no money moved | ✅ | ❌ |
| A missed month can share; a sat-out month shows no calendar | ✅ | ❌ |
| Pop-ups (Your Log, Week's MVP, log a workout, share sheet) centred in the visible screen | ✅ **unverified on an iPhone** | ❌ |
| Share stickers: navy icon outline, "SESSIONS", bigger month | ✅ | ❌ |
| Month close reads the closing month (`c9ce86a`), money fixes (`cc6c990`, `9b25e74`) | ✅ | ❌ |
| Member profiles stay fixed and scroll from Today and History | ✅ | ❌ |
| Rebuilt header, safe area, motion, haptics | ✅ | ✅ |
| Comment load failure is honest | ✅ | ✅ |
| Reaction picker stays on screen | ✅ | ✅ |
| Bell opens "coming soon" | ✅ | ✅ |
| Nav lift at 30ms | ✅ | ✅ |
| Tab colour changes at finger release | ✅ | ✅ |
| Android Today-scroll fix | ✅ **unverified on a device** | ✅ |
| Band at the bottom of the Stream | ✅ fixed | n/a — never had it |
| Composer dead space removed | ✅ | n/a — native keeps its inset |
| Bloc entry builds one screen, not four | ✅ | ❌ |
| Swipe: outgoing fades, arriving is solid | ✅ | ❌ |
| Swipe: no jump-start at the gesture lock | ✅ | ❌ |
| Same five reactions on all three surfaces | ✅ | ❌ |
| Emoji "more" sheet — search, categories, recents | ✅ checked on the founder's phone 1 Oct | ❌ |
| Month no longer remounts on tab navigation | ✅ | ❌ |

**Build 10 caught the phone up to `77fe4d8`.** The eleven commits after it are
website-only; one merge and a build 11 closes the gap again. The emoji-sheet
blocker on build 11 is lifted: the founder found no band on his phone
(1 October).

### Verified live, 9 October

Checked the same three ways — the commit on `main`, a successful Vercel
Production deployment for that exact commit, and the change in the live
bundle — and the live site loaded with no console errors.

- `bd43b8b` — a little more air around the photo in the nav: 16px in an 18px
  row, clearance above it 1.8px → 2.9px. Production deployment `6964931526`
  success; live bundle `index-K1ol78pl.js`.
- `8649e93` — two things the founder found on his phone: the Profile tab's
  ringed photo no longer breaks out of the highlight behind it (it was 20px
  where every other tab icon is 18), and swiping on the Profile tab now moves
  between tabs (the profile's own back-swipe handler was swallowing every
  touch). Production deployment `6964749451` success; live bundle
  `index-vQlxAXGb.js`.
- `22ea440` — the Profile tab, History inside Month as All Time, the smaller
  Bloc details card, and the in-Bloc account screen fix. Production deployment
  `6964278301` success; CI green; live bundle `index-Rgy-apHa.js` contains
  "See full leaderboard", "Account settings", "Months active" and
  "workouts logged".

**Not seen against live data.** It was driven end to end in the sandbox at
393×812 — every state the practice data allowed — but nobody has opened the
Profile tab on the live site or on a real iPhone yet. Swiping between tabs was
not exercised either: the test browser sends mouse events, not touch.

### Verified live, 15 October — the displaced page

- `ebf9de5` — the in-Bloc page track refuses to scroll. Production deployment
  success for that commit; CI green; the live bundle `index-DIhYQ_rD.js`
  contains the guard (`scrollLeft!==0&&(…scrollLeft=0)`); the live site loads
  with no console errors.
- Proven in the sandbox **with the fix in and stashed back out**, same build,
  same screen: a direct scroll, `scrollIntoView` and `focus()` each left the
  page displaced without it (−200px on the direct scroll) and each snaps back
  to 0 with it. Tapping a slice still opens that member's month.

### Verified live, 15 October

Checked the same three ways — the commit on `main`, a successful Vercel
Production deployment for that exact commit, and the change in the live
bundle — and the live site loaded with no console errors.

- `abc568f` — the profile header card, back in the Bloc header, the net figure
  on the workout counter, the bigger month chevrons. Production deployment
  success for `abc568f`; CI green; live bundle `index-Dnfseo20.js` contains
  `profileBack` and `translateY(-2.25px)`, and no longer contains "Net in this
  Bloc", "Perfect months" or "Months won".

**Driven end to end in the sandbox before it shipped**, at 393x852 and at
375x667 (iPhone SE): the chevron appears and the Bloc name returns on the
Today, Month and All Time routes and on the way back out; the Profile tab keeps
the Bloc name; tapping another tab with a profile open restores the header; a
24-character name wraps to two lines and clears the `...` by 24px; no
horizontal scroll at either width. Lint, build and 24 of 26 suites clean — the
two failures are `test:auth-edge-flows` and `test:mobile-navigation`, which
fail on `main` too.

**Not seen against live data, and not on a real iPhone.** Nobody has opened
this on the live site or on a phone yet.

### Verified live, 10 October

- `d5781a4` — former Bloc members no longer appear in the All-Time leaderboard
  or member-name awards; historical totals and activity mix still include
  history. Production deployment `dpl_3NxgUt8ZxWNKb8gvdrjypsRiigjf` is READY
  and aliases to `joinfero.app` and `lift-log-nu.vercel.app`. The live bundle
  contains the current-member filter.
- Production member records: Abhishek left Go To Da Gym and Aki Jain 2000
  (`akijain2000` in the app) left Ctrl Alt De-feat. Backup `2983` was saved
  first. Their 73 and 8 workouts remain. No removal stream message was added.

### Verified live, 1–2 October

Each checked the same three ways — commit on `main`, a successful Vercel
Production deployment for that exact commit, the change in the live bundle —
and the live site loaded with no console errors.

- `689d9d9` — the two calendar-dependent test suites pinned (no app change)
- `5a84359` — share stickers: navy outline (Grid/Bare), SESSIONS, month 18
- `473c761` — Today redesign, ended-month redesign, centred pop-ups, share
  sheet; live bundle `index-BLGC5dOj.js` contains "Share your month",
  "Week's MVP:", "See how you and your Bloc did" and "Month Off"

The founder tested the Today and ended-month work on his own phone through
the sandbox over wifi before it shipped. **The pop-up centring has not been
seen on a real iPhone against live data** — it follows the playbook's
portal rule, measured in Chromium.

### Verified live, 29 September

Each deploy checked three ways — commit on `main`, a Ready Vercel Production
deployment for that exact commit, and the change present in the live bundle:

- `534fd11` — nav lift 30ms, easing `cubic-bezier(.3,1,.4,1)`
- `76770cc` — `--tab-ink` in both the JS and the CSS, and
  `html{background:var(--bg-primary)}` in the CSS
- `b43d70f` — Android Today-scroll fix

Aadhil confirmed the feel on his PWA: *"so much nicer... the swiping moves so
much quicker."*

### Verified live, 30 September

Same three checks each time. All six confirmed by Aadhil on his installed PWA.

- `ebb80be` — the bottom band painted the composer's colour, `#05090a`
- `06564c4` — composer safe-area inset dropped in the installed PWA; 109px of
  dead space under the field became 75px
- `058ff76` — entering a Bloc paints one screen, not four
- `559df0a` — the outgoing screen fades to zero on its own faster curve
- `bc952e6` — only the screen being left fades; the arriving one stays solid
- `35daf06` — a page is demoted off its compositing layer only once hidden
- `c219023` — the swipe tracks from the lock point, and the incoming screen is
  revealed without waiting for React

His words on the result: *"much, much, much better"*, then *"quite happy with
it now"*.

Then the shared emoji picker, five more Production deploys:

- `4c4b6f2` — one reaction set `🦍 🔥 ❤️ 💪 🏃` on all three surfaces, a shared
  "more" sheet portalled to `document.body`, `QUICK_REACTS` deleted
- `47a63f5`, `5eb5be3`, `baeb722`, `d577d78` — search, height and skin-tone
  follow-ups
- `66943f0` — `MonthPage` no longer remounts on tab navigation

The five were picked from production usage, not taste: 🦍 is the most-used
reaction in Fero at 582 uses by 20 people, and the Stream did not offer it at
all. Dropped from the quick row into the sheet: 👀 (99 uses), 😤, 😂, 👏.

Adds one dependency, `emojibase-data` v17 (MIT), lazy-loaded as a separate
~666 kB chunk. Initial bundle 1,017.97 → 1,025.23 kB.

**Two reaction paths are unverified against a real backend.** Comment and
Stream reactions were exercised with browser response fixtures because the
sandbox returned empty canonical records; only the Activity-feed path hit a
real API.

**One of these is a hypothesis, not a reproduction.** `35daf06` fixes a
compositing repaint that never reproduced in Chromium; the frame trace pointed
at it. If a flash ever returns on the phone, revert that one commit first — it
is self-contained.

### ⚠️ One thing shipped unverified

The Android Today-scroll fix (`b43d70f`) is live and **has not been tested on any
device, Android or iOS**. Nobody in the loop has an Android phone. It shipped
because the risk is asymmetric — the change can only make the back-swipe harder
to trigger and scrolling easier, never the reverse.

**Two confirmations are still owed:**
1. Aadhil, on iOS: does the left-edge back-swipe out of a Bloc still work?
2. An Android member who reported it: does Today scroll now?

## Why the two kept drifting — and what closed it

All of September's app work went to the app branch and was never merged back.
`main` is the website; Codex builds the phone app from his own branch. Nobody
did anything wrong — the work simply never travelled back.

**Closed 30 September.** `main` was merged into the app lineage on branch
`testflight-build-10` (`77fe4d8`), which became build 10. All 22 conflicts were
resolved to main's side: they were the same work arriving from two lineages,
with main holding the newer version. Nothing native was lost.

It will drift again, because the website keeps shipping. The fix is not "one
merge, permanently" — it is **merge `main` into the app branch before every
build**, and resolve shared UI to main's side.

---

## Two platform questions, settled

### Haptics on the website — nothing to do

`src/lib/haptics.js` returns immediately unless
`Capacitor.isNativePlatform()`. On the web every buzz is already a silent no-op,
by design. There is nothing to strip out before shipping to the PWA.

### The top area on the website — nothing to fear

`index.html` already sets `viewport-fit=cover`,
`apple-mobile-web-app-capable: yes` and
`apple-mobile-web-app-status-bar-style: black-translucent`. **Added to the home
screen, the PWA gets the same top space as the native app.** In a Safari tab it
does not, because Safari's own chrome is there.

The header padding handles both without a branch:

| | `main` today | Claude's branch |
| --- | --- | --- |
| rule | `padding-top: env(safe-area-inset-top)` | `padding-top: max(0px, calc(env(safe-area-inset-top) - 13px))` |
| Safari tab (inset 0) | `0` | `max(0, -13)` = **`0`** |
| Installed / native (inset ~47-59) | 47-59 | 34-46 |

**Identical in a Safari tab.** The 13px pull-up only claims space that exists.

### So: one codebase, but the native build leads

**Updated 30 September.** The old note here said "no deliberate fork" and was
read as "scope every feature down to what the PWA can do". That is no longer the
intent. The App Store build is the product; a web limitation is a reason to
build the feature **for native**, not a reason to drop it.

What has not changed is the **mechanism**. Still one codebase. Native-only
behaviour is a **runtime gate** — the `Capacitor.isNativePlatform()` pattern
`src/lib/haptics.js` already uses, where every buzz is a silent no-op on the
web — and never a separate branch or a duplicated component. Divergence across
branches is exactly what re-broke swipe and reaction behaviour after merges, and
this playbook is full of it. A gate gives the same result without that cost.

---

## Where the two builds diverge

The register. Add a row whenever something lands on one platform and not the
other, and say which mechanism holds it apart.

| | Web (PWA) | Native (App Store) | How it is held apart |
| --- | --- | --- | --- |
| Haptics | silent no-op | real | `Capacitor.isNativePlatform()` in `src/lib/haptics.js` |
| Push notifications | **impossible** | planned, not built | no APNs key yet; permission moment is Aadhil's call |
| Composer safe-area inset | dropped | kept | installed PWA has an unreachable strip that already clears the home indicator; native has no strip |
| Canvas painted under the Stream | needed | harmless no-op | the strip only exists in an installed PWA |

**Not on this list, and a common mistake:** the emoji picker. iOS exposes no API
to open the system emoji picker to *any* app — native or web. The keyboard only
appears for a focused text field and the person taps the globe key themselves.
So a custom sheet has to be built either way, and it works on both. Going
native-only there would buy nothing and cost a fork.

---

## The dead bell — resolved

**Closed 30 September.** The bell was a mock with no tap handler,
`aria-hidden="true"` and `tabIndex:-1`, and this file warned that merging it
as-is would put a dead button in front of every member.

It did not happen. `main` had already wired it to a "coming soon" destination,
and the build-10 merge resolved that conflict in main's favour deliberately.

**Superseded on 16 October:** the placeholder is gone from the website. The
bell now opens the real notification centre (`a6d7bab`, top of this file).
**Build 10 still shows the "coming soon" box**, because it predates all of it.

---

## TestFlight vs the App Store

**A TestFlight install and an App Store install are separate downloads.** When
Fero reaches the App Store, testers must go and get it from there; their data
carries over (same app underneath), but it is a second trip. TestFlight builds
also expire after 90 days.

**Decision (29 Sep): do not move members onto TestFlight.** They stay on the
PWA, which works and which they already use, and they move once, to the App
Store. TestFlight stays for Aadhil and a small number of testers.

Revisit only if App Store review drags. First submissions are often rejected and
review can take days to weeks.

---

## How to check this yourself

```bash
# what the website is running
git fetch && git log --oneline -1 origin/main
curl -s https://lift-log-nu.vercel.app | grep -oE '/assets/index-[A-Za-z0-9_-]+\.js'

# is a given commit on the website?
git merge-base --is-ancestor <sha> origin/main && echo yes || echo no
```

Merged is not live: a commit on `main` still needs a Ready Vercel **Production**
deployment for that exact commit, and the change visible in the live bundle.
Check all three before believing it.
