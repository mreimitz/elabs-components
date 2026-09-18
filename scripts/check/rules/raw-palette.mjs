/**
 * raw-palette — no raw Tailwind palette utilities in component source (#189).
 * Ported from scripts/check-raw-palette.mjs. `text-yellow-600`, `bg-red-500/80`
 * bypass every theme; token-backed utilities (`text-info-text`, `bg-success/10`)
 * do not match. Per-file ratchet; `registry/` is warn-only (copy-own blocks).
 */
import { lineOf } from "../context.mjs";

export const RAW_PALETTE_RE =
  /\b(?:text|bg|border|fill|stroke|ring|from|via|to|outline|decoration|accent|caret|shadow)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}\b/g;

const IGNORE = [
  "**/*.{test,stories}.{ts,tsx}",
  "**/{node_modules,dist,storybook-static,.next,.turbo,coverage,__output}/**",
];

function scan(ctx, patterns, warn) {
  const out = [];
  for (const file of ctx.glob(patterns, { ignore: IGNORE })) {
    const text = ctx.readFile(file);
    for (const m of text.matchAll(RAW_PALETTE_RE)) {
      out.push({
        file,
        line: lineOf(text, m.index),
        msg: `raw palette utility \`${m[0]}\` — use a semantic token (text-info-text, bg-success/10, …)`,
        ...(warn ? { warn: true } : {}),
      });
    }
  }
  return out;
}

const src = (body) => ({ files: { "packages/ai/src/x.tsx": body } });

export default {
  id: "raw-palette",
  scope: "components",
  doc: "Use semantic color utilities (`text-info-text`, `bg-success/10`, `border-destructive`), never raw Tailwind palette utilities (`text-yellow-600`, `bg-red-500`) in package source and the website (`apps/home`).",
  baseline: "per-file",
  run(ctx) {
    return [
      ...scan(ctx, "packages/*/src/**/*.{ts,tsx}", false),
      // The website is held to the same palette discipline as the packages (ADR 0038).
      ...scan(ctx, "apps/home/**/*.{ts,tsx}", false),
      ...scan(ctx, "registry/**/*.{ts,tsx}", true),
    ];
  },
  fixtures: {
    pass: [
      src('className="text-info"'),
      src('className="bg-success/10"'),
      src('className="text-destructive-text border-info/40 bg-warning text-warning-foreground"'),
      src('className="bg-muted/50 text-chart-1"'),
      src('className="text-red"'),
      { files: { "packages/ai/src/x.test.tsx": 'className="text-blue-600"' } },
      { files: { "packages/ai/src/x.stories.tsx": 'className="text-blue-600"' } },
      { files: { "packages/ai/other/x.tsx": 'className="text-blue-600"' } },
      // registry is warn-only: reported, never counted
      { files: { "registry/blocks/a/a.tsx": 'className="text-blue-600"' } },
    ],
    fail: [
      src('className="text-blue-600"'),
      { files: { "apps/home/app/page.tsx": 'className="bg-red-500"' } },
      src('className="size-4 text-yellow-600"'),
      src('cn("bg-red-500", "border-blue-300", "fill-green-400")'),
      src('className="ring-emerald-50 shadow-slate-900"'),
      src('className="bg-rose-500/20"'),
    ],
  },
};
