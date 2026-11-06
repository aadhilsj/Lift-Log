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

## 8. Build 12 on TestFlight, and what the founder checked on his phone

Uploaded by Codex from the personal laptop at 19:13 on 5 November, **Ready to
Submit**, internal *Fero Team* group. Its own handover is
`docs/handover-2026-11-05-testflight-build-12-upload.md`, which lives **only on
the build branch** — `main` cannot see it, and that is deliberate until after
submission. Codex touched nothing outside `docs/`: confirmed by diffing
`bdee799..` over the branch.

### Verified on the founder's phone, 5 November

| Check | Result |
| --- | --- |
| Running build 12 | **Yes** — the Today screen shows the "N to go" / "Week's MVP" pills, which replaced the four stat cards and were never in build 10 |
| Bloc screen and nav | **Good**, founder's words |
| Calendar tap on your own current-month day | **Fixed** — opens a sheet with the date, the caption and *Delete workout* / *Close* as separate buttons. The tap no longer starts a delete |
| Two-per-activity cap | **Not checked on device.** It needs two real workouts logged into a live Bloc and the founder had logged nothing that day; he declined, which is the right call |

### Why the unchecked one is low risk

The cap is **not** a client rule. `assertWorkoutSlotAvailable` runs in
`api/lift-log.js` (two call sites, 6996 and 8422) and the database enforces it
atomically via `20261023100000_cap_two_per_activity_per_day.sql`. Both builds
talk to the same backend, so the rule has been in force for build 10 users as
well since 23 October.

What build 12 adds is only what the member *sees*: the in-app pre-check and the
message that names the activity (`Already logged 2 Run workouts for this date`)
instead of the bare `Already logged 2 workouts for this date`. So the untested
part is the wording, not the behaviour.

Keyed on the **specific activity**, confirmed in `getWorkoutActivityKey`, which
reads `log.activity` and only falls back to the broad `type`. Padel and Tennis
are both Sports and count apart. Note that the comment at the top of
`src/lib/activities.js` still says the daily cap reads the category — that
sentence predates 22 October and is wrong; the code is right.

### If it ever needs checking on a device

Sign the TestFlight app in as the review account,
`feroappreview@gmail.com` — it sits in Sunday Warriors with seeded November
activity, and it is excluded from every founder-dashboard number, so logging
throwaway workouts there costs nothing.

## 9. The review video, and the one real bug in it

Founder recorded it on build 12 on the night of 5–6 November: **2:11, portrait,
1170×2532, one continuous take.** Reviewed here by extracting frames (this
laptop has no video tooling; `imageio-ffmpeg` was installed into the session
scratchpad, not onto the machine).

What it covers, in order: email sign-in → the code in Gmail → onboarding →
the account screen → Sunday Warriors → logging a workout with a photo →
the leaderboard updating → Activity feed → Bloc Stream → October recap →
Profile. **More thorough than the shot list asked for**, and no real member's
name, photo or data appears anywhere — only the seeded Tariq, Hana, Noah, Eli,
Leo and Fero Review.

### The bug: every sign-in email still says "Anté"

Visible in the video at ~0:25, and confirmed read-only against the production
auth config:

| Key | Value |
| --- | --- |
| `mailer_subjects_magic_link` | `Your Anté sign-in code` |
| `mailer_templates_magic_link_content` | `<h2>Your Anté sign-in code</h2>…` |
| `smtp_sender_name` | `Fero` ✅ |

The sender is right; the subject and the body carry the old product name. The
sign-in code is **the only email Fero ever sends**, so every member who has
ever signed in has seen it — this is not a review-only problem. Apple's
reviewer will see an app called Fero asking them to open an email titled
"Your Anté sign-in code".

**Fixed, 6 November, on the founder's go-ahead.** `Anté` → `Fero` in both keys
via the Management API; `smtp_sender_name` was already `Fero` and was not
touched. Verified by diffing the entire auth config before and after: those two
keys are the only ones that moved, and no `Ant` string survives anywhere in it.
Rollback is a single PATCH, recorded at
`docs/rollback/20261106-magic-link-email-wording-PROD-BEFORE.md`.

The new wording is `Your Fero sign-in code`, in both the subject and the body
heading. Everything else in the template — the sentence, the code styling,
`{{ .Token }}`, the expiry line — is byte-identical to before.

**The video still shows the old wording**, since it was recorded before the
fix. That does not matter and is not a reason to re-record: the video is a
demonstration, and a reviewer comparing it to a live email finds the live one
better branded, not worse.

### Measured, from frames sampled every 2 seconds

Code entered at ~0:33, the Bloc on screen at ~0:74 — **about 40 seconds**, of
which `Saving…` on the "Your first month" sheet alone holds ~0:62 to ~0:72,
**10 to 12 seconds**. Nothing is broken; it is the slowest stretch in the video
and a reviewer could read it as a hang. Not investigated — out of scope for a
video review, and worth its own look before launch rather than before
submission.

### Not in the video

Account deletion. Apple requires it to exist, not to be filmed, and it is on
the Support page, so this is not a gap for submission.

## 10. The offline notice now says when it reconnects

