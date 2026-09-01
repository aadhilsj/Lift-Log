// Summarises the system events shown on the founder dashboard.
//
// Kept apart from the component so it can be tested without a DOM, the same
// reason profileStats.js lives here. The component only renders what this
// returns.
//
// Context: the 2026-09-01 rollover fix skips a Bloc that cannot roll over so the
// others can proceed. That is correct, and silent — which is why the dashboard
// needs to say so. See docs/rollover-incident-2026-09-01.md.

const MAX_LISTED = 5;

const safeCount = value => {
  const count = Number(value);
  return Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
};

function summarizeSystemHealth(events) {
  const last24h = safeCount(events?.last24h);
  const last7d = safeCount(events?.last7d);
  const recent = Array.isArray(events?.recent) ? events.recent : [];

  // Healthy is decided by the 7-day count alone. A failure older than that is
  // history, not something to act on, and the recent list can still hold it.
  const healthy = last7d === 0;

  return {
    healthy,
    last24h,
    last7d,
    // "3 Blocs skipped in 7 days · 1 today" — the today clause only when there
    // is one, so a stale failure does not read as an ongoing one.
    headline: healthy
      ? "no Blocs skipped in 7 days"
      : `${last7d} Bloc${last7d === 1 ? "" : "s"} skipped in 7 days${last24h > 0 ? ` · ${last24h} today` : ""}`,
    entries: recent.slice(0, MAX_LISTED).map(event => ({
      blocKey: String(event?.blocKey || "").trim() || "unknown Bloc",
      detail: String(event?.detail || "").trim(),
      occurredAt: event?.occurredAt || null
    }))
  };
}

export { summarizeSystemHealth, MAX_LISTED };
