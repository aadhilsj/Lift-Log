# Handover — the 29–30 September session (Claude as reviewer)

Claude was the lead reviewer/instructor; Codex operated. Where this disagrees
with an older dated handover, this wins. Where it disagrees with
`docs/WHATS-LIVE.md`, **WHATS-LIVE.md wins** — it is kept current.

`main` finished the session at **`66943f0`**, with a Ready Production
deployment. Twelve commits landed.

---

## 0. Read this first — the one thing that was never reported

**The emoji sheet has the bottom-band bug, and nobody has been told.**

Claude was midway through reviewing `codex/emoji-reaction-sheet` when the usage
limit hit, and the review findings were never delivered. The branch then landed
on `main` and shipped. The finding still applies to what is live at `66943f0`:

`src/components/EmojiReactionPicker.jsx` renders its sheet as
`position:fixed; inset:0` with `alignItems:flex-end`. In an **installed iOS
PWA**, the bottom of the fixed viewport is roughly 47px short of the bottom of
the screen — that is the whole finding of §1 below. So:

1. **A band of page canvas will show below the emoji sheet.** The sheet is
   `#081110`; the canvas under it is `--bg-primary` `#070C0C`, or `#05090a`
   when the sheet is opened from the Stream. Different in every case. This is
   exactly the band that took five attempts to fix on the Stream.
2. **The sheet double-counts the safe area**, the same way the composer did
   before `06564c4`: it carries both
   `height: calc(400px + env(safe-area-inset-bottom))` and
   `padding-bottom: calc(12px + env(safe-area-inset-bottom))`, while the strip
   below the viewport already clears the home indicator.

Codex's own hand-back says: *"Not verified: an installed iOS PWA or
WKWebView."* That is the environment where both problems appear.

**Do not guess at a fix.** The method that worked is in §1 and in the playbook
entry. Neither problem will show in a desktop browser or the simulator.

Also unverified by Codex, in his words: comment and Stream reaction flows used
**browser response fixtures** because the sandbox returned empty or null
canonical records. Only the Activity-feed reaction path was exercised against a
real API. Backend persistence for the other two was not verified.

---

## 1. The PWA bottom band — solved, after four failed attempts

**The mechanism:** in an installed iOS PWA there is a strip below the fixed
viewport that **no element can reach**. Codex measured it on the founder's
physical iPhone through iPhone Mirroring: an element extended 80px past the
viewport was clipped entirely, and the canvas still showed. Only the document
canvas paints there. WebKit only; the packaged app has no such strip.

The four earlier attempts failed because they painted the canvas
`--bg-primary` (`#070C0C`) — the *page* colour — while the composer resolves to
`#05090a`. The band was never unpainted; it was the wrong shade.

**What shipped:**

| | |
| --- | --- |
| `ebb80be` | Canvas painted `#05090a` while the Stream, or a comment thread opened from it, is visible |
| `06564c4` | Composer safe-area inset dropped in the installed PWA — 109px of dead space under the field became 75px |

`#05090a` was verified against both surfaces independently: `rgba(5,9,10,.55)`
over a sheet ending `#05090a` in `BlocStream`, and `rgba(5,9,10,.96)` over
`#080F0F` in `LogCommentThread`, which computes to `rgb(5,9,10)`.

The founder confirmed both on his phone. The playbook entry is closed in
`f430900` with the mechanism, both commits, and four fix rules.

**Two things remain unexplained** and are worth knowing if this returns:

1. Why it only became visible after the 29 September merge. `body { background:
   var(--bg-gradient) }` is unchanged by that merge, and before it body's
   background propagated to the canvas — so the strip and its colour mismatch
   appear to *predate* the merge.
2. Why a comment thread opened from the **Activity feed** was always clean.
   Same composer colour, same uncovered strip. The founder confirmed on 30
   September that it has a clean bottom edge. It should band too. It does not.

---

## 2. Swipe and Bloc entry — five commits, all measured

The founder's complaints, in his order, and what each turned out to be.

**"Entering a Bloc takes half a second."** `058ff76`. The in-Bloc track was
rendering **all four** screens in one commit. The `near` flag that looks like it
gates them only sets `visibility`. Selection was already synchronous, so this
was pure render cost. The first paint now contains only the screen being
entered; the other three mount two frames later and are never unmounted.

**"I see the old screen for a moment."** `559df0a`, then `bc952e6`. The first
change was half right — the outgoing screen held 28% opacity for the whole
200ms settle. But setting the fade depth to 1 also made the **arriving** screen
start transparent, so the old screen showed *through* the new one. `bc952e6`
fixed the real problem: **only the screen being left fades; the arriving one is
solid**, which is also how native page transitions behave.

**"Still a slight flash."** `35daf06`. A frame-by-frame trace in a seeded
sandbox showed the opacity was by then correct — outgoing `0.97 → 0.00`,
arriving `1.00` throughout, no bad frame in Chromium. What the trace did expose
was every layer dropping `will-change: transform` in the same commit that swaps
`position`, **while still visible**. `will-change` is now driven by `near`, so a
layer is demoted only once it is already `visibility:hidden`.

