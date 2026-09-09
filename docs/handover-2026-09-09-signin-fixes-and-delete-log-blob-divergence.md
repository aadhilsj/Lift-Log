# Handover — 2026-09-09 Sign-in fixes, and a delete that never reached the blob

Two things happened this session. The sign-in work is finished and live. The
second thing is a **live product defect in the blob-retirement rollout** that
blocked the founder from logging a real workout, and it is the reason this
document exists rather than a playbook entry alone.

**If you are Deveen or one of his agents, read section 2 and stop there.**

> **Updated 2026-09-09, evening.** Section 2 originally framed this as a
> two-per-day-cap problem and leaned toward moving the cap onto canonical.
> That was the smaller half and the wrong lean. **Month close also reads the
> blob**, and the parity gate cannot see any of it. Sections 2.5, 2.6 and 6 are
> new; "The decision Deveen owns" has been rewritten.

---

## Plain-English summary

Three sign-in bugs shipped to production, including one that could rename a
member and rewrite a finished month's record.

Then the founder could not log a workout. It turned out that **deleting a
workout has written only to canonical since 19 July**. The blob keeps the
workout forever, and the two-per-day cap reads the blob. So every deleted
workout permanently eats one of that day's two slots. He was the first person
to hit it, because it needs a delete *and* a second attempt on the same league
day.

His data was corrected by hand. **The code is still broken for everyone.**

Following that further the same evening: month close also counts from the blob,
so a deleted workout is counted in the frozen month and the wrong number is
copied into canonical, where it decides settlements. And the parity gate audits
closed months only, so none of this is visible to it until it is already frozen.

---

## 1. What shipped (live in production)

