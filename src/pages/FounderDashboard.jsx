import React, { useCallback, useEffect, useMemo, useState } from "react";
import { fetchFounderDashboardData } from "../lib/api.js";

const number = value => new Intl.NumberFormat("en-GB").format(Math.max(0, Number(value) || 0));
const average = value => new Intl.NumberFormat("en-GB", {minimumFractionDigits:1,maximumFractionDigits:1}).format(Math.max(0, Number(value) || 0));

const Metric = ({label,value,detail}) => React.createElement("article", {
  style:{padding:"15px 14px",borderRadius:14,border:"1px solid rgba(78,205,196,.17)",background:"rgba(11,27,26,.92)",minWidth:0,textAlign:"center"}
},
  React.createElement("div", {style:{fontSize:10,fontWeight:900,letterSpacing:".1em",textTransform:"uppercase",color:"var(--muted)",lineHeight:1.3}}, label),
  React.createElement("div", {style:{marginTop:6,fontSize:26,fontWeight:900,letterSpacing:"-.035em",color:"#f5f7ff",lineHeight:1}}, number(value)),
  detail && React.createElement("div", {style:{marginTop:7,fontSize:11,lineHeight:1.35,color:"var(--text-faint)"}}, detail)
);

const Trend = ({points=[]}) => {
  const safePoints = Array.isArray(points) ? points : [];
  const [selectedIndex,setSelectedIndex] = useState(Math.max(0, safePoints.length - 1));
  const max = Math.max(1, ...safePoints.flatMap(point=>[Number(point?.activeUsers)||0, Number(point?.workoutUploads)||0]));
  const selected = safePoints[Math.min(selectedIndex, Math.max(0, safePoints.length - 1))] || {};
  return React.createElement(React.Fragment,null,
    React.createElement("div", {style:{marginTop:12,padding:"9px 10px",borderRadius:10,background:"rgba(255,255,255,.035)",fontSize:11,lineHeight:1.4,color:"var(--text-soft)",textAlign:"center"}},
      React.createElement("strong", {style:{color:"var(--text)"}}, selected?.date || "Select a day"),
      ` · ${number(selected?.activeUsers)} active · ${number(selected?.workoutUploads)} uploads`,
      React.createElement("div", {style:{marginTop:2,color:"var(--text-faint)",fontSize:10}}, `Scale: 0–${number(max)} uploads · tap a day to read its values`)
    ),
    React.createElement("div", {style:{display:"grid",gridTemplateColumns:`repeat(${Math.max(1,safePoints.length)}, minmax(2px,1fr))`,gap:3,alignItems:"end",height:108,marginTop:10}},
    safePoints.map((point,index)=>{
      const activeHeight = Math.max(3, Math.round(((Number(point?.activeUsers)||0) / max) * 92));
      const workoutHeight = Math.max(3, Math.round(((Number(point?.workoutUploads)||0) / max) * 92));
      return React.createElement("button", {type:"button",key:point?.date || index,onClick:()=>setSelectedIndex(index),"aria-label":`${point?.date || ""}: ${number(point?.activeUsers)} active, ${number(point?.workoutUploads)} uploads`,"aria-pressed":selectedIndex===index,style:{height:"100%",display:"flex",alignItems:"flex-end",gap:1,minWidth:0,padding:0,border:0,borderBottom:selectedIndex===index?"2px solid #f5f7ff":"2px solid transparent",background:"transparent",cursor:"pointer"}},
        React.createElement("span", {style:{display:"block",width:"50%",height:activeHeight,borderRadius:"3px 3px 1px 1px",background:"#4ECDC4"}}),
        React.createElement("span", {style:{display:"block",width:"50%",height:workoutHeight,borderRadius:"3px 3px 1px 1px",background:"#8f78ff"}})
      );
    })
    )
  );
};

