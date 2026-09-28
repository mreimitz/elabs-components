/**
 * DG-26 — `node scripts/upgrade-workspace.mjs [--dry-run] [file-or-folder …]` (default:
 * workspace): dialect 0 → 1, in place, on disk, never on open (upgrade.ts `upgradeText`).
 *
 * `--ref-first [--choices <file.json>]` (1b.9): the reference-first migration, once, over
 * every `*.yaml` under the target (default: workspace), skipping `_trash` — the same walk as a
 * plain upgrade. `ref-first-choices.json` (this folder) is always the base: it is exactly what
 * migrated the seven shipped workspace files, so a bare `--ref-first` re-run is a no-op on them
 * (review round 1 F3, review-r1 — committed, not a file that only ever lived outside the repo).
 * `--choices <file.json>` merges on top of it, per file and then per node id, so a project can
 * add its own choices without repeating the shipped ones. `choices` shape: `{ "<workspace-
 * relative path>": { "<node id>": "<catalog name>" | "<ref to write>" | "custom" } }` — a bare
 * catalog name ("aws/rds") and the full ref form ("catalog/aws/rds") both work (review round 0
 * F3). A node not named in a file's `choices` falls back to its own written `icon:` as the
 * catalog name to try, so a file with no entry in `choices` at all is still processed (review
 * round 0 F8); "custom", or an icon that is not a catalog name, leaves the node exactly as
 * written. A `choices` entry naming no node in its file, or no catalog entry, is reported and
 * fails the run (review round 1 F3 / verify-r1 F2) unless `--dry-run`. Refuses a file not
 * already at the current dialect (review round 1 F6 / N2 — run the plain upgrade first). Never
 * run together with a dialect upgrade.
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
const { module: typesModule } = await runnerImport(
  fileURLToPath(new URL("../src/spec/dialect/types.ts", import.meta.url)),
  { root, configFile: false, logLevel: "error" },
);
const { DIALECT_VERSION } = typesModule;

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const refFirst = args.includes("--ref-first");
const choicesFlag = args.indexOf("--choices");
const choicesPath = choicesFlag === -1 ? undefined : args[choicesFlag + 1];
// review round 0 F1 — only exclude the value that actually follows a real `--choices` flag;
// with no `--choices` at all, `choicesFlag === -1` must never exclude the argument at index 0.
const targets = args.filter(
  (a, i) =>
    a !== "--dry-run" &&
    a !== "--ref-first" &&
    a !== "--choices" &&
    !(choicesFlag !== -1 && i === choicesFlag + 1),
);
const roots = (targets.length > 0 ? targets : ["workspace"]).map((t) => resolve(root, t));

/** `override`'s per-file id choices win over `base`'s; files from either side are kept. */
function mergeChoices(base, override) {
  const out = { ...base };
  for (const [file, patch] of Object.entries(override ?? {})) {
    out[file] = { ...(out[file] ?? {}), ...patch };
  }
  return out;
}

const defaultChoices = refFirst
  ? JSON.parse(
      readFileSync(fileURLToPath(new URL("./ref-first-choices.json", import.meta.url)), "utf8"),
    )
  : null;
const choices = refFirst
  ? mergeChoices(
      defaultChoices,
      choicesPath ? JSON.parse(readFileSync(resolve(root, choicesPath), "utf8")) : null,
    )
  : null;
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
let missingTarget = false;
for (const r of roots) {
  const st = statSync(r, { throwIfNoEntry: false });
  if (!st) {
    console.log(`${relative(workspace, r)}: cannot read (not found)`);
    missingTarget = true;
    continue;
  }
  if (st.isDirectory()) files.push(...walk(r));
  else if (/\.yaml$/i.test(r)) files.push(r);
}
const rels = [...new Set(files.map((f) => relative(workspace, f)))].sort();

const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

let changedCount = 0;
let totalRefs = 0;
let totalDropped = 0;
let anyBadChoices = false;
let failed = missingTarget;
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
    // review round 1 F6 / N2 — refuse a file `--ref-first` has not seen the plain upgrade
    // run on yet: adding `ref:` beside `diagram: "0"` would leave a mixed file. A file this
    // reads as unreadable for another reason falls through to `refFirstText`'s own reason
    // below, which names the real cause.
    const versionCheck = upgradeText(text);
    if (versionCheck.from !== null && versionCheck.from !== DIALECT_VERSION) {
      console.log(`${rel}: cannot read (run the dialect upgrade first)`);
      failed = true;
      continue;
    }
    const result = refFirstText(text, catalog, choices[rel] ?? {});
    // review round 0 F2 — refFirstText now reports why an unreadable file could not be read
    // (the same reasons upgradeText does, below), never a quiet "unchanged".
    if (result.reason) {
      console.log(`${rel}: cannot read (${result.reason})`);
      failed = true;
      continue;
    }
    // review round 1 F3 (review-r1) / F2 (verify-r1) — a `choices` entry that named no node
    // or no catalog item is reported, not silently dropped.
    for (const bad of result.badChoices) {
      console.log(`${rel}: bad choice ${bad}`);
      anyBadChoices = true;
    }
    // review round 1 F1 (verify-r1) — informational: the node stayed custom on purpose, to
    // keep the drawing identical. Never a failure.
    for (const skip of result.skipped) {
      console.log(`${rel}: "${skip.id}" left custom (${skip.reason})`);
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
  // Any reason at all (unreadable, or a version bump that could not be made exactly, DG-26
  // 1a.9) is a failure — never reported as a quiet "unchanged".
  if (result.reason !== undefined) {
    console.log(`${rel}: cannot read (${result.reason})`);
    failed = true;
    continue;
  }
  if (!result.changed) {
    console.log(`${rel}: unchanged (${result.from})`);
    continue;
  }
  console.log(`${rel}: ${result.from} → ${DIALECT_VERSION} (lines ${result.lines.join(", ")})`);
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
// review round 1 F3 (review-r1) / F2 (verify-r1) — a bad choice fails the run so it gets
// fixed, but `--dry-run` is a preview: it reports without failing.
process.exit(failed || (anyBadChoices && !dryRun) ? 1 : 0);
