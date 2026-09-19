#!/usr/bin/env node
/**
 * create-matrix.mjs — `brand-ui create` is green for every template, with npm and
 * with pnpm, on the packages as they would be published (RM-130).
 *
 * What a first-time user does, outside this workspace:
 *
 *   1. Pack every publishable `@elabs-ai/components-*` package and the CLI
 *      (`pnpm pack` applies publishConfig and rewrites `workspace:*`, like publishing).
 *   2. Install the packed CLI the way `npx` does, and run `create` for each
 *      template through the package manager (`npm exec` / `pnpm exec`), so `create`
 *      sees the real user agent, as it does under `npx` / `pnpm dlx`.
 *   3. Point the app at the tarballs (npm `overrides`; pnpm `overrides` in
 *      pnpm-workspace.yaml and `pnpm.overrides` in package.json, so pnpm 9 to 11
 *      all read them), install, then run every `run:` step of the app's own CI
 *      workflow in order (the lockfile install → typecheck → lint → audit), then
 *      build and `audit:ui --strict`.
 *   4. Assert what the matrix promises: npm prints no `ERESOLVE`, and the dashboard's
 *      entry chunk stays under ENTRY_GZIP_CEILING.
 *
 * Exits non-zero on the first failure, naming the step, template and package
 * manager. The same script runs on a laptop and in CI (.github/workflows/ci.yml,
 * `create-pack` then `create-matrix`), so no shell-isms: arrays to spawnSync,
 * path.join, fs.rmSync. It imports only Node built-ins and the dependency-free
 * CLI engine, so a CI cell runs it from a bare checkout with no install.
 *
 * Usage (build the packages first: `pnpm build`, or `pnpm turbo run build --filter=./packages/*`):
 *   node scripts/create-matrix.mjs --pm npm|pnpm [--template dashboard,settings]
 *        [--pnpm-version 10] [--tarballs <dir>] [--keep] [--json <file>]
 *   node scripts/create-matrix.mjs --pack <dir>
 *
 *   --pack          only pack every package and the CLI into <dir> (plus packed.json).
 *   --tarballs      use a --pack directory instead of packing, as CI does: the packages
 *                   are built and packed once on Linux, like a release, and every OS
 *                   cell installs those same tarballs.
 *   --pnpm-version  run the app's pnpm as `npx pnpm@<v>` instead of the pnpm on PATH.
 *   --keep          leave the temp directory on disk and print its path.
 *   --json          also write the results as JSON (CI uploads it).
 */
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { gzipSync } from "node:zlib";
import { ARCHETYPES } from "../packages/cli/lib/engine.mjs";
import { distributablePackages, tarballName } from "./check-consumer-install.mjs";

const REPO_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const PACKED_INDEX = "packed.json";
const SCOPE = "@elabs-ai/components-";
const CLI = `${SCOPE}cli`;

/** The dashboard's entry chunk, gzipped, stays under this (RM-130). */
export const ENTRY_GZIP_CEILING = 250 * 1024;
/** Templates whose entry chunk is held to ENTRY_GZIP_CEILING. */
export const ENTRY_BUDGET_TEMPLATES = ["dashboard"];

// A synchronous child with no timeout can hang the job forever on a stuck registry.
const CHILD_TIMEOUT_MS = 10 * 60_000;
const WINDOWS = process.platform === "win32";

export function parseArgs(argv) {
  const o = {
    pm: null,
    templates: ARCHETYPES,
    pnpmVersion: null,
    pack: null,
    tarballs: null,
    keep: false,
    json: null,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const value = () => {
      const v = argv[++i];
      if (!v || v.startsWith("--")) throw new Error(`${a} needs a value`);
      return v;
    };
    if (a === "--pm") o.pm = value();
    else if (a === "--template") o.templates = value().split(",").filter(Boolean);
    else if (a === "--pnpm-version") o.pnpmVersion = value();
    else if (a === "--json") o.json = value();
    else if (a === "--pack") o.pack = value();
    else if (a === "--tarballs") o.tarballs = value();
    else if (a === "--keep") o.keep = true;
    else throw new Error(`unknown argument ${a}`);
  }
  if (o.pack) return o;
  if (o.pm !== "npm" && o.pm !== "pnpm") throw new Error("--pm must be npm or pnpm");
  const unknown = o.templates.filter((t) => !ARCHETYPES.includes(t));
  if (unknown.length) throw new Error(`unknown template(s): ${unknown.join(", ")}`);
  return o;
}

