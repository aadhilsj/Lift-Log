const cancelSwipeFrame = frameRef => {
  if (!frameRef?.current) return;
  cancelAnimationFrame(frameRef.current);
  frameRef.current = null;
};

const clearInlineSwipeStyles = elements => {
  elements.filter(Boolean).forEach(el => {
    el.style.transform = "";
    el.style.transition = "";
    el.style.boxShadow = "";
    el.style.willChange = "";
  });
};

const releaseSwipeForward = ({
  dragRef,
  frameRef,
  finalX,
  transitionMs = 80,
  setDragging,
  applyTransform,
  commit,
  cleanup
}) => {
  cancelSwipeFrame(frameRef);
  dragRef.current = finalX;
  setDragging?.(false);
  applyTransform(finalX, false);
  window.setTimeout(() => {
    dragRef.current = 0;
    commit?.();
    requestAnimationFrame(() => cleanup?.());
  }, transitionMs);
};

const releaseSwipeBack = ({
  dragRef,
  frameRef,
  transitionMs = 80,
  setDragging,
  applyTransform,
  cleanup
}) => {
  cancelSwipeFrame(frameRef);
  dragRef.current = 0;
  setDragging?.(false);
  applyTransform(0, false);
  window.setTimeout(() => cleanup?.(), transitionMs);
};

export {
  cancelSwipeFrame,
  clearInlineSwipeStyles,
  releaseSwipeBack,
  releaseSwipeForward
};
