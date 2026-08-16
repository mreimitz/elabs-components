---
TYPE: epic (tracking issue)
TITLE: "[governance] WP-10 — Self-maintaining repo: enforcement over reminders"
LABELS: type:tech-debt, severity:P1, area:governance, area:test, area:ai, needs-triage
---

## Summary

The maintainer's explicit requirement: **never have to remind an agent to register a new component,
regenerate the manifest, or update an inventory file.** Today the repo leans the right way (six hooks,
a manifest generator, a `check-package-registered.sh` hook) but stops short of true self-maintenance —
the manifest isn't auto-regenerated or stale-gated, component registration is a manual multi-place
ritual (the quality-gates rule lists ~8 files to touch when adding a _package_), and inventory/derived
docs are hand-maintained. This package builds the shared machinery that makes "the correct behavior is
automatic; the wrong behavior fails loudly" true for the whole repo. _(Closes gaps G1, G2, G3.)_

## The operating principle this package institutionalizes

> A change isn't done when the code is written — it's done when its rule is wired into a **generator +
> a gate/hook/CI check + the skill system**. Every other working package's Definition of Done depends
> on the machinery built here. (doc 03 area G; doc 04 sequencing rule 3.)

Two layers, both needed:

- **Happy path** — the scaffolding skill/command (`/new-component`, `brand-ui-component`) _does_ the
  registration automatically, so the agent rarely has to think about it.
- **Backstop gate** — a hook/CI check that **fails loudly** if registration/manifest/inventory is
  missing or stale, regardless of how the change was made (human edit, different agent, hand-written
  file). The gate is what makes it reliable; the happy path is what makes it pleasant.

## Child issues

- **issue-01-manifest-autoregen-and-stale-gate** — regenerate `brand-ui.manifest.json` on commit + a
  CI step that fails on a stale manifest. _(P1 — G1)_
- **issue-02-component-registration-gate** — a hook/CI check: a new component `*.tsx` must have its
  barrel export + story + (where practical) test + manifest entry, with an actionable failure message;
  extend `check-package-registered.sh` from packages to components, and ensure the scaffolding
  skill/command writes all of it. _(P1 — G2)_
- **issue-03-generated-inventories** — generate the component index, the package tables in
  `CLAUDE.md`/`AGENTS.md`/`PROJECT.md`/`Introduction.mdx`, and (as they land) the context file /
  llms.txt / playbook index from the manifest, each with a CI stale-check. _(P1 — G3)_
- **issue-04-institutionalize-the-convention** — bake "enforcement over reminders" into the PR
  template, the quality-gates rule, and CONTRIBUTING so every future WP ships its own gate; **and wire
  the session cadence** — a Stop/SessionEnd nudge to run visual-review + the review agents on changed
  work after larger sessions, and `/session-retro` at completion. _(P2)_
- **issue-05-theme-token-parity-gate** — a gate that fails when any theme omits a token other themes
  define (+ new-token propagation via `/new-component`/`/new-theme` + a six-theme contrast re-audit), so
  new components/charts always have complete, legible theme support. _(P1 — answers the "themes update
  logic / completeness" ask; WP-04 makes it structural later.)_

## Definition of done

- The manifest is regenerated automatically and CI fails on a stale one (G1).
- Adding a component without its barrel/story/(test)/manifest entry **fails a gate** with a clear fix
  message; the scaffolding path produces all of it (G2).
- All "lists of components/packages/tokens/playbooks" are generated + stale-checked, not hand-written
  (G3).
- **Every theme defines every token** (parity gate, issue-05); new component/chart tokens propagate to
  all six themes by construction and pass the six-theme contrast audit.
- **Larger building sessions end with self-review** — visual-review + the review agents on changed work,
  and `/session-retro` at completion — wired as a Stop/SessionEnd nudge (issue-04), not left to memory.
- The PR template / quality-gates rule require each change to wire its own enforcement (issue-04).
- Closes **G1, G2, G3**; makes the DoD-enforcement rule real for WP-02…WP-09.

## Dependencies

Depends on **WP-01** (a CI to run the gates in). The manifest-stale and component-registration gates
(issue-01/02) can land in **NOW** right after WP-01 — they deliver the maintainer's core ask
immediately. The derived-file generation (issue-03) expands as **WP-03** (context file/index) and
**WP-09** (playbooks) produce artifacts to generate.

> **See also — interaction guidelines** ([adoption record](../../12-interaction-guidelines-adoption.md)): this WP absorbs the **anti-pattern ESLint gate** (`eslint-plugin-jsx-a11y` + custom: `transition: all`, `outline-none`, `<div onClick>`, img-without-dims, icon-button-without-aria-label, hardcoded date/number).
