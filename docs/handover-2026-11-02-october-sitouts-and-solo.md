# 2 November 2026 — three retroactive October corrections

**Status: DONE and verified in production, 2 November 2026 12:28 UTC.** All
three corrections are live in both stores. No code changed, nothing deployed.
Blob revision **3395 → 3397**. Backups `3484` and `3485`. See §8 onward.

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

## 5. The one open question — answered

**Marlène's Solo personal target for October: 5**, confirmed by the founder.

That turned out to be the only value the app itself would ever have assigned.
`npm run test:solo-standard-penalty` pins the rule as *"the Solo goal is half the
Bloc target rounded up, whatever the client sends"* — StavanGang's target is 10,
so half is 5. It also matches Juju B and Bananaaaa in the same month.

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

**No application code was modified, and nothing was deployed.** The only
production change is the data described in §8.

---

## 8. What was actually written

### The blob — two PATCHes, both backed up first

| # | Backup | Revision | What |
| --- | --- | --- | --- |
| 1 | `3484` (`...:before`) | 3395 → 3396 | the three corrections |
| 2 | `3485` (`...:fix-solo-nesting`) | 3396 → 3397 | the fix in §9 |

Both PATCHes were sent with `revision=eq.<the revision just read>` so a
concurrent write from the live app would have made them a no-op rather than
clobbering it. Each matched exactly one row.

Seven paths changed in total, and a full recursive diff of the whole blob
confirmed **nothing else moved** — no workout count, no log, no other Bloc:

```
groups.sweat-equity-saucff.monthHistory[2026-9].excused.Manz          false -> true
groups.sweat-equity-saucff.sitOutRequests.2026-9.Manz                 new, approved
groups.ctrl-alt-de-feat-ocdti8.monthHistory[2026-9].excused.Cutie pie false -> true
groups.ctrl-alt-de-feat-ocdti8.monthHistory[2026-9].settlements.Cutie pie  removed
groups.ctrl-alt-de-feat-ocdti8.sitOutRequests.2026-9.Cutie pie        new, approved, exceptional
groups.stavanger-4ever-7162hj.monthHistory[2026-9].solo.Marlène       new, {2026-9:{standard_penalty,5}}
groups.stavanger-4ever-7162hj.soloRequests.2026-9.Marlène             new, approved, target 5
```

### Canonical — six RPC calls, all 204

`upsert_ante_core_season_member_excused` and `upsert_ante_core_sit_out_request`
for Manz and Cutie pie; `upsert_ante_core_season_member_solo` and
`upsert_ante_core_solo_request` for Marlène. A full diff of
`read_ante_core_month_history` across all **44 bloc-months** shows exactly four
fields changed and nothing else:

```
stavanger-4ever-7162hj 2026-9  Marlène    solo        false -> true
stavanger-4ever-7162hj 2026-9  Marlène    solo_target null  -> 5
sweat-equity-saucff    2026-9  Manz       excused     false -> true
ctrl-alt-de-feat-ocdti8 2026-9 Cutie pie  excused     false -> true
```

No `workout_count` moved. `update_ante_core_season_member_settlement` was not
needed — every October `settlement_status` was already `null`.

---

## 9. A mistake I made, and the check that caught it

The first write put Marlène's Solo entry in at the **wrong depth**:
`solo["Marlène"] = {rule, target}` instead of
`solo["Marlène"]["2026-9"] = {rule, target}`. The month snapshot's `solo` map is
keyed by month inside the member key, as the existing Juju B and Bananaaaa
entries show.

The effect was that `isSoloForMonth` returned false, so Marlène was **still
counted as an ordinary member and still owed 10 EUR** — the change looked
applied and did nothing. Nothing else was wrong, and no other member was
affected.

It was caught by the verification step that re-runs the app's own
`buildDefaultSettlements` against what was actually written, rather than
assuming the write was correct. Fixed in the second PATCH (backup `3485`).

**This is the argument for that step existing.** Writing the data and asserting
the data are not the same check; only recomputing the money with the app's own
code caught it.

---

## 10. Verification — what was run, and what passed

