import React from "react";
const { useState, useEffect, useRef, useCallback } = React;
import { renderStickerAsync, canvasToBlob } from "../lib/shareSticker.js";

// Share sticker modal — canvas preview, style picker, copy/share.
//
// The preview IS the canvas element, scaled down with CSS, and the exported PNG is that
// same canvas via toBlob(). There is deliberately no separate DOM preview: a second
// implementation would drift from the renderer, and the whole point is that exactly one
// thing decides the pixels.

const STYLE_OPTIONS = [
  { id: "solid", label: "Solid", hint: "For busy photos" },
  { id: "grid",  label: "Grid",  hint: "The default" },
  { id: "bare",  label: "Bare",  hint: "For clean skies" }
];

const ShareSticker = ({ data, monthLabel, onClose }) => {
  const canvasRef = useRef(null);
  const [style, setStyle] = useState("grid");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  // Render on open and on style change only — it is fast enough to do synchronously, but
  // the font wait makes it async on the very first pass.
  useEffect(() => {
    let cancelled = false;
    const canvas = canvasRef.current;
    if (!canvas || !data) return;
    renderStickerAsync(canvas, data, { style })
      .then(() => { if (!cancelled) setStatus(""); })
      .catch(() => { if (!cancelled) setStatus("Couldn't draw the sticker."); });
    return () => { cancelled = true; };
  }, [data, style]);

  const fileName = `fero-${String(monthLabel || "month").toLowerCase().replace(/\s+/g, "-")}.png`;

  const handleCopy = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setBusy(true);
    try {
      // Construct the ClipboardItem synchronously inside the tap handler and hand it the
      // promise — Safari rejects the write if the blob is awaited first.
      await navigator.clipboard.write([
        new window.ClipboardItem({ "image/png": canvasToBlob(canvas) })
      ]);
      setStatus("Copied — paste it into your story.");
    } catch {
      setStatus("Couldn't copy. Try Share instead.");
    } finally {
      setBusy(false);
    }
  }, []);

  const handleShare = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setBusy(true);
    try {
      const blob = await canvasToBlob(canvas);
      const file = new File([blob], fileName, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file] });
        setStatus("");
      } else {
        setStatus("Sharing isn't available here — use Copy.");
      }
    } catch (err) {
      if (err?.name !== "AbortError") setStatus("Couldn't share. Try Copy instead.");
    } finally {
      setBusy(false);
    }
  }, [fileName]);

  const styleButton = opt => React.createElement('button', {
    key: opt.id,
    type: "button",
    onClick: () => setStyle(opt.id),
    style: {
      flex: 1, padding: "9px 6px", borderRadius: 9, cursor: "pointer",
      background: style === opt.id ? "var(--cyan, #4ECDC4)" : "transparent",
      color: style === opt.id ? "#0B1B1A" : "var(--text)",
      border: `1px solid ${style === opt.id ? "var(--cyan, #4ECDC4)" : "var(--border)"}`,
      fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: 12
    }
  }, opt.label);

  return React.createElement('div', { className: "overlay center-mobile", onClick: onClose },
    React.createElement('div', {
      className: "modal pi",
      onClick: e => e.stopPropagation(),
      style: { maxWidth: 424, padding: "16px 16px 14px" }
    },
      React.createElement('div', { style: { fontWeight: 800, fontSize: 17, marginBottom: 3 } },
        monthLabel ? `Share ${monthLabel}` : "Share your month"),
      React.createElement('div', {
        style: { fontSize: 12, color: "var(--muted)", marginBottom: 13, lineHeight: 1.45 }
      }, "Copy it, then paste over your own photo in a story."),

      // Checkerboard behind the preview so the transparency is visible — the sticker has
      // no background of its own and would otherwise look like it was drawn on the modal.
      React.createElement('div', {
        style: {
          borderRadius: 10, padding: 10, marginBottom: 12,
          backgroundColor: "#2a2a33",
          backgroundImage: "linear-gradient(45deg,#22222a 25%,transparent 25%,transparent 75%,#22222a 75%)," +
                           "linear-gradient(45deg,#22222a 25%,transparent 25%,transparent 75%,#22222a 75%)",
          backgroundSize: "16px 16px", backgroundPosition: "0 0, 8px 8px"
        }
      },
        React.createElement('canvas', {
          ref: canvasRef,
          style: { width: "100%", height: "auto", display: "block" }
        })
      ),

      React.createElement('div', { style: { display: "flex", gap: 7, marginBottom: 12 } },
        STYLE_OPTIONS.map(styleButton)),

      status && React.createElement('div', {
        style: { fontSize: 11.5, color: "var(--muted)", textAlign: "center", marginBottom: 9 }
      }, status),

      React.createElement('div', { style: { display: "flex", gap: 8 } },
        React.createElement('button', {
          type: "button", onClick: handleCopy, disabled: busy,
          style: {
            flex: 2, padding: "12px 10px", borderRadius: 10, border: "none",
            background: "var(--cyan, #4ECDC4)", color: "#0B1B1A",
            fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: 13,
            cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1
          }
        }, "Copy sticker"),
        React.createElement('button', {
          type: "button", onClick: handleShare, disabled: busy,
          style: {
            flex: 1, padding: "12px 10px", borderRadius: 10,
            background: "transparent", color: "var(--text)",
            border: "1px solid var(--border)",
            fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: 13,
            cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1
          }
        }, "Share")
      )
    )
  );
};

export { ShareSticker };
