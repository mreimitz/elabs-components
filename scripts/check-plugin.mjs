#!/usr/bin/env node
/**
 * check-plugin.mjs — plugin-manifest validity + path-resolution gate (VP-01 #120).
 *
 * The brand-ui plugin (`.claude-plugin/`) is the product's front door for both
 * Claude Code and Cowork. A manifest that declares a skill/agent/MCP path that
 * does not resolve, or a marketplace entry whose version has drifted from the
 * plugin's, installs broken — silently. This gate makes the manifest a checked
 * artifact, not a hand-kept one:
 *
 *   1. JSON VALIDITY — `.claude-plugin/plugin.json` + `marketplace.json` parse.
 *   2. REQUIRED FIELDS — plugin.json has `name` (+ `version` for this plugin).
 *   3. MANIFEST AGREEMENT — the marketplace entry for the plugin exists and its
 *      `version` matches plugin.json's (catches the 0.7.0↔1.0.0 drift).
 *   4. PATHS RESOLVE — every declared component path (`skills`/`agents`/`commands`/
 *      `hooks`/`outputStyles`) starts with `./` and points at an existing file/dir.
 *   5. SKILLS ARE REAL — each skill dir has a `SKILL.md` with a `name`.
 *   6. ROUTER PRESENT — the `brand-ui-start` front-door skill exists and is
 *      `user-invocable`.
 *   7. AGENTS RESOLVE — a declared `agents` dir holds ≥1 `*.md`.
 *   8. MCP SHAPE — the plugin-root `.mcp.json` (auto-adopted by the plugin) parses
 *      and every server is a valid `http` (url) or stdio (`command`) entry.
 *   9. SHARED REFERENCE DOCS (#57) — a doc two skills both run (the visual
 *      feedback loop) exists exactly ONCE, and every cross-skill reference to it
 *      resolves. A second copy is how "both flows call the same loop" quietly
 *      becomes "both flows call their own copy".
 *
 * Run via `pnpm plugin:check`; the self-test (`pnpm plugin:check:test`) drives the
 * pure `checkPlugin()` with in-memory fixtures so the gate itself can't rot.
 *
 * Flags: --warn  never exit non-zero (dev-hook mode); still prints findings.
 *
 * NOTE: this validates the manifest + that paths resolve in THIS repo. It does
 * NOT replace `claude plugin validate --strict` or a live Cowork/Code install —
 * those run a real loader and must be done by a human before release.
 *
 * Dependency-free; locates the plugin relative to this file (cwd-independent).
 */
import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, basename } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = dirname(HERE); // scripts/ -> repo root (the plugin root: source "./")

/** The component path fields whose values are plugin-root-relative paths. */
export const COMPONENT_PATH_FIELDS = ["skills", "agents", "commands", "hooks", "outputStyles"];
/** The user-invocable router skill that is the plugin's front door. */
export const ROUTER_SKILL = "brand-ui-start";

/**
 * Reference docs that MULTIPLE skills share and that must therefore exist exactly
 * ONCE in the bundle (#57). The visual feedback loop is the case this exists for:
 * `brand-ui-new-app` and `brand-ui-migrate` both run it, and the DoD is "both
 * flows call the SAME loop". A second copy would let the two drift silently, so
 * the gate requires one canonical file and cross-skill references pointing at it.
 */
export const SHARED_SKILL_DOCS = ["skills/brand-ui-new-app/reference/visual-loop.md"];

/** Normalize a `string | string[] | object` field to an array of path strings. */
function toPaths(value) {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.filter((v) => typeof v === "string");
  return []; // an inline object (e.g. inline hooks) carries no path to resolve
}

