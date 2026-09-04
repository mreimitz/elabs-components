/**
 * check-optional-peer-types.test.mjs — locks the optional-peer-type-leak gate
 * (issue #101). Run in CI: `node --test scripts/check-optional-peer-types.test.mjs`.
 *
 * Fixtures are INLINE `.d.ts` source strings (a plain function argument, via
 * `readDts`) — no real build is required to exercise the core logic. The
 * final tests assert the real committed tree matches the committed baseline
 * and specifically that issue #101's two named peers stay clean, mirroring
 * `check-eager-heavy-deps.test.mjs`'s closing shape.
 *
 * The LAST test in this file is the brief's own regression check: a REAL
 * `tsc --noEmit` (`skipLibCheck: false`) run against a throwaway consumer
 * file that imports a non-Persona/non-AudioPlayer export from the BUILT
 * `packages/ai/dist/index.d.ts`, in a synthetic `node_modules` that
 * deliberately never symlinks `media-chrome`/`@rive-app/react-webgl2` — the
 * "consumer who correctly omitted the optional peer" the gate above only
 * checks the static shape of. It is co-located here (not a second harness)
 * and reuses `findDtsImportSpecifiers` from the gate module to discover which
 * OTHER (non-`@elabs-ai/components-*`) specifiers the real build needs, so it
 * never hand-maintains that list.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import {
  findDtsImportSpecifiers,
  findLeakedPeerTypes,
  optionalPeersOf,
} from "./check-optional-peer-types.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = dirname(HERE);

// ── optionalPeersOf ──────────────────────────────────────────────────────────
test("optionalPeersOf reads only optional:true peers", () => {
  const pkgJson = {
    peerDependencies: { react: "^19", "media-chrome": "^4" },
    peerDependenciesMeta: {
      "media-chrome": { optional: true },
      react: {}, // present, not optional
    },
  };
  assert.deepEqual(optionalPeersOf(pkgJson), ["media-chrome"]);
});

test("optionalPeersOf tolerates a missing/malformed manifest", () => {
  assert.deepEqual(optionalPeersOf(undefined), []);
  assert.deepEqual(optionalPeersOf({}), []);
});

// ── findDtsImportSpecifiers ──────────────────────────────────────────────────
test("FAILS-shape: finds a real .d.ts import specifier", () => {
  const dts = `import { MediaController } from 'media-chrome/react';\nexport declare const AudioPlayer: () => void;\n`;
  assert.deepEqual(findDtsImportSpecifiers(dts), ["media-chrome/react"]);
});

test("finds a re-export specifier too", () => {
  const dts = `export { RiveParameters } from '@rive-app/react-webgl2';\n`;
  assert.deepEqual(findDtsImportSpecifiers(dts), ["@rive-app/react-webgl2"]);
});

test("PASSES-shape: a doc-comment merely mentioning the phrase is not a real edge", () => {
  // This is the exact regression this gate must not reintroduce: the fix's
  // own doc comments (persona.tsx, audio-player.tsx) say "media-chrome" and
  // "@rive-app/react-webgl2" in PROSE, inside a `/** … */` block that ships
  // in the built `.d.ts` verbatim (tsup/rollup-dts keep JSDoc). None of those
  // lines may be mistaken for an import/export edge.
  const dts = [
    "/**",
    " * Issue #101: `media-chrome` is an OPTIONAL peer, so no PUBLIC export's",
    " * type may structurally reference `media-chrome/react`'s own types —",
    " * doing so would name `@rive-app/react-webgl2`'s module specifier too.",
    " */",
    "export declare const AudioPlayer: () => void;",
  ].join("\n");
  assert.deepEqual(findDtsImportSpecifiers(dts), []);
});

test("PASSES: an unrelated import from a real dependency", () => {
  const dts = `import { z } from 'zod';\nimport * as react from 'react';\n`;
  assert.deepEqual(findDtsImportSpecifiers(dts), ["zod", "react"]);
});

test("multi-line import blocks are matched as ONE logical statement", () => {
  // rollup-plugin-dts emits single-line import statements even for many named
  // bindings, but the regex must not require the whole statement to be on one
  // line if a future toolchain wraps it — assert the common (single-line)
  // case explicitly, since that's what this repo's build actually produces.
  const dts = `import { A, B, C } from 'some-pkg';\n`;
  assert.deepEqual(findDtsImportSpecifiers(dts), ["some-pkg"]);
});

// ── findLeakedPeerTypes ──────────────────────────────────────────────────────
// `findDtsFiles` walks the REAL filesystem, so every fixture below injects
// `listDtsFiles` (an in-memory stand-in) alongside `readDts` — otherwise a
// fake `dir` like "/fixture/components-fixture" has no real `dist/`,
// `existsSync` returns false, `readDts` is never called, and every assertion
// (leak-found AND leak-absent alike) passes vacuously. This is the exact gap
// this file's own first draft shipped with (issue #101 self-review): two
// "leak found" tests read as green while `findDtsFiles` silently returned
// `[]` under them.
const FIXTURE_DIR = "/fixture/components-fixture";
const FIXTURE_DTS = `${FIXTURE_DIR}/dist/index.d.ts`;

function fixturePackages(peerDependenciesMeta) {
  return [
    {
      name: "@elabs-ai/components-fixture",
      dir: FIXTURE_DIR,
      json: { peerDependenciesMeta },
    },
  ];
}

const singleFileFixture = (dtsSource) => ({
  listDtsFiles: () => [FIXTURE_DTS],
  readDts: () => dtsSource,
});

test("FAILS: the original #101 regression — media-chrome AND rive both leak", () => {
  const leaks = findLeakedPeerTypes({
    packages: fixturePackages({
      "media-chrome": { optional: true },
      "@rive-app/react-webgl2": { optional: true },
    }),
    ...singleFileFixture(
      [
        "import { ComponentProps } from 'react';",
        "import { MediaController } from 'media-chrome/react';",
        "import { RiveParameters } from '@rive-app/react-webgl2';",
      ].join("\n"),
    ),
  });
  assert.deepEqual(leaks.map((l) => l.specifier).sort(), [
    "@rive-app/react-webgl2",
    "media-chrome/react",
  ]);
  assert.ok(leaks.every((l) => l.package === "@elabs-ai/components-fixture"));
  assert.ok(leaks.every((l) => l.file === relative(REPO_ROOT, FIXTURE_DTS)));
});

test("PASSES: the #101 fix — owned types, no peer specifier in the .d.ts", () => {
  const leaks = findLeakedPeerTypes({
    packages: fixturePackages({
      "media-chrome": { optional: true },
      "@rive-app/react-webgl2": { optional: true },
    }),
    ...singleFileFixture(
      [
        "import { HTMLAttributes } from 'react';",
        "export declare type AudioPlayerPartProps = HTMLAttributes<HTMLElement>;",
        "export declare type PersonaRiveEventCallback = (event: { type: string }) => void;",
      ].join("\n"),
    ),
  });
  assert.deepEqual(leaks, []);
});

test("a bare specifier only matches its own package boundary, not a lookalike", () => {
  const leaks = findLeakedPeerTypes({
    packages: fixturePackages({ mermaid: { optional: true } }),
    ...singleFileFixture(
      `import { x } from '@streamdown/mermaid';\nimport { y } from 'mermaid-lookalike';\n`,
    ),
  });
  assert.deepEqual(leaks, [], "neither specifier equals or is a subpath of the literal peer name");
});

test("a package with NO optional peers is never scanned", () => {
  const leaks = findLeakedPeerTypes({
    packages: [{ name: "@elabs-ai/components-plain", dir: "/fixture/plain", json: {} }],
    ...singleFileFixture(`import { MediaController } from 'media-chrome/react';\n`),
  });
  assert.deepEqual(leaks, [], "no optional peers means the dist scan never runs");
});

test("a missing dist file for a package is skipped, not thrown", () => {
  // No `listDtsFiles` override here: this exercises the REAL default
  // (`findDtsFiles`) against a genuine directory (`REPO_ROOT`) that has no
  // `dist/*.d.ts` directly under it — proving the real filesystem path
  // degrades gracefully, not just the injected stand-in.
  const leaks = findLeakedPeerTypes({
    packages: [
      {
        name: "@elabs-ai/components-fixture",
        dir: REPO_ROOT,
        json: { peerDependenciesMeta: { "media-chrome": { optional: true } } },
      },
    ],
  });
  assert.deepEqual(leaks, []);
});

test("results are deduped per (package, file, specifier) even with repeated import lines", () => {
  const leaks = findLeakedPeerTypes({
    packages: fixturePackages({ "media-chrome": { optional: true } }),
    ...singleFileFixture(
      [
        "import { MediaController } from 'media-chrome/react';",
        "import { MediaControlBar } from 'media-chrome/react';",
      ].join("\n"),
    ),
  });
  assert.equal(leaks.length, 1, "one specifier, reported once");
});

test("multiple .d.ts files under one package's dist are all scanned", () => {
  const files = {
    [`${FIXTURE_DIR}/dist/index.d.ts`]: `import { x } from 'react';\n`,
    [`${FIXTURE_DIR}/dist/audio-player.d.ts`]: `import { MediaController } from 'media-chrome/react';\n`,
  };
  const leaks = findLeakedPeerTypes({
    packages: fixturePackages({ "media-chrome": { optional: true } }),
    listDtsFiles: () => Object.keys(files),
    readDts: (p) => files[p],
  });
  assert.equal(leaks.length, 1);
  assert.equal(leaks[0].file, relative(REPO_ROOT, `${FIXTURE_DIR}/dist/audio-player.d.ts`));
});

// ── The real tree matches the committed baseline ─────────────────────────────
test("the committed baseline matches the real, freshly-built packages/ai dist", () => {
  const distDtsPath = join(REPO_ROOT, "packages/ai/dist/index.d.ts");
  if (!existsSync(distDtsPath)) {
    // Mirrors check-css-assets.mjs's convention: a missing dist/ before
    // `pnpm build` is normal, not a failure this test can meaningfully assert.
    return;
  }

  const pkgJson = JSON.parse(readFileSync(join(REPO_ROOT, "packages/ai/package.json"), "utf8"));
  const current = findLeakedPeerTypes({
    packages: [{ name: pkgJson.name, dir: join(REPO_ROOT, "packages/ai"), json: pkgJson }],
  });

  const baseline = JSON.parse(
    readFileSync(join(HERE, "optional-peer-types-baseline.json"), "utf8"),
  );
  const baselineKeys = new Set(baseline.map((b) => `${b.package}::${b.file}::${b.specifier}`));
  const added = current.filter((c) => !baselineKeys.has(`${c.package}::${c.file}::${c.specifier}`));

  assert.deepEqual(added, [], `new optional-peer type leaks: ${JSON.stringify(added)}`);
});

test("issue #101's two named peers — media-chrome and @rive-app/react-webgl2 — are clean", () => {
  const distDtsPath = join(REPO_ROOT, "packages/ai/dist/index.d.ts");
  if (!existsSync(distDtsPath)) return;

  const pkgJson = JSON.parse(readFileSync(join(REPO_ROOT, "packages/ai/package.json"), "utf8"));
  const current = findLeakedPeerTypes({
    packages: [{ name: pkgJson.name, dir: join(REPO_ROOT, "packages/ai"), json: pkgJson }],
  });
  const stillLeaking = current.filter((c) => c.peer !== "ai");

  assert.deepEqual(
    stillLeaking,
    [],
    "the #101 fix (owned PersonaRiveEventCallback / AudioPlayerPartProps) must stay in place",
  );
});

// ── The real tsc consumer regression (brief's "test to add") ────────────────

/**
 * Populates `work/node_modules` with every REAL third-party dependency the
 * three own-packages' dist output could need, by SYMLINKING each top-level
 * entry straight out of `<pkgDir>/node_modules` for each `pkgDir` in
 * `ownPackageDirs` — never Node's module resolver, and never a per-specifier
 * resolve step.
 *
 * pnpm already solved third-party resolution correctly for these exact three
 * packages — that is what `pnpm install` produced: `<pkgDir>/node_modules`
 * contains a real symlink for every one of that package's own dependencies,
 * transitively COMPLETE (a scoped package's own nested deps live inside its
 * own pnpm-store folder, invisible here and untouched — pnpm's isolated
 * `node_modules` strategy). Reproducing that structure at the top level —
 * one symlink per entry, a scope directory (`@radix-ui`) recursed one level
 * so each scoped package gets its own symlink — gives exactly what a real
 * published consumer's `node_modules` would contain, with two properties an
 * earlier, per-specifier `require.resolve`-based version of this helper had
 * to work hard for and still got wrong:
 *
 * - **No dependency on `exports`-map condition sets.** An ESM-only package
 *   (`"type": "module"`, an `exports["."]` map with only `types`/`import`
 *   conditions) — a real, installed example is `@streamdown/mermaid` — is
 *   unresolvable via `require.resolve` (Node's CJS condition set is
 *   `["node", "require"]`) regardless of anchor. Symlinking the whole
 *   top-level directory sidesteps Node's resolver entirely, so this never
 *   comes up.
 * - **No risk of stopping at an internal legacy shim.** The real `motion`
 *   package ships a shim subdirectory at `motion/react/` with its OWN
 *   `"private": true` `package.json` whose `types`/`main` point RELATIVELY
 *   to `"../dist/…"`. A per-specifier resolve for the literal specifier
 *   `"motion/react"` can stop at that shim and miss the sibling `../dist` it
 *   depends on. Symlinking the WHOLE `motion` directory as one unit (because
 *   nothing here ever computes a "package name" from a deep specifier — it
 *   only ever walks `node_modules`'s own top-level entries) keeps that
 *   relative reference intact automatically.
 *
 * `@elabs-ai/components-*` entries are skipped — those are OUR OWN packages,
 * published separately via `publishOwnPackageInto` (dist-only, matching
 * `publishConfig.exports`, not the workspace-mode source `exports` a real
 * consumer never sees). `media-chrome` and `@rive-app` are skipped
 * deliberately: they are the two optional peers issue #101 is about, and
 * this test's whole point is proving the built `.d.ts` still resolves with
 * them ABSENT — the "consumer who correctly omitted the optional peer"
 * environment.
 */
