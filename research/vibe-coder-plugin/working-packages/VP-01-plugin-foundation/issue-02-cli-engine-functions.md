---
TYPE: issue
TITLE: "[plugin] Add CLI engine functions: scaffold / scan / map / codemod (skeletons)"
LABELS: type:tech-debt, severity:P1, area:ai, needs-triage
WP: VP-01
---

## Summary

Stand up the deterministic backend the two flows call, so they're repeatable code paths — not
hand-wavy LLM steps. Add `brand-ui scaffold`, `scan`, `map`, `codemod` to `@qlik-coe-emea/qlabs-components-cli` (skeletons +
contracts here; full behavior in VP-02/03), alongside the existing `info/search/docs/audit/manifest`
and the WP-03 `context`.

## Source

[`../../04-skills-functions-architecture.md`](../../04-skills-functions-architecture.md) (functions
table); `docs/CONCEPT-ai-skills.md` (thin-skill + deterministic-backend pattern).

## Severity & impact

**P1.** These functions are what make scaffolding/migration reliable and reviewable. Defining their
contracts early lets VP-02/VP-03 build against stable interfaces.

## Current state & why the gap exists

`@qlik-coe-emea/qlabs-components-cli` has `info/search/docs/audit/manifest`; the experience functions don't exist yet.

## Proposed solution

Define + skeleton each (reuse the manifest + context + playbooks + templates):

- `brand-ui scaffold <spec.json>` → emit a best-practice app (template + playbooks + theme + shell +
  gates + context). (Full impl: VP-02.)
- `brand-ui scan [path]` → read-only repo profile JSON (framework, UI lib, styling, component
  inventory + usage freq). (Full impl: VP-03.)
- `brand-ui map <scan.json>` → mapping of existing components → brand-ui via the manifest, with the
  direct/props/compose/gap/drop classification. (Full impl: VP-03.)
- `brand-ui codemod <map.json>` → generate/dry-run/apply AST codemods (jscodeshift/ast-grep).
  (Full impl: VP-03.)

Keep each with `--json` output (agent-consumable) and deterministic behavior; no paid deps.

## Affected files

- [ ] `packages/cli/bin/brand-ui.mjs` + `lib/*` (new subcommands + contracts)
- [ ] `packages/cli/package.json` (codemod deps — jscodeshift/ast-grep, OSS only)
- [ ] CLI tests for the contracts/skeletons

## Acceptance criteria

- [ ] `scaffold`/`scan`/`map`/`codemod` exist with documented input/output contracts and `--json`.
- [ ] Skeletons run without error; no paid deps; reuse the manifest/context engine.
- [ ] **needs-run:** confirm the existing CLI still passes after the additions.

## Test to add

Contract tests asserting each command's `--json` shape (even on a skeleton/fixture).

## Risks / ripple effects

- Don't over-build here — these are contracts + skeletons; behavior lands in VP-02/03. Pick OSS codemod
  tooling (jscodeshift/ast-grep) to respect the no-paid-deps rule.

## References

- `../../04-skills-functions-architecture.md`; `../../03-brownfield-migration-flow.md`; WP-03 (manifest/context).
