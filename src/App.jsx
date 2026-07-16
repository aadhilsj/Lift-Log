import React from "react";
const { useState, useEffect, useMemo, useCallback, useRef } = React;
import {
  MIN_TARGET,
  curKey,
  INSTALL_DISMISSED_KEY,
  LOCAL_GROUP_KEY,
  LOCAL_DEV_IMPERSONATION_KEY,
  SYNC_POLL_INTERVAL_MS,
  getCurrentMonthSummary,
  shouldPromptProration,
  uniqueNames,
  getActivityAlertCount,
  normalizeGroupState,
  buildEmptyAppState,
  normalizeAppState,
  getProfileForSession,
  getMembershipForUser,
  syncActiveGroupGlobals,
  getCurrentGroupMemberNames,
  setActiveSessionUserId
} from "./lib/appState.js";
import {
  setSupabaseAuthClientPromise,
  slugifyLocalPreview,
  buildLocalPreviewSession,
  isLocalDevEnvironment,
  readLocalPreviewSession,
  persistLocalPreviewSession,
  mapSupabaseSession,
  fetchAuthConfig,
  getSupabaseAuthClient,
  getCurrentAuthSession,
  signOutAuthSession,
  syncAuthSessionData,
  fetchData,
  saveData,
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
  joinGroupData,
  fetchInviteContextData,
  kickMemberData,
  leaveBlocData,
  multiLogData,
  mutateLogData,
  readCachedData,
  writeCachedData,
  readPersistedAuthSession,
  persistAuthSessionHint,
  getRevision
} from "./lib/api.js";
import {
  isMobile,
  isStandalone,
  isIos,
  isSafari
} from "./lib/utils.js";
import { Spinner, InstallBanner, TodayPageErrorBoundary } from "./components/primitives.jsx";
import { PreviewLanding, ProfileModal, JoinGroupModal, AuthFlowModal, IdentitySetup, GroupHome, GroupAccessNotice, LocalDevImpersonationBar } from "./components/authShell.jsx";
import { GroupSettingsModal, ProrationChoiceModal } from "./modals/modals.jsx";
import { Nav } from "./pages/Nav.jsx";
import { TodayPage } from "./pages/TodayPage.jsx";
import { ActivityPage } from "./pages/ActivityPage.jsx";
import { MonthPage } from "./pages/MonthPage.jsx";
import { HistoryPage } from "./pages/HistoryPage.jsx";
import { BlocStream } from "./pages/BlocStream.jsx";
import { ProfilePage } from "./pages/ProfilePage.jsx";
import { getUnreadCount, markStreamRead } from "./lib/blocStream.js";

