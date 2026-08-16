import { test } from "node:test";
import assert from "node:assert/strict";
import { applyMarkerBlock, CONTEXT_START, CONTEXT_END } from "../lib/context.mjs";

test("applyMarkerBlock creates a wrapped block in a new file", () => {
  const out = applyMarkerBlock(null, "BODY");
  assert.match(out, new RegExp(`${CONTEXT_START}\\nBODY\\n${CONTEXT_END}`));
});

test("applyMarkerBlock replaces ONLY the marked region, preserving prose", () => {
  const existing = `# My hand-written heading

Some human prose above.

${CONTEXT_START}
OLD GENERATED BODY
${CONTEXT_END}

Human prose below — must survive.
`;
  const out = applyMarkerBlock(existing, "NEW BODY");
  assert.match(out, /# My hand-written heading/, "content above the markers preserved");
  assert.match(out, /Human prose below — must survive\./, "content below the markers preserved");
  assert.match(out, /NEW BODY/, "generated body replaced");
  assert.doesNotMatch(out, /OLD GENERATED BODY/, "old body gone");
});

test("applyMarkerBlock is idempotent — running twice yields the same output", () => {
  const seed = `header\n\n${CONTEXT_START}\nv1\n${CONTEXT_END}\nfooter\n`;
  const once = applyMarkerBlock(seed, "v2");
  const twice = applyMarkerBlock(once, "v2");
  assert.equal(once, twice, "second application is a no-op");
});

test("applyMarkerBlock appends (keeping content) when markers are absent", () => {
  const existing = "just some prose, no markers\n";
  const out = applyMarkerBlock(existing, "BODY");
  assert.match(out, /just some prose, no markers/, "existing content kept");
  assert.match(out, new RegExp(`${CONTEXT_START}\\nBODY\\n${CONTEXT_END}`), "block appended");
});

test("applyMarkerBlock tolerates a stray/partial marker (no valid pair)", () => {
  const existing = `prose\n${CONTEXT_START}\nbroken — no end marker\n`;
  const out = applyMarkerBlock(existing, "BODY");
  // No valid pair → append a fresh, complete block rather than corrupting the file.
  assert.ok(out.includes(CONTEXT_END), "a closing marker now exists");
  assert.ok(out.includes("BODY"), "new body present");
});
