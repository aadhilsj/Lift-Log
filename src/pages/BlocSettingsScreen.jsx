import React from "react";
const { useEffect, useMemo, useState } = React;
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
  normalizeEscalationStepAmount,
  getCurrentGroupMemberNames,
  getSetupReviewPendingFields
} from "../lib/appState.js";
import { copyToClipboard, isMobile } from "../lib/utils.js";
import {
  Avatar,
  AppIcon,
  WorkoutCategorySelector,
  SettingsField,
  SelectField,
  StepperField,
  inputShellStyle
} from "../components/primitives.jsx";
import { TIME_ZONE_OPTIONS } from "../modals/modals.jsx";

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

const REVIEW_LABELS = {
  feeModel: "defaulted — take a look",
  acceptedWorkoutTypes: "defaulted — take a look",
  timeZone: "defaulted — take a look"
};

const ReadOnlyField = ({title,value,review=false,children}) => (
  React.createElement('div',{style:{padding:"13px 0",borderBottom:"0.5px solid rgba(22,61,54,.55)"}},
    React.createElement('div',{style:{display:"flex",alignItems:"center",gap:7,marginBottom:5,flexWrap:"wrap"}},
      React.createElement('div',{style:{fontSize:11,fontWeight:800,color:"#6B9690",letterSpacing:".1em",textTransform:"uppercase"}},title),
      review && React.createElement(ReviewTag,null)
    ),
    children || React.createElement('div',{style:{fontSize:15,fontWeight:700,color:"#f5f7ff",lineHeight:1.35}},value)
  )
);

const ReviewTag = () => (
  React.createElement('span',{style:{display:"inline-flex",alignItems:"center",gap:5,borderRadius:999,padding:"3px 7px",background:"rgba(78,205,196,.08)",border:"0.5px solid rgba(78,205,196,.24)",color:"#4ECDC4",fontSize:9,fontWeight:800,letterSpacing:".06em",textTransform:"uppercase"}},
    React.createElement('span',{style:{width:5,height:5,borderRadius:999,background:"#4ECDC4",boxShadow:"0 0 10px rgba(78,205,196,.55)"}}),
    "defaulted"
  )
);

const ReviewShell = ({children,review=false}) => (
  React.createElement('div',{style:review?{borderRadius:12,border:"1px solid rgba(78,205,196,.45)",boxShadow:"0 0 0 1px rgba(78,205,196,.06) inset",padding:"10px 10px 0",margin:"0 -10px 10px"}:{}},children)
);

