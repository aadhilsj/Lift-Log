import { authenticatePushUser, pushRpc, validateDevice } from "../server/push.js";

const ORIGINS = new Set(["capacitor://localhost", "ionic://localhost", "https://lift-log-nu.vercel.app", "https://joinfero.app", "https://www.joinfero.app"]);

export function createPushDeviceHandler({ env=process.env, fetchImpl=fetch } = {}) {
  return async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Vary", "Origin");
    const origin = req.headers?.origin;
    if (origin && !ORIGINS.has(origin) && !/^http:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(origin)) {
      return res.status(403).json({ error:"Origin not allowed" });
    }
    if (origin) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    }
    if (req.method === "OPTIONS") return res.status(204).end();
    if (req.method !== "POST") return res.status(405).json({ error:"Method not allowed" });
    if (env.PUSH_REGISTRATION_ENABLED !== "true" || env.SANDBOX_BLOB_FILE) {
      return res.status(503).json({ error:"Push registration is not enabled" });
    }
    try {
      let body = req.body;
      if (body === undefined && req[Symbol.asyncIterator]) {
        const chunks = [];
        let bytes = 0;
        for await (const chunk of req) {
          bytes += Buffer.byteLength(chunk);
          if (bytes > 4096) return res.status(413).json({ error:"Request too large" });
          chunks.push(Buffer.from(chunk));
        }
        body = Buffer.concat(chunks).toString("utf8");
      }
      if (typeof body === "string") {
        if (body.length > 4096) return res.status(413).json({ error:"Request too large" });
        try { body=JSON.parse(body); } catch { return res.status(400).json({ error:"Invalid JSON" }); }
      }
      if (!body || JSON.stringify(body).length > 4096) return res.status(400).json({ error:"Invalid request" });
      validateDevice(body);
      const userId = await authenticatePushUser(req.headers?.authorization, { env, fetchImpl });
      const parameters = { p_auth_user_id:userId, p_device_id:body.deviceId };
      const name = body.action === "revoke" ? "revoke_fero_push_device" : "register_fero_push_device";
      if (body.action === "register") Object.assign(parameters, {
        p_token:body.token.toLowerCase(), p_environment:body.environment, p_app_version:body.appVersion || ""
      });
      await pushRpc(name, parameters, { env, fetchImpl });
      return res.status(200).json({ ok:true });
    } catch (error) {
      return res.status(error.status || 503).json({ error:error.status ? error.message : "Push registration unavailable" });
    }
  };
}

export default createPushDeviceHandler();
