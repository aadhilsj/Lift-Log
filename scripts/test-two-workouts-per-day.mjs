import assert from "node:assert/strict";
import {
  applyAddLog,
  applyMultiLog,
  getDistinctWorkoutCountForDate,
  isMissingLocalCanonicalWorkoutRpcError,
  getWorkoutSessionKey
} from "../api/lift-log.js";
import {
  getDistinctWorkoutCountForDate as getFrontendWorkoutCount,
  countWorkoutsInDayMap
} from "../src/lib/appState.js";

// Week's MVP counts workouts, not merely occupied calendar dates. Its display
// map still accepts the legacy singleton shape alongside two-workout arrays.
assert.equal(countWorkoutsInDayMap({
  "2026-08-24": [{ id: "morning" }, { id: "evening" }],
  "2026-08-25": { id: "legacy-singleton" },
  "2026-08-26": [],
  "2026-08-27": null
}), 3);
assert.equal(countWorkoutsInDayMap({ "2026-08-24": [{ id: "same-type-one", type: "Gym" }, { id: "same-type-two", type: "Gym" }] }), 2);
assert.equal(countWorkoutsInDayMap({}), 0);
assert.equal(countWorkoutsInDayMap(null), 0);

assert.equal(
  isMissingLocalCanonicalWorkoutRpcError(
    {
      status: 404,
      message: '{"code":"PGRST202","message":"Could not find the function public.upsert_ante_core_workout_log"}'
    },
    "upsert_ante_core_workout_log",
    { enableLocalDevOtp:true, supabaseUrl:"http://127.0.0.1:54321" }
  ),
  false,
  "local preview must not bypass the atomic limit when the canonical write RPC is missing"
);
assert.equal(
  isMissingLocalCanonicalWorkoutRpcError(
    { status:404, message:'{"code":"PGRST202","message":"Could not find the function public.upsert_ante_core_workout_log"}' },
    "upsert_ante_core_workout_log",
    { enableLocalDevOtp:true, supabaseUrl:"https://example.supabase.co" }
  ),
  false,
  "production Supabase must never suppress a missing canonical workout RPC"
);

const USER_ID = "11111111-1111-4111-8111-111111111111";
const USER = "Aadhil";

function leagueDate() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Oslo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false
  }).formatToParts(new Date());
  const year = Number(parts.find(part => part.type === "year").value);
  const month = Number(parts.find(part => part.type === "month").value);
  const day = Number(parts.find(part => part.type === "day").value);
  const hour = Number(parts.find(part => part.type === "hour").value);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (hour < 3) date.setUTCDate(date.getUTCDate() - 1);
  return {
    iso: date.toISOString().slice(0, 10),
    monthKey: `${date.getUTCFullYear()}-${date.getUTCMonth()}`
  };
}

const { iso: TODAY, monthKey: MONTH_KEY } = leagueDate();

function group(id, acceptedWorkoutTypes = ["Gym", "Run", "Sports", "Pilates", "Other"]) {
  return {
    id,
    name: id,
    inviteCode: id.toUpperCase().slice(0, 8),
    adminName: USER,
    adminUserId: USER_ID,
    memberOrder: [USER],
    activeMemberOrder: [USER],
    memberships: {
      [USER_ID]: { userId: USER_ID, displayName: USER, role: "admin", joinedAt: null }
    },
    logs: { [USER]: [] },
    excused: {},
    monthHistory: [],
    lastMonth: MONTH_KEY,
    settings: {
      minTarget: 12,
      timeZone: "Europe/Oslo",
      acceptedWorkoutTypes
    }
  };
}

function state() {
  return {
    version: 2,
    groups: {
      "bloc-a": group("bloc-a"),
      "bloc-b": group("bloc-b", ["Gym"])
    },
    groupOrder: ["bloc-a", "bloc-b"],
    defaultGroupId: "bloc-a",
    profiles: {
      [USER_ID]: { id: USER_ID, email: "aadhil@example.com", displayName: USER }
    },
    meta: { revision: 1, updatedAt: new Date().toISOString() }
  };
}

function addLog(current, groupId, workoutType = "Gym") {
  return applyAddLog(current, {
    groupId,
    actor: USER,
    actorUserId: USER_ID,
    workoutType,
    date: TODAY,
    note: "Two-workout test",
    photoUrl: "https://example.com/workout.jpg"
  }).updated;
}

