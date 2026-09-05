/**
 * check-tailwind-sources.test.mjs — self-test for the Tailwind `@source`
 * coverage gate (#348). Run in CI: `node --test scripts/check-tailwind-sources.test.mjs`
 * (`pnpm tailwind-sources:check:test`).
 *
 * A gate that can silently stop firing is worse than none
 * (`.claude/rules/quality-gates.md`, "Enforcement over reminders"), so this file:
 *
 *   1. Unit-tests every pure function on inline fixtures — including the exact
 *      shape that broke the first draft of this gate (a `**\/` recursive-glob
 *      segment inside a quoted `@source` value getting eaten by a naive
 *      CSS-comment stripper).
 *   2. PLANTS bad trees on disk (mirroring the issue's own "Test to add" list)
 *      and asserts the CLI exits non-zero and names the offending package +
 *      CSS file, or exits zero where it should.
 *   3. Asserts the gate is still WIRED (package.json + the blocking job in
 *      gates.yml + the AGENTS.md command contract that `pnpm docs:check`
 *      cross-checks against ci.yml).
 *   4. Runs the CLI directly against the REAL repo tree and asserts it passes.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  EXEMPT_PACKAGES,
  REPO_ROOT,
  checkTailwindSources,
  extractSourceValues,
  main,
  sourceBaseDir,
  stripCssComments,
  tailwindScopedPackages,
  tailwindSourceCssFiles,
} from "./check-tailwind-sources.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const GATE = path.join(HERE, "check-tailwind-sources.mjs");

// ── 1. pure-function unit tests ──────────────────────────────────────────────

test("stripCssComments: removes a real block comment", () => {
  const text = '/* a comment\n   spanning lines */\n@source "x";';
  assert.equal(stripCssComments(text).trim(), '@source "x";');
});

test("stripCssComments: does NOT eat a recursive-glob marker inside a quoted @source value", () => {
  // This is the exact shape that broke the first draft: a naive
  // `/\/\*[\s\S]*?\*\//` regex reads the four characters "/**/ " inside the
  // string as an EMPTY comment (opener immediately followed by closer) and
  // deletes them, truncating the glob.
  const text = '@source "../../../packages/ui/src/**/*.{ts,tsx}";';
  assert.equal(stripCssComments(text), text);
});

test("stripCssComments: a real comment AFTER a glob-bearing string is still stripped", () => {
  const text = '@source "../../../packages/ui/src/**/*.{ts,tsx}"; /* trailing note */';
  assert.equal(stripCssComments(text).trim(), '@source "../../../packages/ui/src/**/*.{ts,tsx}";');
});

test("extractSourceValues: ignores an @source-shaped mention inside a doc comment", () => {
  const text = "/* Tailwind ignores node_modules unless you @source it. */\n";
  assert.deepEqual(extractSourceValues(text), []);
});

test("extractSourceValues: reads a real directive with the recursive-glob segment intact", () => {
  const text = '@source "../../../packages/process/src/**/*.{ts,tsx}";';
  assert.deepEqual(extractSourceValues(text), ["../../../packages/process/src/**/*.{ts,tsx}"]);
});

test("extractSourceValues: reads a dist-shaped directive", () => {
  const text = '@source "../node_modules/@elabs-ai/components-process/dist";';
  assert.deepEqual(extractSourceValues(text), [
    "../node_modules/@elabs-ai/components-process/dist",
  ]);
});

test("sourceBaseDir: resolves the SRC glob's base directory relative to the CSS file", () => {
  const cssFile = "/repo/apps/docs/.storybook/preview.css";
  const resolved = sourceBaseDir(cssFile, "../../../packages/process/src/**/*.{ts,tsx}");
  assert.equal(resolved, "/repo/packages/process/src");
});

test("sourceBaseDir: a bare directory (DIST shape, no glob magic) resolves as a whole", () => {
  const cssFile = "/repo/fixtures/consumer-smoke/src/index.css";
  const resolved = sourceBaseDir(cssFile, "../node_modules/@elabs-ai/components-process/dist");
  assert.equal(
    resolved,
    "/repo/fixtures/consumer-smoke/node_modules/@elabs-ai/components-process/dist",
  );
});

test("sourceBaseDir: RESOLVES rather than string-matches -- a wrong relative depth lands elsewhere", () => {
  const cssFile = "/repo/apps/docs/.storybook/preview.css";
  // One ".." short -- looks similar as a string, resolves to the wrong directory.
  const resolved = sourceBaseDir(cssFile, "../../packages/process/src/**/*.{ts,tsx}");
  assert.notEqual(resolved, "/repo/packages/process/src");
  assert.equal(resolved, "/repo/apps/packages/process/src");
});

