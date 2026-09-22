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

---

## 2026-09-13 — Deleted workouts kept counting against the daily limit

Symptom:
- A member could not log a workout: it appeared, then vanished. The API returned 409 "Already logged 2 workouts for this date" although the app showed fewer.

Scope:
- Any member who deleted a workout since 2026-07-19. Known affected: Aadhil (found by audit) and Kasper (reported). Neither has a phantom left.

Cause:
- `delete-log` was in the production `BLOB_MIRROR_SKIP_ACTIONS`, so a delete never reached the blob. The two-per-day cap and month close both read the blob.
- Busy Blocs hid it: the next member's write to the same Bloc cleared the phantom.

Resolution:
1. Removed `delete-log` from the production `BLOB_MIRROR_SKIP_ACTIONS` in Vercel (Deveen approved).
2. Redeployed and read the value back through the admin `blob-mirror-dependency-report`.
3. Re-ran the phantom audit query (handover 2026-09-09 §2): zero rows.

Notes:
- The founder's own phantom was removed by hand on 2026-09-08 (blob rev 2302 to 2303).
- Detail: `docs/handover-2026-09-09-signin-fixes-and-delete-log-blob-divergence.md`, playbook "A Skipped Blob Write With A Blob Reader Left Behind".

---

## 2026-09-13 — A failed workout log said nothing

Symptom:
- A workout logged to several Blocs appeared, then disappeared, with no message. This hid the entry above for a day.

Scope:
- Multi-Bloc logs only. Single-Bloc logs already showed a message, but blamed the connection even when the daily limit was the reason.

Cause:
- `handleMultiLog` rolled back its optimistic row without telling the member.

Resolution:
- Commit `19e3d8b`. Both log paths now alert, and name the daily limit when that is the reason.

Notes:
- Failed deletes were fixed separately on 2026-09-14 (entry below).

---

## 2026-09-13 — The same workout saved twice

Symptom:
- Two identical workouts, seconds apart, with the same photo.

Scope:
- Seen twice: Kasper (2026-09-09), Varun (2026-09-13). Neither has a duplicate left.

Cause:
- The same save request reached the server twice. Most likely the phone's network layer: nothing in the app resends. Unconfirmed.

Resolution:
- Commit `19e3d8b`. The server now ignores a repeat of the same member, date and photo, and answers it as a success.

Notes:
- Varun deleted the copy without reactions and kept the one with 3. Nothing was lost.
- Playbook: "The Same Workout Saved Twice".

---

## 2026-09-14 — Deleting a multi-Bloc workout left copies behind

Symptom:
- Deleting a workout that had been logged to several Blocs removed it from one Bloc only.

Scope:
- Every multi-Bloc log. Founder request.

Cause:
- By design: `delete-log` acts on one Bloc.

Resolution:
- Commit `6e9da32`. The delete confirmation offers "Also delete from …", ticked by default, and removes each copy with an ordinary `delete-log`.

Notes:
- Fixed alongside: an optimistic-update trap that would have shown one Bloc's logs under another's id. Playbook: "Optimistic Updates Must Target The Bloc On Screen".

---

## 2026-09-14 — A failed workout delete said nothing

Symptom:
- Tapping Delete on a workout could do nothing visible: it disappeared for a moment, then came back, with no message.

Scope:
- Every workout delete. No reports; found while closing out the silent log failure above.

Cause:
- `handleLogMutation` rolls back its optimistic removal on failure without telling the member, and the delete caller did not check the result.

Resolution:
- Commit `e69fb24`. `deleteOwnLog` alerts "Workout couldn't be deleted. Please check your connection and try again." and does not go on to other Blocs' copies.

Notes:
- `handleLogMutation` still does not alert for other actions (flags, flag responses). Any new caller needs to check `result.ok`.

---

## 2026-09-17 — The Members tab showed only "Leave Bloc"

Symptom:
- In Bloc Settings, the Members tab showed the Leave Bloc button and nothing else: no member list, no Remove buttons, no pending sit-out or Solo requests.

Scope:
- Every Bloc Admin, live from 29 August to 17 September. One request was missed because of it (Rahul, Sarandawgs, sit-out, 16 September); every other request since 28 August was checked in production.

Cause:
- `a0ca12c`, which moved Leave Bloc into settings, wrote `renderMembers` as `( membersBlock, renderLeaveBloc() )`. That is a JavaScript comma expression, which returns only its last item, so everything but Leave Bloc was thrown away. Lint and build both passed.

Resolution:
- Commit `81441e1`.

Notes:
- A sweep with ESLint's `no-sequences` rule found no other instance in `src` or `api`. The project's lint config does not enable that rule; turning it on would catch this automatically if it ever recurs.

