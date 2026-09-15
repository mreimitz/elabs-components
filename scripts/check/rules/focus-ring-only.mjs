/**
 * focus-ring-only — ESLint-backed (`conventions/focus-ring-only` in packages/eslint-config/rules/product-conventions.js).
 * The lint config ships it at "warn" for editor feedback; here it runs at error level
 * over package source against a per-file ratchet. RuleTester cases live next to the rule.
 */
const src = (body, file = "packages/ui/src/x.tsx") => ({ files: { [file]: body } });

export default {
  id: "focus-ring-only",
  scope: "components",
  doc: "Focus indicators use `focus-ring`/`focus-ring-within`/`focus-ring-inset`/`focus-ring-static`, never a hand-rolled `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring` stack.",
  baseline: "per-file",
  eslint: "conventions/focus-ring-only",
  fixtures: {
    pass: [
      src('export const x = <button className="focus-ring focus-visible:ring-offset-2" />;'),
      src('export const x = <div className="ring-2 ring-ring" />;'),
      src(
        'export const x = <button className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />;',
        "packages/ui/src/x.test.tsx",
      ),
      src(
        'export const x = <button className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />;',
        "packages/ui/src/x.stories.tsx",
      ),
    ],
    fail: [
      src(
        'export const x = <button className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />;',
      ),
    ],
  },
};
