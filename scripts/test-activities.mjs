import assert from "node:assert/strict";
import {
  applyAddLog,
  applyMultiLog,
  applyUpsertProfile,
  ACTIVITY_CATEGORIES,
  DISPLAY_NAME_MAX_LENGTH,
  capDisplayName,
  normalizeLogEntry
} from "../api/lift-log.js";
import {
  ACTIVITIES,
  NEW_MEMBER_ACTIVITIES,
  activityNeedsNote,
  countMemberActivities,
  getActivityCategory,
  getLogActivity,
  getLogDisplayActivity,
  getTopActivities
} from "../src/lib/activities.js";
import { getWorkoutIcon } from "../src/lib/workoutIcons.js";
import { DISPLAY_NAME_MAX_LENGTH as CLIENT_DISPLAY_NAME_MAX_LENGTH } from "../src/lib/appState.js";

const ALL_CATEGORIES = ["Gym", "Run", "Sports", "Pilates", "Other"];

// ── The server's copy and the app's copy describe the same list ────────────
assert.deepEqual(
  Object.fromEntries(ACTIVITIES.map(activity => [activity.name, activity.category])),
  ACTIVITY_CATEGORIES,
  "api/lift-log.js ACTIVITY_CATEGORIES must match src/lib/activities.js"
);
for (const { name, category } of ACTIVITIES) {
  assert.ok(ALL_CATEGORIES.includes(category), `${name} has an unknown category ${category}`);
  assert.ok(getWorkoutIcon(name), `${name} has no icon`);
}
for (const name of NEW_MEMBER_ACTIVITIES) assert.ok(getActivityCategory(name), `${name} is not an activity`);
assert.deepEqual(NEW_MEMBER_ACTIVITIES, ["Gym", "Run", "Hiking", "Basketball", "Pilates"]);

// ── Only the catch-all needs a note ────────────────────────────────────────
assert.equal(activityNeedsNote("Other"), true);
assert.equal(activityNeedsNote("Hiking"), false);
assert.equal(activityNeedsNote("Padel"), false);
assert.equal(activityNeedsNote(null), false);

// ── Old logs map to activities without being changed ───────────────────────
assert.equal(getLogActivity({ type: "Gym" }), "Gym");
assert.equal(getLogActivity({ type: "Pilates" }), "Pilates");
assert.equal(getLogActivity({ type: "Other" }), "Other");
assert.equal(getLogActivity({ type: "Sports" }), null, "an old Sports log never said which sport");
assert.equal(getLogActivity({ type: "Sports", activity: "Padel" }), "Padel");
assert.equal(getLogActivity({ type: "Sports", activity: "Not a sport" }), null);

// What screens show: the activity, or the category for older logs.
assert.equal(getLogDisplayActivity({ type: "Sports", activity: "Padel" }), "Padel");
assert.equal(getLogDisplayActivity({ type: "Sports" }), "Sports");
assert.equal(getLogDisplayActivity({ type: "Other", activity: "home workout" }), "Home Workout");
assert.equal(getLogDisplayActivity({ type: "Gym", activity: "nonsense" }), "Gym");

// ── Top five ───────────────────────────────────────────────────────────────
assert.deepEqual(getTopActivities({}, ALL_CATEGORIES), NEW_MEMBER_ACTIVITIES, "a new member sees the starting five");
assert.deepEqual(
  getTopActivities({ Gym: 31, Padel: 11, Run: 8, Hiking: 6, Basketball: 4, Swimming: 2 }, ALL_CATEGORIES),
  ["Gym", "Padel", "Run", "Hiking", "Basketball"]
);
assert.deepEqual(
  getTopActivities({ Swimming: 1 }, ALL_CATEGORIES),
  ["Swimming", "Gym", "Run", "Hiking", "Basketball"],
  "one logged activity joins the five; the rest fill from the starting list"
);
assert.deepEqual(
  getTopActivities({ Tennis: 2, Golf: 2 }, ALL_CATEGORIES).slice(0, 2),
  ["Tennis", "Golf"],
  "ties keep a fixed order so tiles do not jump"
);
assert.deepEqual(
  getTopActivities({ Padel: 9, Gym: 3 }, ["Gym", "Run", "Pilates", "Other"]),
  ["Gym", "Run", "Hiking", "Pilates", "Yoga"],
  "a Bloc without Sports never offers a sport, however often it is logged"
);

// Counting: across Blocs and closed months, a multi-Bloc workout counts once.
{
  const userId = "u1";
  const groups = [
    {
      id: "a",
      memberships: { [userId]: { displayName: "Aadhil" } },
      logs: { Aadhil: [
        { id: "1789000000000001", date: "2026-09-10", type: "Sports", activity: "Padel" },
        { id: "1789000000000002", date: "2026-09-11", type: "Sports" }
      ] },
      monthHistory: [{ key: "2026-7", logsByUser: { Aadhil: [{ id: "old-1", date: "2026-08-02", type: "Gym" }] } }]
    },
    {
      id: "b",
      memberships: { [userId]: { displayName: "Aadhil S" } },
      logs: { "Aadhil S": [{ id: "1789000000000001-b", date: "2026-09-10", type: "Sports", activity: "Padel" }] },
      monthHistory: []
    },
    { id: "c", memberships: {}, logs: { Aadhil: [{ id: "someone-else", date: "2026-09-10", type: "Run" }] } }
  ];
  assert.deepEqual(countMemberActivities(groups, userId), { Padel: 1, Gym: 1 });
}

// ── The server stores the activity and derives the category from it ───────
const USER_ID = "11111111-1111-4111-8111-111111111111";
const USER = "Aadhil";

