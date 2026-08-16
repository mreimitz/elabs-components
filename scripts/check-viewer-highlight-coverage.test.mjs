/**
 * check-viewer-highlight-coverage.test.mjs — locks the ADR 0025 capability gate.
 * Run in CI: `node --test scripts/check-viewer-highlight-coverage.test.mjs`.
 *
 * Fixtures are INLINE strings (hermetic — never real files), per the repo's
 * "a gate ships with its self-test" convention. A gate that can silently stop
 * firing is worse than no gate, so every rung is planted broken here.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import {
  checkAdapter,
  parseAddressKinds,
  parseCapabilities,
  readsHighlights,
  readsRects,
  stripComments,
} from "./check-viewer-highlight-coverage.mjs";

const REPO_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const KINDS = ["quote", "range", "rect"];

const MANIFEST = `export const textManifest = {
  id: "text",
  capabilities: { text: true, search: true, highlight: ["quote", "range"] },
};`;

const ADAPTER = `function Renderer({ document: doc, highlights, activeHighlightId }) {
  const { ranges, activeIndex } = toMarkRanges(highlights, doc.text.length);
  return <MatchHighlight text={doc.text} ranges={ranges} activeIndex={activeIndex} />;
}`;

const TEST = `const cite = (id, range) => ({ id, address: { kind: "range", start: range[0], end: range[1] } });
it("marks a located range", () => {
  const { container } = render(<Renderer document={doc} highlights={[cite("a", [4, 9])]} />);
  expect(container.querySelectorAll("mark")).toHaveLength(1);
});`;

const good = (over = {}) => ({
  id: "text",
  manifestSrc: MANIFEST,
  adapterSrc: ADAPTER,
  testSrc: TEST,
  validKinds: KINDS,
  ...over,
});

// ── the happy shape ──────────────────────────────────────────────────────────

test("a conforming adapter reports nothing", () => {
  assert.deepEqual(checkAdapter(good()), []);
});

test("an adapter that declares nothing and paints nothing is fine", () => {
  assert.deepEqual(
    checkAdapter(
      good({
        manifestSrc: `capabilities: { text: true }`,
        adapterSrc: `function Renderer({ document: doc }) { return <pre>{doc.text}</pre>; }`,
        testSrc: `it("renders", () => {});`,
      }),
    ),
    [],
  );
});

// ── (a) declaration validity ─────────────────────────────────────────────────

test("(a) an invented address kind fails", () => {
  const problems = checkAdapter(
    good({ manifestSrc: `capabilities: { text: true, highlight: ["quote", "cell"] }` }),
  );
  assert.ok(
    problems.some((p) => p.includes('"cell"')),
    problems.join("\n"),
  );
});

test("(a) a duplicate kind fails", () => {
  const problems = checkAdapter(
    good({ manifestSrc: `capabilities: { text: true, highlight: ["range", "range"] }` }),
  );
  assert.ok(
    problems.some((p) => p.includes("twice")),
    problems.join("\n"),
  );
});

test('(a) "quote" without `text: true` fails — the provider has nothing to locate in', () => {
  const problems = checkAdapter(
    good({ manifestSrc: `capabilities: { search: true, highlight: ["quote"] }` }),
  );
  assert.ok(
    problems.some((p) => p.includes("located by the provider")),
    problems.join("\n"),
  );
});

test("(a) an empty highlight array fails — omit the key instead", () => {
  const problems = checkAdapter(
    good({ manifestSrc: `capabilities: { text: true, highlight: [] }` }),
  );
  assert.equal(problems.length, 1);
  assert.match(problems[0], /empty array/);
});

// ── (b) the renderer keeps the promise ───────────────────────────────────────

test("(b) a manifest claiming kinds while the renderer ignores the prop fails", () => {
  const problems = checkAdapter(
    good({ adapterSrc: `function Renderer({ document: doc }) { return <pre>{doc.text}</pre>; }` }),
  );
  assert.ok(
    problems.some((p) => p.includes("never reads the `highlights` renderer prop")),
    problems.join("\n"),
  );
});

test('(b) "rect" declared while the renderer never reads `rects` fails', () => {
  const problems = checkAdapter(
    good({
      manifestSrc: `capabilities: { text: true, highlight: ["range", "rect"] }`,
      testSrc: `${TEST}\nit("paints geometry", () => { const a = { kind: "rect", page: 1 }; });`,
    }),
  );
  assert.ok(
    problems.some((p) => p.includes("never reads a rect address")),
    problems.join("\n"),
  );
});

// ── (c) the converse ─────────────────────────────────────────────────────────

test("(c) painting code with no declaration fails — a capability cannot vanish quietly", () => {
  const problems = checkAdapter(good({ manifestSrc: `capabilities: { text: true }` }));
  assert.equal(problems.length, 1);
  assert.match(problems[0], /declares no `capabilities.highlight`/);
});

// ── (d) a test covers each kind ──────────────────────────────────────────────

test("(d) a declared kind no test builds fails", () => {
  const problems = checkAdapter(
    good({
      manifestSrc: `capabilities: { text: true, highlight: ["range", "rect"] }`,
      adapterSrc: `${ADAPTER}\nconst boxes = address.rects;`,
    }),
  );
  assert.ok(
    problems.some((p) => p.includes('no test builds a `kind: "rect"` address')),
    problems.join("\n"),
  );
});

test('(d) "quote" is satisfied by a `range` case — the provider resolves it before the renderer', () => {
  assert.deepEqual(checkAdapter(good()), []);
  const problems = checkAdapter(
    good({
      manifestSrc: `capabilities: { text: true, highlight: ["quote"] }`,
      testSrc: `it("does nothing with highlights", () => {});`,
    }),
  );
  assert.ok(
    problems.some((p) => p.includes('no test builds a `kind: "quote"` address')),
    problems.join("\n"),
  );
});

test("(d) a test that builds addresses but never asserts on a painted mark fails", () => {
  const problems = checkAdapter(
    good({
      testSrc: `it("passes highlights", () => {
        render(<Renderer document={doc} highlights={[{ address: { kind: "range", start: 0, end: 1 } }]} />);
        expect(true).toBe(true);
      });`,
    }),
  );
  assert.equal(problems.length, 1);
  assert.match(problems[0], /never asserts on a painted highlight/);
});

test("(d) a missing adapter test file fails", () => {
  const problems = checkAdapter(good({ testSrc: null }));
  assert.equal(problems.length, 1);
  assert.match(problems[0], /no\n?\s*`\*-adapter\.test\.tsx`/);
});

test("(d) an overlay-only adapter is covered by the `highlight-rect` slot", () => {
  assert.deepEqual(
    checkAdapter(
      good({
        manifestSrc: `capabilities: { text: true, highlight: ["rect"] }`,
        adapterSrc: `function Renderer({ highlights }) { return highlights.map((h) => h.address.rects); }`,
        testSrc: `it("draws boxes", () => {
          render(<Renderer highlights={[{ address: { kind: "rect", page: 1, rects: [] } }]} />);
          expect(container.querySelectorAll('[data-slot="highlight-rect"]')).toHaveLength(1);
        });`,
      }),
    ),
    [],
  );
});

test("(d) a block-plating adapter is covered by the `highlight-block` slot", () => {
  // Markdown cannot mark characters — its text projection is the SOURCE — so it
  // plates whole blocks. That is a paint, and the gate has to see it as one.
  assert.deepEqual(
    checkAdapter(
      good({
        manifestSrc: `capabilities: { text: true, highlight: ["quote", "range"] }`,
        adapterSrc: `function Renderer({ highlights }) { return highlights.length; }`,
        testSrc: `it("plates the block", () => {
          render(<Renderer highlights={[{ address: { kind: "range", start: 0, end: 4 } }]} />);
          expect(container.querySelector('[data-slot="highlight-block"]')).not.toBeNull();
        });`,
      }),
    ),
    [],
  );
});

// ── parsing helpers ──────────────────────────────────────────────────────────

test("comments are never evidence — a kind named in prose does not count", () => {
  const problems = checkAdapter(
    good({
      manifestSrc: `capabilities: { text: true, highlight: ["rect"] }`,
      adapterSrc: `// reads the rects of an address one day\nfunction Renderer({ highlights }) {}`,
      testSrc: `/* kind: "rect" is coming */\n${TEST}`,
    }),
  );
  assert.equal(problems.length, 2);
  assert.ok(problems.every((p) => p.includes("rect")));
});

test("stripComments leaves code alone", () => {
  assert.match(stripComments(`const a = 1; // gone\n/* gone */ const b = 2;`), /const b = 2;/);
});