| PR | What |
|---|---|
| [#17](https://github.com/aadhilsj/Lift-Log/pull/17) | Joiner prompt copy — **Ease in** / "Find your rhythm. Penalties start next month." and **Dive in** / "Penalties apply from your first month." |
| [#18](https://github.com/aadhilsj/Lift-Log/pull/18) | Sign-in dead end, signup landing, redemption note month, target-hit retraction, delete modal, playbook |
| [#19](https://github.com/aadhilsj/Lift-Log/pull/19) | Two remaining "this month's stakes" strings |

Detail on each, and the reasoning, is in the PR bodies. The parts most likely
to matter later:

- **A failed account load is no longer read as "a new member."** After the OTP
  is verified the client fetches the account; when that fetch failed it returned
  nothing, and the caller inferred `needsProfileSetup`. That put an existing
  member on the display-name screen, and saving a name there renamed them across
  every Bloc **and rewrote the counts inside already-closed months**. Reproduced
  and fixed. `npm run test:otp-errors` guards the related error classification.
- **Signing in after a cancelled attempt** used to land back on onboarding
  screen 4 while fully signed in. `closeAuth` queues the intro to replay and
  nothing cleared that queue; `resetAuthFlow()` does not touch
  `replayColdOnboarding`. This was the founder's and his friend's actual bug,
  reported twice before it was caught.
- **"X hit target" is retracted** when a deletion drops the member back under
  target. `delete-log` previously did not touch the Bloc stream at all.
- **The delete-log modal** is portalled through a shared `ModalScrim`
  (`src/components/primitives.jsx`), because `PlayerProfile`'s root transform
  made Safari position it against that box instead of the viewport.

No betting or poker language remains in user-facing copy. That is a hard rule:
see the playbook and `docs/recurring-debugging-playbook.md`.

---

## 2. The one that matters to blob retirement

### What is wrong

**`delete-log` writes canonical only. The blob keeps the workout. The
two-per-day cap reads the blob.**

So a deleted workout keeps consuming one of that member's two daily slots, for
that date, permanently. Nothing in the UI shows it — the leaderboard, the
member's count and the month screen all read canonical and are correct. The
phantom is visible **only** to the cap.

### Evidence

```
delete-log writes to the blob, ever      : 51
last one                                 : 2026-07-19
since then                               : 0
add-log writes to the blob, last 3 days  : 46
multi-log writes to the blob, last 3 days: 18
reaction writes to the blob, last 3 days : 0
```

`delete-log` and `reaction` are in `BLOB_MIRROR_SKIP_ACTIONS`; `add-log` and
`multi-log` are not. Both are in `BLOB_MIRROR_SKIP_ALLOWED_ACTIONS` in
`api/lift-log.js`.

### How it presents

The founder logged a Run at 17:28 to two Blocs, logged it again at 17:30 to all
six with a note, then deleted the first one from each Bloc. The deletes removed
it from canonical and left it in the blob.

Hours later he tried to log a genuine second workout for the same league day and
the API returned **409** (`assertWorkoutSlotAvailable` → "Already logged 2
workouts for this date"). Because the client discards that error (see §3.2), the
workout appeared and then silently vanished — indistinguishable from the app
deleting it.

### Blast radius, as audited 2026-09-09

Every member, every date in September, comparing blob sessions with canonical
sessions: **one row, the founder, 2026-09-08.** Nobody else is currently
blocked or carrying a phantom.

That is luck, not safety. It needs a delete *and* a second attempt on the same
league day. Anyone who deletes a workout is carrying a phantom for that date.

### The correction applied

Two blob entries removed — session `1788888521665526`, in
`ctrl-alt-de-feat-ocdti8` and `sweat-equity-saucff`. Blob revision **2302 →
2303**. Full backup exists at revision 2302 (`public.lift_log_backups`,
2026-09-08 21:09:58 UTC).

Verified after: all six Blocs read 9 in both stores, and 2026-09-08 counts one
session against the cap. Visible counts were 9 before and 9 after — the phantom
never appeared anywhere the member could see.

Undo, if it is ever needed:

```sql
-- Restores the removed entries. Not expected to be needed.
update public.lift_log_state
set state = jsonb_set(state, '{groups,ctrl-alt-de-feat-ocdti8,logs,Aadhil}',
      (state->'groups'->'ctrl-alt-de-feat-ocdti8'->'logs'->'Aadhil') || jsonb_build_array(
        '{"id":"1788888521665526-ctrl-alt-de-feat-ocdti8","date":"2026-09-08","note":"","type":"Run","photoUrl":"https://bpvvvqjsfwmmfjvvijkd.supabase.co/storage/v1/object/public/workout-photos/768de245-5b17-4292-b91c-804daaa3b217/1788888516527-988028.jpg","createdAt":"2026-09-08T17:28:41.680Z","flaggedBy":null,"reactions":{},"decisionAt":null,"decisionBy":null,"flagReason":"","flagStatus":null,"verifiedVia":"photo","commentCount":0,"flagResponse":""}'::jsonb))
where id = true;

update public.lift_log_state
set state = jsonb_set(state, '{groups,sweat-equity-saucff,logs,Aadhil}',
      (state->'groups'->'sweat-equity-saucff'->'logs'->'Aadhil') || jsonb_build_array(
        '{"id":"1788888521665526-sweat-equity-saucff","date":"2026-09-08","note":"","type":"Run","photoUrl":"https://bpvvvqjsfwmmfjvvijkd.supabase.co/storage/v1/object/public/workout-photos/768de245-5b17-4292-b91c-804daaa3b217/1788888516527-988028.jpg","createdAt":"2026-09-08T17:28:41.683Z","flaggedBy":null,"reactions":{},"decisionAt":null,"decisionBy":null,"flagReason":"","flagStatus":null,"verifiedVia":"photo","commentCount":0,"flagResponse":""}'::jsonb))
where id = true;
```

### 2.5 The larger half: month close reads the blob

Found the same evening, after the section above was written.

Four links, all `api/lift-log.js`:

1. **The blob is never rewritten on delete.** `persistOrSkipBlobMirror` returns
   before `persistStateToSupabase` when the action is skipped. Both the log
   removal *and* the `deletedCurrentLogIds` marker `applyDeleteLog` sets are
   discarded — the blob has no record a deletion ever happened.
2. **Rollover reads the raw blob.** `fetchCurrentStateFromSupabase()` selects
   `lift_log_state.state` and calls `rolloverStateIfNeeded()` on it directly.
   No canonical overlay; the readable projection is a different path.
3. **The frozen count comes from blob logs.** `rolloverGroupIfNeeded()` builds
   `counts` from `getCountedLogCount(group.logs?.[name] || [])` and `logsByUser`
   from `buildMonthLogsSnapshot(group.logs, relevantNames)`.
4. **The wrong number reaches canonical.** The rollover batch passes
   `closedSnapshot`'s `workoutCount` to `upsertSeasonMemberStatusToCanonical`.

`buildDefaultSettlements(...)` is built from the same `counts` in the same
snapshot.

Verified with fixtures against the real exported `rolloverGroupIfNeeded`:

```
Real workouts the member has:      10
Frozen into the closed month:      11   <- the deleted one
Control (blob mirror restored):    10
```

And on the money, target 12, member genuinely did 11 plus one deleted:

```
Frozen from blob (phantom):  12 of 12 -> no settlement row
Actually true:               11 of 12 -> {"status":"outstanding", ...}
```

Phantoms **inflate** counts, so this releases members from penalties they owe.
It does not over-charge. **Not verified:** no real production month-end was run.

September closes 1 October.

### 2.6 Why nothing caught it for seven weeks

`npm run parity:gate` ran clean on 2026-09-09 at blob revision 2304 — 8 checks,
0 failures, 0 warnings. That is not evidence the current month is sound.

Every check operates on closed seasons. `open-season-scope` says so:

> "Open seasons are excluded by design; season_member_status is a rollover
> snapshot, not the live counter."

So current-month divergence is invisible until the month closes, at which point
the number is frozen and `scripts/blob-remirror.mjs` cannot repair it — its own
header says *never touched: monthHistory*.

**A green gate is not clearance for a mirror skip.** The missing check is an
open-season comparison of blob current-month log sets against
`ante_core.workout_logs`, per member per date. That is the check that would have
caught this on 20 July; the audit query above is that check written by hand.

### The decision Deveen owns

Either **`delete-log` mirrors to the blob again**, or **the cap stops reading the
blob**.

**Recommendation: restore the mirror.** Section 2.5 is why. Moving the cap onto
canonical fixes the 409 and leaves month close still counting the phantom — so
September would still close wrong. Restoring the mirror fixes both, and it is
env-only: drop `delete-log` from `BLOB_MIRROR_SKIP_ACTIONS`. No code, no deploy,
reversible in minutes.

Moving the cap onto canonical remains the right long-term direction —
`ante_core.upsert_ante_core_workout_log` already enforces the same cap correctly
against canonical, counting distinct session keys, and the JS-side
`assertWorkoutSlotAvailable` is the odd copy out (two call sites, `applyAddLog`
and `applyMultiLog`). It just is not sufficient on its own, and it is not what
1 October needs.

**Also worth his attention:** `reaction` is skipping the blob too. The same
question applies — does anything still read reactions from the blob?

**The general shape, which is the third time it has bitten:** an action stops
writing the blob while something else still reads it. A skip is only safe once
every reader of that field has moved. A grep for readers is not optional.

### To find a phantom for any member

```sql
with g as (
  select key as bloc, value as grp
  from public.lift_log_state s, jsonb_each(s.state->'groups') where s.id = true
),
memb as (
  select g.bloc, m.key as auth_user_id, m.value->>'displayName' as nm, g.grp
  from g, jsonb_each(g.grp->'memberships') m
),
blob_sessions as (
  select mb.auth_user_id, max(mb.nm) as nm, l.value->>'date' as d,
         count(distinct coalesce(substring(l.value->>'id' from '^([0-9]{10,})(?:-|$)'), l.value->>'id')) as blob_sessions
  from memb mb, lateral jsonb_array_elements(coalesce(mb.grp->'logs'->mb.nm,'[]'::jsonb)) l
  group by mb.auth_user_id, l.value->>'date'
),
canon as (
  select p.auth_user_id::text as auth_user_id, wl.workout_date::text as d,
         count(distinct coalesce(substring(wl.id from '^([0-9]{10,})(?:-|$)'), wl.id)) as canon_sessions
  from ante_core.workout_logs wl join ante_core.profiles p on p.id = wl.profile_id
  group by 1,2
)
select b.nm, b.d, b.blob_sessions, coalesce(c.canon_sessions,0) as canonical_sessions
from blob_sessions b
left join canon c on c.auth_user_id = b.auth_user_id and c.d = b.d
where b.blob_sessions > coalesce(c.canon_sessions,0)
order by b.blob_sessions desc, b.d desc;
```

Any row is a member carrying a phantom. `blob_sessions >= 2` means they are
blocked from logging on that date.

---

## 3. Where this session stops, and what to do next

Nothing below is started. `main` is at PR #19, production is deployed and
healthy, and there are no open branches.

### 3.1 Deleting must clear both stores — **do this first**

The defect in §2. It affects every member who deletes a workout, and §2.5 gives
it a date: September closes 1 October. Recommendation is to restore the blob
mirror; see "The decision Deveen owns". Sent to Deveen 2026-09-09, awaiting his
answer — do not implement either option before he replies.

Do not treat the founder's data correction as the fix. It was one row.

### 3.2 A failed workout log must say so

`src/pages/TodayPage.jsx` around line 272:

```js
const result = await onMultiLog({ workoutType, isoDate, targetGroupIds, note, photoUrl });
return;
```

The result is captured and discarded. `handleMultiLog` in `src/App.jsx` has
already shown the workout optimistically, so on failure it calls
`clearOptimisticMutation()` and `refreshNow()` — the workout appears, then
vanishes, and **nothing tells the member why**.

`submitSitOut`, ten lines below in the same file, does this correctly and is the
pattern to copy.

This is why the §2 defect went a full day without a diagnosis: the only symptom
was a workout disappearing. Last changed 2026-07-10.

### 3.3 Deleting a multi-logged workout should offer to clear every Bloc

The founder's request. Logging writes one session to several Blocs;
`applyDeleteLog` removes it from one. Deleting should ask whether to remove it
from the others, and default to yes.

Related and worth checking while in there: a multi-log that fails partway can
leave the blob holding a session canonical never received. Session
`1788888521665526` existed in two Blocs in the blob and in **zero** canonical
rows, which is how it survived a canonical-only delete.

### 3.4 Two test suites still cannot run

`test:mobile-navigation` and `test:auth-edge-flows` both import Playwright from a
hard-coded path inside another machine's cache (`/Users/opera_user/...`). They
have been broken since before this work.

They cover **sign-in and navigation** — the exact area of every bug this session.
Neither would have caught any of them, because neither can start. Fixing the
import is small; whether the assertions still pass is unknown until they run.

---

## 4. Testing notes worth keeping

**Test the second attempt, not just the first.** Every sign-in test went fresh
browser → clean sign-in, and all passed. The bug lived two taps off that path:
cancel once, then sign in. Any flow with a cancel, a back or a retry needs the
retry exercised.

**A silent failure costs a day.** The §2 defect was one 409 in a server log. It
took a full session to find because the client threw the error away. When a
mutation can fail, the failure must be visible before the feature is done.

**`npm run sandbox`** runs the whole app on a Mac against a JSON file, reachable
from a phone on the same wifi. It now answers the real Supabase auth path
(`ENABLE_LOCAL_DEV_OTP=false`), including a genuine 429 for any address
containing `ratelimit` and `otp_disabled` for unknown addresses. Every Vercel
preview writes the production database, so the sandbox is the only safe place to
rehearse a flow that writes member data.

**Do not use `?onboarding=1` to test onboarding.** It keeps forcing the intro
after a successful sign-in, so a working flow looks broken. Use a private window.

---

## 5. State at handover

- `main` = PR #19, deployed, healthy, no console errors
- No open branches
- Blob revision **2304** as of the evening gate run; backup at 2302
- One hand-correction applied, recorded in §2, reversible
- 13 test suites pass; 2 cannot run (§3.4)
- Parity gate: **18/18 offline, 8/8 live, 0 warnings** (2026-09-09 evening)
- §2 was extended the same evening — see the note at the top of this document

---

## 6. Deveen's runbook — status, and a stop condition on Task 5

`docs/blob-retirement-runbook-aadhil-side-2026-09-06.md`.

### 6.1 Task 5 must not run yet

Task 5 adds `add-log,multi-log` to `BLOB_MIRROR_SKIP_ACTIONS`, after which no
workout write reaches the blob at all. Month close still counts from the blob
(§2.5). Same fixture, two members who both genuinely hit 12 of 12, with the blob
having received only the first five of one member's:

```
Aadhil: actually 12 of 12 -> no penalty
        frozen    5 of 12 -> {"status":"outstanding", ...}   <- charged wrongly
Sam:    actually 12 of 12 -> no penalty
        frozen   12 of 12 -> no penalty
```

So Task 5 reverses the failure direction: from releasing members from penalties
they owe, to charging members who completed the month. That is the worse one.

Three reasons it is a hard stop, not a caution:

- Month close reads the blob, and Task 5 stops the blob being written.
- No heal path. `blob-remirror.mjs` never touches `monthHistory` (§2.6).
- The gate will not warn during the soak window (§2.6).

Task 5's own step 4 — "log a workout, log a second, delete one, all three must
behave normally" — passes fine in this scenario. The damage does not appear
until rollover, up to a month after the soak ends.

**Open question for Deveen:** does the `left_at` branch move month close onto
canonical? If yes, Task 5 sequences behind it. If no, month close has to move
first.

### 6.2 Two things block running the gate at all

Tooling only; neither affects production.

- `loadEnvFile()` in `scripts/blob-parity-gate.mjs` does not strip quotes, and a
  Vercel-pulled `.env.local` quotes every value — `SUPABASE_URL` arrives as
  `"https://…"` and the run dies with `ERR_INVALID_URL`.
- Vercel redacts secrets on pull: `SUPABASE_SERVICE_ROLE_KEY` in `.env.local` is
  the literal string `[SENSITIVE]`. The runbook's "Aadhil's workspace already has
  these" cannot be true for anyone who pulled env from Vercel.

Workaround used. No repo change; the key never reaches disk or shell history:

```bash
cd "/Users/aadhilsj/Documents/Codex Space/Fero" && printf 'Paste your secret key, then press Enter: ' && read -rs KEY && echo && SUPABASE_URL="$(grep '^SUPABASE_URL=' .env.local | cut -d= -f2- | tr -d '"')" SUPABASE_SERVICE_ROLE_KEY="$KEY" node scripts/blob-parity-gate.mjs
```

### 6.3 Runbook status

| Task | State |
|---|---|
| 1 — confirm the mirror-skip flag | not started; needs `ADMIN_PIN`, set by Aadhil in his own shell |
| 2 — parity gate baseline | **done 2026-09-09. 18/18 offline, 8/8 live, rev 2304** |
| 3 — prove a backup restores | not started; needs a scratch Supabase project |
| 4 — close I3 | Aadhil's decision; Option A recommended in the runbook |
| 5 — wave B | **blocked, §6.1** |

### 6.4 Three questions with Deveen, sent 2026-09-09

1. Restore the `delete-log` blob mirror? Recommended over moving the cap.
2. Does `left_at` move month close onto canonical? Gates Task 5.
3. Is `reaction` skipping safe — does anything still read reactions off the blob?

---

## 7. Unrelated to the blob, but outstanding

`codex/app-store-readiness` is **21 commits behind `main`**. It last merged
`main` before the sign-in work landed, so it is missing every fix in PRs #14,
#17, #18 and #19 — including the failed-account-load bug that put an existing
member on the display-name screen and renamed them across every Bloc. It is also
missing Deveen's parity gate and runbook (PRs #15, #16).

Submitting from that branch as it stands would ship the member-renaming sign-in
bug to the App Store.

It also edits `api/lift-log.js` and `src/pages/TodayPage.jsx` — the two files
§3.1 and §3.2 will touch, so expect conflicts. Merge `main` into it before any
further App Store work, and re-verify swipe and reaction behaviour afterwards:
the playbook records both being re-broken by branch merges before.

The native shell routes to the deployed API, which is production. TestFlight
testers deleting workouts create the same phantoms real members do — one more
reason to land §3.1 before TestFlight goes wide.
