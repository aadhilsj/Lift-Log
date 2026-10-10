# Handovers — the index

**Every handover and reference doc in `docs/`, in one place.** Read this page
at the start of every session (`AGENTS.md` §0), then the docs it lists.

Same filename forever. Whoever writes a new handover adds one line to it here,
**at the top of its section**, in the same commit.

**When two docs disagree:** `WHATS-LIVE.md` wins over everything; otherwise
the newer dated doc wins over the older.

---

## 1. Read these every session

| Doc | What it is |
| --- | --- |
| [`../AGENTS.md`](../AGENTS.md) | The working agreement. `CLAUDE.md` is a symlink to it, so Codex and Claude read the same rules. |
| [`WHATS-LIVE.md`](WHATS-LIVE.md) | What is on the website vs TestFlight right now. Beats every handover. |
| The newest session handover in §2 | Where the last session stopped, and what it left open. |
| [`handover-2026-09-29-for-deveen-active.md`](handover-2026-09-29-for-deveen-active.md) | Deveen's current list — backend, database, RLS, CI. |
| [`recurring-debugging-playbook.md`](recurring-debugging-playbook.md) | Bugs that keep coming back (swipe, flicker, reactions, stale Blocs), with the fix rules. |
| [`solved-issues-log.md`](solved-issues-log.md) | Every bug already solved, so nobody re-derives one. |

**Before writing SQL:** [`SCHEMA.md`](SCHEMA.md).
**Before analysing numbers or writing a report:**
[`READ-BEFORE-ANALYSING-FERO-NUMBERS.md`](READ-BEFORE-ANALYSING-FERO-NUMBERS.md).

---

## 2. Session handovers — newest first

Read every one of these. Each is a dated record of one session.

### October 2026

| Date | Handover | About |
| --- | --- | --- |
| 10 Oct — **closed** | [`handover-2026-10-10-branch-cleanup.md`](handover-2026-10-10-branch-cleanup.md) | Six old GitHub branches and four matching local names removed after saving a restore copy; 14 non-main GitHub branches remain |
| 9 Oct — **active** | [`handover-2026-10-09-session-catch-up.md`](handover-2026-10-09-session-catch-up.md) | Back after a week away; nothing moved since 8 Oct; state of play, open items, cleanup candidates |
| 1–3 Oct (closed 8 Oct) | [`handover-2026-10-01-session-laptop-sync.md`](handover-2026-10-01-session-laptop-sync.md) | Back on the work laptop; new stickers; Today and the ended month redesigned — live at `473c761`; **Profile tab + History-into-Month designed, not built** |
| 1 Oct | [`handover-2026-10-01-month-close-and-money-fixes.md`](handover-2026-10-01-month-close-and-money-fixes.md) | The 1 October month close broke and was fixed; two money bugs; iCloud slowdown |

### September 2026

