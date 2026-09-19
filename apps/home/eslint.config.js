import { reactConfig } from "@elabs-ai/components-eslint-config/react";

// `scripts/**/*.mjs` is the site's own Node build tooling (RM-102's registry-output copy) —
// same Node-globals override as `packages/tokens/eslint.config.js` uses for its scripts.
export default [
  { ignores: [".next/**", "next-env.d.ts"] },
  ...reactConfig,
  {
    files: ["scripts/**/*.mjs", "scripts/**/*.js"],
    languageOptions: {
      sourceType: "module",
      globals: { process: "readonly", console: "readonly" },
    },
  },
];
