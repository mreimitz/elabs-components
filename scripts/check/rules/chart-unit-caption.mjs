/**
 * chart-unit-caption — every unit-decomposed chart story states its unit (RM-039 rule 4, #265).
 * Ported from scripts/check-charts-honesty.mjs (rule 4) + charts-honesty-caption-baseline.json.
 *
 * A unit-mode story (UnitChart `layout="waffle|field"`, HeatmapChart `mode: "dot"` /
 * `DotHeat*`, `<Bar unit={…}>`, WaterfallChart `unit`, DumbbellChart `beads: {…}`) under
 * `packages/charts/src/{charts,marks}/**` must carry "one X = N" / "1 X = N" in the VALUE
 * of `unitLabel`, `description` or `accessibleDescription`. `layout="rows"` is exempt
 * (unitLabel is ignored there). Keys baseline: `<file>#<Story>`.
 */
import { ENCODING_GLOB } from "./charts-honesty.mjs";

const UNIT_PHRASE_RE = /\b(?:one|1)\b[^=\n]{0,40}\s=\s[^=\n]{0,60}/i;
const CAPTION_PROP_RE =
  /\b(?:unitLabel|description|accessibleDescription)\s*[:=]\s*\{?\s*(["'`])((?:\\.|(?!\1)[^\\])*)\1/g;

const hasUnitCaption = (text) =>
  [...text.matchAll(CAPTION_PROP_RE)].some((m) => UNIT_PHRASE_RE.test(m[2]));

/** Index just after the `}` matching the `{` at `openIndex` (skips strings/templates/comments). */
function findMatchingBrace(src, openIndex) {
  let depth = 0;
  let i = openIndex;
  const n = src.length;
  while (i < n) {
    const ch = src[i];
    if (ch === "{") {
      depth++;
      i++;
    } else if (ch === "}") {
      depth--;
      i++;
      if (depth === 0) return i;
    } else if (ch === '"' || ch === "'") {
      i++;
      while (i < n && src[i] !== ch) i += src[i] === "\\" ? 2 : 1;
      i++;
    } else if (ch === "`") {
      i++;
      while (i < n && src[i] !== "`") {
        if (src[i] === "\\") i += 2;
        else if (src[i] === "$" && src[i + 1] === "{") {
          i += 2;
          let t = 1;
          while (i < n && t > 0) {
            if (src[i] === "{") t++;
            else if (src[i] === "}") t--;
            i++;
          }
        } else i++;
      }
      i++;
    } else if (ch === "/" && src[i + 1] === "/") {
      while (i < n && src[i] !== "\n") i++;
    } else if (ch === "/" && src[i + 1] === "*") {
      i += 2;
      while (i < n && !(src[i] === "*" && src[i + 1] === "/")) i++;
      i += 2;
    } else i++;
  }
  return n;
}

/** `export const Name: Story = { … }` blocks, sliced to their own closing brace. */
function splitStoryBlocks(src) {
  const blocks = [];
  for (const m of src.matchAll(/export const (\w+)\s*:\s*Story\s*=\s*\{/g)) {
    const end = findMatchingBrace(src, m.index + m[0].length - 1);
    blocks.push({ name: m[1], index: m.index, text: src.slice(m.index, end) });
  }
  return blocks;
}

function isUnitModeStory(file, { name, text }) {
  if (/unit-chart\.stories\.tsx$/.test(file))
    return /layout\s*[=:]\s*"(?:waffle|field)"/.test(text);
  if (/heatmap-chart\.stories\.tsx$/.test(file))
    return /mode\s*:\s*"dot"/.test(text) || /^DotHeat/.test(name);
  if (/[/\\]bar-chart\.stories\.tsx$/.test(file)) return /<Bar\b[^>]*\bunit=\{/.test(text);
  if (/waterfall-chart\.stories\.tsx$/.test(file))
    return /<WaterfallChart\b[^>]*\bunit=\{/.test(text) || /\bunit\s*:\s*\d/.test(text);
  if (/dumbbell-chart\.stories\.tsx$/.test(file)) return /\bbeads\s*:\s*\{/.test(text);
  return false;
}

const story = (file, body) => ({ files: { [`packages/charts/src/charts/${file}`]: body } });

export default {
  id: "chart-unit-caption",
  scope: "stories",
  doc: 'Every unit-decomposed chart story (waffle/field UnitChart, dot heatmap, `unit`-ed Bar/WaterfallChart, beaded DumbbellChart) states its unit ("one X = N") in `unitLabel`, `description` or `accessibleDescription`.',
  baseline: "keys",
  run(ctx) {
    const out = [];
    for (const file of ctx.glob(ENCODING_GLOB, { ignore: "**/{node_modules,dist}/**" })) {
      if (!/\.stories\.tsx$/.test(file)) continue;
      const src = ctx.readFile(file);
      for (const block of splitStoryBlocks(src)) {
        if (!isUnitModeStory(file, block) || hasUnitCaption(block.text)) continue;
        out.push({
          file,
          line: src.slice(0, block.index).split("\n").length,
          key: `${file}#${block.name}`,
          msg: `story "${block.name}" plots a unit-decomposed chart but states no unit ("one X = N") in description/unitLabel/accessibleDescription`,
        });
      }
    }
    return out;
  },
  fixtures: {
    pass: [
      story(
        "unit-chart.stories.tsx",
        'export const Foo: Story = {\n  args: { data: [], layout: "waffle", unitLabel: "one dot = one visit in a hundred" },\n};',
      ),
      story(
        "unit-chart.stories.tsx",
        'export const Foo: Story = {\n  args: { data: [], layout: "field", unitLabel: "1 dot = 1 visit" },\n};',
      ),
      story(
        "unit-chart.stories.tsx",
        'export const Foo: Story = {\n  args: { data: [], layout: "rows" },\n};',
      ),
      story("bar-chart.stories.tsx", "export const Diverging: Story = {\n  args: { data: d },\n};"),
      story("unit-chart.tsx", 'export const Foo: Story = { args: { layout: "waffle" } };'),
      {
        files: {
          "packages/charts/src/gantt/unit-chart.stories.tsx":
            'export const Foo: Story = { args: { layout: "waffle" } };',
        },
      },
    ],
    fail: [
      story(
        "unit-chart.stories.tsx",
        'export const Foo: Story = {\n  args: { data: [], layout: "waffle" },\n};',
      ),
      story(
        "heatmap/heatmap-chart.stories.tsx",
        'export const DotHeat: Story = {\n  args: { mode: "dot", data: [] },\n};',
      ),
      story(
        "bar-chart.stories.tsx",
        'export const UnitRungs: Story = {\n  render: () => (\n    <BarChart data={d}>\n      <Bar dataKey="revenue" fill="var(--chart-1)" lineCap="round" unit={2000} />\n    </BarChart>\n  ),\n};',
      ),
      story(
        "waterfall-chart.stories.tsx",
        "export const UnitRungs: Story = {\n  render: () => <WaterfallChart data={d} unit={25} />,\n};",
      ),
      story(
        "dumbbell-chart.stories.tsx",
        "export const Default: Story = {\n  args: { data: d, beads: { unit: 4 } },\n};",
      ),
      story(
        "bar-chart.stories.tsx",
        'export const UnitRungs: Story = {\n  render: () => <Bar dataKey="revenue" unit={2000} />,\n};\n\nconst profitLossData = [{ month: "Jan", net: 4200 }];\n\n/**\n * one thing = another — a later story\'s docs.\n */\nexport const Diverging: Story = {\n  args: { data: profitLossData },\n};',
      ),
    ],
  },
};
