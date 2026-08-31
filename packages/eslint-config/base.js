import js from "@eslint/js";
import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier";
import brandTokens from "./rules/brand-tokens.js";
import sidebarInk from "./rules/sidebar-ink.js";

/**
 * Shared, framework-agnostic ESLint flat config for all @brand packages.
 * Apps and packages extend this and append their own globals/overrides.
 *
 * @type {import("eslint").Linter.Config[]}
 */
export const baseConfig = [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
  {
    files: ["**/*.{ts,tsx,js,jsx,mts,cts}"],
    plugins: { brand: brandTokens, "sidebar-a11y": sidebarInk },
    rules: {
      // Taxonomy enforcement at the consumer's point of action — type is a role, colour
      // is a token (see ./rules/brand-tokens.js). "warn" is non-breaking and surfaces the
      // fix in the edit→lint loop so coding agents self-correct; bump to "error" to block.
      // The repo's library debt stays governed by the scripts/check-text-scale + raw-palette
      // ratchets; these reach the CONSUMER apps those scripts don't.
      "brand/no-raw-font-size": "warn",
      "brand/no-raw-color": "warn",
      // Sidebar chrome/canvas ink discipline (#66, #50 — see ./rules/sidebar-ink.js).
      // Same "warn" severity as the two rules above, for the same reason.
      "sidebar-a11y/no-canvas-ink-in-sidebar": "warn",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/consistent-type-imports": [
        "warn",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
      "@typescript-eslint/no-explicit-any": "warn",
      // Icon policy (WP-12 #119): Lucide is the default icon library; @elabs-ai/components-icons holds
      // brand/product icons. No other icon set — see .claude/rules/icons.md.
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@heroicons/*",
                "react-icons",
                "react-icons/*",
                "@tabler/icons-react",
                "react-feather",
                "feather-icons",
                "phosphor-react",
                "@phosphor-icons/*",
                "@fortawesome/free-*",
                "@fortawesome/react-fontawesome",
                "@mui/icons-material",
                "@mui/icons-material/*",
                "@ant-design/icons",
                "boxicons",
                "@iconify/react",
                "@iconify/*",
                "@mdi/js",
                "@mdi/react",
                "@primer/octicons-react",
                "react-bootstrap-icons",
                "grommet-icons",
                "ionicons",
                "ionicons/*",
                "@expo/vector-icons",
                "@icons-pack/*",
              ],
              message:
                "Use lucide-react (default, generic glyphs) or @elabs-ai/components-icons (brand icons). Other icon sets are not allowed — see .claude/rules/icons.md.",
            },
            {
              // Deep-path imports bypass the package entry + can pull a duplicate copy.
              group: ["lucide-react/*"],
              message:
                'Import named icons from the lucide-react root, not deep paths — e.g. `import { Bell } from "lucide-react"`. See .claude/rules/icons.md.',
            },
          ],
        },
      ],
    },
  },
  {
    // Tests legitimately demo raw sizes/colours AND assert on raw class strings
    // (`toHaveClass("text-sm")`), so keep both taxonomy rules off there.
    files: ["**/*.test.{ts,tsx,js,jsx}"],
    rules: {
      "brand/no-raw-font-size": "off",
      "brand/no-raw-color": "off",
    },
  },
  {
    // Stories: raw COLOURS stay legit (token tables, chart-palette demos), but
    // "type is a role, not a size" holds even in reference/scenario/template
    // stories — they're the exemplar + copy-own surfaces. So no-raw-font-size is
    // ENFORCED here (matches the check-text-scale ratchet now scanning stories).
    // A genuine type-scale DEMO disables it inline with a reason.
    files: ["**/*.stories.{ts,tsx,js,jsx}"],
    rules: {
      "brand/no-raw-color": "off",
    },
  },
  {
    ignores: ["dist/**", "build/**", "storybook-static/**", "coverage/**", "**/*.config.*"],
  },
];

export default baseConfig;