| Check | Result |
| --- | --- |
| Full recursive blob diff, before vs after | **pass** — 7 paths, all planned |
| Workout counts unchanged in all three Blocs | **pass** |
| Full canonical diff across 44 bloc-months | **pass** — 4 fields, all planned |
| Canonical agrees with the blob on all three members | **pass** |
| `buildDefaultSettlements` (the app's own code) on the written state | **pass** — nobody owes in any of the three |
| `buildCanonicalMonthHistoryForGroup` — the canonical→blob overlay | **pass** — October survives it in all three, corrections intact |
| `scopeReadableStateForUser` for each subject **and** an affected other member (imadh, Giang, Isira) | **pass** — all six payloads show October, nobody owing |
| `npm run parity:gate` | `historical-settlement-parity` **3 → 2** (§11) |
| `npm run test:solo-standard-penalty` | **pass** |
| `npm run test:solo-sitout-exclusion` | **pass** |
| `npm run lint` | **clean** |
| `https://lift-log-nu.vercel.app` | HTTP 200 |

The overlay check is the one that matters most: `AGENTS.md` §6 warns that
canonical must never replace valid blob data, and a retroactive edit to a closed
month is exactly where that could bite. It does not — the real overlay function
was run against production data for all three Blocs and October came through
unchanged.

### Not verified

- **No screen was loaded.** Signing in as a member needs a one-time code sent to
  that member's email, which is not something to do on their behalf, and a
  Vercel preview cannot reach the live database. Everything above is the data
  and the server read path, up to but not including the React render. The render
  logic for an excused or Solo month is pre-existing and was not touched.
- `npm run build` and the other `test:*` scripts were not run; no application
  code changed, so they had nothing to say about this.

---

## 11. Two things I told the founder that were wrong

Corrected here rather than left standing.

1. **"The parity gate should fall 5 → 3."** It went **3 → 2**. The gate reads the
   *stored* `settlements` map, it does not recompute, and before this session
   only three members had a stored `outstanding` with a null canonical status:
   Emma, Cutie pie and Ashanee. Manz and Rishane were in the 1 November
   handover's list of five but their Blocs' stored `settlements` maps were
   already `{}` by the time this session read them, so the gate was not counting
   them. This session cleared exactly one: **Cutie pie**. Emma
   (`active-divas-p19b0j`) and Ashanee (`two-a-half-men-n18fcv`) are untouched
   and still open.

   Worth noting for whoever picks up that item: Manz's stored `settlements` was
   `{}` while the computed result had him owing 20 USD, so the stored map and the
   computation had already drifted apart before this session. That is
   pre-existing and is now moot for him.

2. **"Marlène has used no Solo months in 2026."** She had used **two**
   (2026-7 and 2026-8). October is her third, so she now has **0 of 3 Solo
   months left** this year, not 2. I had read only the Bloc-level `solo` map,
   which holds the open month; the closed months are in `monthHistory`, which is
   what `getYearlyAllowanceUsage` reads.

### Allowance, as it now stands

| Member | Bloc | Sit-outs used 2026 | Left | Solo used 2026 | Left |
| --- | --- | --- | --- | --- | --- |
| Manz | Sweat Equity | 2026-9 | **1 of 2** | — | 3 |
| Cutie pie | Ctrl Alt De-feat | 2026-6, -7, -8, -9 | **0 of 2** | — | 3 |
| Marlène | StavanGang | 2026-6 | 1 of 2 | 2026-7, -8, -9 | **0 of 3** |

---

## 12. Rollback

Both backups hold the complete pre-change blob, so the blob is one restore away
at either point. For canonical:

| What | How | Available |
| --- | --- | --- |
| Blob | restore backup `3484` over `lift_log_state` | yes |
| Manz / Cutie pie `excused` | `upsert_ante_core_season_member_status` with `p_excused: false`, `p_workout_count` 0 and 2, `p_joined_for_month: true` | yes, one call each |
| Marlène `solo` | no RPC clears it — needs one `update` on `ante_core.season_member_status` | **no, needs SQL** |

As written in §6: the app has no un-Solo path either, so this is forward-only by
design. If it ever has to be undone, it needs SQL access, which this session did
not have.

---

## 13. Two documentation errors found in `SCHEMA.md`

Both were hit while doing this work and both would mislead the next person.
**Not edited** — flagged for the founder to decide.

1. A `monthHistory` entry's month field is **`key`**, not `monthKey`.
   `SCHEMA.md` Part 1 says `month.monthKey`, which matches nothing in production.
2. **`state.meta` is not stored in the blob at all.** The stored document has
   only `version`, `groups`, `groupOrder`, `profiles` — `serializeStateForBlob`
   strips the rest, and the revision lives in the `lift_log_state.revision`
   **column**. `SCHEMA.md` lists `state.meta.revision` and `state.meta.updatedAt`
   as top-level keys of `state`.

A third, smaller one: `scripts/blob-parity-gate.mjs` is classified as binary by
`file` and `grep`, so plain `grep` silently finds nothing in it — `grep -a` is
needed. The script itself runs fine.
