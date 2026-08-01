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
  getMonthKeyFromISO,
  normalizeGroupState,
  buildEmptyAppState,
  normalizeAppState,
  getProfileForSession,
  getMembershipForUser,
  syncActiveGroupGlobals,
  syncActiveProfileGlobals,
  getCurrentGroupMemberNames,
  flattenFeedPosts,
  setActiveSessionUserId,
  getSetupReviewPendingCount
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
  requestSoloData,
  reviewSoloData,
  deleteAccountData,
  checkAuthEmailExistsData,
  sendOtpData,
  verifyOtpData,
  upsertProfileData,
  uploadProfilePhotoData,
  joinGroupData,
  fetchInviteContextData,
  kickMemberData,
  leaveBlocData,
  multiLogData,
  mutateLogData,
  getBlocStreamUnreadCountData,
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
import {
  cancelSwipeFrame,
  clearInlineSwipeStyles,
  releaseSwipeBack,
  releaseSwipeForward
} from "./lib/swipeRelease.js";
import { Spinner, InstallBanner, TodayPageErrorBoundary } from "./components/primitives.jsx";
import { PreviewLanding, SignedOutLanding, ProfileModal, JoinGroupModal, AuthFlowModal, DisplayNameSetupScreen, IdentitySetup, CreatedBlocInviteScreen, GroupHome, GroupAccessNotice, LocalDevImpersonationBar } from "./components/authShell.jsx";
import { GroupCreateModal, ProrationChoiceModal } from "./modals/modals.jsx";
import { Nav } from "./pages/Nav.jsx";
import { TodayPage } from "./pages/TodayPage.jsx";
import { ActivityPage } from "./pages/ActivityPage.jsx";
import { MonthPage } from "./pages/MonthPage.jsx";
import { HistoryPage } from "./pages/HistoryPage.jsx";
import { BlocStream } from "./pages/BlocStream.jsx";
import { ProfilePage } from "./pages/ProfilePage.jsx";
import { BlocSettingsScreen } from "./pages/BlocSettingsScreen.jsx";
import { LogCommentThread } from "./components/LogCommentThread.jsx";
import { ColdOnboarding } from "./components/ColdOnboarding.jsx";
import { InviteWelcomeScreen } from "./components/InviteWelcomeScreen.jsx";

const normalizeReactionMembers = (members) => Array.isArray(members)
  ? Array.from(new Set(members.filter(Boolean))).sort()
  : [];

const reactionsMatch = (a, b) => {
  const left = normalizeReactionMembers(a);
  const right = normalizeReactionMembers(b);
  return left.length === right.length && left.every((member, index) => member === right[index]);
};

const preserveKnownProfilePhotos = (current, incoming) => {
  const existingProfiles = current?.profiles || {};
  const incomingProfiles = incoming?.profiles || {};
  let changed = false;
  const mergedProfiles = { ...incomingProfiles };
  const incomingMemberIds = new Set();
  Object.values(incoming?.groups || {}).forEach(group => {
    Object.values(group?.memberships || {}).forEach(membership => {
      const userId = String(membership?.userId || "").trim();
      if (userId) incomingMemberIds.add(userId);
    });
  });
  Object.entries(existingProfiles).forEach(([userId, existing]) => {
    const existingPhoto = String(existing?.profilePhotoUrl || "").trim();
    if (!existingPhoto) return;
    const incomingProfile = mergedProfiles[userId];
    if (!incomingProfile) {
      if (!incomingMemberIds.has(userId)) return;
      mergedProfiles[userId] = existing;
      changed = true;
      return;
    }
    if (String(incomingProfile.profilePhotoUrl || "").trim()) return;
    mergedProfiles[userId] = { ...incomingProfile, profilePhotoUrl: existingPhoto };
    changed = true;
  });
  return changed ? { ...incoming, profiles: mergedProfiles } : incoming;
};

const SetupProgressScreen = () => {
  const labels = ["Saving your name...", "Setting up your Bloc...", "Almost done...", "Opening your Bloc..."];
  const [index,setIndex]=useState(0);
  useEffect(()=>{
    const timer = window.setInterval(()=>setIndex(current=>Math.min(labels.length-1,current+1)),1800);
    return ()=>window.clearInterval(timer);
  },[]);
  return React.createElement(Spinner,{label:labels[index]});
};

const IN_BLOC_PAGES = ["today", "activity", "month", "history"];
const COLD_ONBOARDING_SEEN_KEY = "fero_cold_onboarding_seen";
const INVITE_WELCOME_SEEN_PREFIX = "fero_invite_welcome_seen";
const INVITE_HANDOFF_MARKER_KEY = "fero_invite_web_handoff";

const inviteWelcomeSeenKey = (userId, groupId) => `${INVITE_WELCOME_SEEN_PREFIX}:${userId || "anon"}:${groupId || "none"}`;

const hasSeenInviteWelcome = (userId, groupId) => {
  try { return localStorage.getItem(inviteWelcomeSeenKey(userId, groupId)) === "1"; } catch { return false; }
};

const markInviteWelcomeSeen = (userId, groupId) => {
  try { localStorage.setItem(inviteWelcomeSeenKey(userId, groupId), "1"); } catch {}
};

