import React from "react";
const { useState, useRef, useEffect } = React;
import {
} from "../lib/appState.js";
import { PaymentHandleSection } from "../components/PaymentHandleSection.jsx";
import { ProfileStatsPanel } from "../components/ProfileStatsPanel.jsx";
import { buildProfileStats } from "../lib/profileStats.js";
import { Avatar, Card, AppIcon, WorkoutTypeIcon } from "../components/primitives.jsx";
import {
  cancelSwipeFrame,
  releaseSwipeBack,
  releaseSwipeForward
} from "../lib/swipeRelease.js";

// Premium block (everything under the "Premium" divider). Built fully
// & shown to everyone now. Flip this to add the paywall later without a rebuild —
// the single switch point, mirroring the History screen.
const PROFILE_PREMIUM_GATE = false; // eslint-disable-line no-unused-vars

const FULL_MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const isoOf = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
const sinceLabel = ts => {
  const d = ts ? new Date(ts) : null;
  if (!d || Number.isNaN(d.getTime())) return null;
  return `${FULL_MONTH_NAMES[d.getMonth()]} '${String(d.getFullYear()).slice(2)}`;
};
// Brand font system: inherited sans-serif, two weights only — 400 and 500.
const REG = 400, MED = 500;

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const ProfilePhotoCropModal = ({ imageSrc, onCancel, onConfirm }) => {
  const frameRef = useRef(null);
  const stateRef = useRef(null);
  const dragRef = useRef({ active:false, pointerId:null, x:0, y:0 });
  const [imageSize, setImageSize] = useState({ width:0, height:0 });
  const [frameSize, setFrameSize] = useState(0);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x:0, y:0 });
  const [ready, setReady] = useState(false);
  const [viewport, setViewport] = useState(() => ({
    height: typeof window !== "undefined" ? Math.floor(window.visualViewport?.height || window.innerHeight || 640) : 640,
    offsetTop: typeof window !== "undefined" ? Math.floor(window.visualViewport?.offsetTop || 0) : 0
  }));

  const minScale = imageSize.width && imageSize.height && frameSize
    ? frameSize / Math.min(imageSize.width, imageSize.height)
    : 1;
  const maxScale = Math.max(minScale * 4, minScale + .01);

  const clampOffset = (nextOffset, nextScale = scale) => {
    if (!imageSize.width || !imageSize.height || !frameSize) return { x:0, y:0 };
    const scaledWidth = imageSize.width * nextScale;
    const scaledHeight = imageSize.height * nextScale;
    const maxX = Math.max(0, (scaledWidth - frameSize) / 2);
    const maxY = Math.max(0, (scaledHeight - frameSize) / 2);
    return {
      x: Math.max(-maxX, Math.min(maxX, nextOffset.x)),
      y: Math.max(-maxY, Math.min(maxY, nextOffset.y))
    };
  };

  stateRef.current = { imageSize, frameSize, scale, offset };

  useEffect(() => {
    const updateFrame = () => {
      const rect = frameRef.current?.getBoundingClientRect();
      setFrameSize(Math.max(150, Math.min(236, Math.floor(rect?.width || 220))));
    };
    updateFrame();
    window.addEventListener("resize", updateFrame);
    return () => window.removeEventListener("resize", updateFrame);
  }, []);

  useEffect(() => {
    const updateViewport = () => {
      setViewport({
        height: Math.floor(window.visualViewport?.height || window.innerHeight || 640),
        offsetTop: Math.floor(window.visualViewport?.offsetTop || 0)
      });
    };
    updateViewport();
    window.visualViewport?.addEventListener("resize", updateViewport);
    window.visualViewport?.addEventListener("scroll", updateViewport);
    window.addEventListener("resize", updateViewport);
    return () => {
      window.visualViewport?.removeEventListener("resize", updateViewport);
      window.visualViewport?.removeEventListener("scroll", updateViewport);
      window.removeEventListener("resize", updateViewport);
    };
  }, []);

  useEffect(() => {
    const image = new Image();
    image.onload = () => {
      const nextSize = { width:image.naturalWidth, height:image.naturalHeight };
      const nextFrame = frameRef.current?.getBoundingClientRect()?.width || frameSize || 240;
      const nextMinScale = Math.max(150, Math.min(236, nextFrame)) / Math.min(nextSize.width, nextSize.height);
      setImageSize(nextSize);
      setScale(nextMinScale);
      setOffset({ x:0, y:0 });
      setReady(true);
    };
    image.src = imageSrc;
  }, [imageSrc]); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePointerDown = event => {
    event.currentTarget.setPointerCapture?.(event.pointerId);
    dragRef.current = { active:true, pointerId:event.pointerId, x:event.clientX, y:event.clientY };
  };
  const handlePointerMove = event => {
    const drag = dragRef.current;
    if (!drag.active || drag.pointerId !== event.pointerId) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    dragRef.current = { ...drag, x:event.clientX, y:event.clientY };
    setOffset(current => clampOffset({ x: current.x + dx, y: current.y + dy }));
  };
  const handlePointerEnd = event => {
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    dragRef.current = { active:false, pointerId:null, x:0, y:0 };
  };
  const handleScale = event => {
    const nextScale = Number(event.target.value);
    setScale(nextScale);
    setOffset(current => clampOffset(current, nextScale));
  };
  const handleConfirm = () => {
    const { imageSize: size, frameSize: frame, scale: activeScale, offset: activeOffset } = stateRef.current || {};
    if (!size?.width || !size?.height || !frame) return;
    const image = new Image();
    image.onload = () => {
      const sourceSize = frame / activeScale;
      const sourceX = (size.width / 2) - (activeOffset.x / activeScale) - (sourceSize / 2);
      const sourceY = (size.height / 2) - (activeOffset.y / activeScale) - (sourceSize / 2);
      const canvas = document.createElement("canvas");
      canvas.width = 720;
      canvas.height = 720;
      const context = canvas.getContext("2d");
      context.drawImage(image, sourceX, sourceY, sourceSize, sourceSize, 0, 0, 720, 720);
      onConfirm(canvas.toDataURL("image/jpeg", .84));
    };
    image.src = imageSrc;
  };

  const stopCropGesture = event => event.stopPropagation();
  const visibleHeight = Math.max(320, viewport.height || 640);
  const cropFrameSize = Math.max(150, Math.min(224, Math.floor((visibleHeight - 148) * .5)));
  return React.createElement('div', { onTouchStart:stopCropGesture, onTouchMove:stopCropGesture, onTouchEnd:stopCropGesture, onTouchCancel:stopCropGesture, onPointerDown:stopCropGesture, onPointerMove:stopCropGesture, onPointerUp:stopCropGesture, style:{ position:"fixed", left:0, right:0, top:viewport.offsetTop || 0, height:visibleHeight, zIndex:10000, background:"rgba(0,0,0,.94)", display:"flex", alignItems:"center", justifyContent:"center", overflow:"hidden", padding:"16px 16px", boxSizing:"border-box", touchAction:"none", overscrollBehavior:"contain" } },
    React.createElement('div', { style:{ width:"100%", maxWidth:390, maxHeight:"100%", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:10 } },
      React.createElement('div', { style:{ color:"#fff", fontSize:15, fontWeight:MED } }, "Edit Profile Photo"),
      React.createElement('div', {
        ref: frameRef,
        onPointerDown: handlePointerDown,
        onPointerMove: handlePointerMove,
        onPointerUp: handlePointerEnd,
        onPointerCancel: handlePointerEnd,
        style:{ width:`min(58vw, ${cropFrameSize}px)`, height:`min(58vw, ${cropFrameSize}px)`, minWidth:150, minHeight:150, maxWidth:224, maxHeight:224, position:"relative", overflow:"hidden", borderRadius:"50%", background:"#050507", touchAction:"none", boxShadow:"0 0 0 999px rgba(0,0,0,.38), 0 0 0 1.5px rgba(255,255,255,.74)" }
      },
        ready && React.createElement('img', {
          src:imageSrc,
          alt:"",
          draggable:false,
          style:{
            position:"absolute",
            left:"50%",
            top:"50%",
            width:imageSize.width * scale,
            height:imageSize.height * scale,
            transform:`translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`,
            userSelect:"none",
            WebkitUserSelect:"none",
            pointerEvents:"none"
          }
        })
      ),
      React.createElement('div', { style:{ width:"min(78vw, 320px)", display:"grid", gap:5 } },
        React.createElement('div', { style:{ display:"flex", alignItems:"center", justifyContent:"space-between", color:"rgba(255,255,255,.42)", fontSize:11 } },
          React.createElement('span', null, "Drag to move"),
          React.createElement('span', null, "Zoom")
        ),
        React.createElement('input', { type:"range", min:minScale, max:maxScale, step:(maxScale-minScale)/120 || .01, value:scale, onChange:handleScale, style:{ width:"100%", accentColor:"#4ECDC4" } })
      ),
      React.createElement('div', { style:{ display:"flex", gap:10, width:"min(78vw, 320px)" } },
        React.createElement('button', { type:"button", onClick:onCancel, style:{ flex:1, height:38, borderRadius:999, background:"#0D1F1E", border:"1px solid #163d36", color:"var(--muted)", fontSize:13, fontWeight:MED } }, "Cancel"),
        React.createElement('button', { type:"button", onClick:handleConfirm, style:{ flex:1, height:38, borderRadius:999, background:"#4ECDC4", border:"1px solid #4ECDC4", color:"#04110e", fontSize:13, fontWeight:MED } }, "Done")
      )
    )
  );
};

