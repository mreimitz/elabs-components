/**
 * logical-props — ESLint-backed (`conventions/logical-props` in packages/eslint-config/rules/product-conventions.js).
 * The lint config ships it at "warn" for editor feedback; here it runs at error level
 * over package source against a per-file ratchet. RuleTester cases live next to the rule.
 */
const src = (body, file = "packages/ui/src/x.tsx") => ({ files: { [file]: body } });

export default {
  id: "logical-props",
  scope: "components",
  doc: "Use logical direction utilities (`ms-`/`me-`/`ps-`/`pe-`/`start-`/`end-`/`border-s`/`rounded-s`/`text-start`), never physical `ml-`/`pr-`/`left-`/`border-l`/`text-right`, so layouts mirror in RTL.",
  baseline: "per-file",
  eslint: "conventions/logical-props",
  fixtures: {
    pass: [
      src('export const x = <div className="ms-2 pe-4 text-start" />;'),
      src('export const x = <div className="ml-2" />;', "packages/ui/src/x.test.tsx"),
      src('export const x = <div className="ml-2" />;', "packages/ui/src/x.stories.tsx"),
    ],
    fail: [src('export const x = <div className="ml-2" />;')],
  },
};
