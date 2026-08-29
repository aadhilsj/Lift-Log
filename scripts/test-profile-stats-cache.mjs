// Cache semantics for cross-Bloc profile stats.
//
// Only the offline paths are covered here: a cache hit must not touch the
// network, a revision bump must drop every entry, and invalidating one member
// must leave the others alone. The request paths need a real session and are
// verified against a deployed preview instead.

import { fetchProfileStatsData, setProfileStatsRevision, invalidateProfileStatsFor, __primeProfileStatsCacheForTest } from "../src/lib/api.js";

let fails = 0;
const t = (label, cond) => { if (!cond) fails += 1; console.log(`${cond ? "[PASS]" : "[FAIL]"} ${label}`); };
const cachedRead = async id => {
  const result = await fetchProfileStatsData(id).catch(() => ({ ok: false }));
  return result?.cached === true;
};

setProfileStatsRevision(100);
__primeProfileStatsCacheForTest({ ok: true, userId: "u1", blocCount: 3, workoutsLogged: 100 });
__primeProfileStatsCacheForTest({ ok: true, userId: "u2", blocCount: 1, workoutsLogged: 20 });

t("cache hit returns without a request", await cachedRead("u1"));
t("second member also cached", await cachedRead("u2"));

invalidateProfileStatsFor("u1");
t("invalidated member is no longer cached", !(await cachedRead("u1")));
t("other members survive a targeted invalidation", await cachedRead("u2"));

setProfileStatsRevision(101);
t("revision bump drops every entry", !(await cachedRead("u2")));

setProfileStatsRevision(101);
__primeProfileStatsCacheForTest({ ok: true, userId: "u3", blocCount: 2, workoutsLogged: 50 });
setProfileStatsRevision(101);
t("re-setting the same revision keeps the cache", await cachedRead("u3"));

console.log(fails === 0 ? "\nall cache checks passed" : `\n${fails} failure(s)`);
process.exit(fails ? 1 : 0);
