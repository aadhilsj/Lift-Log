import React from "react";
const { useState, useEffect, useMemo, useCallback, useRef } = React;
import {
  DEFAULT_GROUP_TIME_ZONE,
  avatarColor,
  getCurrentGroupMemberNames
} from "../lib/appState.js";
import {
  getAcceptedWorkoutTypes,
  getGroupCloseMeta,
  getGroupMemberPreview,
  isMobile,
  copyToClipboard
} from "../lib/utils.js";
import { Avatar, WorkoutTypeIcon, AppIcon, AnteWordmark, PrimaryActionButton } from "../components/primitives.jsx";
import { GroupCreateModal } from "../modals/modals.jsx";

const previewStatus = (logged, target) => {
  const safeTarget = Math.max(1, Number(target) || 1);
  const pct = Number(logged || 0) / safeTarget;
  if (pct >= 1) return { label:"CLEARED", bg:"linear-gradient(90deg, rgba(203,213,225,.08) 0%, rgba(203,213,225,.35) 100%)", fg:"#E2E8F0", border:"#2a2d31" };
  if (pct >= 0.65) return { label:"ON TRACK", bg:"rgba(90,191,90,.14)", fg:"#5ABF5A", border:"rgba(90,191,90,.35)" };
  if (pct >= 0.35) return { label:"AT RISK", bg:"#1E1808", fg:"#D4A843", border:"#3D3010" };
  return { label:"COOKED", bg:"rgba(212,74,74,.14)", fg:"#D44A4A", border:"#3B1818" };
};