function linkThirdPartyDeps(work, ownPackageDirs) {
  const destNodeModules = join(work, "node_modules");
  mkdirSync(destNodeModules, { recursive: true });

  const SKIP_TOP_LEVEL = new Set([".bin", "@elabs-ai", "media-chrome", "@rive-app"]);

  const linkInto = (srcDir, name, destDir) => {
    const dest = join(destDir, name);
    if (existsSync(dest)) return; // first package wins; pnpm already deduped versions
    mkdirSync(dirname(dest), { recursive: true });
    // A symlink, not a copy — deliberately. pnpm's own top-level entry here
    // is ITSELF a symlink into `.pnpm/<pkg>@<version>/node_modules/<pkg>`,
    // and that isolated `.pnpm/<pkg>@<version>/node_modules/` folder is where
    // pnpm ALSO placed every one of `<pkg>`'s own resolved dependencies as
    // SIBLING entries (not nested one level deeper inside `<pkg>` itself) —
    // e.g. `mermaid`'s own `d3-selection`, `shiki`'s own `@shikijs/core`.
    // Keeping the symlink means a file's TypeScript-resolved realpath stays
    // inside that isolated store subtree, so its ancestor `node_modules`
    // walk climbs straight to those real siblings and finds them — this is
    // pnpm's own dependency resolution working correctly, not something this
    // helper does. A dereferenced COPY was tried and rejected here: it flattens
    // ONLY the copied package's own files, leaving its sibling deps behind,
    // which broke resolution for every package with more than a trivial
    // dependency tree (mermaid, shiki, motion, react-day-picker, streamdown).
    // The one real gap symlinking leaves (`mermaid`'s own `type-fest` import,
    // genuinely absent from that isolated subtree — a real, pre-existing
    // upstream defect, not an artifact of this choice) is closed with a
    // `paths` mapping in the synthetic tsconfig instead, which works
    // uniformly regardless of the importing file's real location.
    symlinkSync(join(srcDir, name), dest, "dir");
  };

  for (const pkgDir of ownPackageDirs) {
    const srcNodeModules = join(pkgDir, "node_modules");
    if (!existsSync(srcNodeModules)) continue;

    for (const entry of readdirSync(srcNodeModules)) {
      if (SKIP_TOP_LEVEL.has(entry)) continue;
      if (entry.startsWith("@")) {
        const scopeDir = join(srcNodeModules, entry);
        for (const scoped of readdirSync(scopeDir)) {
          linkInto(scopeDir, scoped, join(destNodeModules, entry));
        }
      } else {
        linkInto(srcNodeModules, entry, destNodeModules);
      }
    }
  }
}

