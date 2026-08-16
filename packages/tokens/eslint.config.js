import { reactConfig } from "@elabs-ai/components-eslint-config/react";

/**
 * @elabs-ai/components-tokens extends the shared React preset, plus a Node-globals override
 * for the package's build scripts (the DTCG → themes.css pipeline). The shared
 * preset only wires Node globals for `.{ts,tsx,js,jsx}`; these are `.mjs` Node
 * CLI scripts that use `process`/`console`, so they need the Node environment.
 * The globals are declared inline (the `globals` pkg isn't a direct dep here).
 */
export default [
  ...reactConfig,
  {
    files: ["scripts/**/*.mjs", "scripts/**/*.js"],
    languageOptions: {
      sourceType: "module",
      globals: {
        process: "readonly",
        console: "readonly",
        URL: "readonly",
        Buffer: "readonly",
      },
    },
  },
];
