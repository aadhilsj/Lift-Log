# Handover — 2026-09-18 to 09-19: private notes, Furthest behind, the yearly allowance

**Start here.** Everything in §1 is live in production. §6 is what the next
session picks up.

| For | Read |
|---|---|
| The session before this one | `docs/handover-2026-09-18-solo-new-rules.md` |
| Deveen's open items (1 October) | his handover `docs/handover-2026-09-14-blob-runbook-tasks-1-4-and-log-fixes.md`, §3, §9–§13 |

---

## Plain-English summary

Nishara's private Solo note had gone into her Bloc's Stream. It was removed,
and both request sheets now say "Your Bloc will see this". A sit-out request
no longer posts to the Stream; only approvals do. The "Furthest behind" award
now counts Solo members against their Solo goal.

The founder then replaced "once every three months" with a yearly allowance:
2 sit-outs and 3 Solo months per calendar year per Bloc, from 1 October 2026
for current members. Using one needs no approval; asking for one more always
does, after a short explanation step. Sitting out now also means you cannot
log workouts.

---

## 1. What went live, in order

All pushed straight to `main` on the founder's word, each deployed and verified
(Vercel success, live bundle containing the change, live page with no console
errors).

| Commit | What |
|---|---|
| DB, 2026-09-18 | Nishara's `solo_started` message: note removed from `body` and `payload` (§2) |
| `f8041cb` | Furthest behind counts Solo misses; no Stream post for a sit-out request |
| `d7ff89d` | "Your Bloc will see this" on both sheets; sit-out reason required; the note becomes its own quoted line in the Stream |
| `03d25df` | Yearly allowance, Status tab dots and "Your 2026" strip, profile line, the explanation step, Sit out sheet rules, no logging while sitting out (§4) |

---

## 2. Nishara's note (production data)

- Row `47f6de53-72b0-4c25-8c3c-eaf41e227beb` in `ante_core.bloc_messages`. Body
  is now "Nishara went Solo for the month." and `payload.reason` is removed.
  Nothing else was touched (348 messages before and after).
- A backup of the original row is in
  `ante_core.backup_bloc_message_solo_note_2026_09_18`. It grants nothing to
  `anon` or `authenticated`. It can be dropped about a week after 2026-09-18,
  on the founder's word.
- Tobias's 9 September Solo note ("work") was left alone on the founder's word.
  It now displays in the new quoted style.

## 3. Stream and sheets (`f8041cb`, `d7ff89d`)

