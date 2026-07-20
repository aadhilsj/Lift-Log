import React from "react";
const { useState, useEffect, useMemo, useCallback, useRef } = React;
import {
  QUICK_REACTIONS,
  countApprovedFlagsForActor,
  flattenFeedPosts
} from "../lib/appState.js";
import { getLogCommentCountsData } from "../lib/api.js";
import {
  formatShortDate,
  formatCompactRelativeTime,
  isRecentPastTimestamp,
  isMobile
} from "../lib/utils.js";
import { Avatar, AppIcon, WorkoutTypeIcon, Card } from "../components/primitives.jsx";
import { LogCommentThread } from "../components/LogCommentThread.jsx";
import { TextEntryModal, NoticeModal } from "../modals/modals.jsx";

const getReactionKey = (groupId, owner, logId, emoji) => `${groupId || ""}:${owner || ""}:${logId || ""}:${emoji || ""}`;

const normalizeReactionMembers = (members) => Array.isArray(members)
  ? Array.from(new Set(members.filter(Boolean))).sort()
  : [];

const reactionsMatch = (a, b) => {
  const left = normalizeReactionMembers(a);
  const right = normalizeReactionMembers(b);
  return left.length === right.length && left.every((member, index) => member === right[index]);
};
const reactionSortIndex = emoji => {
  const index = QUICK_REACTIONS.indexOf(emoji);
  return index === -1 ? QUICK_REACTIONS.length : index;
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
  const [commentTarget,setCommentTarget]=useState(null);
  const [commentCounts,setCommentCounts]=useState({});
  const [notice,setNotice]=useState(null);
  const reactionPressTimer = useRef(null);
  const reactionLongPressKey = useRef("");
  const reactionSuppressClickKey = useRef("");
  const reactionPopoverRef = useRef(null);
  const reactionPickerRef = useRef(null);
  const photoSwipeStart = useRef(null);
  const photoSwipeHandled = useRef(false);
  const activeReactionOverrides = reactionOverrides || localReactionOverrides;
  const updateReactionOverrides = setReactionOverrides || setLocalReactionOverrides;
  const baseFeedPosts = useMemo(()=>flattenFeedPosts(group),[group]);
  const userIdForOwner = useCallback(owner => {
    const match = Object.values(group?.memberships || {}).find(membership => membership?.displayName === owner);
    return match?.userId || "";
  },[group?.memberships]);
  const feedPosts = useMemo(()=>baseFeedPosts.map(post => {
    const reactions = { ...(post.reactions || {}) };
    Object.values(activeReactionOverrides).forEach(override => {
      if (override.groupId !== group?.id || override.owner !== post.owner || override.logId !== post.id) return;
      const members = normalizeReactionMembers(override.members);
      if (members.length > 0) reactions[override.emoji] = members;
      else delete reactions[override.emoji];
    });
    return { ...post, reactions };
  }),[activeReactionOverrides, baseFeedPosts, group?.id]);
  const photoFeedPosts = useMemo(()=>feedPosts.filter(post=>post.photoUrl),[feedPosts]);
  const isAdmin = group?.adminName === currentUser;
  const approvedFlagCount = countApprovedFlagsForActor(group, currentUser);
  const cannotFlagMore = approvedFlagCount >= 3;
  const compactFeed = isMobile();
  const getCommentCount = useCallback(post => {
    const key = String(post?.id || "");
    const override = commentCounts[key];
    if (Number.isFinite(Number(override))) return Math.max(0, Number(override));
    return Number.isFinite(Number(post?.commentCount)) ? Math.max(0, Number(post.commentCount)) : 0;
  },[commentCounts]);
  const updateCommentCount = useCallback((logId, count) => {
    const key = String(logId || "");
    if (!key) return;
    setCommentCounts(current => ({ ...current, [key]: Math.max(0, Number(count || 0)) }));
  },[]);
  useEffect(()=>{
    if (!group?.id || !feedPosts.length) return undefined;
    const logIds = feedPosts.map(post => String(post.id || "")).filter(Boolean);
    let cancelled = false;
    const refreshCounts = async () => {
      const result = await getLogCommentCountsData(group.id, logIds);
      if (cancelled || !result?.ok) return;
      setCommentCounts(current => ({ ...current, ...result.counts }));
    };
    refreshCounts();
    const id = window.setInterval(refreshCounts, 8000);
    return ()=>{ cancelled = true; window.clearInterval(id); };
  },[feedPosts, group?.id]);
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
    if (!reactionTarget) return;
    const handlePointerDown = event => {
      if (!event.target?.closest?.('[data-reaction-picker-root="true"]')) {
        setReactionTarget(null);
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return ()=>document.removeEventListener("pointerdown", handlePointerDown);
  },[reactionTarget]);
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
    Promise.resolve(onReact(post.owner, post.id, emoji, nextMembers.includes(currentUser))).then(result => {
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
  useEffect(()=>{
    if (!imageTarget) return;
    const previousOverflow = document.body.style.overflow;
    const previousTouchAction = document.body.style.touchAction;
    document.body.style.overflow = "hidden";
    document.body.style.touchAction = "none";
    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.touchAction = previousTouchAction;
    };
  },[imageTarget]);
  const clearReactionTimer = () => {
    if (reactionPressTimer.current) {
      clearTimeout(reactionPressTimer.current);
      reactionPressTimer.current = null;
    }
  };
  const startReactionPress = (postId, emoji, members) => {
    const reactionKey = `${postId}:${emoji}`;
    clearReactionTimer();
    if (reactionSuppressClickKey.current === reactionKey) return;
    reactionLongPressKey.current = "";
    reactionPressTimer.current = setTimeout(()=>{
      reactionLongPressKey.current = reactionKey;
      reactionSuppressClickKey.current = reactionKey;
      try { window.getSelection?.()?.removeAllRanges?.(); } catch {}
      setReactionPopover({postId, emoji, names:members});
    }, 420);
  };
  const handleReactionClick = (event, post, emoji, reactionKey) => {
    if (reactionSuppressClickKey.current === reactionKey || reactionLongPressKey.current === reactionKey) {
      event.preventDefault();
      reactionSuppressClickKey.current = "";
      reactionLongPressKey.current = "";
      return;
    }
    handleReact(post, emoji);
  };
  const renderReactionPicker = (post, centered=false) => reactionTarget===post.id && React.createElement('div',{"data-reaction-picker-root":"true",style:{position:"absolute",left:centered?"50%":"calc(100% + 5px)",top:centered?"auto":"calc(100% + 5px)",bottom:centered?"calc(100% + 4px)":"auto",transform:centered?"translateX(-50%)":"none",zIndex:8,width:"max-content",maxWidth:"calc(100vw - 48px)",padding:"6px 8px",borderRadius:999,background:"rgba(8,15,15,.96)",border:"1px solid rgba(78,205,196,.16)",boxShadow:"0 14px 32px rgba(0,0,0,.34), inset 0 1px 0 rgba(255,255,255,.05)",display:"grid",gap:6,overflowX:"auto",WebkitOverflowScrolling:"touch"}},
    React.createElement('div',{style:{display:"flex",alignItems:"center",gap:5,flexWrap:"nowrap",justifyContent:"center",minWidth:"max-content"}},
      QUICK_REACTIONS.map(emoji=>
        React.createElement('button',{key:emoji,type:"button",onClick:()=>{ handleReact(post, emoji); setReactionTarget(null); },style:{width:24,height:24,borderRadius:999,background:"var(--s2)",border:"1px solid var(--border)",fontSize:13,color:"var(--text)",display:"inline-flex",alignItems:"center",justifyContent:"center",padding:0,flex:"0 0 auto"}},emoji)
      )
    )
  );
  const renderReactionRow = (post, compact=false, suppressFloating=false, centered=false) => {
    const reactionEntries = Object.entries(post.reactions || {})
      .filter(([, members]) => Array.isArray(members) && members.length > 0)
      .sort((a,b)=>(b[1].length-a[1].length) || (reactionSortIndex(a[0])-reactionSortIndex(b[0])));
    const commentCount = getCommentCount(post);
    return React.createElement('div',{style:{position:centered?"relative":"static",display:"flex",alignItems:"center",justifyContent:centered?"center":"flex-start",gap:6,flexWrap:"wrap",paddingTop:compact?0:6,marginLeft:centered?0:(compact?-2:0)}},
      reactionEntries.map(([emoji, members])=>{
        const active = members.includes(currentUser);
        const reactionKey = `${post.id}:${emoji}`;
        return React.createElement('div',{key:`${compact?"compact":"bottom"}-${emoji}`,style:{position:"relative",display:"inline-flex"}},
          React.createElement('button',{type:"button",onContextMenu:e=>e.preventDefault(),onSelectStart:e=>e.preventDefault(),onDragStart:e=>e.preventDefault(),onMouseDown:e=>{e.preventDefault();startReactionPress(post.id, emoji, members);},onMouseUp:clearReactionTimer,onMouseLeave:clearReactionTimer,onTouchStart:()=>startReactionPress(post.id, emoji, members),onTouchEnd:clearReactionTimer,onTouchCancel:clearReactionTimer,onClick:e=>handleReactionClick(e, post, emoji, reactionKey),style:{height:compact?20:22,padding:compact?"0 6px":"0 7px",borderRadius:999,background:active?"rgba(78,205,196,.12)":"var(--s1)",border:`1px solid ${active?"rgba(78,205,196,.35)":"var(--border)"}`,fontSize:10.5,color:active?"var(--cyan)":"var(--muted)",display:"inline-flex",alignItems:"center",gap:3,userSelect:"none",WebkitUserSelect:"none",WebkitTouchCallout:"none",touchAction:"manipulation"}},
            React.createElement('span',null,emoji),
            React.createElement('span',{className:"mono",style:{fontSize:8.5,color:active?"var(--cyan)":"var(--muted)"}},members.length)
          ),
          !suppressFloating && reactionPopover?.postId===post.id && reactionPopover?.emoji===emoji && React.createElement('div',{ref:reactionPopoverRef,style:{position:"absolute",left:0,bottom:"calc(100% + 6px)",zIndex:5,minWidth:120,maxWidth:220,padding:"8px 10px",borderRadius:10,background:"rgba(9,14,14,.98)",border:"1px solid var(--border2)",boxShadow:"0 14px 30px rgba(0,0,0,.28)",fontSize:12,color:"var(--text)",lineHeight:1.4,whiteSpace:"normal",userSelect:"none",WebkitUserSelect:"none",WebkitTouchCallout:"none",pointerEvents:"none"}},
            `${emoji} ${reactionPopover.names.join(", ")}`
          )
        );
      }),
      React.createElement('div',{"data-reaction-picker-root":"true",ref:reactionTarget===post.id?reactionPickerRef:null,style:{position:centered?"static":"relative",display:"inline-flex"}},
        React.createElement('button',{type:"button",onClick:()=>setReactionTarget(reactionTarget===post.id?null:post.id),style:{height:compact?20:22,padding:compact?"0 6px":"0 7px",borderRadius:999,background:"var(--s1)",border:"1px solid var(--border)",fontSize:10.5,color:"var(--muted)"}},"＋"),
        !suppressFloating && renderReactionPicker(post, centered)
      ),
      !centered && React.createElement('button',{
        type:"button",
        onClick:()=>setCommentTarget(post),
        style:{height:compact?20:22,padding:compact?"3px 7px":"3px 8px",borderRadius:14,background:"#0D1F1E",border:"0.5px solid #163d36",fontSize:12,color:commentCount>0?"#4ECDC4":"#3d5e59",display:"inline-flex",alignItems:"center",gap:4,lineHeight:1}
      },
        React.createElement(AppIcon,{name:"message-circle",size:13,stroke:"currentColor"}),
        React.createElement('span',{className:"mono",style:{fontSize:9,color:"currentColor"}},commentCount)
      )
    );
  };
  const imagePost = imageTarget
    ? photoFeedPosts.find(post=>post.owner===imageTarget.owner && post.id===imageTarget.id) || imageTarget.post
    : null;
  const imageIndex = imagePost ? photoFeedPosts.findIndex(post=>post.owner===imagePost.owner && post.id===imagePost.id) : -1;
  const closeImage = () => {
    setImageTarget(null);
    setReactionTarget(null);
    setReactionPopover(null);
  };
  const navigateImage = direction => {
    const nextIndex = imageIndex + direction;
    const nextPost = photoFeedPosts[nextIndex];
    if (!nextPost) {
      closeImage();
      return;
    }
    setReactionTarget(null);
    setReactionPopover(null);
    setImageTarget({owner:nextPost.owner,id:nextPost.id});
  };
  const handlePhotoPointerDown = event => {
    photoSwipeStart.current = {x:event.clientX,y:event.clientY};
    photoSwipeHandled.current = false;
  };
  const handlePhotoPointerUp = event => {
    const start = photoSwipeStart.current;
    photoSwipeStart.current = null;
    if (!start) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
    photoSwipeHandled.current = true;
    navigateImage(dx < 0 ? 1 : -1);
  };
  const handlePhotoTap = event => {
    event.stopPropagation();
    if (photoSwipeHandled.current) {
      photoSwipeHandled.current = false;
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    const tappedLeft = event.clientX - rect.left < rect.width / 2;
    navigateImage(tappedLeft ? -1 : 1);
  };
  const renderExpandedPhoto = () => {
    if (!imagePost) return null;
    const canFlag = imagePost.owner !== currentUser && imagePost.verifiedVia !== "strava";
    const categoryIcon = React.createElement(WorkoutTypeIcon,{type:imagePost.type,size:13});
    return React.createElement('div',{onClick:closeImage,style:{position:"fixed",inset:0,background:"rgba(0,0,0,0.92)",zIndex:260,display:"flex",alignItems:"center",justifyContent:"center",padding:compactFeed?"18px 14px":"24px"}},
      React.createElement('button',{type:"button",onClick:closeImage,style:{position:"fixed",top:16,right:16,zIndex:2,width:40,height:40,borderRadius:999,background:"rgba(7,7,10,.82)",border:"1px solid rgba(255,255,255,.12)",color:"#fff",fontSize:18,fontWeight:800}},"×"),
      canFlag && React.createElement('button',{type:"button",onClick:e=>{e.stopPropagation();closeImage();setFlagTarget(imagePost);},style:{position:"fixed",bottom:28,right:20,zIndex:2,display:"flex",alignItems:"center",gap:6,padding:"9px 14px",borderRadius:999,background:"rgba(7,7,10,.82)",border:"1px solid rgba(255,255,255,.1)",color:"rgba(255,255,255,.55)",fontSize:12,fontWeight:600,letterSpacing:".01em"}},
        React.createElement('svg',{width:13,height:13,viewBox:"0 0 24 24",fill:"currentColor",xmlns:"http://www.w3.org/2000/svg"},
          React.createElement('path',{d:"M4 21V4l1 1 2-2 2 2 2-2 2 2 2-2 2 2 1-1v13l-1-1-2 2-2-2-2 2-2-2-2 2-2-2-1 1z"})
        ),
        "Report"
      ),
      React.createElement('div',{onClick:e=>e.stopPropagation(),onPointerDown:handlePhotoPointerDown,onPointerUp:handlePhotoPointerUp,style:{width:"100%",maxWidth:720,maxHeight:"92vh",display:"flex",flexDirection:"column",gap:10}},
        React.createElement('div',{style:{display:"flex",alignItems:"center",justifyContent:"center",gap:7,minWidth:0,whiteSpace:"nowrap",padding:"0 2px",textAlign:"center"}},
          React.createElement(Avatar,{name:imagePost.owner,userId:userIdForOwner(imagePost.owner),size:28}),
          React.createElement('span',{style:{fontWeight:600,fontSize:13,color:"#fff",minWidth:0,overflow:"hidden",textOverflow:"ellipsis",flex:"0 1 auto",maxWidth:compactFeed?118:220}},imagePost.owner),
          React.createElement('span',{style:{display:"inline-flex",alignItems:"center",gap:4,color:"var(--muted)",fontSize:11.5,flexShrink:0}},
            React.createElement('span',{style:{display:"inline-flex",alignItems:"center",justifyContent:"center",color:"var(--cyan)",width:14}},categoryIcon),
            React.createElement('span',null,imagePost.type)
          ),
          React.createElement('span',{className:"mono",style:{fontSize:8,color:"var(--muted2)",letterSpacing:"-.01em",flexShrink:0}},formatShortDate(imagePost.date))
        ),
        React.createElement('img',{src:imagePost.photoUrl,alt:`${imagePost.owner} ${imagePost.type}`,onClick:handlePhotoTap,style:{display:"block",width:"100%",maxHeight:compactFeed?"62vh":"68vh",objectFit:"contain",borderRadius:12,background:"#050507",boxShadow:"0 24px 60px rgba(0,0,0,.45)",cursor:"pointer"}}),
        React.createElement('div',{style:{padding:"0 2px"}},renderReactionRow(imagePost,false,false,true)),
        imagePost.note && React.createElement('div',{style:{fontSize:14,lineHeight:1.45,color:"var(--text-soft)",fontStyle:"italic",whiteSpace:"pre-wrap",padding:"0 2px",overflowY:"auto",maxHeight:"18vh",textAlign:"center"}},imagePost.note)
      )
    );
  };

  return React.createElement(React.Fragment,null,
    renderExpandedPhoto(),
    commentTarget && React.createElement(LogCommentThread,{
      open:Boolean(commentTarget),
      groupId:group?.id,
      log:commentTarget,
      currentUserName:currentUser,
      onClose:()=>setCommentTarget(null),
      onCommentCountChange:updateCommentCount
    }),
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
        React.createElement('div',{style:{fontWeight:800,fontSize:15,textAlign:"left"}},"Activity Feed")
      ),
      !feedPosts.length
        ? React.createElement('div',{style:{padding:"18px 15px",fontSize:13,color:"var(--muted)"}},"No workouts logged yet.")
        : React.createElement('div',{style:{display:"flex",flexDirection:"column",gap:6,padding:10}},
            feedPosts.map((post,index)=>{
              const displayDate = post.date;
              const showDateHeader = index === 0 || feedPosts[index - 1]?.date !== displayDate;
              const hasThumbnail = Boolean(post.photoUrl);
              const isOwner = post.owner === currentUser;
              const categoryIcon = React.createElement(WorkoutTypeIcon,{type:post.type,size:13});
              const showRelativeTime = isRecentPastTimestamp(post.createdAt, clockTick || Date.now());
              const compactRelativeTime = showRelativeTime ? formatCompactRelativeTime(post.createdAt) : "";
              return React.createElement(React.Fragment,{key:`${post.owner}-${post.id}`},
                showDateHeader && React.createElement('div',{style:{display:"flex",alignItems:"center",gap:10,padding:"6px 2px 2px"}},
                  React.createElement('div',{style:{height:1,flex:1,background:"rgba(78,205,196,.18)"}}),
                  React.createElement('span',{className:"mono",style:{fontSize:10,color:"#4ECDC4",letterSpacing:".08em",textTransform:"uppercase",whiteSpace:"nowrap",textAlign:"center"}},formatShortDate(displayDate)),
                  React.createElement('div',{style:{height:1,flex:1,background:"rgba(78,205,196,.18)"}})
                ),
                React.createElement('div',{style:{
                  position:"relative",
                  border:`0.75px solid ${post.flagStatus==="flagged"?"rgba(232,69,69,.38)":"rgba(42,82,78,.64)"}`,
                  borderRadius:10,
                  background:"radial-gradient(circle at 14% 0%, rgba(255,255,255,.019), transparent 34%), radial-gradient(circle at 92% 100%, rgba(78,205,196,.024), transparent 40%), linear-gradient(180deg, rgba(7,16,16,.99), rgba(5,12,12,.99))",
                  boxShadow:"inset 0 1px 0 rgba(255,255,255,.028), 0 3px 9px rgba(0,0,0,.09)",
                  overflow:"visible"
                }},
                hasThumbnail
                ? React.createElement('div',{style:{padding:"10px 14px 10px"}},
                    React.createElement('div',{style:{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:12}},
                      React.createElement('div',{style:{flex:1,minWidth:0,minHeight:72,display:"flex",flexDirection:"column",justifyContent:"space-between"}},
                        React.createElement('div',{style:{display:"flex",flexDirection:"column",gap:7}},
                          React.createElement('div',{style:{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,minWidth:0,whiteSpace:"nowrap"}},
                            React.createElement('div',{style:{display:"flex",alignItems:"center",gap:7,minWidth:0,flex:1}},
                              React.createElement(Avatar,{name:post.owner,userId:userIdForOwner(post.owner),size:28}),
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
                          post.note && React.createElement('div',{style:{fontSize:12,lineHeight:1.32,color:"var(--text-soft)",fontStyle:"italic",overflow:"hidden",display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",whiteSpace:"normal"}},post.note)
                        ),
                        renderReactionRow(post,false,Boolean(imagePost)),
                      ),
                      React.createElement('button',{type:"button",onClick:()=>setImageTarget({owner:post.owner,id:post.id,post}),style:{display:"block",width:72,height:72,padding:0,borderRadius:8,overflow:"hidden",background:"#050507",border:"1px solid rgba(255,255,255,.08)",flexShrink:0,marginTop:2}},
                        React.createElement('img',{src:post.photoUrl,alt:`${post.owner} ${post.type}`,style:{display:"block",width:"100%",height:"100%",objectFit:"cover"}})
                      )
                    ),
                  )
                : React.createElement('div',{style:{padding:"8px 12px",display:"flex",flexDirection:"column",gap:14}},
                    React.createElement('div',{style:{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,minWidth:0}},
                      React.createElement('div',{style:{display:"flex",alignItems:"center",gap:7,minWidth:0,flex:1}},
                        React.createElement(Avatar,{name:post.owner,userId:userIdForOwner(post.owner),size:22}),
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
                    renderReactionRow(post,true,Boolean(imagePost))
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
                  null
                )
              );
            })
          )
    )
  );
};

// ─── PLAYER PROFILE ───────────────────────────────────────────────────────────

export { ActivityFeed };
