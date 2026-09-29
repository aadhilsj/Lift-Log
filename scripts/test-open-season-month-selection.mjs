// Exercise the production reducer itself, without changing API exports.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../api/lift-log.js", import.meta.url), "utf8");
const compareStart = source.indexOf("function compareMonthKeys(a, b) {");
const compareEnd = source.indexOf("\nfunction canonicalOpenMonthIsCurrentForGroup", compareStart);
const reduceStart = source.indexOf("const openSeasonMonthKeys = openSeasonRows.reduce((acc, row) => {");
const reduceEnd = source.indexOf("\n\n    return { excused, sitOutRequests", reduceStart);
assert.ok(compareStart >= 0 && compareEnd > compareStart, "existing month comparator must be present");
assert.ok(reduceStart >= 0 && reduceEnd > reduceStart, "production open-season reducer must be present");

const selectOpenMonths = new Function("openSeasonRows", [
  source.slice(compareStart, compareEnd),
  source.slice(reduceStart, reduceEnd),
  "return openSeasonMonthKeys;"
].join("\n"));

const stale = { legacy_group_key: "legacy-group", month_key: "2026-5" };
const current = { legacy_group_key: "legacy-group", month_key: "2026-8" };
const otherStale = { legacy_group_key: "ctrl-alt-de-feat-ocdti8", month_key: "2026-6" };
const otherCurrent = { legacy_group_key: "ctrl-alt-de-feat-ocdti8", month_key: "2026-8" };
const expected = { "legacy-group": "2026-8", "ctrl-alt-de-feat-ocdti8": "2026-8" };

assert.deepEqual(selectOpenMonths([stale, current, otherStale, otherCurrent]), expected);
assert.deepEqual(selectOpenMonths([current, stale, otherCurrent, otherStale]), expected);
assert.deepEqual(selectOpenMonths([otherStale, current, otherCurrent, stale]), expected);
console.log("[PASS] newest open month wins for both affected Blocs regardless of row order");
