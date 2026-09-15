/**
 * component-registration — "adding a component never requires remembering to register it"
 * (WP-10 #86, #67 DoD). Ported from scripts/check-components-registered.mjs.
 *
 *   - every `packages/ui/src/components/<name>/` is re-exported from `src/index.ts` or is
 *     the target of its own `package.json` subpath export (ADR 0006);
 *   - every registered ui component ships a `*.stories.tsx` (co-located, or a same-named
 *     story anywhere under packages/ or apps/docs). Pre-existing gaps are baseline keys
 *     (the component folder name); an unexported folder's key is never baselined.
 *   - advisory: a flat-file package's top-level `*.tsx` whose exports reach no manifest
 *     entry (possible orphan).
 * A `_`-prefixed file/folder, or `@registry-ignore` in a file's first 400 chars, is skipped.
 *
 * The orphan arm reads the COMMITTED brand-ui.manifest.json (the old gate regenerated it
 * in-process via packages/cli generateManifest, which reads the filesystem itself); the
 * manifest's freshness is gated by `pnpm gen:check`.
 */
import { posix } from "node:path";

import { MANIFEST } from "../../lib/story-coverage.mjs";

const UI = "packages/ui";
const COMPONENTS = `${UI}/src/components`;
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const baseOf = (f) => f.slice(f.lastIndexOf("/") + 1);
const ignored = (name) => name.startsWith("_");

/** Component folder names registered through a non-`.` subpath export. */
function subpathComponentDirs(pkgJson) {
  const out = new Set();
  for (const [subpath, target] of Object.entries(pkgJson?.exports ?? {})) {
    if (subpath === ".") continue;
    const rel = typeof target === "string" ? target : (target?.types ?? target?.default);
    if (typeof rel !== "string") continue;
    const abs = posix.join(UI, rel);
    if (abs.startsWith(`${COMPONENTS}/`)) out.add(abs.slice(COMPONENTS.length + 1).split("/")[0]);
  }
  return out;
}

/** Every string (and every `name`) anywhere in a manifest package entry, except `path`. */
function collectNames(node, out = new Set()) {
  if (typeof node === "string") out.add(node);
  else if (Array.isArray(node)) for (const v of node) collectNames(v, out);
  else if (node && typeof node === "object")
    for (const k of Object.keys(node)) if (k !== "path") collectNames(node[k], out);
  return out;
}

function exportedIdents(src) {
  const names = new Set();
  for (const m of src.matchAll(
    /export\s+(?:async\s+)?(?:function|const|let|var|class)\s+([A-Za-z0-9_]+)/g,
  ))
    names.add(m[1]);
  for (const m of src.matchAll(/export\s*\{([^}]*)\}/g))
    for (const part of m[1].split(","))
      names.add(
        part
          .trim()
          .split(/\s+as\s+/)
          .pop()
          .trim(),
      );
  return [...names].filter(Boolean);
}

function orphanAdvisories(ctx) {
  if (!ctx.exists(MANIFEST)) return [];
  const out = [];
  for (const [pkg, entry] of Object.entries(ctx.json(MANIFEST).packages ?? {})) {
    if (pkg === "@elabs-ai/components-ui" || !entry?.path) continue;
    const known = collectNames(entry);
    const files = ctx.glob(`${entry.path}/src/*.tsx`, {
      ignore: ["**/*.{stories,test}.tsx", "**/index.tsx", "**/_*"],
    });
    for (const file of files) {
      const text = ctx.readFile(file);
      if (text.slice(0, 400).includes("@registry-ignore")) continue;
      const idents = exportedIdents(text);
      if (!idents.some((n) => /^[A-Z]/.test(n)) || idents.some((n) => known.has(n))) continue;
      out.push({
        file,
        line: 1,
        warn: true,
        msg: `${pkg}: exports [${idents.slice(0, 4).join(", ")}] — none reach the manifest (possible orphan)`,
      });
    }
  }
  return out;
}

