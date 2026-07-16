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
  isMobile
} from "../lib/utils.js";
import { Avatar, WorkoutTypeIcon, AppIcon, AnteWordmark, PrimaryActionButton } from "../components/primitives.jsx";
import { GroupCreateModal } from "../modals/modals.jsx";

const PREVIEW_MEMBERS = [
  { name:"Kai",   logged:11, target:12, color:"#C17F5A" },
  { name:"Jonah", logged:9,  target:12, color:"#7A9CC7" },
  { name:"Priya", logged:7,  target:12, color:"#9B7BB0" },
  { name:"Tariq", logged:5,  target:12, color:"#6BAA8E" },
  { name:"Sofía", logged:2,  target:12, color:"#B07A8A" },
];

const previewStatus = (logged, target) => {
  const pct = logged / target;
  if (pct >= 1)    return { label:"Done",     color:"#5ABF5A" };
  if (pct >= 0.6)  return { label:"On track",  color:"#5ABF5A" };
  if (pct >= 0.35) return { label:"At risk",   color:"var(--amber)" };
  return             { label:"Behind",     color:"var(--red)" };
};


const PreviewLanding = ({inviteContext,onCreate,onJoin,onSignIn}) => {
  const previewRows = PREVIEW_MEMBERS.map((m,i) => {
    const st = previewStatus(m.logged, m.target);
    const pct = Math.min(1, m.logged / m.target);
    return React.createElement('div',{
      key:m.name,
      style:{
        padding:"12px 16px",
        borderBottom:i<PREVIEW_MEMBERS.length-1?"1px solid rgba(62,62,82,.45)":"none",
        display:"flex",
        alignItems:"center",
        gap:12
      }
    },
      React.createElement('div',{style:{fontWeight:700,fontSize:12,color:"var(--muted)",width:16,textAlign:"right",flexShrink:0}},i+1),
      React.createElement('div',{style:{width:32,height:32,borderRadius:"50%",background:m.color,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Outfit',sans-serif",fontWeight:800,fontSize:12,color:"#fff",flexShrink:0}},m.name[0]),
      React.createElement('div',{style:{flex:1,minWidth:0}},
        React.createElement('div',{style:{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:5}},
          React.createElement('span',{style:{fontWeight:700,fontSize:14}},m.name),
          React.createElement('span',{className:"mono",style:{fontSize:10,color:st.color,letterSpacing:".06em",textTransform:"uppercase"}},st.label)
        ),
        React.createElement('div',{style:{height:4,borderRadius:999,background:"rgba(62,62,82,.6)",overflow:"hidden"}},
          React.createElement('div',{style:{height:"100%",width:`${pct*100}%`,borderRadius:999,background:pct>=1?"var(--green)":pct>=0.6?"var(--green)":pct>=0.35?"var(--amber)":"var(--red)",transition:"width .4s ease"}})
        )
      ),
      React.createElement('div',{style:{textAlign:"right",flexShrink:0}},
        React.createElement('div',{style:{fontWeight:800,fontSize:15}},m.logged),
        React.createElement('div',{style:{fontSize:11,color:"var(--muted)"}},"/ "+m.target)
      )
    );
  });

  const hero = React.createElement('div',{
    key:"preview-hero",
    className:"fu",
    style:{textAlign:"center",maxWidth:620,marginBottom:24}
  },
    React.createElement('div',{style:{margin:"0 0 14px"}},React.createElement(AnteWordmark,{size:68})),
    React.createElement('div',{style:{fontSize:15,fontWeight:500,color:"#f5f7ff",marginBottom:8}},
      "For the ",
      React.createElement('span',{style:{color:"#4ECDC4"}},"Bloc"),
      " that keeps you showing up."
    ),
    React.createElement('div',{style:{color:"#2A5555",fontSize:13,lineHeight:1.5,maxWidth:540,margin:"0 auto"}},"See how Antè works")
  );

  const previewHeader = React.createElement('div',{
    key:"preview-header",
    style:{padding:"13px 16px",borderBottom:"1px solid rgba(62,62,82,.7)",display:"flex",alignItems:"center",justifyContent:"space-between"}
  },
    React.createElement('div',null,
      React.createElement('div',{style:{fontWeight:900,fontSize:15,letterSpacing:"-.01em"}},"Sunday Runners Bloc"),
      React.createElement('div',{className:"mono",style:{fontSize:9,color:"var(--muted)",textTransform:"uppercase",letterSpacing:".1em",marginTop:2}},"12 workouts · June")
    ),
  );

  const previewCard = React.createElement('div',{
    key:"preview-card",
    className:"fu2",
    style:{width:"100%",maxWidth:440,marginBottom:20,background:"linear-gradient(180deg,rgba(24,24,31,.98),rgba(17,17,23,.98))",border:"1px solid rgba(62,62,82,.9)",borderRadius:18,overflow:"hidden"}
  }, [previewHeader].concat(previewRows));

  const actions = React.createElement('div',{
    key:"preview-actions",
    className:"fu4",
    style:{display:"flex",gap:10,flexWrap:"wrap",justifyContent:"center"}
  },
    React.createElement(PrimaryActionButton,{label:"Create a Bloc",onClick:onCreate}),
    inviteContext && inviteContext.memberCount>=20
      ? React.createElement('div',{style:{fontSize:12,color:"var(--amber)",padding:"10px 14px",borderRadius:9,background:"var(--amber-bg)",border:"1px solid var(--amber-dim)",textAlign:"center"}},"This Bloc is full. Maximum 20 members allowed.")
      : React.createElement(PrimaryActionButton,{label:inviteContext?"Join this Bloc":"Join a Bloc",onClick:onJoin,secondary:true})
  );

  const signInLink = React.createElement('button',{
    key:"preview-signin",
    type:"button",
    onClick:onSignIn,
    style:{background:"transparent",padding:0,marginTop:10,color:"rgba(78,205,196,.9)",fontSize:13,fontWeight:500,textAlign:"center",textDecoration:"underline",textUnderlineOffset:"2px"}
  },"Already have an account? Sign in");

  const children = [hero, previewCard, actions, signInLink];
  return React.createElement('div',{style:{minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"32px 18px",background:"transparent"}},children);
};


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
      React.createElement('div',{style:{fontWeight:800,fontSize:20,marginBottom:6}},inviteContext?"Join this Bloc":"Join a Bloc"),
      React.createElement('div',{style:{color:"var(--muted)",fontSize:13,lineHeight:1.6,marginBottom:18}},helperCopy),
      React.createElement('label',{style:{display:"block",marginBottom:18}},
        React.createElement('span',{className:"lbl"},"Invite code"),
        React.createElement('input',{value:joinCode,onChange:e=>setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,"").slice(0,8)),placeholder:"OGGROUP",style:{width:"100%",background:"var(--s2)",border:"1px solid var(--border)",borderRadius:10,padding:"12px 13px",color:"var(--text)",fontSize:15,outline:"none",textTransform:"uppercase"}})
      ),
      isFull && React.createElement('div',{style:{fontSize:12,color:"var(--amber)",marginBottom:14,padding:"9px 11px",borderRadius:9,background:"var(--amber-bg)",border:"1px solid var(--amber-dim)"}},"This Bloc is full. Maximum 20 members allowed."),
      !isFull && error && React.createElement('div',{style:{fontSize:12,color:"var(--red)",marginBottom:14}},error),
      React.createElement('div',{style:{display:"flex",gap:9}},
        React.createElement('button',{type:"button",onClick:onClose,style:{flex:1,background:"var(--s2)",border:"1px solid var(--border)",color:"var(--muted)",padding:"14px",borderRadius:10,fontSize:15,fontWeight:600}},"Cancel"),
        React.createElement('button',{type:"button",disabled:!canJoin,onClick:onJoin,style:{flex:1,background:canJoin?"#4ECDC4":"var(--s3)",color:canJoin?"#050909":"var(--muted2)",padding:"14px",borderRadius:10,fontSize:15,fontWeight:800}},joining?"Joining...":"Join Bloc")
      )
    )
  );
};


