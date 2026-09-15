// Activities a member picks when logging a workout.
//
// Each activity belongs to one of the five workout categories. The category is
// what a log's `type` keeps holding, so Bloc rules (accepted workout types),
// multi-Bloc logging, the daily cap, month close and share stickers all carry on
// reading the category unchanged. The activity is stored alongside it as
// `log.activity`.
//
// api/lift-log.js keeps its own copy of the name → category map
// (ACTIVITY_CATEGORIES); `npm run test:activities` fails if the two drift.

const ACTIVITIES = [
  { name: "Gym", category: "Gym" },
  { name: "Run", category: "Run" },
  { name: "Pilates", category: "Pilates" },
  { name: "Yoga", category: "Pilates" },
  { name: "Basketball", category: "Sports" },
  { name: "Football", category: "Sports" },
  { name: "Cricket", category: "Sports" },
  { name: "Tennis", category: "Sports" },
  { name: "Padel", category: "Sports" },
  { name: "Pickleball", category: "Sports" },
  { name: "Golf", category: "Sports" },
  { name: "Volleyball", category: "Sports" },
  { name: "Hiking", category: "Other" },
  { name: "Swimming", category: "Other" },
  { name: "Cycling", category: "Other" },
  { name: "Rowing", category: "Other" },
  { name: "Home Workout", category: "Other" },
  { name: "Kitesurfing", category: "Other" },
  { name: "Other", category: "Other" }
];

// What a member with no history sees first.
const NEW_MEMBER_ACTIVITIES = ["Gym", "Run", "Hiking", "Basketball", "Pilates"];

const TOP_ACTIVITY_COUNT = 5;

const ACTIVITY_BY_KEY = new Map(ACTIVITIES.map(activity => [activity.name.toLowerCase(), activity]));

function normalizeActivityName(name) {
  const key = String(name || "").trim().toLowerCase();
  return ACTIVITY_BY_KEY.get(key)?.name || null;
}

function getActivityCategory(name) {
  const activity = ACTIVITY_BY_KEY.get(String(name || "").trim().toLowerCase());
  return activity ? activity.category : null;
}

// Only the catch-all asks for a description. Named activities in the Other
// category (Hiking, Swimming…) are already specific.
function activityNeedsNote(name) {
  return normalizeActivityName(name) === "Other";
}

// Logs saved before activities existed only have a category. Gym, Run, Pilates
// and Other are activities of the same name; an old Sports log never said which
// sport, so it has no activity.
function getLogActivity(log) {
  const stored = normalizeActivityName(log?.activity);
  if (stored) return stored;
  const type = String(log?.type || "");
  return type === "Sports" ? null : normalizeActivityName(type);
}

function getSessionKey(log) {
  const id = String(log?.id || "").trim();
  if (!id) return "";
  const match = id.match(/^(\d{10,})(?:-|$)/);
  return match ? match[1] : id;
}

// How often this member has logged each activity, across every Bloc they are in
// and the closed months kept on those Blocs. A workout logged to several Blocs
// counts once.
function countMemberActivities(groups, userId) {
  const safeUserId = String(userId || "").trim();
  const seen = new Set();
  const counts = {};
  const add = log => {
    const activity = getLogActivity(log);
    if (!activity) return;
    const key = `${getSessionKey(log)}|${log?.date || ""}`;
    if (seen.has(key)) return;
    seen.add(key);
    counts[activity] = (counts[activity] || 0) + 1;
  };
  (Array.isArray(groups) ? groups : Object.values(groups || {})).forEach(group => {
    const owner = String(group?.memberships?.[safeUserId]?.displayName || "").trim();
    if (!safeUserId || !owner) return;
    (group?.logs?.[owner] || []).forEach(add);
    (Array.isArray(group?.monthHistory) ? group.monthHistory : []).forEach(month => {
      (month?.logsByUser?.[owner] || []).forEach(add);
    });
  });
  return counts;
}

// The member's most-logged activities, limited to what this Bloc counts. Ties
// break by the starting list and then the list order, so the tiles only move when
// a count genuinely overtakes another. Gaps fill from the starting list.
function getTopActivities(counts, acceptedCategories, limit = TOP_ACTIVITY_COUNT) {
  const accepted = new Set(acceptedCategories || []);
  const allowed = ACTIVITIES.filter(activity => accepted.has(activity.category)).map(activity => activity.name);
  const rank = name => {
    const starting = NEW_MEMBER_ACTIVITIES.indexOf(name);
    return starting === -1 ? NEW_MEMBER_ACTIVITIES.length + allowed.indexOf(name) : starting;
  };
  const used = allowed
    .filter(name => (counts?.[name] || 0) > 0)
    .sort((a, b) => (counts[b] - counts[a]) || (rank(a) - rank(b)));
  const top = used.slice(0, limit);
  for (const name of [...NEW_MEMBER_ACTIVITIES, ...allowed]) {
    if (top.length >= limit) break;
    if (allowed.includes(name) && !top.includes(name)) top.push(name);
  }
  return top;
}

export {
  ACTIVITIES,
  NEW_MEMBER_ACTIVITIES,
  TOP_ACTIVITY_COUNT,
  normalizeActivityName,
  getActivityCategory,
  activityNeedsNote,
  getLogActivity,
  countMemberActivities,
  getTopActivities
};
