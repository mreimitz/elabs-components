/**
 * check-storybook-groups.test.mjs — self-test for the Storybook taxonomy gate
 * (RM-002, #151). Run in CI: `node --test scripts/check-storybook-groups.test.mjs`
 * (`pnpm storybook-groups:check:test`).
 *
 * A gate that can silently stop firing is worse than none
 * (`.claude/rules/quality-gates.md`, "Enforcement over reminders"), so this file
 * does three things:
 *
 *   1. Unit-tests every pure function on INLINE fixtures — including the exact
 *      source shapes that broke earlier drafts (an apostrophe in JSX text, a
 *      decoy `title:` in `argTypes`, prose above the `order` literal).
 *   2. PLANTS a bad tree on disk for each rung and asserts the CLI exits 1 and
 *      names the offending file.
 *   3. Asserts the gate is still WIRED — a script nobody runs never fires.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  GUIDELINES_REL,
  NAMING_EXEMPTIONS,
  PREVIEW_REL,
  checkStorybookGroups,
  checkTitle,
  diffGroupLists,
  extractStoryTitle,
  isNamingExempt,
  maskNonCode,
  parseGuidelinesGroups,
  parseStorySortOrder,
  scanSource,
} from "./check-storybook-groups.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.dirname(HERE);
const GATE = path.join(HERE, "check-storybook-groups.mjs");

// ── 1. the order literal ──────────────────────────────────────────────────────

const PREVIEW_OK = `
const preview = {
  parameters: {
    options: {
      // Prose above the literal that talks about the order and even writes
      // order: [ "Decoy" ] inside a comment — a first-match parser reads THIS.
      storySort: {
        method: "alphabetical",
        order: [
          "Docs",
          ["Introduction", "Getting Started"],
          "Core",
          "Patterns",
          ["Templates", "Blocks"],
        ],
      },
    },
  },
};
export default preview;
`;

test("parseStorySortOrder: reads the literal, not the prose above it", () => {
  const { groups, children } = parseStorySortOrder(PREVIEW_OK);
  assert.deepEqual(groups, ["Docs", "Core", "Patterns"]);
  assert.deepEqual(children.Docs, ["Introduction", "Getting Started"]);
  assert.deepEqual(children.Patterns, ["Templates", "Blocks"]);
});

test("parseStorySortOrder: tolerates line comments and trailing commas inside the array", () => {
  const src = `storySort: { order: [
      "Docs", // the doc pages
      "Core",
      // a whole-line comment
    ] }`;
  assert.deepEqual(parseStorySortOrder(src).groups, ["Docs", "Core"]);
});

test("THROWS: an identifier in the order array (the shape Storybook itself rejects)", () => {
  // `getStorySortParameter` throws "Unexpected 'SIDEBAR_ORDER'. Parameter
  // 'options.storySort' should be defined inline" on this — so must the gate,
  // loudly, rather than reading a truncated list.
  assert.throws(
    () => parseStorySortOrder(`storySort: { order: SIDEBAR_ORDER }`),
    /no \`order: \[\` key found|not a plain literal/,
  );
  assert.throws(
    () => parseStorySortOrder(`storySort: { order: [...SIDEBAR_ORDER, "Core"] }`),
    /not a plain literal/,
  );
});

test("THROWS: no order key at all", () => {
  assert.throws(() => parseStorySortOrder(`const preview = {};`), /no `order: \[` key found/);
});

test("the SHIPPED preview.tsx still parses — the array is still an inline literal", () => {
  const { groups } = parseStorySortOrder(readFileSync(path.join(REPO_ROOT, PREVIEW_REL), "utf8"));
  assert.ok(groups.length > 10, `expected the real sidebar order, got ${JSON.stringify(groups)}`);
  assert.ok(groups.includes("Core") && groups.includes("Patterns"));
});

// ── 2. the source lexer ───────────────────────────────────────────────────────

test("scanSource: masked view hides string bodies, comment-free view keeps them", () => {
  const { masked, withoutComments } = scanSource(`const a = "he{llo"; // a } comment\n`);
  assert.equal(masked.length, withoutComments.length);
  assert.ok(!masked.includes("{"), "a brace inside a string must not reach the structural view");
  assert.ok(!masked.includes("}"), "a brace inside a comment must not reach the structural view");
  assert.ok(withoutComments.includes('"he{llo"'), "string content must survive comment stripping");
  assert.ok(!withoutComments.includes("comment"));
});

test("scanSource: an apostrophe in JSX text is NOT a string opener", () => {
  // The regression that hid a meta object 30 lines below a `don't`: treating the
  // apostrophe as a quote swallowed everything up to the next one in the file.
  const src = `function Demo() {\n  return <p>don't</p>;\n}\nconst meta = { title: "Core/Demo" };\nexport default meta;\n`;
  assert.equal(extractStoryTitle(src)?.title, "Core/Demo");
  assert.ok(maskNonCode(src).includes("{ title:"));
});

// ── 3. title extraction ───────────────────────────────────────────────────────

test("extractStoryTitle: multi-line `const meta = { … } satisfies Meta`", () => {
  const src = `import type { Meta } from "@storybook/react-vite";\n\nconst meta = {\n  title: "Core/Button",\n  component: Button,\n} satisfies Meta<typeof Button>;\nexport default meta;\n`;
  assert.deepEqual(extractStoryTitle(src), { title: "Core/Button", line: 4 });
});

test("extractStoryTitle: single-line meta (prettier-collapsed)", () => {
  const src = `const meta = { title: "AI/Tool", component: Tool } satisfies Meta<typeof Tool>;\nexport default meta;\n`;
  assert.equal(extractStoryTitle(src)?.title, "AI/Tool");
});

test("extractStoryTitle: annotated declaration `const meta: Meta<typeof X> = {`", () => {
  const src = `const meta: Meta<typeof X> = {\n  title: "Data/Table",\n};\nexport default meta;\n`;
  assert.equal(extractStoryTitle(src)?.title, "Data/Table");
});

test("extractStoryTitle: inline `export default { … }`", () => {
  assert.equal(extractStoryTitle(`export default { title: "Flow/Canvas" };`)?.title, "Flow/Canvas");
});

test("extractStoryTitle: reads the META title, not a decoy `title:` in argTypes", () => {
  const src = `const meta = {\n  title: "Forms/SchemaForm",\n  argTypes: { title: { control: "text" } },\n  args: { title: "Connector settings" },\n} satisfies Meta<typeof SchemaForm>;\nexport default meta;\n`;
  assert.equal(extractStoryTitle(src)?.title, "Forms/SchemaForm");
});

test("extractStoryTitle: a nested `title` never wins over the meta's own", () => {
  const src = `const meta = {\n  component: X,\n  parameters: { docs: { title: "nested" } },\n  title: "Core/X",\n};\nexport default meta;\n`;
  assert.equal(extractStoryTitle(src)?.title, "Core/X");
});

test("extractStoryTitle: a longer key ending in `title` is not mistaken for it", () => {
  const src = `const meta = {\n  docsTitle: "nope",\n  subtitle: "nope either",\n  title: "Core/X",\n};\nexport default meta;\n`;
  assert.equal(extractStoryTitle(src)?.title, "Core/X");
});

test("extractStoryTitle: MDX `<Meta title=…>`", () => {
  const src = `import { Meta } from "@storybook/addon-docs/blocks";\n\n<Meta title="Docs/Getting Started" />\n`;
  assert.deepEqual(extractStoryTitle(src, { mdx: true }), {
    title: "Docs/Getting Started",
    line: 3,
  });
});

test("extractStoryTitle: null when there is no title to read (the gate FAILS on this)", () => {
  assert.equal(extractStoryTitle(`const meta = { component: X };\nexport default meta;\n`), null);
  assert.equal(extractStoryTitle(`export const Default = {};`), null);
  assert.equal(extractStoryTitle(`<Meta of={ButtonStories} />`, { mdx: true }), null);
});

// ── 4. rung 1 (orphan group) + rung 2 (segment naming) ────────────────────────

const GROUPS = ["Docs", "Foundations", "Core", "Display", "Layout", "Patterns"];

test("FLAGS: a title whose group is not in the order array", () => {
  const [p] = checkTitle("Typography/MatchHighlight", GROUPS);
  assert.equal(p.rung, "orphan-group");
  assert.match(p.message, /"Typography" is not in storySort\.order/);
});

test("FLAGS: RM-001's exact two regressions", () => {
  for (const title of ["Foundation/Toolbar", "Typography/MatchHighlight"]) {
    assert.equal(checkTitle(title, GROUPS)[0]?.rung, "orphan-group", title);
  }
});

test("FLAGS: a space in the component segment", () => {
  const problems = checkTitle("Core/Chat Shell", GROUPS);
  assert.equal(problems.length, 1);
  assert.equal(problems[0].rung, "segment-naming");
});

test("FLAGS: a space in a sub-family leaf of a non-exempt group", () => {
  const rungs = checkTitle("Display/Markdown Preview/Academic", GROUPS).map((p) => p.rung);
  assert.deepEqual(rungs, ["segment-naming"]);
});

test("DOES NOT FLAG: a clean two-level title", () => {
  assert.deepEqual(checkTitle("Core/Button", GROUPS), []);
});

test("DOES NOT FLAG: the sanctioned prose surfaces", () => {
  for (const title of [
    "Docs/Getting Started",
    "Docs/brand-ui MCP Server",
    "Patterns/Templates/Enterprise Admin Console",
    "Patterns/Scenarios/Agentic AI Workspace",
    "Patterns/Blocks/AI Chat Shell",
    "Layout/App Shell/Mail",
    "Foundations/Spacing & Radius",
  ]) {
    assert.deepEqual(checkTitle(title, GROUPS), [], title);
  }
});

test("isNamingExempt: matches on segment boundaries, not raw prefixes", () => {
  assert.ok(isNamingExempt("Docs/Anything At All"));
  assert.ok(isNamingExempt("Foundations/Spacing & Radius"));
  assert.ok(!isNamingExempt("Docsomething/Not Exempt"));
  assert.ok(!isNamingExempt("Foundations/Spacing & Radius Extra"));
  assert.ok(!isNamingExempt("Layout/App Shelf/Mail"));
});

test("every NAMING_EXEMPTIONS entry is still EARNED by a real title", () => {
  // A stale exemption is silent over-permission: it would wave through a future
  // `Docs/…`-shaped group nobody reviewed. Remove the entry when its surface goes.
  const { titles } = checkStorybookGroups(REPO_ROOT);
  for (const e of NAMING_EXEMPTIONS) {
    const used = titles.some(
      (t) => (t.title === e || t.title.startsWith(`${e}/`)) && /\s/.test(t.title.split("/").pop()),
    );
    const covers = titles.some((t) => t.title === e || t.title.startsWith(`${e}/`));
    assert.ok(covers, `NAMING_EXEMPTIONS entry "${e}" matches no story title any more — remove it`);
    assert.ok(used || covers, `"${e}" is unused`);
  }
});

// ── 5. rung 3 (doc parity) ────────────────────────────────────────────────────

test("parseGuidelinesGroups: reads `N. **Group** —` items only, inside its section", () => {
  const md = `# Doc\n\n## Sidebar taxonomy (top-level groups, in order)\n\n1. **Docs** — the doc pages.\n2. **Core** — primitives.\n   continued **NotAGroup** line.\n\nSome **bold** prose.\n`;
  const parsed = parseGuidelinesGroups(md);
  assert.ok(parsed.sectionFound);
  assert.deepEqual(parsed.groups, ["Docs", "Core"]);
});

test("parseGuidelinesGroups: a numbered bold list in ANOTHER section is not a group list", () => {
  // The doc describes this gate's own four rungs as `1. **Orphan group** — …`.
  // A whole-file scan read them as sidebar groups; that really happened while
  // this gate was being written, which is why the parse is section-scoped.
  const md = `## Sidebar taxonomy\n\n1. **Docs** — x.\n\n## Adding a group\n\n1. **Orphan group** — x.\n2. **Doc parity** — x.\n`;
  assert.deepEqual(parseGuidelinesGroups(md).groups, ["Docs"]);
});

test("parseGuidelinesGroups: a missing section is reported, never treated as empty-and-fine", () => {
  const parsed = parseGuidelinesGroups(`# Doc\n\n1. **Docs** — x.\n`);
  assert.equal(parsed.sectionFound, false);
  assert.deepEqual(parsed.groups, []);
});

test("diffGroupLists: identical lists agree", () => {
  assert.deepEqual(diffGroupLists(["A", "B"], ["A", "B"]), []);
});

test("FLAGS: a group in the array that the guidelines list omits", () => {
  const [msg] = diffGroupLists(["A", "B", "Viewer"], ["A", "B"]);
  assert.match(msg, /"Viewer" is in storySort\.order but not in the guidelines list/);
});

test("FLAGS: a group in the guidelines list that the array omits", () => {
  const [msg] = diffGroupLists(["A"], ["A", "Providers"]);
  assert.match(msg, /"Providers" is in the guidelines list but not in storySort\.order/);
});

test("FLAGS: same groups, different order", () => {
  const [msg] = diffGroupLists(["A", "B"], ["B", "A"]);
  assert.match(msg, /different ORDER/);
});

// ── 6. end-to-end: plant a bad tree, assert the CLI fails ─────────────────────

const GUIDELINES_OK = `# Storybook Guidelines

## Sidebar taxonomy (top-level groups, in order)

1. **Docs** — the doc pages.
2. **Core** — base UI primitives.
3. **Patterns** — composed demos.

## Adding a group

Prose, plus a numbered bold list of the gate's own rungs that must NOT be read as
sidebar groups:

1. **Orphan group** — a story whose group is not in the array.
2. **Doc parity** — this list against the array.
`;

/** Write a fixture tree; returns its root. Caller removes it. */
function plant({ preview = PREVIEW_OK, guidelines = GUIDELINES_OK, stories = {}, mdx = {} } = {}) {
  const root = mkdtempSync(path.join(tmpdir(), "sb-groups-"));
  const write = (rel, text) => {
    const p = path.join(root, rel);
    mkdirSync(path.dirname(p), { recursive: true });
    writeFileSync(p, text);
  };
  write(PREVIEW_REL, preview);
  write(GUIDELINES_REL, guidelines);
  write("packages/ui/package.json", `{ "name": "@elabs-ai/components-ui" }`);
  for (const [name, text] of Object.entries(stories)) write(`packages/ui/src/${name}`, text);
  for (const [name, text] of Object.entries(mdx)) write(`apps/docs/stories/${name}`, text);
  return root;
}

