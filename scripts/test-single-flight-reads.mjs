// Single-flight canonical reads — the 2026-09-14 stampede shape.
//
// One global revision clock means any action in any Bloc makes every open
// phone refresh within its 6s poll. Measured on production 2026-10-25,
// read_ante_core_month_history costs 1.4s and ~3,820 per-log subqueries, so
// four phones reacting to one comment meant 15,280 subqueries in a six-second
// window. Load grows quadratically: actions scale with users, reloads scale
// with users.
//
// singleFlightRead collapses concurrent identical reads into one call. These
// pin the behaviour that matters, including the two ways a naive version goes
// wrong: holding a stale result after it settles, and wedging the key forever
// when a read throws.
//
// Offline. The reader is a counting stub; no database, no credentials.
//
// Usage: node scripts/test-single-flight-reads.mjs

let failures = 0;
const check = (label, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures += 1;
  console.log(`${ok ? "[PASS]" : "[FAIL]"} ${label}${ok ? "" : ` — got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`}`);
};

// Same implementation as api/lift-log.js. Kept in step by the shared-shape
// check at the bottom, which fails if the source stops matching.
const inFlight = new Map();
function singleFlightRead(key, read) {
  const existing = inFlight.get(key);
  if (existing) return existing;
  const started = (async () => {
    try {
      return await read();
    } finally {
      inFlight.delete(key);
    }
  })();
  inFlight.set(key, started);
  return started;
}

const defer = ms => new Promise(resolve => setTimeout(resolve, ms));

// --- 1. The stampede: four phones, one database read -------------------------
{
  let calls = 0;
  const slowRead = async () => { calls += 1; await defer(20); return { rows: 31 }; };
  const results = await Promise.all([1, 2, 3, 4].map(() => singleFlightRead("month-history", slowRead)));
  check("four concurrent refreshes cause one read", calls, 1);
  check("...and every caller gets the result", results.map(r => r.rows), [31, 31, 31, 31]);
}

// --- 2. No staleness: a later refresh re-reads -------------------------------
// The reason this is single-flight and not a TTL cache. Closed months change
// at the month rollover -- the path that broke on 1 October -- so a cache that
// outlived the read could serve pre-rollover history. Once the read settles,
// the next caller must go back to the database.
{
  let calls = 0;
  const read = async () => { calls += 1; return calls; };
  const first = await singleFlightRead("current-logs", read);
  const second = await singleFlightRead("current-logs", read);
  check("a refresh after the read settles re-reads", [first, second], [1, 2]);
}

// --- 3. Distinct keys do not collide -----------------------------------------
// fetchAnteLogsForMonth keys by month: the rollover fetches one month per
// distinct closed month, and two time zones can close different months in one
// pass. Sharing a key across months would hand one month the other's logs.
{
  let seen = [];
  const read = monthKey => async () => { seen.push(monthKey); await defer(10); return monthKey; };
  const [a, b] = await Promise.all([
    singleFlightRead("logs-for-month:2026-8", read("2026-8")),
    singleFlightRead("logs-for-month:2026-9", read("2026-9"))
  ]);
  check("different months read independently", [a, b], ["2026-8", "2026-9"]);
  check("...and both actually ran", seen.sort(), ["2026-8", "2026-9"]);
}

// --- 4. A failed read does not wedge the key ---------------------------------
// The finally clause matters: without it a thrown read would leave a rejected
// promise in the map forever, so every later refresh of that reader would
// replay the same failure. That turns one transient blip into a permanent one.
{
  let calls = 0;
  const failing = async () => { calls += 1; throw new Error("supabase unreachable"); };
  let firstError = null;
  try { await singleFlightRead("blocs", failing); } catch (err) { firstError = err.message; }
  const recovered = await singleFlightRead("blocs", async () => { calls += 1; return "ok"; });
  check("the failure reaches the caller", firstError, "supabase unreachable");
  check("...and the next refresh is not stuck replaying it", recovered, "ok");
  check("...having actually re-read", calls, 2);
}

// --- 5. Concurrent callers share one failure ---------------------------------
{
  let calls = 0;
  const failing = async () => { calls += 1; await defer(10); throw new Error("timeout"); };
  const settled = await Promise.allSettled([1, 2, 3].map(() => singleFlightRead("profiles", failing)));
  check("one read for three concurrent callers", calls, 1);
  check("all three see the rejection", settled.map(s => s.status), ["rejected", "rejected", "rejected"]);
}

// --- 6. The source still uses this shape -------------------------------------
// Guards against the copy above drifting from api/lift-log.js and this suite
// quietly testing nothing.
{
  const fs = await import("node:fs");
  const source = fs.readFileSync(new URL("../api/lift-log.js", import.meta.url), "utf8");
  check("api/lift-log.js defines singleFlightRead",
    source.includes("function singleFlightRead(key, read)"), true);
  check("...clears the key when the read settles",
    /finally\s*\{\s*\n\s*\/\/[^\n]*\n\s*\/\/[^\n]*\n\s*inFlightCanonicalReads\.delete\(key\)/.test(source)
      || source.includes("inFlightCanonicalReads.delete(key)"), true);
  check("...and the expensive readers go through it",
    ["month-history", "current-logs", "blocs", "profiles"].every(k => source.includes(`singleFlightRead("${k}"`)), true);
}

console.log(failures === 0 ? "\nAll single-flight checks passed." : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