const AuthFlowModal = ({step,email,setEmail,code,setCode,displayName,setDisplayName,onClose,onSendOtp,onVerifyOtp,onSaveProfile,sending,verifying,savingProfile,error,devCode}) => React.createElement('div',{className:"overlay center-mobile",onClick:()=>{}},
  React.createElement('div',{className:"modal pi",onClick:e=>e.stopPropagation(),style:{maxWidth:420}},
    React.createElement('div',{style:{fontWeight:800,fontSize:20,marginBottom:6}},
      step==="name" ? "Set your Antè name" : "Continue with email"
    ),
    React.createElement('div',{style:{color:"var(--muted)",fontSize:13,lineHeight:1.6,marginBottom:18}},
      step==="email" ? "Use a one-time code to create your account or sign back in."
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
      React.createElement('input',{value:displayName,onChange:e=>setDisplayName(e.target.value),placeholder:(email.split("@")[0]||"Aadhil").replace(/[._-]+/g," "),style:{width:"100%",background:"var(--s2)",border:"1px solid var(--border)",borderRadius:10,padding:"12px 13px",color:"var(--text)",fontSize:15,outline:"none"}})
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


const GroupHome = ({groups,currentIdentity,currentEmail,onOpenProfile,onOpenGroup,onCreateGroup,onJoinGroup,creating,autoOpenCreate=false,onAutoOpenHandled}) => {
  const [showCreate,setShowCreate]=useState(false);
  const compactMobile = isMobile();
  useEffect(() => {
    if (autoOpenCreate) {
      setShowCreate(true);
      onAutoOpenHandled && onAutoOpenHandled();
    }
  }, [autoOpenCreate, onAutoOpenHandled]);
  const renderCloseMeta = group => {
    const closeMeta = getGroupCloseMeta(group);
    if (!closeMeta.isCountdown) return null;
    return React.createElement('span',{className:"mono",style:{display:"inline-flex",alignItems:"center",color:"#1E4040",fontSize:10,letterSpacing:".04em"}},closeMeta.label);
  };
  const statusColor = status => status==="cruising" ? "#CBD5E1" : status==="on-track" ? "#5ABF5A" : status==="at-risk" ? "#D4A843" : status==="behind" ? "#E07A3F" : status==="cooked" ? "#D44A4A" : "#CBD5E1";
  return React.createElement(React.Fragment,null,
    React.createElement('div',{style:{minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"flex-start",padding:compactMobile?"calc(env(safe-area-inset-top) + 16px) 16px 28px":"32px 18px",background:"transparent"}},
      React.createElement('div',{style:{width:"100%",maxWidth:744,display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,marginBottom:compactMobile?10:12}},
        React.createElement('div',null),
        React.createElement('button',{type:"button",onClick:onOpenProfile,title:currentEmail||"Account",style:{width:46,height:46,display:"inline-flex",alignItems:"center",justifyContent:"center",borderRadius:999,background:"transparent",border:"none",fontSize:14,lineHeight:1,flexShrink:0,padding:0,overflow:"visible",cursor:"pointer",touchAction:"manipulation",position:"relative",zIndex:2}},React.createElement(Avatar,{name:currentIdentity||currentEmail||"?",size:30}))
      ),
      groups.length===0
        ? React.createElement('div',{className:"fu",style:{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",textAlign:"center",paddingTop:compactMobile?60:100,paddingBottom:40}},
            React.createElement(AnteWordmark,{size:compactMobile?38:52}),
            React.createElement('div',{style:{color:"var(--muted)",fontSize:14,fontWeight:500,marginTop:12,marginBottom:32}},"You're not in any Blocs yet."),
            React.createElement('div',{style:{display:"flex",gap:10,flexWrap:"wrap",justifyContent:"center"}},
              React.createElement('button',{onClick:()=>setShowCreate(true),style:{background:"var(--green)",color:"#000",padding:compactMobile?"12px 18px":"12px 20px",borderRadius:10,fontSize:14,fontWeight:800}},"Create Bloc"),
              React.createElement('button',{onClick:onJoinGroup,style:{background:"var(--green)",color:"#000",padding:compactMobile?"12px 18px":"12px 20px",borderRadius:10,fontSize:14,fontWeight:800}},"Join Existing")
            )
          )
        : React.createElement(React.Fragment,null,
      React.createElement('div',{className:"fu",style:{width:"100%",display:"grid",justifyItems:"center",textAlign:"center",marginTop:compactMobile?-30:-22,marginBottom:compactMobile?18:34,maxWidth:560}},
        React.createElement('div',{style:{margin:compactMobile?"2px 0 8px":"8px 0 12px"}},React.createElement(AnteWordmark,{size:compactMobile?38:58})),
        React.createElement('span',{style:{fontFamily:"'Outfit',sans-serif",fontSize:10,fontWeight:800,color:"var(--cyan)",letterSpacing:".12em",textTransform:"uppercase"}},"Your Blocs")
      ),
      React.createElement('div',{style:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(228px,1fr))",gap:compactMobile?10:15,width:"100%",maxWidth:744,marginBottom:compactMobile?18:22}},
        groups.map((group,index)=>{
          const preview = getGroupMemberPreview(group, currentIdentity);
          const acceptedTypes = getAcceptedWorkoutTypes(group);
          return React.createElement('button',{key:group.id,onClick:()=>onOpenGroup(group.id),onMouseEnter:e=>{e.currentTarget.style.border="1px solid rgba(78,205,196,.2)";e.currentTarget.style.boxShadow="inset 0 1px 0 rgba(255,255,255,.08), inset 0 -1px 0 rgba(78,205,196,.06), 0 20px 42px rgba(0,0,0,.3), 0 4px 14px rgba(78,205,196,.08)";e.currentTarget.style.transform="translateY(-1px)"},onMouseLeave:e=>{e.currentTarget.style.border=compactMobile?"1px solid rgba(22,44,44,.94)":"0.5px solid rgba(18,42,42,.9)";e.currentTarget.style.boxShadow=compactMobile?"inset 0 1px 0 rgba(255,255,255,.07), inset 0 -1px 0 rgba(78,205,196,.05), 0 16px 34px rgba(0,0,0,.2), 0 2px 10px rgba(78,205,196,.05)":"inset 0 1px 0 rgba(255,255,255,.065), inset 0 -1px 0 rgba(78,205,196,.045), 0 8px 20px rgba(0,0,0,.2), 0 2px 9px rgba(78,205,196,.04)";e.currentTarget.style.transform="translateY(0)"},onMouseDown:e=>{e.currentTarget.style.transform="translateY(2px)";e.currentTarget.style.boxShadow=compactMobile?"inset 0 1px 0 rgba(255,255,255,.045), 0 8px 18px rgba(0,0,0,.18), 0 1px 5px rgba(78,205,196,.03)":"inset 0 1px 0 rgba(255,255,255,.04), 0 2px 10px rgba(0,0,0,.18), 0 1px 4px rgba(78,205,196,.025)"},onMouseUp:e=>{e.currentTarget.style.transform="translateY(-1px)";e.currentTarget.style.boxShadow="inset 0 1px 0 rgba(255,255,255,.08), inset 0 -1px 0 rgba(78,205,196,.06), 0 20px 42px rgba(0,0,0,.3), 0 4px 14px rgba(78,205,196,.08)"},onTouchStart:e=>{e.currentTarget.style.transform="translateY(2px)";e.currentTarget.style.boxShadow=compactMobile?"inset 0 1px 0 rgba(255,255,255,.045), 0 8px 18px rgba(0,0,0,.18), 0 1px 5px rgba(78,205,196,.03)":"inset 0 1px 0 rgba(255,255,255,.04), 0 2px 10px rgba(0,0,0,.18), 0 1px 4px rgba(78,205,196,.025)"},onTouchEnd:e=>{e.currentTarget.style.transform="translateY(0)";e.currentTarget.style.boxShadow=compactMobile?"inset 0 1px 0 rgba(255,255,255,.07), inset 0 -1px 0 rgba(78,205,196,.05), 0 16px 34px rgba(0,0,0,.2), 0 2px 10px rgba(78,205,196,.05)":"inset 0 1px 0 rgba(255,255,255,.065), inset 0 -1px 0 rgba(78,205,196,.045), 0 8px 20px rgba(0,0,0,.2), 0 2px 9px rgba(78,205,196,.04)"},style:{position:"relative",overflow:"hidden",background:"radial-gradient(circle at 86% 0%, rgba(78,205,196,.11), transparent 36%), radial-gradient(circle at 14% 0%, rgba(255,255,255,.045), transparent 32%), linear-gradient(180deg,rgba(13,22,22,.99),rgba(7,12,12,.99))",border:compactMobile?"1px solid rgba(22,44,44,.94)":"0.5px solid rgba(18,42,42,.9)",boxShadow:compactMobile?"inset 0 1px 0 rgba(255,255,255,.07), inset 0 -1px 0 rgba(78,205,196,.05), 0 16px 34px rgba(0,0,0,.2), 0 2px 10px rgba(78,205,196,.05)":"inset 0 1px 0 rgba(255,255,255,.065), inset 0 -1px 0 rgba(78,205,196,.045), 0 8px 20px rgba(0,0,0,.2), 0 2px 9px rgba(78,205,196,.04)",borderRadius:compactMobile?15:18,padding:compactMobile?"12px 10px 12px 14px":"15px 16px 15px 18px",textAlign:"left",cursor:"pointer",transition:"border .15s, box-shadow .15s, transform .15s",animation:`fadeUp .35s ${index*.04}s ease both`}},
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
                      React.createElement('div',{style:{marginTop:3,fontSize:12,fontWeight:800,color:statusColor(preview.status),lineHeight:1.1,whiteSpace:"nowrap"}},preview.status === "starting-soon" ? "Month started" : String(preview.status || "").replace("-", " ").toUpperCase())
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
        React.createElement('button',{onClick:()=>setShowCreate(true),style:{background:"var(--green)",color:"#000",padding:compactMobile?"10px 16px":"11px 18px",borderRadius:10,fontSize:13,fontWeight:800}},"Create Bloc"),
        React.createElement('button',{onClick:onJoinGroup,style:{background:"var(--green)",color:"#000",padding:compactMobile?"10px 16px":"11px 18px",borderRadius:10,fontSize:13,fontWeight:800}},"Join Existing")
      )
    )/* end non-empty Fragment */),
    showCreate && React.createElement(GroupCreateModal,{
      creating,
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

export { PREVIEW_MEMBERS, previewStatus, PreviewLanding, ProfileModal, JoinGroupModal, AuthFlowModal, IdentitySetup, GroupHome, WhoAreYou, GroupAccessNotice, LocalDevImpersonationBar };
