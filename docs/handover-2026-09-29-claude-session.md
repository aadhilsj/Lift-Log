# Handover — Claude's session, 29 September 2026

Codex wrote his own handover for the same session; the two are meant to be read
together. This is the Claude side.

Running detail is in `docs/handover-2026-09-29-reactions-comments-and-pwa-parity.md`
(§1–20). Five new playbook entries were added from this session. The live state
of the website versus the phone is in **`docs/WHATS-LIVE.md`**, which is the file
to trust over any dated handover.

---

## 1. Read this first if you are picking up the open bug

**The bottom band on the PWA is not fixed.** It is the one thing left broken, the
founder is out of patience with it, and four attempts failed. The playbook entry
**"A Band At The Bottom Of A Full-Screen Sheet, PWA Only"** lists every attempt
and six eliminated causes. Read it before touching anything.

The single most important line in it: **the band's colour is always whatever the
page canvas is painted, so it is a region nothing covers. Stop painting it.**

---

## 2. What shipped and is live

`main` went from `e9b7704` to `f463267` over the session. Every deploy was
verified three ways — commit on `main`, a Ready Vercel Production deployment for
that exact commit, and the change present in the live bundle.

| | |
| --- | --- |
| `80629b5` | **A month of iPhone app work merged to the website.** Rebuilt header, safe-area handling, one settle for every screen change, the nav pill moving with the gesture, tab cross-fade, scroll clearance, haptics. `main` had never received any of it |
| `e9b7704` | A failed comment load says so and offers a retry instead of an endless skeleton |
| `bdfb9ad` | The Activity reaction picker stays inside the screen |
| `32256fb` | A "coming soon" destination for the notifications bell |
| `80629b5` | The bell wired to it; its `aria-hidden`/`tabIndex:-1` removed |
| `534fd11` | Nav lift 100ms → then 30ms |
| `76770cc` | The tab's colour changes at finger release, not at commit |
| `b43d70f` | **Android can scroll the Today screen again** |

Aadhil confirmed the feel on his PWA: *"so much nicer... the swiping moves so
much quicker."*

**The phone is now several deploys behind the website.** One TestFlight build
closes it. That was deliberately deferred.

---

## 3. Two bugs worth understanding, not just knowing

### Reactions "deleted" and comments never loading were one outage

A Supabase outage, 16:31–16:45 UTC: every endpoint returned 504 or 500, 346 and
56 in that hour, every other hour clean. **The writes succeeded and the reads
failed** — the four reactions written at 16:30–16:34 are all in the database.
Nothing was ever lost.

Codex was sent looking for a server bug and correctly stopped when he could not
find one. The evidence was in the Supabase edge logs, not the code. Third time
this family has appeared; it is now a playbook entry.

### Android could not scroll Today because two handlers disagreed

`movePageSwipe` and `moveBlocSwitchSwipe` used identical thresholds and opposite
precedence — one called an ambiguous drag a scroll, the other a navigation.
Today is the only screen with both. iOS is shielded because the 72px trigger
strip overlaps the system back-swipe zone; Android is not. The handler landed
16 July, which is when the complaints started.

**Fixed and live, but tested by nobody.** No Android device is available to
either agent. Two confirmations are still owed: Aadhil on iOS (does the
left-edge back-swipe still work?), and an Android member (does Today scroll?).

---

## 4. Month close, 1 October — checked and green

Both the data and the code path.

- All 18 Blocs agree on the open month across both stores.
- Every September workout matches between blob and canonical, **both
  directions**, zero discrepancies.
- No departed member is still countable; no deleted log is.
- **A dry run against real production data with the clock faked to
  2026-10-01T12:00:00Z: 18 of 18 Blocs rolled, 0 rebuild failures, and every
  frozen count identical to the canonical rebuild.**
- The safety guard was tested directly: with canonical empty and the blob
  counting 3, the close **refuses** rather than freezing zeros.

Re-run §7 and §8 of the running handover on 30 September — workouts arrive until
the last minute.

