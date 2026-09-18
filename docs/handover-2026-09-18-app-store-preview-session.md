# Handover — App Store Preview session, 2026-09-18

This is the single continuation note for the long App Store preparation session.
It is written for the next agent and the founder. Read it before changing the
App Store Preview branch or giving App Store advice.

## Plain-English status

Fero is **not ready to submit today**, but the social-safety work is now much
more complete. A member can block another current Bloc member for themselves,
report a Stream message, workout comment, workout post, or profile, and a
founder can hide a reported message/comment/workout post from members without
deleting it. The founder can restore it if the decision was wrong.

The Preview-only App Store branch contains this work. The database additions
were intentionally applied to the live Supabase project because they are
additive and inert until a founder uses them; no existing content was changed.
The remaining major technical blocker is the older database access-control/RLS
rollout owned by Deveen. The remaining founder-owned blockers are public legal
pages, a support email/domain, App Store Connect setup, reviewer access, and
final device/TestFlight testing.

**Current App Store review readiness: 77%.** This is a planning measure, not an
Apple approval estimate.

## Non-negotiable working rules

Read `AGENTS.md` first. In particular:

- Explain in plain English; the founder is not a developer.
- Keep App Store feature work on Preview. Do not merge Preview app code to
  `main`. The founder promotes a tested Preview release later.
- Claude/other agents can be in this repository. Never switch the shared
  worktree's branch, never use `git add -A`, and stage only named files.
- Never deploy production without an explicit request.
- The `ios/App/App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/`
  directory is untracked, pre-existing workspace material. Do not add or remove
  it.
- The standing AGENTS rule says the founder runs Supabase SQL. In this session
  the founder expressly overrode that for the two UGC moderation migrations and
  asked Codex to apply them. Do not treat that as standing permission for future
  production database changes.

## Repository and branch map

| Item | State at handover |
| --- | --- |
| Repository | `https://github.com/aadhilsj/Lift-Log.git` |
| Preview branch | `codex/app-store-readiness` |
| Preview HEAD | `30ca4f9 Add founder moderation for workout posts` |
| Latest main observed | `3672231 docs: section 12 in AGENTS.md — the working loop the founder approved` |
| Preview/main relationship | They have diverged substantially. Do **not** merge Preview into main. When the founder says main is stable, merge **main into Preview** and resolve/test there. |
| Main documentation already added from Preview | `33de0ce` (docs-only cherry-pick of the blob/RLS handover). No Preview app code was moved with it. |
| Current release target | Free, invite-only Fero V1. No in-app purchases or premium gate in the submission build. |

The commits most relevant to this session, oldest first:

| Commit | Meaning |
| --- | --- |
| `c197efb` | Private-photo delivery code and rollout material for app review |
| `3a57701` | Server-side text safety filter |
| `466ef70` | Durable UGC reports/block database queue |
| `b2ae710` | Bloc Stream report/block controls |
| `c47ecc0` | Workout-comment report/block controls |
| `99eb414` | Activity/workout-post report/block controls |
| `c59909b` | Other member-profile report/block controls |
| `566affd` | Reversible founder hide/restore for Stream messages/comments |
| `30ca4f9` | Reversible founder hide/restore for workout posts |

## What was built on Preview

### 1. Member safety controls

Affected UI files:

- `src/pages/BlocStream.jsx`
- `src/components/LogCommentThread.jsx`
- `src/pages/ActivityFeed.jsx`
- `src/pages/PlayerProfile.jsx`

Each shows a small `•••` safety control for another member, never for the
viewer themselves. It opens a sheet with:

- **Report** — choose a reason and optional detail. The reason is stored in a
  private founder queue.
- **Block member** — hides that member's relevant content for the person who
  blocked them. It does not remove either person from the Bloc, change workout
  counts, rankings, settlement records, or payments.

Reporting supports these content types:

| Surface | Report type | What a founder can do now |
| --- | --- | --- |
| Bloc Stream message | `stream_message` | Hide/restore it from member view |
| Workout comment | `workout_comment` | Hide/restore it from member view |
| Activity workout post | `workout_log` | Hide/restore it from Today/Activity member view |
| Other member profile | `profile` | Review/dismiss only; no profile suspension feature exists yet |

