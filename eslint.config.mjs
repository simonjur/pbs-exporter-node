// ESLint 10 flat config — lints all TypeScript sources and the status-UI script.
import js from "@eslint/js";
import tseslint from "typescript-eslint";

// Shared no-unused-vars options: error on unused vars/args/imports, with a
// `_`-prefix escape hatch for intentionally-unused bindings.
const noUnusedVars = [
  "error",
  {
    args: "all",
    argsIgnorePattern: "^_",
    varsIgnorePattern: "^_",
    caughtErrors: "all",
    caughtErrorsIgnorePattern: "^_",
    destructuredArrayIgnorePattern: "^_",
    ignoreRestSiblings: true,
  },
];

export default tseslint.config(
  { ignores: ["dist/", "coverage/", "node_modules/"] },
  {
    files: ["**/*.ts"],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    rules: {
      // Defer to the type-aware rule below for unused-vars detection.
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": noUnusedVars,
    },
  },
  {
    // Status-UI script: a classic browser <script> (no bundler/build step) that
    // relies on global Vue/Vuetify UMD builds. Plain JS, not TypeScript.
    files: ["src/web/app.js"],
    extends: [js.configs.recommended],
    languageOptions: {
      sourceType: "script",
      // Vue/Vuetify are declared via the file's inline `/* global */` comment.
      globals: {
        fetch: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
      },
    },
    rules: {
      "no-unused-vars": noUnusedVars,
    },
  },
);
