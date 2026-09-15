/**
 * loading-states — a not-ready prop ships a story that shows it (#267).
 * Ported from scripts/check-loading-states.mjs. See .claude/rules/loading-states.md.
 *
 * A manifest component whose prop blob has `loading?: boolean`, `isStreaming?: boolean`
 * or `status?: ChartStatus` (the charts-only alias) needs a story file that imports/renders
 * it and either exports `*Loading*`/`*Streaming*` or sets the signal to its not-ready value
 * (`loading: true`, `isStreaming={true}`, `status="loading"`).
 * Baseline keys: `@elabs-ai/components-<pkg>::Component`.
 */
import { MANIFEST, pkgSrcDir, readManifest, storyFilesFor } from "../../lib/story-coverage.mjs";

/** "loading" | "isStreaming" | "status" | null, from the concatenated prop text. */
export function notReadySignal(propInfo) {
  if (!propInfo || !Array.isArray(propInfo.props)) return null;
  const blob = propInfo.props
    .map((p) => `${p?.name ?? ""}${p?.optional ? "?" : ""}: ${p?.type ?? ""}`)
    .join(";\n");
  if (/\bloading\s*\??:\s*boolean\b/.test(blob)) return "loading";
  if (/\bisStreaming\s*\??:\s*boolean\b/.test(blob)) return "isStreaming";
  if (/\bstatus\s*\??:\s*ChartStatus\b/.test(blob)) return "status";
  return null;
}

export function storyExercisesNotReady(storyText) {
  return (
    /export\s+const\s+\w*(?:Loading|Streaming)\w*\s*[:=]/.test(storyText) ||
    /\bloading\s*[:=]\s*\{?\s*true\b/.test(storyText) ||
    /\bisStreaming\s*[:=]\s*\{?\s*true\b/.test(storyText) ||
    /\bstatus\s*[:=]\s*["']?(?:loading|streaming)["']?/.test(storyText)
  );
}

// ── fixtures ─────────────────────────────────────────────────────────────────
const fx = (props, stories = {}, baseline) => ({
  files: {
    [MANIFEST]: JSON.stringify({
      packages: {
        "@elabs-ai/components-fixture": {
          path: "pkg-fixture",
          components: [{ name: "Widget", module: "pkg-fixture/src/widget.tsx" }],
          props: { Widget: { props } },
        },
      },
    }),
    ...Object.fromEntries(Object.entries(stories).map(([k, v]) => [`pkg-fixture/src/${k}`, v])),
  },
  ...(baseline ? { baseline } : {}),
});
const LOADING = [{ name: "loading", optional: true, type: "boolean" }];
const USE = 'import { Widget } from "./widget";\nexport const Default = () => <Widget />;\n';
const story = (extra) => ({ "widget.stories.tsx": `${USE}${extra}` });

export default {
  id: "loading-states",
  scope: "stories",
  doc: 'A component with a `loading`/`isStreaming` (or chart `status: ChartStatus`) prop ships a story that shows it: a `*Loading`/`*Streaming` export or a not-ready arg (`loading: true`, `status="loading"`).',
  baseline: "keys",
  run(ctx) {
    const { manifest, error } = readManifest(ctx, "loading-states");
    if (error) return [error];
    const out = [];
    for (const [pkgName, pkg] of Object.entries(manifest.packages ?? {})) {
      if (!pkg.props || !pkg.components) continue;
      const byName = new Map(pkg.components.map((c) => [c.name, c]));
      for (const [compName, propInfo] of Object.entries(pkg.props)) {
        const signal = notReadySignal(propInfo);
        const comp = byName.get(compName);
        if (!signal || !comp) continue;
        const files = storyFilesFor(ctx, pkgSrcDir(pkg), compName);
        if (files.some((f) => storyExercisesNotReady(ctx.readFile(f)))) continue;
        out.push({
          file: comp.module ?? MANIFEST,
          line: 1,
          key: `${pkgName}::${compName}`,
          msg: `${compName} (\`${signal}\`) has no *Loading/*Streaming story or not-ready arg`,
        });
      }
    }
    return out;
  },
  fixtures: {
    pass: [
      fx(LOADING, story("export const Loading = { args: { loading: true } };\n")),
      fx(LOADING, story("export const Default2 = { args: { loading: true } };\n")),
      fx(
        [{ name: "isStreaming", optional: true, type: "boolean" }],
        story("export const Streaming: Story = {};\n"),
      ),
      fx(
        [{ name: "status", optional: true, type: "ChartStatus" }],
        story('<Widget status="loading" />\n'),
      ),
      // DataTable shape: the signal folded into another prop's type blob
      fx(
        [{ name: "toolbar", optional: true, type: "(t: Table) => ReactNode; loading?: boolean;" }],
        story("export const Loading = {};\n"),
      ),
      // `status` of another type is not a not-ready signal
      fx([{ name: "status", optional: true, type: "TestStatus" }], story("")),
      fx([{ name: "className", optional: true, type: "string" }]),
      fx(LOADING, story(""), ["@elabs-ai/components-fixture::Widget"]),
    ],
    fail: [
      fx(LOADING, story("")),
      fx(LOADING, story("export const Default3: Story = { args: { loading: false } };\n")),
      fx(
        [{ name: "toolbar", optional: true, type: "(t: Table) => ReactNode; loading?: boolean;" }],
        {},
      ),
      // an unrelated story file whose prose names the component does not count
      fx(LOADING, {
        ...story(""),
        "unrelated.stories.tsx": 'export const Loading = { name: "Widget error" };\n',
      }),
    ],
  },
};
