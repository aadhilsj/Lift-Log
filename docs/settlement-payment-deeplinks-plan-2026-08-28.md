# Settlement Payment Deep Links — Plan

Created: 2026-08-28, Europe/Oslo.
Status: proposed, not started. No code exists for this feature.

Owner decision required before build. See "Open Decisions" at the end.

## Problem

The settlement loop currently has a hole in the middle:

1. The month closes and Fero calculates who owes what.
2. **The payer leaves the app entirely, finds some other way to pay, and may
   never come back.**
3. The payer taps "Claim paid".
4. The receiver taps "Confirm received".

Step 2 is unsupported. Fero states the obligation precisely and then abandons
the user at the exact moment they were most willing to act. Every unpaid
settlement sitting in production is sitting in that gap.

## Goal

Close the loop **without Fero ever touching money**.

Fero stores a payment handle per user and opens it. It does not process,
route, hold, verify, or observe any payment. The existing manual
claim/confirm flow remains the only source of settlement truth.

This constraint is not a nicety. It is what keeps the App Review position in
`docs/app-store-submission-runbook.md` true.

## Current State (verified 2026-08-28)

- No payment platform appears anywhere in the repo. A search of `docs/`, `src/`
  and `api/` for Revolut, Vipps, MobilePay, PayPal, Wise, Venmo and Swish
  returns nothing.
- Profiles carry only `displayName`, `email`, and `profilePhotoUrl`
  (`src/lib/appState.js:1604`). There is no payment field.
- Settlement actions that exist today: `settlement`, `settlement-claim-paid`,
  `settlement-confirm-paid`, `settlement-dispute-paid`.
- `SettlementScreen.jsx` renders "Confirm received" and a claim-confirmation
  overlay. There is no payment affordance.

## Design

### Data model

One new optional profile field, stored as an opaque string plus a provider tag:

```
paymentHandle: {
  provider: "revolut" | "paypal" | "vipps" | "wise" | "bank" | "other",
  value:    "<free text, user supplied>",
  label:    "<optional user-facing hint, e.g. 'Commercial Bank'>"
}
```

Treat `value` as untrusted free text at every layer. Fero never parses it for
meaning, never validates it against a provider, and never infers an amount from
it.

### Resolution to a link

A single pure function maps `{provider, value}` to either a URL or null:

- `revolut`  -> `https://revolut.me/<value>`
- `paypal`   -> `https://paypal.me/<value>`
- `wise`     -> `https://wise.com/pay/me/<value>`
- `vipps`    -> Vipps link or app scheme
- `bank`     -> no URL. Render the details as copyable text only.
- `other`    -> if `value` is already an `https:` URL, use it. Otherwise render
                as copyable text.

Anything not resolving to a URL degrades to a **Copy** button. That fallback is
the important half of the design, not an afterthought — see the market note
below.

### UI

- **Settings / profile:** an optional "How people pay you" field. Clearly
  optional. Never required to create, join, or use a Bloc.
- **Settlement screen:** on a row where the current user owes another member,
  add a **Pay** button beside the existing claim control. It opens the
  receiver's link, or copies their details.
- **No payment handle set:** show nothing. No nag, no empty state, no prompt to
  the receiver to add one.
- **Opening a link must never change settlement state.** Fero does not know
  whether the payment happened. Claim and confirm stay manual.

### Amount prefill

Do **not** prefill amounts in v1, even where a provider supports it.

Prefilling means constructing a payment request, which is a materially
different claim to make to App Review than "we open a link". The value added is
small; the review risk is not. Revisit after the first approval.

## Market Note — Sri Lanka Is The Initial Launch Market

Per the Master Task List, Sri Lanka is the initial launch market, not Norway.
This has a direct consequence:

**Do not build this around Vipps and Revolut.** Those are European rails.
Norwegian and pan-European providers are relevant to the founder's own Blocs and
to a later Norway launch, but they are not the launch market's rails.

For the initial market the realistic settlement mechanism is bank transfer and
local mobile wallets. That means:

