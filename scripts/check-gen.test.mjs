/**
 * check-gen.test.mjs — locks the #87/#96 doc-truth generator (`brand-ui gen`).
 * Run in CI: `node --test scripts/check-gen.test.mjs`.
 *
 * Hermetic: every test builds a MINIMAL temp repo root (its own
 * `brand-ui.manifest.json`, `docs/DECISIONS.md` with the SUMMARY markers, and the
 * four gen target docs with empty `brand-ui:gen:*` marker pairs) — never the real
 * repo files. It then drives the same `computeGen`/`writeGen`/`checkGen` the CLI uses.
 *
 * Asserts (the approved-design self-test contract):
 *   1. a stale fixture is flagged by checkGen,
 *   2. writeGen is idempotent (write → check is clean → re-write is a no-op),
 *   3. hand-written content OUTSIDE the markers survives a write,
 *   4. a change to the DECISIONS:SUMMARY source propagates into gen:decisions.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { computeGen, writeGen, checkGen } from "../packages/cli/lib/gen.mjs";

/**
 * A minimal agent-output contract (enough fields for renderAgentOutputGuidance).
 * Mirrors the real lib/agent-output.mjs shape; the contract gate itself is locked
 * separately in check-agent-output.test.mjs.
 */
const AGENT_OUTPUT_FIXTURE = {
  paths: {
    conversation: {
      status: "shipped",
      title: "Conversation — UIMessage",
      summary: "Render what the agent said.",
      model: "ai/UIMessage",
      modelAuthority: "Vercel AI SDK — import type only (D6).",
      owns: "the projection only.",
      consumedBy: ["Conversation", "Message"],
      roles: ["user", "assistant", "system"],
      parts: [
        { kind: "text", consumedBy: ["Message"], note: "streamed markdown." },
        {
          kind: "tool",
          typePattern: "tool-<name> | dynamic-tool",
          consumedBy: ["Tool"],
          consumesFields: ["type", "state", "input", "output", "errorText"],
          stateToStatus: { "input-streaming": "pending", "output-available": "complete" },
          statusEnum: ["pending", "complete"],
          note: "JSON payload + ToolResultCard.",
        },
      ],
      example: "const messages = [];",
      wiring: "Your app owns useChat.",
    },
    jsxPreview: {
      status: "shipped",
      title: "Ad-hoc JSX — JSXPreview",
      summary: "JSX string escape hatch.",
      component: "JSXPreview",
      props: { jsx: "string", components: "allow-list" },
      safety: "allow-list only.",
      streaming: "auto-closes tags.",
      example: "const jsx = '<Stat />';",
      wiring: "Pass the JSX string.",
    },
    a2ui: {
      status: "not-shipped",
      title: "A2UI — NOT YET",
      available: false,
      tracking: "WP-11",
      summary: "Not built.",
    },
  },
  donts: ["Don't call the model in a component."],
};

/** A minimal product-only manifest (two packages is enough to exercise ordering). */
const MANIFEST = {
  packages: {
    "@elabs-ai/components-tokens": {
      path: "packages/tokens",
      components: [],
      hooks: [{ name: "useTheme" }],
    },
    "@elabs-ai/components-ui": {
      path: "packages/ui",
      components: [{ name: "Button" }, { name: "Card" }],
      hooks: [],
    },
  },
  themes: ["light"],
  defaultTheme: "light",
  radius: "0.5rem",
  tokenCount: 42,
  registry: [{ name: "stat-card" }],
  // WP-09 #66/#84 — the playbook index region (docs/playbooks/README.md) renders
  // from this block, so the fixture manifest carries one archetype.
  playbooks: [
    {
      archetype: "dashboard",
      intent: "KPI overview screen",
      keywords: ["dashboard", "kpi"],
      packages: ["@elabs-ai/components-ui"],
      file: "docs/playbooks/dashboard.md",
      template: "templates/dashboard.tsx",
    },
  ],
  agentOutput: AGENT_OUTPUT_FIXTURE,
};

/** The DECISIONS.md SUMMARY region body the generator must extract verbatim. */
const DECISION_BODY = "| # | Decision |\n| --- | --- |\n| **D1** | Build-with is the default. |";

