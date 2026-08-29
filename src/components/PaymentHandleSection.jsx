import React from "react";
import { PAYMENT_PROVIDERS, buildPaymentTarget, normalizePaymentHandle, normalizePaymentMethods } from "../lib/paymentLinks.js";

// "How people pay you" — the payment methods a member accepts.
//
// One row per provider so the whole set is legible at a glance: what is set,
// what is not, and what the stored value is. A row expands in place to edit.
// Fero never processes, routes, holds, or verifies a payment; it stores an
// opaque string and, at render time, either links to an allowlisted host or
// offers it for copying. Settlement status stays member-confirmed.
const PaymentHandleSection = ({ currentPaymentMethods = [], onSavePayment, savingPayment = false, paymentError = "" }) => {
  const saved = React.useMemo(
    () => normalizePaymentMethods({ paymentMethods: currentPaymentMethods }),
    [currentPaymentMethods]
  );
  const savedFor = provider => saved.find(method => method.provider === provider) || null;

  const [openProvider, setOpenProvider] = React.useState("");
  const [draft, setDraft] = React.useState("");
  const [pasteNotice, setPasteNotice] = React.useState(null);

  const openRow = provider => {
    if (openProvider === provider.id) { setOpenProvider(""); return; }
    setPasteNotice(null);
    setOpenProvider(provider.id);
    setDraft(savedFor(provider.id)?.handle || "");
  };

  const commit = methods => {
    setOpenProvider("");
    setPasteNotice(null);
    onSavePayment({ paymentMethods: methods });
  };

  const saveRow = provider => {
    const handle = normalizePaymentHandle(provider.id, draft);
    if (!handle) return;
    const next = saved.filter(method => method.provider !== provider.id).concat({ provider: provider.id, handle });
    commit(next);
  };

  const removeRow = provider => commit(saved.filter(method => method.provider !== provider.id));

  // Custom schemes fail silently when the app is absent, so fall back to the
  // provider's site if we are still here shortly after. Leaving for the app
  // hides the page, which cancels the fallback.
  const openProviderApp = provider => {
    if (!provider?.appUrl) return;
    setPasteNotice(null);
    let cancelled = false;
    const cancel = () => { cancelled = true; };
    document.addEventListener("visibilitychange", cancel, { once: true });
    window.addEventListener("pagehide", cancel, { once: true });
    window.setTimeout(() => {
      document.removeEventListener("visibilitychange", cancel);
      window.removeEventListener("pagehide", cancel);
      if (cancelled || document.hidden) return;
      if (provider.appWeb) window.open(provider.appWeb, "_blank", "noopener,noreferrer");
    }, 1200);
    window.location.href = provider.appUrl;
  };

  // Clipboard reads can be refused (permission, insecure context, older
  // browsers). Failure must never look like a bug: fall back to asking the
  // user to type into the field, which always works.
  const pasteFromClipboard = async provider => {
    setPasteNotice(null);
    try {
      const text = (await navigator.clipboard.readText() || "").trim();
      if (!text) { setPasteNotice({ tone: "error", text: "Clipboard is empty" }); return; }
      const cleaned = normalizePaymentHandle(provider.id, text);
      if (!cleaned) { setPasteNotice({ tone: "error", text: "That doesn't look like a link" }); return; }
      setDraft(cleaned);
      setPasteNotice({ tone: "ok", text: "Pasted" });
    } catch {
      setPasteNotice({ tone: "error", text: "Paste into the field instead" });
    }
  };

  const icon = (provider, size) => React.createElement('span', {
    "aria-hidden": true,
    style: {
      width: size, height: size, borderRadius: size * 0.225, flexShrink: 0,
      background: provider.iconBg || provider.brand, color: "#FFFFFF",
      display: "inline-flex", alignItems: "center", justifyContent: "center"
    }
  }, React.createElement('span', {
    style: { display: "inline-flex", width: "58%", height: "58%", alignItems: "center", justifyContent: "center" },
    dangerouslySetInnerHTML: { __html: provider.appIcon }
  }));

  const smallButton = (label, onClick, tone) => React.createElement('button', {
    type: "button", onClick,
    style: {
      padding: "7px 11px", borderRadius: 8, cursor: "pointer", fontSize: 11, fontWeight: 800,
      fontFamily: "'Outfit', sans-serif", whiteSpace: "nowrap",
      background: tone === "primary" ? "var(--green)" : "transparent",
      border: tone === "primary" ? "none" : "1px solid var(--border)",
      color: tone === "primary" ? "#000" : tone === "danger" ? "rgba(212,74,74,.85)" : "var(--text-soft)"
    }
  }, label);

  return React.createElement('div', { style: { display: "grid", gap: 1 } },
    PAYMENT_PROVIDERS.map((provider, index) => {
      const method = savedFor(provider.id);
      const isOpen = openProvider === provider.id;
      const target = method ? buildPaymentTarget({ paymentProvider: provider.id, paymentHandle: method.handle }) : null;
      return React.createElement('div', {
        key: provider.id,
        style: { borderTop: index === 0 ? "none" : "1px solid rgba(255,255,255,.05)" }
      },
        React.createElement('button', {
          type: "button",
          onClick: () => openRow(provider),
          "aria-expanded": isOpen,
          style: {
            width: "100%", display: "flex", alignItems: "center", gap: 11, padding: "11px 2px",
            background: "transparent", border: "none", cursor: "pointer", textAlign: "left"
          }
        },
          icon(provider, 32),
          React.createElement('span', { style: { flex: 1, minWidth: 0, display: "grid", gap: 2 } },
            React.createElement('span', { style: { fontSize: 13, fontWeight: 700, color: "var(--text)", fontFamily: "'Outfit', sans-serif" } }, provider.label),
            React.createElement('span', {
              style: {
                fontSize: 11, fontWeight: 500, fontFamily: "'Outfit', sans-serif",
                color: method ? "var(--muted)" : "var(--muted2)",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"
              }
            }, method ? method.handle : "Not added")
          ),
          method && target?.mode === "copy"
            ? React.createElement('span', { style: { fontSize: 9.5, fontWeight: 700, color: "var(--amber)", fontFamily: "'Outfit', sans-serif" } }, "Copy only")
            : null,
          React.createElement('span', { style: { fontSize: 15, color: "var(--muted2)", flexShrink: 0 } }, isOpen ? "−" : method ? "Edit" : "+")
        ),
        isOpen ? React.createElement('div', { style: { display: "grid", gap: 8, padding: "2px 2px 13px" } },
          React.createElement('input', {
            value: draft,
            onChange: event => setDraft(event.target.value),
            placeholder: provider.placeholder || "",
            autoCapitalize: "none", autoCorrect: "off", spellCheck: false,
            style: { width: "100%", background: "var(--s2)", border: "1px solid var(--border)", borderRadius: 10, padding: "11px 13px", color: "var(--text)", fontSize: 14, outline: "none", boxSizing: "border-box" }
          }),
          React.createElement('div', { style: { display: "flex", gap: 7, flexWrap: "wrap", alignItems: "center" } },
            provider.appUrl ? smallButton(`Open ${provider.label}`, () => openProviderApp(provider)) : null,
            smallButton("Paste", () => pasteFromClipboard(provider)),
            React.createElement('span', { style: { flex: 1 } }),
            method ? smallButton("Remove", () => removeRow(provider), "danger") : null,
            smallButton(savingPayment ? "Saving..." : "Save", () => saveRow(provider), "primary")
          ),
          pasteNotice ? React.createElement('div', {
            style: { fontSize: 10.5, color: pasteNotice.tone === "error" ? "var(--red)" : "var(--text-faint)" }
          }, pasteNotice.text) : null,
          provider.hint ? React.createElement('div', { style: { fontSize: 10.5, color: "var(--text-faint)", lineHeight: 1.4 } }, provider.hint) : null
        ) : null
      );
    }),
    paymentError ? React.createElement('div', { style: { fontSize: 11, color: "var(--red)", paddingTop: 8 } }, paymentError) : null
  );
};

export { PaymentHandleSection };
