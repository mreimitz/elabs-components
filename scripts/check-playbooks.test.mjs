// check-playbooks.test.mjs — self-test for scripts/check-playbooks.mjs
// -----------------------------------------------------------------------------
// A gate that can silently stop firing is worse than none (quality-gates.md,
// "Self-tested gates"). This drives the PURE checker with fixtures — including the
// exact regression #84 records, an unregistered playbook — and then runs the real
// gate over the real repo to assert it exits 0.
//
// Run: node --test scripts/check-playbooks.test.mjs   (pnpm playbooks:check:test)
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { findPlaybookViolations, collectInputs, REPO_ROOT } from "./check-playbooks.mjs";
import { parseFrontMatter, loadPlaybooks, matchPlaybooks } from "../packages/cli/lib/core.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const GATE = path.join(HERE, "check-playbooks.mjs");

const FM = `---
archetype: dashboard
intent: "KPI overview screen"
keywords: [dashboard, kpi]
packages: ["@qlik-coe-emea/qlabs-components-ui"]
---

# Playbook — Dashboard
`;

const dashboardEntry = {
  archetype: "dashboard",
  intent: "KPI overview screen",
  keywords: ["dashboard", "kpi"],
  packages: ["@qlik-coe-emea/qlabs-components-ui"],
  file: "docs/playbooks/dashboard.md",
  template: "templates/dashboard.tsx",
};

/** A well-formed single-playbook world. */
function world(overrides = {}) {
  return {
    files: [{ slug: "dashboard", text: FM, hasTemplate: true }],
    fresh: [dashboardEntry],
    committed: [dashboardEntry],
    contextText: "## Playbooks\n- **dashboard** — … · docs/playbooks/dashboard.md\n",
    archetypes: ["dashboard"],
    ...overrides,
  };
}

test("a fully registered playbook passes", () => {
  assert.deepEqual(findPlaybookViolations(world()), []);
});

test("a playbook with NO front matter fails (the #84 regression)", () => {
  const v = findPlaybookViolations(
    world({ files: [{ slug: "dashboard", text: "# Playbook — Dashboard\n", hasTemplate: true }] }),
  );
  assert.ok(
    v.some((m) => /no YAML front matter/.test(m)),
    v.join("\n"),
  );
});

test("front matter missing a required key fails", () => {
  const text = FM.replace("keywords: [dashboard, kpi]\n", "");
  const v = findPlaybookViolations(
    world({ files: [{ slug: "dashboard", text, hasTemplate: true }] }),
  );
  assert.ok(
    v.some((m) => /missing `keywords`/.test(m)),
    v.join("\n"),
  );
});

test("archetype disagreeing with the file name fails", () => {
  const v = findPlaybookViolations(
    world({ files: [{ slug: "dashboards", text: FM, hasTemplate: true }] }),
  );
  assert.ok(
    v.some((m) => /disagrees with the file name/.test(m)),
    v.join("\n"),
  );
});

test("an archetype unknown to the engine fails", () => {
  const v = findPlaybookViolations(world({ archetypes: ["settings"] }));
  assert.ok(
    v.some((m) => /not in ARCHETYPES/.test(m)),
    v.join("\n"),
  );
});

test("a playbook with no generated template fails", () => {
  const v = findPlaybookViolations(
    world({ files: [{ slug: "dashboard", text: FM, hasTemplate: false }] }),
  );
  assert.ok(
    v.some((m) => /no docs\/playbooks\/templates\/dashboard\.tsx/.test(m)),
    v.join("\n"),
  );
});

test("a new playbook that never reached the committed manifest fails", () => {
  const v = findPlaybookViolations(world({ committed: [] }));
  assert.ok(
    v.some((m) => /`playbooks` block is stale/.test(m)),
    v.join("\n"),
  );
});

test("a playbook missing from the generated context fails", () => {
  const v = findPlaybookViolations(world({ contextText: "## Packages & components\n" }));
  assert.ok(
    v.some((m) => /no entry for docs\/playbooks\/dashboard\.md/.test(m)),
    v.join("\n"),
  );
});

test("the real repo passes the real gate (exit 0)", () => {
  const out = execFileSync("node", [GATE], { encoding: "utf8" });
  assert.match(out, /✔ playbooks/);
});

test("collectInputs reads the real tree and the real gate agrees", () => {
  assert.deepEqual(findPlaybookViolations(collectInputs(REPO_ROOT)), []);
});

// ── the reader + the router (the two pieces the surfaces depend on) ──────────

test("the front-matter reader handles flow, wrapped-flow and block sequences", () => {
  const flow = parseFrontMatter('---\na: "x"\nb: [one, "two"]\n---\nbody\n').data;
  assert.deepEqual(flow, { a: "x", b: ["one", "two"] });
  const wrapped = parseFrontMatter("---\nb:\n  [one, two, three]\n---\n").data;
  assert.deepEqual(wrapped.b, ["one", "two", "three"]);
  const block = parseFrontMatter("---\nb:\n  - one\n  - two\n---\n").data;
  assert.deepEqual(block.b, ["one", "two"]);
});

test("a free-text intent routes to the right playbook FIRST (epic DoD bullet 3)", () => {
  const manifest = { playbooks: loadPlaybooks(REPO_ROOT) };
  const top = (q) => matchPlaybooks(manifest, q).map((p) => p.archetype)[0];
  assert.equal(top("build a dashboard"), "dashboard");
  assert.equal(top("chatbot"), "ai-assistant");
  assert.equal(top("landing page"), "marketing");
  assert.equal(top("admin console"), "data-app"); // phrase hit outranks settings' "admin portal"
  assert.equal(top("node and edge canvas"), "flow-workspace");
  assert.equal(top("preferences"), "settings");
  assert.deepEqual(matchPlaybooks(manifest, "no such thing here"), []);
});
