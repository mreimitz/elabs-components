/**
 * registry-resolve — every relative import inside a registry item resolves in BOTH the repo
 * tree (`files[].path`) and the install tree (`files[].target`, what `npx shadcn add` writes).
 * Ported from scripts/check-registry-resolve.mjs.
 *
 * `registry:validate` only checks that each `path` exists; it never follows imports. The
 * registry-blocks unit shipped 13 `../data/<file>` imports that resolved in the repo but not at
 * the target layout while validation stayed green. Theme/style items have no imports to follow.
 *
 * `scripts/check-registry-resolve.mjs` remains as a thin entrypoint for `.githooks/pre-commit`.
 */
const REGISTRY = "registry/registry.json";
const CANDIDATE_SUFFIXES = ["", ".ts", ".tsx", ".js", ".jsx", "/index.ts", "/index.tsx"];
const RELATIVE_IMPORT_RE = /(?:from\s+|import\s*\(\s*|require\s*\(\s*)["'](\.\.?\/[^"']+)["']/g;

/** posix normalize (no leading `./`). */
function normalize(p) {
  const parts = [];
  for (const seg of p.replace(/\\/g, "/").split("/")) {
    if (seg === "" || seg === ".") continue;
    if (seg === ".." && parts.length && parts[parts.length - 1] !== "..") parts.pop();
    else parts.push(seg);
  }
  return parts.join("/");
}
const dirOf = (p) => {
  const n = normalize(p);
  return n.includes("/") ? n.slice(0, n.lastIndexOf("/")) : "";
};

export function findRelativeImports(source) {
  return [...source.matchAll(RELATIVE_IMPORT_RE)].map((m) => ({ spec: m[1], index: m.index }));
}

function resolvesAgainst(fromDir, spec, has) {
  const joined = normalize(`${fromDir}/${spec}`);
  return CANDIDATE_SUFFIXES.some((suf) => has(joined + suf));
}

/** Pure: violations for one item → `[{ file, index, msg }]`. */
export function checkItemResolution(item, { readFile, fileExists }) {
  const out = [];
  if (!Array.isArray(item.files) || item.files.length === 0) return out;
  const targetKeys = new Set(item.files.filter((f) => f.target).map((f) => normalize(f.target)));
  for (const file of item.files) {
    if (!file.path) continue;
    let source;
    try {
      source = readFile(normalize(file.path));
    } catch {
      continue; // registry:validate fails a missing path
    }
    for (const { spec, index } of findRelativeImports(source)) {
      if (!resolvesAgainst(dirOf(file.path), spec, fileExists))
        out.push({
          file: normalize(file.path),
          index,
          msg: `item "${item.name}": imports "${spec}" — does not resolve in the REPO tree`,
        });
      if (file.target && !resolvesAgainst(dirOf(file.target), spec, (k) => targetKeys.has(k)))
        out.push({
          file: normalize(file.path),
          index,
          msg: `item "${item.name}" (target ${file.target}): imports "${spec}" — does not resolve in the INSTALL tree (target layout)`,
        });
    }
  }
  return out;
}

/** The whole check over a ctx → findings. Shared with the pre-commit entrypoint via the runner. */
export function checkRegistryResolve(ctx) {
  if (!ctx.exists(REGISTRY)) return [{ file: REGISTRY, line: 1, msg: "registry.json not found" }];
  const registry = ctx.json(REGISTRY);
  if (!Array.isArray(registry.items))
    return [{ file: REGISTRY, line: 1, msg: "registry.json must contain an `items` array" }];
  const io = { readFile: (p) => ctx.readFile(p), fileExists: (p) => ctx.exists(p) };
  const findings = [];
  for (const item of registry.items) {
    if (item.type === "registry:theme" || item.type === "registry:style") continue;
    for (const v of checkItemResolution(item, io)) {
      const text = ctx.readFile(v.file);
      findings.push({ file: v.file, line: text.slice(0, v.index).split("\n").length, msg: v.msg });
    }
  }
  return findings;
}

const reg = (files, sources, type = "registry:block") => ({
  files: {
    [REGISTRY]: JSON.stringify({ items: [{ name: "stat-cards-01", type, files }] }),
    ...sources,
  },
});
const B = "registry/blocks/stat-cards-01";

export default {
  id: "registry-resolve",
  scope: "registry",
  doc: "Every relative import in a registry item resolves both at its repo `path` and at its install `target` layout; keep `target` folders mirroring the repo tree.",
  baseline: "none",
  run: checkRegistryResolve,
  fixtures: {
    pass: [
      // data/ nested under components/ in both trees
      reg(
        [
          { path: `${B}/components/spark.tsx`, target: "components/stat-cards-01/spark.tsx" },
          {
            path: `${B}/components/data/series.ts`,
            target: "components/stat-cards-01/data/series.ts",
          },
        ],
        {
          [`${B}/components/spark.tsx`]: 'import { x } from "./data/series";',
          [`${B}/components/data/series.ts`]: "export const x = 1;",
        },
      ),
      // ../data siblings with a mirroring target; extensionless; dynamic import + require
      reg(
        [
          { path: `${B}/components/widget.tsx`, target: "components/x/components/widget.tsx" },
          { path: `${B}/data/series.ts`, target: "components/x/data/series.ts" },
        ],
        {
          [`${B}/components/widget.tsx`]:
            'import { s } from "../data/series";\nconst m = await import("../data/series");\nimport { cn } from "@/lib/utils";',
          [`${B}/data/series.ts`]: "export const s = 1;",
        },
      ),
      // theme items and empty items are skipped
      reg(
        [{ path: `${B}/theme.tsx`, target: "x/theme.tsx" }],
        { [`${B}/theme.tsx`]: 'import "./nope";' },
        "registry:theme",
      ),
      reg([], {}),
    ],
    fail: [
      // the round-2 defect: ./data/x at repo AND install side
      reg(
        [
          { path: `${B}/components/spark.tsx`, target: "components/stat-cards-01/spark.tsx" },
          { path: `${B}/data/series.ts`, target: "data/stat-cards-01/series.ts" },
        ],
        {
          [`${B}/components/spark.tsx`]: 'import { x } from "./data/series";',
          [`${B}/data/series.ts`]: "export const x = 1;",
        },
      ),
      // resolves in the repo, not at the target
      reg(
        [
          { path: `${B}/components/widget.tsx`, target: "components/x/widget.tsx" },
          { path: `${B}/data/series.ts`, target: "data/x/series.ts" },
        ],
        {
          [`${B}/components/widget.tsx`]: 'const n = require("../data/series");',
          [`${B}/data/series.ts`]: "export const s = 1;",
        },
      ),
    ],
  },
};
