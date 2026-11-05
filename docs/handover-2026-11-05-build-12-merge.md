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
3. ~~**No Terms/EULA page**~~ — **done, live.** See §7.
4. **`payment_methods.method_type` allows `bank` as free text.** Zero rows
   today. If it is reachable in the app, the privacy labels must declare
   financial data; removing the option is the smaller change.


## 7. Terms of Use — live at `/terms/`

Commit `0970ed1`, pushed to `main` and live on
`https://lift-log-nu.vercel.app/terms/` (HTTP 200 confirmed, page contains the
age line). One new file, `public/terms/index.html`, 75 lines. **Nothing else
was modified** — no app code, no styles, no other page.

It reuses the same shell as `/privacy/` and `/support/`: `/legal.css`, the
Outfit font, the `Fero` wordmark, and the same footer pattern. Effective date
5 November 2026.

### The section that matters for App Store review

**"Fero does not handle money."** It states that Fero does not process, hold,
transfer, collect or refund any payment, and has no payment processing of any
kind. A Bloc's forfeit is an agreement between its members; what Fero shows is
a record of what they told it they agreed. Marking an amount paid is a note in
a shared ledger — not proof, not a settlement, and not something Fero can
verify. Fero is not a bank, payment service, escrow, money transmitter, or a
party to any agreement between members.

This was verified against the code before it was written: settlements carry
`payerDisplayName` and `receiverDisplayName` (missers pay achievers directly,
not a pot Fero holds), and a grep for Stripe, PaymentIntent and StoreKit
returns nothing anywhere in the repo.

### Minimum age: 18

The founder asked whether 13+ would be better, since Instagram is 13+. It
would not, and the reasoning is recorded here so it is not re-litigated:

- Instagram moves no money. Fero's settlements have a payer and a receiver, so
  a Bloc with a forfeit is a **staked contest**, not a social feed.
- The closest comparables are both 18+: DietBet's terms restrict the service to
  18 and over; HealthyWage's App Store listing is rated 18+.
- In most jurisdictions a minor cannot be bound to the forfeit they agreed to,
  so the ledger would show a debt that is not enforceable.
- Apple guideline 5.3.1 requires contests to be **sponsored by the developer**.
  Fero's contests are run by the members. What keeps Fero clear of 5.3 is
  precisely the "Fero does not handle money" section; 18+ sits more comfortably
  beside it than 13+.
- It is asymmetric pre-launch: lowering the age later is easy, raising it after
  under-18s have joined is not.

Context for the App Store Connect form: Apple replaced the old tiers in July
2025. They are now **4+, 9+, 13+, 16+, 18+** — 12+ and 17+ no longer exist. The
answer given in the questionnaire must be consistent with this 18 in the Terms,
or Apple flags the mismatch (guideline 2.3.6).

### Footer cross-links — done, live

Commit `03a783a`. One line in each of `public/privacy/index.html` and
`public/support/index.html`, adding `Terms of Use` to the footer. All three
legal pages now cross-link to each other, so a reviewer landing on any one of
them can reach the other two.

Measured, not eyeballed: at 375px the footer is still a single line on both
pages (`scrollWidth` 343 = `clientWidth` 343), so no row height changed.

**Vercel's edge cache serves the old HTML for roughly a minute after a deploy.**
A plain `curl` of `/privacy/` returned the pre-change footer while a
cache-busted request on the same second returned the new one. Verified both
ways afterwards. Worth remembering before concluding a static-page deploy
failed.

Verified before pushing: `npm run lint` clean, `npm run build` clean (the page
is copied into `dist/terms/`), and the page rendered at 375x812 in the browser
pane against the built output.
