# Handover — 10 October 2026: branch cleanup

**Closed.** The founder approved removing the six old branch names discussed
in chat, after saving a restorable copy. The cleanup is complete; this docs
commit records it.

## Starting point

- The cleanup record was pushed to `main` in `4f13505` (parent
  `19ed525`).
- The live website is the 9 October production version; the cleanup does not
  change app code or the live site.
- The shared checkout has four untracked backup disk images. They are untouched.
- Two existing worktrees are attached to other local work. They are untouched.
- Six removed GitHub branch names, with the saved commit IDs:
  - `ante-profiles-read` — `4d025d5`
  - `codex/founder-dashboard-access-preview` — `84492b1`
  - `projection-read-fallback` — `9fed49d`
  - `optimistic-single-log-fix` — `7bc41a6`
  - `saving-indicator-layout-fix` — `f45d5d7`
  - `codex/testflight-build-2` — `7363442`
- The other 14 non-main GitHub branches remain: nine for current or unfinished
  work and five as historical reference. Including `main`, GitHub now has 15
  branches in this count.

## Work in progress

- A separate worktree was created at
  `/Users/opera_user/Developer/FERO/branch-cleanup-2026-10-10`, from
  `origin/main`; `node_modules` is symlinked from the shared checkout and
  `.env.local` copied in as required.
- A verified backup bundle containing exactly the six removed branch tips is
  at `/Users/opera_user/Developer/FERO/branch-cleanup-archive-2026-10-10.bundle`.
- Removed the six GitHub branch names with pushes pinned to their checked commit
  IDs. Removed the four matching local names that existed and were not attached
  to a worktree: `ante-profiles-read`, `projection-read-fallback`,
  `optimistic-single-log-fix`, and `saving-indicator-layout-fix`.
- The other six branches had no matching local branch names in this checkout.
- No app files, live app behaviour, existing worktrees, or untracked backup
  images were changed.
- Production deployment `6975356071` for `4f13505` succeeded. The live site
  still runs the same app code; this cleanup changed branch names and docs only.

## Closeout

- GitHub: 14 branches besides `main`; 15 including `main`.
- Local branch names removed: the four listed above. Existing attached worktrees
  and unrelated local branches remain untouched.
- Verification: the backup bundle passed `git bundle verify`; `git fetch
  --all --prune` showed the six remote names gone and 14 non-main remote names
  remaining; the `verify` check and Vercel deployment succeeded. The live site
  loaded with HTTP 200 and no browser console errors.
- `npm` is not available in this shell. Ran the project's ESLint and Vite build
  commands directly through the installed Node.js runtime; both passed. The
  build emitted only its existing large-chunk warning.
- Commit: `4f13505` records the cleanup and is on `main`.
- Production: unchanged; no app deployment was requested or needed.