const storyFile = (title) =>
  `const meta = { title: "${title}" } satisfies Meta<typeof X>;\nexport default meta;\n`;

/** Run the CLI against a fixture root. Returns `{ status, output }`. */
function run(root) {
  try {
    const output = execFileSync(process.execPath, [GATE, "--root", root], { encoding: "utf8" });
    return { status: 0, output };
  } catch (err) {
    return { status: err.status ?? 1, output: `${err.stdout ?? ""}${err.stderr ?? ""}` };
  }
}

const CLEAN_TREE = {
  stories: {
    "button.stories.tsx": storyFile("Core/Button"),
    "shell.stories.tsx": storyFile("Patterns/Blocks/AI Chat Shell"),
  },
  mdx: { "Intro.mdx": `<Meta title="Docs/Introduction" />\n` },
};

test("PASSES: a clean fixture tree", (t) => {
  const root = plant(CLEAN_TREE);
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const { status, output } = run(root);
  assert.equal(status, 0, output);
  assert.match(output, /✔ storybook-groups/);
});

test("FAILS: a story titled into a group the order array does not list", (t) => {
  const root = plant({
    ...CLEAN_TREE,
    stories: { ...CLEAN_TREE.stories, "toolbar.stories.tsx": storyFile("Foundation/Toolbar") },
  });
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const { status, output } = run(root);
  assert.equal(status, 1);
  assert.match(output, /toolbar\.stories\.tsx:1/);
  assert.match(output, /"Foundation" is not in storySort\.order/);
});