- The **`bank` / copy-to-clipboard path is the primary flow at launch**, not the
  fallback. Build and polish it first.
- The provider list must be open-ended and easy to extend. Do not hardcode a
  closed enum in the UI.
- Verify the actual dominant P2P rails in Sri Lanka with real users before
  adding provider-specific deep links. Do not assume from this document; it has
  not been researched.

A generic "handle + copy" implementation serves every market immediately.
Provider-specific deep links are an enhancement layered on top, per market.

## App Store Implications

Read `docs/app-store-submission-runbook.md` alongside this. The runbook already
identifies the money question as the highest rejection risk.

### What does not change

Fero still does not hold funds, transfer money, sell wagering credit, operate a
prize pool, or process settlement between members. Opening a third-party app is
not processing a payment. The reviewer-safe description remains accurate.

### What does change

The flow now reads end-to-end as stake -> outcome -> payout, even though the
underlying mechanic is unchanged. A reviewer skimming the app may look harder at
the penalty model than they would have before.

Required before submitting a build containing this feature:

- [ ] Update the reviewer-safe description to state explicitly that the Pay
      button opens a third-party application chosen by the receiving user, and
      that Fero never sees, holds, routes, or verifies the transfer.
- [ ] State in the App Review notes that settlement status is member-confirmed
      and is never derived from a payment link being opened.
- [ ] Re-audit the "Fero does not hold funds" statement against the actual
      submitted build, as the runbook already requires.
- [ ] Confirm this is person-to-person settlement of a real-world obligation
      between members and therefore outside the in-app-purchase requirement.
      Confirm against the current App Review Guidelines at submission time; do
      not rely on this document.
- [ ] Declare any app URL schemes required to detect installed payment apps.

### Privacy

A payment handle is personal data, and more sensitive than a display name.

- [ ] Privacy policy updated to cover collection, storage, and visibility.
- [ ] App privacy labels updated.
- [ ] Handles deleted on account deletion, and covered by the existing
      end-to-end deletion test.
- [ ] Visibility scoped to co-members of a Bloc where a settlement exists.
      A handle must never be readable by a non-member or via an invite preview.
- [ ] Never logged in analytics. `docs/product-growth-measurement.md` already
      forbids sending personal fields; add payment handles to that prohibition
      explicitly.

## Build Order

1. Profile field: schema, canonical write path, read composition, deletion.
2. Settings UI, with the copy-only path working first.
3. Link resolution function plus unit coverage of the degrade-to-copy behaviour.
4. Settlement screen Pay/Copy button.
5. Privacy policy, labels, deletion test, reviewer notes.
6. Analytics events (`settlement_pay_opened`, `settlement_handle_copied`) with
   no handle values attached.

Estimate: 2-4 days for steps 1-4. Steps 5-6 fold into existing App Store work.

## Explicit Non-Goals

- No payment processing, escrow, wallet, balance, or prize pool.
- No verification that a payment occurred.
- No automatic settlement status change from any payment signal.
- No amount prefill in v1.
- No payment provider API integration, keys, or webhooks.

Each of these would change Fero's regulatory and App Review position
fundamentally. None is required to close the loop.

## Open Decisions

- Whether this ships before or after first submission. Recommendation: **before**.
  It makes the product visibly better in the exact screens the review video and
  screenshots show, and adding payment affordances after approval means a second
  pass through review on the riskiest surface. Do the scary thing once.
- Which providers get first-class deep links at launch, pending real research
  into Sri Lankan P2P rails.
- Whether receivers may set a handle per Bloc rather than per profile. Default
  to per profile; per Bloc is more flexible and more confusing.

## Relationship To Other Work

- `docs/app-store-submission-runbook.md` owns the submission checklist. This
  feature adds items to it; it does not replace them.
- `docs/product-growth-measurement.md` owns the event contract.
- Independent of the blob/canonical work. The profile field is a normal
  canonical write and does not touch compatibility paths.
