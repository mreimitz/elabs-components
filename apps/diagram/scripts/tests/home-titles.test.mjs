/** Run from apps/diagram: node --test scripts/tests/home-titles.test.mjs */
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
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
for (const file of ["qlik-cloud-customer-landscape.yaml", "qlik-talend-cloud-pipeline.yaml"]) {
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

const referencedTitles = {
  anchored:
    'diagram: "1"\ntitle: &name Original title # keep title\ndescription: *name # keep alias\nnodes:\n  - id: a\n    title: *name\nx-values: [*name, *name]\n',
  aliased:
    'diagram: "1"\nx-title: &name Original title\ntitle: *name # keep title alias\ndescription: *name\nnodes: [{id: a}]\n',
  flow: '{diagram: "1", title: Original title, nodes: [{id: a, title: Inner}]} # keep root\n',
  flowAnchor:
    '{diagram: "1", title: &name "null", description: *name, x-map: {*name : preserved}, nodes: [{id: a, title: *name}]}\n',
  mappingKey:
    'diagram: "1"\ntitle: &name Original title\nx-map:\n  ? *name # keep key\n  : unchanged\nnodes: [{id: a}]\n',
  shadowedAnchor:
    'diagram: "1"\ntitle: &name Original title\ndescription: *name\nx-other: &name Other title\nx-alias: *name\nnodes: [{id: a}]\n',
};
for (const [name, source] of Object.entries(referencedTitles)) {
  for (const n of [1, 2]) {
    for (const ending of ["\n", "\r\n"]) {
      test(`${name} copy ${n} preserves every non-title semantic value (${JSON.stringify(ending)})`, () => {
        const before = source.replaceAll("\n", ending);
        const original = parseDocument(before).toJS();
        assert.equal(titleOf(before), original.title.trim());
        const after = titleWithCopySuffix(before, n);
        const parsed = parseDocument(after);
        assert.deepEqual(parsed.errors, []);
        const result = parsed.toJS();
        const expected = `${original.title}${n === 1 ? " (copy)" : " (copy 2)"}`;
        assert.equal(result.title, expected);
        assert.equal(titleOf(after), expected);
        delete original.title;
        delete result.title;
        assert.deepEqual(result, original);
        assert.deepEqual(comments(after), comments(before));
        if (ending === "\r\n") assert.equal(/(?<!\r)\n/.test(after), false);
      });
    }
  }
}
for (const source of [
  "title: *missing\n",
  "x: &x [*x]\ntitle: *x\n",
  "x: &x [a, b]\ntitle: *x\n",
]) {
  test(`metadata refuses unresolved or collection aliases: ${JSON.stringify(source)}`, () => {
    assert.equal(titleOf(source), null);
    assert.equal(titleWithCopySuffix(source, 1), source);
  });
}
test("oversized alias materialization is refused before allocating a copy", () => {
  const source = `title: &name ${"a".repeat(10000)}\nx: [${Array(101).fill("*name").join(",")} ]\n`;
  assert.throws(() => titleWithCopySuffix(source, 1), /copy too large/);
  assert.equal(titleOf(source), "a".repeat(10000));
});

const difficultTitles = [
  "Simple",
  "null",
  "true",
  "12",
  "a: b # c",
  'quoted "value"',
  "single 'quote'",
  "Line one\nline two\n",
  "A ".repeat(120),
  "Grüezi 雪 😀",
  "Tab\tseparated",
  "Windows\r\nline\r\n",
  "Carriage\rreturn",
  "C:\\some\\path\\file",
  "Next\u0085line",
  "Unicode\u2028line\u2029paragraph",
  '\t"mixed\\\r\n\u0085\u2028\u2029end\n',
];
const quote = (value) =>
  JSON.stringify(value).replace(
    /[\u0085\u2028\u2029]/g,
    (character) => `\\u${character.charCodeAt(0).toString(16).padStart(4, "0")}`,
  );
for (const title of difficultTitles)
  for (const form of ["anchor", "alias", "flow"])
    for (const ending of ["\n", "\r\n"])
      for (const n of [1, 2]) {
        test(`alias scalar matrix ${JSON.stringify({ title, form, ending, n })}`, () => {
          const q = quote(title);
          const consumers =
            "description: *name # keep description\nnodes:\n  - id: a\n    title: *name\nx-list: [*name, {nested: [*name, *name]}]\nx-map: {*name : [*name]}\nx-block-map:\n  ? *name # keep key\n  : *name\n";
          const source =
            form === "anchor"
              ? `diagram: "1"\ntitle: &name ${q} # keep title\n${consumers}`
              : form === "alias"
                ? `diagram: "1"\nx-title: &name ${q}\ntitle: *name # keep title\n${consumers}`
                : `{diagram: "1", title: &name ${q}, description: *name, nodes: [{id: a, title: *name}], x-list: [*name, {nested: [*name, *name]}], x-map: {*name : [*name]}} # keep root\n`;
          const before = source.replaceAll("\n", ending);
          const original = parseDocument(before);
          assert.deepEqual(original.errors, []);
          const after = titleWithCopySuffix(before, n);
          const next = parseDocument(after);
          assert.deepEqual(next.errors, []);
          const expected = `${title.replace(/\n+$/, "")}${n === 1 ? " (copy)" : " (copy 2)"}`;
          const originalValue = original.toJS({ mapAsMap: true });
          const nextValue = next.toJS({ mapAsMap: true });
          assert.equal(nextValue.get("title"), expected);
          assert.equal(titleOf(after), expected.trim());
          originalValue.delete("title");
          nextValue.delete("title");
          assert.deepEqual(nextValue, originalValue);
          assert.deepEqual(comments(after), comments(before));
          if (ending === "\r\n") assert.equal(/(?<!\r)\n/.test(after), false);
        });
      }
for (const ending of ["\n", "\r\n"]) {
  test(`anchored block scalar preserves nested values and keys (${JSON.stringify(ending)})`, () => {
    const before =
      'diagram: "1"\ntitle: &name |+ # keep\n  First line\n  Second line\n\ndescription: *name\nnodes: [{id: a, title: *name}]\nx-map:\n  ? *name\n  : [*name, {nested: *name}]\n'.replaceAll(
        "\n",
        ending,
      );
    for (const n of [1, 2]) {
      const original = parseDocument(before).toJS({ mapAsMap: true });
      const after = titleWithCopySuffix(before, n);
      const parsed = parseDocument(after);
      assert.deepEqual(parsed.errors, []);
      const next = parsed.toJS({ mapAsMap: true });
      assert.equal(next.get("title"), `First line\nSecond line (copy${n === 1 ? "" : " 2"})`);
      original.delete("title");
      next.delete("title");
      assert.deepEqual(next, original);
      assert.deepEqual(comments(after), comments(before));
      if (ending === "\r\n") assert.equal(/(?<!\r)\n/.test(after), false);
    }
  });
}

test("unresolved non-title aliases refuse a copy before creation", () => {
  assert.throws(
    () => titleWithCopySuffix("title: Good title\nx: *missing\n", 1),
    /Could not safely copy/,
  );
});