- **Furthest behind** (`SettlementScreen`, the only place it is computed): a
  new-rules Solo miss is measured against the Solo goal ("4 short of Solo
  goal"). Old-rules Solo (Tobias, September) stays out, because a miss costs
  them nothing.
- **Stream moments:**
  - `sit_out_requested` is no longer inserted. Old rows still render.
  - `solo_started` and `sit_out_approved` carry `payload.reason`. The body
    stays one sentence, and `SystemCard` shows the note as a quoted line under
    it. It also strips a note glued onto an older body.
- **Sheets:**
  - "Your Bloc will see this" sits on the Reason label's own row, at
    `lineHeight 1`, so neither sheet grows.
  - A sit-out needs a reason, checked by both the app and the server.

## 4. The yearly allowance (`03d25df`)

**The rules**
- 2 sit-outs and 3 Solo months per calendar year, per Bloc.
- From `"2026-9"` (October), set in `YEARLY_ALLOWANCE_FROM` in both files.
  September keeps the old rule.
- With one left: a sit-out is instant up to the 5th, Solo up to the 10th, and
  after that it goes to the Bloc Admin.
- With none left: the request always goes to the Bloc Admin. The app sends
  `exceptional: true`, and the server refuses a plain request.
- Only approved sit-outs and Solo months count. Pending, declined and
  cancelled requests don't.
- 2026 usage counts, with no freebies (founder).

**The old rule never worked.** `getRecentSitOutCount` read `group.excused`,
which only holds the open month. The new count reads closed months from
`monthHistory` plus the open month. The founder was shown this 2026 usage,
checked read-only against production, and the code gives the same answers:

| Bloc | Member | Sit-outs left | Solo left |
|---|---|---|---|
| Go To Da Gym | Nishara | 0 (Apr, Aug) | 2 (Sep) |
| OSI H3 | Coach P | 0 (Jun, Jul, Aug) | 3 |
| Ctrl Alt De-feat | Cutie pie | 0 (Jul, Aug) | 3 |
| OSI H3 | Tobias | 2 | 2 (Sep) |
| Several others | one sit-out each | 1 | 3 |

**Screens**
- **Status tab:**
  - Dots and "N left" / "None left" beside each title. Filled = available and
    hollow = used, with filled always first. Teal is Solo, amber is sit-out.
    The card stays 57.3px tall, measured with and without the dots.
  - "Request" in place of the button when none are left. It opens
    `AllowanceUsedModal` ("Not now" / "Request"), then the request sheet with
    "This one needs approval before it takes effect."
  - A "Your 2026" twelve-month strip and a one-line summary.
- **Profile, This Bloc view:** a one-line 2026 row with the same dots and the
  same "left" wording, visible to everyone.
- **Sit out sheet:** three rules: no logging, removed from the penalty, back
  next month.
- **Sheet heights at 375×667:**
  - Sit out: 373px.
  - Solo with none left: 521px.
  - Solo late: 538px, unchanged. The modal's maximum is 547px.
- **"+" while sitting out:** `SittingOutNotice` ("You're sitting out October…
  back in on 1 November"). The server refuses the workout, and a multi-Bloc
  workout skips the sat-out Bloc. No one was sitting out in September at ship
  time.

**Verified:**
- `npm run test:yearly-allowance` (new, 14 checks with a faked server clock),
  lint, build and 15 other suites.
- The two browser suites (`auth-edge-flows`, `mobile-navigation`) were not
  run.
- In the sandbox, with the start month temporarily set to September (reverted
  before commit):
  - every screen above at 375×667
  - the request going to pending
  - the approval
  - the "+" note
  - the server refusing a workout from someone sitting out, while another
    member could still log

**Not verified:** the rules against production's canonical month history
through the real API. The counting was checked against the production blob by
reading it.

## 5. Known, not changed

- The Bloc vote for requests past the allowance is designed later. Until then
  they go to the Bloc Admin. The explanation copy avoids naming who approves,
  so it survives the change.
- The Today screen still says "Exceptional sit-out requested." for such
  requests.
- The Admin's Members tab labels them "Exceptional request" only when there is
  no reason, which can no longer happen.
- Everything in §7 of the 2026-09-18 handover still stands, except that
  Furthest behind is now done.

## 6. What the next session picks up

1. **Chase Deveen:** the month-close merge and the RLS rollout, both by
   1 October. His handover §13 notes that closed snapshots must keep `excused`
   and `solo`.
2. **On 1 October:** check a real Status tab and profile show the right counts
   for Nishara and Coach P.
3. **Design the Bloc vote** for requests past the allowance, with a Bloc Admin
   veto (founder idea, not yet discussed in detail).
4. **Optional, founder's call:**
   - drop the Nishara backup table after about a week
   - the Solo penalty question (half the penalty for Solo?), which the founder
     raised and the agent recommended keeping at the full agreed penalty

## 7. State at handover

| | |
|---|---|
| `main` | this handover's commit, on top of `03d25df` (deployed) |
| Production database | Nishara's message edited plus one backup table; nothing else |
| Worktree | `/Users/aadhilsj/Documents/FERO/fero-solo-stream`, all work merged |
| Sandbox | stopped by PID; `.sandbox-data` in the worktree holds test edits only |
| Untouched | the shared folder `Codex Space/Fero` (still on `086c907`), `fero-app-store` (Codex), `fero-solo-unlock`, `/private/tmp/fero-settings-request-guards`, Deveen's branch |
