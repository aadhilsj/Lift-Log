import assert from "node:assert/strict";
import {
  applyAddLog,
  applyMultiLog,
  getDistinctWorkoutCountForDate,
  findRepeatedWorkoutSave,
  isMissingLocalCanonicalWorkoutRpcError,
  getWorkoutSessionKey
} from "../api/lift-log.js";
import {
  getDistinctWorkoutCountForDate as getFrontendWorkoutCount,
  countWorkoutsInDayMap,
  findWorkoutCopiesInOtherBlocs,
  formatDayWorkoutCount
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

function addLog(current, groupId, workoutType = "Gym", activity = null) {
  return applyAddLog(current, {
    groupId,
    actor: USER,
    actorUserId: USER_ID,
    workoutType,
    ...(activity ? { activity } : {}),
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

// ── The cap is TWO PER ACTIVITY, not two per day ────────────────────────────
// Founder's decision, 22 October 2026: log as many workouts a day as you like,
// but no more than two of the same activity. These cases are his own examples.
{
  let current = state();
  current = addLog(current, "bloc-a", "Gym");
  assert.equal(getDistinctWorkoutCountForDate(current, USER, USER_ID, TODAY), 1);
  current = addLog(current, "bloc-a", "Gym");
  assert.equal(getDistinctWorkoutCountForDate(current, USER, USER_ID, TODAY), 2);
  assert.equal(getFrontendWorkoutCount(current.groups, USER_ID, USER, TODAY), 2);

  // A third GYM is refused, and the message names the activity so it is clear
  // something else may still be logged.
  assert.throws(
    () => addLog(current, "bloc-a", "Gym"),
    error => error.status === 409 && /Already logged 2 Gym workouts for this date/.test(error.message),
    "a third session of the same activity must be refused, by name"
  );

  // A Run on the same day is fine - this is the whole point of the change.
  current = addLog(current, "bloc-a", "Run");
  assert.equal(getDistinctWorkoutCountForDate(current, USER, USER_ID, TODAY), 3,
    "a different activity is not capped by the first one");
  current = addLog(current, "bloc-a", "Run");
  assert.equal(getDistinctWorkoutCountForDate(current, USER, USER_ID, TODAY), 4,
    "two of each activity, so four workouts in a day is allowed");
  assert.throws(() => addLog(current, "bloc-a", "Run"), error => error.status === 409,
    "but a third Run is still refused");
}

// Two activities that share a CATEGORY still count apart. This is the case the
// whole change turns on: Padel, Tennis and Basketball are all "Sports", so a
// cap keyed on the type would have treated three different sports as three of
// the same thing. It keys on the activity instead.
{
  let current = state();
  current = addLog(current, "bloc-a", "Sports", "Padel");
  current = addLog(current, "bloc-a", "Sports", "Padel");
  assert.throws(
    () => addLog(current, "bloc-a", "Sports", "Padel"),
    error => error.status === 409 && /Already logged 2 Padel workouts/.test(error.message),
    "a third Padel is refused, by name"
  );
  current = addLog(current, "bloc-a", "Sports", "Tennis");
  current = addLog(current, "bloc-a", "Sports", "Tennis");
  assert.equal(getDistinctWorkoutCountForDate(current, USER, USER_ID, TODAY), 4,
    "Tennis is not capped by Padel even though both are Sports");
  current = addLog(current, "bloc-a", "Sports", "Basketball");
  assert.equal(getDistinctWorkoutCountForDate(current, USER, USER_ID, TODAY), 5,
    "and Basketball is a third distinct Sport on the same day");
  assert.throws(() => addLog(current, "bloc-a", "Sports", "Tennis"), error => error.status === 409,
    "but a third Tennis is refused");
}

// The per-activity cap is still GLOBAL across Blocs: it is your day, not the
// Bloc's. Two gym sessions anywhere means no third gym session anywhere.
{
  let current = state();
  current = addLog(current, "bloc-a", "Gym");
  current = addLog(current, "bloc-b", "Gym");
  assert.equal(getDistinctWorkoutCountForDate(current, USER, USER_ID, TODAY), 2);
  assert.throws(() => addLog(current, "bloc-a", "Gym"), error => error.status === 409,
    "the second Bloc does not grant a fresh pair of gym slots");
  // ...but a Run is still fine. (bloc-b only accepts Gym in this fixture, so
  // the Run goes to bloc-a - the point is that the activity, not the Bloc,
  // decides.)
  current = addLog(current, "bloc-a", "Run");
  assert.equal(getDistinctWorkoutCountForDate(current, USER, USER_ID, TODAY), 3);
}

// Counting by activity must not count a different activity. The per-activity
// counter is what the log screen uses to decide whether to block.
{
  let current = state();
  current = addLog(current, "bloc-a", "Gym");
  current = addLog(current, "bloc-a", "Run");
  assert.equal(getDistinctWorkoutCountForDate(current, USER, USER_ID, TODAY, "gym"), 1);
  assert.equal(getDistinctWorkoutCountForDate(current, USER, USER_ID, TODAY, "run"), 1);
  assert.equal(getDistinctWorkoutCountForDate(current, USER, USER_ID, TODAY, "padel"), 0);
  assert.equal(getDistinctWorkoutCountForDate(current, USER, USER_ID, TODAY), 2,
    "no activity means every activity, as it did before");
  assert.equal(getFrontendWorkoutCount(current.groups, USER_ID, USER, TODAY, "gym"), 1,
    "the modal counter agrees with the backend counter");
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

// A repeated save is the same photo on the same date for the same member.
// Anything else is a real workout and must reach the cap check as before.
{
  const photo = "https://example.test/workout-photos/u1/1789284663000-111111.jpg";
  const repeatState = {
    groups: {
      bloc: {
        logs: {
          Varun: [{ id: "1789284665238234", date: "2026-09-12", type: "Gym", photoUrl: photo }],
          Other: [{ id: "1789284665238299", date: "2026-09-12", type: "Gym", photoUrl: "https://example.test/other.jpg" }]
        }
      }
    }
  };
  assert.ok(
    findRepeatedWorkoutSave(repeatState, "bloc", "Varun", "2026-09-12", photo),
    "the same photo saved again for the same date is a repeat"
  );
  assert.equal(
    findRepeatedWorkoutSave(repeatState, "bloc", "Varun", "2026-09-12", "https://example.test/workout-photos/u1/1789300000000-222222.jpg"),
    null,
    "a second workout the same day has its own photo and must not be treated as a repeat"
  );
  assert.equal(
    findRepeatedWorkoutSave(repeatState, "bloc", "Varun", "2026-09-13", photo),
    null,
    "the same photo on another date is not a repeat"
  );
  assert.equal(
    findRepeatedWorkoutSave(repeatState, "bloc", "Varun", "2026-09-12", ""),
    null,
    "a save without a photo can never be matched"
  );
  assert.equal(
    findRepeatedWorkoutSave(repeatState, "bloc", "Other", "2026-09-12", photo),
    null,
    "another member's photo is never a repeat of yours"
  );
  assert.equal(
    findRepeatedWorkoutSave(repeatState, "missing-bloc", "Varun", "2026-09-12", photo),
    null,
    "an unknown Bloc is not a repeat"
  );
}

// Deleting a multi-Bloc workout offers to remove its copies elsewhere. A copy
// is the same session on the same date, found under the member's own name in
// each Bloc, never another member's workout and never a separate session.
{
  const u = "user-1";
  const blocs = [
    { id: "a", name: "Bloc A", memberships: { [u]: { displayName: "Aadhil" } }, logs: {
      Aadhil: [{ id: "1788888521665526", date: "2026-09-08", type: "Run" }, { id: "1788888600000000", date: "2026-09-08", type: "Gym" }]
    } },
    { id: "b", name: "Bloc B", memberships: { [u]: { displayName: "AJ" } }, logs: {
      AJ: [{ id: "1788888521665526-b", date: "2026-09-08", type: "Run" }],
      Aadhil: [{ id: "1788888521665526-b", date: "2026-09-08", type: "Run" }]
    } },
    { id: "c", name: "Bloc C", memberships: { [u]: { displayName: "Aadhil" } }, logs: {
      Aadhil: [{ id: "1788888600000000-c", date: "2026-09-08", type: "Gym" }]
    } },
    { id: "d", name: "Not mine", memberships: { "someone-else": { displayName: "Aadhil" } }, logs: {
      Aadhil: [{ id: "1788888521665526-d", date: "2026-09-08", type: "Run" }]
    } }
  ];
  const run = blocs[0].logs.Aadhil[0];
  assert.deepEqual(
    findWorkoutCopiesInOtherBlocs(blocs, "a", u, run),
    [{ groupId: "b", groupName: "Bloc B", owner: "AJ", logId: "1788888521665526-b" }],
    "finds the copy under the member's name in that Bloc, and only the same session"
  );
  assert.deepEqual(
    findWorkoutCopiesInOtherBlocs(blocs, "b", u, blocs[1].logs.AJ[0]).map(copy => copy.groupId),
    ["a"],
    "works from a copy back to the source Bloc"
  );
  assert.deepEqual(
    findWorkoutCopiesInOtherBlocs(blocs, "a", u, { id: "1788999999999999", date: "2026-09-08" }),
    [],
    "a single-Bloc workout has no copies"
  );
  assert.deepEqual(
    findWorkoutCopiesInOtherBlocs(blocs, "a", u, { ...run, date: "2026-09-09" }),
    [],
    "the same session key on another date is not a copy"
  );
  assert.deepEqual(findWorkoutCopiesInOtherBlocs(blocs, "a", "", run), [], "no user, no copies");
}

// ── The calendar day badge ──────────────────────────────────────────────────
// This was Math.min(count, 2) written inline in four places. It was correct
// while the cap was two a day, and on 23 October it silently became a lie: a
// day holding four workouts still reported "2", which is exactly what the
// founder said must stay visible. One definition now, and these pin it.
assert.equal(formatDayWorkoutCount(2), "2");
assert.equal(formatDayWorkoutCount(3), "3", "a third workout must not report as 2");
assert.equal(formatDayWorkoutCount(4), "4");
assert.equal(formatDayWorkoutCount(9), "9");
// Two digits do not fit the ~12px circle, so it caps the way the bell does.
assert.equal(formatDayWorkoutCount(10), "9+");
assert.equal(formatDayWorkoutCount(37), "9+");
// Junk in must not render "NaN" on a calendar.
assert.equal(formatDayWorkoutCount(0), "0");
assert.equal(formatDayWorkoutCount(-3), "0");
assert.equal(formatDayWorkoutCount(null), "0");
assert.equal(formatDayWorkoutCount(undefined), "0");
assert.equal(formatDayWorkoutCount("not a number"), "0");

console.log("Two-per-activity-per-day checks passed.");
