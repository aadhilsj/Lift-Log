# Firo Laptop Migration Handoff

Started: 2026-08-24  
Laptop hand-in deadline: 2026-08-31

This is the durable migration checklist for moving Firo development from the
current laptop to the personal laptop. Update it at each checkpoint. Do not put
passwords, tokens, API keys, OTP codes, or `.env.local` values in this file.

## Goal

Before the current laptop is handed in, the personal laptop must be able to:

- clone Firo from GitHub;
- check out the active onboarding work;
- install dependencies and build the app;
- run the local app and API;
- connect to the intended Supabase and Vercel projects;
- push a test branch back to GitHub; and
- continue from a clear written description of unfinished work.

## Repository Identity

- Product name: Firo
- Local repository directory: `Lift Log`
- GitHub remote: `git@github.com:aadhilsj/Lift-Log.git`
- Production branch: `main`
- Active preview/onboarding branch: `codex/reconcile-chat-with-backend`
- Active preview worktree directory on the old laptop: `Lift Log Extraction`

The repository directory still uses the old `Lift Log` name. Do not rename the
repository or remote as part of the laptop migration unless that is handled as
a separate, deliberate task.

## State Recorded On 2026-08-24

### Production checkout: `main`

`main` itself points at the same commit as the locally known `origin/main`:
`588abfd` (`Fix live Solo Mode fallback`). Its working tree is dirty.

Local modified files:

- `.gitignore`
- `src/components/ColdOnboarding.jsx`
- `src/components/authShell.jsx`

The two component edits restore the approved onboarding and invite-preview UI.
See `docs/handover-2026-08-17-banana-berry-onboarding-invite.md` before changing
or discarding them.

Important untracked material includes:

- the current merge/App Store plan;
- the onboarding/invite handover;
- share-sticker plans and references;
- Supabase return/settlement notes;
- onboarding journey capture and rendering scripts; and
- the onboarding journey screenshots, ZIP files, and PowerPoint pack.

There are currently 431 untracked files. Of those, 367 are under
`docs/user-journey-screenshots/`. The full untracked set is about 101 MB. These
assets must be curated or archived before the final handoff; do not blindly run
`git add -A`.

### Preview/onboarding checkout

The `Lift Log Extraction` worktree is on
`codex/reconcile-chat-with-backend`. The branch tip `c8f3aac` is present on its
GitHub remote branch, but the worktree contains substantial uncommitted work.

Modified areas include:

- API join/profile behavior;
- the current preview-to-App-Store plan;
- application routing and onboarding state;
- cold onboarding and auth shell UI;
- primitives and Today page behavior; and
- profile-photo and invite-flow support.

Local-only additions include the pnpm lock/workspace files and
`scripts/test-profile-photo-storage.mjs`.

At the recorded checkpoint, `main` has 11 commits not in the preview branch and
the preview branch has 34 commits not in `main`. The final integration must
preserve production rollover/settlement fixes from `main` while bringing in the
preview onboarding work. Do not replace one branch with the other wholesale.

### Local stash

There is one local stash:

`stash@{0}: WIP on main: f971678 Move canonical schema into ante_core`

It changes `api/lift-log.js`, `scripts/canonical-to-sql.mjs`, and
`scripts/state-to-canonical.mjs`. A stash is not transferred by cloning the
repository. Before hand-in, either preserve it on an explicitly named archival
branch after review or include it in the encrypted recovery backup.

## Files That Must Not Go To GitHub

- `.env.local`
- `.vercel/`
- `.tmp/`
- `node_modules/`
- `dist/`
- `.home/`
- `supabase-local/`
- private credentials, access tokens, service-role values, and OTP values

`.env.example` records the required variable names without real credentials.
Actual values must be transferred through a password manager or encrypted
backup and recreated on the personal laptop.

## Credential Recovery Map (verified 2026-08-27)

The original plan assumed `.env.local` on the old laptop held the values worth
carrying across. **It does not.** Verified by inspection on 2026-08-27:

