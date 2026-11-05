# 5 November 2026 — Deveen's scoped-reads migration is applied

**`20261103120000_scope_readers_to_member_blocs.sql` is live on production.**
Aadhil said apply it. The safety check Deveen asked for passed, the migration
applied cleanly, and the equivalence proof below shows nothing changed for
anyone using the app today.

**Nothing in the app behaves differently yet, and that is correct.** The two
readers now *accept* a Bloc filter; `api/lift-log.js` does not yet *pass* one,
so every call still asks for everything. Deveen holds the second half.

---

## 1. The check he asked for, before applying

> *"the repo is not production: please diff each against `pg_get_functiondef`
> on production first, and if they differ, say so rather than applying."*

Done. Production's live definitions were saved first, as the rollback, and are
tracked in git at
[`docs/rollback/20261103120000-scoped-reads-PROD-BEFORE.sql`](rollback/20261103120000-scoped-reads-PROD-BEFORE.sql).

They were captured into `migration-output/`, which is **gitignored** — so the
only copy of the pre-change definitions was sitting on one laptop, and the
founder works from more than one. Moved somewhere tracked before committing.

Diffed against the new bodies, whitespace-normalised. **The only differences are
the ones he promised:**

| Function | Difference |
| --- | --- |
| `read_ante_core_month_history` | signature line, plus `and (p_legacy_group_keys is null or b.legacy_group_key = any(p_legacy_group_keys))` |
| `read_ante_core_current_logs` | signature line, plus the same filter on the `where` |

No column added, dropped or reordered — the trap named in
`handover-2026-09-14` §8.4. The repo bodies matched production exactly, so
there was no drift to report.

## 2. Applied

Through the Management API query endpoint, as one transaction. Each function is
dropped and recreated together, because a different signature is a different
function in Postgres and leaving the zero-argument version would make an
unqualified call ambiguous.

Signatures afterwards — note the old zero-argument versions are **gone**:

```
read_ante_core_current_logs(p_legacy_group_keys text[])
read_ante_core_member_bloc_keys(p_auth_user_id uuid)
read_ante_core_month_history(p_legacy_group_keys text[])
```

Grants are right: `postgres` and `service_role` only. `anon` and
`authenticated` cannot call any of the three.

## 3. Proof that nothing changed

The filter is `null means everything`, so passing **every** Bloc key must give
byte-identical JSON to passing nothing. It does, for both readers:

| Reader | no argument | all keys passed | identical? |
| --- | --- | --- | --- |
| `read_ante_core_month_history` | 44 rows | 44 rows | **true** |
| `read_ante_core_current_logs` | 93 rows | 93 rows | **true** |

Checked in SQL with `=` on the whole `jsonb`, not by eye.

Live app afterwards: site HTTP 200; the founder's own account loads 6 Blocs,
27 history entries and this month's logs in all six; both review accounts load
their Bloc. Nothing regressed.

## 4. The saving, measured — this is the point

`explain analyze` on production, unscoped versus scoped to one Bloc:

| Reader | Unscoped | One Bloc | |
| --- | --- | --- | --- |
| `read_ante_core_month_history` | **126.5 ms / 1389.7 KB** | **8.6 ms / 25.3 KB** | ~15x faster, ~55x smaller |
| `read_ante_core_current_logs` | 9.4 ms / 52.5 KB | 5.6 ms / 6.0 KB | |

Most members are in one or two Blocs out of 17 — the largest is the founder at
six — so the typical member is close to the right-hand column once the API
passes their keys.

## 5. The new helper works

`read_ante_core_member_bloc_keys(auth_user_id)` returns the member's own Bloc
keys, active membership only.

**Note for whoever calls it:** it keys on `profiles.auth_user_id`, **not**
`profiles.id`. Passing the profile id returns `[]` silently rather than
erroring — it cost a confused minute here, and it would read as "this member is
in no Blocs" in production.

## 6. Rollback

Run [`docs/rollback/20261103120000-scoped-reads-PROD-BEFORE.sql`](rollback/20261103120000-scoped-reads-PROD-BEFORE.sql),
then `drop function if exists public.read_ante_core_member_bloc_keys(uuid);`.

Those are the exact definitions that were running before, captured with
`pg_get_functiondef` rather than transcribed from the repo. Deveen's own note
adds that code and database can be rolled back independently, in either order:
`fetchAnteMonthHistory` falls back to an unscoped call if the scoped one is not
deployed.

## 7. Still open

- **The API half is Deveen's**, and he asked to be told when this landed so he
  can land it and measure against the real RPC instead of predicting.
- **§14 Q2 — Supabase Nano → Micro — is still unanswered**, and was marked
  **BLOCKING AADHIL**. He is holding off on the purchase until Deveen replies.
- **§14 Q3 — whether Deveen changed anything directly on the database on
  1–3 November — is still unanswered.** If he did, it is still undocumented.
- Step 2, a revision per Bloc, is what removes the quadratic growth rather than
  dividing it. Not started.
