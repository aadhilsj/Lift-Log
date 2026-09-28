# Handover — iOS header, spacing and nav bar (28 September 2026)

**Pick this up and keep going.** The founder is reviewing Fero on a real iPhone
and in the simulator for the first time, and is iterating on the header. His
feedback is in §3, verbatim in intent. Nothing in §3 has been built yet.

Read `AGENTS.md` first. In particular: he is not a developer, he wants plain
English, one step at a time, and he notices single pixels.

---

## 1. Where things stand right now

| | State |
| --- | --- |
| `main` | `3dd78a4` |
| TestFlight | Build 3 is on his iPhone 14 and works |
| iOS simulator | **iPhone 17, booted, app installed — leave it running** |
| Simulator build | From `/Users/aadhilsj/Documents/FERO/fero-safe-area` (scratch worktree, detached at `8844624` + local edits) |
| Photo privacy, account deletion, App Store copy | Done. See `handover-2026-09-27-photo-privacy-deletion-and-listing.md` |
| Production RLS | Still OFF. Staging ON. Unchanged |
| Email | Resend + custom SMTP just configured by the founder — **verify it** (§5) |

### Do not shut the simulator down
The founder explicitly asked for it to stay open. Build into
`/private/tmp/claude-501/.../scratchpad/dd` or your own derived-data path; do
not stop the device.

### The scratch worktree
`/Users/aadhilsj/Documents/FERO/fero-safe-area` has its own real `node_modules`
(not a symlink — `main` does not list `@capacitor/core`, only the packaging
branch does). It currently carries two uncommitted changes: the `viewport-fit`
fix (now also on `main`) and the header mock-up in §2. Rebuild with:

```
cd /Users/aadhilsj/Documents/FERO/fero-safe-area
npm run build && npx cap sync ios
cd ios/App && xcodebuild -scheme App -configuration Debug -sdk iphonesimulator \
  -destination 'platform=iOS Simulator,id=547363ED-CC0B-41AF-8F9A-A475279B5FDF' \
  -derivedDataPath <your path> build
```

First build is ~9 minutes; incremental is much faster. **The app takes several
seconds to render after launch — a black or white screen immediately after
launching is it still loading, not a failure.** I wasted a chunk of a session
calling that a bug.

---

## 2. What shipped, and the one mock-up in progress

### Shipped to `main` (`3dd78a4`)
`index.html` gained `viewport-fit=cover`. The app already had
`env(safe-area-inset-*)` padding everywhere; without that attribute iOS reports
the insets as 0, so all of it was leaving room for nothing. Confirmed working on
the founder's iPhone 14 — wordmark, Bloc name and icons are now clear of the
notch.

### Mocked, NOT committed (in the scratch worktree only)
`src/pages/Nav.jsx`, mobile header only:

| | Before | Mock |
| --- | --- | --- |
| Icon buttons | 28×28 | 44×44 |
| Glyphs | 18 | 20 |
| Header row height | 44 | 56 |
| Gap between buttons | 4 | 8 |

