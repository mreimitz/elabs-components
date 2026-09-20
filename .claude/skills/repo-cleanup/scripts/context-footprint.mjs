#!/usr/bin/env node
/**
 * context-footprint.mjs — what does this repo cost BEFORE any work happens?
 *
 * Measures every surface that is loaded into the model's context at session
 * start, whether or not the session ever uses it: instruction files, the skill
 * listing, agent descriptions, MCP wiring, hooks. Emits bytes and an explicitly
 * ESTIMATED token count per surface.
 *
 * What this script does NOT do, on purpose:
 *  - It does not decide anything is "bloat". It emits measurements plus
 *    deterministic `observations`; the model turns those into findings with a
 *    severity and a confidence (references/finding-model.md).
 *  - It does not execute SessionStart hooks to size their output. Running a
 *    hook to measure it is a mutating act. Hook output is reported as a named
 *    MEASUREMENT GAP, which is the honest answer.
 *  - It does not read file bodies into the report. Only sizes and paths.
 *
 * Calibration: compare `totals.estimatedTokens` against the real floor from
 * usage-forensics.mjs (request #1 of a fresh session). The residual is harness
 * overhead — system prompt, tool schemas, built-in skills — and naming it stops
 * us blaming CLAUDE.md for bytes it does not own.
 *
 * Usage: node context-footprint.mjs [--root <dir>] [--json]
 * Zero dependencies. Node >= 22.
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { basename, join, relative } from "node:path";
import { estimateTokens, findRepoRoot, loadConfig } from "./config.mjs";
import { redact } from "./redact.mjs";

/**
 * The user-level `.claude` directory is a MEASUREMENT INPUT, not a constant.
 * Hardcoding `~/.claude` makes every result depend on the developer's machine
 * and makes fixture tests unwritable — so it is resolvable, and the resolved
 * path is reported in the output so a reader can see what was included.
 */
function resolveUserClaudeDir(opts = {}) {
  return (
    opts.userClaudeDir ?? process.env.REPO_CLEANUP_USER_CLAUDE_DIR ?? join(homedir(), ".claude")
  );
}

/** Claude Code's default per-skill description cap in the listing. */
const DEFAULT_SKILL_DESC_CAP = 1536;

// --------------------------------------------------------------------------
// small fs helpers — all absence-tolerant
// --------------------------------------------------------------------------

function size(path) {
  try {
    return statSync(path).size;
  } catch {
    return 0;
  }
}

function mtime(path) {
  try {
    return statSync(path).mtimeMs;
  } catch {
    return 0;
  }
}

function read(path) {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return null;
  }
}

function readJson(path) {
  const t = read(path);
  if (t === null) return null;
  try {
    return JSON.parse(t);
  } catch {
    return null;
  }
}

function listFiles(dir, ext = ".md") {
  try {
    return readdirSync(dir)
      .filter((f) => f.endsWith(ext))
      .map((f) => join(dir, f));
  } catch {
    return [];
  }
}

function listDirs(dir) {
  try {
    return readdirSync(dir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => join(dir, d.name));
  } catch {
    return [];
  }
}

/** Minimal frontmatter reader: returns { name, description, ... } for scalar keys. */
function frontmatter(text) {
  if (!text?.startsWith("---")) return {};
  const end = text.indexOf("\n---", 3);
  if (end === -1) return {};
  const block = text.slice(4, end);
  /** @type {Record<string,string>} */
  const out = {};
  let key = null;
  for (const line of block.split("\n")) {
    const m = /^([A-Za-z0-9_-]+):\s?(.*)$/.exec(line);
    if (m?.[1]) {
      key = m[1];
      out[key] = m[2] ?? "";
    } else if (key && /^\s+\S/.test(line)) {
      // folded continuation of the previous scalar
      out[key] = `${out[key]} ${line.trim()}`;
    }
  }
  return out;
}

/**
 * `paths:` frontmatter makes a rule file PATH-SCOPED: Claude Code loads it only
 * while a matching file is in play, so it is NOT a per-request cost. Counting
 * every `.claude/rules/*.md` as always-on overstated this repo's per-request
 * instruction footprint by 32,539 bytes — 9 of 12 rule files are scoped.
 *
 * Returns the globs (possibly empty, if `paths:` is present but unreadable) for
 * a scoped rule, or `null` for an always-on one. `frontmatter()` above folds a
 * list into one scalar string, which is fine for a description and useless
 * here, so this reads the block itself.
 *
 * @param {string | null} text
 * @returns {string[] | null}
 */