const persistInviteWebHandoffMarker = ({userId, groupId, inviteCode}) => {
  try {
    localStorage.setItem(INVITE_HANDOFF_MARKER_KEY, JSON.stringify({
      userId:userId || "",
      groupId:groupId || "",
      inviteCode:inviteCode || "",
      joinedAt:new Date().toISOString()
    }));
  } catch {}
};

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
  const [createdInviteGroupId,setCreatedInviteGroupId]=useState(null);
  const [showProfileModal,setShowProfileModal]=useState(false);
  const [showProfile,setShowProfile]=useState(false);
  const [showStream,setShowStream]=useState(false);
  const [streamFocusBlocId,setStreamFocusBlocId]=useState(null);
  const [streamReturnScrollTop,setStreamReturnScrollTop]=useState(null);
  const [logCommentScreen,setLogCommentScreen]=useState(null);
  const [logCommentCountOverrides,setLogCommentCountOverrides]=useState({});
  const [monthInitialIdx,setMonthInitialIdx]=useState(null);
  const [profileSaving,setProfileSaving]=useState(false);
  const [profileError,setProfileError]=useState("");
  const [appState,setAppState]=useState(()=>cached||buildEmptyAppState());
  const [selectedGroupId,setSelectedGroupId]=useState(()=>{try{return localStorage.getItem(LOCAL_GROUP_KEY)||null;}catch{return null;}});
  const [authSession,setAuthSession]=useState(()=>initialPersistedSession);
  const [pendingAuthSession,setPendingAuthSession]=useState(null);
  const [authStep,setAuthStep]=useState(null);
  const [authIntent,setAuthIntent]=useState(null);
  const [coldOnboardingSeen,setColdOnboardingSeen]=useState(()=>{try{return localStorage.getItem(COLD_ONBOARDING_SEEN_KEY)==="1";}catch{return false;}});
  const [replayColdOnboarding,setReplayColdOnboarding]=useState(false);
  const [coldOnboardingInitialIndex,setColdOnboardingInitialIndex]=useState(0);
  const [coldOnboardingPreviewDismissed,setColdOnboardingPreviewDismissed]=useState(false);
  const [authEmail,setAuthEmail]=useState("");
  const [authCode,setAuthCode]=useState("");
  const [authDisplayName,setAuthDisplayName]=useState("");
  const [authError,setAuthError]=useState("");
  const [devOtpCode,setDevOtpCode]=useState("");
  const [authExistingAccountEmail,setAuthExistingAccountEmail]=useState("");
  const [authExistingAccountConfirmed,setAuthExistingAccountConfirmed]=useState(false);
  const [postAuthActionPending,setPostAuthActionPending]=useState(false);
  const [sendingOtp,setSendingOtp]=useState(false);
  const [verifyingOtp,setVerifyingOtp]=useState(false);
  const [savingProfile,setSavingProfile]=useState(false);
  const [showJoinModal,setShowJoinModal]=useState(false);
  const [queuedCreate,setQueuedCreate]=useState(false);
  const [queuedCreateGroupName,setQueuedCreateGroupName]=useState("");
  const [onboardingCreateModalOpen,setOnboardingCreateModalOpen]=useState(false);
  const [onboardingCreateInitialName,setOnboardingCreateInitialName]=useState("");
  const [pendingOnboardingCreatePayload,setPendingOnboardingCreatePayload]=useState(null);
  const [returnToColdOnboardingOnCreateCancel,setReturnToColdOnboardingOnCreateCancel]=useState(false);
  const [returnToColdOnboardingOnJoinCancel,setReturnToColdOnboardingOnJoinCancel]=useState(false);
  const [pendingJoinAfterProfile,setPendingJoinAfterProfile]=useState(false);
  // Cold-onboarding join collects the invite code BEFORE auth, so a brand-new
  // account lands straight in the target Bloc after display-name setup.
  const [onboardingJoinCodeStep,setOnboardingJoinCodeStep]=useState(false);
  const [checkingOnboardingInvite,setCheckingOnboardingInvite]=useState(false);
  const [joinCode,setJoinCode]=useState(()=>{
    try {
      const params = new URLSearchParams(window.location.search);
      return String(params.get("invite") || "").trim().toUpperCase();
    } catch { return ""; }
  });
  const [inviteContext,setInviteContext]=useState(null);
  const [inviteError,setInviteError]=useState("");
  const [joiningGroup,setJoiningGroup]=useState(false);
  const [inviteWelcomeGroupId,setInviteWelcomeGroupId]=useState(null);
  const [inviteDownloadPrompt,setInviteDownloadPrompt]=useState(null);
  const [pendingProrationGroupId,setPendingProrationGroupId]=useState(null);
  const [prorationSavingChoice,setProrationSavingChoice]=useState(null);
  const [installPrompt,setInstallPrompt]=useState(null);
  const [installDismissed,setInstallDismissed]=useState(()=>{try{return localStorage.getItem(INSTALL_DISMISSED_KEY)==="1";}catch{return false;}});
  const [standalone,setStandalone]=useState(()=>isStandalone());
  const [syncing,setSyncing]=useState(false);
  const [syncError,setSyncError]=useState(false);
  const [lastSyncedAt,setLastSyncedAt]=useState(null);
  const [showJustSynced,setShowJustSynced]=useState(false);
  const [reactionOverrides,setReactionOverrides]=useState({});
  const [isMobileView,setIsMobileView]=useState(()=>isMobile());
  const [clockTick,setClockTick]=useState(Date.now());
  const [authReady,setAuthReady]=useState(()=>!!initialPersistedSession?.userId);
  const [authHydrating,setAuthHydrating]=useState(false);
  const [localPreviewAuthEnabled,setLocalPreviewAuthEnabled]=useState(false);
  const [devImpersonationUserId,setDevImpersonationUserId]=useState(()=>{try{return localStorage.getItem(LOCAL_DEV_IMPERSONATION_KEY)||"";}catch{return ""; }});
  const [blocDragging,setBlocDragging]=useState(false);
  const [pageDragging,setPageDragging]=useState(false);
  const [pageSwipeTarget,setPageSwipeTarget]=useState(null);
  const [suppressSwitcherIntro,setSuppressSwitcherIntro]=useState(false);
  const [streamUnreadCount,setStreamUnreadCount]=useState(0);
  const [hiddenLeftGroupIds,setHiddenLeftGroupIds]=useState({});
  const [profileRevealActive,setProfileRevealActive]=useState(false);
  const latestRevisionRef = useRef(getRevision(cached));
  const justSyncedTimerRef = useRef(null);
  const optimisticMutationRef = useRef(null);
  const logMutationQueueRef = useRef(Promise.resolve());
  const reactionMutationQueuesRef = useRef({});
  const inviteDownloadPromptTimerRef = useRef(null);
  const blocSwipeRef = useRef({sx:0,sy:0,active:false,mode:null});
  const blocSurfaceRef = useRef(null);
  const blocBottomNavRef = useRef(null);
  const blocDragXRef = useRef(0);
  const blocFrameRef = useRef(null);
  const pageSwipeRef = useRef({sx:0,sy:0,active:false,mode:null,target:null});
  const pageLayerRefs = useRef({});
  const pageDragXRef = useRef(0);
  const pageFrameRef = useRef(null);
  const profileOverlayRef = useRef(null);

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

  const scheduleInviteDownloadPrompt = useCallback((groupId) => {
    if (inviteDownloadPromptTimerRef.current) clearTimeout(inviteDownloadPromptTimerRef.current);
    inviteDownloadPromptTimerRef.current = setTimeout(() => {
      setInviteDownloadPrompt({ groupId });
    }, 2200);
  },[]);

  const completeInviteJoin = useCallback(({groupId, userId, inviteCode}) => {
    if (!groupId) return;
    persistGroupSelection(groupId);
    setPage("today");
    persistInviteWebHandoffMarker({ userId, groupId, inviteCode });
    if (hasSeenInviteWelcome(userId, groupId)) {
      scheduleInviteDownloadPrompt(groupId);
      return;
    }
    setInviteWelcomeGroupId(groupId);
  },[persistGroupSelection, scheduleInviteDownloadPrompt]);

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
  syncActiveProfileGlobals(appState.profiles);

  useEffect(()=>{
    setReactionOverrides(current => {
      let changed = false;
      const next = {};
      Object.entries(current).forEach(([key, override]) => {
        const group = appState.groups?.[override.groupId];
        if (!group) {
          changed = true;
          return;
        }
        const post = flattenFeedPosts(group).find(item => item.owner === override.owner && item.id === override.logId);
        if (!post) {
          changed = true;
          return;
        }
        const baseMembers = post.reactions?.[override.emoji] || [];
        if (reactionsMatch(baseMembers, override.members)) {
          changed = true;
          return;
        }
        next[key] = override;
      });
      return changed ? next : current;
    });
  },[appState]);

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

  useEffect(() => () => {
    if (inviteDownloadPromptTimerRef.current) clearTimeout(inviteDownloadPromptTimerRef.current);
  }, []);

  useEffect(() => {
    window.scrollTo({top:0,left:0,behavior:"auto"});
  }, [page]);

  useEffect(() => {
    const el = profileOverlayRef.current;
    if (!showProfile || !el) return undefined;
    let startX = 0;
    let startY = 0;
    const handleTouchStart = event => {
      const touch = event.touches?.[0];
      if (!touch) return;
      startX = touch.clientX;
      startY = touch.clientY;
    };
    const handleTouchMove = event => {
      const touch = event.touches?.[0];
      if (!touch || !event.cancelable) return;
      const dx = touch.clientX - startX;
      const dy = touch.clientY - startY;
      if (Math.abs(dx) >= Math.abs(dy)) return;
      const atTop = el.scrollTop <= 0;
      const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 1;
      if ((dy > 0 && atTop) || (dy < 0 && atBottom)) event.preventDefault();
    };
    el.addEventListener("touchstart", handleTouchStart, { passive: true });
    el.addEventListener("touchmove", handleTouchMove, { passive: false });
    return () => {
      el.removeEventListener("touchstart", handleTouchStart);
      el.removeEventListener("touchmove", handleTouchMove);
    };
  }, [showProfile]);

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
    setAppState(current => {
      const next = preserveKnownProfilePhotos(current, resolved);
      writeCachedData(next);
      return next;
    });
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
    const interval = setInterval(()=>{
      if (document.visibilityState === "hidden") return;
      fetchRevision().then(revision=>{
        if (revision === null) {
          setSyncError(true);
          return;
        }
        if (revision <= latestRevisionRef.current) {
          setSyncError(false);
          return;
        }
        return fetchData().then(data=>{
          if(data){
            const applied = applyData(data);
            if (applied) {
              setLastSyncedAt(new Date());
              setSyncError(false);
            }
          } else {
            setSyncError(true);
          }
        });
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

  const handleSave=useCallback(async({ workoutType, isoDate, note, photoUrl })=>{
    if(!selectedGroupId || !currentGroup || !currentUser) return;
    const optimisticLog = {
      id:`opt-${Date.now()}`,
      date:isoDate,
      type:workoutType,
      note:note||"",
      photoUrl:photoUrl||"",
      createdAt:new Date().toISOString(),
      verifiedVia:"photo",
      reactions:{},
      flagStatus:null,
      flagReason:"",
      flagResponse:"",
      flaggedBy:null,
      decisionBy:null,
      decisionAt:null
    };
    const targetMonthKey = getMonthKeyFromISO(isoDate);
    if (targetMonthKey !== curKey) {
      window.alert("You can't log to a closed month.");
      return;
    }
    const optimisticGroup = normalizeGroupState({
      ...currentGroup,
      logs: {
        ...currentGroup.logs,
        [currentUser]: [...(currentGroup.logs?.[currentUser] || []), optimisticLog]
      }
    });
    beginOptimisticMutation();
    applyData(buildOptimisticState({ groupId: selectedGroupId, group: optimisticGroup }), { optimistic:true });
    setSaving(true);
    try{
      const saved = await addLogData({
        groupId: selectedGroupId,
        actor: currentUser,
        actorUserId: authSession?.userId,
        workoutType,
        date: isoDate,
        note,
        photoUrl
      });
      if(saved?.ok && saved.data){
        const applied = applyData(saved.data, { fromMutation: true });
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
  },[addLogData, applyData, authSession?.userId, beginOptimisticMutation, buildOptimisticState, clearOptimisticMutation, currentGroup, currentUser, refreshNow, selectedGroupId]);

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

  const handleUpdateGroupSettings = useCallback(async(groupName, settings, options = {})=>{
    if(!selectedGroupId || !currentUser) return { ok:false, error:"No Bloc selected" };
    setSavingSettings(true);
    try {
      const result = await updateGroupSettingsData(selectedGroupId, currentUser, authSession?.userId, groupName, settings, options);
      if(result.ok && result.data){
        const applied = applyData(result.data);
        if (applied) {
          setLastSyncedAt(new Date());
          setSyncError(false);
        }
        if (options.closeAfterSave !== false) setShowSettings(false);
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
    if (payload.action === "reaction") {
      const reactionKey = [
        payload.groupId || selectedGroupId || "",
        payload.owner || "",
        payload.logId || "",
        payload.emoji || ""
      ].join(":");
      const runReactionMutation = async()=>{
        try {
          const result = await mutateLogData({ ...payload, actorUserId: authSession?.userId || payload.actorUserId });
          if(result.ok){
            setLastSyncedAt(new Date());
            setSyncError(false);
          } else {
            setSyncError(true);
            await refreshNow();
          }
          return result;
        } catch (e) {
          console.error("Reaction mutation failed", e);
          setSyncError(true);
          await refreshNow();
          return { ok:false, error:"Unable to save reaction" };
        }
      };
      const previous = reactionMutationQueuesRef.current[reactionKey] || Promise.resolve();
      const queued = previous.then(runReactionMutation, runReactionMutation);
      const tail = queued.catch(()=>{});
      reactionMutationQueuesRef.current[reactionKey] = tail;
      queued.finally(()=>{
        if (reactionMutationQueuesRef.current[reactionKey] === tail) {
          delete reactionMutationQueuesRef.current[reactionKey];
        }
      });
      return queued;
    }
    const runMutation = async()=>{
      // Optimistic update for delete-log: remove the entry immediately.
      if(payload.action === "delete-log" && payload.logId && currentGroup) {
        const optimisticLogs = Object.fromEntries(
          Object.entries(currentGroup.logs || {}).map(([name, logs]) => [name, logs.filter(l => l.id !== payload.logId)])
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
    };
    const queued = logMutationQueueRef.current.then(runMutation, runMutation);
    logMutationQueueRef.current = queued.catch(()=>{});
    return queued;
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

  const handleCreateGroup = useCallback(async(payload, options = {})=>{
    setCreatingGroup(true);
    try {
      const result = await createGroupData({ ...payload, actorUserId: options.actorUserId || authSession?.userId });
      if(result.ok && result.state){
        applyData(result.state);
        setHiddenLeftGroupIds(current => {
          if (!current[result.createdGroupId]) return current;
          const next = { ...current };
          delete next[result.createdGroupId];
          return next;
        });
        if (options.showInviteScreen === false) {
          setCreatedInviteGroupId(null);
          persistGroupSelection(result.createdGroupId);
          setPage("today");
        } else {
          setCreatedInviteGroupId(result.createdGroupId);
        }
        setSuppressSwitcherIntro(true);
        setReturnToColdOnboardingOnCreateCancel(false);
        setReturnToColdOnboardingOnJoinCancel(false);
      }
      return result;
    } finally {
      setCreatingGroup(false);
    }
  },[applyData, authSession?.userId, persistGroupSelection]);

  const handleContinueFromCreatedInvite = useCallback(()=>{
    const createdGroup = appState.groups?.[createdInviteGroupId];
    if (!createdGroup?.id) {
      setCreatedInviteGroupId(null);
      return;
    }
    setCreatedInviteGroupId(null);
    persistGroupSelection(createdGroup.id);
    setPage("today");
    if (shouldPromptProration(createdGroup, authSession?.userId)) {
      setPendingProrationGroupId(createdGroup.id);
    }
  },[appState.groups, authSession, createdInviteGroupId, persistGroupSelection]);

  const handleReviewSetupDefaults = useCallback(()=>{
    if (!currentGroup || getSetupReviewPendingCount(currentGroup) === 0) return;
    return handleUpdateGroupSettings(currentGroup.name, currentGroup.settings, {
      setupReview: { pending: {} },
      closeAfterSave: false
    });
  },[currentGroup, handleUpdateGroupSettings]);

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

  const handleSoloRequest = useCallback(async(payload)=>{
    if (!selectedGroupId || !currentUser) return { ok:false, error:"No Bloc selected" };
    setSaving(true);
    try {
      const result = await requestSoloData({
        groupId: selectedGroupId,
        actor: currentUser,
        actorUserId: authSession?.userId,
        personalTarget: payload?.personalTarget,
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

  const handleSoloReview = useCallback(async(payload)=>{
    if (!selectedGroupId || !currentUser) return { ok:false, error:"No Bloc selected" };
    setSaving(true);
    try {
      const result = await reviewSoloData({
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
    const leavingGroupId = selectedGroupId;
    const result = await leaveBlocData({ groupId: leavingGroupId, userId: authSession.userId });
    if (result.ok && result.state) {
      setHiddenLeftGroupIds(current => ({ ...current, [leavingGroupId]: true }));
      applyData(result.state);
      resetInviteFlow({ clearUrl:true });
      setShowProfileModal(false);
      setShowStream(false);
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
  const handleUpdateProfilePhoto = useCallback(async (dataUrl) => {
    const result = await uploadProfilePhotoData(dataUrl);
    if (!result?.ok) return result;
    if (result.data) applyData(result.data, { fromMutation:true });
    const profilePhotoUrl = String(result.profilePhotoUrl || "").trim();
    if (profilePhotoUrl && effectiveAuthSession?.userId) {
      setAppState(current => {
        const normalized = normalizeAppState(current);
        const userId = effectiveAuthSession.userId;
        const existing = normalized.profiles?.[userId] || {};
        const updated = normalizeAppState({
          ...normalized,
          profiles: {
            ...(normalized.profiles || {}),
            [userId]: {
              id: userId,
              email: effectiveAuthSession.email || existing.email || "",
              displayName: effectiveProfile?.displayName || existing.displayName || "",
              profilePhotoUrl,
              createdAt: existing.createdAt || new Date().toISOString()
            }
          }
        });
        latestRevisionRef.current = Math.max(latestRevisionRef.current, getRevision(updated));
        writeCachedData(updated);
        return updated;
      });
    }
    setLastSyncedAt(new Date());
    setSyncError(false);
    return { ok: true, profilePhotoUrl };
  }, [applyData, effectiveAuthSession, effectiveProfile]);
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
  const applyBlocTransforms = useCallback((dragX = blocDragXRef.current, dragging = blocDragging) => {
    [
      [blocSurfaceRef.current, true],
      [blocBottomNavRef.current, false]
    ].forEach(([el, withShadow]) => {
      if (!el) return;
      el.style.transform = dragX ? `translateX(${dragX}px)` : "none";
      el.style.transition = dragging ? "none" : "transform .08s ease-out";
      el.style.boxShadow = withShadow && dragX ? "-18px 0 34px rgba(0,0,0,.28)" : "none";
      el.style.willChange = dragging || dragX ? "transform" : "auto";
    });
  },[blocDragging]);
  const scheduleBlocTransforms = useCallback((dragX = blocDragXRef.current, dragging = blocDragging) => {
    blocDragXRef.current = dragX;
    if (blocFrameRef.current) return;
    blocFrameRef.current = requestAnimationFrame(() => {
      blocFrameRef.current = null;
      applyBlocTransforms(blocDragXRef.current, dragging);
    });
  },[applyBlocTransforms, blocDragging]);
  const resetBlocSwipe = useCallback(() => {
    blocSwipeRef.current = {sx:0,sy:0,active:false,mode:null};
    blocDragXRef.current = 0;
    cancelSwipeFrame(blocFrameRef);
    applyBlocTransforms(0, false);
    setBlocDragging(false);
  },[applyBlocTransforms]);
  const handleSwitchGroup=()=>{
    setSuppressSwitcherIntro(false);
    resetBlocSwipe();
    persistGroupSelection(null);
  };
  const startBlocSwitchSwipe = useCallback((e) => {
    if (page !== "today" || showTodayLog || showSettings || showProfileModal || showStream || showJoinModal || authStep || prorationGroup) return;
    if (e.target?.closest?.(".in-bloc-profile-layer")) return;
    const t = e.touches?.[0];
    if (!t || t.clientX > 72) return;
    blocSwipeRef.current = {sx:t.clientX, sy:t.clientY, st:performance.now(), active:true, mode:null};
  },[authStep, page, prorationGroup, showJoinModal, showProfileModal, showSettings, showStream, showTodayLog]);
  const moveBlocSwitchSwipe = useCallback((e) => {
    const s = blocSwipeRef.current;
    const t = e.touches?.[0];
    if (!s.active || !t) return;
    const dx = t.clientX - s.sx;
    const dy = t.clientY - s.sy;
    if (!s.mode && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) {
      s.mode = dx > 0 && Math.abs(dx) > Math.abs(dy) ? "back" : "scroll";
      setBlocDragging(s.mode === "back");
    }
    if (s.mode === "back") scheduleBlocTransforms(Math.max(0, Math.min(dx, window.innerWidth || 420)), true);
  },[applyBlocTransforms, scheduleBlocTransforms]);
  const endBlocSwitchSwipe = useCallback((e) => {
    const s = blocSwipeRef.current;
    const t = e.changedTouches?.[0];
    blocSwipeRef.current = {sx:0,sy:0,active:false,mode:null};
    if (!s.active || !t) return;
    const dx = t.clientX - s.sx;
    const dy = t.clientY - s.sy;
    const screenWidth = window.innerWidth || 420;
    const elapsed = Math.max(1, performance.now() - (s.st || performance.now()));
    const fastEdgeFlick = dx > 24 && elapsed < 260 && dx / elapsed > 0.22 && dx > Math.abs(dy);
    const dominantDrag = dx > screenWidth / 2 && Math.abs(dy) < 100 && dx > Math.abs(dy);
    const shouldClose = s.mode === "back" && (fastEdgeFlick || dominantDrag);
    if (shouldClose) {
      releaseSwipeForward({
        dragRef: blocDragXRef,
        frameRef: blocFrameRef,
        finalX: screenWidth,
        transitionMs: 80,
        setDragging: setBlocDragging,
        applyTransform: applyBlocTransforms,
        commit: () => {
          setSuppressSwitcherIntro(true);
          persistGroupSelection(null);
        }
      });
    } else {
      releaseSwipeBack({
        dragRef: blocDragXRef,
        frameRef: blocFrameRef,
        transitionMs: 80,
        setDragging: setBlocDragging,
        applyTransform: applyBlocTransforms
      });
    }
  },[applyBlocTransforms, persistGroupSelection]);
  const handleStreamSeasonClosedTap = useCallback((groupId) => {
    if (!groupId) return;
    persistGroupSelection(groupId);
    setShowStream(false);
    setShowTodayLog(false);
    setMonthInitialIdx(0);
    setNavResetToken(value=>value+1);
    setPage("month");
  },[persistGroupSelection]);
  const refreshStreamUnreadCount = useCallback(async(groupId = selectedGroupId) => {
    if (!groupId || !effectiveAuthSession?.userId) {
      setStreamUnreadCount(0);
      return;
    }
    const result = await getBlocStreamUnreadCountData(groupId);
    if (result?.ok) setStreamUnreadCount(result.unreadCount);
  },[effectiveAuthSession?.userId, selectedGroupId]);
  const handleOpenStream = useCallback(() => {
    setStreamFocusBlocId(null);
    setStreamReturnScrollTop(null);
    setShowStream(true);
  },[]);
  const handleOpenLogComments = useCallback(({ groupId, log, source, returnScrollTop }) => {
    if (!groupId || !log?.id) return;
    if (source === "stream" && !showStream) {
      setStreamFocusBlocId(groupId);
      setStreamReturnScrollTop(Number.isFinite(Number(returnScrollTop)) ? Math.max(0, Number(returnScrollTop)) : null);
    }
    setLogCommentScreen({ groupId, log, source: source || "activity" });
  },[showStream]);
  const handleCloseLogComments = useCallback(() => {
    const source = logCommentScreen?.source;
    setLogCommentScreen(null);
    if (source === "stream") setShowStream(true);
  },[logCommentScreen?.source]);
  const handleLogCommentCountChange = useCallback((logId, count) => {
    const key = String(logId || "");
    if (!key) return;
    setLogCommentCountOverrides(current => ({ ...current, [key]: Math.max(0, Number(count || 0)) }));
  },[]);
  useEffect(() => {
    if (showStream) return;
    refreshStreamUnreadCount();
  }, [appState?.meta?.revision, refreshStreamUnreadCount, selectedGroupId, showStream]);
  const handleNavSelect = useCallback((nextPage)=>{
    if (showTodayLog && nextPage === page) {
      setShowTodayLog(false);
      return;
    }
    setShowTodayLog(false);
    setShowSettings(false);
    pageDragXRef.current = 0;
    cancelSwipeFrame(pageFrameRef);
    clearInlineSwipeStyles(Object.values(pageLayerRefs.current || {}));
    setPageDragging(false);
    setPageSwipeTarget(null);
    pageSwipeRef.current = {sx:0,sy:0,active:false,mode:null,target:null};
    setMonthInitialIdx(null);
    setNavResetToken(value=>value+1);
    setPage(nextPage);
  },[page, showTodayLog]);
  const adjacentInBlocPage = useCallback((direction) => {
    const index = IN_BLOC_PAGES.indexOf(page);
    if (index < 0) return null;
    const nextIndex = index + direction;
    return IN_BLOC_PAGES[nextIndex] || null;
  },[page]);
  const applyPageTransforms = useCallback((dragX = pageDragXRef.current, dragging = pageDragging) => {
    const activeIndex = IN_BLOC_PAGES.indexOf(page);
    const width = window.innerWidth || 420;
    IN_BLOC_PAGES.forEach((pageName,index) => {
      const el = pageLayerRefs.current?.[pageName];
      if (!el) return;
      const offsetX = (index - activeIndex) * width + dragX;
      el.style.transform = offsetX ? `translateX(${offsetX}px)` : "none";
      el.style.transition = dragging ? "none" : "transform .08s ease-out";
      el.style.boxShadow = pageName === page && dragX ? "-18px 0 34px rgba(0,0,0,.24)" : "none";
      el.style.willChange = dragging || dragX ? "transform" : "auto";
    });
  },[page,pageDragging]);
  const schedulePageTransforms = useCallback((dragX = pageDragXRef.current, dragging = pageDragging) => {
    pageDragXRef.current = dragX;
    if (pageFrameRef.current) return;
    pageFrameRef.current = requestAnimationFrame(() => {
      pageFrameRef.current = null;
      applyPageTransforms(pageDragXRef.current, dragging);
    });
  },[applyPageTransforms,pageDragging]);
  const resetPageSwipe = useCallback(() => {
    pageSwipeRef.current = {sx:0,sy:0,active:false,mode:null,target:null};
    pageDragXRef.current = 0;
    cancelSwipeFrame(pageFrameRef);
    applyPageTransforms(0, false);
    setPageDragging(false);
    setPageSwipeTarget(null);
  },[applyPageTransforms]);
  const startPageSwipe = useCallback((e) => {
    if (showSettings || showTodayLog || showProfileModal || showStream || showJoinModal || authStep || prorationGroup || logCommentScreen) return;
    if (e.target?.closest?.(".in-bloc-profile-layer,input,textarea,select,[contenteditable='true']")) return;
    const t = e.touches?.[0];
    if (!t) return;
    pageSwipeRef.current = {sx:t.clientX, sy:t.clientY, st:performance.now(), active:true, mode:null, target:null};
  },[authStep, logCommentScreen, prorationGroup, showJoinModal, showProfileModal, showSettings, showStream, showTodayLog]);
  const movePageSwipe = useCallback((e) => {
    const s = pageSwipeRef.current;
    const t = e.touches?.[0];
    if (!s.active || !t) return;
    const dx = t.clientX - s.sx;
    const dy = t.clientY - s.sy;
    if (!s.mode && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) {
      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);
      const horizontal = absDx > 5 && absDx > absDy * 0.72;
      const vertical = absDy > 9 && absDy > absDx * 1.08;
      if (!horizontal && !vertical) return;
      if (vertical) {
        s.mode = "scroll";
        return;
      }
      const target = adjacentInBlocPage(dx < 0 ? 1 : -1);
      if (!target) {
        s.mode = "scroll";
        return;
      }
      s.mode = "page";
      s.target = target;
      setPageSwipeTarget(target);
      setPageDragging(true);
    }
    if (s.mode === "page") {
      e.preventDefault();
      const screenWidth = window.innerWidth || 420;
      schedulePageTransforms(Math.max(-screenWidth, Math.min(screenWidth, dx)), true);
    }
  },[adjacentInBlocPage, applyPageTransforms, schedulePageTransforms]);
  const endPageSwipe = useCallback((e) => {
    const s = pageSwipeRef.current;
    const t = e.changedTouches?.[0];
    pageSwipeRef.current = {sx:0,sy:0,active:false,mode:null,target:null};
    if (!s.active || !t) return;
    const dx = t.clientX - s.sx;
    const dy = t.clientY - s.sy;
    const screenWidth = window.innerWidth || 420;
    const elapsed = Math.max(1, performance.now() - (s.st || performance.now()));
    const fastFlick = Math.abs(dx) > 14 && elapsed < 300 && Math.abs(dx) / elapsed > 0.13 && Math.abs(dx) > Math.abs(dy) * 0.82;
    const dominantDrag = Math.abs(dx) > screenWidth * 0.16 && Math.abs(dy) < 140 && Math.abs(dx) > Math.abs(dy) * 0.75;
    const shouldMove = s.mode === "page" && s.target && (fastFlick || dominantDrag);
    if (shouldMove) {
      releaseSwipeForward({
        dragRef: pageDragXRef,
        frameRef: pageFrameRef,
        finalX: dx < 0 ? -screenWidth : screenWidth,
        transitionMs: 80,
        setDragging: setPageDragging,
        applyTransform: applyPageTransforms,
        commit: () => {
          setPage(s.target);
          setPageSwipeTarget(null);
        }
      });
    } else {
      releaseSwipeBack({
        dragRef: pageDragXRef,
        frameRef: pageFrameRef,
        transitionMs: 80,
        setDragging: setPageDragging,
        applyTransform: applyPageTransforms,
        cleanup: () => setPageSwipeTarget(null)
      });
    }
  },[applyPageTransforms]);
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
  const visibleGroups = groups.filter(group => {
    const displayName = String(effectiveProfile?.displayName || "").trim();
    if (hiddenLeftGroupIds[group.id]) return false;
    if (displayName && Array.isArray(group.leftMemberNames) && group.leftMemberNames.includes(displayName)) return false;
    return Boolean(getMembershipForUser(group, effectiveAuthSession, effectiveProfile));
  });
  const firstVisibleGroupId = visibleGroups[0]?.id || null;
  useEffect(() => {
    if (!authSession?.userId) return;
    let showWelcomePreview = false;
    let showDownloadPreview = false;
    try {
      const params = new URLSearchParams(window.location.search);
      showWelcomePreview = params.get("inviteWelcomePreview") === "1";
      showDownloadPreview = params.get("inviteDownloadPreview") === "1";
    } catch {}
    if (!showWelcomePreview && !showDownloadPreview) return;
    const previewGroupId = (selectedGroupId && appState.groups?.[selectedGroupId])
      ? selectedGroupId
      : firstVisibleGroupId;
    if (!previewGroupId) return;
    if (showWelcomePreview) {
      setInviteDownloadPrompt(null);
      setInviteWelcomeGroupId(previewGroupId);
    }
    if (showDownloadPreview) {
      setInviteDownloadPrompt({ groupId: previewGroupId });
    }
  },[appState.groups, authSession?.userId, firstVisibleGroupId, selectedGroupId]);
  const localPreviewMembers = uniqueNames(groups.flatMap(group => getCurrentGroupMemberNames(group)));
  const activityAlertCount = currentGroup && currentUser ? getActivityAlertCount(currentGroup, currentUser) : 0;
  const renderGroupSwitcherSurface = ({ inert=false, suppressIntro=false } = {}) => React.createElement('div',{
    style:{
      position:"fixed",
      inset:0,
      zIndex:inert?0:1,
      overflowY:"auto",
      overflowX:"hidden",
      WebkitOverflowScrolling:"touch",
      pointerEvents:inert?"none":"auto",
      background:"var(--bg-gradient)",
      backgroundImage:"var(--bg-radial-hint), var(--bg-gradient)",
      overscrollBehavior:"contain"
    }
  },
    React.createElement(GroupHome,{
      groups: visibleGroups,
      currentIdentity: profile?.displayName || authSession?.email?.split("@")[0] || effectiveProfile?.displayName || effectiveAuthSession?.email?.split("@")[0] || "",
      currentEmail: authSession?.email || effectiveAuthSession?.email,
      currentUserId: authSession?.userId || effectiveAuthSession?.userId || "",
      onOpenProfile:inert?()=>{}:()=>setShowProfile(true),
      creating: inert ? false : creatingGroup,
      autoOpenCreate: inert ? false : queuedCreate,
      initialCreateGroupName: inert ? "" : queuedCreateGroupName,
      onAutoOpenHandled: inert ? ()=>{} : ()=>{setQueuedCreate(false);setQueuedCreateGroupName("");},
      onCreateCancel: inert ? ()=>{} : handleCreateCancelFromGroupHome,
      onOpenGroup: inert ? ()=>{} : groupId=>{ window.scrollTo({top:0,left:0,behavior:"auto"}); setSuppressSwitcherIntro(false); persistGroupSelection(groupId); setPage("today"); },
      onCreateGroup: inert ? ()=>{} : handleCreateGroup,
      onJoinGroup: inert ? ()=>{} : ()=>setShowJoinModal(true),
      suppressIntro
    })
  );
  const openAuth = intent => {
    setShowJoinModal(false);
    setAuthIntent(intent);
    setAuthStep("email");
    setAuthEmail(authSession?.email || "");
    setAuthCode("");
    setAuthDisplayName("");
    setAuthError("");
    setDevOtpCode("");
    setAuthExistingAccountEmail("");
    setAuthExistingAccountConfirmed(false);
  };
  const completeColdOnboarding = useCallback(() => {
    setReplayColdOnboarding(false);
    setColdOnboardingInitialIndex(0);
    setColdOnboardingPreviewDismissed(true);
    setColdOnboardingSeen(true);
    try { localStorage.setItem(COLD_ONBOARDING_SEEN_KEY, "1"); } catch {}
  },[]);
  const handleColdOnboardingCreate = useCallback(({ blocName } = {}) => {
    const initialGroupName = String(blocName || "").trim();
    setOnboardingCreateInitialName(initialGroupName);
    setOnboardingCreateModalOpen(true);
    setReturnToColdOnboardingOnCreateCancel(true);
    setReturnToColdOnboardingOnJoinCancel(false);
  },[]);
  const handleOnboardingCreateCancel = useCallback(() => {
    setOnboardingCreateModalOpen(false);
    setPendingOnboardingCreatePayload(null);
    setReturnToColdOnboardingOnCreateCancel(false);
    setColdOnboardingInitialIndex(3);
    setColdOnboardingPreviewDismissed(false);
    setReplayColdOnboarding(true);
  },[]);
  const handleOnboardingCreateSubmit = useCallback((payload) => {
    const createDraft = {
      ...payload,
      creatorName: ""
    };
    setPendingOnboardingCreatePayload(createDraft);
    setOnboardingCreateModalOpen(false);
    setReturnToColdOnboardingOnCreateCancel(true);
    setReturnToColdOnboardingOnJoinCancel(false);
    if (authSession?.userId) {
      if (String(profile?.displayName || "").trim()) {
        setPostAuthActionPending(true);
        handleCreateGroup(
          { ...createDraft, creatorName: profile.displayName },
          { actorUserId: authSession.userId, showInviteScreen:false }
        ).then(result => {
          if (result?.ok) {
            setPendingOnboardingCreatePayload(null);
            completeColdOnboarding();
          }
        }).finally(() => setPostAuthActionPending(false));
        return;
      }
      setAuthDisplayName("");
      setAuthError("");
      setAuthIntent({ type:"create", fromOnboarding:true });
      setAuthStep("name");
      return;
    }
    openAuth({ type:"create", fromOnboarding:true });
  },[authSession, completeColdOnboarding, handleCreateGroup, openAuth, profile]);
  const handleColdOnboardingJoin = useCallback(() => {
    setReturnToColdOnboardingOnJoinCancel(true);
    setReturnToColdOnboardingOnCreateCancel(false);
    if (authSession?.userId) {
      completeColdOnboarding();
      setShowJoinModal(true);
      return;
    }
    // Signed out: ask for the invite code first, then email → OTP → name → join.
    setInviteError("");
    setOnboardingJoinCodeStep(true);
  },[authSession?.userId, completeColdOnboarding]);
  const handleOnboardingJoinCodeCancel = useCallback(() => {
    setOnboardingJoinCodeStep(false);
    setCheckingOnboardingInvite(false);
    setInviteError("");
    setJoinCode("");
    setReturnToColdOnboardingOnJoinCancel(false);
    // Cancelling the join always returns to onboarding screen 4, never to an
    // empty Bloc switcher.
    setColdOnboardingInitialIndex(3);
    setColdOnboardingPreviewDismissed(false);
    setReplayColdOnboarding(true);
  },[]);
  const handleOnboardingJoinCodeContinue = useCallback(async () => {
    const code = String(joinCode || "").trim().toUpperCase();
    if (!code) return;
    setCheckingOnboardingInvite(true);
    setInviteError("");
    const result = await fetchInviteContextData(code);
    setCheckingOnboardingInvite(false);
    if (!result?.ok) {
      setInviteError(result?.error || "Invite not found");
      return;
    }
    setInviteContext(result.data);
    if (Number(result.data?.memberCount || 0) >= 20) {
      setInviteError("This Bloc is full. Maximum 20 members allowed.");
      return;
    }
    setJoinCode(code);
    setOnboardingJoinCodeStep(false);
    completeColdOnboarding();
    openAuth({ type:"join", fromOnboarding:true, inviteCode:code });
  },[joinCode, completeColdOnboarding, openAuth]);
  const resetAuthFlow = () => {
    setAuthStep(null);
    setAuthIntent(null);
    setAuthCode("");
    setAuthError("");
    setDevOtpCode("");
    setPendingAuthSession(null);
    setAuthExistingAccountEmail("");
    setAuthExistingAccountConfirmed(false);
  };
  const closeAuth = () => {
    const shouldResumeColdOnboarding = (authIntent?.type === "create" && returnToColdOnboardingOnCreateCancel) || (authIntent?.type === "join" && returnToColdOnboardingOnJoinCancel);
    const cancelledOnboardingJoin = authIntent?.type === "join" && returnToColdOnboardingOnJoinCancel;
    const cancelledOnboardingCreate = authIntent?.type === "create" && returnToColdOnboardingOnCreateCancel;
    resetAuthFlow();
    setPostAuthActionPending(false);
    if (cancelledOnboardingCreate) {
      setPendingOnboardingCreatePayload(null);
      setOnboardingCreateModalOpen(false);
      setReturnToColdOnboardingOnCreateCancel(false);
    }
    if (cancelledOnboardingJoin) {
      setOnboardingJoinCodeStep(false);
      setReturnToColdOnboardingOnJoinCancel(false);
      resetInviteFlow({ clearUrl:false });
    }
    if (shouldResumeColdOnboarding) {
      setColdOnboardingInitialIndex(3);
      setColdOnboardingPreviewDismissed(false);
      setReplayColdOnboarding(true);
    }
  };
  // Single join path shared by the onboarding flow, the invite-link flow and the
  // signed-in Join modal. Membership is granted by the invite code alone — never
  // by a display name.
  const joinWithInviteCode = async (session, rawCode) => {
    const inviteCode = String(rawCode || "").trim().toUpperCase();
    if (!session?.userId || !inviteCode) return { ok:false, error:"Enter an invite code" };
    setJoiningGroup(true);
    setInviteError("");
    const result = await joinGroupData({ userId: session.userId, inviteCode });
    setJoiningGroup(false);
    if (!result?.ok) {
      setInviteError(result?.error || "Unable to join Bloc");
      return result || { ok:false, error:"Unable to join Bloc" };
    }
    applyData(result.state);
    setHiddenLeftGroupIds(current => {
      if (!current[result.joinedGroupId]) return current;
      const next = { ...current };
      delete next[result.joinedGroupId];
      return next;
    });
    resetInviteFlow({ clearUrl:true });
    completeInviteJoin({ groupId: result.joinedGroupId, userId: session.userId, inviteCode });
    setReturnToColdOnboardingOnCreateCancel(false);
    setReturnToColdOnboardingOnJoinCancel(false);
    setOnboardingJoinCodeStep(false);
    setShowJoinModal(false);
    return result;
  };
  const continueAfterAuth = async (nextSession = authSession, nextProfile = effectiveProfile, completedIntent = authIntent) => {
    if (completedIntent?.type === "create") {
      if (completedIntent?.fromOnboarding && pendingOnboardingCreatePayload) {
        const creatorName = String(nextProfile?.displayName || authDisplayName || "").trim();
        if (!creatorName) {
          setAuthIntent(completedIntent);
          setPendingAuthSession(nextSession);
          setAuthDisplayName("");
          setAuthError("");
          setAuthStep("name");
          return;
        }
        setPostAuthActionPending(true);
        const result = await handleCreateGroup(
          { ...pendingOnboardingCreatePayload, creatorName },
          { actorUserId: nextSession?.userId, showInviteScreen:false }
        );
        setPostAuthActionPending(false);
        if (result?.ok) {
          setPendingOnboardingCreatePayload(null);
          setReturnToColdOnboardingOnCreateCancel(false);
          completeColdOnboarding();
        } else {
          setAuthError(result?.error || "Unable to create Bloc");
          setAuthIntent(completedIntent);
          setPendingAuthSession(nextSession);
          setAuthStep("name");
        }
        return;
      }
      setQueuedCreateGroupName(String(completedIntent?.initialGroupName || "").trim());
      setQueuedCreate(true);
      return;
    }
    if (completedIntent?.type === "join") {
      const pendingCode = String(completedIntent?.inviteCode || joinCode || inviteContext?.inviteCode || "").trim();
      // Onboarding join already collected and validated the code up front, so
      // finish the join instead of re-asking for it. The invite-link flow keeps
      // its existing confirm step.
      if (completedIntent?.fromOnboarding && pendingCode && nextProfile?.displayName) {
        setPostAuthActionPending(true);
        const result = await joinWithInviteCode(nextSession, pendingCode);
        setPostAuthActionPending(false);
        if (result?.ok) return;
        setShowJoinModal(true);
        setJoinCode(pendingCode.toUpperCase());
        return;
      }
      setShowJoinModal(true);
      if (inviteContext?.inviteCode) setJoinCode(inviteContext.inviteCode);
    }
  };
  const handleSendOtp = async () => {
    setSendingOtp(true);
    setAuthError("");
    const normalizedEmail = authEmail.trim();
    const onboardingAccountAction = Boolean(authIntent?.fromOnboarding) && (authIntent?.type === "create" || authIntent?.type === "join");
    if (authIntent?.type === "signup") {
      const existingAccount = await checkAuthEmailExistsData(normalizedEmail);
      if (!existingAccount?.ok) {
        setSendingOtp(false);
        setAuthError(existingAccount?.error || "Unable to check email");
        return;
      }
      if (existingAccount.exists) {
        setSendingOtp(false);
        setAuthError("There is already a Fero account with this email. Create a new account with a different email.");
        return;
      }
    }
    if (onboardingAccountAction && !authExistingAccountConfirmed) {
      const existingAccount = await checkAuthEmailExistsData(normalizedEmail);
      if (!existingAccount?.ok) {
        setSendingOtp(false);
        setAuthError(existingAccount?.error || "Unable to check email");
        return;
      }
      if (existingAccount.exists) {
        setSendingOtp(false);
        setAuthExistingAccountEmail(normalizedEmail);
        setAuthStep("existing");
        return;
      }
    }
    const shouldCreateUser = authIntent?.type !== "signin" && !(onboardingAccountAction && authExistingAccountConfirmed);
    const result = await sendOtpData(normalizedEmail, { shouldCreateUser });
    setSendingOtp(false);
    if (!result?.ok) {
      setAuthError(authIntent?.type === "signin" ? "No Fero account found for that email. Create a new account instead." : (result?.error || "Unable to send code"));
      return;
    }
    setDevOtpCode(result.devCode || "");
    setAuthStep("otp");
  };
  const handleConfirmExistingAccount = async () => {
    const normalizedEmail = String(authExistingAccountEmail || authEmail || "").trim();
    if (!normalizedEmail) return;
    setAuthExistingAccountConfirmed(true);
    setAuthEmail(normalizedEmail);
    setSendingOtp(true);
    setAuthError("");
    const result = await sendOtpData(normalizedEmail, { shouldCreateUser:false });
    setSendingOtp(false);
    if (!result?.ok) {
      setAuthError(result?.error || "Unable to send code");
      return;
    }
    setDevOtpCode(result.devCode || "");
    setAuthStep("otp");
  };
  const handleUseDifferentEmail = () => {
    setAuthExistingAccountEmail("");
    setAuthExistingAccountConfirmed(false);
    setAuthEmail("");
    setAuthCode("");
    setAuthError("");
    setAuthStep("email");
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
    const nextSession = {
      userId: result.session.userId,
      email: result.session.email,
      accessToken: result.session.accessToken || authSession?.accessToken || null
    };
    const syncedState = result.state || appState;
    let nextProfile = getProfileForSession(syncedState, nextSession);
    const hasExistingFeroAccount = authIntent?.type === "signup" && (
      Boolean(nextProfile?.displayName)
      || Object.values(syncedState?.groups || {}).some(group => Boolean(getMembershipForUser(group, nextSession, nextProfile)))
    );
    if (hasExistingFeroAccount) {
      try { await signOutAuthSession(); } catch (error) { console.error("Sign out after duplicate signup failed:", error); }
      persistSession(null);
      setPendingAuthSession(null);
      setAuthCode("");
      setAuthStep("email");
      setAuthError("This email already has a Fero account. Sign in instead.");
      return;
    }
    const needsProfileSetup = typeof result.session.needsProfileSetup === "boolean"
      ? result.session.needsProfileSetup
      : !nextProfile?.displayName;

    // Move to the display-name screen BEFORE the session is persisted, so the
    // app never renders an empty Bloc switcher in the gap between OTP success
    // and profile setup. auth-sync already resolved needsProfileSetup against
    // the migrated server state, so no pre-fetch is needed here.
    if (needsProfileSetup) {
      setShowJoinModal(false);
      setAuthDisplayName("");
      setAuthStep("name");
      setAuthError("");
    }
    if (result.state) applyData(result.state);
    persistSession(nextSession);
    setPendingAuthSession(nextSession);
    if (needsProfileSetup) return;
    resetAuthFlow();
    continueAfterAuth(nextSession, nextProfile, authIntent);
  };
  const handleSaveProfile = async () => {
    setSavingProfile(true);
    setAuthError("");
    const completedIntentObj = authIntent;
    const completedIntent = authIntent?.type || "";
    const onboardingPostAuthAction = Boolean(completedIntentObj?.fromOnboarding) && (completedIntent === "create" || completedIntent === "join");
    if (onboardingPostAuthAction) setPostAuthActionPending(true);
    const activeSession = pendingAuthSession || authSession || await getCurrentAuthSession();
    const result = await upsertProfileData(
      { userId: activeSession?.userId, email: activeSession?.email, displayName: authDisplayName.trim() },
      activeSession
    );
    setSavingProfile(false);
    if (!result?.ok) {
      setPostAuthActionPending(false);
      setAuthError(result?.error || "Unable to save profile");
      return;
    }
    if (activeSession?.userId) persistSession(activeSession);
    const savedDisplayName = authDisplayName.trim();
    const pendingInviteCode = String(completedIntentObj?.inviteCode || joinCode || inviteContext?.inviteCode || "").trim().toUpperCase();
    // Auto-join only where the code was already collected as part of that flow:
    // the onboarding join, or a signed-in join that detoured through name setup.
    const shouldAutoJoin = Boolean(activeSession?.userId)
      && Boolean(pendingInviteCode)
      && (pendingJoinAfterProfile || Boolean(completedIntentObj?.fromOnboarding));
    const applied = result.data ? applyData(result.data) : false;
    // The profile write is the gate for joining (the server refuses a join
    // without a saved display name), so only skip the extra refetch — never the
    // save itself. When we already have the state back, the extra round trip is
    // pure latency between the name screen and the target Bloc.
    if (!applied && !shouldAutoJoin) {
      await refreshNow();
    }
    resetAuthFlow();
    if (completedIntent === "signup" && !shouldAutoJoin) {
      setColdOnboardingPreviewDismissed(false);
      setColdOnboardingInitialIndex(0);
      setReplayColdOnboarding(true);
      return;
    }
    if (shouldAutoJoin) {
      setPendingJoinAfterProfile(false);
      const joinResult = await joinWithInviteCode(activeSession, pendingInviteCode);
      setPostAuthActionPending(false);
      if (!joinResult?.ok) {
        if (joinResult?.status === 409) {
          setAuthIntent(completedIntentObj);
          setPendingAuthSession(activeSession);
          setAuthDisplayName(savedDisplayName);
          setAuthStep("name");
          setAuthError(joinResult.error || "That display name is already used in this Bloc. Pick another one.");
          return;
        }
        // Keep the user on the join step with the code they entered rather than
        // dropping them into an empty switcher.
        setShowJoinModal(true);
        setJoinCode(pendingInviteCode);
        return;
      }
      return;
    }
    continueAfterAuth(
      activeSession,
      getProfileForSession(result.data || appState, activeSession) || { id: activeSession?.userId, email: activeSession?.email, displayName: savedDisplayName },
      { ...(completedIntentObj || {}), type: completedIntent, initialGroupName: completedIntentObj?.initialGroupName || "" }
    );
  };
  const handleJoinGroup = async () => {
    if (!authSession?.userId) {
      openAuth({ type:"join" });
      return;
    }
    if (!String(profile?.displayName || "").trim()) {
      setPendingJoinAfterProfile(true);
      setShowJoinModal(false);
      setAuthDisplayName("");
      setAuthError("");
      setAuthStep("name");
      return;
    }
    await joinWithInviteCode(authSession, joinCode);
  };

  const handleInviteWelcomeContinue = useCallback(() => {
    const groupId = inviteWelcomeGroupId;
    if (!groupId) return;
    markInviteWelcomeSeen(authSession?.userId, groupId);
    persistGroupSelection(groupId);
    setPage("today");
    setInviteWelcomeGroupId(null);
    scheduleInviteDownloadPrompt(groupId);
  },[authSession?.userId, inviteWelcomeGroupId, persistGroupSelection, scheduleInviteDownloadPrompt]);

  const dismissInviteDownloadPrompt = useCallback(() => {
    if (inviteDownloadPromptTimerRef.current) clearTimeout(inviteDownloadPromptTimerRef.current);
    setInviteDownloadPrompt(null);
  },[]);

  const renderAuthFlowModal = () => React.createElement(AuthFlowModal,{
    step:authStep,
    mode:authIntent?.type === "signup" ? "signup" : "signin",
    intent:authIntent?.type || "",
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
    onConfirmExistingAccount:handleConfirmExistingAccount,
    onUseDifferentEmail:handleUseDifferentEmail,
    sending:sendingOtp,
    verifying:verifyingOtp,
    savingProfile,
    error:authError,
    devCode:devOtpCode
  });

  const renderInviteDownloadPrompt = () => {
    if (!inviteDownloadPrompt) return null;
    const promptGroup = appState.groups?.[inviteDownloadPrompt.groupId] || currentGroup;
    return React.createElement('div',{
      style:{
        position:"fixed",
        left:16,
        right:16,
        bottom:"calc(106px + env(safe-area-inset-bottom))",
        zIndex:410,
        pointerEvents:"auto",
        borderRadius:18,
        background:"rgba(8,15,15,.96)",
        border:"0.5px solid rgba(78,205,196,.24)",
        boxShadow:"0 22px 64px rgba(0,0,0,.42), 0 0 30px rgba(78,205,196,.08)",
        padding:14,
        display:"grid",
        gap:12
      }
    },
      React.createElement('div',{style:{display:"flex",alignItems:"flex-start",gap:12}},
        React.createElement('div',{style:{width:34,height:34,borderRadius:12,background:"rgba(78,205,196,.12)",border:"0.5px solid rgba(78,205,196,.28)",display:"flex",alignItems:"center",justifyContent:"center",color:"#4ECDC4",fontFamily:"'Outfit', sans-serif",fontWeight:900,fontSize:18,flexShrink:0}},"F"),
        React.createElement('div',{style:{flex:1,minWidth:0}},
          React.createElement('div',{style:{fontFamily:"'Outfit', sans-serif",fontSize:15,fontWeight:900,color:"var(--text)",lineHeight:1.2}},"Log workouts from your phone. Get the app."),
          React.createElement('div',{style:{fontFamily:"'Outfit', sans-serif",fontSize:12,fontWeight:700,color:"var(--text-soft)",lineHeight:1.35,marginTop:3}},
            `You can keep using ${promptGroup?.name || "your Bloc"} here.`
          )
        ),
        React.createElement('button',{type:"button",onClick:dismissInviteDownloadPrompt,style:{width:28,height:28,borderRadius:999,background:"transparent",border:"0.5px solid rgba(78,205,196,.18)",color:"#4ECDC4",fontSize:18,lineHeight:1,flexShrink:0}},"×")
      ),
      React.createElement('div',{style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}},
        React.createElement('button',{type:"button",className:"setup-press",style:{minHeight:40,borderRadius:12,background:"#4ECDC4",color:"#050909",fontFamily:"'Outfit', sans-serif",fontSize:13,fontWeight:900}},"App Store"),
        React.createElement('button',{type:"button",className:"setup-press",style:{minHeight:40,borderRadius:12,background:"rgba(78,205,196,.1)",border:"0.5px solid rgba(78,205,196,.22)",color:"#4ECDC4",fontFamily:"'Outfit', sans-serif",fontSize:13,fontWeight:900}},"Play Store")
      )
    );
  };

  const resumeColdOnboardingAtActionScreen = useCallback(() => {
    setColdOnboardingInitialIndex(3);
    setReplayColdOnboarding(true);
  },[]);

  const handleJoinModalClose = useCallback(() => {
    setShowJoinModal(false);
    if (returnToColdOnboardingOnJoinCancel && visibleGroups.length === 0) {
      setReturnToColdOnboardingOnJoinCancel(false);
      resumeColdOnboardingAtActionScreen();
    }
  },[resumeColdOnboardingAtActionScreen, returnToColdOnboardingOnJoinCancel, visibleGroups.length]);

  const handleCreateCancelFromGroupHome = useCallback(() => {
    if (returnToColdOnboardingOnCreateCancel && visibleGroups.length === 0) {
      setReturnToColdOnboardingOnCreateCancel(false);
      resumeColdOnboardingAtActionScreen();
    }
  },[resumeColdOnboardingAtActionScreen, returnToColdOnboardingOnCreateCancel, visibleGroups.length]);

  const handleSelectLocalPreviewIdentity = useCallback((displayName) => {
    const session = buildLocalPreviewSession(displayName);
    persistSession(session);
    const matchingGroup = groups.find(group => getCurrentGroupMemberNames(group).includes(displayName));
    if (matchingGroup?.id) {
      persistGroupSelection(matchingGroup.id);
      setPage("today");
    }
  },[groups, persistGroupSelection, persistSession]);

  const hasInviteEntry = Boolean(String(joinCode || "").trim()) || Boolean(inviteContext?.inviteCode);
  const forceColdOnboardingPreview = (() => {
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get("onboarding") === "1" && !hasInviteEntry && !coldOnboardingPreviewDismissed;
    } catch { return false; }
  })();
  const shouldShowColdOnboarding = !authStep && (
    forceColdOnboardingPreview
    || replayColdOnboarding
    || (!authSession?.userId && !localPreviewAuthEnabled && !hasInviteEntry && !coldOnboardingSeen)
  );

  if(loading || !authReady || (authHydrating && !authStep)) return React.createElement(Spinner,{label:"Opening Fero..."});
  if(postAuthActionPending) return React.createElement(SetupProgressScreen,null);
  if(authStep === "name") {
    const nameSession = pendingAuthSession || authSession || {};
    return React.createElement(DisplayNameSetupScreen,{
      email:authEmail || nameSession.email || "",
      displayName:authDisplayName,
      setDisplayName:setAuthDisplayName,
      onSave:handleSaveProfile,
      saving:savingProfile,
      error:authError,
    });
  }
  if(authStep) return React.createElement(React.Fragment,null,renderAuthFlowModal());
  // Onboarding join, step 1: invite code, collected before any auth. Onboarding
  // screen 4 stays behind the sheet so Cancel lands back exactly where it began.
  if(onboardingJoinCodeStep && !authSession?.userId && !authStep) {
    return React.createElement(React.Fragment,null,
      React.createElement(ColdOnboarding,{
        key:"cold-onboarding-join-code",
        initialIndex:3,
        onCreate:handleColdOnboardingCreate,
        onJoin:handleColdOnboardingJoin
      }),
      React.createElement(JoinGroupModal,{
        inviteContext,
        joinCode,
        setJoinCode,
        onClose:handleOnboardingJoinCodeCancel,
        onJoin:handleOnboardingJoinCodeContinue,
        joining:checkingOnboardingInvite,
        error:inviteError,
        signedIn:false,
        confirmLabel:"Continue",
        pendingLabel:"Checking...",
        helperOverride:"Enter the invite code for the Bloc you're joining. We'll set up your account next."
      })
    );
  }
  if(shouldShowColdOnboarding) {
    return React.createElement(React.Fragment,null,
      React.createElement(ColdOnboarding,{
        key:`cold-onboarding-${coldOnboardingInitialIndex}`,
        initialIndex:coldOnboardingInitialIndex,
        onCreate:handleColdOnboardingCreate,
        onJoin:handleColdOnboardingJoin
      }),
      onboardingCreateModalOpen && React.createElement(GroupCreateModal,{
        creating:creatingGroup,
        initialGroupName:onboardingCreateInitialName,
        defaultCreatorName:"",
        defaultTimeZone:Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Oslo",
        lockCreatorName:true,
        requireCreatorName:false,
        onClose:handleOnboardingCreateCancel,
        onCreate:handleOnboardingCreateSubmit
      })
    );
  }
  if(localPreviewAuthEnabled && !authSession?.userId) {
    return React.createElement(IdentitySetup,{
      members: localPreviewMembers,
      onSelect: handleSelectLocalPreviewIdentity
    });
  }
  if(!authSession?.userId) {
    return React.createElement(React.Fragment,null,
      inviteContext
        ? React.createElement(PreviewLanding,{
            inviteContext,
            onCreate:()=>openAuth({ type:"create" }),
            onJoin:()=>openAuth({ type:"join" }),
            onSignIn:()=>openAuth({ type:"signin" })
          })
        : React.createElement(SignedOutLanding,{
            onCreateAccount:()=>openAuth({ type:"signup" }),
            onSignIn:()=>openAuth({ type:"signin" }),
          }),
      authStep && renderAuthFlowModal()
    );
  }
  const inviteWelcomeGroup = inviteWelcomeGroupId ? appState.groups?.[inviteWelcomeGroupId] || null : null;
  if(inviteWelcomeGroup && authSession?.userId) {
    return React.createElement(InviteWelcomeScreen,{
      group:inviteWelcomeGroup,
      currentUserId:authSession.userId,
      profilePhotoByUserId:appState.profiles,
      onContinue:handleInviteWelcomeContinue
    });
  }
  // An in-flight join must never flash the empty Bloc switcher between the
  // display-name save and landing in the joined Bloc.
  if(joiningGroup && !showJoinModal && !visibleGroups.some(group => group.id === selectedGroupId)) {
    return React.createElement(Spinner,{label:"Joining your Bloc..."});
  }
  if(!selectedGroupId || !currentGroup || !visibleGroups.some(group => group.id === selectedGroupId)) {
    const createdInviteGroup = createdInviteGroupId ? appState.groups?.[createdInviteGroupId] : null;
    return React.createElement(React.Fragment,null,
      showJoinModal && !authStep && React.createElement(JoinGroupModal,{inviteContext,joinCode,setJoinCode,onClose:handleJoinModalClose,onJoin:handleJoinGroup,joining:joiningGroup,error:inviteError,signedIn:true}),
      showProfileModal && React.createElement(ProfileModal,{email:authSession?.email,onSignOut:handleSwitchUser,onClose:()=>{setProfileError("");setShowProfileModal(false);},currentDisplayName:profile?.displayName||"",onSaveDisplayName:handleSaveProfileFromModal,saving:profileSaving,saveError:profileError,onDeleteAccount:handleDeleteAccount}),
      createdInviteGroup
        ? React.createElement(CreatedBlocInviteScreen,{group:createdInviteGroup,onContinue:handleContinueFromCreatedInvite})
        : renderGroupSwitcherSurface({ suppressIntro:suppressSwitcherIntro }),
      showProfile && React.createElement('div',{ref:profileOverlayRef,style:{position:"fixed",inset:0,zIndex:30,overflowY:"auto",overflowX:"hidden",WebkitOverflowScrolling:"touch",overscrollBehavior:"contain",background:profileRevealActive?"transparent":"var(--bg-gradient)",backgroundImage:profileRevealActive?"none":"var(--bg-radial-hint), var(--bg-gradient)"}},
        React.createElement(ProfilePage,{
          visibleGroups,
          currentUserId: effectiveAuthSession?.userId,
          displayName: effectiveProfile?.displayName || profile?.displayName || "",
          profilePhotoUrl: effectiveProfile?.profilePhotoUrl || profile?.profilePhotoUrl || "",
          email: authSession?.email,
          accountCreatedAt: profile?.createdAt,
          onBack:()=>{ setProfileRevealActive(false); setShowProfile(false); },
          onSwipeRevealChange:setProfileRevealActive,
          onEditName:()=>setShowProfileModal(true),
          onUpdateProfilePhoto:handleUpdateProfilePhoto,
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

  const renderInBlocPage = (pageName, { swipePreview=false } = {}) => React.createElement('div',{
    style:{paddingBottom:isMobileView?"calc(108px + env(safe-area-inset-bottom))":0}
  },
    pageName==="today"  &&React.createElement(TodayPageErrorBoundary,{resetKey:`${selectedGroupId}:${navResetToken}:${currentUser}`},
      React.createElement(TodayPage,  {user:currentUser,currentUserId:effectiveAuthSession?.userId,currentGroupId:selectedGroupId,groups,logs:currentGroup.logs,excused:currentGroup.excused,monthHistory:currentGroup.monthHistory,saving,onSave:handleSave,onMultiLog:handleMultiLog,onLogMutation:handleLogMutation,clockTick,onViewLastMonth:()=>{setMonthInitialIdx(0);setPage("month");},onSitOutRequest:handleSitOutRequest,onSoloRequest:handleSoloRequest,onSettlementClaimPaid:handleSettlementClaimPaid,onSettlementConfirmPaid:handleSettlementConfirmPaid,onSettlementDisputePaid:handleSettlementDisputePaid,onOpenSetupReview:()=>setShowSettings(true),navResetToken,showLog:showTodayLog,setShowLog:setShowTodayLog})
    ),
    pageName==="activity"&&React.createElement(ActivityPage,{group:currentGroup,currentUser,currentUserId:effectiveAuthSession?.userId,onLogMutation:handleLogMutation,clockTick,reactionOverrides,setReactionOverrides,commentCountOverrides:logCommentCountOverrides,onCommentCountsLoaded:setLogCommentCountOverrides,onOpenLogComments:handleOpenLogComments}),
    pageName==="month"  &&React.createElement(MonthPage,  {key:`${selectedGroupId}:${navResetToken}:${monthInitialIdx ?? "current"}`,group:currentGroup,logs:currentGroup.logs,excused:currentGroup.excused,monthHistory:currentGroup.monthHistory,groupSettings:currentGroup.settings,currentUser,currentUserId:effectiveAuthSession?.userId,initialSelIdx:monthInitialIdx,onStartNextMonth:()=>{setMonthInitialIdx(null);setPage("today");},onOpenToday:()=>setPage("today"),onSettlementClaimPaid:handleSettlementClaimPaid,onSettlementConfirmPaid:handleSettlementConfirmPaid,navResetToken}),
    pageName==="history"&&React.createElement(HistoryPage,{group:currentGroup,logs:currentGroup.logs,excused:currentGroup.excused,monthHistory:currentGroup.monthHistory,groupSettings:currentGroup.settings,navResetToken,currentUser})
  );

  const pageIndex = Math.max(0, IN_BLOC_PAGES.indexOf(page));
  const screenWidth = typeof window !== "undefined" ? (window.innerWidth || 420) : 420;
  const activePageLayer = React.createElement('div',{
    onTouchStart:startPageSwipe,
    onTouchMove:movePageSwipe,
    onTouchEnd:endPageSwipe,
    onTouchCancel:resetPageSwipe,
    style:{
      position:"relative",
      zIndex:2,
      minHeight:"calc(100vh - 64px)",
      transition:pageDragging?"none":"transform .08s ease-out",
      willChange:pageDragging?"transform":"auto",
      touchAction:"pan-y"
    }
  },
    IN_BLOC_PAGES.map((pageName,index) => {
      const active = pageName === page;
      const near = Math.abs(index - pageIndex) <= 1 || pageName === pageSwipeTarget;
      const offsetX = (index - pageIndex) * screenWidth + pageDragXRef.current;
      return React.createElement('div',{
        key:pageName,
        ref:el=>{
          if (el) pageLayerRefs.current[pageName] = el;
          else delete pageLayerRefs.current[pageName];
        },
        style:{
          position:active?"relative":"absolute",
          top:0,
          left:0,
          width:"100%",
          minHeight:"calc(100vh - 64px)",
          zIndex:active?2:1,
          pointerEvents:active?"auto":"none",
          visibility:near?"visible":"hidden",
          transform:offsetX ? `translateX(${offsetX}px)` : "none",
          transition:pageDragging?"none":"transform .08s ease-out",
          boxShadow:active&&pageDragXRef.current?"-18px 0 34px rgba(0,0,0,.24)":"none",
          willChange:pageDragging||pageDragXRef.current?"transform":"auto"
        }
      }, renderInBlocPage(pageName,{swipePreview:!active}));
    })
  );

  const activeBlocSurface = React.createElement('div',{
    ref:blocSurfaceRef,
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
      transform:blocDragXRef.current?`translateX(${blocDragXRef.current}px)`:"none",
      transition:blocDragging?"none":"transform .08s ease-out",
      boxShadow:blocDragXRef.current?"-18px 0 34px rgba(0,0,0,.28)":"none",
      willChange:blocDragging||blocDragXRef.current?"transform":"auto",
      touchAction:"pan-y"
    }
  },
    React.createElement(Nav,{page,setPage:handleNavSelect,user:currentUser,currentUserId:effectiveAuthSession?.userId||"",profilePhotoUrl:effectiveProfile?.profilePhotoUrl||"",groupName:currentGroup.name,canEditGroup:isGroupAdmin,onOpenSettings:()=>setShowSettings(true),onOpenProfile:()=>{setProfileError("");setShowProfileModal(true);},onOpenStream:handleOpenStream,streamUnreadCount,onSwitchUser:handleSwitchUser,onSwitchGroup:handleSwitchGroup,onOpenLog:()=>{setPage("today");setShowTodayLog(true);},syncing,lastSyncedAt,syncError,onRefresh:refreshNow,showJustSynced,activityAlertCount,hideMobileBottomNav:true}),
    localDevMode && React.createElement(LocalDevImpersonationBar,{options:devImpersonationOptions,value:effectiveAuthSession?.devImpersonationActive?effectiveAuthSession.userId:"",onChange:handleSelectDevImpersonation}),
    React.createElement('div',{style:{position:"relative",overflow:"hidden",minHeight:"calc(100vh - 64px)"}},
      showSettings && React.createElement('div',{style:{position:"absolute",inset:"0 0 auto 0",zIndex:1,pointerEvents:"none"}},renderInBlocPage(page,{swipePreview:true})),
      showSettings
        ? React.createElement(BlocSettingsScreen,{group:currentGroup,actor:currentUser,actorUserId:authSession?.userId,isAdmin:isGroupAdmin,onSave:handleUpdateGroupSettings,onClose:()=>setShowSettings(false),saving:savingSettings,onReviewSetup:isGroupAdmin?handleReviewSetupDefaults:null,onReviewSitOut:isGroupAdmin?handleSitOutReview:null,onReviewSolo:isGroupAdmin?handleSoloReview:null,onKickMember:isGroupAdmin?handleKickMember:null})
        : activePageLayer
    ),
    showInstallBanner && React.createElement(InstallBanner,{
      installReady:Boolean(installPrompt),
      onInstall:installApp,
      onDismiss:dismissInstall,
      showIosHint
    })
  );

  return React.createElement(React.Fragment,null,
    showJoinModal && !authStep && React.createElement(JoinGroupModal,{inviteContext,joinCode,setJoinCode,onClose:handleJoinModalClose,onJoin:handleJoinGroup,joining:joiningGroup,error:inviteError,signedIn:true}),
    showProfileModal && React.createElement(ProfileModal,{email:authSession?.email,onSignOut:handleSwitchUser,onClose:()=>setShowProfileModal(false),showDisplayName:true,currentDisplayName:currentUser,onSaveDisplayName:handleSaveProfileFromModal,saving:profileSaving,saveError:profileError,onLeaveBloc:handleLeaveBloc,onDeleteAccount:handleDeleteAccount}),
    React.createElement(BlocStream,{open:showStream,groupName:currentGroup.name,blocId:currentGroup.id,initialBlocId:streamFocusBlocId,initialScrollTop:streamReturnScrollTop,initialUnreadCount:streamUnreadCount,currentUserId:effectiveAuthSession?.userId,members:Object.values(currentGroup.memberships||{}).map(m=>({id:m.userId,name:m.displayName,photoUrl:appState.profiles?.[m.userId]?.profilePhotoUrl||""})),streamBlocs:visibleGroups.map(group=>({id:group.id,name:group.name,members:Object.values(group.memberships||{}).map(m=>({id:m.userId,name:m.displayName,photoUrl:appState.profiles?.[m.userId]?.profilePhotoUrl||""}))})),onSeasonClosedTap:handleStreamSeasonClosedTap,onUnreadCountChange:(groupId,count)=>{if(groupId===currentGroup.id)setStreamUnreadCount(Number(count)||0);},onOpenLogComments:handleOpenLogComments,onClose:()=>{setShowStream(false);setStreamFocusBlocId(null);setStreamReturnScrollTop(null);refreshStreamUnreadCount(currentGroup.id);}}),
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
    page==="today"&&renderGroupSwitcherSurface({ inert:true, suppressIntro:true }),
    activeBlocSurface,
    !showSettings && React.createElement(Nav,{onlyMobileBottomNav:true,page,setPage:handleNavSelect,user:currentUser,currentUserId:effectiveAuthSession?.userId||"",profilePhotoUrl:effectiveProfile?.profilePhotoUrl||"",groupName:currentGroup.name,canEditGroup:isGroupAdmin,onOpenSettings:()=>setShowSettings(true),onOpenProfile:()=>{setProfileError("");setShowProfileModal(true);},onOpenStream:handleOpenStream,streamUnreadCount,onSwitchUser:handleSwitchUser,onSwitchGroup:handleSwitchGroup,onOpenLog:()=>{setPage("today");setShowTodayLog(true);},syncing,lastSyncedAt,syncError,onRefresh:refreshNow,showJustSynced,activityAlertCount,mobileBottomDragX:blocDragXRef.current,mobileBottomNavRef:blocBottomNavRef,mobileBottomDragging:blocDragging}),
    renderInviteDownloadPrompt(),
    logCommentScreen && React.createElement('div',{
      style:{position:"fixed",inset:0,zIndex:520,overflow:"hidden",pointerEvents:"auto",background:"transparent"}
    },
      React.createElement(LogCommentThread,{
        groupId:logCommentScreen.groupId,
        log:logCommentScreen.log,
        currentUserId:effectiveAuthSession?.userId,
        currentUserName:currentUser,
        onClose:handleCloseLogComments,
        onCommentCountChange:handleLogCommentCountChange
      })
    )
  );
};


export { App };
