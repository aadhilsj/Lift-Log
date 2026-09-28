import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { getCurrentAuthSession, postApi } from "./api.js";

const DEVICE_ID_KEY = "fero_push_installation_v1";
// TestFlight/App Store use production APNs. Development builds must explicitly
// build with VITE_APNS_ENVIRONMENT=sandbox to match Debug.entitlements.
const environment = import.meta.env?.VITE_APNS_ENVIRONMENT || "production";
let queue = Promise.resolve();
let generation = 0;

function supported() {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios"
    && Capacitor.isPluginAvailable("PushNotifications");
}

function deviceId(create=true) {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id && create) {
    id=crypto.randomUUID();
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

function serial(task) {
  const operation = queue.then(task).catch(() => ({ ok:false, status:"unavailable" }));
  queue=operation;
  return operation;
}

export async function getPushPermissionStatus() {
  try {
    if (!supported()) return "unsupported";
    return (await PushNotifications.checkPermissions()).receive;
  } catch { return "unavailable"; }
}

async function registerGrantedPermission(session, expectedGeneration) {
  if (!["production", "sandbox"].includes(environment)) return { ok:false, status:"invalid-environment" };
  const id=deviceId();
  const listeners=[];
  let timer;
  let resolveToken;
  const tokenResult = new Promise(resolve => { resolveToken=resolve; });
  try {
    listeners.push(await PushNotifications.addListener("registration", token => resolveToken({ token:token.value })));
    listeners.push(await PushNotifications.addListener("registrationError", () => resolveToken({ error:true })));
    timer=setTimeout(() => resolveToken({ error:true }), 15000);
    await PushNotifications.register();
    const result=await tokenResult;
    if (result.error) return { ok:false, status:"registration-failed" };
    const latestSession=await getCurrentAuthSession();
    if (expectedGeneration!==generation || latestSession?.userId!==session.userId) return { ok:false, status:"account-changed" };
    const saved=await postApi("register", {
      deviceId:id, token:result.token, environment, appVersion:"1.0"
    }, { apiPath:"/api/push-devices", sessionOverride:latestSession });
    return { ok:saved.ok, status:saved.ok ? "registered" : "storage-unavailable" };
  } finally {
    clearTimeout(timer);
    await Promise.allSettled(listeners.map(handle => handle.remove()));
  }
}

// Safe on launch/resume: checks existing permission, NEVER requests it. The
// explicit invitation/permission moment is pending Aadhil's design decision.
export function syncPushRegistration() {
  const expectedGeneration=generation;
  return serial(async () => {
    if (!supported()) return { ok:true, status:"unsupported" };
    const session=await getCurrentAuthSession();
    if (!session?.userId || !session.accessToken || session.localDevOtp || session.localPreview) return { ok:true, status:"signed-out" };
    const permission=await getPushPermissionStatus();
    if (permission === "denied") {
      const id=deviceId(false);
      if (id) await postApi("revoke", { deviceId:id }, { apiPath:"/api/push-devices", sessionOverride:session });
      await PushNotifications.unregister();
    }
    if (permission !== "granted") return { ok:true, status:permission };
    return registerGrantedPermission(session, expectedGeneration);
  });
}

// Foundation API for Claude's future explicit "Enable notifications" action.
// No UI calls this yet: Aadhil must agree the invitation moment first.
export function requestPushPermissionFromUserAction({ userInitiated=false } = {}) {
  if (!userInitiated) return Promise.resolve({ ok:false, status:"explicit-action-required" });
  const expectedGeneration=generation;
  return serial(async () => {
    if (!supported()) return { ok:true, status:"unsupported" };
    const session=await getCurrentAuthSession();
    if (!session?.userId || !session.accessToken || session.localDevOtp || session.localPreview) return { ok:false, status:"signed-out" };
    let permission=await getPushPermissionStatus();
    if (permission === "prompt" || permission === "prompt-with-rationale") {
      permission=(await PushNotifications.requestPermissions()).receive;
    }
    // A denial never causes another prompt, and granting permission does not
    // pretend registration succeeded until the token reaches server storage.
    if (permission !== "granted") return { ok:false, status:permission };
    return registerGrantedPermission(session, expectedGeneration);
  });
}

export function revokePushRegistration() {
  generation+=1; // Cancel an in-flight registration before it can persist.
  return serial(async () => {
    if (!supported()) return { ok:true, status:"unsupported" };
    let saved={ ok:true };
    try {
      const session=await getCurrentAuthSession();
      const id=deviceId(false);
      if (id && session?.accessToken && !session.localDevOtp && !session.localPreview) {
        saved=await postApi("revoke", { deviceId:id }, { apiPath:"/api/push-devices", sessionOverride:session });
      }
    } finally {
      // Local unregister still happens if offline. A later registration also
      // revokes previous owners of this installation in one database transaction.
      await PushNotifications.unregister();
    }
    return { ok:saved.ok, status:saved.ok ? "revoked" : "server-revoke-pending" };
  });
}