const PreviewLanding = ({inviteContext,onJoin}) => {
  const target = Number(inviteContext?.minTarget || inviteContext?.target || 12);
  const memberCount = Number(inviteContext?.memberCount || 0);
  const memberLimit = Number(inviteContext?.memberLimit || 20);
  const isFull = memberCount >= memberLimit;
  const leaderboardRows = (Array.isArray(inviteContext?.leaderboardRows) ? inviteContext.leaderboardRows : [])
    .slice()
    .sort((a,b)=>Number(b.logged||0)-Number(a.logged||0))
    .slice(0,3);
  const previewRows = leaderboardRows.map((m,i) => {
    const logged = Number(m.logged || 0);
    const rowTarget = Number(m.target || target);
    const st = previewStatus(logged, rowTarget);
    return React.createElement('div',{
      key:m.userId || m.name || i,
      style:{
        minHeight:50,
        padding:"10px 14px",
        borderBottom:i<leaderboardRows.length-1?"0.5px solid rgba(22,61,54,.58)":"none",
        display:"grid",
        gridTemplateColumns:"24px 34px minmax(0,1fr) auto 30px",
        alignItems:"center",
        gap:9
      }
    },
      React.createElement('div',{style:{fontFamily:"'Outfit',sans-serif",fontWeight:900,fontSize:12,color:"var(--muted)",textAlign:"center",flexShrink:0}},`#${i+1}`),
      React.createElement('div',{style:{width:34,height:34,borderRadius:"50%",background:avatarColor(m.name || "Fero"),display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Outfit',sans-serif",fontWeight:900,fontSize:12,color:"#fff",flexShrink:0,overflow:"hidden",boxShadow:"inset 0 1px 0 rgba(255,255,255,.12), 0 4px 12px rgba(0,0,0,.18)"}},m.avatarUrl
        ? React.createElement('img',{src:m.avatarUrl,alt:"",loading:"lazy",referrerPolicy:"no-referrer",style:{width:"100%",height:"100%",objectFit:"cover",display:"block"}})
        : String(m.name || "?").trim().slice(0,1).toUpperCase()
      ),
      React.createElement('span',{style:{minWidth:0,fontFamily:"'Raleway',sans-serif",fontWeight:900,fontSize:16,lineHeight:1.05,color:"#f5f7ff",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",paddingBottom:2}},m.name || "Member"),
      React.createElement('span',{style:{display:"inline-flex",alignItems:"center",justifyContent:"center",minWidth:70,padding:"3px 8px",borderRadius:999,background:st.bg,border:`0.5px solid ${st.border}`,color:st.fg,fontFamily:"'Outfit',sans-serif",fontSize:9,fontWeight:900,letterSpacing:".06em",textTransform:"uppercase",whiteSpace:"nowrap"}},st.label),
      React.createElement('span',{style:{fontFamily:"'Outfit',sans-serif",fontSize:16,fontWeight:900,color:"#4ECDC4",textAlign:"right"}},logged)
    );
  });

  const hero = React.createElement('div',{
    key:"preview-hero",
    className:"fu",
    style:{textAlign:"center",maxWidth:620,marginBottom:18}
  },
    React.createElement('div',{style:{margin:"0 0 14px"}},React.createElement(AnteWordmark,{size:68})),
    React.createElement('div',{style:{fontFamily:"'Outfit',sans-serif",fontSize:15,fontWeight:700,color:"#f5f7ff",lineHeight:1.35,margin:"0 auto",maxWidth:360}},
      "Welcome to the ",
      React.createElement('span',{style:{color:"#4ECDC4"}},"Bloc"),
      " that keeps you showing up."
    )
  );

  const previewHeader = React.createElement('div',{
    key:"preview-header",
    style:{padding:"14px 16px 12px",borderBottom:"0.5px solid rgba(22,61,54,.72)",display:"grid",gap:5}
  },
    React.createElement('div',{style:{fontFamily:"'Raleway',sans-serif",fontWeight:900,fontSize:18,lineHeight:1.05,letterSpacing:0,color:"#f5f7ff",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",paddingBottom:2}},inviteContext?.groupName || "This Bloc"),
    React.createElement('div',{style:{fontFamily:"'Outfit',sans-serif",fontSize:10,color:"var(--muted)",textTransform:"uppercase",letterSpacing:".12em",fontWeight:800}},`${target} workouts · ${memberCount}/${memberLimit} members`)
  );

  const previewCard = React.createElement('div',{
    key:"preview-card",
    className:"fu2",
    style:{width:"100%",maxWidth:420,marginBottom:20,background:"radial-gradient(circle at 78% 0%, rgba(78,205,196,.08), transparent 34%), rgba(6,16,14,.96)",border:"0.5px solid rgba(22,61,54,.9)",borderRadius:18,overflow:"hidden",boxShadow:"inset 0 1px 0 rgba(255,255,255,.06), 0 18px 46px rgba(0,0,0,.32), 0 0 0 1px rgba(78,205,196,.025)"}
  }, [previewHeader].concat(previewRows.length
    ? previewRows
    : React.createElement('div',{key:"empty-preview",style:{padding:"18px 16px",fontFamily:"'Outfit',sans-serif",fontSize:13,fontWeight:700,color:"var(--muted)",textAlign:"center"}},"The leaderboard is ready.")
  ));

  const actions = React.createElement('div',{
    key:"preview-actions",
    className:"fu4",
    style:{width:"100%",maxWidth:420,display:"grid",gap:10,justifyContent:"stretch"}
  },
    isFull
      ? React.createElement('div',{style:{fontFamily:"'Outfit',sans-serif",fontSize:12,fontWeight:800,color:"var(--amber)",padding:"10px 14px",borderRadius:9,background:"var(--amber-bg)",border:"1px solid var(--amber-dim)",textAlign:"center"}},"This Bloc is full. Maximum 20 members allowed.")
      : React.createElement(PrimaryActionButton,{label:"Join this Bloc",onClick:onJoin})
  );

  const children = [hero, previewCard, actions];
  return React.createElement('div',{style:{minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"32px 18px",background:"transparent"}},children);
};

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


const ProfileModal = ({email,onSignOut,onClose,showDisplayName,currentDisplayName,onSaveDisplayName,saving,saveError,onLeaveBloc,onDeleteAccount}) => {
  const [name,setName]=React.useState(currentDisplayName||"");
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


const JoinGroupModal = ({inviteContext,joinCode,setJoinCode,onClose,onJoin,joining,error,signedIn=false}) => {
  const isFull = inviteContext && inviteContext.memberCount >= 20;
  const canJoin = joinCode.trim() && !joining && !isFull;
  const helperCopy = inviteContext
    ? (signedIn
        ? `${inviteContext.groupName} is ready. Confirm the invite code below to join.`
        : `${inviteContext.groupName} is waiting for you. Confirm the invite code below to join.`)
    : "Enter a Bloc invite code. You can always ask the admin to share the link instead.";
  return React.createElement('div',{className:"overlay center-mobile",style:{background:"rgba(5,9,9,0.85)"}},
    React.createElement('div',{className:"modal pi",onClick:e=>e.stopPropagation(),style:{maxWidth:380}},
      React.createElement('div',{style:{fontFamily:"'Raleway', sans-serif",fontWeight:800,fontSize:22,letterSpacing:0,lineHeight:1.08,marginBottom:6}},inviteContext?"Join this Bloc":"Join a Bloc"),
      React.createElement('div',{style:{fontFamily:"'Outfit', sans-serif",color:"var(--muted)",fontSize:13,lineHeight:1.6,marginBottom:16}},helperCopy),
      React.createElement('label',{style:{display:"block",marginBottom:18}},
        React.createElement('span',{style:{display:"block",fontFamily:"'Outfit', sans-serif",fontSize:13,fontWeight:800,color:"var(--text)",marginBottom:5}},"Invite code"),
        React.createElement('input',{value:joinCode,onChange:e=>setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,"").slice(0,8)),placeholder:"XXXXXXX",style:{width:"100%",background:"var(--s2)",border:"1px solid var(--border)",borderRadius:10,padding:"12px 13px",color:"var(--text)",fontFamily:"'Outfit', sans-serif",fontSize:15,outline:"none",textTransform:"uppercase"}})
      ),
      isFull && React.createElement('div',{style:{fontSize:12,color:"var(--amber)",marginBottom:14,padding:"9px 11px",borderRadius:9,background:"var(--amber-bg)",border:"1px solid var(--amber-dim)"}},"This Bloc is full. Maximum 20 members allowed."),
      !isFull && error && React.createElement('div',{style:{fontSize:12,color:"var(--red)",marginBottom:14}},error),
      React.createElement('div',{style:{display:"flex",gap:9}},
        React.createElement('button',{type:"button",className:"setup-press",onClick:onClose,style:{flex:1,background:"transparent",border:"1px solid var(--border)",color:"var(--muted)",padding:"14px",borderRadius:10,fontSize:15,fontWeight:700}},"Cancel"),
        React.createElement('button',{type:"button",className:"setup-press",disabled:!canJoin,onClick:onJoin,style:{flex:1,background:canJoin?"#4ECDC4":"var(--s3)",color:canJoin?"#050909":"var(--muted2)",padding:"14px",borderRadius:10,fontSize:15,fontWeight:900}},joining?"Joining...":"Join Bloc")
      )
    )
  );
};


const AuthFlowModal = ({step,mode="signin",email,setEmail,code,setCode,displayName,setDisplayName,onClose,onSendOtp,onVerifyOtp,onSaveProfile,sending,verifying,savingProfile,error,devCode}) => React.createElement('div',{className:"overlay center-mobile",onClick:()=>{}},
  React.createElement('div',{className:"modal pi",onClick:e=>e.stopPropagation(),style:{maxWidth:420}},
    React.createElement('div',{style:{fontWeight:800,fontSize:20,marginBottom:6}},
      step==="name" ? "Set your Fero name" : mode==="signup" ? "Create your account" : "Continue with email"
    ),
    React.createElement('div',{style:{color:"var(--muted)",fontSize:13,lineHeight:1.6,marginBottom:18}},
      step==="email" ? (mode==="signup" ? "Use a new email. We'll send a one-time code." : "Use a one-time code to sign in.")
      : step==="otp" ? `We sent a 6-digit code to ${email}.`
      : "What should your Blocs call you?"
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
      React.createElement('button',{onClick:onClose,style:{flex:1,background:"var(--s2)",border:"1px solid var(--border)",color:"var(--muted)",padding:"14px",borderRadius:10,fontSize:15,fontWeight:600}},"Cancel"),
      step==="email" && React.createElement('button',{disabled:!email.trim()||sending,onClick:onSendOtp,style:{flex:1,background:email.trim()&&!sending?"var(--green)":"var(--s3)",color:email.trim()&&!sending?"#000":"var(--muted2)",padding:"14px",borderRadius:10,fontSize:15,fontWeight:800}},sending?"Sending...":"Send code"),
      step==="otp" && React.createElement('button',{disabled:code.length!==6||verifying,onClick:onVerifyOtp,style:{flex:1,background:code.length===6&&!verifying?"var(--green)":"var(--s3)",color:code.length===6&&!verifying?"#000":"var(--muted2)",padding:"14px",borderRadius:10,fontSize:15,fontWeight:800}},verifying?"Checking...":"Verify"),
      step==="name" && React.createElement('button',{disabled:!displayName.trim()||savingProfile,onClick:onSaveProfile,style:{flex:1,background:displayName.trim()&&!savingProfile?"var(--green)":"var(--s3)",color:displayName.trim()&&!savingProfile?"#000":"var(--muted2)",padding:"14px",borderRadius:10,fontSize:15,fontWeight:800}},savingProfile?"Saving...":"Continue")
    )
  )
);


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


const GroupHome = ({groups,currentIdentity,currentEmail,currentUserId="",onOpenProfile,onOpenGroup,onCreateGroup,onJoinGroup,creating,autoOpenCreate=false,initialCreateGroupName="",onAutoOpenHandled,suppressIntro=false}) => {
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
            React.createElement(AnteWordmark,{size:compactMobile?38:52}),
            React.createElement('div',{style:{color:"var(--muted)",fontSize:14,fontWeight:500,marginTop:12,marginBottom:32}},"You're not in any Blocs yet."),
            React.createElement('div',{style:{display:"flex",gap:10,flexWrap:"wrap",justifyContent:"center"}},
              React.createElement('button',{onClick:()=>{setCreateInitialGroupName("");setShowCreate(true);},style:{background:"var(--green)",color:"#000",padding:compactMobile?"12px 18px":"12px 20px",borderRadius:10,fontSize:14,fontWeight:800}},"Create Bloc"),
              React.createElement('button',{onClick:onJoinGroup,style:{background:"var(--green)",color:"#000",padding:compactMobile?"12px 18px":"12px 20px",borderRadius:10,fontSize:14,fontWeight:800}},"Join Existing")
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
      onClose:()=>setShowCreate(false),
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

export { previewStatus, PreviewLanding, SignedOutLanding, ProfileModal, JoinGroupModal, AuthFlowModal, IdentitySetup, CreatedBlocInviteScreen, GroupHome, WhoAreYou, GroupAccessNotice, LocalDevImpersonationBar };