test("parseCapabilities reads the kinds, the text flag, and the absent case", () => {
  assert.deepEqual(parseCapabilities(MANIFEST), { text: true, highlight: ["quote", "range"] });
  assert.deepEqual(parseCapabilities(`capabilities: { text: false }`), {
    text: false,
    highlight: null,
  });
});

test("parseCapabilities survives a nested object inside capabilities", () => {
  // A lazy `[\s\S]*?\}` stops at the first `}` — the inner one — so `highlight`
  // would fall outside the block it thinks it read, and the gate would pass
  // while silently checking fewer declarations than the manifest makes.
  const nested = `capabilities: {
    text: true,
    limits: { pages: 50 },
    highlight: ["quote", "range", "rect"],
  }`;
  assert.deepEqual(parseCapabilities(nested), {
    text: true,
    highlight: ["quote", "range", "rect"],
  });
});

test("parseAddressKinds reads the canonical list from ui, not a copy", () => {
  const src = readFileSync(
    join(REPO_ROOT, "packages", "ui", "src", "lib", "document-address.ts"),
    "utf8",
  );
  assert.deepEqual(parseAddressKinds(src), KINDS);
});

test("readsHighlights / readsRects match the prop, not a lookalike", () => {
  assert.equal(readsHighlights(`const { highlights } = props;`), true);
  assert.equal(readsHighlights(`const highlighted = true;`), false);
  assert.equal(readsRects(`address.rects.map(draw)`), true);
  assert.equal(readsRects(`const rectangles = [];`), false);
});

// ── the gate stays wired (an unregistered gate never fires) ──────────────────

test("the gate is registered in package.json and gates.yml", () => {
  const pkg = JSON.parse(readFileSync(join(REPO_ROOT, "package.json"), "utf8"));
  assert.equal(
    pkg.scripts["viewer-highlight:check"],
    "node scripts/check-viewer-highlight-coverage.mjs",
  );
  assert.equal(
    pkg.scripts["viewer-highlight:check:test"],
    "node --test scripts/check-viewer-highlight-coverage.test.mjs",
  );
  const gates = readFileSync(join(REPO_ROOT, ".github", "workflows", "gates.yml"), "utf8");
  assert.match(gates, /pnpm viewer-highlight:check\b/);
  assert.match(gates, /pnpm viewer-highlight:check:test\b/);
});
