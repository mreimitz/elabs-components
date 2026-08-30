/**
 * Self-test for the sanitizer-passthrough gate (#36).
 *
 * The failure this guards against is the gate silently stopping firing —
 * every other repo gate (typecheck/lint/test/build) was already green over
 * this exact hazard on `main`, so this file has to prove the NEW gate
 * actually catches the shape that slipped through.
 */
import { strict as assert } from "node:assert";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import {
  findTypePassthroughs,
  findUnstrippedSpreads,
  importsComponent,
  scanPackages,
  SAFE_RENDERERS,
} from "./check-sanitizer-passthrough.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");

test("importsComponent: recognises a named import, ignores an unrelated module", () => {
  assert.ok(
    importsComponent('import { Streamdown } from "streamdown";', "streamdown", "Streamdown"),
  );
  assert.ok(
    importsComponent(
      'import { Foo, Streamdown, Bar } from "streamdown";',
      "streamdown",
      "Streamdown",
    ),
  );
  assert.ok(
    !importsComponent('import { Streamdown } from "other-pkg";', "streamdown", "Streamdown"),
  );
  assert.ok(!importsComponent('import { Other } from "streamdown";', "streamdown", "Streamdown"));
});

test("findTypePassthroughs: a bare ComponentProps<typeof X> with no Omit<> is a raw passthrough", () => {
  const src = `
    export type BadProps = ComponentProps<typeof Streamdown> & { loading?: boolean };
  `;
  const problems = findTypePassthroughs(src, "Streamdown", ["rehypePlugins", "remarkPlugins"]);
  assert.equal(problems.length, 1);
  assert.equal(problems[0].kind, "raw-passthrough");
});

test("findTypePassthroughs: an Omit<> that forgets one dangerous prop still fails", () => {
  const src = `
    export interface BadProps extends Omit<ComponentProps<typeof Streamdown>, "components" | "rehypePlugins"> {}
  `;
  const problems = findTypePassthroughs(src, "Streamdown", ["rehypePlugins", "remarkPlugins"]);
  assert.equal(problems.length, 1);
  assert.equal(problems[0].kind, "incomplete-omit");
  assert.match(problems[0].detail, /remarkPlugins/);
});

test("findTypePassthroughs: a complete Omit<> excluding both dangerous props passes clean", () => {
  const src = `
    export interface GoodProps extends Omit<ComponentProps<typeof Streamdown>, "components" | "plugins" | "rehypePlugins" | "remarkPlugins"> {}
  `;
  assert.deepEqual(findTypePassthroughs(src, "Streamdown", ["rehypePlugins", "remarkPlugins"]), []);
});

test("findTypePassthroughs: a single-property indexed access is not a passthrough", () => {
  const src = `
    type C = NonNullable<ComponentProps<typeof Streamdown>["components"]>;
    type P = ComponentProps<typeof Streamdown>["plugins"];
  `;
  assert.deepEqual(findTypePassthroughs(src, "Streamdown", ["rehypePlugins", "remarkPlugins"]), []);
});

test("findUnstrippedSpreads: a {...props} spread onto the renderer with no strip call fails", () => {
  const src = `
    export const Bad = ({ ...props }) => <Streamdown data-slot="x" {...props} />;
  `;
  const problems = findUnstrippedSpreads(src, "Streamdown", ["rehypePlugins", "remarkPlugins"]);
  assert.equal(problems.length, 1);
  assert.equal(problems[0].kind, "unstripped-spread");
});

test("findUnstrippedSpreads: a preceding stripSanitizerOverrides(props) call clears it", () => {
  const src = `
    export const Good = ({ ...props }) => {
      stripSanitizerOverrides(props);
      return <Streamdown data-slot="x" {...props} />;
    };
  `;
  assert.deepEqual(
    findUnstrippedSpreads(src, "Streamdown", ["rehypePlugins", "remarkPlugins"]),
    [],
  );
});

test("findUnstrippedSpreads: inline deletes of every dangerous prop also clear it", () => {
  const src = `
    export const Good = ({ ...props }) => {
      delete props.rehypePlugins;
      delete props.remarkPlugins;
      return <Streamdown data-slot="x" {...props} />;
    };
  `;
  assert.deepEqual(
    findUnstrippedSpreads(src, "Streamdown", ["rehypePlugins", "remarkPlugins"]),
    [],
  );
});

