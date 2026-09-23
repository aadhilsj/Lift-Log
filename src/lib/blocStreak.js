// The Bloc's daily streak: how many days in a row somebody in the Bloc logged a
// workout. It reads the dates on the workouts, not when they were saved, so a
// workout logged late still repairs the day it belongs to.
//
// A Fero day ends at 3am in the Bloc's time zone (LEAGUE_CUTOFF_HOUR in
// appState.js), so "today" here is the Bloc's day, not the device's.
import { getCountedLogs, getMonthPartsFromKey } from "./appState.js";

const isoOf = date => `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
const dayBefore = iso => {
  const [year, month, day] = String(iso).split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() - 1);
  return isoOf(date);
};

// Every date anybody in the Bloc logged a counted workout on: this month's logs
// plus every closed month's frozen logs.
export function blocLogDates({ logs = {}, monthHistory = [] } = {}) {
  const dates = new Set();
  const add = entries => {
    for (const log of getCountedLogs(entries)) {
      const date = String(log?.date || "").slice(0, 10);
      if (date) dates.add(date);
    }
  };
  for (const entries of Object.values(logs || {})) add(entries);
  for (const month of monthHistory || []) {
    if (!getMonthPartsFromKey(month?.key)) continue;
    for (const entries of Object.values(month?.logsByUser || {})) add(entries);
  }
  return dates;
}

// `days` counts back from today, or from yesterday when nobody has logged yet
// today — the day is not lost until it ends. `aliveToday` says whether today is
// already covered.
export function blocStreak({ logs, monthHistory, todayIso }) {
  const dates = blocLogDates({ logs, monthHistory });
  const aliveToday = dates.has(todayIso);
  let cursor = aliveToday ? todayIso : dayBefore(todayIso);
  let days = 0, first = "";
  while (dates.has(cursor)) {
    days += 1;
    first = cursor;
    cursor = dayBefore(cursor);
    if (days > 4000) break;
  }
  return { days, aliveToday, since: first };
}

// The card is earned, not furniture: it appears at ten days and disappears if
// the chain breaks, until the Bloc builds back to ten.
export const BLOC_STREAK_MIN_DAYS = 10;
// Nobody has logged and the Bloc's evening is gone: warn, but only while the
// day can still be saved.
export const BLOC_STREAK_WARN_HOUR = 19;
export function blocStreakView({ logs, monthHistory, todayIso, blocHour }) {
  const { days, aliveToday, since } = blocStreak({ logs, monthHistory, todayIso });
  if (days < BLOC_STREAK_MIN_DAYS) return null;
  // Between midnight and 3am the Bloc day is still yesterday's, so the honest
  // deadline to name is 3am, not midnight.
  const pastMidnight = blocHour < 3;
  const atRisk = !aliveToday && (pastMidnight || blocHour >= BLOC_STREAK_WARN_HOUR);
  return { days, aliveToday, since, atRisk, pastMidnight };
}
