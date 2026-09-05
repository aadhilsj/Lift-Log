import React from "react";
const { useState, useEffect, useMemo, useCallback, useRef } = React;
import {
  WORKOUT_TYPES,
  MAX_WORKOUTS_PER_DAY,
  DEFAULT_MIN_TARGET,
  DEFAULT_GROUP_TIME_ZONE,
  DEFAULT_FINE_AMOUNT,
  DEFAULT_FEE_MODEL,
  DEFAULT_ESCALATION_STEP_AMOUNT,
  DEFAULT_CURRENCY,
  DEFAULT_MIN_RUN_DISTANCE,
  DEFAULT_DISTANCE_UNIT,
  DEFAULT_STRAVA_ENABLED,
  DEFAULT_TRAINING_WHEELS,
  TODAY_ISO,
  curKey,
  CURRENCY_OPTIONS,
  DISTANCE_UNIT_OPTIONS,
  COMMON_TIME_ZONES,
  getTimeContextForGroup,
  fmtISO,
  normalizeSitOutRequests,
  uniqueNames,
  normalizeFlagStatus,
  normalizeEscalationStepAmount,
  buildNormalizedSettings,
  getMonthKeyFromISO,
  getCurrentGroupMemberNames,
  getDistinctWorkoutCountForDate,
  resolveStorageImageUrl
} from "../lib/appState.js";
import {
  getAcceptedWorkoutTypes,
  groupCountsWorkoutType,
  getTimeZoneAbbreviation,
  getGroupCloseMeta,
  compressImageDataUrl,
  uploadPhotoToStorage,
  isMobile,
  copyToClipboard
} from "../lib/utils.js";
import { Avatar, WorkoutTypeIcon, WorkoutCategorySelector, SettingsField, SelectField, inputShellStyle, StepperField } from "../components/primitives.jsx";

const SETTINGS_DEFAULTS = {
  minTarget: DEFAULT_MIN_TARGET,
  acceptedWorkoutTypes: [...WORKOUT_TYPES],
  timeZone: DEFAULT_GROUP_TIME_ZONE,
  fineAmount: DEFAULT_FINE_AMOUNT,
  escalationStepAmount: DEFAULT_ESCALATION_STEP_AMOUNT,
  currency: DEFAULT_CURRENCY,
  feeModel: DEFAULT_FEE_MODEL,
  minRunDistance: DEFAULT_MIN_RUN_DISTANCE,
  distanceUnit: DEFAULT_DISTANCE_UNIT,
  stravaEnabled: DEFAULT_STRAVA_ENABLED,
  trainingWheels: DEFAULT_TRAINING_WHEELS
};

const WORKOUT_NOTE_LIMIT = 140;
const UI_FONT = "'Outfit', sans-serif";
const DISPLAY_FONT = "'Raleway', sans-serif";
const setupFieldTitleStyle = {fontFamily:UI_FONT,fontSize:13,fontWeight:800,color:"var(--text)",marginBottom:5};
const setupFieldHelpStyle = {fontFamily:UI_FONT,fontSize:12,color:"var(--muted)",lineHeight:1.35,marginBottom:7};

const TIME_ZONE_OPTIONS = (() => {
  const supported = typeof Intl.supportedValuesOf === "function"
    ? Intl.supportedValuesOf("timeZone")
    : [];
  const merged = uniqueNames([DEFAULT_GROUP_TIME_ZONE, ...COMMON_TIME_ZONES, ...supported]);
  return merged.map(value => ({
    value,
    label: value.replaceAll("_", " "),
    abbr: getTimeZoneAbbreviation(value)
  }));
})();


const GroupSettingsFields = ({settings,setSettings,showAdvanced,setShowAdvanced,showValidation=false,compact=false,lockCurrency=false}) => {
  const desktopNumericWidth = compact && !isMobile() ? 54 : 39;
  const fineCurrencyWidth = compact && isMobile() ? 110 : 85;
  const fineAmountWidth = compact && isMobile() ? 95 : 75;
  const toggleType = type => setSettings(current => ({
    ...current,
    acceptedWorkoutTypes: current.acceptedWorkoutTypes.includes(type)
      ? current.acceptedWorkoutTypes.filter(item => item !== type)
      : [...current.acceptedWorkoutTypes, type]
  }));
  const needsEscalationStep = settings.feeModel === "escalating";
  const missingEscalationStep = needsEscalationStep && normalizeEscalationStepAmount(settings.escalationStepAmount) === null;
  return React.createElement(React.Fragment,null,
    React.createElement(SettingsField,{title:"Monthly penalty amount",description:"What each person who misses the target owes.",compact},
      React.createElement('div',{style:{display:"inline-flex",alignItems:"center",gap:6}},
        lockCurrency
          ? React.createElement('div',{style:{...inputShellStyle,width:fineCurrencyWidth,fontSize:compact?12:15,padding:compact?"7px 9px":inputShellStyle.padding,borderRadius:compact?8:inputShellStyle.borderRadius,textAlign:"center",color:"var(--muted)",display:"inline-flex",alignItems:"center",justifyContent:"center"}},settings.currency || DEFAULT_CURRENCY)
          : React.createElement(SelectField,{
              value:settings.currency,
              onChange:e=>setSettings(current=>({...current,currency:e.target.value})),
              width:fineCurrencyWidth,
              textAlign:"center",
              options:CURRENCY_OPTIONS.map(option=>({value:option.code,label:option.code})),
              compact,
              arrowColor:"#4ECDC4"
            }),
        React.createElement('input',{type:"number",min:1,value:settings.fineAmount,onChange:e=>setSettings(current=>({...current,fineAmount:e.target.value})),style:{...inputShellStyle,width:fineAmountWidth,fontSize:compact?12:15,padding:compact?"7px 9px":inputShellStyle.padding,borderRadius:compact?8:inputShellStyle.borderRadius,textAlign:"center"}})
      )
    ),
    React.createElement(SettingsField,{title:"How penalties are calculated",compact},
      React.createElement('div',{style:{display:"grid",gap:9,marginTop:6}},
        [
          {id:"escalating",title:"Escalating",body:"Each additional person who misses the target increases the penalty for all losers.",badge:"Recommended"},
          {id:"flat",title:"Flat penalty",body:"Everyone who misses the target pays the same fixed amount."}
        ].map(option=>{
          const active = settings.feeModel === option.id;
          return React.createElement('button',{key:option.id,type:"button",onClick:()=>setSettings(current=>({...current,feeModel:option.id,escalationStepAmount:option.id==="flat" ? null : current.escalationStepAmount})),style:{
            textAlign:"left",
            padding:compact?"6px 10px":"12px 14px",
            borderRadius:compact?10:12,
            background:active?"rgba(78,205,196,.08)":"var(--s2)",
            border:`1px solid ${active?"#4ECDC4":"var(--border)"}`,
            color:"var(--text)"
          }},
            React.createElement('div',{style:{display:"flex",alignItems:"center",gap:8,marginBottom:compact?2:5}},
              React.createElement('span',{style:{fontWeight:800,fontSize:compact?11:14}},option.title),
              option.badge && React.createElement('span',{className:"mono",style:{fontSize:9,color:"var(--cyan)",letterSpacing:".08em",textTransform:"uppercase"}},option.badge)
            ),
            React.createElement('div',{style:{fontSize:compact?10:12,color:"var(--muted)",lineHeight:1.35}},option.body)
          );
        })
      ),
      needsEscalationStep && React.createElement('div',{style:{marginTop:compact?7:12}},
        React.createElement('div',{style:{fontWeight:700,fontSize:compact?11:13,color:"var(--text)",marginBottom:3}},"Penalty increase per miss"),
        React.createElement('div',{style:{fontSize:compact?11:12,color:"#1E4040",lineHeight:1.35,marginBottom:compact?6:10}},"e.g. base 20, step 5 → 2 losers pay 25 each, 3 losers pay 30 each"),
        React.createElement('div',{style:{width:compact?60:75}},
          React.createElement(StepperField,{value:settings.escalationStepAmount,onChange:value=>setSettings(current=>({...current,escalationStepAmount:value})),min:1,compact,suffix:settings.currency||"USD"})
        ),
        showValidation && missingEscalationStep && React.createElement('div',{style:{fontSize:12,color:"var(--red)",marginTop:8}},"Set a step amount to continue.")
      )
    ),
    React.createElement(SettingsField,{title:"Monthly workout target",description:"Between 6 and 30 workouts per month.",compact},
      React.createElement(StepperField,{value:settings.minTarget,onChange:value=>setSettings(current=>({...current,minTarget:value})),min:6,max:30,compact})
    ),
    React.createElement(SettingsField,{title:"Which workout types count",description:"Members can only log workouts from these categories.",compact},
      React.createElement(WorkoutCategorySelector,{selected:settings.acceptedWorkoutTypes,onToggle:toggleType,compact}),
    ),
    React.createElement(SettingsField,{title:"Bloc time zone",description:"This decides when the month closes for everyone in the Bloc.",compact},
      React.createElement(SelectField,{
        value:settings.timeZone,
        onChange:e=>setSettings(current=>({...current,timeZone:e.target.value})),
        width:"100%",
        maxWidth:320,
        options:TIME_ZONE_OPTIONS.map(option=>({value:option.value,label:`${option.label} · ${option.abbr}`})),
        compact,
        arrowColor:"#4ECDC4"
      })
    ),
    React.createElement('button',{type:"button",onClick:()=>setShowAdvanced(value=>!value),style:{width:"100%",background:"transparent",color:"var(--muted)",padding:`0 0 ${compact?7:14}px`,textAlign:"left",fontSize:compact?10.5:12,fontWeight:700,textDecoration:"underline"}},showAdvanced?"Hide advanced settings":"Show advanced settings"),
    showAdvanced && React.createElement('div',{style:{display:"grid",gap:compact?9:18,marginBottom:compact?8:18}},
      React.createElement(SettingsField,{title:"Minimum run distance",description:"If Strava is enabled later, runs shorter than this will not count automatically.",compact},
        React.createElement('div',{style:{display:"flex",alignItems:"stretch",gap:8,flexWrap:"wrap"}},
          React.createElement('input',{type:"number",min:0.5,step:0.5,value:settings.minRunDistance,onChange:e=>setSettings(current=>({...current,minRunDistance:e.target.value})),style:{...inputShellStyle,width:desktopNumericWidth,fontSize:compact?12:15,padding:compact?"7px 9px":inputShellStyle.padding,borderRadius:compact?8:inputShellStyle.borderRadius,textAlign:"center"}}),
          React.createElement('div',{style:{display:"flex",gap:8}},
            DISTANCE_UNIT_OPTIONS.map(option=>{
              const active = settings.distanceUnit === option.value;
              return React.createElement('button',{key:option.value,type:"button",onClick:()=>setSettings(current=>({...current,distanceUnit:option.value})),style:{minWidth:26,padding:compact?"0 6px":"0 8px",borderRadius:compact?8:10,background:active?"rgba(78,205,196,.12)":"var(--s2)",border:`1px solid ${active?"#4ECDC4":"var(--border)"}`,color:active?"var(--cyan)":"var(--muted)",fontSize:compact?10:12,fontWeight:800}},option.value.toUpperCase());
            })
          )
        )
      ),
      React.createElement('button',{type:"button",onClick:()=>setSettings(current=>({...current,stravaEnabled:!current.stravaEnabled})),style:{display:"flex",alignItems:"center",justifyContent:"space-between",background:settings.stravaEnabled?"rgba(78,205,196,.08)":"var(--s2)",border:`1px solid ${settings.stravaEnabled?"#4ECDC4":"var(--border)"}`,borderRadius:compact?10:12,padding:compact?"10px 11px":"12px 14px",color:"var(--text)"}},
        React.createElement('div',null,
          React.createElement('div',{style:{fontWeight:800,fontSize:compact?11:14,marginBottom:3}},"Strava integration"),
          React.createElement('div',{style:{fontSize:compact?11:12,color:"#1E4040",lineHeight:1.35}},"Turn this on if your Bloc plans to accept Strava-verified runs.")
        ),
        React.createElement('span',{className:"mono",style:{fontSize:10,color:settings.stravaEnabled?"var(--cyan)":"var(--muted)",letterSpacing:".08em",textTransform:"uppercase"}},settings.stravaEnabled?"On":"Off")
      )
    ),
    React.createElement('div',{style:{padding:compact?"6px 8px":"14px",borderRadius:compact?10:12,background:"rgba(101,101,122,.05)",border:"1px solid var(--border)",display:"grid",gap:3}},
      React.createElement('div',{className:"lbl"},"Fixed rules"),
      [
        "Season length: one calendar month",
        "Month closes at 5:00 AM on the 1st of each month"
      ].map(rule=>React.createElement('div',{key:rule,style:{fontSize:compact?11:12,color:compact?"#1E4040":"var(--muted)",lineHeight:1.25}},rule))
    )
  );
};


