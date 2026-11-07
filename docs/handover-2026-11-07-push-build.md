# 7 November 2026 — building push, step one

Design is finished and signed off; this is the implementation session. The
design lives in
[`push-notification-design-2026-11-06.md`](push-notification-design-2026-11-06.md)
(§2E–§2I carry the founder's decisions) and the founder's own copy review is
the Claude doc linked from §23 of
[`handover-2026-11-05-build-12-merge.md`](handover-2026-11-05-build-12-merge.md).

**Release route for this session: straight to `main`**, his answer when asked.

**Worktree:** `/Users/opera_user/Developer/FERO/push-2026-11-07` on branch
`claude/push-notifications-2026-11-07`. Not the shared folder — Codex is in it.

---

## The standing constraint he set before any code was written

He asked: *"none of these affect the app ui right?"*

Agreed and recorded: **everything in this session is invisible.** Two items
later in the build DO add UI — the permission card and the per-type switches —
and both get a mockup and his approval before they are built. Nothing visible
ships without him seeing it first.

---

## 1. `ante_core.profiles.time_zone` — applied to production

**Migration:** `supabase/migrations/20261107010000_member_time_zone.sql`

Fero stored a time zone on `blocs` and `seasons` and **never on a person**.
Production: 11 Blocs `Europe/Oslo`, 1 `Europe/Berlin`, 1 `Asia/Colombo`. A
member of the Colombo Bloc living in Oslo would have been nudged at 14:00. He
caught this himself — *"is it 5 p.m. on the user's time, or 5 p.m. where?"*

It blocks notification types 1, 6, 7 and 9, all scheduled, which is why it is
first.

**What it adds**

- `ante_core.profiles.time_zone text` — nullable, with a comment saying null
  means "fall back to the Bloc's zone".
- `public.set_ante_core_profile_time_zone(uuid, text)`, security definer,
  which **validates against `pg_timezone_names`** and silently ignores
  anything else. A device reporting nonsense keeps the Bloc's clock instead of
  poisoning a scheduler.

**Applied to production 7 November.** Told the founder before running it.

| | Before | After |
| --- | --- | --- |
| `profiles` rows | 54 | 54 |
| `time_zone` column | absent | present, nullable |
| rows with a zone | — | **0** |
| `anon` / `authenticated` can execute | — | **no** |
| `service_role` can execute | — | yes |

**Rollback is two statements**, both in the migration's header comment.

**Proved before trusting it.** Inside a transaction that was then rolled back:
a valid zone stored as `Europe/Oslo`; `Mordor/Mount_Doom` was ignored and did
**not** overwrite the good value. Production still has 0 non-null zones.

---

## 2. Reporting the zone from the device — code

Two small changes, no UI.

| File | Change |
| --- | --- |
| `src/lib/api.js` | `deviceTimeZone()` reads `Intl.DateTimeFormat().resolvedOptions().timeZone` in a try/catch, and `auth-sync` now carries `timeZone`. |
| `api/lift-log.js` | `recordCanonicalProfileTimeZone()` calls the new RPC, best-effort, right after `recordCanonicalDailyAppActivity` on `auth-sync`. |

`auth-sync` was chosen because it already fires on every app bootstrap, so no
new request and nothing new on screen.

**Best-effort on purpose.** A failure here must never stop someone signing in.
With no stored zone every future caller falls back to the Bloc's — exactly the
behaviour before this existed — so the column and this code are both safe to
ship ahead of anything that reads them.

### Verified

- `npm run lint` — clean.
- `npm run build` — clean.
- Sandbox, real `auth-sync` POSTs, **all four returned HTTP 200 and `ok:true`**:
  with `Asia/Colombo`; with **no `timeZone` at all** (an older app build);
  with `Mordor/Mount_Doom`; with a 500-character string.

**Not verified:** the write landing in production from a real phone. The
sandbox answers every canonical RPC with `[]`, so it proves the wiring and the
non-blocking behaviour, not the row. First real evidence will be
`select count(*) from ante_core.profiles where time_zone is not null` rising
after this deploys and people open the app.

---

## 3. Tapping a notification can now open the right Bloc — code

`handleNotificationAct` resolved every row against `currentGroup` and never
switched Bloc. Harmless for the bell, which only ever lists the Bloc already
open. Wrong for a push, which arrives with the app closed and can be about any
of the member's Blocs: tapping one would have opened whichever Bloc happened
to be open last and shown the wrong thing.

Replaced by `openNotificationTarget(item)` in `src/App.jsx`, with
`handleNotificationAct` now an alias so every existing caller is untouched.

| | |
| --- | --- |
| Bloc chosen | `item.groupId`, falling back to the open Bloc |
| Switching | `persistGroupSelection()` — the same function the Bloc switcher uses |
| Resolution | everything looks up in the **target** group, not `currentGroup`, because switching is a state update and `currentGroup` is still the old Bloc for the rest of the function |
| Guard | a `groupId` not in state (left, removed, not loaded) falls back to the open Bloc rather than blanking the screen |
| On switch | settings, Stream and the comment screen are closed, or the member lands on the new Bloc underneath the old Bloc's screen |

**The bell leaves `groupId` off**, so every row on that screen takes exactly
the path it took before. No UI change.

### Verified in the sandbox, as Riley, at 375x812

Seeded a real workout and a real reaction through the API, then drove the app:

- **Reaction row** → panel closed, Activity Feed opened, Riley's Gym log on
  screen and highlighted. 
- **Money row** → Month screen, on the Loop ring.
- No console errors on either.

Lint and build clean.

**Not verified: the switching branch itself.** It cannot be reached yet — the
bell never sets `groupId`, and push does not exist. The sandbox cannot produce
a notification from a Bloc you are not in. The switch calls
`persistGroupSelection`, which is the shipped Bloc switcher's own function, and
the rest is an object lookup; but it is untested, and the first thing to check
when push sends its first real notification is that tapping it lands in the
right Bloc.

### Incidentally confirmed

The live "For you" panel matches the corrected mockup from §21 of the build-12
handover: "For you" title, a close cross, bordered rows, avatar with an emoji
badge, the workout thumbnail on the right, SETTLING UP / TODAY section labels.

---

## 4. STOPPED — the permission card cannot be built on `main`

Copy settled with the founder after several rounds:

> **Accountable both ways.**
> You'll know when your Bloc logs. They'll know when you don't.

Centred, in Fero's own `.overlay.center-mobile` modal — the one "Your first
month" and the proration question already use. Buttons **Not now** / **Turn on**.

**Then the build stopped, on purpose.** The card's only job is to call
`requestPushPermissionFromUserAction`, and **none of the push code is on
`main`**:

| | `main` | `claude/testflight-build-12-2026-10-21` |
| --- | --- | --- |
| `src/lib/pushNotifications.js` | — | yes |
| `api/push-devices.js` | — | yes |
| `server/push.js` | — | yes |
| `@capacitor/push-notifications` | **not a dependency** | yes |
| `ios/` | — | yes |

So on `main` the card would be a button with nothing behind it, and a static
import of the missing module fails the build. It is also **native-only** by
nature — there is no APNs on the website — so even built, it could not be
loaded in a browser to check.

Three ways forward, put to the founder:

1. **Build it on the iOS branch**, where push lives, the button can be wired
   to something real, and it can be tested on a phone. Reaches TestFlight
   soonest. `main` gets it when the branches next merge.
2. **Port the push foundation to `main`** first — three files plus the
   dependency. Unifies the trunk, but it is lifting part of that branch's 67
   commits, and `build-12-xcode-handoff.md` says not to merge `main` into
   build 12 again.
3. Build the card on `main` behind a dynamic import that no-ops when the
   module is absent. Safe, invisible on web, but untestable and ships a dead
   button until the branches meet.

**Nothing was written for the card.** Recommendation given: option 1.

---

## 5. The permission card — built, on the TestFlight branch

His answer to §4 was option 1. Built on
`claude/testflight-build-12-2026-10-21`, now at **`e6895ab`** (a clean
fast-forward from `11ee2c2`; also pushed as
`claude/push-permission-card-2026-11-07`).

**It is not on `main`** and cannot be until push comes with it.

### The copy, settled after several rounds

> **Accountable both ways.**
> You'll know when your Bloc logs. They'll know when you don't.

Nine headers were rejected before this. What every rejected one had in common
was "each other", which blurs the Bloc into one blob; the founder wanted his
accountability and theirs named apart. He also asked for one line, so the
22-character version won over the 36-character one that said it in full.

### What was built

| File | What |
| --- | --- |
| `src/modals/modals.jsx` | `PushPermissionModal` — Fero's own `.overlay.center-mobile` modal, the one "Your first month" and the proration question use, with the same button pair in the same order |
| `src/App.jsx` | the trigger, the two handlers, `PUSH_ASK_KEY` / `PUSH_ASK_COOLDOWN_MS`, and the render guard |

- Fires after the member's **first logged workout in any Bloc**, never at
  sign-up.
- Only on **Today**, and never stacked on settings, the Stream, a profile, a
  comment screen, the proration question or the log sheet.
- `getPushPermissionStatus()` **reads** permission without prompting, and
  answers `"unsupported"` on the web — so the card is native-only by
  construction. Correct: there is no APNs on a website.
- "Not now" never reaches Apple. Only "Turn on" calls
  `requestPushPermissionFromUserAction`, **which had no caller anywhere in the
  app before this**.
- Either answer writes `fero_push_ask_v1`; the next ask is 30 days away.
- It deliberately does **not** imitate the iOS alert.

### Verified

Temporarily let `"unsupported"` through so the card could be driven in a
browser at 375x812, then reverted that one line and rebuilt:

- renders centred, title on one line, in the app's real modal;
- **"Not now"** dismisses it and writes `fero_push_ask_v1`;
- the dismissal **survives a reload**;
- **clearing the key brings it back**, so only the cooldown was suppressing it;
- no console errors; lint and build clean after the revert.

**Not verified:** Apple's own prompt and the registration behind it. Both need
the APNs key and a real device.

### A caution for whoever cuts the next build

That branch now has one commit it did not have when
`build-12-xcode-handoff.md` was written. Everything in that doc still holds —
this changes no Capacitor config and adds no dependency — but the build number
and `npx cap sync ios` steps are unchanged and still required.

---

## What is NOT done

Nothing else. No sender, no permission card, no switches, no scheduled job,
and the APNs key is still waiting on his personal laptop.

**Next:** switching Bloc when a notification is tapped — `handleNotificationAct`
(`src/App.jsx:2704`) resolves every row against `currentGroup` and never calls
`setSelectedGroupId`. Invisible, so it needs no mockup.

---

## Also parked this session, at his request

The **Bloc switcher redesign**. His words: the workout-type icons on each card
are irrelevant now. Not started, not in scope for push. Recorded in §25 of the
build-12 handover.

---

## Commits

| Commit | What |
| --- | --- |
| `0b13a25` | `profiles.time_zone`, the migration, and the device reporting its zone |
| `c689691` | tapping a notification opens the right Bloc |
| `c5d22bd` | why the card could not be built on `main` |
| `e6895ab` | **the permission card — on the TestFlight branch, not `main`** |
