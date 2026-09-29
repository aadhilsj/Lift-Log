import React from "react";
import { ModalScrim } from "../components/primitives.jsx";

export function NotificationsPage({ onClose }) {
  return React.createElement(ModalScrim, { onClose },
    React.createElement("section", {
      className: "modal",
      role: "dialog",
      "aria-modal": "true",
      "aria-labelledby": "notifications-title",
      onClick: event => event.stopPropagation(),
      style: { position: "relative", maxWidth: 360, padding: "24px 20px", textAlign: "left" }
    },
      React.createElement("button", {
        type: "button",
        onClick: onClose,
        "aria-label": "Close notifications",
        style: {
          position: "absolute", top: 12, right: 14, background: "transparent",
          border: "none", padding: 6, lineHeight: 1, color: "var(--muted2)",
          fontFamily: "'Outfit',sans-serif", fontSize: 16, fontWeight: 600
        }
      }, "×"),
      React.createElement("h1", {
        id: "notifications-title",
        style: { margin: "0 32px 14px 0", fontFamily: "'Raleway',sans-serif", fontSize: 20, fontWeight: 800 }
      }, "Notifications"),
      React.createElement("p", {
        style: { margin: 0, color: "var(--text-soft, #b8becc)", fontSize: 14, lineHeight: 1.5 }
      }, "Notifications are coming soon.")
    )
  );
}
