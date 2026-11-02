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

---

## 14. History page and All Time leaderboard — verified after the fact

The founder asked, after the writes had landed, whether the History screens and
the All Time leaderboard had adjusted too. They had, and here is the evidence
rather than an assurance.

`src/pages/HistoryPage.jsx` and `src/pages/PlayerProfile.jsx` both **recompute**
the money from `monthHistory` on every render — they do not read the stored
`settlements` map. So the figures follow `excused` and `solo` directly. Both
files use the same helpers in the same order (`isExemptFromStakes`,
`isStandardPenaltySoloForMonth`, `getStandardSoloMisses`, `calcPenalties`,
`addStandardSoloPenalties`, `getLoserAmount`), which is why the profile and the
leaderboard agree.

The check re-ran HistoryPage's exact `allTime` loop against the live blob
(revision 3398) for all three Blocs, with `syncActiveGroupGlobals(group)` giving
each Bloc its own `NAMES` / `MIN_TARGET`:

| Bloc | October winners | October losers | Settlement pairs |
| --- | --- | --- | --- |
| Sweat Equity | imadh, perWinner 0 | none | `[]` |
| Ctrl Alt De-feat | Giang, perWinner 0 | none | `[]` |
| StavanGang | Isira + Aadhil, perWinner 0 | none | `[]` |

Per subject, on the All Time rows:

- **Manz** — `excused["Manz"] = true`, so `isActualParticipant` is false for
  October: the month drops out of his total (6) and his month count (2), and
  the money loop `return`s before any fee. Correct; an excused month has never
  counted as participation.
- **Cutie pie** — same, total 5 over 2 months, out of the money loop.
- **Marlène** — `solo["Marlène"]["2026-9"] = {standard_penalty, 5}`. She is
  *not* skipped, because a new-rules Solo miss still costs money, but her count
  of 6 clears the Solo goal of 5, so `getStandardSoloMisses` returns nothing for
  her and she is neither winner nor loser. October still counts toward her total
  (29) and average (7.0), which is how Solo already works for Juju B and
  Bananaaaa in the same Bloc — Solo excludes a member from the pot, not from the
  stats.

The three "Bloc Legacy" awards were recomputed too. Nothing on them names a
subject wrongly, but one pre-existing oddity surfaced and was **left alone**:
in a Bloc where no current member has ever lost money, "Biggest loser" still
names whoever sorts first at 0. In Ctrl Alt De-feat every historical loss
(200 NOK × 3) belongs to `akijain2000`, who has left the Bloc and so is not in
`allTimeVisibleNames`; the Bloc shows 600 NOK won and 0 lost. That is the
existing left-member rule, not a consequence of this session's writes. Not
touched, not in scope.

`FounderDashboard.jsx` also matches `allTime`, but only as a usage-analytics
window name — it has no leaderboard. Nothing to check there.

Verification script:
`/private/tmp/.../scratchpad/history-check.mjs` (scratch, not committed).

## 15. Why the repo's docs are in the founder's work Google Drive

Not something any agent did. Google Drive for Desktop is running as
`aadhilj@opera.com` and **mirrors the whole `~/Documents` folder** — the mirror
roots in `~/Library/Application Support/Google/DriveFS/<account>/mirror_sqlite.db`
are exactly `Downloads`, `Desktop` and `Documents`. The repo lives at
`~/Documents/Codex Space/Lift Log`, so every file in it is uploaded. Counted
from that database: **16,533 files from this repo are in the work Drive, 584 of
them `.md`.** Google Docs lists `.md` files under "Recent documents", which is
why `HANDOVERS.md` and the handover docs appear there. The 1:33 PM timestamps
are simply when this session wrote and committed those files.

Two things in that upload matter more than the noise:

- **`.env.local` is in the work Drive, uploaded.** It holds the production
  Supabase service role key. Rotating it is the founder's call.
- The four `Fero-*-2026-08-31.dmg` backups in the working directory are up
  there too, including the 594 MB private-recovery image.