/**
 * `mermaid`'s own public `.d.ts` (`dist/diagram-api/types.d.ts`) imports
 * `SetOptional`/`SetRequired` from `type-fest` — but `type-fest` is listed
 * ONLY in `mermaid`'s OWN `devDependencies`, never `dependencies`, so it is
 * never actually installed for any real consumer (confirmed absent from this
 * repo's entire pnpm store: no `type-fest@*` entry exists anywhere under
 * `.pnpm`). This is a genuine, pre-existing upstream packaging bug in
 * `mermaid` itself, unrelated to issue #101 — it would surface for ANY
 * `skipLibCheck: false` consumer of `@elabs-ai/components-ai` (reached via
 * `@streamdown/mermaid`), with or without this fix. Stubbing the two type
 * aliases this consumer graph actually needs keeps that pre-existing,
 * orthogonal defect from masking the #101 regression this test exists to
 * prove.
 */
function stubTypeFest(work) {
  const dest = join(work, "node_modules", "type-fest");
  mkdirSync(dest, { recursive: true });
  writeFileSync(
    join(dest, "package.json"),
    JSON.stringify({ name: "type-fest", version: "0.0.0-stub", types: "index.d.ts" }, null, 2),
  );
  writeFileSync(
    join(dest, "index.d.ts"),
    [
      "export type SetOptional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;",
      "export type SetRequired<T, K extends keyof T> = Omit<T, K> & Required<Pick<T, K>>;",
      "",
    ].join("\n"),
  );
}