const GroupCreateModal = ({onCreate,onClose,creating,defaultCreatorName="",defaultTimeZone=DEFAULT_GROUP_TIME_ZONE,lockCreatorName=false,initialGroupName="",requireCreatorName=true}) => {
  const compactMobile = isMobile();
  const [groupName,setGroupName]=useState(initialGroupName);
  const [creatorName,setCreatorName]=useState(defaultCreatorName);
  const [settings,setSettings]=useState({
    ...SETTINGS_DEFAULTS,
    acceptedWorkoutTypes:[...WORKOUT_TYPES],
    timeZone:defaultTimeZone,
    feeModel:DEFAULT_FEE_MODEL,
    escalationStepAmount: DEFAULT_FINE_AMOUNT
  });
  const [submitAttempted,setSubmitAttempted]=useState(false);
  const normalizedSettings = buildNormalizedSettings(settings);
  const escalationStepMissing = normalizedSettings.feeModel === "escalating" && normalizedSettings.escalationStepAmount === null;
  const canCreate = groupName.trim() && (!requireCreatorName || creatorName.trim()) && normalizedSettings.acceptedWorkoutTypes.length > 0 && !creating;
  const createProgressSteps = ["Creating your Bloc", "Doing the final touches", "Almost done", "Opening your Bloc"];
  const [createProgressStep,setCreateProgressStep]=useState(0);

  useEffect(()=>{
    if (!creating) {
      setCreateProgressStep(0);
      return undefined;
    }
    const timers = [
      window.setTimeout(()=>setCreateProgressStep(1), 2200),
      window.setTimeout(()=>setCreateProgressStep(2), 4700),
      window.setTimeout(()=>setCreateProgressStep(3), 7200)
    ];
    return ()=>timers.forEach(timer=>window.clearTimeout(timer));
  },[creating]);

  return React.createElement('div',{className:`overlay${compactMobile ? " center-mobile" : ""}`,onClick:creating ? undefined : onClose},
    React.createElement('div',{className:"modal setup-create-modal",onClick:e=>e.stopPropagation(),style:{position:"relative",overflow:"hidden",maxWidth:400,padding:"24px 20px 18px",fontFamily:UI_FONT,background:"radial-gradient(circle at 50% -18%, rgba(78,205,196,.16), transparent 36%), linear-gradient(180deg, rgba(11,25,24,.98), rgba(7,15,14,.98))",border:"0.5px solid rgba(78,205,196,.22)",boxShadow:"inset 0 1px 0 rgba(255,255,255,.07), 0 22px 54px rgba(0,0,0,.46), 0 0 42px rgba(78,205,196,.08)"}},
      creating && React.createElement('div',{style:{position:"absolute",inset:0,zIndex:4,display:"grid",placeItems:"center",padding:24,background:"radial-gradient(circle at 50% 8%, rgba(78,205,196,.14), transparent 38%), rgba(7,15,14,.96)",backdropFilter:"blur(8px)"}},
        React.createElement('div',{style:{width:"min(220px, 78%)",display:"grid",gap:12,justifyItems:"center"}},
          React.createElement('div',{style:{fontFamily:UI_FONT,fontSize:14,fontWeight:900,color:"var(--text)",textAlign:"center"}},createProgressSteps[createProgressStep]),
          React.createElement('div',{style:{width:"100%",height:5,borderRadius:999,background:"rgba(78,205,196,.13)",border:"1px solid rgba(78,205,196,.13)",overflow:"hidden"}},
            React.createElement('div',{style:{height:"100%",width:`${[24,50,76,94][createProgressStep]}%`,borderRadius:999,background:"#4ECDC4",boxShadow:"0 0 16px rgba(78,205,196,.28)",transition:"width .55s ease"}})
          )
        )
      ),
      React.createElement('div',{style:{fontFamily:DISPLAY_FONT,fontWeight:800,fontSize:22,letterSpacing:0,lineHeight:1.08,marginBottom:6}},"Create a Bloc"),
      React.createElement('div',{style:{fontFamily:UI_FONT,color:"var(--muted)",fontSize:13,lineHeight:1.35,marginBottom:17,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}},"Start the Bloc now. Tune the rules after."),
      [
        ["Bloc Name",groupName,setGroupName,"Sunday Runners"],
        ...(!lockCreatorName && requireCreatorName ? [["Your Name",creatorName,setCreatorName,"Aadhil"]] : [])
      ].map(([label,value,setter,placeholder])=>
        React.createElement('label',{key:label,style:{display:"block",marginBottom:14}},
          React.createElement('div',{style:setupFieldTitleStyle},label),
          React.createElement('input',{value,onChange:e=>setter(e.target.value),placeholder,style:{...inputShellStyle,width:"100%",fontFamily:UI_FONT,fontSize:14,borderRadius:10}})
        )
      ),
      React.createElement('div',{style:{marginBottom:14}},
        React.createElement('div',{style:setupFieldTitleStyle},"Monthly Penalty Amount"),
        React.createElement('div',{style:setupFieldHelpStyle},"What each person who misses the target owes."),
        React.createElement('div',{style:{display:"grid",gridTemplateColumns:"108px 1fr",gap:8,alignItems:"stretch"}},
          React.createElement(SelectField,{
            value:settings.currency,
            onChange:e=>setSettings(current=>({...current,currency:e.target.value})),
            width:"100%",
            textAlign:"center",
            options:CURRENCY_OPTIONS.map(option=>({value:option.code,label:option.code})),
            arrowColor:"#4ECDC4"
          }),
          React.createElement('input',{type:"number",min:1,value:settings.fineAmount,onChange:e=>setSettings(current=>({...current,fineAmount:e.target.value,escalationStepAmount:e.target.value})),style:{...inputShellStyle,width:"100%",fontFamily:UI_FONT,fontSize:15,textAlign:"center"}})
        )
      ),
      React.createElement('div',{style:{marginBottom:14}},
        React.createElement('div',{style:setupFieldTitleStyle},"Monthly Workout Target"),
        React.createElement('div',{style:setupFieldHelpStyle},"Between 6 and 30 workouts per month."),
        React.createElement(StepperField,{value:settings.minTarget,onChange:value=>setSettings(current=>({...current,minTarget:value})),min:6,max:30})
      ),
      React.createElement('button',{
        type:"button",
        onClick:()=>setSettings(current=>({...current,trainingWheels:!(current.trainingWheels !== false)})),
        "aria-pressed":settings.trainingWheels !== false,
        style:{
          width:"100%",textAlign:"left",display:"flex",alignItems:"flex-start",gap:11,marginBottom:14,
          padding:"11px 12px",borderRadius:11,fontFamily:UI_FONT,
          border:settings.trainingWheels !== false ? "1px solid rgba(78,205,196,.3)" : "1px solid var(--border)",
          background:settings.trainingWheels !== false ? "rgba(78,205,196,.05)" : "rgba(25,27,36,.5)"
        }
      },
        React.createElement('div',{style:{flex:1,minWidth:0}},
          React.createElement('div',{style:{fontSize:13,fontWeight:800,color:"var(--text)",marginBottom:4}},"Training Wheels"),
          // Only the helper line changes between states, so the row keeps its
          // height and the buttons below it never move under a thumb.
          React.createElement('div',{style:{fontSize:12,color:"var(--muted)",lineHeight:1.38}},
            settings.trainingWheels !== false
              ? "Month one is penalty-free for everyone."
              : "No warm-up. Penalties from day one."
          )
        ),
        React.createElement('span',{style:{
          width:40,height:23,borderRadius:999,flexShrink:0,position:"relative",marginTop:1,
          transition:"background .18s",
          background:settings.trainingWheels !== false ? "#4ECDC4" : "#2A2E39"
        }},
          React.createElement('span',{style:{
            position:"absolute",top:3,width:17,height:17,borderRadius:999,transition:"left .18s",
            left:settings.trainingWheels !== false ? 20 : 3,
            background:settings.trainingWheels !== false ? "#050909" : "#767C88"
          }})
        )
      ),
      submitAttempted && escalationStepMissing && React.createElement('div',{style:{fontSize:12,color:"var(--red)",marginTop:-6,marginBottom:10}},"Set a step amount to continue."),
      React.createElement('div',{style:{display:"grid",gridTemplateColumns:"0.82fr 1.18fr",gap:9,marginTop:18}},
        React.createElement('button',{className:"setup-press",disabled:creating,onClick:onClose,style:{background:"transparent",border:"1px solid #163d36",color:"var(--muted)",padding:"13px 12px",borderRadius:11,fontFamily:UI_FONT,fontSize:14,fontWeight:700}},"Cancel"),
        React.createElement('button',{className:"setup-press",disabled:!canCreate,onClick:()=>{
          setSubmitAttempted(true);
          if (!canCreate || escalationStepMissing) return;
          onCreate({
          groupName,
          creatorName,
          ...normalizedSettings,
          groupTimeZone: normalizedSettings.timeZone
        });
        },style:{background:canCreate?"#4ECDC4":"var(--s3)",color:canCreate?"#050909":"var(--muted2)",padding:"14px 14px",borderRadius:12,fontFamily:UI_FONT,fontSize:15,fontWeight:900,boxShadow:canCreate?"0 12px 26px rgba(78,205,196,.16)":"none"}},creating?"Creating...":"Create")
      )
    )
  );
};


