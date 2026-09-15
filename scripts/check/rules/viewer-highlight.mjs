/**
 * viewer-highlight — `capabilities.highlight` is a promise the adapter keeps (ADR 0025).
 * Ported from scripts/check-viewer-highlight-coverage.mjs.
 *
 * Per adapter under packages/viewer/src/adapters/<id>/ (a `*-manifest.ts` + `*-adapter.ts(x)`):
 *   (a) every declared kind is in DOCUMENT_ADDRESS_KINDS (read from ui, never copied),
 *       no duplicates, no empty array, and `quote` implies `capabilities.text: true`;
 *   (b) the adapter reads the `highlights` prop, and `rects` when it declares `rect`;
 *   (c) an adapter that reads `highlights` declares something;
 *   (d) its `*-adapter.test.tsx` builds a `kind: "<kind>"` address per declared kind
 *       (`range` also covers `quote`) and asserts on something painted.
 * It proves the wiring exists, not that the marks land on the right characters.
 */

export const ADAPTERS_DIR = "packages/viewer/src/adapters";
export const ADDRESS_MODULE = "packages/ui/src/lib/document-address.ts";

/** Strip comments so a kind named in prose is never evidence. */
export const stripComments = (src) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");

export function parseAddressKinds(src) {
  const m = stripComments(src).match(/DOCUMENT_ADDRESS_KINDS\s*=\s*\[([\s\S]*?)\]/);
  return m ? [...m[1].matchAll(/["']([a-z-]+)["']/g)].map((k) => k[1]) : [];
}

/** Body of the balanced `{…}` after `<key>:` (counted, so nested objects never truncate it). */
export function balancedBlockAfter(code, key) {
  const at = code.search(new RegExp(`\\b${key}\\s*:\\s*\\{`));
  if (at === -1) return "";
  const open = code.indexOf("{", at);
  let depth = 0;
  for (let i = open; i < code.length; i += 1) {
    if (code[i] === "{") depth += 1;
    else if (code[i] === "}" && --depth === 0) return code.slice(open + 1, i);
  }
  return "";
}

export function parseCapabilities(src) {
  const body = balancedBlockAfter(stripComments(src), "capabilities");
  const highlight = body.match(/highlight\s*:\s*\[([\s\S]*?)\]/);
  return {
    text: /\btext\s*:\s*true\b/.test(body),
    highlight: highlight ? [...highlight[1].matchAll(/["']([a-z-]+)["']/g)].map((k) => k[1]) : null,
  };
}

const readsHighlights = (src) => /\bhighlights\b/.test(stripComments(src));
const readsRects = (src) => /\brects\b/.test(stripComments(src));
const assertsOnPaint = (code) =>
  /querySelectorAll\(\s*["'`]\s*mark/.test(code) ||
  /querySelector\(\s*["'`]\s*mark/.test(code) ||
  /(?:getAllByRole|getByRole|queryAllByRole)\(\s*["']mark["']/.test(code) ||
  /match-highlight-mark|highlight-rect|highlight-block/.test(code);
const buildsAddress = (code, kind) => new RegExp(`kind\\s*:\\s*["']${kind}["']`).test(code);
const list = (kinds) => kinds.map((k) => `"${k}"`).join(", ");

/** Rungs (a)–(d) for one adapter → problem strings. */
export function checkAdapter({ manifestSrc, adapterSrc, testSrc, validKinds }) {
  const problems = [];
  const { text, highlight } = parseCapabilities(manifestSrc);
  if (highlight === null) {
    if (readsHighlights(adapterSrc))
      problems.push(
        "the renderer reads the `highlights` prop but the manifest declares no `capabilities.highlight`",
      );
    return problems;
  }
  if (highlight.length === 0)
    return ["`capabilities.highlight` is an empty array — omit the key instead"];
  for (const kind of highlight)
    if (!validKinds.includes(kind))
      problems.push(
        `declares "${kind}", which is not one of ${list(validKinds)} (DOCUMENT_ADDRESS_KINDS)`,
      );
  const seen = new Set();
  for (const kind of highlight) {
    if (seen.has(kind)) problems.push(`declares "${kind}" twice`);
    seen.add(kind);
  }
  if (highlight.includes("quote") && !text)
    problems.push(
      'declares "quote" without `capabilities.text: true` — a quote is located by the provider against `AdapterDocument.text`',
    );
  if (!readsHighlights(adapterSrc))
    problems.push(
      `declares ${list(highlight)} but the adapter never reads the \`highlights\` renderer prop`,
    );
  if (highlight.includes("rect") && !readsRects(adapterSrc))
    problems.push('declares "rect" but the adapter never reads a rect address\'s `rects`');
  if (testSrc === null) {
    problems.push(
      `declares ${list(highlight)} but has no \`*-adapter.test.tsx\` to prove any of it`,
    );
    return problems;
  }
  const code = stripComments(testSrc);
  if (!assertsOnPaint(code))
    problems.push(
      "its test never asserts on a painted highlight (a `mark` query, `match-highlight-mark`, `highlight-rect` or `highlight-block`)",
    );
  for (const kind of highlight)
    if (!buildsAddress(code, kind) && !(kind === "quote" && buildsAddress(code, "range")))
      problems.push(`declares "${kind}" but no test builds a \`kind: "${kind}"\` address`);
  return problems;
}

// ── fixtures ─────────────────────────────────────────────────────────────────
const MANIFEST = `export const textManifest = {
  id: "text",
  capabilities: { text: true, search: true, highlight: ["quote", "range"] },
};`;
const ADAPTER = `function Renderer({ document: doc, highlights }) {
  const { ranges } = toMarkRanges(highlights, doc.text.length);
  return <MatchHighlight text={doc.text} ranges={ranges} />;
}`;
const TEST = `const cite = (id, r) => ({ id, address: { kind: "range", start: r[0], end: r[1] } });
it("marks a located range", () => {
  const { container } = render(<Renderer document={doc} highlights={[cite("a", [4, 9])]} />);
  expect(container.querySelectorAll("mark")).toHaveLength(1);
});`;
const fx = ({
  manifestSrc = MANIFEST,
  adapterSrc = ADAPTER,
  testSrc = TEST,
  kinds = true,
} = {}) => ({
  files: {
    ...(kinds
      ? {
          [ADDRESS_MODULE]:
            'export const DOCUMENT_ADDRESS_KINDS = ["quote", "range", "rect"] as const;',
        }
      : {}),
    [`${ADAPTERS_DIR}/text/text-manifest.ts`]: manifestSrc,
    [`${ADAPTERS_DIR}/text/text-adapter.tsx`]: adapterSrc,
    ...(testSrc === null ? {} : { [`${ADAPTERS_DIR}/text/text-adapter.test.tsx`]: testSrc }),
  },
});

export default {
  id: "viewer-highlight",
  scope: "packages",
  doc: "A viewer adapter's `capabilities.highlight` lists only real address kinds, its renderer reads `highlights` (and `rects` for `rect`), and its `*-adapter.test.tsx` builds and paints each declared kind.",
  baseline: "none",
  run(ctx) {
    const validKinds = ctx.exists(ADDRESS_MODULE)
      ? parseAddressKinds(ctx.readFile(ADDRESS_MODULE))
      : [];
    if (validKinds.length === 0)
      return [{ file: ADDRESS_MODULE, line: 1, msg: "could not read DOCUMENT_ADDRESS_KINDS" }];
    const byDir = new Map();
    for (const f of ctx.glob(`${ADAPTERS_DIR}/*/*`)) {
      const [id, name] = f.slice(ADAPTERS_DIR.length + 1).split("/");
      byDir.set(id, [...(byDir.get(id) ?? []), name]);
    }
    const out = [];
    for (const [id, names] of [...byDir].sort(([a], [b]) => a.localeCompare(b))) {
      const first = (suffixes) => {
        const n = [...names].sort().find((x) => suffixes.some((s) => x.endsWith(s)));
        return n ? `${ADAPTERS_DIR}/${id}/${n}` : null;
      };
      const manifest = first(["-manifest.ts"]);
      const adapter = first(["-adapter.tsx", "-adapter.ts"]);
      if (!manifest || !adapter) continue;
      const test = first(["-adapter.test.tsx", "-adapter.test.ts"]);
      for (const p of checkAdapter({
        manifestSrc: ctx.readFile(manifest),
        adapterSrc: ctx.readFile(adapter),
        testSrc: test ? ctx.readFile(test) : null,
        validKinds,
      }))
        out.push({ file: manifest, line: 1, msg: `${id}: ${p}` });
    }
    return out;
  },
  fixtures: {
    pass: [
      fx(),
      fx({
        manifestSrc: "capabilities: { text: true }",
        adapterSrc: "function Renderer({ document: doc }) { return <pre>{doc.text}</pre>; }",
        testSrc: 'it("renders", () => {});',
      }),
      fx({
        manifestSrc: 'capabilities: { text: true, highlight: ["rect"] }',
        adapterSrc:
          "function Renderer({ highlights }) { return highlights.map((h) => h.address.rects); }",
        testSrc: `it("boxes", () => { render(<R highlights={[{ address: { kind: "rect", rects: [] } }]} />);
          expect(container.querySelectorAll('[data-slot="highlight-rect"]')).toHaveLength(1); });`,
      }),
      fx({
        adapterSrc: "function Renderer({ highlights }) { return highlights.length; }",
        testSrc: `it("plates", () => { render(<R highlights={[{ address: { kind: "range", start: 0, end: 4 } }]} />);
          expect(container.querySelector('[data-slot="highlight-block"]')).not.toBeNull(); });`,
      }),
      fx({
        manifestSrc:
          'capabilities: {\n  text: true,\n  limits: { pages: 50 },\n  highlight: ["quote", "range"],\n}',
      }),
    ],
    fail: [
      fx({ manifestSrc: 'capabilities: { text: true, highlight: ["quote", "cell"] }' }),
      fx({ manifestSrc: 'capabilities: { text: true, highlight: ["range", "range"] }' }),
      fx({ manifestSrc: 'capabilities: { search: true, highlight: ["quote"] }' }),
      fx({ manifestSrc: "capabilities: { text: true, highlight: [] }" }),
      fx({ adapterSrc: "function Renderer({ document: doc }) { return <pre>{doc.text}</pre>; }" }),
      fx({
        manifestSrc: 'capabilities: { text: true, highlight: ["range", "rect"] }',
        testSrc: `${TEST}\nit("geometry", () => { const a = { kind: "rect", page: 1 }; });`,
      }),
      fx({ manifestSrc: "capabilities: { text: true }" }),
      fx({
        manifestSrc: 'capabilities: { text: true, highlight: ["range", "rect"] }',
        adapterSrc: `${ADAPTER}\nconst boxes = address.rects;`,
      }),
      fx({
        manifestSrc: 'capabilities: { text: true, highlight: ["quote"] }',
        testSrc: 'it("does nothing", () => {});',
      }),
      fx({
        testSrc: `it("passes", () => { render(<R highlights={[{ address: { kind: "range", start: 0, end: 1 } }]} />); });`,
      }),
      fx({ testSrc: null }),
      // comments are never evidence
      fx({
        manifestSrc: 'capabilities: { text: true, highlight: ["rect"] }',
        adapterSrc: "// reads the rects one day\nfunction Renderer({ highlights }) {}",
        testSrc: `/* kind: "rect" is coming */\n${TEST}`,
      }),
      fx({ kinds: false }),
    ],
  },
};
