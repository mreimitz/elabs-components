/**
 * forward-ref-required — ESLint-backed (`conventions/forward-ref-required` in packages/eslint-config/rules/product-conventions.js).
 * The lint config ships it at "warn" for editor feedback; here it runs at error level
 * over package source against a per-file ratchet. RuleTester cases live next to the rule.
 */
const src = (body, file = "packages/ui/src/x.tsx") => ({ files: { [file]: body } });

export default {
  id: "forward-ref-required",
  scope: "components",
  doc: "An exported component that spreads `...props` onto a DOM element is wrapped in `forwardRef`.",
  baseline: "per-file",
  eslint: "conventions/forward-ref-required",
  eslintPatterns: ["packages/*/src/**/*.tsx"],
  eslintIgnore: ["**/*.{test,stories}.{ts,tsx}"],
  fixtures: {
    pass: [
      src("export const Card = forwardRef((props, ref) => <div ref={ref} {...props} />);"),
      src(
        "export function Card({ className, ...props }) { return <div {...props} />; }",
        "packages/ui/src/x.test.tsx",
      ),
      src(
        "export function Card({ className, ...props }) { return <div {...props} />; }",
        "packages/ui/src/x.stories.tsx",
      ),
    ],
    fail: [src("export function Card({ className, ...props }) { return <div {...props} />; }")],
  },
};
