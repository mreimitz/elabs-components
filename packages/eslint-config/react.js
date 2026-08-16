import globals from "globals";
import reactPlugin from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import { baseConfig } from "./base.js";

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
];

export default reactConfig;
