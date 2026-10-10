# Handover — 10 October 2026: departed members and All-Time leaderboard

**Active.** Opened before implementation, as required by `AGENTS.md` §0.

## Goal

Show only current Bloc members on the All-Time leaderboard and its member-name
highlights. Preserve historical months, workout totals, and activity mix. Then
remove Abhishek from Go To Da Gym and Aki Jain 2000 from Ctrl Alt De-feat,
preserving their records and clearing only any removal notice created by those
actions, as previously requested.

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
- No source or production data has been changed yet.

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
- Latest existing `lift_log_backups` entry is from 10 October. A fresh backup
  will be made immediately before the membership changes.
- Vercel project `lift-log` is correctly linked; the latest production deploy
  is READY for `2934a62`.
- No production data has been changed yet.

Record the commit, push, deployment, backup, removals, and final verification
here as they happen.

## Closeout

Pending.
