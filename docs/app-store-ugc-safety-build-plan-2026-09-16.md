# App Store user-content safety build plan

Apple's user-content rule requires four things: filtering, reporting, blocking,
and an easy way to contact the developer. Fero already has limited workout
flagging and Bloc-admin removal; that is not enough on its own for comments and
Bloc Stream content.

## Completed in Preview: server-side text filter

The API rejects clear, high-risk abusive language before it is saved as a:

- Bloc Stream message or event title/location;
- workout comment or workout note;
- Bloc name; or
- display name.

The client cannot bypass this by modifying its interface because the rule is
enforced by the API. The word list intentionally covers only clear severe cases;
it must not be treated as a context-aware moderation system.

## Next: blocking and reporting

1. Add a private canonical record of one account blocking another. It persists
   across devices and does not change Bloc membership, scores, or settlements.
2. Add a report record with content type, content identifier, Bloc, reporter,
   reason, timestamp, and review status.
3. Add visible Report and Block controls to Stream messages, comments, workout
   activity, and member/profile entry points.
4. Hide blocked authors' social content in the blocker’s Stream, comments and
   Activity view. Leaderboard totals remain unchanged.
5. Add a founder-only moderation queue: read the report, mark it reviewed,
   remove the content where applicable, or use the existing Bloc-member removal
   path for serious cases.

## Before release

- Put a monitored Fero support email in the app and public Community Rules.
- Document response expectations for reports (for example, review urgent abuse
  within one business day during launch).
- Test with two test accounts: filter, report, block, unblock, remove content,
  and remove a member. Do this in a non-production environment first.
