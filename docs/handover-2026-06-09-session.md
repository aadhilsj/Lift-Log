# Handover — Session 2026-06-09

This doc covers everything done in the June 9 session. Read alongside
`docs/handover-2026-06-07-canonical-migration.md` for full project context.

---

## Branch
All work is on `codex/membership-safety-fixes` (not yet merged to main).

---

## What Was Done This Session

### 1. Seasons RPC — REVOKE/GRANT signature fix
- File: `supabase/ante-core-seasons-write-rpc.sql`
- After adding `p_time_zone text` (position 16), the 4 REVOKE/GRANT lines
  still had the old 17-param signature. Fixed to 18-param.
- Applied to production Supabase manually by user.

### 2. Full production audit + promotion
- Audited all RPCs, `api/lift-log.js` dual-write calls, `index.html` UI.
- Confirmed 5 RPCs live in pg_proc, seasons data correct in ante_core.
- Promoted preview → production on Vercel.

### 3. Proration modal — mobile centering fix
- File: `index.html`
- `ProrationChoiceModal` was a bottom sheet on mobile.
- Added `center-mobile` class to overlay so it centres instead.

### 4. Supabase Storage photo upload
- Replaced base64-in-blob photos with Supabase Storage uploads.
- Bucket: `workout-photos` (public, 5MB limit, image MIME types only).
- Storage path: `{userId}/{Date.now()}.jpg`
- RLS: authenticated upload, service_role delete.
- `uploadPhotoToStorage(dataUrl)` helper added to `index.html`.
- `handleCropConfirm` now uploads to Storage and stores the public URL.
- Pre-Storage base64 photos unaffected (URLs start with `data:`, not matched
  by any cleanup logic).

### 5. 72h Storage photo cleanup
- `cleanupExpiredStoragePhotos()` added to `api/lift-log.js`.
- Scans bucket folders, parses `Date.now()` timestamp from filename,
  deletes files older than `UNFLAGGED_IMAGE_RETENTION_MS` (72h).
- Fires fire-and-forget after every `persistStateToSupabase` call.
- Timestamp-based approach (not diff-based) because `nextState` is already
  normalised before reaching `persistStateToSupabase` — expired photos are
  stripped to `""` before that point.

### 6. Multi-log bug fix #1 — source bloc log disappears
- File: `api/lift-log.js`, `applyMultiLog`
- Bug: loop only iterated `targetGroupIds` (additional blocs), not
  `sourceGroupId`. Server response overwrote source bloc without the log.
- Fix: `allTargetIds = [...new Set([sourceGroupId, ...targetGroupIds])]`

### 7. Multi-log bug fix #2 — can't deselect additional blocs
- File: `index.html`, `selectedGroupIds` useEffect
- Bug: `eligibleGroups` in deps caused effect to re-fire on every optimistic
  state refresh, resetting manual deselections.
- Fix: removed `eligibleGroups` from deps (intentional omission, commented).

### 8. Reaction UI bug fix — reactions disappear/flicker
- File: `index.html`, `applyData` + `handleLogMutation`
- Bug: `applyData`'s optimistic guard only blocked polls where
  `incomingRevision <= baseRevision`. If another user's concurrent change
  incremented the server revision above `baseRevision`, the poll passed the
  guard, cleared the optimistic flag, and wiped the local reaction before
  the mutation completed.
- Fix: added `fromMutation` flag to `applyData`. While
  `optimisticMutationRef` is set, ALL non-mutation calls (polls, refreshNow)
  are fully blocked. Only `handleLogMutation`'s own server response
  (`fromMutation: true`) clears the optimistic state.
- Commit: `8d96284`

---

## Known Live Issues (not fixed this session)

### Projection RPC timeout (57014)
- `read_lift_log_projection` RPC times out on every GET (every 3s poll).
- Causes ~3s added latency per request (waits for timeout, falls back to blob).
- Does NOT cause data loss — fallback to blob works correctly.
- 9 errors visible in Vercel logs over 30 minutes, all from this.
- Needs investigation: either disable the projection read path or optimise
  the RPC. Not touched this session to avoid unnecessary changes.

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
| Reaction fix (fromMutation) | committed, not pushed | ❌ |

The reaction fix commit (`8d96284`) is on `codex/membership-safety-fixes`
locally. Needs to be pushed to remote and deployed to preview → production.

---

## Pending Migration Work (not started this session)

1. **Season rollover slice** — modify `rolloverStateIfNeeded` to attach
   `_rollovers` metadata, thread through `persistState`, fire canonical syncs
   for close-old / open-new. Plan exists (~85% confidence).

2. **`ante_core.bloc_members`** — memberships slice, not started.

3. **`season_member_status`** — blocked on memberships.

4. **Historical backfill** — past months + March artefact (`2026-3` row
   shouldn't exist). One-time migration.

5. **Workout logs slice** — not started.

6. **Blob retirement** — deferred until all slices done.

7. **Merge `codex/membership-safety-fixes` → `main`** — deferred until
   migration complete.

---

## Supabase Notes

- Project id: `bpvvvqjsfwmmfjvvijkd`
- **EXCEEDING USAGE LIMITS** banner visible — egress at 220%+ of free plan.
  Recommend upgrading to Pro ($25/month) to avoid throttling.
- `ante_core` schema has: `profiles`, `blocs`, `seasons` tables + 5 RPCs.
- `workout-photos` bucket: public, service_role delete RLS policy applied.
- Test images from development still in bucket — can be manually deleted.
- Isindu missing from `ante_core.profiles` — will self-heal on next login
  (auth-sync fires if displayName exists).
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
