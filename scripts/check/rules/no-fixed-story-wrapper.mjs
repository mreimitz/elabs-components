/**
 * no-fixed-story-wrapper — story decorators/render wrappers don't pin a fixed
 * pixel WIDTH that hides how the component behaves when horizontal space runs out.
 *
 * Flags in `*.stories.tsx` (code only — comment lines are skipped):
 *   - Tailwind `w-[Npx]` / `size-[Npx]` with N > 320 (wider than the smallest phone
 *     viewport), unprefixed (`md:w-[800px]` is responsive), and not paired with a
 *     `max-w-*` in the same class string (`w-[560px] max-w-full` still shrinks);
 *   - inline `style={{ width: 800 }}` / `width: "800px"` (N > 320) with no `maxWidth`.
 * Allowed: `max-w-*`, `w-full`, `min-w-*`, `%`/`vw` values, widths ≤ 320px, and fixed
 * HEIGHTS (`h-[600px]`). Heights were measured and dropped (2026-09 sample: 3 of 5 were
 * deliberate — React Flow canvases and chart shells need a sized parent, chat/page
 * stories stand in for a scroll region) and never cause horizontal overflow.
 * Fix: `w-full max-w-*` or `parameters.layout`.
 */
import { lineOf } from "../context.mjs";

const IGNORE = ["**/{node_modules,dist,storybook-static,.turbo,coverage,__output}/**"];
const LIMIT = 320;

const TW_RE = /(?<![\w:-])(w|size)-\[(\d+(?:\.\d+)?)px\]/g;
const STYLE_RE = /style=\{\{([^{}]*)\}\}/g;
const STYLE_PROP_RE =
  /(?<![\w-])(width)\s*:\s*(?:(\d+(?:\.\d+)?)(?![\w%])|["'`](\d+(?:\.\d+)?)px["'`])/g;

/** The enclosing quoted string (class list) around `index`, on one line. */
function classListAround(text, index) {
  const lineStart = text.lastIndexOf("\n", index) + 1;
  const lineEnd = text.indexOf("\n", index);
  const line = text.slice(lineStart, lineEnd === -1 ? text.length : lineEnd);
  const col = index - lineStart;
  let open = -1;
  for (let i = col; i >= 0; i--)
    if (line[i] === '"' || line[i] === "'" || line[i] === "`") {
      open = i;
      break;
    }
  const close = open === -1 ? -1 : line.indexOf(line[open], col);
  return open === -1 || close === -1 ? line : line.slice(open + 1, close);
}

/** Is `index` on a `//`, `/*` or ` * ` comment line? */
function inComment(text, index) {
  const line = text.slice(text.lastIndexOf("\n", index) + 1, index);
  return /^\s*(?:\/\/|\/\*|\*)/.test(line);
}

export function scanText(file, text) {
  const out = [];
  for (const m of text.matchAll(TW_RE)) {
    if (Number(m[2]) <= LIMIT) continue;
    if (inComment(text, m.index)) continue;
    if (classListAround(text, m.index).includes("max-w-")) continue;
    out.push({
      file,
      line: lineOf(text, m.index),
      msg: `fixed story wrapper \`${m[0]}\` hides responsive overflow — use \`w-full max-w-*\` or \`parameters.layout\``,
    });
  }
  for (const s of text.matchAll(STYLE_RE)) {
    const body = s[1];
    if (/\bmaxWidth\b/.test(body) || inComment(text, s.index)) continue;
    for (const p of body.matchAll(STYLE_PROP_RE)) {
      const n = Number(p[2] ?? p[3]);
      if (n <= LIMIT) continue;
      out.push({
        file,
        line: lineOf(text, s.index + 7 + p.index),
        msg: `fixed story wrapper \`style={{ ${p[0]} }}\` hides responsive overflow — use \`maxWidth\`/\`w-full max-w-*\` or \`parameters.layout\``,
      });
    }
  }
  return out;
}

const story = (body) => ({ files: { "packages/ui/src/components/x/x.stories.tsx": body } });

export default {
  id: "no-fixed-story-wrapper",
  scope: "stories",
  doc: "Story decorators and render wrappers never pin a fixed width above 320px (`w-[800px]`, `style={{ width: 800 }}`) without a max — use `w-full max-w-*` or `parameters.layout`.",
  baseline: "per-file",
  run(ctx) {
    return ctx
      .glob(
        [
          "packages/*/src/**/*.stories.tsx",
          "apps/*/stories/**/*.stories.tsx",
          "apps/*/src/**/*.stories.tsx",
        ],
        { ignore: IGNORE },
      )
      .flatMap((file) => scanText(file, ctx.readFile(file)));
  },
  fixtures: {
    pass: [
      story(`decorators: [
  (Story) => (
    <div className="w-full max-w-xl">
      <Story />
    </div>
  ),
],`),
      story(`render: () => (
  <div className="min-h-[480px] w-[560px] max-w-full">
    <Toolbar />
  </div>
),`),
      story(`render: () => <div style={{ height: "100%", width: 240 }}><AppSidebar /></div>,`),
      story(`render: () => <div className="h-[200px] md:w-[800px]"><Sparkline /></div>,`),
      // a chart prop, not a wrapper style
      story(`args: { width: 800, height: 600 },`),
      // fixed heights are allowed: a React Flow canvas needs a sized parent
      story(`render: () => <div className="h-[600px] w-full"><Canvas /></div>,`),
      story(`/**
 * The outer \`w-[420px]\` div stands in for the inset.
 */
export const Default = {};`),
    ],
    fail: [
      story(`decorators: [
  (Story) => (
    <div className="w-[560px]">
      <Story />
    </div>
  ),
],`),
      story(`render: () => (
  <div className="h-[440px] w-[720px]">
    <NetworkChart {...args} />
  </div>
),`),
      story(`render: () => (
  <div style={{ width: 620 }}>
    <ChartCard />
  </div>
),`),
      story(`render: () => <div style={{ width: "900px", height: 700 }}><Canvas /></div>,`),
    ],
  },
};
