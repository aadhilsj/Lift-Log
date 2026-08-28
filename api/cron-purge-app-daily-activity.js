// Daily private-data retention job. Vercel Cron invokes this only in production.
// CRON_SECRET is injected by Vercel as a Bearer token and is never browser-visible.

const CRON_SECRET = String(process.env.CRON_SECRET || "").trim();
const SUPABASE_URL = String(process.env.SUPABASE_URL || "").trim();
const SUPABASE_SERVICE_ROLE_KEY = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error:"Method not allowed" });
  if (!CRON_SECRET || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(503).json({ error:"Retention job is not configured" });
  }
  const authorization = String(req.headers?.authorization || req.headers?.Authorization || "");
  if (authorization !== `Bearer ${CRON_SECRET}`) return res.status(401).json({ error:"Unauthorized" });

  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/purge_ante_core_daily_app_activity`, {
    method:"POST",
    headers:{
      apikey:SUPABASE_SERVICE_ROLE_KEY,
      Authorization:`Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type":"application/json",
      Accept:"application/json"
    },
    body:"{}"
  });
  if (!response.ok) {
    const details = await response.text();
    return res.status(502).json({ error:"Retention purge failed", details:details.slice(0, 500) });
  }
  const deleted = Math.max(0, Number(await response.json()) || 0);
  return res.status(200).json({ ok:true, deleted });
}
