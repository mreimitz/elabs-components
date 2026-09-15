import globals from "globals";
import reactPlugin from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import { baseConfig } from "./base.js";
import productConventions from "./rules/product-conventions.js";

/**
 * React preset for component packages and Vite/Storybook apps.
 * Enables react-hooks rules and the new JSX runtime defaults.
 *
 * @type {import("eslint").Linter.Config[]}
 */
export const reactConfig = [
  ...baseConfig,
  {
    files: ["**/*.{ts,tsx,js,jsx}"],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: {
      react: reactPlugin,
      "react-hooks": reactHooks,
    },
    settings: { react: { version: "detect" } },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // The JSX runtime makes React-in-scope unnecessary.
      "react/react-in-jsx-scope": "off",
      "react/prop-types": "off",
      // External links must carry rel="noopener noreferrer" — the previously
      // unwired interaction-guidelines item (research/structural-design/11 §F).
      "react/jsx-no-target-blank": "error",
    },
  },
  {
    // JSX product conventions (./rules/product-conventions.js) — "warn" here, error-level
    // per-file ratchet in `pnpm check`. Tests and stories are exempt, as there.
    files: ["**/*.{ts,tsx,js,jsx}"],
    ignores: ["**/*.test.{ts,tsx,js,jsx}", "**/*.stories.{ts,tsx,js,jsx}"],
    plugins: { conventions: productConventions },
    rules: {
      "conventions/no-fixed-trigger-width": "warn",
      "conventions/locale-formatting": "warn",
      "conventions/no-index-key-reorderable": "warn",
    },
  },
  {
    files: ["**/*.tsx"],
    ignores: ["**/*.test.tsx", "**/*.stories.tsx"],
    plugins: { conventions: productConventions },
    rules: { "conventions/forward-ref-required": "warn" },
  },
  {
    // UI text should come from props/labels; demo and copy-own surfaces are exempt.
    files: ["**/*.{tsx,jsx}"],
    ignores: [
      "**/*.test.{tsx,jsx}",
      "**/*.stories.{tsx,jsx}",
      "**/{stories,test,tests,__tests__,templates,registry}/**",
    ],
    plugins: { conventions: productConventions },
    rules: { "conventions/i18n-strings": "warn" },
  },
];

export default reactConfig;