| Date | Handover | About |
| --- | --- | --- |
| 29–30 Sep | [`handover-2026-09-30-session.md`](handover-2026-09-30-session.md) | PWA bottom band solved; swipe and Bloc entry; TestFlight build 10 |
| 29 Sep | [`handover-2026-09-29-session.md`](handover-2026-09-29-session.md) | Codex's and Claude's sides of the 29th in one file |
| 29 Sep | [`handover-2026-09-29-swipe-settle-and-haptics.md`](handover-2026-09-29-swipe-settle-and-haptics.md) | Motion, haptics and the Claude/Codex build loop |
| 29 Sep | [`handover-2026-09-29-ios-polish-and-swipe.md`](handover-2026-09-29-ios-polish-and-swipe.md) | iOS polish, activity feed, swipe settle |
| 29 Sep | [`handover-2026-09-29-reactions-comments-and-pwa-parity.md`](handover-2026-09-29-reactions-comments-and-pwa-parity.md) | Reactions vanishing (an outage), Stream comments, PWA parity |
| 28 Sep | [`handover-2026-09-28-ios-header-and-layout.md`](handover-2026-09-28-ios-header-and-layout.md) | iOS header, spacing and nav bar |
| 27 Sep | [`handover-2026-09-27-photo-privacy-deletion-and-listing.md`](handover-2026-09-27-photo-privacy-deletion-and-listing.md) | Private photos, account deletion, App Store listing copy |
| 21–27 Sep | [`handover-2026-09-27-staging-outage-and-header.md`](handover-2026-09-27-staging-outage-and-header.md) | Sign-out fix, staging, Bloc header |
| 24 Sep | [`handover-2026-09-24-usage-tracking-release-2.md`](handover-2026-09-24-usage-tracking-release-2.md) | Usage tracking, release 2 |
| 24 Sep | [`handover-2026-09-24-founder-excluded-from-analytics.md`](handover-2026-09-24-founder-excluded-from-analytics.md) | The founder's testing removed from the usage numbers |
| 24 Sep | [`handover-2026-09-24-dashboard-metrics-accuracy.md`](handover-2026-09-24-dashboard-metrics-accuracy.md) | Founder dashboard accuracy |
| 22–23 Sep | [`handover-2026-09-23-month-ring-today-streak.md`](handover-2026-09-23-month-ring-today-streak.md) | Month ring polish, Bloc streak on Today |
| 22 Sep | [`handover-2026-09-22-month-loop.md`](handover-2026-09-22-month-loop.md) | The perfect-month loop (Month page and results) |
| 21–22 Sep | [`handover-2026-09-22-session-reminders-and-month-loop.md`](handover-2026-09-22-session-reminders-and-month-loop.md) | Reminders design, then the month loop |
| 22 Sep | [`handover-2026-09-22-settlement-reminders-and-setup-review.md`](handover-2026-09-22-settlement-reminders-and-setup-review.md) | Settlement reminders and Setup review |
| 21 Sep | [`handover-2026-09-21-workspace-audit-and-mirror-switch.md`](handover-2026-09-21-workspace-audit-and-mirror-switch.md) | Workspace audit, the live mirror switch |
| 20 Sep | [`handover-2026-09-20-month-close-canonical-and-open-season-gate.md`](handover-2026-09-20-month-close-canonical-and-open-season-gate.md) | Month close reads canonical; the gate sees open seasons |
| 20 Sep | [`handover-2026-09-20-ui-and-log-recovery.md`](handover-2026-09-20-ui-and-log-recovery.md) | Allowance activation, workout UI, log recovery |
| 20 Sep | [`handover-2026-09-20-yearly-allowance-now.md`](handover-2026-09-20-yearly-allowance-now.md) | Yearly allowance active now |
| 18–19 Sep | [`handover-2026-09-19-notes-furthest-behind-yearly-allowance.md`](handover-2026-09-19-notes-furthest-behind-yearly-allowance.md) | Private notes, Furthest behind, yearly allowance |
| 18 Sep | [`handover-2026-09-18-solo-new-rules.md`](handover-2026-09-18-solo-new-rules.md) | New Solo rules, the Solo sheet, the activity outage, App Store audit |
| 17–18 Sep | [`handover-2026-09-18-settings-redesign-and-solo-unlock.md`](handover-2026-09-18-settings-redesign-and-solo-unlock.md) | Members tab bug, Solo unlocked, Bloc settings redesigned |
| 18 Sep | [`handover-2026-09-18-app-store-preview-session.md`](handover-2026-09-18-app-store-preview-session.md) | App Store preview session |
| 16–17 Sep | [`handover-2026-09-17-squash-dance-reload-and-backfill.md`](handover-2026-09-17-squash-dance-reload-and-backfill.md) | Stickers, Squash, Dance, reload-on-deploy, backfill |
| 16 Sep | [`handover-2026-09-16-activities-live.md`](handover-2026-09-16-activities-live.md) | Workout activities live; restored-copy route for canonical testing |
| 9–14 Sep | [`handover-2026-09-14-session-delete-bug-to-runbook.md`](handover-2026-09-14-session-delete-bug-to-runbook.md) | From the delete bug to the blob runbook |
| 14 Sep | [`handover-2026-09-14-blob-runbook-tasks-1-4-and-log-fixes.md`](handover-2026-09-14-blob-runbook-tasks-1-4-and-log-fixes.md) | Blob runbook tasks 1–4, three workout-log fixes |
| 9 Sep | [`handover-2026-09-09-signin-fixes-and-delete-log-blob-divergence.md`](handover-2026-09-09-signin-fixes-and-delete-log-blob-divergence.md) | Sign-in fixes; a delete that never reached the blob |
| 6 Sep | [`handover-2026-09-06-parity-gate-liveness.md`](handover-2026-09-06-parity-gate-liveness.md) | Parity gate: rollover liveness |
| 3 Sep | [`handover-2026-09-03-redemption-and-training-wheels.md`](handover-2026-09-03-redemption-and-training-wheels.md) | Redemption shield and Training Wheels |
| 1 Sep | [`handover-2026-09-01-blob-retirement-parity-tooling.md`](handover-2026-09-01-blob-retirement-parity-tooling.md) | Blob retirement parity tooling |