44pt is Apple's stated minimum tap target
(https://developer.apple.com/design/human-interface-guidelines/layout). Fero was
at 28 — about 60% of the floor. The founder rejected the idea of growing an
invisible hit area under a small icon, correctly: two adjacent hidden targets
would overlap and mis-fire. The buttons must be visibly bigger.

---

## 3. The founder's feedback on that mock — THIS IS THE WORK

All of it is from looking at the simulator on 28 September. Nothing below is
built.

1. **The glyphs are too small inside the new buttons.** The buttons grew, the
   icons did not keep up, so each button reads as mostly empty space. He wants
   the icon to fill much more of the circle, like Strava. Look at the ratio in
   Strava's header and match it rather than picking a number.

2. **A third button is coming.** The notification centre — see
   `docs/concept-2026-09-24-notification-centre.md` (committed alongside this
   handover). It will sit next to chat and settings. **Mock it in now as a
   static, non-functional button** so the spacing is designed for three buttons,
   not two, and is not reworked later.

3. **Too much vertical space between the status bar and the header.** In Strava
   the header icons sit close under the time and battery. Fero's mock leaves a
   visible gap. Tighten it.

4. **The FERO wordmark should be bigger, and higher.** It currently reads as
   sitting below the buttons. There is unused space beside the clock.

5. **The Bloc name should grow too.** With bigger neighbours it now looks small
   and cramped — "Sweat Equity" already sits close to the chat button, and a
   longer name will be worse. There is a character limit on Bloc names; find it
   and design for the longest one.

6. **Position all of this properly.** His words: figure out how to wrap or code
   it so things do not shift. The centre title is currently
   `position:absolute; left:50%; transform:translateX(-50%)` while the
   wordmark and buttons are flex children — so the title can collide with
   either side and nothing pushes back. A three-column layout with a bounded,
   truncating centre would be more robust than the current absolute centring.

7. **The bottom nav sits too high, and content shows beneath it.** He called it
   glitchy and broken. **This is a regression from my own `viewport-fit` fix**
   — see §4.

---

## 4. The bottom nav regression — diagnosed, not fixed

`src/styles/app.css`:

```
.mobile-bottom-nav { position:fixed; ... bottom:calc(23px + env(safe-area-inset-bottom)); }
```

Those literal offsets were tuned while the insets resolved to **0**. Now that
`viewport-fit=cover` is live, `env(safe-area-inset-bottom)` is a real ~34pt on
these phones, so the bar floats at ~57pt and content scrolls visible underneath.

The same applies to the three places using
`calc(108px + env(safe-area-inset-bottom))` — `app.css:132`, `app.css:143`, and
`src/App.jsx:3310` — which now over-pad.

**Do not just delete the insets.** The right fix is to re-tune the literal
part now that the inset is real, so the bar sits just above the home indicator
the way Strava's and Instagram's do, with content ending cleanly behind it.
Check every screen that scrolls: Today, Activity, Month, History, and the
in-Bloc profile layer (`app.css:143`).

---

## 5. Email — just set up, needs verifying

The founder hit "Unable to send code" on TestFlight build 1. Two causes, both
now fixed: the API had no CORS (`0bab15f`) so the app could never reach the
backend at all, and Supabase's built-in email is a testing-only service at
roughly 2 messages an hour that mostly lands in spam.

He has now, in the dashboard:
- created a Resend account, added `joinfero.app`, auto-configured DNS through
  Cloudflare (verified from outside: sending MX, SPF and DKIM are live on
  `send.joinfero.app`, and the root MX/SPF for `support@joinfero.app` are
  **untouched**);
- created a sending API key;
- enabled custom SMTP in Supabase: `smtp.resend.com`, port 465, user `resend`,
  sender `no-reply@joinfero.app`, name `Fero`.

**Nobody has yet confirmed a real code arrives from the new sender.** Have him
request one and check the From address. If it fails, check the Resend domain has
gone green, then look at Supabase auth logs:

```sql
select timestamp, log_attributes['path'], log_attributes['status'], log_attributes['error']
from logs where source='auth_logs' and log_attributes['path'] like '%otp%'
order by timestamp desc limit 10
```

A `/otp` with status 200 means Supabase accepted and sent it — the problem is
then delivery, not the app.

---

## 6. Rules that will bite you

- **Claude runs the Supabase SQL now**, including production (AGENTS.md §4,
  changed 27 Sep). Say what you are about to run, or report it immediately
  after. Never silently.
- **Fero ships mobile only.** Do not mirror header changes into the desktop
  layout. `Nav.jsx:69` is the desktop header — leave it alone.
- **Verify against the running app, not a checklist.** Photo signing shipped
  with two broken surfaces because coverage was checked against a review prompt
  instead of the app. The app has six photo surfaces; the same discipline
  applies to layout — check every screen, not the one you changed.
- **Verify legal-facing claims against production, not the repo.** Three public
  pages have described what the code intended rather than what was deployed.
- The founder is watching token spend. Be brief, and stop chasing a dead end
  once you notice you are debugging your own environment.

---

## 7. Still open elsewhere

- **Production RLS.** Migration verified on staging, reasoning checked against
  production, never applied. Do it **after** the 1 October month close.
- **Apple Developer enrolment** — founder.
- **Orphaned profile photos** — replacing a photo leaves the old file behind. 5
  in production. Claude's, after submission.
- **Reported photos can outlive the 72-hour sweep** — needs a founder decision.
- **Notifications do not exist at all.** No APNs, no permission request, no
  token storage. Concept doc only. Should not block a build.