**Method note:** the sandbox cannot be used for this (it answers every canonical
RPC with `[]`, which makes a healthy close look catastrophic), and port 54321
was already held by the other agent. The route that works is in §8 of that doc.

---

## 5. RLS — and one gap nobody had caught

Deveen's migration is written and rehearsed on staging; **it is not applied to
production**, scheduled 2–3 October after the close. Verified independently: nine
`ante_core` tables still have RLS off and the projection tables still carry the
full `anon`/`authenticated` grants.

**`ante_core.push_devices` is missing from the migration.** It was created
28 September, two days after the migration was written and eight days after the
inventory that produced its list. The migration names eight tables; production
has nine without RLS. Applying as-is leaves push tokens uncovered **and makes
the migration's own verification query report a failure on the day.**

A fresh active handover for Deveen is at
`docs/handover-2026-09-29-for-deveen-active.md`. It leads with that, hands the
staging click-through back to Aadhil, records three items of his that are now
done, and gives him the outage as a scaling data point.

`fero-staging` is still running at ~$9.68/month. Do not delete it until the
migration is on production; delete it immediately after.

---

## 6. Mistakes made in this session, so they are not repeated

**I reported "all 24 tests pass" when two were failing.** The recipe in the
previous handover greps output for `FAIL`/`✗`; the two Playwright scripts die
with a Node stack trace containing neither, so they counted as passes. The
correct recipe is in the playbook. An older handover had been right about this
and the 29 September one wrongly "corrected" it.

**I gave Codex a confident diagnosis that was wrong.** I concluded reactions were
vanishing because two Blocs had duplicate open seasons. They do not: the code
defines "open" by `status`, not by `closed_at`, and no Bloc has more than one.
The founder had already sent the instruction before it was withdrawn, and the
resulting no-op commit is on production. It is harmless and deliberately left.

**I shipped four fixes for the bottom band without reproducing it once.** Each
was reasoned from source. The one that finally produced real information was
reading `getComputedStyle` on the live page. The founder asked me to diff build 9
against main two rounds before I did it. **Do the comparison the founder asks for
first.**

**Both agents pushed to `main` in the same evening**, which diverged the branch
twice. Route pushes through one agent.

---

## 7. Decisions the founder made

- **One codebase for the PWA and the app. No deliberate fork.** Haptics are
  already a silent no-op on web (`Capacitor.isNativePlatform()` guards every
  buzz), and the header resolves to identical padding in a Safari tab, so the two
  platform worries that motivated a fork do not exist.
- **Members stay on the PWA and move once, to the App Store.** Not onto
  TestFlight. A TestFlight install and an App Store install are separate
  downloads, and TestFlight builds expire after 90 days.
- **Notification permission timing is still undecided** and is his alone. iOS
  only asks once.
- **Codex operates, Claude reviews** — set for the week ending Sunday 4 October,
  to conserve Claude's usage.

---

## 8. Still open

| | Owner |
| --- | --- |
| **The PWA bottom band** | next session — see the playbook entry |
| TestFlight build 10 | Codex |
| The emoji picker (top 5 + more, three surfaces) | next session; a feature, not a fix |
| iOS confirmation of the Android swipe fix | Aadhil |
| Android confirmation of it | an Android member |
| Staging click-through before 2 Oct | Aadhil |
| RLS to production, with `push_devices` added | Deveen, 2–3 Oct |
| `fero-staging` teardown | after that |
| Re-run the month-close checks | 30 Sep |
| Bloc entry speed | parked — there is no entry animation to shorten; it is mount cost, and it touches the swipe track |

---

## 9. Housekeeping

- Branch `ios-header-and-nav-polish` and `main` are the same content.
- Rollback tag for the big merge: `pre-pwa-merge-2026-09-29` at `e9b7704`.
- The iOS simulator (iPhone 17, `547363ED-CC0B-41AF-8F9A-A475279B5FDF`) is
  running build 9 — useful as the known-good reference for anything visual.
- Scratch files from the month-close dry run were removed.