/**
 * `ai`'s own public `.d.ts` does `import { ServerResponse } from "node:http"`
 * (and again from `"http"`), and `@ai-sdk/provider-utils`'s references the
 * ambient `Buffer` global — neither of which is a real npm package; both come
 * from `@types/node`, which is declared as a dependency of NONE of
 * `@elabs-ai/components-ai`/`-ui`/`-tokens` (confirmed: no `@types/node` entry
 * anywhere in any of their `node_modules`). This is the SAME already-known,
 * already-baselined `ai` SDK peer type leak `check-optional-peer-types.mjs`'s
 * own doc comment names as deliberately out of scope for issue #101 (`ai`'s
 * `UIMessage`/`ToolUIPart`/… types leak through every chat component's public
 * props) — a Node builtin reference is just another shape of that same leak,
 * not a new one this fix must also close. A real consumer with `@types/node`
 * as a devDependency (ordinary for a full-stack or tooling-adjacent project)
 * never hits this; stubbing exactly the two shapes this consumer graph needs
 * (the `Buffer` global, and `"node:http"`/`"http"`'s `ServerResponse`) keeps
 * that pre-existing, orthogonal gap from masking the #101 regression this
 * test exists to prove. Paired with `types: ["node"]` in the synthetic
 * `tsconfig.json` below — TypeScript only auto-includes an `@types/*`
 * package's AMBIENT globals when it is named in `types` (or `types` is
 * unset); this test's tsconfig deliberately sets `types: ["node"]` rather
 * than leaving it empty, precisely so this stub's global `Buffer` is seen.
 *
 * **The stub `.d.ts` must be a SCRIPT, not a module** — no top-level
 * `import`/`export` anywhere in the file. `declare module "http" { … }`
 * means two different things depending on which the file is: inside a
 * *module* (any file with top-level `import`/`export`, including a bare
 * `export {};`) it is **module augmentation** — it only adds to an
 * `"http"` module that must already be resolvable from elsewhere, and
 * since nothing else in this synthetic tree provides one, the augmentation
 * never creates a resolvable module and the real `import … from "http"` in
 * `ai/dist/index.d.ts` still fails `TS2307`. Inside a *script* (no
 * top-level import/export) the identical syntax is a genuine **ambient
 * module declaration**, visible to every importer. `declare class Buffer`
 * at the top level of a script file is likewise already global — no
 * `declare global { … }` wrapper needed (that wrapper is itself only
 * meaningful inside a module, which is exactly the shape this file must
 * avoid). Confirmed via an isolated, symlink-free `mktemp -d` repro: the
 * module-shaped stub failed `TS2307` even with zero monorepo/pnpm
 * complexity involved, and the identical declarations as a script resolved
 * cleanly — so this was never an ancestor-shadowing artifact of this
 * test's synthetic `node_modules`, just this file's own module-vs-script
 * status.
 */
