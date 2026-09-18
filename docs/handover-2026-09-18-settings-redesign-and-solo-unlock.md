# Handover — 2026-09-17 to 09-18: Members tab bug, Solo unlocked, Bloc settings redesigned

**Start here.** Everything in section 1 is live in production. Section 7 is what
the next session picks up. Section 8 is what Deveen needed, also copied into his
handover (`docs/handover-2026-09-14-blob-runbook-tasks-1-4-and-log-fixes.md` §11).

| For | Read |
|---|---|
| The previous session | `docs/handover-2026-09-17-squash-dance-reload-and-backfill.md` |
| Deveen's open items, including the 1 October deadline | his handover §9–§11 |

---

## Plain-English summary

The admin's Members tab had been blank since 29 August, so a sit-out request from
Rahul sat unseen for a day. That is fixed. Solo is no longer locked after day 10;
it becomes a request the admin approves. The percentage is gone from the Solo row.

Bloc settings was then redesigned. It opens on Invite, and it differs by role:
an admin sees Invite, Status, Members and Rules, and everyone else sees Invite,
Status and Rules. Solo and Sit out moved off the Today screen into Status. A
member can cancel their own pending request. A dot on the settings icon tells an
admin a request is waiting.

One database addition was made: two functions that delete a pending request.
No data was changed.

---

## 1. What went live, in order

All pushed straight to `main` on the founder's word, each deployed and verified
(Vercel success, live page with no console errors, live bundle containing the
change).

| Commit | What |
|---|---|
| `81441e1` | Members tab shows members and pending requests again (§2) |
| `61893d8` | Solo after day 10 becomes a request; percentage removed from the Solo row (§3) |
| DB, 2026-09-18 | `delete_ante_core_sit_out_request`, `delete_ante_core_solo_request` (§5) |
| `5f16649` | Bloc settings split by role; Solo and Sit out moved into Status (§4) |
| `923a591`, `a277b3e` | "Bloc Admin" capitalised everywhere it appears on screen |
| `b4bc285` | Status cards show no button when there is nothing to do (§4) |

A docs-only commit from another session (`33de0ce`, RLS notes in Deveen's
handover) landed on `main` mid-session. It was rebased onto, not overwritten.

---

## 2. The Members tab bug (live 29 Aug → 17 Sep)

`a0ca12c` (moving Leave Bloc into settings) wrote `renderMembers` as
`( membersBlock, renderLeaveBloc() )`. That is a JavaScript comma expression, so
it returns only the last item. The member list, the Remove buttons and every
pending sit-out and Solo request were thrown away. Only Leave Bloc rendered.

- Only one request was caught by it: Rahul, Sarandawgs, sit-out, 16 Sep. Every
  request since 28 Aug was checked in production. The founder has since declined
  it.
- A `no-sequences` ESLint sweep of `src` and `api` found no other instance. The
  project's lint config does not enable that rule. Worth adding if it ever
  recurs.

---

## 3. Solo unlocked after day 10

- **Server** (`applySoloRequest`, `api/lift-log.js`): the day > 10 rejection is
  gone. The instant path also requires `day <= 10`, so a later request takes the
  existing pending path, the same one a second Solo within three months uses.
- **Client:** the "Solo Mode is locked" notice and the preview-host bypass that
  only existed to get round the lock were removed. `SoloModal` has a `late` mode:
  "Request Solo for September?" / "After day 10, Solo needs the Bloc Admin's
  approval."
- **Money rules are unchanged.** A Solo member still pays nothing and wins
  nothing. See §7 for the November change.
- **The Solo row on Today** shows `count/target` with no percentage. The right
  column keeps `minHeight: 28.5` so the row stays 45.5px, measured before and
  after.

---

## 4. Bloc settings redesign

The founder approved every piece of this over three rounds of mockups.

| Tab | Who | What |
|---|---|---|
| Invite (opens first) | everyone | The Bloc's faces plus an empty "+" seat, "A Bloc is better full", "Bring in the ones who'll show up." The code and link fields are unchanged |
| Status | everyone | "Injured, traveling, or got a busy month ahead?" on one line, then one card each for Solo and Sit out, then Leave Bloc |
| Members | admin only | Pending sit-out and Solo requests, then the roster with Remove |
| Rules | everyone | Unchanged |

**Status card states:**
- **Solo:** "A lighter target for a heavy month." with Go Solo.
  - Pending: "Solo requested · Waiting on admin" with Cancel.
  - Active: "Solo for September · Your target is N."
  - While sitting out: "Not available while you're sitting out."
- **Sit out:** "Take September off entirely." with Sit out, or Request again
  after a decline.
  - Pending: "Sit out requested · Waiting on admin" with Cancel.
  - Active: "Sitting out September."
  - While Solo: "Not available while you're Solo."
- **Copy decisions:**
  - The admin is never named. A pending card just says "Waiting on admin".
  - There is no third card for a pending request; the card itself changes.
  - The tab is "Status". The founder rejected "Your month" and "You".

**Other details:**
- **Today screen:** the Solo / Sit out button row is gone. The status lines
  stay ("Sit-out requested.", "You're sitting out September." and so on), and
  the card doesn't render when there's nothing to say.
- **Settings dot:** it appears for admins while a request is pending in the
  current month (`pendingRequestCount` in `App.jsx`, `settingsAlert` on `Nav`).
- **Both sheets portal to `document.body`:** the settings surface has a
  back-swipe transform. This is the Safari containing-block rule in the
  recurring debugging playbook. The overlay was checked to be a child of `body`
  covering the exact viewport.
- **A copy line to swap on 1 November:** the Solo pop-up's "You keep logging,
  but you are out of the reward / penalty system for the month." becomes the
  new-rules line in §7.

