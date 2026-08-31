/**
 * Self-test for the sanitizer-passthrough gate (#36, hardened by #75).
 *
 * The failure this guards against is the gate silently stopping firing — every
 * other repo gate (typecheck/lint/test/build) was already green over the #36
 * hazard on `main`, so this file has to prove the gate actually catches the
 * shapes that slipped through.
 *
 * #75's contribution: the ORIGINAL gate passed this file while five distinct
 * evasions reproduced live against it, because every test drove the exported
 * helpers with the one shape the helpers happened to recognise, and NOTHING
 * drove `main()` down its failure path — `process.exit(1)` was unreachable from
 * any test, so deleting it was invisible here. Every fixture below is therefore
 * either a shape that produced ZERO findings before #75, or an assertion about
 * the CLI's exit status. Per `.claude/rules/quality-gates.md` § "Self-tested
 * gates": plant a bad fixture, assert the gate FAILS.
 */
import { strict as assert } from "node:assert";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import {
  findExplicitDangerousProps,
  findKeyListParityProblems,
  findPropsAliasDrift,
  findTypePassthroughs,
  findUnstrippedSpreads,
  importsComponent,
  readSanitizerOverrideKeys,
  resolveRendererBindings,
  resolveRendererTypes,
  scanPackages,
  spreadSearchWindowStart,
  SAFE_RENDERERS,
  UNRESOLVED_BASELINE,
} from "./check-sanitizer-passthrough.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const gate = join(here, "check-sanitizer-passthrough.mjs");
const streamdown = SAFE_RENDERERS.find((r) => r.module === "streamdown");
const DANGEROUS = streamdown.dangerousProps;

/**
 * Build a fixture repo root. Every fixture MUST carry a runtime-guard stub,
 * because channel 4 fails closed on a missing `_streamdown-safety.ts` — the
 * gate refuses to assume parity it cannot read.
 */
function fixtureRoot(prefix, files, { guardKeys = DANGEROUS } = {}) {
  const dir = mkdtempSync(join(tmpdir(), `${prefix}-`));
  if (guardKeys !== null) {
    const aiSrc = join(dir, "packages", "ai", "src");
    mkdirSync(aiSrc, { recursive: true });
    writeFileSync(
      join(dir, "packages", "ai", "package.json"),
      JSON.stringify({ name: "@elabs-ai/components-ai", version: "0.0.0" }),
    );
    writeFileSync(
      join(aiSrc, "_streamdown-safety.ts"),
      `const SANITIZER_OVERRIDE_KEYS = [${guardKeys.map((k) => `"${k}"`).join(", ")}] as const;\n` +
        "export { SANITIZER_OVERRIDE_KEYS };\n",
    );
  }
  for (const [rel, body] of Object.entries(files)) {
    const abs = join(dir, rel);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, body);
  }
  // Any package dir we plant needs a package.json to be seen as distributable.
  for (const rel of Object.keys(files)) {
    const m = /^packages\/([^/]+)\//.exec(rel);
    if (!m) continue;
    const pj = join(dir, "packages", m[1], "package.json");
    try {
      readFileSync(pj);
    } catch {
      writeFileSync(pj, JSON.stringify({ name: `@elabs-ai/${m[1]}`, version: "0.0.0" }));
    }
  }
  return dir;
}