/**
 * The pure validator. Driven by already-loaded data so the self-test is hermetic.
 *
 * @param {object}  input
 * @param {object|null} input.pluginJson      parsed plugin.json (null = parse failed)
 * @param {object|null} input.marketplaceJson parsed marketplace.json (null = parse failed)
 * @param {object|null|undefined} input.mcpJson parsed root .mcp.json (undefined = absent)
 * @param {(rel:string)=>"dir"|"file"|null} input.typeOf  what a plugin-relative path is
 * @param {(rel:string)=>string[]} input.mdFiles  immediate `*.md` children of a dir
 * @param {{name:string|null,dir:string,userInvocable:boolean,hasSkillMd:boolean}[]} input.skills
 * @returns {string[]} findings (empty = valid)
 */
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
  const findings = [];

  // 1–2. plugin.json validity + required fields.
  if (!pluginJson) {
    findings.push(".claude-plugin/plugin.json: missing or not valid JSON");
    return findings; // nothing else is checkable without the manifest
  }
  if (!pluginJson.name) findings.push("plugin.json: missing required `name`");
  if (!pluginJson.version) findings.push("plugin.json: missing `version`");

  // 3. marketplace agreement.
  if (!marketplaceJson) {
    findings.push(".claude-plugin/marketplace.json: missing or not valid JSON");
  } else {
    const entry = (marketplaceJson.plugins ?? []).find((p) => p.name === pluginJson.name);
    if (!entry) {
      findings.push(`marketplace.json: no plugin entry named "${pluginJson.name}"`);
    } else if (entry.version !== pluginJson.version) {
      findings.push(
        `marketplace.json: entry version "${entry.version}" != plugin.json version "${pluginJson.version}" (keep them in sync)`,
      );
    }
  }

  // 4. component paths resolve.
  for (const field of COMPONENT_PATH_FIELDS) {
    if (!(field in pluginJson)) continue;
    for (const p of toPaths(pluginJson[field])) {
      if (!p.startsWith("./")) {
        findings.push(
          `plugin.json: ${field} path "${p}" must be plugin-relative and start with "./"`,
        );
        continue;
      }
      if (typeOf(p) === null) findings.push(`plugin.json: ${field} path "${p}" does not resolve`);
    }
  }

  // 5–6. skills are real + the router is present and user-invocable.
  for (const s of skills) {
    if (!s.hasSkillMd) findings.push(`skills/${basename(s.dir)}: no SKILL.md`);
    else if (!s.name) findings.push(`${s.dir}/SKILL.md: missing \`name:\` in frontmatter`);
  }
  const router = skills.find((s) => s.name === ROUTER_SKILL);
  if (!router) {
    findings.push(`router skill "${ROUTER_SKILL}" not found (the plugin needs a front door)`);
  } else if (!router.userInvocable) {
    findings.push(`router skill "${ROUTER_SKILL}" must be \`user-invocable: true\``);
  }

  // 7. a declared agents dir holds ≥1 *.md.
  if ("agents" in pluginJson) {
    for (const p of toPaths(pluginJson.agents)) {
      if (typeOf(p) === "dir" && mdFiles(p).length === 0)
        findings.push(`plugin.json: agents dir "${p}" contains no *.md agents`);
    }
  }

  // 9. shared reference docs exist exactly once, and every cross-skill reference
  //    resolves. Skipped when the caller does not supply the inputs (the hermetic
  //    self-test drives this rule with its own fixtures).
  if (sharedDocCopies) {
    for (const canonical of SHARED_SKILL_DOCS) {
      const copies = sharedDocCopies[canonical] ?? [];
      if (!copies.includes(canonical)) {
        findings.push(`shared skill doc "${canonical}" is missing (both flows reference it)`);
      }
      for (const copy of copies) {
        if (copy !== canonical)
          findings.push(
            `shared skill doc duplicated at "${copy}" — there must be exactly one copy of "${canonical}", or the two silently drift`,
          );
      }
    }
  }
  for (const { from, ref } of sharedDocRefs ?? []) {
    if (typeOf(ref) === null)
      findings.push(`${from}: reference to "${ref}" does not resolve (shared skill doc moved?)`);
  }

  // 8. MCP shape (the plugin auto-adopts the plugin-root .mcp.json).
  if (mcpJson !== undefined) {
    if (!mcpJson || typeof mcpJson !== "object") {
      findings.push(".mcp.json: present but not valid JSON");
    } else {
      const servers = mcpJson.mcpServers ?? {};
      for (const [name, cfg] of Object.entries(servers)) {
        const okHttp = cfg && cfg.type === "http" && typeof cfg.url === "string";
        const okStdio = cfg && typeof cfg.command === "string";
        if (!okHttp && !okStdio)
          findings.push(`.mcp.json: server "${name}" needs an http \`url\` or a stdio \`command\``);
      }
    }
  }

  return findings;
}

// ---- disk loaders (the real-FS half; the self-test bypasses these) ---------

function readJson(abs) {
  if (!existsSync(abs)) return null;
  try {
    return JSON.parse(readFileSync(abs, "utf8"));
  } catch {
    return null;
  }
}

function parseFrontmatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return {};
  const fm = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z0-9_-]+)\s*:\s*(.*)$/);
    if (kv) fm[kv[1]] = kv[2].trim().replace(/^["']|["']$/g, "");
  }
  return fm;
}

