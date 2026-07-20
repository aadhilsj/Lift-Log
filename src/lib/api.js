import {
  LOCAL_CACHE_KEY,
  LOCAL_PREVIEW_AUTH_KEY,
  resolveStateRevision,
  normalizeAppState
} from "./appState.js";

let supabaseAuthConfigPromise = null;
let supabaseAuthClientPromise = null;
const PERSISTED_AUTH_SESSION_KEY = "ll_auth_session_hint_v1";

function slugifyLocalPreview(value) {
  return String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "preview";
}

function buildLocalPreviewSession(displayName) {
  const normalizedName = String(displayName || "").trim();
  if (!normalizedName) return null;
  const slug = slugifyLocalPreview(normalizedName);
  return {
    userId: `local-preview:${slug}`,
    email: `${slug}@local.test`,
    accessToken: null,
    previewDisplayName: normalizedName,
    localPreview: true
  };
}

function isLocalDevHost(hostname) {
  const normalized = String(hostname || "").trim().toLowerCase();
  return normalized === "localhost"
    || normalized === "127.0.0.1"
    || /^192\.168\.\d{1,3}\.\d{1,3}$/.test(normalized)
    || /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(normalized)
    || /^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(normalized);
}

function isLocalDevEnvironment() {
  try {
    return isLocalDevHost(window.location.hostname);
  } catch {
    return false;
  }
}

function readLocalPreviewSession() {
  try {
    const raw = localStorage.getItem(LOCAL_PREVIEW_AUTH_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return buildLocalPreviewSession(parsed?.previewDisplayName || parsed?.displayName || "");
  } catch {
    return null;
  }
}

function persistLocalPreviewSession(session) {
  try {
    if (!session?.localPreview || !session?.previewDisplayName) {
      localStorage.removeItem(LOCAL_PREVIEW_AUTH_KEY);
      return;
    }
    localStorage.setItem(LOCAL_PREVIEW_AUTH_KEY, JSON.stringify({
      previewDisplayName: session.previewDisplayName
    }));
  } catch {}
}

function readPersistedAuthSession() {
  try {
    const raw = localStorage.getItem(PERSISTED_AUTH_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.localPreview) {
      return buildLocalPreviewSession(parsed?.previewDisplayName || parsed?.displayName || "");
    }
    if (!parsed?.userId) return null;
    return {
      userId: parsed.userId,
      email: parsed.email || "",
      accessToken: null
    };
  } catch {
    return null;
  }
}

function persistAuthSessionHint(session) {
  try {
    if (!session?.userId) {
      localStorage.removeItem(PERSISTED_AUTH_SESSION_KEY);
      return;
    }
    if (session.localPreview) {
      localStorage.setItem(PERSISTED_AUTH_SESSION_KEY, JSON.stringify({
        localPreview: true,
        previewDisplayName: session.previewDisplayName || ""
      }));
      return;
    }
    localStorage.setItem(PERSISTED_AUTH_SESSION_KEY, JSON.stringify({
      userId: session.userId,
      email: session.email || ""
    }));
  } catch {}
}

function mapSupabaseSession(session) {
  if (!session?.user?.id || !session?.access_token) return null;
  return {
    userId: session.user.id,
    email: session.user.email || "",
    accessToken: session.access_token
  };
}

async function fetchAuthConfig() {
  if (!supabaseAuthConfigPromise) {
    supabaseAuthConfigPromise = fetch("./api/lift-log?config=auth", {
      cache: "no-store",
      headers: { Accept: "application/json" }
    })
      .then(async res => {
        if (!res.ok) {
          throw new Error("Supabase auth config is missing");
        }
        return await res.json();
      })
      .catch(error => {
        supabaseAuthConfigPromise = null;
        throw error;
      });
  }
  return await supabaseAuthConfigPromise;
}

async function getSupabaseAuthClient() {
  if (!supabaseAuthClientPromise) {
    supabaseAuthClientPromise = (async () => {
      const config = await fetchAuthConfig();
      const factory = window.supabase?.createClient;
      if (!factory) {
        throw new Error("Supabase browser client failed to load");
      }
      return factory(config.supabaseUrl, config.supabaseAnonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        }
      });
    })().catch(error => {
      supabaseAuthClientPromise = null;
      throw error;
    });
  }
  return await supabaseAuthClientPromise;
}

async function getCurrentAuthSession() {
  const client = await getSupabaseAuthClient();
  const { data, error } = await client.auth.getSession();
  if (error) throw error;
  return mapSupabaseSession(data.session);
}

