import { reactConfig } from "@elabs-ai/components-eslint-config/react";

export default [
  { ignores: ["dist/**", "src/themes/**"] },
  ...reactConfig,
  {
    files: ["scripts/**/*.mjs", "scripts/**/*.js"],
    languageOptions: {
      sourceType: "module",
      globals: {
        process: "readonly",
        console: "readonly",
        fetch: "readonly",
        AbortSignal: "readonly",
        URL: "readonly",
      },
    },
  },
];
