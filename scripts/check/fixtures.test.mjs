// fixtures.test.mjs — rule shapes, baseline.json hygiene and every rule's pass/fail fixtures.
// Run: node --test scripts/check/fixtures.test.mjs (also part of `pnpm check:test`).
import { BASELINE_PATH, readBaseline } from "./baseline.mjs";
import { RULES_DIR, loadRules } from "./registry.mjs";
import { registerTests } from "./run.mjs";

await registerTests(await loadRules(RULES_DIR), readBaseline(BASELINE_PATH));
