/**
 * header-band — every header band takes the ONE shared height, `h-header`.
 *
 * An app shell puts several header bands side by side: the nav rail's top, the
 * content column's top bar, a SideDock / ContextRail / ContextPanel / list
 * column header. Their bottom rules must sit on one line in every theme, and a
 * theme retunes `--header-size` (Qlik: 48px). So a band sized any other way —
 * `h-14`, `h-12`, or padding that grows with its content — misaligns: measured
 * 2026-09-17, a padded SideDock header was 73px beside a 56px top bar, and every
 * `h-14` top bar stood 8px taller than the Qlik rail header beside it.
 *
 * Detected: a JSX opening tag that is a header band — a `<header>` element, or
 * any tag whose `data-slot` ends in `-header` / `top-bar` — and carries a
 * `border-b` (the band's bottom rule, which is what has to line up). It must
 * name `h-header`. Card/dialog/sheet headers carry no `border-b` and are exempt;
 * a band that genuinely is not shell chrome opts out with
 * `// header-band-exempt: <reason>` on the line above the tag.
 */
import { lineOf } from "../context.mjs";

const IGNORE = [
  "**/*.test.{ts,tsx}",
  "**/{node_modules,dist,storybook-static,.turbo,coverage,__output}/**",
];

const TAG_START_RE = /<([A-Za-z][\w.]*)\b/g;
const SLOT_RE = /data-slot=["'{`]+[^"'`}]*(?:-header|top-bar)["'`}]/;

/** The source text of the opening tag starting at `start`, brace-aware. */
function openingTag(text, start) {
  let depth = 0;
  let quote = null;
  for (let i = start + 1; i < text.length; i++) {
    const ch = text[i];
    if (quote) {
      if (ch === quote && text[i - 1] !== "\\") quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") quote = ch;
    else if (ch === "{") depth++;
    else if (ch === "}") depth--;
    else if (ch === ">" && depth === 0) return text.slice(start, i + 1);
  }
  return text.slice(start);
}

export function headerBandViolations(text) {
  const out = [];
  for (const m of text.matchAll(TAG_START_RE)) {
    const tag = openingTag(text, m.index);
    const isBand = m[1] === "header" || SLOT_RE.test(tag);
    if (!isBand || !/(?:^|[\s"'`:])border-b(?![\w-])/.test(tag)) continue;
    if (/(?:^|[\s"'`:])h-header(?![\w-])/.test(tag)) continue;
    const before = text.slice(Math.max(0, text.lastIndexOf("\n", m.index - 2) - 200), m.index);
    if (/header-band-exempt:/.test(before.split("\n").slice(-2).join("\n"))) continue;
    out.push({ index: m.index, tag: m[1] });
  }
  return out;
}

export default {
  id: "header-band",
  scope: "components",
  doc: "Size every header band (`<header>`, or a `data-slot` ending `-header`/`top-bar`, with a `border-b`) with `h-header`, never `h-14`/`h-12` or padding, so side-by-side shell headers share one bottom line in every theme; opt out with `// header-band-exempt: <reason>`.",
  baseline: "none",
  run(ctx) {
    const findings = [];
    for (const file of ctx.glob(
      ["packages/*/src/**/*.tsx", "registry/**/*.tsx", "apps/docs/stories/**/*.tsx"],
      { ignore: IGNORE },
    )) {
      const text = ctx.readFile(file);
      for (const v of headerBandViolations(text)) {
        findings.push({
          file,
          line: lineOf(text, v.index),
          msg: `header band <${v.tag}> with a bottom rule is not sized by \`h-header\` — it will not line up with the shell's other headers in every theme`,
        });
      }
    }
    return findings;
  },
  fixtures: {
    pass: [
      { files: { "packages/ui/src/x.tsx": '<header className="flex h-header border-b px-3" />' } },
      {
        files: {
          "packages/ui/src/x.tsx":
            '<div data-slot="side-dock-header" className={cn("flex h-header items-center border-b", a)} />',
        },
      },
      { files: { "packages/ui/src/x.tsx": '<div data-slot="card-header" className="p-6" />' } },
      { files: { "packages/ui/src/x.test.tsx": '<header className="h-14 border-b" />' } },
      {
        files: {
          "packages/ui/src/x.tsx":
            '// header-band-exempt: a page section, not shell chrome\n<header className="border-b p-4" />',
        },
      },
    ],
    fail: [
      { files: { "packages/ui/src/x.tsx": '<header className="flex h-14 border-b px-3" />' } },
      {
        files: {
          "registry/blocks/a/a.tsx":
            '<div data-slot="side-dock-header" className="flex items-start border-b px-4 py-3" />',
        },
      },
      {
        files: {
          "apps/docs/stories/a.stories.tsx":
            '<SheetHeader data-slot="dock-header" className={cn("h-12", "border-b")}>',
        },
      },
    ],
  },
};
