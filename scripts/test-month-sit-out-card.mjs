import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("../src/pages/MonthPage.jsx", import.meta.url), "utf8");

assert.match(source, /const currentUserIsOut = isCurrent && !!currentUserEntry\?\.isOut;/);
assert.match(source, /currentUserIsOut\?"Sitting out this month":"Month in progress"/);
assert.doesNotMatch(source, /You won't pay or collect anything this month\./);
assert.match(source, /currentUser&&!currentUserIsOut&&React\.createElement\('div'/);
console.log("Month sit-out card checks passed.");
