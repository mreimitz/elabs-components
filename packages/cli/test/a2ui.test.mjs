/**
 * `brand-ui a2ui` (D2) — the agent-facing verbs over the generated core bundle:
 * catalog (all / one type), schema, validate (exit codes), example (validates).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const BIN = fileURLToPath(new URL("../bin/brand-ui.mjs", import.meta.url));
const run = (args, cwd = process.cwd()) =>
  spawnSync(process.execPath, [BIN, ...args], { cwd, encoding: "utf8" });

test("a2ui catalog: every type, then one type in full; --json is structured", () => {
  const all = run(["a2ui", "catalog"]);
  assert.equal(all.status, 0, all.stderr);
  assert.match(all.stdout, /A2UI catalog v1 — \d+ types/);
  assert.match(all.stdout, /Stack\s+builtin\s+children\s+align, direction, gap, justify, wrap/);
  assert.match(
    all.stdout,
    /AutoChart\s+charts\s+on\.datapointClick, on\.selectionIntent\s+height, loading, plotHeight, spec/,
  );
  const one = run(["a2ui", "catalog", "MetricCard"]);
  assert.equal(one.status, 0);
  assert.match(one.stdout, /label: node/);
  assert.match(one.stdout, /valueFormat\?: "number" \| "compact" \| "currency" \| "percent"/);
  const json = JSON.parse(run(["a2ui", "catalog", "Button", "--json"]).stdout);
  assert.equal(json.type, "Button");
  assert.deepEqual(json.events, { click: "onClick" });
  const unknown = run(["a2ui", "catalog", "Nope"]);
  assert.equal(unknown.status, 1);
  assert.match(unknown.stderr, /unknown type "Nope"/);
});

test("a2ui: AutoChart's Responsive plotHeight, choropleth prose, and a deprecated name that warns without failing (RM-197)", () => {
  const auto = JSON.parse(run(["a2ui", "catalog", "AutoChart", "--json"]).stdout);
  assert.equal(auto.props.height.deprecated, true);
  assert.match(auto.props.height.description, /plotHeight/);
  assert.ok(
    Array.isArray(auto.props.plotHeight.anyOf),
    "plotHeight carries a real anyOf, not `any`",
  );
  assert.match(auto.props.spec.description, /\bchoropleth\b/);

  const dir = mkdtempSync(join(tmpdir(), "brand-ui-a2ui-rm197-"));
  try {
    const surface = (props) =>
      JSON.stringify({ a2ui: "1", root: { type: "AutoChart", props: { spec: {}, ...props } } });

    // Both Responsive forms accepted, a malformed one rejected.
    writeFileSync(join(dir, "px.json"), surface({ plotHeight: 320 }));
    assert.equal(run(["a2ui", "validate", "px.json"], dir).status, 0);
    writeFileSync(join(dir, "aspect.json"), surface({ plotHeight: { aspect: 2 } }));
    assert.equal(run(["a2ui", "validate", "aspect.json"], dir).status, 0);
    writeFileSync(join(dir, "tiers.json"), surface({ plotHeight: { base: 320, narrow: 240 } }));
    assert.equal(run(["a2ui", "validate", "tiers.json"], dir).status, 0);
    writeFileSync(join(dir, "bad.json"), surface({ plotHeight: "tall" }));
    const bad = run(["a2ui", "validate", "bad.json", "--json"], dir);
    assert.equal(bad.status, 1);
    assert.deepEqual(
      JSON.parse(bad.stdout).errors.map((e) => e.code),
      ["invalid-value"],
    );

    // The deprecated `height` name still validates — a warning, never in `errors` (ADR 0042 §8).
    writeFileSync(join(dir, "deprecated.json"), surface({ height: 300 }));
    const dep = run(["a2ui", "validate", "deprecated.json", "--json"], dir);
    assert.equal(dep.status, 0, dep.stderr);
    const parsed = JSON.parse(dep.stdout);
    assert.equal(parsed.ok, true);
    assert.deepEqual(parsed.errors, []);
    assert.deepEqual(
      parsed.warnings.map((e) => e.code),
      ["deprecated-prop"],
    );
    const depText = run(["a2ui", "validate", "deprecated.json"], dir);
    assert.match(depText.stdout, /deprecated\.json: valid A2UI surface v1\n1 warning:/);
    assert.match(depText.stdout, /root\.props\.height\s+deprecated-prop/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a2ui example validates; a bad surface exits 1 with path/code/message lines", () => {
  const dir = mkdtempSync(join(tmpdir(), "brand-ui-a2ui-"));
  try {
    const example = run(["a2ui", "example"]);
    assert.equal(example.status, 0);
    writeFileSync(join(dir, "ok.json"), example.stdout);
    const ok = run(["a2ui", "validate", "ok.json"], dir);
    assert.equal(ok.status, 0, ok.stderr);
    assert.match(ok.stdout, /ok\.json: valid A2UI surface v1/);
    writeFileSync(
      join(dir, "bad.json"),
      JSON.stringify({
        a2ui: "1",
        root: {
          type: "Stack",
          children: [{ type: "Sparkle" }, { type: "Badge", props: { variant: "loud" } }],
        },
      }),
    );
    const bad = run(["a2ui", "validate", "bad.json", "--json"], dir);
    assert.equal(bad.status, 1);
    const parsed = JSON.parse(bad.stdout);
    assert.equal(parsed.ok, false);
    assert.deepEqual(
      parsed.errors.map((e) => e.code),
      ["unknown-type", "invalid-value"],
    );
    const text = run(["a2ui", "validate", "bad.json"], dir);
    assert.match(text.stdout, /root\.children\[0\]\.type\s+unknown-type/);
    const missing = run(["a2ui", "validate"], dir);
    assert.equal(missing.status, 1);
    assert.match(missing.stderr, /validate needs a <file>/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a2ui schema is draft 2020-12 with one $def per catalog type; search finds the verbs", () => {
  const schema = JSON.parse(run(["a2ui", "schema"]).stdout);
  assert.equal(schema.$schema, "https://json-schema.org/draft/2020-12/schema");
  assert.ok(schema.$defs.Button && schema.$defs.Stack && schema.$defs.action);
  const search = run(["search", "a2ui"]);
  assert.equal(search.status, 0);
  assert.match(search.stdout, /a2ui catalog/);
});
