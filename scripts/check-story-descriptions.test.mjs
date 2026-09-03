#!/usr/bin/env node
/**
 * Self-test for `check-story-descriptions.mjs` (RM-016, #152).
 *
 * A gate that can silently stop firing is worse than none, so every rung is
 * exercised against a PLANTED BAD FIXTURE and asserted to FAIL — not merely
 * asserted to pass on the real tree, which a broken scanner also does.
 *
 * The fixtures build a miniature repo (`apps/docs/.storybook/preview.tsx` +
 * `packages/<pkg>/src/*.stories.tsx`) because the checker discovers files
 * through `listStoryFiles()` from `check-storybook-groups.mjs`, which mirrors
 * Storybook's own globs.
 *
 *   node --test scripts/check-story-descriptions.test.mjs
 */
import { strict as assert } from "node:assert";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  MIN_DESCRIPTION_CHARS,
  checkStoryDescriptions,
  concatenatedStringValue,
  extractComponentDescription,
  findBaselineViolations,
  meaningfulLength,
} from "./check-story-descriptions.mjs";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const CHECKER = join(SCRIPT_DIR, "check-story-descriptions.mjs");
const REPO_ROOT = dirname(SCRIPT_DIR);

/** A description long enough to clear the rung-2 floor. */
const REAL =
  "The sidebar primitive set you assemble yourself — an application sidebar with typed slots " +
  "is `Layout/AppSidebar`, which composes exactly these parts.";

function story(title, { description = null, extra = "" } = {}) {
  const params = description
    ? `parameters: { layout: "padded", docs: { description: { component: ${JSON.stringify(
        description,
      )} } } },`
    : `parameters: { layout: "padded" },`;
  return [
    `import type { Meta } from "@storybook/react-vite";`,
    `const meta = {`,
    `  title: ${JSON.stringify(title)},`,
    `  ${params}`,
    extra,
    `} satisfies Meta<unknown>;`,
    `export default meta;`,
  ].join("\n");
}

/** Build a fixture tree; `files` maps a repo-relative path to its contents. */
function fixture(files) {
  const root = mkdtempSync(join(tmpdir(), "story-desc-"));
  const write = (rel, body) => {
    const p = join(root, rel);
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, body);
  };
  write("apps/docs/.storybook/preview.tsx", `export const parameters = {};\n`);
  write("packages/demo/package.json", `{ "name": "demo" }\n`);
  for (const [rel, body] of Object.entries(files)) write(rel, body);
  return { root, write, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

function runCli(args, { expectFail = false } = {}) {
  const r = spawnSync(process.execPath, [CHECKER, ...args], { encoding: "utf8" });
  const out = `${r.stdout ?? ""}${r.stderr ?? ""}`;
  if (expectFail) assert.notEqual(r.status, 0, `expected a non-zero exit; got success:\n${out}`);
  else assert.equal(r.status, 0, `expected success; got exit ${r.status}:\n${out}`);
  return { code: r.status, out };
}

// ───────────────────────── rung 1 — MISSING ───────────────────────────────────

test("rung 1: a story with no description FAILS, naming its file:line", () => {
  const f = fixture({
    "packages/demo/src/naked.stories.tsx": story("Core/Naked"),
  });
  try {
    const { findings } = checkStoryDescriptions(f.root, []);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].rung, "missing");
    assert.equal(findings[0].file, "packages/demo/src/naked.stories.tsx");
    assert.equal(typeof findings[0].line, "number");
    assert.ok(findings[0].line > 0);
  } finally {
    f.cleanup();
  }
});

test("rung 1: the same story PASSES once it is on the baseline", () => {
  const f = fixture({ "packages/demo/src/naked.stories.tsx": story("Core/Naked") });
  try {
    const { findings } = checkStoryDescriptions(f.root, ["packages/demo/src/naked.stories.tsx"]);
    assert.deepEqual(findings, []);
  } finally {
    f.cleanup();
  }
});

test("rung 1: a real description PASSES with no baseline at all", () => {
  const f = fixture({
    "packages/demo/src/good.stories.tsx": story("Core/Good", { description: REAL }),
  });
  try {
    const { findings, files } = checkStoryDescriptions(f.root, []);
    assert.deepEqual(findings, []);
    assert.equal(files[0].state, "ok");
  } finally {
    f.cleanup();
  }
});

// ───────────────────────── rung 2 — VACUOUS ───────────────────────────────────

test("rung 2: a stub description FAILS even though the slot exists", () => {
  const f = fixture({
    "packages/demo/src/stub.stories.tsx": story("Core/Stub", { description: "A sidebar." }),
  });
  try {
    const { findings } = checkStoryDescriptions(f.root, []);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].rung, "vacuous");
  } finally {
    f.cleanup();
  }
});

test("rung 2: vacuous is NOT baselineable — the escape hatch must not launder a stub", () => {
  const rel = "packages/demo/src/stub.stories.tsx";
  const f = fixture({ [rel]: story("Core/Stub", { description: "A sidebar." }) });
  try {
    const { findings } = checkStoryDescriptions(f.root, [rel]);
    assert.equal(findings.length, 1, "a baselined file must still fail the vacuous rung");
    assert.equal(findings[0].rung, "vacuous");
  } finally {
    f.cleanup();
  }
});

