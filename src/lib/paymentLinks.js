// Settlement payment handles.
//
// Fero never processes, routes, holds, or verifies a payment. This module
// turns a user-supplied handle into either a link we are willing to open or
// text the payer can copy. Settlement status stays member-confirmed and is
// never derived from a link being opened.
//
// Security: handles are free text written by one member and rendered to
// another as a trusted-looking "Pay" button. Only URLs on the allowlisted
// hosts below ever become clickable. Anything else degrades to copy-only, so a
// pasted phishing URL cannot borrow the Pay affordance.

const PAYMENT_PROVIDER_DEFS = [
  {
    id: "revolut",
    label: "Revolut",
    placeholder: "username",
    hint: "Your Revolut username, without the @.",
    host: "revolut.me",
    build: handle => `https://revolut.me/${encodeURIComponent(handle)}`
  },
  {
    id: "paypal",
    label: "PayPal",
    placeholder: "paypal.me name",
    hint: "Your PayPal.Me name.",
    host: "paypal.me",
    build: handle => `https://paypal.me/${encodeURIComponent(handle)}`
  },
  {
    id: "vipps",
    label: "Vipps",
    placeholder: "Vipps QR link or phone number",
    // Vipps has no public person-to-person deep link. A personal Vipps QR
    // resolves to a qr.vipps.no URL, which we can open directly. A phone
    // number cannot be linked, so it degrades to copy-only.
    hint: "Paste your Vipps QR link for one-tap paying, or your phone number to show it for copying.",
    host: "qr.vipps.no",
    build: () => ""
  }
];

const ALLOWED_LINK_HOSTS = new Set(["revolut.me", "paypal.me", "qr.vipps.no"]);

const PAYMENT_PROVIDERS = PAYMENT_PROVIDER_DEFS.map(({ id, label, placeholder, hint }) => ({
  id, label, placeholder, hint
}));

const PAYMENT_PROVIDER_IDS = new Set(PAYMENT_PROVIDER_DEFS.map(def => def.id));

const MAX_HANDLE_LENGTH = 200;

// A handle we are willing to interpolate into a provider URL. Deliberately
// strict: anything with a slash, scheme, or whitespace is not a username, so
// it degrades to copy rather than being encoded into a nonsense link.
const SAFE_HANDLE_PATTERN = /^[A-Za-z0-9._-]{1,64}$/;

function findProviderDef(provider) {
  return PAYMENT_PROVIDER_DEFS.find(def => def.id === provider) || null;
}

function isSupportedPaymentProvider(provider) {
  return PAYMENT_PROVIDER_IDS.has(String(provider || "").trim().toLowerCase());
}

// Parse a handle that is already a URL. Returns the URL only when it is https
// and on an allowlisted host; otherwise null.
function parseAllowedUrl(value) {
  const raw = String(value || "").trim();
  if (!/^https?:\/\//i.test(raw)) return null;
  let url;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  const host = url.hostname.replace(/^www\./i, "").toLowerCase();
  if (!ALLOWED_LINK_HOSTS.has(host)) return null;
  return url;
}

// Users paste all sorts of things. Reduce a value to the bare handle where we
// can, and leave it alone where we cannot.
function normalizePaymentHandle(provider, value) {
  let handle = String(value || "").trim();
  if (!handle) return "";

  const def = findProviderDef(String(provider || "").trim().toLowerCase());
  if (!def) return handle.slice(0, MAX_HANDLE_LENGTH);

  const url = parseAllowedUrl(handle);
  if (url) {
    // Keep a Vipps QR link whole; it carries a path we must not rewrite.
    if (url.hostname.replace(/^www\./i, "").toLowerCase() === "qr.vipps.no") {
      return url.toString().slice(0, MAX_HANDLE_LENGTH);
    }
    const segment = url.pathname.split("/").filter(Boolean).pop() || "";
    if (segment) handle = decodeURIComponent(segment);
  }

  handle = handle.replace(/^@+/, "").trim();
  return handle.slice(0, MAX_HANDLE_LENGTH);
}

// Returns { mode, url, copyText, label } or null when nothing is set.
//   mode "link" -> render a Pay button that opens url
//   mode "copy" -> render the details for copying; no navigation
function buildPaymentTarget(profile) {
  const provider = String(profile?.paymentProvider || "").trim().toLowerCase();
  const handle = String(profile?.paymentHandle || "").trim();
  if (!provider || !handle || !isSupportedPaymentProvider(provider)) return null;

  const def = findProviderDef(provider);
  if (!def) return null;

  const normalized = normalizePaymentHandle(provider, handle);
  if (!normalized) return null;

  // A handle that is itself an allowlisted URL is opened as-is.
  const asUrl = parseAllowedUrl(normalized);
  if (asUrl) {
    return { mode: "link", url: asUrl.toString(), copyText: asUrl.toString(), label: def.label };
  }

  const built = SAFE_HANDLE_PATTERN.test(normalized) ? def.build(normalized) : "";
  if (built) {
    const verified = parseAllowedUrl(built);
    if (verified) {
      return { mode: "link", url: verified.toString(), copyText: normalized, label: def.label };
    }
  }

  // Vipps phone numbers and anything else we will not open.
  return { mode: "copy", url: "", copyText: normalized, label: def.label };
}

function describePaymentHandle(profile) {
  const target = buildPaymentTarget(profile);
  if (!target) return "";
  return `${target.label}: ${target.copyText}`;
}

export {
  PAYMENT_PROVIDERS,
  isSupportedPaymentProvider,
  normalizePaymentHandle,
  buildPaymentTarget,
  describePaymentHandle,
  MAX_HANDLE_LENGTH
};
