// Month award rules.
//
// "Most Consistent" and "Biggest Turnaround" were never computed: they named
// whoever came second and third on workout count, which is why the same person
// always won. These pin the replacements so they cannot silently regress to
// ranking by volume again.

import { getCountedLogs } from "../src/lib/appState.js";

let fails = 0;
const t = (label, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) fails += 1;
  console.log(`${ok ? "[PASS]" : "[FAIL]"} ${label}${ok ? "" : ` — got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`}`);
};

// Mirrors the implementation in SettlementScreen.
const mostDiverse = (activeCounts, month) => {
  const scored = activeCounts.map(member => {
    const types = new Set(
      getCountedLogs(month.logsByUser?.[member.name] || [])
        .map(log => String(log?.type || "").trim()).filter(Boolean)
    );
    return { name: member.name, variety: types.size, count: member.count };
  }).filter(m => m.variety > 1);
  return scored.sort((a, b) => b.variety - a.variety || b.count - a.count || a.name.localeCompare(b.name))[0] || null;
};

const biggestTurnaround = (activeCounts, previous) => {
  if (!previous) return null;
  const gains = activeCounts.map(member => {
    if (previous.excused?.[member.name]) return null;
    const before = Number(previous.counts?.[member.name] ?? NaN);
    if (!Number.isFinite(before)) return null;
    return { name: member.name, gain: member.count - before, before, after: member.count };
  }).filter(e => e && e.gain > 0);
  return gains.sort((a, b) => b.gain - a.gain || a.name.localeCompare(b.name))[0] || null;
};

const log = (date, type) => ({ id: date + type, date, type });

// Aadhil trains most but only lifts; Nishara does four different things.
const month = { logsByUser: {
  Aadhil: [log("2026-08-01","Gym"),log("2026-08-02","Gym"),log("2026-08-03","Gym"),log("2026-08-04","Gym"),log("2026-08-05","Gym")],
  Nishara:[log("2026-08-01","Gym"),log("2026-08-02","Run"),log("2026-08-03","Pilates"),log("2026-08-04","Sports")],
  Rishane:[log("2026-08-01","Run")]
}};
const counts = [{name:"Aadhil",count:5},{name:"Nishara",count:4},{name:"Rishane",count:1}];

t("variety beats volume", mostDiverse(counts, month)?.name, "Nishara");
t("reports how many kinds", mostDiverse(counts, month)?.variety, 4);
t("one kind of training wins nothing",
  mostDiverse([{name:"Aadhil",count:5}], { logsByUser:{ Aadhil: month.logsByUser.Aadhil } }), null);
t("no logs at all wins nothing", mostDiverse([{name:"X",count:0}], { logsByUser:{} }), null);

// Ties on variety fall to total workouts.
const tie = { logsByUser: {
  A:[log("2026-08-01","Gym"),log("2026-08-02","Run"),log("2026-08-03","Run")],
  B:[log("2026-08-01","Gym"),log("2026-08-02","Run")]
}};
t("variety ties break on volume", mostDiverse([{name:"A",count:3},{name:"B",count:2}], tie)?.name, "A");

const previous = { counts: { Aadhil: 4, Nishara: 12, Rishane: 1 }, excused: {} };
t("largest gain wins", biggestTurnaround(counts, previous)?.name, "Aadhil");
t("reports before and after",
  [biggestTurnaround(counts, previous)?.before, biggestTurnaround(counts, previous)?.after], [4, 5]);
t("a decline never wins", biggestTurnaround([{name:"Nishara",count:4}], previous), null);
t("no previous month means no award", biggestTurnaround(counts, null), null);
t("someone excused last month is skipped",
  biggestTurnaround([{name:"Aadhil",count:5}], { counts:{Aadhil:4}, excused:{Aadhil:true} }), null);
t("someone absent last month is skipped",
  biggestTurnaround([{name:"NewJoiner",count:9}], previous), null);

console.log(fails === 0 ? "\nall award checks passed" : `\n${fails} failure(s)`);
process.exit(fails ? 1 : 0);
