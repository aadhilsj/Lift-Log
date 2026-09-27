# Handover — 2026-09-21: workspace audit, the live mirror switch, and one colour fix

Short session. Mostly an audit; one line of code changed. **§3 is the part
worth reading even if you skip the rest** — it records a live production
setting that had never been verified from outside Vercel.

| For | Read |
|---|---|
| The previous session (mine) | `docs/handover-2026-09-19-notes-furthest-behind-yearly-allowance.md` |
| Deveen's latest | `docs/handover-2026-09-20-month-close-canonical-and-open-season-gate.md` |
| The 09-20 UI session | `docs/handover-2026-09-20-ui-and-log-recovery.md` |

---

## 1. Plain-English summary

The founder asked what Deveen had done, since he had reported progress without
sending a handover. He had in fact written one; it was in the repo. His month-
close work and the new open-season parity check are merged and live, with no
database changes. Everything on `main` passes its checks.

While closing a small leftover item we found that the live `BLOB_MIRROR_SKIP_ACTIONS`
setting had never been read by anyone, because Vercel hides it. It is switched
on, for the expected first wave. That is now recorded, with the command to
re-check it in ten seconds.

## 2. The audit, verified on `main` at `727c326`

- `npm run lint`, `npm run build`, **17 test suites** and **23/23 parity-gate
  scenarios** all pass.
- Production deployed and healthy; the live bundle contains the current code.
- **No new migrations since 2026-09-18.** Deveen's month-close work is code only.
- Production data spot checks: the restored 19 September log is present in both
  canonical and blob with its tombstone cleared; no pending sit-out or Solo
  requests; three Solo members in September (Tobias old rules, Nishara and Rahul
  new rules, both correctly marked); nobody excused in September.

## 3. The live mirror switch — read this

`BLOB_MIRROR_SKIP_ACTIONS` tells the server to stop mirroring an action into
the blob. There were **two** Vercel entries, not one:

| Scope | State |
|---|---|
| Preview, branch `codex/create-group-canon`, last updated 18 Jul | **Deleted 2026-09-21** by the founder. The branch no longer exists on GitHub either. This closes §3 item 3 of Deveen's 09-14 handover. |
| **Production**, last updated 13 Sep | **Enabled**, with `reaction, flag, flag-response, flag-review`. Left untouched. |

The Production value is the planned first wave from
`docs/backend-migration-closeout-plan-2026-07-12.md`. The 13 September edit is
when `delete-log` was taken **out** of that list — the fix for the delete-log
divergence. Deveen's live gate run on 20 September found zero phantom and zero
missing logs, which is independent confirmation that it worked.

**How to read it again** (the value is write-only in Vercel, so ask the app).
The admin PIN must never be pasted into a chat — the founder runs this in his
own terminal:

```bash
printf 'Admin PIN (hidden): ' && read -rs PIN && echo && curl -s -X POST https://lift-log-nu.vercel.app/api/lift-log -H 'Content-Type: application/json' -d "{\"action\":\"blob-mirror-dependency-report\",\"pin\":\"$PIN\"}" | python3 -c 'import sys,json;d=json.load(sys.stdin);print(json.dumps(d.get("mirrorSkipRuntime",d),indent=2))'
```

**Rule for anyone touching these entries:** never delete one because a handover
calls it inert. Check the scope in Vercel, then check the runtime value with
the command above. A Production entry is live behaviour.

## 4. What changed in code (`aa4595b`)

One line. On the Status tab the sit-out allowance dots were amber; they are now
the same cyan the profile uses, so a filled dot means the same thing and looks
the same on both screens that draw it.

- **Deliberately not changed:** the "Your 2026" strip still shows sat-out months
  in amber and Solo months in cyan. There the colour separates the two kinds of
  month rather than showing what is left, and the line under it names them.
  Founder decision, 2026-09-21.
- Verified: lint, build, `test:yearly-allowance`, seen at 375×667 in two states,
  live bundle confirmed after deploy.

## 5. Noticed, not fixed

1. **`caption` is read but never written.** `normalizeLogEntry` in both
   `api/lift-log.js` and `src/lib/appState.js` falls back to `log.caption` when
   `note` is empty, and `LogCommentThread` does the same. Nothing in the codebase
   ever writes `caption`. Harmless, but it is dead shape that will mislead
   someone. Confirm with the 09-20 session before removing.
2. **Sit-out is now instant through the 10th** (was the 5th), matching Solo.
   Founder decision on 09-20. It widens the window in which someone can see how
   their month is going before taking a free month off. Worth watching once the
   allowance has run for a month or two.
3. **Two definitions of "a month you sat out"** now exist: the per-Bloc
   allowance (`getYearlyAllowanceUsage`) and a cross-Bloc set collected by
   `buildFeroProfileStats` / `buildProfileStats` for the All Blocs trend chart.
   They serve different purposes and do not currently disagree. Do not let the
   second one drift into being used as an allowance count.

## 6. Open items, unchanged by this session

- **Deveen:** the RLS rollout (App Store blocker, not started) and scaling
  (not started). The founder has been sent a note asking for dates; he says
  Deveen will take the RLS work.
- **1 October:** month close on canonical has never run against a real
  rollover. Deveen's handover lists the four checks to run right after it.
- **Codex:** App Store readiness, about 55%.
- **Product:** the Bloc vote for requests past the yearly allowance is still
  undesigned; those requests go to the Bloc Admin until it exists.

## 7. Working note for the next agent

Two sessions were editing this repo on 20–21 September; `main` moved twice
during a one-line change. Fetch and rebase immediately before pushing, and
expect the shared folder `Codex Space/Fero` to be far behind — it is still on
`086c907`. Work from `origin/main` in your own worktree.