test("FAILS: a space in a component segment outside the exemptions", (t) => {
  const root = plant({
    ...CLEAN_TREE,
    stories: { ...CLEAN_TREE.stories, "chat.stories.tsx": storyFile("Core/Chat Shell") },
  });
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const { status, output } = run(root);
  assert.equal(status, 1);
  assert.match(output, /chat\.stories\.tsx:1\s+"Core\/Chat Shell"/);
  assert.match(output, /PascalCase with no spaces/);
});

test("FAILS: the guidelines list drifts from the order array", (t) => {
  const root = plant({
    ...CLEAN_TREE,
    guidelines: `# G\n\n## Sidebar taxonomy\n\n1. **Docs** — the doc pages.\n2. **Core** — base UI primitives.\n`,
  });
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const { status, output } = run(root);
  assert.equal(status, 1);
  assert.match(output, /STORYBOOK_GUIDELINES\.md/);
  assert.match(output, /"Patterns" is in storySort\.order but not in the guidelines list/);
});

test("FAILS: the guidelines list is in a different ORDER", (t) => {
  const root = plant({
    ...CLEAN_TREE,
    guidelines: `# G\n\n## Sidebar taxonomy\n\n1. **Docs** — x.\n2. **Patterns** — x.\n3. **Core** — x.\n`,
  });
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const { status, output } = run(root);
  assert.equal(status, 1);
  assert.match(output, /different ORDER/);
});

