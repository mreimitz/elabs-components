#!/usr/bin/env node
/**
 * check-optional-peer-transitives.mjs — proves (or disproves) an optional
 * peer's install-time guarantee, straight from `pnpm-lock.yaml` (#94).
 *
 * `peerDependenciesMeta.<name>.optional: true` governs only whether a package
 * manager DEMANDS the consumer declare `<name>` themselves. It has no effect on
 * whether a DIFFERENT package this one depends on resolves `<name>` anyway —
 * an optional peer and a plain transitive dependency on the same name are
 * independent facts, and the optional declaration cannot cancel the transitive
 * edge. `@elabs-ai/components-ai` declares `mermaid` optional, but two of its
 * OWN plain `dependencies` — `streamdown` and `@streamdown/mermaid` — each
 * declare `mermaid` as their own plain, non-optional dependency, so every
 * package manager installs mermaid's bytes regardless of what a consumer's
 * manifest says (issue #94).
 *
 * This gate makes that provable, no install required: for every
 * `@elabs-ai/components-*` package, it reads that package's OWN
 * `peerDependenciesMeta` (from its `package.json`) and its OWN plain
 * `dependencies`, resolves each direct dependency's exact installed version
 * from `pnpm-lock.yaml`'s `importers:` section, then walks that dependency's
 * resolved subgraph in the lockfile's `snapshots:` section. A `dependencies:`
 * edge only — never `optionalDependencies:`/`peerDependencies:`, which are
 * constraints, not installed edges. If an optional peer's name turns up
 * anywhere in a direct dependency's transitive closure, that peer is
 * DEFEATED, and the direct dependency is named as the responsible edge.
 *
 * ## The ratchet is two-directional (deliberately, unlike most baselines here)
 *
 * `scripts/optional-peer-transitives-baseline.json` records today's known
 * defeats. Most ratchet baselines in this repo only fail when NEW debt is
 * added (a shrinking baseline is a bonus, not required). This one is
 * different on purpose: it also fails when a BASELINED entry goes clean,
 * because the whole point is to catch the day a third-party fix (upstream
 * `streamdown` declaring `mermaid` optional) lands — see #94's "Test to add".
 * A silently-stale baseline entry would hide exactly the event this gate
 * exists to report.
 *
 * Flags:
 *   --warn     never exit non-zero (dev-hook mode); still prints findings.
 *   --update   rewrite the baseline to match the CURRENT defeated-peer set.
 *              Carries over `justification` for keys that survive; a brand
 *              new key gets a TODO placeholder that must be hand-edited.
 *
 * Dependency-free (no YAML library — this file's own minimal parser mirrors
 * `check-lockfile-dup-keys.mjs`'s indentation-scope technique, generalized
 * into a small tree instead of a duplicate-key scan); ESM; locates
 * `pnpm-lock.yaml` and `packages/*` relative to this file (cwd-independent).
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { distributablePackages, REPO_ROOT as DIST_REPO_ROOT } from "./lib/distributables.mjs";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = dirname(SCRIPT_DIR);
const LOCKFILE = join(REPO_ROOT, "pnpm-lock.yaml");
const BASELINE = join(SCRIPT_DIR, "optional-peer-transitives-baseline.json");

// ─────────────────────────── minimal YAML → tree ───────────────────────────
//
// pnpm-lock.yaml's `importers:`/`snapshots:` sections are plain block mappings
// (quoted or bare scalar keys, inline scalar values); no lists or multi-line
// block scalars appear inside the sub-trees this gate reads. A full YAML
// parser is not warranted for that subset — see check-lockfile-dup-keys.mjs
// for the sibling rationale (dependency-free by convention).

/** Matches a mapping key line, optionally with an inline scalar value. */
const KEY_RE = /^('(?:[^']|'')*'|"(?:[^"\\]|\\.)*"|[^\s:#-][^:]*?):(?:\s+(.*))?$/;

function unquoteKey(raw) {
  if (raw.length >= 2 && raw[0] === "'" && raw[raw.length - 1] === "'") {
    return raw.slice(1, -1).replace(/''/g, "'");
  }
  if (raw.length >= 2 && raw[0] === '"' && raw[raw.length - 1] === '"') {
    try {
      return JSON.parse(raw);
    } catch {
      return raw.slice(1, -1);
    }
  }
  return raw;
}

/**
 * Parse one indented block into a `Map<key, string | Map>`, returning the
 * node and the index of the first line NOT consumed (a dedent or EOF).
 */
function parseBlock(lines, start, parentIndent) {
  const node = new Map();
  let i = start;
  while (i < lines.length) {
    const raw = lines[i];
    if (raw.trim() === "") {
      i++;
      continue;
    }
    const indent = raw.length - raw.trimStart().length;
    if (indent <= parentIndent) break;
    const trimmed = raw.slice(indent);
    // Sequence items (`- foo`) never appear inside the sub-trees we read
    // (`importers:<path>:dependencies:` / `snapshots:<key>:dependencies:`);
    // skip them defensively rather than mis-parsing as a mapping key.
    if (trimmed.startsWith("- ") || trimmed === "-") {
      i++;
      continue;
    }
    const m = trimmed.match(KEY_RE);
    if (!m) {
      i++;
      continue;
    }
    const key = unquoteKey(m[1]);
    const inline = m[2];
    if (inline !== undefined && inline.trim() !== "") {
      node.set(key, inline.trim());
      i++;
    } else {
      const child = parseBlock(lines, i + 1, indent);
      node.set(key, child.node);
      i = child.next;
    }
  }
  return { node, next: i };
}

