import assert from "node:assert/strict";
import fs from "node:fs";

process.env.FOUNDER_DASHBOARD_USER_IDS = "founder-one, founder-two";
process.env.SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role";
const api = await import(`../api/lift-log.js?founder-dashboard-test=${Date.now()}`);

assert.equal(api.isFounderDashboardUser("founder-one"), true, "exact allowed founder id is accepted");
assert.equal(api.isFounderDashboardUser(" founder-two "), true, "surrounding caller whitespace cannot change an exact id");
assert.equal(api.isFounderDashboardUser("founder"), false, "partial founder id is denied");
assert.equal(api.isFounderDashboardUser("someone-else"), false, "unlisted user is denied");

const originalFetch = globalThis.fetch;
globalThis.fetch = async url => {
  const path = String(url);
  assert.ok(path.includes("/rest/v1/rpc/read_ante_core_founder_dashboard_details"), "roster details must use the private server RPC, never a private PostgREST schema");
  const body = {
    accounts:{newProfiles:[{displayName:"Newer"}],allProfiles:[{displayName:"Newer"},{displayName:"Older"}]},
    activeBlocs:{threePlus:2,fivePlus:1,periodDays:30}
  };
  return new Response(JSON.stringify(body), { status:200, headers:{"Content-Type":"application/json"} });
};
const rosterAndBlocs = await api.readFounderRosterAndActiveBlocs();
globalThis.fetch = originalFetch;
assert.deepEqual(rosterAndBlocs.accounts.newProfiles, [{ displayName:"Newer" }], "new-account roster uses the Oslo 30-day period");
assert.deepEqual(rosterAndBlocs.accounts.allProfiles, [{ displayName:"Newer" }, { displayName:"Older" }], "account roster contains display names only");
assert.deepEqual(rosterAndBlocs.activeBlocs, { threePlus:2, fivePlus:1, periodDays:30 }, "active Bloc thresholds count actual recent Bloc logs");

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
  "read_ante_core_founder_dashboard_details",
  "grant execute on function public.read_ante_core_founder_dashboard_details(timestamptz) to service_role",
  "v_thirty_day_start := v_today - 29",
  "Europe/Oslo",
  "purge_ante_core_daily_app_activity"
].forEach(fragment => assert.ok(sql.includes(fragment), `dashboard privacy/metric contract is missing: ${fragment}`));

console.log("Founder dashboard contract checks passed.");