test("findUnstrippedSpreads: a spread of something other than `props` is out of scope", () => {
  const src = `
    export const Fine = (rest) => <Streamdown data-slot="x" {...rest} />;
  `;
  assert.deepEqual(
    findUnstrippedSpreads(src, "Streamdown", ["rehypePlugins", "remarkPlugins"]),
    [],
  );
});

test("scanPackages: flags a planted fixture that re-exports the whole Streamdown surface", () => {
  const dir = mkdtempSync(join(tmpdir(), "sanitizer-passthrough-"));
  try {
    const pkgDir = join(dir, "packages", "fake-ai");
    mkdirSync(join(pkgDir, "src"), { recursive: true });
    writeFileSync(
      join(pkgDir, "package.json"),
      JSON.stringify({ name: "@elabs-ai/fake-ai", version: "0.0.0" }),
    );
    writeFileSync(
      join(pkgDir, "src", "bad-wrapper.tsx"),
      [
        'import type { ComponentProps } from "react";',
        'import { Streamdown } from "streamdown";',
        "",
        "export type BadProps = ComponentProps<typeof Streamdown> & { loading?: boolean };",
        "",
        "export const BadWrapper = ({ ...props }: BadProps) => <Streamdown {...props} />;",
        "",
      ].join("\n"),
    );

    const findings = scanPackages(dir);
    assert.ok(findings.length >= 2, "expected both a type-level and a runtime-level finding");
    assert.ok(findings.some((f) => f.kind === "raw-passthrough"));
    assert.ok(findings.some((f) => f.kind === "unstripped-spread"));
    assert.ok(findings.every((f) => f.file.endsWith("bad-wrapper.tsx")));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("scanPackages: a clean fixture (Omit<> + strip call) reports nothing", () => {
  const dir = mkdtempSync(join(tmpdir(), "sanitizer-passthrough-clean-"));
  try {
    const pkgDir = join(dir, "packages", "fake-ai");
    mkdirSync(join(pkgDir, "src"), { recursive: true });
    writeFileSync(
      join(pkgDir, "package.json"),
      JSON.stringify({ name: "@elabs-ai/fake-ai", version: "0.0.0" }),
    );
    writeFileSync(
      join(pkgDir, "src", "good-wrapper.tsx"),
      [
        'import type { ComponentProps } from "react";',
        'import { Streamdown } from "streamdown";',
        'import { stripSanitizerOverrides } from "./_streamdown-safety";',
        "",
        "export type GoodProps = Omit<",
        "  ComponentProps<typeof Streamdown>,",
        '  "rehypePlugins" | "remarkPlugins"',
        "> & { loading?: boolean };",
        "",
        "export const GoodWrapper = ({ ...props }: GoodProps) => {",
        "  stripSanitizerOverrides(props);",
        "  return <Streamdown {...props} />;",
        "};",
        "",
      ].join("\n"),
    );

    assert.deepEqual(scanPackages(dir), []);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("scanPackages: a module that never imports the renderer is skipped entirely", () => {
  const dir = mkdtempSync(join(tmpdir(), "sanitizer-passthrough-unrelated-"));
  try {
    const pkgDir = join(dir, "packages", "fake-other");
    mkdirSync(join(pkgDir, "src"), { recursive: true });
    writeFileSync(
      join(pkgDir, "package.json"),
      JSON.stringify({ name: "@elabs-ai/fake-other", version: "0.0.0" }),
    );
    writeFileSync(
      join(pkgDir, "src", "unrelated.tsx"),
      "export const Unrelated = ({ ...props }: { children?: unknown }) => <div {...props} />;\n",
    );
    assert.deepEqual(scanPackages(dir), []);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("SAFE_RENDERERS names streamdown with both dangerous props (so the table can't silently shrink)", () => {
  const streamdown = SAFE_RENDERERS.find((r) => r.module === "streamdown");
  assert.ok(streamdown);
  assert.deepEqual(new Set(streamdown.dangerousProps), new Set(["rehypePlugins", "remarkPlugins"]));
});

test("gate: passes on the committed tree (packages/ai's two Streamdown wrappers close both halves)", () => {
  const out = execFileSync("node", [join(here, "check-sanitizer-passthrough.mjs")], {
    cwd: root,
    encoding: "utf8",
  });
  assert.match(out, /closes both halves/);
});