/** Build the validator input from the repo's real plugin tree. */
export function loadPlugin(root = REPO_ROOT) {
  const typeOf = (rel) => {
    const abs = join(root, rel);
    if (!existsSync(abs)) return null;
    return statSync(abs).isDirectory() ? "dir" : "file";
  };
  const mdFiles = (rel) => {
    const abs = join(root, rel);
    if (!existsSync(abs) || !statSync(abs).isDirectory()) return [];
    return readdirSync(abs).filter((f) => f.endsWith(".md"));
  };

  // Discover skills from each declared `skills` path (default "./skills"). A
  // declared path may be EITHER a single skill dir (it has its own SKILL.md — the
  // explicit-curation form, e.g. "./skills/brand-ui-audit") OR a CONTAINER of skill
  // dirs (no SKILL.md of its own — the "./skills" form, every child is a skill).
  // Handle both so the gate works whichever form plugin.json uses.
  const pluginJson = readJson(join(root, ".claude-plugin", "plugin.json"));
  const skillDirs = pluginJson ? toPaths(pluginJson.skills) : [];
  if (!skillDirs.length) skillDirs.push("./skills");
  const skills = [];
  const pushSkill = (relDir, absDir) => {
    const skillMd = join(absDir, "SKILL.md");
    const hasSkillMd = existsSync(skillMd);
    const fm = hasSkillMd ? parseFrontmatter(readFileSync(skillMd, "utf8")) : {};
    skills.push({
      dir: relDir,
      hasSkillMd,
      name: fm.name ?? null,
      userInvocable: fm["user-invocable"] === "true" || fm["user-invocable"] === true,
    });
  };
  for (const sd of skillDirs) {
    const absSd = join(root, sd);
    if (!existsSync(absSd) || !statSync(absSd).isDirectory()) continue;
    const rel = sd.replace(/^\.\//, "");
    if (existsSync(join(absSd, "SKILL.md"))) {
      // The declared path IS a skill (explicit-curation form).
      pushSkill(rel, absSd);
      continue;
    }
    // The declared path CONTAINS skills (container form); each child dir is a skill.
    for (const entry of readdirSync(absSd)) {
      const dirAbs = join(absSd, entry);
      if (!statSync(dirAbs).isDirectory()) continue;
      pushSkill(`${rel}/${entry}`, dirAbs);
    }
  }

  // Shared-doc bookkeeping (#57): where each SHARED_SKILL_DOCS basename actually
  // lives under skills/, and every markdown reference to one of those basenames,
  // resolved to a repo-relative path so `typeOf` can confirm it exists.
  const sharedBasenames = new Map(SHARED_SKILL_DOCS.map((p) => [basename(p), p]));
  const sharedDocCopies = Object.fromEntries(SHARED_SKILL_DOCS.map((p) => [p, []]));
  const sharedDocRefs = [];
  const refRe = /[^\s`()[\]"'<>]*(?:visual-loop)\.md/g;
  const walkMd = (absDir, relDir) => {
    if (!existsSync(absDir) || !statSync(absDir).isDirectory()) return;
    for (const entry of readdirSync(absDir)) {
      const abs = join(absDir, entry);
      const rel = `${relDir}/${entry}`;
      if (statSync(abs).isDirectory()) {
        walkMd(abs, rel);
        continue;
      }
      if (!entry.endsWith(".md")) continue;
      const canonical = sharedBasenames.get(entry);
      if (canonical) sharedDocCopies[canonical].push(rel);
      for (const m of readFileSync(abs, "utf8").matchAll(refRe)) {
        const token = m[0];
        if (token.startsWith("/")) continue; // absolute — not ours to resolve
        // Resolve relative to the referencing file's directory.
        const resolved = join(relDir, token).split("/").filter(Boolean);
        const stack = [];
        for (const seg of resolved) {
          if (seg === ".") continue;
          if (seg === "..") stack.pop();
          else stack.push(seg);
        }
        const refPath = stack.join("/");
        if (!sharedDocRefs.some((r) => r.from === rel && r.ref === refPath))
          sharedDocRefs.push({ from: rel, ref: refPath });
      }
    }
  };
  walkMd(join(root, "skills"), "skills");

  return {
    pluginJson,
    marketplaceJson: readJson(join(root, ".claude-plugin", "marketplace.json")),
    mcpJson: existsSync(join(root, ".mcp.json")) ? readJson(join(root, ".mcp.json")) : undefined,
    typeOf,
    mdFiles,
    skills,
    sharedDocCopies,
    sharedDocRefs,
  };
}

// Only run the gate when executed directly (not when imported by the self-test).
const invokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (invokedDirectly) {
  const WARN = process.argv.includes("--warn");
  const findings = checkPlugin(loadPlugin());
  if (findings.length) {
    console.error(`✖ plugin manifest (${findings.length} problem(s)):`);
    for (const f of findings) console.error("  - " + f);
    console.error(
      "\n  Fix: keep .claude-plugin/plugin.json + marketplace.json valid and in sync,\n" +
        "  and make every declared skill/agent/MCP path resolve. (Does NOT replace\n" +
        "  `claude plugin validate --strict` or a live Cowork/Code install.)",
    );
    if (!WARN) process.exit(1);
  } else {
    console.log("✔ plugin: manifest valid, marketplace in sync, paths resolve, router present.");
  }
}
