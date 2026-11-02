# 2 November 2026 — three retroactive October corrections

**Status: OPEN — plan agreed? not yet. Nothing has been changed in production.**

The founder asked for three corrections to **October 2026** (`2026-9`), the
month that closed on 1 November:

1. **Sweat Equity** (`sweat-equity-saucff`) — **Manz** was meant to sit out and
   never submitted it. Backdate the sit-out.
2. **Ctrl Alt De-feat** (`ctrl-alt-de-feat-ocdti8`) — **Cutie pie** was meant to
   sit out. She has **no yearly sit-out left**; the founder is granting one as an
   exception because she had a hard month.
3. **StavanGang** (`stavanger-4ever-7162hj`) — **Marlène** was meant to be on
   **Solo**. Backdate Solo mode.

In all three cases the money and the standings must come out right everywhere:
History, Profile, the month results, and every other member's screen.

---

## 1. Up to speed (§0)

- `git fetch` clean. This checkout is **level with `origin/main`** at `8555514`
  (0 ahead, 0 behind). 8 worktrees, 4 untracked `.dmg` backups in the folder —
  all pre-existing, left alone.
- Newest handover read: [`handover-2026-11-01-month-close.md`](handover-2026-11-01-month-close.md).
  The 1 November close worked; all 13 Blocs froze October and opened November.
- Live production is `6203152` per that handover; nothing has shipped since.
  **No code change is needed for this task**, so no deploy is planned.

### Blocker found: the Supabase MCP cannot reach the Fero project

`execute_sql` against `bpvvvqjsfwmmfjvvijkd` returns
`You do not have permission to perform this action`, and `list_projects` returns
only two unrelated projects (`LifeOS`, `Runway`). **Arbitrary SQL and
`apply_migration` are not available this session.**

Everything needed is still reachable with `SUPABASE_SERVICE_ROLE_KEY` from
`.env.local`, exactly as the repo's own scripts do it:

- the blob over PostgREST (`/rest/v1/lift_log_state`, `/rest/v1/lift_log_backups`)
- canonical through the existing service-role-only RPCs (§4)

The one consequence is for rollback — see §6.

---

## 2. Before-state, read from production

Blob revision **3395**, read 2026-11-02 11:52 UTC. Saved to the scratchpad as
`blob-2026-11-02.json`; canonical read through
`read_ante_core_month_history` and saved as `canon-month-history.json`.

**Correction to [`SCHEMA.md`](SCHEMA.md):** a `monthHistory` entry's month field
is **`key`**, not `monthKey`. `SCHEMA.md` Part 1 says `month.monthKey`, which
matches nothing in production. Not edited — flagged for the founder.

### Sweat Equity, October — target 12, fine 20 USD, step 5, escalating

| Member | Workouts | Excused | Solo |
| --- | --- | --- | --- |
| imadh | 29 | — | — |
| Shaq | 19 | — | — |
| Aadhil | 19 | — | — |
| Krish | 14 | — | — |
| Kisal | 12 | — | — |
| **Manz** | **0** | no | — |
| Janek | 0 | **yes** | — |

`monthHistory['2026-9'].settlements` is `{}`. Canonical `settlement_status` is
`null` for every member.

### Ctrl Alt De-feat, October — target 12, fine 200 NOK, step 50, escalating

| Member | Workouts | Excused | Solo |
| --- | --- | --- | --- |
| Giang | 20 | — | — |
| Aadhil | 19 | — | — |
| enrico | 16 | — | — |
| Monika | 12 | — | — |
| Varun | 9 | — | Solo, target 6 |
| Bianković | 8 | — | Solo, target 6 |
| Rodri | 6 | — | Solo, target 6 |
| **Cutie pie** | **2** | no | — |

`settlements` = `{ "Cutie pie": { status: "outstanding" } }`. Canonical
`settlement_status` is `null` for everyone, including her — the gap recorded in
§4 of the 1 November handover.

### StavanGang, October — target 10, fine 10 EUR, step 5, escalating

| Member | Workouts | Excused | Solo |
| --- | --- | --- | --- |
| Isira | 19 | — | — |
| Aadhil | 19 | — | — |
| Dasha the Legend | 15 | — | — |
| Masha | 14 | — | — |
| Juju B | 10 | — | Solo, target 5 |
| Bananaaaa | 7 | — | Solo, target 5 |
| **Marlène** | **6** | no | — |

