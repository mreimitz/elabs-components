/**
 * source-theme-count — product source never claims a stale theme count (#29).
 *
 * The docs/skills currency checks read prose surfaces only; ~20 "all three themes"
 * comments (and one rendered Storybook line) survived a deleted third theme in
 * component source. This rule scans packages/*\/src/** (.ts/.tsx/.css, tests
 * included) and apps/docs/stories/** (.ts/.tsx/.mdx) with the shared
 * `findThemeCountViolations` detector, against the count of `BUILT_IN_THEMES` in
 * theme-types.ts — never a hardcoded number.
 */
import { THEME_TYPES } from "../context.mjs";
import { findThemeCountViolations, themeCountFromSource } from "../lib/theme-count-prose.mjs";

const TYPES = (names) =>
  `export const BUILT_IN_THEMES = [${names.map((n) => `"${n}"`).join(", ")}] as const;\n`;
const tree = (file, text) => ({ files: { [THEME_TYPES]: TYPES(["light", "dark"]), [file]: text } });

export default {
  id: "source-theme-count",
  scope: "components",
  doc: 'Say "every theme" (or "both themes"), never a hardcoded theme count that disagrees with `BUILT_IN_THEMES`, in package source comments and stories.',
  baseline: "none",
  run(ctx) {
    const count = ctx.exists(THEME_TYPES) ? themeCountFromSource(ctx.readFile(THEME_TYPES)) : null;
    if (!count)
      return [
        { file: THEME_TYPES, line: 1, msg: "cannot derive a theme count from BUILT_IN_THEMES" },
      ];
    const files = ctx.glob(
      ["packages/*/src/**/*.{ts,tsx,css}", "apps/docs/stories/**/*.{ts,tsx,mdx}"],
      { ignore: "**/{node_modules,dist}/**" },
    );
    return files.flatMap((file) =>
      findThemeCountViolations(ctx.readFile(file), count).map((v) => ({
        file,
        line: v.line,
        msg: `claims "${v.match}" but BUILT_IN_THEMES ships ${count} — say "every theme"`,
      })),
    );
  },
  fixtures: {
    pass: [
      tree("packages/ui/src/components/split-panel/split-panel.tsx", "robust across every theme."),
      tree("packages/editor/src/code-editor/code-editor.tsx", "matches both themes."),
      tree(
        "packages/ui/src/x.tsx",
        "React 19 supports themes through context; ratio 4.5:1 in all themes.",
      ),
      tree("docs/x.md", "all three themes"),
    ],
    fail: [
      tree(
        "packages/ui/src/components/split-panel/split-panel.tsx",
        "/**\n * a white `bg-card` and is robust across all three themes — a card is\n */\n",
      ),
      tree(
        "apps/docs/stories/foundations/theming.stories.tsx",
        "Use the theme control in the toolbar to flip between the three themes,",
      ),
      tree("packages/ai/src/_streamdown-i18n.ts", "// brand-ui ships THREE themes (light/dark),"),
      tree("packages/tokens/src/themes.css", "/* Run a three-theme sweep before merge. */"),
      tree("packages/ui/src/x.test.tsx", "/* reads in all three\n   shipped themes */"),
      { files: { "packages/ui/src/x.tsx": "every theme" } },
    ],
  },
};
