# Handover — Read Composition Audit 2026-06-24

This note records the branch state and migration conclusions after the June 24,
2026 read-composition and parity pass.

It is intended to sit beside the older broad audit in
[`docs/handover-2026-06-15-audit.md`](/Users/opera_user/Documents/Codex%20Space/Lift%20Log/docs/handover-2026-06-15-audit.md)
and to capture what changed after the June 23 historical month-history work.

## Branch State

Branch:
- `codex/membership-safety-fixes`

Recent migration commits on the branch:
- `3d130e7` — `feat(read): overlay canonical closed-season month history on GET`
- `3d5dd63` — `feat(write): persist canonical bloc and member sort order`
- `ad7b7a5` — `feat(read): reconstruct member order from canonical sort order`
- `a260181` — `feat(read): reconstruct group order from canonical sort order`
- `eb03fb2` — `feat(read): trust canonical member order when coverage is complete`
- `7bae1a3` — `feat(read): trust canonical group order when coverage is complete`

Branch-local code change after those commits:
- source covered groups' `lastMonth` from canonical open seasons using the
  existing `read_ante_core_current_excused_and_sitouts` payload

## What Was Verified

### Historical closed-season parity

Verified healthy:
- `season_member_status.workout_count` vs historical `workout_logs`
- historical settlement status parity for the reviewed months
- historical reactions were not shown to be missing for the reviewed months

### Ordering coverage

Verified healthy for active legacy-backed production blocs:
- `blocs.sort_order`
- `bloc_members.sort_order`

Backfill was applied for the remaining active null `bloc_members.sort_order`
rows using blob `memberOrder` as the source of truth. After that:
- active member ordering coverage for the real blocs was complete
- preview ordering looked correct

### Open-season authoritative surfaces

Verified healthy:
- open `seasons` rows exist for active legacy-backed blocs
- open-season `workout_logs` look plausible for the active blocs
- open-season `workout_reactions` look plausible for the active blocs
- excused members appear canonically where expected
- sit-out requests appear canonically where expected
- season overrides appear canonically where expected
- no active bloc is missing its open season row

Important correction discovered during this audit:
- open-season `season_member_status.workout_count` is not currently the
  authoritative live current-month counter surface
- it is still primarily a rollover / closed-season snapshot path
- therefore, open-season count mismatches between `season_member_status` and
  `workout_logs` are not by themselves a production bug under the current
  architecture

## Current Read Composition Reality

`fetchReadableCurrentState()` still starts from the blob and overlays canonical
data on top.

### Effectively canonical-backed on read now

- profiles
- bloc settings and bloc name
- `season_overrides`
- current-month logs
- current-month excused
- current-month sit-out requests
- closed-season `monthHistory`
- `memberOrder`
- `groupOrder`
- `lastMonth` for groups covered by canonical open seasons

### Still fundamentally blob-backed on read

Top-level:
- `defaultGroupId`
- `pendingOtps`
- `meta.revision`
- `meta.updatedAt`

Per-group shell/base fields:
- `inviteCode`
- `createdAt`
- `leftMemberNames`

Compatibility scaffolding still supplied by the blob base:
- empty groups / zero-log members / old edge-case names that survive because
  the read path still begins with `fetchCurrentStateFromSupabase()`

### Important preserved safety property

`fetchWritableCurrentState()` is still blob-only by design.

That means:
- writes still hydrate from the blob source of truth
- canonical remains dual-write plus read-overlay, not the mutation base yet

## Conclusions

1. The migration is no longer blocked by ordering coverage.
2. The migration is no longer blocked by the currently authoritative open-season
   canonical surfaces.
3. The next major problem is not another tiny read overlay.
4. The next major problem is authority transfer:
   - remaining blob-only shell/state dependencies
   - eventual write-authority transfer away from blob
   - eventual blob retirement planning

## Recommended Next Phase

Do not jump straight to full blob retirement.

Recommended next step:
- treat the next phase as a broader write-authority / blob-retirement planning
  slice

Suggested sequence:
1. keep `fetchWritableCurrentState()` blob-only for now
2. explicitly document the remaining blob-only read dependencies
3. decide whether any shell-field read cutovers (`defaultGroupId`,
   `inviteCode`, `createdAt`) are worth doing before write-authority transfer
4. design the first bounded write-authority candidate instead of continuing
   endless micro-overlays

## Progress Estimate

Estimated as of June 24, 2026:
- write-path migration for the current product model: `85%`
- read-path migration for user-visible data: `90%`
- ordering migration specifically: `95%`
- historical parity/backfill confidence: `72%`
- blob retirement readiness: `40%`
- overall migration program: `76%`

These are judgment calls, not measured metrics, but they reflect the current
shape of the work:
- most high-value narrow slices are done
- the remaining work is broader and more architectural
