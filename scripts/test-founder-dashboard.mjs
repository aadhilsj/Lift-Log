import assert from "node:assert/strict";
import fs from "node:fs";

process.env.FOUNDER_DASHBOARD_USER_IDS = "founder-one, founder-two";
const api = await import(`../api/lift-log.js?founder-dashboard-test=${Date.now()}`);

assert.equal(api.isFounderDashboardUser("founder-one"), true, "exact allowed founder id is accepted");
assert.equal(api.isFounderDashboardUser(" founder-two "), true, "surrounding caller whitespace cannot change an exact id");
assert.equal(api.isFounderDashboardUser("founder"), false, "partial founder id is denied");
assert.equal(api.isFounderDashboardUser("someone-else"), false, "unlisted user is denied");

const config = JSON.parse(fs.readFileSync(new URL("../vercel.json", import.meta.url), "utf8"));
assert.deepEqual(config.crons, [{
  path:"/api/cron-purge-app-daily-activity",
  schedule:"0 3 * * *"
}], "retention cron must use the dedicated protected endpoint");

const sql = fs.readFileSync(new URL("../supabase/ante-core-founder-dashboard.sql", import.meta.url), "utf8");
[
  "on delete cascade",
  "enable row level security",
  "revoke all on table ante_core.app_daily_activity from anon",
  "revoke execute on function public.read_ante_core_founder_dashboard(timestamptz) from public, anon, authenticated",
  "grant execute on function public.read_ante_core_founder_dashboard(timestamptz) to service_role",
  "v_thirty_day_start := v_today - 29",
  "Europe/Oslo",
  "purge_ante_core_daily_app_activity"
].forEach(fragment => assert.ok(sql.includes(fragment), `dashboard privacy/metric contract is missing: ${fragment}`));

console.log("Founder dashboard contract checks passed.");