async function signOutAuthSession() {
  const client = await getSupabaseAuthClient();
  const { error } = await client.auth.signOut();
  if (error) throw error;
}

async function syncAuthSessionData(sessionOverride) {
  const session = sessionOverride || await getCurrentAuthSession();
  if (!session?.accessToken) return { ok:false, error:"You need to sign in again" };
  try {
    const res = await fetch("./api/lift-log", {
      method: "POST",
      cache: "no-store",
      headers: {
        "Content-Type":"application/json",
        "Authorization": `Bearer ${session.accessToken}`
      },
      body: JSON.stringify({ action:"auth-sync" })
    });
    const body = await res.json().catch(()=>null);
    if (!res.ok) {
      return { ok:false, error: body?.details || body?.error || "Unable to sync account" };
    }
    return {
      ok:true,
      state: normalizeAppState(body.state),
      session: body.session || session
    };
  } catch (e) {
    console.error("Auth sync error:", e);
  }
  return { ok:false, error:"Unable to sync account" };
}

async function refreshAuthSession() {
  const client = await getSupabaseAuthClient();
  const { data, error } = await client.auth.refreshSession();
  if (error || !data?.session) return null;
  return mapSupabaseSession(data.session);
}

async function postApi(action, payload = {}, options = {}) {
  const { auth = true, sessionOverride = null, extraHeaders = null } = options;
  try {
    const headers = { "Content-Type":"application/json" };
    if (extraHeaders && typeof extraHeaders === "object") {
      Object.assign(headers, extraHeaders);
    }
    if (auth) {
      const session = sessionOverride || await getCurrentAuthSession();
      if (!session?.accessToken) return { ok:false, error:"You need to sign in again" };
      headers.Authorization = `Bearer ${session.accessToken}`;
    }
    const res = await fetch("./api/lift-log", {
      method: "POST",
      cache: "no-store",
      headers,
      body: JSON.stringify({ action, ...payload })
    });
    const body = await res.json().catch(()=>null);
    if (!res.ok) {
      // On 401, try refreshing the session and retrying once
      if (res.status === 401 && auth && !sessionOverride) {
        const refreshed = await refreshAuthSession();
        if (refreshed?.accessToken) {
          const retryHeaders = { ...headers, Authorization:`Bearer ${refreshed.accessToken}` };
          const retryRes = await fetch("./api/lift-log", {
            method: "POST",
            cache: "no-store",
            headers: retryHeaders,
            body: JSON.stringify({ action, ...payload })
          });
          const retryBody = await retryRes.json().catch(()=>null);
          if (!retryRes.ok) return { ok:false, error: retryBody?.details || retryBody?.error || "Request failed", body: retryBody };
          return { ok:true, body: retryBody };
        }
      }
      return { ok:false, error: body?.details || body?.error || "Request failed", body };
    }
    return { ok:true, body };
  } catch (e) {
    console.error(`${action} request error:`, e);
  }
  return { ok:false, error:"Request failed" };
}

async function fetchData() {
  try {
    const session = await getCurrentAuthSession();
    if (!session?.accessToken) return null;
    const res = await fetch("./api/lift-log", {
      cache: "no-store",
      headers: {
        "Accept":"application/json",
        "Authorization": `Bearer ${session.accessToken}`
      }
    });
    if (!res.ok && res.status === 401) {
      const refreshed = await refreshAuthSession();
      if (refreshed?.accessToken) {
        const retryRes = await fetch("./api/lift-log", {
          cache: "no-store",
          headers: {
            "Accept":"application/json",
            "Authorization": `Bearer ${refreshed.accessToken}`
          }
        });
        if (!retryRes.ok) {
          if (retryRes.status === 401) {
            await signOutAuthSession().catch(()=>{});
          }
          console.error("Fetch retry failed:", retryRes.status, await retryRes.text());
          return null;
        }
        return normalizeAppState(await retryRes.json());
      }
      await signOutAuthSession().catch(()=>{});
      return null;
    }
    if(!res.ok){ console.error("Fetch failed:", res.status, await res.text()); return null; }
    return normalizeAppState(await res.json());
  } catch(e){ console.error("Fetch error:", e); return null; }
}

