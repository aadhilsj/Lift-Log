import React, { useCallback, useEffect, useMemo, useState } from "react";
import { fetchFounderDashboardData } from "../lib/api.js";

const number = value => new Intl.NumberFormat("en-GB").format(Math.max(0, Number(value) || 0));
const average = value => new Intl.NumberFormat("en-GB", {minimumFractionDigits:1,maximumFractionDigits:1}).format(Math.max(0, Number(value) || 0));
const calendarDate = (value, options) => {
  if (!value) return "";
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isNaN(date.getTime()) ? "" : new Intl.DateTimeFormat("en-GB", {timeZone:"Europe/Oslo", ...options}).format(date);
};
const weekOf = value => {
  const date = calendarDate(value, {day:"numeric",month:"short"});
  return date ? `Week of ${date}` : "This Week";
};
const monthOf = value => calendarDate(value, {month:"long",year:"numeric"}) || "This Month";
const usageLabels = {
  today_opened:"Today Screen", activity_opened:"Activity Screen", month_opened:"Month Screen", history_opened:"History Screen",
  own_profile_opened:"Own Main Profile", own_block_profile_opened:"Own Bloc Profile", other_profile_opened:"Other Profiles", mvp_card_opened:"Week's MVP Card",
  bloc_month_opened:"Bloc Month Card", settings_opened:"Settings", bloc_stream_opened:"Bloc Stream",
  comment_composer_opened:"Comment Composer", reaction_picker_opened:"Reaction Picker"
};

const Metric = ({label,value,detail,formatValue=number}) => React.createElement("article", {
  style:{padding:"15px 14px",borderRadius:14,border:"1px solid rgba(78,205,196,.17)",background:"rgba(11,27,26,.92)",minWidth:0,textAlign:"center"}
},
  React.createElement("div", {style:{fontSize:10,fontWeight:900,letterSpacing:".1em",textTransform:"uppercase",color:"var(--muted)",lineHeight:1.3}}, label),
  React.createElement("div", {style:{marginTop:6,fontSize:26,fontWeight:900,letterSpacing:"-.035em",color:"#f5f7ff",lineHeight:1}}, formatValue(value)),
  detail && React.createElement("div", {style:{marginTop:7,fontSize:11,lineHeight:1.35,color:"var(--text-faint)"}}, detail)
);

