# Handover — 2026-09-21 to 27: the sign-out fix, staging, and the Bloc header

Founder-side operational state. **Deveen's plate is in
`docs/handover-2026-09-22-for-deveen-active.md`** — do not duplicate it here;
that document is the one he reads.

## Plain-English summary

Three things shipped: the Bloc switcher header now reads as a button, a bug
that signed members out during a network outage is fixed, and a throwaway copy
of the live database (`fero-staging`) is built and verified so Deveen can
rehearse the RLS fix. Correction, 2026-09-29: the server-only production lockdown
is already applied (RLS on, zero client policies, no anon/authenticated table
privileges). Direct-client policies are a separate pending phase after the
1 October close. The copy costs ~$0.30/day; teardown is a separate approved
operation, not part of this documentation correction.

## What is live

| Commit | What |
|---|---|
| `a98ebef`, `77a0def` | Bloc switcher header: a drawn chevron-down, 14.5px medium name, no home icon. The old `⌄` was a text glyph sitting ~4px low. |
| `9cb945c` | **Sign-out fix.** `fetchAuthenticatedUser` turned any non-OK reply from Supabase Auth into 401 "session no longer valid", so a Cloudflare outage on 22 Sep signed members out mid-use. Now only 400/401/403 mean that; unreachable/5xx/52x/429 return a retryable 503. Client-side, `refreshAuthSession` throws on a retryable error instead of returning null (all three callers signed out on null). New suite `test:auth-outage`, 27 cases; **not yet in `ci.yml`** — that is Deveen's §6.3. |

## The 22 September outage, for the record

Cloudflare's London junction, 04:14–04:51 CEST. ~39% of Vercel→Supabase
requests returned 522/520 after 19–40s. Postgres was idle throughout; phones
reaching Supabase directly were fine. **No data was lost**: the live gate ran
9/9 clean afterwards, and blob vs canonical open-season logs matched exactly.
One workout was lost — Imadh pressed Log during the relapse, the photo uploaded
but `add-log` never reached the database, and there is no client-side retry. He
re-logged it.

**Two follow-ups, neither started:**

1. **A "save later" queue on the phone** so a failed log is kept and retried.
   The copy must live on the device — the server could not reach the database,
   so any server-side capture fails at the same moment. Hard parts: the workout
   must keep its original date across a month boundary, the two-a-day cap still
   applies, and the existing idempotency key must be reused. **Planned for after
   1 October.**
2. **The server runs in the US while the database is in Ireland** (no `regions`
   in `vercel.json`, every request goes via Cloudflare IAD). Pinning to `dub1`
   would cut latency and remove the London path. Deveen's §6.4.

## fero-staging: what exists and how to take it down

- Project `fero-staging`, ref **`okwrrspdmoluxatyokzh`**, eu-west-1, restored
  from the 23 Sep 07:48 UTC backup. **$9.68/month billed hourly.**
- Emails scrubbed everywhere except **`aadhil101@gmail.com`** on the founder's
  own account, which exists so sign-in works. Names and Stream bodies were
  deliberately kept — Fero matches people by email *and* display name across
  the two stores, so a half-scrub makes the copy misbehave.
- Vercel has **Preview-scoped** `SUPABASE_URL`, `SUPABASE_ANON_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY` and `ADMIN_PIN` pointing at it.
- Branch **`staging/rls-rehearsal`** exists only to give Vercel something to
  build a preview from (Vercel will not rebuild a commit already deployed to
  production, hence the empty commits).
- A **Vercel shareable link** is in Deveen's §3 so he can open it without an
  account. Hobby allows one per project, so generating another anywhere revokes it.

**Historical teardown checklist — requires separate approval; not executed here:**

1. Delete the `fero-staging` project in Supabase — this is what stops the cost.
2. Revoke the shareable link (Deployment Protection → Shareable Links).
3. Delete the four **Preview-scoped** Vercel variables, and the branch
   `staging/rls-rehearsal`.
4. Leave the Production `ADMIN_PIN` alone.

## A security finding worth remembering

`SUPABASE_ANON_KEY` and `ADMIN_PIN` were both scoped to **Production and
Preview**, so every preview deployment had been running with production's
public key and production's admin PIN. Both are now Production-only with
separate Preview values. **Task 4 cut previews off from production data but not
from production secrets.** Worth sweeping the rest when convenient; from the
Vercel list, `CRON_SECRET`, both `FOUNDER_DASHBOARD_*` and
`BLOB_MIRROR_SKIP_ACTIONS` are Production-only and clean.

## Dated items

- **1 October (Thursday):** first real canonical month close. Run
  `npm run parity:gate` afterwards and check the four things in Deveen's
  09-20 handover. The gate needs the secret key passed explicitly; see
  the memory note, not `.env.local`.
- **After the 1 October close:** policy-based RLS for direct client reads,
  subject to approval. The server-only lockdown is already applied; do not
  repeat it. **Wave B** is separate — and the runbook's Wave B line still wrongly
  includes `delete-log`. Corrected value is in Deveen's §9.

## Sandbox gotcha for the next agent

Several sessions run sandboxes at once. `scripts/sandbox.mjs` hardcodes
Supabase-stand-in port 54321, so a second sandbox fails with `EADDRINUSE` and,
worse, `npm run sandbox:seed` then seeds **another session's** sandbox — which
happened here. Check ports 3000/54321/3100 first, and run a copy of
`sandbox.mjs` with different ports if they are taken.
