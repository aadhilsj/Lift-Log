# Handover — Migration Pause Checkpoint 2026-06-28

This note freezes the migration state at the point where it is safe to pause
relational migration work and temporarily switch focus to month-end settlement
features.

Read alongside:
- [docs/handover-2026-06-24-read-composition-audit.md](/Users/opera_user/Documents/Codex%20Space/Lift%20Log/docs/handover-2026-06-24-read-composition-audit.md)
- [docs/handover-2026-06-24-mutation-audit.md](/Users/opera_user/Documents/Codex%20Space/Lift%20Log/docs/handover-2026-06-24-mutation-audit.md)
- [docs/handover-2026-06-26-blob-retirement-audit.md](/Users/opera_user/Documents/Codex%20Space/Lift%20Log/docs/handover-2026-06-26-blob-retirement-audit.md)
- [docs/relational-cutover-plan.md](/Users/opera_user/Documents/Codex%20Space/Lift%20Log/docs/relational-cutover-plan.md)

## Branch State

Branch:
- `codex/membership-safety-fixes`

Recent verified migration commits relevant to this pause:
- `d2d1544` — `feat(read): resolve invites from canonical bloc data`
- `5eadd24` — `feat(read): source group createdAt from canonical blocs`
- `31a73fd` — `chore(sql): clean bloc read rpc comment`

## Green At Pause

Verified healthy before pausing:
- canonical closed-season month-history overlay
- canonical member sort order reconstruction
- canonical group sort order reconstruction
- canonical `lastMonth` sourcing for covered groups
- canonical invite resolution on read
- canonical `join-group` invite lookup path
- canonical `createdAt` read authority from `blocs.created_at`
- canonical-first `season-proration-choice`
- canonical-first `sitout-request`
- canonical-first `sitout-review`
- canonical-first `update-settings`
- `create-group` / `join-group` seeding of open-season
  `season_member_status` rows for zero-log members

## Latest Manual Verifications

### Invite / join path

Verified against `test101-us8qvg`:
- canonical `read_ante_core_blocs()` returned the expected `invite_code`
- leave-and-rejoin behavior restored the active `bloc_members` row
- rejoined member appeared again in open-season `season_member_status`

### `createdAt` authority

Verified against `test101-us8qvg`:
- direct `ante_core.blocs.created_at`
- `public.read_ante_core_blocs()` `created_at`

Both matched, so `group.createdAt` is now safe to treat as canonically sourced
on the GET path with blob fallback preserved.

### Sit-out write path

Verified against `test101-us8qvg`:
- pending sit-out request row created canonically
- approval updated the canonical request row
- open-season `season_member_status.excused` flipped to `true`

This makes the sit-out slice green at the canonical authority boundary.

## Important Known Caveat

A recurring edge case was observed around members who are new to a bloc and
still have zero logs:
- if no open-season `season_member_status` row exists yet, they can disappear
  from canonical open-season membership coverage even though the active
  `bloc_members` row exists

This is why the create/join seeding fix mattered, and it should be rechecked
again before broader blob-retirement work resumes.

At pause time, this is a watch item, not a reason to block month-end feature
work.

## What Is Still Not Done

The remaining work is no longer a set of small safe overlays. The main
unfinished areas are:

1. blob-retirement architecture
   - `defaultGroupId`
   - `pendingOtps`
   - `meta.revision`
   - `meta.updatedAt`
   - `leftMemberNames`

2. blob-first mutation hydration
   - `fetchWritableCurrentState()` is still blob-first

3. lifecycle / identity-sensitive flows
   - `leave-bloc`
   - `kick-member`
   - `delete-account`
   - `repair-display-name`

4. display-name de-keying
   - active product behavior is still not fully identity-keyed
   - display names are not cosmetic-only yet

## Why It Is Safe To Pause Here

This is a good pause point because:
- the highest-value bounded write slices are already green
- invite and `createdAt` shell-field reads are green
- remaining migration work is architectural, not quick slice work
- month-end settlement features are time-sensitive to real user behavior

## Recommended Restart Order

When migration work resumes, restart in this order:

1. re-run a quick canonical sanity pass on zero-log new-member coverage
2. do the `defaultGroupId` cleanup slice
3. decide the replacement strategy for `pendingOtps` and `leftMemberNames`
4. plan blob-retirement / mutation-hydration transfer explicitly
5. only then resume deeper identity work and display-name de-keying

## Product Focus During Pause

Recommended temporary focus:
- month-end settlement features
- anything that specifically needs real users at month close to validate

Do not treat this pause as migration completion.
Treat it as an intentional checkpoint after the safe bounded slices.