async function fetchRevision() {
  try {
    const session = await getCurrentAuthSession();
    if (!session?.accessToken) return null;
    const res = await fetch("./api/lift-log?revision=1", {
      cache: "no-store",
      headers: {
        "Accept":"application/json",
        "Authorization": `Bearer ${session.accessToken}`
      }
    });
    if (!res.ok && res.status === 401) {
      const refreshed = await refreshAuthSession();
      if (refreshed?.accessToken) {
        const retryRes = await fetch("./api/lift-log?revision=1", {
          cache: "no-store",
          headers: {
            "Accept":"application/json",
            "Authorization": `Bearer ${refreshed.accessToken}`
          }
        });
        if (!retryRes.ok) {
          if (retryRes.status === 401) {
            await signOutAuthSession().catch(()=>{});
          }
          console.error("Revision retry failed:", retryRes.status, await retryRes.text());
          return null;
        }
        const retryBody = await retryRes.json();
        return Number.isFinite(Number(retryBody?.revision)) ? Number(retryBody.revision) : null;
      }
      await signOutAuthSession().catch(()=>{});
      return null;
    }
    if(!res.ok){ console.error("Revision fetch failed:", res.status, await res.text()); return null; }
    const body = await res.json();
    return Number.isFinite(Number(body?.revision)) ? Number(body.revision) : null;
  } catch(e){ console.error("Revision fetch error:", e); return null; }
}

async function addLogData(payload) {
  const result = await postApi("add-log", payload);
  if (!result.ok) return { ok:false, error: result.error || "Unable to save workout" };
  return { ok:true, data: normalizeAppState(result.body) };
}

async function claimSettlementConfirmationData(payload) {
  const extraHeaders = {};
  if (payload?.devImpersonationUserId) {
    extraHeaders["X-Dev-Impersonate-User-Id"] = String(payload.devImpersonationUserId).trim();
  }
  const result = await postApi("settlement-claim-paid", payload, { extraHeaders });
  if (!result.ok) return { ok:false, error: result.error || "Unable to mark payment as claimed" };
  return { ok:true, data: normalizeAppState(result.body) };
}

async function confirmSettlementConfirmationData(payload) {
  const extraHeaders = {};
  if (payload?.devImpersonationUserId) {
    extraHeaders["X-Dev-Impersonate-User-Id"] = String(payload.devImpersonationUserId).trim();
  }
  const result = await postApi("settlement-confirm-paid", payload, { extraHeaders });
  if (!result.ok) return { ok:false, error: result.error || "Unable to confirm payment" };
  return { ok:true, data: normalizeAppState(result.body) };
}

async function disputeSettlementConfirmationData(payload) {
  const extraHeaders = {};
  if (payload?.devImpersonationUserId) {
    extraHeaders["X-Dev-Impersonate-User-Id"] = String(payload.devImpersonationUserId).trim();
  }
  const result = await postApi("settlement-dispute-paid", payload, { extraHeaders });
  if (!result.ok) return { ok:false, error: result.error || "Unable to dispute payment" };
  return { ok:true, data: normalizeAppState(result.body) };
}

async function updateGroupSettingsData(groupId, actor, actorUserId, groupName, settings) {
  const result = await postApi("update-settings", { groupId, actor, actorUserId, groupName, settings });
  if (!result.ok) return { ok:false, error: result.error || "Unable to update settings" };
  return { ok:true, data: normalizeAppState(result.body) };
}

async function createGroupData(payload) {
  const result = await postApi("create-group", payload);
  if (!result.ok) return { ok:false, error: result.error || "Unable to create Bloc" };
  return { ok:true, state: normalizeAppState(result.body.state), createdGroupId: result.body.createdGroupId };
}

async function saveSeasonProrationChoice(payload) {
  const result = await postApi("season-proration-choice", payload);
  if (!result.ok) return { ok:false, error: result.error || "Unable to save first-month target" };
  return { ok:true, data: normalizeAppState(result.body) };
}

async function requestSitOutData(payload) {
  const result = await postApi("sitout-request", payload);
  if (!result.ok) return { ok:false, error: result.error || "Unable to request sit-out" };
  return { ok:true, data: normalizeAppState(result.body) };
}

async function reviewSitOutData(payload) {
  const result = await postApi("sitout-review", payload);
  if (!result.ok) return { ok:false, error: result.error || "Unable to review sit-out" };
  return { ok:true, data: normalizeAppState(result.body) };
}

async function deleteAccountData(userId) {
  const result = await postApi("delete-account", { userId });
  if (!result.ok) return { ok:false, error: result.error || "Unable to delete account" };
  return { ok:true, state: normalizeAppState(result.body.state) };
}

async function sendOtpData(email) {
  try {
    const client = await getSupabaseAuthClient();
    const { error } = await client.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: `${window.location.origin}${window.location.pathname}`
      }
    });
    if (error) return { ok:false, error:error.message || "Unable to send code" };
    return { ok:true, devCode:null };
  } catch(e){ console.error("Send OTP error:", e); }
  return { ok:false, error:"Unable to send code" };
}

