# 1 November 2026 — the month close check

**The close worked.** All 13 Blocs froze October (`2026-9` — month keys are
zero-indexed) and opened November (`2026-10`). The frozen counts are exact, and
the App Store review Bloc has **no fines**, which was the one thing that had to
go right.

**One real problem, not fixed:** five members were marked as owing money in the
legacy blob, and the matching flag was **not** written into canonical. The money
itself is correct; only the canonical copy of the status is missing. `npm run
parity:gate` fails on it. Details in §4.

Written by the scheduled task `fero-month-close-check-1-nov`. Nobody was at the
keyboard, so **nothing was changed in production** — this is a read-only report.

- **Nothing was deployed.** Live production is `6203152`, the same commit as
  `origin/main` and as this checkout. The live site returns HTTP 200.
- This is the first full close since the daily cap became **two per activity**
  on 22 October, and the first since the skipped-Bloc read-path fix of
  19 October (`1c23241`).

---

## 1. The pre-close snapshot it was compared against

`migration-output/month-close/before.json`, captured 30 October 12:14 UTC at
blob revision 3350: closing key `2026-9`, 13 Blocs, 13 open seasons on `2026-9`,
687 current logs, all 687 carrying an activity.

## 2. Scripted checks

| Step | Result |
| --- | --- |
| `node scripts/month-close-check.mjs --after --month-key 2026-9` | **pass** — 4 OK, 1 warning-only (§3) |
| `npm run parity:gate` | **1 failure**, 1 warning — see §4 and §5 |
| `npm run test:month-close-canonical` | **pass** — all 25 cases |

`--month-key 2026-9` was passed explicitly. The script defaults to `2026-8`,
which is the September close it was first written for.

The month-close script reported blob revision 3383 (was 3350) and:

```
[OK  ] all blocs rolled forward       0 blocs still open on 2026-9
[OK  ] closing month archived         13 closed seasons for 2026-9, expected >= 13
[OK  ] logs survived the close        726 archived vs 687 open before
[OK  ] activities survived the close  726 archived with activity vs 687 before
[WARN] no blocs skipped               100 skipped: ...
```

**The parity gate had to be run twice.** The first run died before finishing:
`/rest/v1/rpc/read_ante_core_bloc_members network failure: ECONNRESET`. That is
a dropped connection, not a parity result — this machine's link to Supabase was
slow throughout (a trivial Management API query took about two minutes). The
retry completed and produced the report in §4.

## 3. The 100 "skipped" warnings are all from 1 October — not today

The warning line looks alarming and is the first thing anyone will see, so it is
worth being precise: **every one of those 100 events is historical.**

- All of them name month `2026-8`, which is **September**, not the month that
  just closed.
- The newest row in `ante_core.system_events` is from **2026-10-01 04:46 UTC**.
- Events recorded since 31 October: **0**.

The script reads the last 100 system events and does not filter by date, so
after a clean close it still replays the 1 October incident. Nothing was skipped
this time.

## 4. The one failure: October's fines are missing from canonical

`historical-settlement-parity` — 5 mismatches, all in `2026-9`. In every case the
blob says `outstanding` and canonical's `season_member_status.settlement_status`
is `null`:

| Bloc | Member | Workouts | Target | Fine | Blob | Canonical |
| --- | --- | --- | --- | --- | --- | --- |
| `active-divas-p19b0j` | Emma | 0 | 11 | 100 | outstanding | — |
| `ctrl-alt-de-feat-ocdti8` | Cutie pie | 2 | 12 | 200 | outstanding | — |
| `legacy-group` | Rishane | 3 | 12 | 20 | outstanding | — |
| `sweat-equity-saucff` | Manz | 0 | 12 | 20 | outstanding | — |
| `two-a-half-men-n18fcv` | Ashanee | 0 | 15 | 500 | outstanding | — |

