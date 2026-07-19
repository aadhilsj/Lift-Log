import assert from "node:assert/strict";
import { buildWorkoutLogDerivedMoments } from "../api/lift-log.js";

const monthKey = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Oslo",
  year: "numeric",
  month: "2-digit"
}).formatToParts(new Date()).reduce((acc, part) => {
  acc[part.type] = part.value;
  return acc;
}, {});

const currentMonthKey = `${Number(monthKey.year)}-${Number(monthKey.month) - 1}`;
const memberUserId = "00000000-0000-0000-0000-000000000001";
const displayName = "Test Member";

function logs(count) {
  return Array.from({ length: count }, (_, index) => ({
    id: `log-${index + 1}`,
    createdAt: new Date(Date.now() - (count - index) * 1000).toISOString()
  }));
}

function group({ id = "test-bloc", target = 12, count }) {
  return {
    id,
    lastMonth: currentMonthKey,
    settings: { minTarget: target, timeZone: "Europe/Oslo" },
    logs: { [displayName]: logs(count) },
    excused: {},
    memberships: {
      [memberUserId]: {
        userId: memberUserId,
        displayName,
        joinedAt: "2026-01-01T12:00:00.000Z"
      }
    }
  };
}

function derive(before, after, log = { id: "new-log", createdAt: "2026-07-19T12:00:00.000Z" }) {
  return buildWorkoutLogDerivedMoments(before, after, currentMonthKey, displayName, memberUserId, log);
}

{
  const result = derive(group({ count: 4 }), group({ count: 7 }));
  assert.equal(result.deleteKeys.length, 0);
  assert.equal(result.inserts.length, 1);
  assert.equal(result.inserts[0].systemKind, "comeback");
  assert.equal(result.inserts[0].idempotencyKey, `comeback:test-bloc:${currentMonthKey}:${memberUserId}:behind:on-track`);
}

{
  const result = derive(group({ count: 5 }), group({ count: 7 }));
  assert.equal(result.deleteKeys.length, 0);
  assert.equal(result.inserts.length, 0);
}

{
  const result = derive(group({ target: 25, count: 10 }), group({ target: 25, count: 15 }));
  assert.deepEqual(result.deleteKeys, [`cooked:test-bloc:${currentMonthKey}:${memberUserId}`]);
  assert.equal(result.inserts.length, 0);
}

console.log("Bloc Stream derived moment tests passed");
