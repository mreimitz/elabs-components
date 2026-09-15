/**
 * disabled-recipe — ESLint-backed (`conventions/disabled-recipe` in packages/eslint-config/rules/product-conventions.js).
 * The lint config ships it at "warn" for editor feedback; here it runs at error level
 * over package source against a per-file ratchet. RuleTester cases live next to the rule.
 */
const src = (body, file = "packages/ui/src/x.tsx") => ({ files: { [file]: body } });

export default {
  id: "disabled-recipe",
  scope: "components",
  doc: "A dimmed disabled state follows the house recipe: `disabled:opacity-50` plus `disabled:pointer-events-none` (Button) or `disabled:cursor-not-allowed` (Input) in the same class list.",
  baseline: "per-file",
  eslint: "conventions/disabled-recipe",
  fixtures: {
    pass: [
      src(
        'export const x = <button className="disabled:pointer-events-none disabled:opacity-50" />;',
      ),
      src(
        'export const x = <button className="disabled:opacity-50" />;',
        "packages/ui/src/x.test.tsx",
      ),
      src(
        'export const x = <button className="disabled:opacity-50" />;',
        "packages/ui/src/x.stories.tsx",
      ),
    ],
    fail: [src('export const x = <button className="disabled:opacity-50" />;')],
  },
};