test("rung 2: a bare link to the disambiguation page does not buy length", () => {
  const linkOnly = "See [Choosing](?path=/docs/docs-choosing-between-similar-components--docs).";
  assert.ok(linkOnly.length > MIN_DESCRIPTION_CHARS, "the raw string is long…");
  assert.ok(meaningfulLength(linkOnly) < MIN_DESCRIPTION_CHARS, "…but its meaningful text is not");
});

// ───────────────────────── fail-closed — UNREADABLE ───────────────────────────

test("unreadable: a non-literal `parameters` FAILS rather than being skipped", () => {
  const src = [
    `import type { Meta } from "@storybook/react-vite";`,
    `const shared = { layout: "padded" };`,
    `const meta = { title: "Core/Indirect", parameters: shared } satisfies Meta<unknown>;`,
    `export default meta;`,
  ].join("\n");
  const result = extractComponentDescription(src);
  assert.equal(result.state, "unreadable");
});

test("unreadable: an interpolated template description FAILS (its text is not on the page)", () => {
  const src = [
    `const NAME = "Sidebar";`,
    'const meta = { title: "Core/T", parameters: { docs: { description: { component: `The ${NAME} set` } } } };',
    `export default meta;`,
  ].join("\n");
  assert.equal(extractComponentDescription(src).state, "unreadable");
});

test("unreadable: no readable default-exported meta FAILS", () => {
  assert.equal(extractComponentDescription("export const x = 1;\n").state, "unreadable");
});

// ───────────────────────── the extractor's own traps ──────────────────────────

test("a `description` inside argTypes is not mistaken for the component description", () => {
  const src = [
    `const meta = {`,
    `  title: "Core/Trap",`,
    `  argTypes: { size: { description: { component: "not this one" } } },`,
    `  parameters: { layout: "padded" },`,
    `} satisfies Meta<unknown>;`,
    `export default meta;`,
  ].join("\n");
  assert.equal(extractComponentDescription(src).state, "missing");
});

test("a `+`-concatenated description reads as one string", () => {
  const src = [
    `const meta = {`,
    `  parameters: {`,
    `    docs: { description: { component: "first half — " + "second half of the sentence." } },`,
    `  },`,
    `} satisfies Meta<unknown>;`,
    `export default meta;`,
  ].join("\n");
  const r = extractComponentDescription(src);
  assert.equal(r.state, "ok");
  assert.equal(r.text, "first half — second half of the sentence.");
});

test("an ARRAY-of-strings description reads as one string (the Gantt shape)", () => {
  const src = [
    `const meta = {`,
    `  parameters: {`,
    `    docs: {`,
    `      description: {`,
    `        component: [`,
    `          "Interactive, accessible Gantt chart.",`,
    `          "",`,
    `          "### Time units " + "(#360)",`,
    `        ].join("\\n"),`,
    `      },`,
    `    },`,
    `  },`,
    `} satisfies Meta<unknown>;`,
    `export default meta;`,
  ].join("\n");
  const r = extractComponentDescription(src);
  assert.equal(r.state, "ok");
  assert.ok(r.text.includes("Interactive, accessible Gantt chart."));
  assert.ok(r.text.includes("### Time units (#360)"));
});

test("concatenatedStringValue refuses an expression it only partly understands", () => {
  assert.equal(concatenatedStringValue(` "a" + someVar `, 0, 15), null);
});

test("meaningfulLength discounts link targets, backticks and collapsed whitespace", () => {
  assert.equal(meaningfulLength("[label](https://example.com/very/long/target)"), "label".length);
  assert.equal(meaningfulLength("`Code`   spaced"), "Code spaced".length);
});

// ───────────────────────── the baseline's own shape ───────────────────────────

test("baseline: an unsorted list FAILS its shape check", () => {
  const v = findBaselineViolations(["b.stories.tsx", "a.stories.tsx"]);
  assert.ok(
    v.some((m) => /not sorted/.test(m)),
    v.join("\n"),
  );
});

test("baseline: a duplicate entry FAILS", () => {
  const v = findBaselineViolations(["a.stories.tsx", "a.stories.tsx"]);
  assert.ok(v.some((m) => /duplicate/.test(m)));
});

test("baseline: a non-story path FAILS", () => {
  const v = findBaselineViolations(["packages/ui/src/button.tsx"]);
  assert.ok(v.some((m) => /not a story file/.test(m)));
});

test("baseline: a well-formed list is clean", () => {
  assert.deepEqual(findBaselineViolations(["a.stories.tsx", "b.stories.tsx"]), []);
});

// ───────────────────────── the CLI + the ratchet ──────────────────────────────

test("CLI: exits non-zero on a missing description and prints file:line", () => {
  const f = fixture({ "packages/demo/src/naked.stories.tsx": story("Core/Naked") });
  const baseline = join(f.root, "baseline.json");
  writeFileSync(baseline, "[]\n");
  try {
    const { code, out } = runCli(["--root", f.root, "--baseline", baseline], { expectFail: true });
    assert.equal(code, 1);
    assert.match(out, /story-descriptions gate FAILED/);
    assert.match(out, /packages\/demo\/src\/naked\.stories\.tsx:\d+/);
  } finally {
    f.cleanup();
  }
});