/** `file:` spec for a tarball, with forward slashes so Windows paths survive JSON and YAML. */
export const fileSpec = (tarball) => `file:${tarball.replace(/\\/g, "/")}`;

/**
 * Point an app at the packed tarballs: every direct `@elabs-ai/components-*`
 * dependency, plus an override for every packed package so a transitive one
 * (charts → ui) resolves to its tarball, never to the registry. npm requires a
 * direct dependency and its override to carry the same spec; they do.
 */
export function pinApp(pkgJson, packed, pm) {
  const overrides = Object.fromEntries(packed.map((p) => [p.name, fileSpec(p.tarball)]));
  const pin = (deps = {}) =>
    Object.fromEntries(Object.entries(deps).map(([k, v]) => [k, overrides[k] ?? v]));
  const out = {
    ...pkgJson,
    dependencies: pin(pkgJson.dependencies),
    devDependencies: pin(pkgJson.devDependencies),
  };
  const missing = Object.keys({ ...pkgJson.dependencies, ...pkgJson.devDependencies }).filter(
    (k) => k.startsWith(SCOPE) && !overrides[k],
  );
  if (pm === "npm") out.overrides = { ...pkgJson.overrides, ...overrides };
  else out.pnpm = { ...pkgJson.pnpm, overrides: { ...pkgJson.pnpm?.overrides, ...overrides } };
  return { pkgJson: out, overrides, missing };
}

/** The `overrides:` block appended to pnpm-workspace.yaml (pnpm 10+ reads it there). */
export function workspaceOverrides(overrides) {
  const lines = Object.entries(overrides).map(([k, v]) => `  "${k}": "${v}"`);
  return `\n# create-matrix: resolve brand-ui packages from local tarballs.\noverrides:\n${lines.join("\n")}\n`;
}

/** The `- run:` commands of a GitHub workflow, in order. */
export const workflowRuns = (yaml) =>
  [...yaml.matchAll(/^\s*- run: (.+)$/gm)].map((m) => m[1].trim());

/** How many `ERESOLVE` peer warnings an npm install printed. */
export const countEresolve = (text) => (text.match(/\bERESOLVE\b/g) ?? []).length;

/** The entry chunk `vite build` wrote: the module script in dist/index.html. */
export function entryChunk(indexHtml) {
  const m = /<script[^>]*type="module"[^>]*src="\/?([^"]+\.js)"/.exec(indexHtml);
  return m ? m[1] : null;
}

/** Run a command; the package managers are .cmd shims on Windows, so they need a shell. */
function exec(cmd, args, { cwd, env } = {}) {
  const started = Date.now();
  const res = spawnSync(cmd, args, {
    cwd,
    env: { ...process.env, ...env },
    encoding: "utf8",
    shell: WINDOWS && cmd !== process.execPath,
    timeout: CHILD_TIMEOUT_MS,
    killSignal: "SIGKILL",
    maxBuffer: 64 * 1024 * 1024,
  });
  const output = `${res.stdout ?? ""}${res.stderr ?? ""}`;
  const ok = res.status === 0 && !res.error;
  return { ok, output, ms: Date.now() - started, error: res.error?.message };
}

function packAll(tarDir) {
  const packages = distributablePackages(join(REPO_ROOT, "packages"));
  const cliJson = JSON.parse(readFileSync(join(REPO_ROOT, "packages/cli/package.json"), "utf8"));
  packages.push({ dir: join(REPO_ROOT, "packages/cli"), name: CLI, version: cliJson.version });
  for (const p of packages) {
    if (p.name !== CLI && !existsSync(join(p.dir, "dist")))
      throw new Error(`${p.name} has no dist/ — build the packages first (pnpm build)`);
  }
  mkdirSync(tarDir, { recursive: true });
  const packed = packages.map(({ dir, name, version }) => {
    const r = exec("pnpm", ["pack", "--pack-destination", tarDir], { cwd: dir });
    const tarball = join(tarDir, tarballName(name, version));
    if (!r.ok || !existsSync(tarball)) throw new Error(`pnpm pack failed for ${name}\n${r.output}`);
    return { name, version, tarball };
  });
  const index = packed.map(({ name, version, tarball }) => ({
    name,
    version,
    file: basename(tarball),
  }));
  writeFileSync(join(tarDir, PACKED_INDEX), `${JSON.stringify(index, null, 2)}\n`);
  return packed;
}

