import React from "react";
const { useEffect, useMemo, useRef, useState } = React;
import {
  WORKOUT_TYPES,
  DEFAULT_CURRENCY,
  DEFAULT_GROUP_TIME_ZONE,
  DEFAULT_FINE_AMOUNT,
  DEFAULT_FEE_MODEL,
  DEFAULT_MIN_TARGET,
  DEFAULT_MIN_RUN_DISTANCE,
  DEFAULT_DISTANCE_UNIT,
  DEFAULT_STRAVA_ENABLED,
  curKey,
  buildNormalizedSettings,
  normalizeSitOutRequests,
  normalizeSoloRequests,
  normalizeEscalationStepAmount,
  getCurrentGroupMemberNames,
  getSetupReviewPendingFields
} from "../lib/appState.js";
import { copyToClipboard, isMobile } from "../lib/utils.js";
import {
  Avatar,
  AppIcon,
  WorkoutTypeIcon,
  SelectField,
  StepperField,
  inputShellStyle
} from "../components/primitives.jsx";
import { TIME_ZONE_OPTIONS } from "../modals/modals.jsx";

const UI_FONT = "'Outfit', sans-serif";
const DISPLAY_FONT = "'Raleway', sans-serif";
const fieldTitleStyle = {fontFamily:UI_FONT,fontSize:11,fontWeight:800,color:"rgba(245,247,255,.88)",marginBottom:4};
const fieldHelpStyle = {fontFamily:UI_FONT,fontSize:10,color:"var(--muted)",lineHeight:1.32,marginBottom:6};

const SETTINGS_DEFAULTS = {
  minTarget: DEFAULT_MIN_TARGET,
  acceptedWorkoutTypes: [...WORKOUT_TYPES],
  timeZone: DEFAULT_GROUP_TIME_ZONE,
  fineAmount: DEFAULT_FINE_AMOUNT,
  escalationStepAmount: DEFAULT_FINE_AMOUNT,
  currency: DEFAULT_CURRENCY,
  feeModel: DEFAULT_FEE_MODEL,
  minRunDistance: DEFAULT_MIN_RUN_DISTANCE,
  distanceUnit: DEFAULT_DISTANCE_UNIT,
  stravaEnabled: DEFAULT_STRAVA_ENABLED
};

const ReadOnlyField = ({title,value,review=false,children}) => (
  React.createElement('div',{style:{padding:"10px 0",borderBottom:"0.5px solid rgba(22,61,54,.42)",fontFamily:UI_FONT}},
    React.createElement('div',{style:{display:"flex",alignItems:"center",gap:7,marginBottom:5,flexWrap:"wrap"}},
      React.createElement('div',{style:{fontSize:11,fontWeight:800,color:"rgba(245,247,255,.88)"}},title),
      review && React.createElement(ReviewTag,null)
    ),
    children || React.createElement('div',{style:{fontSize:12,fontWeight:600,color:"var(--muted)",lineHeight:1.35}},value)
  )
);

const ReadOnlyWorkoutTypeTile = ({type}) => (
  React.createElement('div',{
    style:{
      minWidth:0,
      minHeight:46,
      borderRadius:9,
      background:"rgba(78,205,196,.07)",
      border:"0.5px solid rgba(78,205,196,.34)",
      color:"#4ECDC4",
      display:"flex",
      flexDirection:"column",
      alignItems:"center",
      justifyContent:"center",
      gap:2,
      padding:"5px 2px",
      fontFamily:UI_FONT
    }
  },
    React.createElement('span',{style:{width:18,height:18,display:"inline-flex",alignItems:"center",justifyContent:"center"}},React.createElement(WorkoutTypeIcon,{type,size:14})),
    React.createElement('span',{style:{fontSize:7.6,fontWeight:800,lineHeight:1.05,whiteSpace:"nowrap"}},type)
  )
);

const ReviewTag = () => (
  React.createElement('span',{style:{display:"inline-flex",alignItems:"center",gap:5,borderRadius:999,padding:"3px 7px",background:"rgba(78,205,196,.08)",border:"0.5px solid rgba(78,205,196,.24)",color:"#4ECDC4",fontFamily:UI_FONT,fontSize:8,fontWeight:800,letterSpacing:".06em",textTransform:"uppercase"}},
    React.createElement('span',{style:{width:5,height:5,borderRadius:999,background:"#4ECDC4",boxShadow:"0 0 10px rgba(78,205,196,.55)"}}),
    "defaulted"
  )
);

