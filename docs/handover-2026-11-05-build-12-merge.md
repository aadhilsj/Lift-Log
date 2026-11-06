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

---

## §12. The `bank` option, and the App Review notes filled in — 6 November 2026

The founder asked two things: should the `bank` payment option be removed, and
which of the four remaining submission items could be handled without him.

### The `bank` option: nothing to remove, and I had it wrong

I told the founder the app lets a member type bank details into their profile,
and that keeping it meant declaring financial data to Apple. **That was wrong.**
I took it from §4 of `docs/app-store-review-notes-2026-10-22.md`, which claimed
the value was "stored as free text", and repeated it without checking. He said
"yes, remove it" on the strength of that. Checking it first would have saved him
the decision.

What is actually there, each line checked on 6 November:

| | |
| --- | --- |
| Not free text | It is a Postgres enum, `ante_core.payment_method_type` = `revolut, wise, paypal, bank, other` |
| No way to reach it | `PAYMENT_PROVIDERS` (`src/lib/paymentLinks.js`) offers Revolut, PayPal, Vipps. The API rejects the rest: `SUPPORTED_PAYMENT_PROVIDERS = new Set(["revolut","paypal","vipps"])`, `api/lift-log.js:9332` |
| The tables are empty | `payment_methods` **0 rows**, `settlement_transfers` **0 rows**; nothing in `api/` writes to either. Dormant from the canonical-schema plan |
| Where handles actually live | `ante_core.profiles.payment_provider` / `payment_handle`. 54 profiles: **53 blank, 1 `revolut`** |

**Decision: the database type is left alone, and I told the founder why rather
than carrying out the change he had approved.** Dropping a value from a Postgres
enum means recreating the type and re-pointing two live columns; the rollback is
not one statement. That is real risk for a value no code path can produce, in
two empty tables. Apple's privacy questionnaire asks what the app *collects* —
it collects no financial data — so the labels are already right and this was
never a rejection risk. `wise` and `bank` stay defined and unreachable; a
tidy-up for whenever `payment_methods` is brought into use.

### The App Review notes are now paste-ready

`docs/app-store-review-notes-2026-10-22.md`, §1. Every placeholder is gone —
`grep '\[URL\]\|\[NAME\]\|\[CODE'` returns nothing, which the runbook requires
before submission.

Filled in from production, not from memory:

| | |
| --- | --- |
| Review account | `feroappreview@gmail.com`, display name **Fero Review**, active member, 1 November workout logged so it does not read as dormant |
| Bloc | **Sunday Warriors**, invite `FQ1GXF`, target 12, penalty GBP 10 |
| Members | 6 active — Tariq, Hana, Noah, Eli, Leo, Fero Review |
| October | **closed** 1 Nov. 14/13/13/12/12 — all five met the target |
| November | **open**. Tariq 4, Hana 3, Eli 2, Leo 2, Noah 2, Fero Review 1 |

**Three things in the notes were wrong and are corrected:**

1. **The cap.** They said "two workouts per day". It has been two of the *same
   activity* per day since 22 October. A reviewer logging a run and a gym
   session would have been told the notes were wrong about the app's own rule.
2. **The settlement buttons.** The notes promised a reviewer "will see" Claim
   paid / Confirm / Dispute. **Every October member met the target, so nothing
   is owed and those controls are not on screen anywhere in this Bloc** — all
   five `settlement_status` values on the October season are null. The notes now
   describe the mechanic, say plainly that nothing is currently owed, and say
   how to produce one. A reviewer following the old wording and finding no
   buttons was the worse outcome.
3. **The `bank` line**, as above.

**Also closed in the notes:** the review video is marked *not required* —
guideline 2.1 asks for a demo account, not a video, and §1 carries the single
line to add if a URL ever exists. The section claiming there is no Terms page is
replaced; `/terms/`, `/privacy/` and `/support/` on `www.joinfero.app` all
returned **200** on 6 November. The notes now state the 18+ minimum and that
Fero asks for no bank or card details.

### What is left, now in §5 of the notes

Four fields the founder types into App Store Connect — Privacy Policy URL, Terms
of Use URL, the age questionnaire answered **18+**, and the §1 notes block plus
the mailbox password, which goes straight into Apple and never into a chat — and
one judgement call: submit build 12, or cut build 13 so the three changes that
landed today are in the binary. None of the three is a rejection risk.