/** The tarballs a `--pack` run wrote, from its packed.json. */
export function readPacked(tarDir) {
  const index = join(tarDir, PACKED_INDEX);
  if (!existsSync(index)) throw new Error(`${index} not found — make it with --pack ${tarDir}`);
  return JSON.parse(readFileSync(index, "utf8")).map(({ name, version, file }) => {
    const tarball = resolve(tarDir, file);
    if (!existsSync(tarball))
      throw new Error(`${tarball} is listed in ${PACKED_INDEX} but missing`);
    return { name, version, tarball };
  });
}

/** The packed CLI installed the way `npx` installs it, into its own folder. */
function installCli(work, cliTarball) {
  const tools = join(work, "cli");
  mkdirSync(tools, { recursive: true });
  writeFileSync(join(tools, "package.json"), '{ "private": true }\n');
  const r = exec("npm", ["install", "--no-audit", "--no-fund", fileSpec(cliTarball)], {
    cwd: tools,
  });
  if (!r.ok) throw new Error(`installing the packed CLI failed\n${r.output}`);
  return tools;
}

function pmCommand(o) {
  if (o.pm === "npm") return ["npm", []];
  return o.pnpmVersion ? ["npx", ["--yes", `pnpm@${o.pnpmVersion}`]] : ["pnpm", []];
}

function pmVersion(o) {
  const [cmd, pre] = pmCommand(o);
  const r = exec(cmd, [...pre, "--version"]);
  return r.ok ? r.output.trim().split(/\s+/).pop() : "unknown";
}

function runTemplate(template, o, ctx) {
  const { work, tools, packed, version } = ctx;
  const appName = `app-${template}`;
  const app = join(work, appName);
  const [cmd, pre] = pmCommand(o);
  const run = (...args) => exec(cmd, [...pre, ...args], { cwd: app });
  const result = { template, pm: o.pm, pmVersion: version, steps: [], eresolve: 0 };
  const step = (name, r) => {
    result.steps.push({ name, ok: r.ok, ms: r.ms });
    if (!r.ok) {
      result.failed = name;
      result.output = r.output.slice(-6000) + (r.error ? `\n${r.error}` : "");
    }
    return r.ok;
  };

  // Through the package manager, so `create` reads the real npm_config_user_agent
  // (`pnpm/9.15.4 npm/? node/…` under pnpm) and writes the app's CI for it.
  const created = exec(
    cmd,
    [
      ...pre,
      "exec",
      ...(o.pm === "npm" ? ["--"] : []),
      "brand-ui",
      "create",
      app,
      "--template",
      template,
    ],
    { cwd: tools },
  );
  if (!step("create", created)) return result;

  const pkgPath = join(app, "package.json");
  const { pkgJson, overrides, missing } = pinApp(
    JSON.parse(readFileSync(pkgPath, "utf8")),
    packed,
    o.pm,
  );
  if (missing.length) {
    step("pin", { ok: false, ms: 0, output: `not packed: ${missing.join(", ")}` });
    return result;
  }
  writeFileSync(pkgPath, `${JSON.stringify(pkgJson, null, 2)}\n`);
  const ws = join(app, "pnpm-workspace.yaml");
  if (o.pm === "pnpm" && existsSync(ws))
    writeFileSync(ws, readFileSync(ws, "utf8") + workspaceOverrides(overrides));

  const install = o.pm === "npm" ? run("install", "--no-audit", "--no-fund") : run("install");
  if (!step("install", install)) return result;
  if (o.pm === "npm") {
    result.eresolve = countEresolve(install.output);
    if (result.eresolve > 0) {
      const lines = install.output.split("\n").filter((l) => /ERESOLVE|peer|Found:|from /.test(l));
      step("no ERESOLVE", { ok: false, ms: 0, output: lines.slice(0, 80).join("\n") });
      return result;
    }
  }
  // The app's own CI job, step by step, as GitHub runs it: `npm ci` /
  // `pnpm install --frozen-lockfile` reads the lockfile the install above wrote.
  const workflow = readFileSync(join(app, ".github/workflows/brand-ui.yml"), "utf8");
  for (const line of workflowRuns(workflow)) {
    const [tool, ...args] = line.split(/\s+/);
    const r =
      tool === o.pm
        ? run(...args)
        : {
            ok: false,
            ms: 0,
            output: `the app's workflow runs ${tool}; it was created with ${o.pm}`,
          };
    if (!step(`ci: ${line}`, r)) return result;
  }
  if (!step("build", run("run", "build"))) return result;

  const dist = join(app, "dist");
  const entry = entryChunk(readFileSync(join(dist, "index.html"), "utf8"));
  if (entry) {
    result.entryGzip = gzipSync(readFileSync(join(dist, entry))).length;
    result.jsGzip = readdirSync(join(dist, "assets"))
      .filter((f) => f.endsWith(".js"))
      .reduce((n, f) => n + gzipSync(readFileSync(join(dist, "assets", f))).length, 0);
  }
  if (ENTRY_BUDGET_TEMPLATES.includes(template)) {
    const size = result.entryGzip ?? Infinity;
    const ok = size < ENTRY_GZIP_CEILING;
    const kb = (n) => `${(n / 1024).toFixed(1)} KB`;
    if (
      !step("entry chunk budget", {
        ok,
        ms: 0,
        output: `entry chunk ${entry} is ${kb(size)} gzip, ceiling ${kb(ENTRY_GZIP_CEILING)}`,
      })
    )
      return result;
  }

  const auditArgs =
    o.pm === "npm" ? ["run", "audit:ui", "--", "--strict"] : ["run", "audit:ui", "--strict"];
  step("audit:ui --strict", run(...auditArgs));
  return result;
}