const App = () => {
  const cached = readCachedData();
  const initialPersistedSession = readPersistedAuthSession();
  const hasCachedShell = !!cached;
  const [page,setPage]=useState("today");
  const [showTodayLog,setShowTodayLog]=useState(false);
  const [navResetToken,setNavResetToken]=useState(0);
  const [loading,setLoading]=useState(()=>!cached);
  const [saving,setSaving]=useState(false);
  const [creatingGroup,setCreatingGroup]=useState(false);
  const [savingSettings,setSavingSettings]=useState(false);
  const [showSettings,setShowSettings]=useState(false);
  const [showProfileModal,setShowProfileModal]=useState(false);
  const [showProfile,setShowProfile]=useState(false);
  const [showStream,setShowStream]=useState(false);
  const [monthInitialIdx,setMonthInitialIdx]=useState(null);
  const [profileSaving,setProfileSaving]=useState(false);
  const [profileError,setProfileError]=useState("");
  const [appState,setAppState]=useState(()=>cached||buildEmptyAppState());
  const [selectedGroupId,setSelectedGroupId]=useState(()=>{try{return localStorage.getItem(LOCAL_GROUP_KEY)||null;}catch{return null;}});
  const [authSession,setAuthSession]=useState(()=>initialPersistedSession);
  const [pendingAuthSession,setPendingAuthSession]=useState(null);
  const [authStep,setAuthStep]=useState(null);
  const [authIntent,setAuthIntent]=useState(null);
  const [authEmail,setAuthEmail]=useState("");
  const [authCode,setAuthCode]=useState("");
  const [authDisplayName,setAuthDisplayName]=useState("");
  const [authError,setAuthError]=useState("");
  const [devOtpCode,setDevOtpCode]=useState("");
  const [sendingOtp,setSendingOtp]=useState(false);
  const [verifyingOtp,setVerifyingOtp]=useState(false);
  const [savingProfile,setSavingProfile]=useState(false);
  const [showJoinModal,setShowJoinModal]=useState(false);
  const [queuedCreate,setQueuedCreate]=useState(false);
  const [pendingJoinAfterProfile,setPendingJoinAfterProfile]=useState(false);
  const [joinCode,setJoinCode]=useState(()=>{
    try {
      const params = new URLSearchParams(window.location.search);
      return String(params.get("invite") || "").trim().toUpperCase();
    } catch { return ""; }
  });
  const [inviteContext,setInviteContext]=useState(null);
  const [inviteError,setInviteError]=useState("");
  const [joiningGroup,setJoiningGroup]=useState(false);
  const [pendingProrationGroupId,setPendingProrationGroupId]=useState(null);
  const [prorationSavingChoice,setProrationSavingChoice]=useState(null);
  const [installPrompt,setInstallPrompt]=useState(null);
  const [installDismissed,setInstallDismissed]=useState(()=>{try{return localStorage.getItem(INSTALL_DISMISSED_KEY)==="1";}catch{return false;}});
  const [standalone,setStandalone]=useState(()=>isStandalone());
  const [syncing,setSyncing]=useState(false);
  const [syncError,setSyncError]=useState(false);
  const [lastSyncedAt,setLastSyncedAt]=useState(null);
  const [showJustSynced,setShowJustSynced]=useState(false);
  const [isMobileView,setIsMobileView]=useState(()=>isMobile());
  const [clockTick,setClockTick]=useState(Date.now());
  const [authReady,setAuthReady]=useState(()=>!!initialPersistedSession?.userId);
  const [authHydrating,setAuthHydrating]=useState(false);
  const [localPreviewAuthEnabled,setLocalPreviewAuthEnabled]=useState(false);
  const [devImpersonationUserId,setDevImpersonationUserId]=useState(()=>{try{return localStorage.getItem(LOCAL_DEV_IMPERSONATION_KEY)||"";}catch{return ""; }});
  const [blocDragX,setBlocDragX]=useState(0);
  const [blocDragging,setBlocDragging]=useState(false);
  const [suppressSwitcherIntro,setSuppressSwitcherIntro]=useState(false);
  const latestRevisionRef = useRef(getRevision(cached));
  const justSyncedTimerRef = useRef(null);
  const optimisticMutationRef = useRef(null);
  const blocSwipeRef = useRef({sx:0,sy:0,active:false,mode:null});

  const persistGroupSelection = useCallback((groupId) => {
    try {
      if (groupId) localStorage.setItem(LOCAL_GROUP_KEY, groupId);
      else localStorage.removeItem(LOCAL_GROUP_KEY);
    } catch {}
    setSelectedGroupId(groupId || null);
  },[]);

  const persistSession = useCallback((session) => {
    const nextSession = session?.userId ? session : null;
    persistLocalPreviewSession(nextSession);
    persistAuthSessionHint(nextSession);
    setAuthSession(nextSession);
  },[]);

  const clearInviteParamFromUrl = useCallback(() => {
    try {
      const url = new URL(window.location.href);
      if (!url.searchParams.has("invite")) return;
      url.searchParams.delete("invite");
      const next = `${url.pathname}${url.search}${url.hash}`;
      window.history.replaceState({}, "", next);
    } catch {}
  },[]);

  const resetInviteFlow = useCallback(({ clearUrl=false } = {}) => {
    setInviteContext(null);
    setInviteError("");
    setJoinCode("");
    if (clearUrl) clearInviteParamFromUrl();
  },[clearInviteParamFromUrl]);

  const currentGroup = selectedGroupId ? appState.groups?.[selectedGroupId] || null : null;
  const localDevMode = isLocalDevEnvironment();
  const profile = getProfileForSession(appState, authSession);
  const devImpersonationOptions = useMemo(() => {
    if (!localDevMode || !currentGroup) return [];
    const activeNames = Array.isArray(currentGroup.activeMemberOrder) && currentGroup.activeMemberOrder.length
      ? currentGroup.activeMemberOrder
      : (currentGroup.memberOrder || []);
    const memberIndex = new Map(activeNames.map((name, index) => [name, index]));
    const members = Object.values(currentGroup.memberships || {})
      .filter(membership => membership?.userId && membership?.displayName)
      .sort((a, b) => (memberIndex.get(a.displayName) ?? 999) - (memberIndex.get(b.displayName) ?? 999));
    const options = authSession?.userId
      ? [{ userId:"", label:`Use signed-in account (${profile?.displayName || authSession?.email || "current"})` }]
      : [];
    members.forEach(membership => {
      options.push({
        userId: membership.userId,
        label: membership.displayName === profile?.displayName ? `${membership.displayName} (you)` : membership.displayName
      });
    });
    return options;
  },[authSession?.email, authSession?.userId, currentGroup, localDevMode, profile?.displayName]);
  const effectiveAuthSession = useMemo(() => {
    if (!localDevMode || !devImpersonationUserId || !authSession?.userId || !currentGroup?.memberships?.[devImpersonationUserId]) {
      return authSession;
    }
    const membership = currentGroup.memberships[devImpersonationUserId];
    return {
      ...authSession,
      userId: devImpersonationUserId,
      email: authSession.email || `${slugifyLocalPreview(membership.displayName)}@local.test`,
      devImpersonationActive: true,
      devImpersonatedByUserId: authSession.userId
    };
  },[authSession, currentGroup, devImpersonationUserId, localDevMode]);
  const effectiveProfile = getProfileForSession(appState, effectiveAuthSession);
  const currentMembership = currentGroup ? getMembershipForUser(currentGroup, effectiveAuthSession, effectiveProfile) : null;
  const currentUser = currentMembership?.displayName || null;
  const isGroupAdmin = currentGroup ? (currentGroup.adminUserId ? currentGroup.adminUserId === effectiveAuthSession?.userId : currentGroup.adminName === currentUser) : false;
  const prorationGroup = pendingProrationGroupId ? appState.groups?.[pendingProrationGroupId] || null : null;

  setActiveSessionUserId(effectiveAuthSession?.userId || "");
  syncActiveGroupGlobals(currentGroup);

  const buildOptimisticState = useCallback((incoming) => {
    const nextState = normalizeAppState({
      ...appState,
      groups: {
        ...appState.groups,
        [incoming.groupId]: normalizeGroupState(incoming.group)
      },
      meta: {
        revision: latestRevisionRef.current,
        updatedAt: new Date().toISOString()
      }
    });
    return nextState;
  }, [appState]);

  const beginOptimisticMutation = useCallback(() => {
    optimisticMutationRef.current = {
      baseRevision: latestRevisionRef.current
    };
  },[]);

  const clearOptimisticMutation = useCallback(() => {
    optimisticMutationRef.current = null;
  },[]);

  useEffect(()=>{
    if(!("serviceWorker" in navigator)) return;
    if (isLocalDevEnvironment()) {
      navigator.serviceWorker.getRegistrations()
        .then(registrations => Promise.all(registrations.map(registration => registration.unregister())))
        .catch(err => console.error("Service worker unregister failed", err));
      return;
    }
    navigator.serviceWorker.register("./sw.js").catch(err=>console.error("Service worker registration failed", err));
  },[]);

  useEffect(()=>{
    const syncViewport = () => setIsMobileView(isMobile());
    window.addEventListener("resize", syncViewport);
    return () => window.removeEventListener("resize", syncViewport);
  },[]);

  useEffect(() => {
    const interval = setInterval(() => setClockTick(Date.now()), 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    window.scrollTo({top:0,left:0,behavior:"auto"});
  }, [page]);

  useEffect(() => {
    if (!joinCode) {
      setInviteContext(null);
      setInviteError("");
      return;
    }
    fetchInviteContextData(joinCode).then(result => {
      if (result?.ok) {
        setInviteContext(result.data);
        setInviteError("");
      } else {
        setInviteContext(null);
        setInviteError(result?.error || "Invite not found");
      }
    });
  }, [joinCode]);


  const applyData = useCallback((data, { optimistic=false, fromMutation=false } = {}) => {
    if(!data) return false;
    const resolved = normalizeAppState(data);
    const incomingRevision = getRevision(resolved);
    const pendingOptimistic = optimisticMutationRef.current;
    if (!optimistic && pendingOptimistic) {
      // While a mutation is in flight, block all background polls and refreshes.
      // Only the mutation's own response (fromMutation:true) is allowed to clear
      // the optimistic state and apply. This prevents a concurrent poll carrying
      // another user's revision from wiping the local optimistic update before
      // the mutation completes.
      if (!fromMutation) return false;
      optimisticMutationRef.current = null;
    }
    if (!optimistic && incomingRevision < latestRevisionRef.current) return false;
    latestRevisionRef.current = Math.max(latestRevisionRef.current, incomingRevision);
    setAppState(resolved);
    writeCachedData(resolved);
    return true;
  },[]);

  const flashJustSynced = useCallback(() => {
    setShowJustSynced(true);
    if (justSyncedTimerRef.current) clearTimeout(justSyncedTimerRef.current);
    justSyncedTimerRef.current = setTimeout(() => setShowJustSynced(false), 2500);
  },[]);

  const refreshNow = useCallback(async () => {
    setSyncing(true);
    setSyncError(false);
    try {
      const data = await fetchData();
      if(data){
        const applied = applyData(data);
        setLastSyncedAt(new Date());
        flashJustSynced();
        if (!applied) setSyncError(false);
      } else {
        setSyncError(true);
      }
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  },[applyData, flashJustSynced]);

  useEffect(()=>{
    const syncStandalone = () => setStandalone(isStandalone());
    const handleBeforeInstallPrompt = event => {
      event.preventDefault();
      setInstallPrompt(event);
      setInstallDismissed(false);
      try { localStorage.removeItem(INSTALL_DISMISSED_KEY); } catch {}
    };
    const handleInstalled = () => {
      setInstallPrompt(null);
      setStandalone(true);
      setInstallDismissed(true);
      try { localStorage.setItem(INSTALL_DISMISSED_KEY, "1"); } catch {}
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);
    window.addEventListener("resize", syncStandalone);
    syncStandalone();

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
      window.removeEventListener("resize", syncStandalone);
    };
  },[]);

  useEffect(() => {
    if (!currentGroup?.settlementConfirmationsEnabled || currentGroup?.settlementConfirmationsPreviewMode || !authSession?.userId) return;
    let active = true;
    let channel = null;
    getSupabaseAuthClient()
      .then(client => {
        if (!active) return;
        channel = client
          .channel(`settlement-confirmations:${currentGroup.id}`)
          .on("postgres_changes", {
            event: "*",
            schema: "ante_core",
            table: "settlement_confirmations"
          }, () => {
            refreshNow();
          })
          .subscribe();
      })
      .catch(error => console.error("Settlement confirmations realtime failed", error));
    return () => {
      active = false;
      if (channel) {
        getSupabaseAuthClient()
          .then(client => client.removeChannel(channel))
          .catch(()=>{});
      }
    };
  }, [authSession?.userId, currentGroup?.id, currentGroup?.settlementConfirmationsEnabled, refreshNow]);

  useEffect(()=>{
    const cachedData = readCachedData();
    if(cachedData){
      applyData(cachedData);
      setLoading(false);
    }

    refreshNow();
    // Poll every few seconds so active devices converge faster without going fully realtime.
    const interval = setInterval(()=>{
      fetchData().then(data=>{
        if(data){
          const applied = applyData(data);
          if (applied) {
            setLastSyncedAt(new Date());
            setSyncError(false);
          }
        } else {
          setSyncError(true);
        }
      }).catch(()=>setSyncError(true));
    }, SYNC_POLL_INTERVAL_MS);
    const handleVisibility = () => {
      if (document.visibilityState === "visible") refreshNow();
    };
    const handleFocus = () => refreshNow();
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("focus", handleFocus);
    return ()=>{
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("focus", handleFocus);
    };
  },[applyData, refreshNow]);

  useEffect(()=>{
    let active = true;
    let subscription = null;

    const bootstrapAuth = async () => {
      try {
        const config = await fetchAuthConfig();
        const localPreviewEnabled = !!config?.enableLocalPreviewAuth;
        if (active) setLocalPreviewAuthEnabled(localPreviewEnabled);
        if (localPreviewEnabled) {
          if (active) persistSession(readLocalPreviewSession());
          return;
        }
        const factory = window.supabase?.createClient;
        if (!factory) throw new Error("Supabase browser client failed to load");
        const client = factory(config.supabaseUrl, config.supabaseAnonKey, {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true
          }
        });
        setSupabaseAuthClientPromise(Promise.resolve(client));
        const initialSession = await getCurrentAuthSession();
        if (!active) return;
        persistSession(initialSession);
        if (initialSession?.accessToken) {
          const shouldHydrateUi = !hasCachedShell;
          if (active && shouldHydrateUi) setAuthHydrating(true);
          try {
            const synced = await syncAuthSessionData(initialSession);
            if (active && synced?.ok && synced.state) applyData(synced.state);
          } finally {
            if (active && shouldHydrateUi) setAuthHydrating(false);
          }
        }
        const listener = client.auth.onAuthStateChange(async (event, session) => {
          const mapped = mapSupabaseSession(session);
          persistSession(mapped);
          if (mapped?.accessToken) {
            const shouldHydrateUi = event === "SIGNED_IN" && !hasCachedShell;
            if (active && shouldHydrateUi) setAuthHydrating(true);
            try {
              const synced = await syncAuthSessionData(mapped);
              if (active && synced?.ok && synced.state) applyData(synced.state);
            } finally {
              if (active && shouldHydrateUi) setAuthHydrating(false);
            }
          } else if (active) {
            setAuthHydrating(false);
          }
        });
        subscription = listener?.data?.subscription || null;
      } catch (error) {
        console.error("Auth bootstrap failed:", error);
      } finally {
        if (active) setAuthReady(true);
      }
    };

    bootstrapAuth();

    return ()=>{
      active = false;
      subscription?.unsubscribe?.();
    };
  },[applyData, persistSession]);

  useEffect(()=>()=>{ if (justSyncedTimerRef.current) clearTimeout(justSyncedTimerRef.current); },[]);

  useEffect(()=>{
    if(selectedGroupId && appState.groups?.[selectedGroupId]) return;
    if(selectedGroupId && !appState.groups?.[selectedGroupId]) {
      persistGroupSelection(null);
    }
  },[appState, selectedGroupId, persistGroupSelection, authSession, profile]);

  useEffect(()=>{
    if (!localDevMode) {
      if (devImpersonationUserId) setDevImpersonationUserId("");
      try { localStorage.removeItem(LOCAL_DEV_IMPERSONATION_KEY); } catch {}
      return;
    }
    if (!devImpersonationUserId) return;
    if (!currentGroup?.memberships?.[devImpersonationUserId]) {
      setDevImpersonationUserId("");
      try { localStorage.removeItem(LOCAL_DEV_IMPERSONATION_KEY); } catch {}
    }
  },[currentGroup, devImpersonationUserId, localDevMode]);

  const handleSelectDevImpersonation = useCallback((nextUserId)=>{
    const normalized = String(nextUserId || "").trim();
    setDevImpersonationUserId(normalized);
    try {
      if (normalized) localStorage.setItem(LOCAL_DEV_IMPERSONATION_KEY, normalized);
      else localStorage.removeItem(LOCAL_DEV_IMPERSONATION_KEY);
    } catch {}
  },[]);

  const handleSave=useCallback(async(newData)=>{
    if(!selectedGroupId || !currentGroup || !currentUser) return;
    const payload = {
      actor: currentUser,
      groupId: selectedGroupId,
      group: normalizeGroupState({
        ...currentGroup,
        logs: newData.logs || currentGroup.logs,
        excused: newData.excused || currentGroup.excused,
        monthHistory: newData.monthHistory || currentGroup.monthHistory,
        lastMonth: newData.lastMonth || curKey
      })
    };
    beginOptimisticMutation();
    applyData(buildOptimisticState(payload), { optimistic:true });
    setSaving(true);
    try{
      const saved = await saveData(payload);
      if(saved){
        const applied = applyData(saved, { fromMutation: true });
        if (applied) {
          setLastSyncedAt(new Date());
          setSyncError(false);
        }
      } else {
        clearOptimisticMutation();
        setSyncError(true);
        window.alert("Workout couldn't be saved. Please check your connection and try again.");
        await refreshNow();
      }
    }catch(e){
      console.error("Save failed",e);
      clearOptimisticMutation();
      setSyncError(true);
      window.alert("Workout couldn't be saved. Please check your connection and try again.");
      await refreshNow();
    }
    setSaving(false);
  },[applyData, beginOptimisticMutation, buildOptimisticState, clearOptimisticMutation, currentGroup, currentUser, refreshNow, selectedGroupId]);

  const handleMultiLog = useCallback(async({ workoutType, isoDate, targetGroupIds, note, photoUrl }) => {
    if(!selectedGroupId || !currentUser) return { ok:false, error:"No Bloc selected" };
    // Optimistic update: add log to UI immediately so the screen responds instantly.
    if(currentGroup) {
      const optimisticLog = { id:`opt-${Date.now()}`, date:isoDate, type:workoutType, note:note||"", photoUrl:photoUrl||"", createdAt:new Date().toISOString(), verifiedVia:"manual", reactions:{} };
      const userLogs = Array.isArray(currentGroup.logs?.[currentUser]) ? currentGroup.logs[currentUser] : [];
      beginOptimisticMutation();
      applyData(buildOptimisticState({ groupId:selectedGroupId, group:{ ...currentGroup, logs:{ ...currentGroup.logs, [currentUser]:[...userLogs, optimisticLog] } } }), { optimistic:true });
    }
    setSaving(true);
    try {
      const result = await multiLogData({
        actor: currentUser,
        actorUserId: authSession?.userId,
        sourceGroupId: selectedGroupId,
        workoutType,
        date: isoDate,
        note,
        photoUrl,
        targetGroupIds
      });
      if(result.ok && result.data){
        const applied = applyData(result.data, { fromMutation: true });
        if (applied) {
          setLastSyncedAt(new Date());
          setSyncError(false);
        }
      } else {
        clearOptimisticMutation();
        setSyncError(true);
        await refreshNow();
      }
      return result;
    } catch(e){
      console.error("Multi-group log failed", e);
      clearOptimisticMutation();
      setSyncError(true);
      await refreshNow();
      return { ok:false, error:"Unable to save workout" };
    } finally {
      setSaving(false);
    }
  },[applyData, beginOptimisticMutation, buildOptimisticState, clearOptimisticMutation, currentGroup, currentUser, refreshNow, selectedGroupId, authSession]);

  const handleUpdateGroupSettings = useCallback(async(groupName, settings)=>{
    if(!selectedGroupId || !currentUser) return { ok:false, error:"No Bloc selected" };
    setSavingSettings(true);
    try {
      const result = await updateGroupSettingsData(selectedGroupId, currentUser, authSession?.userId, groupName, settings);
      if(result.ok && result.data){
        const applied = applyData(result.data);
        if (applied) {
          setLastSyncedAt(new Date());
          setSyncError(false);
        }
        setShowSettings(false);
      } else {
        setSyncError(true);
        await refreshNow();
      }
      return result;
    } finally {
      setSavingSettings(false);
    }
  },[applyData, currentUser, refreshNow, selectedGroupId, authSession]);

  const handleLogMutation = useCallback(async(payload)=>{
    // Optimistic update for delete-log: remove the entry immediately.
    if(payload.action === "delete-log" && payload.logId && currentGroup) {
      const optimisticLogs = Object.fromEntries(
        Object.entries(currentGroup.logs || {}).map(([name, logs]) => [name, logs.filter(l => l.id !== payload.logId)])
      );
      beginOptimisticMutation();
      applyData(buildOptimisticState({ groupId: payload.groupId || selectedGroupId, group: { ...currentGroup, logs: optimisticLogs } }), { optimistic:true });
    }
    // Optimistic update for reaction: toggle the reactor immediately.
    if(payload.action === "reaction" && payload.logId && payload.emoji && payload.actor && currentGroup) {
      const optimisticLogs = Object.fromEntries(
        Object.entries(currentGroup.logs || {}).map(([name, logs]) => [name, logs.map(l => {
          if(l.id !== payload.logId) return l;
          const reactors = Array.isArray(l.reactions?.[payload.emoji]) ? l.reactions[payload.emoji] : [];
          const already = reactors.includes(payload.actor);
          return { ...l, reactions: { ...l.reactions, [payload.emoji]: already ? reactors.filter(r => r !== payload.actor) : [...reactors, payload.actor] } };
        })])
      );
      beginOptimisticMutation();
      applyData(buildOptimisticState({ groupId: payload.groupId || selectedGroupId, group: { ...currentGroup, logs: optimisticLogs } }), { optimistic:true });
    }
    setSaving(true);
    try {
      const result = await mutateLogData({ ...payload, actorUserId: authSession?.userId || payload.actorUserId });
      if(result.ok && result.data){
        const applied = applyData(result.data, { fromMutation: true });
        if (applied) {
          setLastSyncedAt(new Date());
          setSyncError(false);
        }
      } else {
        clearOptimisticMutation();
        setSyncError(true);
        await refreshNow();
      }
      return result;
    } catch (e) {
      console.error("Log mutation failed", e);
      clearOptimisticMutation();
      setSyncError(true);
      await refreshNow();
      return { ok:false, error:"Unable to save change" };
    } finally {
      setSaving(false);
    }
  },[applyData, beginOptimisticMutation, buildOptimisticState, clearOptimisticMutation, currentGroup, refreshNow, selectedGroupId, authSession]);

  const handleSettlementClaimPaid = useCallback(async(payload)=>{
    if (!selectedGroupId) return { ok:false, error:"No Bloc selected" };
    const result = await claimSettlementConfirmationData({
      groupId: selectedGroupId,
      monthKey: payload.monthKey,
      payerDisplayName: payload.payerDisplayName,
      receiverDisplayName: payload.receiverDisplayName,
      amount: payload.amount,
      currency: payload.currency,
      devImpersonationUserId: effectiveAuthSession?.devImpersonationActive ? effectiveAuthSession.userId : ""
    });
    if (result.ok && result.data) {
      const applied = applyData(result.data);
      if (applied) {
        setLastSyncedAt(new Date());
        setSyncError(false);
      }
    }
    return result;
  },[applyData, effectiveAuthSession, selectedGroupId]);

  const handleSettlementConfirmPaid = useCallback(async(payload)=>{
    if (!selectedGroupId) return { ok:false, error:"No Bloc selected" };
    const result = await confirmSettlementConfirmationData({
      groupId: selectedGroupId,
      monthKey: payload.monthKey,
      payerDisplayName: payload.payerDisplayName,
      receiverDisplayName: payload.receiverDisplayName,
      devImpersonationUserId: effectiveAuthSession?.devImpersonationActive ? effectiveAuthSession.userId : ""
    });
    if (result.ok && result.data) {
      const applied = applyData(result.data);
      if (applied) {
        setLastSyncedAt(new Date());
        setSyncError(false);
      }
    }
    return result;
  },[applyData, effectiveAuthSession, selectedGroupId]);

  const handleSettlementDisputePaid = useCallback(async(payload)=>{
    if (!selectedGroupId) return { ok:false, error:"No Bloc selected" };
    const result = await disputeSettlementConfirmationData({
      groupId: selectedGroupId,
      monthKey: payload.monthKey,
      payerDisplayName: payload.payerDisplayName,
      receiverDisplayName: payload.receiverDisplayName,
      devImpersonationUserId: effectiveAuthSession?.devImpersonationActive ? effectiveAuthSession.userId : ""
    });
    if (result.ok && result.data) {
      const applied = applyData(result.data);
      if (applied) {
        setLastSyncedAt(new Date());
        setSyncError(false);
      }
    }
    return result;
  },[applyData, effectiveAuthSession, selectedGroupId]);

  const handleCreateGroup = useCallback(async(payload)=>{
    setCreatingGroup(true);
    try {
      const result = await createGroupData({ ...payload, actorUserId: authSession?.userId });
      if(result.ok && result.state){
        applyData(result.state);
        persistGroupSelection(result.createdGroupId);
        const createdGroup = result.state.groups?.[result.createdGroupId];
        if (shouldPromptProration(createdGroup, authSession?.userId)) {
          setPendingProrationGroupId(result.createdGroupId);
        }
      }
      return result;
    } finally {
      setCreatingGroup(false);
    }
  },[applyData, persistGroupSelection, authSession]);

  const handleSeasonProrationChoice = useCallback(async(choice)=>{
    if (!pendingProrationGroupId || !currentUser) return;
    setProrationSavingChoice(choice);
    const result = await saveSeasonProrationChoice({
      groupId: pendingProrationGroupId,
      actor: currentUser,
      actorUserId: authSession?.userId,
      choice
    });
    setProrationSavingChoice(null);
    if (result?.ok && result.data) {
      applyData(result.data);
      setPendingProrationGroupId(null);
      setLastSyncedAt(new Date());
      setSyncError(false);
    }
  },[pendingProrationGroupId,currentUser,authSession,applyData]);

  const handleSitOutRequest = useCallback(async(payload)=>{
    if (!selectedGroupId || !currentUser) return { ok:false, error:"No Bloc selected" };
    setSaving(true);
    try {
      const result = await requestSitOutData({
        groupId: selectedGroupId,
        actor: currentUser,
        actorUserId: authSession?.userId,
        reason: payload?.reason || "",
        exceptional: !!payload?.exceptional
      });
      if (result?.ok && result.data) {
        const applied = applyData(result.data);
        if (applied) {
          setLastSyncedAt(new Date());
          setSyncError(false);
        }
      }
      return result;
    } finally {
      setSaving(false);
    }
  },[selectedGroupId,currentUser,authSession,applyData]);

  const handleSitOutReview = useCallback(async(payload)=>{
    if (!selectedGroupId || !currentUser) return { ok:false, error:"No Bloc selected" };
    setSaving(true);
    try {
      const result = await reviewSitOutData({
        groupId: selectedGroupId,
        actor: currentUser,
        actorUserId: authSession?.userId,
        memberName: payload.memberName,
        monthKey: payload.monthKey,
        decision: payload.decision
      });
      if (result?.ok && result.data) {
        const applied = applyData(result.data);
        if (applied) {
          setLastSyncedAt(new Date());
          setSyncError(false);
        }
      }
      return result;
    } finally {
      setSaving(false);
    }
  },[selectedGroupId,currentUser,authSession,applyData]);

  const handleKickMember = useCallback(async(targetUserId, targetDisplayName)=>{
    if (!selectedGroupId || !authSession?.userId) return { ok:false, error:"No Bloc selected" };
    const result = await kickMemberData({ groupId: selectedGroupId, actorUserId: authSession.userId, actorDisplayName: currentUser, targetUserId, targetDisplayName });
    if (result.ok && result.state) {
      applyData(result.state);
      setLastSyncedAt(new Date());
      setSyncError(false);
    } else {
      alert(result.error || "Unable to remove member");
    }
    return result;
  },[selectedGroupId, authSession, currentUser, applyData]);

  const handleLeaveBloc = useCallback(async()=>{
    if (!selectedGroupId || !authSession?.userId) return { ok:false };
    const result = await leaveBlocData({ groupId: selectedGroupId, userId: authSession.userId });
    if (result.ok && result.state) {
      applyData(result.state);
      resetInviteFlow({ clearUrl:true });
      setShowProfileModal(false);
      persistGroupSelection(null);
      setLastSyncedAt(new Date());
      setSyncError(false);
    } else {
      alert(result.error || "Unable to leave Bloc");
    }
    return result;
  },[selectedGroupId, authSession, applyData, persistGroupSelection, resetInviteFlow]);

  const handleSwitchUser=async()=>{
    if (!authSession?.localPreview) {
      try { await signOutAuthSession(); } catch (error) { console.error("Sign out failed:", error); }
    }
    persistSession(null);
    persistGroupSelection(null);
    setShowSettings(false);
    setShowProfileModal(false);
  };
  const handleSaveProfileFromModal = async (displayName) => {
    setProfileSaving(true);
    setProfileError("");
    const result = await upsertProfileData({ userId: authSession?.userId, email: authSession?.email, displayName });
    setProfileSaving(false);
    if (!result?.ok) { setProfileError(result?.error || "Unable to save"); return; }
    applyData(result.data);
    setShowProfileModal(false);
  };
  const handleDeleteAccount = async () => {
    const result = await deleteAccountData(authSession?.userId);
    if (!result?.ok) return result;
    if (result.state) applyData(result.state);
    try { await signOutAuthSession(); } catch (error) { console.error("Sign out failed:", error); }
    resetInviteFlow({ clearUrl:true });
    persistSession(null);
    persistGroupSelection(null);
    setShowProfileModal(false);
    return { ok: true };
  };
  const resetBlocSwipe = useCallback(() => {
    blocSwipeRef.current = {sx:0,sy:0,active:false,mode:null};
    setBlocDragging(false);
    setBlocDragX(0);
  },[]);
  const handleSwitchGroup=()=>{
    setSuppressSwitcherIntro(false);
    resetBlocSwipe();
    persistGroupSelection(null);
  };
  const startBlocSwitchSwipe = useCallback((e) => {
    if (page !== "today" || showTodayLog || showSettings || showProfileModal || showStream || showJoinModal || authStep || prorationGroup) return;
    const t = e.touches?.[0];
    if (!t || t.clientX > 64) return;
    blocSwipeRef.current = {sx:t.clientX, sy:t.clientY, active:true, mode:null};
  },[authStep, page, prorationGroup, showJoinModal, showProfileModal, showSettings, showStream, showTodayLog]);
  const moveBlocSwitchSwipe = useCallback((e) => {
    const s = blocSwipeRef.current;
    const t = e.touches?.[0];
    if (!s.active || !t) return;
    const dx = t.clientX - s.sx;
    const dy = t.clientY - s.sy;
    if (!s.mode && (Math.abs(dx) > 5 || Math.abs(dy) > 5)) {
      s.mode = dx > 0 && Math.abs(dx) > Math.abs(dy) * 1.05 ? "back" : "scroll";
      setBlocDragging(s.mode === "back");
    }
    if (s.mode === "back") setBlocDragX(Math.max(0, Math.min(dx, window.innerWidth || 420)));
  },[]);
  const endBlocSwitchSwipe = useCallback((e) => {
    const s = blocSwipeRef.current;
    const t = e.changedTouches?.[0];
    blocSwipeRef.current = {sx:0,sy:0,active:false,mode:null};
    if (!s.active || !t) return;
    const dx = t.clientX - s.sx;
    const dy = t.clientY - s.sy;
    const screenWidth = window.innerWidth || 420;
    const shouldClose = s.mode === "back" && dx > screenWidth * 0.42 && Math.abs(dy) < 100 && dx > Math.abs(dy) * 1.05;
    setBlocDragging(false);
    if (shouldClose) {
      setBlocDragX(screenWidth);
      window.setTimeout(() => {
        setSuppressSwitcherIntro(true);
        resetBlocSwipe();
        persistGroupSelection(null);
      }, 95);
    } else {
      setBlocDragX(0);
    }
  },[persistGroupSelection, resetBlocSwipe]);
  const handleStreamSeasonClosedTap = useCallback((groupId) => {
    if (!groupId) return;
    persistGroupSelection(groupId);
    setShowStream(false);
    setShowTodayLog(false);
    setMonthInitialIdx(0);
    setNavResetToken(value=>value+1);
    setPage("month");
  },[persistGroupSelection]);
  const handleNavSelect = useCallback((nextPage)=>{
    setShowTodayLog(false);
    setMonthInitialIdx(null);
    setNavResetToken(value=>value+1);
    setPage(nextPage);
  },[]);
  const dismissInstall = () => {
    setInstallDismissed(true);
    try { localStorage.setItem(INSTALL_DISMISSED_KEY, "1"); } catch {}
  };
  const installApp = async () => {
    if(!installPrompt) return;
    try {
      await installPrompt.prompt();
      await installPrompt.userChoice;
    } catch (e) {
      console.error("Install prompt failed", e);
    } finally {
      setInstallPrompt(null);
    }
  };
  const showIosHint = !standalone && !installDismissed && isIos() && isSafari() && !installPrompt;
  const showInstallBanner = !standalone && !installDismissed && (Boolean(installPrompt) || showIosHint);
  const groups = appState.groupOrder.map(groupId => appState.groups[groupId]).filter(Boolean);
  const visibleGroups = groups.filter(group => Boolean(getMembershipForUser(group, effectiveAuthSession, effectiveProfile)));
  const localPreviewMembers = uniqueNames(groups.flatMap(group => getCurrentGroupMemberNames(group)));
  const activityAlertCount = currentGroup && currentUser ? getActivityAlertCount(currentGroup, currentUser) : 0;
  const openAuth = intent => {
    setShowJoinModal(false);
    setAuthIntent(intent);
    setAuthStep("email");
    setAuthEmail(authSession?.email || "");
    setAuthCode("");
    setAuthDisplayName(effectiveProfile?.displayName || "");
    setAuthError("");
    setDevOtpCode("");
  };
  const closeAuth = () => {
    setAuthStep(null);
    setAuthIntent(null);
    setAuthCode("");
    setAuthError("");
    setDevOtpCode("");
    setPendingAuthSession(null);
  };
  const continueAfterAuth = async (nextSession = authSession, nextProfile = effectiveProfile) => {
    if (authIntent?.type === "create") {
      setQueuedCreate(true);
      return;
    }
    if (authIntent?.type === "join") {
      setShowJoinModal(true);
      if (inviteContext?.inviteCode) setJoinCode(inviteContext.inviteCode);
    }
  };
  const handleSendOtp = async () => {
    setSendingOtp(true);
    setAuthError("");
    const result = await sendOtpData(authEmail.trim());
    setSendingOtp(false);
    if (!result?.ok) {
      setAuthError(result?.error || "Unable to send code");
      return;
    }
    setDevOtpCode(result.devCode || "");
    setAuthStep("otp");
  };
  const handleVerifyOtp = async () => {
    setVerifyingOtp(true);
    setAuthError("");
    const result = await verifyOtpData(authEmail.trim(), authCode.trim());
    setVerifyingOtp(false);
    if (!result?.ok) {
      setAuthError(result?.error || "Unable to verify code");
      return;
    }
    if (result.state) applyData(result.state);
    const nextSession = {
      userId: result.session.userId,
      email: result.session.email,
      accessToken: result.session.accessToken || authSession?.accessToken || null
    };
    persistSession(nextSession);
    setPendingAuthSession(nextSession);
    let nextProfile = getProfileForSession(result.state || appState, nextSession);
    let needsProfileSetup = typeof result.session.needsProfileSetup === "boolean"
      ? result.session.needsProfileSetup
      : !nextProfile?.displayName;

    if (needsProfileSetup && authIntent?.type !== "join") {
      const freshData = await fetchData();
      if (freshData) {
        applyData(freshData);
        const freshProfile = getProfileForSession(freshData, nextSession);
        if (freshProfile?.displayName) {
          needsProfileSetup = false;
          nextProfile = freshProfile;
        }
      }
    }

    if (needsProfileSetup && authIntent?.type !== "join") {
      setShowJoinModal(false);
      setAuthDisplayName(nextProfile?.displayName || (authEmail.split("@")[0] || "").replace(/[._-]+/g," "));
      setAuthStep("name");
      setAuthError("");
      return;
    }
    closeAuth();
    continueAfterAuth(nextSession, nextProfile);
  };
  const handleSaveProfile = async () => {
    setSavingProfile(true);
    setAuthError("");
    const activeSession = pendingAuthSession || authSession || await getCurrentAuthSession();
    const result = await upsertProfileData(
      { userId: activeSession?.userId, email: activeSession?.email, displayName: authDisplayName.trim() },
      activeSession
    );
    setSavingProfile(false);
    if (!result?.ok) {
      setAuthError(result?.error || "Unable to save profile");
      return;
    }
    if (activeSession?.userId) persistSession(activeSession);
    const applied = result.data ? applyData(result.data) : false;
    if (!applied) {
      await refreshNow();
    }
    closeAuth();
    if (pendingJoinAfterProfile && activeSession?.userId) {
      setPendingJoinAfterProfile(false);
      setShowJoinModal(true);
      setJoiningGroup(true);
      setInviteError("");
      const joinResult = await joinGroupData({ userId: activeSession.userId, inviteCode: joinCode.trim().toUpperCase() });
      setJoiningGroup(false);
      if (!joinResult?.ok) {
        setInviteError(joinResult?.error || "Unable to join Bloc");
        setShowJoinModal(true);
        if (inviteContext?.inviteCode) setJoinCode(inviteContext.inviteCode);
        return;
      }
      applyData(joinResult.state);
      resetInviteFlow({ clearUrl:true });
      persistGroupSelection(joinResult.joinedGroupId);
      setPage("today");
      setShowJoinModal(false);
      return;
    }
    continueAfterAuth(activeSession, getProfileForSession(result.data || appState, activeSession));
  };
  const handleJoinGroup = async () => {
    if (!authSession?.userId) {
      openAuth({ type:"join" });
      return;
    }
    if (!String(profile?.displayName || "").trim()) {
      setPendingJoinAfterProfile(true);
      setShowJoinModal(false);
      setAuthDisplayName((authSession?.email?.split("@")[0] || "").replace(/[._-]+/g," "));
      setAuthError("");
      setAuthStep("name");
      return;
    }
    setJoiningGroup(true);
    setInviteError("");
    const result = await joinGroupData({ userId: authSession.userId, inviteCode: joinCode.trim().toUpperCase() });
    setJoiningGroup(false);
    if (!result?.ok) {
      setInviteError(result?.error || "Unable to join Bloc");
      return;
    }
    applyData(result.state);
    resetInviteFlow({ clearUrl:true });
    persistGroupSelection(result.joinedGroupId);
    setPage("today");
    setShowJoinModal(false);
  };

  const handleSelectLocalPreviewIdentity = useCallback((displayName) => {
    const session = buildLocalPreviewSession(displayName);
    persistSession(session);
    const matchingGroup = groups.find(group => getCurrentGroupMemberNames(group).includes(displayName));
    if (matchingGroup?.id) {
      persistGroupSelection(matchingGroup.id);
      setPage("today");
    }
  },[groups, persistGroupSelection, persistSession]);

  if(loading || !authReady || authHydrating) return React.createElement(Spinner,{label:"Opening Fero..."});
  if(localPreviewAuthEnabled && !authSession?.userId) {
    return React.createElement(IdentitySetup,{
      members: localPreviewMembers,
      onSelect: handleSelectLocalPreviewIdentity
    });
  }
  if(!authSession?.userId) {
    return React.createElement(React.Fragment,null,
      React.createElement(PreviewLanding,{
        inviteContext,
        onCreate:()=>openAuth({ type:"create" }),
        onJoin:()=>openAuth({ type:"join" }),
        onSignIn:()=>openAuth({ type:"signin" })
      }),
      authStep && React.createElement(AuthFlowModal,{
        step:authStep,
        email:authEmail,
        setEmail:setAuthEmail,
        code:authCode,
        setCode:setAuthCode,
        displayName:authDisplayName,
        setDisplayName:setAuthDisplayName,
        onClose:closeAuth,
        onSendOtp:handleSendOtp,
        onVerifyOtp:handleVerifyOtp,
        onSaveProfile:handleSaveProfile,
        sending:sendingOtp,
        verifying:verifyingOtp,
        savingProfile,
        error:authError,
        devCode:devOtpCode
      })
    );
  }
  if(authStep === "name") {
    return React.createElement(AuthFlowModal,{
      step:"name",
      email:authEmail || authSession.email || "",
      setEmail:setAuthEmail,
      code:authCode,
      setCode:setAuthCode,
      displayName:authDisplayName,
      setDisplayName:setAuthDisplayName,
      onClose:closeAuth,
      onSendOtp:handleSendOtp,
      onVerifyOtp:handleVerifyOtp,
      onSaveProfile:handleSaveProfile,
      sending:sendingOtp,
      verifying:verifyingOtp,
      savingProfile,
      error:authError,
      devCode:devOtpCode
    });
  }
  if(!selectedGroupId || !currentGroup || !visibleGroups.some(group => group.id === selectedGroupId)) {
    return React.createElement(React.Fragment,null,
      showJoinModal && !authStep && React.createElement(JoinGroupModal,{inviteContext,joinCode,setJoinCode,onClose:()=>setShowJoinModal(false),onJoin:handleJoinGroup,joining:joiningGroup,error:inviteError,signedIn:true}),
      showProfileModal && React.createElement(ProfileModal,{email:authSession?.email,onSignOut:handleSwitchUser,onClose:()=>{setProfileError("");setShowProfileModal(false);},currentDisplayName:profile?.displayName||"",onSaveDisplayName:handleSaveProfileFromModal,saving:profileSaving,saveError:profileError,onDeleteAccount:handleDeleteAccount}),
      React.createElement(GroupHome,{
            groups: visibleGroups,
            currentIdentity: profile?.displayName || authSession?.email?.split("@")[0] || effectiveProfile?.displayName || effectiveAuthSession?.email?.split("@")[0] || "",
            currentEmail: authSession?.email || effectiveAuthSession?.email,
            currentUserId: authSession?.userId || effectiveAuthSession?.userId || "",
            onOpenProfile:()=>setShowProfile(true),
            creating: creatingGroup,
            autoOpenCreate: queuedCreate,
            onAutoOpenHandled:()=>setQueuedCreate(false),
            onOpenGroup:groupId=>{ setSuppressSwitcherIntro(false); persistGroupSelection(groupId); setPage("today"); },
            onCreateGroup:handleCreateGroup,
            onJoinGroup:()=>setShowJoinModal(true),
            suppressIntro:suppressSwitcherIntro
          }),
      showProfile && React.createElement('div',{style:{position:"fixed",inset:0,zIndex:30,overflowY:"auto",WebkitOverflowScrolling:"touch",background:"transparent"}},
        React.createElement(ProfilePage,{
          visibleGroups,
          currentUserId: effectiveAuthSession?.userId,
          displayName: effectiveProfile?.displayName || profile?.displayName || "",
          email: authSession?.email,
          accountCreatedAt: profile?.createdAt,
          onBack:()=>setShowProfile(false),
          onEditName:()=>setShowProfileModal(true),
          onSignOut:handleSwitchUser,
          onDeleteAccount:handleDeleteAccount
        })
      )
    );
  }
  if(!currentUser || !getMembershipForUser(currentGroup, effectiveAuthSession, effectiveProfile)) {
    return React.createElement(GroupAccessNotice,{
      groupName: currentGroup.name,
      userName: effectiveProfile?.displayName || "",
      onBack: handleSwitchGroup
    });
  }

  const streamUnreadCount = getUnreadCount(currentGroup.id, {
    currentUserId: effectiveAuthSession?.userId,
    members: Object.values(currentGroup.memberships || {}).map(m => ({ id: m.userId, name: m.displayName }))
  });

  const activeBlocSurface = React.createElement('div',{
    onTouchStart:startBlocSwitchSwipe,
    onTouchMove:moveBlocSwitchSwipe,
    onTouchEnd:endBlocSwitchSwipe,
    onTouchCancel:resetBlocSwipe,
    style:{
      position:"relative",
      zIndex:1,
      minHeight:"100vh",
      background:"var(--bg-gradient)",
      backgroundImage:"var(--bg-radial-hint), var(--bg-gradient)",
      transform:blocDragX?`translateX(${blocDragX}px)`:"none",
      transition:blocDragging?"none":"transform .12s ease",
      boxShadow:blocDragX?"-18px 0 34px rgba(0,0,0,.28)":"none",
      willChange:blocDragging||blocDragX?"transform":"auto",
      touchAction:"pan-y"
    }
  },
    React.createElement(Nav,{page,setPage:handleNavSelect,user:currentUser,groupName:currentGroup.name,canEditGroup:isGroupAdmin,onOpenSettings:()=>setShowSettings(true),onOpenProfile:()=>{setProfileError("");setShowProfileModal(true);},onOpenStream:()=>{markStreamRead(currentGroup.id);setShowStream(true);},streamUnreadCount,onSwitchUser:handleSwitchUser,onSwitchGroup:handleSwitchGroup,onOpenLog:()=>{setPage("today");setShowTodayLog(true);},syncing,lastSyncedAt,syncError,onRefresh:refreshNow,showJustSynced,activityAlertCount,hideMobileBottomNav:true}),
    localDevMode && React.createElement(LocalDevImpersonationBar,{options:devImpersonationOptions,value:effectiveAuthSession?.devImpersonationActive?effectiveAuthSession.userId:"",onChange:handleSelectDevImpersonation}),
    React.createElement('div',{style:{paddingBottom:isMobileView?"calc(86px + env(safe-area-inset-bottom))":0}},
      page==="today"  &&React.createElement(TodayPageErrorBoundary,{resetKey:`${selectedGroupId}:${navResetToken}:${currentUser}`},
        React.createElement(TodayPage,  {user:currentUser,currentUserId:effectiveAuthSession?.userId,currentGroupId:selectedGroupId,groups,logs:currentGroup.logs,excused:currentGroup.excused,monthHistory:currentGroup.monthHistory,saving,onSave:handleSave,onMultiLog:handleMultiLog,onLogMutation:handleLogMutation,clockTick,onViewLastMonth:()=>{setMonthInitialIdx(0);setPage("month");},onSitOutRequest:handleSitOutRequest,onSettlementClaimPaid:handleSettlementClaimPaid,onSettlementConfirmPaid:handleSettlementConfirmPaid,onSettlementDisputePaid:handleSettlementDisputePaid,navResetToken,showLog:showTodayLog,setShowLog:setShowTodayLog})
      ),
      page==="activity"&&React.createElement(ActivityPage,{group:currentGroup,currentUser,onLogMutation:handleLogMutation,clockTick}),
      page==="month"  &&React.createElement(MonthPage,  {key:`${selectedGroupId}:${navResetToken}:${monthInitialIdx ?? "current"}`,group:currentGroup,logs:currentGroup.logs,excused:currentGroup.excused,monthHistory:currentGroup.monthHistory,groupSettings:currentGroup.settings,currentUser,currentUserId:effectiveAuthSession?.userId,initialSelIdx:monthInitialIdx,onStartNextMonth:()=>{setMonthInitialIdx(null);setPage("today");},onOpenToday:()=>setPage("today"),onSettlementClaimPaid:handleSettlementClaimPaid,onSettlementConfirmPaid:handleSettlementConfirmPaid,navResetToken}),
      page==="history"&&React.createElement(HistoryPage,{group:currentGroup,logs:currentGroup.logs,excused:currentGroup.excused,monthHistory:currentGroup.monthHistory,groupSettings:currentGroup.settings,navResetToken,currentUser})
    ),
    showInstallBanner && React.createElement(InstallBanner,{
      installReady:Boolean(installPrompt),
      onInstall:installApp,
      onDismiss:dismissInstall,
      showIosHint
    })
  );

  return React.createElement(React.Fragment,null,
    showJoinModal && !authStep && React.createElement(JoinGroupModal,{inviteContext,joinCode,setJoinCode,onClose:()=>setShowJoinModal(false),onJoin:handleJoinGroup,joining:joiningGroup,error:inviteError,signedIn:true}),
    showProfileModal && React.createElement(ProfileModal,{email:authSession?.email,onSignOut:handleSwitchUser,onClose:()=>setShowProfileModal(false),showDisplayName:true,currentDisplayName:currentUser,onSaveDisplayName:handleSaveProfileFromModal,saving:profileSaving,saveError:profileError,onLeaveBloc:handleLeaveBloc,onDeleteAccount:handleDeleteAccount}),
    showSettings && React.createElement(GroupSettingsModal,{group:currentGroup,actor:currentUser,actorUserId:authSession?.userId,onSave:isGroupAdmin?handleUpdateGroupSettings:null,onClose:()=>setShowSettings(false),saving:savingSettings,onReviewSitOut:isGroupAdmin?handleSitOutReview:null,onKickMember:isGroupAdmin?handleKickMember:null}),
    React.createElement(BlocStream,{open:showStream,groupName:currentGroup.name,blocId:currentGroup.id,currentUserId:effectiveAuthSession?.userId,members:Object.values(currentGroup.memberships||{}).map(m=>({id:m.userId,name:m.displayName})),streamBlocs:visibleGroups.map(group=>({id:group.id,name:group.name,members:Object.values(group.memberships||{}).map(m=>({id:m.userId,name:m.displayName}))})),onSeasonClosedTap:handleStreamSeasonClosedTap,onClose:()=>setShowStream(false)}),
    prorationGroup && React.createElement(ProrationChoiceModal,{
      monthName: getCurrentMonthSummary(prorationGroup).monthName,
      fullMas: prorationGroup.settings?.minTarget || MIN_TARGET,
      daysRemaining: getCurrentMonthSummary(prorationGroup).daysRemaining,
      daysInMonth: getCurrentMonthSummary(prorationGroup).daysInMonth,
      proratedMas: Math.max(1, Math.round((getCurrentMonthSummary(prorationGroup).daysRemaining / getCurrentMonthSummary(prorationGroup).daysInMonth) * (prorationGroup.settings?.minTarget || MIN_TARGET))),
      onKeep:()=>handleSeasonProrationChoice("keep"),
      onProrate:()=>handleSeasonProrationChoice("prorate"),
      savingChoice:prorationSavingChoice
    }),
    page==="today"&&React.createElement('div',{style:{position:"fixed",inset:0,zIndex:0,pointerEvents:"none"}},
      React.createElement(GroupHome,{
        groups: visibleGroups,
        currentIdentity: profile?.displayName || authSession?.email?.split("@")[0] || effectiveProfile?.displayName || effectiveAuthSession?.email?.split("@")[0] || "",
        currentEmail: authSession?.email || effectiveAuthSession?.email,
        currentUserId: authSession?.userId || effectiveAuthSession?.userId || "",
        onOpenProfile:()=>{},
        creating: creatingGroup,
        autoOpenCreate: false,
        onAutoOpenHandled:()=>{},
        onOpenGroup:()=>{},
        onCreateGroup:()=>{},
        onJoinGroup:()=>{},
        suppressIntro:true
      })
    ),
    activeBlocSurface,
    React.createElement(Nav,{onlyMobileBottomNav:true,page,setPage:handleNavSelect,user:currentUser,groupName:currentGroup.name,canEditGroup:isGroupAdmin,onOpenSettings:()=>setShowSettings(true),onOpenProfile:()=>{setProfileError("");setShowProfileModal(true);},onOpenStream:()=>{markStreamRead(currentGroup.id);setShowStream(true);},streamUnreadCount,onSwitchUser:handleSwitchUser,onSwitchGroup:handleSwitchGroup,onOpenLog:()=>{setPage("today");setShowTodayLog(true);},syncing,lastSyncedAt,syncError,onRefresh:refreshNow,showJustSynced,activityAlertCount,mobileBottomDragX:blocDragX,mobileBottomDragging:blocDragging})
  );
};


export { App };