### Deveen's handovers (backend)

| Week | Handover |
| --- | --- |
| 29 Sep — **active** | [`handover-2026-09-29-for-deveen-active.md`](handover-2026-09-29-for-deveen-active.md) |
| 22 Sep | [`handover-2026-09-22-for-deveen-active.md`](handover-2026-09-22-for-deveen-active.md) |

### June to August 2026 — the migration era

Older, and often superseded by September. Read them, but where one disagrees
with a newer doc, the newer doc wins.

| Date | Handover |
| --- | --- |
| 27 Aug | [`handover-2026-08-27-post-merge.md`](handover-2026-08-27-post-merge.md) |
| 17 Aug | [`handover-2026-08-17-banana-berry-onboarding-invite.md`](handover-2026-08-17-banana-berry-onboarding-invite.md) |
| 19 Jul | [`handover-2026-07-19-merge-and-app-store-readiness.md`](handover-2026-07-19-merge-and-app-store-readiness.md) |
| 12 Jul | [`handover-2026-07-12-backend-migration-current.md`](handover-2026-07-12-backend-migration-current.md) |
| 11 Jul | [`bloc-stream-handover-2026-07-11.md`](bloc-stream-handover-2026-07-11.md) |
| 4 Jul | [`handover-2026-07-04-current-main-migration-audit.md`](handover-2026-07-04-current-main-migration-audit.md) |
| 4 Jul | [`handover-2026-07-04-join-group-audit.md`](handover-2026-07-04-join-group-audit.md) |
| 4 Jul | [`handover-2026-07-04-next-migration-phase.md`](handover-2026-07-04-next-migration-phase.md) |
| 4 Jul | [`handover-2026-07-04-removal-lifecycle-audit.md`](handover-2026-07-04-removal-lifecycle-audit.md) |
| 3 Jul | [`handover-2026-07-03-read-cutover-phase-closed.md`](handover-2026-07-03-read-cutover-phase-closed.md) |
| 2 Jul | [`handover-2026-07-02-canonical-import-complete.md`](handover-2026-07-02-canonical-import-complete.md) |
| 2 Jul | [`handover-2026-07-02-active-vs-historical-membership-design.md`](handover-2026-07-02-active-vs-historical-membership-design.md) |
| 1 Jul | [`handover-2026-07-01-product-pass-closed.md`](handover-2026-07-01-product-pass-closed.md) |
| 1 Jul | [`handover-2026-07-01-left-member-lifecycle-audit.md`](handover-2026-07-01-left-member-lifecycle-audit.md) |
| 1 Jul | [`handover-2026-07-01-data-migration-restart-plan.md`](handover-2026-07-01-data-migration-restart-plan.md) |
| 30 Jun | [`handover-2026-06-30-today-screen-settlement-and-stat-cards.md`](handover-2026-06-30-today-screen-settlement-and-stat-cards.md) |
| 28 Jun | [`handover-2026-06-28-migration-pause-checkpoint.md`](handover-2026-06-28-migration-pause-checkpoint.md) |
| 26 Jun | [`handover-2026-06-26-blob-retirement-audit.md`](handover-2026-06-26-blob-retirement-audit.md) |
| 24 Jun | [`handover-2026-06-24-read-composition-audit.md`](handover-2026-06-24-read-composition-audit.md) |
| 24 Jun | [`handover-2026-06-24-mutation-audit.md`](handover-2026-06-24-mutation-audit.md) |
| 15 Jun | [`handover-2026-06-15-audit.md`](handover-2026-06-15-audit.md) |
| 11 Jun | [`handover-2026-06-11-session.md`](handover-2026-06-11-session.md) |
| 9 Jun | [`handover-2026-06-09-session.md`](handover-2026-06-09-session.md) |
| 7 Jun | [`handover-2026-06-07-canonical-migration.md`](handover-2026-06-07-canonical-migration.md) |

