# Supabase `settlement-test` Branch Retirement - 2026-08-11

## Purpose

This document records the audit, deletion boundary, execution steps, and final
verification for retiring the obsolete hosted Supabase test branch that caused
an unexpected branching-compute charge.

## Hard Safety Boundary

Protected production project - do not modify:

- project ref: `bpvvvqjsfwmmfjvvijkd`
- role: Fero live/production Supabase project
- current production and Vercel preview deployments both point here

Deletion target only:

- branch name: `settlement-test`
- branch project ref: `pukarpxsrmbnkbagyidg`
- internal branch id: `e5c3beed-3ce6-489f-b813-1f738d5ad962`
- role: disposable hosted Supabase test branch

No SQL, schema, data, Auth, Storage, settings, keys, or branch operations are to
be performed against `bpvvvqjsfwmmfjvvijkd` during this retirement.

## Why The Branch Existed

The branch was created around 2026-06-28/29 to test the real settlement claim,
confirm, dispute, and reminder-card flows without risking production data. The
production `lift_log_state` was copied into it, and the missing canonical helper
baseline plus settlement SQL were applied there for functional QA.

The relevant historical records are:

- `docs/settlement-cards-implementation-2026-06-28.md`
- `docs/settlement-audit-2026-06-29-preview-branch.md`
- `docs/handover-2026-06-30-today-screen-settlement-and-stat-cards.md`

## Production Completion Evidence

- Settlement claim/confirm/dispute behavior was verified green on the branch.
- Commit `9be428e` shipped settlement confirmations and the mobile UI refresh.
- That commit is an ancestor of current `main`.
- `docs/handover-2026-07-01-product-pass-closed.md` records the production
  Supabase SQL baseline, production Vercel enablement, and release as complete.
- Later settlement fixes were verified live and promoted to production.
- On 2026-08-11, both the production site and active Vercel workflow preview
  returned Supabase ref `bpvvvqjsfwmmfjvvijkd`.
- Vercel reported no runtime errors for the project in the preceding seven days.

## Branch Data Inventory

Read-only inspection on 2026-08-11 found:

- one Supabase Auth user
- last Auth sign-in: 2026-06-30
- one `lift_log_state` row
- one Storage bucket: `profile-photos`
- 16 top-level Storage entries in that bucket
- 120 compatibility backups from 2026-06-28 through 2026-08-09

Backup reasons show disposable workflow-test activity:

- `profile`: 49
- `join-group`: 25
- `profile-photo`: 16
- `create-group`: 15
- `settings`: 11
- `solo-request`: 2
- initial production seed: 1
- initial auth sync: 1

The August writes came from the local fake-OTP workflow harness. They do not
represent a production dependency or source code that exists only in Supabase.
Some onboarding/invite implementation remains on the Git preview branch, but
that source is preserved in Git and is independent of this database branch.

## Repository And Deployment Dependency Audit

Before retirement, exact operational references to the deletion target existed
only in:

- the three historical documents listed above
- gitignored `.env.local` files in both worktrees

The two environment files have since been neutralized, so they no longer contain
a Supabase project URL or credentials. This document intentionally retains the
identifiers as an audit record.

No tracked runtime configuration, Vercel deployment, GitHub automation, SQL
migration, or production application code points to `pukarpxsrmbnkbagyidg`.
All SQL used for settlement and canonical setup is tracked under `supabase/`.

Pre-retirement local-only findings:

- main worktree `.env.local` pointed to `pukarpxsrmbnkbagyidg`
- extraction worktree `.env.local` pointed to `pukarpxsrmbnkbagyidg`
- 20 stale Vite processes were found for the extraction worktree
- one stale Vite process was still listening on port `5199`

Deleting the branch will therefore affect only obsolete local test
configuration and synthetic fixtures. It will not affect deployed production.
Local mutation testing must not be repointed to production; use local Supabase
or a deliberately created temporary test environment instead.

## Billing Context

Invoice `TIFODM-00006` billed 744 hours of Branching Compute for the target over
2026-07-11 through 2026-08-10:

- branch compute before tax: USD 10.00
- Norwegian VAT attributable to branch compute: USD 2.50
- total unexpected branch-related amount: USD 12.50

The accurate support position is that the branch was intentionally created as a
temporary test environment but was unintentionally left persistent and kept
accruing compute. A one-time courtesy refund or account credit can be requested;
the charge is valid usage under Supabase billing rules, so approval is not
guaranteed.

## Retirement Procedure And Status

- [x] Confirm target ref is `pukarpxsrmbnkbagyidg`.
- [x] Confirm protected production ref is `bpvvvqjsfwmmfjvvijkd`.
- [x] Confirm both endpoints were healthy before retirement.
- [x] Confirm production and active Vercel preview use the protected ref.
- [x] Confirm branch-only state is disposable and code/SQL is preserved in Git.
- [x] Verify the exact target through the authenticated Supabase branch list.
- [x] Attempt to pause `settlement-test` only. Supabase refused the pause for
  insufficient permission; no state changed.
- [x] Recheck production health after the refused pause attempt.
- [x] Delete `settlement-test` only through the authenticated branch-specific
  delete operation.
- [x] Confirm the target is absent from the Supabase branch list.
- [x] Confirm the target endpoint no longer serves the branch (`HTTP 410`).
- [x] Confirm production remains healthy and unchanged (`ACTIVE_HEALTHY`, API
  `HTTP 200`).
- [x] Stop stale local Vite processes tied to the obsolete worktree server.
- [x] Remove obsolete target credentials from both gitignored `.env.local` files.
- [ ] Check the Supabase upcoming invoice/usage view for stopped branch compute.

## Final Outcome

Completed at 2026-08-11T11:14:43Z.

The authenticated Supabase connector deleted only internal branch id
`e5c3beed-3ce6-489f-b813-1f738d5ad962`. Post-deletion verification showed:

- the parent branch list contains only default branch `main`
- `settlement-test` is absent
- `pukarpxsrmbnkbagyidg` returns `HTTP 410`
- protected production `bpvvvqjsfwmmfjvvijkd` remains `ACTIVE_HEALTHY`
- the production Auth settings endpoint returns `HTTP 200`
- zero extraction-worktree Vite processes remain
- nothing is listening on local port `5199`
- both worktrees have empty Supabase URL/anon/service-role entries and an
  explanatory retirement comment

The Supabase usage/upcoming-invoice view may take time to refresh. Confirm that
Branching Compute no longer accumulates there, then use this record plus invoice
`TIFODM-00006` when requesting a one-time courtesy refund or account credit.
