/**
 * collapse-fork — collapse-mechanism fork prevention (#190, research 09 §E.1/§F).
 * Restored from scripts/check-collapse-fork.mjs (git 2fa2ce6).
 *
 * Sidebar's gap-spacer + fixed-slide width tween lives ONCE in `useCollapsiblePanel`
 * (`packages/ui/src/components/collapsible-panel/`). A file outside that folder
 * with BOTH halves — a `transition-[…width…]` tween AND an off-screen slide
 * `left|right|start|end-[calc(var(--x)*-1)]` — that does not reference
 * `useCollapsiblePanel` is a fork. One half alone never flags. Comments stripped.
 */
import { lineOf } from "../context.mjs";

export const CANONICAL_DIR = "packages/ui/src/components/collapsible-panel";
const TRANSITION_WIDTH_RE = /\btransition-\[[^\]]*width[^\]]*\]/;
const OFFSCREEN_SLIDE_RE = /\b(?:left|right|start|end)-\[calc\(var\(--[a-z0-9-]+\)\*-1\)\]/;
const HOOK_RE = /\buseCollapsiblePanel\b/;

const stripComments = (src) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");

/** At most one file-level co-occurrence → `[{ transition, transitionLine, slide, slideLine }]`. */
export function findCollapseForkViolations(src) {
  const code = stripComments(src);
  if (HOOK_RE.test(code)) return [];
  const transition = code.match(TRANSITION_WIDTH_RE);
  const slide = code.match(OFFSCREEN_SLIDE_RE);
  if (!transition || !slide) return [];
  return [
    {
      transition: transition[0],
      transitionLine: lineOf(code, transition.index),
      slide: slide[0],
      slideLine: lineOf(code, slide.index),
    },
  ];
}

// ── fixtures ─────────────────────────────────────────────────────────────────
const src = (body, file = "packages/ai/src/context-panel.tsx") => ({ files: { [file]: body } });
const HAND_ROLLED_FORK = `
export function MyPanel({ open }: { open: boolean }) {
  return (
    <div data-state={open ? "expanded" : "collapsed"} className="group">
      <div className="relative w-(--my-panel-width) bg-transparent transition-[width] duration-base ease-linear group-data-[state=collapsed]:w-0" />
      <div className="fixed inset-y-0 z-10 hidden h-svh w-(--my-panel-width) transition-[left,right,width] duration-base ease-linear md:flex right-0 group-data-[state=collapsed]:right-[calc(var(--my-panel-width)*-1)]" />
    </div>
  );
}
`;
const HOOK_CONSUMER = `
import { useCollapsiblePanel } from "../collapsible-panel";
export function MyPanel() {
  const panel = useCollapsiblePanel({
    side: "right",
    widthClassName: "w-(--my-panel-width)",
    containerSlideClassNames: {
      left: "left-0 group-data-[state=collapsed]:left-[calc(var(--my-panel-width)*-1)]",
      right: "right-0 group-data-[state=collapsed]:right-[calc(var(--my-panel-width)*-1)]",
    },
  });
  return <div {...panel.attrs}><div className={panel.spacerClassName} /></div>;
}
`;

export default {
  id: "collapse-fork",
  scope: "components",
  doc: "Build a collapsing side panel on `useCollapsiblePanel` (`@elabs-ai/components-ui`); never hand-roll a `transition-[…width…]` tween plus an off-screen `[calc(var(--x)*-1)]` slide outside `packages/ui/src/components/collapsible-panel`.",
  baseline: "none",
  run(ctx) {
    const files = ctx.glob("packages/*/src/**/*.{ts,tsx}", {
      ignore: ["**/*.{test,stories}.{ts,tsx}", "**/{node_modules,dist}/**", `${CANONICAL_DIR}/**`],
    });
    const out = [];
    for (const file of files)
      for (const v of findCollapseForkViolations(ctx.readFile(file)))
        out.push({
          file,
          line: v.transitionLine,
          msg: `width tween \`${v.transition}\` + off-screen slide \`${v.slide}\` (line ${v.slideLine}) — a hand-rolled collapse mechanism; compose useCollapsiblePanel`,
        });
    return out;
  },
  fixtures: {
    pass: [
      src(HOOK_CONSUMER),
      src('const bar = "h-full rounded-full transition-[width] duration-slow";'),
      src('const slide = "right-0 group-data-[state=collapsed]:right-[calc(var(--x)*-1)]";'),
      src(
        HAND_ROLLED_FORK.split("\n")
          .map((l) => `// ${l}`)
          .join("\n"),
      ),
      src(`/*${HAND_ROLLED_FORK}*/`),
      src('const a = "transition-transform duration-base left-0 -translate-x-1/2";'),
      src(HAND_ROLLED_FORK, `${CANONICAL_DIR}/use-collapsible-panel.ts`),
      src(HAND_ROLLED_FORK, "packages/ai/src/context-panel.test.tsx"),
      src(HAND_ROLLED_FORK, "packages/ai/src/context-panel.stories.tsx"),
    ],
    fail: [
      src(HAND_ROLLED_FORK),
      src(HAND_ROLLED_FORK, "packages/ui/src/components/sidebar/sidebar.tsx"),
      src(
        'const a = "fixed inset-y-0 w-(--sidebar-width) transition-[left,right,width] md:flex";\nconst b = "left-0 group-data-[collapsible=offcanvas]:left-[calc(var(--sidebar-width)*-1)]";',
      ),
    ],
  },
};
