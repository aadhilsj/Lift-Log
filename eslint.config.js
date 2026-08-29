import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";

// Minimal ESLint config for Fero.
//
// Purpose: catch un-imported / undefined identifiers before they reach the
// browser. A missing import once shipped a blank screen after a file split.
// This is deliberately NOT a style linter — it reports correctness only, so
// the post-edit hook stays quiet unless something is actually broken.

export default [
  {
    ignores: [
      "node_modules/**",
      "dist/**",
      "migration-output/**",
      "branding-backups/**",
      ".vercel/**",
      "public/**",
      "supabase-local/**"
    ]
  },
  {
    files: ["**/*.{js,jsx,mjs}"],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
      parserOptions: {
        ecmaFeatures: { jsx: true }
      },
      globals: {
        ...globals.browser,
        ...globals.node,
        React: "readonly"
      }
    },
    plugins: { "react-hooks": reactHooks },
    linterOptions: {
      reportUnusedDisableDirectives: false
    },
    rules: {
      // The rules of hooks are real correctness bugs, so they stay on.
      // exhaustive-deps is advisory here and stays off — the codebase has
      // deliberate disable comments for it and the swipe code depends on
      // hand-tuned dependency arrays.
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "off",

      "no-undef": "error",
      "no-dupe-keys": "error",
      "no-dupe-args": "error",
      "no-unreachable": "error",
      "no-const-assign": "error",
      "no-import-assign": "error",
      "no-obj-calls": "error",
      "use-isnan": "error"
    }
  }
];