function pathScope(text) {
  if (!text?.startsWith("---")) return null;
  const end = text.indexOf("\n---", 3);
  if (end === -1) return null;
  const lines = text.slice(4, end).split("\n");
  const i = lines.findIndex((l) => /^paths:/.test(l));
  if (i === -1) return null;

  const unquote = (s) => s.trim().replace(/^["']|["']$/g, "");
  /** @type {string[]} */
  const globs = [];
  const inline = lines[i].slice("paths:".length).trim();
  if (inline.startsWith("[")) {
    for (const p of inline.replace(/^\[|\]$/g, "").split(",")) {
      const v = unquote(p);
      if (v) globs.push(v);
    }
  } else if (inline && inline !== "|" && inline !== ">") {
    globs.push(unquote(inline));
  }
  for (let j = i + 1; j < lines.length; j++) {
    const m = /^\s*-\s*(.+)$/.exec(lines[j]);
    if (!m) break;
    const v = unquote(m[1]);
    if (v) globs.push(v);
  }
  return globs;
}

// --------------------------------------------------------------------------
// settings chain (user < project < local)
// --------------------------------------------------------------------------

function loadSettingsChain(root, userDir) {
  const layers = [
    { scope: "user", path: join(userDir, "settings.json") },
    { scope: "project", path: join(root, ".claude", "settings.json") },
    { scope: "local", path: join(root, ".claude", "settings.local.json") },
  ];
  /** @type {Record<string, unknown>} */
  const merged = {};
  const present = [];
  for (const layer of layers) {
    const json = readJson(layer.path);
    if (!json) continue;
    present.push(layer.scope);
    for (const [k, v] of Object.entries(json)) {
      merged[k] =
        v &&
        typeof v === "object" &&
        !Array.isArray(v) &&
        merged[k] &&
        typeof merged[k] === "object"
          ? { ...merged[k], ...v }
          : v;
    }
  }
  return { merged, present };
}

// --------------------------------------------------------------------------
// surfaces
// --------------------------------------------------------------------------

/** Instruction files that load on every request. */
function measureInstructions(root, userDir) {
  /** @type {{ path: string, scope: string, bytes: number, alwaysLoaded: boolean, note?: string }[]} */
  const entries = [];

  const userMd = join(userDir, "CLAUDE.md");
  if (existsSync(userMd))
    entries.push({
      path: "~/.claude/CLAUDE.md",
      scope: "user",
      bytes: size(userMd),
      alwaysLoaded: true,
    });

  const projMd = join(root, "CLAUDE.md");
  if (existsSync(projMd))
    entries.push({ path: "CLAUDE.md", scope: "project", bytes: size(projMd), alwaysLoaded: true });

  for (const f of listFiles(join(root, ".claude", "rules"))) {
    const globs = pathScope(read(f));
    if (globs === null) {
      entries.push({
        path: relative(root, f),
        scope: "project-rules",
        bytes: size(f),
        alwaysLoaded: true,
      });
    } else {
      entries.push({
        path: relative(root, f),
        scope: "project-rules-scoped",
        bytes: size(f),
        alwaysLoaded: false,
        matchPaths: globs,
        note: "`paths:` frontmatter — loads only when a matching file is touched",
      });
    }
  }

  // Nested CLAUDE.md files load only while working inside their directory —
  // real cost, but conditional. Counted separately so the always-loaded total
  // stays honest.
  const nested = [];
  const walk = (dir, depth) => {
    if (depth > 4) return;
    for (const d of listDirs(dir)) {
      const b = basename(d);
      if (b === "node_modules" || b === ".git" || b.startsWith(".")) continue;
      const md = join(d, "CLAUDE.md");
      if (existsSync(md)) nested.push({ path: relative(root, md), bytes: size(md) });
      walk(d, depth + 1);
    }
  };
  walk(root, 0);
  for (const n of nested) {
    entries.push({
      path: n.path,
      scope: "project-nested",
      bytes: n.bytes,
      alwaysLoaded: false,
      note: "loads only while working in this subtree",
    });
  }

  return entries;
}

/**
 * Resolve enabled plugin ids to their cached skill/agent directories — ONE
 * directory per plugin.
 *
 * The cache keeps every version ever installed side by side
 * (`plugins/cache/<marketplace>/<plugin>/<version>/`), and an earlier version
 * of this function returned all of them. Every surface the plugin contributes
 * was then counted once per version directory: on this machine one plugin had
 * eleven, so its agents, commands and MCP servers were counted eleven times and
 * the listing measurement was nonsense. Claude Code loads one version; the
 * stale copies are disk, never context.
 *
 * Which one is loaded is not knowable from the cache, so the newest by mtime is
 * measured (preferring a directory that actually holds plugin content, and
 * tie-broken by name so the result is deterministic), and the number of stale
 * directories is reported rather than silently dropped.
 */
function resolvePluginRoots(settings, userDir) {
  const enabled = settings.enabledPlugins ?? {};
  /** @type {{ id: string, dir: string, version: string, staleVersionDirs: number }[]} */
  const roots = [];
  for (const [id, on] of Object.entries(enabled)) {
    if (on === false) continue;
    const [plugin, marketplace] = String(id).split("@");
    if (!plugin || !marketplace) continue;
    const base = join(userDir, "plugins", "cache", marketplace, plugin);
    const versionDirs = listDirs(base);
    if (versionDirs.length === 0) continue;
    const hasContent = (d) =>
      existsSync(join(d, ".claude-plugin", "plugin.json")) ||
      ["skills", "agents", "commands", "hooks"].some((s) => existsSync(join(d, s)));
    const chosen = [...versionDirs].sort(
      (a, b) =>
        Number(hasContent(b)) - Number(hasContent(a)) ||
        mtime(b) - mtime(a) ||
        (a < b ? 1 : a > b ? -1 : 0),
    )[0];
    roots.push({
      id,
      dir: chosen,
      version: basename(chosen),
      staleVersionDirs: versionDirs.length - 1,
    });
  }
  return roots;
}

/**
 * The skill listing: one name + (capped) description per discovered skill,
 * injected into the system prompt every request. This is the surface that grows
 * silently when a plugin is enabled.
 */
function measureSkillListing(root, settings, userDir) {
  const cap = Number(settings.skillListingMaxDescChars ?? DEFAULT_SKILL_DESC_CAP);
  const overrides = settings.skillOverrides ?? {};
  /** @type {{ name: string, origin: string, descChars: number, cappedChars: number, skillMdBytes: number, hidden: boolean }[]} */
  const skills = [];

  const collect = (skillsDir, origin) => {
    for (const d of listDirs(skillsDir)) {
      const md = join(d, "SKILL.md");
      if (!existsSync(md)) continue;
      const text = read(md) ?? "";
      const fm = frontmatter(text);
      const name = fm.name ?? basename(d);
      const desc = fm.description ?? "";
      const mode = overrides[name];
      const hidden = mode === "off" || mode === "user-invocable-only";
      const listed = mode === "name-only" || hidden ? 0 : Math.min(desc.length, cap);
      skills.push({
        name,
        origin,
        descChars: desc.length,
        cappedChars: listed,
        skillMdBytes: size(md),
        hidden,
      });
    }
  };

  collect(join(root, ".claude", "skills"), "project");
  collect(join(userDir, "skills"), "user");
  for (const { id, dir } of resolvePluginRoots(settings, userDir))
    collect(join(dir, "skills"), `plugin:${id}`);

  return { cap, skills };
}

/** Agent descriptions are listed for the Agent tool on every request. */
function measureAgentListing(root, settings, userDir) {
  /** @type {{ name: string, origin: string, descChars: number, bytes: number }[]} */
  const agents = [];
  const collect = (dir, origin) => {
    for (const f of listFiles(dir)) {
      const fm = frontmatter(read(f) ?? "");
      agents.push({
        name: fm.name ?? basename(f, ".md"),
        origin,
        descChars: (fm.description ?? "").length,
        bytes: size(f),
      });
    }
  };
  collect(join(root, ".claude", "agents"), "project");
  collect(join(userDir, "agents"), "user");
  for (const { id, dir } of resolvePluginRoots(settings, userDir))
    collect(join(dir, "agents"), `plugin:${id}`);
  return agents;
}

/** Slash commands contribute name + description to the listing. */
function measureCommands(root, settings, userDir) {
  /** @type {{ name: string, origin: string, descChars: number, bytes: number }[]} */
  const commands = [];
  const collect = (dir, origin) => {
    for (const f of listFiles(dir)) {
      const fm = frontmatter(read(f) ?? "");
      commands.push({
        name: basename(f, ".md"),
        origin,
        descChars: (fm.description ?? "").length,
        bytes: size(f),
      });
    }
  };
  collect(join(root, ".claude", "commands"), "project");
  collect(join(userDir, "commands"), "user");
  for (const { id, dir } of resolvePluginRoots(settings, userDir))
    collect(join(dir, "commands"), `plugin:${id}`);
  return commands;
}

/**
 * MCP servers. Tool schemas are the expensive part and they are only knowable
 * by connecting, which this read-only audit will not do — so tool count is a
 * declared MEASUREMENT GAP, not a zero.
 */
function measureMcp(root, settings, userDir) {
  const projectMcp = readJson(join(root, ".mcp.json"));
  const servers = Object.keys(projectMcp?.mcpServers ?? {});
  /** @type {string[]} */
  const pluginServers = [];
  for (const { id, dir } of resolvePluginRoots(settings, userDir)) {
    const manifest = readJson(join(dir, ".claude-plugin", "plugin.json"));
    if (manifest?.mcpServers)
      pluginServers.push(...Object.keys(manifest.mcpServers).map((s) => `${id}:${s}`));
    if (existsSync(join(dir, ".mcp.json"))) pluginServers.push(`${id}:(.mcp.json)`);
  }
  return {
    projectServers: servers,
    pluginServers,
    claudeAiConnectorsDisabled: settings.disableClaudeAiConnectors === true,
    toolSchemaBytes: null,
    measurementGap:
      "tool names and schemas are only knowable by connecting to each server; this audit is read-only and does not connect",
  };
}

/**
 * SessionStart / UserPromptSubmit hooks inject text every session. Their OUTPUT
 * size is not knowable statically, and running one to find out is a mutating
 * act — so this reports declarations and script sizes, and names the gap.
 *
 * Hooks come from two places and BOTH must be scanned. Missing the second is a
 * real under-report: this repo's settings.json declares no injecting hook, yet
 * two fire every session from an enabled plugin.
 *  1. the settings chain — `settings.hooks`
 *  2. enabled plugins — `.claude-plugin/plugin.json#hooks` OR `hooks/hooks.json`
 */
function measureHooks(root, settings, userDir) {
  /** @type {{ event: string, matcher: string, kind: string, origin: string, script: string | null, scriptBytes: number }[]} */
  const out = [];

  const collect = (hooksObj, origin, baseDir) => {
    for (const [event, groups] of Object.entries(hooksObj ?? {})) {
      if (!Array.isArray(groups)) continue;
      for (const g of groups) {
        for (const h of g?.hooks ?? []) {
          const cmd = typeof h?.command === "string" ? h.command : "";
          const m = /([\w./$@{}-]+\.(?:mjs|js|sh|py|ts))/.exec(cmd);
          const raw = m?.[1]?.replace(/^"|"$/g, "") ?? null;
          const rel =
            raw?.replace("$CLAUDE_PROJECT_DIR/", "").replace("${CLAUDE_PLUGIN_ROOT}/", "") ?? null;
          out.push({
            event,
            matcher: g?.matcher ?? "*",
            kind: h?.type ?? "command",
            origin,
            script: rel,
            scriptBytes: rel ? size(join(baseDir, rel)) : 0,
          });
        }
      }
    }
  };

  collect(settings.hooks, "settings", root);
  for (const { id, dir } of resolvePluginRoots(settings, userDir)) {
    const manifest = readJson(join(dir, ".claude-plugin", "plugin.json"));
    if (manifest?.hooks) collect(manifest.hooks, `plugin:${id}`, dir);
    const standalone = readJson(join(dir, "hooks", "hooks.json"));
    if (standalone) collect(standalone.hooks ?? standalone, `plugin:${id}`, dir);
  }

  const injecting = out.filter((h) => h.event === "SessionStart" || h.event === "UserPromptSubmit");
  return {
    hooks: out,
    contextInjectingHooks: injecting.length,
    measurementGap:
      injecting.length > 0
        ? "SessionStart/UserPromptSubmit hooks inject text into every session; their OUTPUT size is not measured because running a hook to size it is a mutating act"
        : null,
  };
}

/** The settings levers that govern per-request cost. */
function readLevers(settings) {
  const plugins = settings.enabledPlugins ?? {};
  return {
    model: settings.model ?? null,
    effortLevel: settings.effortLevel ?? null,
    autoCompactEnabled: settings.autoCompactEnabled ?? null,
    autoCompactWindow: settings.autoCompactWindow ?? null,
    disableClaudeAiConnectors: settings.disableClaudeAiConnectors ?? null,
    skillListingMaxDescChars: settings.skillListingMaxDescChars ?? null,
    skillListingBudgetFraction: settings.skillListingBudgetFraction ?? null,
    enabledPluginCount: Object.values(plugins).filter((v) => v !== false).length,
    disabledPluginCount: Object.values(plugins).filter((v) => v === false).length,
    skillOverrideCount: Object.keys(settings.skillOverrides ?? {}).length,
  };
}

// --------------------------------------------------------------------------
// deterministic observations (facts, not findings)
// --------------------------------------------------------------------------

function buildObservations(result) {
  const obs = [];
  const push = (code, statement, data) => obs.push({ code, statement, data });
  const t = result.totals;

  push("CTX.always-loaded-total", "instruction bytes loaded on every request", {
    bytes: t.alwaysLoadedBytes,
    estimatedTokens: t.alwaysLoadedEstimatedTokens,
  });

  const scoped = result.instructions.filter((e) => e.scope === "project-rules-scoped");
  if (scoped.length) {
    push(
      "CTX.path-scoped-rules",
      "rule files carrying `paths:` frontmatter — loaded only when a matching file is touched, so they are NOT part of the per-request figure above",
      {
        files: scoped.length,
        bytes: t.pathScopedRuleBytes,
        estimatedTokens: t.pathScopedRuleEstimatedTokens,
        paths: scoped.map((e) => e.path),
      },
    );
  }

  const biggest = [...result.instructions]
    .filter((e) => e.alwaysLoaded)
    .sort((a, b) => b.bytes - a.bytes)
    .slice(0, 5);
  if (biggest.length)
    push("CTX.largest-instruction-files", "largest always-loaded instruction files", biggest);

  const listed = result.skillListing.skills.filter((s) => !s.hidden);
  push("CTX.skill-listing", "skills contributing to the listing", {
    listedSkills: listed.length,
    hiddenSkills: result.skillListing.skills.length - listed.length,
    listingChars: listed.reduce((n, s) => n + s.cappedChars, 0),
    truncatedSkills: listed.filter((s) => s.descChars > result.skillListing.cap).map((s) => s.name),
  });

  const byOrigin = {};
  for (const s of listed) {
    const key = s.origin.startsWith("plugin:") ? s.origin : s.origin;
    byOrigin[key] = (byOrigin[key] ?? 0) + s.cappedChars;
  }
  push("CTX.skill-listing-by-origin", "listing characters attributable to each origin", byOrigin);

  if (result.levers.model && /\[1m\]/.test(String(result.levers.model))) {
    push(
      "CTX.long-context-model",
      "a 1M-context model is configured; without a compaction window, per-request cost grows linearly with turn count",
      { model: result.levers.model, autoCompactWindow: result.levers.autoCompactWindow },
    );
  }
  if (result.levers.autoCompactWindow === null) {
    push(
      "CTX.no-compact-window",
      "no autoCompactWindow is configured; the default for the model applies",
      {},
    );
  }
  if (result.hooks.contextInjectingHooks > 0) {
    push("CTX.injecting-hooks", "hooks inject text into every session (output size unmeasured)", {
      count: result.hooks.contextInjectingHooks,
    });
  }
  if (result.plugins.staleVersionDirsTotal > 0) {
    push(
      "CTX.plugin-version-dirs",
      "the plugin cache holds more than one version directory per plugin; one is loaded and the surfaces below are counted once",
      {
        staleVersionDirsTotal: result.plugins.staleVersionDirsTotal,
        plugins: result.plugins.enabled.filter((p) => p.staleVersionDirs > 0),
      },
    );
  }
  if (result.mcp.projectServers.length + result.mcp.pluginServers.length > 0) {
    push("CTX.mcp-servers", "MCP servers configured (tool schema cost unmeasured)", {
      project: result.mcp.projectServers,
      plugin: result.mcp.pluginServers,
      claudeAiConnectorsDisabled: result.mcp.claudeAiConnectorsDisabled,
    });
  }
  return obs;
}

// --------------------------------------------------------------------------
// main
// --------------------------------------------------------------------------

/** @param {string} [rootArg] */
export function measureContextFootprint(rootArg, opts = {}) {
  const root = rootArg ?? findRepoRoot();
  const userDir = resolveUserClaudeDir(opts);
  const { warnings } = loadConfig(root);
  const { merged: settings, present } = loadSettingsChain(root, userDir);

  const instructions = measureInstructions(root, userDir);
  const skillListing = measureSkillListing(root, settings, userDir);
  const agents = measureAgentListing(root, settings, userDir);
  const commands = measureCommands(root, settings, userDir);
  const mcp = measureMcp(root, settings, userDir);
  const hooks = measureHooks(root, settings, userDir);
  const levers = readLevers(settings);

  const pluginRoots = resolvePluginRoots(settings, userDir);
  const sumBytes = (pred) => instructions.filter(pred).reduce((n, e) => n + e.bytes, 0);
  const alwaysLoadedBytes = sumBytes((e) => e.alwaysLoaded);
  const pathScopedRuleBytes = sumBytes((e) => e.scope === "project-rules-scoped");
  const nestedInstructionBytes = sumBytes((e) => e.scope === "project-nested");
  const conditionalBytes = sumBytes((e) => !e.alwaysLoaded);
  const listingChars =
    skillListing.skills.filter((s) => !s.hidden).reduce((n, s) => n + s.cappedChars, 0) +
    agents.reduce((n, a) => n + a.descChars, 0) +
    commands.reduce((n, c) => n + c.descChars, 0);

  const result = {
    schema: "repo-cleanup/context-footprint@1",
    root,
    userClaudeDir: userDir,
    generatedBy: "context-footprint.mjs",
    settingsLayersPresent: present,
    configWarnings: warnings,
    tokenEstimate: {
      method: "chars / 4",
      caveat:
        "ESTIMATE ONLY — never present as API billing data. Calibrate against usage-forensics.mjs.",
    },
    instructions,
    skillListing,
    agents,
    commands,
    mcp,
    hooks,
    levers,
    plugins: {
      enabled: pluginRoots.map(({ id, version, staleVersionDirs }) => ({
        id,
        measuredVersionDir: version,
        staleVersionDirs,
      })),
      staleVersionDirsTotal: pluginRoots.reduce((n, p) => n + p.staleVersionDirs, 0),
      note: "the plugin cache keeps every installed version side by side; Claude Code loads one, so each plugin's skills, agents, commands and MCP servers are counted ONCE. Stale version directories cost disk, never context.",
    },
    totals: {
      alwaysLoadedBytes,
      alwaysLoadedEstimatedTokens: estimateTokens(alwaysLoadedBytes),
      pathScopedRuleBytes,
      pathScopedRuleEstimatedTokens: estimateTokens(pathScopedRuleBytes),
      nestedInstructionBytes,
      conditionalInstructionBytes: conditionalBytes,
      instructionBytesIfEveryScopeMatched: alwaysLoadedBytes + conditionalBytes,
      listingChars,
      listingEstimatedTokens: estimateTokens(listingChars),
      combinedEstimatedTokens: estimateTokens(alwaysLoadedBytes + listingChars),
    },
    totalsLegend: {
      alwaysLoadedBytes: "instruction files loaded on EVERY request — the per-request figure",
      pathScopedRuleBytes:
        "`.claude/rules/*.md` carrying `paths:` — loaded only when a matching file is touched; NOT per-request",
      nestedInstructionBytes: "nested CLAUDE.md files — loaded only while working in that subtree",
      conditionalInstructionBytes: "pathScopedRuleBytes + nestedInstructionBytes",
      instructionBytesIfEveryScopeMatched:
        "worst-case upper bound if every scope matched at once — never quote this as the per-request cost",
      combinedEstimatedTokens:
        "alwaysLoadedBytes + listingChars — the per-request floor (estimate)",
    },
    measurementGaps: [mcp.measurementGap, hooks.measurementGap].filter(Boolean),
  };

  result.observations = buildObservations(result);
  // Belt: paths and names are user-derived. Nothing here should be secret-shaped,
  // but the seam is unconditional by design (safety-model.md).
  return JSON.parse(redact(JSON.stringify(result)));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const rootFlag = process.argv.indexOf("--root");
  const root = rootFlag !== -1 ? process.argv[rootFlag + 1] : undefined;
  process.stdout.write(`${JSON.stringify(measureContextFootprint(root), null, 2)}\n`);
}
