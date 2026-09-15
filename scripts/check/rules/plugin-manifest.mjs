/**
 * plugin-manifest — the brand-ui Claude plugin (`.claude-plugin/`) installs whole (VP-01 #120).
 * Ported from scripts/check-plugin.mjs.
 *
 *   1–2. plugin.json parses and has `name` + `version`.
 *   3.   marketplace.json has an entry for the plugin at the SAME version.
 *   4.   every `skills`/`agents`/`commands`/`hooks`/`outputStyles` path starts `./` and resolves.
 *   5–6. every skill has a SKILL.md with `name:`; the `brand-ui-start` router is user-invocable.
 *   7.   a declared agents dir holds ≥1 `*.md`.
 *   8.   `.mcp.json` servers are http (`url`) or stdio (`command`).
 *   9.   a doc several skills share (the visual loop, #57) exists exactly once and every
 *        reference to it resolves.
 * Does NOT replace `claude plugin validate --strict` or a live install.
 */
export const COMPONENT_PATH_FIELDS = ["skills", "agents", "commands", "hooks", "outputStyles"];
export const ROUTER_SKILL = "brand-ui-start";
export const SHARED_SKILL_DOCS = ["skills/brand-ui-new-app/reference/visual-loop.md"];

const PLUGIN_JSON = ".claude-plugin/plugin.json";
const MARKETPLACE_JSON = ".claude-plugin/marketplace.json";
const MCP_JSON = ".mcp.json";

function toPaths(value) {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.filter((v) => typeof v === "string");
  return [];
}

const strip = (p) => p.replace(/^\.\//, "").replace(/\/$/, "");
const basename = (p) => p.slice(p.lastIndexOf("/") + 1);

/** Pure validator over loaded data → `[{ file, msg }]`. */
export function checkPlugin({
  pluginJson,
  marketplaceJson,
  mcpJson,
  typeOf,
  mdFiles,
  skills,
  sharedDocCopies,
  sharedDocRefs,
}) {
  const f = [];
  const add = (file, msg) => f.push({ file, msg });
  if (!pluginJson) {
    add(PLUGIN_JSON, "missing or not valid JSON");
    return f;
  }
  if (!pluginJson.name) add(PLUGIN_JSON, "missing required `name`");
  if (!pluginJson.version) add(PLUGIN_JSON, "missing `version`");

  if (!marketplaceJson) add(MARKETPLACE_JSON, "missing or not valid JSON");
  else {
    const entry = (marketplaceJson.plugins ?? []).find((p) => p.name === pluginJson.name);
    if (!entry) add(MARKETPLACE_JSON, `no plugin entry named "${pluginJson.name}"`);
    else if (entry.version !== pluginJson.version)
      add(
        MARKETPLACE_JSON,
        `entry version "${entry.version}" != plugin.json version "${pluginJson.version}" (keep them in sync)`,
      );
  }

  for (const field of COMPONENT_PATH_FIELDS) {
    if (!(field in pluginJson)) continue;
    for (const p of toPaths(pluginJson[field])) {
      if (!p.startsWith("./"))
        add(PLUGIN_JSON, `${field} path "${p}" must be plugin-relative and start with "./"`);
      else if (typeOf(p) === null) add(PLUGIN_JSON, `${field} path "${p}" does not resolve`);
    }
  }

  for (const s of skills) {
    if (!s.hasSkillMd) add(s.dir, `skills/${basename(s.dir)}: no SKILL.md`);
    else if (!s.name) add(`${s.dir}/SKILL.md`, "missing `name:` in frontmatter");
  }
  const router = skills.find((s) => s.name === ROUTER_SKILL);
  if (!router)
    add(PLUGIN_JSON, `router skill "${ROUTER_SKILL}" not found (the plugin needs a front door)`);
  else if (!router.userInvocable)
    add(
      `${router.dir}/SKILL.md`,
      `router skill "${ROUTER_SKILL}" must be \`user-invocable: true\``,
    );

  if ("agents" in pluginJson)
    for (const p of toPaths(pluginJson.agents))
      if (typeOf(p) === "dir" && mdFiles(p).length === 0)
        add(PLUGIN_JSON, `agents dir "${p}" contains no *.md agents`);

  if (sharedDocCopies) {
    for (const canonical of SHARED_SKILL_DOCS) {
      const copies = sharedDocCopies[canonical] ?? [];
      if (!copies.includes(canonical))
        add(canonical, `shared skill doc "${canonical}" is missing (both flows reference it)`);
      for (const copy of copies)
        if (copy !== canonical)
          add(copy, `shared skill doc duplicated — keep exactly one copy of "${canonical}"`);
    }
  }
  for (const { from, ref } of sharedDocRefs ?? [])
    if (typeOf(ref) === null)
      add(from, `reference to "${ref}" does not resolve (shared skill doc moved?)`);

  if (mcpJson !== undefined) {
    if (!mcpJson || typeof mcpJson !== "object") add(MCP_JSON, "present but not valid JSON");
    else
      for (const [name, cfg] of Object.entries(mcpJson.mcpServers ?? {})) {
        const okHttp = cfg && cfg.type === "http" && typeof cfg.url === "string";
        const okStdio = cfg && typeof cfg.command === "string";
        if (!okHttp && !okStdio)
          add(MCP_JSON, `server "${name}" needs an http \`url\` or a stdio \`command\``);
      }
  }
  return f;
}

function parseFrontmatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const fm = {};
  if (!m) return fm;
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z0-9_-]+)\s*:\s*(.*)$/);
    if (kv) fm[kv[1]] = kv[2].trim().replace(/^["']|["']$/g, "");
  }
  return fm;
}

