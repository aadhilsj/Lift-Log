// Month close counts from canonical, not the blob.
//
// See docs/handover-2026-09-09-signin-fixes-and-delete-log-blob-divergence.md:
// delete-log stopped mirroring to the blob on 2026-07-19, so blob group.logs
// can hold workouts the member deleted (freezing them lets members off), and
// once add-log/multi-log stop mirroring the blob misses real workouts
// (freezing that charges members who completed the month).
//
// These pin rebuildClosedMonthSnapshotFromCanonicalLogs: the closed snapshot's
// counts, logsByUser and settlements must come from canonical rows, the
// tombstone filter must hold, and an empty canonical record for a month the
// blob counted must skip the Bloc rather than freeze either number.
//
// Usage: node scripts/test-month-close-canonical.mjs  (offline, no credentials)

import {
  rolloverGroupIfNeeded,
  rebuildClosedMonthSnapshotFromCanonicalLogs
} from "../api/lift-log.js";

let failures = 0;
const check = (label, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures += 1;
  console.log(`${ok ? "[PASS]" : "[FAIL]"} ${label}${ok ? "" : ` — got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`}`);
};

// A month key is "year-monthIndex", zero-based: August 2026 is "2026-7".
const staleMonthKey = () => {
  const now = new Date();
  const year = now.getUTCFullYear();
  const monthIndex = now.getUTCMonth();
  return monthIndex === 0 ? `${year - 1}-11` : `${year}-${monthIndex - 1}`;
};
const CLOSED_KEY = staleMonthKey();

const blobLog = (id, date) => ({ id: String(id), type: "Run", date, createdAt: `${date}T10:00:00.000Z`, reactions: {} });
const canonicalRow = (owner, id, date, extra = {}) => ({
  ownerDisplayName: owner,
  id: String(id),
  type: "Run",
  date,
  note: "",
  photoUrl: "",
  createdAt: `${date}T10:00:00.000Z`,
  verifiedVia: "photo",
  flagStatus: null,
  flagReason: "",
  flagResponse: "",
  flaggedBy: null,
  decisionBy: null,
  decisionAt: null,
  commentCount: 0,
  reactions: {},
  ...extra
});

