# App Store / RLS safe-copy test checklist

Prepared 2026-09-18 for Devin's planned Sunday work. This is a test plan, not
permission to create a project, restore data, run SQL, or change Production.

## Owners and boundaries

- **Devin:** lead the RLS review/migration rehearsal and the month-close checks.
- **Codex:** prepare/review the App Store server test cases and help run the
  local app/API against the approved test copy.
- **Founder:** approve the isolated project/backup use, provide a safe test
  account/device when needed, and personally approve any later Production SQL.
- **Nobody:** use Production as a test target, hide a real member's content, or
  quietly promote the App Store server code to `main`.

The Vercel Preview environment cannot reach member data: its Supabase URL and
service-role key are Production-only. Use a local app/API explicitly configured
for the isolated copy. `npm run sandbox` is useful for UI-only checks, but its
canonical database RPCs return empty results and it cannot prove RLS or the
founder hide/restore database flows.

## 1. Prepare and verify the copy — stop if any item is unclear

- [ ] Agree who owns the isolated development/scratch Supabase project and
  confirm the founder approves using a recent backup for this test.
- [ ] Restore into a **new non-Production project**. Do not overwrite or point
  tools at the live project. The earlier `fero-backup-test` scratch project was
  deleted; do not assume a current restored copy already exists.
- [ ] Treat a restored backup as sensitive: it can contain real member data.
  Limit access and scrub/anonymise member identifiers, messages, comments and
  other personal content before ordinary QA. If that cannot be done safely,
  stop and ask the founder for direction.
- [ ] Remember that database backups do not include Storage objects. Use only
  synthetic test photos uploaded to the isolated project's buckets; do not
  copy Production photos into test evidence.
- [ ] Configure local API/Auth credentials for this copy only. Verify the
  project URL/ref is not Production before starting the app, and keep service
  credentials server-side (never in the browser bundle or screenshots).
- [ ] Record the copy's project label/ref, backup date, app branch/commit,
  migration under test, test accounts and operator. Do not record secrets.
- [ ] Take a copy-only before snapshot of affected table counts, RLS state,
  grants, policies and relevant RPC definitions so results can be compared.

## 2. Rehearse Devin's RLS change on the copy

The current audit lists seven older `ante_core` tables: `revision_clock`,
`bloc_messages`, `bloc_message_reactions`, `bloc_message_reads`,
`workout_log_comments`, `workout_log_comment_reactions` and `solo_requests`.

- [ ] Review the proposed migration and confirm it grants no direct browser
  table access and adds no broad client policy merely to silence an adviser.
- [ ] For every live function the proposed change replaces, read Production's
  current definition with `pg_get_functiondef`, compare the proposed version,
  and preserve existing output fields. Ask the founder before applying any
  change to Production. Never rebuild from an old migration.
- [ ] Apply the candidate migration **only to the isolated copy**. Record its
  result and any rollback needed; do not apply it to Production as part of this
  checklist.
- [ ] Verify anonymous and signed-in browser roles cannot directly read the
  seven protected tables or call protected RPCs. Verify the intended
  server/service-role path still works through the app.
- [ ] With dedicated synthetic accounts, test normal sign-in/bootstrap and:
  Stream read/send/reaction/unread; workout-comment read/send/reaction; and
  Solo request/review/cancel flows.
- [ ] Compare before/after counts and test records. No existing rows should be
  lost or altered by an access-control-only rehearsal.
- [ ] Run the Supabase security advisor on the copy and record remaining
  findings without treating an advisor result alone as proof of correct
  access.

## 3. Rehearse App Store safety and photo flows on the same copy

Use only synthetic content and at least two test members in a test Bloc, plus
an unrelated test member. Keep the founder/admin test account separate.

- [ ] Sign in and confirm the normal app state loads through the local API.
- [ ] Report a synthetic Stream message, workout comment and workout post;
  confirm each appears in the founder queue.
- [ ] Hide each supported item, reload as a normal member and confirm it is
  absent; restore it and confirm it returns. Verify this is reversible hiding,
  not deletion.
- [ ] Block one test member and confirm the block changes visibility only for
  the blocker—not for the other test member or the Bloc itself.
- [ ] Submit a synthetic profile report and confirm the founder can review and
  dismiss it.
- [ ] If checking Capacitor CORS, send the actual iOS app to the local API and
  verify the expected `capacitor://` origin preflight/request against the copy.
- [ ] Make the test copy's profile/workout photo buckets private only after
  recording their starting settings. Upload synthetic photos, then verify an
  authorised Bloc member can load them and the unrelated test member cannot
  obtain them through normal app state.
- [ ] Confirm returned photo links are signed for the branch's 24-hour lifetime.
  Do not paste signed links into tickets, chat, screenshots or shared logs.
- [ ] Confirm old public-style photo references are not returned to the client
  as permanent public links when tested against private buckets.

## 4. Month-close and final evidence

- [ ] After Devin's month-close change is ready, test it against the isolated
  copy before the 1 October close. Confirm September activity values survive
  the close and the agreed October Solo rule/settlement behavior is preserved.
- [ ] Record each case as pass/fail with expected and actual results, the test
  account role, and the app/code/migration version. Remove personal data and
  signed URLs from evidence.
- [ ] If anything fails, stop the rehearsal, preserve the copy for diagnosis,
  and report the failure; do not "fix" it by changing Production grants or
  applying unreviewed SQL.
- [ ] Only after the copy tests pass, prepare a separate Production rollout
  plan with a fresh backup, explicit founder approval, and rollback/verification
  steps. This checklist does not authorize that rollout.
- [ ] Separately, on a signed TestFlight build and a real iPhone, drag up and
  down over the History All-Time Leaderboard and confirm the page scrolls;
  verify horizontal drags stay within the table. The browser test checks
  scroll-container capability, not real-device finger behavior.

## Sunday handoff summary

Devin can lead Sections 1–2 and the month-close rehearsal in Section 4. Codex
can assist with Section 3 and the local app/API setup once the founder-approved
copy exists. Production changes, server-code promotion to `main`, and the
real-iPhone TestFlight check remain separate gates.
