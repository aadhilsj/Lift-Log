# QA Update — Bloc Members Backfill

Date: June 17, 2026

This note records the canonical membership backfill verification for the
real blob-backed blocs that were known to be undercounted in
`ante_core.bloc_members`.

## Context

Observed parity gap before backfill:

- `osi-h3-9pmkuy` — blob `7`, canonical `1`
- `stavanger-4ever-7162hj` — blob `2`, canonical `0`
- `legacy-group` — blob `10`, canonical `9`
- `sparring-sessions-u84oeg` — blob `1`, canonical `0`

Root causes discovered during the run:

- canonical `profiles.id` did not reliably match blob auth UUIDs
- canonical `blocs.id` did not reliably match importer-derived bloc IDs
- some memberships already existed canonically, so a blanket insert/upsert on
  importer-generated IDs was not safe

## What was done

1. Exported a fresh blob state snapshot from `lift_log_state`.
2. Exported live canonical profiles from `ante_core.profiles`.
3. Re-ran the importer with canonical profile ID reconciliation enabled in
   `scripts/state-to-canonical.mjs`.
4. Applied canonical profile rows first.
5. Reconciled importer membership rows against the real canonical `blocs.id`
   values already present in production.
6. Inserted only the missing `bloc_members` rows, using the existing canonical
   `(bloc_id, profile_id)` pairs as the source of truth.

## Verified result

After the filtered membership backfill, canonical member counts matched the
expected blob-backed counts for the affected blocs:

- `ctrl-alt-de-feat-ocdti8` — `7`
- `legacy-group` — `10`
- `osi-h3-9pmkuy` — `7`
- `sparring-sessions-u84oeg` — `1`
- `stavanger-4ever-7162hj` — `2`

## Conclusion

The known `ante_core.bloc_members` parity gap for the active real blocs above
is now resolved.

This does not by itself prove every historical or future membership edge case,
but it clears the specific canonical undercount issue that was blocking
confidence in membership parity for these production blocs.

## Post-Migration Cleanup Note

After the broader canonical migration is complete, do one explicit production
hygiene pass for canonical-only test data.

Confirmed June 19, 2026:

- active real bloc membership rows: `27`
- total canonical `bloc_members` rows: `32`
- the extra `5` rows are historical-only left memberships attached to dead
  test blocs with `0` active members:
  - `test-bloc-ka2ovu`
  - `gym-gal-3ipo38`
  - `test-bwazc0`
  - `test-ux55f8`

Recommended follow-up after migration:

- review and remove dead test blocs with `0` active members if they are no
  longer needed
- review test profiles with `0` active memberships
- separately review unverified typo-email `auth.users` rows created by the OTP
  flow (`shouldCreateUser: true`) before deciding whether to purge them

This is a production hygiene task, not a migration correctness blocker, so it
was intentionally deferred until after the migration data pass stabilized.
