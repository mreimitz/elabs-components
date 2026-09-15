#!/usr/bin/env node
/**
 * check-registry-resolve.mjs — thin entrypoint kept for `.githooks/pre-commit`.
 *
 * The detection lives in the check runner rule `scripts/check/rules/registry-resolve.mjs`
 * (every relative import in a registry item resolves at its repo `path` AND its install
 * `target`). This file only runs that one rule, so the hook and `pnpm check` share one
 * implementation. Equivalent: `node scripts/check/run.mjs --rule registry-resolve`.
 */
import { main } from "./check/run.mjs";

process.exitCode = await main(["--rule", "registry-resolve"]);