Do not say that blocking bans a member. It is a personal visibility choice.

### 2. Founder moderation queue

Affected files:

- `src/pages/FounderDashboard.jsx`
- `src/lib/api.js`
- `api/lift-log.js`

The Founder Dashboard has a **Moderation** tab. A founder (the pre-existing
server-side founder allowlist is enforced before every queue action) can:

- see reports;
- mark them reviewed or dismiss them;
- hide a reported Stream message, comment, or workout post from members;
- restore hidden content.

The button deliberately says **Hide from members**, not delete. The audit log
records the action, actor and time. The founder dashboard currently does not
show the reported body/content itself; it shows the report context and member
supplied details. That is a future usability improvement, not required to make
the current safety path work.

### 3. Database implementation and live state

Project: Supabase `bpvvvqjsfwmmfjvvijkd` (`Lift Log`, EU-West).

These repository migrations exist and were applied to the live project during
this session:

| Repository migration | Applied migration name | Purpose |
| --- | --- | --- |
| `supabase/migrations/20260916150000_add_ugc_moderation.sql` | `add_ugc_moderation` | `user_blocks`, `content_reports`, private report/block RPCs |
| `supabase/migrations/20260918090000_add_founder_content_removal.sql` | `add_founder_content_removal` | reversible moderation for Stream messages/comments and audit table |
| `supabase/migrations/20260918100000_add_workout_post_moderation.sql` | `add_workout_post_moderation` | reversible moderation for workout posts and reader filtering |

The first one may appear in Supabase's migration history under a generated
timestamp (`20260916222241`) rather than the repository filename. That is not
an error; do not re-run it just because the numbers differ.

Private tables:

- `ante_core.user_blocks`
- `ante_core.content_reports`
- `ante_core.content_moderation_actions`

All have RLS enabled and direct table access revoked from `public`, `anon`, and
`authenticated`. The server uses its service-role key only after authenticating
the member and, for queue actions, checking the founder allowlist.

The following service-only RPCs were introduced/updated:

- `read_ante_core_user_blocks`
- `set_ante_core_user_block`
- `create_ante_core_content_report`
- `read_ante_core_content_reports`
- `review_ante_core_content_report`
- `moderate_ante_core_report_content`

Important safety property: the moderation RPC verifies that the reported item
is in the report's Bloc **and belongs to the reported person** before it can be
hidden. A forged report cannot be used to hide somebody else's content.

No existing post, comment, or message was hidden while verifying this work.

### 4. Reader behaviour after moderation

- A hidden Stream message is excluded before Stream pagination.
- A hidden comment is excluded from the comment reader and its displayed count.
- A hidden workout post is excluded from the canonical current-log reader that
  powers the current season's Today and Activity views. Its comment count is
  excluded too, preventing an empty visible comment indicator.
- The original record remains in `ante_core` for founder restoration/audit; it
  is not a destructive delete.
- Historical closed-season views have not been given a new founder removal path
  in this session. The Activity feed reports current active Bloc logs.

`supabase/ante-core-current-logs-read-rpc.sql` was updated alongside the
migration so the source/reference reader matches the live behavior.

## Verification completed

All following checks passed against the local Fero/Lift-Log Preview checkout
after the final workout-post change:

```bash
npm run test:founder-dashboard
npm run lint
npm run build
npm run test:content-safety
npm run test:release-guards
git diff --check
```

The Vite build emits an existing non-blocking bundle-size warning: the main
JavaScript bundle is about 967 kB uncompressed / 260 kB gzip. It is not a
submission blocker, but code-splitting is reasonable post-launch optimization.

Live Supabase checks confirmed:

- the moderation columns are present on Stream messages, comments and workout
  logs;
- the moderation audit table has RLS enabled;
- `anon` and `authenticated` cannot execute the moderation RPC or directly
  read protected current logs;
- `service_role` can execute the private RPCs/readers;
- no workout-post moderation actions existed during verification.

The Supabase security adviser showed **no new warning caused by this work**.
It still shows the pre-existing RLS rollout findings and the existing leaked
password protection warning described below.

