# Profile And Account Restructure

Written: 2026-08-29, Europe/Oslo.
Status: shipped to `main`. This records the decisions and why, so they are not
quietly reversed later.

## The problem

Account actions were spread across three screens, and the in-Bloc modal put
**Leave Bloc** next to **Delete Account** in identical styling. One affects a
single Bloc; the other erases everything.

Two screens also computed overlapping statistics differently, so the same
member could see different numbers depending on where they looked.

## The shape now

| Surface | Answers | Holds |
| --- | --- | --- |
| Bloc Switcher → avatar | *my account* | photo, display name, email, payment methods, sign out, delete account |
| Bloc Settings | *this Bloc* | rules, members, invite, Leave Bloc |
| Member profile, in a Bloc | *this person* | in-Bloc month view, plus an All time tab |

The in-Bloc account icon was removed. Account settings live on the Switcher and
your own profile is reached by tapping yourself on the leaderboard, so it
duplicated both.

## Decisions worth not reversing

**All time means every Bloc, and reads the same for everyone.** Computed
server-side because a client only holds its own Blocs. See
`docs/profile-stats-endpoint-followup-2026-08-29.md`.

**Aggregate numbers only — never another Bloc's name.** A Bloc *count* is fine;
naming them exposes who someone trains with to people outside those Blocs. The
constraint is recorded in `src/lib/profileStats.js`. Adding a Bloc list to a
profile would need a viewer gate, and should be argued for rather than slipped
in.

**Money is per-Bloc and never on a profile.** The profile card labelled
"Accountability Score" was in fact the lifetime money balance — "Won X all-time
from your blocmates" — under a virtuous name. Removed because it summed nothing
meaningful across currencies, because profiles became visible to other members
and a public lifetime-loss figure punishes exactly the people the app should
help, and because money is the commitment mechanism rather than the achievement.
Per-Bloc settlement figures are untouched, where the currency and context are
unambiguous. The in-Bloc equivalent was renamed to "Net".

Reintroducing a money total on a profile would undo a deliberate product
decision and increase the App Store gambling-classification risk, which
`docs/app-store-submission-runbook.md` already flags as the biggest one.

**Destructive actions are separated and quiet.** Delete account sits in its own
card below the account block, not beside Sign Out. It is not wrapped in a red
"Danger zone" — a loud block shouted at everyone on every visit to guard against
something almost nobody does. Consequences are explained at the point of
decision. Apple requires in-app deletion to be findable, so it stays plainly
labelled and unhidden.

**Sign out is ordinary text.** It was styled red with a chevron, reading as both
destructive and navigational. It is neither.

**Payment setup lives on the account screen and is signposted from settlements.**
Members list every method they accept and the payer picks whichever suits them.
Only allowlisted hosts become clickable; everything else degrades to copy-only,
so a pasted phishing URL cannot borrow the Pay affordance.

**Awards measure what they claim.** "Most Consistent" and "Biggest Turnaround"
were never computed — they named whoever came second and third on workout count,
which is why the same person always won. Replaced with Most Diverse (range of
training) and a real Biggest Turnaround (improvement on that member's own
previous month). Hardcoded fallback names, "Isira" and "Rahul", were removed.
`scripts/test-month-awards.mjs` pins both so they cannot regress to ranking by
volume.

**Share sits next to what it shares.** The sticker is itself a calendar grid, so
the calendar is now rendered beside the share button on both the settlement
report and a member's own closed months. The sticker's design is locked against
the reference PNGs; only new ways to open it were added.

## Known limits

- All-time stats for another member need a live backend; there is no offline
  fallback, by design. Failure says so plainly rather than showing shared-Bloc
  numbers under an "all time" heading.
- The account screen still runs the local aggregation to derive "On Fero since",
  which reads earliest workout before earliest join. Cheap and local, but it is
  the only remaining reason that screen touches stats at all.
- `scripts/test-auth-edge-flows.mjs` and `scripts/test-mobile-navigation.mjs`
  cover onboarding and mobile navigation but need a local API server, so they
  did not run against this work. Restore `.env.local` before relying on them.
