/**
 * no-fixed-trigger-width — ESLint-backed (`conventions/no-fixed-trigger-width` in packages/eslint-config/rules/product-conventions.js).
 * The lint config ships it at "warn" for editor feedback; here it runs at error level
 * over package source against a per-file ratchet. RuleTester cases live next to the rule.
 */
const src = (body, file = "packages/ui/src/x.tsx") => ({ files: { [file]: body } });

export default {
  id: "no-fixed-trigger-width",
  scope: "components",
  doc: 'Triggers (`*Trigger` components, `data-slot="*-trigger"`) size with `min-w-*`/`w-full`, never a fixed `w-40`/`w-[180px]`.',
  baseline: "per-file",
  eslint: "conventions/no-fixed-trigger-width",
  fixtures: {
    pass: [
      src('export const x = <SelectTrigger className="min-w-40 w-full" />;'),
      src('export const x = <SelectTrigger className="w-40" />;', "packages/ui/src/x.test.tsx"),
      src('export const x = <SelectTrigger className="w-40" />;', "packages/ui/src/x.stories.tsx"),
    ],
    fail: [src('export const x = <SelectTrigger className="w-40" />;')],
  },
};