function readJsonOrNull(ctx, rel) {
  if (!ctx.exists(rel)) return null;
  try {
    return JSON.parse(ctx.readFile(rel));
  } catch {
    return null;
  }
}

/** Build the validator input from ctx. */
export function loadPlugin(ctx) {
  const files = ctx.gitFiles();
  const isDir = (rel) => rel === "" || files.some((f) => f.startsWith(`${rel}/`));
  const typeOf = (p) => {
    const rel = strip(p);
    if (isDir(rel)) return "dir";
    return ctx.exists(rel) ? "file" : null;
  };
  const mdFiles = (p) => {
    const rel = strip(p);
    return files
      .filter((f) => f.startsWith(`${rel}/`) && !f.slice(rel.length + 1).includes("/"))
      .filter((f) => f.endsWith(".md"));
  };

  const pluginJson = readJsonOrNull(ctx, PLUGIN_JSON);
  const skillDirs = pluginJson ? toPaths(pluginJson.skills) : [];
  if (!skillDirs.length) skillDirs.push("./skills");
  const skills = [];
  const pushSkill = (dir) => {
    const hasSkillMd = ctx.exists(`${dir}/SKILL.md`);
    const fm = hasSkillMd ? parseFrontmatter(ctx.readFile(`${dir}/SKILL.md`)) : {};
    skills.push({
      dir,
      hasSkillMd,
      name: fm.name ?? null,
      userInvocable: fm["user-invocable"] === "true",
    });
  };
  for (const sd of skillDirs) {
    const rel = strip(sd);
    if (!isDir(rel)) continue;
    if (ctx.exists(`${rel}/SKILL.md`)) {
      pushSkill(rel); // explicit-curation form
      continue;
    }
    const children = new Set(
      files
        .filter((f) => f.startsWith(`${rel}/`))
        .map((f) => f.slice(rel.length + 1))
        .filter((r) => r.includes("/"))
        .map((r) => r.slice(0, r.indexOf("/"))),
    );
    for (const child of [...children].sort()) pushSkill(`${rel}/${child}`); // container form
  }

  const sharedBasenames = new Map(SHARED_SKILL_DOCS.map((p) => [basename(p), p]));
  const sharedDocCopies = Object.fromEntries(SHARED_SKILL_DOCS.map((p) => [p, []]));
  const sharedDocRefs = [];
  const refRe = /[^\s`()[\]"'<>]*(?:visual-loop)\.md/g;
  for (const rel of files.filter((f) => f.startsWith("skills/") && f.endsWith(".md"))) {
    const canonical = sharedBasenames.get(basename(rel));
    if (canonical) sharedDocCopies[canonical].push(rel);
    const relDir = rel.slice(0, rel.lastIndexOf("/"));
    for (const m of ctx.readFile(rel).matchAll(refRe)) {
      if (m[0].startsWith("/")) continue;
      const stack = [];
      for (const seg of `${relDir}/${m[0]}`.split("/").filter(Boolean)) {
        if (seg === ".") continue;
        if (seg === "..") stack.pop();
        else stack.push(seg);
      }
      const ref = stack.join("/");
      if (!sharedDocRefs.some((r) => r.from === rel && r.ref === ref))
        sharedDocRefs.push({ from: rel, ref });
    }
  }

  return {
    pluginJson,
    marketplaceJson: readJsonOrNull(ctx, MARKETPLACE_JSON),
    mcpJson: ctx.exists(MCP_JSON) ? readJsonOrNull(ctx, MCP_JSON) : undefined,
    typeOf,
    mdFiles,
    skills,
    sharedDocCopies,
    sharedDocRefs,
  };
}

// ── fixtures ─────────────────────────────────────────────────────────────────
const skillMd = (name, inv = false) =>
  `---\nname: ${name}\nuser-invocable: ${inv}\n---\n# ${name}\n`;
function tree({ plugin = {}, market, mcp, extra = {}, drop = [] } = {}) {
  const pluginJson = {
    name: "brand-ui",
    version: "1.0.0",
    skills: "./skills",
    agents: "./agents",
    ...plugin,
  };
  const files = {
    [PLUGIN_JSON]: JSON.stringify(pluginJson),
    [MARKETPLACE_JSON]: JSON.stringify(
      market ?? { plugins: [{ name: "brand-ui", version: "1.0.0" }] },
    ),
    "skills/brand-ui-start/SKILL.md": skillMd("brand-ui-start", true),
    "skills/brand-ui/SKILL.md": skillMd("brand-ui"),
    "skills/brand-ui-new-app/SKILL.md": skillMd("brand-ui-new-app"),
    [SHARED_SKILL_DOCS[0]]: "# shared reference\n",
    "skills/brand-ui-migrate/SKILL.md": `${skillMd("brand-ui-migrate")}Run ../brand-ui-new-app/reference/visual-loop.md\n`,
    "agents/brand-ui-reviewer.md": "---\nname: x\n---\n",
    ...(mcp === undefined
      ? {}
      : { [MCP_JSON]: typeof mcp === "string" ? mcp : JSON.stringify(mcp) }),
    ...extra,
  };
  for (const d of drop) delete files[d];
  return { files };
}

export default {
  id: "plugin-manifest",
  scope: "repo",
  doc: "The Claude plugin installs whole: `plugin.json` and `marketplace.json` agree on version, every declared skill/agent path starts `./` and resolves, the `brand-ui-start` router is user-invocable, MCP servers are http or stdio, and shared skill docs exist exactly once.",
  baseline: "none",
  run: (ctx) => checkPlugin(loadPlugin(ctx)).map((x) => ({ ...x, line: 1 })),
  fixtures: {
    pass: [
      tree(),
      tree({
        mcp: { mcpServers: { storybook: { type: "http", url: "http://localhost:6006/mcp" } } },
      }),
      tree({ mcp: { mcpServers: { local: { command: "node", args: ["x.js"] } } } }),
      // explicit-curation form, reference/ subdir not a fake skill, agent file paths
      tree({
        plugin: {
          skills: ["./skills/brand-ui-start", "./skills/brand-ui-new-app"],
          agents: ["./agents/brand-ui-reviewer.md"],
        },
        extra: { "skills/brand-ui-new-app/reference/rules.md": "x" },
      }),
    ],
    fail: [
      tree({ drop: [PLUGIN_JSON] }),
      tree({ extra: { [PLUGIN_JSON]: "{ nope" } }),
      tree({ plugin: { name: undefined } }),
      tree({ market: { plugins: [{ name: "brand-ui", version: "0.7.0" }] } }),
      tree({ market: { plugins: [{ name: "other", version: "1.0.0" }] } }),
      tree({ plugin: { agents: "./agents-does-not-exist" } }),
      tree({ plugin: { skills: "skills" } }),
      tree({
        plugin: { agents: "./agents" },
        drop: ["agents/brand-ui-reviewer.md"],
        extra: { "agents/readme.txt": "x" },
      }),
      tree({ extra: { "skills/broken/notes.txt": "x" } }),
      tree({ drop: ["skills/brand-ui-start/SKILL.md"] }),
      tree({ extra: { "skills/brand-ui-start/SKILL.md": skillMd("brand-ui-start", false) } }),
      tree({ mcp: { mcpServers: { bad: { type: "http" } } } }),
      tree({ mcp: "{ nope" }),
      tree({ extra: { "skills/brand-ui-migrate/reference/visual-loop.md": "# copy\n" } }),
      tree({ drop: [SHARED_SKILL_DOCS[0]] }),
      tree({
        extra: { "skills/brand-ui/SKILL.md": `${skillMd("brand-ui")}See ../nope/visual-loop.md\n` },
      }),
    ],
  },
};