**The money is right.** All five genuinely missed their target, none is
`excused`, none has a prorated target, and all five were active that month
(`joined_for_month` true). The close did the arithmetic correctly.

**What is missing is only canonical's copy of the flag.** Supporting facts:

- `ante_core.settlement_runs`, `settlement_entries` and `settlement_transfers`
  are **empty — all time, 0 rows each.** No settlement run has ever happened, so
  nothing was going to populate these as a side effect of one.
- Canonical does hold four settlement statuses, and they were therefore written
  by something other than a run: `2026-3` Rishane `settled`, and three
  `outstanding` rows in `2026-5`.
- June, July, August and September pass this check only because **nobody owed
  anything in those months** — the blob has no settlement entries for them
  either. October is the first month since May 2026 in which anyone was marked
  outstanding at all.

So the mirror managed this in May and did not manage it now. **What I cannot
tell from read-only evidence** is whether May's rows were written by the close
itself or patched in by hand later — several handovers record manual data
corrections. That is the difference between "a regression landed since May" and
"a gap that has always been there and only became visible now", and it needs
Deveen or the founder to settle.

**Likely member impact: none, but unverified.** `AGENTS.md` §6 says the blob wins
on doubt and canonical must not overlay an empty result, so the five should still
see what they owe. I did not load a screen to confirm it.

**Nothing was changed.** No fix was attempted — the task is read-only unless the
founder has said to fix something.

## 5. The other parity warning is benign

`open-season-log-parity` warned with `phantomCount: 0` and two canonical logs not
yet in the blob — both the same 1 November workout by **imadh**, mirrored to
`sweat-equity-saucff` and `two-a-half-men-n18fcv`. The gate's own note says this
is expected while `add-log` sits in `BLOB_MIRROR_SKIP_ACTIONS`, and phantoms
(blob-only logs, which would eat daily cap slots) are the failing condition —
there are none. `blockedFromLoggingToday` is empty.

## 6. The checks run by hand, in SQL

### a. Did every Bloc close October? Yes — 13 of 13

`seasons` on `2026-9` with `closed_at is null`: **0**.

### b. Did every Bloc open November? Yes — 13 of 13

Every Bloc has a `2026-10` season; none is missing.

### c. Do the frozen counts match the snapshot? Yes, exactly

| Bloc | Frozen | Logs in season | In `before.json` | Delta |
| --- | --- | --- | --- | --- |
| `active-divas-p19b0j` | 14 | 14 | 14 | 0 |
| `ctrl-alt-de-feat-ocdti8` | 92 | 92 | 88 | +4 |
| `curke-jxzdka` | 18 | 18 | 15 | +3 |
| `fimctive-nkek3n` | 0 | 0 | — | — |
| `lazy-no-more-dn48xd` | 0 | 0 | — | — |
| `legacy-group` | 110 | 110 | 104 | +6 |
| `osi-h3-9pmkuy` | 157 | 157 | 151 | +6 |
| `sarandawgs-qblka3` | 63 | 63 | 61 | +2 |
| `stavanger-4ever-7162hj` | 90 | 90 | 86 | +4 |
| `sunday-warriors-yr392c` | 64 | 64 | 64 | 0 |
| `sweat-equity-saucff` | 93 | 93 | 84 | +9 |
| `trying-times-i8d33x` | 0 | 0 | — | — |
| `two-a-half-men-n18fcv` | 25 | 25 | 20 | +5 |
| **total** | **726** | **726** | **687** | **+39** |

The frozen count equals the archived log count for **every** Bloc, and the +39 is
fully accounted for rather than assumed:

- 726 logs sit in the `2026-9` seasons.
- **687** were created before the snapshot timestamp, **39** after it — matching
  the snapshot exactly.
- **0** are dated outside October, in either direction.

So nothing was lost, nothing was invented, and no log from a neighbouring month
was pulled in. The three Blocs with no entry in `before.json`
(`fimctive-nkek3n`, `lazy-no-more-dn48xd`, `trying-times-i8d33x`) had no October
logs; they froze at 0, which is correct — empty is not an error.

