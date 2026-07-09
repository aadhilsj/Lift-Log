// Compatibility globals for the extracted monolith (src/app.jsx).
//
// The app was written against CDN UMD globals: `React`, `ReactDOM`, and
// `window.supabase.createClient`. Phase 1 of the extraction keeps the app
// source verbatim and satisfies those globals from npm packages instead.
// Later extraction phases replace global access with real imports, after
// which this file shrinks and eventually disappears.
//
// This module MUST be imported before ./app.jsx (see src/main.jsx) so the
// globals exist when the app's top-level code runs.
import React from "react";
import { createRoot } from "react-dom/client";
import { createClient } from "@supabase/supabase-js";

window.React = React;
window.ReactDOM = { createRoot };
window.supabase = { createClient };