### Verified

Read-only SQL against production (project `bpvvvqjsfwmmfjvvijkd`) for every
number above; `curl` for the three legal URLs. **Docs only — no code, no schema
and no production data was changed in this section.**

---

## §13. App Store items parked, and where push notifications actually stand — 6 November 2026

### Parked, at the founder's request

He has **not** done these yet and asked that they be written down so they are not
lost. Nothing here is blocked on anyone else; it is typing into App Store
Connect, and §5 of `docs/app-store-review-notes-2026-10-22.md` holds the exact
values.

| | Where | Value |
| --- | --- | --- |
| 1 | App Information → Privacy Policy URL | `https://www.joinfero.app/privacy/` |
| 2 | App Information → Terms of Use (EULA) | `https://www.joinfero.app/terms/` |
| 3 | Age rating questionnaire | answer so it lands on **18+** |
| 4 | App Review Information → Notes | the §1 block, paste-ready |
| 5 | App Review Information → Sign-In | `feroappreview@gmail.com` + mailbox password, typed straight into Apple |

**One thing found while looking at push, which changes item 4.** The notes claim
Apple Push Notification service is an external service the app uses, and that
the Notifications permission is requested for "workout and settlement
reminders". **On build 12 that is not true** — see below, no permission prompt
can appear and nothing is ever sent. Either push ships before submission, or
those two lines come out of the notes. **Do not submit with them as they are.**

### Push notifications: the foundation is built and secure; nothing is wired up

The founder asked how notifications would be made to pop up when someone logs a
workout or reacts. He thought push was "already activated". Half right, and the
half that is done is the hard half.

**This was not re-derived.** Two documents already cover it and both were read:

- `docs/handover-2026-09-28-push-foundation.md` — on
  `origin/claude/testflight-build-12-2026-10-21`, not on `main`
- `docs/push-notifications-order-of-operations-2026-09-30.md` — on
  `origin/claude/push-notifications-plan-2026-09-30`, documentation only

**Everything push lives on the iOS branch. `main` has no push files at all** —
`git ls-tree origin/main | grep push` returns nothing. The nine files are
`api/push-devices.js`, `server/push.js`, `src/lib/pushNotifications.js`,
`scripts/send-test-push.mjs`, `scripts/test-push-foundation.mjs`,
`scripts/test-push-foundation-db.sql`, two migrations and the 28 Sept handover.

**Built and verified in production on 6 November:**

| | |
| --- | --- |
| `ante_core.push_devices` | exists, **RLS on, 0 policies, grants only to `postgres` and `service_role`** |
| The four RPCs | `register_fero_push_device`, `revoke_fero_push_device`, `list_fero_push_devices`, `record_fero_push_result` — all present |
| Device rows | **0** |
| Capacitor plugin | `@capacitor/push-notifications` **8.1.2**, on the iOS branch only |
| iOS entitlements | `Release.entitlements` = `aps-environment: production`, `Debug` = `development`, both wired via `CODE_SIGN_ENTITLEMENTS` in `project.pbxproj` |
| `AppDelegate.swift` | has both Capacitor remote-notification forwarding hooks |
| Apple App ID | Push **enabled** 5 November, and the distribution profile regenerated — steps 1 and 3 of the order of operations |
| The sender | `server/push.js`, 129 lines: ES256 JWT signing, production/sandbox routing, 410-vs-BadDeviceToken handling, `record_fero_push_result` |

**The five things missing, in the order they have to happen:**

1. **No APNs key.** `vercel env ls production` lists 14 variables and **none** is
   `APNS_PRIVATE_KEY`, `APNS_KEY_ID` or `APNS_TEAM_ID`. Without the key nothing
   can ever be sent. Team ID is already known: `SMR55A2M96`. The `.p8`
   downloads **once only** and must never reach the repo or a chat.
2. **`PUSH_REGISTRATION_ENABLED` is not set**, so `api/push-devices.js` refuses
   every registration. That is why `push_devices` has 0 rows.
