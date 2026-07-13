import React from "react";
const { useState, useEffect, useMemo, useCallback, useRef } = React;
import { ActivityFeed } from "../pages/ActivityFeed.jsx";

const ActivityPage = ({group,currentUser,onLogMutation,clockTick,reactionOverrides,setReactionOverrides}) => {
  const wrapStyle = {maxWidth:1060,margin:"0 auto",padding:"20px 16px"};
  const handleReaction = (owner, logId, emoji) => onLogMutation({ action:"reaction", groupId:group.id, actor:currentUser, owner, logId, emoji });
  const handleFlag = async (owner, logId, reason) => {
    const result = await onLogMutation({ action:"flag", groupId:group.id, actor:currentUser, owner, logId, reason });
    return result;
  };
  const handleRespond = (owner, logId, response) => onLogMutation({ action:"flag-response", groupId:group.id, actor:currentUser, owner, logId, response });
  const handleReview = (owner, logId, decision) => onLogMutation({ action:"flag-review", groupId:group.id, actor:currentUser, owner, logId, decision });

  return React.createElement('div',{style:wrapStyle},
    React.createElement(ActivityFeed,{group,currentUser,onReact:handleReaction,onFlag:handleFlag,onRespond:handleRespond,onReview:handleReview,clockTick,reactionOverrides,setReactionOverrides})
  );
};

// ─── PIN MODAL ────────────────────────────────────────────────────────────────

export { ActivityPage };