**"There's a jump start on the screen I'm swiping into."** `c219023`. Two
causes, and the founder's wording named the second one exactly:

- The incoming layer was `visibility:hidden` until React re-rendered, and that
  render is triggered when the classifier locks — so it appeared a frame or two
  after the outgoing screen had begun moving. Visibility is now derived from
  the layer's own offset in the imperative path.
- The gesture's start slop was being treated as movement, so the screen jumped
  the whole accumulated distance at the lock. On a slow diagonal drag the
  dominance test can take 20–40px to satisfy. It now tracks from the lock
  point, subtracted in the release decision too so the thresholds keep their
  meaning.

Measured after: an 8px-per-frame input steps `-8, -16, -24 … -88`, perfectly
linear, incoming visible and opaque from the first movement frame.

**`SCREEN_SETTLE_MS` was deliberately never touched** — `TAB_LIFT_MS` derives
from it, so changing the settle would silently retune the 30ms nav lift the
founder approved.

### One commit is a hypothesis, not a reproduction

`35daf06` fixes a compositing repaint that **never reproduced in Chromium**. It
is the mechanism the frame trace points at on iOS, not one that was watched
failing. **If a flash ever returns on the phone, revert that commit first** — it
is self-contained.

### A test artifact that nearly shipped as a regression

Synthetic `TouchEvent`s dispatched from the console produced a release that got
**stuck mid-swipe** — the worst failure the swipe contract names. Re-testing
with **real touch in the iOS Simulator** showed both directions land cleanly.
The stuck state was an artifact of synthetic dispatch. Two lessons: `rAF` does
not run while the browser pane is hidden, which silently corrupts any
frame-based measurement; and gesture code must be verified with real touch
before it is believed.

---

## 3. TestFlight build 10

Branch `testflight-build-10` at **`77fe4d8`**, merged `main` (`f430900`) into
build 9's lineage (`7363442`). **All 22 conflicts resolved to main's side** —
every one was the same work arriving from two lineages, with main holding the
newer version.

That included the notification bell: `WHATS-LIVE.md` had flagged the dead mock
as *"the one thing that must not ship as-is"*. Build 10 carries main's wired
"coming soon" version instead. **That warning is now closed.**

Nothing native was lost — `capacitor.config.ts`, `ios/`, `server/push.js`,
`pushNotifications.js`, `apiOrigin.js` and `haptics.js` all verified present.

The build shipped and the founder tested it. **The six swipe/entry commits after
`77fe4d8` are website-only** and are not on the phone; that needs a merge and a
build 11.

**Drift is permanent, not one-off.** The fix is to merge `main` into the app
branch *before every build* and resolve shared UI to main's side.

---

## 4. The policy reversal — the native build is the product

Decided 30 September. TestFlight is what goes to the App Store; the PWA is
where members happen to be today. A web limitation is a reason to build the
feature **for native**, not to scope it down. The founder named push
notifications as the case.

This **reverses the intent** of the old "one codebase, no deliberate fork"
note — but **not the mechanism**. Still one codebase. Native-only behaviour is
a runtime `Capacitor.isNativePlatform()` gate, as `src/lib/haptics.js` already
does, never a branch or a duplicated component. Branch divergence is exactly
what re-broke swipe and reaction behaviour after merges.

`e514ed5` records this in `WHATS-LIVE.md`, with a **divergence register** —
haptics, push, the composer inset, the canvas paint — each with the mechanism
holding it apart. Add a row rather than re-deriving the policy.

---

## 5. The emoji picker

**The three surfaces had drifted apart** — two near-identically-named constants,
`QUICK_REACTIONS` (8 emoji, `appState.js`) and `QUICK_REACTS` (5, in
`BlocStream.jsx`). Different lengths, different contents. Nobody chose it.

**The five were chosen from production usage, not taste.** Counts read
read-only from production:

| | uses | people |
| --- | --- | --- |
| 🦍 | 582 (35%) | 20 |
| 🔥 | 427 (26%) | 22 |
| 💪 | 212 | 16 |
| 🏃 | 176 | 16 |
| 👀 | 99 | 13 |
| 😤 | 73 | 12 |
| 😂 | 41 | 13 |
| 👏 | 40 | 10 |

The gorilla is the most-used reaction in Fero — and the Stream did not offer it
at all. But ❤️ leads both the Stream (48) and comments (26) while not being in
the eight, so **each surface's winner is shaped by what it offers** and the
counts cannot be read straight. The shipped five are `🦍 🔥 ❤️ 💪 🏃`; 👀, 😤,
😂 and 👏 moved into the sheet.

**A premise was corrected before any code was written.** iOS exposes **no API
to open the system emoji picker to any app, native or web**. The keyboard only
appears for a focused text field and the person taps the globe key themselves.
So a custom sheet had to be built either way, and it works on both — going
native-only there would have bought nothing and cost a fork. That correction is
recorded in `WHATS-LIVE.md`.