function decisionsMd(body = DECISION_BODY) {
  return [
    "# DECISIONS",
    "",
    "<!-- DECISIONS:SUMMARY:START — edit decisions here. -->",
    "",
    body,
    "",
    "<!-- DECISIONS:SUMMARY:END -->",
    "",
    "Trailing prose (must not be extracted).",
    "",
  ].join("\n");
}

/**
 * A doc with hand prose around an empty named gen region. MDX targets use an MDX
 * expression-comment marker (HTML comments break MDX indexing); Markdown uses an
 * HTML-comment marker. `mdx:true` switches the fixture to the MDX marker form.
 */
function docWithRegion(
  name,
  { before = "Hand prose ABOVE.", after = "Hand prose BELOW.", mdx = false } = {},
) {
  const [start, end] = mdx
    ? [`{/* brand-ui:gen:${name}:start */}`, `{/* brand-ui:gen:${name}:end */}`]
    : [`<!-- brand-ui:gen:${name}:start -->`, `<!-- brand-ui:gen:${name}:end -->`];
  return ["# Doc", "", before, "", start, end, "", after, ""].join("\n");
}

/** Build a temp repo root with the manifest, DECISIONS.md, and the four targets. */
function makeRoot({ decisionBody } = {}) {
  const root = mkdtempSync(join(tmpdir(), "brand-ui-gen-"));
  mkdirSync(join(root, "docs/playbooks"), { recursive: true });
  mkdirSync(join(root, "apps/docs/stories"), { recursive: true });
  mkdirSync(join(root, "skills/brand-ui"), { recursive: true });
  writeFileSync(join(root, "brand-ui.manifest.json"), JSON.stringify(MANIFEST));
  writeFileSync(join(root, "docs/DECISIONS.md"), decisionsMd(decisionBody));
  writeFileSync(join(root, "CLAUDE.md"), docWithRegion("decisions"));
  // AGENTS.md carries all three regions in one file.
  writeFileSync(
    join(root, "AGENTS.md"),
    [
      "# AGENTS",
      "",
      "Top prose.",
      "",
      "<!-- brand-ui:gen:packages:start -->",
      "<!-- brand-ui:gen:packages:end -->",
      "",
      "<!-- brand-ui:gen:selection:start -->",
      "<!-- brand-ui:gen:selection:end -->",
      "",
      "<!-- brand-ui:gen:decisions:start -->",
      "<!-- brand-ui:gen:decisions:end -->",
      "",
      "Bottom prose.",
      "",
    ].join("\n"),
  );
  writeFileSync(join(root, "PROJECT.md"), docWithRegion("packages"));
  // The .mdx target must use MDX-comment markers (HTML comments break MDX).
  writeFileSync(
    join(root, "apps/docs/stories/Introduction.mdx"),
    docWithRegion("packages", { mdx: true }),
  );
  // The brand-ui skill carries TWO generated regions: the `catalogue` (#87) and
  // the `agent-output` contract — wrapped by hand-written judgment prose (frontmatter
  // above, references between/below) that the writer must preserve.
  writeFileSync(
    join(root, "skills/brand-ui/SKILL.md"),
    [
      "---",
      "name: brand-ui",
      "---",
      "",
      "# brand-ui",
      "",
      "Hand prose ABOVE the catalogue.",
      "",
      "<!-- brand-ui:gen:catalogue:start -->",
      "<!-- brand-ui:gen:catalogue:end -->",
      "",
      "Hand prose BETWEEN the regions.",
      "",
      "<!-- brand-ui:gen:agent-output:start -->",
      "<!-- brand-ui:gen:agent-output:end -->",
      "",
      "Hand prose BELOW the catalogue.",
      "",
    ].join("\n"),
  );
  // The agent-facing "AI Output Contract" Storybook page carries the SAME
  // agent-output region (MDX markers — HTML comments break MDX).
  writeFileSync(
    join(root, "apps/docs/stories/AI-Output-Contract-for-Agents.mdx"),
    docWithRegion("agent-output", { mdx: true }),
  );
  // The human playbook index (#84) — a generated table inside hand-written prose.
  writeFileSync(join(root, "docs/playbooks/README.md"), docWithRegion("playbooks"));
  return root;
}

function cleanup(root) {
  rmSync(root, { recursive: true, force: true });
}

// ── 1. a stale fixture is flagged ────────────────────────────────────────────

