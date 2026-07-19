# Reaction Mutation Race Runbook

Date: 2026-07-19

This documents the reaction lag/race bug fixed on `codex/reconcile-chat-with-backend` after merging `feature/chat` with the canonical backend branch. Keep this as the blueprint if workout-log reactions ever regress again.

## User-visible symptoms

- Reacting to several workout logs quickly looked unstable.
- Existing reactions on another workout could disappear while reacting to a different workout.
- Unreacting from a count of `1` could briefly render a `0` reaction chip instead of removing the chip.
- Navigating Today -> Activity, or refreshing the browser, could make previously deleted reactions reappear.
- Refresh eventually showed that canonical backend state was correct for adds sometimes, but deletes/unreacts could persist only one at a time or flip back.
- Equal-count reaction chips could reorder after refresh, making newer reactions appear before older visible reactions.

## Root causes

There were multiple layers, but the final important one was backend semantics:

1. The frontend was correctly applying optimistic reaction overrides.
2. App-level `reactionOverrides` were needed so pending reactions survived navigation/refetch until canonical state matched.
3. Applying full reaction mutation response snapshots locally could overwrite unrelated optimistic reaction state with stale readable state.
4. The backend reaction endpoint still treated every request as a toggle. Under fast add/remove flows, the backend could read stale canonical state and turn a user-intended remove into an add, or a user-intended add into a remove.

The key lesson: reaction requests must be idempotent add/remove intents, not blind toggles, once the UI is optimistic and users can click quickly.

## Final fix shape

### Frontend

`src/pages/ActivityFeed.jsx`

- Compute the optimistic next members immediately.
- Send explicit direction to `onReact`:

```js
Promise.resolve(onReact(post.owner, post.id, emoji, nextMembers.includes(currentUser)))
```

- When applying pending overrides to rendered posts:
  - if override members are non-empty, assign them
  - if override members are empty, delete the emoji key so no `0` chip renders
- Filter reaction rows to non-empty member arrays.
- Sort equal-count reactions by `QUICK_REACTIONS` order to avoid unstable refresh order.

`src/pages/ActivityPage.jsx`

- Preserve the explicit direction in the mutation payload:

```js
const handleReaction = (owner, logId, emoji, isAdding) =>
  onLogMutation({ action: "reaction", groupId: group.id, actor: currentUser, owner, logId, emoji, isAdding });
```

`src/App.jsx`

- Keep app-level `reactionOverrides`.
- Pass `reactionOverrides,setReactionOverrides` into `ActivityPage`.
- Keep the `flattenFeedPosts` cleanup effect that clears an override only when canonical app state matches the intended members.
- Do not route independent reactions through the global log mutation queue. Use a per `groupId:owner:logId:emoji` queue so toggles for the same chip stay ordered, while reactions on different workouts can run concurrently.
- Do not apply successful reaction mutation response state with `applyData(result.data)`. Let the optimistic override remain until revision polling/refresh brings canonical state. Applying the POST response can overwrite unrelated local reaction state with a stale snapshot.
- Keep revision-gated polling (`fetchRevision()` before full `fetchData()`) to avoid repeated full-state stale overwrites.

### Backend

`api/lift-log.js`

- `applyToggleReaction` must support explicit boolean `payload.isAdding`:
  - `true`: add actor if not already present
  - `false`: remove actor if present
  - absent: fall back to legacy toggle behavior for old clients
- Reaction handler must pass explicit `isAdding` through to canonical RPC selection:

```js
const isAdding = typeof payload?.isAdding === "boolean"
  ? payload.isAdding
  : (reactionLog.reactions?.[emoji] || []).includes(canonicalActor);

await toggleWorkoutReactionInCanonical(payload.logId, auth.user.id, canonicalActor, emoji, isAdding, { throwOnError: true });
```

- Preserve the canonical reaction backend:
  - `buildCanonicalWritableStateForAuthenticatedMutation(...)`
  - `canonicalActor`
  - 404-tolerant blob shadow
  - `syncOpenWorkoutLogSnapshotToCanonical(...)`
  - `toggleWorkoutReactionInCanonical(...)`
  - `persistOrSkipBlobMirror(..., "reaction")`

## Commits that matter

On `codex/reconcile-chat-with-backend`:

- `bf841c5 restore canonical branch reaction overrides`
- `b63372a hide empty reaction overrides`
- `759e1c1 restore revision gated polling`
- `344895d parallelize independent reaction mutations`
- `ec1eefe avoid stale reaction response overwrites`
- `484448e make reaction mutations direction explicit`

The final correctness fix is `484448e`; the earlier commits support the optimistic UX and prevent stale local overwrites.

## Regression test

Use a real preview/prod auth session against a Bloc with at least three recent workout logs.

1. Open Activity Feed.
2. Pick the three most recent workout logs.
3. Ensure the oldest of the three already has one existing reaction.
4. Add reactions quickly:
   - first log: first reaction
   - second log: first reaction
   - third log: second reaction
5. Expected:
   - no existing reaction disappears
   - all new reactions appear immediately
   - navigating Today -> Activity does not change the visible reaction state
   - browser refresh keeps all reactions
6. Remove the newly added reactions quickly.
7. Expected:
   - count `1` unreact removes the chip immediately, never renders `0`
   - unrelated reactions on the same or other logs do not disappear
   - navigating Today -> Activity does not resurrect deleted reactions
   - browser refresh keeps deleted reactions deleted

Also test deleting workout logs after reaction churn:

1. Delete three recently interacted workout logs.
2. Expected:
   - all disappear optimistically
   - navigating and refresh do not resurrect deleted logs one at a time

## Do not regress

- Do not make reaction POST responses replace the whole app state.
- Do not remove app-level `reactionOverrides`; local-only overrides get lost across navigation.
- Do not turn explicit add/remove back into backend toggle-only behavior.
- Do not run unrelated reaction mutations through a single global queue.
- Do not remove revision-gated polling.
- Do not render reaction entries with empty member arrays.