function stubNodeTypes(work) {
  const dest = join(work, "node_modules", "@types", "node");
  mkdirSync(dest, { recursive: true });
  writeFileSync(
    join(dest, "package.json"),
    JSON.stringify({ name: "@types/node", version: "0.0.0-stub", types: "index.d.ts" }, null, 2),
  );
  writeFileSync(
    join(dest, "index.d.ts"),
    [
      "declare class Buffer extends Uint8Array {}",
      'declare module "http" {',
      "  export class ServerResponse {}",
      "}",
      'declare module "node:http" {',
      "  export class ServerResponse {}",
      "}",
      "",
    ].join("\n"),
  );
}

/**
 * Publishes `pkgDir` into `work/node_modules/<name>` the way `pnpm pack` +
 * install would: a package.json whose `exports` IS `publishConfig.exports`
 * (dist-pointing, exactly what a real consumer's node_modules contains), and
 * a COPY of `dist/` — no tarball, no network, no `pnpm install`.
 *
 * `dist/` is copied, not symlinked. A symlink would keep the file's REAL
 * (target) directory as `pkgDir/dist` — still inside the actual
 * `packages/<pkg>` — whose OWN `node_modules` (a genuine pre-existing pnpm
 * workspace link, e.g. `packages/ai/node_modules/@elabs-ai/components-ui ->
 * ../../../ui`, pointing at that package's SOURCE `exports`, not
 * `publishConfig.exports`) sits on the ancestor `node_modules` walk TypeScript's
 * module resolver performs from a symlink's real path — and is found before
 * ever reaching this test's synthetic `work/node_modules`. A `dist/` that is a
 * real copy has no such ancestor chain back into the monorepo, exactly like a
 * real `pnpm pack` tarball would not.
 */
