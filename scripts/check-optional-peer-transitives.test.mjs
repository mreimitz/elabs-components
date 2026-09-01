// Self-test for scripts/check-optional-peer-transitives.mjs (#94).
//
// Plants synthetic lockfile/package fixtures (never the real pnpm-lock.yaml)
// and asserts the pure functions detect exactly what they should — including
// the BAD-fixture case the "Enforcement over reminders" convention requires:
// a gate must ship proof that it actually fails when the thing it guards
// against is present. Also directly exercises the real repo's mermaid shape
// (both `streamdown` and `@streamdown/mermaid` edges) as a positive control.
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  diffAgainstBaseline,
  extractImporterDependencies,
  extractSnapshotDependencies,
  findDefeatedOptionalPeers,
  packageNameFromSnapshotKey,
  parsePnpmLockYaml,
  transitiveClosureNames,
} from "./check-optional-peer-transitives.mjs";

// ─────────────────────────── parser mechanics ───────────────────────────

test("parsePnpmLockYaml builds a nested Map tree from indentation", () => {
  const yaml = [
    "importers:",
    "  packages/ai:",
    "    dependencies:",
    "      streamdown:",
    "        specifier: ^2.4.0",
    "        version: 2.5.0(react@19.2.7)",
    "snapshots:",
    "  streamdown@2.5.0(react@19.2.7):",
    "    dependencies:",
    "      mermaid: 11.15.0",
    "      react: 19.2.7",
    "",
  ].join("\n");

  const root = parsePnpmLockYaml(yaml);
  assert.ok(root instanceof Map);
  const importers = root.get("importers");
  const aiDeps = importers.get("packages/ai").get("dependencies");
  assert.equal(aiDeps.get("streamdown").get("version"), "2.5.0(react@19.2.7)");

  const snapshots = root.get("snapshots");
  const snapDeps = snapshots.get("streamdown@2.5.0(react@19.2.7)").get("dependencies");
  assert.equal(snapDeps.get("mermaid"), "11.15.0");
  assert.equal(snapDeps.get("react"), "19.2.7");
});

test("parsePnpmLockYaml handles single- and double-quoted scoped keys", () => {
  const yaml = [
    "snapshots:",
    "  '@streamdown/mermaid@1.0.2(react@19.2.7)':",
    "    dependencies:",
    "      mermaid: 11.15.0",
    '  "@scope/needs-escape":',
    "    dependencies: {}",
    "",
  ].join("\n");

  const root = parsePnpmLockYaml(yaml);
  const snapshots = root.get("snapshots");
  assert.ok(snapshots.has("@streamdown/mermaid@1.0.2(react@19.2.7)"));
  assert.ok(snapshots.has("@scope/needs-escape"));
});

test("packageNameFromSnapshotKey splits scoped and unscoped keys", () => {
  assert.equal(
    packageNameFromSnapshotKey("@streamdown/mermaid@1.0.2(react@19.2.7)"),
    "@streamdown/mermaid",
  );
  assert.equal(packageNameFromSnapshotKey("mermaid@11.15.0"), "mermaid");
  assert.equal(packageNameFromSnapshotKey("react-dom@19.2.7(react@19.2.7)"), "react-dom");
});

test("extractImporterDependencies reads only plain `dependencies:`, never dev/optional", () => {
  const yaml = [
    "importers:",
    "  packages/ai:",
    "    dependencies:",
    "      streamdown:",
    "        specifier: ^2.4.0",
    "        version: 2.5.0(react@19.2.7)",
    "    devDependencies:",
    "      typescript:",
    "        specifier: ^5.0.0",
    "        version: 5.0.0",
    "    optionalDependencies:",
    "      mermaid:",
    "        specifier: ^11.0.0",
    "        version: 11.15.0",
    "",
  ].join("\n");
  const root = parsePnpmLockYaml(yaml);
  const importers = extractImporterDependencies(root);
  const aiDeps = importers.get("packages/ai");
  assert.equal(aiDeps.get("streamdown"), "2.5.0(react@19.2.7)");
  assert.equal(aiDeps.has("typescript"), false);
  assert.equal(aiDeps.has("mermaid"), false);
});