**Checked before instructing:** `emoji` is plain `text` on all three reaction
tables, with no `CHECK` constraint, and the API does not validate against the
list. No migration was needed and none was written.

**What landed:** `4c4b6f2` plus four follow-ups (`47a63f5`, `5eb5be3`,
`baeb722`, `d577d78`) tuning search, height and skin tones. Adds one dependency,
`emojibase-data` v17 (MIT), lazy-loaded as a separate ~666 kB chunk; the initial
bundle moved 1,017.97 → 1,025.23 kB.

**Review status: incomplete.** See §0. Lint, build and 23/25 were re-verified
independently before the limit hit; the geometry findings were not delivered.

`66943f0` then removed `navResetToken` from `MonthPage`'s `key` to stop it
remounting during tab navigation.

---

## 6. Month close, re-run 30 September — green

All read-only against production.

| Check | Result |
| --- | --- |
| 7.1 Every Bloc's open month agrees | **18/18 on `2026-8`** |
| 7.2 Blob has, canonical missing — *deflating* | **0** |
| 7.3 Canonical has, blob missing | **0** |
| 7.4 Departed member still countable | **0** (7 have `left_at`) |
| 7.5 Deleted log still countable | **0** (10 ids) |

660 September logs on each side, matching exactly. **Per-member counts compared
across every Bloc: zero mismatches.** Per-Bloc member counts reproduce the 29
September list exactly.

Code path with the clock faked to `2026-10-01T12:00:00Z`: rollover moves
`2026-8 → 2026-9`, and **the guard fires** — canonical empty while the blob
counted 3 returns `ok:false`, reason `canonical logs empty for 2026-8 while
blob counted 3`.

**A correction worth keeping:** the guard test passed for the *wrong reason*
first — calling the rebuild before the rollover created a snapshot returns
`no closed snapshot for 2026-8`, which is a different branch. Roll over first,
then test the guard.

**Not repeated:** the full in-memory rollover over all 18 live Blocs. That route
needs the service-role key, which `.env.local` redacts to `[SENSITIVE]`. The
core assertion was verified in SQL instead. Not the same test.

---

## 7. RLS — Deveen, 2–3 October

`838b5a8` re-verified his gap on production and corrected one detail in
`docs/handover-2026-09-29-for-deveen-active.md`.

Still exactly **nine** `ante_core` tables with RLS off; `push_devices` is still
the ninth and still missing from his migration. Nothing new since 28 September.

**The correction:** the note said `anon` has no `USAGE` on `ante_core` and the
table grants nothing to either role. Both true — but **`authenticated` does
hold `USAGE`**. What keeps `push_devices` unreachable is the absence of table
grants *alone*, not the schema barrier. Still a gap rather than a live hole, but
thinner than the original wording implied.

`push_devices` is **empty**, and build 10 will not change that: it carries the
push foundation but archives with the same no-push override and no
`aps-environment`.

---

## 8. Things that are not true, and were believed

- **`test:auth-edge-flows` and `test:mobile-navigation` are broken, not
  un-runnable.** `AGENTS.md` says they "require an app on `127.0.0.1:3000`",
  which reads as *they would pass with one*. They do not. Verified 30 September
  against a seeded sandbox on 3000: both still fail as 30s Playwright timeouts,
  and fail identically on untouched `origin/main`. **23 of 25 is the honest
  number.** Never report them as passing, and never as merely not-run.
- **The shared folder's `main` was 47 commits behind** `origin/main` at session
  start — a stale checkout, cleanly fast-forwardable, not a divergence. Worth
  checking before believing anything read from it.
- **`rAF` does not run while the Browser pane is hidden.** Any frame-based
  measurement taken then is corrupt.

---

## 9. Still open

| | Owner |
| --- | --- |
| **Emoji sheet band + double safe-area inset in the installed PWA** | next session — §0 |
| Backend persistence for comment and Stream reactions | unverified; Codex used fixtures |
| Why the band only appeared after the 29 Sep merge | unexplained |
| Why Activity-feed comment threads never banded | unexplained |
| Six website commits not on the phone | merge + build 11 |
| iOS confirmation of the Android swipe fix | Aadhil |
| Android confirmation of it | an Android member |
| RLS to production, with `push_devices` added | Deveen, 2–3 Oct |
| `fero-staging` teardown | after that |
| Notification permission moment | Aadhil's alone; iOS asks once |

---

## 10. Housekeeping

- Worktrees created this session: `fero-composer-padding`, `fero-tf-build-10`,
  `fero-emoji-review`. Removable; delete the `node_modules` symlink first where
  one exists, so the shared folder is not harmed. `fero-emoji-review` has its
  own real `node_modules` because the branch adds a dependency.
- Both sandboxes started this session were stopped by PID. Ports 3000 and 54321
  were left clear.
- Codex's orphan sandbox from the previous session was found still running and
  deliberately **not** killed; it died on its own later.
- All production SQL this session was **read-only**. No writes, no migrations.
- Rollback tag for the big PWA merge: `pre-pwa-merge-2026-09-29` at `e9b7704`.
