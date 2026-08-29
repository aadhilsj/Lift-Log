import React from "react";
import { createPortal } from "react-dom";
import { PAYMENT_PROVIDERS, buildPaymentTarget, normalizePaymentHandle } from "../lib/paymentLinks.js";
const { useState, useEffect, useMemo, useCallback, useRef } = React;
import {
  DEFAULT_GROUP_TIME_ZONE,
  MIN_TARGET,
  avatarColor,
  getCountedLogCount,
  getCurrentGroupMemberNames
} from "../lib/appState.js";
import {
  getAcceptedWorkoutTypes,
  getGroupCloseMeta,
  getGroupMemberPreview,
  isMobile,
  copyToClipboard
} from "../lib/utils.js";
import { Avatar, WorkoutTypeIcon, AppIcon, AnteWordmark, PrimaryActionButton, UploadPhotoIcon } from "../components/primitives.jsx";
import { GroupCreateModal } from "../modals/modals.jsx";

const previewStatus = (logged, target) => {
  const pct = logged / target;
  if (pct >= 1)    return { label:"CLEARED",  color:"#E9EEF5", bg:"rgba(233,238,245,.16)", border:"rgba(233,238,245,.18)" };
  if (pct >= 0.6)  return { label:"ON TRACK", color:"#61D36A", bg:"rgba(97,211,106,.12)", border:"rgba(97,211,106,.18)" };
  if (pct >= 0.35) return { label:"AT RISK",  color:"var(--amber)", bg:"rgba(255,177,66,.12)", border:"rgba(255,177,66,.18)" };
  return             { label:"COOKED",   color:"var(--red)", bg:"rgba(255,91,91,.12)", border:"rgba(255,91,91,.18)" };
};

const containOverlayTouchMove = event => {
  if (event.target?.closest?.(".modal")) return;
  if (event.cancelable) event.preventDefault();
};

