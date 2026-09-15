/**
 * optional-peer-transitives — an optional peer's install-time promise is proven from
 * `pnpm-lock.yaml` (#94, ADR 0032). Ported from scripts/check-optional-peer-transitives.mjs.
 *
 * `peerDependenciesMeta.<name>.optional: true` does not cancel a PLAIN dependency edge on the
 * same name elsewhere in the package's own tree. For each distributable `@elabs-ai/components-*`
 * package, walk every direct `dependencies` entry's resolved subgraph in the lockfile
 * (`importers:` → `snapshots:`, `dependencies:` edges only) and report optional peers that turn
 * up — "defeated" peers.
 *
 * TWO-DIRECTIONAL on purpose: `KNOWN_DEFEATS` below is exact. A new defeat fails, AND a known
 * defeat that has gone clean fails — the day upstream `streamdown` declares mermaid optional is
 * exactly the event this exists to report (then drop the entry and tighten the docs that
 * disclose it: docs/CONSUMING.md §6, packages/ai/README.md, ADR 0032, _lazy-mermaid.ts).
 */
const LOCKFILE = "pnpm-lock.yaml";

/** Known, disclosed defeats — identity is package + peer (`via` is informational). */
export const KNOWN_DEFEATS = [
  {
    package: "@elabs-ai/components-ai",
    peer: "mermaid",
    via: ["@streamdown/mermaid", "streamdown"],
    justification:
      "issue #94 — streamdown and @streamdown/mermaid (plain deps of -ai) each depend on mermaid non-optionally, so its bytes always install. The lazy boundary in _lazy-mermaid.ts still keeps it out of the entry chunk (ADR 0019); this residual is install-time presence only. Remove when upstream declares mermaid optional.",
  },
];

// ─────────────────────────── minimal YAML → tree ───────────────────────────
// `importers:`/`snapshots:` are plain block mappings with inline scalar values.

const KEY_RE = /^('(?:[^']|'')*'|"(?:[^"\\]|\\.)*"|[^\s:#-][^:]*?):(?:\s+(.*))?$/;

function unquoteKey(raw) {
  if (raw.length >= 2 && raw[0] === "'" && raw.at(-1) === "'")
    return raw.slice(1, -1).replace(/''/g, "'");
  if (raw.length >= 2 && raw[0] === '"' && raw.at(-1) === '"') {
    try {
      return JSON.parse(raw);
    } catch {
      return raw.slice(1, -1);
    }
  }
  return raw;
}

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
    const m = trimmed.startsWith("- ") || trimmed === "-" ? null : trimmed.match(KEY_RE);
    if (!m) {
      i++;
      continue;
    }
    const key = unquoteKey(m[1]);
    if (m[2] !== undefined && m[2].trim() !== "") {
      node.set(key, m[2].trim());
      i++;
    } else {
      const child = parseBlock(lines, i + 1, indent);
      node.set(key, child.node);
      i = child.next;
    }
  }
  return { node, next: i };
}

export const parsePnpmLockYaml = (text) => parseBlock(text.split("\n"), 0, -1).node;

/** `<section>` → `Map<key, Map<depName, version>>`, plain `dependencies:` only. */
function extractDeps(root, section, versionOf) {
  const out = new Map();
  const sec = root.get(section);
  if (!(sec instanceof Map)) return out;
  for (const [key, node] of sec) {
    const deps = new Map();
    const depsNode = node instanceof Map ? node.get("dependencies") : undefined;
    if (depsNode instanceof Map)
      for (const [name, entry] of depsNode) {
        const v = versionOf(entry);
        if (typeof v === "string") deps.set(name, v);
      }
    out.set(key, deps);
  }
  return out;
}
export const extractImporterDependencies = (root) =>
  extractDeps(root, "importers", (e) => (e instanceof Map ? e.get("version") : undefined));
export const extractSnapshotDependencies = (root) => extractDeps(root, "snapshots", (e) => e);

const SNAPSHOT_KEY_RE = /^(@[^/]+\/[^@]+|[^@]+)@(.+)$/;
export const packageNameFromSnapshotKey = (key) => key.match(SNAPSHOT_KEY_RE)?.[1] ?? null;

