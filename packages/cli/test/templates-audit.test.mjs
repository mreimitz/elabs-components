// templates-audit.test.mjs — the templates `brand-ui create` ships must pass the
// gate the generated app's own CLAUDE.md calls the definition of done. Measured
// 2026-09-18: a freshly created dashboard app exited 1 on `audit --strict`
// (slop-brand-name in the template's NavUser e-mail) before the user had typed
// a line; object-detail-hub carried 7 blocking space-y findings and marketing a
// fake-perfect number. A starter that is red on first run teaches an agent to
// ignore the gate.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { existsSync } from "node:fs";
import { findRepoRoot } from "../lib/core.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const bin = join(here, "..", "bin", "brand-ui.mjs");
const repoRoot = findRepoRoot(here);

test("every shipped whole-screen template passes `audit --strict`", (t) => {
  const dir = repoRoot && join(repoRoot, "docs", "playbooks", "templates");
  if (!dir || !existsSync(dir)) return t.skip("not inside the monorepo");
  const res = spawnSync(process.execPath, [bin, "audit", dir, "--strict", "--json"], {
    encoding: "utf8",
    cwd: repoRoot,
  });
  assert.equal(
    res.status,
    0,
    `audit --strict failed on the templates:\n${res.stdout.slice(0, 2000)}`,
  );
});
