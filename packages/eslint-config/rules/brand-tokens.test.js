/**
 * Self-test for the brand-tokens ESLint rules (node --test).
 * Plants valid + invalid fixtures and asserts the rules fire exactly where
 * expected — so the gate can't silently rot. Run: `pnpm --filter @elabs-ai/components-eslint-config test`.
 */
import test from "node:test";
import { RuleTester } from "eslint";
import tseslint from "typescript-eslint";
import { noRawFontSize, noRawColor } from "./brand-tokens.js";

const ruleTester = new RuleTester({
  languageOptions: {
    parser: tseslint.parser,
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
});

test("no-raw-font-size", () => {
  ruleTester.run("no-raw-font-size", noRawFontSize, {
    valid: [
      { code: 'const a = <div className="text-body text-muted-foreground" />;' },
      { code: 'const a = <h2 className="text-title font-semibold" />;' },
      { code: 'const a = <p className="text-display text-kpi text-caption text-meta" />;' },
      // alignment / wrapping utilities are NOT font sizes
      { code: 'const a = <div className="text-center text-balance text-pretty truncate" />;' },
      { code: 'const c = cn("bg-card rounded-md", "text-subtitle");' },
    ],
    invalid: [
      {
        code: 'const a = <div className="text-2xl font-bold" />;',
        errors: [{ messageId: "rawFontSize" }],
      },
      {
        code: 'const a = <span className="text-sm" />;',
        errors: [{ messageId: "rawFontSize" }],
      },
      {
        code: 'const c = cn("p-2", "text-[18px]");',
        errors: [{ messageId: "rawFontSize" }],
      },
      {
        // cva variant value
        code: 'const v = cva("base", { variants: { size: { lg: "text-xl" } } });',
        errors: [{ messageId: "rawFontSize" }],
      },
    ],
  });
});

test("no-raw-color", () => {
  ruleTester.run("no-raw-color", noRawColor, {
    valid: [
      { code: 'const a = <div className="text-foreground bg-card border-border" />;' },
      { code: 'const a = <div className="bg-primary text-primary-foreground" />;' },
      { code: 'const a = <div className="bg-success/10 text-destructive-text" />;' },
      { code: 'const c = cn("text-muted-foreground", "ring-ring");' },
    ],
    invalid: [
      {
        code: 'const a = <div className="text-gray-500" />;',
        errors: [{ messageId: "rawColor" }],
      },
      {
        code: 'const a = <div className="bg-red-500/80" />;',
        errors: [{ messageId: "rawColor" }],
      },
      {
        code: 'const c = cn("text-[#fff]");',
        errors: [{ messageId: "rawColor" }],
      },
      {
        code: 'const a = <div className="bg-[oklch(0.5_0.1_150)]" />;',
        errors: [{ messageId: "rawColor" }],
      },
      {
        // clsx object key as class
        code: 'const c = clsx({ "border-blue-300": isActive });',
        errors: [{ messageId: "rawColor" }],
      },
    ],
  });
});
