# Handover — Session 2026-06-11

This doc covers everything done in the June 11 session. Read alongside
`docs/handover-2026-06-09-session.md` and `docs/handover-2026-06-07-canonical-migration.md`
for full project context.

---

## Branch
All work is on `codex/membership-safety-fixes` (not yet merged to main).

---

## What Was Done This Session

### 1. Day cutoff changed from 5 AM → 3 AM
- Files: `api/lift-log.js` (line 5), `index.html` (line 164)
- `LEAGUE_CUTOFF_HOUR = 3` in both files.
- Reason: friend (Nishara) in Sri Lanka works out at 7 AM local = 4 AM Norway.
  Old 5 AM cutoff counted her workout as the previous day. 3 AM is safer.
- Change is forward-only (day boundary logic, not historical).

### 2. Nishara's log date fixed directly via SQL
- Log: display name "Nishara", type "Gym", previously dated June 8, corrected to June 9.
- Identified via dry-run SQL: group_id confirmed, array_index=4, log_id=1780968734126.
- Applied SQL update to blob + incremented `meta.revision` to bust projection cache.
- Verified post-fix: date=2026-06-09, type=Gym confirmed in SQL output.

### 3. Projection RPC read path disabled entirely
- File: `api/lift-log.js`, `fetchReadableCurrentState`
- `read_lift_log_projection` RPC was timing out at 28–60s on EVERY GET request
  (every 3s per client). This caused loading screen hangs visible to users.
- Root cause: projection RPC has a query planner or data issue making it slow.
  Will not be fixed — projection system is being retired via canonical migration.
- Fix: removed all projection read code. GETs now go straight to blob only.
- Also removed dead calls to `fetchBlobRevision()` and `fetchProjectionMeta()`
  which were firing on every GET despite `projectionFresh = false`.
- No data loss risk — blob is still authoritative.

### 4. fromMutation flag — extended to handleSave and handleMultiLog
- File: `index.html`
- `fromMutation` flag (introduced for reactions in previous session) was not
  applied to `handleSave` and `handleMultiLog`. Same race condition existed there.
- Fix: both now pass `{ fromMutation: true }` when calling `applyData` with the
  server response.
- Committed in same commit as projection disable.

### 5. Season rollover canonical sync slice — IMPLEMENTED
- File: `api/lift-log.js`
- Three changes:
  1. `rolloverStateIfNeeded` now attaches `_rollovers: [{ groupId, closedMonthKey,
     newMonthKey, closedAt }]` to returned state when a rollover is detected.
     `_rollovers` is stripped by `normalizeState` before blob write — never persisted.
  2. `syncSeasonToCanonical` updated to accept `closedAt = null` parameter,
     passed as `p_closed_at` to the RPC.
  3. `persistState` extracts `_rollovers` before `persistStateToSupabase`,
     fires best-effort canonical syncs (close old season + open new season)
     for each rollover detected.
- Rollover will trigger organically at month end (July 1 at 3 AM Norway time).
- Commit: `c239199` — **LOCAL ONLY, NOT PUSHED TO REMOTE YET** (see below).

### 6. Storage SQL doc created
- File: `supabase/storage-workout-photos.sql`
- Documents bucket config, RLS policies, file path convention, cleanup logic,
  pre-Storage legacy photos, and relationship to `ante_core.workout_logs`.

---

## URGENT — Push Blocked

Commit `c239199` (season rollover slice) is local only on branch
`codex/membership-safety-fixes`. Push failed because:

- HTTPS remote: GitHub no longer accepts password auth.
- SSH: no SSH key registered with GitHub on this Mac.

**To push:**
1. Go to github.com → Settings → Developer settings → Personal access tokens →
   Tokens (classic) → Generate new token (classic)
2. Give it `repo` scope, 90-day expiry.
3. Run:
   ```
   git remote set-url origin https://github.com/aadhilsj/Lift-Log.git
   git push origin codex/membership-safety-fixes
   ```
4. Use GitHub username `aadhilsj` and the token as the password.
5. macOS Keychain will save it — won't be asked again.

After push: deploy to preview on Vercel, check logs for errors, then promote
to production.

---

