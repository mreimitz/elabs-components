/**
 * home-tokens — the website (`apps/home`, ADR 0038) paints only with tokens. In
 * apps/home/**\/*.{ts,tsx,css}: no raw hex colour, no `rgb()`/`hsl()`/`oklch()`/`oklab()` colour
 * function, no arbitrary `duration-[…]` or `ease-[…]` utility. `app/globals.css` is the one CSS
 * entry and may only REFERENCE tokens (`var(--…)`): the colour checks apply to it too.
 * Comments are ignored. Per-line escape hatch: `home-tokens-exempt: <reason>` in a comment.
 */
import { lineOf } from "../context.mjs";
import { blankJsComments } from "../lib/css.mjs";

const CHECKS = [
  {
    re: /(?<![\w&/-])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b/g,
    msg: (m) => `raw hex colour \`${m}\` — use a semantic token utility or var(--…)`,
  },
  {
    re: /\b(?:rgba?|hsla?|oklch|oklab)\(/g,
    msg: (m) => `raw colour function \`${m}…)\` — colour values live in the token themes only`,
  },
  {
    re: /\bduration-\[[^\]]*\]/g,
    msg: (m) => `arbitrary duration \`${m}\` — use duration-fast|base|slow|slower`,
  },
  {
    re: /\bease-\[[^\]]*\]/g,
    msg: (m) => `arbitrary easing \`${m}\` — use ease-standard|entrance|exit`,
  },
];
const EXEMPT_RE = /home-tokens-exempt:\s*\S/;
const IGNORE = ["**/{node_modules,.next,.turbo}/**"];

/** Findings in one source string → `[{ line, msg }]`. */
export function findHomeTokenViolations(src) {
  const exempt = new Set();
  src.split("\n").forEach((l, i) => EXEMPT_RE.test(l) && exempt.add(i + 1));
  const code = blankJsComments(src);
  const out = [];
  for (const { re, msg } of CHECKS)
    for (const m of code.matchAll(re)) {
      const line = lineOf(code, m.index);
      if (!exempt.has(line)) out.push({ line, msg: msg(m[0]) });
    }
  return out.sort((a, b) => a.line - b.line);
}

const home = (body, file = "apps/home/app/page.tsx") => ({ files: { [file]: body } });
const css = (body) => home(body, "apps/home/app/globals.css");

export default {
  id: "home-tokens",
  scope: "components",
  doc: "Paint the website (`apps/home`, ADR 0038) with tokens only: no raw hex, `rgb()`/`hsl()`/`oklch()` colour or arbitrary `duration-[…]`/`ease-[…]` in `apps/home/**/*.{ts,tsx,css}`; `app/globals.css` may only reference `var(--…)`.",
  baseline: "none",
  run(ctx) {
    return ctx
      .glob("apps/home/**/*.{ts,tsx,css}", { ignore: IGNORE })
      .flatMap((file) => findHomeTokenViolations(ctx.readFile(file)).map((v) => ({ file, ...v })));
  },
  fixtures: {
    pass: [
      home(
        'className="bg-background text-foreground transition-opacity duration-base ease-standard"',
      ),
      home('<a href="#main-content">Skip</a>\nconst s = "&#123;";'),
      home("// tracked in #459 and #fff-less comments\n/* #abcdef */\nexport const A = 1;"),
      home('style={{ color: "rgb(0 0 0)" }} // home-tokens-exempt: fixture proving the hatch'),
      css(
        '@import "@elabs-ai/components-tokens/styles.css";\n@source "../../../packages/ui/src/**/*.{ts,tsx}";\nbody { color: var(--foreground); }',
      ),
      { files: { "apps/docs/stories/x.tsx": 'className="bg-[#123456]"' } },
    ],
    fail: [
      home('className="bg-[#123456]"'),
      home('style={{ color: "#fff" }}'),
      home('className="transition-opacity duration-[250ms]"'),
      home('className="ease-[cubic-bezier(0.2,0,0,1)]"'),
      css(":root { --brand: oklch(0.6 0.2 250); }"),
      css("body { background: rgb(255 255 255); }"),
    ],
  },
};
