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

## Still open

- The mockup itself — being drawn now, not yet shown to him.
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