test("FLAGS stale: empty regions are not yet populated", async () => {
  const root = makeRoot();
  try {
    const stale = await checkGen(root);
    // All four targets start with EMPTY regions → all stale until written.
    assert.ok(stale.length >= 1, "expected stale targets before the first write");
    assert.ok(stale.some((f) => f.endsWith("CLAUDE.md")));
  } finally {
    cleanup(root);
  }
});

// ── 2. writeGen is idempotent ────────────────────────────────────────────────

test("IDEMPOTENT: write → check clean → re-write no-op", async () => {
  const root = makeRoot();
  try {
    await writeGen(root);
    const afterFirst = (await checkGen(root)).length;
    assert.equal(afterFirst, 0, "checkGen must be clean immediately after writeGen");
    // Snapshot all files, write again, assert byte-identical.
    const snap = (await computeGen(root)).map(({ file }) => readFileSync(file, "utf8"));
    await writeGen(root);
    const snap2 = (await computeGen(root)).map(({ file }) => readFileSync(file, "utf8"));
    assert.deepEqual(snap2, snap, "a second write must produce byte-identical files");
  } finally {
    cleanup(root);
  }
});

// ── 3. hand-written content OUTSIDE the markers survives ──────────────────────

test("PRESERVES: hand prose outside the markers survives a write", async () => {
  const root = makeRoot();
  try {
    await writeGen(root);
    const claude = readFileSync(join(root, "CLAUDE.md"), "utf8");
    assert.ok(claude.includes("Hand prose ABOVE."), "prose above the region must survive");
    assert.ok(claude.includes("Hand prose BELOW."), "prose below the region must survive");
    const agents = readFileSync(join(root, "AGENTS.md"), "utf8");
    assert.ok(agents.includes("Top prose."));
    assert.ok(agents.includes("Bottom prose."));
    // The packages region was populated with the manifest packages.
    assert.ok(
      agents.includes("@elabs-ai/components-tokens"),
      "package table must be generated into AGENTS.md",
    );
    // Infra rows (scope:"all") are present in AGENTS.md.
    assert.ok(
      agents.includes("@elabs-ai/components-eslint-config"),
      "infra rows must appear in AGENTS.md",
    );
    // The MDX target keeps MDX-comment markers (HTML comments break MDX) and is populated.
    const intro = readFileSync(join(root, "apps/docs/stories/Introduction.mdx"), "utf8");
    assert.ok(
      intro.includes("{/* brand-ui:gen:packages:start */}"),
      "the .mdx target must use MDX-comment markers, not HTML comments",
    );
    assert.ok(
      intro.includes("@elabs-ai/components-tokens"),
      "the .mdx package list must be generated",
    );
  } finally {
    cleanup(root);
  }
});

// ── 4. a DECISIONS:SUMMARY change propagates into gen:decisions ───────────────

test("PROPAGATES: editing DECISIONS:SUMMARY changes the gen:decisions region", async () => {
  const root = makeRoot();
  try {
    await writeGen(root);
    const before = readFileSync(join(root, "CLAUDE.md"), "utf8");
    assert.ok(
      before.includes("Build-with is the default."),
      "initial summary text must be present",
    );

    // Edit the source SUMMARY body, then the gate must report stale until regen.
    const changed = "| # | Decision |\n| --- | --- |\n| **D1** | A DIFFERENT decision now. |";
    writeFileSync(join(root, "docs/DECISIONS.md"), decisionsMd(changed));
    const stale = await checkGen(root);
    assert.ok(
      stale.some((f) => f.endsWith("CLAUDE.md")),
      "a DECISIONS.md edit must make CLAUDE.md stale",
    );

    await writeGen(root);
    const after = readFileSync(join(root, "CLAUDE.md"), "utf8");
    assert.ok(after.includes("A DIFFERENT decision now."), "new summary text must propagate");
    assert.ok(!after.includes("Build-with is the default."), "old summary text must be gone");
    // The trailing prose from DECISIONS.md must NOT leak into the extracted block.
    assert.ok(
      !after.includes("Trailing prose (must not be extracted)."),
      "only the SUMMARY region is extracted, not the rest of DECISIONS.md",
    );
  } finally {
    cleanup(root);
  }
});

// ── 5. the skill catalogue region is generated, gated, and prose-preserving ───

