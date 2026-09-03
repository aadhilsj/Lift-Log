# Handover — 2026-09-03 Redemption shield & Training Wheels

Branch: everything landed directly on `main` (founder's call for this session).
Commits `03ff8c5` → `dfe2676`. Two Supabase migrations applied and one
production data correction, all recorded below.

---

## Plain-English summary

Two features shipped. **Redemption** puts a small shield beside your name the
month after you miss your target — red while it's owed, gold once you answer
it. **Training Wheels** gives a new Bloc's founding roster, and every later
joiner, a first month where they log and compete normally but cannot be
penalised.

Along the way eleven bugs were found and fixed, most of them pre-existing and
unrelated to either feature. The one that started the session was a blank
screen when opening a Bloc.

---

## What shipped

| Commit | What |
|---|---|
| `03ff8c5` | Error boundaries on Activity, Month, History |
| `15a8f1d` | Sat-out headline, empty-pot winner, perfect-month rule, penalty copy |
| `25ca382` | The Redemption shield |
| `dd99ca5` | Training Wheels state, invisible, behind its test |
| `a64824d` | Training Wheels switched on and visible |
| `3d7b3e5` | The joiner's prompt |
| `38ce2f6` | Carry training through the closed-month canonical rebuild |
| `5820f4d` | Player profile money, and the missing settings toggle |
| `091cdc9` | Member tags in the app's own font; tappable shield |
| `855defe` | Centre the note, lock scroll, tag only real proration |
| `dfe2676` | Smaller tags, spelled-out month, one share button |

---

## How Training Wheels works

### The data

A `training` map on the group, shaped `{ [displayName]: { [monthKey]: true } }`.
It sits **beside** `solo`, not inside it. Two reasons, both load-bearing:

- Solo is limited to once every three months (`getRecentSoloCount`). Riding on
  the solo map would make a member's free first month silently spend a solo
  allowance they never asked to use.
- `normalizeSolo` rebuilds every entry as `{target}` only, so any marker added
  to a solo entry is stripped on the very next read.

A second map, `trainingDecisions`, records **that a joiner answered**, separately
from what they answered. Choosing "same terms as everyone" leaves no training
entry behind, so without its own record that member would be re-prompted on
every app open.

Both maps are normalised on read, carried into the closed-month snapshot,
**cleared at rollover**, moved with a display-name rename, and scoped to the
open month in the readable projection. All of that exists twice — in
`src/lib/appState.js` and again in `api/lift-log.js` — because the solo
mechanic it mirrors is written twice.

### Where the grant happens

Server-side only, in two functions:

- `applyCreateGroup` — the founding roster, if the create-time switch is on.
- `applyJoinGroup` — each new joiner, from the Bloc's current default.

**Deliberately not in any invite path.** There are four ways into a Bloc
(invite link, join code, cold onboarding, already-a-member) and that area fails
silently rather than loudly. No door carries the setting, so no door can miss
it.

### The joiner's prompt

A centred modal on arrival, pre-selected to the Bloc's default, recorded once.
It appears **only when the Bloc already has a closed month behind it**. Before
that, the admin's create-time switch governs the whole founding roster, and
offering an opt-out there would overrule the admin in the exact month their
switch was meant to decide.

The prompt never says "training wheels" — nobody wants to be told they need
them on day one. The leaderboard tag says it afterwards, once it's their own
choice.

### The exemption

`isExemptFromStakes(groupOrMonth, name, monthKey)` is the single question every
money path asks. It covers solo *and* training. Call sites: the settlement map,
settlement pairs, the settlement screen's active list, the month page counts,
and the player profile's own totals.

---

## How Redemption works

Entirely derived, nothing stored. `getRedemptionMark(monthHistory, name,
monthKey, hitTargetThisMonth)` returns `"redemption"`, `"redeemed"` or `null`
by looking at the closed month immediately before the one being displayed.

Consequences of deriving rather than storing: it is correct after a rollover by
construction, it is scoped to one Bloc for free, there is nothing to migrate,
and removing the feature means deleting a render branch.

Rules:

- The trigger is **missing the target**, not owing money. Those diverge whenever
  nobody qualifies as a winner.
- Anyone excused, on solo, or on training that month **did not miss** — they
  weren't held to the Bloc target — so they earn no mark.
- On a closed month's summary the mark refers to the month *before* that one.
  A Bloc with a single closed month therefore shows no marks there, which is
  correct and was initially mistaken for a bug.

Tapping the mark on a player profile opens a note that names the month
explicitly ("a slow September", never "last month" — on a profile you can
scroll back through history).

---

## Month screen rules settled this session

- **Perfect Bloc Month** requires *every active member* to hit **the Bloc's
  target**. Training members count. Solo members count, and clearing only their
  own lower target is not enough. Sitting out is the sole exclusion. A prorated
  target for joining mid-month still counts as hit.
- **Sat Out** has its own headline, asked before any money question.
- **A win with an empty pot** shows the workout count, not `+£ 0`, and the line
  keeps its usual wording. Money is never mentioned when no money is involved.
- **Exemption footnotes** ("first month, no penalty" / "on solo mode") appear
  only when that member actually came up short, and never on their own screen —
  their headline already said it.
- **Member tags** are Outfit 700 at 8px with no pill, from one `MemberTag`
  component. Mono is this app's *data* font; labels are Outfit.

---

## Bugs found and fixed

| # | Symptom | Root cause |
|---|---|---|
| 1 | Blank screen opening one Bloc | `monthInitialIdx` is app-wide, not per-Bloc. The "results are in" banner set it to `0`; opening a Bloc with fewer closed months read past the end of `monthHistory`. Every in-Bloc page mounts at once, so Month threw before Today painted. |
| 2 | Any page crash blanked the whole app | Only Today had an error boundary, and there is none at the root. |
| 3 | Someone who sat out was congratulated | Headline decided by "did you lose money", so everyone exempt fell into the Target Hit branch. |
| 4 | `+£ 0` in celebration type | Winner headline hard-wired to the money. |
| 5 | Perfect month with people who missed | The check only looked at members with stakes. |
| 6 | Old money on player profiles after the backfill | The profile computes its own totals and only asked about solo. |
| 7 | **Backfill appeared to do nothing** | A closed month is *rebuilt from canonical* and replaces the blob's copy wholesale. The rebuild carried `counts`, `excused`, `solo` — not `training`. A write with no matching read is a number that never changes. |
| 8 | No Training Wheels control in Bloc settings | Omission. The create-time switch shipped without the admin default it pairs with, so a Bloc's intent could never be changed afterwards. |
| 9 | Tags looked subtly wrong | `index.html` loads JetBrains Mono at 400/500/700. The tags asked for 800, so the browser synthesised the bold. Also the wrong family: mono is the data font. |
| 10 | "joined mid-month" never appeared | `getJoinedTargetInfo` exists in both the frontend and the API and the copies had drifted — only the API set `prorationSource: "member"`. The frontend returned nothing for that key, so the row compared `undefined` and never matched. |
| 11 | Prorated tag on people with a full target | One branch of that function returns the **base** target while still reporting proration. The tag now requires the member's target to actually be lower than the Bloc's. |
| 12 | Redemption note opened low, page scrolled behind | `PlayerProfile`'s root sets `transform: translateX(0)` and Safari treats any transform as the containing block for `position: fixed` children. Fixed by portalling to `document.body`, per the playbook's existing rule for the photo overlay. |
| 13 | Share metric counted non-shares | `share_month_clicked` fired on the "View the settlement" ledger jump too. |

---

## Database changes

Two migrations, both additive, applied to production and recorded in Supabase
migration history:

- `add_training_wheels_to_season_member_status` — `training_wheels boolean not
  null default false`. All 143 existing rows defaulted to `false`.
- `add_upsert_ante_core_season_member_training` — writer, `service_role` only,
  `anon` and `authenticated` revoked, matching the solo writer.

One existing function was **replaced additively**:
`read_ante_core_month_history` now returns `training_wheels` alongside `solo` in
its members array. Nothing was removed.

### The Sarandawgs correction

Rithu and Deveen were given training wheels for **August 2026 only**, at the
founder's instruction and after confirming nobody had paid.

| | Before | After |
|---|---|---|
| Rithu | owed £15 | £0 |
| Deveen | owed £15 | £0 |
| mindi | collected £30 | £0 |

August did **not** become a Perfect Bloc Month, because two active members
missed the Bloc target — the tightened rule held.

Verified beforehand: no `settlement_runs`, `settlement_entries` or
`settlement_transfers` rows existed for that season, and every
`settlement_status` was null. The before-state (blob revision 2184, no
`training` key, empty settlements) and a two-statement rollback were captured
and handed to the founder. **That rollback is not in the repo.**

---

## Tests

`npm run test:training-wheels` — 19 checks, written before any of the feature
was visible. It deliberately checks *other people's* money, because that is
where this feature does damage if it is wrong: exempting one loser lowers what
the remaining losers pay under the escalating fee, shrinks the winner's
collection to match, and exempting everyone leaves an empty pot rather than a
negative one. It also proves the grant clears at rollover, that a closed month
keeps the record, and that a training month leaves the solo allowance alone.

All 11 runnable suites pass.

**Two suites cannot run at all**: `test:mobile-navigation` and
`test:auth-edge-flows` both import Playwright from a hard-coded absolute path
into another machine's cache (`/Users/opera_user/...`). Pre-existing, unrelated
to this session, and it means onboarding has no automated coverage.

---

## Known gaps

1. **The joiner prompt has never run end-to-end.** The modal and the grant logic
   are tested; the live path — invite, land, prompt, choose, tag — has not
   executed once. The Bloc settings toggle has likewise never been watched
   through a save round-trip. This is the highest residual risk in the session.
2. **Training is not written to canonical at the moment of the grant.** See the
   companion document for the blob-retirement implications; this is the one that
   matters to anyone else's work.
3. `trainingDecisions` has no canonical home at all.
4. The Sarandawgs rollback script exists only outside the repo.

---

## Two lessons worth keeping

**Check that the function you are reading is the one that runs.** Three separate
mistakes this session came from the same habit: claiming the Month Summary shows
`£0` (that code path is unreachable for closed months), verifying the backfill by
feeding the settlement screen an object the app never receives, and declaring the
prorated tag dead from a `grep | head -6` that had truncated the evidence.

**A write with no matching read is not a partial round trip.** It is a value that
silently never changes. Bug 7 was described as a "known limitation" one commit
before it became a user-visible failure.
