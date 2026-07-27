import assert from "node:assert/strict";
import { buildWorkoutLogDerivedMoments } from "../api/lift-log.js";

const parts = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Oslo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
}).formatToParts(new Date()).reduce((acc, part) => {
  acc[part.type] = part.value;
  return acc;
}, {});

const currentYear = Number(parts.year);
const currentMonth = Number(parts.month) - 1;
const currentDay = Number(parts.day);
const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
const daysLeft = Math.max(1, daysInMonth - currentDay + 1);
const currentMonthKey = `${currentYear}-${currentMonth}`;
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

function statusFor(target, count) {
  const expected = Math.floor((target / daysInMonth) * currentDay);
  const diff = count - expected;
  if (count >= target) return "locked-in";
  if (count + daysLeft < target) return "cooked";
  if (diff >= 2) return "cruising";
  if (diff >= 0) return "on-track";
  if (diff >= -2) return "at-risk";
  return "behind";
}

function findTransition(fromStatus, toStatus) {
  for (let target = 4; target <= 60; target += 1) {
    for (let beforeCount = 0; beforeCount < target; beforeCount += 1) {
      if (statusFor(target, beforeCount) !== fromStatus) continue;
      for (let afterCount = beforeCount + 1; afterCount <= target; afterCount += 1) {
        if (statusFor(target, afterCount) === toStatus) return { target, beforeCount, afterCount };
      }
    }
  }
  throw new Error(`No ${fromStatus} -> ${toStatus} fixture available for ${currentMonthKey}`);
}

{
  const { target, beforeCount, afterCount } = findTransition("behind", "on-track");
  const result = derive(group({ target, count: beforeCount }), group({ target, count: afterCount }));
  assert.equal(result.deleteKeys.length, 0);
  assert.equal(result.inserts.length, 1);
  assert.equal(result.inserts[0].systemKind, "comeback");
  assert.equal(result.inserts[0].idempotencyKey, `comeback:test-bloc:${currentMonthKey}:${memberUserId}:behind:on-track`);
}

{
  const { target, beforeCount, afterCount } = findTransition("at-risk", "on-track");
  const result = derive(group({ target, count: beforeCount }), group({ target, count: afterCount }));
  assert.equal(result.deleteKeys.length, 0);
  assert.equal(result.inserts.length, 0);
}

{
  const { target, beforeCount, afterCount } = findTransition("cooked", "on-track");
  const result = derive(group({ target, count: beforeCount }), group({ target, count: afterCount }));
  assert.deepEqual(result.deleteKeys, [`cooked:test-bloc:${currentMonthKey}:${memberUserId}`]);
  assert.equal(result.inserts.length, 0);
}

console.log("Bloc Stream derived moment tests passed");