test("FAILS: the guidelines lost their group list (rung 3 must never pass vacuously)", (t) => {
  const root = plant({ ...CLEAN_TREE, guidelines: `# G\n\nNo taxonomy section at all.\n` });
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const { status, output } = run(root);
  assert.equal(status, 1);
  assert.match(output, /rung 3 would pass vacuously/);
});

test("FAILS: a listed group no story uses any more (rung 4)", (t) => {
  const root = plant({
    ...CLEAN_TREE,
    stories: { "button.stories.tsx": storyFile("Core/Button") }, // no Patterns story left
  });
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const { status, output } = run(root);
  assert.equal(status, 1);
  assert.match(output, /"Patterns" is listed in storySort\.order but no story titles into it/);
});

test("FAILS: a story whose title cannot be read (fail-closed, never a skip)", (t) => {
  const root = plant({
    ...CLEAN_TREE,
    stories: {
      ...CLEAN_TREE.stories,
      "untitled.stories.tsx": `const meta = { component: X };\nexport default meta;\n`,
    },
  });
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const { status, output } = run(root);
  assert.equal(status, 1);
  assert.match(output, /untitled\.stories\.tsx\s+could not read this file's sidebar title/);
});

test("FAILS: the order array was extracted out of preview.tsx", (t) => {
  // Storybook's own static parser rejects this too — the gate must not silently
  // resolve an empty group list and pass every title vacuously.
  const root = plant({
    ...CLEAN_TREE,
    preview: `import { SIDEBAR_ORDER } from "./sidebar-order";\nconst preview = { parameters: { options: { storySort: { order: SIDEBAR_ORDER } } } };\nexport default preview;\n`,
  });
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const { status, output } = run(root);
  assert.equal(status, 1);
  assert.match(output, /order/);
});

test("--warn never exits non-zero but still prints the findings", (t) => {
  const root = plant({
    ...CLEAN_TREE,
    stories: { ...CLEAN_TREE.stories, "toolbar.stories.tsx": storyFile("Foundation/Toolbar") },
  });
  t.after(() => rmSync(root, { recursive: true, force: true }));
  // Exit 0 (execFileSync throws on non-zero) AND the finding still printed.
  const proc = spawnSync(process.execPath, [GATE, "--root", root, "--warn"], { encoding: "utf8" });
  assert.equal(proc.status, 0, proc.stderr);
  assert.match(proc.stderr, /⚠ storybook-groups/);
  assert.match(proc.stderr, /"Foundation" is not in storySort\.order/);
});

// ── 7. the gate is WIRED (a script nobody runs never fires) ───────────────────

test("package.json declares both the gate and its self-test", () => {
  const { scripts } = JSON.parse(readFileSync(path.join(REPO_ROOT, "package.json"), "utf8"));
  assert.equal(scripts["storybook-groups:check"], "node scripts/check-storybook-groups.mjs");
  assert.equal(
    scripts["storybook-groups:check:test"],
    "node --test scripts/check-storybook-groups.test.mjs",
  );
});

test("gates.yml runs the gate in the BLOCKING job, and its self-test too", () => {
  const yml = readFileSync(path.join(REPO_ROOT, ".github/workflows/gates.yml"), "utf8");
  // Everything before the second job (`  storybook:`) belongs to the blocking one.
  // Don't cut on the string "non-blocking": the blocking job's own NOTE comment
  // quotes it, which truncated this slice to the header.
  const secondJob = /^ {2}storybook:$/m.exec(yml);
  assert.ok(secondJob, "expected gates.yml to still declare the second, non-blocking job");
  const blocking = yml.slice(0, secondJob.index);
  assert.ok(
    blocking.includes("pnpm storybook-groups:check\n"),
    "gates.yml's blocking job must run `pnpm storybook-groups:check`",
  );
  assert.ok(blocking.includes("pnpm storybook-groups:check:test"));
});

test("AGENTS.md's command contract names the gate", () => {
  const md = readFileSync(path.join(REPO_ROOT, "AGENTS.md"), "utf8");
  assert.ok(
    md.includes("pnpm storybook-groups:check"),
    'AGENTS.md\'s "Validate before you finish" contract must name the gate',
  );
});