`settlements` is `{}`. Canonical `settlement_status` is `null` for everyone.

### Auth user ids (needed by the canonical RPCs)

| Member | Bloc | auth_user_id |
| --- | --- | --- |
| Manz | sweat-equity-saucff | `cbdd2ac0-a5e3-4f03-a52e-d3b7356176bd` |
| Cutie pie | ctrl-alt-de-feat-ocdti8 | `3af50f1e-70f9-4b70-acea-e118381515ee` |
| Marlène | stavanger-4ever-7162hj | `c7913303-702c-459c-8cc1-fb3bbbc133bb` |

Aadhil (Bloc Admin of all three): `768de245-5b17-4292-b91c-804daaa3b217`.

---

## 3. What the money becomes

Amounts are **computed**, not stored: `calcPenalties` in
`api/lift-log.js` / `src/lib/appState.js`. Excused and Solo members are dropped
from `activeCounts` before it runs, so every other member's figure moves with
them. Working shown so the founder can check it.

### Sweat Equity

| | Before | After Manz sits out |
| --- | --- | --- |
| Winner | imadh (29) | imadh (29) |
| Losers | **Manz** | none |
| Manz owes | **20 USD** | **0** |
| imadh receives | **20 USD** | **0** |

Kisal is on exactly 12 and was never a loser. Nobody else is affected.

### Ctrl Alt De-feat

| | Before | After Cutie pie sits out |
| --- | --- | --- |
| Winner | Giang (20) | Giang (20) |
| Losers | **Cutie pie** | none |
| Cutie pie owes | **200 NOK** | **0** |
| Giang receives | **200 NOK** | **0** |

The three Solo members (Rodri 6/6, Varun 9/6, Bianković 8/6) all cleared their
Solo goal, so none of them owes anything either way.

### StavanGang

| | Before | After Marlène goes Solo (target 5) |
| --- | --- | --- |
| Winners | Isira & Aadhil (19) | Isira & Aadhil (19) |
| Losers | **Marlène** | none |
| Marlène owes | **10 EUR** | **0** |
| Isira receives | **5 EUR** | **0** |
| Aadhil receives | **5 EUR** | **0** |

**This is target-dependent.** Solo from October 2026 runs on the new rules
(`SOLO_STANDARD_PENALTY_FROM = "2026-9"`): missing the Solo goal costs the flat
standard fine. Marlène logged **6**.

- target **5 or 6** → she clears it, owes **0**
- target **7 or more** → she owes the flat **10 EUR**, and Isira and Aadhil take
  5 EUR each

### Side effect: two of the five parity-gate mismatches go away

The 1 November handover's §4 lists five members marked `outstanding` in the blob
with nothing in canonical. **Manz and Cutie pie are two of those five.** Once
they are excused, neither is outstanding on either side, so
`historical-settlement-parity` should drop from 5 mismatches to 3. The remaining
three (Emma, Rishane, Ashanee) are untouched and still need the founder's
decision.

### Side effect: yearly allowance

Approved sit-outs are counted per calendar year per Bloc from the
`monthHistory` entries (`getYearlyAllowanceUsage`, 2 sit-outs and 3 Solo months
a year).

- **Manz** has used none in 2026. October becomes his first: **1 of 2 left.**
- **Cutie pie** has already used 2026-6, 2026-7 and 2026-8 — so she is already
  past the allowance, which is why this one is being granted as an exception.
  Her request will be recorded with `exceptional: true`, matching how her
  September one was recorded.
- **Marlène** has used no Solo months in 2026: October becomes her first, **2 of
  3 left.**

---

## 4. The plan, exactly

No code change. No deploy. Production data only, in both stores, because the
read path overlays canonical onto the blob only where both agree (§6 of
`AGENTS.md`) — leaving one side behind is what produces a wrong screen.

**Step 0 — backup.** Insert a fresh row into `public.lift_log_backups` holding
the current `state` and `revision` 3395, reason
`manual:2026-11-02-october-sitouts-and-solo`. Confirm the row exists before
anything is written.

**Step 1 — the blob**, one PATCH of `public.lift_log_state`, with the revision
bumped. Inside `monthHistory` entry `key = "2026-9"`:

