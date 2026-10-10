# Handover — 10 October 2026: departed members and All-Time leaderboard

**Active.** Opened before implementation, as required by `AGENTS.md` §0.

## Goal

Show only current Bloc members on the All-Time leaderboard and its member-name
highlights. Preserve historical months, workout totals, and activity mix. Then
remove Abhishek from Go To Da Gym and Aki Jain 2000 from Ctrl Alt De-feat,
preserving their records and leaving both Bloc streams without a removal
notice, as previously requested.

## Starting state

- Worktree: `/Users/opera_user/Developer/FERO/alltime-active-members`
- Branch: `codex/alltime-active-members-2026-10-10`, based on `origin/main`
  at `2934a62`.
- The shared checkout in Documents is at `19ed525`, two commits behind
  `origin/main`; it contains four untracked August backup images, left alone.
- A `node_modules` symlink and `.env.local` copy have been created in this
  worktree; `.env.local` is not tracked.
- Live `https://lift-log-nu.vercel.app/` returned HTTP 200.
- `gh` is not installed in this laptop environment; deployment details will be
  checked through Vercel's connected tools if available.
- Founder selected direct release to `main` for this change.
- At session start no source or production data had been changed.

## Decisions and verification

### All-Time membership display change

- `src/pages/HistoryPage.jsx` now filters only the All-Time member rows and
  member-name highlights through `group.activeMemberOrder`.
- Historical names still drive month history, historical totals, and the
  activity mix. No historical data is deleted or rewritten by this change.
- A server-render check with a former member confirmed: hidden while absent,
  old month counts retained, and name returned when included as active again.
- ESLint and Vite production build pass using their installed binaries. The
  laptop has no `npm` command; the exact commands behind `npm run lint` and
  `npm run build` were run directly. Build emitted only the existing large
  bundle warning.
- 23 of 23 runnable `test:*` scripts passed. `test:auth-edge-flows` and
  `test:mobile-navigation` were skipped because the local API/database sandbox
  is unavailable (Docker is not running). Four scripts that use `npx` were run
  successfully through a temporary shim in `/tmp`; it is not in the repo.
- The first package-manager attempt used the provided pnpm shim against the
  required `node_modules` symlink. It moved installed packages before refusing
  an install script. The original package directories and executable links
  were restored, the generated pnpm metadata/store was removed, and the shared
  checkout has no tracked changes from that attempt.

### Live data check (read only so far)

- Confirmed one active `Abhishek` membership in the live Bloc `Go To Da Gym`.
- Confirmed the live account `akijain2000` (the user's “Aki Jain 2000”) is an
  active member of `Ctrl Alt De-feat`.
- Before-removal live workout counts: Abhishek 73, akijain2000 8. These are
  baselines to verify remain after departure.
- The live member rows were confirmed as ordinary members, not Bloc admins.
- Both departed members had empty current-month blob log arrays, so the normal
  departure cleanup had no current log reactions or flags to change.

### Changes shipped and production data update

- Commit `d5781a4` (`Hide former members from All-Time leaderboard`) was pushed
  directly to `main` after confirming `origin/main` was its ancestor.
- Vercel deployment `dpl_3NxgUt8ZxWNKb8gvdrjypsRiigjf` is READY for commit
  `d5781a489cce2c78bb5f6b8fc789db11b96c2998`, with the production aliases
  `www.joinfero.app`, `joinfero.app`, and `lift-log-nu.vercel.app`. The live
  bundle contains the new `activeMemberOrder` filter. The public home page
  loaded successfully in the browser.
- Fresh full-state backup `public.lift_log_backups.backup_id = 2983`, saved at
  revision 2910 before the writes.
- Both removals were applied together in one guarded database operation. Each
  canonical membership now has `left_at` set, each blob membership is removed
  from the active lists and recorded in `leftMemberNames`, and the revision
  clock was advanced. No `member_removed` message was inserted.
- Verification: Abhishek is no longer active in Go To Da Gym and his 73 workout
  rows remain. `akijain2000` is no longer active in Ctrl Alt De-feat and the
  account's 8 workout rows remain. Both names are absent from `memberOrder` and
  present in `leftMemberNames`; neither membership remains in the blob map.
- No historical month snapshot, workout record, month count, or activity-mix
  data was changed. A later rejoin can reactivate the same canonical membership
  and restore the name to the active list without deleting the old records.
- No stream removal message was added. The normal app removal helper would add
  one, so the operation deliberately updated the membership and mirrored member
  lists directly while retaining the same departed-member markers.

## Verification details

- ESLint passed via its installed binary (`./node_modules/.bin/eslint src api
  scripts`) because this laptop has no `npm` command.
- Vite production build passed via `./node_modules/.bin/vite build`, with only
  the existing large-bundle warning.
- 23 runnable `test:*` scripts passed. `test:auth-edge-flows` and
  `test:mobile-navigation` could not run because Docker/local database is not
  available. The server-render check confirmed former members disappear from
  All Time and return if active again, while historical counts stay intact.
- Browser inspection confirmed the live Fero homepage loads. The live member
  leaderboard itself could not be opened because this browser has no signed-in
  Fero session; the production data and deployed bundle were verified directly.

## Files changed

- `src/pages/HistoryPage.jsx`
- `docs/HANDOVERS.md`
- `docs/handover-2026-10-10-all-time-members.md`
- `docs/WHATS-LIVE.md`

Nothing else was modified in the repository.

## Closeout

Live on `main` and production. The two memberships are marked departed; their
past workouts remain, and no stream notices were created. Open item: the
founder may want to check the visible All-Time view on a signed-in phone.

| Commit | Purpose | State |
| --- | --- | --- |
| `d5781a4` | Hide former members from All Time | On `main`, production READY |