async function verifyOtpData(email, code) {
  try {
    const client = await getSupabaseAuthClient();
    const { data, error } = await client.auth.verifyOtp({
      email,
      token: code,
      type: "email"
    });
    if (error) return { ok:false, error:error.message || "Unable to verify code" };
    const session = mapSupabaseSession(data?.session);
    if (!session) return { ok:false, error:"Unable to verify code" };
    const synced = await syncAuthSessionData(session);
    if (!synced.ok) {
      return {
        ok:true,
        state:null,
        session,
        syncError: synced.error || "Unable to sync account"
      };
    }
    return { ok:true, state: synced.state, session: { ...synced.session, accessToken: session.accessToken } };
  } catch(e){ console.error("Verify OTP error:", e); }
  return { ok:false, error:"Unable to verify code" };
}

async function upsertProfileData(payload, sessionOverride = null) {
  try {
    const result = await postApi("upsert-profile", payload, { sessionOverride });
    if (!result.ok) return { ok:false, error: result.error || "Unable to save profile" };
    try {
      return { ok:true, data: normalizeAppState(result.body), syncError:"" };
    } catch (error) {
      console.error("Profile sync normalize error:", error);
      return { ok:true, data: null, syncError: error instanceof Error ? error.message : "Unable to sync account" };
    }
  } catch (error) {
    console.error("Profile save error:", error);
  }
  return { ok:false, error:"Unable to save profile" };
}

async function updateProfilePhotoData(profilePhotoUrl) {
  try {
    const result = await postApi("update-profile-photo", { profilePhotoUrl });
    if (!result.ok) return { ok:false, error: result.error || "Unable to save photo" };
    try {
      return { ok:true, data: normalizeAppState(result.body), syncError:"" };
    } catch (error) {
      console.error("Profile photo sync normalize error:", error);
      return { ok:true, data: null, syncError: error instanceof Error ? error.message : "Unable to sync account" };
    }
  } catch (error) {
    console.error("Profile photo save error:", error);
  }
  return { ok:false, error:"Unable to save photo" };
}

async function joinGroupData(payload) {
  const result = await postApi("join-group", payload);
  if (!result.ok) return { ok:false, error: result.error || "Unable to join Bloc" };
  return { ok:true, state: normalizeAppState(result.body.state), joinedGroupId: result.body.joinedGroupId };
}

async function fetchInviteContextData(inviteCode) {
  try {
    const res = await fetch("./api/lift-log", {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type":"application/json" },
      body: JSON.stringify({ action:"invite-context", inviteCode })
    });
    const body = await res.json().catch(()=>null);
    if(!res.ok) return { ok:false, error: body?.details || body?.error || "Invite not found" };
    return { ok:true, data: body };
  } catch(e){ console.error("Invite context error:", e); }
  return { ok:false, error:"Invite not found" };
}

async function kickMemberData(payload) {
  const result = await postApi("kick-member", payload);
  if (!result.ok) return { ok:false, error: result.error || "Unable to remove member" };
  return { ok:true, state: normalizeAppState(result.body.state) };
}

async function leaveBlocData(payload) {
  const result = await postApi("leave-bloc", payload);
  if (!result.ok) return { ok:false, error: result.error || "Unable to leave Bloc" };
  return { ok:true, state: normalizeAppState(result.body.state), leftGroupId: result.body.leftGroupId };
}

async function multiLogData(payload) {
  const result = await postApi("multi-log", payload);
  if (!result.ok) return { ok:false, error: result.error || "Unable to save workout" };
  return { ok:true, data: normalizeAppState(result.body) };
}

async function mutateLogData(payload) {
  const action = payload?.action;
  const rest = { ...payload };
  delete rest.action;
  const result = await postApi(action, rest);
  if (!result.ok) return { ok:false, error: result.error || "Unable to update workout" };
  return { ok:true, data: normalizeAppState(result.body) };
}

async function listBlocStreamMessagesData(groupId, limit = 100) {
  const result = await postApi("stream-list", { groupId, limit });
  if (!result.ok) return { ok:false, error: result.error || "Unable to load Bloc Stream", messages: [] };
  return { ok:true, messages: Array.isArray(result.body?.messages) ? result.body.messages : [] };
}

async function getBlocStreamUnreadCountData(groupId) {
  const result = await postApi("stream-unread-count", { groupId });
  if (!result.ok) return { ok:false, error: result.error || "Unable to load unread count", unreadCount: 0 };
  const unreadCount = Number(result.body?.unreadCount || 0);
  return { ok:true, unreadCount: Number.isFinite(unreadCount) ? Math.max(0, unreadCount) : 0 };
}

