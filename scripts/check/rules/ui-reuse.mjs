/**
 * ui-reuse — no layer-2 package re-declares a `@elabs-ai/components-ui` component name (ADR 0041).
 *
 * A shared need moves DOWN into ui (ADR 0012, 0024 §5a, 0034); a sibling that declares its own
 * `Image`, `Card`, `Slider`… forks the primitive. Generalises `charts-reuse`'s collision arm to
 * every layer-2 package (ai, data, flow, maps, charts, marketing, editor, viewer, terminal).
 *
 *   collision — a LOCAL runtime declaration (`export function|const|let|var|class`,
 *               `export default function`, `export default X` with a local decl) whose name is
 *               a ui component (brand-ui.manifest.json). Type-only exports, imports and
 *               pass-through re-exports (`export { GeneratedImage as Image } from …`) never flag —
 *               the specifier form is the deprecation-alias precedent (ADR 0024 §5a).
 * Per-line escape hatch: `// ui-reuse-exempt: <reason>` (reason required).
 * Scope: packages/<layer-2>/src, not tests/stories/__contract__.
 */
import { lineOf } from "../context.mjs";
import { MANIFEST, localDeclarations, manifestComponentNames } from "./charts-reuse.mjs";

export const LAYER_2_DIRS = [
  "ai",
  "data",
  "flow",
  "maps",
  "charts",
  "marketing",
  "editor",
  "viewer",
  "terminal",
];
const EXEMPT_RE = /\/\/\s*ui-reuse-exempt:\s*\S/;

/** Strip comments but keep every newline so indexes still map to source lines. */
export const stripCommentsKeepLines = (src) =>
  src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ""))
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");

/** Violations in one source string → `[{ name, line }]`, sorted by line. */
export function findUiReuseViolations(src, uiNames) {
  const exempt = new Set();
  src.split("\n").forEach((l, i) => EXEMPT_RE.test(l) && exempt.add(i + 1));
  const code = stripCommentsKeepLines(src);
  const seen = new Set();
  const out = [];
  for (const d of localDeclarations(code, uiNames)) {
    const line = lineOf(code, d.index);
    const key = `${d.name}::${line}`;
    if (exempt.has(line) || seen.has(key)) continue;
    seen.add(key);
    out.push({ name: d.name, line });
  }
  return out.sort((a, b) => a.line - b.line);
}

// ── fixtures ─────────────────────────────────────────────────────────────────
const UI = ["Card", "Button", "Image", "Slider", "Tooltip", "FilterChip"];
const manifest = JSON.stringify({
  packages: { "@elabs-ai/components-ui": { components: UI.map((name) => ({ name })) } },
});
const src = (body, file = "packages/ai/src/x.tsx") => ({
  files: { [MANIFEST]: manifest, [file]: body },
});

export default {
  id: "ui-reuse",
  scope: "packages",
  doc: "A layer-2 package (ai, data, flow, maps, charts, marketing, editor, viewer, terminal) never declares a runtime export named like a `@elabs-ai/components-ui` component — import it or use a package-scoped name; a pass-through alias (`export { X as Y } from …`) is fine; exempt one line with `// ui-reuse-exempt: <reason>`.",
  baseline: "keys",
  run(ctx) {
    let uiNames;
    try {
      uiNames = manifestComponentNames(ctx, ["@elabs-ai/components-ui"]);
    } catch (err) {
      return [{ file: MANIFEST, line: 1, msg: err.message }];
    }
    const out = [];
    for (const dir of LAYER_2_DIRS)
      for (const file of ctx.glob(`packages/${dir}/src/**/*.{ts,tsx}`, {
        ignore: [
          "**/*.test.{ts,tsx}",
          "**/*.stories.tsx",
          "**/__contract__/**",
          "**/{node_modules,dist}/**",
        ],
      }))
        for (const v of findUiReuseViolations(ctx.readFile(file), uiNames))
          out.push({
            file,
            line: v.line,
            key: `@elabs-ai/components-${dir}::${v.name}`,
            msg: `declares "${v.name}", which @elabs-ai/components-ui already exports — import it (or compose it under a package-scoped name)`,
          });
    return out;
  },
  fixtures: {
    pass: [
      src(
        'import { Card, Image } from "@elabs-ai/components-ui";\nexport const Gallery = () => <Image alt="" />;',
      ),
      src(
        '/** @deprecated Use GeneratedImage */\nexport { GeneratedImage as Image, type GeneratedImageProps as ImageProps } from "./generated-image";',
      ),
      src("export function GeneratedImage() { return null; }"),
      src("export interface ImageProps { alt: string; }\nexport type CardProps = { x?: 1 };"),
      src('import { Image as ImageIcon } from "lucide-react";'),
      src("export function Card() { return null; }", "packages/ui/src/components/card/card.tsx"),
      src("export function Card() { return null; }", "packages/process/src/x.tsx"),
      src("export function Card() { return null; }", "packages/ai/src/x.test.tsx"),
      src("export function Card() { return null; }", "packages/ai/src/x.stories.tsx"),
      src(
        "export function Card() { return null; }",
        "packages/ai/src/__contract__/x.contract.test.tsx",
      ),
      src(
        "export const Slider = () => null; // ui-reuse-exempt: wraps a canvas range, not the form control",
      ),
      src("/* Image */\n/* two\nlines */\nexport const Thing = 1;"),
      {
        files: {
          [MANIFEST]: manifest,
          "packages/data/src/filter-bar/filter-chip.tsx":
            "export function FilterChip() { return null; }",
        },
        baseline: ["@elabs-ai/components-data::FilterChip"],
      },
    ],
    fail: [
      src("export const Image = () => <img />;"),
      src("export function Card() { return null; }", "packages/viewer/src/x.tsx"),
      src("export class Button {}", "packages/editor/src/x.ts"),
      src("export default function Tooltip() { return null; }", "packages/flow/src/x.tsx"),
      src(
        "function Slider() { return null; }\nexport default Slider;\n",
        "packages/maps/src/x.tsx",
      ),
      src("export const Slider = () => null; // ui-reuse-exempt:"),
      { files: { "packages/ai/src/x.tsx": "export const A = 1;" } }, // no manifest → throws
    ],
  },
};
