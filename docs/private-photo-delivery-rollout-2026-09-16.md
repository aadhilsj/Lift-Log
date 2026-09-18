# Private photo delivery rollout

## What changed in Preview

Fero now treats profile and workout photo locations as private data.

- New uploads save a durable internal reference such as
  `fero-storage://workout-photos/<user-id>/<file-name>`, not a public web link.
- When the API returns app state, it first limits that state to Blocs the
  signed-in person belongs to. It then turns only the photo references in that
  allowed state into signed viewing links that expire after 24 hours.
- Existing records with Fero's old public-style Supabase links still work: the
  server recognises them internally and signs them without exposing the old link
  to the app.
- The old unauthenticated `/api/lift-log?image=...` proxy has been removed.

This does not alter the visible photo experience. It changes who can obtain a
usable link and how long that link works.

## Safe rollout order

1. Use an isolated restored/development Supabase copy and a local API configured
   only for that copy; Vercel Preview cannot reach member data because its
   Supabase credentials are Production-only. Follow
   `docs/app-store-safe-copy-test-checklist-2026-09-18.md`.
2. Test profile-photo and workout-photo upload, reload and viewing with two
   synthetic members in the same test Bloc. Confirm an unrelated test member
   cannot obtain either photo through normal authenticated app state.
3. Before changing production Storage, take a fresh backup, confirm current
   bucket settings in the dashboard, and get the founder's explicit approval.
4. Have the founder run
   `supabase/migrations/20260916120000_make_photo_buckets_private.sql` in the
   Supabase SQL editor. Do not run it from Codex.
5. Verify the production bucket privacy setting and photo access behavior after
   the approved change; do not use real users' content as QA fixtures.
6. Promote only after test evidence is recorded and the founder approves the
   tested server-code promotion to `main`.

## Important operational note

Private-bucket signed URLs remain usable until their 24-hour expiry. They are
not a permanent public address and are not written back to Fero's database. A
copied link therefore has a longer use window than the previous 15-minute
setting. If immediate revocation of already-issued links is ever needed, treat
that as an incident and follow Supabase's current support guidance.
