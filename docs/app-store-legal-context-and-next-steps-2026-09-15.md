# App Store legal context and next steps

Last updated: 2026-09-15, Europe/Oslo.

Purpose: give future Fero agents and collaborators one factual starting point
for App Store preparation. This is product and release context, not legal, tax,
or immigration advice. Obtain qualified advice before relying on it for a major
decision.

Source: `Fero_Legal_Payments_Visa_Roadmap.pdf` supplied by Aadhil on
2026-09-15. The roadmap is forward-looking. At this date, Fero has no live
revenue, no signed partner deal, and no enabled Premium/paywall purchase path.
It is not a plan to retroactively regularise live operations.

## Decisions already made

1. **Individual Apple enrollment first.**
   - Enrol in the Apple Developer Program under Aadhil's own legal name.
   - The individual seller name will be public on the App Store.
   - A later change to an organisation account is possible after a genuine
     company exists, but requires Apple's formal verification process. Do not
     describe it as automatic.

2. **No version-one Premium sales.**
   - The current App Store submission will not include Premium gating, a
     paywall, subscriptions, or in-app purchases.
   - Before submission, remove or rename all user-visible references to
     Premium so the app does not promise an unavailable product.
   - Maintain an internal feature map of intended future gated features; do
     not build or market the purchase flow until the later payments decision.

3. **No partner revenue or team compensation now.**
   - Nutrimax and Fitness First are prospective only; no partner arrangement
     is signed and no revenue is moving.
   - Do not create founder payroll, contractor, or compensation arrangements
     for Randy, Deveen, or Mindi before a company and equity structure exist.
   - This does not mean concealing income. Any income that does arise must be
     handled and reported as required; obtain accounting advice before the
     first revenue is accepted.

4. **Incorporation is deferred.**
   - Revisit incorporation when an investor wants equity, an acquisition is
     offered, or Aadhil wants the company rather than himself to be the public
     App Store seller.

## Visa and founder-activity context

- The roadmap already identified UDI as a valuable free written check for
  Aadhil's Norwegian Skilled Worker permit. Aadhil deliberately deferred it
  after the risk and trade-off were discussed.
- This is a conscious risk-acceptance decision, not an overlooked task. Do not
  describe it as a blind spot or advise hiding activity.
- The important release framing is that active founder conduct (for example,
  public CEO activity, commercial negotiations, or personally receiving
  revenue) may matter independently of whether a company has been incorporated.
  Treat that as a decision gate before signing commercial agreements, receiving
  revenue, or materially increasing public operating activity.
- Do not give immigration conclusions. If Aadhil elects to seek certainty,
  direct him to a written UDI inquiry or a qualified Norwegian immigration
  lawyer.
- The roadmap's fully vested founder-share approach is a record-keeping risk
  reduction only. It does not turn active work into passive ownership.
- Randy's possible UK Skilled Worker supplementary-employment exception should
  be formally checked if it ever matters. COO work for an unrelated startup is
  not assumed to qualify.

## What must be complete before App Store submission

### A. Public legal and support presence

- Public Fero Privacy Policy URL.
- Public Terms of Use/EULA URL.
- Public Support/contact URL with a monitored Fero support email.
- Public Community Rules explaining comments, reactions, reporting, blocking,
  and how support responds to complaints.

The Privacy Policy must match the submitted build's actual data handling,
including authentication email/account data, display names, Bloc membership,
workout and profile photos, workout records, comments, reactions, reports,
hosting providers, analytics (if any), retention, and deletion.

### B. Product decisions Aadhil must make

1. Choose a public support email and final public domain.
2. Decide the initial countries/regions for release.
3. Decide the retention rule for a deleted member's historical workouts,
   comments, reactions, photos, and settlement records visible to other Bloc
   members. The policy and deletion implementation must agree.
4. Approve factual wording for the penalty/settlement model. Fero records
   member obligations and confirmations; it must not imply that Fero holds,
   transfers, pools, or wagers money unless that is actually built and legally
   cleared.
5. Obtain appropriate legal review of that wording and launch regions before
   broad distribution.

### C. Technical and review preparation

- Final merge of `main` into `codex/app-store-readiness` after all approved
  release work is on `main`; never merge Preview back into `main` for this.
- Create a realistic, non-personal Apple reviewer account and seeded private
  review Bloc. Keep authentication, database, email, and photo storage working
  during review.
- Configure and verify Universal Links on the final HTTPS domain so invite
  links hand off into the installed app.
- Create a signed TestFlight build using the final Apple team, version/build
  number, and production API origin.
- Test sign-in, joining, logging, photos, account deletion, history, and links
  on real TestFlight devices.
- Complete App Store Connect: app information, App Privacy disclosures, age
  rating, regional availability, export compliance, screenshots, review notes,
  review account, and required URLs.
- Run the final release guard, lint, production build, mobile navigation,
  Greenlight preflight, native archive, and TestFlight smoke test immediately
  before submission.

## Work an agent can do now without founder input

1. Audit the submitted Preview build into an exact data inventory for the
   Privacy Policy and App Store Connect App Privacy answers.
2. Inventory every user-visible `Premium` reference and preserve a private map
   of the future-gated feature behind it. Do not change product copy until
   Aadhil explicitly asks.
3. Draft privacy, terms, support, and community-rule pages using clearly marked
   placeholders for the founder-only decisions above. Do not publish them until
   the domain, support email, and factual policy choices are approved.
4. Prepare App Store metadata, screenshot storyboard, reviewer-notes template,
   and TestFlight test checklist from the actual release candidate.
5. Inspect the final-domain Universal Link requirements once a domain is chosen;
   do not claim the invite handoff is ready before it is deployed and tested.

## Out of scope for version one

- Premium paywall implementation.
- In-app purchases, subscriptions, StoreKit, restore purchases, or billing
  support.
- Partner payment collection and international money movement.
- Paying team members or formal founder compensation.
- Incorporation or equity issuance.
- Push notifications, unless separately approved for the submitted version.

## Current branch and verification state

- App Store branch: `codex/app-store-readiness`.
- `main` was merged into that Preview branch at commit `55560a5`; the Preview
  branch also includes mobile leaderboard swipe containment at `b63fef0`.
- Preview has passed lint, production build, deterministic release checks,
  sandbox auth/invite flow, three mobile-navigation runs, native Capacitor
  sync, unsigned Xcode archive, Greenlight preflight, and production dependency
  audit.
- `main` and production were not modified by this App Store work.

## Agent safety rules

- Do not merge App Store Preview into `main`.
- Do not publish legal wording, enroll an Apple account, accept contracts, add
  banking/tax details, sign commercial deals, or alter production data without
  explicit founder action/approval.
- Do not treat this document as permission to avoid reporting income or to
  conceal business activity from immigration, tax, banking, or Apple systems.
