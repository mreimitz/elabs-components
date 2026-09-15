/**
 * i18n-strings — ESLint-backed (`conventions/i18n-strings` in packages/eslint-config/rules/product-conventions.js).
 * The lint config ships it at "warn" for editor feedback; here it runs at error level
 * over package source against a per-file ratchet. RuleTester cases live next to the rule.
 */
const src = (body, file = "packages/ui/src/x.tsx") => ({ files: { [file]: body } });

export default {
  id: "i18n-strings",
  scope: "components",
  doc: "UI text in package source (JSX text, `aria-label`/`title`/`placeholder` literals) comes from props or a labels object so apps can localize it; stories, tests, templates and registry are exempt.",
  baseline: "per-file",
  eslint: "conventions/i18n-strings",
  eslintIgnore: [
    "**/*.{test,stories}.{ts,tsx}",
    "**/{stories,test,tests,__tests__,templates,registry}/**",
  ],
  fixtures: {
    pass: [
      src("export const x = <button aria-label={labels.close}>{label} …</button>;"),
      src('export const x = <button aria-label="Close" />;', "packages/ui/src/x.test.tsx"),
      src('export const x = <button aria-label="Close" />;', "packages/ui/src/x.stories.tsx"),
      src('export const x = <button aria-label="Close" />;', "packages/ai/src/templates/x.tsx"),
    ],
    fail: [
      src('export const x = <button aria-label="Close" />;'),
      src("export const x = <span>Copy code</span>;"),
    ],
  },
};