// Dates inside the closing month, whatever month the suite runs in.
const [cy, cm] = CLOSED_KEY.split("-").map(Number);
const day = d => `${cy}-${String(cm + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

// inviteCode and createdAt fixed for the same reason as the isolation suite:
// normalizeGroup generates both when absent.
const mkGroup = (blobLogsByName) => ({
  id: "g1",
  name: "Fixture",
  inviteCode: "QA0001",
  createdAt: "2026-07-16T00:00:00.000Z",
  adminName: "Aadhil",
  memberOrder: Object.keys(blobLogsByName),
  memberships: Object.fromEntries(
    Object.keys(blobLogsByName).map((name, i) =>
      [`u${i + 1}`, { userId: `u${i + 1}`, role: i === 0 ? "admin" : "member", displayName: name, joinedAt: "2026-07-16T00:00:00.000Z" }])
  ),
  logs: blobLogsByName,
  excused: {},
  solo: {},
  monthHistory: [],
  lastMonth: CLOSED_KEY,
  settings: { minTarget: 12, timeZone: "UTC" }
});

// Roll the group over with blob logs, then rebuild from canonical rows —
// exactly the persistState sequence.
const closeMonth = (blobLogsByName, canonicalRows, options = {}) => {
  const rolled = rolloverGroupIfNeeded(mkGroup(blobLogsByName));
  return rebuildClosedMonthSnapshotFromCanonicalLogs(rolled, CLOSED_KEY, canonicalRows, options);
};

const nLogs = (n, offset = 0) => Array.from({ length: n }, (_, i) => blobLog(1000 + offset + i, day((i % 27) + 1)));
const nRows = (owner, n, offset = 0) => Array.from({ length: n }, (_, i) => canonicalRow(owner, 1000 + offset + i, day((i % 27) + 1)));

// --- 1. The Task 5 scenario: blob is missing real workouts ------------------
// Aadhil's fixture: a member who genuinely hit 12 of 12, with the blob having
// received only the first five. Must freeze at 12 with no penalty.
{
  const result = closeMonth(
    { Aadhil: nLogs(5), Sam: nLogs(12, 100) },
    [...nRows("Aadhil", 12), ...nRows("Sam", 12, 100)]
  );
  const month = result.group.monthHistory[0];
  check("blob missing workouts: frozen count comes from canonical", month.counts, { Aadhil: 12, Sam: 12 });
  check("blob missing workouts: no one is charged", month.settlements, {});
  check("blob missing workouts: snapshot logs are the canonical set", month.logsByUser.Aadhil.length, 12);
}

// --- 2. The delete-log scenario: blob holds phantom workouts ----------------
// The live bug's direction: a member deleted a workout the blob kept. 12 in
// the blob, 11 in canonical, target 12 — must freeze at 11 and stay charged.
{
  const result = closeMonth(
    { Aadhil: nLogs(12), Sam: nLogs(12, 100) },
    [...nRows("Aadhil", 11), ...nRows("Sam", 12, 100)]
  );
  const month = result.group.monthHistory[0];
  check("phantom delete: frozen count excludes the deleted workout", month.counts, { Aadhil: 11, Sam: 12 });
  check("phantom delete: the missed target stays outstanding", month.settlements, { Aadhil: { status: "outstanding", settledAt: null, updatedAt: null } });
}

// --- 3. Rejected logs stay excluded from counts -----------------------------
{
  const rows = [...nRows("Aadhil", 12), canonicalRow("Aadhil", 9999, day(28), { flagStatus: "rejected" })];
  const result = closeMonth({ Aadhil: nLogs(12) }, rows);
  const month = result.group.monthHistory[0];
  check("rejected canonical log does not count", month.counts, { Aadhil: 12 });
  check("rejected canonical log is still archived", month.logsByUser.Aadhil.length, 13);
}

// --- 4. Reactions ride along from canonical ---------------------------------
// The blob's live logs carry no reactions while the reaction mirror is
// skipped; the frozen month must archive canonical's reactions anyway.
{
  const rows = nRows("Aadhil", 12).map((row, i) => i === 0 ? { ...row, reactions: { "🔥": ["Sam"] } } : row);
  const result = closeMonth({ Aadhil: nLogs(12) }, rows);
  const archived = result.group.monthHistory[0].logsByUser.Aadhil.find(log => log.id === "1000");
  check("canonical reactions land in the frozen month", archived.reactions, { "🔥": ["Sam"] });
}

// --- 5. Tombstoned logs are not resurrected ---------------------------------
{
  const result = closeMonth(
    { Aadhil: nLogs(12) },
    nRows("Aadhil", 12),
    { deletedCurrentLogIds: ["1000"] }
  );
  const month = result.group.monthHistory[0];
  check("race-window tombstone excludes the log from the frozen month", month.counts, { Aadhil: 11 });
}

// --- 6. Suspect canonical record skips instead of freezing ------------------
{
  const result = closeMonth({ Aadhil: nLogs(12) }, []);
  check("empty canonical vs counted blob: skip, never freeze", result.ok, false);
}
{
  const result = closeMonth({ Aadhil: [] }, []);
  const ok = result.ok === true && JSON.stringify(result.group.monthHistory[0].counts) === JSON.stringify({ Aadhil: 0 });
  check("genuinely quiet month closes at zero", ok, true);
}

// --- 7. Missing snapshot is reported, not thrown ----------------------------
{
  const result = rebuildClosedMonthSnapshotFromCanonicalLogs(mkGroup({ Aadhil: [] }), "1999-0", []);
  check("no snapshot for the month: reported as skip reason", result.ok, false);
}

console.log(failures === 0 ? "\nAll month-close canonical checks passed." : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
