/**
 * context.mjs — the ONLY way a check rule touches the repository.
 *
 * Two backings, one API:
 *   - createFsContext(root)       the real tree (git-listed files, read from disk)
 *   - createMemoryContext(files)  a fixture: `{ "rel/path": "content" }`
 *
 * Because rules never import `node:fs`, every rule's fixtures run hermetically
 * against the memory backing. Everything is cached per context, and the runner
 * shares ONE fs context across all rules (one `git ls-files`, one read per file).
 *
 * Paths are always repo-relative, forward-slash (`packages/ui/src/x.tsx`).
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { parseStringArray } from "../lib/active-themes.mjs";
import { isDistributable } from "../lib/distributables.mjs";
import { joinThemeSources } from "../lib/theme-sources.mjs";
import { lintFiles, lintTexts } from "./eslint.mjs";

export const THEME_TYPES = "packages/tokens/src/theme-types.ts";
export const THEMES_ENGINE_CSS = "packages/tokens/src/themes.css";
export const themeCssPath = (name) => `packages/tokens/src/themes/${name}.css`;

// ─────────────────────────────── glob ─────────────────────────────────────────

/** Glob body → regex source. Supports `**`, `*`, `?`, `{a,b}` (not nested). */
function globSource(glob) {
  let re = "";
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === "*" && glob[i + 1] === "*") {
      if (glob[i + 2] === "/") {
        re += "(?:.*/)?";
        i += 2;
      } else {
        re += ".*";
        i += 1;
      }
    } else if (c === "*") re += "[^/]*";
    else if (c === "?") re += "[^/]";
    else if (c === "{") {
      const end = glob.indexOf("}", i);
      if (end === -1) throw new Error(`glob: unclosed { in ${glob}`);
      re += `(?:${glob
        .slice(i + 1, end)
        .split(",")
        .map(globSource)
        .join("|")})`;
      i = end;
    } else re += c.replace(/[.+^$()|[\]\\]/g, "\\$&");
  }
  return re;
}

/** Compile a glob (or array of globs) into a path predicate. */
export function globMatcher(patterns) {
  const list = [patterns ?? []].flat();
  const res = list.map((g) => new RegExp(`^${globSource(g)}$`));
  return (path) => res.some((r) => r.test(path));
}

// ───────────────────────────── shared API ─────────────────────────────────────

/**
 * Build the ctx API over two primitives: `listFiles()` and `readRaw(rel)`.
 * `eslint` is injected separately because the two backings lint differently.
 */
function buildContext({ root, listFiles, readRaw, existsRaw, eslint }) {
  const textCache = new Map();
  const jsonCache = new Map();
  let files;
  let fileSet;

  const gitFiles = () => (files ??= listFiles().sort());
  const exists = (rel) => (fileSet ??= new Set(gitFiles())).has(rel) || existsRaw(rel);
  const readFile = (rel) => {
    if (!textCache.has(rel)) {
      const text = readRaw(rel);
      if (text == null) throw new Error(`ctx.readFile: no such file ${rel}`);
      textCache.set(rel, text);
    }
    return textCache.get(rel);
  };
  const json = (rel) => {
    if (!jsonCache.has(rel)) jsonCache.set(rel, JSON.parse(readFile(rel)));
    return jsonCache.get(rel);
  };
  const glob = (patterns, { ignore } = {}) => {
    const inc = globMatcher(patterns);
    const exc = ignore ? globMatcher(ignore) : () => false;
    return gitFiles().filter((f) => inc(f) && !exc(f));
  };

  let themeNames;
  const themes = {
    /** Shipped theme slugs, from BUILT_IN_THEMES in theme-types.ts. */
    names: () => (themeNames ??= parseStringArray(readFile(THEME_TYPES), "BUILT_IN_THEMES")),
    /** Engine themes.css + every theme's own file, concatenated; throws when incomplete. */
    css: () => {
      const names = themes.names();
      const parts = [THEMES_ENGINE_CSS, ...names.map(themeCssPath)].map((rel) => {
        if (!exists(rel)) throw new Error(`theme-sources: cannot read ${rel}`);
        return readFile(rel);
      });
      return joinThemeSources(parts, names);
    },
  };

  let pkgs;
  const packages = () =>
    (pkgs ??= glob("packages/*/package.json").map((rel) => {
      const pkgJson = json(rel);
      const dir = rel.slice(0, -"/package.json".length);
      return { name: pkgJson.name, dir, json: pkgJson, distributable: isDistributable(pkgJson) };
    }));

  return {
    root,
    readFile,
    exists,
    glob,
    gitFiles,
    themes,
    packages,
    json,
    /** Lint matching files with the given rules → findings. See eslint.mjs. */
    eslint: ({ rules, patterns, ignore }) => eslint({ rules, files: glob(patterns, { ignore }) }),
  };
}

// ───────────────────────────── fs backing ─────────────────────────────────────

const WALK_SKIP = new Set([
  "node_modules",
  ".git",
  "dist",
  ".turbo",
  "coverage",
  "storybook-static",
]);

function walk(root, dir = "", out = []) {
  for (const e of readdirSync(join(root, dir), { withFileTypes: true })) {
    if (WALK_SKIP.has(e.name)) continue;
    const rel = dir ? `${dir}/${e.name}` : e.name;
    if (e.isDirectory()) walk(root, rel, out);
    else if (e.isFile()) out.push(rel);
  }
  return out;
}

/** Tracked + untracked-not-ignored files that exist on disk (outside git: a plain walk). */
function listRepoFiles(root) {
  const git = (...args) =>
    execFileSync("git", args, {
      cwd: root,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
      stdio: ["ignore", "pipe", "ignore"],
    })
      .split("\0")
      .filter(Boolean);
  try {
    const deleted = new Set(git("ls-files", "-d", "-z"));
    return git("ls-files", "-co", "--exclude-standard", "-z").filter((f) => !deleted.has(f));
  } catch {
    return walk(root);
  }
}

export function createFsContext(root) {
  return buildContext({
    root,
    listFiles: () => [...new Set(listRepoFiles(root))],
    readRaw: (rel) => {
      const abs = join(root, rel);
      return existsSync(abs) ? readFileSync(abs, "utf8") : null;
    },
    existsRaw: (rel) => existsSync(join(root, rel)),
    eslint: ({ rules, files }) => lintFiles({ root, rules, files }),
  });
}

// ─────────────────────────── memory backing ───────────────────────────────────

export function createMemoryContext(fileMap = {}) {
  const root = "/__fixture__";
  return buildContext({
    root,
    listFiles: () => Object.keys(fileMap),
    readRaw: (rel) => (Object.hasOwn(fileMap, rel) ? fileMap[rel] : null),
    existsRaw: (rel) => Object.hasOwn(fileMap, rel),
    eslint: ({ rules, files }) =>
      lintTexts({ rules, texts: files.map((file) => ({ file, text: fileMap[file] })) }),
  });
}

/** 1-based line number of a string offset. */
export function lineOf(text, index) {
  let line = 1;
  for (let i = 0; i < index && i < text.length; i++) if (text.charCodeAt(i) === 10) line++;
  return line;
}
