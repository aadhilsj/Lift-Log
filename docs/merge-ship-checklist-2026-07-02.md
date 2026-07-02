# Merge & Ship Checklist — 2026-07-02

This checklist is for landing:

- branch: `codex/membership-safety-fixes`

into `main`, then verifying production safely.

## Scope Being Shipped

This branch includes:

- approved Today / History / Results / Week's MVP product changes
- settlement confirmation SQL + repo artifacts
- canonical import hardening fixes
- migration closeout docs
- repo hygiene / artifact organization

This checklist is intentionally **not** a relational runtime cutover checklist.

## Pre-Merge

Before merging:

1. confirm branch is pushed
   - branch: `codex/membership-safety-fixes`
2. confirm local worktree is clean
3. confirm no further product changes are pending on this branch
4. confirm production database state is already correct
   - canonical import applied
   - Varun duplicate cleanup applied
   - parity query returned `0 rows`

## Merge

Preferred order:

1. open or review PR from `codex/membership-safety-fixes` into `main`
2. scan changed files for accidental scope creep
3. merge to `main`
4. wait for Vercel production deployment for `main`

## Immediate Production Verification

After deploy completes:

1. open live Today screen
   - leaderboard renders
   - row navigation works
   - no blank screen from row/profile navigation
   - early-month copy behaves correctly
2. open Activity
   - no white-screen / scroll-state regression
3. open Results
   - completed-month states render correctly
   - payout / perfect-month copy looks correct
4. open History
   - all-time leaderboard renders correctly
   - profile navigation works
5. open Week's MVP
   - this-week block renders
   - earlier-this-month rows render
   - no icon/calendar rendering regressions
6. settlement confirmations
   - if visible for a real account, claim/confirm flow still works

## Database Verification

Production spot checks after deploy:

1. canonical parity mismatch query returns `0 rows`
2. settlement confirmation tables / RPCs still present
3. no obvious production data regression in migrated blocs

## Rollback Trigger Conditions

Rollback or hotfix immediately if any of these happen:

- Today screen crashes
- Activity / History white-screen regression returns
- live profile navigation breaks
- Results screen copy/state logic is broken for real users
- settlement confirmation writes fail in production
- canonical read/write behavior regresses for real bloc data

## Rollback Shape

If rollback is needed:

1. revert the merge commit on `main`
2. redeploy production
3. do not revert the already-applied canonical import unless there is a proven data issue

The code release and the canonical historical import should be treated separately.

## After Successful Ship

If production looks good:

1. mark this branch as landed
2. archive or close the product-pass thread
3. start a new focused pass for:
   - relational runtime cutover
   - canonical read/write default path
   - blob retirement sequencing
