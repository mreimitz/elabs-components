/**
 * surface-separation — redundant-border ratchet (#187, research 08 §F).
 * Restored from scripts/check-separation.mjs (git 2fa2ce6).
 *
 * Each region owns ONE focal separation gesture — fill / rail / elevation / a
 * single divider. A bare `border` stacked on a region that already has a
 * non-default fill is (usually) a redundant boundary.
 *
 * Detectable slice (honest scope): within ONE class-string literal, the standalone
 * `border` token co-occurring with a non-default fill (`bg-surface-muted`,
 * `bg-surface-elevated`, `bg-chat-user`, `bg-<status>/N`). `border bg-card` (the
 * generic Card default), rails (`border-s-*`), axis borders and `border-0` never
 * flag. Cross-element regions / "sole cue?" belong to the visual reviewer.
 * Per-file ratchet; `registry/` is warn-only (copy-own).
 */
import { lineOf } from "../context.mjs";

/** Non-default fills that make a bare `border` redundant (08 §F). */
const FILL_RE =
  /^bg-(?:surface-muted|surface-elevated|chat-user|(?:success|warning|destructive|info)\/\d+)$/;

/** String literals a className could live in (single-line; class strings are). */
const STRING_LITERAL_RE = /"[^"\n]*"|'[^'\n]*'|`[^`\n]*`/g;

const IGNORE = [
  "**/*.{test,stories}.{ts,tsx}",
  "**/{node_modules,dist,storybook-static,.turbo,coverage,__output}/**",
];

/** True iff ONE class string has a standalone `border` AND a non-default fill. */
export function classStringViolates(classString) {
  const tokens = classString.split(/\s+/).filter(Boolean);
  const bare = (t) => t.replace(/^.*:/, "");
  return tokens.some((t) => bare(t) === "border") && tokens.some((t) => FILL_RE.test(bare(t)));
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
        msg: `bare \`border\` stacked on a non-default fill (${m[0].slice(1, -1).trim()}) — one separation gesture per region: drop the border, or keep it as the sole cue and drop the fill`,
        ...(warn ? { warn: true } : {}),
      });
    }
  }
  return out;
}

const src = (body) => ({ files: { "packages/ai/src/x.tsx": body } });

export default {
  id: "surface-separation",
  scope: "components",
  doc: "Give each region ONE separation gesture: never a bare `border` in the same class string as a non-default fill (`bg-surface-muted`, `bg-surface-elevated`, `bg-chat-user`, `bg-<status>/N`); rails (`border-s-*`), axis dividers and `border bg-card` are fine.",
  baseline: "per-file",
  run(ctx) {
    return [
      ...scan(ctx, "packages/*/src/**/*.{ts,tsx}", false),
      ...scan(ctx, "registry/**/*.{ts,tsx}", true),
    ];
  },
  fixtures: {
    pass: [
      src('const a = "rounded-lg border bg-card shadow-sm";'),
      src('const a = "bg-warning/10 border-s-4 border-s-border-strong";'),
      src('const a = "border-t bg-surface-muted";'),
      src('const a = "rounded-md border p-3";'),
      src('const a = "bg-surface-muted p-3";'),
      { files: { "packages/ai/src/x.test.tsx": 'const a = "border bg-chat-user";' } },
      { files: { "packages/ai/src/x.stories.tsx": 'const a = "border bg-chat-user";' } },
      { files: { "registry/blocks/a/a.tsx": 'const a = "border bg-chat-user";' } },
    ],
    fail: [
      src('const a = cn("rounded-md border bg-surface-muted p-3");'),
      src("const b = `border bg-chat-user`;"),
      src("const c = 'rounded border bg-warning/10';"),
      src('const d = "dark:border bg-surface-elevated";'),
    ],
  },
};
