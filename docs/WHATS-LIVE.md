# What's live, right now

**This file is the answer to "what's on the website vs what's on my phone".**
Update it whenever something ships. Same filename forever — never date it, never
fork it. If it disagrees with a handover, this file wins.

Last updated: **29 September 2026, night** — after the big merge. Everything is
now on the website.

---

## The three places

| | Website (PWA) | TestFlight (phone) | Claude's branch |
| --- | --- | --- | --- |
| **What it is** | `lift-log-nu.vercel.app` | build 9 | `ios-header-and-nav-polish` |
| **At commit** | **`80629b5`** | `dfc5b4e` | `80629b5` |
| Rebuilt header, 42pt buttons | ✅ | ✅ | ✅ |
| Safe-area + notch handling | ✅ | ✅ | ✅ |
| One settle for every screen change | ✅ | ✅ | ✅ |
| Nav pill moves with the gesture | ✅ | ✅ | ✅ |
| Tab cross-fade | ✅ | ✅ | ✅ |
| Scroll clears the bottom bar | ✅ | ✅ | ✅ |
| Haptics (silent on web by design) | ✅ | ✅ | ✅ |
| Faster nav lift (100ms) | ✅ | ❌ | ✅ |
| Comment load failure is honest | ✅ | ❌ | ✅ |
| Reaction picker stays on screen | ✅ | ❌ | ✅ |
| Bell opens "coming soon" | ✅ | ❌ (dead mock) | ✅ |

**The website and the branch are now the same commit.** Only the phone is
behind, and that is one TestFlight build away.

### Verified live, 29 September (not taken on trust)

- `80629b5` is on `origin/main`
- Vercel has a **Ready Production deployment for that exact commit**
- the live JS bundle contains `Notifications are coming soon`, the new lift
  easing `cubic-bezier(.2,.9,.3,1)`, and `Comments couldn't load`
- the live CSS bundle contains the new header rule
  `max(0px, calc(env(safe-area-inset-top) - 13px))`
- the reaction-picker fix is confirmed **in the source on `main`** rather than in
  the bundle — its identifiers are local variables and get minified away, so a
  bundle grep proves nothing either way

## Why the website looks old

All of this month's app work went to the app branch and was never merged back.
`main` is the website; Codex builds the phone app from his own branch. Nobody
did anything wrong — the work simply never travelled back. One merge fixes it
permanently.

---

## Two platform questions, settled

### Haptics on the website — nothing to do

`src/lib/haptics.js` returns immediately unless
`Capacitor.isNativePlatform()`. On the web every buzz is already a silent no-op,
by design. There is nothing to strip out before shipping to the PWA.

### The top area on the website — nothing to fear

`index.html` already sets `viewport-fit=cover`,
`apple-mobile-web-app-capable: yes` and
`apple-mobile-web-app-status-bar-style: black-translucent`. **Added to the home
screen, the PWA gets the same top space as the native app.** In a Safari tab it
does not, because Safari's own chrome is there.

The header padding handles both without a branch:

| | `main` today | Claude's branch |
| --- | --- | --- |
| rule | `padding-top: env(safe-area-inset-top)` | `padding-top: max(0px, calc(env(safe-area-inset-top) - 13px))` |
| Safari tab (inset 0) | `0` | `max(0, -13)` = **`0`** |
| Installed / native (inset ~47-59) | 47-59 | 34-46 |

**Identical in a Safari tab.** The 13px pull-up only claims space that exists.

### So: one codebase, no deliberate fork

Do not maintain a PWA-only and an app-only version. Every divergence doubles the
testing and the memory, and this repo's playbook is already full of things fixed
and re-broken across merges. The platform differences above are handled in code
already.

---

## The one thing that must not ship as-is

**The bell button is a mock with no tap handler**, carrying `aria-hidden="true"`
and `tabIndex:-1` (`src/pages/Nav.jsx`, see
`docs/concept-2026-09-24-notification-centre.md`). It is not on `main`, so today
only Aadhil sees it, on TestFlight.

Merging as-is puts a dead button in front of every member. It needs a
"coming soon" destination, or to be held back, **before** the merge lands.

---

## TestFlight vs the App Store

**A TestFlight install and an App Store install are separate downloads.** When
Fero reaches the App Store, testers must go and get it from there; their data
carries over (same app underneath), but it is a second trip. TestFlight builds
also expire after 90 days.

**Decision (29 Sep): do not move members onto TestFlight.** They stay on the
PWA, which works and which they already use, and they move once, to the App
Store. TestFlight stays for Aadhil and a small number of testers.

Revisit only if App Store review drags. First submissions are often rejected and
review can take days to weeks.

---

## How to check this yourself

```bash
# what the website is running
git fetch && git log --oneline -1 origin/main
curl -s https://lift-log-nu.vercel.app | grep -oE '/assets/index-[A-Za-z0-9_-]+\.js'

# is a given commit on the website?
git merge-base --is-ancestor <sha> origin/main && echo yes || echo no
```

Merged is not live: a commit on `main` still needs a Ready Vercel **Production**
deployment for that exact commit, and the change visible in the live bundle.
Check all three before believing it.