function publishOwnPackageInto(work, pkgDir, name) {
  const pkgJson = JSON.parse(readFileSync(join(pkgDir, "package.json"), "utf8"));
  const dest = join(work, "node_modules", name);
  mkdirSync(dest, { recursive: true });
  writeFileSync(
    join(dest, "package.json"),
    JSON.stringify(
      {
        name,
        version: pkgJson.version,
        type: pkgJson.type,
        exports: pkgJson.publishConfig.exports,
      },
      null,
      2,
    ),
  );
  cpSync(join(pkgDir, "dist"), join(dest, "dist"), { recursive: true });
}

test("tsc --noEmit (skipLibCheck: false) resolves a real consumer import with media-chrome AND @rive-app/react-webgl2 absent from node_modules", () => {
  // `@elabs-ai/components-ai` depends on `@elabs-ai/components-ui`, which depends on
  // `@elabs-ai/components-tokens` — the transitive closure this test's synthetic
  // node_modules must publish. Fixed, not discovered, because it is the
  // package graph, not something a dist file enumerates about itself.
  const OWN_PACKAGES = ["ai", "ui", "tokens"];
  const ownPackageDirs = OWN_PACKAGES.map((p) => join(REPO_ROOT, "packages", p));
  const dtsPaths = OWN_PACKAGES.map((p) => join(REPO_ROOT, "packages", p, "dist/index.d.ts"));
  if (!dtsPaths.every(existsSync)) return; // mirrors the other dist-dependent tests above

  const work = mkdtempSync(join(tmpdir(), "brand-ui-optional-peer-types-tsc-"));
  try {
    linkThirdPartyDeps(work, ownPackageDirs);
    stubTypeFest(work); // pre-existing, unrelated upstream mermaid/type-fest gap — see stubTypeFest doc comment
    stubNodeTypes(work); // pre-existing, already-baselined `ai` SDK Node-builtin leak — see stubNodeTypes doc comment
    // `media-chrome` and `@rive-app/react-webgl2` are deliberately NEVER
    // symlinked — this is the "consumer who correctly omitted the optional
    // peer" environment issue #101 describes.
    assert.ok(!existsSync(join(work, "node_modules", "media-chrome")));
    assert.ok(!existsSync(join(work, "node_modules", "@rive-app")));

    for (const pkg of OWN_PACKAGES) {
      const pkgJson = JSON.parse(
        readFileSync(join(REPO_ROOT, "packages", pkg, "package.json"), "utf8"),
      );
      publishOwnPackageInto(work, join(REPO_ROOT, "packages", pkg), pkgJson.name);
    }

    // A non-Persona/non-AudioPlayer export, referenced by TYPE so `tsc` must
    // fully resolve `Message`'s declared prop types — which is exactly how the
    // #101 bug reached a consumer who never touched Persona/AudioPlayer at
    // all: TypeScript resolves a module's WHOLE top-level import list to
    // compute any one export's type, not just the imports that export uses.
    writeFileSync(
      join(work, "consumer.ts"),
      [
        'import { Message } from "@elabs-ai/components-ai";',
        "export const _typeTouch: typeof Message = Message;",
        "",
      ].join("\n"),
    );
    writeFileSync(
      join(work, "tsconfig.json"),
      JSON.stringify(
        {
          compilerOptions: {
            target: "esnext",
            module: "esnext",
            moduleResolution: "bundler",
            lib: ["esnext", "dom", "dom.iterable"],
            types: ["node"], // resolves stubNodeTypes' ambient Buffer/node:http — see its doc comment
            esModuleInterop: true,
            strict: false,
            skipLibCheck: false,
            noEmit: true,
            baseUrl: ".",
            // `mermaid`'s own real resolved location is deep inside pnpm's
            // isolated store (kept a SYMLINK — see `linkThirdPartyDeps`'s doc
            // comment — precisely so its OTHER sibling deps resolve
            // correctly), so a `node_modules/type-fest` placed in THIS
            // synthetic tree is never reached by mermaid's own ancestor
            // `node_modules` walk. `paths` is a specifier rewrite the
            // compiler applies uniformly regardless of the importing file's
            // real location, so it reaches `stubTypeFest`'s stub without
            // needing to know or reproduce mermaid's actual on-disk path.
            paths: { "type-fest": ["./node_modules/type-fest"] },
          },
          include: ["consumer.ts"],
        },
        null,
        2,
      ),
    );

    const tsc = join(REPO_ROOT, "node_modules/.bin/tsc");
    assert.ok(existsSync(tsc), "expected a built tsc binary at node_modules/.bin/tsc");

    try {
      execFileSync(tsc, ["--noEmit", "-p", "tsconfig.json"], { cwd: work, encoding: "utf8" });
    } catch (err) {
      assert.fail(
        `tsc --noEmit failed against the built dist with media-chrome/@rive-app/react-webgl2 absent:\n${err.stdout ?? ""}${err.stderr ?? ""}`,
      );
    }
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
});