test("SKILL CATALOGUE: generated from the manifest; hand prose survives; drift is gated", async () => {
  const root = makeRoot();
  const skill = join(root, "skills/brand-ui/SKILL.md");
  try {
    await writeGen(root);
    const md = readFileSync(skill, "utf8");
    // Hand-written judgment prose around the markers is preserved verbatim.
    assert.ok(md.includes("Hand prose ABOVE the catalogue."), "prose above the catalogue survives");
    assert.ok(md.includes("Hand prose BELOW the catalogue."), "prose below the catalogue survives");
    assert.ok(md.includes("name: brand-ui"), "the skill frontmatter must survive");
    // The factual catalogue is generated from the manifest: packages + counts.
    assert.ok(
      md.includes("@elabs-ai/components-ui"),
      "the package catalogue must be generated into the skill",
    );
    assert.ok(
      /Exported surface:\*\*\s*2 components/.test(md),
      "exact component count from manifest",
    );
    assert.ok(md.includes("**Themes (1):**"), "theme count comes from the manifest");
    assert.ok(md.includes("light (default)"), "the default theme is flagged");
    assert.ok(md.includes("**Tokens:** 42"), "token count comes from the manifest");

    // A manifest change (add a component) must make the skill catalogue stale.
    const m2 = JSON.parse(readFileSync(join(root, "brand-ui.manifest.json"), "utf8"));
    m2.packages["@elabs-ai/components-ui"].components.push({ name: "Dialog" });
    writeFileSync(join(root, "brand-ui.manifest.json"), JSON.stringify(m2));
    const stale = await checkGen(root);
    assert.ok(
      stale.some((f) => f.endsWith("SKILL.md")),
      "adding a component without regen must make the skill catalogue stale",
    );

    // Regenerate → fresh again, new count present, prose still intact.
    await writeGen(root);
    assert.equal((await checkGen(root)).length, 0, "regen clears the stale flag");
    const md2 = readFileSync(skill, "utf8");
    assert.ok(/Exported surface:\*\*\s*3 components/.test(md2), "new count propagates");
    assert.ok(md2.includes("Hand prose ABOVE the catalogue."), "prose still survives after regen");
  } finally {
    cleanup(root);
  }
});

// ── 6. the agent-output contract region: generated into the skill + the MDX page,
//      A2UI shown as future-only, and a consumedBy rename is gated ───────────────

test("AGENT OUTPUT: generated into skill + MDX page; A2UI is future; rename gates", async () => {
  const root = makeRoot();
  const skill = join(root, "skills/brand-ui/SKILL.md");
  const page = join(root, "apps/docs/stories/AI-Output-Contract-for-Agents.mdx");
  try {
    await writeGen(root);
    const md = readFileSync(skill, "utf8");
    // Both SHIPPED paths are documented.
    assert.ok(md.includes("Path A"), "Path A (UIMessage) heading present");
    assert.ok(md.includes("Path B"), "Path B (JSXPreview) heading present");
    // A2UI is rendered as NOT YET / WP-11 — never as a usable surface.
    assert.ok(/WP-11/.test(md), "A2UI shown as WP-11");
    assert.ok(/not yet/i.test(md), "A2UI shown as not-yet");
    // The tool state→Status mapping is rendered FROM the manifest.
    assert.ok(md.includes("input-streaming"), "tool state mapping present");
    // The same contract region landed in the MDX page too (one source).
    const pageMd = readFileSync(page, "utf8");
    assert.ok(pageMd.includes("Path A") && pageMd.includes("Path B"), "contract mirrored into MDX");
    assert.ok(
      pageMd.includes("{/* brand-ui:gen:agent-output:start */}"),
      "the MDX page keeps MDX-comment markers",
    );
    // Hand prose around the skill markers survives.
    assert.ok(
      md.includes("Hand prose BETWEEN the regions."),
      "skill prose between regions survives",
    );

    // Renaming a consumedBy component in the manifest must make BOTH stale.
    const m2 = JSON.parse(readFileSync(join(root, "brand-ui.manifest.json"), "utf8"));
    m2.agentOutput.paths.conversation.consumedBy = ["Conversation", "RenamedMessage"];
    writeFileSync(join(root, "brand-ui.manifest.json"), JSON.stringify(m2));
    const stale = await checkGen(root);
    assert.ok(
      stale.some((f) => f.endsWith("SKILL.md")),
      "a consumedBy rename makes the skill stale",
    );
    assert.ok(
      stale.some((f) => f.endsWith(".mdx")),
      "and the MDX page stale",
    );
  } finally {
    cleanup(root);
  }
});