const secs = (ms) => `${(ms / 1000).toFixed(1)}s`;

function report(results) {
  for (const r of results) {
    const steps = r.steps.map((s) => `${s.ok ? "✔" : "✖"} ${s.name} ${secs(s.ms)}`).join("  ");
    const size = r.entryGzip ? `  entry ${(r.entryGzip / 1024).toFixed(1)} KB gzip` : "";
    console.log(`${r.failed ? "✖" : "✔"} ${r.template} (${r.pm} ${r.pmVersion})${size}`);
    console.log(`    ${steps}`);
  }
}

export function main(argv = process.argv.slice(2)) {
  let o;
  try {
    o = parseArgs(argv);
  } catch (err) {
    console.error(`create-matrix: ${err.message}`);
    console.error(
      "usage: node scripts/create-matrix.mjs --pm npm|pnpm [--template a,b] [--tarballs <dir>] [--keep]\n" +
        "       node scripts/create-matrix.mjs --pack <dir>",
    );
    return 2;
  }
  if (o.pack) {
    try {
      const packed = packAll(resolve(o.pack));
      console.log(`✔ create-matrix: packed ${packed.length} tarballs into ${resolve(o.pack)}`);
      return 0;
    } catch (err) {
      console.error(`✖ create-matrix: ${err.message}`);
      return 1;
    }
  }
  const work = mkdtempSync(join(tmpdir(), "brand-ui-create-matrix-"));
  const results = [];
  const started = Date.now();
  try {
    if (!o.tarballs) console.log(`• packing into ${work} …`);
    const packed = o.tarballs ? readPacked(resolve(o.tarballs)) : packAll(join(work, "tarballs"));
    const tools = installCli(work, packed.find((p) => p.name === CLI).tarball);
    const version = pmVersion(o);
    console.log(
      `• ${packed.length} tarballs; ${o.pm} ${version}; ${o.templates.length} template(s)`,
    );
    for (const template of o.templates) {
      console.log(`• ${template} …`);
      const r = runTemplate(template, o, { work, tools, packed, version });
      results.push(r);
      if (r.failed) {
        report(results);
        console.error(`\n✖ create-matrix: ${r.template} with ${r.pm} failed at "${r.failed}"`);
        console.error(r.output);
        return 1;
      }
    }
    report(results);
    console.log(
      `\n✔ create-matrix: ${results.length} template(s) green with ${o.pm} ${version} in ${secs(Date.now() - started)}`,
    );
    return 0;
  } catch (err) {
    console.error(`\n✖ create-matrix: ${err.message}`);
    return 1;
  } finally {
    if (o.json) {
      const summary = { platform: process.platform, pm: o.pm, results };
      writeFileSync(o.json, `${JSON.stringify(summary, null, 2)}\n`);
    }
    if (o.keep) console.log(`  kept ${work}`);
    else rmSync(work, { recursive: true, force: true, maxRetries: 5 });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = main();
}
