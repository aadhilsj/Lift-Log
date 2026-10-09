# What's live, right now

**This file is the answer to "what's on the website vs what's on my phone".**
Update it whenever something ships. Same filename forever — never date it, never
fork it. If it disagrees with a handover, this file wins.

Last updated: **9 October 2026** — the website now has the **Profile tab**:
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
| **At commit** | **`bd43b8b`** | `77fe4d8` (build 10) |
| Fifth tab is **Profile** (your photo in the tab, tap it to change it); History is inside Month as **Month \| All Time** | ✅ | ❌ |
| Profile header: photo left, name over the This Bloc / All Blocs buttons; the month is a one-tap pill; the month as a ring | ✅ | ❌ |
| All Time: no heading, three awards, top-3 leaderboard with the full table one tap away; Bloc details half the height | ✅ | ❌ |
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
Both the website and build 10 now open the placeholder. Nothing is built behind
it — see `docs/concept-2026-09-24-notification-centre.md` — so do not infer any
notification-centre scope from the button existing.

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
