# Handover — 22 September 2026: settlement reminders and Setup review

## Status

**Live on `main`.** Product work shipped in `e2cb1e9`; the final month-label
adjustment shipped in `ea75914`.

No production database data or schema was changed in this session.

## What changed

### Mobile Today settlement reminders

`src/pages/TodayPage.jsx` and the new `src/components/ReminderSheet.jsx` now
give phone users one featured reminder on Today instead of a stack of cards.

- `1 unpaid` is red, non-clickable, and has no chevron.
- `2+ unpaid ›` is red and opens a centred, scrollable reminder sheet.
- The featured card uses one vertical payment row:
  - lightweight inline month prefix: `Aug '26:` — **10px / 550**
  - debt copy: `Jo owes you` / `You owe Riley` — **11px / 500**
  - payer payment-provider icons sit directly after the debt copy at 19.5px.
  - actions precede the amount; the amount stays at the far right.
- `Mark as paid` uses the muted light treatment approved in review.
- Receiver-side `Confirm` is solid Fero cyan with dark text. The same cyan
  treatment is used in the full reminder sheet; the payment amount remains
  amber while confirmation is pending.
- The sheet is portalled to `document.body`, locks the page behind it, supports
  internal scrolling, and leaves the backdrop in place when a follow-up prompt
  opens. This prevents swipe-through and fixed-layer placement bugs.

Desktop retains its existing multi-card reminder layout.

`src/lib/appState.js` now exposes frozen closed-month payer counts, targets and
Solo status so the sheet can explain why a payment is owed without reading
current Bloc settings.

### Finish Setup card

`src/App.jsx` and `src/pages/BlocSettingsScreen.jsx` make the Today `Finish
setup` card open Bloc Settings directly on **Rules**. Opening it immediately
marks the review as complete, so closing Settings without saving rules still
dismisses the card. The ordinary Settings entry continues to open on Invite.

### Sandbox support

`scripts/sandbox-seed.mjs` now creates a useful reminder test fixture:
Riley, Jo and Sam have July/August closed months with debts, while Alex joins
as a current-month bystander. `scripts/sandbox-supabase.mjs` mirrors current
logs into the one canonical read route needed for the sandbox to close those
months.

## Important known limitation

The local sandbox intentionally returns empty results for settlement-confirmation
canonical reads/writes. Therefore `Mark as paid` does not persist locally, and
the real receiver confirmation state cannot be tested there. This was observed,
explained to the founder, and **intentionally not fixed**. A temporary
appearance-only preview was used for the receiver `Confirm` layout and removed
before release. Do not treat this sandbox limitation as a production defect.

## Validation performed

- Manual local visual checks: payer card, receiver-confirm layout, one-reminder
  and multi-reminder count states, icon/action alignment, and the Settings →
  Rules/Finish Setup dismissal flow.
- `npm run lint` — passed.
- `npm run build` — passed.
- All non-browser `test:*` scripts — passed.
- `test:auth-edge-flows` and `test:mobile-navigation` could not start in this
  worktree because the Playwright package was absent; the relevant mobile flows
  were checked manually.
- GitHub `verify` check passed for both release commits.
- The live bundle at `https://lift-log-nu.vercel.app` was checked after each
  release; the final bundle contains `fontSize:10,fontWeight:550`, and the live
  app loaded successfully.

## Release files

- `scripts/sandbox-seed.mjs`
- `scripts/sandbox-supabase.mjs`
- `src/App.jsx`
- `src/components/ReminderSheet.jsx`
- `src/lib/appState.js`
- `src/pages/BlocSettingsScreen.jsx`
- `src/pages/TodayPage.jsx`