/** Parse the whole lockfile into a nested `Map` tree. */
export function parsePnpmLockYaml(text) {
  const lines = text.split("\n");
  return parseBlock(lines, 0, -1).node;
}

/**
 * `importers:` → `Map<importerPath, Map<depName, resolvedVersion>>`, PLAIN
 * `dependencies:` only (never `devDependencies:`/`optionalDependencies:` —
 * those are not what a consumer of the packed tarball installs).
 */
export function extractImporterDependencies(root) {
  const out = new Map();
  const importers = root.get("importers");
  if (!(importers instanceof Map)) return out;
  for (const [importerPath, importerNode] of importers) {
    const deps = new Map();
    const depsNode = importerNode instanceof Map ? importerNode.get("dependencies") : undefined;
    if (depsNode instanceof Map) {
      for (const [name, entry] of depsNode) {
        const version = entry instanceof Map ? entry.get("version") : undefined;
        if (typeof version === "string") deps.set(name, version);
      }
    }
    out.set(importerPath, deps);
  }
  return out;
}

/**
 * `snapshots:` → `Map<snapshotKey, Map<depName, resolvedVersion>>`, PLAIN
 * `dependencies:` only (never `optionalDependencies:`/`peerDependencies:` —
 * those are constraints, not edges a package manager always installs).
 */
export function extractSnapshotDependencies(root) {
  const out = new Map();
  const snapshots = root.get("snapshots");
  if (!(snapshots instanceof Map)) return out;
  for (const [snapKey, snapNode] of snapshots) {
    const deps = new Map();
    const depsNode = snapNode instanceof Map ? snapNode.get("dependencies") : undefined;
    if (depsNode instanceof Map) {
      for (const [name, version] of depsNode) {
        if (typeof version === "string") deps.set(name, version);
      }
    }
    out.set(snapKey, deps);
  }
  return out;
}

/**
 * `'@scope/name@1.2.3(peer@4.0.0)'` → `'@scope/name'`; `'foo@1.2.3'` → `'foo'`.
 */
const SNAPSHOT_KEY_RE = /^(@[^/]+\/[^@]+|[^@]+)@(.+)$/;
export function packageNameFromSnapshotKey(key) {
  const m = key.match(SNAPSHOT_KEY_RE);
  return m ? m[1] : null;
}

/**
 * Every package name reachable from `startKey` by following `dependencies:`
 * edges in `snapshots` (including `startKey`'s own name at depth 0). Cycle-safe.
 */
export function transitiveClosureNames(startKey, snapshots) {
  const names = new Set();
  const visited = new Set();
  const stack = [startKey];
  while (stack.length) {
    const key = stack.pop();
    if (visited.has(key)) continue;
    visited.add(key);
    const name = packageNameFromSnapshotKey(key);
    if (name) names.add(name);
    const deps = snapshots.get(key);
    if (!deps) continue;
    for (const [depName, depVersion] of deps) {
      if (depVersion.startsWith("link:")) continue; // workspace link, not a real edge
      stack.push(`${depName}@${depVersion}`);
    }
  }
  return names;
}

/**
 * @param {{ packages: {name:string, relDir:string, dependencies?:Record<string,string>, peerDependenciesMeta?:Record<string,{optional?:boolean}>}[], importers: Map, snapshots: Map }} input
 * @returns {{ package: string, peer: string, via: string[] }[]} sorted deterministically.
 */
export function findDefeatedOptionalPeers({ packages, importers, snapshots }) {
  const results = [];
  for (const pkg of packages) {
    const optionalPeers = Object.entries(pkg.peerDependenciesMeta ?? {})
      .filter(([, meta]) => meta?.optional === true)
      .map(([name]) => name);
    if (optionalPeers.length === 0) continue;

    const importerDeps = importers.get(pkg.relDir) ?? new Map();
    const directDeps = Object.keys(pkg.dependencies ?? {});
    const viaByPeer = new Map(optionalPeers.map((p) => [p, new Set()]));

    for (const depName of directDeps) {
      const version = importerDeps.get(depName);
      if (!version || version.startsWith("link:")) continue;
      const closureNames = transitiveClosureNames(`${depName}@${version}`, snapshots);
      for (const peer of optionalPeers) {
        if (closureNames.has(peer)) viaByPeer.get(peer).add(depName);
      }
    }

    for (const peer of optionalPeers) {
      const via = viaByPeer.get(peer);
      if (via.size > 0) results.push({ package: pkg.name, peer, via: [...via].sort() });
    }
  }
  return results.sort((a, b) => `${a.package}::${a.peer}`.localeCompare(`${b.package}::${b.peer}`));
}

