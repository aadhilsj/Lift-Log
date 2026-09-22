import assert from "node:assert/strict";
import fs from "node:fs";

// Someone sitting out must not appear to be in the month. The Month page used
// to show a "Sitting out this month" card; since the perfect-month loop
// (2026-09-22) they get no slice on the ring and are listed under "Sitting out".
const page = fs.readFileSync(new URL("../src/pages/MonthPage.jsx", import.meta.url), "utf8");
const loop = fs.readFileSync(new URL("../src/components/MonthLoop.jsx", import.meta.url), "utf8");

// The Month page passes each member's sit-out state into the loop.
assert.match(page, /isOut: !!u\.isOut/);
// ...and lists them by name under "Sitting out".
assert.match(page, /loopMembers\.filter\(m => m\.isOut\)\.map\(m => noteRow\(`out-\$\{m\.name\}`, "Sitting out"/);
// The ring and the totals leave them out entirely.
assert.match(loop, /const inLoop = members\.filter\(m => !m\.isOut\);/);
// The old copy that suggested sitting out still involved money stays gone.
assert.doesNotMatch(page, /You won't pay or collect anything this month\./);
console.log("Month sit-out card checks passed.");