3. **Nothing asks the member for permission.**
   `requestPushPermissionFromUserAction({ userInitiated: true })` exists in
   `src/lib/pushNotifications.js` and **has no caller anywhere in `src/`**.
   `syncPushRegistration()` deliberately only checks existing permission and
   never prompts. iOS asks **once, ever** — this is the founder's decision and
   has been open since 28 September.
4. **No app event sends anything.** This is what he actually asked for. The
   server already has the exact hook points, all in `api/lift-log.js`:
   `add-log` / `multi-log` (:11135, :11059), `reaction` (:11544),
   `log-comment-create` (:10394), `stream-send` (:10297), `stream-reaction`
   (:10333). Not one of them sends a push.
5. **The message text is hardcoded.** `buildApnsRequest` always sends
   `title: "Fero test"`, `body: "Push notifications are connected."` It needs a
   message argument before it can carry a real event. Small change; the signing,
   routing and token lifecycle around it are done.

**One thing to be clear about for the "For you" centre.** It is **not** a
server-side notification feed. `buildNotifications` in
`src/lib/notificationCentre.js` computes every row **in the client** from state
the app already holds. So push cannot simply mirror it — a push has to be sent
from the server at the moment the action is written. The two will need to agree,
which is work in its own right, not a side effect.

**Environment trap, worth repeating because it has cost a session before.**
TestFlight and App Store builds use **production** APNs. A sandbox token sent to
production APNs returns `BadDeviceToken`, which reads like an expired token and
is not. A physical Debug build needs
`VITE_APNS_ENVIRONMENT=sandbox npm run build` before `npx cap sync ios`.

### Verified, and what was not changed

Read-only throughout: `git ls-tree` / `git show` against `origin/main` and the
two branches, `vercel env ls production`, and read-only SQL against project
`bpvvvqjsfwmmfjvvijkd` for the table, its RLS, its grants, its RPCs and its row
count. **No code, no schema, no environment variable and no production data was
changed in this section.** No plan was executed — the founder asked how it
would work, and that is a separate turn from building it.

---

## §14. The push notification design — 6 November 2026

The founder asked to leave the APNs key until last, because it needs his
personal laptop, and to do the design work now: which moments deserve a
notification, how they bundle, what the types are, and when to ask permission.

**All four are answered in `docs/push-notification-design-2026-11-06.md`**, with
a mockup of every notification in Fero's styling on the Design canvas titled
*Fero push notifications* (the six types, bundling, the permission moment, the
measured volume). **It is a proposal; no code was changed.**

### The finding that shaped it

His own example — "when somebody has logged a workout" — is the one rule that
must not be built, and the number says so. Counted from production for October
2026 (730 workouts, 512 reactions, 84 comments, 124 Stream messages, every
Bloc), per member per month:

| Bloc | People | Workouts | "Someone logged a workout" | "Reacted to yours", bundled |
| --- | --- | --- | --- | --- |
| OSI H3 | 7 | 157 | **135** | 9.7 |
| Go To Da Gym | 10 | 110 | **99** | 5.5 |
| Sweat Equity | 7 | 93 | **80** | 8.4 |
| Ctrl Alt De-feat | 8 | 92 | **81** | 9.9 |
| StavanGang | 7 | 90 | **77** | 9.6 |
| Sarandawgs | 8 | 63 | **55** | 4.6 |

**135 a month is four or five buzzes a day and not one is about you.** The
bundled column is exact, not estimated: distinct logs that got a reaction from
someone other than the owner, divided by members.

**I first wrote "30 a day" in the mockup from a rough multiplication and
corrected it to 135 a month once it was measured.** The right order is measure
then state; the artboard was fixed before this was committed.

### What was decided, and on what grounds

