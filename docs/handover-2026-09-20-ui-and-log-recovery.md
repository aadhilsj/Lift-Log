# Handover — 2026-09-20: allowance activation, workout UI, and log recovery

## Current state

All items below were pushed directly to `main` at the founder's request and are
live. The last relevant commit is `67fe271`. The active worktree is
`/Users/aadhilsj/Documents/FERO/fero-activate-yearly-allowance` on
`fix/activate-yearly-allowance-now`; it is clean apart from an untracked
`node_modules` symlink. Do not stage that symlink.

Every code change in this handover passed `npm run lint` and `npm run build`.

## Product decisions now in effect

- **Yearly allowance starts immediately:** in 2026, each member has two
  sit-outs and three Solo months per calendar year, per Bloc. Earlier approved
  2026 months count. The rolling-three-month rule is retired.
- **Timing:** Solo and sit-out are instant through the 10th; later requests
  need approval. This is enforced and described consistently in the app.
- **Allowance UI:** the profile allowance card is below Workout Breakdown; both
  allowance types use cyan (no orange); the year is displayed as `2026:`.
- **Rules screen:** Save Rules is muted until an actual rule edit is made.
- **Leave Bloc:** visually separated lower on the settings screen.

Core commits: `b101f0e`, `a2aabf5`, `e33e94f`.

## Activity image viewer

Commits: `858de21`, `8dd953b`, `a7149fb`, `7727620`, `1e3b6e4`.

- Tapping the left or right third **of the image itself** changes photos;
  tapping the image centre does nothing.
- Tapping outside the image closes the viewer, like the X.
- Swipe navigation remains available, but it no longer leaks through to the
  page navigation behind the lightbox.
- Pinch zoom follows the pinch focal point. Releasing a pinch smoothly returns
  the image to its normal size; zoom is intentionally not persistent.

Primary implementation is `src/pages/ActivityFeed.jsx` (with the image
lightbox exported from `src/modals/modals.jsx`). If gestures regress, preserve
the modal's touch containment before adjusting page-level swipe logic.

## Comments

Commit: `559bece` (on top of `2e387c1`).

- A log caption is shown as plain context at the top of its comment thread, not
  as a comment-shaped card.
- Comment content bottom-aligns above the composer when short, so the latest
  message is at the bottom like a normal chat. Existing and new threads use the
  same layout.
- Code: `src/components/LogCommentThread.jsx`.

## Profile-calendar workout interactions

Commits: `1d16044`, `30a64c7`, `08ce149`, `67fe271`.

### Own profile

- A single workout opens the delete confirmation; a two-workout day first
  asks which workout to delete.
- The final scope step is intentionally separate: it asks **“Delete from your
  other Blocs too?”**, then says only **“This workout also appears in X other
  Blocs.”** It has compact, clearly active choices: **Delete only from this
  Bloc** and **Delete from every Bloc**. The local-only button must never look
  disabled.

### Another member's profile

- Any calendar workout is now tappable, including historical months.
- One workout opens a read-only, centred `ModalScrim` (blurred background) with
  activity, date, and caption. It exposes no destructive controls.
- A double-workout day first presents a read-only picker, then that detail
  modal.
- The caption is deliberately plain muted text, not a card or button-like
  surface. This was the final visual adjustment.

All of this lives in `src/pages/PlayerProfile.jsx`. The controlling distinction
is `canDelete` (own current-month log with `onDeleteLog`) versus `canInspect`
(any available log). Do not merge those paths: other members must stay
read-only.

## Production data repair performed today

The founder accidentally deleted their own 19 September 2026 Gym log while
testing the delete flow. It was restored in the live Supabase project after
locating the exact pre-delete backup.

| Field | Restored value |
|---|---|
| Bloc | Ctrl Alt De-feat (`ctrl-alt-de-feat-ocdti8`) |
| Member | Aadhil |
| Date/activity | 2026-09-19 / Gym |
| Caption | `it’s getting cold 🍁` |
| Log ID | `1789851697610445-ctrl-alt-de-feat-ocdti8` |
| Source | `public.lift_log_backups`, state revision 2492 |

The repair first saved a fresh blob backup, then:

1. restored the canonical `ante_core.workout_logs` row using
   `public.upsert_ante_core_workout_log(...)`;
2. restored the log in the legacy blob path
   `groups.ctrl-alt-de-feat-ocdti8.logs.Aadhil`;
3. removed that log ID from `deletedCurrentLogIds`.

This dual write matters: restoring only the canonical row leaves the blob's
tombstone able to hide it. Verification returned `true` for canonical restore,
blob restore, deletion-marker removal, and retained the original photo URL.
If this log later looks missing, inspect those two stores and the tombstone
before attempting another restore. Do not create a new replacement log.

## Useful recent commit map

| Commit | Purpose |
|---|---|
| `67fe271` | Plain, muted caption in read-only profile workout detail |
| `08ce149` | Read-only profile calendar detail and tighter delete copy |
| `30a64c7` | Larger, clearer Bloc-specific deletion step |
| `559bece` | Latest comment at chat bottom |
| `1d16044` | Two-step workout deletion flow |
| `e33e94f` | Allowance card hierarchy and cyan sit-out styling |
| `a2aabf5` | Sit-out deadline and Rules/Leave Bloc UI |
| `b101f0e` | Immediate yearly allowance activation |

## Follow-up guardrails

- Keep the two-workout-per-day cap unchanged.
- Before any production data mutation, make a fresh backup and update both
  canonical and blob data where the feature still reads both.
- For future profile-calendar work, verify all four paths: own/single,
  own/double, other/single, other/double.
- No outstanding implementation work was left from this session.