test("extractSnapshotDependencies ignores optionalDependencies/peerDependencies edges", () => {
  const yaml = [
    "snapshots:",
    "  streamdown@2.5.0(react@19.2.7):",
    "    dependencies:",
    "      mermaid: 11.15.0",
    "    peerDependencies:",
    "      ai: ^5.0.0",
    "    optionalDependencies:",
    "      shiki: 1.0.0",
    "",
  ].join("\n");
  const root = parsePnpmLockYaml(yaml);
  const snapshots = extractSnapshotDependencies(root);
  const deps = snapshots.get("streamdown@2.5.0(react@19.2.7)");
  assert.equal(deps.get("mermaid"), "11.15.0");
  assert.equal(deps.has("ai"), false);
  assert.equal(deps.has("shiki"), false);
});

// ─────────────────────────── closure walk ───────────────────────────

test("transitiveClosureNames walks nested dependency edges and is cycle-safe", () => {
  const snapshots = new Map([
    ["a@1.0.0", new Map([["b", "2.0.0"]])],
    [
      "b@2.0.0",
      new Map([
        ["c", "3.0.0"],
        ["a", "1.0.0"],
      ]),
    ], // cycle back to a
    ["c@3.0.0", new Map()],
  ]);
  const names = transitiveClosureNames("a@1.0.0", snapshots);
  assert.deepEqual([...names].sort(), ["a", "b", "c"]);
});

test("transitiveClosureNames skips link: (workspace) edges", () => {
  const snapshots = new Map([
    [
      "a@1.0.0",
      new Map([
        ["b", "link:../b"],
        ["c", "3.0.0"],
      ]),
    ],
    ["c@3.0.0", new Map()],
  ]);
  const names = transitiveClosureNames("a@1.0.0", snapshots);
  assert.deepEqual([...names].sort(), ["a", "c"]);
  assert.equal(names.has("b"), false);
});

// ─────────────────────────── findDefeatedOptionalPeers ───────────────────────────

function fixtureLock({ importerDeps, snapshotDeps }) {
  // importerDeps: Map<pkgRelDir, Map<depName, version>>
  // snapshotDeps: Map<snapshotKey, Map<depName, version>>
  return { importers: importerDeps, snapshots: snapshotDeps };
}

test("findDefeatedOptionalPeers: a clean tree (no plain edge reaches the peer) reports nothing", () => {
  const pkg = {
    name: "@elabs-ai/components-viewer",
    relDir: "packages/viewer",
    dependencies: { "@tanstack/react-virtual": "^3.0.0" },
    peerDependenciesMeta: { papaparse: { optional: true }, shiki: { optional: true } },
  };
  const { importers, snapshots } = fixtureLock({
    importerDeps: new Map([["packages/viewer", new Map([["@tanstack/react-virtual", "3.0.0"]])]]),
    snapshotDeps: new Map([["@tanstack/react-virtual@3.0.0", new Map()]]),
  });
  const result = findDefeatedOptionalPeers({ packages: [pkg], importers, snapshots });
  assert.deepEqual(result, []);
});

test("findDefeatedOptionalPeers: reports the peer AND names both responsible direct deps (the mermaid shape)", () => {
  const pkg = {
    name: "@elabs-ai/components-ai",
    relDir: "packages/ai",
    dependencies: { streamdown: "^2.4.0", "@streamdown/mermaid": "^1.0.2" },
    peerDependenciesMeta: { mermaid: { optional: true } },
  };
  const { importers, snapshots } = fixtureLock({
    importerDeps: new Map([
      [
        "packages/ai",
        new Map([
          ["streamdown", "2.5.0(react@19.2.7)"],
          ["@streamdown/mermaid", "1.0.2(react@19.2.7)"],
        ]),
      ],
    ]),
    snapshotDeps: new Map([
      [
        "streamdown@2.5.0(react@19.2.7)",
        new Map([
          ["mermaid", "11.15.0"],
          ["react", "19.2.7"],
        ]),
      ],
      [
        "@streamdown/mermaid@1.0.2(react@19.2.7)",
        new Map([
          ["mermaid", "11.15.0"],
          ["react", "19.2.7"],
        ]),
      ],
      ["mermaid@11.15.0", new Map()],
    ]),
  });
  const result = findDefeatedOptionalPeers({ packages: [pkg], importers, snapshots });
  assert.deepEqual(result, [
    {
      package: "@elabs-ai/components-ai",
      peer: "mermaid",
      via: ["@streamdown/mermaid", "streamdown"],
    },
  ]);
});