const withFixture = (dir, fn) => {
  try {
    return fn();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};

// ─────────────────── channel 0: binding resolution ───────────────────

test("resolveRendererBindings: named, aliased, default, namespace, dynamic and member forms", () => {
  const r = (text) => resolveRendererBindings(text, streamdown);

  assert.deepEqual(r('import { Streamdown } from "streamdown";').bindings, ["Streamdown"]);
  assert.deepEqual(r('import { Streamdown as SD } from "streamdown";').bindings, ["SD"]);
  assert.deepEqual(r('import Streamdown from "streamdown";').bindings, ["Streamdown"]);
  assert.deepEqual(r('import { Other } from "streamdown";').bindings, []);
  assert.deepEqual(r('import { Streamdown } from "other-pkg";').bindings, []);

  // Evasion C, the one a real shipped file uses: a TYPE namespace import plus a
  // dynamic import, with the component pulled off the module object later.
  const adapterShape = [
    'import type * as StreamdownExports from "streamdown";',
    "type StreamdownModule = typeof StreamdownExports;",
    "let streamdown: StreamdownModule | undefined;",
    'async function load() { streamdown ??= await import("streamdown"); }',
    "const Streamdown = streamdown?.Streamdown;",
  ].join("\n");
  const adapter = r(adapterShape);
  assert.ok(adapter.referenced);
  assert.ok(adapter.bindings.includes("Streamdown"), "member binding off the namespace resolves");
  assert.ok(adapter.typeNamespaces.includes("StreamdownModule"));

  // Destructured off a namespace, and off the dynamic import directly.
  assert.ok(
    r('import * as NS from "streamdown";\nconst { Streamdown: SD } = NS;').bindings.includes("SD"),
  );
  assert.ok(
    r('const { Streamdown } = await import("streamdown");').bindings.includes("Streamdown"),
  );

  // The props alias is resolved as a separate channel-1 input.
  assert.deepEqual(
    r('import { Streamdown, type StreamdownProps } from "streamdown";').propsAliases,
    ["StreamdownProps"],
  );
});

test("importsComponent stays true to its old contract for the plain named form", () => {
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

test("scanPackages FAILS CLOSED on a module it references but cannot bind (#75 item 1)", () => {
  // A shape deliberately outside the resolver's contract: the component arrives
  // through a re-export indirection the text scan cannot follow. Before #75 this
  // module was SKIPPED and the gate reported clean.
  const dir = fixtureRoot("sanitizer-unresolved", {
    "packages/fake-ai/src/exotic.tsx": [
      'import * as NS from "streamdown";',
      "const Renderer = pickRenderer(NS);",
      "export const Bad = ({ ...rest }) => <Renderer {...rest} />;",
      "",
    ].join("\n"),
  });
  withFixture(dir, () => {
    const findings = scanPackages(dir);
    assert.ok(
      findings.some((f) => f.kind === "unresolved-renderer-binding"),
      `expected a fail-closed finding, got ${JSON.stringify(findings)}`,
    );
  });
});

test("a .ts module with no JSX is NOT a fail-closed finding (type-only i18n seam)", () => {
  // `packages/ai/src/_streamdown-i18n.ts` imports StreamdownTranslations as a
  // type and renders nothing; `Partial<StreamdownTranslations>` must not be read
  // as an element. A `.ts` file cannot contain JSX at all.
  const dir = fixtureRoot("sanitizer-typeonly", {
    "packages/fake-ai/src/i18n.ts": [
      'import type { StreamdownTranslations } from "streamdown";',
      "export type Partials = Partial<StreamdownTranslations>;",
      "",
    ].join("\n"),
  });
  withFixture(dir, () => assert.deepEqual(scanPackages(dir), []));
});

test("UNRESOLVED_BASELINE is empty — every in-tree renderer resolves (it may only shrink)", () => {
  assert.deepEqual(
    UNRESOLVED_BASELINE,
    {},
    "adding a grandfathered module means the gate can no longer prove that module safe; " +
      "it needs a written reason in the constant and a deliberate change here",
  );
});

// ─────────────────── channel 1: type level ───────────────────

test("findTypePassthroughs: a bare ComponentProps<typeof X> with no Omit<> is a raw passthrough", () => {
  const src = "export type BadProps = ComponentProps<typeof Streamdown> & { loading?: boolean };";
  const problems = findTypePassthroughs(src, "Streamdown", DANGEROUS);
  assert.equal(problems.length, 1);
  assert.equal(problems[0].kind, "raw-passthrough");
});

test("findTypePassthroughs: an Omit<> that forgets a dangerous prop still fails", () => {
  const src =
    'export interface BadProps extends Omit<ComponentProps<typeof Streamdown>, "components"> {}';
  const problems = findTypePassthroughs(src, "Streamdown", DANGEROUS);
  assert.equal(problems.length, 1);
  assert.equal(problems[0].kind, "incomplete-omit");
  assert.match(problems[0].detail, /rehypePlugins/);
});

test("findTypePassthroughs: a complete Omit<> passes, and an indexed access is exempt", () => {
  assert.deepEqual(
    findTypePassthroughs(
      'export interface GoodProps extends Omit<ComponentProps<typeof Streamdown>, "components" | "rehypePlugins"> {}',
      "Streamdown",
      DANGEROUS,
    ),
    [],
  );
  assert.deepEqual(
    findTypePassthroughs(
      [
        'type C = NonNullable<ComponentProps<typeof Streamdown>["components"]>;',
        'type P = ComponentProps<typeof Streamdown>["plugins"];',
      ].join("\n"),
      "Streamdown",
      DANGEROUS,
    ),
    [],
  );
});

test("EVASION A: the package's own StreamdownProps alias is a passthrough (was 0 findings)", () => {
  // `findTypePassthroughs("export type Bad = StreamdownProps & { x?: 1 };", …)`
  // returned [] before #75 — the match was a literal string search for
  // `ComponentProps<typeof Streamdown>`.
  const src = "export type Bad = StreamdownProps & { x?: 1 };";
  assert.deepEqual(findTypePassthroughs(src, "Streamdown", DANGEROUS), [], "old arm still silent");
  const problems = findTypePassthroughs(src, "Streamdown", DANGEROUS, ["StreamdownProps"]);
  assert.equal(problems.length, 1);
  assert.equal(problems[0].kind, "raw-passthrough");
  // …and an Omit<> around the alias clears it, so the arm is a check, not a ban.
  assert.deepEqual(
    findTypePassthroughs(
      'export type Ok = Omit<StreamdownProps, "rehypePlugins">;',
      "Streamdown",
      DANGEROUS,
      ["StreamdownProps"],
    ),
    [],
  );
});

test("findTypePassthroughs: a namespace-indexed props expression is covered too", () => {
  const src = 'export type Bad = ComponentProps<NS["Streamdown"]>;';
  const problems = findTypePassthroughs(src, [], DANGEROUS, [], ["NS"], "Streamdown");
  assert.equal(problems.length, 1);
  assert.equal(problems[0].kind, "raw-passthrough");
});

test("findTypePassthroughs: a props alias named only inside a comment is not a passthrough", () => {
  const src = "/** Accepts StreamdownProps minus the sanitiser prop. */\nexport type Ok = {};";
  assert.deepEqual(findTypePassthroughs(src, "Streamdown", DANGEROUS, ["StreamdownProps"]), []);
});

// ─────────────────── channel 2: runtime level ───────────────────

test("findUnstrippedSpreads: an unstripped {...props} fails; a strip call or inline deletes clear it", () => {
  assert.equal(
    findUnstrippedSpreads(
      'export const Bad = ({ ...props }) => <Streamdown data-slot="x" {...props} />;',
      "Streamdown",
      DANGEROUS,
    ).length,
    1,
  );
  assert.deepEqual(
    findUnstrippedSpreads(
      [
        "export const Good = ({ ...props }) => {",
        "  stripSanitizerOverrides(props);",
        '  return <Streamdown data-slot="x" {...props} />;',
        "};",
      ].join("\n"),
      "Streamdown",
      DANGEROUS,
    ),
    [],
  );
  assert.deepEqual(
    findUnstrippedSpreads(
      [
        "export const Good = ({ ...props }) => {",
        "  delete props.rehypePlugins;",
        '  return <Streamdown data-slot="x" {...props} />;',
        "};",
      ].join("\n"),
      "Streamdown",
      DANGEROUS,
    ),
    [],
  );
});

test("EVASION B: a spread named anything but `props` is now in scope (was 0 findings)", () => {
  // The pre-#75 arm searched for the literal `{...props}`, so renaming the rest
  // element to `rest` walked straight past it.
  const problems = findUnstrippedSpreads(
    'export const Fine = ({ ...rest }) => <Streamdown data-slot="x" {...rest} />;',
    "Streamdown",
    DANGEROUS,
  );
  assert.equal(problems.length, 1);
  assert.equal(problems[0].kind, "unstripped-spread");
  assert.match(problems[0].detail, /\{\.\.\.rest\}/);
});

test("EVASION D: an aliased import tag is spread-checked under its local name", () => {
  const text = [
    'import { Streamdown as SD } from "streamdown";',
    "export type P = ComponentProps<typeof SD>;",
    "export const Bad = ({ ...props }: P) => <SD {...props} />;",
  ].join("\n");
  const resolved = resolveRendererBindings(text, streamdown);
  assert.deepEqual(resolved.bindings, ["SD"]);
  assert.equal(findUnstrippedSpreads(text, resolved.bindings, DANGEROUS).length, 1);
  assert.equal(findTypePassthroughs(text, resolved.bindings, DANGEROUS).length, 1);
});

test("CHANNEL G: a compliant wrapper cannot vouch for a later non-compliant sibling", () => {
  const text = [
    "export const Good = ({ ...props }) => {",
    "  stripSanitizerOverrides(props);",
    "  return <Streamdown {...props} />;",
    "};",
    "",
    "export const Bad = ({ ...props }) => <Streamdown {...props} />;",
  ].join("\n");
  const problems = findUnstrippedSpreads(text, "Streamdown", DANGEROUS);
  assert.equal(problems.length, 1, "exactly the second wrapper");
  assert.ok(
    problems[0].line > 4,
    `finding should point at the second wrapper, got ${problems[0].line}`,
  );
});

test("spreadSearchWindowStart: a CALL passing the identifier is not a binding site", () => {
  // The regression this pins: `\(\s*props\s*[,)]` also matched
  // `stripSanitizerOverrides(props)`, moving the window start PAST the very
  // strip call it exists to find — which reported both compliant wrappers in
  // `packages/ai` as violations.
  const text = [
    "const Wrapper = ({ ...props }) => {",
    "  stripSanitizerOverrides(props);",
    "  return <Streamdown {...props} />;",
    "};",
  ].join("\n");
  const tagIndex = text.indexOf("<Streamdown");
  const start = spreadSearchWindowStart(text, "props", tagIndex);
  assert.ok(
    text.slice(start, tagIndex).includes("stripSanitizerOverrides(props)"),
    "the window must still contain the strip call",
  );
});

// ─────────────────── channel 3: explicit prop ───────────────────

test("findExplicitDangerousProps: a literal rehypePlugins={…} attribute is a finding", () => {
  const problems = findExplicitDangerousProps(
    "export const Bad = () => <Streamdown rehypePlugins={mine}>{md}</Streamdown>;",
    "Streamdown",
    DANGEROUS,
  );
  assert.equal(problems.length, 1);
  assert.equal(problems[0].kind, "explicit-dangerous-prop");
  assert.equal(problems[0].prop, "rehypePlugins");
  assert.deepEqual(
    findExplicitDangerousProps(
      "export const Ok = () => <Streamdown components={c}>{md}</Streamdown>;",
      "Streamdown",
      DANGEROUS,
    ),
    [],
  );
});

test("the markdown-preview allowlist is scoped, reasoned, and ratchets on site count", () => {
  const entry = streamdown.explicitPropAllowlist.find(
    (a) => a.file === "packages/editor/src/markdown-preview/markdown-preview.tsx",
  );
  assert.ok(entry, "the two reviewed call sites must stay named, not blanket-exempt");
  assert.equal(entry.prop, "rehypePlugins");
  assert.equal(entry.sites, 2);
  assert.match(entry.reason, /defaultRehypePlugins/);

  // The allowance is file-scoped: the same shape elsewhere is still a finding.
  const dir = fixtureRoot("sanitizer-explicit", {
    "packages/fake-ai/src/elsewhere.tsx": [
      'import { Streamdown } from "streamdown";',
      "export const Bad = () => <Streamdown rehypePlugins={[]}>{md}</Streamdown>;",
      "",
    ].join("\n"),
  });
  withFixture(dir, () => {
    const findings = scanPackages(dir);
    assert.ok(findings.some((f) => f.kind === "explicit-dangerous-prop"));
  });
});

// ─────────────────── channel 4: key-list parity ───────────────────

test("SAFE_RENDERERS pins streamdown's dangerous-prop set exactly (neither shrink nor re-widen)", () => {
  // Exactly `rehypePlugins`. `remarkPlugins` is NOT here by decision (PR #74
  // review, round 1): it runs upstream of the rehype chain and cannot bypass the
  // sanitiser, so gating it would gate a capability rather than a hazard. The
  // security property is locked in `packages/ai/src/{markdown-view,message}.test.tsx`
  // ("SUPPORTS a caller-supplied remarkPlugins array, and still sanitises what it
  // injects"), which fail if the remark stage ever stops being sanitised.
  assert.deepEqual(new Set(streamdown.dangerousProps), new Set(["rehypePlugins"]));
});

test("readSanitizerOverrideKeys: parses the real helper, and returns null when it cannot", () => {
  const real = readFileSync(join(root, streamdown.runtimeGuard.file), "utf8");
  assert.deepEqual(readSanitizerOverrideKeys(real), ["rehypePlugins"]);
  assert.equal(readSanitizerOverrideKeys("export const SOMETHING_ELSE = [];"), null);
});

test("parity fails in BOTH directions, and REFUSES when the array literal is unreadable", () => {
  // Runtime helper drops the key → the strip no longer covers what the gate declares.
  const dropped = findKeyListParityProblems(
    "const SANITIZER_OVERRIDE_KEYS = [] as const;",
    streamdown,
  );
  assert.equal(dropped.length, 1);
  assert.equal(dropped[0].kind, "key-list-parity");
  assert.match(dropped[0].detail, /NOT in SANITIZER_OVERRIDE_KEYS/);

  // Table drops the key → the gate stops checking what the runtime still strips.
  const widened = findKeyListParityProblems(
    'const SANITIZER_OVERRIDE_KEYS = ["rehypePlugins"] as const;',
    { ...streamdown, dangerousProps: [] },
  );
  assert.equal(widened.length, 1);
  assert.match(widened[0].detail, /NOT in SAFE_RENDERERS\.dangerousProps/);

  // Unreadable is a finding, not an assumption of parity.
  const unreadable = findKeyListParityProblems("export const NOTHING = 1;", streamdown);
  assert.equal(unreadable.length, 1);
  assert.equal(unreadable[0].kind, "unreadable-runtime-guard");
});

test("scanPackages fails when the runtime guard has lost the key, or is missing entirely", () => {
  const stripped = fixtureRoot("sanitizer-guard-empty", {}, { guardKeys: [] });
  withFixture(stripped, () => {
    const findings = scanPackages(stripped);
    assert.ok(findings.some((f) => f.kind === "key-list-parity"));
  });

  const absent = fixtureRoot("sanitizer-guard-absent", {}, { guardKeys: null });
  withFixture(absent, () => {
    const findings = scanPackages(absent);
    assert.ok(findings.some((f) => f.kind === "missing-runtime-guard"));
  });
});

// ─────────────────── channel 5: alias reality ───────────────────

test("every propsTypeAliases entry is really exported by the installed streamdown .d.ts", () => {
  const dts = resolveRendererTypes(root, "streamdown");
  assert.ok(dts, "streamdown's type declarations must be resolvable (run `pnpm install`)");
  assert.deepEqual(findPropsAliasDrift(readFileSync(dts, "utf8"), streamdown), []);
});

test("a renamed/removed props alias upstream is a finding, not a widened blind spot", () => {
  const doctored = "type StreamdownConfig = {};\nexport { type StreamdownConfig };\n";
  const problems = findPropsAliasDrift(doctored, streamdown);
  assert.equal(problems.length, 1);
  assert.equal(problems[0].kind, "props-alias-drift");
  assert.match(problems[0].detail, /StreamdownProps/);
});

// ─────────────────── whole-tree fixtures (A–E) ───────────────────

test("REPRODUCTION E: the literal #36 vulnerability, reopened, is caught end to end", () => {
  // Verbatim from #75's own repro.
  const dir = fixtureRoot("sanitizer-repro-e", {
    "packages/fake-ai/src/reopened.tsx": [
      'import { Streamdown, type StreamdownProps } from "streamdown";',
      "export const Reopened = ({ ...rest }: StreamdownProps) => <Streamdown {...rest} />;",
      "",
    ].join("\n"),
  });
  withFixture(dir, () => {
    const findings = scanPackages(dir);
    assert.ok(findings.length >= 1, "the composed bypass must not be silent");
    assert.ok(
      findings.some((f) => f.kind === "raw-passthrough"),
      "type half",
    );
    assert.ok(
      findings.some((f) => f.kind === "unstripped-spread"),
      "runtime half",
    );
    assert.ok(findings.every((f) => f.rel.endsWith("reopened.tsx")));
  });
});

test("scanPackages: shapes A–D each produce at least one finding", () => {
  const dir = fixtureRoot("sanitizer-shapes", {
    // A — the package's own props alias, no Omit<>.
    "packages/fake-a/src/a.tsx": [
      'import { Streamdown, type StreamdownProps } from "streamdown";',
      "export type BadA = StreamdownProps & { loading?: boolean };",
      "export const A = (p: BadA) => <Streamdown>{p.children}</Streamdown>;",
      "",
    ].join("\n"),
    // B — a rest spread under a name other than `props`.
    "packages/fake-b/src/b.tsx": [
      'import { Streamdown } from "streamdown";',
      "export const B = ({ ...rest }) => <Streamdown {...rest} />;",
      "",
    ].join("\n"),
    // C — namespace + dynamic import, rendering through the module object.
    "packages/fake-c/src/c.tsx": [
      'import * as NS from "streamdown";',
      "export const C = ({ ...rest }) => <NS.Streamdown {...rest} />;",
      "",
    ].join("\n"),
    // D — aliased named import driving both channels.
    "packages/fake-d/src/d.tsx": [
      'import { Streamdown as SD } from "streamdown";',
      "export type BadD = ComponentProps<typeof SD>;",
      "export const D = ({ ...props }: BadD) => <SD {...props} />;",
      "",
    ].join("\n"),
  });
  withFixture(dir, () => {
    const findings = scanPackages(dir);
    for (const shape of ["a.tsx", "b.tsx", "c.tsx", "d.tsx"]) {
      assert.ok(
        findings.some((f) => f.rel.endsWith(shape)),
        `shape ${shape} produced no finding: ${JSON.stringify(findings, null, 2)}`,
      );
    }
  });
});

test("scanPackages: a clean fixture (Omit<> + strip call) reports nothing", () => {
  const dir = fixtureRoot("sanitizer-clean", {
    "packages/fake-ai/src/good-wrapper.tsx": [
      'import type { ComponentProps } from "react";',
      'import { Streamdown } from "streamdown";',
      'import { stripSanitizerOverrides } from "./_streamdown-safety";',
      "",
      'export type GoodProps = Omit<ComponentProps<typeof Streamdown>, "rehypePlugins">;',
      "",
      "export const GoodWrapper = ({ ...props }: GoodProps) => {",
      "  stripSanitizerOverrides(props);",
      "  return <Streamdown {...props} />;",
      "};",
      "",
    ].join("\n"),
  });
  withFixture(dir, () => assert.deepEqual(scanPackages(dir), []));
});

test("scanPackages: a module that never references the renderer is skipped entirely", () => {
  const dir = fixtureRoot("sanitizer-unrelated", {
    "packages/fake-other/src/unrelated.tsx":
      "export const Unrelated = ({ ...props }: { children?: unknown }) => <div {...props} />;\n",
  });
  withFixture(dir, () => assert.deepEqual(scanPackages(dir), []));
});

// ─────────────────── the CLI, both branches ───────────────────

test("CLI: exits NON-ZERO on a planted violation and names the file and the finding kind", () => {
  // The #75 hole this closes: `main()` hardcoded `scanPackages(REPO_ROOT)`, so
  // `process.exit(1)` was unreachable from any test — deleting it was silent.
  const dir = fixtureRoot("sanitizer-cli-fail", {
    "packages/fake-ai/src/bad-wrapper.tsx": [
      'import type { ComponentProps } from "react";',
      'import { Streamdown } from "streamdown";',
      "export type BadProps = ComponentProps<typeof Streamdown>;",
      "export const BadWrapper = ({ ...props }: BadProps) => <Streamdown {...props} />;",
      "",
    ].join("\n"),
  });
  withFixture(dir, () => {
    const res = spawnSync("node", [gate, dir], { encoding: "utf8" });
    assert.notEqual(res.status, 0, "a planted violation must fail the CLI, not just the helpers");
    assert.match(res.stderr, /bad-wrapper\.tsx/);
    assert.match(res.stderr, /raw-passthrough/);
    assert.match(res.stderr, /unstripped-spread/);
  });
});

test("CLI: exits ZERO and passes on the committed tree", () => {
  const out = execFileSync("node", [gate], { cwd: root, encoding: "utf8" });
  assert.match(out, /every safe-renderer binding resolved/);
});