**Every Bloc closed at about 03:00 in its own time zone, not Oslo's.** Eleven
Blocs closed at `2026-11-01 02:09:48 UTC`. `two-a-half-men-n18fcv` closed
earlier in UTC terms, at `2026-10-31 21:32:15`, which looked like an early
close until its season time zone was read: it is **`Asia/Colombo`**, so that is
`03:02` local — the same shape as the Oslo Blocs' `03:09` local. The seasons
carry their own frozen `time_zone` and the close respected it.

### d. The review Bloc has no fines — confirmed on both sides

**Sunday Warriors** (`sunday-warriors-yr392c`), the App Store review fixture.

Canonical, October season:

| Member | Workouts | Target | Settlement status | Settlement entries | Transfers |
| --- | --- | --- | --- | --- | --- |
| Tariq | 14 | 12 | — | 0 | 0 |
| Hana | 13 | 12 | — | 0 | 0 |
| Noah | 13 | 12 | — | 0 | 0 |
| Eli | 12 | 12 | — | 0 | 0 |
| Leo | 12 | 12 | — | 0 | 0 |

The blob agrees: the Bloc's `monthHistory` has exactly one entry, `2026-9`, with
`settlements: {}` — empty — and `lastMonth` is now `2026-10`. The Bloc-level
`settlements` object is null.

The five members marked outstanding across the whole database (§4) are in five
other Blocs. **No settlement, fine or transfer exists for any of Tariq, Hana,
Noah, Eli or Leo.** The 14/13/13/12/12 spread survived the freeze intact.

### e. Nothing from the fixture leaked into the founder dashboard

`read_ante_core_founder_dashboard()` reports **`accounts {total: 48,
newLast30Days: 0}`** — the same real numbers the 29 October handover recorded, so
migration `20261030120000` is still doing its job.

Workout uploads show no sign of the fixture's 64 logs: `allTime` is **2057**
against **2022** recorded on 30 October, a rise of 35 over two days of real
logging. Had the fixture been counted it would have jumped by 64 at once.
`today` is 9 and `month` is 9, which is right for the 1st of a new month.

## 7. What I could NOT verify

- **Nothing was checked in the app itself.** No screen was loaded, on a phone or
  anywhere else. Every statement here comes from the database and the scripts.
- **Whether the five members still see what they owe.** Reasoned from the blob-wins
  rule, not observed.
- **Whether the §4 gap is new.** Deciding that needs to know how May's canonical
  statuses got written, which read-only evidence cannot tell me.
- **November's seasons have no `season_member_status` rows yet** — 0 for all 13
  Blocs, even for `ctrl-alt-de-feat-ocdti8`, which already has a November log.
  These rows look to be created lazily as members log, and October's 62 rows
  accumulated the same way, but I did not confirm that against a previous close.
- `npm run lint`, `npm run build` and the other `test:*` scripts were **not run**.
  No code was changed, so they had nothing to tell us about this close.

## 8. Files touched

| File | Change |
| --- | --- |
| `docs/handover-2026-11-01-month-close.md` | this file, new |
| `docs/HANDOVERS.md` | one line added, in a new November section |

Two script outputs were also written under `migration-output/`, which is
gitignored and therefore not committed: `month-close/after.json` and
`parity-gate/parity-gate-2026-11-01T16-41-32-194Z.json`.

**Nothing else was modified. No production data was changed, and nothing was
deployed.**

## 9. Open, for the founder

1. **The missing canonical settlement flags (§4).** The money is right and the
   blob has it; canonical does not. Worth deciding whether to backfill the five
   rows and whether the mirror needs a fix, before the next close on 1 December.
2. **The review Bloc needs topping up again.** Per the 29 October handover, once
   November closes on 1 December the same five members fall short and a reviewer
   would see the fines this close avoided.
