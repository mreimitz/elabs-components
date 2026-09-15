/**
 * radius-rungs — ESLint-backed (`conventions/radius-rungs` in packages/eslint-config/rules/product-conventions.js).
 * The lint config ships it at "warn" for editor feedback; here it runs at error level
 * over package source against a per-file ratchet. RuleTester cases live next to the rule.
 */
const src = (body, file = "packages/ui/src/x.tsx") => ({ files: { [file]: body } });

export default {
  id: "radius-rungs",
  scope: "components",
  doc: "Radius comes from the `rounded-*` scale (backed by `--radius`), never an arbitrary `rounded-[6px]`.",
  baseline: "per-file",
  eslint: "conventions/radius-rungs",
  fixtures: {
    pass: [
      src('export const x = <div className="rounded-md rounded-[inherit]" />;'),
      src('export const x = <div className="rounded-[5px]" />;', "packages/ui/src/x.test.tsx"),
      src('export const x = <div className="rounded-[5px]" />;', "packages/ui/src/x.stories.tsx"),
    ],
    fail: [src('export const x = <div className="rounded-[5px]" />;')],
  },
};