- **Six types.** Four of them are exactly the kinds the bell already builds —
  `reaction`, `comment`, thread `comment`, `mention` — reusing `describeWorkout`
  and `nameList` so the push and the bell can never word the same event two
  ways. Two are new and scheduled: a **pace nudge** ("3 days left. You're 2
  workouts off 12.") and **month closed**.
- **The pace nudge is the only genuinely new notification**, and for an
  accountability app probably the most valuable of the six: it is the only one
  that can change the outcome rather than report it. `ante_core.blocs.time_zone`
  already has what it needs.
- **The Bloc name is the iOS title**, every type, because members are in more
  than one Bloc and "who reacted" is useless without "where".
- **Two deliberate omissions.** The workout feed becomes **one daily digest, off
  by default**. Being owed money sends nothing — the bell already draws that
  line with `alwaysUnread`, whose comment reads *"a badge you cannot clear is
  just nagging"*.
- **Bundling reuses the bell's own rule**, in the code's words: *"five reactions
  on one workout is one thing that happened, not five."* Plus collapsing names,
  never your own action, a 22:00–07:00 quiet window in the member's time zone,
  and six individual switches.
- **The permission moment: right after the first workout is logged**, as Fero's
  own card with "Turn on notifications" and "Not now". Apple is only called by
  the green button, so a "Not now" leaves the single system prompt unspent and
  Fero can ask again. This is the question the 28 September handover left open
  and nobody answered; it is now one recommendation, not a menu.

### What can be built before the key, and what cannot

Buildable now: the message argument on `buildApnsRequest` (it hardcodes
`title: "Fero test"`), the permission card, and the six switches with their
store. **None of it can be tested end to end without the key** — no device token
is stored until registration is switched on, and nothing can be sent at all
without `APNS_PRIVATE_KEY`. That limit is stated in the design doc rather than
left to be discovered.

### Verified, and what was not changed

Read-only SQL against production for every figure (project
`bpvvvqjsfwmmfjvvijkd`), and `src/lib/notificationCentre.js`,
`api/lift-log.js` and `server/push.js` read for the existing rules and hook
points. **No code, no schema, no environment variable and no production data was
changed.** `main` is docs-only on this session. Nothing was built: the founder
asked for the design, and build is a separate turn.

---

## §15. The founder overruled the digest, and he was right — 6 November 2026

Same day, immediately after §14. **He pushed back on the one thing §14 dropped,
and the pushback was correct.** His words:

> *"it is important to be notified when your blocmates log a workout. That's the
> whole like motivation and accountability factor. It's like when you're being
> lazy on a Sunday and you get notification saying three of your buddies have
> logged a workout. That's what pushes you to go do your own workout."*

He also supplied the fix himself — a threshold, "maybe two people, maybe three,
or maybe a certain percentage, depending on if one person is in a block with
only three people" — and asked whether it should be per Bloc or across all of
them.

**My error in §14 was treating "too many" as "do not send".** The 135-a-month
figure was right; the conclusion was not. The problem was *one per event*, never
the subject. An off-by-default daily digest was the timid answer to a correct
measurement, and it would have cut out the loop the app exists for.

### What the data said once the right rule was tested

The condition that changes everything is **"and you have not logged today"**.
It removes every notification that could not change anything. Per member per
month, October 2026, every Bloc of three or more:

| Rule, with "you have not logged" | Per member / month |
| --- | --- |
| ≥1 other logged | 19.2 |
| ≥2 others logged | 14.5 |
| ≥3 others logged | 8.8 |
| **a third of the others** | **11.3** |
| half of the others | 5.9 |

**His percentage instinct was right, and Curke proves it.** In the 3-member
Bloc: a flat "3 people" fires **0.0** times a month — it *cannot*, there are
only two other people — and a flat "2 people" fires 1.3. A third of the others
fires 8.0. Meanwhile in 10-member Go To Da Gym a flat "2 people" is 17.5 and a
third is 11.1. **A flat count is either dead in small Blocs or too loud in large
ones; a third is neither.**

**The rule: a third of the other members, rounded up, minimum one** — 1 of 2,
2 of 6, 3 of 7, 7 of 19. No special case.

### 17:00, chosen from when people actually log

Share of a day's workouts already logged, by hour, October 2026: 09:00 23%,
12:00 37%, 15:00 55%, **17:00 65%**, 19:00 80%, 21:00 97%.

So at 17:00 two-thirds of the Bloc's day has happened — the number in the
message is real rather than premature — and **a third of all logging is still
ahead**, so it can still be acted on. Earlier reports nothing; later is a
reproach. 17:00 in the member's own time zone (`ante_core.blocs.time_zone`).

### Per Bloc, with one cap across all of them

Per Bloc, because the message names people. But **at most one a day per
member**: two qualifying Blocs merge into "5 of your blocmates have logged
today." On October's data the cap trims 519 fires to 468 — small at 1.2 Blocs a
member (8 of 51 are in more than one), and the thing that stops it compounding.

### The copy

> **Sarandawgs**
> Hana, Noah and Tariq have logged today.
> You're on 7 of 12.

One person: *"Hana has logged today. You're on 7 of 12."* Two Blocs: *"5 of your
blocmates have logged today."* Already at target: **nothing sent**.

The names are the social proof; the "7 of 12" is the stake. Both halves are
needed — names alone are gossip, the number alone is a spreadsheet.

### Decided

- It is **type 1 of seven**, and **the only one on by default**: an
  accountability app whose accountability is opt-in does not work. It keeps its
  own switch.
- **Types 1, 6 and 7 are one scheduled job**, not three. Where type 1 and the
  pace nudge would both fire on a day, **type 6 wins** — "3 days left" is the
  more urgent fact.
- `docs/push-notification-design-2026-11-06.md` is revised in place (§1A is new
  and carries the whole rule) and the mockup canvas has a new artboard for it.

**Still a proposal. No code, no schema, no env var, no production data changed.**
Every figure is read-only SQL against project `bpvvvqjsfwmmfjvvijkd`; the
queries are in §1A of the design doc in prose form.

---

## 16. Nine notification types, and a bug the founder's question found

Design only. **No code, schema, environment variable or production data was
changed.** Still a proposal awaiting his go-ahead.

### What he asked

He approved the comment, mention and month-close types, then asked three
things: how types 1 and 2 behave for someone in several Blocs, to see every
variation of the money and month-close notifications, and for a new
notification when the **Bloc streak** is at risk.

### A correction I had to make first

My chat summary of the seven types did not match the design doc's seven. I
dropped "reply in a thread" and added "money" as a type of its own. The
numbering was wrong; the instinct was right — money does need its own type,
because the settlement handshake happens days after month close. The doc now
has **nine types**, and nothing he had already approved was renumbered.

### The bug, which is the important part

**One workout can be posted to several Blocs at once** — one row per Bloc
sharing a session key (`getWorkoutSessionKey`, `appState.js:1412`). The "For
you" bell keys a reaction row on `log.id`, which is per-Bloc.

If push copies that, **one gym session buzzes you once per Bloc.** Measured on
October production: 103 of 547 workouts went to more than one Bloc, 19 to all
six. The founder himself would have had **51 reaction pushes for 17 workouts**.

Fix: key reactions and comments on `getWorkoutSessionKey` + owner, and use that
as the APNs `apns-collapse-id`. Written up as §2D.

### Type 9 — the streak

The rule already exists and must not be re-derived: `src/lib/blocStreak.js`
(`BLOC_STREAK_MIN_DAYS = 10`, `BLOC_STREAK_WARN_HOUR = 19`, 3am day end). The
notification calls `blocStreakView` so the card and the push cannot disagree.
It needs no "only if you haven't logged" filter — if the streak is at risk,
nobody has. It can never collide with type 1, whose condition is the opposite.

Volume, Sept–Oct, per member per month: 3.6–5.0 in four Blocs, 8.6 in
Sarandawgs, **14.1 in StavanGang** — who are not fragile, they just train late.
Recommended: keep 19:00 for v1, revisit with a per-Bloc hour if it annoys.

### Also written up

- **§2A, type 8 — money.** Five pushes across claim / confirm / dispute / a
  single 7-day reminder / pot settled. Never "X still owes you", inheriting the
  bell's `alwaysUnread` rule.
- **§2B, type 7 — the seven month-close outcomes**, lifted from
  `SettlementScreen.jsx` in its own check order so the two cannot disagree.

### Verified

Structure of all five changed artboards (tag balance, every `sc-for` alias and
list key resolving). **Not** verified visually: the browser pane is not signed
in to claude.ai, so the boards were not eyeballed rendered.

### Files

| File | What |
| --- | --- |
| `docs/push-notification-design-2026-11-06.md` | §2 now nine types; new §2A, §2B, §2C, §2D; build order updated |
| `docs/handover-2026-11-05-build-12-merge.md` | this section |
| Artifact `SiGivnD85RCPqpjayZp1k1` | v10 — four new boards, overview updated |

### Open

He has not yet approved building any of it. The APNs key is still deferred to
his personal laptop, and the review notes still claim push is in build 12.