// A same-named person in an unrelated Bloc must not consume this account's
// slots. The backend reads the global state before canonical hydration, while
// the frontend helper must apply the same authenticated-identity boundary.
{
  const OTHER_USER_ID = "22222222-2222-4222-8222-222222222222";
  const current = state();
  current.groups["bloc-a"].logs[USER] = [{ id: "mine-one", date: TODAY, type: "Gym" }];
  current.groups["bloc-b"].memberships = {
    [OTHER_USER_ID]: { userId: OTHER_USER_ID, displayName: USER, role: "admin", joinedAt: null }
  };
  current.groups["bloc-b"].adminUserId = OTHER_USER_ID;
  current.groups["bloc-b"].logs[USER] = [
    { id: "theirs-one", date: TODAY, type: "Gym" },
    { id: "theirs-two", date: TODAY, type: "Gym" }
  ];
  current.profiles[OTHER_USER_ID] = { id: OTHER_USER_ID, email: "other@example.com", displayName: USER };
  assert.equal(getDistinctWorkoutCountForDate(current, USER, USER_ID, TODAY), 1,
    "another authenticated account's same-name logs must not consume my slots");
  assert.equal(getFrontendWorkoutCount(current.groups, USER_ID, USER, TODAY), 1,
    "the modal must count only this authenticated account's memberships");
  const updated = addLog(current, "bloc-a", "Run");
  assert.equal(updated.groups["bloc-a"].logs[USER].length, 2);
  assert.equal(updated.groups["bloc-b"].logs[USER].length, 2,
    "logging must leave the other same-named person's workouts unchanged");
}

// Two genuine workouts on the same date count separately, including the same type.
{
  let current = state();
  current = addLog(current, "bloc-a", "Gym");
  assert.equal(getDistinctWorkoutCountForDate(current, USER, USER_ID, TODAY), 1);
  current = addLog(current, "bloc-a", "Gym");
  assert.equal(getDistinctWorkoutCountForDate(current, USER, USER_ID, TODAY), 2);
  assert.equal(getFrontendWorkoutCount(current.groups, USER_ID, USER, TODAY), 2);
  assert.equal(current.groups["bloc-a"].logs[USER].length, 2);
  assert.throws(
    () => addLog(current, "bloc-a", "Run"),
    error => error.status === 409 && error.message === "Already logged 2 workouts for this date"
  );
}

// The cap is global across Blocs, not two workouts per Bloc.
{
  let current = state();
  current = addLog(current, "bloc-a", "Run");
  current = addLog(current, "bloc-b", "Gym");
  assert.equal(getDistinctWorkoutCountForDate(current, USER, USER_ID, TODAY), 2);
  assert.throws(() => addLog(current, "bloc-a", "Gym"), error => error.status === 409);
}

// One workout copied into two Blocs consumes one slot; a second copied workout
// consumes the second slot. Both copies retain the same logical workout key.
{
  let current = state();
  current = applyMultiLog(current, {
    sourceGroupId: "bloc-a",
    targetGroupIds: ["bloc-b"],
    actor: USER,
    actorUserId: USER_ID,
    workoutType: "Gym",
    date: TODAY,
    note: "Morning gym",
    photoUrl: "https://example.com/morning.jpg"
  });
  const firstSource = current.groups["bloc-a"].logs[USER][0];
  const firstTarget = current.groups["bloc-b"].logs[USER][0];
  assert.equal(getWorkoutSessionKey(firstSource), getWorkoutSessionKey(firstTarget));
  assert.equal(getDistinctWorkoutCountForDate(current, USER, USER_ID, TODAY), 1);

  current = applyMultiLog(current, {
    sourceGroupId: "bloc-a",
    targetGroupIds: ["bloc-b"],
    actor: USER,
    actorUserId: USER_ID,
    workoutType: "Gym",
    date: TODAY,
    note: "Evening gym",
    photoUrl: "https://example.com/evening.jpg"
  });
  assert.equal(current.groups["bloc-a"].logs[USER].length, 2);
  assert.equal(current.groups["bloc-b"].logs[USER].length, 2);
  assert.equal(getDistinctWorkoutCountForDate(current, USER, USER_ID, TODAY), 2);
  assert.throws(
    () => applyMultiLog(current, {
      sourceGroupId: "bloc-a",
      targetGroupIds: ["bloc-b"],
      actor: USER,
      actorUserId: USER_ID,
      workoutType: "Gym",
      date: TODAY,
      note: "Third gym",
      photoUrl: "https://example.com/third.jpg"
    }),
    error => error.status === 409
  );
}

// Existing workout-type eligibility still applies to the second workout.
{
  const current = applyMultiLog(state(), {
    sourceGroupId: "bloc-a",
    targetGroupIds: ["bloc-b"],
    actor: USER,
    actorUserId: USER_ID,
    workoutType: "Run",
    date: TODAY,
    note: "Evening run",
    photoUrl: "https://example.com/run.jpg"
  });
  assert.equal(current.groups["bloc-a"].logs[USER].length, 1);
  assert.equal(current.groups["bloc-b"].logs[USER].length, 0);
  assert.equal(getDistinctWorkoutCountForDate(current, USER, USER_ID, TODAY), 1);
}

console.log("Two-workouts-per-day checks passed.");