Not yet completed: a real browser/TestFlight founder hide-then-restore flow.
The code/database contracts passed, but that manual flow should be run once a
Preview deployment is available with a dedicated test founder and reportable
seeded content. Do not test by hiding a real member's production content.

## App Store preparation already completed or drafted

Read these before writing public legal/App Store material:

- `docs/app-store-release-pack-2026-09-15.md` — submission checklist and
  screenshots/reviewer walkthrough.
- `docs/privacy-data-inventory-2026-09-15.md` — factual data inventory.
- `docs/app-store-founder-decisions-2026-09-15.md` — founder choices to date.
- `docs/app-store-legal-context-and-next-steps-2026-09-15.md` and
  `docs/legal-launch-pack-2026-09-01.md` — legal context, not legal advice.
- `docs/future-premium-feature-map-2026-09-15.md` — preserve the future
  monetisation plan internally.
- `docs/app-store-listing-draft-2026-09-01.md` and
  `docs/app-store-submission-runbook.md` — listing and operational steps.
- `docs/private-photo-delivery-rollout-2026-09-16.md` — photo access rollout.

### Product decisions made

- Fero V1 launches free. Premium is the future business model: more than one
  Bloc and selected analytics/insights are intended paid features.
- Do **not** build the paywall for this submission. Before submission, remove
  or rename every user-facing Premium label so nobody is promised a tier that
  does not work. Keep the internal feature map for later implementation.
- Launch intent is all App Store countries/regions, subject to final legal and
  App Store Connect review.
- Private photo delivery before launch was approved in principle. The visible
  UI should not change; only image access should become authorised/short-lived.
- Detailed account-linked usage events are approved for a six-month retention
  rule. Daily activity summary data has a separate 90-day cleanup rule.
- Fero does not process, hold, route or verify member money. It records
  accountability/settlement outcomes and may display member-selected payment
  handles. Public wording and App Review notes must say this accurately.

### Decisions still required from the founder/team

1. **Support email and domain:** create/select a public Fero email address and
   domain. This is needed for Privacy Policy, Terms, Support, Community Rules,
   and App Review contact information.
2. **Account deletion/history:** decide exactly which historical shared
   workouts, comments, reactions, photos, display-name snapshots and settlement
   information remain visible to Bloc members after someone deletes an account.
   Current code deletes account/profile photos and active membership while some
   canonical historical rows retain the incident/history with profile links
   cleared. Policy, implementation and test must agree.
3. **Company/App Store seller:** company registration and whether to enrol in
   Apple Developer Program as an individual or organisation remain a founder/
   legal/team decision. Do not provide immigration/tax/legal advice as a final
   answer. The legal roadmap discussion identified that the founder's own
   active operation of Fero may matter under the current Norwegian permit even
   before incorporation; get appropriate professional advice before revenue,
   partner contracts, or public commercial operation.
4. **Final settlement wording and country legal review:** especially because
   worldwide availability is intended and member payment handles exist.
5. **Who monitors reports/support:** name a real responsible person and a
   response process before TestFlight/App Review.

## Outstanding technical blockers and owners

### Deveen — database access-control/RLS rollout (submission blocker)

This is separate from the UGC tables, which are already private. Supabase found
RLS disabled on seven older canonical tables:

- `ante_core.revision_clock`
- `ante_core.bloc_messages`
- `ante_core.bloc_message_reactions`
- `ante_core.bloc_message_reads`
- `ante_core.workout_log_comments`
- `ante_core.workout_log_comment_reactions`
- `ante_core.solo_requests`

Do **not** run a generic production "enable RLS" command. It could break live
Stream, comments, reactions, unread counts or solo mode. The safe plan is
already appended to
`docs/handover-2026-09-14-blob-runbook-tasks-1-4-and-log-fixes.md`:

1. inventory schemas, grants, RPC permissions and all call sites;
2. make an additive reviewable migration that preserves only the server path;
3. exercise the real flows in a database development copy;
4. take a fresh backup and then roll out to production with rollback steps;
5. verify adviser output and prove anon/authenticated roles cannot access the
   affected tables/RPCs.

### App Store Preview owner / next agent

After Deveen's rollout reaches a stable `main`:

