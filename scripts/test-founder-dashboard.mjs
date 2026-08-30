import assert from "node:assert/strict";
import fs from "node:fs";

process.env.FOUNDER_DASHBOARD_USER_IDS = "founder-one, founder-two";
process.env.FOUNDER_DASHBOARD_EMAILS = "mindi2001@gmail.com";
process.env.SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role";
const api = await import(`../api/lift-log.js?founder-dashboard-test=${Date.now()}`);

assert.equal(api.isFounderDashboardUser("founder-one"), true, "exact allowed founder id is accepted");
assert.equal(api.isFounderDashboardUser(" founder-two "), true, "surrounding caller whitespace cannot change an exact id");
assert.equal(api.isFounderDashboardUser({ id:"not-an-id", email:"mindi2001@gmail.com" }), true, "exact allowed founder email is accepted");
assert.equal(api.isFounderDashboardUser({ id:"not-an-id", email:"other@example.com" }), false, "unlisted founder email is rejected");
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
  "v_active_average_daily",
  "v_active_average_weekly",
  "v_active_average_monthly",
  "v_upload_average_daily",
  "v_upload_average_weekly",
  "v_upload_average_monthly",
  "v_active_tracking_started",
  "v_upload_tracking_started",
  "activeUserTrackingStarted",
  "date_trunc('week'",
  "date_trunc('month'",
  "Europe/Oslo",
  "purge_ante_core_daily_app_activity"
].forEach(fragment => assert.ok(sql.includes(fragment), `dashboard privacy/metric contract is missing: ${fragment}`));

const dashboardUi = fs.readFileSync(new URL("../src/pages/FounderDashboard.jsx", import.meta.url), "utf8");
const appUi = fs.readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
const authShell = fs.readFileSync(new URL("../src/components/authShell.jsx", import.meta.url), "utf8");
[
  "Dashboard",
  "Total Active Users",
  "Average Active Users",
  "Total Workout Uploads",
  "Average Workout Uploads",
  "Unique User Accounts",
  "Active-user tracking began",
  "Joined in the last 30 days",
  "New Account Names",
  "Qualifying Blocs",
  "Activity Trend",
  "Daily totals from the last 30 days.",
  "Signed-in users who opened Fero",
  "Unique workout uploads"
].forEach(fragment => assert.ok(dashboardUi.includes(fragment), `dashboard UI label is missing: ${fragment}`));
assert.ok(!dashboardUi.includes('subtitle:"All-time average"'), "dashboard UI should not repeat the all-time average helper text");
assert.ok(!dashboardUi.includes('"Private"'), "dashboard UI should not show the private header");
assert.ok(!dashboardUi.includes('All Account Names'), "dashboard UI should not show the all-account roster");
assert.ok(appUi.includes('showFounderDashboard: !inert && founderDashboardAvailable'), "founder dashboard entry should be available from the bloc switcher");
assert.ok(appUi.includes('FOUNDER_DASHBOARD_AVAILABILITY_PREFIX'), "founder dashboard availability should be cached per account");
assert.ok(appUi.includes('useState(()=>readFounderDashboardAvailability(initialPersistedSession?.userId))'), "founder dashboard entry should render from the persisted availability hint");
assert.ok(appUi.includes('persistFounderDashboardAvailability(initialSession.userId, available)'), "fresh founder dashboard permission should update the local hint");
assert.ok(authShell.includes('"Dashboard"'), "bloc switcher should use a labelled dashboard entry");
assert.ok(!authShell.includes('"Open founder dashboard"'), "profile should not duplicate the founder dashboard entry");

console.log("Founder dashboard contract checks passed.");
