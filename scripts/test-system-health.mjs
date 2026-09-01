// System health summary rules — see docs/rollover-incident-2026-09-01.md.
//
// The rollover fix skips a Bloc that cannot roll over so the rest can proceed.
// That is correct and silent, so the founder dashboard is the only place a
// skipped Bloc becomes visible. These pin what it says.

import { summarizeSystemHealth, MAX_LISTED } from "../src/lib/systemHealth.js";

let failures = 0;
const check = (label, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures += 1;
  console.log(`${ok ? "[PASS]" : "[FAIL]"} ${label}${ok ? "" : ` — got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`}`);
};

const event = (blocKey, detail, occurredAt) => ({ blocKey, detail, occurredAt });

// --- Healthy -----------------------------------------------------------------
// Missing data must read as healthy, never as a failure. The dashboard calls
// this before the first response lands.
check("undefined events reads as healthy", summarizeSystemHealth(undefined).healthy, true);
check("empty object reads as healthy", summarizeSystemHealth({}).healthy, true);
check("healthy headline names the window", summarizeSystemHealth({}).headline, "no Blocs skipped in 7 days");
check("healthy has no entries", summarizeSystemHealth({}).entries, []);

// A failure older than seven days is history, not something to act on.
check(
  "an event outside the 7-day window still reads as healthy",
  summarizeSystemHealth({ last24h:0, last7d:0, total:3, recent:[event("osi-h3","old","2026-01-01T00:00:00Z")] }).healthy,
  true
);

// --- Unhealthy ---------------------------------------------------------------
check(
  "one Bloc skipped is singular",
  summarizeSystemHealth({ last24h:0, last7d:1, recent:[] }).headline,
  "1 Bloc skipped in 7 days"
);
check(
  "several Blocs skipped is plural",
  summarizeSystemHealth({ last24h:0, last7d:3, recent:[] }).headline,
  "3 Blocs skipped in 7 days"
);
// The today clause only appears when something happened today, so a stale
// failure cannot read as an ongoing one.
check(
  "today is only mentioned when it happened today",
  summarizeSystemHealth({ last24h:2, last7d:5, recent:[] }).headline,
  "5 Blocs skipped in 7 days · 2 today"
);

// --- Entries -----------------------------------------------------------------
const many = Array.from({length:9},(_,i)=>event(`bloc-${i}`,`reason ${i}`,`2026-09-0${(i%9)+1}T00:00:00Z`));
check("the list is capped", summarizeSystemHealth({ last7d:9, recent:many }).entries.length, MAX_LISTED);
check(
  "an event with no Bloc key is still readable",
  summarizeSystemHealth({ last7d:1, recent:[event(null,"bloc not found",null)] }).entries[0],
  { blocKey:"unknown Bloc", detail:"bloc not found", occurredAt:null }
);
check(
  "a blank Bloc key is treated as missing, not printed empty",
  summarizeSystemHealth({ last7d:1, recent:[event("   ","x","2026-09-01T00:00:00Z")] }).entries[0].blocKey,
  "unknown Bloc"
);

// --- Hostile input -----------------------------------------------------------
// This renders on a screen the founder opens during an incident. It must not
// throw on a payload that arrived malformed.
check("a non-array recent is ignored", summarizeSystemHealth({ last7d:1, recent:"nope" }).entries, []);
check("negative counts are floored at zero", summarizeSystemHealth({ last24h:-4, last7d:-9 }).healthy, true);
check("non-numeric counts are floored at zero", summarizeSystemHealth({ last24h:"x", last7d:"y" }).last7d, 0);
check("fractional counts are whole", summarizeSystemHealth({ last7d:2.7 }).last7d, 2);

console.log(failures === 0 ? "\nAll system health checks passed." : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
