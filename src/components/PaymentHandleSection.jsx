import React from "react";
import { PAYMENT_PROVIDERS, buildPaymentTarget, normalizePaymentHandle } from "../lib/paymentLinks.js";

// "How people pay you" — an optional handle shown to Bloc members who owe you
// after a month closes. Fero stores an opaque string and, at render time,
// either links to an allowlisted payment host or offers it for copying. It
// never processes, routes, holds, or verifies a payment, and it never changes
// settlement status. See src/lib/paymentLinks.js.
const PaymentHandleSection = ({
  currentPaymentProvider = "", currentPaymentHandle = "",
  onSavePayment, savingPayment = false, paymentError = ""
}) => {
  const [payProvider, setPayProvider] = React.useState(currentPaymentProvider || "");
  const [payHandle, setPayHandle] = React.useState(currentPaymentHandle || "");
  const [pasteNotice, setPasteNotice] = React.useState(null);

  // Custom schemes fail silently when the app is absent, so fall back to the
  // provider's site if we are still here shortly after. Leaving for the app
  // hides the page, which cancels the fallback.
  const onOpenProviderApp = provider => {
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
  // browsers). Failure must never look like a bug: fall back to telling the
  // user to paste into the field, which always works.
  const onPasteFromClipboard = async () => {
    setPasteNotice(null);
    try {
      const text = (await navigator.clipboard.readText() || "").trim();
      if (!text) { setPasteNotice({ tone: "error", text: "Clipboard is empty" }); return; }
      const cleaned = normalizePaymentHandle(payProvider, text);
      if (!cleaned) { setPasteNotice({ tone: "error", text: "That doesn't look like a link" }); return; }
      setPayHandle(cleaned);
      setPasteNotice({ tone: "ok", text: "Pasted" });
    } catch {
      setPasteNotice({ tone: "error", text: "Paste into the field above instead" });
    }
  };

  const activeDef = PAYMENT_PROVIDERS.find(provider => provider.id === payProvider) || null;
  const trimmedHandle = payHandle.trim();
  const dirty = payProvider !== (currentPaymentProvider || "") || trimmedHandle !== (currentPaymentHandle || "");
  // Clearing the provider clears the handle, which is how a user removes it.
  const canSave = !savingPayment && dirty && (!payProvider || trimmedHandle.length > 0);
  const preview = payProvider && trimmedHandle
    ? buildPaymentTarget({ paymentProvider: payProvider, paymentHandle: trimmedHandle })
    : null;
  // Each provider is rendered as its own app icon: a rounded square filled
  // with the provider's icon background and the glyph reversed out in white,
  // the way it looks on a phone home screen. Selection is shown by a ring and
  // full opacity rather than by changing the icon, so the tile always reads as
  // that app.
  const ICON_SIZE = 54;
  const chipStyle = (provider, active) => ({
    width:ICON_SIZE, height:ICON_SIZE, padding:0, flexShrink:0,
    borderRadius:ICON_SIZE * 0.225,
    background: provider.iconBg || provider.brand,
    border:"none",
    cursor:"pointer",
    display:"flex", alignItems:"center", justifyContent:"center",
    opacity: active ? 1 : 0.42,
    boxShadow: active
      ? `0 0 0 2px var(--s1, #080F0F), 0 0 0 4px ${provider.brand}, 0 6px 14px rgba(0,0,0,.35)`
      : "0 2px 6px rgba(0,0,0,.25)",
    transition:"opacity .16s ease, box-shadow .16s ease",
    WebkitTapHighlightColor:"transparent"
  });
  const renderProviderMark = provider => provider.appIcon
    ? React.createElement('span',{
        "aria-hidden":true,
        style:{display:"inline-flex",width:"58%",height:"58%",alignItems:"center",justifyContent:"center",color:"#FFFFFF"},
        dangerouslySetInnerHTML:{__html:provider.appIcon}
      })
    : null;
  return React.createElement('div',{style:{marginBottom:14}},
    React.createElement('span',{className:"lbl",style:{marginBottom:6,display:"block"}},"How people pay you"),
    React.createElement('div',{style:{fontSize:11,color:"var(--text-faint)",lineHeight:1.45,marginBottom:8}},
      "Optional. Shown only to Bloc members who owe you after a month closes. Fero never handles the money."
    ),
    React.createElement('div',{style:{display:"flex",gap:12,marginBottom:10,alignItems:"center"}},
      PAYMENT_PROVIDERS.map(provider => React.createElement('button',{
        key:provider.id, type:"button",
        onClick:()=>{ const next = payProvider===provider.id ? "" : provider.id; setPayProvider(next); if(!next) setPayHandle(""); },
        style:chipStyle(provider, payProvider===provider.id),
        "aria-pressed":payProvider===provider.id,
        "aria-label":provider.label,
        title:provider.label
      },
        renderProviderMark(provider) || provider.label
      ))
    ),
    payProvider && React.createElement(React.Fragment,null,
      React.createElement('input',{
        value:payHandle,
        onChange:e=>setPayHandle(e.target.value),
        placeholder:activeDef?.placeholder||"",
        autoCapitalize:"none", autoCorrect:"off", spellCheck:false,
        style:{width:"100%",background:"var(--s2)",border:"1px solid var(--border)",borderRadius:10,padding:"11px 13px",color:"var(--text)",fontSize:14,outline:"none",boxSizing:"border-box"}
      }),
      // Most people have to leave Fero to fetch their link. Rather than make
      // them retype it, offer a one-tap paste of whatever they copied.
      React.createElement('div',{style:{display:"flex",alignItems:"center",gap:8,marginTop:7,flexWrap:"wrap"}},
        activeDef?.appUrl && React.createElement('button',{
          type:"button",
          onClick:()=>onOpenProviderApp(activeDef),
          style:{
            display:"inline-flex",alignItems:"center",gap:6,
            padding:"6px 10px",borderRadius:8,cursor:"pointer",
            background:activeDef.iconBg||activeDef.brand,border:"none",
            color:"#FFFFFF",fontSize:11,fontWeight:800,
            fontFamily:"'Outfit', sans-serif"
          }
        },
          React.createElement('span',{"aria-hidden":true,style:{display:"inline-flex",width:12,height:12,alignItems:"center",justifyContent:"center"},dangerouslySetInnerHTML:{__html:activeDef.appIcon}}),
          `Open ${activeDef.label}`
        ),
        React.createElement('button',{
          type:"button",
          onClick:onPasteFromClipboard,
          style:{
            display:"inline-flex",alignItems:"center",gap:5,
            padding:"6px 10px",borderRadius:8,cursor:"pointer",
            background:"var(--s2)",border:"1px solid var(--border)",
            color:"var(--text-soft)",fontSize:11,fontWeight:800,
            fontFamily:"'Outfit', sans-serif"
          }
        }, "Paste copied link"),
        pasteNotice && React.createElement('span',{style:{fontSize:10.5,color:pasteNotice.tone==="error"?"var(--red)":"var(--text-faint)",lineHeight:1.35}},pasteNotice.text)
      ),
      React.createElement('div',{style:{fontSize:10.5,color:"var(--text-faint)",lineHeight:1.4,marginTop:6}},
        `Open ${activeDef?.label || "the app"}, copy your payment link, then come back and tap Paste.`
      ),
      activeDef?.hint && React.createElement('div',{style:{fontSize:10.5,color:"var(--text-faint)",lineHeight:1.4,marginTop:4}},activeDef.hint),
      preview && preview.mode==="copy" && React.createElement('div',{style:{fontSize:10.5,color:"var(--amber)",lineHeight:1.4,marginTop:6}},
        "This will be shown for copying rather than as a one-tap link."
      )
    ),
    paymentError && React.createElement('div',{style:{fontSize:11,color:"var(--red)",marginTop:8}},paymentError),
    dirty && React.createElement('button',{
      type:"button", disabled:!canSave,
      onClick:()=>onSavePayment({ paymentProvider:payProvider, paymentHandle:payProvider?trimmedHandle:"" }),
      style:{width:"100%",marginTop:9,background:canSave?"var(--green)":"var(--s3)",color:canSave?"#000":"var(--muted2)",padding:"10px",borderRadius:10,fontSize:13,fontWeight:800,border:"none",cursor:canSave?"pointer":"default"}
    }, savingPayment ? "Saving..." : (payProvider ? "Save payment details" : "Remove payment details"))
  );
};

export { PaymentHandleSection };