const ProfilePage = ({ visibleGroups = [], currentUserId, displayName, email, accountCreatedAt, profilePhotoUrl = "", onBack, onSwipeRevealChange, onEditName, onUpdateProfilePhoto, onSignOut, onDeleteAccount, currentPaymentMethods = [], onSavePayment, savingPayment = false, paymentError = "" }) => {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState("");
  const [localProfilePhotoUrl, setLocalProfilePhotoUrl] = useState(profilePhotoUrl || "");
  const [cropSource, setCropSource] = useState("");
  const [dragging, setDragging] = useState(false);
  const photoInputRef = useRef(null);
  const swipeRef = useRef({ sx: 0, sy: 0, active: false, mode: null });
  const surfaceRef = useRef(null);
  const dragXRef = useRef(0);
  const frameRef = useRef(null);
  useEffect(() => { setLocalProfilePhotoUrl(profilePhotoUrl || ""); }, [profilePhotoUrl]);

  // Cross-Bloc stats now live in src/lib/profileStats.js so the in-Bloc member
  // profile can render the same numbers.
  // Only the 'On Fero since' date is needed here; the stats panel computes
  // its own numbers from the same helper.
  const { agg } = buildProfileStats({ groups: visibleGroups, userId: currentUserId });

  const profileStartTs = agg.earliestWorkout || agg.earliestJoined || Date.parse(accountCreatedAt || "") || null;
  const since = sinceLabel(profileStartTs);

  // ── heatmap — Mon→Sun rows, from the join date through today (multi-year). ──
  // Delete Account is deliberately not in this list. It sits in its own
  // separated danger area below, so an irreversible action never looks like a
  // sibling of a harmless one.
  const accountRows = [
    { label: "Email", value: email || "—", kind: "display" },
    { label: "Sign out", kind: "action", onClick: onSignOut }
  ];
  const handlePhotoFile = async event => {
    const file = event.target?.files?.[0];
    if (event.target) event.target.value = "";
    if (!file || photoBusy) return;
    try {
      setPhotoError("");
      setCropSource(await readFileAsDataUrl(file));
    } catch (error) {
      setPhotoError(error instanceof Error ? error.message : "Unable to load photo");
    }
  };
  const handleCroppedPhoto = async croppedDataUrl => {
    const previousUrl = localProfilePhotoUrl;
    try {
      setPhotoBusy(true);
      setPhotoError("");
      setCropSource("");
      setLocalProfilePhotoUrl(croppedDataUrl);
      const result = await onUpdateProfilePhoto?.(croppedDataUrl);
      if (result && !result.ok) throw new Error(result.error || "Unable to save photo");
      if (result?.profilePhotoUrl) setLocalProfilePhotoUrl(result.profilePhotoUrl);
    } catch (error) {
      setLocalProfilePhotoUrl(previousUrl);
      setPhotoError(error instanceof Error ? error.message : "Unable to save photo");
    } finally {
      setPhotoBusy(false);
    }
  };
  const startSwipeBack = e => {
    const t = e.touches?.[0];
    if (!t || t.clientX > 72) return;
    swipeRef.current = { sx: t.clientX, sy: t.clientY, st: performance.now(), active: true, mode: null };
  };
  const applySwipeTransform = (x = dragXRef.current, isDragging = dragging) => {
    const el = surfaceRef.current;
    if (!el) return;
    el.style.transform = x ? `translateX(${x}px)` : "translateX(0)";
    el.style.transition = isDragging ? "none" : "transform .12s ease";
    el.style.boxShadow = x ? "-18px 0 34px rgba(0,0,0,.28)" : "none";
    el.style.willChange = isDragging || x ? "transform" : "auto";
  };
  const scheduleSwipeTransform = (x, isDragging = dragging) => {
    dragXRef.current = x;
    if (frameRef.current) return;
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null;
      applySwipeTransform(dragXRef.current, isDragging);
    });
  };
  const resetSwipeTransform = () => {
    dragXRef.current = 0;
    cancelSwipeFrame(frameRef);
    applySwipeTransform(0, false);
  };
  const moveSwipeBack = e => {
    const s = swipeRef.current;
    const t = e.touches?.[0];
    if (!s.active || !t) return;
    const dx = t.clientX - s.sx;
    const dy = t.clientY - s.sy;
    if (!s.mode && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) {
      s.mode = dx > 0 && Math.abs(dx) > Math.abs(dy) ? "back" : "scroll";
      setDragging(s.mode === "back");
      onSwipeRevealChange?.(s.mode === "back");
    }
    if (s.mode === "back") {
      scheduleSwipeTransform(Math.max(0, Math.min(dx, window.innerWidth || 420)), true);
    }
  };
  const endSwipeBack = e => {
    const s = swipeRef.current;
    const t = e.changedTouches?.[0];
    swipeRef.current = { sx: 0, sy: 0, active: false, mode: null };
    if (!s.active || !t) return;
    const dx = t.clientX - s.sx;
    const dy = t.clientY - s.sy;
    const screenWidth = window.innerWidth || 420;
    const elapsed = Math.max(1, performance.now() - (s.st || performance.now()));
    const fastEdgeFlick = dx > 24 && elapsed < 260 && dx / elapsed > 0.22 && dx > Math.abs(dy);
    const dominantDrag = dx > screenWidth / 2 && Math.abs(dy) < 100 && dx > Math.abs(dy);
    const shouldClose = s.mode === "back" && (fastEdgeFlick || dominantDrag);
    if (shouldClose) {
      releaseSwipeForward({
        dragRef: dragXRef,
        frameRef,
        finalX: screenWidth,
        transitionMs: 95,
        setDragging,
        applyTransform: applySwipeTransform,
        commit: () => onBack?.()
      });
    } else {
      onSwipeRevealChange?.(false);
      releaseSwipeBack({
        dragRef: dragXRef,
        frameRef,
        transitionMs: 95,
        setDragging,
        applyTransform: applySwipeTransform
      });
    }
  };

  return React.createElement('div', { ref:surfaceRef, onTouchStart: startSwipeBack, onTouchMove: moveSwipeBack, onTouchEnd: endSwipeBack, onTouchCancel: () => { swipeRef.current = { sx: 0, sy: 0, active: false, mode: null }; onSwipeRevealChange?.(false); setDragging(false); resetSwipeTransform(); }, style: { position: "relative", isolation: "isolate", minHeight: "100dvh", width: "100%", maxWidth: 640, margin: "0 auto", padding: "10px 14px 40px", display: "flex", flexDirection: "column", gap: 14, background: "var(--bg-gradient)", backgroundImage: "var(--bg-radial-hint), var(--bg-gradient)", transform: dragXRef.current ? `translateX(${dragXRef.current}px)` : "translateX(0)", transition: dragging ? "none" : "transform .12s ease", boxShadow: dragXRef.current ? "-18px 0 34px rgba(0,0,0,.28)" : "none", willChange: dragging||dragXRef.current ? "transform" : "auto", touchAction: "pan-y" } },
    cropSource ? React.createElement(ProfilePhotoCropModal, { imageSrc:cropSource, onCancel:()=>setCropSource(""), onConfirm:handleCroppedPhoto }) : null,
    React.createElement('div', { "aria-hidden": true, style: { position: "fixed", inset: 0, zIndex: -1, pointerEvents: "none", background: "var(--bg-gradient)", backgroundImage: "var(--bg-radial-hint), var(--bg-gradient)" } }),
    // Header
    React.createElement('div', { style: { position: "relative", display: "flex", alignItems: "center", justifyContent: "center", height: 40, marginBottom: 2 } },
      React.createElement('button', { type: "button", onClick: onBack, "aria-label": "Back", style: { position: "absolute", left: 0, top: "50%", transform: "translateY(-50%)", width: 34, height: 34, display: "inline-flex", alignItems: "center", justifyContent: "center", background: "transparent", border: "none", color: "var(--text)", cursor: "pointer", padding: 0 } },
        React.createElement(AppIcon, { name: "chevron-left", size: 20, stroke: "var(--text)" })),
      React.createElement('div', { style: { fontSize: 16, fontWeight: MED } }, "Profile")
    ),

    // Identity block — horizontal: avatar left, name + since stacked right
    React.createElement('div', { style: { display: "flex", alignItems: "center", justifyContent: "center", gap: 14, padding: "2px 2px 4px", textAlign: "center" } },
      React.createElement('div', { style: { position: "relative", flexShrink: 0 } },
        React.createElement('input', { ref: photoInputRef, type: "file", accept: "image/*", onChange: handlePhotoFile, style: { display: "none" } }),
        React.createElement('button', { type: "button", disabled: photoBusy, onClick: () => photoInputRef.current?.click(), "aria-label": "Edit profile photo", style: { position: "relative", display: "inline-flex", width: 56, height: 56, borderRadius: "50%", border: "none", padding: 0, background: "transparent", cursor: photoBusy ? "default" : "pointer", opacity: photoBusy ? .72 : 1 } },
          React.createElement(Avatar, { name: displayName || "?", userId: currentUserId, photoUrl: localProfilePhotoUrl, size: 56 }),
          React.createElement('span', { style: { position: "absolute", right: -2, bottom: -2, width: 20, height: 20, borderRadius: 999, display: "inline-flex", alignItems: "center", justifyContent: "center", background: "#0D1F1E", border: "1px solid #163d36", color: "#4ECDC4", boxShadow: "0 8px 18px rgba(0,0,0,.24)" } },
            React.createElement(AppIcon, { name: "edit", size: 11, stroke: "currentColor" })
          )
        )
      ),
      React.createElement('div', { style: { minWidth: 0 } },
        React.createElement('button', { type: "button", onClick: onEditName, style: { display: "inline-flex", alignItems: "center", gap: 6, background: "transparent", border: "none", padding: 0, cursor: "pointer", color: "var(--text)", maxWidth: "100%" } },
          React.createElement('span', { style: { fontSize: 20, fontWeight: MED, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } }, displayName || "—"),
          React.createElement(AppIcon, { name: "edit", size: 14, stroke: "var(--muted)" })
        ),
        since ? React.createElement('div', { style: { fontSize: 11.5, fontWeight: REG, color: "var(--muted)", marginTop: 2 } }, `On Fero since ${since}`) : null,
        photoError ? React.createElement('div', { style: { fontSize: 10.5, fontWeight: REG, color: "var(--red)", marginTop: 4 } }, photoError) : null
      )
    ),

    // Statistics deliberately live on the in-Bloc member profile's All time
    // tab, not here. This screen is your account: who you are, how people pay
    // you, and how to leave. Duplicating the stats would mean two places to
    // keep in step for no gain.

    // How people pay you — account-level, not per Bloc, so it lives here
    // rather than inside any single Bloc's screens.
    onSavePayment ? React.createElement('div', { style: { marginTop: 4 } },
      React.createElement('div', { style: { fontSize: 10, fontWeight: MED, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 8, paddingLeft: 2 } }, "Payments"),
      React.createElement(Card, { style: { padding: "13px 15px" } },
        React.createElement(PaymentHandleSection, {
          currentPaymentMethods,
          onSavePayment, savingPayment, paymentError
        })
      )
    ) : null,

    // Account section
    React.createElement('div', { style: { marginTop: 4 } },
      React.createElement('div', { style: { fontSize: 10, fontWeight: MED, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 8, paddingLeft: 2 } }, "Account"),
      React.createElement(Card, { style: { overflow: "hidden" } },
        accountRows.map((row, i) => {
              const border = i < accountRows.length - 1 ? "1px solid rgba(255,255,255,.055)" : "none";
              // Sign Out is safe and immediate, so it reads as ordinary text
              // rather than a warning. Only genuinely destructive rows are red.
              const valueColor = row.tone === "red" ? "rgba(212,74,74,.9)" : "var(--text)";
              if (row.kind === "display") {
                return React.createElement('div', { key: row.label, style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "12px 15px", borderBottom: border } },
                  React.createElement('span', { style: { fontSize: 12.5, color: "var(--muted)", fontWeight: MED } }, row.label),
                  React.createElement('span', { style: { fontSize: 12.5, color: "var(--text)", fontWeight: REG, textAlign: "right", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, row.value)
                );
              }
              return React.createElement('button', { key: row.label, type: "button", onClick: row.onClick, style: { width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "13px 15px", borderBottom: border, background: "transparent", border: "none", cursor: "pointer", textAlign: "left" } },
                React.createElement('span', { style: { fontSize: 13, color: valueColor, fontWeight: MED } }, row.label)
              );
            })
      )
    ),
    // Deleting is quiet by default. A loud red "Danger zone" block shouts at
    // everyone every visit to guard against something almost nobody does, and
    // it sat oddly next to Sign Out, which is harmless. The consequences are
    // explained at the point of decision instead. Apple requires in-app
    // deletion to be findable, so it stays plainly labelled and unhidden.
    React.createElement('div', { style: { marginTop: 22, display: "grid", justifyItems: "center", gap: 10 } },
      confirmDelete
        ? React.createElement(Card, { style: { width: "100%", padding: "14px 15px", display: "grid", gap: 11, background: "rgba(60,10,10,.2)", border: "1px solid rgba(212,74,74,.22)" } },
            React.createElement('div', { style: { fontSize: 12.5, fontWeight: REG, color: "rgba(220,170,170,.9)", lineHeight: 1.55 } },
              "This removes you from every Bloc and erases your workouts, photos and payment details. It cannot be undone."
            ),
            deleteError ? React.createElement('div', { style: { fontSize: 11, fontWeight: REG, color: "var(--red)" } }, deleteError) : null,
            React.createElement('div', { style: { display: "flex", gap: 8 } },
              React.createElement('button', { type: "button", onClick: () => { setConfirmDelete(false); setDeleteError(""); }, style: { flex: 1, background: "var(--s2)", border: "1px solid var(--border)", color: "var(--text-soft)", padding: "11px", borderRadius: 9, fontSize: 12.5, fontWeight: MED, cursor: "pointer" } }, "Keep my account"),
              React.createElement('button', { type: "button", disabled: deleting, onClick: async () => { setDeleting(true); setDeleteError(""); const r = await onDeleteAccount?.(); if (r && !r.ok) { setDeleteError(r.error || "Unable to delete account"); setDeleting(false); } }, style: { flex: 1, background: "var(--red-dim)", border: "1px solid rgba(212,74,74,.35)", color: "var(--red)", padding: "11px", borderRadius: 9, fontSize: 12.5, fontWeight: MED, cursor: "pointer" } }, deleting ? "Deleting..." : "Delete forever")
            )
          )
        : React.createElement('button', {
            type: "button",
            onClick: () => { setDeleteError(""); setConfirmDelete(true); },
            style: { background: "transparent", border: "none", padding: "6px 4px", color: "var(--text-faint)", fontSize: 11.5, fontWeight: REG, cursor: "pointer", textDecoration: "underline", textDecorationColor: "rgba(255,255,255,.14)", textUnderlineOffset: "3px" }
          }, "Delete account")
    )
  );
};

export { ProfilePage };