Nothing was changed. Turning the mirror off is a setting in the Drive app
(Preferences → Folders from your computer) and belongs to the founder, as does
any decision to rotate the key. The longer-term fix is the one CLAUDE.md §12
already prescribes: work from `~/Developer`, which is synced by nothing.

---

## 16. Live app health check, 2 November

The founder asked for a full check of the live app — Vercel, speed, breakages.
One real problem found, and it is one this repo already documented.

### Healthy

| Checked | Result |
| --- | --- |
| Vercel production deployment | `7484583514`, commit `8555514`, **success**, built in 12s |
| Build log | clean; only the known >500 kB chunk advisory |
| `https://lift-log-nu.vercel.app` | HTTP 200, TTFB 52–85 ms over three calls |
| `index.js` / `index.css` / manifest / icon | all HTTP 200, 62–209 ms |
| Signed-out app in the browser pane | renders; DOMContentLoaded **208 ms**, load 209 ms |
| Console | no errors; one known warning (below) |
| Network tab | 4 requests, all 200 |
| `GET /api/lift-log` unauthenticated | 401 in 175 ms — correct |
| `npm run lint` | clean |
| `npm run build` | clean, 1.39s |
| 23 `test:*` suites | all pass |

`origin/main` is `8555514` and that is what is live. The only local commits are
this session's docs, so **the live code is current**.

The one console warning — "Multiple GoTrueClient instances detected" — is
pre-existing and already recorded in `extraction-record-2026-07-09.md` §62: two
`window.supabase?.createClient` call sites (`src/App.jsx:1210`,
`src/lib/api.js:198`) build two auth clients over one storage key. Not new, not
touched.

`test:profile-stats-cache` prints `profile-stats failed: Request failed` twice
and then `all cache checks passed`. That is the test exercising its deliberately
offline paths; the script's own header says the request paths are verified
against a deployed preview instead. Not a failure.

Not run: `test:month-close-canonical`, `test:remirror`,
`test:profile-photo-storage`, `test:account-deletion` — they need the sandbox or
production write access, and no application code changed.

### The real problem: the database is slow from cold

A single-row, single-column read of `lift_log_state` — the cheapest query in the
system — measured from this laptop, with network time isolated (connect 15–21 ms,
TLS 33–41 ms throughout, so none of this is the network):

| Call | TTFB |
| --- | --- |
| first, after idle | **70.0 s** |
| second | 6.1 s |
| first of a later series | **29.2 s** |
| second | 4.2 s |
| third | 0.25 s |
| first of a third series | **13.8 s** |
| then decaying | 6.2 → 1.3 → 0.17 → 0.14 s |
| later in the same series | drifts back to 0.5–1.7 s |

Through the app's own API the same pattern appears as outright failure:

- `POST /api/lift-log {"action":"load"}` → **500 after 63 s**, with
  `{"code":"57014","message":"canceling statement due to statement timeout"}`.
- A second attempt → no response at all within 90 s.
- `POST /api/lift-log {"action":"zzz-not-a-real-action"}` → the correct
  `400 Unsupported POST action`, but **after 68 s**. That path touches no
  database at all (the state getters at `api/lift-log.js:10106` are lazy), so
  the function itself was waiting on a starved connection, not on a query.

Once warm, everything is fine: `read_ante_core_month_history` returns 1.40 MB in
0.44–1.19 s and the full blob returns 1.06 MB in 0.16–0.33 s.

### This is the September incident, unfixed

`scaling-before-launch-2026-09-15.md` is the same thing, and its status line
still reads **"must be done before launch. Nothing below has been started."**
`state-of-play-2026-09-26.md:54` confirms: "Scaling — the five-simultaneous-user
traffic incident. Not started."

That document's evidence was the matching one: `57014` statement timeouts on
`read_ante_core_month_history`, CPU "~95%, almost all IOwait", "Memory — Free
near zero throughout", on **Micro** compute (2-core shared ARM, 1 GB RAM). Its
reading was "the CPU was not busy computing; it was waiting on disk."

