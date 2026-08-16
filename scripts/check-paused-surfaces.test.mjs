/**
 * check-paused-surfaces.test.mjs — self-test for the paused-surfaces gate.
 *
 * The gate exists so a paused surface cannot creep back into the build. A gate
 * that silently stops firing is worse than none, so this plants each real
 * failure shape in a throwaway copy of the repo layout and asserts refusal —
 * and, just as importantly, asserts the shapes it must NOT flag (design-rationale
 * comments, an inert `[data-theme]` CSS selector, the un-pause recipe comment),
 * because a gate that flags everything gets routed around within a day.
 *
 * Each case copies the gate + its reader into a temp tree, writes the minimum
 * files those two read, and runs the gate with the temp tree as its repo root.
 */
import { deepStrictEqual, match, ok, strictEqual } from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { after, describe, it } from "node:test";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = dirname(HERE);
const GATE = join(HERE, "check-paused-surfaces.mjs");
const READER = join(HERE, "lib", "paused-surfaces.mjs");

const temps = [];
after(() => {
  for (const t of temps) rmSync(t, { recursive: true, force: true });
});

/** Minimal, VALID fixture tree: one paused theme + one paused package. */
function makeTree(overrides = {}) {
  const root = mkdtempSync(join(tmpdir(), "paused-gate-"));
  temps.push(root);

  const write = (rel, body) => {
    const full = join(root, rel);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, body, "utf8");
  };

  // The gate + its reader, at the same relative paths they live at in the repo.
  mkdirSync(join(root, "scripts", "lib"), { recursive: true });
  cpSync(GATE, join(root, "scripts", "check-paused-surfaces.mjs"));
  cpSync(READER, join(root, "scripts", "lib", "paused-surfaces.mjs"));

  write(
    "packages/tokens/src/theme-types.ts",
    overrides.themeTypes ??
      [
        'export const THEMES = ["light", "dark"] as const;',
        'export const PAUSED_THEMES = ["blueprint"] as const;',
        "export const THEME_META = {",
        '  "light": { value: "light" },',
        '  "dark": { value: "dark" },',
        "  // blueprint is PAUSED — restore this entry to un-pause.",
        "};",
      ].join("\n"),
  );

  write(
    "packages/tokens/src/themes.css",
    overrides.themesCss ?? '[data-theme="light"] {\n}\n[data-theme="blueprint"] {\n}\n',
  );

  write(
    "packages/blueprint/package.json",
    JSON.stringify(
      overrides.pausedPkg ?? {
        name: "@elabs/components-blueprint",
        private: true,
        version: "2.1.1",
      },
      null,
      2,
    ),
  );
  write("packages/blueprint/src/index.ts", 'export const GRID = "blueprint";\n');

  write(
    "apps/docs/package.json",
    JSON.stringify(overrides.docsPkg ?? { name: "docs", dependencies: {} }, null, 2),
  );
  write(
    "apps/docs/.storybook/main.ts",
    overrides.storybookMain ??
      'export default { stories: ["../../../packages/*/src/**/*.stories.@(ts|tsx)"], paused: "blueprint excluded below" };\n',
  );

  write("package.json", JSON.stringify({ name: "root" }, null, 2));

  for (const [rel, body] of Object.entries(overrides.extraFiles ?? {})) write(rel, body);

  return root;
}

function run(root) {
  const r = spawnSync(process.execPath, [join(root, "scripts", "check-paused-surfaces.mjs")], {
    encoding: "utf8",
  });
  return { code: r.status, out: `${r.stdout}${r.stderr}` };
}