function leagueToday() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Oslo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hour12: false
  }).formatToParts(new Date());
  const get = type => Number(parts.find(part => part.type === type).value);
  const date = new Date(Date.UTC(get("year"), get("month") - 1, get("day")));
  if (get("hour") < 3) date.setUTCDate(date.getUTCDate() - 1);
  return { iso: date.toISOString().slice(0, 10), monthKey: `${date.getUTCFullYear()}-${date.getUTCMonth()}` };
}
const { iso: TODAY, monthKey: MONTH_KEY } = leagueToday();

function group(id, acceptedWorkoutTypes = ALL_CATEGORIES) {
  return {
    id, name: id, inviteCode: id.toUpperCase().slice(0, 8), adminName: USER, adminUserId: USER_ID,
    memberOrder: [USER], activeMemberOrder: [USER],
    memberships: { [USER_ID]: { userId: USER_ID, displayName: USER, role: "admin", joinedAt: null } },
    logs: { [USER]: [] }, excused: {}, monthHistory: [], lastMonth: MONTH_KEY,
    settings: { minTarget: 12, timeZone: "Europe/Oslo", acceptedWorkoutTypes }
  };
}
function state() {
  return {
    version: 2,
    groups: { "bloc-a": group("bloc-a"), "bloc-no-sports": group("bloc-no-sports", ["Gym", "Run", "Pilates", "Other"]) },
    groupOrder: ["bloc-a", "bloc-no-sports"],
    defaultGroupId: "bloc-a",
    profiles: { [USER_ID]: { id: USER_ID, email: "aadhil@example.com", displayName: USER } },
    meta: { revision: 1, updatedAt: new Date().toISOString() }
  };
}
const base = { actor: USER, actorUserId: USER_ID, date: TODAY, photoUrl: "https://example.com/p.jpg" };

// add-log: the activity decides the category, whatever type the client sent.
{
  const { log } = applyAddLog(state(), { ...base, groupId: "bloc-a", workoutType: "Gym", activity: "padel", note: "" });
  assert.equal(log.type, "Sports");
  assert.equal(log.activity, "Padel");
}
// add-log without an activity behaves exactly as before, and stores none.
{
  const { log } = applyAddLog(state(), { ...base, groupId: "bloc-a", workoutType: "Run", note: "" });
  assert.equal(log.type, "Run");
  assert.equal("activity" in log, false);
}
// An unknown activity is ignored rather than trusted.
{
  const { log } = applyAddLog(state(), { ...base, groupId: "bloc-a", workoutType: "Gym", activity: "Bobsleigh", note: "" });
  assert.equal(log.type, "Gym");
  assert.equal("activity" in log, false);
}
// A sport is refused by a Bloc that does not count Sports.
assert.throws(
  () => applyAddLog(state(), { ...base, groupId: "bloc-no-sports", workoutType: "Other", activity: "Golf", note: "" }),
  /not accepted/
);

// multi-log: named Other-category activities need no note; the catch-all does.
{
  const next = applyMultiLog(state(), { ...base, sourceGroupId: "bloc-a", targetGroupIds: ["bloc-no-sports"], workoutType: "Other", activity: "Hiking", note: "" });
  const a = next.groups["bloc-a"].logs[USER][0];
  const b = next.groups["bloc-no-sports"].logs[USER][0];
  assert.equal(a.type, "Other");
  assert.equal(a.activity, "Hiking");
  assert.equal(b.activity, "Hiking", "the copy in the other Bloc carries the activity too");
}
assert.throws(
  () => applyMultiLog(state(), { ...base, sourceGroupId: "bloc-a", targetGroupIds: ["bloc-no-sports"], workoutType: "Other", activity: "Other", note: "" }),
  /note is required/
);
assert.throws(
  () => applyMultiLog(state(), { ...base, sourceGroupId: "bloc-a", targetGroupIds: ["bloc-no-sports"], workoutType: "Other", note: "" }),
  /note is required/,
  "an older client sending Other with no activity still needs a note"
);
// A sport logged to several Blocs skips the one without Sports.
{
  const next = applyMultiLog(state(), { ...base, sourceGroupId: "bloc-a", targetGroupIds: ["bloc-no-sports"], workoutType: "Sports", activity: "Tennis", note: "" });
  assert.equal(next.groups["bloc-a"].logs[USER].length, 1);
  assert.equal(next.groups["bloc-no-sports"].logs[USER].length, 0);
}

// ── Stored logs keep a known activity and drop anything else ───────────────
assert.equal(normalizeLogEntry({ id: "x", date: TODAY, type: "Sports", activity: "Padel" }).activity, "Padel");
assert.equal("activity" in normalizeLogEntry({ id: "x", date: TODAY, type: "Sports", activity: "nonsense" }), false);
assert.equal("activity" in normalizeLogEntry({ id: "x", date: TODAY, type: "Gym" }), false);

// ── Display names are capped so they never overflow a layout ──────────────
assert.equal(DISPLAY_NAME_MAX_LENGTH, 16);
assert.equal(CLIENT_DISPLAY_NAME_MAX_LENGTH, DISPLAY_NAME_MAX_LENGTH, "the app and the server must cap names the same");
assert.equal(capDisplayName("  Dasha the Legend  "), "Dasha the Legend", "the longest existing name is untouched");
assert.equal(capDisplayName("Bartholomew Fitzgerald III").length, 16);
{
  const state = {
    version: 2, groups: {}, groupOrder: [], defaultGroupId: null,
    profiles: {}, meta: { revision: 1, updatedAt: new Date().toISOString() }
  };
  const next = applyUpsertProfile(state, {
    userId: USER_ID, email: "long@example.com", displayName: "Bartholomew Fitzgerald III"
  });
  assert.equal(next.profiles[USER_ID].displayName, "Bartholomew Fitz", "the server caps the name it stores");
}

console.log("All activity checks passed.");
