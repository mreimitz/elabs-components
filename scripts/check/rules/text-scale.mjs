/**
 * text-scale — type is a role, not a size (#187).
 *
 * Component source and stories reach for a type ROLE (`text-display|title|subtitle|
 * body|caption|meta|kpi|code`, or `<Heading>`/`<Text>`), never a raw font-size
 * utility (`text-sm`, `text-xl`, `text-[17px]`). `--text-body == text-sm`, so
 * `text-sm` → `text-body` is a visual no-op. Color/var arbitraries (`text-[#fff]`,
 * `text-[var(--x)]`), alignment and `text-balance` do not match.
 * Per-file ratchet over packages/*\/src + apps/docs/stories (stories are exemplar
 * surfaces, so they are gated; only *.test.* is exempt). `registry/` is warn-only.
 */
import { lineOf } from "../context.mjs";

export const RAW_TYPE_RE =
  /\btext-(?:xs|sm|base|lg|xl|[2-9]xl)\b|\btext-\[[0-9.]+(?:px|rem|em)\b[^\]]*\]/g;

const IGNORE = [
  "**/*.test.{ts,tsx}",
  "**/{node_modules,dist,storybook-static,.turbo,coverage,__output}/**",
];

function scan(ctx, patterns, warn) {
  return ctx.glob(patterns, { ignore: IGNORE }).flatMap((file) => {
    const text = ctx.readFile(file);
    return [...text.matchAll(RAW_TYPE_RE)].map((m) => ({
      file,
      line: lineOf(text, m.index),
      msg: `raw font-size utility \`${m[0]}\` — use a type role (\`text-body\`, \`text-title\`, …) or <Heading>/<Text>`,
      ...(warn ? { warn: true } : {}),
    }));
  });
}

const src = (body, file = "packages/ui/src/a.tsx") => ({ files: { [file]: body } });

export default {
  id: "text-scale",
  scope: "components",
  doc: "Set type with a role (`text-display-lg|display|title|subtitle|body|caption|meta|eyebrow|kpi|kpi-sm|code` or `<Heading>`/`<Text>`), never a raw size utility (`text-sm`, `text-xl`, `text-[17px]`) in package source or stories.",
  baseline: "per-file",
  run(ctx) {
    return [
      ...scan(ctx, ["packages/*/src/**/*.{ts,tsx}", "apps/docs/stories/**/*.{ts,tsx}"], false),
      ...scan(ctx, "registry/**/*.{ts,tsx}", true),
    ];
  },
  fixtures: {
    pass: [
      src(
        'className="text-body text-title text-kpi text-meta text-caption text-subtitle text-display text-code"',
      ),
      src('className="text-left text-center text-balance"'),
      src('className="text-[#fff] text-[var(--x)] text-[oklch(0.5 0 0)]"'),
      src('className="text-sm"', "packages/ui/src/a.test.tsx"),
      src('className="text-sm"', "registry/blocks/a/a.tsx"),
    ],
    fail: [
      src('className="text-sm font-medium"'),
      src('cn("text-xs", "text-2xl", "text-9xl")'),
      src('className="text-[17px] leading-none"'),
      src('className="text-[1.25rem]"'),
      src("text-base text-balance"),
      src('className="text-sm"', "apps/docs/stories/foundations/x.stories.tsx"),
    ],
  },
};