| Bloc | Change |
| --- | --- |
| sweat-equity-saucff | `excused["Manz"] = true` |
| ctrl-alt-de-feat-ocdti8 | `excused["Cutie pie"] = true`; delete `settlements["Cutie pie"]` → `{}` |
| stavanger-4ever-7162hj | `solo["Marlène"] = { rule: "standard_penalty", target: <agreed> }` |

and, at Bloc level, an **approved** request record so the month reads as a
sit-out / Solo rather than an unexplained excuse:

| Bloc | Change |
| --- | --- |
| sweat-equity-saucff | `sitOutRequests["2026-9"]["Manz"]` — approved, `exceptional: false` |
| ctrl-alt-de-feat-ocdti8 | `sitOutRequests["2026-9"]["Cutie pie"]` — approved, `exceptional: true` |
| stavanger-4ever-7162hj | `soloRequests["2026-9"]["Marlène"]` — approved, `personalTarget: <agreed>` |

Each recorded as decided by **Aadhil**, `autoApproved: false`, reason left empty
(the precedent in Cutie pie's 2026-6 and 2026-7 records), `requestedAt` and
`decidedAt` stamped today with a note in this handover that they are backdated
entries, not live ones.

`settlements` for Sweat Equity and StavanGang is already `{}` and recomputes to
`{}`, so neither is touched. Live `group.excused` / `group.solo` hold the **open**
month only and are not touched.

**Step 2 — canonical**, through the existing service-role-only RPCs. Nothing
here is new; these are the same calls the app itself makes when an admin
approves a request, and the excused RPC documents closed-season retroactive
approval as a supported case.

| Call | For |
| --- | --- |
| `upsert_ante_core_season_member_excused` | Manz, Cutie pie |
| `upsert_ante_core_sit_out_request` | Manz, Cutie pie |
| `upsert_ante_core_season_member_solo` | Marlène |
| `upsert_ante_core_solo_request` | Marlène |

`update_ante_core_season_member_settlement` is **not** needed: every October
`settlement_status` is already `null`.

**Step 3 — verify, before saying a word about it being done.**

1. Re-read the blob and diff it against `blob-2026-11-02.json` — assert the
   changed paths are exactly the ones in Step 1 and **nothing else moved**.
2. Re-read `read_ante_core_month_history` and assert `excused` / `solo` /
   `solo_target` match, and that no `workout_count` changed.
3. Recompute the amounts with the app's own `calcPenalties` against the written
   state and assert the table in §3.
4. `npm run parity:gate` and confirm the mismatch count falls 5 → 3.
5. Load the real screens at 375×812 — History and Profile for each of the three
   members **and** for an affected other member (imadh, Giang, Isira) — and
   confirm the figures and the "sat out" / "Solo" labels.

---

## 5. The one open question

**Marlène's Solo personal target for October.** Recommended: **5** — the same
target the other two StavanGang Solos got for the same month (Juju B and
Bananaaaa). At 5 she clears it with her 6 workouts and owes nothing, which
matches the intent of backdating a Solo she was meant to have.

Nothing will be written until this is answered.

---

## 6. Rollback, honestly

| What | How | One statement? |
| --- | --- | --- |
| The blob | Restore the Step 0 backup over `lift_log_state` | Yes |
| Canonical `excused` (Manz, Cutie pie) | `upsert_ante_core_season_member_status` with `p_excused: false` and the original `workout_count` (0 and 2) | Yes, one call each |
| Canonical `solo` (Marlène) | **No RPC can clear it.** `upsert_ante_core_season_member_solo` only ever sets `solo = true` | **No** |

Clearing Marlène's canonical Solo flag would need one `update` statement against
`ante_core.season_member_status`, and SQL access is not available this session
(§1). The app itself has no un-Solo path either — a Solo month is never revoked
in the product — so this is forward-only by design rather than an oversight, but
it should be said out loud before the write, not after.

---

## 7. Files touched

| File | Change |
| --- | --- |
| `docs/handover-2026-11-02-october-sitouts-and-solo.md` | this file, new |
| `docs/HANDOVERS.md` | one line added at the top of the November section |

**Nothing else was modified. No production data has been changed, and nothing
has been deployed.**
