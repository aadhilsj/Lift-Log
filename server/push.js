// Server only. Never import this module into src/; it holds APNs credentials.
import { createPrivateKey, randomUUID, sign } from "node:crypto";
import { connect } from "node:http2";

export const PUSH_TOPIC = "com.aadhilsj.fero";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
let cachedProviderToken;

export function validateDevice(body) {
  if (!body || !UUID.test(body.deviceId || "")) throw Object.assign(new Error("Invalid device ID"), { status:400 });
  if (body.action === "revoke") return;
  if (body.action !== "register" || !/^[0-9a-f]{32,512}$/i.test(body.token || "")
      || body.token.length % 2 || !["production", "sandbox"].includes(body.environment)
      || (body.appVersion != null && (typeof body.appVersion !== "string" || body.appVersion.length > 40))) {
    throw Object.assign(new Error("Invalid push registration"), { status:400 });
  }
}

function supabaseConfig(env) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw Object.assign(new Error("Push storage is not configured"), { status:503 });
  }
  return { url:env.SUPABASE_URL.replace(/\/$/, ""), key:env.SUPABASE_SERVICE_ROLE_KEY };
}

export async function authenticatePushUser(authorization, { env=process.env, fetchImpl=fetch } = {}) {
  const token = String(authorization || "").match(/^Bearer (\S+)$/)?.[1];
  // No sandbox identities, body-supplied actor IDs, or unverified JWT claims.
  if (!token || token.startsWith("local-dev:")) throw Object.assign(new Error("Sign in required"), { status:401 });
  const { url, key } = supabaseConfig(env);
  let response;
  try {
    response = await fetchImpl(`${url}/auth/v1/user`, {
      headers:{ apikey:key, Authorization:`Bearer ${token}` },
      signal:AbortSignal.timeout(10000)
    });
  } catch {
    throw Object.assign(new Error("Sign-in service unavailable"), { status:503 });
  }
  if (!response.ok) throw Object.assign(new Error("Unable to verify sign-in"), {
    status:[400,401,403].includes(response.status) ? 401 : 503
  });
  const user = await response.json();
  if (!UUID.test(user?.id || "")) throw Object.assign(new Error("Sign in required"), { status:401 });
  return user.id;
}

