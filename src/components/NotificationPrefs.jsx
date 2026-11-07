import React from "react";
const { useCallback, useEffect, useState } = React;
import { getNotificationPrefsData, setNotificationPrefData } from "../lib/api.js";
import { getPushPermissionStatus } from "../lib/pushNotifications.js";

// The five notification switches, behind Account -> Notifications.
//
// Five and not twelve: push can send twelve kinds of thing, and twelve rows of
// toggles is a settings screen nobody reads. They are grouped by what a
// notification feels like to receive rather than by how it is built. The
// grouping, and the one case it cannot express - comments but not reactions -
// are recorded in docs/handover-2026-11-07-notification-switches.md section 3.
//
// These switch PUSH only. "For you" is computed in the client from state the
// app already holds, so it keeps showing everything either way.

const REG = 400, MED = 500;

const SWITCHES = [
  {
    key: "trainingNudges",
    label: "Training nudges",
    body: "Your Bloc is training, the month is running out, the streak is at risk."
  },
  {
    key: "reactionsComments",
    label: "Reactions and comments",
    body: "Someone reacts to or comments on your workout."
  },
  {
    key: "mentions",
    label: "Mentions",
    body: "Someone mentions you in the Stream."
  },
  {
    key: "monthClose",
    label: "Month close",
    body: "The month closes, and anything settling after it."
  },
  {
    key: "requests",
    label: "Requests",
    body: "Someone asks to sit out or go Solo, and when your own request is answered."
  }
];

const ALL_ON = SWITCHES.reduce((all, row) => ({ ...all, [row.key]: true }), {});