async function sendBlocStreamMessageData(payload) {
  const result = await postApi("stream-send", payload);
  if (!result.ok) return { ok:false, error: result.error || "Unable to send message" };
  return { ok:true, messageId: result.body?.messageId || null };
}

async function createBlocStreamEventData(payload) {
  const result = await postApi("stream-create-event", payload);
  if (!result.ok) return { ok:false, error: result.error || "Unable to create event" };
  return { ok:true, messageId: result.body?.messageId || null };
}

async function setBlocStreamRsvpData(payload) {
  const result = await postApi("stream-rsvp", payload);
  if (!result.ok) return { ok:false, error: result.error || "Unable to update RSVP" };
  return { ok:true };
}

async function toggleBlocStreamReactionData(payload) {
  const result = await postApi("stream-reaction", payload);
  if (!result.ok) return { ok:false, error: result.error || "Unable to update reaction" };
  return { ok:true };
}

async function markBlocStreamReadData(groupId) {
  const result = await postApi("stream-mark-read", { groupId });
  if (!result.ok) return { ok:false, error: result.error || "Unable to mark stream read" };
  return { ok:true };
}

async function listLogCommentsData(groupId, logId) {
  const result = await postApi("log-comments-list", { groupId, logId });
  if (!result.ok) return { ok:false, error: result.error || "Unable to load comments", comments: [] };
  return { ok:true, comments: Array.isArray(result.body?.comments) ? result.body.comments : [] };
}

async function getLogCommentCountsData(groupId, logIds = []) {
  const result = await postApi("log-comment-counts", { groupId, logIds });
  if (!result.ok) return { ok:false, error: result.error || "Unable to load comment counts", counts: {} };
  const counts = result.body?.counts && typeof result.body.counts === "object" && !Array.isArray(result.body.counts)
    ? result.body.counts
    : {};
  return { ok:true, counts };
}

async function createLogCommentData(payload) {
  const result = await postApi("log-comment-create", payload);
  if (!result.ok) return { ok:false, error: result.error || "Unable to add comment" };
  return {
    ok:true,
    comment: result.body?.comment || null,
    commentCount: Number.isFinite(Number(result.body?.commentCount)) ? Math.max(0, Number(result.body.commentCount)) : null,
    streamMessageId: result.body?.streamMessageId || null
  };
}

function readCachedData() {
  try {
    const raw = localStorage.getItem(LOCAL_CACHE_KEY);
    if (!raw) return null;
    return normalizeAppState(JSON.parse(raw));
  } catch {
    return null;
  }
}

function writeCachedData(data) {
  try {
    localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify(data));
  } catch {}
}

function getRevision(data) {
  return resolveStateRevision(data);
}

function setSupabaseAuthClientPromise(value) {
  supabaseAuthClientPromise = value;
}

export {
  setSupabaseAuthClientPromise,
  supabaseAuthConfigPromise,
  supabaseAuthClientPromise,
  slugifyLocalPreview,
  buildLocalPreviewSession,
  isLocalDevHost,
  isLocalDevEnvironment,
  readLocalPreviewSession,
  readPersistedAuthSession,
  persistLocalPreviewSession,
  persistAuthSessionHint,
  mapSupabaseSession,
  fetchAuthConfig,
  getSupabaseAuthClient,
  getCurrentAuthSession,
  signOutAuthSession,
  syncAuthSessionData,
  refreshAuthSession,
  postApi,
  fetchData,
  fetchRevision,
  addLogData,
  claimSettlementConfirmationData,
  confirmSettlementConfirmationData,
  disputeSettlementConfirmationData,
  updateGroupSettingsData,
  createGroupData,
  saveSeasonProrationChoice,
  requestSitOutData,
  reviewSitOutData,
  deleteAccountData,
  sendOtpData,
  verifyOtpData,
  upsertProfileData,
  updateProfilePhotoData,
  joinGroupData,
  fetchInviteContextData,
  kickMemberData,
  leaveBlocData,
  multiLogData,
  mutateLogData,
  getBlocStreamUnreadCountData,
  listBlocStreamMessagesData,
  sendBlocStreamMessageData,
  createBlocStreamEventData,
  setBlocStreamRsvpData,
  toggleBlocStreamReactionData,
  markBlocStreamReadData,
  listLogCommentsData,
  getLogCommentCountsData,
  createLogCommentData,
  readCachedData,
  writeCachedData,
  getRevision
};