const GroupSettingsModal = ({group,actor,actorUserId,onSave,onClose,saving,onReviewSitOut,onKickMember}) => {
  const [groupName,setGroupName]=useState(group.name);
  const [showAdvanced,setShowAdvanced]=useState(false);
  const [settings,setSettings]=useState({...SETTINGS_DEFAULTS,...group.settings});
  const [submitAttempted,setSubmitAttempted]=useState(false);
  const [kickingUserId,setKickingUserId]=useState(null);
  const [confirmKick,setConfirmKick]=useState(null);
  const [removedTypeWarnings,setRemovedTypeWarnings]=useState(null);
  const inviteLink = `${window.location.origin}${window.location.pathname}?invite=${group.inviteCode}`;
  const normalizedSettings = buildNormalizedSettings(settings);
  const escalationStepMissing = normalizedSettings.feeModel === "escalating" && normalizedSettings.escalationStepAmount === null;
  const canSave = groupName.trim() && normalizedSettings.acceptedWorkoutTypes.length > 0 && !saving;
  const pendingSitOuts = Object.values(normalizeSitOutRequests(group?.sitOutRequests)?.[curKey] || {}).filter(request => request.status === "pending");

  useEffect(()=>{
    document.body.style.overflow = "hidden";
    return ()=>{ document.body.style.overflow = ""; };
  },[]);

  return React.createElement(React.Fragment,null,
    React.createElement('div',{onClick:onClose,style:{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",zIndex:999}}),
    React.createElement('div',{onClick:e=>e.stopPropagation(),style:{position:"fixed",top:"50%",left:"50%",transform:"translate(-50%,-50%)",zIndex:1000,width:"calc(100% - 32px)",maxWidth:424,maxHeight:"85vh",overflowY:"auto",background:"#080F0F",border:"0.5px solid #0D1F1E",borderRadius:16,padding:isMobile()?"14px 13px":"16px 14px",boxSizing:"border-box"}},
      React.createElement('button',{type:"button",onClick:onClose,style:{position:"absolute",top:10,right:10,width:36,height:36,display:"inline-flex",alignItems:"center",justifyContent:"center",background:"transparent",color:"#1E4040",fontSize:20,lineHeight:1,padding:0}},"×"),
      React.createElement('div',{style:{fontWeight:800,fontSize:17,marginBottom:12,paddingRight:32}},"Bloc settings"),
      onSave && React.createElement(React.Fragment,null,
        React.createElement('div',{style:{marginBottom:12}},
          React.createElement('div',{className:"lbl",style:{marginBottom:4}},"Invite code"),
          React.createElement('div',{style:{display:"grid",gridTemplateColumns:"1fr auto",gap:8,alignItems:"stretch"}},
            React.createElement('div',{style:{padding:"7px 10px",borderRadius:8,background:"var(--s2)",border:"1px solid var(--border)",fontSize:13,fontWeight:800,color:"#f5f7ff",letterSpacing:".08em",fontFamily:"'JetBrains Mono',monospace"}},group.inviteCode),
            React.createElement('button',{type:"button",onClick:e=>copyToClipboard(group.inviteCode,e.currentTarget),style:{padding:"0 10px",borderRadius:8,background:"var(--s2)",border:"1px solid var(--border)",fontSize:10,fontWeight:700,color:"var(--muted)",minHeight:34}},"Copy code")
          )
        ),
        React.createElement('div',{style:{marginBottom:12}},
          React.createElement('div',{className:"lbl",style:{marginBottom:4}},"Invite link"),
          React.createElement('div',{style:{display:"grid",gridTemplateColumns:"1fr auto",gap:8,alignItems:"stretch"}},
            React.createElement('div',{style:{padding:"7px 9px",borderRadius:8,border:"1px solid rgba(62,62,82,.85)",background:"var(--s2)",fontSize:10,color:"var(--muted)",overflow:"hidden",textOverflow:"ellipsis"}},inviteLink),
            React.createElement('button',{type:"button",onClick:e=>copyToClipboard(inviteLink,e.currentTarget),style:{padding:"0 10px",borderRadius:8,background:"var(--s2)",border:"1px solid var(--border)",fontSize:10,fontWeight:700,color:"var(--muted)",minHeight:34}},"Copy link")
          )
        )
      ),
      React.createElement(SettingsField,{title:"Bloc name",compact:true},
        React.createElement('input',{value:groupName,onChange:e=>onSave&&setGroupName(e.target.value),readOnly:!onSave,style:{width:"85%",background:"var(--s2)",border:"1px solid var(--border)",borderRadius:8,padding:"7px 9px",color:onSave?"var(--text)":"var(--muted)",fontSize:12,outline:"none",cursor:onSave?"text":"default"}})
      ),
      pendingSitOuts.length>0 && React.createElement('div',{style:{marginBottom:14,padding:"11px 12px",borderRadius:10,background:"#080F0F",border:"0.5px solid #0D1F1E",display:"grid",gap:8}},
        React.createElement('div',{style:{fontWeight:800,fontSize:13}},"Pending sit-out requests"),
        pendingSitOuts.map(request=>React.createElement('div',{key:`${request.monthKey}-${request.memberName}`,style:{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,padding:"8px 10px",borderRadius:9,background:"var(--s2)",border:"1px solid var(--border)"}},
          React.createElement('div',null,
            React.createElement('div',{style:{fontWeight:700,fontSize:12}},request.memberName),
            React.createElement('div',{style:{fontSize:11,color:"var(--muted)",marginTop:2}},request.reason || (request.exceptional ? "Exceptional request" : "No reason provided"))
          ),
          React.createElement('div',{style:{display:"flex",gap:8}},
            React.createElement('button',{type:"button",onClick:()=>onReviewSitOut && onReviewSitOut({memberName:request.memberName,monthKey:request.monthKey,decision:"decline"}),style:{padding:"7px 10px",borderRadius:9,background:"transparent",border:"1px solid var(--border)",color:"var(--muted)",fontSize:11,fontWeight:700}},"Decline"),
            React.createElement('button',{type:"button",onClick:()=>onReviewSitOut && onReviewSitOut({memberName:request.memberName,monthKey:request.monthKey,decision:"approve"}),style:{padding:"7px 10px",borderRadius:9,background:"#4ECDC4",color:"#050909",fontSize:11,fontWeight:800}},"Approve")
          )
        ))
      ),
      React.createElement('div',{style:onSave?{}:{pointerEvents:"none",opacity:0.4}},
        React.createElement(GroupSettingsFields,{settings,setSettings,showAdvanced,setShowAdvanced,showValidation:submitAttempted,compact:true,lockCurrency:true})
      ),
      onKickMember && React.createElement('div',{style:{marginTop:14,marginBottom:4}},
        React.createElement('div',{style:{fontWeight:700,fontSize:12,color:"var(--text)",marginBottom:8,letterSpacing:".04em"}},`Members (${getCurrentGroupMemberNames(group).length})`),
        React.createElement('div',{style:{display:"grid",gap:6}},
          getCurrentGroupMemberNames(group).map(displayName=>{
            const membershipEntry = Object.values(group.memberships||{}).find(m=>m.displayName===displayName);
            const memberId = membershipEntry?.userId || null;
            const isMe = memberId ? memberId===actorUserId : displayName===actor;
            const kickKey = memberId || displayName;
            const kicking = kickingUserId===kickKey;
            return React.createElement('div',{key:displayName,style:{display:"flex",alignItems:"center",gap:10,padding:"8px 10px",borderRadius:10,background:"var(--s2)",border:"1px solid var(--border)"}},
              React.createElement(Avatar,{name:displayName,size:28}),
              React.createElement('span',{style:{flex:1,fontSize:13,fontWeight:600,color:"var(--text)"}},displayName,isMe&&React.createElement('span',{style:{fontSize:10,color:"var(--muted)",marginLeft:6}},"(you)")),
              !isMe && (confirmKick===kickKey
                ? React.createElement('div',{style:{display:"flex",gap:6,alignItems:"center"}},
                    React.createElement('button',{type:"button",onClick:()=>setConfirmKick(null),style:{padding:"5px 8px",borderRadius:8,background:"var(--s3)",border:"1px solid var(--border)",color:"var(--muted)",fontSize:11,fontWeight:600}},"Cancel"),
                    React.createElement('button',{type:"button",disabled:!!kicking,onClick:async()=>{
                      setKickingUserId(kickKey);
                      setConfirmKick(null);
                      await onKickMember(memberId, displayName);
                      setKickingUserId(null);
                    },style:{padding:"5px 10px",borderRadius:8,background:"transparent",border:"1px solid rgba(180,60,60,.25)",color:"rgba(180,80,80,.55)",fontSize:11,fontWeight:600}},kicking?"Removing...":"Confirm remove")
                  )
                : React.createElement('button',{type:"button",onClick:()=>setConfirmKick(kickKey),style:{padding:"5px 10px",borderRadius:8,background:"transparent",border:"1px solid var(--red-dim)",color:"var(--red)",fontSize:11,fontWeight:700}},"Remove")
              )
            );
          })
        )
      ),
      removedTypeWarnings && React.createElement('div',{style:{marginTop:14,padding:"12px 13px",borderRadius:10,background:"rgba(240,165,0,.06)",border:"1px solid rgba(240,165,0,.25)"}},
        React.createElement('div',{style:{fontWeight:700,fontSize:13,color:"var(--amber)",marginBottom:8}},"Heads up — workouts already logged"),
        removedTypeWarnings.map(({type,lines})=>
          React.createElement('div',{key:type,style:{marginBottom:6}},
            lines.map((line,i)=>React.createElement('div',{key:i,style:{fontSize:12,color:"var(--text-soft)",lineHeight:1.5}},line))
          )
        ),
        React.createElement('div',{style:{fontSize:12,color:"var(--muted)",marginTop:4}},"These workouts will still count — only new logs of this type will be blocked."),
        React.createElement('div',{style:{display:"flex",gap:8,marginTop:10}},
          React.createElement('button',{type:"button",onClick:()=>setRemovedTypeWarnings(null),style:{flex:1,background:"var(--s2)",border:"1px solid var(--border)",color:"var(--muted)",padding:"10px",borderRadius:9,fontSize:13,fontWeight:600}},"Go back"),
          React.createElement('button',{type:"button",disabled:saving,onClick:()=>{ setRemovedTypeWarnings(null); onSave(groupName.trim(), normalizedSettings); },style:{flex:1,background:"var(--amber)",border:"none",color:"#000",padding:"10px",borderRadius:9,fontSize:13,fontWeight:800}},saving?"Saving...":"Save anyway")
        )
      ),
      !removedTypeWarnings && React.createElement('div',{style:{display:"flex",gap:9,marginTop:14}},
        React.createElement('button',{onClick:onClose,style:{flex:1,background:"var(--s2)",border:"1px solid var(--border)",color:"var(--muted)",padding:"14px",borderRadius:10,fontSize:15,fontWeight:600}},"Close"),
        onSave && React.createElement('button',{disabled:!canSave,onClick:()=>{
          setSubmitAttempted(true);
          if (!canSave || escalationStepMissing) return;
          const currentAccepted = group.settings?.acceptedWorkoutTypes || WORKOUT_TYPES;
          const newAccepted = normalizedSettings.acceptedWorkoutTypes;
          const removedTypes = currentAccepted.filter(t => !newAccepted.includes(t));
          if (removedTypes.length) {
            const currentMonthLogs = Object.values(group.logs || {}).flat();
            const warnings = removedTypes.flatMap(type => {
              const affected = Object.entries(group.logs || {}).map(([name, logs]) => ({
                name,
                count: (logs || []).filter(l => l.type === type && normalizeFlagStatus(l.flagStatus) !== "rejected").length
              })).filter(e => e.count > 0);
              if (!affected.length) return [];
              const lines = affected.map(({name,count}) => `${name} has logged ${count} ${type} workout${count===1?"":"s"} this month.`);
              return [{type, lines}];
            });
            if (warnings.length) { setRemovedTypeWarnings(warnings); return; }
          }
          onSave(groupName.trim(), normalizedSettings);
        },style:{flex:1,background:canSave?"var(--green)":"var(--s3)",color:canSave?"#000":"var(--muted2)",padding:"14px",borderRadius:10,fontSize:15,fontWeight:800}},saving?"Saving...":"Save")
      ),
    )
  );
};


const CropModal = ({imageSrc, onConfirm, onCancel}) => {
  const containerRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [naturalSize, setNaturalSize] = useState({w:0,h:0});
  const [containerSize, setContainerSize] = useState({w:0,h:0});
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({x:0,y:0});
  const gestureRef = useRef({type:null,lastX:0,lastY:0,lastDist:0,startScale:1,startOffset:{x:0,y:0}});
  const stateRef = useRef({scale:1,offset:{x:0,y:0},naturalSize:{w:0,h:0},containerSize:{w:0,h:0}});
  stateRef.current = {scale,offset,naturalSize,containerSize};
  const CROP_RATIO = 0.82;

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const cw = rect.width, ch = rect.height;
      const ns = {w:img.naturalWidth, h:img.naturalHeight};
      const cropPx = Math.min(cw,ch) * CROP_RATIO;
      const initScale = cropPx / Math.min(ns.w, ns.h);
      setNaturalSize(ns);
      setContainerSize({w:cw,h:ch});
      setScale(initScale);
      setOffset({x:0,y:0});
      setReady(true);
    };
    img.src = imageSrc;
  }, [imageSrc]);

  const clamp = (ox, oy, s, ns, cw, ch) => {
    const cropPx = Math.min(cw,ch) * CROP_RATIO;
    const imgW = ns.w * s, imgH = ns.h * s;
    const maxX = Math.max(0, imgW/2 - cropPx/2);
    const maxY = Math.max(0, imgH/2 - cropPx/2);
    return {x: Math.max(-maxX, Math.min(maxX, ox)), y: Math.max(-maxY, Math.min(maxY, oy))};
  };

  const minScale = () => {
    const {naturalSize:ns, containerSize:{w:cw,h:ch}} = stateRef.current;
    if (!ns.w || !ns.h) return 1;
    return Math.min(cw,ch) * CROP_RATIO / Math.min(ns.w, ns.h);
  };

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onTouchStart = e => {
      const g = gestureRef.current;
      const {scale:s, offset:o} = stateRef.current;
      if (e.touches.length === 1) {
        g.type = 'pan'; g.lastX = e.touches[0].clientX; g.lastY = e.touches[0].clientY;
        g.startScale = s; g.startOffset = {...o};
      } else if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        g.type = 'pinch'; g.lastDist = Math.sqrt(dx*dx+dy*dy);
        g.startScale = s; g.startOffset = {...o};
      }
    };
    const onTouchMove = e => {
      e.preventDefault();
      const g = gestureRef.current;
      const {naturalSize:ns, containerSize:{w:cw,h:ch}, scale:s, offset:o} = stateRef.current;
      if (g.type === 'pan' && e.touches.length >= 1) {
        const dx = e.touches[0].clientX - g.lastX;
        const dy = e.touches[0].clientY - g.lastY;
        g.lastX = e.touches[0].clientX; g.lastY = e.touches[0].clientY;
        const clamped = clamp(o.x+dx, o.y+dy, s, ns, cw, ch);
        setOffset(clamped);
      } else if (g.type === 'pinch' && e.touches.length >= 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.sqrt(dx*dx+dy*dy);
        const newScale = Math.max(minScale(), Math.min(g.startScale * 6, g.startScale * dist / g.lastDist));
        const clamped = clamp(o.x, o.y, newScale, ns, cw, ch);
        setScale(newScale);
        setOffset(clamped);
      }
    };
    const onTouchEnd = () => { gestureRef.current.type = null; };
    el.addEventListener('touchstart', onTouchStart, {passive:true});
    el.addEventListener('touchmove', onTouchMove, {passive:false});
    el.addEventListener('touchend', onTouchEnd, {passive:true});
    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
    };
  }, [ready]);

  const handleConfirm = () => {
    const {naturalSize:ns, containerSize:{w:cw,h:ch}, scale:s, offset:o} = stateRef.current;
    const cropPx = Math.min(cw,ch) * CROP_RATIO;
    const imgLeft = cw/2 + o.x - ns.w*s/2;
    const imgTop  = ch/2 + o.y - ns.h*s/2;
    const cropLeft = cw/2 - cropPx/2;
    const cropTop  = ch/2 - cropPx/2;
    const srcX = (cropLeft - imgLeft) / s;
    const srcY = (cropTop  - imgTop)  / s;
    const srcSize = cropPx / s;
    const canvas = document.createElement('canvas');
    canvas.width = 1080; canvas.height = 1080;
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, srcX, srcY, srcSize, srcSize, 0, 0, 1080, 1080);
      onConfirm(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.src = imageSrc;
  };

  const {w:cw, h:ch} = containerSize;
  const cropPx = cw ? Math.min(cw,ch) * CROP_RATIO : 0;

  return React.createElement('div', {style:{position:'fixed',inset:0,zIndex:9999,background:'rgba(0,0,0,0.97)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'0 0 env(safe-area-inset-bottom,0)'}},
    React.createElement('div', {style:{fontSize:14,color:'#fff',fontWeight:700,marginBottom:14,letterSpacing:'.01em'}}, 'Crop photo'),
    React.createElement('div', {
      ref: containerRef,
      style:{position:'relative',width:'100%',maxWidth:480,height:400,overflow:'hidden',background:'#000',touchAction:'none',userSelect:'none',WebkitUserSelect:'none'}
    },
      ready && React.createElement('img', {
        src: imageSrc,
        draggable: false,
        style:{
          position:'absolute',
          width: naturalSize.w * scale,
          height: naturalSize.h * scale,
          left:'50%', top:'50%',
          transform:`translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`,
          pointerEvents:'none',
          userSelect:'none',
          WebkitUserSelect:'none'
        }
      }),
      cropPx > 0 && React.createElement('div', {style:{position:'absolute',inset:0,pointerEvents:'none'}},
        React.createElement('div', {style:{
          position:'absolute',
          left:'50%', top:'50%',
          width:cropPx, height:cropPx,
          transform:'translate(-50%,-50%)',
          boxShadow:'0 0 0 9999px rgba(0,0,0,0.58)',
          border:'2px solid rgba(255,255,255,0.75)',
          borderRadius:10
        }})
      )
    ),
    React.createElement('div', {style:{fontSize:11,color:'rgba(255,255,255,0.35)',marginTop:10,marginBottom:20}},'Drag to reposition · Pinch to zoom'),
    React.createElement('div', {style:{display:'flex',gap:12}},
      React.createElement('button', {type:'button',onClick:onCancel,style:{height:44,padding:'0 28px',borderRadius:999,background:'rgba(255,255,255,0.08)',border:'1px solid rgba(255,255,255,0.15)',color:'#fff',fontSize:14,fontWeight:600}}, 'Cancel'),
      React.createElement('button', {type:'button',onClick:handleConfirm,style:{height:44,padding:'0 28px',borderRadius:999,background:'var(--cyan)',border:'none',color:'#04110a',fontSize:14,fontWeight:700}}, 'Done')
    )
  );
};


const LogModal = ({user,currentUserId,currentGroupId,groups,onConfirm,onClose}) => {
  const compactMobile = isMobile();
  const [wType,setWType]=useState(null);
  const [selDate,setSelDate]=useState(TODAY_ISO);
  const [note,setNote]=useState("");
  const [photoUrl,setPhotoUrl]=useState("");
  const [uploading,setUploading]=useState(false);
  const [photoError,setPhotoError]=useState("");
  const [cropSource,setCropSource]=useState(null);
  const takePhotoInputRef = useRef(null);
  const choosePhotoInputRef = useRef(null);
  const currentGroup = groups.find(group => group.id === currentGroupId) || null;
  const visibleWorkoutTypes = getAcceptedWorkoutTypes(currentGroup);
  const timeContext = currentGroup ? getTimeContextForGroup(currentGroup) : getTimeContextForGroup(null);
  const isCurrentMonthSelection = getMonthKeyFromISO(selDate) === timeContext.monthKey;
  const workoutsLoggedForDate = useMemo(
    () => getDistinctWorkoutCountForDate(groups, currentUserId, user, selDate),
    [groups, currentUserId, user, selDate]
  );
  const loggingAnotherWorkout = workoutsLoggedForDate === 1;
  const alreadyLogged = workoutsLoggedForDate >= MAX_WORKOUTS_PER_DAY;
  const eligibleGroups = useMemo(() => {
    if (!wType || !isCurrentMonthSelection) return [];
    return groups
      .filter(group => group.id !== currentGroupId && getCurrentGroupMemberNames(group).includes(user) && groupCountsWorkoutType(group, wType))
      .map(group => {
        return {
          id: group.id,
          name: group.name,
          acceptsType: true,
          alreadyLogged: false,
          disabled: false,
          helper: ""
        };
      });
  }, [groups, isCurrentMonthSelection, selDate, user, wType]);
  const [selectedGroupIds,setSelectedGroupIds]=useState([]);

  useEffect(() => {
    if (!wType) {
      setSelectedGroupIds([]);
      return;
    }
    setSelectedGroupIds(eligibleGroups.filter(group => !group.disabled).map(group => group.id));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wType]); // intentionally omit eligibleGroups — only reset on workout type change, not on every state update

  useEffect(() => {
    const bodyStyle = document.body.style;
    const rootStyle = document.documentElement.style;
    const prevBodyOverflow = bodyStyle.overflow;
    const prevRootOverflow = rootStyle.overflow;
    const prevBodyTouchAction = bodyStyle.touchAction;
    bodyStyle.overflow = "hidden";
    rootStyle.overflow = "hidden";
    bodyStyle.touchAction = "none";
    return () => {
      bodyStyle.overflow = prevBodyOverflow;
      rootStyle.overflow = prevRootOverflow;
      bodyStyle.touchAction = prevBodyTouchAction;
    };
  }, []);

  const toggleGroupSelection = groupId => {
    setSelectedGroupIds(current => current.includes(groupId)
      ? current.filter(id => id !== groupId)
      : [...current, groupId]
    );
  };

  const handlePhotoPick = async event => {
    const file = event.target.files?.[0];
    if (!file) return;
    setPhotoError("");
    const reader = new FileReader();
    reader.onload = () => setCropSource(reader.result);
    reader.onerror = () => setPhotoError("Unable to load that image");
    reader.readAsDataURL(file);
    event.target.value = "";
  };

  const handleCropConfirm = async (croppedDataUrl) => {
    setCropSource(null);
    setUploading(true);
    try {
      const compressed = await compressImageDataUrl(croppedDataUrl, 720, 0.72);
      const storageUrl = await uploadPhotoToStorage(compressed);
      setPhotoUrl(storageUrl);
    } catch {
      setPhotoError("Photo couldn't be uploaded. Please check your connection and try again.");
    } finally {
      setUploading(false);
    }
  };

  const handleCropCancel = () => setCropSource(null);

  const needsNote = wType === "Other";
  const canSubmit = Boolean(wType && photoUrl && !alreadyLogged && (!needsNote || note.trim()));
  const modalFrameStyle = compactMobile
    ? { position:"fixed", top:"50%", left:"50%", transform:"translate(-50%,-50%)", zIndex:1000, width:"calc(100% - 32px)", maxWidth:440, maxHeight:"calc(100dvh - 170px - env(safe-area-inset-bottom))", overflowY:"auto", background:"radial-gradient(circle at 50% -18%, rgba(78,205,196,.13), transparent 34%), linear-gradient(180deg, rgba(10,24,23,.99), rgba(8,15,15,.99))", border:"0.5px solid rgba(78,205,196,.2)", borderRadius:20, padding:"16px 14px", boxSizing:"border-box", boxShadow:"inset 0 1px 0 rgba(255,255,255,.055), 0 24px 62px rgba(0,0,0,.58), 0 0 34px rgba(78,205,196,.07)", fontFamily:UI_FONT }
    : { position:"fixed", top:"50%", left:"50%", transform:"translate(-50%,-50%)", zIndex:1000, width:"calc(100% - 32px)", maxWidth:440, maxHeight:"85vh", overflowY:"auto", background:"radial-gradient(circle at 50% -18%, rgba(78,205,196,.13), transparent 34%), linear-gradient(180deg, rgba(10,24,23,.99), rgba(8,15,15,.99))", border:"0.5px solid rgba(78,205,196,.2)", borderRadius:20, padding:"20px 18px", boxSizing:"border-box", boxShadow:"inset 0 1px 0 rgba(255,255,255,.055), 0 24px 62px rgba(0,0,0,.58), 0 0 34px rgba(78,205,196,.07)", fontFamily:UI_FONT };
  const logFieldLabelStyle = {fontFamily:UI_FONT,marginBottom:6,color:"var(--text)",fontSize:10,fontWeight:800,textTransform:"uppercase",letterSpacing:".08em"};
  const handleDateChange = event => {
    const value = event.target.value;
    if (!value) return;
    const clamped = value < timeContext.earliestIso
      ? timeContext.earliestIso
      : value > timeContext.todayIso
        ? timeContext.todayIso
        : value;
    setSelDate(clamped);
  };

  if (cropSource) return React.createElement(CropModal, {imageSrc:cropSource, onConfirm:handleCropConfirm, onCancel:handleCropCancel});

  return React.createElement(React.Fragment,null,
    React.createElement('div',{onClick:onClose,style:{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",zIndex:999}}),
    React.createElement('div',{className:"log-workout-modal",onClick:e=>e.stopPropagation(),style:modalFrameStyle},
      React.createElement('div',{style:{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:10,marginBottom:compactMobile?9:14}},
        React.createElement('div',{style:{minWidth:0}},
          React.createElement('div',{style:{fontFamily:DISPLAY_FONT,fontWeight:800,fontSize:compactMobile?18:20,letterSpacing:0,lineHeight:1.08}},loggingAnotherWorkout?"Log another workout":"Log a workout")
        )
      ),
      React.createElement('span',{style:logFieldLabelStyle},"Date"),
      React.createElement('input',{type:"date",value:selDate,min:timeContext.earliestIso,max:timeContext.todayIso,onChange:handleDateChange,
        style:{width:"100%",maxWidth:"100%",minWidth:0,display:"block",height:34,background:"var(--s1)",border:`1px solid ${alreadyLogged?"var(--red)":"rgba(13,31,30,.8)"}`,borderRadius:10,padding:"7px 10px",color:"#9BA6B5",fontSize:13,lineHeight:"18px",marginBottom:alreadyLogged?4:(compactMobile?7:10),outline:"none",boxSizing:"border-box",appearance:"none",WebkitAppearance:"none",opacity:0.92,fontFamily:UI_FONT}}),
      alreadyLogged&&React.createElement('div',{style:{color:"var(--red)",fontSize:compactMobile?11:12,fontFamily:UI_FONT,fontWeight:700,marginBottom:compactMobile?7:10}},"Already logged 2 workouts for this date"),
      React.createElement('span',{style:logFieldLabelStyle},"Workout type"),
      React.createElement('div',{style:{display:"grid",gridTemplateColumns:"repeat(5,minmax(0,1fr))",gap:compactMobile?5:6,marginBottom:compactMobile?8:12}},
        visibleWorkoutTypes.map(t=>React.createElement('button',{key:t,onClick:()=>setWType(t),type:"button",
          style:{minWidth:0,background:wType===t?"var(--green-dim)":"rgba(25,27,36,.82)",border:`1px solid ${wType===t?"var(--green)":"rgba(78,205,196,.16)"}`,borderRadius:10,padding:compactMobile?"7px 2px":"8px 4px",display:"flex",flexDirection:"column",alignItems:"center",gap:compactMobile?3:4,color:wType===t?"var(--green)":"var(--text)"}},
          React.createElement('span',{style:{width:compactMobile?24:30,height:compactMobile?24:30,display:"inline-flex",alignItems:"center",justifyContent:"center"}},React.createElement(WorkoutTypeIcon,{type:t,size:compactMobile?18:22})),
          React.createElement('span',{style:{fontSize:compactMobile?10:11,fontWeight:600,lineHeight:1.1}},t)
        ))
      ),
      React.createElement('span',{style:logFieldLabelStyle},"Photo"),
      React.createElement('input',{ref:takePhotoInputRef,type:"file",accept:"image/*",capture:"environment",onChange:handlePhotoPick,style:{display:"none"}}),
      React.createElement('input',{ref:choosePhotoInputRef,type:"file",accept:"image/*",onChange:handlePhotoPick,style:{display:"none"}}),
      !photoUrl && React.createElement('div',{style:{display:"flex",alignItems:"center",gap:6,minHeight:36,padding:"0 8px",borderRadius:12,background:"rgba(25,27,36,.82)",border:"1px solid rgba(78,205,196,.16)",marginBottom:7}},
        React.createElement('span',{style:{flex:1,minWidth:0,fontSize:13,fontWeight:600,color:"var(--text)",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}},uploading?"Processing photo...":"Add photo"),
        React.createElement('div',{style:{display:"flex",alignItems:"center",gap:4,flexShrink:0}},
          React.createElement('button',{type:"button",onClick:()=>takePhotoInputRef.current?.click(),style:{height:26,padding:"0 9px",borderRadius:999,background:"var(--s1)",border:"1px solid rgba(78,205,196,.16)",fontSize:10.5,fontWeight:700,color:"var(--text)"}},"Camera"),
          React.createElement('button',{type:"button",onClick:()=>choosePhotoInputRef.current?.click(),style:{height:26,padding:"0 9px",borderRadius:999,background:"var(--s1)",border:"1px solid rgba(78,205,196,.16)",fontSize:10.5,fontWeight:700,color:"var(--text)"}},"Library")
        )
      ),
      photoUrl && React.createElement('div',{style:{display:"grid",gap:5,marginBottom:7}},
        React.createElement('label',{style:{display:"block",cursor:"pointer"}},
          React.createElement('div',{style:{minHeight:compactMobile?72:114,borderRadius:14,border:"1px dashed rgba(31,206,101,.35)",background:"rgba(31,206,101,.04)",display:"flex",alignItems:"center",justifyContent:"center",overflow:"hidden"}},
            React.createElement('img',{src:resolveStorageImageUrl(photoUrl),alt:"Workout preview",style:{display:"block",width:"100%",maxHeight:compactMobile?104:176,objectFit:"cover"}})
          )
        ),
        React.createElement('div',{style:{display:"flex",justifyContent:"center",gap:5}},
          React.createElement('button',{type:"button",onClick:()=>takePhotoInputRef.current?.click(),style:{height:23,padding:"0 8px",borderRadius:999,background:"rgba(25,27,36,.82)",border:"1px solid rgba(78,205,196,.16)",fontSize:10,fontWeight:700,color:"var(--text)"}},"Camera"),
          React.createElement('button',{type:"button",onClick:()=>choosePhotoInputRef.current?.click(),style:{height:23,padding:"0 8px",borderRadius:999,background:"rgba(25,27,36,.82)",border:"1px solid rgba(78,205,196,.16)",fontSize:10,fontWeight:700,color:"var(--text)"}},"Library")
        )
      ),
      photoError && React.createElement('div',{style:{fontSize:12,color:"var(--red)",marginBottom:7}},photoError),
      React.createElement('span',{style:logFieldLabelStyle},needsNote?"Describe your workout":"Add a note (optional)"),
      React.createElement('div',{style:{position:"relative",marginBottom:compactMobile?8:12}},
        React.createElement('textarea',{value:note,onChange:e=>setNote(e.target.value.slice(0,WORKOUT_NOTE_LIMIT)),rows:compactMobile?2:3,placeholder:needsNote?"e.g. swim, home workout, martial arts":"e.g. trail run, home workout, yoga",style:{width:"100%",resize:"none",background:"var(--s2)",border:`1px solid ${needsNote&&!note.trim()?"rgba(240,165,0,.28)":"var(--border)"}`,borderRadius:10,padding:compactMobile?"9px 44px 16px 11px":"10px 48px 17px 13px",color:"var(--text)",fontSize:compactMobile?13:14,outline:"none",boxSizing:"border-box",fontFamily:UI_FONT,display:"block"}}),
        React.createElement('div',{style:{position:"absolute",right:9,bottom:5,fontFamily:UI_FONT,fontSize:8.5,color:"var(--muted2)",pointerEvents:"none"}},`${note.length}/${WORKOUT_NOTE_LIMIT}`)
      ),
      wType && eligibleGroups.length > 0 && React.createElement('div',{style:{marginBottom:compactMobile?10:16}},
        React.createElement('span',{style:logFieldLabelStyle},"Also Log To"),
        React.createElement('div',{style:{display:"flex",flexWrap:"wrap",gap:6}},
          eligibleGroups.map(group => React.createElement('button',{
            key:group.id,
            type:"button",
            disabled:group.disabled,
            onClick:()=>!group.disabled&&toggleGroupSelection(group.id),
            style:{
              minWidth:0,
              flex:"0 1 auto",
              maxWidth:"100%",
              background:selectedGroupIds.includes(group.id)?"rgba(31,206,101,.08)":"var(--s2)",
              border:`1px solid ${group.disabled?"rgba(62,62,82,.8)":selectedGroupIds.includes(group.id)?"rgba(31,206,101,.35)":"var(--border)"}`,
              borderRadius:999,
              padding:"5px 8px",
              display:"flex",
              alignItems:"center",
              justifyContent:"center",
              gap:6,
              color:group.disabled?"var(--muted2)":"var(--text)",
              cursor:group.disabled?"default":"pointer",
              opacity:group.disabled?0.75:1
            }},
            React.createElement('span',{style:{width:14,height:14,borderRadius:999,border:`1px solid ${group.disabled?"var(--border2)":selectedGroupIds.includes(group.id)?"var(--green)":"var(--border2)"}`,background:selectedGroupIds.includes(group.id)?"var(--green)":"transparent",display:"inline-flex",alignItems:"center",justifyContent:"center",color:"#04110a",fontSize:8,fontWeight:800,flexShrink:0}},selectedGroupIds.includes(group.id)?"✓":""),
            React.createElement('span',{style:{minWidth:0,maxWidth:150,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",fontSize:11,fontWeight:600}},group.name),
            group.helper && React.createElement('span',{style:{fontSize:9,color:group.acceptsType?"var(--red)":"var(--muted)"}},group.helper)
          ))
        )
      ),
      React.createElement('div',{style:{display:"flex",gap:9,paddingTop:6}},
        React.createElement('button',{onClick:onClose,style:{flex:1,background:"transparent",border:"1px solid #163d36",color:"var(--muted)",padding:compactMobile?"12px":"14px",borderRadius:10,fontSize:compactMobile?14:15,fontWeight:700}},"Cancel"),
        React.createElement('button',{onClick:()=>canSubmit&&onConfirm({ workoutType:wType, isoDate:selDate, targetGroupIds:isCurrentMonthSelection?selectedGroupIds:[], note:note.trim(), photoUrl }),
          style:{flex:2,background:canSubmit?"var(--green)":"var(--s3)",color:canSubmit?"#000":"var(--muted2)",padding:compactMobile?"12px":"14px",borderRadius:10,fontSize:compactMobile?14:15,fontWeight:800,animation:canSubmit?"glow 2s infinite":"none",cursor:canSubmit?"pointer":"default"}},
          uploading?"Processing photo...":"Log workout")
      )
    )
  );
};

// ─── DELETE MODAL ─────────────────────────────────────────────────────────────

const DeleteModal = ({log,onConfirm,onClose}) => React.createElement('div',{className:"overlay center-mobile",onClick:onClose},
  React.createElement('div',{className:"modal pi",onClick:e=>e.stopPropagation(),style:{textAlign:"center",maxWidth:280,padding:"14px 14px"}},
    React.createElement('div',{style:{marginBottom:6,display:"flex",justifyContent:"center"}},
      React.createElement('svg',{xmlns:"http://www.w3.org/2000/svg",width:20,height:20,viewBox:"0 0 24 24",fill:"none",stroke:"var(--red)",strokeWidth:"1.8",strokeLinecap:"round",strokeLinejoin:"round"},
        React.createElement('path',{d:"M10 11v6"}),
        React.createElement('path',{d:"M14 11v6"}),
        React.createElement('path',{d:"M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"}),
        React.createElement('path',{d:"M3 6h18"}),
        React.createElement('path',{d:"M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"})
      )
    ),
    React.createElement('div',{style:{fontWeight:800,fontSize:13,marginBottom:8}},"Delete this log?"),
    React.createElement('div',{style:{background:"var(--s2)",border:"1px solid var(--border)",borderRadius:8,padding:"6px 10px",marginBottom:8,textAlign:"left"}},
      React.createElement('div',{style:{fontWeight:700,fontSize:11,marginBottom:3,display:"inline-flex",alignItems:"center",gap:5}},
        React.createElement(WorkoutTypeIcon,{type:log.type,size:12}),
        log.type
      ),
      React.createElement('div',{className:"mono",style:{fontSize:10,color:"var(--muted)"}},fmtISO(log.date))
    ),
    React.createElement('div',{style:{color:"var(--muted)",fontSize:10,marginBottom:10}},"This will permanently remove this workout."),
    React.createElement('div',{style:{display:"flex",gap:6}},
      React.createElement('button',{onClick:onClose,style:{flex:1,background:"var(--s2)",border:"1px solid var(--border)",color:"var(--muted)",padding:"7px",borderRadius:7,fontSize:11,fontWeight:600}},"Keep it"),
      React.createElement('button',{onClick:onConfirm,style:{flex:1,background:"var(--red-bg)",border:"1px solid var(--red)",color:"var(--red)",padding:"7px",borderRadius:7,fontSize:11,fontWeight:800}},"Delete")
    )
  )
);

// ─── EXCUSE MODAL ─────────────────────────────────────────────────────────────

const SitOutModal = ({mode,monthName,onClose,onSubmit,submitting,error}) => {
  const [reason,setReason] = React.useState("");
  const competitionModalLabelStyle = {display:"block",marginBottom:5,fontFamily:UI_FONT,fontSize:9,color:"var(--muted)",textTransform:"uppercase",letterSpacing:".08em",fontWeight:800};
  const config = mode === "instant"
    ? {
        title:`Sit out ${monthName}?`,
        body:["You'll be removed from this month's stakes.","You won't pay or collect anything."],
        cta:"Confirm sit-out"
      }
    : mode === "exceptional"
      ? {
          title:"You've already sat out recently.",
          body:[`Your next sit-out is available in ${monthName}.`,"If you have exceptional circumstances, you can send a request to the bloc admin."],
          cta:"Send exceptional request"
        }
      : {
          title:`Request sit-out for ${monthName}?`,
          body:["Your request will be sent to the bloc admin for approval."],
          cta:"Send request"
        };
  return React.createElement('div',{className:`overlay${isMobile() ? " center-mobile" : ""}`,onClick:onClose},
    React.createElement('div',{className:"modal pi",onClick:e=>e.stopPropagation(),style:{maxWidth:420,fontFamily:UI_FONT}},
      React.createElement('div',{style:{fontFamily:UI_FONT,fontWeight:800,fontSize:20,marginBottom:10}},config.title),
      React.createElement('div',{style:{display:"grid",gap:4,color:"var(--muted)",fontFamily:UI_FONT,fontSize:13,lineHeight:1.55,marginBottom:16}},
        config.body.map(line=>React.createElement('div',{key:line},line))
      ),
      React.createElement('label',{style:{display:"block",marginBottom:16}},
        React.createElement('span',{style:competitionModalLabelStyle},"Reason (optional)"),
        React.createElement('textarea',{value:reason,onChange:e=>setReason(e.target.value),placeholder:"e.g. travelling, injured",rows:3,style:{width:"100%",background:"var(--s2)",border:"1px solid var(--border)",borderRadius:10,padding:"12px 13px",color:"var(--text)",fontFamily:UI_FONT,fontSize:14,outline:"none",resize:"none"}})
      ),
      error && React.createElement('div',{style:{fontFamily:UI_FONT,fontSize:12,color:"var(--red)",marginBottom:14}},error),
      React.createElement('div',{style:{display:"flex",gap:9}},
        React.createElement('button',{onClick:onClose,style:{flex:1,background:"var(--s2)",border:"1px solid var(--border)",color:"var(--muted)",padding:"14px",borderRadius:10,fontFamily:UI_FONT,fontSize:15,fontWeight:600}},"Cancel"),
        React.createElement('button',{onClick:()=>onSubmit(reason),style:{flex:1,background:"#4ECDC4",color:"#050909",padding:"14px",borderRadius:10,fontFamily:UI_FONT,fontSize:15,fontWeight:800}},submitting?"Sending...":config.cta)
      )
    )
  );
};

const SoloModal = ({mode,monthName,minimumTarget,maximumTarget,defaultTarget,onClose,onSubmit,submitting,error}) => {
  const [reason,setReason] = React.useState("");
  const minTarget = Math.max(1, Number(minimumTarget || 1));
  const maxTarget = Math.max(minTarget, Math.round(Number(maximumTarget || defaultTarget || minTarget)));
  const initialTarget = Math.max(minTarget, Math.min(maxTarget, Math.round(Number(defaultTarget || minTarget))));
  const [target,setTarget] = React.useState(initialTarget);
  const competitionModalLabelStyle = {display:"block",marginBottom:5,fontFamily:UI_FONT,fontSize:9,color:"var(--muted)",textTransform:"uppercase",letterSpacing:".08em",fontWeight:800};
  const config = mode === "exceptional"
    ? {
        title:`Request Solo for ${monthName}?`,
        body:["Solo is meant to be used only once every three months.","If you want to go Solo again, your request will be sent to the Bloc admin for approval."],
        cta:"Send request"
      }
    : {
        title:`Go Solo for ${monthName}?`,
        body:["You keep logging, but you are out of the reward / penalty system for the month.","This action can't be undone."],
        cta:"Go Solo"
      };
  const reasonReady = reason.trim().length > 0;
  const adjustTarget = delta => setTarget(current => Math.max(minTarget, Math.min(maxTarget, Number(current || minTarget) + delta)));
  const submit = () => onSubmit({ personalTarget: Math.max(minTarget, Math.min(maxTarget, Math.round(Number(target || minTarget)))), reason });
  return React.createElement('div',{className:`overlay${isMobile() ? " center-mobile" : ""}`,onClick:onClose},
    React.createElement('div',{className:"modal pi",onClick:e=>e.stopPropagation(),style:{maxWidth:420,fontFamily:UI_FONT}},
      React.createElement('div',{style:{fontFamily:UI_FONT,fontWeight:800,fontSize:20,lineHeight:1.1,letterSpacing:0,marginBottom:12}},config.title),
      React.createElement('div',{style:{display:"grid",gap:7,padding:"11px 12px",borderRadius:12,background:"linear-gradient(180deg, rgba(13,31,30,.96), rgba(8,15,15,.86))",border:"1px solid rgba(78,205,196,.34)",boxShadow:"0 0 0 1px rgba(78,205,196,.08), inset 0 1px 0 rgba(255,255,255,.04)",marginBottom:14}},
        [
          "Keep logging with a personal target.",
          "Step out of this month's potential reward / penalty."
        ].map(line=>React.createElement('div',{key:line,style:{display:"flex",alignItems:"flex-start",gap:8,fontFamily:UI_FONT,fontSize:12.5,color:"var(--text)",lineHeight:1.35,fontWeight:650}},
          React.createElement('span',{style:{width:5,height:5,borderRadius:999,background:"#4ECDC4",marginTop:7,flexShrink:0}}),
          React.createElement('span',null,line)
        ))
      ),
      React.createElement('div',{style:{display:"grid",gap:4,color:"var(--muted)",fontFamily:UI_FONT,fontSize:13,lineHeight:1.55,marginBottom:16}},
        config.body.map(line=>React.createElement('div',{key:line},line))
      ),
      React.createElement('label',{style:{display:"block",marginBottom:14}},
        React.createElement('span',{style:competitionModalLabelStyle},"Solo target"),
        React.createElement('div',{style:{display:"grid",gridTemplateColumns:"44px 1fr 44px",height:46,background:"var(--s2)",border:"1px solid var(--border)",borderRadius:10,overflow:"hidden"}},
          React.createElement('button',{type:"button",onClick:()=>adjustTarget(-1),disabled:target <= minTarget,style:{background:"transparent",borderRight:"1px solid var(--border)",color:target <= minTarget ? "var(--muted2)" : "var(--text)",fontFamily:UI_FONT,fontSize:20,fontWeight:900,opacity:target <= minTarget ? .5 : 1}},"-"),
          React.createElement('div',{style:{display:"flex",alignItems:"center",justifyContent:"center",fontFamily:UI_FONT,fontSize:15,fontWeight:800,color:"var(--text)"}},target),
          React.createElement('button',{type:"button",onClick:()=>adjustTarget(1),disabled:target >= maxTarget,style:{background:"transparent",borderLeft:"1px solid var(--border)",color:target >= maxTarget ? "var(--muted2)" : "#4ECDC4",fontFamily:UI_FONT,fontSize:20,fontWeight:900,opacity:target >= maxTarget ? .5 : 1}},"+")
        ),
        React.createElement('span',{style:{display:"block",marginTop:6,fontFamily:UI_FONT,fontSize:11,color:"var(--muted)"}},"Minimum ",minTarget," workouts")
      ),
      React.createElement('label',{style:{display:"block",marginBottom:16}},
        React.createElement('span',{style:competitionModalLabelStyle},"Reason"),
        React.createElement('textarea',{value:reason,onChange:e=>setReason(e.target.value),placeholder:"e.g. travel month, work sprint",rows:3,style:{width:"100%",background:"var(--s2)",border:"1px solid var(--border)",borderRadius:10,padding:"12px 13px",color:"var(--text)",fontFamily:UI_FONT,fontSize:14,outline:"none",resize:"none"}})
      ),
      error && React.createElement('div',{style:{fontFamily:UI_FONT,fontSize:12,color:"var(--red)",marginBottom:14}},error),
      React.createElement('div',{style:{display:"flex",gap:9}},
        React.createElement('button',{onClick:onClose,style:{flex:1,background:"var(--s2)",border:"1px solid var(--border)",color:"var(--muted)",padding:"14px",borderRadius:10,fontFamily:UI_FONT,fontSize:15,fontWeight:600}},"Cancel"),
        React.createElement('button',{onClick:submit,disabled:submitting||!reasonReady,style:{flex:1,background:reasonReady?"#4ECDC4":"var(--s3)",color:reasonReady?"#050909":"var(--muted2)",padding:"14px",borderRadius:10,fontFamily:UI_FONT,fontSize:15,fontWeight:800,opacity:submitting ? .75 : 1}},submitting?"Sending...":config.cta)
      )
    )
  );
};


// Shown once, over the Bloc a member has just landed in. Pre-selected to
// whatever the admin set, so tapping straight through honours the Bloc's
// intent. The wording avoids "training wheels": nobody wants to be told they
// need them on day one. The leaderboard tag says it afterwards, once it is
// their own choice.
const TrainingChoiceModal = ({blocName, defaultTraining = true, onConfirm, saving}) => {
  const [choice,setChoice] = useState(defaultTraining ? "training" : "standard");
  const option = (value, title, help) => {
    const picked = choice === value;
    return React.createElement('button',{
      type:"button",
      onClick:()=>setChoice(value),
      "aria-pressed":picked,
      style:{
        width:"100%",textAlign:"left",display:"flex",alignItems:"flex-start",gap:10,
        padding:12,borderRadius:11,marginBottom:9,fontFamily:UI_FONT,
        border:picked ? "1px solid rgba(245,200,66,.4)" : "1px solid var(--border)",
        background:picked ? "rgba(245,200,66,.06)" : "rgba(25,27,36,.45)"
      }
    },
      React.createElement('span',{style:{
        width:17,height:17,borderRadius:999,flexShrink:0,marginTop:1,position:"relative",
        border:picked ? "1.5px solid #f5c842" : "1.5px solid #3A414C",
        background:picked ? "radial-gradient(circle, #f5c842 0 45%, transparent 46%)" : "transparent"
      }}),
      React.createElement('span',{style:{minWidth:0}},
        React.createElement('span',{style:{display:"block",fontSize:13.5,fontWeight:800,color:"var(--text)",marginBottom:3}},title),
        React.createElement('span',{style:{display:"block",fontSize:11.5,color:"var(--muted)",lineHeight:1.4}},help)
      )
    );
  };
  return React.createElement('div',{className:"overlay center-mobile"},
    React.createElement('div',{className:"modal",onClick:e=>e.stopPropagation(),style:{maxWidth:340,padding:"20px 18px 16px",fontFamily:UI_FONT}},
      React.createElement('div',{style:{fontFamily:DISPLAY_FONT,fontWeight:800,fontSize:19,lineHeight:1.1,marginBottom:6}},"Your first month"),
      React.createElement('div',{style:{color:"var(--muted)",fontSize:12.5,lineHeight:1.45,marginBottom:14}},
        `${blocName || "This Bloc"} has been running a while. Ease in, or start on the same terms as everyone else.`),
      option("training","Ease in","Find your rhythm. Penalties start next month."),
      option("standard","Dive in","Penalties apply from your first month."),
      React.createElement('button',{
        disabled:saving,
        onClick:()=>onConfirm(choice),
        style:{width:"100%",marginTop:4,background:"#4ECDC4",color:"#050909",padding:14,borderRadius:12,fontFamily:UI_FONT,fontSize:15,fontWeight:900,opacity:saving?.6:1}
      }, saving ? "Saving..." : "Confirm")
    )
  );
};

const ProrationChoiceModal = ({monthName,fullMas,daysRemaining,daysInMonth,proratedMas,onKeep,onProrate,savingChoice}) => React.createElement('div',{className:"overlay center-mobile"},
  React.createElement('div',{className:"modal pi",style:{maxWidth:430}},
    React.createElement('div',{style:{fontWeight:800,fontSize:20,marginBottom:10}},"You're starting mid-month."),
    React.createElement('div',{style:{color:"var(--muted)",fontSize:13,lineHeight:1.6,marginBottom:18}},
      `Your target is ${fullMas} workouts. There are ${daysRemaining} days left in ${monthName} — a prorated target would be ${proratedMas}.`
    ),
    React.createElement('div',{style:{fontSize:13,color:"var(--text-soft)",marginBottom:14}},"Which do you want for this first month?"),
    React.createElement('div',{style:{display:"flex",gap:9}},
      React.createElement('button',{onClick:onKeep,disabled:!!savingChoice,style:{flex:1,background:"var(--s2)",border:"1px solid var(--border)",color:"var(--text)",padding:"14px",borderRadius:10,fontSize:15,fontWeight:700}},savingChoice==="keep"?"Saving...":`Keep ${fullMas}`),
      React.createElement('button',{onClick:onProrate,disabled:!!savingChoice,style:{flex:1,background:"#4ECDC4",color:"#050909",padding:"14px",borderRadius:10,fontSize:15,fontWeight:800}},savingChoice==="prorate"?"Saving...":`Prorate to ${proratedMas}`)
    )
  )
);

// ─── NAV ──────────────────────────────────────────────────────────────────────

const TextEntryModal = ({title,label,placeholder,value,setValue,confirmLabel,onConfirm,onClose,accent="var(--green)"}) => React.createElement('div',{className:"overlay center-mobile",onClick:onClose},
  React.createElement('div',{className:"modal pi",onClick:e=>e.stopPropagation(),style:{maxWidth:340,padding:"18px 16px"}},
    React.createElement('div',{style:{fontWeight:800,fontSize:15,marginBottom:10}},title),
    React.createElement('label',{style:{display:"block",marginBottom:12}},
      label && React.createElement('span',{className:"lbl"},label),
      React.createElement('textarea',{value,onChange:e=>setValue(e.target.value.slice(0,280)),rows:3,placeholder,style:{width:"100%",resize:"none",background:"var(--s2)",border:"1px solid var(--border)",borderRadius:9,padding:"9px 11px",color:"var(--text)",fontSize:13,outline:"none"}})
    ),
    React.createElement('div',{style:{display:"flex",gap:8}},
      React.createElement('button',{onClick:onClose,style:{flex:1,background:"var(--s2)",border:"1px solid var(--border)",color:"var(--muted)",padding:"10px",borderRadius:9,fontSize:13,fontWeight:600}},"Cancel"),
      React.createElement('button',{onClick:onConfirm,style:{flex:1,background:accent,color:accent==="var(--green)"?"#000":"#fff",padding:"10px",borderRadius:9,fontSize:13,fontWeight:800}},confirmLabel)
    )
  )
);


const NoticeModal = ({title,body,onClose}) => React.createElement('div',{className:"overlay",onClick:onClose},
  React.createElement('div',{className:"modal pi",onClick:e=>e.stopPropagation(),style:{maxWidth:420,textAlign:"center"}},
    React.createElement('div',{style:{fontWeight:800,fontSize:20,marginBottom:10}},title),
    React.createElement('div',{style:{fontSize:14,color:"var(--muted)",lineHeight:1.6,marginBottom:22,whiteSpace:"pre-wrap"}},body),
    React.createElement('button',{type:"button",onClick:onClose,style:{width:"100%",background:"var(--s2)",border:"1px solid var(--border)",color:"var(--text)",padding:"14px",borderRadius:10,fontSize:15,fontWeight:700}},"Got it")
  )
);


const ImageLightbox = ({src,alt,onClose,canFlag,onFlag}) => React.createElement('div',{onClick:onClose,style:{position:"fixed",inset:0,background:"rgba(0,0,0,0.92)",zIndex:260,display:"flex",alignItems:"center",justifyContent:"center",padding:24}},
  React.createElement('button',{type:"button",onClick:onClose,style:{position:"fixed",top:16,right:16,zIndex:2,width:40,height:40,borderRadius:999,background:"rgba(7,7,10,.82)",border:"1px solid rgba(255,255,255,.12)",color:"#fff",fontSize:18,fontWeight:800}},"×"),
  canFlag && React.createElement('button',{type:"button",onClick:e=>{e.stopPropagation();onFlag&&onFlag();},style:{position:"fixed",bottom:28,right:20,zIndex:2,display:"flex",alignItems:"center",gap:6,padding:"9px 14px",borderRadius:999,background:"rgba(7,7,10,.82)",border:"1px solid rgba(255,255,255,.1)",color:"rgba(255,255,255,.55)",fontSize:12,fontWeight:600,letterSpacing:".01em"}},
    React.createElement('svg',{width:13,height:13,viewBox:"0 0 24 24",fill:"currentColor",xmlns:"http://www.w3.org/2000/svg"},
      React.createElement('path',{d:"M4 21V4l1 1 2-2 2 2 2-2 2 2 2-2 2 2 1-1v13l-1-1-2 2-2-2-2 2-2-2-2 2-2-2-1 1z"})
    ),
    "Report"
  ),
  React.createElement('div',{onClick:e=>e.stopPropagation(),style:{width:"100%",display:"flex",alignItems:"center",justifyContent:"center"}},
    React.createElement('img',{src,alt,style:{display:"block",maxWidth:"100%",maxHeight:"90vh",objectFit:"contain",borderRadius:12,background:"#050507",boxShadow:"0 24px 60px rgba(0,0,0,.45)"}})
  )
);


const PinModal = ({prompt, onConfirm, onClose}) => {
  const [pin, setPin] = React.useState("");
  const [err, setErr] = React.useState("");
  const inputRef = React.useRef(null);
  React.useEffect(()=>{ setTimeout(()=>inputRef.current?.focus(), 80); }, []);
  const handleConfirm = () => {
    if (!pin.trim()) { setErr("Enter the admin PIN."); return; }
    onConfirm(pin.trim());
  };
  return React.createElement(React.Fragment, null,
    React.createElement('div',{onClick:onClose,style:{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",zIndex:1100}}),
    React.createElement('div',{onClick:e=>e.stopPropagation(),style:{position:"fixed",top:"50%",left:"50%",transform:"translate(-50%,-50%)",zIndex:1101,width:"calc(100% - 48px)",maxWidth:340,background:"#080F0F",border:"0.5px solid #0D1F1E",borderRadius:18,padding:"22px 20px",boxSizing:"border-box"}},
      React.createElement('div',{style:{fontWeight:700,fontSize:15,marginBottom:6}},prompt),
      React.createElement('input',{ref:inputRef,type:"password",placeholder:"PIN",value:pin,onChange:e=>{setPin(e.target.value);setErr("");},onKeyDown:e=>e.key==="Enter"&&handleConfirm(),style:{width:"100%",height:40,background:"var(--s2)",border:`1px solid ${err?"var(--red)":"var(--border)"}`,borderRadius:10,padding:"0 12px",color:"var(--text)",fontSize:15,outline:"none",boxSizing:"border-box",marginBottom:6}}),
      err && React.createElement('div',{style:{fontSize:12,color:"var(--red)",marginBottom:8}},err),
      React.createElement('div',{style:{display:"flex",gap:8,marginTop:err?0:8}},
        React.createElement('button',{onClick:onClose,style:{flex:1,padding:"11px",borderRadius:10,background:"var(--s2)",border:"1px solid var(--border)",color:"var(--muted)",fontSize:14,fontWeight:600}},"Cancel"),
        React.createElement('button',{onClick:handleConfirm,style:{flex:1,padding:"11px",borderRadius:10,background:"var(--green)",border:"none",color:"#000",fontSize:14,fontWeight:800}},"Confirm")
      )
    )
  );
};

// ─── SETTLEMENT SCREEN ───────────────────────────────────────────────────────

export { SETTINGS_DEFAULTS, TIME_ZONE_OPTIONS, GroupSettingsFields, GroupCreateModal, GroupSettingsModal, CropModal, LogModal, DeleteModal, SitOutModal, SoloModal, ProrationChoiceModal, TrainingChoiceModal, TextEntryModal, NoticeModal, ImageLightbox, PinModal };