---

## 3. Reference docs, by topic

Not session records — read the ones for the area you are about to touch.

**Product rules and designs**
- [`solo-rules-decisions-2026-09-18.md`](solo-rules-decisions-2026-09-18.md) — Solo rules to carry forward
- [`two-workouts-per-day-plan-2026-08-26.md`](two-workouts-per-day-plan-2026-08-26.md) — the deliberate two-a-day cap
- [`share-sticker-implementation-plan-2026-08-01.md`](share-sticker-implementation-plan-2026-08-01.md) and `share-sticker-reference/` — locked sticker design
- [`bloc-stream-system-moments-rulebook-2026-07-19.md`](bloc-stream-system-moments-rulebook-2026-07-19.md) — what the Stream posts automatically
- [`concept-2026-09-23-settlement-notes-and-the-chooser.md`](concept-2026-09-23-settlement-notes-and-the-chooser.md) — concept, not built
- [`concept-2026-09-24-notification-centre.md`](concept-2026-09-24-notification-centre.md) — concept, not built
- [`onboarding-evaluation-2026-08-24.md`](onboarding-evaluation-2026-08-24.md)
- [`profile-and-account-restructure-2026-08-29.md`](profile-and-account-restructure-2026-08-29.md)

**App Store**
- [`app-store-submission-runbook.md`](app-store-submission-runbook.md)
- [`app-store-listing-final-copy-2026-09-27.md`](app-store-listing-final-copy-2026-09-27.md) — agreed listing copy
- [`current-plan-2026-08-02-preview-to-app-store.md`](current-plan-2026-08-02-preview-to-app-store.md), [`current-plan-2026-08-01-merge-to-app-store.md`](current-plan-2026-08-01-merge-to-app-store.md) — older plans

**Database, security and scaling**
- [`SCHEMA.md`](SCHEMA.md) — before any SQL
- [`rls-inventory-2026-09-20.md`](rls-inventory-2026-09-20.md), [`rls-migration-rehearsal-2026-09-26.md`](rls-migration-rehearsal-2026-09-26.md) — RLS
- [`staging-environment-spec-2026-09-20.md`](staging-environment-spec-2026-09-20.md) — `fero-staging`
- [`scaling-before-launch-2026-09-15.md`](scaling-before-launch-2026-09-15.md) — why a few phones overloaded the database
- [`rollover-incident-2026-09-01.md`](rollover-incident-2026-09-01.md) — the 1 September month-boundary incident
- [`state-of-play-2026-09-26.md`](state-of-play-2026-09-26.md) — who owned what before the 1 October close
- [`rollback-2026-09-24-dashboard-metrics.sql`](rollback-2026-09-24-dashboard-metrics.sql)