September saw it as a burst problem — 2–4 phones at once. Today's measurement
shows the same starvation with **nobody using the app**, which fits the same
cause: with 1 GB of RAM and no free memory, nothing stays cached, so the first
read of a quiet period comes off disk.

One number has moved the wrong way. §2.6 of that doc recorded
`public.lift_log_backups` at **315 MB of the 344 MB database, 2,475 full blob
copies**. Counted today over PostgREST: **3,484 rows**. At ~1.06 MB per copy
that is roughly **440 MB** of backups — around 1,000 more copies than in
September, and still the overwhelming majority of the disk and cache footprint
on a 1 GB instance. Two of those 1,000 are this session's (3484, 3485).

### Not done, deliberately

Nothing was changed. The compute size is a dashboard setting and a ~2 minute
outage (that doc §4 Step 0 recommends **Small**, 2 GB, ~$15/month, and the Pro
plan's $10 credit comes off it); trimming `lift_log_backups` is a destructive
production change and §2.6 says explicitly not to delete anything without a
fresh backup. Both are the founder's calls. The real fix is the code work in
§4 of that document, which is Deveen's area and still unstarted.

I could not read the current compute size or the live CPU/memory charts: the
Supabase MCP has no access to project `bpvvvqjsfwmmfjvvijkd` (§1 of this
handover), so "Micro" is the September record, not a reading from today.

### Correction to §16 — it is an episode, not a cold-start rule

§16 above reads the timings as "slow from cold: the first read of a quiet period
comes off disk". **That framing is wrong and is corrected here.** The
confirmation test was run after §16 was written, and it did not reproduce:

| Time (UTC) | Test | Result |
| --- | --- | --- |
| 14:44:49 | trivial read after **8 minutes fully idle** | **1.63 s** |
| 14:44:51 | same read immediately after | 0.28 s |
| 14:45:10 | trivial read × 5 | 0.57 / 0.29 / 0.18 / 0.21 / 0.29 s |
| 14:45:1x | full 1.06 MB blob read × 3 | 0.49 / 0.30 / 0.24 s |
| 14:45:2x | the API POST that took **68 s** earlier | **400 in 2.11 s** |

So the stalling was an **episode**, roughly 14:10–14:30 UTC on 2 November, not a
standing property of an idle database. Everything measured after it is normal.
An 8-minute idle produced 1.63 s, not the 13–70 s §16 predicts.

What stands, and what does not:

- **Stands.** The episode happened and was measured repeatedly: a 57014
  statement timeout after 63 s, a 90 s no-response, a 68 s reply on a path that
  touches no database, and 70 s / 29 s / 13.8 s on the cheapest query in the
  system, with network time isolated throughout. That is the September
  signature.
- **Stands.** `lift_log_backups` at 3,484 rows (~440 MB) against September's
  2,475 (315 MB of a 344 MB database), on 1 GB of RAM.
- **Does not stand.** Any claim that this reproduces on demand after a quiet
  spell. It did not.
- **Not known.** What triggered it. One candidate is this check itself: the
  measurements repeatedly pulled the full 1.06 MB blob and the 1.40 MB
  `read_ante_core_month_history`, and §2.1 of the scaling doc is precisely that
  a few clients doing full-app reads starve a Micro instance. If that is what
  happened, this check **reproduced** the September incident from one laptop
  rather than finding a new fault, which would make the case for §4 of that
  document stronger, not weaker. But the Supabase logs and the CPU/memory charts
  are the only things that would settle it, and the MCP has no access to project
  `bpvvvqjsfwmmfjvvijkd`. Not guessed at further.

Even healthy, a one-row one-column read sits at 0.18–0.57 s where it should be
nearer 0.05 s, and a warm API round trip is 2.11 s. Slower than it ought to be,
but not the thing a member would call broken.
