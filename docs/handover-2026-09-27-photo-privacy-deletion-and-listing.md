# Handover — 27 September 2026

Photo privacy closed end to end, account deletion proven, the App Store listing
copy agreed, and the Supabase SQL rule handed to Claude.

Written by Claude at the end of a long session with the founder. Read §6 before
touching anything photo-related.

---

## 1. Production state at handover

| Thing | State |
| --- | --- |
| `main` | `9e56d5b` |
| Storage buckets | **Both private** (`profile-photos`, `workout-photos`) — changed tonight |
| Photo delivery | Signed URLs, 24h lifetime, live |
| Unauthenticated image proxy | **Removed** (`proxyStorageImage` gone) |
| Account deletion | Removes photos + Auth identity. Proven on staging |
| RLS on the seven `ante_core` tables | **Still OFF in production.** ON in staging |
| Private-bucket migration | Applied to production tonight |

Photo/row counts after the bucket change, unchanged from before it: 20 profile
photos, 72 workout photos, 1,825 workout logs, 48 profiles.

## 2. What shipped today

| Commit | What |
| --- | --- |
| `91e94d7` | Onboarding "Or pay up." → "Or settle up."; the agreed listing copy doc |
| `42e5ac0` | Private photo signing (Codex's candidate, promoted to main) |
| `353f0d8` | Revert of the above — see §6 |
| `e284cee` | Reapply |
| `0a541f1` | Bloc Stream photo signing + log-workout preview fix |
| `9bdd263` | Account deletion removes photos and the Auth identity (Codex's candidate) |
| `9e56d5b` | AGENTS.md: the founder no longer runs the Supabase SQL |

## 3. The App Store listing copy is agreed

In `docs/app-store-listing-final-copy-2026-09-27.md`, approved line by line.
Name `Fero: Fitness Accountability`, subtitle `Workout goals with your people`.
The description now names the penalty directly rather than denying a money
mechanic it never mentioned. Codex is entering it and deletes that doc when done.

Two docs still say `Name: Fero` and need correcting: the submission packet and
the 09-01 listing draft.

## 4. Account deletion is proven, not just shipped

Tested against `fero-staging` using the **shipped** functions pulled out of
`api/lift-log.js`, not a reimplementation. A throwaway auth user with one photo
in each bucket: both photos 1 → 0, login existed → gone, other members' folders
unchanged (14 and 26 before and after), zero leftover test accounts.

Known partial-failure mode, **documented, not a bug**: the Auth identity is
deleted last. If that step fails, the profile, membership and state are already
gone and the request returns an error — the member is told deletion failed while
their data is gone and only their login remains. Verified in a sandbox. The
ordering is correct (Supabase will not delete an Auth user that still owns
Storage objects); do not redesign it.

## 5. RLS — ready, not done

Production has RLS **off** on all seven tables; staging has it **on** and
verified. The migration is `supabase/migrations/20260926120000_enable_rls_on_server_only_tables.sql`.

Its safety argument was checked directly against production and holds:
`service_role` has `BYPASSRLS`; every `ante_core` table is owned by `postgres`;
all 22 `SECURITY DEFINER` functions touching those tables are owned by
`postgres`; no table has `FORCE ROW LEVEL SECURITY`. The 15 projection tables it
strips grants from really are abandoned — the only reference left in `api/lift-log.js`
is a comment saying the read path was removed.

**What is missing is exercise, not reasoning.** Nobody has driven Stream,
comments, reactions, unread counts and Solo against an RLS-enabled database from
the app. Staging has RLS on, so that test is available: point a local app at
staging (needs the staging **anon** key adding to `.env.staging`) and walk those
flows. Do that before production.

## 6. Why photo work must be verified against the running app

`42e5ac0` was reviewed against the list of surfaces in the review prompt —
Today, Activity, profiles, month history — and shipped. The founder found two
breakages on his phone within the hour:

- **Bloc Stream** showed "Image expired" on every photo. Stream messages are
  read through their own RPC, not through the scoped readable state, so
  `collectScopedPhotoReferences` never saw them.
- **The log-workout preview** was blank, because the upload returns an internal
  reference the browser cannot render. This had been called a "known
  non-blocking regression" and parked. It sits in the middle of logging a
  workout; that judgement was wrong.

The revert then stranded 13 workout logs and 1 stream message written as
`fero-storage://` references while signing was briefly live. The redeploy
repaired them.

**The app has six photo surfaces**, and any new photo work must check all six:
profile avatars (`primitives.jsx`), Activity thumbnails and the full-screen
viewer (`ActivityFeed.jsx`), comment threads (`LogCommentThread.jsx`), the
log-workout preview (`modals.jsx`), and Bloc Stream (`BlocStream.jsx`).
`ImageLightbox` in `modals.jsx` is exported but never used — dead code. Share
stickers are transparent overlays and contain no stored photo.

## 7. Cloudflare cache after locking a bucket

Flipping a bucket private does **not** immediately kill existing public links.
Cloudflare keeps serving recently-fetched objects from the edge — observed
`cf-cache: HIT` returning 200 after the lock, while a cache-busted request to
the same URL returned 400. Expect roughly an hour. Do not read a working old
link straight after a lock as a failed lock.

## 8. Parked, with owners

- **Replacing a profile photo orphans the old file.** Production had 5 orphans
  across 15 members with photos, oldest 66 days. Claude owns this, after the
  App Store build is submitted. It touches the upload path and interacts with
  the 24h signed URLs, so it is not a one-liner.
- **An open report can outlive the 72-hour sweep**, leaving the moderator with
  no evidence. Needs a founder decision first: should a reported photo survive
  past 72h until judged? Apple expects reports actioned within 24 hours, so
  acting as Apple expects means the photo is still there.
- **Storage sweep caps.** `cleanupExpiredStoragePhotos` fires on traffic only and
  is capped at 250 folders per run. Past ~250 members with photos, one run can
  no longer reach everyone and the public "about 72 hours" claim starts to drift.

## 9. Legal pages

Both drafts are accurate now: the retention wording was corrected, and the
deletion sentence became true today. **They are still unpublished**, blocked on
founder items only — the `support@joinfero.app` Gmail spam problem, hosting at
`joinfero.app`, and legal review of retention periods and GDPR rights.

Three times this week a public page described what the repository intended
rather than what production did. **Verify legal-facing claims against
production**, never against a migration file or a feature branch.

## 10. The Supabase SQL rule changed

Since today Claude runs the SQL, including on production (§4 of AGENTS.md).
Report before or immediately after — never silently. Every other guard stands.