// A failed load must not be dressed up as "everything is on" - that is a real
// state, and showing it when we do not know would have someone believe they
// are covered when they may not be. `prefs` stays null until the server has
// actually answered.
const useNotificationPrefs = () => {
  const [prefs, setPrefs] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    let cancelled = false;
    setError("");
    getNotificationPrefsData()
      .then(result => {
        if (cancelled) return;
        if (result.ok && result.prefs) setPrefs({ ...ALL_ON, ...result.prefs });
        else setError(result.error || "Unable to load your notification settings");
        setLoaded(true);
      })
      .catch(() => {
        if (cancelled) return;
        setError("Unable to load your notification settings");
        setLoaded(true);
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => load(), [load]);

  const reload = useCallback(() => { setLoaded(false); load(); }, [load]);

  return { prefs, setPrefs, loaded, error, setError, reload };
};

const Toggle = ({ on }) => React.createElement('span', {
  style: {
    width: 38, height: 22, borderRadius: 999, flexShrink: 0, position: "relative",
    transition: "background .18s", background: on ? "#4ECDC4" : "#2A2E39"
  }
},
  React.createElement('span', {
    style: {
      position: "absolute", top: 3, width: 16, height: 16, borderRadius: 999,
      transition: "left .18s", left: on ? 19 : 3,
      background: on ? "#050909" : "#767C88"
    }
  })
);

const NotificationPrefsPanel = ({ prefs, setPrefs, loaded, error, setError, reload, onBack }) => {
  const [permission, setPermission] = useState("");
  const [busyKey, setBusyKey] = useState("");
  const [asking, setAsking] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getPushPermissionStatus()
      .then(status => { if (!cancelled) setPermission(status); })
      .catch(() => { if (!cancelled) setPermission("unavailable"); });
    return () => { cancelled = true; };
  }, []);

  // Apple's permission is a separate thing from these switches, and it wins:
  // with it denied, nothing below can reach the phone whatever it says.
  const denied = permission === "denied";
  const notAsked = permission === "prompt" || permission === "prompt-with-rationale";
  const nativeless = permission === "unsupported" || permission === "unavailable";

  // Optimistic, then put back if the server refuses. A switch that looks saved
  // and is not is worse than one that visibly fails.
  const toggle = async key => {
    if (!prefs || busyKey || denied) return;
    const next = !prefs[key];
    setPrefs(current => ({ ...current, [key]: next }));
    setBusyKey(key);
    setError("");
    const result = await setNotificationPrefData(key, next);
    setBusyKey("");
    if (!result.ok) {
      setPrefs(current => ({ ...current, [key]: !next }));
      setError(result.error || "That did not save. Try again.");
      return;
    }
    if (result.prefs) setPrefs({ ...ALL_ON, ...result.prefs });
  };

  const askForPermission = async () => {
    if (asking) return;
    setAsking(true);
    try {
      const { requestPushPermissionFromUserAction } = await import("../lib/pushNotifications.js");
      await requestPushPermissionFromUserAction({ userInitiated: true });
      setPermission(await getPushPermissionStatus());
    } catch {
      setError("Could not ask for permission. Try again.");
    }
    setAsking(false);
  };

  const notice = (tone, title, body, action) => React.createElement('div', {
    style: {
      background: tone === "amber" ? "#1E1808" : "var(--s1)",
      border: `0.5px solid ${tone === "amber" ? "#3D3010" : "var(--border)"}`,
      borderRadius: 13, padding: "13px 14px", marginBottom: 14
    }
  },
    React.createElement('div', { style: { fontSize: 12.5, fontWeight: MED, color: tone === "amber" ? "var(--amber)" : "var(--text)", marginBottom: 5 } }, title),
    React.createElement('div', { style: { fontSize: 11.5, fontWeight: REG, color: "var(--text-soft)", lineHeight: 1.45 } }, body),
    action || null
  );

  return React.createElement(React.Fragment, null,
    React.createElement('button', {
      type: "button",
      onClick: onBack,
      style: { alignSelf: "flex-start", textAlign: "left", background: "transparent", border: "none", color: "var(--muted)", fontSize: 13, fontWeight: 700, padding: "0 0 10px", fontFamily: "inherit", cursor: "pointer" }
    }, "‹ Account"),
    React.createElement('div', { style: { fontWeight: 800, fontSize: 18, marginBottom: 14 } }, "Notifications"),

    denied && notice("amber", "Notifications are off for Fero",
      "Nothing below can reach your phone until you turn them back on in your iPhone's Settings, under Fero."),

    notAsked && notice("plain", "Notifications are not on yet",
      "Turn them on and Fero can tell you when your Bloc is moving.",
      React.createElement('button', {
        type: "button",
        onClick: askForPermission,
        disabled: asking,
        style: { marginTop: 11, background: "var(--cyan)", color: "#050909", border: "none", borderRadius: 9, padding: "9px 14px", fontSize: 12, fontWeight: 800, fontFamily: "inherit", cursor: "pointer" }
      }, asking ? "Asking…" : "Turn on notifications")),

    nativeless && notice("plain", "These apply to the Fero app",
      "Push notifications are sent to Fero on your phone. Your choices here are saved either way."),

    error ? React.createElement('div', { role: "alert", style: { color: "#ffd4d4", fontSize: 11, marginBottom: 10 } }, error) : null,

    !loaded
      ? React.createElement('div', { style: { padding: "18px 2px", fontSize: 12.5, color: "var(--muted2)" } }, "Loading…")
      : !prefs
      ? React.createElement('button', {
          type: "button",
          onClick: reload,
          style: { alignSelf: "flex-start", background: "var(--s2)", border: "1px solid var(--border)", color: "var(--text-soft)", borderRadius: 9, padding: "10px 14px", fontSize: 12.5, fontWeight: MED, fontFamily: "inherit", cursor: "pointer" }
        }, "Try again")
      : React.createElement('div', {
          style: {
            background: "var(--s1)", border: ".5px solid var(--border)", borderRadius: 14,
            overflow: "hidden", opacity: denied ? 0.4 : 1
          }
        },
          SWITCHES.map((row, index) => React.createElement('button', {
            key: row.key,
            type: "button",
            onClick: () => toggle(row.key),
            disabled: denied,
            "aria-pressed": !!prefs[row.key],
            style: {
              width: "100%", boxSizing: "border-box", display: "flex", alignItems: "center", gap: 12,
              padding: "13px 15px", background: "transparent", textAlign: "left", fontFamily: "inherit",
              border: "none",
              borderBottom: index < SWITCHES.length - 1 ? "1px solid rgba(255,255,255,.055)" : "none",
              cursor: denied ? "default" : "pointer"
            }
          },
            React.createElement('span', { style: { flex: 1, minWidth: 0, display: "block" } },
              React.createElement('span', { style: { display: "block", fontSize: 13, fontWeight: MED, color: "var(--text)" } }, row.label),
              React.createElement('span', { style: { display: "block", fontSize: 11, fontWeight: REG, color: "var(--muted)", lineHeight: 1.4, marginTop: 3 } }, row.body)
            ),
            React.createElement(Toggle, { on: !!prefs[row.key] })
          ))
        ),

    loaded && prefs ? React.createElement('div', {
      style: { marginTop: 14, fontSize: 11, fontWeight: REG, color: "var(--muted2)", lineHeight: 1.45 }
    }, "Quiet from 23:30 to 06:00, in your own time zone. Anything that would land in those hours is held until 06:00.") : null
  );
};

// How many are on, for the row on the Account screen. Null prefs means we have
// not been told yet, so the row says nothing rather than guessing.
const summariseNotificationPrefs = prefs => {
  if (!prefs) return "";
  const on = SWITCHES.filter(row => prefs[row.key] !== false).length;
  if (on === SWITCHES.length) return "All on";
  if (on === 0) return "Off";
  return `${on} on`;
};

export { NotificationPrefsPanel, useNotificationPrefs, summariseNotificationPrefs, SWITCHES };
