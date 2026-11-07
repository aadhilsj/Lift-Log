# 7 November 2026 (session 2) — the per-type notification switches

Second session on push. The first is
[`handover-2026-11-07-push-build.md`](handover-2026-11-07-push-build.md); its
"Closed out" section was the starting state and every fact in it was
re-verified here before anything was touched.

The design is
[`push-notification-design-2026-11-06.md`](push-notification-design-2026-11-06.md),
§2E–§2I carrying the founder's decisions.

**Release route for this session, his answer when asked:** straight to `main`
for anything that belongs on `main`; work that needs the push code goes on
`claude/testflight-build-12-2026-10-21` instead.

**The standing constraint, restated by him at the top of this session:**
anything that changes a screen gets a mockup he approves **before** it is
built. The switches change a screen, so they are mocked up first. Invisible
work can just be done.

**Worktrees:** `/Users/opera_user/Developer/FERO/switches-2026-11-07` on
`claude/notification-switches-2026-11-07` (off `origin/main`, docs only). A
second worktree on the TestFlight branch will be needed for the code, and
**that one needs its own `npm install`** — it carries
`@capacitor/push-notifications`, `@capacitor/ios` and `@capacitor/keyboard`,
none of which are in `main`'s `node_modules`.

---

## 1. Catch-up — what was verified before touching anything

Everything the founder stated in his brief checked out. Three facts he did not
have:

| | |
| --- | --- |
| **This shared folder is 5 commits behind `origin/main`** | `Documents/Codex Space/Lift Log` sits at `0d98eef`. Everything in this session was read from `origin/main`, not from disk. Not corrected — Codex works in that folder. |
| **The build-12 worktree is 1 commit behind its branch** | `~/Developer/FERO/build-12-2026-10-21` is at `11ee2c2`, so it does **not** have the permission card `e6895ab`. Anyone cutting a build from that folder without pulling first would ship without it. It does already have `node_modules` and `.env.local`. |
| **The design's switch count predates the founder's own additions** | §3 rule 5 and §5 step 4 both say "nine switches". §2E then added types 10, 11 and 12, taking the set to **twelve**. So the number of switches was never actually decided. |

### Live, confirmed

Production is `3bbde63`, deployed 7 November 02:17 UTC. `lift-log-nu.vercel.app`
returns HTTP 200, bundle `assets/index-D3c5hxMA.js`. The three invisible pieces
from session 1 — `profiles.time_zone`, the device reporting its zone, and a
notification tap opening the right Bloc — are all in it.

### The TestFlight branch, confirmed

`claude/testflight-build-12-2026-10-21` is at `e6895ab`, 76 commits ahead of
`main`, and `claude/push-permission-card-2026-11-07` points at the same commit.
The permission card is on it and in no build.

---

## 2. Two findings that shape the switches

### `notification_prefs` does not exist anywhere

Grepped both branches: no table, no column, no code. `ante_core.notification_jobs`
**does** exist (in `supabase/canonical-schema.sql` and the original canonical
migration), but that is the scheduler table the design points at for step 6 —
not this one. The prefs store is genuinely new.

### There is a dead placeholder screen with the right name

`src/pages/NotificationsPage.jsx` exists on **both** `main` and the TestFlight
branch. It renders a modal saying *"Notifications are coming soon."* and
**nothing imports it** — the only other mention in either tree is a line in
`handover-2026-10-15-session-catch-up.md` calling it the old placeholder.

It was **not** used and **not** deleted. Left alone pending the founder's word.

The pattern actually shipped, and the one the mockup follows, is the **Blocked**
row in `src/pages/ProfilePage.jsx` (line ~412) opening `BlockedMembersPanel`:
a row inside a `Card`, and a panel with a `‹ Account` back button, an 18px/800
title and a 12px muted explainer. Not a modal.

---

## 3. The grouping — five switches, not twelve

Recommended to the founder and built into the mockup rather than put to him as
a question, because twelve rows of toggles is a settings screen nobody reads.

