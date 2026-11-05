# Build 12 — Xcode handoff to the personal laptop

**Written 5 November 2026 on the work laptop, which has no Xcode.** Everything
needed to cut and upload TestFlight build 12 is in this file, so the personal
laptop needs nothing pasted into it beyond a pointer here.

Read `CLAUDE.md` first. Section 0 (get up to speed, keep a live handover),
section 2 (change only what was asked) and section 5 (another agent shares the
repo — stage by explicit path, never `git add -A`) all apply to this job.

---

## 1. The one-line summary

Check out `claude/testflight-build-12-2026-10-21`, run `npm run build && npx
cap sync ios`, open the Xcode workspace, archive, upload to TestFlight. Do not
merge `main`. Do not change `ios/`.

## 2. The branch

| | |
| --- | --- |
| Branch | `claude/testflight-build-12-2026-10-21` |
| Head when this was written | `bdee799` |
| Relative to `main` | **68 ahead, 5 behind** |
| Build number already set | `CURRENT_PROJECT_VERSION = 12` |
| Version | `MARKETING_VERSION = 1.0` |
| Bundle id | `com.aadhilsj.fero` |
| Team | `SMR55A2M96` |

**This branch is the only copy of the iPhone app.** `ios/`,
`capacitor.config.ts`, `server/push.js` and the push migrations exist nowhere
else — `main` has none of it. Do not delete the branch, do not force-push it,
and do not try to untangle it onto `main` before submission.

`main` was merged into it on 5 November (`bdee799`), so it carries the
per-activity cap, the calendar-tap fix, Deveen's three fixes and the rest.
Verified then: lint clean, build clean, 29 of 31 `test:*` scripts pass (the 2
failures are a stale sandbox seed and fail identically on `main`), and `ios/`
was byte-identical before and after the merge.

### Do NOT merge `main` again

The branch is 5 commits behind `main` as of writing. All five are the Terms of
Use work from 5 November: two touch `public/` (the `/terms/` page and a footer
link on `/privacy/` and `/support/`), three are documentation.

Those pages are served by Vercel at `lift-log-nu.vercel.app` and are **already
live**. The app does not link to them from anywhere — checked by grepping
`src/` for `privacy`, `terms`, `legal` and `joinfero`, which returns nothing
but an unrelated comment. Apple reads those URLs from the App Store Connect
metadata, not from inside the binary.

So merging would change the bundled assets without changing anything reachable,
and would throw away the verification already done. **Leave it 5 behind.**

## 3. Before you build

Work in a worktree, not the shared folder:

```bash
git fetch origin
git worktree add /Users/<you>/Developer/FERO/build-12 claude/testflight-build-12-2026-10-21
```

**Never create a worktree under `~/Documents`** — it is synced to iCloud, and
`node_modules` plus `dist/` there has previously brought `git status` to a
halt. `~/Developer` is not synced.

### No `.env.local` is needed

Confirmed on 5 November, because this is the kind of thing that wastes an hour:
the frontend reads exactly one build-time variable, `FERO_BUILD_ID`. The
Supabase keys in `.env.local` are server-side only and are not compiled into
the bundle.

The packaged app reaches the backend through `src/lib/apiOrigin.js`, which
rewrites every API call to an absolute origin when running natively:

```js
const nativeApiOrigin = (configuredApiOrigin || "https://lift-log-nu.vercel.app")...
```

`VITE_FERO_API_ORIGIN` overrides it and **must be left unset** — the default is
production, which is what a TestFlight build should talk to.

## 4. The build

```bash
cd /Users/<you>/Developer/FERO/build-12
npm ci
npm run lint
npm run build
npx cap sync ios
open ios/App/App.xcworkspace
```

`npx cap sync ios` is not optional — it copies `dist/` into the iOS project and
writes the generated Capacitor config. Neither is committed to the repo, so a
fresh checkout has no web assets in it until this runs.

In Xcode: select **Any iOS Device (arm64)**, then **Product → Archive**, then
**Distribute App → TestFlight & App Store**.

First build takes roughly 9 minutes. **A black or white screen for several
seconds after launch is the app still loading, not a failure** — a previous
session lost time calling that a bug.

## 5. Check before archiving

Run it on a device or simulator from the same build and confirm:

- [ ] It signs in with an emailed six-digit code (no passwords anywhere).
- [ ] Logging a **third** workout of the same activity in one day is refused,
      while a different activity on the same day is allowed. This is the
      22 October rule and the main reason build 12 exists.
- [ ] Tapping your own day in the calendar opens the workout rather than
      starting a delete.
- [ ] The Bloc screen shows the target, the members and the leaderboard.

If any of those behave like the old build, `npx cap sync ios` did not run or
Xcode built a stale archive.

## 6. What not to touch

- Do not change anything under `ios/`. The project, `Info.plist`,
  entitlements and `PrivacyInfo.xcprivacy` are all set and were verified.
- Do not bump the build number by hand unless the upload is rejected as a
  duplicate; it is already 12.
- Do not push to `main` from this job.
- Stage by explicit path. Another agent works in this repo.

## 7. The review video

Not required by Apple. Guideline 2.1 requires a demo account when the app has a
login, and that exists and works (`feroappreview@gmail.com`, in the Sunday
Warriors Bloc, seeded with November activity). Guideline 2.1 does not mention
demo videos at all.

It is still worth 90 seconds, because the sign-in is an emailed code and that
is the one step a reviewer could conclude is broken. Record it **from the build
that is actually submitted**, portrait, on a real device, in one continuous
take with no narration.

| Time | Shot |
| --- | --- |
| 0:00–0:10 | Launch from cold. Let the splash finish — do not cut the wait, it is real. |
| 0:10–0:30 | Enter the review email. Switch to Mail, show the six-digit code arriving, go back, enter it. **This is the shot that matters.** |
| 0:30–0:45 | The Bloc lands: monthly target, the five members, the leaderboard with real November activity. |
| 0:45–1:05 | Tap the centre **+** and log a workout. Hold on the count and status changing. |
| 1:05–1:20 | Activity tab — recent workouts, a reaction, a comment. |
| 1:20–1:30 | Month tab — the progress ring. Stop. |

Leave out the old runbook's step 10 ("show Privacy Policy, Terms, Support in
the app"). Those pages exist on the web but the app does not link to them, so
the shot cannot be taken. Apple gets those URLs from App Store Connect.

Upload it anywhere Apple can open without a login and put the URL in **App
Review Information → Notes**, alongside the review account.

## 8. Still open after this

1. Record the video (§7).
2. `payment_methods.method_type` accepts `bank` as free text. Zero rows today.
   If it is reachable in the app the privacy labels must declare financial
   data; removing the option is the smaller change.
3. Chase Deveen on the Supabase Nano→Micro upgrade (~£8–10/month), which is
   blocking a purchase decision.
