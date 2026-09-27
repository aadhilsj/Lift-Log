// The Bloc daily streak: counted from the dates on workouts, shown only at ten
// days, and warned about only while the day can still be saved.
import assert from "node:assert/strict";
import { blocStreak, blocStreakView, BLOC_STREAK_MIN_DAYS, BLOC_STREAK_WARN_HOUR } from "../src/lib/blocStreak.js";

const log = (date, owner = "Riley") => ({ id: `${owner}-${date}`, date, ownerDisplayName: owner, type: "Gym" });
const days = (fromIso, count) => {
  const [y, m, d] = fromIso.split("-").map(Number);
  return Array.from({ length: count }, (_, i) => {
    const date = new Date(Date.UTC(y, m - 1, d - i));
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
  });
};
const TODAY = "2026-09-22";
const checks = [];
const check = (name, fn) => { fn(); checks.push(name); };

check("counts consecutive days ending today", () => {
  const logs = { Riley: days(TODAY, 12).map(d => log(d)) };
  const streak = blocStreak({ logs, monthHistory: [], todayIso: TODAY });
  assert.equal(streak.days, 12);
  assert.equal(streak.aliveToday, true);
  assert.equal(streak.since, "2026-09-11");
});

check("a gap ends the streak", () => {
  const logs = { Riley: [...days(TODAY, 3), "2026-09-18", "2026-09-17"].map(d => log(d)) };
  assert.equal(blocStreak({ logs, monthHistory: [], todayIso: TODAY }).days, 3);
});

check("nobody yet today: the streak still stands", () => {
  const logs = { Riley: days("2026-09-21", 11).map(d => log(d)) };
  const streak = blocStreak({ logs, monthHistory: [], todayIso: TODAY });
  assert.equal(streak.days, 11);
  assert.equal(streak.aliveToday, false);
});

check("any member keeps the day alive", () => {
  const logs = { Riley: [log("2026-09-22")], Jo: [log("2026-09-21", "Jo")], Sam: [log("2026-09-20", "Sam")] };
  assert.equal(blocStreak({ logs, monthHistory: [], todayIso: TODAY }).days, 3);
});

check("a workout logged late repairs its own day", () => {
  const broken = { Riley: [...days(TODAY, 2), ...days("2026-09-19", 9)].map(d => log(d)) };
  assert.equal(blocStreak({ logs: broken, monthHistory: [], todayIso: TODAY }).days, 2);
  const repaired = { Riley: [...broken.Riley, log("2026-09-20")] };
  assert.equal(blocStreak({ logs: repaired, monthHistory: [], todayIso: TODAY }).days, 12);
});

check("closed months count too", () => {
  const logs = { Riley: days(TODAY, 22).map(d => log(d)) };
  const monthHistory = [{ key: "2026-7", logsByUser: { Riley: days("2026-08-31", 10).map(d => log(d)) } }];
  assert.equal(blocStreak({ logs, monthHistory, todayIso: TODAY }).days, 32);
});

check("deleted and rejected workouts do not hold a day", () => {
  const logs = { Riley: [...days(TODAY, 3).map(d => log(d)), { ...log("2026-09-19"), flagStatus: "rejected" }, log("2026-09-18")] };
  assert.equal(blocStreak({ logs, monthHistory: [], todayIso: TODAY }).days, 3);
});

check("no card under ten days", () => {
  const logs = { Riley: days(TODAY, BLOC_STREAK_MIN_DAYS - 1).map(d => log(d)) };
  assert.equal(blocStreakView({ logs, monthHistory: [], todayIso: TODAY, blocHour: 21 }), null);
});

check("the card appears at ten", () => {
  const logs = { Riley: days(TODAY, BLOC_STREAK_MIN_DAYS).map(d => log(d)) };
  const view = blocStreakView({ logs, monthHistory: [], todayIso: TODAY, blocHour: 21 });
  assert.equal(view.days, BLOC_STREAK_MIN_DAYS);
  assert.equal(view.atRisk, false, "somebody trained today, so nothing is at risk");
});

check("the warning waits for the evening", () => {
  const logs = { Riley: days("2026-09-21", 14).map(d => log(d)) };
  const morning = blocStreakView({ logs, monthHistory: [], todayIso: TODAY, blocHour: 9 });
  assert.equal(morning.atRisk, false);
  assert.equal(blocStreakView({ logs, monthHistory: [], todayIso: TODAY, blocHour: BLOC_STREAK_WARN_HOUR - 1 }).atRisk, false);
  assert.equal(blocStreakView({ logs, monthHistory: [], todayIso: TODAY, blocHour: BLOC_STREAK_WARN_HOUR }).atRisk, true);
});

check("after midnight the deadline is 3am", () => {
  const logs = { Riley: days("2026-09-21", 14).map(d => log(d)) };
  const view = blocStreakView({ logs, monthHistory: [], todayIso: TODAY, blocHour: 1 });
  assert.equal(view.atRisk, true);
  assert.equal(view.pastMidnight, true);
});

check("no logs at all", () => {
  assert.equal(blocStreak({ logs: {}, monthHistory: [], todayIso: TODAY }).days, 0);
  assert.equal(blocStreakView({ logs: {}, monthHistory: [], todayIso: TODAY, blocHour: 20 }), null);
});

console.log(`bloc streak: ${checks.length} checks passed`);
