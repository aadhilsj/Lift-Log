# Supabase Free Tier Return Note - 2026-08-15

## Summary

Fero should be capable of returning to the Supabase Free tier after the remaining
blob compatibility layer is retired or tightly capped. The current paid-tier
pressure does not appear to come from normal product data, realtime usage, or
file storage. It comes mainly from legacy migration safety data.

As of the 2026-08-14 production check:

- Supabase project: `Lift Log` (`bpvvvqjsfwmmfjvvijkd`)
- Auth users: `39`
- Canonical workout logs: `945`
- Canonical workout reactions: `757`
- File storage: about `6.38 MB`
- Visible app/auth/storage table size: about `274 MB`
- Main size driver: `public.lift_log_backups`
  - rows: `1,910`
  - table size: about `259.47 MB`

Interpretation: the core relational app data is small. The backup table is large
because it stores full state snapshots while the app is still in a hybrid
blob-to-canonical migration posture.

## Why Free Is Not A Good Fit Right Now

Supabase Free has a 500 MB database limit. The backup table alone was already
using roughly half of that limit during the August 2026 check. Because the app
still writes full-state backups during persistence, continued usage can grow the
database much faster than clean relational writes would.

The current issue is therefore not that Fero has too many users for Free. It is
that the migration safety layer creates large repeated snapshots.

## What Needs To Happen Before Downgrading

Before considering a move back to Supabase Free:

1. Retire normal runtime dependence on `public.lift_log_state`.
2. Stop writing uncapped full-state rows to `public.lift_log_backups`.
3. Decide the final backup policy:
   - delete old migration snapshots after exporting any needed archive, or
   - keep only a small rolling retention window, or
   - move long-term migration archives outside the production database.
4. Confirm that legacy projection tables are no longer live dependencies,
   especially:
   - `public.lift_log_projection_group_logs`
   - `public.lift_log_projection_month_logs`
   - any other `public.lift_log_projection_*` tables
5. Run a fresh size audit after cleanup and vacuum/compaction where appropriate.
6. Confirm production requirements still fit Free limits:
   - database size below 500 MB with meaningful headroom
   - file storage below the Free storage cap
   - realtime connections/messages below Free limits
   - monthly active users below the Free auth limit
7. Confirm the product is comfortable without Pro-only operational features such
   as larger headroom, no project pausing, daily backups, and stronger production
   support posture.

## Downgrade Decision Rule

Returning to Free is reasonable only after the blob backup growth source is gone
and a fresh audit shows the database comfortably below the Free limit. A good
target is to stay well under the cap, not merely under it on the day of
downgrade.

Until then, Pro should be treated as a temporary operational buffer for the
migration period rather than proof that the core app permanently requires a paid
Supabase tier.

