// Build entry. Import order matters: globals must be installed before the
// verbatim app module evaluates (it reads `React` / `window.supabase` at
// module top level).
import "./globals.js";
import "./styles/app.css";
import "./app.jsx";