const ReviewShell = ({children,review=false,onDismiss}) => (
  React.createElement('div',{
    onPointerDown:review ? onDismiss : undefined,
    style:review?{borderRadius:12,border:"1px solid rgba(78,205,196,.45)",boxShadow:"0 0 0 1px rgba(78,205,196,.06) inset",padding:"10px 10px 0",margin:"0 -10px 12px"}:{}
  },children)
);

const EditableField = ({title,description,children}) => (
  React.createElement('div',{style:{marginBottom:12,fontFamily:UI_FONT}},
    React.createElement('div',{style:fieldTitleStyle},title),
    description && React.createElement('div',{style:fieldHelpStyle},description),
    children
  )
);

const BlocSettingsScreen = ({group,actor,actorUserId,isAdmin,onSave,onClose,saving,onReviewSetup,onReviewSitOut,onReviewSolo,onKickMember,localDevMode=false}) => {
  const compactMobile = isMobile();
  const [tab,setTab]=useState("rules");
  const [groupName,setGroupName]=useState(group?.name || "");
  const [settings,setSettings]=useState({...SETTINGS_DEFAULTS,...group?.settings});
  const [submitAttempted,setSubmitAttempted]=useState(false);
  const [confirmKick,setConfirmKick]=useState(null);
  const [kickingUserId,setKickingUserId]=useState(null);
  const [dragX,setDragX]=useState(0);
  const [dragging,setDragging]=useState(false);
  const [dismissedReviewFields,setDismissedReviewFields]=useState({});
  const surfaceRef = useRef(null);
  const swipeRef = useRef({sx:0,sy:0,active:false,mode:null});
  const pendingFields = useMemo(()=>getSetupReviewPendingFields(group),[group]);
  const pendingSet = useMemo(()=>new Set(pendingFields.filter(field=>!dismissedReviewFields[field])),[dismissedReviewFields,pendingFields]);
  const inviteLink = `${window.location.origin}${window.location.pathname}?invite=${group?.inviteCode || ""}`;
  const pendingSitOuts = Object.values(normalizeSitOutRequests(group?.sitOutRequests)?.[curKey] || {}).filter(request => request.status === "pending");
  const pendingSolos = Object.values(normalizeSoloRequests(group?.soloRequests)?.[curKey] || {}).filter(request => request.status === "pending");
  const normalizedSettings = buildNormalizedSettings(settings);
  const escalationStepMissing = normalizedSettings.feeModel === "escalating" && normalizedSettings.escalationStepAmount === null;
  const canSave = isAdmin && groupName.trim() && normalizedSettings.acceptedWorkoutTypes.length > 0 && !saving;

  useEffect(()=>{
    setGroupName(group?.name || "");
    setSettings({...SETTINGS_DEFAULTS,...group?.settings});
    setDismissedReviewFields({});
  },[group?.id]);

  useEffect(() => {
    const el = surfaceRef.current;
    if (!el) return undefined;

    let startY = 0;

    const handleTouchStart = event => {
      const touch = event.touches?.[0];
      if (!touch) return;
      startY = touch.clientY;
    };

    const handleTouchMove = event => {
      const touch = event.touches?.[0];
      if (!touch || !event.cancelable) return;

      const dy = touch.clientY - startY;
      const atTop = el.scrollTop <= 0;
      const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 1;

      if ((dy > 0 && atTop) || (dy < 0 && atBottom)) {
        event.preventDefault();
      }
    };

    el.addEventListener("touchstart", handleTouchStart, { passive: true });
    el.addEventListener("touchmove", handleTouchMove, { passive: false });

    return () => {
      el.removeEventListener("touchstart", handleTouchStart);
      el.removeEventListener("touchmove", handleTouchMove);
    };
  }, []);

  const saveRules = () => {
    setSubmitAttempted(true);
    if (!canSave || escalationStepMissing) return;
    setDismissedReviewFields({});
    onSave(groupName.trim(), normalizedSettings, { setupReview: { pending: {} }, optimisticClose: true });
  };

  const dismissReviewField = field => {
    if (!field) return;
    setDismissedReviewFields(current => current[field] ? current : { ...current, [field]: true });
  };

  const toggleType = type => setSettings(current => ({
    ...current,
    acceptedWorkoutTypes: current.acceptedWorkoutTypes.includes(type)
      ? current.acceptedWorkoutTypes.filter(item => item !== type)
      : [...current.acceptedWorkoutTypes, type]
  }));

  const resetSwipe = () => {
    swipeRef.current = {sx:0,sy:0,active:false,mode:null};
    setDragging(false);
    setDragX(0);
  };
  const startSwipeBack = e => {
    const t = e.touches?.[0];
    if (!t || t.clientX > 82 || e.target?.closest?.("input,textarea,select,button,[contenteditable='true']")) return;
    swipeRef.current = {sx:t.clientX, sy:t.clientY, st:performance.now(), active:true, mode:null};
  };
  const moveSwipeBack = e => {
    const s = swipeRef.current;
    const t = e.touches?.[0];
    if (!s.active || !t) return;
    const dx = t.clientX - s.sx;
    const dy = t.clientY - s.sy;
    if (!s.mode && (Math.abs(dx) > 5 || Math.abs(dy) > 5)) {
      s.mode = dx > 0 && Math.abs(dx) > 9 && Math.abs(dx) > Math.abs(dy) * 1.18 ? "back" : "scroll";
      setDragging(s.mode === "back");
    }
    if (s.mode === "back") {
      e.preventDefault();
      setDragX(Math.max(0, Math.min(dx, window.innerWidth || 420)));
    }
  };
  const endSwipeBack = e => {
    const s = swipeRef.current;
    const t = e.changedTouches?.[0];
    swipeRef.current = {sx:0,sy:0,active:false,mode:null};
    if (!s.active || !t) return;
    const dx = t.clientX - s.sx;
    const dy = t.clientY - s.sy;
    const screenWidth = window.innerWidth || 420;
    const elapsed = Math.max(1, performance.now() - (s.st || performance.now()));
    const fastEdgeFlick = dx > 24 && elapsed < 260 && dx / elapsed > 0.22 && dx > Math.abs(dy);
    const dominantDrag = dx > screenWidth / 2 && Math.abs(dy) < 100 && dx > Math.abs(dy);
    const shouldClose = s.mode === "back" && (fastEdgeFlick || dominantDrag);
    setDragging(false);
    if (shouldClose) {
      setDragX(screenWidth);
      window.setTimeout(()=>onClose?.(),45);
    } else {
      setDragX(0);
    }
  };

  const renderRuleTitle = (title,field) => (
    React.createElement('div',{style:{display:"flex",alignItems:"center",gap:7,flexWrap:"wrap"}},
      React.createElement('span',null,title),
      pendingSet.has(field) && React.createElement(ReviewTag,null)
    )
  );

  const renderRules = () => {
    if (!isAdmin) {
      const readonlySettings = buildNormalizedSettings(group.settings || {});
      const readonlyTypes = readonlySettings.acceptedWorkoutTypes?.length ? readonlySettings.acceptedWorkoutTypes : WORKOUT_TYPES;
      return React.createElement('div',null,
        React.createElement(ReadOnlyField,{title:"Bloc Name",value:group.name}),
        React.createElement(ReadOnlyField,{title:"Monthly Penalty Amount",value:`${readonlySettings.currency || DEFAULT_CURRENCY} ${readonlySettings.fineAmount || DEFAULT_FINE_AMOUNT}`}),
        React.createElement(ReadOnlyField,{title:"Penalty Calculation",value:readonlySettings.feeModel === "flat" ? "Flat" : "Escalating"}),
        readonlySettings.feeModel === "escalating" && React.createElement(ReadOnlyField,{title:"Penalty Increase Per Miss",value:`${readonlySettings.currency || DEFAULT_CURRENCY} ${readonlySettings.escalationStepAmount || DEFAULT_FINE_AMOUNT}`}),
        React.createElement(ReadOnlyField,{title:"Monthly Workout Target",value:`${readonlySettings.minTarget || DEFAULT_MIN_TARGET} workouts`}),
        React.createElement(ReadOnlyField,{title:"Workout Types That Count"},
          React.createElement('div',{style:{display:"grid",gridTemplateColumns:"repeat(5, minmax(0, 1fr))",gap:7,alignItems:"stretch",width:"100%"}},
            readonlyTypes.map(type=>React.createElement(ReadOnlyWorkoutTypeTile,{key:type,type}))
          )
        ),
        React.createElement(ReadOnlyField,{title:"Time Zone",value:readonlySettings.timeZone || DEFAULT_GROUP_TIME_ZONE}),
        React.createElement('div',{style:{fontSize:11,color:"var(--muted)",lineHeight:1.5,marginTop:14}},"Only the Bloc admin can edit these.")
      );
    }
    const miniWorkoutTypeSelector = React.createElement('div',{style:{display:"grid",gridTemplateColumns:"repeat(5, minmax(0, 1fr))",gap:7,alignItems:"stretch",width:"100%"}},
      WORKOUT_TYPES.map(type => {
        const active = normalizedSettings.acceptedWorkoutTypes.includes(type);
        return React.createElement('button',{
          key:type,
          type:"button",
          className:"setup-press",
          onClick:()=>toggleType(type),
          style:{
            minWidth:0,
            minHeight:46,
            borderRadius:9,
            background:active?"rgba(78,205,196,.09)":"rgba(13,31,30,.58)",
            border:`0.5px solid ${active?"#4ECDC4":"rgba(22,61,54,.68)"}`,
            color:active?"#4ECDC4":"var(--muted)",
            display:"flex",
            flexDirection:"column",
            alignItems:"center",
            justifyContent:"center",
            gap:2,
            padding:"5px 2px",
            fontFamily:UI_FONT
          }
        },
          React.createElement('span',{style:{width:18,height:18,display:"inline-flex",alignItems:"center",justifyContent:"center"}},React.createElement(WorkoutTypeIcon,{type,size:14})),
          React.createElement('span',{style:{fontSize:7.6,fontWeight:800,lineHeight:1.05,whiteSpace:"nowrap"}},type)
        );
      })
    );
    return React.createElement('div',null,
      React.createElement(EditableField,{title:"Bloc Name"},
        React.createElement('input',{value:groupName,onChange:e=>setGroupName(e.target.value),style:{...inputShellStyle,width:"min(100%, 250px)",fontSize:11.5,padding:"7px 9px",borderRadius:9,textAlign:"center",display:"block"}})
      ),
      React.createElement(EditableField,{title:"Monthly Penalty Amount"},
        React.createElement('div',{style:{display:"grid",gridTemplateColumns:"68px 96px",gap:7,maxWidth:172}},
          React.createElement('div',{style:{...inputShellStyle,padding:"8px 9px",borderRadius:9,fontSize:11,textAlign:"center",color:"var(--muted)",display:"flex",alignItems:"center",justifyContent:"center"}},settings.currency || DEFAULT_CURRENCY),
          React.createElement('input',{type:"number",min:1,value:settings.fineAmount,onChange:e=>setSettings(current=>({...current,fineAmount:e.target.value})),style:{...inputShellStyle,width:"100%",fontSize:12,padding:"8px 9px",borderRadius:9,textAlign:"center"}})
        )
      ),
      React.createElement(ReviewShell,{review:pendingSet.has("feeModel"),onDismiss:()=>dismissReviewField("feeModel")},
        React.createElement(EditableField,{title:renderRuleTitle("Penalty Calculation","feeModel")},
          React.createElement('div',{style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:7,marginBottom:7}},
            ["escalating","flat"].map(value => {
              const active = settings.feeModel === value;
              return React.createElement('button',{key:value,type:"button",className:"setup-press",onClick:()=>setSettings(current=>({...current,feeModel:value,escalationStepAmount:value==="flat"?null:(normalizeEscalationStepAmount(current.escalationStepAmount) || DEFAULT_FINE_AMOUNT)})),style:{padding:"8px 10px",borderRadius:9,background:active?"rgba(78,205,196,.1)":"#0D1F1E",border:`0.5px solid ${active?"#4ECDC4":"#163d36"}`,color:active?"#4ECDC4":"var(--muted)",fontFamily:UI_FONT,fontSize:10,fontWeight:900,textTransform:"uppercase"}},value === "flat" ? "Flat" : "Escalating");
            })
          ),
          React.createElement('div',{style:{fontSize:10,color:"var(--muted)",lineHeight:1.35}},
            settings.feeModel === "flat"
              ? "Everyone who misses the target pays the same fixed amount."
              : "Each extra miss raises the penalty for everyone who missed."
          ),
          settings.feeModel === "escalating" && React.createElement('div',{style:{marginTop:10}},
            React.createElement('div',{style:{fontSize:10,fontWeight:800,color:"var(--text)",marginBottom:6}},"Penalty Increase Per Miss"),
            React.createElement(StepperField,{value:settings.escalationStepAmount,onChange:value=>setSettings(current=>({...current,escalationStepAmount:value})),min:1,compact:true,suffix:settings.currency || DEFAULT_CURRENCY}),
            submitAttempted && escalationStepMissing && React.createElement('div',{style:{fontSize:11,color:"var(--red)",marginTop:7}},"Set a step amount to continue.")
          )
        )
      ),
      React.createElement(EditableField,{title:"Monthly Workout Target"},
        React.createElement(StepperField,{value:settings.minTarget,onChange:value=>setSettings(current=>({...current,minTarget:value})),min:6,max:30,compact:true})
      ),
      React.createElement(ReviewShell,{review:pendingSet.has("acceptedWorkoutTypes"),onDismiss:()=>dismissReviewField("acceptedWorkoutTypes")},
        React.createElement(EditableField,{title:renderRuleTitle("Workout Types That Count","acceptedWorkoutTypes")},
          React.createElement('div',{style:{width:"100%"}},
            miniWorkoutTypeSelector
          )
        )
      ),
      React.createElement(ReviewShell,{review:pendingSet.has("timeZone"),onDismiss:()=>dismissReviewField("timeZone")},
        React.createElement(EditableField,{title:renderRuleTitle("Time Zone","timeZone")},
          React.createElement(SelectField,{value:settings.timeZone,onChange:e=>setSettings(current=>({...current,timeZone:e.target.value})),width:"100%",maxWidth:196,options:TIME_ZONE_OPTIONS.map(option=>({value:option.value,label:`${option.label} · ${option.abbr}`})),compact:true,arrowColor:"#4ECDC4"})
        )
      ),
      React.createElement('button',{type:"button",className:"setup-press",disabled:!canSave,onClick:saveRules,style:{width:"100%",minHeight:40,borderRadius:12,background:canSave?"#4ECDC4":"var(--s3)",color:canSave?"#050909":"var(--muted2)",fontFamily:UI_FONT,fontSize:12,fontWeight:900,marginTop:8}},saving?"Saving...":"Save Rules")
    );
  };

  const renderMembers = () => (
    React.createElement('div',{style:{display:"grid",gap:8}},
      pendingSitOuts.length>0 && isAdmin && React.createElement('div',{style:{marginBottom:10,padding:"11px 12px",borderRadius:12,background:"#080F0F",border:"0.5px solid #163d36",display:"grid",gap:8}},
        React.createElement('div',{style:{fontWeight:900,fontSize:12}},"Pending sit-out requests"),
        pendingSitOuts.map(request=>React.createElement('div',{key:`${request.monthKey}-${request.memberName}`,style:{display:"grid",gap:8,padding:"9px 10px",borderRadius:10,background:"#0D1F1E",border:"0.5px solid #163d36"}},
          React.createElement('div',null,
            React.createElement('div',{style:{fontWeight:800,fontSize:11}},request.memberName),
            React.createElement('div',{style:{fontSize:10,color:"var(--muted)",marginTop:2}},request.reason || (request.exceptional ? "Exceptional request" : "No reason provided"))
          ),
          React.createElement('div',{style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}},
            React.createElement('button',{type:"button",onClick:()=>onReviewSitOut && onReviewSitOut({memberName:request.memberName,monthKey:request.monthKey,decision:"decline"}),style:{padding:"8px 10px",borderRadius:9,background:"transparent",border:"1px solid var(--border)",color:"var(--muted)",fontSize:10,fontWeight:800}},"Decline"),
            React.createElement('button',{type:"button",onClick:()=>onReviewSitOut && onReviewSitOut({memberName:request.memberName,monthKey:request.monthKey,decision:"approve"}),style:{padding:"8px 10px",borderRadius:9,background:"#4ECDC4",color:"#050909",fontSize:10,fontWeight:900}},"Approve")
          )
        ))
      ),
      pendingSolos.length>0 && isAdmin && React.createElement('div',{style:{marginBottom:10,padding:"11px 12px",borderRadius:12,background:"#080F0F",border:"0.5px solid rgba(78,205,196,.24)",display:"grid",gap:8}},
        React.createElement('div',{style:{fontWeight:900,fontSize:12}},"Pending Solo Mode requests"),
        pendingSolos.map(request=>React.createElement('div',{key:`solo-${request.monthKey}-${request.memberName}`,style:{display:"grid",gap:8,padding:"9px 10px",borderRadius:10,background:"rgba(78,205,196,.06)",border:"0.5px solid rgba(78,205,196,.20)"}},
          React.createElement('div',null,
            React.createElement('div',{style:{fontWeight:800,fontSize:11}},request.memberName),
            React.createElement('div',{style:{fontSize:10,color:"var(--muted)",marginTop:2}},`Target ${request.personalTarget} · ${request.reason || (request.exceptional ? "Exceptional request" : "No reason provided")}`)
          ),
          React.createElement('div',{style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}},
            React.createElement('button',{type:"button",onClick:()=>onReviewSolo && onReviewSolo({memberName:request.memberName,monthKey:request.monthKey,decision:"decline"}),style:{padding:"8px 10px",borderRadius:9,background:"transparent",border:"1px solid var(--border)",color:"var(--muted)",fontSize:10,fontWeight:800}},"Decline"),
            React.createElement('button',{type:"button",onClick:()=>onReviewSolo && onReviewSolo({memberName:request.memberName,monthKey:request.monthKey,decision:"approve"}),style:{padding:"8px 10px",borderRadius:9,background:"#4ECDC4",color:"#050909",fontSize:10,fontWeight:900}},"Approve")
          )
        ))
      ),
      getCurrentGroupMemberNames(group).map(displayName => {
        const membershipEntry = Object.values(group.memberships||{}).find(m=>m.displayName===displayName);
        const memberId = membershipEntry?.userId || null;
        const isMe = memberId ? memberId===actorUserId : displayName===actor;
        const kickKey = memberId || displayName;
        const kicking = kickingUserId===kickKey;
        return React.createElement('div',{key:displayName,style:{display:"flex",alignItems:"center",gap:10,padding:"10px 11px",borderRadius:12,background:isAdmin?"#0D1F1E":"rgba(13,31,30,.48)",border:`0.5px solid ${isAdmin?"#163d36":"rgba(22,61,54,.45)"}`,opacity:isAdmin?1:.72}},
          React.createElement(Avatar,{name:displayName,size:30,userId:memberId}),
          React.createElement('span',{style:{flex:1,fontSize:12,fontWeight:800,color:isAdmin?"var(--text)":"rgba(245,247,255,.72)"}},displayName,isMe&&React.createElement('span',{style:{fontSize:10,color:"var(--muted)",marginLeft:6}},"(you)")),
          isAdmin && !isMe && onKickMember && (confirmKick===kickKey
            ? React.createElement('div',{style:{display:"flex",gap:6}},
                React.createElement('button',{type:"button",onClick:()=>setConfirmKick(null),style:{padding:"6px 8px",borderRadius:8,background:"var(--s3)",border:"1px solid var(--border)",color:"var(--muted)",fontSize:10,fontWeight:700}},"Cancel"),
                React.createElement('button',{type:"button",disabled:kicking,onClick:async()=>{setKickingUserId(kickKey);setConfirmKick(null);await onKickMember(memberId,displayName);setKickingUserId(null);},style:{padding:"6px 9px",borderRadius:8,background:"transparent",border:"1px solid rgba(180,60,60,.25)",color:"rgba(220,100,100,.75)",fontSize:10,fontWeight:800}},kicking?"Removing...":"Remove")
              )
            : React.createElement('button',{type:"button",onClick:()=>setConfirmKick(kickKey),style:{padding:"6px 9px",borderRadius:8,background:"transparent",border:"1px solid rgba(180,60,60,.22)",color:"rgba(220,100,100,.7)",fontSize:10,fontWeight:800}},"Remove")
          )
        );
      })
    )
  );

  const renderInvite = () => (
    React.createElement('div',{style:{display:"grid",gap:14}},
      React.createElement('div',null,
        React.createElement('div',{style:fieldTitleStyle},"Invite Code"),
        React.createElement('div',{style:{display:"grid",gridTemplateColumns:"1fr auto",gap:8}},
          React.createElement('div',{style:{padding:"11px 12px",borderRadius:11,background:"#0D1F1E",border:"0.5px solid #163d36",fontFamily:UI_FONT,fontSize:14,fontWeight:900,color:"#f5f7ff",letterSpacing:".08em"}},group.inviteCode),
          React.createElement('button',{type:"button",className:"setup-press",onClick:e=>copyToClipboard(group.inviteCode,e.currentTarget),style:{padding:"0 12px",borderRadius:11,background:"#0D1F1E",border:"0.5px solid #163d36",fontFamily:UI_FONT,fontSize:10,fontWeight:800,color:"#4ECDC4"}},"Copy")
        )
      ),
      React.createElement('div',null,
        React.createElement('div',{style:fieldTitleStyle},"Invite Link"),
        React.createElement('div',{style:{display:"grid",gridTemplateColumns:"1fr auto",gap:8}},
          React.createElement('div',{style:{padding:"11px 12px",borderRadius:11,background:"#0D1F1E",border:"0.5px solid #163d36",fontFamily:UI_FONT,fontSize:10,color:"var(--muted)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}},inviteLink),
          React.createElement('button',{type:"button",className:"setup-press",onClick:e=>copyToClipboard(inviteLink,e.currentTarget),style:{padding:"0 12px",borderRadius:11,background:"#0D1F1E",border:"0.5px solid #163d36",fontFamily:UI_FONT,fontSize:10,fontWeight:800,color:"#4ECDC4"}},"Copy")
        )
      )
    )
  );

  const content = tab === "members" ? renderMembers() : tab === "invite" ? renderInvite() : renderRules();
  const surfaceHeight = localDevMode ? "calc(100dvh - 130px)" : "calc(100dvh - 64px)";

  return React.createElement('div',{
    ref:surfaceRef,
    onTouchStart:startSwipeBack,
    onTouchMove:moveSwipeBack,
    onTouchEnd:endSwipeBack,
    onTouchCancel:resetSwipe,
    style:{position:"relative",zIndex:2,height:surfaceHeight,minHeight:0,background:"var(--bg-gradient)",backgroundImage:"var(--bg-radial-hint), var(--bg-gradient)",backgroundColor:"#050909",overflowY:"auto",overflowX:"hidden",WebkitOverflowScrolling:"touch",overscrollBehavior:"contain",isolation:"isolate",transform:dragX?`translateX(${dragX}px)`:"translateX(0)",transition:dragging?"none":"transform .08s ease-out",boxShadow:dragX?"-18px 0 34px rgba(0,0,0,.28)":"none",willChange:dragging||dragX?"transform":"auto",touchAction:"pan-y"}
  },
    React.createElement('div',{style:{maxWidth:560,margin:"0 auto",padding:compactMobile?"8px 16px calc(env(safe-area-inset-bottom) + 22px)":"16px 18px 34px"}},
      React.createElement('div',{style:{display:"grid",gridTemplateColumns:"38px 1fr 38px",alignItems:"center",minHeight:36,marginBottom:7}},
        React.createElement('button',{type:"button",className:"setup-press",onClick:onClose,style:{width:34,height:34,borderRadius:999,display:"inline-flex",alignItems:"center",justifyContent:"center",background:"transparent",color:"#4ECDC4",border:"none",padding:0,flexShrink:0}},React.createElement(AppIcon,{name:"chevron-left",size:23,stroke:"#4ECDC4"})),
        React.createElement('div',{style:{fontFamily:DISPLAY_FONT,fontSize:18,fontWeight:800,letterSpacing:0,lineHeight:1,color:"#f5f7ff",textAlign:"center"}},"Bloc Settings"),
        React.createElement('div')
      ),
      React.createElement('div',{style:{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:5,marginBottom:10,padding:3,borderRadius:12,background:"rgba(8,20,19,.76)",border:"0.5px solid rgba(22,61,54,.72)"}},
        ["rules","members","invite"].map(value => {
          const active = tab === value;
          const label = value.charAt(0).toUpperCase()+value.slice(1);
          return React.createElement('button',{key:value,type:"button",className:"setup-press",onClick:()=>setTab(value),style:{minHeight:31,borderRadius:9,background:active?"rgba(78,205,196,.12)":"transparent",color:active?"#4ECDC4":"var(--muted)",fontFamily:UI_FONT,fontSize:9.5,fontWeight:900,textTransform:"uppercase",letterSpacing:".055em"}},label);
        })
      ),
      React.createElement('div',{style:{borderRadius:14,background:"rgba(8,15,15,.58)",border:"0.5px solid rgba(22,61,54,.5)",padding:"11px 11px",boxShadow:"inset 0 1px 0 rgba(255,255,255,.025)"}},
        content
      )
    )
  );
};

export { BlocSettingsScreen };