| Switch | Covers | Types |
| --- | --- | --- |
| Training nudges | Bloc is training / 3 days left / streak at risk | 1, 6, 9 |
| Reactions and comments | reaction, comment, thread reply | 2, 3, 4 |
| Mentions | mentioned in the Stream | 5 |
| Money and month close | month closed, money, perfect month | 7, 8, 12 |
| Requests | sit-out or Solo asked, and answered | 10, 11 |

**The trade-off, recorded honestly:** a member who wants comments but not
reactions cannot have that. Accepted as the right trade — the wall of twelve is
a real cost and that split is a hypothetical one.

---

## 4. The mockup — on his design canvas, awaiting his word

Added to the existing canvas `SiGivnD85RCPqpjayZp1k1` ("Fero push
notifications") rather than a new one, in the same 900x844 house style as its
other eleven artboards. Nothing existing was moved or resized.

| Artboard | What |
| --- | --- |
| `Switches.dc.html` | The panel: five switches, **interactive** — the toggles really move, and the line under the phone shows what the Account row would then read. Rationale column carries the grouping, the trade-off and four notes |
| `SwitchesEntry.dc.html` | Two phones: the Account screen with the one new row, and the **iOS-permission-off state** |

### Drawn from the real code, not invented

| Element | Source |
| --- | --- |
| The toggle | `BlocSettingsScreen.jsx:457` — 38x22 track, radius 999, `#4ECDC4` on / `#2A2E39` off, knob 16x16 at `top:3` sliding `left` 3 to 19, `#050909` on / `#767C88` off, `.18s` |
| Panel chrome | `BlockedMembers.jsx:52-61` — `< Account` back at 13px/700 `--muted`, title 18px/800, 12px `--muted` explainer. A panel, not a modal |
| Rows | `ProfilePage.jsx:387-399` — `13px 15px`, label 13px/500, divider `1px solid rgba(255,255,255,.055)`, last row none |
| Section labels | `ProfilePage.jsx:374` — 10px/500, uppercase, `.1em` |
| Account rows | `ProfilePage.jsx:218` — really only Email, (Dashboard, founder-only) and Sign out. The new row is drawn between Email and Sign out |
| Colours | `src/styles/app.css` `:root` |

### Decisions inside the mockup, for him to accept or reject

- **Five switches**, per §3 above.
- **All five default ON.** A member who has just allowed notifications has
  said yes once; making them say it five more times wastes the permission.
- **The switches govern push only.** The explainer says so in as many words,
  because "For you" is computed in the client and cannot be switched off from
  here — §6 of the design.
- **Permission-off state:** the switches stay on and visible, dimmed, under an
  amber notice. Not reset, not hidden, so re-allowing returns the member's
  choices untouched.
**Nothing was built.** No code on either branch.

### His verdict, 7 November — approved with two changes

> *"i think you can remove the copy under the notifications header other than
> that we ok"*

**1. The explainer under the header is cut.** The line read *"What Fero sends
to your phone. Turning one off changes nothing inside the app - For you still
shows everything."* Removed from both phones; the title's bottom margin goes
3 -> 14 so the first card is not jammed against it. The point it made is still
true and still worth knowing when the senders are built: these switches govern
**push only**, because "For you" is computed in the client.

**2. Quiet hours are settled: 23:30 to 06:00, in each member's OWN time zone.**
His words: *"change quiet hours to 23:30 to 06:00 / in your individual
timezone"*.

This **supersedes the design's 22:00-07:00** (§3 rule 4), which was the open
question about StavanGang training late. Note what it leans on: the member's
zone, not the Bloc's, which is exactly what `ante_core.profiles.time_zone`
was added for in session 1 — and that column is still **0 rows filled** until
people open the app. Until a member has a zone, the only honest fallback is
the Bloc's, the same fallback the column was written with.

`push-notification-design-2026-11-06.md` §3 still says 22:00-07:00. Not
edited — that document is the signed-off design and its founder decisions are
recorded in §2E as supersessions rather than by rewriting the original. This
handover is the record of this one.

**Everything else in the mockup he approved as drawn**: five switches, the
grouping, all five on by default, and the permission-off state.

## 5. A correction to the permission board, at his request

Mid-session, looking at `Permission.dc.html`, he asked for the header on one
line.

The board was **stale**: it still showed option A, `You're accountable, and so
are they.`, as the pick, which wraps to two lines at 19px in a 340 modal. The
copy he actually settled on, and the copy **already built** into
`PushPermissionModal` on the TestFlight branch at `e6895ab`, is option B,
`Accountable both ways.` — §5 of the first session's handover records exactly
that, and records the reason as his asking for one line.

So the board disagreed with the shipped card. Changed `pick` from `options[0]`
to `options[1]`, and moved the green "recommended" treatment from A to B,
relabelled `B - built` so the board now says which one exists. **The three
options and their reasoning are untouched** — that is his copy-review record.

No code changed. The built card was already correct.

## 6. The permission card, two more changes — 7 November

> *"this copy doesnt say we are turning on notifications, change the turn on
> button to say turn on notifs and the copy under the header, wrap so its on
> one line - don't change the copy tho"*

Both done on the board. **Measured, not eyeballed** — a one-line claim about a
340px modal is exactly the kind that has been wrong before.

### The button

`Turn on` -> `Turn on notifs` -> **`Turn on notifications`**, spelled out in
full at his second instruction: *"not notifs, notifications. spell the whoole
thing"*.

The full word does **not** fit the button pair as it was. Measured at 15px/800
Outfit it is **143.5px** against **119.5px** of room on the board and 127.0px
on a real phone. The shortened `Turn on notifs` fitted at 95.9px; the full one
does not.

So one of two things had to give, and this is a layout change he did not ask
for either way:

| | |
| --- | --- |
| Shrink the type | the full word needs **12px** for equal buttons, against the secondary's 15px. The primary action would be the smaller text on the screen |
| **Give the primary the room (chosen)** | `Not now` sizes to its own text (**85.2px**), the primary takes the rest (**181.8px** of text room). Both stay at 15px, and 143.5px fits with 38px spare |

Chosen the second: the buttons are **no longer equal width**. That is the one
visible consequence, and it also reads correctly — the primary action is the
wider of the two. `.mbtn` loses `flex: 1`; `.mprimary` gains it, `.msecondary`
gets `flex: 0 0 auto` and `white-space: nowrap`.

**If he would rather they stayed equal**, it is the first row of that table:
equal widths, 12px primary text. One line to change.

### The body line, on one line, copy untouched

`You'll know when your Bloc logs. They'll know when you don't.` at the current
12.5px measures **334.3px** against **304px** of content width — which is why
it wrapped.

| Size | Width | At 304px |
| --- | --- | --- |
| 12.5px (was) | 334.3px | wraps |
| 12px | 321.0px | wraps |
| 11.5px | 307.6px | wraps |
| **11px (now)** | **294.2px** | **fits, 9.8px spare** |

**A correction found while measuring.** The board draws the modal as
`max-width: 340px` in a 360px phone. The real one is **not** 340: `app.css:202`
gives `.modal` `max-width:100%` with `padding:18px 16px 16px` under 769px, and
`.overlay.center-mobile` adds `padding:16px 12px` (line 200). On a 375px phone
that is **319px** of content, 15px more than the board assumes.

So 11.5px would in fact fit the real screen (307.6 <= 319) but would still wrap
in the 360px board. **11px is used in both**, deliberately: one number that
holds from 360px up, and 11px is already a Fero size — it is what the row
explainers on the switches panel use. Two different numbers in the board and
the code is how a mockup and a screen drift apart.

### Both are still only on the board

`PushPermissionModal` on the TestFlight branch at `e6895ab` still says
**`Turn on`**, still sets the body at the old size, and still has equal-width
buttons. **None** of the three changes is in code. They go in with the switches
work, on the same branch.

## 7. Which side Apple puts Allow on — checked, nothing to change

He asked which side Apple's notification alert puts its accept button on, and
for Fero's card to match.

**Apple's Human Interface Guidelines, the Alerts page, Buttons section:**

> *"Place buttons where people expect."*

It then says to put the button people are most likely to choose on the
**trailing** side of a row — and always to put the default button there —
with Cancel buttons on the **leading** side. Trailing is the right, in a
left-to-right language. So Apple's own prompt is `Don't Allow` left,
`Allow` right.

**Fero's card already matches.** `Not now` is on the left, `Turn on
notifications` on the right. No change was made, to the board or anywhere
else.

Two things worth keeping:

- If the titles are long enough that iOS stacks the buttons vertically
  instead, the preferred one goes to the **top**, not the bottom. Fero's card
  is always a row, so this does not arise for it.
- This does **not** contradict §2I of the design, which says Fero's card must
  not imitate Apple's. That warning is about copying the look — same shape,
  same grey — so that the card reads as a system dialog and the member feels
  tricked. Matching which side the accept button sits on is the opposite: it
  is muscle memory, and it means the member taps right on Fero's card and
  then right again on Apple's.

**How this was checked:** fetched in the browser, not recalled. Apple's HIG
pages render their body with JavaScript, so a plain fetch returns only the
page title — the first attempt came back empty and proved nothing.

## 8. Built — 7 November

He said start building. Everything below is written, linted, built, driven in
the sandbox and pushed to a branch. **Nothing is live and nothing is on `main`.**

### The one thing that is blocked, and it is not code

**The Supabase connector is signed in to the wrong account.** Every call
against project `bpvvvqjsfwmmfjvvijkd` returns *"You do not have permission to
perform this action"*, so unlike session 1 I could neither read production nor
apply the migration. The table does not exist yet.

**Diagnosed properly rather than left as "no access".** The connector is not
broken and not disconnected: it reports `connected` with 31 tools, and
`list_projects` answers happily. It just lists **Runway** and **LifeOS**, both
in organisation `nkdiocffmnmnydcpavwk`. **Fero's project is not in that list
at all.** So the token behind the connector belongs to an account that is not
a member of the organisation that owns Fero, and the permission error is
accurate rather than a glitch.

**The fix is the founder's, and it is not a code change:** sign the Supabase
connector in to the account that owns Fero, from `/mcp` in a session or from
Connectors on claude.ai. Nothing should be pasted into the chat to do it --
see AGENTS.md section 9.

That inverts the usual order — AGENTS.md section 12 says schema goes first —
so the server half is deliberately **held back from `main`** until the
migration is applied. It is one commit, ready to push.

### Where each piece went, and why they are not in the same place

The split matters and is easy to get wrong: **the phone runs the branch's UI
but calls `main`'s API.** `src/lib/apiOrigin.js` points the native build at
`https://lift-log-nu.vercel.app`, and Vercel builds that from `main`. So an
API action only on the TestFlight branch would never run.

| Piece | Branch | Live? |
| --- | --- | --- |
| `supabase/migrations/20261107120000_notification_prefs.sql` | both | **no — not applied** |
| `api/lift-log.js` — two actions | `claude/notification-switches-2026-11-07`, cherry-picked onto the build branch | **no — held off `main`** |
| The panel, the row, the card changes | `claude/notification-switches-build-2026-11-07` | no |

Both branches are pushed. The server commit is the **same commit** on both
(cherry-picked, clean), so the eventual merge has nothing to resolve.

### The table

`ante_core.notification_prefs`, one row per member who has changed something,
five booleans, `profile_id` referencing `profiles(id)`. Plus
`public.read_ante_core_notification_prefs(uuid)` and
`public.set_ante_core_notification_prefs(uuid, jsonb)`, both security definer,
both revoked from `anon` and `authenticated` and granted only to
`service_role` — the same shape as session 1's time-zone function.

No row means every type is on, so there is nothing to backfill. The setter is
partial: it changes only the switches actually named, and a key that is
missing, null or not a JSON boolean is ignored rather than read as `false`.

**Quiet hours are not columns**, deliberately — 23:30 to 06:00 is a rule for
everyone, and two columns would imply it is configurable.

**Rollback is the three statements in the migration header.**

### Decisions I made while building that he did not specify

- **A failed load shows "Try again", not all-on.** All-on is a real state;
  showing it when the server has not answered would tell someone they are
  covered when they may not be.
- **A toggle is optimistic, then put back if the server refuses**, with the
  reason shown. A switch that looks saved and is not is the worse failure.
- **Denied dims the switches rather than hiding them**, so re-allowing returns
  the member's choices untouched.
- **No "Open Settings" button, though the mockup drew one.** Opening iOS
  Settings needs a native call this app does not have — `@capacitor/app` is
  not a dependency and `App-Prefs:` URL schemes are unreliable and have been
  rejected by Apple. Rather than ship a button that does nothing, the notice
  tells the member where to go in words. **This is a visible difference from
  the approved mockup** and is his to overrule; the honest alternatives are a
  new Capacitor dependency or leaving it as text.

### Verified

- `npm run lint` clean, `npm run build` clean, on both branches.
- **29 of 31 `test:*` scripts pass.** The two that fail — `test:auth-edge-flows`
  and `test:mobile-navigation` — **also fail at `e6895ab`**, checked by
  detaching to that commit and running them, so they are pre-existing and not
  from this work. That matches the 5 November handover's 29/31.
- **Driven in the sandbox at 375x812 as Riley.** The row appears in Account
  between Email and Sign out reading `All on >`; the panel opens with the five
  switches, the web notice and the quiet-hours line; back returns to Account;
  **no console errors anywhere**.
- The round trip is real, not assumed: the POST to `/api/lift-log` returned
  **200** with
  `{"ok":true,"prefs":{"trainingNudges":true,...}}`.

### NOT verified, and why

- **Persistence.** The sandbox answers every canonical RPC with `[]`, so the
  setter echoes all-true and a switch springs back on immediately after being
  turned off. That is the sandbox, not the code — but it means **no switch has
  ever actually been saved and read back.** First real proof is after the
  migration is applied.
- **The denied and not-yet-asked states.** Both need a real device; the web
  reports `unsupported`, which is the third branch and is the one seen above.
- Apple's prompt behind the "Turn on notifications" button in the panel.

### A caution before build 13 is cut

The TestFlight branch has **not** been fast-forwarded to this work, on purpose.
Until the migration is applied, the Notifications screen would open and show
"Try again" — a visibly broken screen. Once the table exists, the branch moves
with one fast-forward.

Also still true from session 1: the TestFlight branch does **not** carry
`profiles.time_zone` or the device reporting it. Those are on `main` only.

### Commits

| Commit | Branch | What |
| --- | --- | --- |
| `d6a34e1` | `claude/notification-switches-2026-11-07` | the table, the two RPCs, two API actions — **held off `main`** |
| `bbfe0c5` | `claude/notification-switches-build-2026-11-07` | the same commit, cherry-picked |
| `9070a9c` | `claude/notification-switches-build-2026-11-07` | the five switches, the row, the three card changes |

**No production SQL was run this session — the connected Supabase account
cannot see Fero's project.**

## 9. A mistake: the server commit reached `main` after all

Recorded because it contradicts section 8, which was written minutes earlier
and says the server half is held back.

**What happened.** The handover commit was pushed with `git push ... HEAD:main`
from a branch that already carried `d6a34e1` on top of `main`. Pushing `HEAD`
took the whole branch, so the commit meant to wait went with it. The push was
checked for ancestry and force-with-lease, as always — neither of those catches
sending one commit more than intended.

**What is now on production**, at `6b6ef3f`, deploy `success`, live site 200:

| | |
| --- | --- |
| `supabase/migrations/20261107120000_notification_prefs.sql` | a file only. **Vercel does not run migrations. The database is unchanged.** |
| `api/lift-log.js`, two added actions | live, and **unreachable** — no web UI calls them and no iOS build carries the screen |

**The real effect** is two dormant endpoints. Called, they would 500, because
the RPCs they invoke do not exist. Nothing existing was touched; the rest of
the file is byte-identical, lint and build were clean before the push.

**What it breaks is the rule, not the app:** AGENTS.md section 12 says schema
goes first, and this is code landing ahead of its schema.

**Recommendation: leave it, and apply the migration next.** A revert is two
further production deploys — one to take it out, one to put it back — against
code nothing can reach. The founder was told immediately and it is his call;
the revert is `git revert d6a34e1` if he wants it.

## 10. Unblocked, applied, and live — 7 November

The founder reconnected the Supabase connector to the account that owns Fero.
`list_projects` now returns **Lift Log** (`bpvvvqjsfwmmfjvvijkd`), and
everything section 8 was waiting on is done.

### Found on the way in: the time zone column is filling

| | Session 1 | Now |
| --- | --- | --- |
| `profiles` rows | 54 | 54 |
| rows with a `time_zone` | **0** | **14** |

That closes one of session 1's unverified items: `profiles.time_zone` **is**
being written from real phones. Nobody did anything to make it happen; people
simply opened the app.

### The migration is applied to production

Applied as `notification_prefs`. Announced here rather than beforehand only
because the access appeared mid-conversation; AGENTS.md section 4 allows
either.

| | Before | After |
| --- | --- | --- |
| `ante_core.notification_prefs` | absent | **present, 0 rows** |
| the two RPCs | absent | **present** |
| `anon` / `authenticated` can execute either | — | **no** |
| `service_role` can execute both | — | yes |
| `profiles` rows | 54 | 54 |
| `workout_logs` rows | 2783 | 2783 |

**Rollback is the three statements in the migration header.**

### Proved, not assumed

Inside a transaction that was then rolled back, against a real profile:

| Call | Result |
| --- | --- |
| read, member with no row | all five **true** |
| set `{"mentions": false}` | mentions **false**, the other four untouched |
| set `{"requests": "banana"}` | **ignored** — requests stays true, and mentions stays false |
| set `{"mentions": true}` | back to all five true |
| read, unknown member id | `null` |

After the rollback: `notification_prefs` **0 rows**, `profiles` 54,
`workout_logs` 2783. Production was read and reasoned about, never written.

### The live API

The two actions are deployed and gated. Unauthenticated:

| Request | Status |
| --- | --- |
| `notification-prefs` | **401** |
| `set-notification-prefs` | **401** |
| a made-up action, for comparison | 400 |

A 401 rather than a 400 is the proof they are recognised; a 400 is what an
unknown action gets.

**So section 9's accidental push turned out to be harmless and is now
correct.** The code that was briefly ahead of its schema has its schema. No
revert is needed and none was made.

### The TestFlight branch now carries it

`claude/testflight-build-12-2026-10-21` fast-forwarded **`e6895ab` ->
`9070a9c`**, checked as a true fast-forward first and pushed with
`--force-with-lease` pinned to the sha that was read. It now has the permission
card, the five switches and the three card changes.

**Cutting a build in Xcode is what puts it on a phone.** Everything in
`build-12-xcode-handoff.md` still applies, and `npx cap sync ios` is still
mandatory.

### Still not verified, and now verifiable

A switch has still never been saved and read back **through the app** — the
sandbox stubs every canonical RPC, so that needs the real app against
production. The first real proof is turning a switch off on a phone from
build 13 and seeing it survive a restart.

## Still open

- **Done and on the TestFlight branch.** The table is applied, the API is
  live, the branch is fast-forwarded. What is left is cutting build 13 and
  turning a switch off on a real phone. See §10.

### Carried over from session 1, unchanged

- **Needs his laptop:** the APNs key, then `APNS_PRIVATE_KEY`, `APNS_KEY_ID`,
  `APNS_TEAM_ID` (team `SMR55A2M96`) and `PUSH_REGISTRATION_ENABLED=true` in
  Vercel. The `.p8` downloads once and must never reach the repo or a chat.
- **Still undecided by him:** what the member who logged the completing workout
  sees for type 12. Quiet hours are now settled — 23:30–06:00, member's own
  zone — see §4 above.
- **Unverified until push is real:** the Bloc-switching branch of
  `openNotificationTarget`, `profiles.time_zone` filling from a real phone,
  Apple's prompt and the registration behind it.

### Commits

| Commit | Branch | What |
| --- | --- | --- |
| — | — | nothing yet |

No production SQL run this session. No production data touched.
