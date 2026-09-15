/**
 * type-roles — ESLint-backed (`conventions/type-roles` in packages/eslint-config/rules/product-conventions.js).
 * The lint config ships it at "warn" for editor feedback; here it runs at error level
 * over package source against a per-file ratchet. RuleTester cases live next to the rule.
 */
const src = (body, file = "packages/ui/src/x.tsx") => ({ files: { [file]: body } });

export default {
  id: "type-roles",
  scope: "components",
  doc: "Type is a role: use `text-display|title|subtitle|body|caption|meta|kpi|code`, never raw `text-sm`/`text-[17px]` in `packages/*/src/**/*.tsx` (stories are covered by `pnpm text-scale:check`).",
  baseline: "per-file",
  eslint: "conventions/type-roles",
  eslintPatterns: ["packages/*/src/**/*.tsx"],
  eslintIgnore: ["**/*.{test,stories}.{ts,tsx}"],
  fixtures: {
    pass: [
      src('export const x = <p className="text-body text-muted-foreground" />;'),
      src('export const x = <p className="text-sm" />;', "packages/ui/src/x.test.tsx"),
      src('export const x = <p className="text-sm" />;', "packages/ui/src/x.stories.tsx"),
    ],
    fail: [
      src('export const x = <p className="text-sm" />;'),
      src('export const x = cn("md:text-[17px]");'),
    ],
  },
};
