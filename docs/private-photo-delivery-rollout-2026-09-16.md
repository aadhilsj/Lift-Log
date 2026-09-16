# Private photo delivery rollout

## What changed in Preview

Fero now treats profile and workout photo locations as private data.

- New uploads save a durable internal reference such as
  `fero-storage://workout-photos/<user-id>/<file-name>`, not a public web link.
- When the API returns app state, it first limits that state to Blocs the
  signed-in person belongs to. It then turns only the photo references in that
  allowed state into short-lived (15-minute) signed viewing links.
- Existing records with Fero's old public-style Supabase links still work: the
  server recognises them internally and signs them without exposing the old link
  to the app.
- The old unauthenticated `/api/lift-log?image=...` proxy has been removed.

This does not alter the visible photo experience. It changes who can obtain a
usable link and how long that link works.

## Safe rollout order

1. Deploy the matching Preview code and test profile-photo and workout-photo
   upload, reload, and viewing with two members of the same Bloc.
2. Confirm that a person outside that Bloc cannot obtain either photo through
   their normal authenticated app state.
3. Before changing Storage, take the normal Supabase backup and confirm the
   current bucket settings in the dashboard.
4. Have the owner run
   `supabase/migrations/20260916120000_make_photo_buckets_private.sql` in the
   Supabase SQL editor. Do not run it from Codex.
5. Repeat the tests in Preview. Existing public links should stop working;
   signed links issued by the API should keep working for their 15-minute life.
6. Promote only after the test evidence is recorded in the App Store runbook.

## Important operational note

Private-bucket signed URLs remain usable until they expire. They are not a
permanent public address and are not written back to Fero's database. If a
photo link is copied, it can work only until its short expiry. If immediate
revocation of already-issued links is ever needed, treat that as an incident and
follow Supabase's current support guidance.
