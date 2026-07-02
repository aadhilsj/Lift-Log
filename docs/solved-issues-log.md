# Solved Issues Log

This is the canonical troubleshooting log for this workspace.

Purpose:
- record real production or device issues that were investigated and resolved
- capture the actual root cause or most likely cause
- record the recovery steps that worked
- give future agents one predictable place to look for prior incident handling

Agent instructions:
- when investigating a recurring bug, outage, or odd device-specific behavior, check this file first
- when a problem is resolved with enough confidence to be useful later, append a new dated entry here
- prefer short, factual notes over long narratives
- include exact recovery steps when they matter
- if the cause is uncertain, say so explicitly rather than overstating confidence

Suggested entry format:
- Date
- Symptom
- Scope
- Cause
- Resolution
- Notes

---

## 2026-06-23 — iPhone PWA blank screen / broken Add to Home Screen preview

Symptom:
- Installed iPhone home-screen PWA opened to a blank/dark screen.
- Desktop PWA worked.
- Desktop browser worked.
- iPhone Safari browser worked.
- After uninstalling the PWA, Safari's `Add to Home Screen` sheet was initially blank for this site on the affected phone.

Scope:
- Appeared to be device-local, not a broad production outage.
- Other users were still actively opening the app and logging workouts during the same period.

Cause:
- Most likely corrupted local Safari / iPhone home-screen app state for this site.
- Not consistent with a general production metadata failure.
- Not consistent with an app-wide backend outage.

What was verified:
- Production was serving the updated service worker (`ante-v50`).
- iPhone Safari showed a valid live page and successful network activity.
- The affected phone had the current service worker registered:
  - scope: `https://lift-log-nu.vercel.app/`
  - active script: `https://lift-log-nu.vercel.app/sw.js`
- The affected phone only showed the current cache:
  - `ante-v50`

Resolution:
1. On the affected iPhone, open `Settings -> Safari`.
2. Tap `Clear History and Website Data`.
3. Reopen Safari.
4. Reload `https://lift-log-nu.vercel.app`.
5. Sign in again if needed.
6. Use `Share -> Add to Home Screen` again.

Result:
- The Add to Home Screen preview returned to normal.
- Reinstalled PWA launched normally afterward.

Notes:
- This incident did not justify further speculative production fixes on its own.
- A small service-worker hardening patch was still shipped:
  - `sw.js` cache version bumped to `ante-v50`
  - cross-origin shell assets are now actually served from cache
  - Supabase CDN script was added to the app shell
- If this happens again for another user, first determine whether it is:
  - device-local only
  - or reproducible across multiple iPhones
- If reproducible across multiple devices, reopen investigation as a product bug rather than assuming local corruption.
