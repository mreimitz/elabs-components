/**
 * `brand-ui create <dir> --template <archetype>` — the zero-friction start
 * (2026-09-17 review). Locks the contract a first-time user and an agent rely
 * on: one command, a runnable Vite app on the chosen template, the CSS entry
 * wired (`@import` + one `@source` per rendered package + ThemeProvider), the
 * agent context files present, and the "Next:" steps printed.
 */
import { before, test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { findRepoRoot } from "../lib/core.mjs";

const BIN = fileURLToPath(new URL("../bin/brand-ui.mjs", import.meta.url));
const BUNDLE_ASSETS = fileURLToPath(new URL("../scripts/bundle-assets.mjs", import.meta.url));
const repoRoot = findRepoRoot(fileURLToPath(import.meta.url));

function run(args, cwd) {
  return spawnSync(process.execPath, [BIN, ...args], { cwd, encoding: "utf8" });
}

// `create` runs in a temp dir outside the checkout, so it reads the templates
// bundled INTO the CLI — gitignored copies that only `prepack` writes. Bundle
// them here, or the test passes only on a machine that once packed the CLI.
before(() => {
  if (!repoRoot) return;
  const r = spawnSync(process.execPath, [BUNDLE_ASSETS], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr || r.stdout);
});

test("create: writes a runnable app on the dashboard template and prints next steps", (t) => {
  if (!repoRoot) return t.skip("not inside the monorepo — templates unavailable");
  const dir = mkdtempSync(join(tmpdir(), "brand-ui-create-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const r = run(["create", "my-app", "--template", "dashboard", "--title", "Sales Pulse"], dir);
  assert.equal(r.status, 0, r.stderr || r.stdout);
  assert.match(r.stdout, /brand-ui create — written/);
  assert.match(r.stdout, /template: dashboard · theme: light · title: Sales Pulse/);
  assert.match(r.stdout, /cd my-app && pnpm install && pnpm dev/);
  const app = join(dir, "my-app");
  for (const f of [
    "index.html",
    "src/App.tsx",
    "src/main.tsx",
    "src/styles.css",
    "package.json",
    "CLAUDE.md",
    "AGENTS.md",
  ])
    assert.ok(existsSync(join(app, f)), `${f} written`);
  const css = readFileSync(join(app, "src/styles.css"), "utf8");
  assert.match(css, /@import "@elabs-ai\/components-tokens\/styles\.css"/);
  assert.match(css, /@source "\.\.\/node_modules\/@elabs-ai\/components-ui\/dist"/);
  assert.match(css, /@source "\.\.\/node_modules\/@elabs-ai\/components-charts\/dist"/);
  const main = readFileSync(join(app, "src/main.tsx"), "utf8");
  assert.match(main, /ThemeProvider/);
  const pkg = JSON.parse(readFileSync(join(app, "package.json"), "utf8"));
  assert.equal(pkg.name, "my-app");
  assert.ok(pkg.dependencies["@elabs-ai/components-ui"], "ui package declared");
  assert.ok(pkg.dependencies["@elabs-ai/components-charts"], "dashboard's charts package declared");
});

test("create: a folder named like its template, theme or title is still the folder", (t) => {
  if (!repoRoot) return t.skip("not inside the monorepo — templates unavailable");
  const dir = mkdtempSync(join(tmpdir(), "brand-ui-create-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  for (const [folder, args] of [
    ["dashboard", ["dashboard", "--template", "dashboard"]],
    ["marketing", ["--template", "marketing", "marketing"]],
    ["dark", ["dark", "--theme", "dark"]],
    ["settings", ["--template=settings", "settings"]],
  ]) {
    const r = run(["create", ...args], dir);
    assert.equal(r.status, 0, `${args.join(" ")}: ${r.stderr || r.stdout}`);
    assert.ok(existsSync(join(dir, folder, "package.json")), `${folder}/ written`);
  }
});

test("create: defaults the title from the directory name and rejects an unknown template", (t) => {
  if (!repoRoot) return t.skip("not inside the monorepo — templates unavailable");
  const dir = mkdtempSync(join(tmpdir(), "brand-ui-create-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const bad = run(["create", "x", "--template", "kiosk"], dir);
  assert.equal(bad.status, 1);
  assert.match(bad.stderr, /--template must be one of/);
  const ok = run(["create", "ops-console"], dir);
  assert.equal(ok.status, 0, ok.stderr || ok.stdout);
  assert.match(ok.stdout, /title: Ops Console/);
  assert.match(ok.stdout, /template: dashboard/);
});

test("create: no directory → usage on stderr, exit 1, nothing written", (t) => {
  const dir = mkdtempSync(join(tmpdir(), "brand-ui-create-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const r = run(["create"], dir);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /usage: brand-ui create <dir>/);
});

test('create: outside the monorepo every @elabs-ai dependency is pinned to the CLI\'s release, never "latest"', (t) => {
  if (!repoRoot) return t.skip("not inside the monorepo — templates unavailable");
  const dir = mkdtempSync(join(tmpdir(), "brand-ui-create-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const r = run(["create", "pinned", "--template", "dashboard"], dir);
  assert.equal(r.status, 0, r.stderr || r.stdout);
  const cli = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  const pkg = JSON.parse(readFileSync(join(dir, "pinned", "package.json"), "utf8"));
  const ours = Object.entries({ ...pkg.dependencies, ...pkg.devDependencies }).filter(([n]) =>
    n.startsWith("@elabs-ai/"),
  );
  assert.ok(ours.length >= 3);
  for (const [name, range] of ours) assert.equal(range, `^${cli.version}`, name);
});

test("create: next steps follow the caller's package manager (npx → npm)", (t) => {
  if (!repoRoot) return t.skip("not inside the monorepo — templates unavailable");
  const dir = mkdtempSync(join(tmpdir(), "brand-ui-create-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const r = spawnSync(process.execPath, [BIN, "create", "via-npx"], {
    cwd: dir,
    encoding: "utf8",
    env: { ...process.env, npm_config_user_agent: "npm/10.9.0 node/v22.0.0 darwin arm64" },
  });
  assert.equal(r.status, 0, r.stderr || r.stdout);
  assert.match(r.stdout, /cd via-npx && npm install && npm run dev/);
  assert.doesNotMatch(r.stdout, /pnpm install/);
});

test("create --install: installs with the package manager that ran it, the one CI expects", (t) => {
  if (!repoRoot) return t.skip("not inside the monorepo — templates unavailable");
  if (process.platform === "win32") return t.skip("the stand-in package managers are sh scripts");
  const dir = mkdtempSync(join(tmpdir(), "brand-ui-create-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  // Stand-ins record which one ran; a real install is the create matrix's job.
  const bin = join(dir, "bin");
  mkdirSync(bin);
  const used = join(dir, "used");
  for (const pm of ["npm", "pnpm"])
    writeFileSync(join(bin, pm), `#!/bin/sh\necho ${pm} > "${used}"\n`, { mode: 0o755 });

  for (const [agent, pm, ci] of [
    // pnpm's agent string also contains `npm/` — it once picked npm here.
    ["pnpm/9.15.4 npm/? node/v22.0.0 darwin arm64", "pnpm", /pnpm install --frozen-lockfile/],
    ["npm/10.9.0 node/v22.0.0 darwin arm64", "npm", /npm ci/],
  ]) {
    const r = spawnSync(process.execPath, [BIN, "create", `via-${pm}`, "--install"], {
      cwd: dir,
      encoding: "utf8",
      env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, npm_config_user_agent: agent },
    });
    assert.equal(r.status, 0, r.stderr || r.stdout);
    assert.match(r.stdout, new RegExp(`installing with ${pm}…`));
    assert.equal(readFileSync(used, "utf8").trim(), pm);
    const workflow = readFileSync(join(dir, `via-${pm}`, ".github/workflows/brand-ui.yml"), "utf8");
    assert.match(workflow, ci);
  }
});

test("create: a standalone app installs under pnpm 9, 10 and 11 (esbuild allowed, root add allowed)", (t) => {
  if (!repoRoot) return t.skip("not inside the monorepo — templates unavailable");
  const dir = mkdtempSync(join(tmpdir(), "brand-ui-create-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const r = run(["create", "pnpm-ready", "--template", "marketing"], dir);
  assert.equal(r.status, 0, r.stderr || r.stdout);
  const app = join(dir, "pnpm-ready");
  // pnpm 11 exits 1 on install (and before every `pnpm dev`) while esbuild's
  // install script is unapproved; `allowBuilds` is the key it reads.
  const ws = readFileSync(join(app, "pnpm-workspace.yaml"), "utf8");
  assert.match(ws, /^packages:\n {2}- "\."$/m, "pnpm 9 rejects a workspace file without packages");
  assert.match(ws, /^allowBuilds:\n {2}esbuild: true$/m, "pnpm 11");
  assert.match(ws, /^onlyBuiltDependencies:\n {2}- esbuild$/m, "pnpm 10");
  assert.match(ws, /^ignoreWorkspaceRootCheck: true$/m, "`pnpm add` at the root, pnpm 10+");
  const npmrc = readFileSync(join(app, ".npmrc"), "utf8");
  assert.match(npmrc, /^ignore-workspace-root-check=true$/m, "`pnpm add` at the root, pnpm 9");
  assert.doesNotMatch(npmrc, /_authToken/, "public npm needs no token");
  assert.match(r.stdout, /wrote: pnpm-workspace\.yaml/);
});
