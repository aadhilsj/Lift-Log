# State of play — Saturday 26 September 2026

One page for Aadhil, reconciling every open thread before the 1 October month
close and the App Store push. Written because two agents gave contradicting
answers in the same evening; §6 records why, so it does not happen again.

**Deveen's own list lives in
[`handover-2026-09-22-for-deveen-active.md`](handover-2026-09-22-for-deveen-active.md)**
and is the authority on his half. This document does not duplicate it — it
states who owns what and names the one thing that had fallen off both lists.

---

## 1. The single most important line

**Nothing is waiting on Deveen that he does not already know about. One thing
is waiting on Aadhil that nobody is tracking: Wave B.**

---

## 2. Dates that matter

| Date | What |
|---|---|
| **Thu 1 Oct** | September month close. First real canonical rollover. |
| **Thu 1 Oct** | App Store readiness target set at the 20 Sep meeting. |
| **2–3 Oct** | RLS migration to production — deliberately **after** the close. |
| December | Public launch on socials. |

---

## 3. Deveen's side — all of it already in his active handover

Weekend of 26–27 September:

1. **Merge `test/month-close-allowance-regression` before 1 October.** Still
   unmerged; `main` differs by 26 lines in
   `scripts/test-month-close-canonical.mjs`.
2. **Write the RLS migration.** The verdict it waited on has been settled since
   22 Sep: **not exposed**, so it is the low-risk shape — enable RLS, no client
   policies. Plus the §2.1 backup table and the §2.2 grants if he agrees.
3. **Rehearse it on staging.** Staging is built and ready (see §4).
4. **Add `test:auth-outage` to `ci.yml`.**
5. **Decide §2.1** (the 18 Sep backup table) **and §2.2** (the 15 abandoned
   `lift_log_projection_*` tables that still carry full `anon` grants).
6. **Server region** (§6.4) — functions run in US East, database is in Ireland.

Not started and not scheduled, longer range:

- **`left_at` redesign.** The column exists and is populated, but the code
  still reads the blob's `leftMemberNames` in 30 places and `left_at` in none.
  **This is the only unstarted design work in the whole blob retirement**, and
  the last four mirror actions cannot move without it. No branch exists.
- **Scaling** (`scaling-before-launch-2026-09-15.md`) — the five-simultaneous-
  user traffic incident. Not started.

---

## 4. Staging — built, ready, and costing money

Project `fero-staging`, ref `okwrrspdmoluxatyokzh`, `eu-west-1`, restored
2026-09-24 from the 23 Sep backup. **$9.68/month billed hourly, ~$0.30/day.**

- Emails scrubbed to `@staging.invalid` in all three stores; names and message
  bodies deliberately left. Aadhil's own address is the one real one, because
  sign-in needs a deliverable address.
- Vercel Preview scope points at it; production still points at
  `bpvvvqjsfwmmfjvvijkd`, verified by behaviour.
- **4 migrations behind production** (staging `20260918063953`, production
  `20260924164237`). None of the four touch the seven tables, so **the RLS
  rehearsal is valid as-is.** Recommend leaving it rather than spending fifteen
  minutes on a rescrub.
- **It is billing daily until deleted.** Delete it, and the
  `staging/rls-rehearsal` branch, once RLS is live on production.

---

## 5. Aadhil's side — including the gap

### 5.1 Wave B is unblocked and untracked

This is the finding. **Wave B stops workout logs being written twice** — once
to the proper tables, once to the old blob. It is one Vercel environment
variable, no code, reversible in about two minutes.

Its history:

| Date | State |
|---|---|
| 6 Sep | Defined by Deveen as Task 5 of the Aadhil-side runbook |
| 9 Sep | **Hard stop** — month close still counted from the blob, so switching it off could have charged members who had completed their month |
| 20 Sep | **Unblocked.** Deveen: *"Nothing on our side now blocks Task 5."* Month close reads canonical (#24), the gate sees open seasons (#25) |
| 26 Sep | **Not mentioned in any document since.** Not in the active handover's open list, because that list is Deveen-facing and this waits on Aadhil |

So it is nobody's line item. It is not urgent, and it is explicitly *not*
recommended before 1 October — a mirror change immediately before the first
real canonical rollover is the wrong week for it. **Do it after the close, and
after RLS lands.**

When it is done, the exact steps are Task 5 of
[`blob-retirement-runbook-aadhil-side-2026-09-06.md`](blob-retirement-runbook-aadhil-side-2026-09-06.md):
fresh backup, set the variable, redeploy, phone smoke test, 48–72h soak with a
daily parity gate.

### 5.2 Smaller, open

- **Staging: match migrations or leave?** Recommend leave.
- **CI is advisory.** `main` has no required status checks, and pushes deploy to
  Vercel before CI finishes. Making it blocking means going back to PRs — a
  process decision, flagged not changed.
- **`npm run sandbox:seed` fails** with "Rollover did not produce a closed
  month". Cause unconfirmed.
- **Migration version drift.** The four migrations applied on 24 September were
  recorded with MCP-assigned versions (`20260924031027`, `20260924033007`,
  `20260924164030`, `20260924164237`) that do not match their filenames in
  `supabase/migrations/`. The **names** match and all four are applied. A
  `supabase db push` could try to re-apply the files; all four are written to be
  safe if it does, but it is drift worth knowing about.

---

## 6. Why two agents disagreed, and how to avoid it

On 26 September one session reported Wave B as *"on hold by agreement"* and
framed Deveen as the critical path. Both were wrong, for one reason:

**It read the handover documents from the shared working folder, which was
three days behind `origin/main`.** It got the 22 September version of the
active handover and never saw §3 (staging built, 24 Sep), §7 or §8 (both added
26 Sep). "On hold by agreement" was true on 14 September and superseded on the
20th.

**Rule: always read docs from `origin/main`, never the working tree.**

```bash
git fetch -q && git show origin/main:docs/<file>.md
```

The shared folder is a worktree that other sessions and agents move
independently; its `HEAD` is routinely behind. A stale handover reads exactly
like a current one.

The second lesson: **when a document says something is blocked, check whether a
later document unblocked it.** The 9 September hard stop was lifted on the
20th, in a different document, by a different author.

---

## 7. Recommended order

1. **Now → 1 Oct:** Deveen's weekend list. Nothing else touches the database.
2. **Thu 1 Oct:** month close. Watch it — first real canonical rollover.
3. **2–3 Oct:** RLS to production, then delete staging and the rehearsal
   branch.
4. **After that:** Wave B, then Wave C.
5. **Unscheduled but on the critical path for December:** `left_at`, which is
   the only thing standing between here and the last four mirror actions.
