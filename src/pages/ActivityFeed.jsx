import React from "react";
const { useState, useEffect, useMemo, useCallback, useRef } = React;
import {
  QUICK_REACTIONS,
  countApprovedFlagsForActor,
  flattenFeedPosts
} from "../lib/appState.js";
import {
  formatShortDate,
  formatCompactRelativeTime,
  isRecentPastTimestamp,
  isMobile
} from "../lib/utils.js";
import { Avatar, WorkoutTypeIcon, Card } from "../components/primitives.jsx";
import { TextEntryModal, NoticeModal, ImageLightbox } from "../modals/modals.jsx";

const getReactionKey = (groupId, owner, logId, emoji) => `${groupId || ""}:${owner || ""}:${logId || ""}:${emoji || ""}`;

const normalizeReactionMembers = (members) => Array.isArray(members)
  ? Array.from(new Set(members.filter(Boolean))).sort()
  : [];

const reactionsMatch = (a, b) => {
  const left = normalizeReactionMembers(a);
  const right = normalizeReactionMembers(b);
  return left.length === right.length && left.every((member, index) => member === right[index]);
};

const ActivityFeed = ({group,currentUser,onReact,onFlag,onRespond,onReview,clockTick,reactionOverrides,setReactionOverrides}) => {
  const [flagTarget,setFlagTarget]=useState(null);
  const [flagReason,setFlagReason]=useState("");
  const [responseTarget,setResponseTarget]=useState(null);
  const [responseText,setResponseText]=useState("");
  const [reactionTarget,setReactionTarget]=useState(null);
  const [reactionPopover,setReactionPopover]=useState(null);
  const [localReactionOverrides,setLocalReactionOverrides]=useState({});
  const [imageTarget,setImageTarget]=useState(null);
  const [notice,setNotice]=useState(null);
  const reactionPressTimer = useRef(null);
  const reactionLongPressKey = useRef("");
  const reactionPopoverRef = useRef(null);
  const activeReactionOverrides = reactionOverrides || localReactionOverrides;
  const updateReactionOverrides = setReactionOverrides || setLocalReactionOverrides;
  const baseFeedPosts = useMemo(()=>flattenFeedPosts(group),[group]);
  const feedPosts = useMemo(()=>baseFeedPosts.map(post => {
    const reactions = { ...(post.reactions || {}) };
    Object.values(activeReactionOverrides).forEach(override => {
      if (override.groupId !== group?.id || override.owner !== post.owner || override.logId !== post.id) return;
      reactions[override.emoji] = override.members;
    });
    return { ...post, reactions };
  }),[activeReactionOverrides, baseFeedPosts, group?.id]);
  const isAdmin = group?.adminName === currentUser;
  const approvedFlagCount = countApprovedFlagsForActor(group, currentUser);
  const cannotFlagMore = approvedFlagCount >= 3;
  const compactFeed = isMobile();
  useEffect(()=>{
    if (!reactionPopover) return;
    const handlePointerDown = event => {
      if (reactionPopoverRef.current && !reactionPopoverRef.current.contains(event.target)) {
        setReactionPopover(null);
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return ()=>document.removeEventListener("pointerdown", handlePointerDown);
  },[reactionPopover]);
  useEffect(()=>{
    updateReactionOverrides(current => {
      let changed = false;
      const next = {};
      Object.entries(current).forEach(([key, override]) => {
        if (override.groupId !== group?.id) {
          next[key] = override;
          return;
        }
        const post = baseFeedPosts.find(item => item.owner === override.owner && item.id === override.logId);
        if (!post) {
          changed = true;
          return;
        }
        const baseMembers = post?.reactions?.[override.emoji] || [];
        if (reactionsMatch(baseMembers, override.members)) {
          changed = true;
          return;
        }
        next[key] = override;
      });
      return changed ? next : current;
    });
  },[baseFeedPosts, group?.id, updateReactionOverrides]);
  const clearReactionTimer = () => {
    if (reactionPressTimer.current) {
      clearTimeout(reactionPressTimer.current);
      reactionPressTimer.current = null;
    }
  };
  const startReactionPress = (postId, emoji, members) => {
    clearReactionTimer();
    reactionLongPressKey.current = "";
    reactionPressTimer.current = setTimeout(()=>{
      reactionLongPressKey.current = `${postId}:${emoji}`;
      setReactionPopover({postId, emoji, names:members});
    }, 420);
  };
  const handleReact = useCallback((post, emoji) => {
    if (!currentUser) return;
    const key = getReactionKey(group?.id, post.owner, post.id, emoji);
    const currentMembers = normalizeReactionMembers(post.reactions?.[emoji]);
    const nextMembers = currentMembers.includes(currentUser)
      ? currentMembers.filter(member => member !== currentUser)
      : [...currentMembers, currentUser].sort();
    updateReactionOverrides(current => ({
      ...current,
      [key]: {
        groupId: group?.id,
        owner: post.owner,
        logId: post.id,
        emoji,
        members: nextMembers
      }
    }));
    Promise.resolve(onReact(post.owner, post.id, emoji)).then(result => {
      if (result?.ok === false) {
        updateReactionOverrides(current => {
          const next = { ...current };
          delete next[key];
          return next;
        });
      }
    }).catch(() => {
      updateReactionOverrides(current => {
        const next = { ...current };
        delete next[key];
        return next;
      });
    });
  },[currentUser, group?.id, onReact, updateReactionOverrides]);

  return React.createElement(React.Fragment,null,
    imageTarget && React.createElement(ImageLightbox,{src:imageTarget.src,alt:imageTarget.alt,onClose:()=>setImageTarget(null),canFlag:imageTarget.canFlag,onFlag:()=>{ setImageTarget(null); setFlagTarget(imageTarget.post); }}),
    notice && React.createElement(NoticeModal,{title:notice.title,body:notice.body,onClose:()=>setNotice(null)}),
    flagTarget && React.createElement(TextEntryModal,{
      title:"Flag this workout?",
      label:"Add a reason (optional)",
      placeholder:"Why does this look suspicious?",
      value:flagReason,
      setValue:setFlagReason,
      confirmLabel:"Flag it",
      accent:"var(--red)",
      onClose:()=>{ setFlagTarget(null); setFlagReason(""); },
      onConfirm:async ()=>{
        const result = await onFlag(flagTarget.owner, flagTarget.id, flagReason.trim());
        if (!result?.ok) {
          setNotice({
            title:"Flag not submitted",
            body:result?.error || "Unable to flag this workout right now."
          });
          return;
        }
        setFlagTarget(null);
        setFlagReason("");
      }
    }),
    responseTarget && React.createElement(TextEntryModal,{
      title:"Respond to flag",
      label:"Your response",
      placeholder:"Add context for your Bloc",
      value:responseText,
      setValue:setResponseText,
      confirmLabel:"Post response",
      onClose:()=>{ setResponseTarget(null); setResponseText(""); },
      onConfirm:()=>{ onRespond(responseTarget.owner, responseTarget.id, responseText.trim()); setResponseTarget(null); setResponseText(""); }
    }),
    React.createElement(Card,{style:{overflow:"hidden"}},
      React.createElement('div',{style:{padding:"12px 15px",borderBottom:"1px solid var(--border)",display:"flex",alignItems:"center",justifyContent:"space-between"}},
        React.createElement('div',{style:{fontWeight:800,fontSize:15}},"Activity Feed"),
        React.createElement('span',{className:"mono",style:{fontSize:9,color:"var(--muted)"}},`${feedPosts.length} post${feedPosts.length===1?"":"s"}`)
      ),
      !feedPosts.length
        ? React.createElement('div',{style:{padding:"18px 15px",fontSize:13,color:"var(--muted)"}},"No workouts logged yet.")
        : React.createElement('div',{style:{display:"flex",flexDirection:"column",gap:6,padding:10}},
            feedPosts.map((post,index)=>{
              const displayDate = post.date;
              const showDateHeader = index === 0 || feedPosts[index - 1]?.date !== displayDate;
              const hasThumbnail = Boolean(post.photoUrl);
              const isOwner = post.owner === currentUser;
              const canFlag = !isOwner && post.verifiedVia !== "strava";
              const reactionEntries = Object.entries(post.reactions || {})
                .filter(([, members]) => Array.isArray(members) && members.length)
                .sort((a,b)=>b[1].length-a[1].length);
              const categoryIcon = React.createElement(WorkoutTypeIcon,{type:post.type,size:13});
              const showRelativeTime = isRecentPastTimestamp(post.createdAt, clockTick || Date.now());
              const compactRelativeTime = showRelativeTime ? formatCompactRelativeTime(post.createdAt) : "";
              return React.createElement(React.Fragment,{key:`${post.owner}-${post.id}`},
                showDateHeader && React.createElement('div',{style:{display:"flex",alignItems:"center",gap:10,padding:"6px 2px 2px"}},
                  React.createElement('span',{className:"mono",style:{fontSize:10,color:"#4ECDC4",letterSpacing:".08em",textTransform:"uppercase",whiteSpace:"nowrap"}},formatShortDate(displayDate)),
                  React.createElement('div',{style:{height:1,flex:1,background:"rgba(78,205,196,.18)"}})
                ),
                React.createElement('div',{style:{
                  border:`0.5px solid ${post.flagStatus==="flagged"?"rgba(232,69,69,.35)":"#103434"}`,
                  borderRadius:10,
                  background:"#080F0F",
                  overflow:"hidden"
                }},
                hasThumbnail
                ? React.createElement('div',{style:{padding:"10px 14px 10px"}},
                    React.createElement('div',{style:{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:12}},
                      React.createElement('div',{style:{flex:1,minWidth:0,minHeight:72,display:"flex",flexDirection:"column",justifyContent:"space-between"}},
                        React.createElement('div',{style:{display:"flex",flexDirection:"column",gap:7}},
                          React.createElement('div',{style:{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,minWidth:0,whiteSpace:"nowrap"}},
                            React.createElement('div',{style:{display:"flex",alignItems:"center",gap:7,minWidth:0,flex:1}},
                              React.createElement(Avatar,{name:post.owner,size:28}),
                              React.createElement('span',{style:{fontWeight:600,fontSize:13,color:"#fff",minWidth:0,overflow:"hidden",textOverflow:"ellipsis",flex:"0 1 auto",maxWidth:hasThumbnail?(compactFeed?96:180):(compactFeed?116:220)}},post.owner),
                              React.createElement('span',{style:{display:"inline-flex",alignItems:"center",gap:4,color:"var(--muted)",fontSize:11.5,flexShrink:0}},
                                React.createElement('span',{style:{display:"inline-flex",alignItems:"center",justifyContent:"center",color:"var(--cyan)",width:14}},categoryIcon),
                                React.createElement('span',null,post.type)
                              ),
                              React.createElement('span',{className:"mono",style:{fontSize:9,color:"var(--muted2)",letterSpacing:"-.01em",flexShrink:0}},formatShortDate(displayDate))
                            ),
                            React.createElement('div',{style:{display:"flex",alignItems:"center",gap:5,flexShrink:0,marginLeft:6}},
                              compactRelativeTime && React.createElement('span',{className:"mono",style:{fontSize:8,color:"var(--muted)",opacity:0.58}},compactRelativeTime),
                              post.verifiedVia==="strava" && React.createElement('span',{className:"mono",style:{fontSize:9,color:"var(--cyan)",letterSpacing:".05em",textTransform:"uppercase"}},"Strava")
                            )
                          ),
                          post.note && React.createElement('div',{style:{fontSize:12,lineHeight:1.3,color:"var(--text-soft)",fontStyle:"italic",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}},post.note)
                        ),
                        React.createElement('div',{style:{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap",paddingTop:6}},
                          reactionEntries.map(([emoji, members])=>{
                            const active = members.includes(currentUser);
                            const reactionKey = `${post.id}:${emoji}`;
                            return React.createElement('div',{key:`bottom-${emoji}`,style:{position:"relative",display:"inline-flex"}},
                              React.createElement('button',{type:"button",onContextMenu:e=>e.preventDefault(),onMouseDown:()=>startReactionPress(post.id, emoji, members),onMouseUp:clearReactionTimer,onMouseLeave:clearReactionTimer,onTouchStart:()=>startReactionPress(post.id, emoji, members),onTouchEnd:clearReactionTimer,onTouchCancel:clearReactionTimer,onClick:()=>{ if (reactionLongPressKey.current===reactionKey) { reactionLongPressKey.current=""; return; } handleReact(post, emoji); },style:{height:24,padding:"0 8px",borderRadius:999,background:active?"rgba(78,205,196,.12)":"var(--s1)",border:`1px solid ${active?"rgba(78,205,196,.35)":"var(--border)"}`,fontSize:11,color:active?"var(--cyan)":"var(--muted)",display:"inline-flex",alignItems:"center",gap:4}},
                                React.createElement('span',null,emoji),
                                React.createElement('span',{className:"mono",style:{fontSize:9,color:active?"var(--cyan)":"var(--muted)"}},members.length)
                              ),
                              reactionPopover?.postId===post.id && reactionPopover?.emoji===emoji && React.createElement('div',{ref:reactionPopoverRef,style:{position:"absolute",left:0,bottom:"calc(100% + 6px)",zIndex:5,minWidth:120,maxWidth:220,padding:"8px 10px",borderRadius:10,background:"rgba(9,14,14,.98)",border:"1px solid var(--border2)",boxShadow:"0 14px 30px rgba(0,0,0,.28)",fontSize:12,color:"var(--text)",lineHeight:1.4,whiteSpace:"normal",userSelect:"none",WebkitUserSelect:"none",WebkitTouchCallout:"none",pointerEvents:"none"}},
                                `${emoji} ${reactionPopover.names.join(", ")}`
                              )
                            );
                          }),
                          React.createElement('button',{type:"button",onClick:()=>setReactionTarget(reactionTarget===post.id?null:post.id),style:{height:24,padding:"0 8px",borderRadius:999,background:"var(--s1)",border:"1px solid var(--border)",fontSize:11,color:"var(--muted)"}},"＋")
                        ),
                      ),
                      React.createElement('button',{type:"button",onClick:()=>setImageTarget({src:post.photoUrl,alt:`${post.owner} ${post.type}`,post,canFlag}),style:{display:"block",width:72,height:72,padding:0,borderRadius:8,overflow:"hidden",background:"#050507",border:"1px solid rgba(255,255,255,.08)",flexShrink:0,marginTop:2}},
                        React.createElement('img',{src:post.photoUrl,alt:`${post.owner} ${post.type}`,style:{display:"block",width:"100%",height:"100%",objectFit:"cover"}})
                      )
                    ),
                  )
                : React.createElement('div',{style:{padding:"8px 12px",display:"flex",flexDirection:"column",gap:14}},
                    React.createElement('div',{style:{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,minWidth:0}},
                      React.createElement('div',{style:{display:"flex",alignItems:"center",gap:7,minWidth:0,flex:1}},
                        React.createElement(Avatar,{name:post.owner,size:22}),
                        React.createElement('span',{style:{fontWeight:600,fontSize:13,color:"#fff",minWidth:0,overflow:"hidden",textOverflow:"ellipsis",flex:"0 1 auto",maxWidth:compactFeed?116:220}},post.owner),
                        React.createElement('span',{style:{display:"inline-flex",alignItems:"center",gap:4,color:"var(--muted)",fontSize:11.5,flexShrink:0}},
                          React.createElement('span',{style:{display:"inline-flex",alignItems:"center",justifyContent:"center",color:"var(--cyan)",width:14}},categoryIcon),
                          React.createElement('span',null,post.type)
                        ),
                        React.createElement('span',{className:"mono",style:{fontSize:9,color:"var(--muted2)",letterSpacing:"-.01em",flexShrink:0}},formatShortDate(displayDate))
                      ),
                      React.createElement('div',{style:{display:"flex",alignItems:"center",gap:5,flexShrink:0,marginLeft:6}},
                        compactRelativeTime && React.createElement('span',{className:"mono",style:{fontSize:8,color:"var(--muted)",opacity:0.58}},compactRelativeTime),
                        post.verifiedVia==="strava" && React.createElement('span',{className:"mono",style:{fontSize:9,color:"var(--cyan)",letterSpacing:".05em",textTransform:"uppercase",flexShrink:0}},"Strava")
                      )
                    ),
                    React.createElement('div',{style:{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap",marginLeft:-2}},
                      reactionEntries.map(([emoji, members])=>{
                        const active = members.includes(currentUser);
                        const reactionKey = `${post.id}:${emoji}`;
                        return React.createElement('div',{key:`compact-${emoji}`,style:{position:"relative",display:"inline-flex"}},
                          React.createElement('button',{type:"button",onContextMenu:e=>e.preventDefault(),onMouseDown:()=>startReactionPress(post.id, emoji, members),onMouseUp:clearReactionTimer,onMouseLeave:clearReactionTimer,onTouchStart:()=>startReactionPress(post.id, emoji, members),onTouchEnd:clearReactionTimer,onTouchCancel:clearReactionTimer,onClick:()=>{ if (reactionLongPressKey.current===reactionKey) { reactionLongPressKey.current=""; return; } handleReact(post, emoji); },style:{height:22,padding:"0 7px",borderRadius:999,background:active?"rgba(78,205,196,.12)":"var(--s1)",border:`1px solid ${active?"rgba(78,205,196,.35)":"var(--border)"}`,fontSize:11,color:active?"var(--cyan)":"var(--muted)",display:"inline-flex",alignItems:"center",gap:4}},
                            React.createElement('span',null,emoji),
                            React.createElement('span',{className:"mono",style:{fontSize:9,color:active?"var(--cyan)":"var(--muted)"}},members.length)
                          ),
                          reactionPopover?.postId===post.id && reactionPopover?.emoji===emoji && React.createElement('div',{ref:reactionPopoverRef,style:{position:"absolute",left:0,bottom:"calc(100% + 6px)",zIndex:5,minWidth:120,maxWidth:220,padding:"8px 10px",borderRadius:10,background:"rgba(9,14,14,.98)",border:"1px solid var(--border2)",boxShadow:"0 14px 30px rgba(0,0,0,.28)",fontSize:12,color:"var(--text)",lineHeight:1.4,whiteSpace:"normal",userSelect:"none",WebkitUserSelect:"none",WebkitTouchCallout:"none",pointerEvents:"none"}},
                            `${emoji} ${reactionPopover.names.join(", ")}`
                          )
                        );
                      }),
                      React.createElement('button',{type:"button",onClick:()=>setReactionTarget(reactionTarget===post.id?null:post.id),style:{height:22,padding:"0 7px",borderRadius:999,background:"var(--s1)",border:"1px solid var(--border)",fontSize:11,color:"var(--muted)"}},"＋")
                    )
                  ),
                  post.flagStatus==="flagged" && React.createElement('div',{style:{padding:"9px 11px",borderRadius:10,background:"rgba(232,69,69,.08)",border:"1px solid rgba(232,69,69,.22)",marginBottom:8}},
                    isAdmin && post.flaggedBy && React.createElement('div',{style:{fontSize:12,color:"var(--amber)",lineHeight:1.45,marginBottom:(post.flagReason || post.flagResponse)?8:0}},React.createElement('strong',null,"Flagged by: "),post.flaggedBy),
                    post.flagReason && React.createElement('div',{style:{fontSize:12,color:"#ffd7d7",lineHeight:1.45,marginBottom:post.flagResponse?8:0}},React.createElement('strong',null,"Flag reason: "),post.flagReason),
                    post.flagResponse && React.createElement('div',{style:{fontSize:12,color:"var(--text)",lineHeight:1.45}},React.createElement('strong',null,"Response: "),post.flagResponse)
                  ),
                  post.flagStatus==="rejected" && React.createElement('div',{style:{padding:"9px 11px",borderRadius:10,background:"rgba(232,69,69,.08)",border:"1px solid rgba(232,69,69,.22)",marginBottom:8,fontSize:12,color:"#ffd7d7"}},
                    isAdmin && post.flaggedBy && React.createElement('div',{style:{marginBottom:6,color:"var(--amber)"}},React.createElement('strong',null,"Original flag by: "),post.flaggedBy),
                    "The bloc admin rejected this workout."
                  ),
                  React.createElement('div',{style:{display:"flex",alignItems:"center",justifyContent:"flex-end",gap:8,flexWrap:"wrap",marginTop:post.flagStatus ? 8 : 0}},
                    React.createElement('div',{style:{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}},
                      isOwner && post.flagStatus==="flagged" && React.createElement('button',{type:"button",onClick:()=>setResponseTarget(post),style:{background:"transparent",color:"var(--muted)",fontSize:12,textDecoration:"underline",padding:0}},"Respond to flag"),
                      isAdmin && post.flagStatus==="flagged" && React.createElement(React.Fragment,null,
                        React.createElement('button',{type:"button",onClick:()=>onReview(post.owner, post.id, "approve"),style:{padding:"7px 10px",borderRadius:8,background:"var(--green-dim)",border:"1px solid rgba(31,206,101,.3)",color:"var(--green)",fontSize:11,fontWeight:800}},"Approve workout"),
                        React.createElement('button',{type:"button",onClick:()=>onReview(post.owner, post.id, "reject"),style:{padding:"7px 10px",borderRadius:8,background:"var(--red-dim)",border:"1px solid rgba(232,69,69,.28)",color:"var(--red)",fontSize:11,fontWeight:800}},"Reject workout")
                      )
                    )
                  ),
                  reactionTarget===post.id && React.createElement('div',{style:{marginTop:8,padding:"10px 12px",borderRadius:12,background:"var(--s1)",border:"1px solid var(--border)",display:"grid",gap:10}},
                    React.createElement('div',{style:{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}},
                      QUICK_REACTIONS.map(emoji=>
                        React.createElement('button',{key:emoji,type:"button",onClick:()=>{ handleReact(post, emoji); setReactionTarget(null); },style:{width:40,height:40,borderRadius:999,background:"var(--s2)",border:"1px solid var(--border)",fontSize:22,color:"var(--text)"}},emoji)
                      )
                    )
                  )
                )
              );
            })
          )
    )
  );
};

// ─── PLAYER PROFILE ───────────────────────────────────────────────────────────

export { ActivityFeed };
