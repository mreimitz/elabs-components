/** Run from apps/diagram: node --test scripts/tests/home-titles.test.mjs */
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { Parser, parseDocument } from "yaml";
import { runnerImport } from "vite";
import { titleOf } from "../../server/workspace-fs.mjs";
const root = fileURLToPath(new URL("../../", import.meta.url));
const {
  module: { titleWithCopySuffix, splitCopySuffix },
} = await runnerImport(`${root}/src/home/templates.ts`, {
  root,
  configFile: false,
  logLevel: "error",
});
const comments = (text) => {
  const result = [];
  function walk(token) {
    if (!token || typeof token !== "object") return;
    if (token.type === "comment") result.push(token.source);
    for (const child of Object.values(token)) {
      if (Array.isArray(child)) child.forEach(walk);
      else if (child && typeof child === "object") walk(child);
    }
  }
  [...new Parser().parse(text)].forEach(walk);
  return result;
};
const bodies = [
  "title: Plain title # keep",
  "title: 'Customer''s landscape' # keep",
  'title: "Say \\"hi\\"" # keep'.replaceAll("\\\\", "\\"),
  'title: "Unicode \\u2603" # keep',
  "title: |\n  Multi\n  line",
  "title: >- # block comment\n  Folded title\n  continued",
  "title: >\n  Folded title\n  continued",
  "title: |+\n  Trailing\n  lines\n\n",
  "'title': 'Quoted key' # keep",
  "title: &title Anchored title # keep",
];
for (const title of bodies) {
  for (const ending of ["\n", "\r\n"]) {
    test(`roundtrip ${JSON.stringify(title)} with ${JSON.stringify(ending)}`, () => {
      const before =
        `# document\n${title}\ndescription: unchanged # detail\nnodes: [{id: nested, title: Nested}]\n`.replaceAll(
          "\n",
          ending,
        );
      const original = parseDocument(before).toJS();
      assert.equal(typeof original.title, "string");
      const after = titleWithCopySuffix(before, 2);
      const parsed = parseDocument(after);
      assert.deepEqual(parsed.errors, []);
      const next = parsed.toJS();
      assert.equal(next.title, original.title.replace(/\n+$/, "") + " (copy 2)");
      assert.equal(titleOf(after), next.title.trim());
      assert.equal(splitCopySuffix(titleOf(after)).marker, "(copy 2)");
      delete original.title;
      delete next.title;
      assert.deepEqual(next, original);
      assert.deepEqual(comments(after), comments(before));
      assert.ok(
        after.includes(
          `description: unchanged # detail${ending}nodes: [{id: nested, title: Nested}]${ending}`,
        ),
      );
    });
  }
}
for (const text of [
  "title: ~\n",
  "title: null\n",
  "title: 42\n",
  "title: false\n",
  "title: [a,b]\n",
  "description: no title\n",
  "title: [bad\n",
  "title: one\ntitle: two\n",
]) {
  test(`invalid or non-string title stays unchanged: ${JSON.stringify(text)}`, () => {
    assert.equal(titleWithCopySuffix(text, 1), text);
    assert.equal(titleOf(text), null);
  });
}
for (const file of await readdir(new URL("../../workspace/templates/", import.meta.url))) {
  if (!file.endsWith(".yaml")) continue;
  test(`shipped template preserves every other byte: ${file}`, async () => {
    const before = await readFile(
      new URL(`../../workspace/templates/${file}`, import.meta.url),
      "utf8",
    );
    const after = titleWithCopySuffix(before, 2);
    assert.equal(after.split("\n").filter((line, i) => line !== before.split("\n")[i]).length, 1);
    assert.deepEqual(comments(after), comments(before));
    const first = parseDocument(before).toJS();
    const next = parseDocument(after).toJS();
    assert.equal(next.title, first.title + " (copy 2)");
    delete first.title;
    delete next.title;
    assert.deepEqual(next, first);
  });
}