## Infrastructure — Upgrades Needed (URGENT)

### Vercel — PAUSED
- Fast Origin Transfer hit 314% of free plan (31.42 GB / 10 GB).
- Account is paused — new deployments may be blocked.
- Root cause: every 3s poll calls the API, which returns the full blob JSON.
  The blob payload flowing through Vercel's CDN counts as Fast Origin Transfer.
- Spike visible around June 7 — coincides with base64 photos briefly in blob.
- **Action: Upgrade Vercel to Pro ($20/month).** User had the upgrade screen
  open at end of session. Pro includes 1 TB Fast Data Transfer — well within
  current usage.

### Supabase — Grace period ends June 13
- Egress at 497% of free plan (24.8 GB / 5 GB).
- Same root cause as Vercel: blob polled every 3s per client, read from Supabase
  each time (Supabase egress) and served back through Vercel (Vercel transfer).
- Grace period until June 13, 2026 — after that, API returns 402 and app breaks.
- **Action: Upgrade Supabase to Pro ($25/month). THIS IS MORE URGENT.**

Long-term fix for both: canonical migration reduces poll payload from full blob
to small targeted queries. That's weeks away — upgrades are the only option now.

---

## Deyhan's Missing Workout

- SQL confirmed: only 1 log in blob for Deyhan (a Run from June 1).
- Vercel logs: no PUT request arrived at the time of his attempts.
- Conclusion: network/connection issue on his end — request never reached server.
- No code bug found. Deyhan will try again from his office with better connection.
- **No action needed from Codex.**

---

## Deployment Status

| Change | Preview | Production |
|---|---|---|
| Seasons RPC SQL | ✅ | ✅ |
| Proration modal centering | ✅ | ✅ |
| Storage photo upload | ✅ | ✅ |
| 72h Storage cleanup | ✅ | ✅ |
| Multi-log fix #1 (source bloc) | ✅ | ✅ |
| Multi-log fix #2 (deselect) | ✅ | ✅ |
| Reaction fix (fromMutation) | ⚠️ committed, not pushed | ❌ |
| Day cutoff 5AM → 3AM | ⚠️ committed, not pushed | ❌ |
| Projection read path disabled | ⚠️ committed, not pushed | ❌ |
| fromMutation for handleSave/handleMultiLog | ⚠️ committed, not pushed | ❌ |
| Season rollover canonical sync | ⚠️ committed, not pushed | ❌ |

All pending items are in commits on `codex/membership-safety-fixes` locally.
Push the branch, deploy to preview, verify Vercel logs clean, then promote to production.

---

## Pending Migration Work

1. **Push + deploy current branch** — first priority (see above).

2. **`ante_core.bloc_members` dual-write** — not started. Next migration slice
   after current branch is deployed.

3. **`season_member_status` dual-write** — blocked on bloc_members.

4. **Historical backfill** — past months + March artefact (`2026-3` row in
   `ante_core.seasons` from testing, shouldn't exist).

5. **`ante_core.workout_logs` dual-write** — not started.

6. **`ante_core.workout_reactions` dual-write** — not started.

7. **Blob retirement** — deferred until all slices done.

8. **Merge `codex/membership-safety-fixes` → `main`** — deferred until
   migration complete.

---

## Supabase Notes

- Project id: `bpvvvqjsfwmmfjvvijkd`
- **Egress at 497% of free plan — upgrade to Pro before June 13.**
- `ante_core` schema: `profiles`, `blocs`, `seasons` tables + 5 RPCs live.
- `workout-photos` bucket: public, service_role delete RLS policy applied.
- Test images from development still in bucket — can be manually deleted.
- Isindu missing from `ante_core.profiles` — will self-heal on next login.
- March artefact: `2026-3` season row in `ante_core.seasons` from testing —
  flagged for cleanup during historical backfill slice.

---

## Codex Operating Rules (must be preserved)
- Never destructively cut over production
- Always preview first, then production
- Never mix migration tracks
- Never apply Supabase changes autonomously — draft SQL, explain, user applies manually
- Small bounded slices only, additive only
- Best-effort canonical writes — failure logged, never propagated to API response
- Test at every stage before proceeding
