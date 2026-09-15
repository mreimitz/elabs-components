/**
 * plugin-consumer-clean — shipped plugin skills/agents carry no repo-internal governance.
 * Ported from scripts/check-plugin-consumer-clean.mjs.
 *
 * The plugin ships skills + agents to END USERS in THEIR project, who have none of this
 * monorepo: no `/file-issue`, no `.claude/` rules, no maintainer agents, no `packages/`/`apps/`
 * tree. Prose referencing those installs broken — it tells the user's agent to read files that
 * do not exist and run commands it does not have. Every shippable text file under the declared
 * `skills`/`agents` paths is scanned for the substrings below.
 */
export const BANNED_TOKENS = [
  "/file-issue",
  ".claude/",
  "issue-workflow",
  "packages/",
  "apps/",
  "brand-ui-root-cause",
  "brand-ui-session-reviewer",
  "repo-architect",
];

const PLUGIN_JSON = ".claude-plugin/plugin.json";
const SHIPPED_TEXT_EXT = /\.(md|json|tsx?|mjs|cjs|js|csv|txt|ya?ml)$/i;

function toPaths(value) {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.filter((v) => typeof v === "string");
  return [];
}

/** Pure: `[{ line, token }]` for one text. */
export function findBannedTokens(text) {
  const hits = [];
  const lines = text.split(/\r?\n/);
  for (const token of BANNED_TOKENS)
    lines.forEach((l, i) => {
      if (l.includes(token)) hits.push({ line: i + 1, token });
    });
  return hits;
}

const plugin = (json, files = {}) => ({
  files: { [PLUGIN_JSON]: JSON.stringify(json), ...files },
});
const P = { skills: ["./skills/brand-ui-audit"], agents: ["./agents/brand-ui-reviewer.md"] };
const CLEAN_AGENT =
  "---\nname: brand-ui-reviewer\ndescription: Review a UI built with @elabs-ai/components-*.\n---\nReport findings directly to the user. Read-only.";

export default {
  id: "plugin-consumer-clean",
  scope: "repo",
  doc: "Shipped plugin skills and agents reference no repo-internal plumbing (`/file-issue`, `.claude/`, `packages/`, `apps/`, maintainer agents); end users install them without this monorepo.",
  baseline: "none",
  run(ctx) {
    if (!ctx.exists(PLUGIN_JSON))
      return [{ file: PLUGIN_JSON, line: 1, msg: "missing — cannot find the shipped surface" }];
    let pluginJson;
    try {
      pluginJson = JSON.parse(ctx.readFile(PLUGIN_JSON));
    } catch {
      return [{ file: PLUGIN_JSON, line: 1, msg: "not valid JSON" }];
    }
    const out = [];
    const seen = new Set();
    for (const p of [...toPaths(pluginJson.agents), ...toPaths(pluginJson.skills)]) {
      const rel = p.replace(/^\.\//, "").replace(/\/$/, "");
      const shipped = ctx
        .gitFiles()
        .filter((f) => (f === rel || f.startsWith(`${rel}/`)) && SHIPPED_TEXT_EXT.test(f));
      for (const file of shipped) {
        if (seen.has(file)) continue;
        seen.add(file);
        for (const { line, token } of findBannedTokens(ctx.readFile(file)))
          out.push({
            file,
            line,
            msg: `repo-internal reference "${token}" in a shipped plugin file`,
          });
      }
    }
    return out;
  },
  fixtures: {
    pass: [
      plugin(P, {
        "agents/brand-ui-reviewer.md": CLEAN_AGENT,
        "skills/brand-ui-audit/SKILL.md":
          "Use @elabs-ai/components-tokens/styles.css; report findings to the user with token fixes.",
      }),
      // files outside the declared surface are not shipped
      plugin(P, {
        "agents/brand-ui-reviewer.md": CLEAN_AGENT,
        ".claude/agents/x.md": "Run /file-issue",
      }),
      // binaries are skipped
      plugin(P, { "skills/brand-ui-audit/shot.png": "packages/" }),
    ],
    fail: [
      plugin(P, {
        "agents/brand-ui-reviewer.md": `${CLEAN_AGENT}\nFile each finding via /file-issue.`,
      }),
      plugin(P, { "agents/brand-ui-reviewer.md": "Critique against .claude/rules/theming.md." }),
      plugin(P, {
        "agents/brand-ui-reviewer.md": "Raw colors live in packages/tokens/src/themes.css.",
      }),
      plugin(P, {
        "agents/brand-ui-reviewer.md": "Route to brand-ui-root-cause-analyst, then repo-architect.",
      }),
      plugin(P, {
        "skills/brand-ui-audit/SKILL.md":
          "Run /file-issue and read packages/tokens/src/themes.css.",
      }),
      plugin(P, { "skills/brand-ui-audit/reference/app-spec.schema.json": '{"see":"apps/docs"}' }),
      plugin(P, {
        "skills/brand-ui-audit/SKILL.md": "See issue-workflow and brand-ui-session-reviewer.",
      }),
      { files: {} },
    ],
  },
};