**Cancel** (`sitout-cancel`, `solo-cancel`):
- Only your own request, only while it is pending, and only for the current
  month.
- It deletes the request in canonical (the new RPCs), then goes through
  `persistAndScopeReadableStateForUser`, so the blob loses it too.
- The founder chose delete over a new `cancelled` status, so there is no
  history of withdrawn requests.

---

## 5. The database addition

`supabase/migrations/20260918090000_delete_request_rpcs.sql`, applied
2026-09-18 by the agent on the founder's explicit instruction.

- Two `security definer` functions that delete a **pending** request for
  (legacy group key, month key, display name). They are no-ops otherwise.
- `execute` is granted to `postgres` and `service_role` only. It was verified
  that `anon` and `authenticated` cannot call them.
- No data was changed: 16 `sit_out_requests` rows before and after.

---

## 6. How it was verified (reusable)

- **Sandbox at 375px, both roles.** Sign in as `riley@local.test` (admin) and a
  joiner. Small throwaway Node scripts posting to `/api/lift-log` with a
  `local-dev:<base64url email>` bearer token join members and send requests
  through the real API.
- **The local test identity dropdown** at the top of a sandbox Bloc switches
  the acting member without signing out. This is useful for checking another
  member's Status tab.
- **Faking the date:** `NODE_OPTIONS="--import <file>"` with a `Date` override
  gives the server a fake date (used to prove Solo is still instant on day 5).
  The browser clock is unaffected.
- **Server rules checked, 11 of 11 pass:**
  - requesting after day 5 or 10 goes to pending
  - cancel works, and a second cancel returns 404
  - you can't cancel after an approval or a decline
  - you can ask again after a decline
  - the admin can't cancel someone else's request
- Lint, build and 13 script suites pass. The two browser suites
  (`auth-edge-flows`, `mobile-navigation`) were not run; they need a seeded
  account, as noted in earlier handovers.
- **Layout:** the "Injured, traveling…" line measured 320/320px at 375px wide,
  with no clipping.

---

## 7. What the next session picks up

1. **Step 5, the "lives".** Make the existing limit visible. It is already once
   per three months for each of Sit out and Solo (`getRecentSitOutCount`,
   `getRecentSoloCount`), but nobody can see it. The founder wants:
   - the limit visible on the Status cards
   - others able to see who has used theirs
   - a real cost to going over

   It is design first; nothing is agreed yet.
2. **Step 6, the new Solo, switched on from 1 November.** These are the
   founder's decisions so far:
   - The Solo target is automatic: a fixed percentage of the Bloc target, with
     no picking your own. The percentage is to be researched: 25–50% was
     discussed, and the agent recommended 50%.
   - A Solo member who misses pays the normal penalty into the same pot.
   - A Solo member can never win the pot.
   - The Status card copy already fits both eras. Only the pop-up line changes,
     to: "You keep logging to a smaller target. Hit it and you're clear. Miss it
     and it counts like any other month."

   This is a change to how payments are calculated.
   - **Inventory every call site first:** `calcPenalties` and
     `buildDefaultSettlements`, in both `api/lift-log.js` and
     `src/lib/appState.js`, plus `isExemptFromStakes`, `SettlementScreen`,
     `MonthPage` and month close.
   - **Only after Deveen's month-close branch is merged.**
   - **It must not apply to September or October.**
3. **Deveen's month-close branch before 1 October.** It still merges cleanly
   with today's `main`, and `test:month-close-canonical`,
   `test:rollover-isolation` and `test:activities` pass on the merge
   (2026-09-18).

---

## 8. For Deveen

This is also in his handover as §11. Nothing needs action from him except the
existing month-close merge.

1. **Your branch still merges cleanly** with `main` at `b4bc285`, and its suite
   passes on the merge.
2. **Two new production RPCs:**
   - `delete_ante_core_sit_out_request(text, text, text)`
   - `delete_ante_core_solo_request(text, text, text)`

   They are `service_role` only and delete pending rows only. The migration
   file is `20260918090000_delete_request_rpcs.sql`.
3. **Two new actions, `sitout-cancel` and `solo-cancel`.** They compute from
   canonical writable state, delete canonically, then mirror through
   `persistAndScopeReadableStateForUser`, so blob and canonical both lose the
   request. They are **not** in `WRITE_HYDRATION_PARITY_DEFAULT_ACTIONS` or the
   mirror-policy lists at the top of `api/lift-log.js`; add them if you want
   parity probes on them.
4. **`solo_requests` will see more pending rows**, because every Solo after
   day 10 is now a request. It is one of the seven RLS-disabled tables in your
   §5.
5. **Heads-up: payments will change from 1 November.** Solo members join the
   penalty (§7 item 2). It will be built on top of your branch after it merges,
   not alongside it.

---

## 9. State at handover

| | |
|---|---|
| `main` | `b4bc285`, deployed |
| Worktree | `/Users/aadhilsj/Documents/FERO/fero-solo-unlock` (all work merged; safe to remove) |
| Branch cleanup this session | 36 merged remote branches and 4 finished worktrees removed. 8 unmerged old branches were kept for review with the founder: `ante-preview-20260605-192238`, `ante-profiles-read`, `codex/founder-dashboard-access-preview` (its change is already on `main`), `codex/read-cutover-get-composer`, `docs/plan-audit-2026-08-27`, `optimistic-single-log-fix`, `projection-read-fallback`, `saving-indicator-layout-fix` |
| Sandboxes / dev servers | all stopped |
| Still noted, not fixed | `docs/SCHEMA.md` does not list `ante_core.workout_logs.activity` or the two new RPCs; drop `ante_core.backup_activity_backfill_2026_09_17` on the founder's word |
