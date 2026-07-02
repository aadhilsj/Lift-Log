# Settlement Investigation — 2026-06-28

This note records the investigation state for the intermittent closed-month
settlement reversion reported in the live `legacy-group` bloc (`Go To Da Gym`).

## Reported Symptom

User report:
- April 2026 settlement for `Rishane` has been marked settled multiple times
- it stays settled immediately after save
- it stays settled across refresh / app reopen
- at some later unknown time window, it can revert and show `Mark settled`
  again

This does **not** currently present as an immediate save failure.

## Verified State On 2026-06-28

Immediately after the user marked the April settlement settled again on
2026-06-28, live SQL showed:

- blob month-history state was `settled`
- canonical `ante_core.season_member_status` was also `settled`

That ruled out the main first-pass hypothesis that the GET read overlay was
currently overriding a settled blob row with stale canonical `outstanding`
state.

## Current Best Interpretation

The most likely problem is a **delayed overwrite**, not the initial settlement
click itself.

Likely categories:

1. later blob rewrite
   - some later write path rebuilds the closed month and restores default
     `outstanding` settlement state

2. later canonical rewrite
   - some later sync/import/backfill path rewrites canonical
     `season_member_status` settlement columns for that closed month

3. full state restore / rollback
   - blob state gets replaced from an older snapshot or backup

What is *not* currently supported by the evidence:

- an immediate POST failure
- an immediate GET overlay mismatch at the time of the June 28 check

## What To Do If It Happens Again

If the settlement flips back again, do **not** re-settle it immediately.
Run the SQL below first and paste the results into chat.

The goal is to catch which layer flipped:
- blob only
- canonical only
- both together

That determines whether the culprit is:
- normal app write path
- canonical sync/import path
- or full state restore

## SQL To Run On Next Recurrence

### A. Current blob settlement entry

```sql
with params as (
  select
    'legacy-group'::text as group_id,
    '2026-3'::text as month_key,
    'Rishane'::text as loser_name
),
groups as (
  select key as group_id, value as group_json
  from public.lift_log_state s,
       jsonb_each(s.state->'groups')
  where s.id = true
),
target_month as (
  select g.group_id, mh.value as month_json, p.loser_name
  from groups g
  join params p on p.group_id = g.group_id
  cross join lateral jsonb_array_elements(coalesce(g.group_json->'monthHistory', '[]'::jsonb)) as mh(value)
  where mh.value->>'key' = p.month_key
)
select
  now() as checked_at,
  month_json->'settlements'->loser_name as blob_settlement_entry
from target_month;
```

### B. Current canonical settlement row

```sql
select
  now() as checked_at,
  sms.display_name_snapshot,
  sms.settlement_status,
  sms.settlement_settled_at,
  sms.settlement_updated_at
from ante_core.blocs b
join ante_core.seasons s
  on s.bloc_id = b.id
join ante_core.season_member_status sms
  on sms.season_id = s.id
where b.legacy_group_key = 'legacy-group'
  and s.month_key = '2026-3'
  and sms.display_name_snapshot = 'Rishane';
```

### C. Recent backup/state-restore context

```sql
select
  created_at,
  backup_reason
from public.lift_log_backups
order by created_at desc
limit 20;
```

## How To Interpret The Next Results

If A = settled and B = outstanding/null:
- canonical rewrite / stale canonical authority issue

If A = outstanding and B = settled:
- blob rewrite issue

If A = outstanding and B = outstanding/null:
- likely broad overwrite / restore / importer-style rewrite

If A = settled and B = settled:
- issue is not currently reproduced; wait for the next recurrence and capture
  again before touching it

## Relevance To The New Settlement Feature

This investigation does not block the new Today-screen settlement-card feature,
but it reinforces two design choices:

1. new settlement confirmations should be modeled canonically in their own
   explicit table
2. the new feature should be developed and tested locally / behind a flag
   before any live rollout
