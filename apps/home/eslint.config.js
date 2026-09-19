import { reactConfig } from "@elabs-ai/components-eslint-config/react";

// `scripts/**/*.mjs` is the site's own Node build tooling (RM-102's registry-output copy) —
// same Node-globals override as `packages/tokens/eslint.config.js` uses for its scripts.
export default [
  { ignores: [".next/**", "next-env.d.ts"] },
  ...reactConfig,
  {
    // Registry blocks copied verbatim (`// registry: <name> — copied <date>`): their words are
    // the block's own sample content, authored and edited in `registry/blocks/**`. A copy that
    // is adapted for the site moves its words to `content/copy.ts` and needs no exemption.
    files: ["components/blocks/**/*.{ts,tsx}"],
    rules: { "conventions/i18n-strings": "off" },
  },
  {
    files: ["scripts/**/*.mjs", "scripts/**/*.js"],
    languageOptions: {
      sourceType: "module",
      globals: { process: "readonly", console: "readonly" },
    },
  },
];
