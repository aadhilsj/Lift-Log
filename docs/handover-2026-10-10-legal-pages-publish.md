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

Filled in as the session runs.

## Commits

| Commit | What |
| --- | --- |
| (this one) | Open the handover before the first change |
