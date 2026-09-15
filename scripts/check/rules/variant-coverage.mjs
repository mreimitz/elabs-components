/**
 * variant-coverage — every cva variant VALUE reaches a rendered story (#388).
 * Ported from scripts/check-variant-coverage.mjs.
 *
 * For every manifest component with a `variants` map and at least one story file that
 * imports/renders it, each value must appear as `axis="value"` (JSX) or `axis: "value"`
 * (args/object literal) OUTSIDE the `argTypes` block — `argTypes.options` makes a value
 * selectable, it does not render it. A DEFAULT value is also met by any story that leaves
 * the axis unset. A component with no story at all is `component-registration`'s job.
 * Baseline keys: `@elabs-ai/components-<pkg>::Component::axis=value`.
 */
import { MANIFEST, pkgSrcDir, readManifest, storyFilesFor } from "../../lib/story-coverage.mjs";

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Remove the first brace-matched `argTypes: { … }` block. */
export function stripArgTypesBlock(text) {
  const idx = text.indexOf("argTypes");
  if (idx === -1) return text;
  const brace = text.indexOf("{", idx);
  if (brace === -1) return text;
  let depth = 0;
  for (let i = brace; i < text.length; i++) {
    if (text[i] === "{") depth++;
    else if (text[i] === "}" && --depth === 0) return text.slice(0, idx) + text.slice(i + 1);
  }
  return text;
}

/** `axis="value"` or `axis: "value"`, word-boundary anchored (`invariant` ≠ `variant`). */
export function valueRenderedInText(text, axis, value) {
  const a = escapeRe(axis);
  const v = escapeRe(value);
  return new RegExp(`\\b${a}\\s*[=:]\\s*["'\`]${v}["'\`]`).test(text);
}

/** Per-export story blocks (not `meta`, not any block holding `argTypes:`). */
export function findStoryBlocks(storyText) {
  const matches = [...storyText.matchAll(/export\s+const\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*[:=]/g)];
  const blocks = [];
  for (let i = 0; i < matches.length; i++) {
    if (matches[i][1] === "meta") continue;
    const end = i + 1 < matches.length ? matches[i + 1].index : storyText.length;
    const text = storyText.slice(matches[i].index, end);
    if (!/\bargTypes\s*:/.test(text)) blocks.push({ name: matches[i][1], text });
  }
  return blocks;
}

/** Does at least one story block never set `axis` (so cva's default renders)? */
export function hasDefaultOmittingStory(storyText, axis) {
  const setRe = new RegExp(`\\b${escapeRe(axis)}\\s*[:=]\\s*["'\`]`);
  return findStoryBlocks(storyText).some((b) => !setRe.test(b.text));
}

// ── fixtures ─────────────────────────────────────────────────────────────────
const fx = (story, variants, { withStory = true, baseline } = {}) => ({
  files: {
    [MANIFEST]: JSON.stringify({
      packages: {
        "@elabs-ai/components-fixture": {
          path: "pkg-fixture",
          components: [{ name: "Widget", module: "pkg-fixture/src/widget.tsx" }],
          variants: { Widget: variants },
        },
      },
    }),
    "pkg-fixture/src/widget.tsx": "export function Widget() {}\n",
    ...(withStory
      ? { "pkg-fixture/src/widget.stories.tsx": `import { Widget } from "./widget";\n${story}` }
      : {}),
    "pkg-fixture/src/unrelated.stories.tsx":
      'export const X = { name: "Widget", variant: "success" };\n',
  },
  ...(baseline ? { baseline } : {}),
});
const DS = {
  variants: { variant: ["default", "success"] },
  defaultVariants: { variant: "default" },
};
const META = "const meta = { argTypes: { variant: { options: ['default', 'success'] } } };\n";

export default {
  id: "variant-coverage",
  scope: "stories",
  doc: 'Render every `cva` variant value in a story (`variant="success"` or `args: { variant: "success" }`); `argTypes.options` does not count, a default is met by a story that leaves the axis unset.',
  baseline: "keys",
  run(ctx) {
    const { manifest, error } = readManifest(ctx, "variant-coverage");
    if (error) return [error];
    const out = [];
    for (const [pkgName, pkg] of Object.entries(manifest.packages ?? {})) {
      if (!pkg.variants || !pkg.components) continue;
      const byName = new Map(pkg.components.map((c) => [c.name, c]));
      for (const [compName, info] of Object.entries(pkg.variants)) {
        const comp = byName.get(compName);
        if (!comp) continue;
        const storyFiles = storyFilesFor(ctx, pkgSrcDir(pkg), compName);
        if (storyFiles.length === 0) continue;
        const raw = storyFiles.map((f) => ctx.readFile(f));
        const stripped = raw.map(stripArgTypesBlock);
        const defaults = info?.defaultVariants ?? {};
        for (const [axis, values] of Object.entries(info?.variants ?? {})) {
          if (!Array.isArray(values)) continue;
          for (const value of values) {
            if (stripped.some((t) => valueRenderedInText(t, axis, value))) continue;
            if (value === defaults[axis] && raw.some((t) => hasDefaultOmittingStory(t, axis)))
              continue;
            out.push({
              file: comp.module ?? MANIFEST,
              line: 1,
              key: `${pkgName}::${compName}::${axis}=${value}`,
              msg: `${compName} \`${axis}="${value}"\` is not rendered by any story (${storyFiles[0]})`,
            });
          }
        }
      }
    }
    return out;
  },
  fixtures: {
    pass: [
      fx(
        `${META}export const Default: Story = { args: { variant: "default" } };\nexport const Success: Story = { args: { variant: "success" } };\n`,
        DS,
      ),
      // JSX attribute counts
      fx(
        `export const S = () => <Widget variant="success" />;\nexport const D = () => <Widget variant='default' />;\n`,
        DS,
      ),
      // a default value is covered by a story that omits the axis (InputGroup precedent)
      fx(
        `export const Bare: Story = { render: () => <Widget className="max-w-sm" /> };\nexport const Surface: Story = { args: { variant: "surface" } };\n`,
        { variants: { variant: ["outline", "surface"] }, defaultVariants: { variant: "outline" } },
      ),
      // no story file at all: out of scope
      fx("", DS, { withStory: false }),
      // a baselined gap
      fx(`${META}export const Default: Story = { args: { variant: "default" } };\n`, DS, {
        baseline: ["@elabs-ai/components-fixture::Widget::variant=success"],
      }),
    ],
    fail: [
      // an uncovered value
      fx(`${META}export const Default: Story = { args: { variant: "default" } };\n`, DS),
      // mentioned ONLY in argTypes.options (the #388 trap)
      fx(
        "const meta = {\n  argTypes: {\n    variant: { options: ['default', 'info', 'success'] },\n  },\n};\nexport const Info: Story = { args: { variant: \"info\" } };\n",
        {
          variants: { variant: ["default", "info", "success"] },
          defaultVariants: { variant: "default" },
        },
      ),
      // every story sets the axis, so the default is never rendered; `invariant` is not `variant`
      fx(
        `export const A: Story = { args: { variant: "success" } };\nconst invariant = "default";\n`,
        DS,
      ),
    ],
  },
};
