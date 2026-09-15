# App Store founder decisions

Last updated: 2026-09-15 (Europe/Oslo).

Purpose: short, factual decision log for the App Store Preview work. This is
not legal advice and does not by itself change the app or production services.

## Confirmed decisions

1. **Private photo access before launch.**
   - Profile and workout photos should no longer be delivered from public direct
     URLs in version one.
   - The intended user experience does not change: authorised Bloc members see
     the same photos in the same places. The change is underneath the screen:
     Fero gives an authorised user a short-lived/private image link instead of
     a permanent public one.
   - This requires a Preview code change plus a carefully reviewed Supabase
     Storage configuration/policy change. Aadhil runs the final Supabase SQL;
     no production change is authorised by this document.

2. **Detailed usage-event retention: six months.**
   - Account-linked detailed events such as opening History or Settings should
     be deleted after six months.
   - This is separate from daily app-activity rows, which are configured for a
     90-day cleanup. The dashboard remains useful: it can still use recent
     activity and broader aggregate/product records, but will not retain a
     person-by-person click history indefinitely.

3. **Worldwide App Store availability is the launch intent.**
   - In App Store Connect, "All Countries or Regions" currently makes an app
     available in all 175 App Store countries/regions, subject to Apple and
     local legal/regulatory availability.
   - This is technically possible for a free app. It is not a promise that
     every country is legally low-risk for Fero's accountability/settlement
     wording. Do the settlement/privacy review before enabling worldwide
     availability.

## Current behaviour — leaving a Bloc

Leaving a Bloc is **not** deleting an account.

- The person is removed from that one Bloc only; their account and other Blocs
  remain.
- If they were the admin, the app transfers the admin role to a remaining
  member. If they were the last member, the whole Bloc is deleted.
- Their current-month workout entries stay in the Bloc's underlying current
  record, but they are no longer an active member/leaderboard participant.
- Their reactions on current workouts are removed. If they initiated an open
  workout flag, that open flag is cleared.
- A dated "member left" system event with their display name is retained.
- Existing closed-month history is retained. The source review did not prove a
  complete removal rule for every old comment/message/reaction, so public
  wording must not overpromise deletion.

## Current behaviour — deleting an account

Deleting an account is broader than leaving a Bloc.

- The app deletes the Fero profile, Supabase Auth account, profile photos and
  workout-photo files owned by that person.
- It removes the person from every active Bloc. A sole-member Bloc is deleted;
  administration transfers where a surviving Bloc needs a new admin.
- In the compatibility/current-state path, the person's current owned workouts
  are removed and their reactions/active flags are cleaned up.
- The canonical database keeps some historic shared records by removing their
  direct link to the deleted profile rather than deleting every historic row.
  Closed-month snapshots may therefore retain historical names/counts.

## The remaining founder decision: deleted-account history

Recommended V1 rule:

> When a person leaves a Bloc, their historic Bloc record stays because they
> still have an account. When a person deletes their account, remove their
> profile, photos, current activity, messages/comments/reactions and identifying
> links. Keep only the minimum anonymised, frozen closed-month totals and
> settlement ledger needed for the remaining Bloc's historical record.

This is fair to the remaining group while respecting a deletion request. It is
not exactly what every current storage path guarantees yet, so it needs a
deliberate implementation and end-to-end TestFlight test before it appears in
the Privacy Policy.

## Settlement wording

Working plain-English position for review:

> Fero helps private Bloc members track workout commitments and record
> member-confirmed outcomes. Fero does not hold money, transfer money, process
> payments, operate a prize pool, or verify an off-platform payment.

Use this only if it remains true in the submitted build. The final public
wording and worldwide distribution decision require the planned legal review.