1. Fetch main and merge **main into `codex/app-store-readiness`**. Never merge
   Preview into main. Preserve unrelated local work and resolve only genuine
   conflicts.
2. Re-run the full relevant suite, including mobile navigation, sign-in and
   account deletion flows. The known local browser commands are described in
   `docs/review-environment-setup-2026-09-01.md`.
3. Deploy/test a Vercel Preview (not production) and manually test:
   - sign in with a dedicated founder test account;
   - report a seeded Stream message/comment/workout post;
   - hide it in Founder Dashboard; refresh as a normal member and confirm it is
     absent; restore it; refresh and confirm it returns;
   - block a current Bloc member and confirm only the blocker loses sight of
     that person's content;
   - verify a profile report can be reviewed/dismissed;
   - confirm no real member data is used as review test content.
4. Re-check photo delivery against `docs/private-photo-delivery-rollout-2026-09-16.md`.
   The repository migration is
   `supabase/migrations/20260916120000_make_photo_buckets_private.sql`; this
   handover does not confirm it has been applied to production. Treat it as an
   open launch check, not complete merely because Preview code exists.
5. Remove/rename visible Premium labels, then run a screenshot/text audit.
6. Once founder inputs are available, create/publish the public Privacy Policy,
   Terms, Support and Community Rules pages. The wording must exactly match the
   actual deletion, photo, moderation and payment-handle behavior.
7. Create a non-personal App Review account and seeded Bloc; then produce the
   five truthful App Store screenshots from the signed TestFlight build.
8. Complete App Store Connect: seller/legal entity, availability, age rating,
   privacy questionnaire, support/privacy URLs, review contact/notes and export
   compliance. Submit only after the final signed build is tested.

### Still worth improving, but not a reason to delay the immediate RLS work

- Add a founder account-suspension/removal process for profile reports if the
  operating model needs it. Do not fake this by hiding a profile; it is a
  separate product/legal process.
- Add reported-content preview/context to the founder queue, with care not to
  expose private content beyond authorised founders.
- Turn on Supabase leaked-password protection, shown as an existing security
  adviser warning. Assess its login UX before changing it.
- Reduce the main JavaScript bundle after the release-critical work is stable.

## Known environment/testing facts

- Local app/API: `npm run dev:api` on port 3000; `npm run dev` on 5173.
- Production-like local check: `npm run build`, then `npm run dev:api`, open
  `http://localhost:3000`.
- The known seeded browser account used earlier was `riley@local.test` with
  invite `DMU9MI`. Treat both as non-secret local fixtures, but regenerate them
  rather than relying on them for a final reviewer flow.
- The two browser flows need a running app and seeded user/Bloc. They were made
  more reliable but still must be re-run against the final review environment.
- Greenlight preflight tooling was not available for a fresh final run in this
  session. Do not claim it was; the local Fero/Lift-Log verification listed
  above is what actually ran.
- Xcode/TestFlight work is not complete. The Apple App Store install initially
  rejected the current Xcode because the Mac's macOS was too old for the latest
  version; an older compatible Xcode download path was explored. Reconfirm the
  locally installed Xcode version and iOS signing state before attempting an
  archive.

## What not to accidentally change

- Do not remove the intentional limited horizontal swipe behavior on the
  all-time leaderboard. It prevents normal leaderboard swipes from switching
  screens; see the relevant local notes/playbook before touching navigation.
- Do not confuse a Bloc with a "block" in public copy.
- Do not turn on Premium wording/paywall partially. V1 is free until a complete
  product, billing, legal, restoration and App Store purchase implementation is
  separately planned and tested.
- Do not claim Fero processes payments or acts as a money-transfer service.
- Do not claim the historical deletion policy is settled; it is not.

## Suggested opening prompt for the next session

> Read `AGENTS.md` and `docs/handover-2026-09-18-app-store-preview-session.md`
> in full. We are continuing Fero App Store preparation on
> `codex/app-store-readiness`. Do not merge Preview into main or deploy
> production. First inspect current `main`, Preview, Deveen's RLS status, and
> these handover checks. Explain the current state in plain English, including
> what you verified against the local Fero/Lift-Log repo. At the end of every
> response, state the recommended next action and `App Store review readiness:
> X%`.