/** Package names reachable from `startKey` via `dependencies:` edges. Cycle-safe. */
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
    for (const [depName, depVersion] of snapshots.get(key) ?? []) {
      if (depVersion.startsWith("link:")) continue;
      stack.push(`${depName}@${depVersion}`);
    }
  }
  return names;
}

/** Pure: `[{ package, peer, via }]`, sorted. */
export function findDefeatedOptionalPeers({ packages, importers, snapshots }) {
  const results = [];
  for (const pkg of packages) {
    const peers = Object.entries(pkg.peerDependenciesMeta ?? {})
      .filter(([, meta]) => meta?.optional === true)
      .map(([name]) => name);
    if (peers.length === 0) continue;
    const importerDeps = importers.get(pkg.relDir) ?? new Map();
    const viaByPeer = new Map(peers.map((p) => [p, new Set()]));
    for (const depName of Object.keys(pkg.dependencies ?? {})) {
      const version = importerDeps.get(depName);
      if (!version || version.startsWith("link:")) continue;
      const closure = transitiveClosureNames(`${depName}@${version}`, snapshots);
      for (const peer of peers) if (closure.has(peer)) viaByPeer.get(peer).add(depName);
    }
    for (const peer of peers) {
      const via = viaByPeer.get(peer);
      if (via.size > 0) results.push({ package: pkg.name, peer, via: [...via].sort() });
    }
  }
  return results.sort((a, b) => `${a.package}::${a.peer}`.localeCompare(`${b.package}::${b.peer}`));
}

const idOf = (e) => `${e.package}::${e.peer}`;

/** Pure: `{ added, stale }` vs an exact expectation. */
export function diffAgainstKnown(current, known = KNOWN_DEFEATS) {
  const cur = new Set(current.map(idOf));
  const exp = new Set(known.map(idOf));
  return {
    added: current.filter((c) => !exp.has(idOf(c))),
    stale: known.filter((k) => !cur.has(idOf(k))),
  };
}

// ── fixtures ─────────────────────────────────────────────────────────────────
const AI_LOCK = [
  "lockfileVersion: '9.0'",
  "",
  "importers:",
  "  packages/ai:",
  "    dependencies:",
  "      '@streamdown/mermaid':",
  "        specifier: ^1.0.2",
  "        version: 1.0.2(react@19.2.7)",
  "      streamdown:",
  "        specifier: ^2.4.0",
  "        version: 2.5.0(react-dom@19.2.7(react@19.2.7))(react@19.2.7)",
  "      react:",
  "        specifier: ^19.2.0",
  "        version: 19.2.7",
  "  packages/viewer:",
  "    dependencies:",
  "      some-lib:",
  "        specifier: ^1.0.0",
  "        version: 1.0.0",
  "    devDependencies:",
  "      shiki:",
  "        specifier: ^1.0.0",
  "        version: 1.0.0",
  "",
  "packages:",
  "  mermaid@11.15.0:",
  "    resolution: {integrity: sha512-fake==}",
  "",
  "snapshots:",
  "  '@streamdown/mermaid@1.0.2(react@19.2.7)':",
  "    dependencies:",
  "      mermaid: 11.15.0",
  "      react: 19.2.7",
  "",
  "  streamdown@2.5.0(react-dom@19.2.7(react@19.2.7))(react@19.2.7):",
  "    dependencies:",
  "      mermaid: 11.15.0",
  "      react: 19.2.7",
  "      react-dom: 19.2.7(react@19.2.7)",
  "",
  "  react-dom@19.2.7(react@19.2.7):",
  "    dependencies:",
  "      react: 19.2.7",
  "",
  "  react@19.2.7: {}",
  "  mermaid@11.15.0:",
  "    dependencies:",
  "      dompurify: 3.0.0",
  "  dompurify@3.0.0: {}",
  "  some-lib@1.0.0:",
  "    dependencies:",
  "      lodash: 4.0.0",
  "    optionalDependencies:",
  "      shiki: 1.0.0",
  "  lodash@4.0.0:",
  "    dependencies:",
  "      some-lib: 1.0.0",
  "",
].join("\n");

