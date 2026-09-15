/**
 * state-coverage — curated stateful components ship a non-happy-path story (#247, #108).
 * Ported from scripts/check-state-coverage.mjs.
 *
 * State applicability has no reliable prop signature, so membership is a hand-kept
 * allowlist (`STATEFUL_COMPONENTS`); the rule never invents it. Each allowlisted manifest
 * component needs a story file that imports/renders it and exports a story whose name
 * contains Loading/Empty/Error/Disabled/Skeleton/FirstRun/Awaiting.
 * Baseline keys: `@elabs-ai/components-<pkg>::Component`.
 */
import { MANIFEST, pkgSrcDir, readManifest, storyFilesFor } from "../../lib/story-coverage.mjs";

export const STATEFUL_COMPONENTS = [
  "ChatShell",
  "Conversation",
  "Tool",
  "Combobox",
  "Command",
  "DatePicker",
  "Drawer",
  "DropdownMenu",
  "Accordion",
  "Breadcrumb",
  "Calendar",
  "Plan",
];

const STATE_KEYWORD_RE = /(?:Loading|Empty|Error|Disabled|Skeleton|FirstRun|Awaiting)/;

export function hasStateStory(storyText) {
  for (const m of storyText.matchAll(/export\s+const\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*[:=]/g))
    if (STATE_KEYWORD_RE.test(m[1])) return true;
  return false;
}

// ── fixtures ─────────────────────────────────────────────────────────────────
const fx = (name, stories, baseline) => ({
  files: {
    [MANIFEST]: JSON.stringify({
      packages: {
        "@elabs-ai/components-fixture": {
          path: "pkg-fixture",
          components: [{ name, module: "pkg-fixture/src/widget.tsx" }],
        },
      },
    }),
    ...Object.fromEntries(Object.entries(stories).map(([k, v]) => [`pkg-fixture/src/${k}`, v])),
  },
  ...(baseline ? { baseline } : {}),
});
const USE = 'import { Combobox } from "./combobox";\nexport const Default = () => <Combobox />;\n';

export default {
  id: "state-coverage",
  scope: "stories",
  doc: "Every allowlisted stateful component (`STATEFUL_COMPONENTS` in the rule) exports a story named for a non-happy state (`Loading`, `Empty`, `Error`, `Disabled`, `Skeleton`, `FirstRun`, `Awaiting`).",
  baseline: "keys",
  run(ctx) {
    const { manifest, error } = readManifest(ctx, "state-coverage");
    if (error) return [error];
    const allow = new Set(STATEFUL_COMPONENTS);
    const out = [];
    for (const [pkgName, pkg] of Object.entries(manifest.packages ?? {})) {
      for (const comp of pkg.components ?? []) {
        if (!allow.has(comp.name)) continue;
        const files = storyFilesFor(ctx, pkgSrcDir(pkg), comp.name);
        if (files.some((f) => hasStateStory(ctx.readFile(f)))) continue;
        out.push({
          file: comp.module ?? MANIFEST,
          line: 1,
          key: `${pkgName}::${comp.name}`,
          msg: `${comp.name} has no *Loading/*Empty/*Error/*Disabled/*Skeleton/*FirstRun/*Awaiting story export`,
        });
      }
    }
    return out;
  },
  fixtures: {
    pass: [
      fx("Combobox", { "combobox.stories.tsx": `${USE}export const EmptyResults = () => null;\n` }),
      fx("Combobox", { "combobox.stories.tsx": `${USE}export const Awaiting: Story = {};\n` }),
      fx("Combobox", { "shared.stories.tsx": `${USE}export const FirstRunOnboarding = {};\n` }),
      // not on the allowlist: never considered
      fx("Widget", {}),
      fx("Combobox", { "combobox.stories.tsx": USE }, ["@elabs-ai/components-fixture::Combobox"]),
    ],
    fail: [
      fx("Combobox", { "combobox.stories.tsx": `${USE}export const Palette: Story = {};\n` }),
      fx("Combobox", {}),
      // an unrelated story file that only mentions the name does not count
      fx("Combobox", {
        "combobox.stories.tsx": USE,
        "unrelated.stories.tsx": 'export const ErrorState = { name: "Combobox error" };\n',
      }),
    ],
  },
};