export async function pushRpc(name, parameters, { env=process.env, fetchImpl=fetch } = {}) {
  const { url, key } = supabaseConfig(env);
  const response = await fetchImpl(`${url}/rest/v1/rpc/${name}`, {
    method:"POST",
    headers:{ apikey:key, Authorization:`Bearer ${key}`, "Content-Type":"application/json" },
    body:JSON.stringify(parameters), signal:AbortSignal.timeout(10000)
  });
  if (!response.ok) throw Object.assign(new Error("Push storage request failed"), { status:503 });
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

export function apnsProviderToken(env=process.env, now=Date.now()) {
  const keyId = env.APNS_KEY_ID;
  const teamId = env.APNS_TEAM_ID;
  const pem = String(env.APNS_PRIVATE_KEY || "").replace(/\\n/g, "\n");
  if (!/^[A-Z0-9]{10}$/.test(keyId || "") || !/^[A-Z0-9]{10}$/.test(teamId || "") || !pem) {
    throw new Error("Set APNS_KEY_ID, APNS_TEAM_ID and APNS_PRIVATE_KEY in the server environment");
  }
  if (cachedProviderToken?.pem === pem && cachedProviderToken.keyId === keyId
      && cachedProviderToken.teamId === teamId && now-cachedProviderToken.createdAt < 20*60*1000
      && now >= cachedProviderToken.createdAt) return cachedProviderToken.token;
  const key = createPrivateKey(pem);
  if (key.asymmetricKeyType !== "ec" || key.asymmetricKeyDetails?.namedCurve !== "prime256v1") {
    throw new Error("APNs requires Apple's P-256 private key");
  }
  const header = Buffer.from(JSON.stringify({ alg:"ES256", kid:keyId })).toString("base64url");
  const claims = Buffer.from(JSON.stringify({ iss:teamId, iat:Math.floor(now/1000) })).toString("base64url");
  const message = `${header}.${claims}`;
  const signature = sign("sha256", Buffer.from(message), { key, dsaEncoding:"ieee-p1363" }).toString("base64url");
  const token = `${message}.${signature}`;
  cachedProviderToken = { pem,keyId,teamId,createdAt:now,token };
  return token;
}

export function buildApnsRequest(device, providerToken) {
  if (!["production","sandbox"].includes(device.environment) || !/^[0-9a-f]{32,512}$/.test(device.token)) {
    throw new Error("Invalid stored push device");
  }
  return {
    origin:device.environment === "sandbox" ? "https://api.sandbox.push.apple.com" : "https://api.push.apple.com",
    headers:{
      ":method":"POST", ":path":`/3/device/${device.token}`,
      authorization:`bearer ${providerToken}`, "apns-topic":PUSH_TOPIC,
      "apns-push-type":"alert", "apns-priority":"10", "apns-expiration":"0",
      "apns-id":randomUUID(), "content-type":"application/json"
    },
    payload:JSON.stringify({ aps:{ alert:{ title:"Fero test", body:"Push notifications are connected." }, sound:"default" } })
  };
}

export function sendApnsRequest(request) {
  return new Promise((resolve, reject) => {
    const client = connect(request.origin);
    let stream;
    let settled = false;
    const finish = (err, result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      stream?.close();
      client.destroy();
      if (err) reject(new Error("APNs connection failed"));
      else resolve(result);
    };
    const timer = setTimeout(() => finish(new Error("timeout")), 10000);
    client.on("error", err => finish(err));
    client.on("goaway", () => finish(new Error("APNs closed the connection")));
    client.on("connect", () => {
      try {
        stream = client.request(request.headers);
        let status = 0;
        let responseBody = "";
        let apnsId;
        stream.setEncoding("utf8");
        stream.on("response", headers => { status=Number(headers[":status"]); apnsId=headers["apns-id"]; });
        stream.on("data", chunk => {
          responseBody += chunk;
          if (responseBody.length > 8192) finish(new Error("Oversized APNs response"));
        });
        stream.on("error", err => finish(err));
        stream.on("end", () => {
          try {
            const body = responseBody ? JSON.parse(responseBody) : {};
            finish(null, { status, reason:body.reason || null, timestamp:body.timestamp || null, apnsId });
          } catch { finish(new Error("Invalid APNs response")); }
        });
        stream.end(request.payload);
      } catch (err) { finish(err); }
    });
  });
}

// Manual smoke test only. No event triggers or notification-centre state.
export async function sendTestPush(authUserId, { env=process.env, rpc=pushRpc, transport=sendApnsRequest } = {}) {
  if (!UUID.test(authUserId || "")) throw new Error("A valid test user ID is required");
  const providerToken = apnsProviderToken(env);
  const devices = await rpc("list_fero_push_devices", { p_auth_user_id:authUserId }, { env });
  if (!Array.isArray(devices)) throw new Error("Push storage returned invalid devices");
  const results = [];
  for (const device of devices) {
    let result;
    try {
      result = await transport(buildApnsRequest(device, providerToken));
    } catch {
      result = { status:0, reason:"TransportError" };
    }
    const timestamp = Number(result.timestamp);
    const invalidSince = timestamp > 0 && Number.isFinite(timestamp) && timestamp <= Date.now()
      ? new Date(timestamp).toISOString() : null;
    await rpc("record_fero_push_result", {
      p_auth_user_id:authUserId, p_device_id:device.device_id, p_registration_id:device.registration_id,
      p_status:result.status, p_reason:result.reason, p_invalid_since:invalidSince
    }, { env });
    // Never print device tokens or signing credentials, even in error paths.
    results.push({ deviceId:device.device_id, accepted:result.status===200, status:result.status,
      reason:result.reason, retryable:result.status===0 || result.status===429 || result.status>=500 });
  }
  return { deviceCount:devices.length, results };
}
