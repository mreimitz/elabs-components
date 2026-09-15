/**
 * microtypography-ellipsis — "…" not "..." in user-visible copy (#70).
 * Ported from scripts/check-microtypography.mjs (ellipsis half: hard, no baseline;
 * the apostrophe half is `microtypography-apostrophe`).
 *
 * Scans only JSX attribute values (`aria-label`/`placeholder`/`title`/`description`,
 * literal and `{…}`-expression forms) and JSX text nodes, in `packages/*\/src/**\/*.tsx`
 * INCLUDING stories (exemplar screens are copy), excluding tests/specs. A comment line
 * is skipped; a line carrying `// microtypography-exempt: <reason>` is skipped.
 */

const EXEMPT = /\/\/\s*microtypography-exempt\b/;
const ATTR_KEYS = ["aria-label", "placeholder", "title", "description"];
const ATTR_RE = new RegExp(`\\b(?:${ATTR_KEYS.join("|")})="([^"]*)"`, "g");
const ATTR_EXPR_RE = new RegExp(`\\b(?:${ATTR_KEYS.join("|")})=\\{([^}]*)\\}`, "g");
const STRING_LITERAL_RE = /"([^"]*)"|'([^']*)'/g;
const JSX_TEXT_RE = />([^<>{}\n]*)</g;
const ELLIPSIS_RE = /\.\.\./;
const STRAIGHT_APOSTROPHE_RE = /\w'\w/;

export const MICROTYPOGRAPHY_GLOB = "packages/*/src/**/*.tsx";
export const MICROTYPOGRAPHY_IGNORE = ["**/*.{test,spec}.tsx", "**/{node_modules,dist}/**"];

function extractStrings(line) {
  const texts = [];
  for (const m of line.matchAll(ATTR_RE)) texts.push(m[1]);
  for (const m of line.matchAll(ATTR_EXPR_RE))
    for (const lit of m[1].matchAll(STRING_LITERAL_RE)) {
      const text = lit[1] ?? lit[2] ?? "";
      if (text) texts.push(text);
    }
  for (const m of line.matchAll(JSX_TEXT_RE)) {
    const text = m[1].trim();
    if (text) texts.push(text);
  }
  return texts;
}

/** Violations in a source file → `[{ line, kind: "ellipsis" | "apostrophe", text }]`. */
export function findMicrotypography(source) {
  const out = [];
  source.split("\n").forEach((line, i) => {
    if (EXEMPT.test(line) || /^\s*(\*|\/\/)/.test(line)) return;
    for (const text of extractStrings(line)) {
      if (ELLIPSIS_RE.test(text)) out.push({ line: i + 1, kind: "ellipsis", text });
      if (STRAIGHT_APOSTROPHE_RE.test(text)) out.push({ line: i + 1, kind: "apostrophe", text });
    }
  });
  return out;
}

/** Findings of one kind across the scanned tree. */
export function scanMicrotypography(ctx, kind, msg) {
  const out = [];
  for (const file of ctx.glob(MICROTYPOGRAPHY_GLOB, { ignore: MICROTYPOGRAPHY_IGNORE }))
    for (const h of findMicrotypography(ctx.readFile(file)))
      if (h.kind === kind) out.push({ file, line: h.line, msg: `${msg}: "${h.text}"` });
  return out;
}

const src = (body, file = "packages/fixture-pkg/src/widget.tsx") => ({ files: { [file]: body } });

export default {
  id: "microtypography-ellipsis",
  scope: "components",
  doc: 'Write "…" (U+2026), never "...", in JSX text and `aria-label`/`placeholder`/`title`/`description` values, stories included; a genuine code sample carries `// microtypography-exempt: <reason>`.',
  baseline: "none",
  run: (ctx) => scanMicrotypography(ctx, "ellipsis", 'literal "..." — use "…"'),
  fixtures: {
    pass: [
      src('<input placeholder="Search…" title="Couldn’t load" />'),
      src("<span>{'{...props}'}</span> // microtypography-exempt: code sample"),
      src(" * nests as `<defs>...<defs>` when placed inside a chart."),
      src("<Foo {...props} />"),
      src('import { Foo } from "../foo/index";'),
      src('<input placeholder="Search..." />', "packages/fixture-pkg/src/widget.test.tsx"),
    ],
    fail: [
      src('<input placeholder="Search..." />'),
      src('<button aria-label="Loading..." />'),
      src("<span>Thinking...</span>"),
      src('<span title={isLoading ? "Loading..." : "Ready"} />'),
      src("<span>Thinking...</span>", "packages/fixture-pkg/src/widget.stories.tsx"),
    ],
  },
};