| Variable | On old laptop `.env.local` | Readable in Vercel? | Real source of truth |
| --- | --- | --- | --- |
| `SUPABASE_URL` | **empty** | yes (eye icon) | Supabase dashboard -> Project Settings -> API |
| `SUPABASE_ANON_KEY` | **empty** | **no — Sensitive/padlocked** | Supabase dashboard -> Project Settings -> API |
| `SUPABASE_SERVICE_ROLE_KEY` | **empty** | **no — Sensitive/padlocked** | Supabase dashboard -> Project Settings -> API |
| `ADMIN_PIN` | stale value, rejected by production | **no — Sensitive/padlocked** | Nowhere. Unrecoverable; must be reset. |
| `ENABLE_SETTLEMENT_CONFIRMATIONS` | set | yes | Vercel |
| `ENABLE_SETTLEMENT_CONFIRMATIONS_PREVIEW` | set | yes | Vercel |
| `ENABLE_LOCAL_PREVIEW_AUTH` | set | yes | Vercel |

Consequences for the migration:

- **There is no local credential backup to carry across.** Do not plan the
  handover around copying `.env.local`; it is mostly empty. Nothing is lost by
  the laptop being wiped, but nothing is gained by preserving the file either.
- **The two Supabase keys are recoverable only from the Supabase dashboard.**
  Vercel stores them write-only, so they cannot be read back from there and
  `vercel env pull` will not return them. Retrieve them from Supabase
  (Project Settings -> API) and put them straight into the password manager.
- **`ADMIN_PIN` is not recoverable from anywhere.** The old laptop's copy is
  stale (production returned 401 on 2026-08-27) and Vercel stores it write-only.
  It must be reset in Vercel and the project redeployed for the new value to
  take effect. Nothing depends on the old value: `ADMIN_PIN` is read from the
  environment at request time in `api/lift-log.js` and gates only the admin
  diagnostic actions, plus one internal settlement self-consistency check at
  `api/lift-log.js:6360` that reads the same variable.
- When resetting it, do not use another 4-digit number. The endpoint is public
  and has no lockout. Generate a long random value (`openssl rand -hex 24`) and
  store it in the password manager immediately, because Vercel will not show it
  again either.

### Node/toolchain prerequisite

`npx` and `npm` are **not on the default shell PATH** on the old laptop; Node is
installed through nvm at `~/.nvm/versions/node/v24.16.0/bin/`. The clean-clone
smoke test below silently assumes a working Node install. Install nvm and a
matching Node version on the personal laptop **before** running `npm ci`, or the
first migration step will fail for a reason unrelated to the repository.

## Source Documents For The Onboarding Finish

Read these before finishing or merging the onboarding work:

1. `docs/handover-2026-08-17-banana-berry-onboarding-invite.md`
2. `docs/current-plan-2026-08-01-merge-to-app-store.md`
3. In the preview worktree:
   `docs/current-plan-2026-08-02-preview-to-app-store.md`
4. `docs/solved-issues-log.md`
5. `docs/recurring-debugging-playbook.md`

## Migration Checkpoints

### Checkpoint 1: Initial audit

- [x] Record repository, remote, branches, and worktrees.
- [x] Record dirty files and local-only assets.
- [x] Record the local stash.
- [x] Add `.tmp/` to `.gitignore`.
- [ ] Decide which onboarding journey artifacts belong in Git, Git LFS, or the
      encrypted asset archive.

### Checkpoint 2: Finish onboarding work

- [ ] Finish the onboarding/auth changes in the preview worktree.
- [ ] Reconcile the approved `main` UI corrections with the preview versions.
- [ ] Run the onboarding journey matrix in the active preview plan.
- [ ] Run the production build and relevant tests.
- [ ] Commit the preview work in logical commits.
- [ ] Push `codex/reconcile-chat-with-backend` to GitHub.

### Checkpoint 3: Reconcile with production

- [ ] Fetch the current remote state.
- [ ] Merge or rebase deliberately, preserving the live rollover and settlement
      fixes documented in the onboarding handover.
