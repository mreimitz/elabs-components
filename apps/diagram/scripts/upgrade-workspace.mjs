/** DG-26 — `node scripts/upgrade-workspace.mjs [--dry-run] [file-or-folder …]` (default: workspace). */
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runnerImport } from "vite";

const root = fileURLToPath(new URL("..", import.meta.url));
const workspace = join(root, "workspace");
const { module } = await runnerImport(
  fileURLToPath(new URL("../src/spec/dialect/upgrade.ts", import.meta.url)),
  { root, configFile: false, logLevel: "error" },
);
const { upgradeText } = module;

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const targets = args.filter((a) => a !== "--dry-run");
const roots = (targets.length > 0 ? targets : ["workspace"]).map((t) => resolve(root, t));

/** Every `*.yaml` file under `dir`, skipping any path with a "_trash" segment. */
function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "_trash") continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.isFile() && /\.yaml$/i.test(entry.name)) out.push(full);
  }
  return out;
}

const files = [];
for (const r of roots) {
  const st = statSync(r, { throwIfNoEntry: false });
  if (!st) continue;
  if (st.isDirectory()) files.push(...walk(r));
  else if (/\.yaml$/i.test(r)) files.push(r);
}
const rels = [...new Set(files.map((f) => relative(workspace, f)))].sort();

let changedCount = 0;
let failed = false;
for (const rel of rels) {
  const full = join(workspace, rel);
  let text;
  try {
    text = readFileSync(full, "utf8");
  } catch (err) {
    console.log(`${rel}: cannot read (${err.message})`);
    failed = true;
    continue;
  }
  const result = upgradeText(text);
  if (result.from === null) {
    console.log(`${rel}: cannot read (${result.reason})`);
    failed = true;
    continue;
  }
  if (!result.changed) {
    console.log(`${rel}: unchanged (${result.from})`);
    continue;
  }
  console.log(`${rel}: ${result.from} → 1 (lines ${result.lines.join(", ")})`);
  changedCount += 1;
  if (!dryRun) writeFileSync(full, result.text);
}

console.log(
  dryRun
    ? `${changedCount} of ${rels.length} files would change`
    : `${changedCount} of ${rels.length} files upgraded`,
);
process.exit(failed ? 1 : 0);
