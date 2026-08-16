#!/usr/bin/env node
/**
 * check-app-spec.mjs — app-spec contract gate (VP-02 #122).
 *
 * The `brand-ui-new-app` interview produces an `app-spec` (a fenced ```json block
 * inside `app-spec.md`) and `brand-ui scaffold` consumes it. If the spec doesn't
 * match the contract, the scaffold breaks or asks the user questions the interview
 * was supposed to answer. This gate makes the contract a checked artifact:
 *
 *   1. The shipped fixture (`skills/brand-ui-new-app/reference/app-spec.example.md`)
 *      validates against the schema — proof the documented schema + example agree.
 *   2. Any `app-spec.md` / `app-spec.json` passed as an argument validates too
 *      (so the scaffold flow can verify a generated spec before building).
 *
 * The reader + validator themselves live ONCE, in
 * `packages/cli/lib/app-spec.mjs`, and are imported here — the same "one source of
 * truth" wiring `check-anti-slop.mjs` uses for `packages/cli/lib/audit.mjs`. That
 * is what makes it impossible for this gate and `brand-ui scaffold` (#123, which
 * reads + validates the same block before emitting) to drift apart. They are
 * re-exported below so the self-test keeps importing them from the gate.
 *
 * The schema (`skills/brand-ui-new-app/reference/app-spec.schema.json`) mirrors the
 * input shape of `planScaffold` in @elabs/components-cli
 * (packages/cli/lib/engine.mjs). The validator is a small, dependency-free
 * JSON-Schema subset (type/required/enum/minLength/minItems/properties/items) —
 * no ajv, no paid deps.
 *
 * Run via `pnpm app-spec:check`; the self-test (`pnpm app-spec:check:test`) drives
 * the pure functions with in-memory fixtures so the gate can't silently rot.
 *
 * Flags: --warn  never exit non-zero (dev-hook mode); still prints findings.
 */
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import {
  SCHEMA_PATH,
  EXAMPLE_PATH,
  validate,
  validateSpec,
  extractSpec,
  specFromFile,
  loadSchema as loadSchemaFrom,
} from "../packages/cli/lib/app-spec.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = dirname(HERE); // scripts/ -> repo root

// Re-exported so the gate stays the import surface its self-test (and any other
// caller) already targets, while the implementation lives in one place.
export { SCHEMA_PATH, EXAMPLE_PATH, validate, validateSpec, extractSpec, specFromFile };

/** The shipped schema, defaulting to this repo's root. */
export function loadSchema(root = REPO_ROOT) {
  const schema = loadSchemaFrom(root);
  if (!schema) throw new Error(`app-spec schema not found at ${join(root, SCHEMA_PATH)}`);
  return schema;
}

// Only run the gate when executed directly (not when imported by the self-test).
const invokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (invokedDirectly) {
  const WARN = process.argv.includes("--warn");
  const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const targets = args.length ? args.map((a) => resolve(a)) : [join(REPO_ROOT, EXAMPLE_PATH)];
  const schema = loadSchema();
  const findings = [];
  for (const t of targets) {
    const rel = t.replace(REPO_ROOT + "/", "");
    const { data, error } = specFromFile(t);
    if (error) {
      findings.push(`${rel}: ${error}`);
      continue;
    }
    for (const e of validateSpec(data, schema)) findings.push(`${rel}: ${e}`);
  }
  if (findings.length) {
    console.error(`✖ app-spec contract (${findings.length} problem(s)):`);
    for (const f of findings) console.error("  - " + f);
    console.error(
      `\n  Fix: the app-spec's ${"```"}json block must satisfy ${SCHEMA_PATH}\n` +
        "  (archetype/theme/title required; archetype + theme are enums).",
    );
    if (!WARN) process.exit(1);
  } else {
    console.log(`✔ app-spec: ${targets.length} spec(s) valid against ${SCHEMA_PATH}.`);
  }
}
