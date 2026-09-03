# Blob retirement — impact briefing, 2026-09-03

For: Deveen (blob retirement / parity tooling)
From: the Redemption + Training Wheels session, commits `03ff8c5` → `dfe2676`,
all on `main`.

Written after reading `docs/handover-2026-09-01-blob-retirement-parity-tooling.md`
and PRs #7–#11. **Three items below intersect directly with the mirror-skip
waves you have queued.** The rest is context.

---

## TL;DR

A new per-member monthly flag (`training`) shipped this week. It is granted in
`applyCreateGroup` and `applyJoinGroup` and, at the moment of the grant, is
written **to the blob only**.

Those two actions are on your hold list — but so is `update-settings`, which is
in your **next wave but one**, and it carries a new settings field with the same
problem. If either gets added to `BLOB_MIRROR_SKIP_ACTIONS` as things stand
today, the write is dropped and the user-visible effect is a member being
charged money they were exempted from.

None of this is urgent. All of it is cheap to close before the relevant wave.

---

## 1. `create-group` / `join-group` mirror-skip would drop training grants

**Status: on your hold list already, for `leftMemberNames` / `joinedMonthByName`.
This adds a third reason and a sharper consequence.**

`training` is a map on the group, `{ [displayName]: { [monthKey]: true } }`,
granted server-side at Bloc creation (founding roster) and at join (each new
member). At that moment it is persisted through the blob path only.

It reaches canonical in exactly two places:

- `upsertSeasonMemberTrainingInCanonical` on the **closed-month rollover sync**
- the same writer on the **`training-choice`** mutation (the joiner's opt-out
  prompt, which only appears in Blocs with a closed month)

So for a Bloc in its first month, or a joiner who never sees the prompt, the
grant lives in the blob until the month closes.

**If `create-group` / `join-group` are skipped before that changes**, the grant
is never written anywhere. The member is not exempt. They get charged at
settlement. That is a money-visible failure, not a cosmetic one.

**Cheapest fix:** call `upsertSeasonMemberTrainingInCanonical` from those two
handlers at grant time, exactly as `training-choice` already does. The RPC and
column already exist. That makes the flag safe to skip and closes the gap for
the retirement generally.

---

## 2. `update-settings` mirror-skip would drop the Training Wheels default

**Status: this is the one I would flag hardest, because `update-settings` is in
your wave after next and this is not on any hold list.**

`buildNormalizedSettings` gained a field:

```
trainingWheels: settings?.trainingWheels !== false   // default on
```

It is the admin's default for new joiners, set in the Create a Bloc modal and in
Bloc settings.

**It is not in the canonical settings mirror.** The season/bloc upsert RPCs take
`p_min_target`, `p_fine_amount`, `p_fee_model`, `p_strava_enabled` and the rest —
there is no `p_training_wheels`, and no column for it on `blocs` or `seasons`.

That was a deliberate call at the time: the per-member grant is the thing that
matters historically, and the admin default is a live preference, so I avoided
touching a shared RPC signature. **That reasoning holds only while
`update-settings` is still mirrored.** Once it is skipped, the setting has
nowhere to live and an admin's choice stops persisting.

**Two options:**

- Add `training_wheels` to `blocs` and a `p_training_wheels` param to the bloc
  upsert. Clean, costs an RPC signature change.
- Or explicitly defer `update-settings` until it is done.

Your call — I have not touched the settings RPC.

---

## 3. `trainingDecisions` has no canonical home

Same class of problem as `leftMemberNames` / `joinedMonthByName`, and it should
probably join them in the same redesign.

`trainingDecisions` is `{ [displayName]: { [monthKey]: true } }` and records
**that a joiner answered the prompt**, separately from what they answered. It
exists because choosing "same terms as everyone" leaves no `training` entry, so
without its own record the member is re-prompted on every app open.

It is blob-only, cleared at rollover, and carried through renames. At retirement
it vanishes, and the symptom is a member being asked the same question forever.

Low stakes, no money involved, but it needs a home before the blob goes.

---

## 4. Schema changes I made

All additive, applied to production, in Supabase migration history.

| Migration | Change |
|---|---|
| `add_training_wheels_to_season_member_status` | `training_wheels boolean not null default false`. 143 existing rows defaulted false. |
| `add_upsert_ante_core_season_member_training` | Writer function. `service_role` only; `anon`/`authenticated` revoked, mirroring the solo writer. |
| `month_history_returns_training_wheels` | **Replaced `read_ante_core_month_history`** to return `training_wheels` alongside `solo` in the members array. Purely additive to the payload — no field removed, no shape change. |

That third one touches a function you may be reading from. Nothing was taken
away, but you should know it moved.

---

## 5. A failure mode worth adding to your mental model

This is the part I would most want you to have, because it cost a live bug and
the parity gate would not have caught it.

I shipped the canonical write for `training` first and described the missing
read as "canonical is write-only for now — a limitation". That framing was
wrong, and the reason is structural:

**`buildCanonicalMonthHistoryForGroup` rebuilds each closed month from canonical
rows and replaces the blob's copy wholesale.** It carries `counts`, `excused`,
`solo`, `memberTargets`, `logsByUser`, `settlements` — anything not explicitly
listed is silently dropped.

So a field written to canonical but not read back by that rebuild does not
degrade gracefully. It reads as though the write never happened. In our case a
production data correction appeared to do nothing at all, on both the blob side
and the canonical side, because the rebuild sat between them and discarded the
field.

**The general rule for the retirement: any new field needs its read path in that
rebuild landed in the same change as its write, or it is invisible in exactly
the way that looks like a data-loss bug.**

---

## 6. Parity gate blind spots

Your seven checks are workout counts, reaction coverage, settlements, season
overrides, bloc sort order, member sort order, open-season scope.

Nothing in that set covers:

- `training` / `training_wheels` — a member exempt in the blob but not in
  canonical (or the reverse) passes the gate silently, while the settlement
  amounts it produces would differ.
- `settings.trainingWheels` — blob-only, so there is nothing to compare.
- `trainingDecisions` — blob-only.

The settlement check may catch a *downstream* symptom if the exemption changes
who owes, but it would not name the cause. If you want a check for it, the
comparison is `season_member_status.training_wheels` against the group's
`training` map for that month key — the same shape as your solo comparison.

---

## 7. Production data note

You will see your own August figure change in Sarandawgs. At the founder's
instruction, Rithu and Deveen were given training wheels for **August 2026 only**
and both penalties went to £0; mindi's £30 collection went to £0 with them.
Nobody had paid — no `settlement_runs`, `settlement_entries` or
`settlement_transfers` rows existed for that season and every
`settlement_status` was null.

Applied to both the blob's closed-month snapshot and
`season_member_status.training_wheels`, deliberately together, since either one
alone is exactly the drift your gate exists to catch. A two-statement rollback
was captured and is with the founder; it is not in the repo.

---

## Suggested sequence

1. Before the `update-settings` wave: decide on `trainingWheels` — mirror it or
   defer that action.
2. Before `create-group` / `join-group` ever come off hold: move the training
   grant to write canonical at grant time. Small, and it closes item 1 fully.
3. Fold `trainingDecisions` into the `leftMemberNames` / `joinedMonthByName`
   canonical-home redesign rather than solving it separately.
4. Optional: add a training-exemption check to the gate, shaped like the solo
   one.

Nothing here blocks the waves you have already queued (`add-log`, `multi-log`).