**Blob retirement** (moving off the single JSON blob onto `ante_core`)
- [`blob-retirement-impact-2026-09-03.md`](blob-retirement-impact-2026-09-03.md)
- [`blob-retirement-runbook-aadhil-side-2026-09-06.md`](blob-retirement-runbook-aadhil-side-2026-09-06.md)
- [`relational-cutover-plan.md`](relational-cutover-plan.md), [`canonical-importer-design.md`](canonical-importer-design.md), [`canonical-parity-audit-current-phase.md`](canonical-parity-audit-current-phase.md)
- [`supabase-migration.md`](supabase-migration.md), [`write-hydration-retirement-plan-2026-07-11.md`](write-hydration-retirement-plan-2026-07-11.md), [`profile-stats-endpoint-followup-2026-08-29.md`](profile-stats-endpoint-followup-2026-08-29.md)
- July closeouts: [`backend-migration-closeout-plan-2026-07-12.md`](backend-migration-closeout-plan-2026-07-12.md), [`backend-residue-closeout-audit-2026-07-11.md`](backend-residue-closeout-audit-2026-07-11.md), [`read-cutover-closeout-2026-07-03.md`](read-cutover-closeout-2026-07-03.md)
- July production runbooks: [`production-canonical-import-runbook-2026-07-02.md`](production-canonical-import-runbook-2026-07-02.md), [`production-execution-checklist-2026-07-01.md`](production-execution-checklist-2026-07-01.md), [`production-release-audit-2026-07-01.md`](production-release-audit-2026-07-01.md), [`production-rollout-plan-2026-07-01.md`](production-rollout-plan-2026-07-01.md), [`merge-ship-checklist-2026-07-02.md`](merge-ship-checklist-2026-07-02.md)

**Analytics**
- [`READ-BEFORE-ANALYSING-FERO-NUMBERS.md`](READ-BEFORE-ANALYSING-FERO-NUMBERS.md) — before any numbers
- [`product-growth-measurement.md`](product-growth-measurement.md)

**Running and debugging**
- [`local-dev.md`](local-dev.md)
- [`recurring-debugging-playbook.md`](recurring-debugging-playbook.md), [`solved-issues-log.md`](solved-issues-log.md)
- [`reaction-mutation-race-runbook-2026-07-19.md`](reaction-mutation-race-runbook-2026-07-19.md)
- [`in-bloc-profile-swipe-layering-note-2026-07-16.md`](in-bloc-profile-swipe-layering-note-2026-07-16.md)

**June–July records** (historical)
- Frontend extraction: [`frontend-extraction-plan-2026-07-09.md`](frontend-extraction-plan-2026-07-09.md), [`extraction-record-2026-07-09.md`](extraction-record-2026-07-09.md)
- Settlement: [`settlement-investigation-2026-06-28.md`](settlement-investigation-2026-06-28.md), [`settlement-cards-implementation-2026-06-28.md`](settlement-cards-implementation-2026-06-28.md), [`settlement-audit-2026-06-29-preview-branch.md`](settlement-audit-2026-06-29-preview-branch.md)
- QA updates: [`qa-followup-2026-06-16-season-overrides.md`](qa-followup-2026-06-16-season-overrides.md), [`qa-update-2026-06-17-bloc-members-backfill.md`](qa-update-2026-06-17-bloc-members-backfill.md), [`qa-update-2026-06-17-sitout-slices.md`](qa-update-2026-06-17-sitout-slices.md), [`qa-update-2026-06-18-display-name-repair.md`](qa-update-2026-06-18-display-name-repair.md), [`qa-update-2026-06-18-importer-id-reconciliation.md`](qa-update-2026-06-18-importer-id-reconciliation.md), [`qa-update-2026-07-04-create-group-canonical-first.md`](qa-update-2026-07-04-create-group-canonical-first.md)