// ── fixtures ─────────────────────────────────────────────────────────────────
const tree = ({ barrel = 'export * from "./components/card";\n', files = {}, exports } = {}) => ({
  files: {
    [`${UI}/package.json`]: JSON.stringify({ name: "@elabs-ai/components-ui", exports }),
    [`${UI}/src/index.ts`]: barrel,
    [`${COMPONENTS}/card/card.tsx`]: "export function Card() {}",
    [`${COMPONENTS}/card/index.ts`]: 'export * from "./card";',
    ...files,
  },
});
const STORY = { [`${COMPONENTS}/card/card.stories.tsx`]: "export default {};" };

export default {
  id: "component-registration",
  scope: "components",
  doc: "Every `@elabs-ai/components-ui` component folder is re-exported from `src/index.ts` (or its own subpath export) and ships a `*.stories.tsx`.",
  baseline: "keys",
  run(ctx) {
    const out = [];
    if (!ctx.exists(`${UI}/src/index.ts`)) return out;
    const barrel = ctx.readFile(`${UI}/src/index.ts`);
    const viaSubpath = subpathComponentDirs(
      ctx.exists(`${UI}/package.json`) ? ctx.json(`${UI}/package.json`) : {},
    );
    const storyIndex = new Set(
      ctx
        .glob(["packages/**/*.stories.tsx", "apps/docs/**/*.stories.tsx"], {
          ignore: "**/{node_modules,dist,.turbo}/**",
        })
        .map((f) =>
          baseOf(f)
            .replace(/\.stories\.tsx$/, "")
            .toLowerCase(),
        ),
    );
    const byDir = new Map();
    for (const f of ctx.glob(`${COMPONENTS}/*/**`)) {
      const rest = f.slice(COMPONENTS.length + 1);
      const name = rest.split("/")[0];
      if (!byDir.has(name)) byDir.set(name, []);
      byDir.get(name).push(rest.slice(name.length + 1));
    }
    for (const [name, files] of [...byDir].sort(([a], [b]) => a.localeCompare(b))) {
      if (ignored(name)) continue;
      const spec = `./components/${name}`;
      const exported =
        new RegExp(`["']${escapeRe(spec)}(/index)?["']`).test(barrel) || viaSubpath.has(name);
      const file = `${COMPONENTS}/${name}/${files.includes("index.ts") ? "index.ts" : files[0]}`;
      if (!exported) {
        out.push({
          file: `${UI}/src/index.ts`,
          line: 1,
          key: `unexported::${name}`,
          msg: `components/${name}/ is NOT re-exported — add \`export * from "${spec}";\` (or run /new-component)`,
        });
        continue;
      }
      const hasStory =
        files.some((f) => !f.includes("/") && f.endsWith(".stories.tsx")) ||
        storyIndex.has(name.toLowerCase());
      if (!hasStory)
        out.push({
          file,
          line: 1,
          key: name,
          msg: `components/${name}/ has no *.stories.tsx — add <name>.stories.tsx (tags: ["autodocs"]) beside it`,
        });
    }
    return [...out, ...orphanAdvisories(ctx)];
  },
  fixtures: {
    pass: [
      tree({ files: STORY }),
      tree({ barrel: 'export * from "./components/card/index";', files: STORY }),
      // a story in apps/docs with the component's name
      tree({ files: { "apps/docs/stories/card.stories.tsx": "export default {};" } }),
      // registered through its own subpath export (ADR 0006)
      tree({ barrel: "", files: STORY, exports: { "./card": "./src/components/card/index.ts" } }),
      // `_internal` folders are skipped
      tree({ files: { ...STORY, [`${COMPONENTS}/_internal/x.tsx`]: "export const X = 1;" } }),
      // a baselined story gap
      { ...tree(), baseline: ["card"] },
      // flat-file orphans are advisory only
      tree({
        files: {
          ...STORY,
          [MANIFEST]: JSON.stringify({
            packages: { "@elabs-ai/components-ai": { path: "packages/ai", components: [] } },
          }),
          "packages/ai/src/orphan.tsx": "export function Orphan() {}",
        },
      }),
    ],
    fail: [
      tree(), // a NEW component with no story
      tree({ barrel: "", files: STORY }), // unexported folder
      { ...tree({ barrel: "", files: STORY }), baseline: ["card"] }, // baseline never excuses export
    ],
  },
};