const AccountRoster = ({label,profiles=[]}) => {
  const names = (Array.isArray(profiles) ? profiles : []).map(profile=>String(profile?.displayName || "").trim()).filter(Boolean);
  return React.createElement("details", {style:{marginTop:10,padding:"11px 12px",borderRadius:11,border:"1px solid rgba(78,205,196,.14)",background:"rgba(255,255,255,.025)",textAlign:"center"}},
    React.createElement("summary", {style:{cursor:"pointer",fontSize:12,fontWeight:800,color:"var(--text-soft)",listStylePosition:"inside"}}, `${label} (${number(names.length)})`),
    React.createElement("div", {style:{display:"flex",flexWrap:"wrap",justifyContent:"center",gap:6,marginTop:10}}, names.map((name,index)=>React.createElement("span", {key:`${name}-${index}`,style:{padding:"5px 7px",borderRadius:99,background:"rgba(78,205,196,.1)",color:"var(--text-soft)",fontSize:10,fontWeight:800}}, name)))
  );
};

const FounderDashboard = ({onClose}) => {
  const [status,setStatus] = useState("loading");
  const [dashboard,setDashboard] = useState(null);
  const [error,setError] = useState("");
  const load = useCallback(async()=>{
    setStatus("loading");
    setError("");
    const result = await fetchFounderDashboardData();
    if (!result.ok) {
      setStatus("error");
      setError(result.status === 403 ? "This account is not authorised to view the founder dashboard." : result.error || "Unable to load dashboard.");
      return;
    }
    setDashboard(result.dashboard);
    setStatus("ready");
  },[]);
  useEffect(()=>{ load(); },[load]);
  const range = useMemo(()=>dashboard?.range || {},[dashboard]);
  return React.createElement("div", {style:{position:"fixed",inset:0,zIndex:1200,overflowY:"auto",background:"#070c0c",color:"var(--text)",padding:"max(18px, env(safe-area-inset-top)) 16px max(28px, env(safe-area-inset-bottom))",boxSizing:"border-box"}},
    React.createElement("main", {style:{width:"100%",maxWidth:760,margin:"0 auto",textAlign:"center"}},
      React.createElement("header", {style:{position:"relative",display:"flex",alignItems:"center",justifyContent:"center",gap:12,padding:"4px 0 20px"}},
        React.createElement("div", {style:{textAlign:"center"}},
          React.createElement("div", {style:{fontSize:10,fontWeight:900,letterSpacing:".13em",color:"#4ECDC4",textTransform:"uppercase"}}, "Private"),
          React.createElement("h1", {style:{margin:"4px 0 0",fontSize:27,lineHeight:1,fontWeight:900,letterSpacing:"-.04em"}}, "Founder Dashboard")
        ),
        React.createElement("button", {type:"button",onClick:onClose,style:{position:"absolute",right:0,top:4,border:"1px solid var(--border)",borderRadius:99,width:38,height:38,background:"var(--s2)",color:"var(--text)",fontSize:24,lineHeight:1,cursor:"pointer"},"aria-label":"Close founder dashboard"}, "×")
      ),
      status === "loading" && React.createElement("div", {style:{padding:"44px 0",textAlign:"center",color:"var(--muted)",fontSize:14}}, "Loading your live metrics…"),
      status === "error" && React.createElement("section", {style:{padding:18,borderRadius:14,border:"1px solid rgba(212,74,74,.32)",background:"rgba(80,20,20,.18)",textAlign:"center"}},
        React.createElement("p", {style:{margin:"0 0 14px",fontSize:13,lineHeight:1.5,color:"var(--text-soft)"}}, error),
        React.createElement("button", {type:"button",onClick:load,style:{border:0,borderRadius:9,padding:"10px 13px",fontWeight:800,background:"#4ECDC4",color:"#061010",cursor:"pointer"}}, "Try again")
      ),
      status === "ready" && React.createElement(React.Fragment,null,
        React.createElement("p", {style:{margin:"0 0 18px",fontSize:12,lineHeight:1.5,color:"var(--muted)"}}, `All figures use ${range.timeZone || "Europe/Oslo"} calendar boundaries. A person counts once per day after opening Fero while signed in.`),
        React.createElement("section", {style:{marginBottom:20}},
          React.createElement("h2", {style:{fontSize:13,margin:"0 0 9px",fontWeight:900}}, "Active Users"),
          React.createElement("div", {style:{display:"grid",gridTemplateColumns:"repeat(3,minmax(0,1fr))",gap:8}},
            React.createElement(Metric,{label:"Daily Active Users",value:dashboard?.activeUsers?.today,detail:`30-day avg: ${average(dashboard?.activeUsers?.averages?.daily)}`}),
            React.createElement(Metric,{label:"Weekly Active Users",value:dashboard?.activeUsers?.week,detail:`4-week avg: ${average(dashboard?.activeUsers?.averages?.weekly)}`}),
            React.createElement(Metric,{label:"Monthly Active Users",value:dashboard?.activeUsers?.month,detail:`3-month avg: ${average(dashboard?.activeUsers?.averages?.monthly)}`})
          )
        ),
        React.createElement("section", {style:{marginBottom:20}},
          React.createElement("h2", {style:{fontSize:13,margin:"0 0 9px",fontWeight:900}}, "Workout Uploads"),
          React.createElement("div", {style:{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:8}},
            React.createElement(Metric,{label:"Daily Workout Uploads",value:dashboard?.workoutUploads?.today,detail:`30-day avg: ${average(dashboard?.workoutUploads?.averages?.daily)}`}),
            React.createElement(Metric,{label:"Weekly Workout Uploads",value:dashboard?.workoutUploads?.week,detail:`4-week avg: ${average(dashboard?.workoutUploads?.averages?.weekly)}`}),
            React.createElement(Metric,{label:"Monthly Workout Uploads",value:dashboard?.workoutUploads?.month,detail:`3-month avg: ${average(dashboard?.workoutUploads?.averages?.monthly)}`}),
            React.createElement(Metric,{label:"All-Time",value:dashboard?.workoutUploads?.allTime,detail:"Canonical Database"})
          )
        ),
        React.createElement("section", {style:{marginBottom:20}},
          React.createElement("h2", {style:{fontSize:13,margin:"0 0 9px",fontWeight:900}}, "Users"),
          React.createElement("div", {style:{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:8}},
            React.createElement(Metric,{label:"Total",value:dashboard?.accounts?.total}),
            React.createElement(Metric,{label:"New in 30 Days",value:dashboard?.accounts?.newLast30Days})
          ),
          React.createElement(AccountRoster,{label:"New Account Names",profiles:dashboard?.accounts?.newProfiles}),
          React.createElement(AccountRoster,{label:"All Account Names",profiles:dashboard?.accounts?.allProfiles})
        ),
        React.createElement("section", {style:{marginBottom:20}},
          React.createElement("h2", {style:{fontSize:13,margin:"0 0 9px",fontWeight:900}}, "Active Blocs"),
          React.createElement("p", {style:{margin:"0 0 9px",fontSize:11,lineHeight:1.45,color:"var(--muted)"}}, `With five-plus workouts in the last ${number(dashboard?.activeBlocs?.periodDays || 30)} days.`),
          React.createElement("div", {style:{display:"grid",gridTemplateColumns:"minmax(0,1fr)",gap:8}},
            React.createElement(Metric,{label:"Five-plus workouts",value:dashboard?.activeBlocs?.fivePlus})
          )
        ),
        React.createElement("section", {style:{padding:"15px 14px",borderRadius:14,border:"1px solid rgba(78,205,196,.17)",background:"rgba(11,27,26,.92)"}},
          React.createElement("div", {style:{fontSize:13,fontWeight:900}}, "Last 30 Days"),
          React.createElement("div", {style:{marginTop:4,fontSize:11,color:"var(--muted)"}}, "Teal: active users · Purple: workout uploads"),
          React.createElement(Trend,{points:dashboard?.trend?.daily})
        )
      )
    )
  );
};

export { FounderDashboard };