const AI_PKG = {
  name: "@elabs-ai/components-ai",
  dependencies: { streamdown: "^2.4.0", "@streamdown/mermaid": "^1.0.2", react: "^19.2.0" },
  peerDependenciesMeta: { mermaid: { optional: true } },
};
const VIEWER_PKG = {
  name: "@elabs-ai/components-viewer",
  dependencies: { "some-lib": "^1.0.0" },
  peerDependenciesMeta: { shiki: { optional: true }, papaparse: { optional: true } },
};
function tree({ lock = AI_LOCK, ai = AI_PKG, viewer = VIEWER_PKG } = {}) {
  const files = { [LOCKFILE]: lock };
  if (ai) files["packages/ai/package.json"] = JSON.stringify(ai);
  if (viewer) files["packages/viewer/package.json"] = JSON.stringify(viewer);
  return { files };
}

export default {
  id: "optional-peer-transitives",
  scope: "packages",
  doc: "An optional peer is not also installed through a plain transitive dependency (resolved from `pnpm-lock.yaml`); the known, disclosed exceptions in the rule's `KNOWN_DEFEATS` are exact — remove one the day it goes clean.",
  baseline: "none",
  run(ctx) {
    if (!ctx.exists(LOCKFILE))
      return [{ file: LOCKFILE, line: 1, msg: "pnpm-lock.yaml not found" }];
    const root = parsePnpmLockYaml(ctx.readFile(LOCKFILE));
    const packages = ctx
      .packages()
      .filter((p) => p.distributable && p.name?.startsWith("@elabs-ai/components-"))
      .map((p) => ({
        name: p.name,
        relDir: p.dir,
        dependencies: p.json.dependencies,
        peerDependenciesMeta: p.json.peerDependenciesMeta,
      }));
    const current = findDefeatedOptionalPeers({
      packages,
      importers: extractImporterDependencies(root),
      snapshots: extractSnapshotDependencies(root),
    });
    const { added, stale } = diffAgainstKnown(current);
    const fileOf = (name) => {
      const p = packages.find((x) => x.name === name);
      return p ? `${p.relDir}/package.json` : LOCKFILE;
    };
    return [
      ...added.map((a) => ({
        file: fileOf(a.package),
        line: 1,
        msg: `optional peer "${a.peer}" is defeated — installed anyway via plain dependency ${a.via.join(", ")} (fix the edge, or disclose it and add it to KNOWN_DEFEATS)`,
      })),
      ...stale.map((s) => ({
        file: fileOf(s.package),
        line: 1,
        msg: `KNOWN_DEFEATS entry "${s.peer}" is now CLEAN — remove it from scripts/check/rules/optional-peer-transitives.mjs and tighten the docs that disclose it`,
      })),
    ];
  },
  fixtures: {
    pass: [
      // the real shape: ai's mermaid defeated via both edges (known), viewer clean
      // (shiki only via optionalDependencies / devDependencies, never a plain edge; lodash cycle)
      tree(),
      // non-brand / private packages are not scanned
      tree({
        viewer: {
          ...VIEWER_PKG,
          name: "some-app",
          peerDependenciesMeta: { lodash: { optional: true } },
        },
      }),
    ],
    fail: [
      // a new defeat: viewer's optional lodash is reached via some-lib
      tree({ viewer: { ...VIEWER_PKG, peerDependenciesMeta: { lodash: { optional: true } } } }),
      // a transitive one level deeper (mermaid → dompurify)
      tree({
        ai: {
          ...AI_PKG,
          peerDependenciesMeta: { mermaid: { optional: true }, dompurify: { optional: true } },
        },
      }),
      // the known defeat went clean (upstream fix) → stale
      tree({ ai: { ...AI_PKG, dependencies: { react: "^19.2.0" } } }),
      tree({ lock: "" }),
      { files: { "packages/ai/package.json": JSON.stringify(AI_PKG) } },
    ],
  },
};
