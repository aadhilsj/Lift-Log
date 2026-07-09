// Build entry. globals.js must load before the app modules (api layer
// still reads window.supabase at call time).
import "./globals.js";
import "./styles/app.css";
import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.jsx";

createRoot(document.getElementById("root")).render(React.createElement(App));
