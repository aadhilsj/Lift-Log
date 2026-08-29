# Profile Stats Endpoint — Follow-Up For Blob Retirement

Written: 2026-08-29, Europe/Oslo.
Audience: whoever owns the blob/canonical migration.
Status: the endpoint ships and works. This records a known cost and the safe
way to remove it. Nothing here is urgent at current scale.

## What was built

`POST /api/lift-log` with `action: "profile-stats"` returns one member's
cross-Bloc totals: workouts, Bloc count, wins, target-hit months, weekday
spread, workout mix, per-day totals and best month. It accepts `subjectUserId`
for one member or `subjectUserIds` for a batch.

It exists because readable state is scoped per viewer by
`scopeReadableStateForUser`, so a client only ever holds its own Blocs. A
client-side aggregation silently shrank a member's "all time" figures to the
Blocs the viewer happened to share with them, and the same profile reported
different numbers to different people.

Authorisation: the caller must share at least one Bloc with the subject, or be
the subject. Each id in a batch is checked separately, so one permitted id
cannot smuggle others through.

## The cost

`buildFeroProfileStats` walks the composed application state that
`getReadableCurrent()` has already loaded. It does not issue its own queries.

That is fine today — 17 Blocs, 34 profiles — and the request adds nothing the
handler was not already doing. It matters later because **every API call in
Fero loads the entire application state first**, and this adds another caller
to that pattern. It is not the cause of that cost, but it does bring it forward.

Mitigation already in place on the client: results are cached against the
revision clock and prefetched in one batch when a Bloc opens, so a Bloc's whole
roster costs one request rather than one per member.

## Why it was not written as SQL

The obvious optimisation is a canonical aggregate touching only that member's
rows. It was deliberately not done, for a reason that is this migration's
central question rather than a performance judgement.

`api/lift-log.js` currently refuses to trust canonical membership. In read
composition, a canonical member row is ignored unless the blob already knows
that user:

```js
if (!allowCanonicalShellCreation && !blobMembershipKeys.has(m.auth_user_id)) continue;
```

The stated reason is that a canonical soft-delete (`left_at`) can fail
silently, so a canonical row could resurrect someone who was actually removed.

A SQL aggregate would read membership straight from `ante_core` and therefore
disagree with every other screen, which applies the blob veto. Not a crash —
worse: two surfaces quietly reporting different truths, the same failure mode
as the August rollover incident.

The JavaScript version reads the same composed state as everything else, veto
included, so it cannot disagree.

## The safe way to switch

Do not replace it. Run both and compare, the way `scripts/blob-parity-gate.mjs`
does for the mirror-skip rollout.

1. Write the canonical aggregate alongside `buildFeroProfileStats`.
2. Run both for every member and diff the results.
3. Investigate every disagreement. Each one is evidence about whether canonical
   membership is trustworthy — which is the question the parity gate is already
   circling.
4. Switch over only when they agree across the whole roster, then delete the
   state-walking version.

`scripts/test-fero-profile-stats.mjs` already pins the server aggregation
against the client one and earned its place immediately: it caught the server
bucketing weekdays Monday-first while the client and the UI both use `getDay()`
indexing, which would have mislabelled every bar in Workouts by Day. Extend it
rather than starting fresh.

## Privacy constraint

Aggregate numbers only. Bloc names, member names and per-Bloc splits are never
returned: a caller learns how much someone trains, never with whom or where.
The same rule is recorded in `src/lib/profileStats.js`. Preserve it in any
replacement.
