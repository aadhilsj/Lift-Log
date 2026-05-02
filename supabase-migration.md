# Supabase migration

## What changed in the repo

The repo now uses Supabase as the only backend for persisted app state.

Relevant files:

- `api/lift-log.js`: backend reads and writes app state through Supabase
- `supabase/state-schema.sql`: immediate production schema for a singleton app-state row plus backup snapshots
- `.env.example`: environment variables you will need in hosting
- `scripts/jsonbin-to-supabase-state.mjs`: turns the current JSON export into a SQL seed file

There is also a more normalized future schema in `supabase/schema.sql`, but for the safest cutover, use `supabase/state-schema.sql` first.

## Current shape

The app currently stores one JSON document with:

- `logs`: current-month workouts by player
- `excused`: current and historical sit-out flags by player and month
- `monthHistory`: closed-month snapshots with counts, detailed logs, and settlements
- `lastMonth`: current open month key
- `meta`: revision and update timestamp

That means the migration has to preserve both:

- live current-month data
- frozen historical month snapshots

## Recommended cutover

This is the safest version for you right now:

1. Freeze writes briefly or do the final import during a low-traffic window.
2. Export the JSONBin record exactly once as the source-of-truth snapshot.
3. Transform that snapshot into a SQL seed file for Supabase.
4. Load that seed into Supabase.
5. Set environment variables in hosting.
6. Redeploy and verify the app.

The process is low risk because it preserves the state exactly as the app already expects it.

## Manual steps you need to do

These are the parts only you can do because they require your Supabase account and hosting account.

1. Create a Supabase project.
2. In Supabase, open SQL Editor.
3. Run the contents of `supabase/state-schema.sql`.
4. In Supabase project settings, copy:
   - Project URL
   - Service role key
5. In your hosting provider environment variables, set:
   - `SUPABASE_URL=...`
   - `SUPABASE_SERVICE_ROLE_KEY=...`
   - `ADMIN_PIN=...`
6. Redeploy after the data import is complete.

## Steps I can do locally

1. Turn the JSON export into a seed SQL file:

```bash
node scripts/jsonbin-to-supabase-state.mjs data/jsonbin-export.json migration-output/lift_log_state_seed.sql
```

2. That file can then be pasted into the Supabase SQL Editor and run once.

## Verification checklist

- The app loads after redeploy.
- Current month data matches what you saw before cutover.
- Old month history still appears.
- Settlement states still appear.
- New workout logging works.
- A new row appears in `lift_log_backups` after a write.

## Data safety notes

- The migration preserves the current JSON shape exactly.
- Historical months stay intact because they are copied byte-for-byte into Supabase JSONB.
- Each future write can create a backup snapshot in `lift_log_backups`.
- Keep the original JSON export file as your rollback artifact.

## Cutover strategy

1. Keep the existing app running on JSONBin.
2. Prepare Supabase schema and hosting env vars.
3. Perform one fresh export/import right before cutover.
4. Redeploy the app with the Supabase environment variables in place.
5. Keep the JSON export file as an immutable rollback artifact.

## Ease

This is fairly easy. The hard part is not coding anymore; it is just doing the cutover carefully and in order.