const MetricGroup = ({title,subtitle,columns=3,children}) => React.createElement("section", {style:{marginTop:12}},
  React.createElement("div", {style:{margin:"0 0 7px",fontSize:11,fontWeight:900,letterSpacing:".06em",textTransform:"uppercase",color:"var(--text-soft)"}}, title),
  subtitle && React.createElement("div", {style:{margin:"-2px 0 7px",fontSize:10,lineHeight:1.35,color:"var(--text-faint)"}}, subtitle),
  React.createElement("div", {style:{display:"grid",gridTemplateColumns:`repeat(${columns},minmax(0,1fr))`,gap:8}}, children)
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
  const [tab,setTab] = useState("overview");
  const [usagePeriod,setUsagePeriod] = useState("monthly");
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
  const activeTrackingStarted = calendarDate(range.activeUserTrackingStarted, {day:"numeric",month:"long",year:"numeric"});
  const weeklyRetentionAvailable = !!(range.activeUserTrackingStarted && range.previousWeekStarts && range.activeUserTrackingStarted <= range.previousWeekStarts);
  const monthlyRetentionAvailable = !!(range.activeUserTrackingStarted && range.previousMonthStarts && range.activeUserTrackingStarted <= range.previousMonthStarts);
  const usageEvents = dashboard?.usage?.events || {};
  return React.createElement("div", {style:{position:"fixed",inset:0,zIndex:1200,overflowY:"auto",background:"#070c0c",color:"var(--text)",padding:"max(18px, env(safe-area-inset-top)) 16px max(28px, env(safe-area-inset-bottom))",boxSizing:"border-box"}},
    React.createElement("main", {style:{width:"100%",maxWidth:760,margin:"0 auto",textAlign:"center"}},
      React.createElement("header", {style:{position:"relative",display:"flex",alignItems:"center",justifyContent:"center",gap:12,padding:"4px 0 20px"}},
        React.createElement("div", {style:{textAlign:"center"}},
          React.createElement("h1", {style:{margin:0,fontSize:20,lineHeight:1,fontWeight:900,letterSpacing:"-.04em"}}, "Dashboard")
        ),
        React.createElement("button", {type:"button",onClick:onClose,style:{position:"absolute",right:0,top:4,border:"1px solid var(--border)",borderRadius:99,width:38,height:38,background:"var(--s2)",color:"var(--text)",fontSize:24,lineHeight:1,cursor:"pointer"},"aria-label":"Close founder dashboard"}, "×")
      ),
      status === "loading" && React.createElement("div", {style:{padding:"44px 0",textAlign:"center",color:"var(--muted)",fontSize:14}}, "Loading your live metrics…"),
      status === "error" && React.createElement("section", {style:{padding:18,borderRadius:14,border:"1px solid rgba(212,74,74,.32)",background:"rgba(80,20,20,.18)",textAlign:"center"}},
        React.createElement("p", {style:{margin:"0 0 14px",fontSize:13,lineHeight:1.5,color:"var(--text-soft)"}}, error),
        React.createElement("button", {type:"button",onClick:load,style:{border:0,borderRadius:9,padding:"10px 13px",fontWeight:800,background:"#4ECDC4",color:"#061010",cursor:"pointer"}}, "Try again")
      ),
      status === "ready" && React.createElement(React.Fragment,null,
        React.createElement("div", {style:{display:"grid",gridTemplateColumns:"repeat(3,minmax(0,1fr))",gap:6,padding:4,margin:"0 0 14px",borderRadius:11,background:"rgba(255,255,255,.045)"}},
          ["overview","growth","usage"].map(item=>React.createElement("button", {type:"button",key:item,onClick:()=>setTab(item),style:{border:0,borderRadius:8,padding:"9px 8px",background:tab===item?"#4ECDC4":"transparent",color:tab===item?"#061010":"var(--muted)",fontSize:11,fontWeight:900,cursor:"pointer",textTransform:"capitalize"}}, item))
        ),
        tab === "overview" && React.createElement(React.Fragment,null,
        React.createElement("section", {style:{marginBottom:20}},
          React.createElement(MetricGroup,{title:"Total Active Users"},
            React.createElement(Metric,{label:"Daily",value:dashboard?.activeUsers?.today,detail:"Today"}),
            React.createElement(Metric,{label:"Weekly",value:dashboard?.activeUsers?.week,detail:weekOf(range.weekStarts)}),
            React.createElement(Metric,{label:"Monthly",value:dashboard?.activeUsers?.month,detail:monthOf(range.monthStarts)})
          ),
          React.createElement(MetricGroup,{title:"Average Active Users"},
            React.createElement(Metric,{label:"Daily",value:dashboard?.activeUsers?.averages?.daily,formatValue:average}),
            React.createElement(Metric,{label:"Weekly",value:dashboard?.activeUsers?.averages?.weekly,formatValue:average}),
            React.createElement(Metric,{label:"Monthly",value:dashboard?.activeUsers?.averages?.monthly,formatValue:average})
          ),
          activeTrackingStarted && React.createElement("p", {style:{margin:"9px 0 0",fontSize:10,lineHeight:1.4,color:"var(--text-faint)"}}, `Active-user tracking began ${activeTrackingStarted}.`)
        ),
        React.createElement("section", {style:{marginBottom:20}},
          React.createElement(MetricGroup,{title:"Total Workout Uploads",columns:2},
            React.createElement(Metric,{label:"Daily",value:dashboard?.workoutUploads?.today,detail:"Today"}),
            React.createElement(Metric,{label:"Weekly",value:dashboard?.workoutUploads?.week,detail:weekOf(range.weekStarts)}),
            React.createElement(Metric,{label:"Monthly",value:dashboard?.workoutUploads?.month,detail:monthOf(range.monthStarts)}),
            React.createElement(Metric,{label:"All Time",value:dashboard?.workoutUploads?.allTime})
          ),
          React.createElement(MetricGroup,{title:"Average Workout Uploads"},
            React.createElement(Metric,{label:"Daily",value:dashboard?.workoutUploads?.averages?.daily,formatValue:average}),
            React.createElement(Metric,{label:"Weekly",value:dashboard?.workoutUploads?.averages?.weekly,formatValue:average}),
            React.createElement(Metric,{label:"Monthly",value:dashboard?.workoutUploads?.averages?.monthly,formatValue:average})
          )
        ),
        React.createElement("section", {style:{marginBottom:20}},
          React.createElement("h2", {style:{fontSize:13,margin:"0 0 9px",fontWeight:900}}, "Unique User Accounts"),
          React.createElement("div", {style:{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:8}},
            React.createElement(Metric,{label:"Total Users",value:dashboard?.accounts?.total}),
            React.createElement(Metric,{label:"New Users",value:dashboard?.accounts?.newLast30Days,detail:"Joined in the last 30 days"})
          ),
          React.createElement(AccountRoster,{label:"New Account Names",profiles:dashboard?.accounts?.newProfiles})
        ),
        React.createElement("section", {style:{marginBottom:20}},
          React.createElement("h2", {style:{fontSize:13,margin:"0 0 9px",fontWeight:900}}, "Active Blocs"),
          React.createElement("p", {style:{margin:"0 0 9px",fontSize:11,lineHeight:1.45,color:"var(--muted)"}}, `Logged five or more workouts in the last ${number(dashboard?.activeBlocs?.periodDays || 30)} days.`),
          React.createElement("div", {style:{display:"grid",gridTemplateColumns:"minmax(0,1fr)",gap:8}},
            React.createElement(Metric,{label:"Qualifying Blocs",value:dashboard?.activeBlocs?.fivePlus})
          )
        ),
        React.createElement("section", {style:{padding:"15px 14px",borderRadius:14,border:"1px solid rgba(78,205,196,.17)",background:"rgba(11,27,26,.92)"}},
          React.createElement("div", {style:{fontSize:13,fontWeight:900}}, "Activity Trend"),
          React.createElement("div", {style:{marginTop:5,fontSize:11,lineHeight:1.45,color:"var(--muted)",textAlign:"left"}},
            React.createElement("div", null, "Daily totals from the last 30 days."),
            React.createElement("div", {style:{display:"flex",alignItems:"center",gap:6}},
              React.createElement("span", {"aria-hidden":true,style:{width:8,height:8,borderRadius:2,background:"#4ECDC4",flex:"0 0 auto"}}),
              "Signed-in users who opened Fero"
            ),
            React.createElement("div", {style:{display:"flex",alignItems:"center",gap:6}},
              React.createElement("span", {"aria-hidden":true,style:{width:8,height:8,borderRadius:2,background:"#8f78ff",flex:"0 0 auto"}}),
              "Unique workout uploads"
            )
          ),
          React.createElement(Trend,{points:dashboard?.trend?.daily})
        ),
        ),
        tab === "growth" && React.createElement("section", {style:{marginBottom:20}},
          React.createElement("p", {style:{margin:"0 0 12px",fontSize:11,lineHeight:1.45,color:"var(--muted)"}}, "Active user = a signed-in person who opened Fero at least once in the selected period."),
          React.createElement(MetricGroup,{title:"Activation Rate",columns:1},
            React.createElement(Metric,{label:"New users who logged a workout",value:dashboard?.growth?.activation?.rate,formatValue:value=>`${average(value)}%`,detail:`${number(dashboard?.growth?.activation?.activatedAccounts)} of ${number(dashboard?.growth?.activation?.eligibleAccounts)} eligible accounts logged their first workout within 7 days`})
          ),
          React.createElement(MetricGroup,{title:"Retention",columns:2},
            React.createElement(Metric,{label:"Weekly Retention",value:dashboard?.growth?.retention?.weekly?.rate,formatValue:value=>weeklyRetentionAvailable?`${average(value)}%`:"—",detail:weeklyRetentionAvailable?`${number(dashboard?.growth?.retention?.weekly?.returningUsers)} of ${number(dashboard?.growth?.retention?.weekly?.activeUsers)} active this week were active last week`:"Available after a full prior week of tracking"}),
            React.createElement(Metric,{label:"Monthly Retention",value:dashboard?.growth?.retention?.monthly?.rate,formatValue:value=>monthlyRetentionAvailable?`${average(value)}%`:"—",detail:monthlyRetentionAvailable?`${number(dashboard?.growth?.retention?.monthly?.returningUsers)} of ${number(dashboard?.growth?.retention?.monthly?.activeUsers)} active this month were active last month`:"Available after a full prior month of tracking"})
          ),
          React.createElement(MetricGroup,{title:"Workouts Per Active User",columns:1},
            React.createElement(Metric,{label:"This month",value:dashboard?.growth?.workoutsPerActiveUser?.value,formatValue:average,detail:`${number(dashboard?.growth?.workoutsPerActiveUser?.uploads)} uploads from ${number(dashboard?.growth?.workoutsPerActiveUser?.activeUsers)} active users`})
          ),
          React.createElement(MetricGroup,{title:"Feature Engagement This Month",columns:3},
            React.createElement(Metric,{label:"Bloc Stream",value:dashboard?.growth?.featureEngagement?.blocStreamUsers,formatValue:value=>Number(value)>0?number(value):"—",detail:Number(dashboard?.growth?.featureEngagement?.blocStreamUsers)>0?`of ${number(dashboard?.growth?.featureEngagement?.activeUsers)} active`:"No recorded opens yet"}),
            React.createElement(Metric,{label:"Comments",value:dashboard?.growth?.featureEngagement?.commentUsers,detail:`of ${number(dashboard?.growth?.featureEngagement?.activeUsers)} active`}),
            React.createElement(Metric,{label:"Reactions",value:dashboard?.growth?.featureEngagement?.reactionUsers,detail:`of ${number(dashboard?.growth?.featureEngagement?.activeUsers)} active`})
          )
        ),
        tab === "usage" && React.createElement("section", {style:{marginBottom:20}},
          React.createElement("p", {style:{margin:"0 0 12px",fontSize:11,lineHeight:1.45,color:"var(--muted)"}}, "Unique users counts people once. Total uses counts every open or tap."),
          React.createElement("div", {style:{display:"grid",gridTemplateColumns:"repeat(4,minmax(0,1fr))",gap:5,marginBottom:10}},
            ["daily","weekly","monthly","allTime"].map(period=>React.createElement("button", {type:"button",key:period,onClick:()=>setUsagePeriod(period),style:{border:"1px solid rgba(78,205,196,.18)",borderRadius:8,padding:"8px 4px",background:usagePeriod===period?"rgba(78,205,196,.16)":"transparent",color:usagePeriod===period?"var(--text)":"var(--muted)",fontSize:10,fontWeight:900,cursor:"pointer"}}, period === "allTime" ? "All Time" : period.charAt(0).toUpperCase() + period.slice(1)))
          ),
          React.createElement("div", {style:{display:"grid",gap:7}}, Object.entries(usageLabels).map(([eventName,label])=>{
            const metric = usageEvents?.[eventName]?.[usagePeriod] || {};
            const averageUsers = dashboard?.usage?.averages?.[eventName]?.[usagePeriod]?.users;
            const averageUses = dashboard?.usage?.averages?.[eventName]?.[usagePeriod]?.uses;
            return React.createElement("article", {key:eventName,style:{display:"grid",gridTemplateColumns:"minmax(0,1fr) auto auto auto auto",alignItems:"center",gap:8,padding:"10px 12px",borderRadius:11,border:"1px solid rgba(78,205,196,.14)",background:"rgba(11,27,26,.92)",textAlign:"left"}},
              React.createElement("div", {style:{fontSize:12,fontWeight:800,color:"var(--text)"}}, label),
              React.createElement("div", {style:{textAlign:"right"}}, React.createElement("div", {style:{fontSize:17,fontWeight:900,color:"var(--text)"}}, number(metric.users)), React.createElement("div", {style:{fontSize:9,color:"var(--text-faint)"}}, "Users")),
              React.createElement("div", {style:{textAlign:"right",minWidth:42}}, React.createElement("div", {style:{fontSize:17,fontWeight:900,color:"var(--text)"}}, number(metric.total)), React.createElement("div", {style:{fontSize:9,color:"var(--text-faint)"}}, "Uses")),
              React.createElement("div", {style:{textAlign:"right",minWidth:52}}, React.createElement("div", {style:{fontSize:17,fontWeight:900,color:"var(--text)"}}, average(averageUsers)), React.createElement("div", {style:{fontSize:9,color:"var(--text-faint)"}}, "Avg Users")),
              React.createElement("div", {style:{textAlign:"right",minWidth:52}}, React.createElement("div", {style:{fontSize:17,fontWeight:900,color:"var(--text)"}}, average(averageUses)), React.createElement("div", {style:{fontSize:9,color:"var(--text-faint)"}}, "Avg Uses"))
            );
          }))
        )
      )
    )
  );
};

export { FounderDashboard };
