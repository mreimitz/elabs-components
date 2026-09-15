/**
 * locale-formatting — ESLint-backed (`conventions/locale-formatting` in packages/eslint-config/rules/product-conventions.js).
 * The lint config ships it at "warn" for editor feedback; here it runs at error level
 * over package source against a per-file ratchet. RuleTester cases live next to the rule.
 */
const src = (body, file = "packages/ui/src/x.tsx") => ({ files: { [file]: body } });

export default {
  id: "locale-formatting",
  scope: "components",
  doc: "Format numbers and dates with `Intl.*` and a locale prop: no `toLocaleString()`/`toLocaleDateString()`/`toLocaleTimeString()` without a locale, no `new Date(…).toString()` in JSX.",
  baseline: "per-file",
  eslint: "conventions/locale-formatting",
  fixtures: {
    pass: [
      src("export const x = <span>{n.toLocaleString(locale)}</span>;"),
      src("export const x = <span>{n.toLocaleString()}</span>;", "packages/ui/src/x.test.tsx"),
      src("export const x = <span>{n.toLocaleString()}</span>;", "packages/ui/src/x.stories.tsx"),
    ],
    fail: [src("export const x = <span>{n.toLocaleString()}</span>;")],
  },
};
