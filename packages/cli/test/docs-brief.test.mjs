// docs-brief.test.mjs — `docs --brief` / MCP `docs { detail: "brief" }`: the small
// first read. Locks (a) it keeps what decides correct usage, (b) it is materially
// smaller than the full entry on the heaviest component, (c) the default is unchanged,
// (d) it is never LONGER than the full entry — a small component gets the full card.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { findRepoRoot } from "../lib/core.mjs";
import { firstSentence, renderDocsBrief, smallerCard } from "../lib/docs-brief.mjs";
import { flat, loadManifest } from "../lib/core.mjs";
import { handleMessage } from "../lib/mcp.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const bin = join(here, "..", "bin", "brand-ui.mjs");
const repoRoot = findRepoRoot(here);
const run = (args) =>
  spawnSync(process.execPath, [bin, ...args], { encoding: "utf8", cwd: repoRoot ?? here });

test("firstSentence keeps one sentence and clips on a word boundary", () => {
  assert.equal(firstSentence("Enable paging. Default true. See #227."), "Enable paging.");
  const long = firstSentence("word ".repeat(80), 40);
  assert.ok(long.length <= 41 && long.endsWith("…"));
  assert.equal(firstSentence(undefined), "");
});

test("renderDocsBrief keeps import, purpose, anti-patterns, variants and own props", () => {
  const out = renderDocsBrief({
    name: "Button",
    kind: "component",
    pkg: "@elabs-ai/components-ui",
    module: "packages/ui/src/components/button/button.tsx",
    intent: {
      purpose: "Primary action trigger.",
      antiPatterns: ["Two primary Buttons. Demote one."],
    },
    variants: { variants: { size: ["sm", "default"] }, defaultVariants: { size: "default" } },
    props: {
      extends: ["ButtonHTMLAttributes<HTMLButtonElement>"],
      props: [
        {
          name: "asChild",
          optional: true,
          type: "boolean",
          description: "Render as child. Long history follows here.",
        },
      ],
      resolved: { onClick: { type: "MouseEventHandler" } },
    },
  });
  assert.match(out, /import \{ Button \} from "@elabs-ai\/components-ui";/);
  assert.match(out, /purpose: Primary action trigger\./);
  assert.match(out, /x Two primary Buttons\./);
  assert.match(out, /size: sm \| default \(default\)/);
  assert.match(out, /asChild\?: boolean {2}— Render as child\.$/m);
  assert.doesNotMatch(out, /Long history|onClick/);
  assert.match(out, /without --brief/);
});

test("CLI: --brief is several times smaller on DataTable; the default output is untouched", (t) => {
  if (!repoRoot) return t.skip("not inside the monorepo");
  const full = run(["docs", "DataTable"]).stdout;
  const brief = run(["docs", "DataTable", "--brief"]).stdout;
  assert.match(brief, /^# DataTable/);
  assert.match(brief, /columns: /);
  assert.ok(brief.length * 3 < full.length, `brief ${brief.length} vs full ${full.length}`);
  assert.match(full, /props \(own-declared\):/);
});

test("smallerCard returns the brief card only when it is smaller", () => {
  assert.equal(smallerCard("short", "a longer full card"), "short");
  assert.equal(smallerCard("a brief card with a footer", "tiny"), "tiny");
  assert.equal(smallerCard("same", "same"), "same");
});

test("MCP: detail brief is never longer than full, for every component in the manifest", (t) => {
  if (!repoRoot) return t.skip("not inside the monorepo");
  const manifest = loadManifest(repoRoot);
  const names = [
    ...new Set(
      flat(manifest)
        .filter((r) => r.kind === "component")
        .map((r) => r.name),
    ),
  ];
  const call = (component, detail) =>
    handleMessage(
      {
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: { name: "docs", arguments: detail ? { component, detail } : { component } },
      },
      { root: repoRoot, manifest },
    ).result.content[0].text;
  const bytes = (text) => Buffer.byteLength(text);
  const longer = names.filter((n) => bytes(call(n, "brief")) > bytes(call(n)));
  assert.deepEqual(longer, [], `brief longer than full for: ${longer.slice(0, 10).join(", ")}`);
  assert.match(
    call("DataTable", "brief"),
    /brief view/,
    "a large component still gets the brief card",
  );
});

test("CLI: --brief on a small entry prints the full card, not a longer brief one", (t) => {
  if (!repoRoot) return t.skip("not inside the monorepo");
  const full = run(["docs", "A2UI_VERSION"]).stdout;
  assert.equal(run(["docs", "A2UI_VERSION", "--brief"]).stdout, full);
  assert.match(full, /source: /);
});
