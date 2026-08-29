// Parity test: the server-side Fero profile aggregation must agree with the
// client one for the Blocs both can see.
//
// The two implementations live apart on purpose — the API is a standalone file
// and cannot import from src/ — so this guards against them drifting. The
// server sees every Bloc; the client only the viewer's. Given the same groups,
// the shared figures must match exactly.

import { buildFeroProfileStats } from "../api/lift-log.js";
import { buildProfileStats } from "../src/lib/profileStats.js";

let failures = 0;
const check = (label, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures += 1;
  console.log(`${ok ? "[PASS]" : "[FAIL]"} ${label}${ok ? "" : ` — server ${JSON.stringify(actual)} vs client ${JSON.stringify(expected)}`}`);
};

const mkGroup = (id, name, logs, history) => ({
  id,
  name,
  memberships: { u1: { userId: "u1", displayName: "Aadhil", joinedAt: "2026-01-15" } },
  logs: { Aadhil: logs },
  excused: {},
  monthHistory: history,
  settings: { minTarget: 12, currency: "NOK" }
});

const month = (key, count) => ({
  key,
  label: key,
  counts: { Aadhil: count },
  memberTargets: {},
  excused: {},
  settings: { minTarget: 12, fineAmount: 20, feeModel: "flat" },
  logsByUser: { Aadhil: [] }
});

const g1 = mkGroup("g1", "One",
  [{ id: "a", date: "2026-08-01", type: "Gym" }, { id: "b", date: "2026-08-03", type: "Run" }],
  [month("2026-07", 14)]);
const g2 = mkGroup("g2", "Two",
  [{ id: "c", date: "2026-08-05", type: "Gym" }],
  [month("2026-06", 3)]);

const state = { groups: { g1, g2 }, profiles: {} };

const server = buildFeroProfileStats(state, "u1");
const client = buildProfileStats({ groups: [g1, g2], userId: "u1" }).agg;

check("workoutsLogged", server.workoutsLogged, client.workoutsLogged);
check("blocWins", server.blocWins, client.blocWins);
check("targetHitMonths", server.targetHitMonths, client.targetHitMonths);
check("targetEligibleMonths", server.targetEligibleMonths, client.targetEligibleMonths);
check("weekday", server.weekday, client.weekday);
check("logsByDate", server.logsByDate, client.logsByDate);
check("earliestJoined", server.earliestJoined, client.earliestJoined);

// The whole point: the server must NOT shrink to the viewer's shared Blocs.
const sharedOnly = buildProfileStats({ groups: [g1], userId: "u1" }).agg;
const widerThanShared = server.workoutsLogged > sharedOnly.workoutsLogged;
console.log(`${widerThanShared ? "[PASS]" : "[FAIL]"} server counts all Blocs, not just a shared one (${server.workoutsLogged} > ${sharedOnly.workoutsLogged})`);
if (!widerThanShared) failures += 1;

check("blocCount", server.blocCount, 2);

console.log(`\n${failures === 0 ? "all checks passed" : `${failures} failure(s)`}`);
process.exit(failures === 0 ? 0 : 1);
