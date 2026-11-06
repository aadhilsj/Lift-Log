// An outage episode: a stretch where the app could not reach Fero.
//
// An app that is offline cannot report that it is offline, so the episode is
// held in localStorage while it is happening and sent once the app can reach
// the server again. One row per episode, not per failed request.
//
// Added 6 November 2026. The founder saw "Still can't reach Fero" over a fully
// loaded feed; the notice having no success state explained what he saw, but
// nothing in Fero recorded that the app had failed to reach the server at all,
// so there was nothing to investigate with.

const OPEN_KEY = "ll_sync_outage_open_v1";
const QUEUE_KEY = "ll_sync_outage_queue_v1";
const MAX_QUEUED = 20;
// Longer than this and the phone was almost certainly asleep rather than the
// server unreachable, which would be a lie in the data.
const MAX_EPISODE_MS = 6 * 60 * 60 * 1000;

function read(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function write(key, value) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Private browsing, or storage full. Diagnostics are not worth an error.
  }
}

function platform() {
  try {
    return window.matchMedia?.("(display-mode: standalone)")?.matches ? "installed" : "web";
  } catch { return "web"; }
}

// Idempotent: a second failure while one episode is open extends that episode
// rather than starting another, which is what makes this one row per outage.
export function openSyncOutage() {
  if (read(OPEN_KEY)) return;
  let wasOnline = null;
  try {
    if (typeof navigator?.onLine === "boolean") wasOnline = navigator.onLine;
  } catch { /* some engines throw on navigator access in workers */ }
  write(OPEN_KEY, {
    startedAt: new Date().toISOString(),
    retries: 0,
    wasOnline,
    platform: platform()
  });
}

export function noteSyncRetry() {
  const open = read(OPEN_KEY);
  if (!open) return;
  write(OPEN_KEY, { ...open, retries: (Number(open.retries) || 0) + 1 });
}

// resolvedBy: "retry" when the member pressed it, "auto" when a background
// sync fixed it with nobody doing anything.
export function closeSyncOutage(resolvedBy) {
  const open = read(OPEN_KEY);
  write(OPEN_KEY, null);
  if (!open?.startedAt) return;
  const startedMs = new Date(open.startedAt).getTime();
  if (!Number.isFinite(startedMs)) return;
  const endedAt = new Date();
  const durationMs = endedAt.getTime() - startedMs;
  if (durationMs < 0 || durationMs > MAX_EPISODE_MS) return;
  const queue = Array.isArray(read(QUEUE_KEY)) ? read(QUEUE_KEY) : [];
  queue.push({
    startedAt: open.startedAt,
    endedAt: endedAt.toISOString(),
    durationMs,
    retries: Number(open.retries) || 0,
    resolvedBy: resolvedBy === "retry" ? "retry" : "auto",
    wasOnline: typeof open.wasOnline === "boolean" ? open.wasOnline : null,
    platform: open.platform || platform()
  });
  // Oldest first out: a phone that has been failing all week should still send
  // the episode that just ended.
  write(QUEUE_KEY, queue.slice(-MAX_QUEUED));
}

export function takeQueuedSyncOutages() {
  const queue = read(QUEUE_KEY);
  if (!Array.isArray(queue) || queue.length === 0) return [];
  write(QUEUE_KEY, null);
  return queue;
}

export function restoreQueuedSyncOutages(episodes) {
  if (!Array.isArray(episodes) || episodes.length === 0) return;
  const queue = Array.isArray(read(QUEUE_KEY)) ? read(QUEUE_KEY) : [];
  write(QUEUE_KEY, [...episodes, ...queue].slice(-MAX_QUEUED));
}
