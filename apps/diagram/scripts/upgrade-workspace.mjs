/**
 * DG-26 — `node scripts/upgrade-workspace.mjs [--dry-run] [file-or-folder …]` (default:
 * workspace): dialect 0 → 1, in place, on disk, never on open (upgrade.ts `upgradeText`).
 *
 * `--ref-first --choices <file.json>` (1b.9): the reference-first migration, once, over the
 * files `choices` names. `choices` shape: `{ "<workspace-relative path>": { "<node id>":
 * "<ref to write>" } }` — a node not named is left exactly as it is written (a stand-in, a
 * custom node with no catalog item, a zone). Never run together with a dialect upgrade.
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runnerImport } from "vite";
import { readAll } from "../server/catalog-fs.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const workspace = join(root, "workspace");
const { module } = await runnerImport(
  fileURLToPath(new URL("../src/server-surface.ts", import.meta.url)),
  { root, configFile: false, logLevel: "error" },
);
const { upgradeText, refFirstText, catalogLookupOf, ICON_NAMES } = module;

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const refFirst = args.includes("--ref-first");
const choicesFlag = args.indexOf("--choices");
const choicesPath = choicesFlag === -1 ? undefined : args[choicesFlag + 1];
const targets = args.filter(
  (a, i) => a !== "--dry-run" && a !== "--ref-first" && a !== "--choices" && i !== choicesFlag + 1,
);
const roots = (targets.length > 0 ? targets : ["workspace"]).map((t) => resolve(root, t));

if (refFirst && !choicesPath) {
  console.error("--ref-first needs --choices <file.json>.");
  process.exit(1);
}
const choices = refFirst ? JSON.parse(readFileSync(resolve(root, choicesPath), "utf8")) : null;
const catalog = refFirst ? catalogLookupOf((await readAll(ICON_NAMES)).entries) : null;

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

const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

let changedCount = 0;
let totalRefs = 0;
let totalDropped = 0;
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
  if (refFirst) {
    const result = refFirstText(text, catalog, choices[rel] ?? {});
    if (result.reason) {
      console.log(`${rel}: ${result.reason}`);
      failed = true;
      continue;
    }
    if (!result.changed) {
      console.log(`${rel}: unchanged`);
      continue;
    }
    const refs = result.changes.length;
    const dropped = result.changes.reduce((n, c) => n + c.dropped.length, 0);
    console.log(`${rel}: ${plural(refs, "reference")}, ${plural(dropped, "key")} dropped`);
    totalRefs += refs;
    totalDropped += dropped;
    changedCount += 1;
    if (!dryRun) writeFileSync(full, result.text);
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

const suffix = dryRun ? " (dry run)" : "";
console.log(
  refFirst
    ? `${plural(totalRefs, "reference")} and ${plural(totalDropped, "dropped key")} in ${changedCount} of ${rels.length} files${suffix}`
    : dryRun
      ? `${changedCount} of ${rels.length} files would change`
      : `${changedCount} of ${rels.length} files upgraded`,
);
process.exit(failed ? 1 : 0);
