# 5 November 2026 — build 12 is current again

**`main` is merged into `claude/testflight-build-12-2026-10-21`, pushed as
`bdee799`.** The branch is now **0 commits behind main** and carries all 21
code changes it was missing. `ios/` is untouched. Nothing on `main` changed;
nothing was deployed.

The branch is ready to open in Xcode. Cutting and uploading the build is the
founder's step.

---

## 1. What this branch actually is

Worth stating, because it surprised everyone this session: that branch is
**67 commits ahead of `main`, not just behind it.** It holds the entire iOS
side of Fero, and `main` has none of it:

- `ios/` — the Xcode project, `Info.plist`, entitlements, `PrivacyInfo.xcprivacy`
- `capacitor.config.ts`
- `server/push.js`, `src/lib/pushNotifications.js`, and two push migrations

**This branch is the only copy of the iPhone app.** If it were deleted, the
Xcode setup goes with it. Moving it onto `main` is worth doing after
submission; it should not be untangled before.

## 2. The merge

Dry-run first with `git merge-tree`, which touches nothing: **no conflicts.**
Then merged for real in the existing worktree at
`/Users/opera_user/Developer/FERO/build-12-2026-10-21`, which was clean, in
sync with origin, and untouched since 21 October.

The two sides had edited different things — `main` changed the app, the branch
added the wrapper — so git resolved it without help. Confirmed afterwards that
`git diff` over `ios/` and `capacitor.config.ts` is **empty**: the merge did
not touch a single file of the iOS project.

### What build 12 was missing

| | |
| --- | --- |
| the daily cap | two per **activity**, not two per day (22 Oct) |
| the calendar | tapping your own day shows the workout instead of starting a delete |
| notifications | your own comment no longer notifies you; threads you are in now do |
| **Deveen:** auth | a rate-limited Auth no longer signs members out of working accounts |
| **Deveen:** reads | concurrent refreshes share one read instead of each starting their own |
| **Deveen:** targets | a prorated target can no longer exceed the full target |
| offline | the "cannot reach the server" notice, and Retry showing its own outcome |
| dashboard | the App Review fixture stays out of the founder numbers |

## 3. Verification

| Check | Result |
| --- | --- |
| `npm run lint` | **clean** |
| `npm run build` | **clean**, built in 1.60s |
| All 31 `test:*` scripts | **29 pass, 2 fail** — see below |
| App loads in the browser at 375×812 | **yes** — renders the shell and the empty state, no blank screen |
| `ios/` and `capacitor.config.ts` after merge | **byte-identical** to before |
| `origin/main` contained in the branch | **yes**, 0 behind |

Lint passing is the one that matters most here: `no-undef` is what catches the
un-imported identifier that has shipped a blank screen more than once.

### The two failures are pre-existing, and that is proved rather than assumed

`test:auth-edge-flows` and `test:mobile-navigation` both fail. Neither is
caused by the merge.

Both need the sandbox, and **the sandbox seed itself fails first**:

```
Error: Rollover did not close September.
```

`scripts/sandbox-seed.mjs` is **byte-identical to main's** — confirmed with
`git diff origin/main HEAD`. So it fails on `main` today in exactly the same
way. `scripts/test-auth-edge-flows.mjs` is identical to main's too.
`test-mobile-navigation.mjs` is the one script that differs, and it depends on
the same seed.

**Stated plainly: those two tests were not run successfully, on this branch or
anywhere else.** The seed is stale — it is built around a September close and
we are in November. Fixing it is its own task and was not attempted here.

## 4. What was NOT done

- **No build was cut and nothing was uploaded to TestFlight.** That is Xcode,
  and it is the founder's step.
- Nothing was deployed. `main` is unchanged and production is untouched.
- The sandbox seed was not repaired.

## 5. Housekeeping

Sandbox processes on ports 3000 and 54321 stopped by PID. Browser viewport
reset. The worktree at `/Users/opera_user/Developer/FERO/build-12-2026-10-21`
was **kept** — it is where the build gets cut from, and its `.env.local` holds
only sandbox-safe values (the three Supabase keys are empty there, which is why
a local run against real data was not attempted).

## 6. Still open for the App Store

1. **Cut build 12 in Xcode and upload it.**
2. **The review video.**
3. **No Terms/EULA page** — `/terms`, `/eula` and `/legal` all return 404 on
   the live site, checked today. The runbook had this as "not a blocker", and
   that is probably right for Apple's form, but Fero moves money between
   members and has nothing written down about who is responsible when someone
   does not pay.
4. **`payment_methods.method_type` allows `bank` as free text.** Zero rows
   today. If it is reachable in the app, the privacy labels must declare
   financial data; removing the option is the smaller change.