Founder hit this on his phone on the night of 5–6 November, in Sarandawgs: the
Activity Feed's images were slow, the notice appeared, he pressed Retry, the
content loaded — **and the notice still read "Still can't reach Fero".** He
left the Bloc and came back; it loaded, and the notice was still red.

### What was wrong

The notice had three states and all three were bad news: `Can't reach Fero`,
`Reconnecting`, `Still can't reach Fero`. **There was no success state at
all.** The dot was hardcoded `#FF5B5B`. So a retry that worked and a retry that
did nothing looked identical, which is the same "did that do anything?" the
Retry spinner was added in `40d1190` to answer.

Shipped `a9c1547`, live on the website: reaching the server turns the dot
green (`--track-green`), says **Connected**, drops the Retry button and removes
the notice after 1.4 s. The path that heals a stuck failure without anyone
pressing anything — the `lastSyncedAt` effect — goes through the same green
moment instead of vanishing silently. A fresh failure during that moment wins
and puts the notice back to red.

### What is NOT explained yet

**Why it got stuck in the first place.** Two things are certain from the code:

1. A retry is judged failed by `const failed = !ok || syncErrorRef.current`.
   That ORs in a flag **every other request also writes**, so a retry that
   genuinely succeeded is still marked failed if any concurrent poll set
   `syncError` inside the same window.
2. Once `failed`, the only thing that clears it is `lastSyncedAt` changing.

That is a plausible route to what he saw, but it is **not proven** and the
exact sequence is unknown. Guessing further without evidence is how sessions
get wasted here — which is exactly why the founder asked for the failures to be
tracked. Nothing records them today: there is no client-side error reporting
anywhere in `src/`, and `ante_core.system_events` is written only by the
server, by the rollover.

### For build 13

`main` must be merged into `claude/testflight-build-12-2026-10-21` before the
next build is cut, or the phone app will not have this. That reverses the
earlier "do not merge main" instruction, which was written when the only thing
on `main` was the static Terms pages.

## 11. Sync outages are now recorded

Founder asked for the "can't reach Fero" failures to be tracked so they can be
investigated rather than guessed at. Shipped `4017a6d`, live on the website.

### How it works, and the one constraint that shapes it

**An app that cannot reach Fero cannot tell Fero that it cannot reach Fero.**
So the client opens an *episode* in `localStorage` the moment a sync fails,
holds it open while it keeps failing, closes it when a sync finally succeeds,
and sends it then. One row per outage, not per failed request.

Each row carries: when it started and ended, how long it lasted, how many
times Retry was pressed, whether a **retry** or a background sync (**auto**)
resolved it, `navigator.onLine` at the start — which separates "the phone knew
it had no network" from "the server could not be reached" — and whether the
app was installed or in a browser.

An episode that fails to send goes back in the queue. The network was
unreliable a moment ago; the send can fail too.

### Why a new table and not `system_events`

`ante_core.system_events` is the founder dashboard's health panel, and
`read_ante_core_system_events` takes the most recent rows **with no filter on
`event_type`**. Client outages are many-per-member; rollover failures are a
handful a month. Sharing the table would push the one alarm it exists for off
the bottom of the list. It already holds **862 rows**. So:
`ante_core.client_sync_events`, migration `20261106020000`, with its own
`record_` and `read_` RPCs shaped like the system-events pair.

### Applied to production, and verified

| Check | Result |
| --- | --- |
| Table created, RLS enabled | ✅ |
| Both RPCs `service_role` only (`anon` and `authenticated` revoked) | ✅ |
| Attribution resolves through `profiles.auth_user_id` | ✅ — the same trap as `read_ante_core_member_bloc_keys`; a wrong id loses attribution but keeps the row, because `profile_id` is nullable |
| Clamps hold | ✅ — 999999999 ms → 86400000, 99999 retries → 1000 |
| A timestamp 5 days in the future | ✅ refused, no row |
| `system_events` untouched | ✅ still 862 |
| Test rows removed | ✅ table is empty |
| `record-sync-outage` unauthenticated | ✅ 401 |
| `record-sync-outage` as the review account | ✅ `{ok:true, recorded:0}` — routed, authenticated, and the reviewer correctly dropped, no row written |

### What is NOT proven

**The full path from a real member's phone to a row.** Every account available
for testing is analytics-excluded, and creating a throwaway production account
to prove it was not worth the junk data. The two halves are each verified and
the code between them is six lines. **Check `ante_core.client_sync_events`
after the founder next sees the notice** — that is the real confirmation.

### The last Anté string — fixed

`api/lift-log.js` answered failures with `"Anté sync proxy failed"`. Fixed on
the founder's go-ahead, `fb1feef`, live and confirmed by calling the endpoint
unauthenticated: it now returns `"Fero sync proxy failed"`. Nothing matched on
the old string — the client reads `details`, not `error` — so there was no
caller to update.

**`grep -rI "Anté" api/ src/` now returns nothing.** With the sign-in email
fixed earlier today, the old product name is gone from shipped code and from
the only email Fero sends. It survives only in `ante_core` schema and file
names, which are internal and deliberately left alone.
