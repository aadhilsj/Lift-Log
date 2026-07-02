# QA Update — June 18, 2026 — Display Name Repair

## Summary

Shipped and verified the blob-state display-name rename propagation fix.

This closes the production bug where changing `profiles[userId].displayName` could desync a user's bloc identity and cause the bloc switcher to show:

- `Your profile is not in <Bloc> yet`
- `Invite needed`

## Root Cause

Before this fix, `applyUpsertProfile(...)` updated only `profiles[userId].displayName`.

Shared group state still retained the old display name across name-keyed structures such as:

- `group.memberOrder`
- `group.memberships[userId].displayName`
- `group.logs`
- `group.excused`
- `group.joinedMonthByName`
- `group.sitOutRequests`
- `group.monthHistory[*].counts`
- `group.monthHistory[*].logsByUser`
- `group.monthHistory[*].settlements`
- `group.monthHistory[*].memberTargets`

That left profile state and bloc state out of sync.

## Code Changes Shipped

Commit:

- `4c61878` — `fix(identity): reconcile rename and importer ids`

Relevant file:

- [api/lift-log.js](/Users/opera_user/Documents/Codex%20Space/Lift%20Log/api/lift-log.js)

Shipped behavior:

- normal display-name changes now propagate through the active name-keyed blob group state
- duplicate display names inside a user's bloc are rejected
- legacy users without a wired `memberships[userId]` row are handled through fallback old-name resolution
- one-time `repair-display-name` backend action added for already-broken users

## One-Time Repairs Applied

Applied successfully in preview via `repair-display-name`, then verified behavior through production smoke testing.

Repairs performed:

1. `mathiassilfverhielm` → `Mathias`
   - userId: `e698b870-10d4-4d36-a1b6-7be2ad3469cd`
   - bloc: `osi-h3-9pmkuy` / `OSI H3`

2. `cjfoures` → `Giang`
   - userId: `98d52b4b-e822-4cdf-8496-17c85acbf5fe`
   - bloc: `ctrl-alt-de-feat-ocdti8` / `Ctrl Alt De-feat`
   - profile display name also corrected from `Giang gangster` to `Giang`

3. `isindug` → `Isindu`
   - userId: `fc84a7b5-675e-4044-868d-ae5df3d34203`
   - bloc: `legacy-group` / `Go To Da Gym`
   - profile display name also corrected from `Test subject` to `Isindu`

## Verification

Preview verification:

- all three `repair-display-name` requests returned `status: 200`
- affected names were repaired without API errors

Production verification:

- changed a real production display name through the app UI
- bloc switcher did not break
- updated display name appeared correctly inside the bloc

Result:

- future display-name changes no longer break bloc membership resolution
- visible bloc state follows the updated display name
- the known broken users are repaired

## Remaining Follow-Up

- rotate `ADMIN_PIN` after the broader migration pass, since it was exposed during manual repair coordination