test("CLI: --update REFUSES to grow the todo list without --force", () => {
  const f = fixture({ "packages/demo/src/naked.stories.tsx": story("Core/Naked") });
  const baseline = join(f.root, "baseline.json");
  writeFileSync(baseline, "[]\n");
  try {
    const { out } = runCli(["--root", f.root, "--baseline", baseline, "--update"], {
      expectFail: true,
    });
    assert.match(out, /would GROW the todo list/);
    assert.equal(readFileSync(baseline, "utf8").trim(), "[]", "the baseline must be untouched");
  } finally {
    f.cleanup();
  }
});

test("CLI: --update PRUNES a file that has since gained a description", () => {
  const rel = "packages/demo/src/now-good.stories.tsx";
  const f = fixture({ [rel]: story("Core/NowGood", { description: REAL }) });
  const baseline = join(f.root, "baseline.json");
  writeFileSync(baseline, `${JSON.stringify([rel], null, 2)}\n`);
  try {
    runCli(["--root", f.root, "--baseline", baseline, "--update"]);
    assert.deepEqual(JSON.parse(readFileSync(baseline, "utf8")), []);
  } finally {
    f.cleanup();
  }
});

test("CLI: --update writes a SORTED, newline-terminated list (Prettier-clean)", () => {
  const f = fixture({
    "packages/demo/src/zeta.stories.tsx": story("Core/Zeta"),
    "packages/demo/src/alpha.stories.tsx": story("Core/Alpha"),
  });
  const baseline = join(f.root, "baseline.json");
  writeFileSync(baseline, "[]\n");
  try {
    runCli(["--root", f.root, "--baseline", baseline, "--update", "--force"]);
    const raw = readFileSync(baseline, "utf8");
    assert.ok(raw.endsWith("\n"));
    const parsed = JSON.parse(raw);
    assert.deepEqual(parsed, [...parsed].sort());
    assert.equal(raw, `${JSON.stringify(parsed, null, 2)}\n`);
  } finally {
    f.cleanup();
  }
});

test("CLI: --warn never exits non-zero but still prints the findings", () => {
  const f = fixture({ "packages/demo/src/naked.stories.tsx": story("Core/Naked") });
  const baseline = join(f.root, "baseline.json");
  writeFileSync(baseline, "[]\n");
  try {
    const { code, out } = runCli(["--root", f.root, "--baseline", baseline, "--warn"]);
    assert.equal(code, 0);
    assert.match(out, /story-descriptions/);
  } finally {
    f.cleanup();
  }
});

// ───────────────────────── the real tree ──────────────────────────────────────

test("the repo itself passes, and the committed baseline is well-formed", () => {
  const baseline = JSON.parse(
    readFileSync(join(REPO_ROOT, "scripts", "story-description-baseline.json"), "utf8"),
  );
  assert.deepEqual(findBaselineViolations(baseline), []);
  const { findings } = checkStoryDescriptions(REPO_ROOT, baseline);
  assert.deepEqual(
    findings.map((f) => `${f.file}:${f.line} [${f.rung}]`),
    [],
  );
});

test("the stories RM-016 wrote are OFF the baseline and clear the floor", () => {
  const baseline = JSON.parse(
    readFileSync(join(REPO_ROOT, "scripts", "story-description-baseline.json"), "utf8"),
  );
  // A representative slice of the ambiguous pairs, both halves of each.
  const pairs = [
    ["packages/ui/src/components/sidebar/sidebar.stories.tsx", "AppSidebar"],
    ["packages/ui/src/components/app-sidebar/app-sidebar.stories.tsx", "Layout/Sidebar"],
    ["packages/ui/src/components/toolbar/toolbar.stories.tsx", "ViewToolbar"],
    ["packages/ui/src/components/view-toolbar/view-toolbar.stories.tsx", "Layout/Toolbar"],
    ["packages/ai/src/snippet.stories.tsx", "CodeBlock"],
    ["packages/ai/src/code-block.stories.tsx", "Snippet"],
    ["packages/ai/src/context-panel.stories.tsx", "TokenUsage"],
    ["packages/ai/src/token-usage.stories.tsx", "ContextPanel"],
    ["packages/ai/src/conversation.stories.tsx", "TerminalSurface"],
    ["packages/ai/src/chat-shell.stories.tsx", "TerminalConsole"],
  ];
  for (const [rel, sibling] of pairs) {
    assert.ok(!baseline.includes(rel), `${rel} must have left the todo list`);
    const r = extractComponentDescription(readFileSync(join(REPO_ROOT, rel), "utf8"));
    assert.equal(r.state, "ok", `${rel} must have a readable description`);
    assert.ok(
      meaningfulLength(r.text) >= MIN_DESCRIPTION_CHARS,
      `${rel} must clear the rung-2 floor`,
    );
    assert.ok(r.text.includes(sibling), `${rel} must name its sibling ${sibling}`);
  }
});
