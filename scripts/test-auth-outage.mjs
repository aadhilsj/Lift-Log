// An auth-check outage must never read as "signed out".
// Drives the real api/lift-log.js handler with Supabase's /auth/v1/user faked
// into each outage shape: unreachable, Cloudflare 520/522, 5xx, 429 -> 503;
// a rejected token (400/401/403) -> 401. See the 2026-09-22 handover.
process.env.SUPABASE_URL = "https://fake-project.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
const root = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
let authMode = "ok";
globalThis.fetch = async (url) => {
  url = String(url);
  if (url.includes("/auth/v1/user")) {
    if (authMode === "network") throw new TypeError("fetch failed");
    const code = { cf522: 522, cf520: 520, s500: 500, s503: 503, s429: 429, bad401: 401, bad403: 403, bad400: 400 }[authMode];
    if (code) return new Response(JSON.stringify({ msg: "x" }), { status: code, headers: { "content-type": "application/json" } });
    return new Response(JSON.stringify({ id: "11111111-1111-1111-1111-111111111111", email: "someone@example.com" }), { status: 200 });
  }
  return new Response("[]", { status: 200, headers: { "content-type": "application/json" } });
};
const { default: handler } = await import(`${root}/api/lift-log.js`);
async function call(method, action) {
  let status = 0, body = null;
  const res = { setHeader(){}, status(c){ status = c; return this; }, json(b){ body = b; return this; }, send(b){ body = b; return this; }, end(){ return this; } };
  const req = method === "GET"
    ? { method, query: { revision: "1" }, url: "/api/lift-log?revision=1", headers: { authorization: "Bearer real-looking-token", host: "lift-log-nu.vercel.app" } }
    : { method, query: {}, url: "/api/lift-log", headers: { authorization: "Bearer real-looking-token", host: "lift-log-nu.vercel.app" }, body: { action } };
  await handler(req, res);
  return { status, details: body?.details || body?.error };
}
const expectations = [
  ["network", 503], ["cf522", 503], ["cf520", 503], ["s500", 503], ["s503", 503], ["s429", 503],
  ["bad401", 401], ["bad403", 401], ["bad400", 401],
];
let fails = 0;
for (const [mode, want] of expectations) {
  authMode = mode;
  for (const [m, a] of [["POST", "founder-dashboard"], ["GET", null], ["POST", "auth-sync"]]) {
    const r = await call(m, a);
    const ok = r.status === want;
    if (!ok) fails++;
    console.log(`${ok ? "PASS" : "FAIL"}  supabase auth=${mode.padEnd(7)} ${m} ${a || "revision"}`.padEnd(66) + `-> ${r.status}  ${String(r.details).slice(0, 70)}`);
  }
}
console.log(fails ? `\n${fails} FAILED` : "\nall passed");
process.exit(fails ? 1 : 0);