- [ ] Resolve onboarding/auth conflicts by behavior, not merely by choosing one
      side of a file.
- [ ] Repeat build and critical-flow verification.
- [ ] Merge the approved result to `main` and push it.
- [ ] Confirm GitHub shows the intended `main` and preview commits.

### Checkpoint 4: Prepare local-only recovery material

- [ ] ~~Transfer `.env.local` values through an encrypted channel.~~ Superseded:
      see the Credential Recovery Map above. `.env.local` is mostly empty and is
      not the source of truth for anything.
- [ ] Retrieve `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and
      `SUPABASE_SERVICE_ROLE_KEY` from the Supabase dashboard
      (Project Settings -> API) into the password manager.
- [ ] Reset `ADMIN_PIN` in Vercel to a long random value, redeploy, and store
      the new value in the password manager.
- [ ] Confirm you can still sign in to both the Vercel and Supabase accounts
      from a browser that is not on the old laptop.
- [ ] Preserve the old stash in an archive branch or encrypted Git bundle.
- [ ] Preserve selected onboarding journey/reference assets.
- [ ] Create a final repository bundle as an offline recovery copy.

### Checkpoint 5: Personal laptop verification

- [ ] Install Codex and sign in normally; do not copy `auth.json`.
- [ ] Authenticate GitHub with a new credential on the personal laptop.
- [ ] Clone `git@github.com:aadhilsj/Lift-Log.git`.
- [ ] Open the cloned directory as a local Codex project.
- [ ] Install nvm and Node (old laptop ran v24.16.0) before anything else.
- [ ] Rebuild `.env.local` from `.env.example` using the password-manager
      values, not from a copy of the old file.
- [ ] Install dependencies.
- [ ] Re-link or sign in to Supabase and Vercel as required.
- [ ] Run the build and relevant tests.
- [ ] Run the app and verify the active onboarding flows.
- [ ] Create, push, and delete a harmless test branch to confirm GitHub access.

Initial clean-clone smoke test from `main`:

```sh
git clone git@github.com:aadhilsj/Lift-Log.git
cd Lift-Log
npm ci
npm run build
```

After `.env.local` is restored, run the API and frontend in separate terminals:

```sh
npm run dev:api
npm run dev
```

The preview worktree currently contains uncommitted pnpm workspace files. Do
not switch the clean-clone installation command from `npm ci` to pnpm until the
preview package-manager change is intentionally reviewed and committed.

## Final Handoff Record

Complete this immediately before the old laptop is handed in:

- Final `main` commit:
- Final onboarding/preview commit, if still separate:
- GitHub branches intentionally retained:
- Recovery bundle location:
- Encrypted asset archive location:
- Personal-laptop build result:
- Personal-laptop local-flow result:
- Personal-laptop GitHub push/pull result:
- Remaining known issues and next action:

## Audit Update — 2026-08-27

The Banana Berry work has since been merged into `main` and refreshed against
GitHub.

- Local `main` and `origin/main` match at `5a9e327` (`docs: add post-merge
  continuation handover`).
- The tracked Firo working tree is clean.
- The post-merge handover at `docs/handover-2026-08-27-post-merge.md` is
  accurate about the release, but its recorded commit `7a29c93` is one commit
  behind the current `main`; the later `5a9e327` commit only adds continuation
  handover documentation.
- The local preview branch `codex/reconcile-chat-with-backend` is two commits
  ahead of its remote branch, but both commits are already ancestors of
  `main`; no preview code is missing from the merged production history.
- That preview worktree still has two untracked pnpm workspace/lock files. Keep
  them only if the pnpm package-manager change is intentional; otherwise leave
  them out of the migration snapshot.
- The Firo checkout still has six untracked entries containing 381 files,
  primarily onboarding journey/reference assets. These are not on GitHub yet.
- The local canonical-schema stash remains present and is not transferred by a
  normal clone.
- GitHub pruned the already-merged remote branch
  `codex/two-workouts-per-day`; the remaining remote branches are visible with
  `git branch -r`.
