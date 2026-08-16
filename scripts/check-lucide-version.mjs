#!/usr/bin/env node
/**
 * check-lucide-version.mjs — WP-12 #119 icon-policy gate (version drift half).
 *
 * Lucide (`lucide-react`) is brand-ui's default icon library (.claude/rules/icons.md).
 * Multiple `lucide-react` versions across the workspace means two copies in the bundle
 * and icon-set drift between packages. This gate FAILS the build (exit 1) when more than
 * one `lucide-react` version specifier is declared across all package.json manifests.
 *
 * (The other half — blocking non-Lucide/non-@brand icon-library imports — is the ESLint
 * `no-restricted-imports` rule in @qlik-coe-emea/qlabs-components-eslint-config, enforced by `pnpm lint`.)
 *
 * Dependency-free; locates the workspace relative to this file (cwd-independent).
 */
import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";

const REPO_ROOT = dirname(dirname(fileURLToPath(import.meta.url))); // scripts/ → root
const DEP_KEYS = ["dependencies", "peerDependencies", "devDependencies", "optionalDependencies"];

/** Every package.json under packages/* and apps/* (+ the workspace root). */
function manifestPaths() {
  const out = [join(REPO_ROOT, "package.json")];
  for (const group of ["packages", "apps"]) {
    const base = join(REPO_ROOT, group);
    if (!existsSync(base)) continue;
    for (const name of readdirSync(base)) {
      const p = join(base, name, "package.json");
      if (existsSync(p) && statSync(p).isFile()) out.push(p);
    }
  }
  return out;
}

const found = []; // { file, key, version }
for (const file of manifestPaths()) {
  let json;
  try {
    json = JSON.parse(readFileSync(file, "utf8"));
  } catch {
    continue;
  }
  for (const key of DEP_KEYS) {
    const v = json[key]?.["lucide-react"];
    if (v) found.push({ file: relative(REPO_ROOT, file), key, version: v });
  }
  // A version pinned via the root manifest's pnpm.overrides / resolutions must
  // participate in the single-version check too.
  const rel = relative(REPO_ROOT, file);
  const pins = { "pnpm.overrides": json.pnpm?.overrides, resolutions: json.resolutions };
  for (const [key, obj] of Object.entries(pins)) {
    const v = obj?.["lucide-react"];
    if (v) found.push({ file: rel, key, version: v });
  }
}

const versions = [...new Set(found.map((f) => f.version))];

if (found.length === 0) {
  console.log("✔ lucide-version: no lucide-react declarations found.");
  process.exit(0);
}

if (versions.length > 1) {
  console.error(
    `\n✖ lucide-version gate FAILED — ${versions.length} different lucide-react versions:`,
  );
  for (const v of versions) {
    console.error(`  ${v}`);
    for (const f of found.filter((x) => x.version === v)) {
      console.error(`    - ${f.file} (${f.key})`);
    }
  }
  console.error(
    "\nUse ONE lucide-react version across the workspace (see .claude/rules/icons.md).\n" +
      "Align the manifests + run `pnpm install`.",
  );
  process.exit(1);
}

console.log(
  `✔ lucide-version: single version ${versions[0]} across ${found.length} declaration(s).`,
);
