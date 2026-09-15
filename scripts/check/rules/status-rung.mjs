/**
 * status-rung — status FILL rung used as running text (#124).
 * Restored from scripts/check-status-rung.mjs (git 2fa2ce6).
 *
 * Three rungs per tone (`destructive`/`success`/`warning`/`info`): the bare FILL
 * rung `text-<tone>` (≥3:1 — a MARK: icon, dot, stroke), the INK rung
 * `text-<tone>-text` (≥4.5:1 — running TEXT), and `-foreground` (ink on a plate).
 *
 * Detectable slice (honest scope, ~39% completeness / 100% precision on the #124
 * corpus): within ONE class-string literal, a bare `text-<tone>` (not scoped via
 * `[&>svg]:`/`[&_svg]:`) co-occurring with a TEXT TELL (`text-xs`/a type role/
 * `font-*` weight/`truncate`) flags. No tell → silent. NOT detected (review is the
 * backstop): a tone token in its own ternary-branch literal, a lookup-map value
 * reused for icon AND text, and `text-<tone> [&>svg]:text-<tone>` (alert.tsx shape).
 * Comments are not stripped. The old baseline was empty, so this is a zero rule;
 * `registry/` is warn-only (copy-own).
 */
import { lineOf } from "../context.mjs";

const TONES = ["destructive", "success", "warning", "info"];
const TYPE_ROLE_RE = /^text-(display|title|subtitle|body|caption|meta|kpi|code)$/;
const TEXT_SIZE_RE = /^text-(xs|sm|base|lg|xl|2xl|3xl|4xl|5xl|6xl)$/;
const FONT_WEIGHT_RE = /^font-(thin|extralight|light|normal|medium|semibold|bold|extrabold|black)$/;
const STRING_LITERAL_RE = /"[^"\n]*"|'[^'\n]*'|`[^`\n]*`/g;

const IGNORE = [
  "**/*.{test,stories}.{ts,tsx}",
  "**/{node_modules,dist,storybook-static,.turbo,coverage,__output}/**",
];

const stripVariants = (token) => token.replace(/^.*:/, "");
const isSvgScoped = (token) => /^\[&[_>]svg\]:/.test(token);
const isBareToneToken = (token) =>
  !isSvgScoped(token) && TONES.some((tone) => stripVariants(token) === `text-${tone}`);
function isTextTell(token) {
  const s = stripVariants(token);
  return TYPE_ROLE_RE.test(s) || TEXT_SIZE_RE.test(s) || FONT_WEIGHT_RE.test(s) || s === "truncate";
}

/** True iff ONE class string pairs a bare `text-<tone>` with a text tell. */
export function classStringViolates(classString) {
  const tokens = classString.split(/\s+/).filter(Boolean);
  return tokens.some(isBareToneToken) && tokens.some(isTextTell);
}

function scan(ctx, patterns, warn) {
  const out = [];
  for (const file of ctx.glob(patterns, { ignore: IGNORE })) {
    const text = ctx.readFile(file);
    for (const m of text.matchAll(STRING_LITERAL_RE)) {
      if (!classStringViolates(m[0].slice(1, -1))) continue;
      out.push({
        file,
        line: lineOf(text, m.index),
        msg: "bare `text-<tone>` (3:1 MARK rung) on running text — use `text-<tone>-text` (≥4.5:1)",
        ...(warn ? { warn: true } : {}),
      });
    }
  }
  return out;
}

const src = (body) => ({ files: { "packages/ui/src/widget/widget.tsx": body } });
const cls = (c) => src(`export const X = () => <p className="${c}">x</p>;\n`);

export default {
  id: "status-rung",
  scope: "components",
  doc: "Paint running status text with the ink rung `text-<tone>-text`; a bare `text-<tone>` (the 3:1 fill rung) is for marks only and never shares a class string with a text tell (`text-xs`, a type role, `font-*`, `truncate`).",
  baseline: "none",
  run(ctx) {
    return [
      ...scan(ctx, "packages/*/src/**/*.{ts,tsx}", false),
      ...scan(ctx, "registry/**/*.{ts,tsx}", true),
    ];
  },
  fixtures: {
    pass: [
      // marks (icon slots)
      cls("size-4 text-success"),
      cls("size-4 shrink-0 text-destructive"),
      cls("fill-current text-warning"),
      cls("size-4 text-success animate-in fade-in zoom-in-95 duration-fast ease-entrance"),
      // no tell → silent (stated completeness gap)
      cls("text-destructive"),
      cls("bg-destructive/10 text-destructive"),
      // [&>svg]: extension deliberately not implemented
      cls("border-destructive/40 bg-destructive/10 text-destructive [&>svg]:text-destructive"),
      // correct rungs
      cls("text-xs text-destructive-text"),
      cls("text-xs text-destructive-foreground"),
      cls("rounded-full bg-destructive text-destructive-foreground"),
      // tests / stories not scanned; registry advisory
      { files: { "packages/ui/src/w.test.tsx": 'const a = "text-xs text-destructive";' } },
      { files: { "packages/ui/src/w.stories.tsx": 'const a = "text-xs text-destructive";' } },
      { files: { "registry/blocks/a/a.tsx": 'const a = "text-xs text-destructive";' } },
    ],
    fail: [
      cls("text-xs text-destructive"),
      cls(
        "text-sm font-medium text-destructive animate-in fade-in slide-in-from-top-1 ease-entrance",
      ),
      cls("flex min-w-0 items-center gap-1.5 px-2 py-1.5 text-body text-destructive"),
      cls("text-destructive font-bold text-meta"),
      cls("shrink-0 font-semibold text-destructive"),
      src(
        'const chip = "inline-flex items-center gap-1 rounded px-2 py-0.5 text-caption bg-destructive/10 text-destructive ";',
      ),
      cls("text-xs text-warning"),
      src("const b = `shrink-0 font-semibold text-warning`;"),
    ],
  },
};
