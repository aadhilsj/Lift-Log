// A prorated target must never exceed the full target.
//
// Proration means "you joined part-way through the month, so you owe less".
// A prorated target ABOVE the full one is not a smaller share of anything.
//
// It drifts because proration is computed once, when the admin chooses it, and
// nothing recomputes it if the Bloc target later changes -- the settings-update
// path never touches season_overrides. Active divas sat on a prorated 12
// against a target of 11 (handover-2026-10-29-for-deveen-active.md §9).
//
// Clamped on read rather than recomputed on write: no migration, it repairs
// rows that are already wrong, and it cannot move a target under a member
// mid-month.
//
// Offline. Usage: node scripts/test-prorated-target-clamp.mjs

import { getEffectiveTargetForMonth } from "../api/lift-log.js";

let failures = 0;
const check = (label, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures += 1;
  console.log(`${ok ? "[PASS]" : "[FAIL]"} ${label}${ok ? "" : ` — got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`}`);
};

const MONTH = "2026-10";
const mkGroup = (minTarget, override) => ({
  settings: { minTarget, timeZone: "UTC" },
  seasonOverrides: override ? { [MONTH]: override } : {}
});
const prorated = proratedMas => ({ prorated: true, proratedMas, chosenAt: "2026-11-02T10:00:00Z", chosenBy: "Ana" });

// --- The reported bug --------------------------------------------------------
{
  // Active divas: prorated 12 against a target of 11, after the Bloc lowered
  // its target mid-month.
  check("prorated above the full target is clamped to it",
    getEffectiveTargetForMonth(mkGroup(11, prorated(12)), MONTH), 11);
}

// --- Proration still works when it is genuinely smaller ----------------------
{
  check("a real prorated share is left alone",
    getEffectiveTargetForMonth(mkGroup(15, prorated(7)), MONTH), 7);
  check("equal to the full target is left alone",
    getEffectiveTargetForMonth(mkGroup(12, prorated(12)), MONTH), 12);
}

// --- No override at all ------------------------------------------------------
{
  check("no override: the full target",
    getEffectiveTargetForMonth(mkGroup(14, null), MONTH), 14);
  check("an override that did not prorate: the full target",
    getEffectiveTargetForMonth(mkGroup(14, { prorated: false, proratedMas: 3 }), MONTH), 14);
}

// --- Direction of a later target change --------------------------------------
// Lowering converges everyone on the lower number, which nobody can be hurt by.
// Raising leaves the prorated share where it was, because joining late should
// not retroactively cost more.
{
  check("target lowered under a prorated member: converges down",
    getEffectiveTargetForMonth(mkGroup(8, prorated(10)), MONTH), 8);
  check("target raised over a prorated member: share unchanged",
    getEffectiveTargetForMonth(mkGroup(20, prorated(10)), MONTH), 10);
}

// --- The settings override argument takes the same path ----------------------
// Callers pass a pending settings object when previewing a change; the clamp
// has to use that target, not the stored one, or a preview would show a target
// the member can never actually be held to.
{
  check("settingsOverride is what gets clamped against",
    getEffectiveTargetForMonth(mkGroup(20, prorated(12)), MONTH, { minTarget: 9 }), 9);
}

// --- Floors ------------------------------------------------------------------
{
  check("a prorated target never drops below 1",
    getEffectiveTargetForMonth(mkGroup(10, prorated(0)), MONTH), 1);
  check("a fractional prorated target is rounded, then clamped",
    getEffectiveTargetForMonth(mkGroup(6, prorated(7.4)), MONTH), 6);
}

console.log(failures === 0 ? "\nAll prorated-target clamp checks passed." : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
