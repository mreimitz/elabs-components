#!/usr/bin/env node
/**
 * check-templates-fresh.mjs — generated-template stale-gate (mirrors check-manifest).
 *
 * The full-screen templates under `docs/playbooks/templates/**` are GENERATED from
 * the Storybook stories (packages/<pkg>/src/templates-<name>.stories.tsx) by
 * `pnpm gen:templates`. This is the CI backstop that makes "change a story → must
 * regenerate" load-bearing rather than a reminder:
 *
 *   FRESHNESS — regenerating must produce no change vs the committed files;
 *               otherwise the templates are stale (someone changed a story without
 *               running `pnpm gen:templates`), or an orphaned generated file
 *               survives a deleted story.
 *
 * Run by `pnpm templates:check` and in CI. Exits non-zero with an actionable
 * message. The self-test (`pnpm templates:check:test`) plants a stale fixture and
 * asserts the gate fails, so the gate itself can't silently rot.
 *
 * Dependency-light (imports the generator; the generator pulls in Prettier, a
 * devDependency present in the monorepo where this runs). Locates the repo root
 * relative to this file, so it is cwd-independent.
 */
import { staleTemplates, REPO_ROOT } from "./gen-templates.mjs";

const stale = await staleTemplates(REPO_ROOT);
if (stale.length) {
  console.error(
    "✖ generated templates are STALE — they do not match the Storybook stories:\n" +
      stale.map((f) => "  - " + f).join("\n") +
      "\n  Run `pnpm gen:templates` and commit the result.\n" +
      "  (docs/playbooks/templates/** is generated from packages/*/src/templates-*.stories.tsx;\n" +
      "   never hand-edit it — edit the story.)",
  );
  process.exit(1);
}
console.log("✔ generated templates are fresh.");
