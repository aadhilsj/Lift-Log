// Cross-Bloc profile statistics.
//
// Shared by the account profile (your own, across all your Blocs) and the
// in-Bloc member profile (someone else, across the Blocs you share with them).
//
// SCOPE NOTE: readable state is scoped per viewer by scopeReadableStateForUser,
// so a client only ever holds its own Blocs. Stats for another member are
// therefore computed across SHARED Blocs only — never their full history. This
// is both the only thing computable client-side and the privacy-preserving
// default.
//
// PRIVACY CONSTRAINT: this returns aggregate numbers only and must never
// expose another Bloc's name. A Bloc count is fine; naming them would reveal
// someone's social graph. Do not add names here without a viewer gate.

import {
  MIN_TARGET,
  WORKOUT_TYPES,
  calcPenalties,
  getCountedLogs
} from "./appState.js";

const FULL_MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const dayIso = s => { const m = /^(\d{4}-\d{2}-\d{2})/.exec(String(s || "")); return m ? m[1] : null; };

function buildProfileStats({ groups = [], userId }) {
  const myGroups = (groups || []).map(g => {
    const mem = Object.values(g.memberships || {}).find(m => m.userId === userId);
    return mem ? { group: g, myName: mem.displayName, joinedAt: mem.joinedAt } : null;
  }).filter(Boolean);

  const agg = (() => {
    let blocWins = 0, earliestJoined = null, earliestWorkout = null, targetHitMonths = 0, targetEligibleMonths = 0;
    const dayTypeMax = {};
    myGroups.forEach(({ group, myName, joinedAt }) => {
      const jt = Date.parse(joinedAt || "");
      if (Number.isFinite(jt) && (earliestJoined === null || jt < earliestJoined)) earliestJoined = jt;
      // Per-day, per-type counts WITHIN this Bloc (real workouts, incl. 2-a-days).
      const groupDayType = {};
      const tally = logs => logs.forEach(l => {
        const iso = dayIso(l.date); if (!iso) return;
        const ts = Date.parse(`${iso}T00:00:00`);
        if (Number.isFinite(ts) && (earliestWorkout === null || ts < earliestWorkout)) earliestWorkout = ts;
        const t = l.type || "Other";
        if (!groupDayType[iso]) groupDayType[iso] = {};
        groupDayType[iso][t] = (groupDayType[iso][t] || 0) + 1;
      });
      const curLogs = getCountedLogs(group.logs?.[myName] || []);
      tally(curLogs);
      (group.monthHistory || []).forEach(m => {
        const histLogs = getCountedLogs(m.logsByUser?.[myName] || []);
        tally(histLogs);
        const participated = Object.prototype.hasOwnProperty.call(m.counts || {}, myName) || histLogs.length > 0;
        const excused = !!m.excused?.[myName];
        if (participated && !excused) {
          const target = m.memberTargets?.[myName] || m.settings?.minTarget || MIN_TARGET;
          const count = Number(m.counts?.[myName] ?? histLogs.length) || 0;
          targetEligibleMonths += 1;
          if (count >= target) targetHitMonths += 1;
        }
        const activeCounts = Object.keys(m.counts || {})
          .filter(n => !m.excused?.[n])
          .map(n => ({ name: n, count: Number(m.counts[n] || 0), target: m.memberTargets?.[n] || m.settings?.minTarget || MIN_TARGET }));
        const penalties = calcPenalties(activeCounts, m.settings || {});
        if (penalties.winners.find(w => w.name === myName)) blocWins += 1;
      });
      // Merge into the cross-Bloc max: the same session logged in several Blocs
      // collapses (max), while genuine multiple workouts on a day survive.
      Object.entries(groupDayType).forEach(([iso, types]) => {
        if (!dayTypeMax[iso]) dayTypeMax[iso] = {};
        Object.entries(types).forEach(([t, c]) => { dayTypeMax[iso][t] = Math.max(dayTypeMax[iso][t] || 0, c); });
      });
    });

    const logsByDate = {}, monthTotals = {}, weekday = [0,0,0,0,0,0,0], typeMix = {};
    WORKOUT_TYPES.forEach(t => { typeMix[t] = 0; });
    let workoutsLogged = 0;
    Object.entries(dayTypeMax).forEach(([iso, types]) => {
      const n = Object.values(types).reduce((a, b) => a + b, 0);
      logsByDate[iso] = n;
      const monthKey = iso.slice(0, 7);
      monthTotals[monthKey] = (monthTotals[monthKey] || 0) + n;
      workoutsLogged += n;
      weekday[new Date(`${iso}T00:00:00`).getDay()] += n;
      Object.entries(types).forEach(([t, c]) => { typeMix[t] = (typeMix[t] || 0) + c; });
    });

    const anyLogs = Object.keys(logsByDate).length > 0;
    const wmax = Math.max(...weekday), wmin = Math.min(...weekday);
    const bestIdx = anyLogs && wmax > 0 ? weekday.indexOf(wmax) : -1;
    const worstIdx = anyLogs && wmax > wmin ? weekday.indexOf(wmin) : -1;
    const bestMonthEntry = Object.entries(monthTotals).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
    const bestMonth = bestMonthEntry ? {
      key: bestMonthEntry[0],
      count: bestMonthEntry[1],
      label: FULL_MONTH_NAMES[Number(bestMonthEntry[0].slice(5, 7)) - 1]
    } : null;
    return { workoutsLogged, blocWins, earliestJoined, earliestWorkout, targetHitMonths, targetEligibleMonths, bestMonth, weekday,
      bestIdx, worstIdx, typeMix, logsByDate, anyLogs };
  })();
  return { myGroups, agg };
}

export { buildProfileStats };
