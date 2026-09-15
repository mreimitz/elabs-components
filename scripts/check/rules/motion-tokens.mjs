/**
 * motion-tokens — no raw motion utilities in @elabs-ai/components-charts / -ai (#178).
 *
 * `duration-<N>`, `ease-in`, `ease-out`, `ease-in-out` and `transition-all` bypass the
 * `--motion-factor` gate and ignore reduced motion. Token utilities
 * (`duration-fast|base|slow|slower`, `ease-standard|entrance|exit`, `ease-linear`),
 * specific transitions (`transition-colors`, `transition-[…]`), framer-motion
 * camelCase values (`ease: "easeOut"`) and CSS vars are fine. Comments are ignored.
 * Scope: packages/{charts,ai}/src, excluding tests and stories.
 */
import { lineOf } from "../context.mjs";
import { blankJsComments } from "../lib/css.mjs";

const FORBIDDEN = [
  {
    re: /\bduration-\d+\b/g,
    fix: "duration-fast / duration-base / duration-slow / duration-slower",
  },
  { re: /\bease-in\b(?!-)/g, fix: "ease-entrance (appearing) or ease-standard (on-screen morph)" },
  { re: /\bease-out\b/g, fix: "ease-entrance (settle) or ease-exit (leaving)" },
  { re: /\bease-in-out\b/g, fix: "ease-standard" },
  { re: /\btransition-all\b/g, fix: "transition-colors / -opacity / -transform / -[property]" },
];

export function findMotionViolations(src) {
  const code = blankJsComments(src);
  return FORBIDDEN.flatMap(({ re, fix }) =>
    [...code.matchAll(re)].map((m) => ({ line: lineOf(src, m.index), match: m[0], fix })),
  );
}

const src = (text) => ({ files: { "packages/ai/src/x.tsx": text } });

export default {
  id: "motion-tokens",
  scope: "components",
  doc: "Use motion tokens in charts/ai source: `duration-fast|base|slow|slower` and `ease-standard|entrance|exit`, never `duration-<N>`, `ease-in`/`ease-out`/`ease-in-out` or `transition-all` (docs/MOTION_GUIDELINES.md).",
  baseline: "none",
  run(ctx) {
    return ctx
      .glob("packages/{charts,ai}/src/**/*.{ts,tsx}", {
        ignore: ["**/*.test.{ts,tsx}", "**/*.stories.tsx", "**/{node_modules,dist}/**"],
      })
      .flatMap((file) =>
        findMotionViolations(ctx.readFile(file)).map(({ line, match, fix }) => ({
          file,
          line,
          msg: `raw motion utility \`${match}\` — use ${fix}; add motion-reduce:transition-none`,
        })),
      );
  },
  fixtures: {
    pass: [
      src(
        'className="transition-colors duration-fast ease-standard motion-reduce:transition-none"',
      ),
      src(
        'className="transition-opacity duration-slow ease-entrance duration-base duration-slower"',
      ),
      src('className="transition-colors ease-exit animate-spin ease-linear"'),
      src('transition={{ duration: 0.3, ease: "easeOut" }}\nease: "easeInOut"'),
      src('style={{ transition: "opacity var(--t-base) var(--ease-standard)" }}'),
      src('style={{ transition: "transform 260ms cubic-bezier(.2,0,0,1)" }}'),
      src('transition: {\n  duration: 0.4,\n  ease: "easeInOut"\n}'),
      src('/* className="transition-all duration-200 ease-out" */'),
      src('// className="transition-all duration-200"'),
      { files: { "packages/ai/src/x.test.tsx": 'className="transition-all"' } },
      { files: { "packages/ai/src/x.stories.tsx": 'className="transition-all"' } },
      { files: { "packages/ui/src/x.tsx": 'className="transition-all"' } },
    ],
    fail: [
      src('className="rounded transition-all hover:bg-accent"'),
      src('cn("transition-all", "rounded")'),
      src('className="transition-colors duration-150"'),
      src('className="transition-colors ease-out"'),
      src('className="transition-opacity ease-in"'),
      src('className="transition-transform ease-in-out"'),
      { files: { "packages/charts/src/x.tsx": 'className="duration-500"' } },
    ],
  },
};
