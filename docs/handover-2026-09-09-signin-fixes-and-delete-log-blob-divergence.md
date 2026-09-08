# Handover — 2026-09-09 Sign-in fixes, and a delete that never reached the blob

Two things happened this session. The sign-in work is finished and live. The
second thing is a **live product defect in the blob-retirement rollout** that
blocked the founder from logging a real workout, and it is the reason this
document exists rather than a playbook entry alone.

**If you are Deveen or one of his agents, read section 2 and stop there.**

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

### The decision Deveen owns

Either **`delete-log` mirrors to the blob again**, or **the cap stops reading the
blob**. The second is the direction everything else is moving, and
`ante_core.upsert_ante_core_workout_log` already enforces the same cap correctly
against canonical, counting distinct session keys. The JS-side
`assertWorkoutSlotAvailable` is the copy that reads the blob.

Two call sites, both in `api/lift-log.js`: `applyAddLog` and `applyMultiLog`.

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

The defect in §2. It affects every member who deletes a workout. Decide with
Devein whether the fix is to restore the blob mirror for `delete-log` or to move
`assertWorkoutSlotAvailable` onto canonical, then implement it.

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
- No open branches, nothing uncommitted
- Blob revision **2303**; backup at 2302
- One hand-correction applied, recorded in §2, reversible
- 13 test suites pass; 2 cannot run (§3.4)
