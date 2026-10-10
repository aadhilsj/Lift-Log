# Handover — 10 October 2026: publish the Privacy and Support pages

**Status: open.** Publishing the two legal pages from `aa57985`, with four
corrections the founder approved after an independent review of Codex's
9 October attempt.

## Why this session exists

Codex attempted this on 9 October and stopped before publishing, because the
Privacy Policy claims Fero collects "blocks" and no blocking feature exists.
That finding was correct. Its handover was committed only to a local branch
(`codex/legal-pages-publish-2026-10-09`) and never pushed, so `origin` holds no
record of it. See `docs/handover-2026-10-09-legal-pages-publish.md` on that
local branch if this laptop still has it.

An independent review on 10 October confirmed the blocking mismatch and found
three more problems Codex did not report. The founder approved fixing all four
and publishing.

## Starting point

- `origin/main` and live production are both at `9c404e8`.
- Worktree `/Users/opera_user/Developer/FERO/legal-pages-publish-2026-10-10`
  on `claude/legal-pages-publish-2026-10-10`, branched from `origin/main`.
  Outside `~/Documents`, so iCloud does not sync it.
- `node_modules` is a symlink to the shared checkout. No `.env.local` was
  copied — a static page build does not need one.
- The pages come from `aa57985` only. The rest of
  `codex/legal-pages-publish` is already on `main`.
- `public/legal.css` comes from `origin/codex/app-store-readiness`, the only
  branch that ever had it.

## The four approved corrections

1. **Delete-account directions were wrong.** The Support page said
   "Settings -> Account -> Delete account". No such path exists: the nav's
   settings icon opens Bloc settings (`src/pages/Nav.jsx:141`), which has no
   account deletion. The real path is Profile tab -> tap your name -> the
   "Account" pop-up -> "Delete account"
   (`src/pages/ProfilePage.jsx:347` -> `src/App.jsx:2452` ->
   `src/components/authShell.jsx:243`).
2. **Blocking does not exist.** Both pages promised it. There is no
   `blockMember` on `main`, nor in TestFlight builds 10 or 11. It is built on
   the unmerged `codex/app-store-readiness` branch
   (`src/pages/PlayerProfile.jsx:337`), which is why the wording was written.
   The mentions are removed rather than the feature merged; merging that
   branch is a separate, much larger job.
3. **Reporting is narrower than described.** On `main` you can report an
   expanded workout photo only (`src/modals/modals.jsx` `ImageLightbox`,
   `src/pages/ActivityFeed.jsx:488`). There is no comment or member
   reporting, so "member-safety concerns" overstated it.
4. **The type did not match Fero.** `legal.css` asked for Inter, which the app
   never loads and a phone does not have, so the pages fell back to the system
   font. Changed to Outfit from Google Fonts, exactly as `index.html` loads it
   for the app.

Nothing else in the legal wording was changed. Colours and layout are
untouched.

## Verified before publishing

Everything below was checked on a local build of this branch, before any push.

- `npm run lint` clean. `npm run build` clean.
- Vite's default `public/` handling puts the files at the site root with no
  config change: `dist/privacy/index.html`, `dist/support/index.html` and
  `dist/legal.css`. No `publicDir` override exists in `vite.config.js`.
- **No Vercel rewrites were added, and none are needed.** `vercel.json` has no
  rewrites at all, so the single-page app cannot swallow these URLs. Confirmed
  against live: `https://lift-log-nu.vercel.app/some-random-path` returns a
  plain Vercel 404, not the app shell, and `/manifest.webmanifest`, `/sw.js`
  and `/icon-192.png` already serve from `public/` at the root today.
- Served the build locally: `/privacy`, `/privacy/`, `/support`, `/support/`
  and `/legal.css` all 200. The no-slash form on Vercel specifically cannot be
  proven until this is deployed.
- Rendered at **393x852** and **1440x900**. Stylesheet loads on both pages,
  Outfit resolves (`document.fonts.check('700 16px Outfit')` true),
  `scrollWidth` equals `clientWidth` at phone width so there is no sideways
  scroll, and the column is 760px centred on desktop. Screenshots were taken.
- The word "block" no longer appears in either page's rendered text.
- **23 of 25 `test:*` scripts pass.** `test:auth-edge-flows` and
  `test:mobile-navigation` fail on a Playwright `networkidle` timeout. These
  were confirmed pre-existing: with all three new files removed and a pristine
  `origin/main` rebuilt, `test:mobile-navigation` fails identically. Nothing in
  this change is reachable from the app bundle - these are static files the app
  never imports.

### Deliberately not done

- The effective date is left at 27 September 2026. The corrections describe the
  service more accurately; they do not change what Fero collects or does, so
  the page's own "materially change" trigger is arguably not met. Say the word
  and it moves to today.
- `docs/app-store-submission-runbook.md` and `docs/WHATS-LIVE.md` are not
  updated yet; `WHATS-LIVE.md` is updated when this actually goes live.
- Blocking was not built. That is a separate job on
  `codex/app-store-readiness`.

### Still unverified - needs the founder

**Whether `support@joinfero.app` is a real, monitored mailbox.** No test email
was sent. The domain's MX records are Cloudflare Email Routing
(`route1/2/3.mx.cloudflare.net`) with a matching SPF record, so mail is routed
somewhere. In the Gmail account connected to the review session the only trace
of that address is one message *sent* to it on 27 September and nothing
received, which is inconclusive - the forward may target a different mailbox.
Both pages name this address as the only way to reach support, so it needs
confirming.

## Commits

| Commit | What |
| --- | --- |
| `53a4afb` | Open the handover before the first change |
| `804c07c` | The two pages and the stylesheet, with the four corrections |
| (this one) | Record how it was verified |