const entryKey = (e) => `${e.package}::${e.peer}`;

/**
 * Pure core: given the current defeated-peer set and a baseline, compute the
 * two-directional diff. `ok` is true only when they match exactly (by
 * package+peer identity — `via` is reported but not part of the identity, so
 * a resolution-version bump that doesn't change WHICH direct deps are
 * responsible doesn't need a baseline edit).
 */
export function diffAgainstBaseline(current, baseline) {
  const currentMap = new Map(current.map((c) => [entryKey(c), c]));
  const baselineMap = new Map(baseline.map((b) => [entryKey(b), b]));
  const added = current.filter((c) => !baselineMap.has(entryKey(c)));
  const stale = baseline.filter((b) => !currentMap.has(entryKey(b)));
  return { added, stale, ok: added.length === 0 && stale.length === 0 };
}

/** Each workspace package.json → the shape `findDefeatedOptionalPeers` needs. */
export function loadPackages(root = REPO_ROOT) {
  return distributablePackages(root)
    .filter((p) => p.name?.startsWith("@elabs-ai/components-"))
    .map((p) => ({
      name: p.name,
      relDir: p.relDir,
      dependencies: p.json.dependencies,
      peerDependenciesMeta: p.json.peerDependenciesMeta,
    }));
}

function readBaseline() {
  try {
    return JSON.parse(readFileSync(BASELINE, "utf8"));
  } catch {
    return [];
  }
}

// ───────────────────────────────── CLI ────────────────────────────────────────
function main(argv) {
  const warnOnly = argv.includes("--warn");
  const update = argv.includes("--update");

  if (!existsSync(LOCKFILE)) {
    console.error(`✖ optional-peers gate: pnpm-lock.yaml not found at ${LOCKFILE}`);
    return warnOnly ? 0 : 1;
  }

  const root = parsePnpmLockYaml(readFileSync(LOCKFILE, "utf8"));
  const importers = extractImporterDependencies(root);
  const snapshots = extractSnapshotDependencies(root);
  const packages = loadPackages(DIST_REPO_ROOT);
  const current = findDefeatedOptionalPeers({ packages, importers, snapshots });

  if (update) {
    const previous = readBaseline();
    const previousByKey = new Map(previous.map((b) => [entryKey(b), b]));
    const next = current.map((c) => {
      const prev = previousByKey.get(entryKey(c));
      return {
        package: c.package,
        peer: c.peer,
        via: c.via,
        justification: prev?.justification ?? "TODO: add justification — see docs/ADR/0032",
      };
    });
    writeFileSync(BASELINE, `${JSON.stringify(next, null, 2)}\n`);
    console.log(`✔ optional-peers: baseline updated — ${next.length} defeated peer(s).`);
    const fresh = next.filter((n) => n.justification.startsWith("TODO"));
    if (fresh.length) {
      console.log(
        `  ⚠ ${fresh.length} new entr${fresh.length === 1 ? "y needs" : "ies need"} a hand-written justification.`,
      );
    }
    return 0;
  }

  const baseline = readBaseline();
  const { added, stale, ok } = diffAgainstBaseline(current, baseline);

  if (!ok) {
    console.error("✖ optional-peers gate FAILED:");
    if (added.length) {
      console.error(`\n  ${added.length} NEWLY-defeated optional peer(s) (not in the baseline):`);
      for (const a of added) {
        console.error(`    ${a.package}'s "${a.peer}" — defeated via: ${a.via.join(", ")}`);
      }
    }
    if (stale.length) {
      console.error(
        `\n  ${stale.length} baselined entr${stale.length === 1 ? "y is" : "ies are"} now CLEAN — the residual outlived its cause:`,
      );
      for (const s of stale) {
        console.error(`    ${s.package}'s "${s.peer}" (was via: ${(s.via ?? []).join(", ")})`);
      }
      console.error(
        "\n  This means the transitive edge that used to defeat this optional peer is gone —\n" +
          "  drop the entry from scripts/optional-peer-transitives-baseline.json (--update)\n" +
          "  and tighten the docs that disclosed it (docs/CONSUMING.md, the package README,\n" +
          "  the relevant ADR, CHANGELOG.md, the in-source comment) to match.",
      );
    }
    console.error(
      "\nA `peerDependenciesMeta.<name>.optional: true` declaration does not cancel a\n" +
        "PLAIN dependency edge on the same name elsewhere in the package's own\n" +
        "dependency tree — the two facts are independent. See #94 and\n" +
        ".claude/rules/quality-gates.md § 'Enforcement over reminders'.\n" +
        "Run `pnpm optional-peers:check --update` once the finding is understood and\n" +
        "the baseline (with a written justification) is the intended fix.",
    );
    return warnOnly ? 0 : 1;
  }

  console.log(
    `✔ optional-peers: ${current.length} defeated optional peer(s), all baselined and current.`,
  );
  for (const c of current) {
    console.log(`  ${c.package}'s "${c.peer}" is defeated — via: ${c.via.join(", ")}`);
  }
  return 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exit(main(process.argv.slice(2)));
}