const BlocSettingsScreen = ({group,actor,actorUserId,isAdmin,onSave,onClose,saving,onReviewSetup,onReviewSitOut,onKickMember}) => {
  const compactMobile = isMobile();
  const [tab,setTab]=useState("rules");
  const [groupName,setGroupName]=useState(group?.name || "");
  const [settings,setSettings]=useState({...SETTINGS_DEFAULTS,...group?.settings});
  const [submitAttempted,setSubmitAttempted]=useState(false);
  const [confirmKick,setConfirmKick]=useState(null);
  const [kickingUserId,setKickingUserId]=useState(null);
  const pendingFields = useMemo(()=>getSetupReviewPendingFields(group),[group]);
  const pendingSet = useMemo(()=>new Set(pendingFields),[pendingFields]);
  const inviteLink = `${window.location.origin}${window.location.pathname}?invite=${group?.inviteCode || ""}`;
  const pendingSitOuts = Object.values(normalizeSitOutRequests(group?.sitOutRequests)?.[curKey] || {}).filter(request => request.status === "pending");
  const normalizedSettings = buildNormalizedSettings(settings);
  const escalationStepMissing = normalizedSettings.feeModel === "escalating" && normalizedSettings.escalationStepAmount === null;
  const canSave = isAdmin && groupName.trim() && normalizedSettings.acceptedWorkoutTypes.length > 0 && !saving;

  useEffect(()=>{
    document.body.style.overflow = "hidden";
    return ()=>{ document.body.style.overflow = ""; };
  },[]);

  useEffect(()=>{
    setGroupName(group?.name || "");
    setSettings({...SETTINGS_DEFAULTS,...group?.settings});
  },[group?.id]);

  useEffect(()=>{
    if (tab !== "rules" || !isAdmin || pendingFields.length === 0 || !onReviewSetup) return undefined;
    const timer = setTimeout(()=>onReviewSetup(), 250);
    return ()=>clearTimeout(timer);
  },[tab,isAdmin,pendingFields.length,onReviewSetup]);

  const saveRules = () => {
    setSubmitAttempted(true);
    if (!canSave || escalationStepMissing) return;
    onSave(groupName.trim(), normalizedSettings);
  };

  const toggleType = type => setSettings(current => ({
    ...current,
    acceptedWorkoutTypes: current.acceptedWorkoutTypes.includes(type)
      ? current.acceptedWorkoutTypes.filter(item => item !== type)
      : [...current.acceptedWorkoutTypes, type]
  }));

  const renderRuleTitle = (title,field) => (
    React.createElement('div',{style:{display:"flex",alignItems:"center",gap:7,flexWrap:"wrap"}},
      React.createElement('span',null,title),
      pendingSet.has(field) && React.createElement(ReviewTag,null)
    )
  );

  const renderRules = () => {
    if (!isAdmin) {
      return React.createElement('div',null,
        React.createElement(ReadOnlyField,{title:"Bloc name",value:group.name}),
        React.createElement(ReadOnlyField,{title:"Monthly fine amount",value:`${group.settings?.currency || DEFAULT_CURRENCY} ${group.settings?.fineAmount || DEFAULT_FINE_AMOUNT}`}),
        React.createElement(ReadOnlyField,{title:"Fine calculation",value:group.settings?.feeModel === "flat" ? "Flat" : "Escalating",review:pendingSet.has("feeModel")}),
        React.createElement(ReadOnlyField,{title:"Monthly workout target",value:`${group.settings?.minTarget || DEFAULT_MIN_TARGET} workouts`}),
        React.createElement(ReadOnlyField,{title:"Workout types that count",review:pendingSet.has("acceptedWorkoutTypes")},
          React.createElement('div',{style:{display:"flex",gap:7,flexWrap:"wrap"}},
            (group.settings?.acceptedWorkoutTypes || WORKOUT_TYPES).map(type=>React.createElement('span',{key:type,style:{fontSize:12,fontWeight:700,color:"#f5f7ff"}},type))
          )
        ),
        React.createElement(ReadOnlyField,{title:"Time zone",value:group.settings?.timeZone || DEFAULT_GROUP_TIME_ZONE,review:pendingSet.has("timeZone")}),
        React.createElement('div',{style:{fontSize:12,color:"var(--muted)",lineHeight:1.5,marginTop:14}},"Only the Bloc admin can edit these.")
      );
    }
    return React.createElement('div',null,
      React.createElement(SettingsField,{title:"Bloc name",compact:true},
        React.createElement('input',{value:groupName,onChange:e=>setGroupName(e.target.value),style:{...inputShellStyle,width:"100%",fontSize:13,padding:"10px 11px",borderRadius:10}})
      ),
      React.createElement(SettingsField,{title:"Monthly fine amount",compact:true},
        React.createElement('div',{style:{display:"grid",gridTemplateColumns:"78px 1fr",gap:8,maxWidth:220}},
          React.createElement('div',{style:{...inputShellStyle,padding:"10px 11px",borderRadius:10,fontSize:13,textAlign:"center",color:"var(--muted)",display:"flex",alignItems:"center",justifyContent:"center"}},settings.currency || DEFAULT_CURRENCY),
          React.createElement('input',{type:"number",min:1,value:settings.fineAmount,onChange:e=>setSettings(current=>({...current,fineAmount:e.target.value})),style:{...inputShellStyle,width:"100%",fontSize:13,padding:"10px 11px",borderRadius:10,textAlign:"center"}})
        )
      ),
      React.createElement(ReviewShell,{review:pendingSet.has("feeModel")},
        React.createElement(SettingsField,{title:renderRuleTitle("Fine calculation","feeModel"),compact:true},
          React.createElement('div',{style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}},
            ["escalating","flat"].map(value => {
              const active = settings.feeModel === value;
              return React.createElement('button',{key:value,type:"button",onClick:()=>setSettings(current=>({...current,feeModel:value,escalationStepAmount:value==="flat"?null:(normalizeEscalationStepAmount(current.escalationStepAmount) || DEFAULT_FINE_AMOUNT)})),style:{padding:"10px 12px",borderRadius:10,background:active?"rgba(78,205,196,.1)":"#0D1F1E",border:`0.5px solid ${active?"#4ECDC4":"#163d36"}`,color:active?"#4ECDC4":"var(--muted)",fontSize:12,fontWeight:900,textTransform:"uppercase"}},value === "flat" ? "Flat" : "Escalating");
            })
          ),
          React.createElement('div',{style:{fontSize:12,color:"var(--muted)",lineHeight:1.4}},
            settings.feeModel === "flat"
              ? "Everyone who misses the target pays the same fixed amount."
              : "Each extra miss raises the fine for everyone who missed."
          ),
          settings.feeModel === "escalating" && React.createElement('div',{style:{marginTop:10}},
            React.createElement('div',{style:{fontSize:11,fontWeight:800,color:"var(--text)",marginBottom:6}},"Fine increase per miss"),
            React.createElement(StepperField,{value:settings.escalationStepAmount,onChange:value=>setSettings(current=>({...current,escalationStepAmount:value})),min:1,compact:true,suffix:settings.currency || DEFAULT_CURRENCY}),
            submitAttempted && escalationStepMissing && React.createElement('div',{style:{fontSize:12,color:"var(--red)",marginTop:7}},"Set a step amount to continue.")
          )
        )
      ),
      React.createElement(SettingsField,{title:"Monthly workout target",compact:true},
        React.createElement(StepperField,{value:settings.minTarget,onChange:value=>setSettings(current=>({...current,minTarget:value})),min:6,max:30,compact:true})
      ),
      React.createElement(ReviewShell,{review:pendingSet.has("acceptedWorkoutTypes")},
        React.createElement(SettingsField,{title:renderRuleTitle("Workout types that count","acceptedWorkoutTypes"),compact:true},
          React.createElement(WorkoutCategorySelector,{selected:settings.acceptedWorkoutTypes,onToggle:toggleType,compact:true})
        )
      ),
      React.createElement(ReviewShell,{review:pendingSet.has("timeZone")},
        React.createElement(SettingsField,{title:renderRuleTitle("Time zone","timeZone"),compact:true},
          React.createElement(SelectField,{value:settings.timeZone,onChange:e=>setSettings(current=>({...current,timeZone:e.target.value})),width:"100%",maxWidth:320,options:TIME_ZONE_OPTIONS.map(option=>({value:option.value,label:`${option.label} · ${option.abbr}`})),compact:true,arrowColor:"#4ECDC4"})
        )
      ),
      React.createElement('button',{type:"button",disabled:!canSave,onClick:saveRules,style:{width:"100%",minHeight:46,borderRadius:14,background:canSave?"#4ECDC4":"var(--s3)",color:canSave?"#050909":"var(--muted2)",fontSize:14,fontWeight:900,marginTop:10}},saving?"Saving...":"Save rules")
    );
  };

  const renderMembers = () => (
    React.createElement('div',{style:{display:"grid",gap:8}},
      pendingSitOuts.length>0 && isAdmin && React.createElement('div',{style:{marginBottom:10,padding:"11px 12px",borderRadius:12,background:"#080F0F",border:"0.5px solid #163d36",display:"grid",gap:8}},
        React.createElement('div',{style:{fontWeight:900,fontSize:13}},"Pending sit-out requests"),
        pendingSitOuts.map(request=>React.createElement('div',{key:`${request.monthKey}-${request.memberName}`,style:{display:"grid",gap:8,padding:"9px 10px",borderRadius:10,background:"#0D1F1E",border:"0.5px solid #163d36"}},
          React.createElement('div',null,
            React.createElement('div',{style:{fontWeight:800,fontSize:12}},request.memberName),
            React.createElement('div',{style:{fontSize:11,color:"var(--muted)",marginTop:2}},request.reason || (request.exceptional ? "Exceptional request" : "No reason provided"))
          ),
          React.createElement('div',{style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}},
            React.createElement('button',{type:"button",onClick:()=>onReviewSitOut && onReviewSitOut({memberName:request.memberName,monthKey:request.monthKey,decision:"decline"}),style:{padding:"8px 10px",borderRadius:9,background:"transparent",border:"1px solid var(--border)",color:"var(--muted)",fontSize:11,fontWeight:800}},"Decline"),
            React.createElement('button',{type:"button",onClick:()=>onReviewSitOut && onReviewSitOut({memberName:request.memberName,monthKey:request.monthKey,decision:"approve"}),style:{padding:"8px 10px",borderRadius:9,background:"#4ECDC4",color:"#050909",fontSize:11,fontWeight:900}},"Approve")
          )
        ))
      ),
      getCurrentGroupMemberNames(group).map(displayName => {
        const membershipEntry = Object.values(group.memberships||{}).find(m=>m.displayName===displayName);
        const memberId = membershipEntry?.userId || null;
        const isMe = memberId ? memberId===actorUserId : displayName===actor;
        const kickKey = memberId || displayName;
        const kicking = kickingUserId===kickKey;
        return React.createElement('div',{key:displayName,style:{display:"flex",alignItems:"center",gap:10,padding:"10px 11px",borderRadius:12,background:"#0D1F1E",border:"0.5px solid #163d36"}},
          React.createElement(Avatar,{name:displayName,size:30,userId:memberId}),
          React.createElement('span',{style:{flex:1,fontSize:13,fontWeight:800,color:"var(--text)"}},displayName,isMe&&React.createElement('span',{style:{fontSize:10,color:"var(--muted)",marginLeft:6}},"(you)")),
          isAdmin && !isMe && onKickMember && (confirmKick===kickKey
            ? React.createElement('div',{style:{display:"flex",gap:6}},
                React.createElement('button',{type:"button",onClick:()=>setConfirmKick(null),style:{padding:"6px 8px",borderRadius:8,background:"var(--s3)",border:"1px solid var(--border)",color:"var(--muted)",fontSize:11,fontWeight:700}},"Cancel"),
                React.createElement('button',{type:"button",disabled:kicking,onClick:async()=>{setKickingUserId(kickKey);setConfirmKick(null);await onKickMember(memberId,displayName);setKickingUserId(null);},style:{padding:"6px 9px",borderRadius:8,background:"transparent",border:"1px solid rgba(180,60,60,.25)",color:"rgba(220,100,100,.75)",fontSize:11,fontWeight:800}},kicking?"Removing...":"Remove")
              )
            : React.createElement('button',{type:"button",onClick:()=>setConfirmKick(kickKey),style:{padding:"6px 9px",borderRadius:8,background:"transparent",border:"1px solid rgba(180,60,60,.22)",color:"rgba(220,100,100,.7)",fontSize:11,fontWeight:800}},"Remove")
          )
        );
      })
    )
  );

  const renderInvite = () => (
    React.createElement('div',{style:{display:"grid",gap:14}},
      React.createElement('div',null,
        React.createElement('div',{className:"lbl",style:{marginBottom:6}},"Invite code"),
        React.createElement('div',{style:{display:"grid",gridTemplateColumns:"1fr auto",gap:8}},
          React.createElement('div',{style:{padding:"11px 12px",borderRadius:11,background:"#0D1F1E",border:"0.5px solid #163d36",fontSize:15,fontWeight:900,color:"#f5f7ff",letterSpacing:".12em",fontFamily:"'JetBrains Mono',monospace"}},group.inviteCode),
          React.createElement('button',{type:"button",onClick:e=>copyToClipboard(group.inviteCode,e.currentTarget),style:{padding:"0 12px",borderRadius:11,background:"#0D1F1E",border:"0.5px solid #163d36",fontSize:11,fontWeight:800,color:"#4ECDC4"}},"Copy")
        )
      ),
      React.createElement('div',null,
        React.createElement('div',{className:"lbl",style:{marginBottom:6}},"Invite link"),
        React.createElement('div',{style:{display:"grid",gridTemplateColumns:"1fr auto",gap:8}},
          React.createElement('div',{style:{padding:"11px 12px",borderRadius:11,background:"#0D1F1E",border:"0.5px solid #163d36",fontSize:11,color:"var(--muted)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}},inviteLink),
          React.createElement('button',{type:"button",onClick:e=>copyToClipboard(inviteLink,e.currentTarget),style:{padding:"0 12px",borderRadius:11,background:"#0D1F1E",border:"0.5px solid #163d36",fontSize:11,fontWeight:800,color:"#4ECDC4"}},"Copy")
        )
      )
    )
  );

  const content = tab === "members" ? renderMembers() : tab === "invite" ? renderInvite() : renderRules();

  return React.createElement('div',{
    style:{position:"fixed",inset:0,zIndex:560,background:"var(--bg-gradient)",backgroundImage:"var(--bg-radial-hint), var(--bg-gradient)",overflowY:"auto",WebkitOverflowScrolling:"touch",overscrollBehavior:"contain"}
  },
    React.createElement('div',{style:{maxWidth:520,margin:"0 auto",padding:compactMobile?"calc(env(safe-area-inset-top) + 10px) 16px calc(env(safe-area-inset-bottom) + 28px)":"28px 18px 38px"}},
      React.createElement('div',{style:{display:"grid",gridTemplateColumns:"42px 1fr 42px",alignItems:"center",marginBottom:14}},
        React.createElement('button',{type:"button",onClick:onClose,style:{width:42,height:42,borderRadius:999,display:"inline-flex",alignItems:"center",justifyContent:"center",background:"transparent",color:"#4ECDC4",border:"none",padding:0}},React.createElement(AppIcon,{name:"chevron-left",size:28,stroke:"#4ECDC4"})),
        React.createElement('div',{style:{textAlign:"center",minWidth:0}},
          React.createElement('div',{style:{fontSize:18,fontWeight:900,color:"#f5f7ff"}},"Bloc settings"),
          React.createElement('div',{style:{fontSize:12,color:"var(--muted)",marginTop:2,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}},group.name)
        ),
        React.createElement('div',null)
      ),
      React.createElement('div',{style:{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:7,marginBottom:15,padding:4,borderRadius:14,background:"#081413",border:"0.5px solid #163d36"}},
        ["rules","members","invite"].map(value => {
          const active = tab === value;
          const label = value.charAt(0).toUpperCase()+value.slice(1);
          return React.createElement('button',{key:value,type:"button",onClick:()=>setTab(value),style:{minHeight:38,borderRadius:11,background:active?"rgba(78,205,196,.12)":"transparent",color:active?"#4ECDC4":"var(--muted)",fontSize:12,fontWeight:900,textTransform:"uppercase",letterSpacing:".06em"}},label);
        })
      ),
      React.createElement('div',{style:{borderRadius:16,background:"rgba(8,15,15,.84)",border:"0.5px solid #163d36",padding:"15px 14px"}},
        content
      )
    )
  );
};

export { BlocSettingsScreen };
