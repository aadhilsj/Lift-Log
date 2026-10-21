# Handover — 15 October 2026: the page that sat off to one side

**Status: CLOSED.** Claude, operating. One bug, found during the profile header
session, diagnosed and fixed here.

Previous session: `handover-2026-10-13-session-catch-up.md` (13–15 October,
closed), which found this and deliberately left it alone as out of scope.

---

## What it was

Tapping a member's slice on the Month ring left the whole page about **149px to
the left**, stuck. Swiping did not recover it; changing tabs did. It was
reported as a blank Month page, because the page was pushed far enough off that
only background was left.

**It was never a stuck swipe**, which is what the symptom suggested and what
the previous session's note assumed.

## The cause, measured

`activePageLayer` in `src/App.jsx` lays all four in-Bloc pages side by side so
adjacent pages can be visible mid-drag. That makes the track **four viewports
wide with `overflow: hidden`** — and a hidden overflow is **still
programmatically scrollable**.

Focusing anything inside it — which an ordinary mouse click on a `<button>`
does — lets the browser scroll the track sideways to reveal what was focused.

| Measured at 393x852 | |
| --- | --- |
| Track `scrollWidth` / `clientWidth` | **786 / 393** |
| `scrollLeft` after tapping a slice | **149.5** |
| Page `getBoundingClientRect().x` | **-149** |
| Page's own `scrollWidth` vs `clientWidth` | 393 = 393 — the page itself does not overflow |
| `document.activeElement` | the tapped slice button |

The swipe machinery moves pages with **transforms** and never reads
`scrollLeft`, so nothing ever put it back.

## The fix — `ebf9de5`

The track resets `scrollLeft` and `scrollTop` to 0 whenever anything scrolls
it. One handler, nineteen lines with the comment, in `src/App.jsx` and nothing
else.

**Not `overflow: clip`**, which creates no scroll container at all and would be
the tidier fix: it needs Safari 16, and dropping the clipping for anyone older
is a worse failure than the bug. Noted in the playbook for when the floor
moves.

**Vertical scrolling is untouched.** It lives on the inner page element
(`overflowY: auto`), not on the track.

## How it was verified

In the sandbox at 393x852, **with the fix in and with it stashed back out**,
same build, same screen:

| Trigger | Without the fix | With it |
| --- | --- | --- |
| `scrollLeft = 200` | page sits at **-200** | back to 0 |
| `scrollIntoView` inside the track | scrolls | back to 0 |
| `focus()` inside the track | scrolls | back to 0 |

Tapping a slice still opens that member's month, with the page at x0, and
`focusin` still fires on the slice button — the tap itself is unchanged.

Lint and build clean. **24 of 26 suites pass**; the two failures are
`test:auth-edge-flows` and `test:mobile-navigation`, which fail on `main` too.

**Live and verified three ways:** the commit is on `main`; the Vercel
Production deployment for `ebf9de5` reports success; the live bundle
`index-DIhYQ_rD.js` contains the guard. CI green, and the live site loads with
no console errors.

## Two things worth keeping

1. **This was never only the Month ring.** Any focusable element near the edge
   of any of the four in-Bloc pages could move the whole track. Fixing it on
   the ring would have left the rest.
2. **A displaced page looks exactly like a blank one**, and leaves no console
   error. Reading `getBoundingClientRect().x` on
   `[data-page-scroll-container]` and then walking its ancestors for
   `scrollLeft` and `transform` separates a scrolled container from a stuck
   transform in one step. Both are now in the playbook.

**A correction worth recording:** mid-session I reported that the fix had
stopped the slice responding. It had not — the track had moved the button out
from under a cached click coordinate, so the clicks were landing on the ring's
SVG circle. An event log of `pointerdown` / `focusin` / `click` with their
targets showed it immediately.

## Commits

| Commit | What | Live |
| --- | --- | --- |
| `ebf9de5` | The in-Bloc page track can no longer be scrolled sideways | **Live**, verified |
| `60d4b3d` | The playbook entry and the solved-issues entry | Docs only |
| *(this one)* | This handover, and what's live at `ebf9de5` | Docs only |

## State at close

Sandbox stopped by PID, scratch worktrees removed, browser viewport reset.
Website only — TestFlight is still build 10.
