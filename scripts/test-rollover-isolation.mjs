// Rollover isolation rules — see docs/rollover-incident-2026-09-01.md.
//
// On 2026-09-01 two blob-only Blocs with no ante_core.blocs row made the
// canonical season write raise "bloc not found". persistState aborted before
// the blob write, so all sixteen Blocs stayed on August, and every subsequent
// read re-attempted and re-failed the identical batch.
//
// These pin the two rules that prevent it: a rollover batch carries enough
// information to roll one Bloc back on its own, and an unreadable canonical
// Bloc list must never be mistaken for an empty one.

import {
  rolloverStateIfNeeded,
  rolloverGroupIfNeeded,
  shouldSkipRolloverForMissingCanonicalBloc
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

const mkGroup = (id, name) => ({
  id,
  name,
  adminName: "Aadhil",
  memberOrder: ["Aadhil"],
  memberships: { u1: { userId: "u1", role: "admin", displayName: "Aadhil", joinedAt: "2026-07-16T00:00:00.000Z" } },
  logs: { Aadhil: [] },
  excused: {},
  solo: {},
  monthHistory: [],
  lastMonth: staleMonthKey(),
  settings: { minTarget: 12, timeZone: "Europe/Oslo" }
});

const mkState = (...ids) => ({
  version: 2,
  profiles: {},
  groupOrder: ids,
  groups: Object.fromEntries(ids.map(id => [id, mkGroup(id, id)]))
});

// --- Pre-flight guard -------------------------------------------------------
// The null case is the trap. fetchAnteBlocs() returns null when it could not
// read the list; skipping on null would stall every Bloc — the same outage
// from the other direction.
check(
  "null canonical Bloc list means 'could not verify', so do not skip",
  shouldSkipRolloverForMissingCanonicalBloc(null, "osi-h3-9pmkuy"),
  false
);
check(
  "Bloc present in canonical is not skipped",
  shouldSkipRolloverForMissingCanonicalBloc({ "osi-h3-9pmkuy": { id: "x" } }, "osi-h3-9pmkuy"),
  false
);
check(
  "Bloc absent from a readable canonical list is skipped",
  shouldSkipRolloverForMissingCanonicalBloc({ "osi-h3-9pmkuy": { id: "x" } }, "op0-yneefj"),
  true
);
check(
  "empty-but-readable canonical list skips rather than throwing",
  shouldSkipRolloverForMissingCanonicalBloc({}, "op0-yneefj"),
  true
);

// --- Rollback material ------------------------------------------------------
// persistState can only roll one Bloc back out of a batch if the batch carries
// its pre-rollover copy. Without this the failure has to abort everything.
const rolled = rolloverStateIfNeeded(mkState("osi-h3-9pmkuy", "op0-yneefj"));
const entries = rolled._rollovers || [];

check("both due Blocs are in the rollover batch", entries.length, 2);
check(
  "every rollover entry carries a pre-rollover copy",
  entries.every(entry => !!entry.previousGroup),
  true
);

const orphanEntry = entries.find(entry => entry.groupId === "op0-yneefj");
const healthyEntry = entries.find(entry => entry.groupId === "osi-h3-9pmkuy");

check(
  "the pre-rollover copy still holds the old month",
  orphanEntry?.previousGroup?.lastMonth,
  staleMonthKey()
);
check(
  "the rolled group has moved to the new month",
  rolled.groups["op0-yneefj"].lastMonth !== staleMonthKey(),
  true
);
check(
  "reverting one Bloc restores its old month and leaves the other rolled",
  (() => {
    const next = { ...rolled, groups: { ...rolled.groups } };
    next.groups["op0-yneefj"] = orphanEntry.previousGroup;
    return {
      reverted: next.groups["op0-yneefj"].lastMonth === staleMonthKey(),
      otherStillRolled: next.groups["osi-h3-9pmkuy"].lastMonth === healthyEntry.newMonthKey
    };
  })(),
  { reverted: true, otherStillRolled: true }
);

// --- Closed-month snapshot --------------------------------------------------
// The reverted Bloc must not keep a half-applied close.
check(
  "a rolled Bloc appends exactly one closed month to history",
  rolled.groups["osi-h3-9pmkuy"].monthHistory.length,
  1
);
check(
  "the pre-rollover copy has no closed month appended",
  orphanEntry.previousGroup.monthHistory.length,
  0
);

// --- Restorable revision ----------------------------------------------------
// If every Bloc in a batch is skipped, the read path must be able to restore
// the exact stored revision/updatedAt and skip the write. Otherwise a single
// permanently-skipped Bloc means a blob write and a backup on every read.
check(
  "each entry carries the pre-rollover revision and updatedAt",
  entries.every(entry => entry.baseRevision !== undefined && entry.baseUpdatedAt !== undefined),
  true
);
check(
  "the pre-rollover revision is one below the rolled revision",
  entries[0].baseRevision + 1,
  rolled.meta.revision
);

// --- No-op safety -----------------------------------------------------------
// A state already on the current month must not produce a batch at all.
const current = mkState("osi-h3-9pmkuy");
current.groups["osi-h3-9pmkuy"].lastMonth = rolled.groups["osi-h3-9pmkuy"].lastMonth;
check(
  "a Bloc already on the current month produces no rollover",
  (rolloverStateIfNeeded(current)._rollovers || []).length,
  0
);
check(
  "rolloverGroupIfNeeded returns the same object when nothing is due",
  rolloverGroupIfNeeded(current.groups["osi-h3-9pmkuy"]) === current.groups["osi-h3-9pmkuy"],
  true
);

console.log(failures === 0 ? "\nAll rollover isolation checks passed." : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
