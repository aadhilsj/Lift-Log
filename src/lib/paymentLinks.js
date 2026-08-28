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

// Brand marks. Path data from Simple Icons (https://simpleicons.org), which
// publishes brand SVGs under CC0. Inlined rather than fetched: Fero is a PWA
// and must not request assets at runtime. Rendered with fill="currentColor" so
// each mark inherits the chip's foreground colour.
//
// Vipps is not in Simple Icons, so it has no logo and falls back to its text
// label. To add it, take the official SVG from Vipps MobilePay's own brand
// page and paste its markup as REVOLUT_MARK/PAYPAL_MARK are below.
const REVOLUT_MARK = '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" focusable="false" aria-hidden="true" width="100%" height="100%"><path fill="currentColor" d="M20.9133 6.9566C20.9133 3.1208 17.7898 0 13.9503 0H2.424v3.8605h10.9782c1.7376 0 3.177 1.3651 3.2087 3.043.016.84-.2994 1.633-.8878 2.2324-.5886.5998-1.375.9303-2.2144.9303H9.2322a.2756.2756 0 0 0-.2755.2752v3.431c0 .0585.018.1142.052.1612L16.2646 24h5.3114l-7.2727-10.094c3.6625-.1838 6.61-3.2612 6.61-6.9494zM6.8943 5.9229H2.424V24h4.4704z"/></svg>';
const PAYPAL_MARK = '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" focusable="false" aria-hidden="true" width="100%" height="100%"><path fill="currentColor" d="M15.607 4.653H8.941L6.645 19.251H1.82L4.862 0h7.995c3.754 0 6.375 2.294 6.473 5.513-.648-.478-2.105-.86-3.722-.86m6.57 5.546c0 3.41-3.01 6.853-6.958 6.853h-2.493L11.595 24H6.74l1.845-11.538h3.592c4.208 0 7.346-3.634 7.153-6.949a5.24 5.24 0 0 1 2.848 4.686M9.653 5.546h6.408c.907 0 1.942.222 2.363.541-.195 2.741-2.655 5.483-6.441 5.483H8.714Z"/></svg>';

// TO ADD OFFICIAL LOGOS
// ---------------------
// Each provider below has a `logo` slot, currently null, which renders the
// text label instead. To use a real mark, download the official SVG from the
// provider's own brand/press page and paste its markup as a string here, e.g.
//
//   logo: '<svg viewBox="0 0 24 24" ...>...</svg>'
//
// Requirements:
//  - Inline SVG only. Fero is a PWA and must not fetch logos at runtime.
//  - Use the official asset, not a redrawn approximation.
//  - Follow each provider's brand guidelines for clear space and minimum size.
//  - Prefer a monochrome/white mark: it is rendered on the brand colour below.
//
// Until then `brand` supplies the provider's colour so the chips still read as
// that provider at a glance.
const PAYMENT_PROVIDER_DEFS = [
  {
    id: "revolut",
    label: "Revolut",
    brand: "#0666EB",
    onBrand: "#FFFFFF",
    logo: REVOLUT_MARK,
    placeholder: "username",
    hint: "Your Revolut username, without the @.",
    host: "revolut.me",
    build: handle => `https://revolut.me/${encodeURIComponent(handle)}`
  },
  {
    id: "paypal",
    label: "PayPal",
    brand: "#003087",
    onBrand: "#FFFFFF",
    logo: PAYPAL_MARK,
    placeholder: "paypal.me name",
    hint: "Your PayPal.Me name.",
    host: "paypal.me",
    build: handle => `https://paypal.me/${encodeURIComponent(handle)}`
  },
  {
    id: "vipps",
    label: "Vipps",
    brand: "#FF5B24",
    onBrand: "#FFFFFF",
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

const PAYMENT_PROVIDERS = PAYMENT_PROVIDER_DEFS.map(({ id, label, placeholder, hint, brand, onBrand, logo = null }) => ({
  id, label, placeholder, hint, brand, onBrand, logo
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
    return { mode: "link", url: asUrl.toString(), copyText: asUrl.toString(), label: def.label, brand: def.brand, onBrand: def.onBrand, logo: def.logo || null };
  }

  const built = SAFE_HANDLE_PATTERN.test(normalized) ? def.build(normalized) : "";
  if (built) {
    const verified = parseAllowedUrl(built);
    if (verified) {
      return { mode: "link", url: verified.toString(), copyText: normalized, label: def.label, brand: def.brand, onBrand: def.onBrand, logo: def.logo || null };
    }
  }

  // Vipps phone numbers and anything else we will not open.
  return { mode: "copy", url: "", copyText: normalized, label: def.label, brand: def.brand, onBrand: def.onBrand, logo: def.logo || null };
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
