/**
 * microcopy — hardcoded user-visible English is a ratchet (ADR 0014/0017).
 * Ported from scripts/check-microcopy.mjs.
 *
 * Counts, per file in `packages/*\/src/**\/*.tsx` (not tests/specs/stories):
 * `aria-label="…"`, `placeholder="…"`, `title="…"`, prose-shaped string literals
 * inside those attributes' `{…}` expressions (after dropping `t("key")` calls), and
 * capitalized JSX text nodes. A line carrying `// i18n-exempt: <reason>` is skipped.
 */

/** Opt-out marker for a genuinely untranslatable string. */
const EXEMPT = /\/\/\s*i18n-exempt\b/;

export const MICROCOPY_IGNORE = ["**/*.{test,spec,stories}.tsx", "**/{node_modules,dist}/**"];

/** Hardcoded microcopy in a source file → `[{ line, kind, text }]`. */
export function findHardcodedMicrocopy(source) {
  const out = [];
  source.split("\n").forEach((line, i) => {
    if (EXEMPT.test(line)) return;
    for (const [kind, re] of [
      ["aria-label", /\baria-label="([^"]+)"/g],
      ["placeholder", /\bplaceholder="([^"]+)"/g],
      ["title", /\btitle="([^"]+)"/g],
    ]) {
      for (const m of line.matchAll(re)) out.push({ line: i + 1, kind, text: m[1] });
    }
    // A literal inside a JSX expression container: aria-label={x ? "Stop" : "Submit"}.
    for (const m of line.matchAll(/\b(aria-label|placeholder|title)=\{([^}]*)\}/g)) {
      const expr = m[2].replace(/\bt\(\s*(["'])[^"']*\1\s*(?:,[^)]*)?\)/g, "");
      for (const lit of expr.matchAll(/"([A-Z][^"]*[a-z][^"]*)"|'([A-Z][^']*[a-z][^']*)'/g)) {
        const text = (lit[1] ?? lit[2] ?? "").trim();
        if (text.length >= 2) out.push({ line: i + 1, kind: `${m[1]}-expr`, text });
      }
    }
    for (const m of line.matchAll(/>([A-Z][^<>{}\n]*[a-z][^<>{}\n]*)</g)) {
      const text = m[1].trim();
      if (text.length >= 2) out.push({ line: i + 1, kind: "jsx-text", text });
    }
  });
  return out;
}

const src = (body, file = "packages/ai/src/x.tsx") => ({ files: { [file]: body } });

export default {
  id: "microcopy",
  scope: "components",
  doc: "Route user-visible strings (`aria-label`, `placeholder`, `title`, JSX text) through the locale seam `t()` (ADR 0017); a genuinely untranslatable string carries `// i18n-exempt: <reason>`.",
  baseline: "per-file",
  run(ctx) {
    const out = [];
    for (const file of ctx.glob("packages/*/src/**/*.tsx", { ignore: MICROCOPY_IGNORE }))
      for (const h of findHardcodedMicrocopy(ctx.readFile(file)))
        out.push({ file, line: h.line, msg: `hardcoded ${h.kind} "${h.text}" — use t()` });
    return out;
  },
  fixtures: {
    pass: [
      src('<button aria-label={t("ai.message.nextBranch")} />'),
      src("<span>{label}</span>"),
      src("<span>API</span>"),
      src("<span>ChatGPT</span> // i18n-exempt: brand name"),
      src("<code>npm install</code>"),
      src('<Foo type={"string"} title={t("a.b", { n })} />'),
      src("<span>No results found</span>", "packages/ai/src/x.stories.tsx"),
      src("<span>No results found</span>", "packages/ai/src/x.test.tsx"),
      src("<span>No results found</span>", "packages/ai/other/x.tsx"),
    ],
    fail: [
      src('<button aria-label="Next branch" />'),
      src('<input placeholder="Search…" title="Search" />'),
      src("<span>No results found</span>"),
      src('<button aria-label={isGenerating ? "Stop" : "Submit"} />'),
    ],
  },
};
