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
// The Vipps mark is a wordmark, not a square glyph: its content box is
// 3.93:1, so providers carry a logoAspect and the render sites size width
// from height. Converted from a supplied SVG by keeping only the five visible
// paths, dropping the four fill:none template leftovers, discarding the
// <style> block (its generic .st0/.st1 class names would leak into the page)
// and setting fill=currentColor. viewBox is cropped to the measured content
// bounds rather than the original heavily padded canvas.
const REVOLUT_MARK = '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" focusable="false" aria-hidden="true" width="100%" height="100%"><path fill="currentColor" d="M20.9133 6.9566C20.9133 3.1208 17.7898 0 13.9503 0H2.424v3.8605h10.9782c1.7376 0 3.177 1.3651 3.2087 3.043.016.84-.2994 1.633-.8878 2.2324-.5886.5998-1.375.9303-2.2144.9303H9.2322a.2756.2756 0 0 0-.2755.2752v3.431c0 .0585.018.1142.052.1612L16.2646 24h5.3114l-7.2727-10.094c3.6625-.1838 6.61-3.2612 6.61-6.9494zM6.8943 5.9229H2.424V24h4.4704z"/></svg>';
const VIPPS_ARROW = '<svg viewBox="19 19 28 28" xmlns="http://www.w3.org/2000/svg" focusable="false" aria-hidden="true" width="100%" height="100%"><path fill="currentColor" d="M28 22l5.1 14.9 5-14.9H44l-8.8 22.1h-4.4L22 22z"/></svg>';
const VIPPS_MARK = '<svg viewBox="20 19.4 123.4 34.4" xmlns="http://www.w3.org/2000/svg" focusable="false" aria-hidden="true" width="100%" height="100%"><path fill="currentColor" d="M28 22l5.1 14.9 5-14.9H44l-8.8 22.1h-4.4L22 22z"/><path fill="currentColor" d="M57.3 40.6c3.7 0 5.8-1.8 7.8-4.4 1.1-1.4 2.5-1.7 3.5-.9 1 .8 1.1 2.3 0 3.7-2.9 3.8-6.6 6.1-11.3 6.1-5.1 0-9.6-2.8-12.7-7.7-.9-1.3-.7-2.7.3-3.4 1-.7 2.5-.4 3.4 1 2.2 3.3 5.2 5.6 9 5.6zm6.9-12.3c0 1.8-1.4 3-3 3s-3-1.2-3-3 1.4-3 3-3 3 1.3 3 3z"/><path fill="currentColor" d="M78.3 22v3c1.5-2.1 3.8-3.6 7.2-3.6 4.3 0 9.3 3.6 9.3 11.3 0 8.1-4.8 12-9.8 12-2.6 0-5-1-6.8-3.5v10.6h-5.4V22zm0 11c0 4.5 2.6 6.9 5.5 6.9 2.8 0 5.6-2.2 5.6-6.9 0-4.6-2.8-6.8-5.6-6.8s-5.5 2.1-5.5 6.8z"/><path fill="currentColor" d="M104.3 22v3c1.5-2.1 3.8-3.6 7.2-3.6 4.3 0 9.3 3.6 9.3 11.3 0 8.1-4.8 12-9.8 12-2.6 0-5-1-6.8-3.5v10.6h-5.4V22zm0 11c0 4.5 2.6 6.9 5.5 6.9 2.8 0 5.6-2.2 5.6-6.9 0-4.6-2.8-6.8-5.6-6.8-2.9 0-5.5 2.1-5.5 6.8z"/><path fill="currentColor" d="M132.3 21.4c4.5 0 7.7 2.1 9.1 7.3l-4.9.8c-.1-2.6-1.7-3.5-4.1-3.5-1.8 0-3.2.8-3.2 2.1 0 1 .7 2 2.8 2.4l3.7.7c3.6.7 5.6 3.1 5.6 6.3 0 4.8-4.3 7.2-8.4 7.2-4.3 0-9.1-2.2-9.8-7.6l4.9-.8c.3 2.8 2 3.8 4.8 3.8 2.1 0 3.5-.8 3.5-2.1 0-1.2-.7-2.1-3-2.5l-3.4-.6c-3.6-.7-5.8-3.2-5.8-6.4.1-5 4.6-7.1 8.2-7.1z"/></svg>';
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
    // App-icon treatment: the glyph reversed out of the provider's own icon
    // background, matching what the app looks like on a home screen.
    appIcon: REVOLUT_MARK,
    iconBg: "#191C1F",
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
    appIcon: PAYPAL_MARK,
    iconBg: "#003087",
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
    logo: VIPPS_MARK,
    logoAspect: 3.93,
    // The Vipps app icon is the arrow alone, not the wordmark. path149 from
    // the supplied file measures 22 x 22.1, so it is already square.
    appIcon: VIPPS_ARROW,
    iconBg: "#FF5B24",
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

const PAYMENT_PROVIDERS = PAYMENT_PROVIDER_DEFS.map(({ id, label, placeholder, hint, brand, onBrand, logo = null, logoAspect = 1, appIcon = null, iconBg = null }) => ({
  id, label, placeholder, hint, brand, onBrand, logo, logoAspect, appIcon, iconBg
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
    return { mode: "link", url: asUrl.toString(), copyText: asUrl.toString(), label: def.label, brand: def.brand, onBrand: def.onBrand, logo: def.logo || null, logoAspect: def.logoAspect || 1, appIcon: def.appIcon || null, iconBg: def.iconBg || def.brand || null };
  }

  const built = SAFE_HANDLE_PATTERN.test(normalized) ? def.build(normalized) : "";
  if (built) {
    const verified = parseAllowedUrl(built);
    if (verified) {
      return { mode: "link", url: verified.toString(), copyText: normalized, label: def.label, brand: def.brand, onBrand: def.onBrand, logo: def.logo || null, logoAspect: def.logoAspect || 1, appIcon: def.appIcon || null, iconBg: def.iconBg || def.brand || null };
    }
  }

  // Vipps phone numbers and anything else we will not open.
  return { mode: "copy", url: "", copyText: normalized, label: def.label, brand: def.brand, onBrand: def.onBrand, logo: def.logo || null, logoAspect: def.logoAspect || 1, appIcon: def.appIcon || null, iconBg: def.iconBg || def.brand || null };
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
