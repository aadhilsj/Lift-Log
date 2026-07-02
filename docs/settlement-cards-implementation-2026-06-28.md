# Settlement Cards Implementation Note — 2026-06-28

This note records the implementation shape of the Today-screen settlement card
feature added on branch `codex/membership-safety-fixes`.

## Design Summary

The feature was implemented to stay aligned with the long-term relational
migration plan:

- settlement confirmations live in canonical SQL only
- no new settlement-confirmation business state is written into the blob
- `fetchWritableCurrentState()` remains unchanged and blob-first
- the server overlays canonical confirmation rows onto the readable app state
- the client derives Today cards from:
  - existing closed-month `monthHistory`
  - canonical `settlementConfirmations`

This means the feature should survive future migration work with minimal
rework, because the underlying source of truth is already canonical.

## Current Status

As of 2026-06-28:

- the Today-screen settlement reminder UI was approved in local preview mode
- local preview auth was enabled so mobile UI review could happen without OTP
- the remaining work is now the **real canonical DB path**, not more visual
  iteration

## Files Added

SQL:
- [supabase/ante-core-settlement-confirmations-schema.sql](/Users/opera_user/Documents/Codex%20Space/Lift%20Log/supabase/ante-core-settlement-confirmations-schema.sql)
- [supabase/ante-core-settlement-confirmations-read-rpc.sql](/Users/opera_user/Documents/Codex%20Space/Lift%20Log/supabase/ante-core-settlement-confirmations-read-rpc.sql)
- [supabase/ante-core-settlement-confirmations-write-rpcs.sql](/Users/opera_user/Documents/Codex%20Space/Lift%20Log/supabase/ante-core-settlement-confirmations-write-rpcs.sql)
- [supabase/ante-core-settlement-confirmations-rls.sql](/Users/opera_user/Documents/Codex%20Space/Lift%20Log/supabase/ante-core-settlement-confirmations-rls.sql)
- [supabase/ante-core-settlement-confirmations-local-apply.sql](/Users/opera_user/Documents/Codex%20Space/Lift%20Log/supabase/ante-core-settlement-confirmations-local-apply.sql)

Docs:
- [docs/settlement-investigation-2026-06-28.md](/Users/opera_user/Documents/Codex%20Space/Lift%20Log/docs/settlement-investigation-2026-06-28.md)
- [docs/settlement-audit-2026-06-29-preview-branch.md](/Users/opera_user/Documents/Codex%20Space/Lift%20Log/docs/settlement-audit-2026-06-29-preview-branch.md)

## Feature Flag

Server flag:
- `ENABLE_SETTLEMENT_CONFIRMATIONS`
- `ENABLE_SETTLEMENT_CONFIRMATIONS_PREVIEW`

Behavior:
- `false` or unset:
  - no settlement-confirmation overlay
  - no Today settlement cards
  - claim/confirm actions return disabled
- `true`:
  - canonical confirmation rows are read and overlaid
  - Today settlement cards render after the existing results-banner window
  - claim/confirm actions are active

Preview behavior:
- `ENABLE_SETTLEMENT_CONFIRMATIONS_PREVIEW=true`:
  - bypasses canonical DB requirements for visual review
  - exposes a local-only mock Today slot with example settlement cards
  - card button interactions stay client-local and do not hit the API

Local dev default was set to enabled in:
- [.env.local](/Users/opera_user/Documents/Codex%20Space/Lift%20Log/.env.local:1)

Example env default was set to disabled in:
- [.env.example](/Users/opera_user/Documents/Codex%20Space/Lift%20Log/.env.example:1)

## Real Testing Constraint

The local Supabase database currently available on this Mac does **not** have
the full `ante_core` baseline applied. That means the real settlement SQL
cannot be validated safely there without first bringing local fully up to the
canonical schema baseline.

Because of that, the recommended next execution environment is:

1. a hosted Supabase branch or other safe non-live database
2. apply canonical prerequisite schema there if needed
3. apply the settlement confirmation SQL there
4. verify with real auth / RLS / realtime behavior there

## Intended Apply Order

Apply on the safe canonical-capable test database:

1. `supabase/ante-core-settlement-confirmations-schema.sql`
2. `supabase/ante-core-settlement-confirmations-read-rpc.sql`
3. `supabase/ante-core-settlement-confirmations-write-rpcs.sql`
4. `supabase/ante-core-settlement-confirmations-rls.sql`

The combined local file exists only as a convenience artifact and should not be
treated as the preferred path now that local canonical baseline drift has been
confirmed.

## Intended Real Test Flow

On the safe hosted branch / non-live database:

1. verify `ante_core` baseline exists
2. apply the settlement confirmation SQL files in order
3. run the app against that environment with `ENABLE_SETTLEMENT_CONFIRMATIONS=true`
4. verify the Today slot stays hidden on league days 1-3 while the results
   banner is visible
5. verify the slot appears after that window
6. verify these states:
   - payer unpaid
   - receiver unpaid
   - pending confirmation
   - third-party unpaid
   - older unpaid month still visible
7. verify payer claim changes the row to pending
8. verify receiver confirm removes the row
9. verify realtime refresh clears the card for every bloc member session

## Important Constraint

This feature did **not** replace the existing Results-screen settlement status
button. That older settlement path remains in place for now.

## 2026-06-29 Preview Branch Testing Update

We moved real settlement testing off local-preview/demo mode and onto the
hosted Supabase preview branch `settlement-test`.

Key points:

- preview branch project ref: `pukarpxsrmbnkbagyidg`
- local app now points at the preview branch from `.env.local`
- real production `lift_log_state` was copied into the preview branch so the
  app renders real bloc/month data instead of the demo stack
- the Results screen was updated to read canonical settlement confirmation
  state instead of the old blob-only settlement toggle path

### Current Reality

At this point:

- Today settlement reminders are reading canonical confirmation state
- Results closed-month settlement rows are also reading canonical confirmation
  state
- the old blob `Mark settled` flow is no longer the active path for closed
  month settlement status in this testing branch

### Localhost-Only Functional Test Path

To test the real claim/confirm flow without touching live auth behavior, a
localhost-only identity override was added:

- only available when the app is opened from a local dev host
  - `localhost`
  - `127.0.0.1`
  - LAN/private IPs such as `192.168.x.x`
- the UI exposes a small `Local Test Identity` selector
- the local API accepts the matching override only on local/private-host
  requests
- the override is restricted to members of the currently selected bloc

This allows safe branch-only testing of:

1. payer view
2. receiver view
3. third-party bloc view
4. payer claim action
5. receiver confirm action
6. disappearance after confirmation

### What Still Needs Verification

The canonical tables and RPCs are now wired, but the actual branch-backed
interaction flow still needs explicit QA:

1. pick a bloc member in the localhost identity selector
2. verify card state for that member
3. trigger `Mark as paid` as the payer
4. switch identity to the receiver
5. verify pending state and trigger `Confirm`

## 2026-06-29 Status

That verification is now green on the hosted Supabase preview branch.

- payer `Mark as paid` works
- receiver `Confirm` works
- confirmed settlements disappear for all bloc-member views
- the earlier delayed-on-refresh reminder issue was fixed by returning the
  readable overlaid state from `auth-sync` instead of the raw blob-backed sync
  state
6. switch identity again to a third party
7. verify the card disappears for the whole bloc

### 2026-06-29 Audit Status

Testing is currently blocked by preview-branch canonical baseline drift, not by
the settlement reminder UI itself.

The current audit and recovery path now live in:

- [docs/settlement-audit-2026-06-29-preview-branch.md](/Users/opera_user/Documents/Codex%20Space/Lift%20Log/docs/settlement-audit-2026-06-29-preview-branch.md)

That note should be treated as the restart point before any more settlement
feature testing continues on the preview branch.

### Known UI Behavior

On refresh, the Today reminder may briefly disappear and then appear a second
or two later. Current assessment is that this is a fetch/render timing issue,
not evidence that the settlement row is being lost.

### Preview Branch Functional Status

The real preview-branch claim/confirm flow is now verified green:

- payer `Mark as paid` works
- receiver `Confirm` works
- the reminder clears for all viewers after confirmation

Open follow-up item:

- Today reminder hydration/render timing still causes a short delayed appearance
  after refresh
