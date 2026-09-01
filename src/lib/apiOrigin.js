import { Capacitor } from "@capacitor/core";

// The packaged iOS app is served from Capacitor's local origin, so a relative
// `/api/...` request would otherwise target the bundle instead of Fero's
// deployed backend. Web deployments deliberately keep their relative API path.
const configuredApiOrigin = typeof import.meta !== "undefined" && import.meta.env
  ? String(import.meta.env.VITE_FERO_API_ORIGIN || "").trim()
  : "";
const nativeApiOrigin = (configuredApiOrigin || "https://lift-log-nu.vercel.app").replace(/\/+$/, "");

const getApiUrl = path => {
  const raw = String(path || "");
  if (!Capacitor.isNativePlatform()) return raw;
  return `${nativeApiOrigin}${raw.startsWith("/") ? raw : `/${raw}`}`;
};

export { getApiUrl, nativeApiOrigin };