test("EXEMPT_PACKAGES names tokens with a reason, not a silent filter", () => {
  assert.ok(typeof EXEMPT_PACKAGES.tokens === "string" && EXEMPT_PACKAGES.tokens.length > 0);
});

test("checkTailwindSources: flags an uncovered package with the CSS file + a suggestion", () => {
  const root = "/repo";
  const cssFile = path.join(root, "apps/docs/.storybook/preview.css");
  const cssFiles = [
    {
      path: cssFile,
      text: '@source "../../../packages/ui/src/**/*.{ts,tsx}";',
    },
  ];
  const packages = [
    { name: "ui", srcDir: path.join(root, "packages/ui/src") },
    { name: "process", srcDir: path.join(root, "packages/process/src") },
  ];
  const violations = checkTailwindSources({ cssFiles, packages, root });
  assert.equal(violations.length, 1);
  assert.equal(violations[0].package, "process");
  assert.match(violations[0].file, /preview\.css$/);
  assert.match(violations[0].suggestion, /@source ".*packages\/process\/src.*"/);
});

test("checkTailwindSources: a DIST-shaped file is satisfied by a dist-shaped directive", () => {
  const root = mkdtempSync(path.join(tmpdir(), "tw-sources-unit-"));
  writeFileSync(
    path.join(root, "package.json"),
    JSON.stringify({ name: "@elabs-ai/components-process" }),
    "utf8",
  ); // never read directly -- readPackageName reads packages/<name>/package.json
  mkdirSync(path.join(root, "packages", "process"), { recursive: true });
  writeFileSync(
    path.join(root, "packages", "process", "package.json"),
    JSON.stringify({ name: "@elabs-ai/components-process" }),
  );
  try {
    const cssFile = path.join(root, "fixtures/consumer-smoke/src/index.css");
    const cssFiles = [
      {
        path: cssFile,
        text: '@source "../node_modules/@elabs-ai/components-process/dist";',
      },
    ];
    const packages = [{ name: "process", srcDir: path.join(root, "packages/process/src") }];
    const violations = checkTailwindSources({ cssFiles, packages, root });
    assert.equal(violations.length, 0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// ── 2. on-disk fixtures — plant a tree, run the real CLI ─────────────────────

/** Write a fixture tree; returns its root. Caller removes it. */
function plant(build) {
  const root = mkdtempSync(path.join(tmpdir(), "tw-sources-"));
  const write = (rel, text) => {
    const p = path.join(root, rel);
    mkdirSync(path.dirname(p), { recursive: true });
    writeFileSync(p, text);
  };
  build(write);
  return root;
}

/** Run the gate's CLI against a fixture root. Returns `{ status, output }`. */
function run(root) {
  try {
    const output = execFileSync(process.execPath, [GATE, "--root", root], { encoding: "utf8" });
    return { status: 0, output };
  } catch (err) {
    return { status: err.status ?? 1, output: `${err.stdout ?? ""}${err.stderr ?? ""}` };
  }
}

const TSX_WITH_CLASSES = `export function Widget() {
  return <div className="flex items-center opacity-35">hi</div>;
}
`;

test("PLANT 1: an @source list missing a package with real .tsx source -> FAILS, names both", () => {
  const root = plant((write) => {
    write("packages/ui/package.json", `{ "name": "@elabs-ai/components-ui" }`);
    write("packages/ui/src/widget.tsx", TSX_WITH_CLASSES);
    write("packages/process/package.json", `{ "name": "@elabs-ai/components-process" }`);
    write("packages/process/src/widget.tsx", TSX_WITH_CLASSES);
    // preview.css only names `ui` -- `process` is missing.
    write(
      "apps/docs/.storybook/preview.css",
      '@source "../../../packages/ui/src/**/*.{ts,tsx}";\n',
    );
  });
  try {
    const { status, output } = run(root);
    assert.equal(status, 1);
    assert.match(output, /packages\/process is missing from apps\/docs\/\.storybook\/preview\.css/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("PLANT 2: the REAL repo tree passes (no false positive -- specifically no failure for tokens)", () => {
  const { status, output } = run(REPO_ROOT);
  assert.equal(status, 0, output);
  assert.doesNotMatch(output, /packages\/tokens/);
});

test("PLANT 3: a .ts-only package with no class strings, absent from the list -> PASSES", () => {
  const root = plant((write) => {
    write("packages/ui/package.json", `{ "name": "@elabs-ai/components-ui" }`);
    write("packages/ui/src/widget.tsx", TSX_WITH_CLASSES);
    write("packages/cli/package.json", `{ "name": "@elabs-ai/components-cli" }`);
    write("packages/cli/src/index.ts", `export const scaffold = () => "no jsx here";\n`);
    write(
      "apps/docs/.storybook/preview.css",
      '@source "../../../packages/ui/src/**/*.{ts,tsx}";\n',
    );
  });
  try {
    const { status, output } = run(root);
    assert.equal(status, 0, output);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("PLANT 4: an @source pattern at the WRONG relative depth -> FAILS (resolve, don't string-match)", () => {
  const root = plant((write) => {
    write("packages/process/package.json", `{ "name": "@elabs-ai/components-process" }`);
    write("packages/process/src/widget.tsx", TSX_WITH_CLASSES);
    // One "../" short of the real depth from apps/docs/.storybook -- looks
    // like coverage as a string, resolves to a directory that does not exist.
    write(
      "apps/docs/.storybook/preview.css",
      '@source "../../packages/process/src/**/*.{ts,tsx}";\n',
    );
  });
  try {
    const { status, output } = run(root);
    assert.equal(status, 1);
    assert.match(output, /packages\/process is missing from apps\/docs\/\.storybook\/preview\.css/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("PLANT 5: fixtures/consumer-smoke's dist-shaped @source list is honoured, not just apps/*", () => {
  const root = plant((write) => {
    write("packages/process/package.json", `{ "name": "@elabs-ai/components-process" }`);
    write("packages/process/src/widget.tsx", TSX_WITH_CLASSES);
    write(
      "fixtures/consumer-smoke/src/index.css",
      '@source "../node_modules/@elabs-ai/components-process/dist";\n',
    );
  });
  try {
    const { status, output } = run(root);
    assert.equal(status, 0, output);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("main(): exit code mirrors the CLI (in-process, for coverage of the --root arg parsing)", () => {
  const root = plant((write) => {
    write(
      "apps/docs/.storybook/preview.css",
      '@source "../../../packages/ui/src/**/*.{ts,tsx}";\n',
    );
  });
  try {
    assert.equal(main(["node", GATE, "--root", root]), 0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// ── 3. discovery sanity on the real tree ─────────────────────────────────────

test("tailwindSourceCssFiles(): finds exactly the two known @source-bearing files", () => {
  const files = tailwindSourceCssFiles(REPO_ROOT).map((f) => path.relative(REPO_ROOT, f));
  assert.deepEqual(
    files.sort(),
    [
      path.join("apps", "docs", ".storybook", "preview.css"),
      path.join("fixtures", "consumer-smoke", "src", "index.css"),
    ].sort(),
  );
});

test("tailwindScopedPackages(): includes process, excludes tokens/cli/eslint-config/typescript-config", () => {
  const names = tailwindScopedPackages(REPO_ROOT).map((p) => p.name);
  assert.ok(names.includes("process"));
  assert.ok(names.includes("ui"));
  for (const excluded of ["tokens", "cli", "eslint-config", "typescript-config"]) {
    assert.ok(!names.includes(excluded), `expected ${excluded} to be excluded, got: ${names}`);
  }
});

// ── 4. the gate is WIRED (a script nobody runs never fires) ─────────────────

test("package.json declares both the gate and its self-test", () => {
  const { scripts } = JSON.parse(readFileSync(path.join(REPO_ROOT, "package.json"), "utf8"));
  assert.equal(scripts["tailwind-sources:check"], "node scripts/check-tailwind-sources.mjs");
  assert.equal(
    scripts["tailwind-sources:check:test"],
    "node --test scripts/check-tailwind-sources.test.mjs",
  );
});

test("gates.yml runs the gate in the BLOCKING job, and its self-test too", () => {
  const yml = readFileSync(path.join(REPO_ROOT, ".github/workflows/gates.yml"), "utf8");
  const secondJob = /^ {2}storybook:$/m.exec(yml);
  assert.ok(secondJob, "expected gates.yml to still declare the second, non-blocking job");
  const blocking = yml.slice(0, secondJob.index);
  assert.ok(
    blocking.includes("pnpm tailwind-sources:check\n"),
    "gates.yml's blocking job must run `pnpm tailwind-sources:check`",
  );
  assert.ok(blocking.includes("pnpm tailwind-sources:check:test"));
});

test("AGENTS.md's command contract names the gate (docs:check cross-checks this against ci.yml)", () => {
  const md = readFileSync(path.join(REPO_ROOT, "AGENTS.md"), "utf8");
  assert.ok(
    md.includes("pnpm tailwind-sources:check"),
    'AGENTS.md\'s "Validate before you finish" contract must name the gate',
  );
  assert.ok(md.includes("pnpm tailwind-sources:check:test"));
});

// ── 5. end-to-end: the CLI (not just the pure function) passes on the real repo ──

test("the REAL repo currently passes tailwind-sources:check (CLI run)", () => {
  assert.doesNotThrow(() => {
    execFileSync(process.execPath, ["scripts/check-tailwind-sources.mjs"], {
      cwd: REPO_ROOT,
      stdio: "pipe",
    });
  });
});
