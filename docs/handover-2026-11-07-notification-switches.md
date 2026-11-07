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
- Quiet hours drawn as 22:00-07:00 **because the design says so**, with the
  board noting he has not settled it.

**Nothing was built.** No code on either branch.

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

## Still open

- **His verdict on the mockup** — five switches or twelve, the copy, the
  defaults, and the permission-off state. Nothing is built until he says.
- Nothing built. No code touched on either branch.

### Carried over from session 1, unchanged

- **Needs his laptop:** the APNs key, then `APNS_PRIVATE_KEY`, `APNS_KEY_ID`,
  `APNS_TEAM_ID` (team `SMR55A2M96`) and `PUSH_REGISTRATION_ENABLED=true` in
  Vercel. The `.p8` downloads once and must never reach the repo or a chat.
- **Still undecided by him:** quiet hours 22:00–07:00, possibly too early for
  StavanGang; and what the member who logged the completing workout sees for
  type 12.
- **Unverified until push is real:** the Bloc-switching branch of
  `openNotificationTarget`, `profiles.time_zone` filling from a real phone,
  Apple's prompt and the registration behind it.

### Commits

| Commit | Branch | What |
| --- | --- | --- |
| — | — | nothing yet |

No production SQL run this session. No production data touched.