test("findDefeatedOptionalPeers: a peer NOT reachable from any direct dependency is not reported", () => {
  const pkg = {
    name: "@elabs-ai/components-ai",
    relDir: "packages/ai",
    dependencies: { "some-lib": "^1.0.0" },
    peerDependenciesMeta: { "@xterm/xterm": { optional: true } },
  };
  const { importers, snapshots } = fixtureLock({
    importerDeps: new Map([["packages/ai", new Map([["some-lib", "1.0.0"]])]]),
    snapshotDeps: new Map([
      ["some-lib@1.0.0", new Map([["lodash", "4.0.0"]])],
      ["lodash@4.0.0", new Map()],
    ]),
  });
  const result = findDefeatedOptionalPeers({ packages: [pkg], importers, snapshots });
  assert.deepEqual(result, []);
});

// ─────────────────────────── bidirectional ratchet (the required "plants a bad fixture, asserts FAIL" test) ───────────────────────────

test("diffAgainstBaseline FAILS (reports `added`) on a newly-defeated peer not yet in the baseline", () => {
  const current = [
    { package: "@elabs-ai/components-ai", peer: "mermaid", via: ["streamdown"] },
    { package: "@elabs-ai/components-viewer", peer: "shiki", via: ["some-new-dep"] }, // NEW, not baselined
  ];
  const baseline = [{ package: "@elabs-ai/components-ai", peer: "mermaid", via: ["streamdown"] }];
  const { added, stale, ok } = diffAgainstBaseline(current, baseline);
  assert.equal(ok, false, "gate must report failure when an unbaselined violation exists");
  assert.equal(added.length, 1);
  assert.equal(added[0].package, "@elabs-ai/components-viewer");
  assert.equal(added[0].peer, "shiki");
  assert.deepEqual(stale, []);
});

test("diffAgainstBaseline FAILS (reports `stale`) when a baselined entry has gone clean", () => {
  // Simulates the day upstream fixes this: streamdown declares mermaid optional,
  // so the transitive edge disappears — the gate must catch the STALE baseline
  // entry rather than silently staying green (this is the deliberate departure
  // from this repo's usual one-directional-only ratchet convention).
  const current = []; // nothing defeated any more
  const baseline = [
    {
      package: "@elabs-ai/components-ai",
      peer: "mermaid",
      via: ["@streamdown/mermaid", "streamdown"],
      justification: "issue #94",
    },
  ];
  const { added, stale, ok } = diffAgainstBaseline(current, baseline);
  assert.equal(ok, false, "gate must report failure when a baselined entry is now clean");
  assert.deepEqual(added, []);
  assert.equal(stale.length, 1);
  assert.equal(stale[0].package, "@elabs-ai/components-ai");
  assert.equal(stale[0].peer, "mermaid");
});

test("diffAgainstBaseline PASSES when current exactly matches the baseline (identity by package+peer, `via` may differ)", () => {
  const current = [
    {
      package: "@elabs-ai/components-ai",
      peer: "mermaid",
      via: ["@streamdown/mermaid", "streamdown"],
    },
  ];
  const baseline = [
    {
      package: "@elabs-ai/components-ai",
      peer: "mermaid",
      via: ["streamdown"], // a resolution bump could reorder/shrink `via` without changing identity
      justification: "issue #94",
    },
  ];
  const { added, stale, ok } = diffAgainstBaseline(current, baseline);
  assert.equal(ok, true);
  assert.deepEqual(added, []);
  assert.deepEqual(stale, []);
});

test("diffAgainstBaseline PASSES on an empty tree with an empty baseline", () => {
  const { ok } = diffAgainstBaseline([], []);
  assert.equal(ok, true);
});

// ─────────────────────────── end-to-end: the exact real-repo mermaid shape, from raw YAML text ───────────────────────────

test("end-to-end: parses a realistic pnpm-lock.yaml excerpt and finds the mermaid defeat via both edges", () => {
  const yaml = [
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
    "",
    "  mermaid@11.15.0:",
    "    dependencies:",
    "      dompurify: 3.0.0",
    "",
    "  dompurify@3.0.0: {}",
    "",
  ].join("\n");

  const root = parsePnpmLockYaml(yaml);
  const importers = extractImporterDependencies(root);
  const snapshots = extractSnapshotDependencies(root);

  const pkg = {
    name: "@elabs-ai/components-ai",
    relDir: "packages/ai",
    dependencies: { streamdown: "^2.4.0", "@streamdown/mermaid": "^1.0.2" },
    peerDependenciesMeta: { mermaid: { optional: true } },
  };
  const result = findDefeatedOptionalPeers({ packages: [pkg], importers, snapshots });
  assert.deepEqual(result, [
    {
      package: "@elabs-ai/components-ai",
      peer: "mermaid",
      via: ["@streamdown/mermaid", "streamdown"],
    },
  ]);
});