function readOnboardingProfilePhoto(file) {
  return new Promise((resolve, reject) => {
    if (!file || !/^image\//i.test(file.type || "")) {
      reject(new Error("Choose an image file"));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Unable to load photo"));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error("Unable to load photo"));
      image.onload = () => {
        const side = Math.min(image.naturalWidth || 0, image.naturalHeight || 0);
        if (!side) {
          reject(new Error("Unable to load photo"));
          return;
        }
        const canvas = document.createElement("canvas");
        canvas.width = 720;
        canvas.height = 720;
        const context = canvas.getContext("2d");
        const sx = Math.max(0, ((image.naturalWidth || side) - side) / 2);
        const sy = Math.max(0, ((image.naturalHeight || side) - side) / 2);
        context.drawImage(image, sx, sy, side, side, 0, 0, 720, 720);
        resolve(canvas.toDataURL("image/jpeg", .84));
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

const containOverlayTouch = event => {
  if (event.target?.closest?.(".modal")) return;
  event.stopPropagation();
};

const containOverlayActivation = event => {
  if (event.target?.closest?.(".modal")) return;
  event.stopPropagation();
  if (event.cancelable) event.preventDefault();
};

const stopModalTouch = event => {
  event.stopPropagation();
};

const renderTopLevelOverlay = node => {
  if (typeof document === "undefined") return node;
  return createPortal(node, document.body);
};


const PreviewLanding = ({inviteContext,group,profilePhotoByUserId,onJoin,alreadyMemberNotice,onEnterAlreadyMember}) => {
  const target = Number(group?.settings?.minTarget || inviteContext?.minTarget || MIN_TARGET);
  const groupName = String(inviteContext?.groupName || group?.name || "Bloc").replace(/^join\s+/i, "").trim() || "Bloc";
  const liveRows = group
    ? Object.values(group.memberships || {})
        .filter(member => String(member?.displayName || "").trim())
        .map(member => {
          const count = getCountedLogCount(group.logs?.[member.displayName] || []);
          return {
            name: member.displayName,
            userId: member.userId || "",
            logged: count,
            target,
            photoUrl: profilePhotoByUserId?.[member.userId]?.profilePhotoUrl || ""
          };
        })
        .sort((a,b) => b.logged - a.logged || a.name.localeCompare(b.name))
        .slice(0, 3)
    : [];
  const inviteRows = Array.isArray(inviteContext?.leaderboardRows)
    ? inviteContext.leaderboardRows
        .filter(member => String(member?.name || "").trim())
        .map(member => ({
          name: String(member.name || "").trim(),
          userId: member.userId || "",
          logged: Number(member.logged || 0),
          target: Number(member.target || target),
          photoUrl: member.photoUrl || ""
        }))
        .slice(0, 3)
    : [];
  const rowData = liveRows.length ? liveRows : inviteRows;
  const memberCount = inviteContext?.memberCount || (group ? getCurrentGroupMemberNames(group).length : 0);
  const previewRows = rowData.map((m,i) => {
    const st = previewStatus(m.logged, target);
    return React.createElement('div',{
      key:m.userId || m.name,
      style:{
        padding:"13px 15px",
        borderBottom:i<rowData.length-1?"1px solid rgba(62,62,82,.45)":"none",
        display:"flex",
        alignItems:"center",
        gap:12
      }
    },
      React.createElement('div',{style:{fontWeight:900,fontSize:13,color:"var(--muted)",width:24,textAlign:"right",flexShrink:0}},`#${i+1}`),
      React.createElement(Avatar,{name:m.name,userId:m.userId,photoUrl:m.photoUrl,size:38}),
      React.createElement('div',{style:{flex:1,minWidth:0}},
        React.createElement('div',{style:{fontFamily:"'Raleway', sans-serif",fontWeight:900,fontSize:16,lineHeight:1.18,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",paddingBottom:1}},m.name)
      ),
      React.createElement('span',{style:{fontFamily:"'Outfit', sans-serif",fontSize:8.5,fontWeight:900,color:st.color,background:st.bg,border:`0.5px solid ${st.border}`,borderRadius:999,padding:"4px 8px",letterSpacing:".08em",textTransform:"uppercase",lineHeight:1,flexShrink:0}},st.label),
      React.createElement('div',{style:{fontFamily:"'Raleway', sans-serif",fontWeight:900,fontSize:20,color:"var(--green)",minWidth:24,textAlign:"right",flexShrink:0}},m.logged)
    );
  });

  const hero = React.createElement('div',{
    key:"preview-hero",
    className:"fu",
    style:{textAlign:"center",maxWidth:620,marginBottom:16}
  },
    React.createElement('div',{style:{margin:"0 0 14px"}},React.createElement(AnteWordmark,{size:68})),
    React.createElement('div',{style:{fontSize:15,fontWeight:500,color:"#f5f7ff",marginBottom:8}},
      "Welcome to the ",
      React.createElement('span',{style:{color:"#4ECDC4"}},"Bloc"),
      " that keeps you showing up."
    )
  );

  const previewHeader = React.createElement('div',{
    key:"preview-header",
    style:{padding:"13px 16px",borderBottom:"1px solid rgba(62,62,82,.7)",display:"flex",alignItems:"center",justifyContent:"space-between"}
  },
    React.createElement('div',null,
      React.createElement('div',{style:{fontWeight:900,fontSize:15,letterSpacing:"-.01em"}},groupName),
      React.createElement('div',{style:{fontFamily:"'Outfit', sans-serif",fontSize:9,color:"var(--muted)",textTransform:"uppercase",letterSpacing:".09em",fontWeight:800,marginTop:2}},`${target} workouts · ${memberCount || "—"}/20 members`)
    ),
  );

  const previewCard = React.createElement('div',{
    key:"preview-card",
    className:"fu2",
    style:{width:"100%",maxWidth:440,marginBottom:20,background:"linear-gradient(180deg,rgba(24,24,31,.98),rgba(17,17,23,.98))",border:"1px solid rgba(62,62,82,.9)",borderRadius:18,overflow:"hidden"}
  }, [previewHeader].concat(previewRows.length
    ? previewRows
    : React.createElement('div',{key:"empty-preview",style:{padding:"18px 16px",fontFamily:"'Outfit', sans-serif",fontSize:13,fontWeight:700,color:"var(--muted)",textAlign:"center"}},"The leaderboard is ready.")
  ));

  const actions = React.createElement('div',{
    key:"preview-actions",
    className:"fu4",
    style:{display:"flex",gap:10,flexWrap:"wrap",justifyContent:"center"}
  },
    alreadyMemberNotice
      ? React.createElement('div',{style:{width:"100%",maxWidth:360,display:"grid",gap:10,padding:13,borderRadius:16,background:"rgba(8,15,15,.9)",border:"0.5px solid rgba(78,205,196,.24)",boxShadow:"0 16px 42px rgba(0,0,0,.24), 0 0 20px rgba(78,205,196,.08)",textAlign:"center"}},
          React.createElement('div',{style:{fontFamily:"'Outfit', sans-serif",fontSize:14,fontWeight:900,color:"var(--text)"}},"You're already in this Bloc."),
          React.createElement('button',{type:"button",className:"setup-press",onClick:onEnterAlreadyMember,style:{minHeight:44,borderRadius:13,background:"#4ECDC4",color:"#050909",fontFamily:"'Outfit', sans-serif",fontSize:14,fontWeight:900}},"Enter the Bloc")
        )
      : inviteContext && inviteContext.memberCount>=20
      ? React.createElement('div',{style:{fontFamily:"'Outfit', sans-serif",fontSize:12,fontWeight:700,color:"var(--amber)",padding:"10px 14px",borderRadius:9,background:"var(--amber-bg)",border:"1px solid var(--amber-dim)",textAlign:"center"}},"This Bloc is full. Maximum 20 members allowed.")
      : React.createElement(PrimaryActionButton,{label:"Join this Bloc",onClick:onJoin})
  );

  const children = [hero, previewCard, actions];
  return React.createElement('div',{style:{minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"32px 18px",background:"transparent"}},children);
};

const InvalidInviteScreen = ({message}) => (
  React.createElement('div',{style:{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",padding:"32px 20px",background:"var(--bg-gradient)",backgroundImage:"var(--bg-radial-hint), var(--bg-gradient)",color:"var(--text)"}},
    React.createElement('section',{className:"fu",style:{width:"100%",maxWidth:420,display:"grid",gap:18,textAlign:"center",justifyItems:"center",transform:"translateY(-18px)"}},
      React.createElement(AnteWordmark,{size:76}),
      React.createElement('div',{style:{display:"grid",gap:9,justifyItems:"center"}},
        React.createElement('h1',{style:{margin:0,fontFamily:"'Raleway', sans-serif",fontSize:34,fontWeight:900,lineHeight:1.02,letterSpacing:0}},"This invite link doesn't work."),
        React.createElement('p',{style:{margin:0,fontFamily:"'Outfit', sans-serif",fontSize:15,fontWeight:700,lineHeight:1.45,color:"var(--text-soft)",maxWidth:340}},message || "Ask the Bloc admin for a fresh invite link.")
      )
    )
  )
);

const SignedOutLanding = ({onCreateAccount,onSignIn}) => (
  React.createElement('div',{style:{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",padding:"32px 20px",background:"var(--bg-gradient)",backgroundImage:"var(--bg-radial-hint), var(--bg-gradient)"}},
    React.createElement('div',{className:"fu",style:{width:"100%",maxWidth:420,display:"grid",gap:22,textAlign:"center",justifyItems:"center",transform:"translateY(-22px)"}},
      React.createElement('div',{style:{display:"grid",gap:14,justifyItems:"center"}},
        React.createElement(AnteWordmark,{size:84}),
        React.createElement('div',{style:{fontFamily:"'Raleway', sans-serif",fontSize:34,fontWeight:900,lineHeight:1.02,letterSpacing:0,color:"var(--text)"}},
          "Welcome back."
        ),
        React.createElement('div',{style:{fontFamily:"'Outfit', sans-serif",fontSize:15,fontWeight:700,lineHeight:1.45,color:"var(--text-soft)",maxWidth:340,margin:"0 auto"}},
          "Sign in to get back to your Blocs, or create a new account to get started."
        )
      ),
      React.createElement('div',{style:{width:"100%",display:"grid",gap:10,padding:14,borderRadius:18,background:"rgba(8,15,15,.82)",border:"0.5px solid rgba(78,205,196,.18)",boxShadow:"0 18px 46px rgba(0,0,0,.28), inset 0 1px 0 rgba(255,255,255,.035)"}},
        React.createElement('button',{type:"button",className:"setup-press",onClick:onSignIn,style:{minHeight:50,borderRadius:14,background:"#4ECDC4",color:"#050909",fontFamily:"'Outfit', sans-serif",fontSize:15,fontWeight:900}},"Sign in"),
        React.createElement('button',{type:"button",className:"setup-press",onClick:onCreateAccount,style:{minHeight:48,borderRadius:14,background:"transparent",border:"0.5px solid rgba(78,205,196,.24)",color:"var(--text-soft)",fontFamily:"'Outfit', sans-serif",fontSize:14,fontWeight:800}},"Create new account")
      )
    )
  )
);


// "How people pay you" — an optional handle shown to Bloc members who owe you
// after a month closes. Fero stores an opaque string and, at render time,
// either links to an allowlisted payment host or offers it for copying. It
// never processes, routes, holds, or verifies a payment, and it never changes
// settlement status. See src/lib/paymentLinks.js.
const renderPaymentHandleSection = ({
  payProvider, setPayProvider, payHandle, setPayHandle,
  currentPaymentProvider, currentPaymentHandle,
  onSavePayment, savingPayment, paymentError,
  pasteNotice, onPasteFromClipboard, onOpenProviderApp
}) => {
  const activeDef = PAYMENT_PROVIDERS.find(provider => provider.id === payProvider) || null;
  const trimmedHandle = payHandle.trim();
  const dirty = payProvider !== (currentPaymentProvider || "") || trimmedHandle !== (currentPaymentHandle || "");
  // Clearing the provider clears the handle, which is how a user removes it.
  const canSave = !savingPayment && dirty && (!payProvider || trimmedHandle.length > 0);
  const preview = payProvider && trimmedHandle
    ? buildPaymentTarget({ paymentProvider: payProvider, paymentHandle: trimmedHandle })
    : null;
  // Each provider is rendered as its own app icon: a rounded square filled
  // with the provider's icon background and the glyph reversed out in white,
  // the way it looks on a phone home screen. Selection is shown by a ring and
  // full opacity rather than by changing the icon, so the tile always reads as
  // that app.
  const ICON_SIZE = 54;
  const chipStyle = (provider, active) => ({
    width:ICON_SIZE, height:ICON_SIZE, padding:0, flexShrink:0,
    borderRadius:ICON_SIZE * 0.225,
    background: provider.iconBg || provider.brand,
    border:"none",
    cursor:"pointer",
    display:"flex", alignItems:"center", justifyContent:"center",
    opacity: active ? 1 : 0.42,
    boxShadow: active
      ? `0 0 0 2px var(--s1, #080F0F), 0 0 0 4px ${provider.brand}, 0 6px 14px rgba(0,0,0,.35)`
      : "0 2px 6px rgba(0,0,0,.25)",
    transition:"opacity .16s ease, box-shadow .16s ease",
    WebkitTapHighlightColor:"transparent"
  });
  const renderProviderMark = provider => provider.appIcon
    ? React.createElement('span',{
        "aria-hidden":true,
        style:{display:"inline-flex",width:"58%",height:"58%",alignItems:"center",justifyContent:"center",color:"#FFFFFF"},
        dangerouslySetInnerHTML:{__html:provider.appIcon}
      })
    : null;
  return React.createElement('div',{style:{marginBottom:14}},
    React.createElement('span',{className:"lbl",style:{marginBottom:6,display:"block"}},"How people pay you"),
    React.createElement('div',{style:{fontSize:11,color:"var(--text-faint)",lineHeight:1.45,marginBottom:8}},
      "Optional. Shown only to Bloc members who owe you after a month closes. Fero never handles the money."
    ),
    React.createElement('div',{style:{display:"flex",gap:12,marginBottom:10,alignItems:"center"}},
      PAYMENT_PROVIDERS.map(provider => React.createElement('button',{
        key:provider.id, type:"button",
        onClick:()=>{ const next = payProvider===provider.id ? "" : provider.id; setPayProvider(next); if(!next) setPayHandle(""); },
        style:chipStyle(provider, payProvider===provider.id),
        "aria-pressed":payProvider===provider.id,
        "aria-label":provider.label,
        title:provider.label
      },
        renderProviderMark(provider) || provider.label
      ))
    ),
    payProvider && React.createElement(React.Fragment,null,
      React.createElement('input',{
        value:payHandle,
        onChange:e=>setPayHandle(e.target.value),
        placeholder:activeDef?.placeholder||"",
        autoCapitalize:"none", autoCorrect:"off", spellCheck:false,
        style:{width:"100%",background:"var(--s2)",border:"1px solid var(--border)",borderRadius:10,padding:"11px 13px",color:"var(--text)",fontSize:14,outline:"none",boxSizing:"border-box"}
      }),
      // Most people have to leave Fero to fetch their link. Rather than make
      // them retype it, offer a one-tap paste of whatever they copied.
      React.createElement('div',{style:{display:"flex",alignItems:"center",gap:8,marginTop:7,flexWrap:"wrap"}},
        activeDef?.appUrl && React.createElement('button',{
          type:"button",
          onClick:()=>onOpenProviderApp(activeDef),
          style:{
            display:"inline-flex",alignItems:"center",gap:6,
            padding:"6px 10px",borderRadius:8,cursor:"pointer",
            background:activeDef.iconBg||activeDef.brand,border:"none",
            color:"#FFFFFF",fontSize:11,fontWeight:800,
            fontFamily:"'Outfit', sans-serif"
          }
        },
          React.createElement('span',{"aria-hidden":true,style:{display:"inline-flex",width:12,height:12,alignItems:"center",justifyContent:"center"},dangerouslySetInnerHTML:{__html:activeDef.appIcon}}),
          `Open ${activeDef.label}`
        ),
        React.createElement('button',{
          type:"button",
          onClick:onPasteFromClipboard,
          style:{
            display:"inline-flex",alignItems:"center",gap:5,
            padding:"6px 10px",borderRadius:8,cursor:"pointer",
            background:"var(--s2)",border:"1px solid var(--border)",
            color:"var(--text-soft)",fontSize:11,fontWeight:800,
            fontFamily:"'Outfit', sans-serif"
          }
        }, "Paste copied link"),
        pasteNotice && React.createElement('span',{style:{fontSize:10.5,color:pasteNotice.tone==="error"?"var(--red)":"var(--text-faint)",lineHeight:1.35}},pasteNotice.text)
      ),
      React.createElement('div',{style:{fontSize:10.5,color:"var(--text-faint)",lineHeight:1.4,marginTop:6}},
        `Open ${activeDef?.label || "the app"}, copy your payment link, then come back and tap Paste.`
      ),
      activeDef?.hint && React.createElement('div',{style:{fontSize:10.5,color:"var(--text-faint)",lineHeight:1.4,marginTop:4}},activeDef.hint),
      preview && preview.mode==="copy" && React.createElement('div',{style:{fontSize:10.5,color:"var(--amber)",lineHeight:1.4,marginTop:6}},
        "This will be shown for copying rather than as a one-tap link."
      )
    ),
    paymentError && React.createElement('div',{style:{fontSize:11,color:"var(--red)",marginTop:8}},paymentError),
    dirty && React.createElement('button',{
      type:"button", disabled:!canSave,
      onClick:()=>onSavePayment({ paymentProvider:payProvider, paymentHandle:payProvider?trimmedHandle:"" }),
      style:{width:"100%",marginTop:9,background:canSave?"var(--green)":"var(--s3)",color:canSave?"#000":"var(--muted2)",padding:"10px",borderRadius:10,fontSize:13,fontWeight:800,border:"none",cursor:canSave?"pointer":"default"}
    }, savingPayment ? "Saving..." : (payProvider ? "Save payment details" : "Remove payment details"))
  );
};

const ProfileModal = ({email,onSignOut,onClose,showDisplayName,currentDisplayName,onSaveDisplayName,saving,saveError,onLeaveBloc,onDeleteAccount,currentPaymentProvider="",currentPaymentHandle="",onSavePayment,savingPayment=false,paymentError="",showFounderDashboard,onOpenFounderDashboard}) => {
  const [name,setName]=React.useState(currentDisplayName||"");
  const [payProvider,setPayProvider]=React.useState(currentPaymentProvider||"");
  const [payHandle,setPayHandle]=React.useState(currentPaymentHandle||"");
  const [pasteNotice,setPasteNotice]=React.useState(null);
  // Clipboard reads can be refused (permission, insecure context, older
  // browsers). Failure must never look like a bug: fall back to telling the
  // user to paste into the field themselves, which always works.
  // Custom schemes fail silently when the app is absent, so fall back to the
  // provider's site if we are still here shortly after. Leaving for the app
  // hides the page, which cancels the fallback.
  const handleOpenProviderApp = provider => {
    if (!provider?.appUrl) return;
    setPasteNotice(null);
    let cancelled = false;
    const cancel = () => { cancelled = true; };
    document.addEventListener("visibilitychange", cancel, { once: true });
    window.addEventListener("pagehide", cancel, { once: true });
    window.setTimeout(() => {
      document.removeEventListener("visibilitychange", cancel);
      window.removeEventListener("pagehide", cancel);
      if (cancelled || document.hidden) return;
      if (provider.appWeb) window.open(provider.appWeb, "_blank", "noopener,noreferrer");
    }, 1200);
    window.location.href = provider.appUrl;
  };
  const handlePasteFromClipboard = async () => {
    setPasteNotice(null);
    try {
      const text = (await navigator.clipboard.readText() || "").trim();
      if (!text) { setPasteNotice({tone:"error",text:"Clipboard is empty"}); return; }
      const cleaned = normalizePaymentHandle(payProvider, text);
      if (!cleaned) { setPasteNotice({tone:"error",text:"That doesn't look like a link"}); return; }
      setPayHandle(cleaned);
      setPasteNotice({tone:"ok",text:"Pasted"});
    } catch {
      setPasteNotice({tone:"error",text:"Paste into the field above instead"});
    }
  };
  const [showLeaveConfirm,setShowLeaveConfirm]=React.useState(false);
  const [leaving,setLeaving]=React.useState(false);
  const [showDeleteConfirm,setShowDeleteConfirm]=React.useState(false);
  const [deleting,setDeleting]=React.useState(false);
  const [deleteError,setDeleteError]=React.useState("");
  const textLink = {background:"transparent",border:"none",padding:0,color:"var(--text-faint)",fontSize:12,fontWeight:500,cursor:"pointer",textDecoration:"underline",textDecorationColor:"rgba(255,255,255,.12)",textUnderlineOffset:"3px"};
  const signOutLink = {...textLink,color:"rgba(220,100,100,.55)"};
  const deleteAccountLink = {...textLink,color:"rgba(180,60,60,.45)",fontSize:10,fontWeight:500};
  return React.createElement(React.Fragment,null,
    React.createElement('div',{onClick:onClose,style:{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",zIndex:1050}}),
    React.createElement('div',{onClick:e=>e.stopPropagation(),style:{position:"fixed",top:"50%",left:"50%",transform:"translate(-50%,-50%)",zIndex:1051,width:"calc(100% - 40px)",maxWidth:400,background:"#080F0F",border:"0.5px solid #0D1F1E",borderRadius:20,padding:"18px 16px",boxSizing:"border-box"}},
      React.createElement('button',{onClick:onClose,style:{position:"absolute",top:12,right:14,background:"transparent",border:"none",color:"var(--muted)",fontSize:20,lineHeight:1,padding:4,cursor:"pointer"}},"×"),
      React.createElement('div',{style:{fontWeight:800,fontSize:18,marginBottom:14}},"Account"),
      React.createElement('label',{style:{display:"block",marginBottom:showDisplayName?12:16}},
        React.createElement('span',{className:"lbl",style:{marginBottom:6}},"Email"),
        React.createElement('div',{style:{padding:"11px 13px",borderRadius:10,background:"var(--s2)",border:"1px solid var(--border)",fontSize:14,color:"var(--muted)"}},email||"—")
      ),
      onSavePayment && renderPaymentHandleSection({
        payProvider, setPayProvider, payHandle, setPayHandle,
        currentPaymentProvider, currentPaymentHandle,
        onSavePayment, savingPayment, paymentError,
        pasteNotice, onPasteFromClipboard: handlePasteFromClipboard,
        onOpenProviderApp: handleOpenProviderApp
      }),
      showFounderDashboard && !showLeaveConfirm && !showDeleteConfirm && React.createElement('button',{type:"button",onClick:onOpenFounderDashboard,style:{width:"100%",margin:"0 0 14px",padding:"11px 12px",borderRadius:10,border:"1px solid rgba(78,205,196,.35)",background:"rgba(78,205,196,.08)",color:"#4ECDC4",fontSize:12,fontWeight:900,cursor:"pointer"}},"Open founder dashboard"),
      showDisplayName
        ? React.createElement(React.Fragment,null,
            showLeaveConfirm
              ? React.createElement('div',{style:{padding:"12px",borderRadius:10,background:"rgba(60,10,10,.6)",border:"1px solid rgba(180,60,60,.22)"}},
                  React.createElement('div',{style:{fontSize:12,color:"rgba(200,160,160,.8)",marginBottom:10,lineHeight:1.5}},`Leave this Bloc? You'll be removed from this month's stakes.`),
                  React.createElement('div',{style:{display:"flex",gap:16,justifyContent:"center"}},
                    React.createElement('button',{type:"button",onClick:()=>setShowLeaveConfirm(false),style:textLink},"Cancel"),
                    React.createElement('button',{type:"button",disabled:leaving,onClick:async()=>{setLeaving(true);await onLeaveBloc();setLeaving(false);},style:textLink},leaving?"Leaving...":"Leave Bloc")
                  )
                )
              : showDeleteConfirm
              ? React.createElement('div',{style:{padding:"12px",borderRadius:10,background:"rgba(60,10,10,.5)",border:"1px solid rgba(180,60,60,.2)"}},
                  React.createElement('div',{style:{fontSize:12,color:"rgba(220,170,170,.85)",marginBottom:10,lineHeight:1.55}},"This will permanently delete your account and remove you from all Blocs. This cannot be undone."),
                  deleteError && React.createElement('div',{style:{fontSize:11,color:"var(--red)",marginBottom:8}},deleteError),
                  React.createElement('div',{style:{display:"flex",gap:8}},
                    React.createElement('button',{type:"button",onClick:()=>{setShowDeleteConfirm(false);setDeleteError("");},style:{flex:1,background:"var(--s2)",border:"1px solid var(--border)",color:"var(--muted)",padding:"9px",borderRadius:9,fontSize:12,fontWeight:600}},"Cancel"),
                    React.createElement('button',{type:"button",disabled:deleting,onClick:async()=>{setDeleting(true);setDeleteError("");const r=await onDeleteAccount();if(r&&!r.ok){setDeleteError(r.error||"Unable to delete account");setDeleting(false);}},style:{flex:1,background:"var(--red-dim)",border:"1px solid rgba(212,74,74,.35)",color:"var(--red)",padding:"9px",borderRadius:9,fontSize:12,fontWeight:800}},deleting?"Deleting...":"Delete account")
                  )
                )
              : React.createElement('div',{style:{display:"flex",alignItems:"center",justifyContent:"center",gap:24}},
                  React.createElement('div',{style:{display:"flex",gap:14,alignItems:"center"}},
                    onDeleteAccount && React.createElement('button',{type:"button",onClick:()=>setShowDeleteConfirm(true),style:deleteAccountLink},"Delete account"),
                    onLeaveBloc && React.createElement('button',{type:"button",onClick:()=>setShowLeaveConfirm(true),style:{...textLink,fontSize:10}},"Leave Bloc")
                  ),
                  React.createElement('button',{onClick:onSignOut,style:signOutLink},"Sign out")
                )
          )
        : showDeleteConfirm
        ? React.createElement('div',{style:{padding:"12px",borderRadius:10,background:"rgba(60,10,10,.5)",border:"1px solid rgba(180,60,60,.2)"}},
            React.createElement('div',{style:{fontSize:12,color:"rgba(220,170,170,.85)",marginBottom:10,lineHeight:1.55}},"This will permanently delete your account and remove you from all Blocs. This cannot be undone."),
            deleteError && React.createElement('div',{style:{fontSize:11,color:"var(--red)",marginBottom:8}},deleteError),
            React.createElement('div',{style:{display:"flex",gap:8}},
              React.createElement('button',{type:"button",onClick:()=>{setShowDeleteConfirm(false);setDeleteError("");},style:{flex:1,background:"var(--s2)",border:"1px solid var(--border)",color:"var(--muted)",padding:"9px",borderRadius:9,fontSize:12,fontWeight:600}},"Cancel"),
              React.createElement('button',{type:"button",disabled:deleting,onClick:async()=>{setDeleting(true);setDeleteError("");const r=await onDeleteAccount();if(r&&!r.ok){setDeleteError(r.error||"Unable to delete account");setDeleting(false);}},style:{flex:1,background:"var(--red-dim)",border:"1px solid rgba(212,74,74,.35)",color:"var(--red)",padding:"9px",borderRadius:9,fontSize:12,fontWeight:800}},deleting?"Deleting...":"Delete account")
            )
          )
        : React.createElement(React.Fragment,null,
            onSaveDisplayName && React.createElement('label',{style:{display:"block",marginBottom:12}},
              React.createElement('span',{className:"lbl",style:{marginBottom:6}},"Display name"),
              React.createElement('input',{value:name,onChange:e=>setName(e.target.value),placeholder:"Your name",style:{width:"100%",background:"var(--s2)",border:"1px solid var(--border)",borderRadius:10,padding:"12px 13px",color:"var(--text)",fontSize:15,outline:"none",boxSizing:"border-box"}})
            ),
            saveError && React.createElement('div',{style:{fontSize:11,color:"var(--red)",marginBottom:8}},saveError),
            onSaveDisplayName && React.createElement('button',{disabled:!name.trim()||saving||name.trim()===currentDisplayName,onClick:()=>onSaveDisplayName(name.trim()),style:{width:"100%",background:name.trim()&&name.trim()!==currentDisplayName&&!saving?"var(--green)":"var(--s3)",color:name.trim()&&name.trim()!==currentDisplayName&&!saving?"#000":"var(--muted2)",padding:"12px",borderRadius:10,fontSize:14,fontWeight:800,border:"none",marginBottom:14,cursor:"pointer"}},saving?"Saving...":"Save name"),
            React.createElement('div',{style:{display:"flex",alignItems:"center",justifyContent:"center",gap:24}},
              onDeleteAccount && React.createElement('button',{type:"button",onClick:()=>setShowDeleteConfirm(true),style:deleteAccountLink},"Delete account"),
              React.createElement('button',{onClick:onSignOut,style:signOutLink},"Sign out")
            )
          )
    )
  );
};


const JoinGroupModal = ({inviteContext,joinCode,setJoinCode,onClose,onJoin,joining,error,signedIn=false,confirmLabel="Join Bloc",pendingLabel="Joining...",helperOverride=""}) => {
  const isFull = inviteContext && inviteContext.memberCount >= 20;
  const canJoin = joinCode.trim() && !joining && !isFull;
  const helperCopy = helperOverride || (inviteContext
    ? (signedIn
        ? `${inviteContext.groupName} is ready. Confirm the invite code below to join.`
        : `${inviteContext.groupName} is waiting for you. Confirm the invite code below to join.`)
    : "Enter a Bloc invite code. You can always ask the admin to share the link instead.");
  return renderTopLevelOverlay(React.createElement('div',{className:"overlay center-mobile",onClick:containOverlayActivation,onMouseDown:containOverlayActivation,onPointerDown:containOverlayActivation,onTouchStart:containOverlayTouch,onTouchMove:containOverlayTouchMove,onTouchEnd:containOverlayTouch,onTouchCancel:containOverlayTouch,style:{background:"rgba(5,9,9,0.85)",touchAction:"none",zIndex:10000,pointerEvents:"auto"}},
    React.createElement('div',{className:"modal pi",onClick:e=>e.stopPropagation(),onTouchStart:stopModalTouch,onTouchMove:stopModalTouch,onTouchEnd:stopModalTouch,onTouchCancel:stopModalTouch,style:{maxWidth:380,touchAction:"auto"}},
      React.createElement('div',{style:{fontFamily:"'Raleway', sans-serif",fontWeight:800,fontSize:22,letterSpacing:0,lineHeight:1.08,marginBottom:6}},inviteContext?"Join this Bloc":"Join a Bloc"),
      React.createElement('div',{style:{fontFamily:"'Outfit', sans-serif",color:"var(--muted)",fontSize:13,lineHeight:1.6,marginBottom:16}},helperCopy),
      React.createElement('label',{style:{display:"block",marginBottom:18}},
        React.createElement('span',{style:{display:"block",fontFamily:"'Outfit', sans-serif",fontSize:13,fontWeight:800,color:"var(--text)",marginBottom:5}},"Invite code"),
        React.createElement('input',{value:joinCode,onChange:e=>setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,"").slice(0,8)),placeholder:"XXXXXXX",style:{width:"100%",background:"var(--s2)",border:"1px solid var(--border)",borderRadius:10,padding:"12px 13px",color:"var(--text)",fontFamily:"'Outfit', sans-serif",fontSize:15,outline:"none",textTransform:"uppercase"}})
      ),
      isFull && React.createElement('div',{style:{fontFamily:"'Outfit', sans-serif",fontSize:12,fontWeight:700,color:"var(--amber)",marginBottom:14,padding:"9px 11px",borderRadius:9,background:"var(--amber-bg)",border:"1px solid var(--amber-dim)"}},"This Bloc is full. Maximum 20 members allowed."),
      !isFull && error && React.createElement('div',{style:{fontSize:12,color:"var(--red)",marginBottom:14}},error),
      React.createElement('div',{style:{display:"flex",gap:9}},
        React.createElement('button',{type:"button",className:"setup-press",onClick:onClose,style:{flex:1,background:"transparent",border:"1px solid var(--border)",color:"var(--muted)",padding:"14px",borderRadius:10,fontSize:15,fontWeight:700}},"Cancel"),
        React.createElement('button',{type:"button",className:"setup-press",disabled:!canJoin,onClick:onJoin,style:{flex:1,background:canJoin?"#4ECDC4":"var(--s3)",color:canJoin?"#050909":"var(--muted2)",padding:"14px",borderRadius:10,fontSize:15,fontWeight:900}},joining?pendingLabel:confirmLabel)
      )
    )
  ));
};


const authTitle = (step, mode, intent) => {
  if (step === "existing") return "Account already exists";
  if (step === "alreadyMember") return "You're already in this Bloc";
  if (step === "name") return "Choose your Fero name";
  if (step === "otp") return "Check your email";
  if (mode === "signup") return "Create your account";
  if (intent === "create" || intent === "join") return "Sign in first";
  return "Continue with email";
};

const authHelper = (step, mode, intent, email) => {
  if (step === "existing") return `We found a Fero account for ${email}. Sign back into it, or use a different email to create a new account.`;
  if (step === "alreadyMember") return "Sign in to open the Bloc you're already part of.";
  if (step === "otp") return `We sent a 6-digit code to ${email}.`;
  if (step === "name") return "This is the name your Bloc will see.";
  if (mode === "signup") return "Use a new email. We'll send a one-time code.";
  if (intent === "create") return "Use your email so your Bloc is saved to your account.";
  if (intent === "join") return "Use your email so we can add you to the Bloc.";
  return "Use a one-time code to sign in.";
};

const AuthFlowModal = ({step,mode="signin",intent="",email,setEmail,code,setCode,displayName,setDisplayName,onClose,onSendOtp,onVerifyOtp,onSaveProfile,onConfirmExistingAccount,onUseDifferentEmail,sending,verifying,savingProfile,error,devCode}) => renderTopLevelOverlay(React.createElement('div',{className:"overlay center-mobile",onClick:containOverlayActivation,onMouseDown:containOverlayActivation,onPointerDown:containOverlayActivation,onTouchStart:containOverlayTouch,onTouchMove:containOverlayTouchMove,onTouchEnd:containOverlayTouch,onTouchCancel:containOverlayTouch,style:{touchAction:"none",zIndex:10000,pointerEvents:"auto"}},
  React.createElement('div',{className:"modal pi",onClick:e=>e.stopPropagation(),onTouchStart:stopModalTouch,onTouchMove:stopModalTouch,onTouchEnd:stopModalTouch,onTouchCancel:stopModalTouch,style:{maxWidth:420,touchAction:"auto"}},
    React.createElement('div',{style:{fontFamily:"'Raleway', sans-serif",fontWeight:900,fontSize:22,marginBottom:6,lineHeight:1.05,letterSpacing:0}},
      authTitle(step, mode, intent)
    ),
    React.createElement('div',{style:{fontFamily:"'Outfit', sans-serif",color:"var(--muted)",fontSize:13,lineHeight:1.6,marginBottom:18}},
      authHelper(step, mode, intent, email)
    ),
    step==="email" && React.createElement('label',{style:{display:"block",marginBottom:18}},
      React.createElement('span',{className:"lbl"},"Email"),
      React.createElement('input',{type:"email",value:email,onChange:e=>setEmail(e.target.value),placeholder:"you@example.com",style:{width:"100%",background:"var(--s2)",border:"1px solid var(--border)",borderRadius:10,padding:"12px 13px",color:"var(--text)",fontSize:15,outline:"none"}})
    ),
    step==="otp" && React.createElement(React.Fragment,null,
      React.createElement('label',{style:{display:"block",marginBottom:12}},
        React.createElement('span',{className:"lbl"},"One-time code"),
        React.createElement('input',{value:code,onChange:e=>setCode(e.target.value.replace(/\D/g,"").slice(0,6)),placeholder:"123456",style:{width:"100%",background:"var(--s2)",border:"1px solid var(--border)",borderRadius:10,padding:"12px 13px",color:"var(--text)",fontSize:20,outline:"none",letterSpacing:".22em",fontFamily:"'JetBrains Mono',monospace"}})
      ),
      devCode && React.createElement('div',{style:{marginBottom:18,padding:"10px 12px",borderRadius:10,background:"rgba(91,141,239,.08)",border:"1px solid rgba(91,141,239,.18)",fontSize:12,color:"var(--muted)",lineHeight:1.5}},
        React.createElement('strong',{style:{color:"#dbe8ff"}},"Local dev code: "),
        React.createElement('span',{className:"mono",style:{color:"#dbe8ff"}},devCode)
      )
    ),
    step==="name" && React.createElement('label',{style:{display:"block",marginBottom:18}},
      React.createElement('span',{className:"lbl"},"Display name"),
      React.createElement('input',{value:displayName,onChange:e=>setDisplayName(e.target.value),placeholder:"Your name",style:{width:"100%",background:"var(--s2)",border:"1px solid var(--border)",borderRadius:10,padding:"12px 13px",color:"var(--text)",fontSize:15,outline:"none"}})
    ),
    error && React.createElement('div',{style:{fontSize:12,color:"var(--red)",marginBottom:16,whiteSpace:"pre-wrap"}},error),
    React.createElement('div',{style:{display:"flex",gap:9}},
      step!=="existing" && step!=="alreadyMember" && React.createElement('button',{onClick:onClose,style:{flex:1,background:"var(--s2)",border:"1px solid var(--border)",color:"var(--muted)",padding:"14px",borderRadius:10,fontFamily:"'Outfit', sans-serif",fontSize:15,fontWeight:700}},"Cancel"),
      step==="email" && React.createElement('button',{disabled:!email.trim()||sending,onClick:onSendOtp,style:{flex:1,background:email.trim()&&!sending?"var(--green)":"var(--s3)",color:email.trim()&&!sending?"#000":"var(--muted2)",padding:"14px",borderRadius:10,fontSize:15,fontWeight:800}},sending?"Sending...":"Send code"),
      step==="otp" && React.createElement('button',{disabled:code.length!==6||verifying,onClick:onVerifyOtp,style:{flex:1,background:code.length===6&&!verifying?"var(--green)":"var(--s3)",color:code.length===6&&!verifying?"#000":"var(--muted2)",padding:"14px",borderRadius:10,fontSize:15,fontWeight:800}},verifying?"Checking...":"Verify"),
      step==="name" && React.createElement('button',{disabled:!displayName.trim()||savingProfile,onClick:onSaveProfile,style:{flex:1,background:displayName.trim()&&!savingProfile?"var(--green)":"var(--s3)",color:displayName.trim()&&!savingProfile?"#000":"var(--muted2)",padding:"14px",borderRadius:10,fontSize:15,fontWeight:800}},savingProfile?"Saving...":"Continue"),
      step==="existing" && React.createElement('button',{onClick:onUseDifferentEmail,style:{flex:1,background:"var(--s2)",border:"1px solid var(--border)",color:"var(--muted)",padding:"14px",borderRadius:10,fontFamily:"'Outfit', sans-serif",fontSize:15,fontWeight:700}},"Use different email"),
      step==="existing" && React.createElement('button',{disabled:sending,onClick:onConfirmExistingAccount,style:{flex:1,background:!sending?"var(--green)":"var(--s3)",color:!sending?"#000":"var(--muted2)",padding:"14px",borderRadius:10,fontSize:15,fontWeight:800}},sending?"Sending...":"Sign in"),
      step==="alreadyMember" && React.createElement('button',{onClick:onUseDifferentEmail,style:{flex:1,background:"var(--s2)",border:"1px solid var(--border)",color:"var(--muted)",padding:"14px",borderRadius:10,fontFamily:"'Outfit', sans-serif",fontSize:15,fontWeight:700}},"Use different email"),
      step==="alreadyMember" && React.createElement('button',{disabled:sending,onClick:onConfirmExistingAccount,style:{flex:1,background:!sending?"var(--green)":"var(--s3)",color:!sending?"#000":"var(--muted2)",padding:"14px",borderRadius:10,fontSize:15,fontWeight:800}},sending?"Sending...":"Enter the Bloc")
    )
  )
));

const DisplayNameSetupScreen = ({displayName,setDisplayName,onSave,saving,error}) => {
  const fileInputRef = useRef(null);
  const [profilePhotoDataUrl,setProfilePhotoDataUrl] = useState("");
  const [photoError,setPhotoError] = useState("");
  const [photoBusy,setPhotoBusy] = useState(false);
  const handlePhotoFile = async event => {
    const file = event.target?.files?.[0];
    if (event.target) event.target.value = "";
    if (!file || photoBusy) return;
    try {
      setPhotoBusy(true);
      setPhotoError("");
      setProfilePhotoDataUrl(await readOnboardingProfilePhoto(file));
    } catch (photoLoadError) {
      setPhotoError(photoLoadError instanceof Error ? photoLoadError.message : "Unable to load photo");
    } finally {
      setPhotoBusy(false);
    }
  };
  return React.createElement('main',{style:{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",padding:"32px 20px",background:"var(--bg-gradient)",backgroundImage:"var(--bg-radial-hint), var(--bg-gradient)",color:"var(--text)"}},
    React.createElement('section',{className:"fu",style:{width:"100%",maxWidth:420,display:"grid",gap:20,textAlign:"center",justifyItems:"center",transform:"translateY(-18px)"}},
      React.createElement(AnteWordmark,{size:76}),
      React.createElement('div',{style:{display:"grid",gap:8,justifyItems:"center"}},
        React.createElement('h1',{style:{margin:0,fontFamily:"'Raleway', sans-serif",fontSize:34,fontWeight:900,lineHeight:1.02,letterSpacing:0}},"What should your Bloc call you?")
      ),
      React.createElement('div',{style:{width:"100%",display:"grid",gap:12,padding:14,borderRadius:18,background:"rgba(8,15,15,.84)",border:"0.5px solid rgba(78,205,196,.18)",boxShadow:"0 18px 46px rgba(0,0,0,.28), inset 0 1px 0 rgba(255,255,255,.035)"}},
        React.createElement('input',{ref:fileInputRef,type:"file",accept:"image/*",onChange:handlePhotoFile,style:{display:"none"}}),
        React.createElement('button',{type:"button",disabled:photoBusy||saving,onClick:()=>fileInputRef.current?.click(),className:"setup-press",style:{justifySelf:"center",display:"grid",justifyItems:"center",gap:7,background:"transparent",border:"none",padding:0,color:"var(--muted)",fontFamily:"'Outfit', sans-serif",fontSize:11,fontWeight:800,letterSpacing:0}},
          React.createElement('span',{style:{position:"relative",display:"inline-flex",width:76,height:76,borderRadius:"50%",alignItems:"center",justifyContent:"center",background:"rgba(18,27,34,.98)",border:"0.5px solid rgba(78,205,196,.34)",boxShadow:"0 0 30px rgba(78,205,196,.11), inset 0 1px 0 rgba(255,255,255,.06)",overflow:"hidden"}},
            profilePhotoDataUrl
              ? React.createElement('img',{src:profilePhotoDataUrl,alt:"Profile preview",style:{width:"100%",height:"100%",objectFit:"cover",display:"block"}})
              : React.createElement(UploadPhotoIcon,{size:30,color:"#4ECDC4"}),
            profilePhotoDataUrl && React.createElement('span',{style:{position:"absolute",right:0,bottom:0,width:26,height:26,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",background:"#4ECDC4",border:"2px solid #071111",boxShadow:"0 8px 18px rgba(0,0,0,.3)"}},
              React.createElement(UploadPhotoIcon,{size:14,color:"#050909"})
            )
          ),
          React.createElement('span',null,photoBusy ? "Loading Photo..." : (profilePhotoDataUrl ? "Change Photo" : "Add Photo"))
        ),
        photoError && React.createElement('div',{style:{fontFamily:"'Outfit', sans-serif",fontSize:11,fontWeight:700,color:"var(--red)",lineHeight:1.35,textAlign:"center",whiteSpace:"pre-wrap"}},photoError),
        React.createElement('input',{value:displayName,onChange:event=>setDisplayName(event.target.value),placeholder:"Display name",autoFocus:true,style:{width:"100%",boxSizing:"border-box",height:52,borderRadius:14,background:"rgba(18,27,34,.98)",border:"0.5px solid rgba(78,205,196,.28)",boxShadow:"inset 0 1px 0 rgba(255,255,255,.06)",color:"var(--text)",fontFamily:"'Outfit', sans-serif",fontSize:16,fontWeight:800,outline:"none",padding:"0 14px"}}),
        error && React.createElement('div',{style:{fontFamily:"'Outfit', sans-serif",fontSize:12,fontWeight:700,color:"var(--red)",lineHeight:1.4,textAlign:"left",whiteSpace:"pre-wrap"}},error),
        React.createElement('button',{type:"button",className:"setup-press",disabled:!displayName.trim()||saving,onClick:()=>onSave?.({profilePhotoDataUrl}),style:{minHeight:50,borderRadius:14,background:displayName.trim()&&!saving?"#4ECDC4":"var(--s3)",color:displayName.trim()&&!saving?"#050909":"var(--muted2)",fontFamily:"'Outfit', sans-serif",fontSize:15,fontWeight:900}},
          saving ? "Saving..." : "Continue"
        )
      )
    )
  );
};


const IdentitySetup = ({members,onSelect}) => (
  React.createElement('div',{style:{minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"32px 18px",background:"var(--bg)",backgroundImage:"radial-gradient(ellipse 60% 38% at 50% 0%,#10103a50,transparent)"}},
    React.createElement('div',{className:"fu",style:{textAlign:"center",marginBottom:34,maxWidth:460}},
      React.createElement('span',{className:"mono",style:{fontSize:10,color:"var(--cyan)",letterSpacing:".2em",textTransform:"uppercase"}},"Local Profile"),
      React.createElement('div',{style:{margin:"14px 0"}},React.createElement(AnteWordmark,{size:58})),
      React.createElement('div',{style:{color:"var(--muted)",fontSize:16,fontWeight:500,lineHeight:1.5}},"Pick your local profile once. After that, Bloc cards will show your status automatically.")
    ),
    React.createElement('div',{className:"fu2",style:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:10,width:"100%",maxWidth:560}},
      members.map((name,i)=>React.createElement('button',{key:name,onClick:()=>onSelect(name),style:{background:"var(--s2)",border:"1px solid var(--border2)",borderRadius:15,padding:"16px",display:"flex",alignItems:"center",gap:12,textAlign:"left",animation:`fadeUp .35s ${i*.04}s ease both`,minHeight:68}},
        React.createElement(Avatar,{name,size:40}),
        React.createElement('span',{style:{fontWeight:700,fontSize:17,color:"var(--text)"}},name)
      ))
    )
  )
);


const CreatedBlocInviteScreen = ({group,onContinue}) => {
  const compactMobile = isMobile();
  if (!group) return null;
  const inviteLink = `${window.location.origin}${window.location.pathname}?invite=${group.inviteCode}`;
  const shareInvite = async event => {
    if (navigator.share) {
      try {
        await navigator.share({
          title:`Join ${group.name} on Fero`,
          text:`Join ${group.name} on Fero with invite code ${group.inviteCode}.`,
          url:inviteLink
        });
        return;
      } catch {}
    }
    copyToClipboard(inviteLink, event.currentTarget);
  };
  return React.createElement('div',{
    style:{
      minHeight:"100vh",
      display:"flex",
      alignItems:"center",
      justifyContent:"center",
      padding:compactMobile?"calc(env(safe-area-inset-top) + 22px) 18px calc(env(safe-area-inset-bottom) + 28px)":"42px 18px",
      background:"var(--bg-gradient)",
      backgroundImage:"var(--bg-radial-hint), var(--bg-gradient)"
    }
  },
    React.createElement('div',{className:"fu",style:{width:"100%",maxWidth:420,textAlign:"center"}},
      React.createElement('div',{style:{width:70,height:70,borderRadius:999,margin:"0 auto 18px",display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(78,205,196,.12)",border:"1px solid rgba(78,205,196,.3)",boxShadow:"0 0 34px rgba(78,205,196,.14)"}},
        React.createElement(AppIcon,{name:"sparkles",size:36,stroke:"#4ECDC4"})
      ),
      React.createElement('h1',{style:{margin:"0 0 8px",fontFamily:"'Raleway', sans-serif",fontWeight:800,fontSize:compactMobile?28:34,lineHeight:1.08,letterSpacing:0}},`${group.name} is live`),
      React.createElement('div',{style:{fontFamily:"'Outfit', sans-serif",fontSize:14,lineHeight:1.55,color:"var(--muted)",maxWidth:340,margin:"0 auto 24px"}},"Get people in now. You can adjust categories and rules once you're inside."),
      React.createElement('div',{style:{padding:"15px 16px",borderRadius:16,background:"rgba(8,15,15,.86)",border:"0.5px solid #163d36",marginBottom:12}},
        React.createElement('div',{style:{fontFamily:"'Outfit', sans-serif",fontSize:13,fontWeight:800,color:"var(--text)",marginBottom:8,textAlign:"center"}},"Invite code"),
        React.createElement('div',{style:{fontFamily:"'Outfit', sans-serif",fontSize:26,fontWeight:900,letterSpacing:".08em",color:"#f5f7ff",marginBottom:12}},group.inviteCode),
        React.createElement('button',{type:"button",className:"setup-press",onClick:event=>copyToClipboard(group.inviteCode,event.currentTarget),style:{width:"100%",minHeight:42,borderRadius:12,background:"#0D1F1E",border:"0.5px solid #163d36",color:"#4ECDC4",fontFamily:"'Outfit', sans-serif",fontSize:13,fontWeight:800}},"Copy code")
      ),
      React.createElement('button',{type:"button",className:"setup-press",onClick:shareInvite,style:{width:"100%",minHeight:48,borderRadius:14,background:"#4ECDC4",color:"#050909",fontFamily:"'Outfit', sans-serif",fontSize:15,fontWeight:900,marginTop:8}},"Share invite link"),
      React.createElement('button',{type:"button",className:"setup-press",onClick:onContinue,style:{background:"transparent",border:"none",padding:"16px 8px 0",color:"var(--muted)",fontFamily:"'Outfit', sans-serif",fontSize:13,fontWeight:700,textDecoration:"underline",textUnderlineOffset:"3px"}},"Continue to Bloc")
    )
  );
};


const GroupHome = ({groups,currentIdentity,currentEmail,currentUserId="",onOpenProfile,onOpenGroup,onCreateGroup,onJoinGroup,creating,autoOpenCreate=false,initialCreateGroupName="",onAutoOpenHandled,onCreateCancel,suppressIntro=false}) => {
  const [showCreate,setShowCreate]=useState(false);
  const [createInitialGroupName,setCreateInitialGroupName]=useState("");
  const compactMobile = isMobile();
  useEffect(() => {
    if (autoOpenCreate) {
      setCreateInitialGroupName(initialCreateGroupName || "");
      setShowCreate(true);
      onAutoOpenHandled && onAutoOpenHandled();
    }
  }, [autoOpenCreate, initialCreateGroupName, onAutoOpenHandled]);
  const renderCloseMeta = group => {
    const closeMeta = getGroupCloseMeta(group);
    if (!closeMeta.isCountdown) return null;
    return React.createElement('span',{className:"mono",style:{display:"inline-flex",alignItems:"center",color:"#1E4040",fontSize:10,letterSpacing:".04em"}},closeMeta.label);
  };
  const statusColor = status => status==="cruising" ? "#CBD5E1" : status==="on-track" ? "#5ABF5A" : status==="at-risk" ? "#D4A843" : status==="behind" ? "#E07A3F" : status==="cooked" ? "#D44A4A" : "#CBD5E1";
  const statusLabel = status => status === "starting-soon" ? "Month started" : status === "locked-in" ? "CLEARED" : String(status || "").replace("-", " ").toUpperCase();
  const statusTextStyle = status => {
    const base = {marginTop:3,fontSize:12,fontWeight:800,lineHeight:1.1,whiteSpace:"nowrap"};
    if (status !== "locked-in") return {...base,color:statusColor(status)};
    return {
      ...base,
      color:"transparent",
      background:"linear-gradient(90deg,#E2E8F0 0%,#4ECDC4 40%,#F5A623 78%,#E2E8F0 100%)",
      WebkitBackgroundClip:"text",
      backgroundClip:"text",
      textShadow:"0 0 18px rgba(78,205,196,.18)"
    };
  };
  return React.createElement(React.Fragment,null,
    React.createElement('div',{style:{minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"flex-start",padding:compactMobile?"calc(env(safe-area-inset-top) + 16px) 16px 28px":"32px 18px",background:"transparent"}},
      React.createElement('div',{style:{width:"100%",maxWidth:744,display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,marginBottom:compactMobile?10:12}},
        React.createElement('div',null),
        React.createElement('button',{type:"button",onClick:onOpenProfile,title:currentEmail||"Account",style:{width:46,height:46,display:"inline-flex",alignItems:"center",justifyContent:"center",borderRadius:999,background:"transparent",border:"none",fontSize:14,lineHeight:1,flexShrink:0,padding:0,overflow:"visible",cursor:"pointer",touchAction:"manipulation",position:"relative",zIndex:2}},React.createElement(Avatar,{name:currentIdentity||currentEmail||"?",size:30,userId:currentUserId}))
      ),
      groups.length===0
        ? React.createElement('div',{className:"fu",style:{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",textAlign:"center",paddingTop:compactMobile?60:100,paddingBottom:40,animation:suppressIntro?"none":undefined}},
            React.createElement(AnteWordmark,{size:compactMobile?52:68}),
            React.createElement('div',{style:{color:"var(--muted)",fontSize:15,fontWeight:700,marginTop:14,marginBottom:34}},"You're not in any Blocs yet."),
            React.createElement('div',{style:{display:"flex",gap:10,flexWrap:"wrap",justifyContent:"center"}},
              React.createElement('button',{onClick:()=>{setCreateInitialGroupName("");setShowCreate(true);},style:{background:"var(--green)",color:"#000",padding:compactMobile?"14px 22px":"14px 24px",borderRadius:12,fontSize:15,fontWeight:900}},"Create Bloc"),
              React.createElement('button',{onClick:onJoinGroup,style:{background:"var(--green)",color:"#000",padding:compactMobile?"14px 22px":"14px 24px",borderRadius:12,fontSize:15,fontWeight:900}},"Join Existing")
            )
          )
        : React.createElement(React.Fragment,null,
      React.createElement('div',{className:"fu",style:{width:"100%",display:"grid",justifyItems:"center",textAlign:"center",marginTop:compactMobile?-30:-22,marginBottom:compactMobile?18:34,maxWidth:560,animation:suppressIntro?"none":undefined}},
        React.createElement('div',{style:{margin:compactMobile?"2px 0 8px":"8px 0 12px"}},React.createElement(AnteWordmark,{size:compactMobile?38:58})),
        React.createElement('span',{style:{fontFamily:"'Outfit',sans-serif",fontSize:10,fontWeight:800,color:"var(--cyan)",letterSpacing:".12em",textTransform:"uppercase"}},"Your Blocs")
      ),
      React.createElement('div',{style:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(228px,1fr))",gap:compactMobile?10:15,width:"100%",maxWidth:744,marginBottom:compactMobile?18:22}},
        groups.map((group,index)=>{
          const preview = getGroupMemberPreview(group, currentIdentity);
          const acceptedTypes = getAcceptedWorkoutTypes(group);
          return React.createElement('button',{key:group.id,onClick:()=>onOpenGroup(group.id),onMouseEnter:e=>{e.currentTarget.style.border="1px solid rgba(78,205,196,.2)";e.currentTarget.style.boxShadow="inset 0 1px 0 rgba(255,255,255,.08), inset 0 -1px 0 rgba(78,205,196,.06), 0 20px 42px rgba(0,0,0,.3), 0 4px 14px rgba(78,205,196,.08)";e.currentTarget.style.transform="translateY(-1px)"},onMouseLeave:e=>{e.currentTarget.style.border=compactMobile?"1px solid rgba(22,44,44,.94)":"0.5px solid rgba(18,42,42,.9)";e.currentTarget.style.boxShadow=compactMobile?"inset 0 1px 0 rgba(255,255,255,.07), inset 0 -1px 0 rgba(78,205,196,.05), 0 16px 34px rgba(0,0,0,.2), 0 2px 10px rgba(78,205,196,.05)":"inset 0 1px 0 rgba(255,255,255,.065), inset 0 -1px 0 rgba(78,205,196,.045), 0 8px 20px rgba(0,0,0,.2), 0 2px 9px rgba(78,205,196,.04)";e.currentTarget.style.transform="translateY(0)"},onMouseDown:e=>{e.currentTarget.style.transform="translateY(2px)";e.currentTarget.style.boxShadow=compactMobile?"inset 0 1px 0 rgba(255,255,255,.045), 0 8px 18px rgba(0,0,0,.18), 0 1px 5px rgba(78,205,196,.03)":"inset 0 1px 0 rgba(255,255,255,.04), 0 2px 10px rgba(0,0,0,.18), 0 1px 4px rgba(78,205,196,.025)"},onMouseUp:e=>{e.currentTarget.style.transform="translateY(-1px)";e.currentTarget.style.boxShadow="inset 0 1px 0 rgba(255,255,255,.08), inset 0 -1px 0 rgba(78,205,196,.06), 0 20px 42px rgba(0,0,0,.3), 0 4px 14px rgba(78,205,196,.08)"},onTouchStart:e=>{e.currentTarget.style.transform="translateY(2px)";e.currentTarget.style.boxShadow=compactMobile?"inset 0 1px 0 rgba(255,255,255,.045), 0 8px 18px rgba(0,0,0,.18), 0 1px 5px rgba(78,205,196,.03)":"inset 0 1px 0 rgba(255,255,255,.04), 0 2px 10px rgba(0,0,0,.18), 0 1px 4px rgba(78,205,196,.025)"},onTouchEnd:e=>{e.currentTarget.style.transform="translateY(0)";e.currentTarget.style.boxShadow=compactMobile?"inset 0 1px 0 rgba(255,255,255,.07), inset 0 -1px 0 rgba(78,205,196,.05), 0 16px 34px rgba(0,0,0,.2), 0 2px 10px rgba(78,205,196,.05)":"inset 0 1px 0 rgba(255,255,255,.065), inset 0 -1px 0 rgba(78,205,196,.045), 0 8px 20px rgba(0,0,0,.2), 0 2px 9px rgba(78,205,196,.04)"},style:{position:"relative",overflow:"hidden",background:"radial-gradient(circle at 86% 0%, rgba(78,205,196,.11), transparent 36%), radial-gradient(circle at 14% 0%, rgba(255,255,255,.045), transparent 32%), linear-gradient(180deg,rgba(13,22,22,.99),rgba(7,12,12,.99))",border:compactMobile?"1px solid rgba(22,44,44,.94)":"0.5px solid rgba(18,42,42,.9)",boxShadow:compactMobile?"inset 0 1px 0 rgba(255,255,255,.07), inset 0 -1px 0 rgba(78,205,196,.05), 0 16px 34px rgba(0,0,0,.2), 0 2px 10px rgba(78,205,196,.05)":"inset 0 1px 0 rgba(255,255,255,.065), inset 0 -1px 0 rgba(78,205,196,.045), 0 8px 20px rgba(0,0,0,.2), 0 2px 9px rgba(78,205,196,.04)",borderRadius:compactMobile?15:18,padding:compactMobile?"12px 10px 12px 14px":"15px 16px 15px 18px",textAlign:"left",cursor:"pointer",transition:"border .15s, box-shadow .15s, transform .15s",animation:suppressIntro?"none":`fadeUp .35s ${index*.04}s ease both`}},
            React.createElement('div',{style:{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:8,marginBottom:compactMobile?6:10}},
              React.createElement('div',{style:{display:"inline-flex",alignItems:"center",gap:5,minWidth:0}},
                React.createElement('div',{style:{fontSize:compactMobile?17:21,fontWeight:900,color:"#f5f7ff",letterSpacing:"-.03em",lineHeight:1.15,minWidth:0}},group.name)
              ),
              React.createElement('div',{style:{display:"flex",flexDirection:"column",alignItems:"flex-end",flexShrink:0,gap:2}},
                React.createElement('span',{style:{fontFamily:"'Outfit',sans-serif",fontSize:compactMobile?11:12,fontWeight:700,letterSpacing:0}},
                  React.createElement('span',{style:{color:"#4ECDC4",fontWeight:800}},group.settings.minTarget),
                  React.createElement('span',{style:{color:"var(--muted)",fontWeight:700}}, " / month")
                )
              )
            ),
            React.createElement('div',{style:{marginBottom:6}},
              React.createElement('div',{style:{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,marginBottom:4}},
                React.createElement('span',{style:{fontSize:10,fontWeight:600,color:"#4ECDC4",letterSpacing:".08em",textTransform:"uppercase",fontFamily:"'Outfit',sans-serif"}},"Workout types"),
                React.createElement('span',{style:{fontSize:compactMobile?10:11,color:"var(--muted)"}},
                  `${getCurrentGroupMemberNames(group).length}/20 member${getCurrentGroupMemberNames(group).length===1?"":"s"}`
                )
              ),
              React.createElement('div',{style:{display:"flex",gap:5,flexWrap:"wrap",marginBottom:renderCloseMeta(group)?4:0}},
                acceptedTypes.map(type=>React.createElement('span',{key:type,style:{width:28,height:28,borderRadius:999,display:"inline-flex",alignItems:"center",justifyContent:"center",background:"#0A1818",border:"0.5px solid #173131",color:"#4ECDC4"}},React.createElement(WorkoutTypeIcon,{type,size:17})))
              ),
              renderCloseMeta(group)
            ),
            React.createElement('div',{style:{paddingTop:6,borderTop:"1px solid rgba(18,36,36,.92)"}},
              preview
                ? React.createElement('div',{style:{display:"grid",gridTemplateColumns:"repeat(3,minmax(0,1fr))",gap:compactMobile?5:8,alignItems:"end"}},
                    React.createElement('div',null,
                      React.createElement('div',{style:{fontSize:9,fontWeight:600,color:"var(--muted)",letterSpacing:".08em",textTransform:"uppercase",fontFamily:"'Outfit',sans-serif"}},"Status"),
                      React.createElement('div',{style:statusTextStyle(preview.status)},statusLabel(preview.status))
                    ),
                    React.createElement('div',null,
                      React.createElement('div',{style:{fontSize:compactMobile?14:20,fontWeight:800,color:"#f5f7ff",marginBottom:1}},preview.count),
                      React.createElement('div',{style:{fontSize:compactMobile?10:12,color:"var(--muted)"}},"Logged")
                    ),
                    React.createElement('div',null,
                      React.createElement('div',{style:{fontSize:compactMobile?14:20,fontWeight:800,color:"#4ECDC4",marginBottom:1}},preview.needed),
                      React.createElement('div',{style:{fontSize:compactMobile?10:12,color:"var(--muted)"}},"Left")
                    )
                  )
                : React.createElement('div',{style:{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10}},
                    React.createElement('div',{style:{fontSize:compactMobile?12:13,color:"var(--muted)",lineHeight:1.45,maxWidth:220}},`Your profile is not in ${group.name} yet.`),
                    React.createElement('div',{className:"mono",style:{fontSize:10,color:"var(--amber)",letterSpacing:".08em",textTransform:"uppercase"}},"Invite needed")
                  )
            )
          );
        })
      ),
      React.createElement('div',{style:{width:"100%",maxWidth:744,height:1,margin:compactMobile?"2px 0 14px":"6px 0 18px",background:"linear-gradient(90deg,transparent,rgba(78,205,196,.28),rgba(255,255,255,.08),rgba(78,205,196,.28),transparent)"}}),
      React.createElement('div',{style:{display:"flex",gap:10,justifyContent:"center",flexWrap:"wrap",width:"100%",maxWidth:744,marginTop:0,marginBottom:compactMobile?28:34}},
        React.createElement('button',{onClick:()=>{setCreateInitialGroupName("");setShowCreate(true);},style:{background:"var(--green)",color:"#000",padding:compactMobile?"10px 16px":"11px 18px",borderRadius:10,fontSize:13,fontWeight:800}},"Create Bloc"),
        React.createElement('button',{onClick:onJoinGroup,style:{background:"var(--green)",color:"#000",padding:compactMobile?"10px 16px":"11px 18px",borderRadius:10,fontSize:13,fontWeight:800}},"Join Existing")
      )
    )/* end non-empty Fragment */),
    showCreate && React.createElement(GroupCreateModal,{
      creating,
      initialGroupName: createInitialGroupName,
      defaultCreatorName: currentIdentity || "",
      defaultTimeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULT_GROUP_TIME_ZONE,
      lockCreatorName: true,
      onClose:()=>{setShowCreate(false); onCreateCancel && onCreateCancel();},
      onCreate:async payload=>{
        const result = await onCreateGroup(payload);
        if (result?.ok) setShowCreate(false);
      }
    })
  );
};


const WhoAreYou = ({groupName,members,onSelect,onBack}) => (
  React.createElement('div',{style:{minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"32px 18px",background:"var(--bg)",backgroundImage:"radial-gradient(ellipse 60% 38% at 50% 0%,#10103a50,transparent)"}},
    React.createElement('div',{className:"fu",style:{textAlign:"center",marginBottom:40}},
      React.createElement('div',{style:{display:"flex",flexDirection:"column",alignItems:"center",gap:16,marginBottom:18}},
        React.createElement('button',{onClick:onBack,style:{background:"transparent",color:"var(--muted)",fontSize:12,padding:0,textDecoration:"underline"}},"← Back to Blocs"),
        React.createElement('span',{className:"mono",style:{fontSize:10,color:"var(--blue)",letterSpacing:".2em",textTransform:"uppercase"}},`${groupName} · ${members.length} members`)
      ),
      React.createElement('div',{style:{margin:"14px 0"}},React.createElement(AnteWordmark,{size:58})),
      React.createElement('div',{style:{color:"var(--muted)",fontSize:16,fontWeight:500}},"Choose your member profile")
    ),
    React.createElement('div',{className:"fu2",style:{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:10,width:"100%",maxWidth:400}},
      members.map((name,i)=>React.createElement('button',{key:name,onClick:()=>onSelect(name),
        style:{background:"var(--s2)",border:"1px solid var(--border2)",borderRadius:13,padding:"16px",display:"flex",alignItems:"center",gap:12,textAlign:"left",animation:`fadeUp .35s ${i*.04}s ease both`,minHeight:64},
        onMouseEnter:e=>{e.currentTarget.style.borderColor=avatarColor(name);e.currentTarget.style.background="var(--s3)"},
        onMouseLeave:e=>{e.currentTarget.style.borderColor="var(--border2)";e.currentTarget.style.background="var(--s2)"}},
        React.createElement(Avatar,{name,size:38}),
        React.createElement('span',{style:{fontWeight:700,fontSize:16,color:"var(--text)"}},name)
      ))
    )
  )
);


const GroupAccessNotice = ({groupName,userName,onBack}) => (
  React.createElement('div',{style:{minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"32px 18px",background:"var(--bg)",backgroundImage:"radial-gradient(ellipse 60% 38% at 50% 0%,#10103a50,transparent)"}},
    React.createElement('div',{className:"fu",style:{width:"100%",maxWidth:420,textAlign:"center"}},
      React.createElement('button',{onClick:onBack,style:{background:"transparent",color:"var(--muted)",fontSize:12,padding:0,textDecoration:"underline",marginBottom:28}},"← Back to Blocs"),
      React.createElement('div',{style:{fontFamily:"'Raleway', sans-serif",fontSize:52,fontWeight:800,lineHeight:.9,letterSpacing:"-.05em",marginBottom:18}},"NOT IN",React.createElement('br'),React.createElement('span',{style:{color:"var(--cyan)"}},"BLOC")),
      React.createElement('div',{style:{fontSize:22,fontWeight:800,color:"#f5f7ff",marginBottom:10}},groupName),
      React.createElement('div',{style:{color:"var(--muted)",fontSize:15,lineHeight:1.6}},`${userName} is not a member of this Bloc in the current local setup. Later this will be handled by real invites and account membership.`)
    )
  )
);


const LocalDevImpersonationBar = ({options,value,onChange}) => {
  if (!Array.isArray(options) || !options.length) return null;
  return React.createElement('div',{
    style:{
      margin:"10px 16px 0",
      padding:"10px 12px",
      borderRadius:14,
      background:"#0A1412",
      border:"0.5px solid #163d36",
      display:"flex",
      alignItems:"center",
      gap:10,
      flexWrap:"wrap"
    }
  },
    React.createElement('span',{className:"mono",style:{fontSize:10,color:"#6B9690",letterSpacing:".14em",textTransform:"uppercase"}},"Local Test Identity"),
    React.createElement('select',{
      value:value || "",
      onChange:event=>onChange(event.target.value || ""),
      style:{
        flex:"1 1 180px",
        minWidth:0,
        background:"#080F0F",
        color:"var(--text)",
        border:"0.5px solid #163d36",
        borderRadius:10,
        padding:"8px 10px",
        fontSize:13,
        fontWeight:600
      }
    },
      options.map(option => React.createElement('option',{key:option.userId,value:option.userId},option.label))
    )
  );
};

// ─── LOG MODAL ────────────────────────────────────────────────────────────────

export { previewStatus, PreviewLanding, InvalidInviteScreen, SignedOutLanding, ProfileModal, JoinGroupModal, AuthFlowModal, DisplayNameSetupScreen, IdentitySetup, CreatedBlocInviteScreen, GroupHome, WhoAreYou, GroupAccessNotice, LocalDevImpersonationBar };