describe("paused-surfaces gate", () => {
  it("passes on a correctly paused tree", () => {
    const { code, out } = run(makeTree());
    strictEqual(code, 0, out);
    match(out, /✔ paused-surfaces gate/);
  });

  it("A — fails when a paused theme is ALSO in the active THEMES", () => {
    const { code, out } = run(
      makeTree({
        themeTypes: [
          'export const THEMES = ["light", "dark", "blueprint"] as const;',
          'export const PAUSED_THEMES = ["blueprint"] as const;',
          "export const THEME_META = {\n};",
        ].join("\n"),
      }),
    );
    strictEqual(code, 1, out);
    match(out, /BOTH THEMES and PAUSED_THEMES/);
  });

  it("A — fails when THEME_META still has a real entry for the paused theme", () => {
    const { code, out } = run(
      makeTree({
        themeTypes: [
          'export const THEMES = ["light", "dark"] as const;',
          'export const PAUSED_THEMES = ["blueprint"] as const;',
          "export const THEME_META = {",
          '  blueprint: { value: "blueprint", label: "Blueprint" },',
          "};",
        ].join("\n"),
      }),
    );
    strictEqual(code, 1, out);
    match(out, /THEME_META still has an entry/);
  });

  it("B — fails when the paused theme's CSS block was DELETED (pause is not delete)", () => {
    const { code, out } = run(makeTree({ themesCss: '[data-theme="light"] {\n}\n' }));
    strictEqual(code, 1, out);
    match(out, /pause is not delete/);
  });

  it("C — fails on a story that renders the paused theme", () => {
    const { code, out } = run(
      makeTree({
        extraFiles: {
          "packages/ui/src/thing.stories.tsx":
            'export const Blue = { render: () => <div data-theme="blueprint" /> };\n',
        },
      }),
    );
    strictEqual(code, 1, out);
    match(out, /thing\.stories\.tsx/);
  });

  it("C — fails on a Storybook global / sweep instruction in a doc", () => {
    const { code, out } = run(
      makeTree({
        extraFiles: {
          "docs/HOWTO.md": "Sweep the story with `globals=theme:blueprint` before merging.\n",
        },
      }),
    );
    strictEqual(code, 1, out);
    match(out, /HOWTO\.md/);
  });

  it("C — fails on a stale 'three themes' count in a shipped doc", () => {
    const { code, out } = run(
      makeTree({ extraFiles: { "docs/HOWTO.md": "Verify across all three themes.\n" } }),
    );
    strictEqual(code, 1, out);
    match(out, /HOWTO\.md/);
  });

  it("C — does NOT flag a design-rationale comment (behaviour, not prose)", () => {
    const { code, out } = run(
      makeTree({
        extraFiles: {
          "packages/ui/src/card.tsx":
            "// Under blueprint the shadow is zeroed, so the border is the sole cue.\n" +
            "/* blueprint keeps this border — see ADR 0010. */\n" +
            "export const Card = () => null;\n",
        },
      }),
    );
    strictEqual(code, 0, out);
  });

  it("C — does NOT flag an inert [data-theme] selector in a component stylesheet", () => {
    const { code, out } = run(
      makeTree({
        extraFiles: {
          "packages/editor/src/calc.css": '[data-theme="blueprint"] .calc { color: white; }\n',
        },
      }),
    );
    strictEqual(code, 0, out);
  });

  it("C — DOES flag an @source/@import that pulls a paused package into a build", () => {
    const { code, out } = run(
      makeTree({
        extraFiles: {
          "fixtures/consumer-smoke/src/index.css":
            '@source "../node_modules/@elabs/components-blueprint/dist";\n',
        },
      }),
    );
    strictEqual(code, 1, out);
    match(out, /index\.css/);
  });

  it("D — fails when a paused package is not private", () => {
    const { code, out } = run(
      makeTree({
        pausedPkg: { name: "@elabs/components-blueprint", version: "2.1.1" },
      }),
    );
    strictEqual(code, 1, out);
    match(out, /must set "private": true/);
  });

  it("E — fails when a paused package still declares a build/test task", () => {
    const { code, out } = run(
      makeTree({
        pausedPkg: {
          name: "@elabs/components-blueprint",
          private: true,
          scripts: { build: "tsup", test: "vitest run" },
        },
      }),
    );
    strictEqual(code, 1, out);
    match(out, /still declares a "build" script/);
    match(out, /still declares a "test" script/);
  });

  it("F — fails when an app still depends on a paused package", () => {
    const { code, out } = run(
      makeTree({
        docsPkg: {
          name: "docs",
          dependencies: { "@elabs/components-blueprint": "workspace:*" },
        },
      }),
    );
    strictEqual(code, 1, out);
    match(out, /depends on the paused package/);
  });

  it("F — fails when the Storybook glob still sweeps a paused package's stories", () => {
    const { code, out } = run(
      makeTree({
        storybookMain:
          'export default { stories: ["../../../packages/*/src/**/*.stories.@(ts|tsx)"] };\n',
      }),
    );
    strictEqual(code, 1, out);
    match(out, /no exclusion for paused packages/);
  });

  it("--warn never exits non-zero but still prints", () => {
    const root = makeTree({ themesCss: "/* deleted */\n" });
    const r = spawnSync(
      process.execPath,
      [join(root, "scripts", "check-paused-surfaces.mjs"), "--warn"],
      { encoding: "utf8" },
    );
    strictEqual(r.status, 0);
    match(`${r.stdout}${r.stderr}`, /pause is not delete/);
  });

  it("is registered as a blocking gate in gates.yml and as a pnpm script", async () => {
    const { readFileSync } = await import("node:fs");
    const pkg = JSON.parse(readFileSync(join(REPO_ROOT, "package.json"), "utf8"));
    deepStrictEqual(
      [pkg.scripts["paused:check"], pkg.scripts["paused:check:test"]],
      [
        "node scripts/check-paused-surfaces.mjs",
        "node --test scripts/check-paused-surfaces.test.mjs",
      ],
    );
    const gates = readFileSync(join(REPO_ROOT, ".github", "workflows", "gates.yml"), "utf8");
    ok(gates.includes("pnpm paused:check"), "gates.yml must run pnpm paused:check");
    ok(gates.includes("pnpm paused:check:test"), "gates.yml must run the self-test");
  });

  it("reads the paused set from theme-types.ts, not a hard-coded literal", () => {
    // Rename the paused theme in the fixture: the gate must follow it there,
    // which is only possible if it parses PAUSED_THEMES rather than matching
    // the string "blueprint".
    const { code, out } = run(
      makeTree({
        themeTypes: [
          'export const THEMES = ["light"] as const;',
          'export const PAUSED_THEMES = ["cyanotype"] as const;',
          "export const THEME_META = {\n};",
        ].join("\n"),
        themesCss: '[data-theme="light"] {\n}\n',
      }),
    );
    strictEqual(code, 1, out);
    match(out, /cyanotype/);
  });
});
