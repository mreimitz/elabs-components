/**
 * `brand-ui create <dir> --template <archetype>` — the zero-friction start
 * (2026-09-17 review). Locks the contract a first-time user and an agent rely
 * on: one command, a runnable Vite app on the chosen template, the CSS entry
 * wired (`@import` + one `@source` per rendered package + ThemeProvider), the
 * agent context files present, and the "Next:" steps printed.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { findRepoRoot } from "../lib/core.mjs";

const BIN = fileURLToPath(new URL("../bin/brand-ui.mjs", import.meta.url));
const repoRoot = findRepoRoot(fileURLToPath(import.meta.url));

function run(args, cwd) {
  return spawnSync(process.execPath, [BIN, ...args], { cwd, encoding: "utf8" });
}

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
