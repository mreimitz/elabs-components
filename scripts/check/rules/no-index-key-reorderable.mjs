/**
 * no-index-key-reorderable — ESLint-backed (`conventions/no-index-key-reorderable` in packages/eslint-config/rules/product-conventions.js).
 * The lint config ships it at "warn" for editor feedback; here it runs at error level
 * over package source against a per-file ratchet. RuleTester cases live next to the rule.
 */
const src = (body, file = "packages/ui/src/x.tsx") => ({ files: { [file]: body } });

export default {
  id: "no-index-key-reorderable",
  scope: "components",
  doc: "List keys are stable ids from the item, never the `.map` index (`key={i}`); placeholder lists (`Array.from({ length })`, `(_, i)`) are exempt.",
  baseline: "per-file",
  eslint: "conventions/no-index-key-reorderable",
  fixtures: {
    pass: [
      src("const a = items.map((item) => <li key={item.id} />);"),
      src("const a = Array.from({ length: 3 }).map((x, i) => <li key={i} />);"),
      src("const a = items.map((item, i) => <li key={i} />);", "packages/ui/src/x.test.tsx"),
      src("const a = items.map((item, i) => <li key={i} />);", "packages/ui/src/x.stories.tsx"),
    ],
    fail: [src("const a = items.map((item, i) => <li key={i} />);")],
  },
};
