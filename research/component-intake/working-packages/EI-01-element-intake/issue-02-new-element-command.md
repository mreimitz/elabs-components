---
TYPE: issue
TITLE: "[dx] /new-element — the one front door: idea → classify → confirm → hand off to the right builder"
LABELS: type:feature, severity:P1, area:governance, area:ai, needs-triage
WP: EI-01
---

## Summary

Add `.claude/commands/new-element.md` — the single command you call with a rough idea. It captures the
idea, invokes the `element-classifier` agent (issue-01), presents the recommended route, asks you to
confirm, then **hands off** to the matching existing builder. This is the "one function to call when I
have an idea for a new element."

## Source

[`../../README.md`](../../README.md). User ask (2026-06-06): "one function to call … help me decide what
it will become."

## Severity & impact

**P1.** It's the entry point that makes "what should this be?" a one-call, scan-grounded decision and
prevents mis-filed artifacts at intake.

## Proposed solution

`.claude/commands/new-element.md`:

- **Frontmatter:** `description: "Decide what a new library element should become, then route to the
right builder"`; `argument-hint: "<one-line idea>"`; `allowed-tools` includes the classifier agent +
  the builder commands it routes to + Read/Grep/Glob/Bash(pnpm:_) + `mcp**storybook**_`.
- **Step 1 — Capture the idea.** Take `$ARGUMENTS` as the one-line idea. Ask **only** the 1–2 clarifiers
  that change the route — primarily **"will many apps share this, or is it app-specific?"** (resolves the
  ownership axis: package vs registry) and, if unclear, "is it interactive UI, a value/token, an icon, or
  reusable logic?". Don't ask anything inferable from the repo.
- **Step 2 — Classify.** Invoke **`element-classifier`** with the idea + answers. It returns the findings
  table + the single recommended route + handoff notes (it does the whole-library scan).
- **Step 3 — Present + confirm.** Show the findings table and the recommendation, then use
  **`AskUserQuestion`** to confirm the route — the options ARE the routing-table outcomes (reuse /
  extend / package-component / registry-block / template / token / icon / hook / playbook). The user can
  override the classifier.
- **Step 4 — Hand off** to the confirmed builder, passing the classifier's notes (target package/folder,
  reuse targets, children to compose):
  - package primitive / composition → **`/new-component <pkg> <Name> <purpose>`**
  - registry block / template → **`/new-registry-item <name> <type>`**
  - token → **`/new-theme`** + token-parity (WP-10 issue-05)
  - icon → the `@qlik-coe-emea/qlabs-components-icons` (brand) / Lucide (generic) flow (DP-01 issue-03 boundary)
  - hook / util → `/new-component`-style scaffold without story/registry
  - playbook → the WP-09 playbook flow
  - reuse → **stop**; print the import path. extend/merge/replace → `/new-component`'s extend/merge plan.
- **Step 5 — Note** the decision + route taken in the summary (so it's traceable).

The existing builders are unchanged; `/new-element` is the recommended front door, they remain callable
directly by experts.

## Affected files

- [ ] `.claude/commands/new-element.md` (new)
- [ ] (referenced) `element-classifier` agent (issue-01), `.claude/rules/element-intake.md` (issue-03),
      `/new-component`, `/new-registry-item`, `/new-theme`

## Acceptance criteria

- [ ] `/new-element "<idea>"` runs classify → present → `AskUserQuestion` confirm → hand off, end to end.
- [ ] Each routing-table outcome reaches the correct builder (or stops with an import for reuse), with
      the classifier's handoff notes passed along.
- [ ] It asks at most the 1–2 route-changing clarifiers; never re-asks what the scan can answer.
- [ ] Calling a builder directly (e.g. `/new-component`) still works unchanged.

## Test to add

A walkthrough check per outcome (reuse / extend / package-component / block / template / token) confirming
the correct hand-off. (Process/command issue — validated by invocation.)

## Risks / ripple effects

- Keep it **lean** — the heavy scan lives in the agent; the command orchestrates. Don't duplicate the
  decision tree here (reference `element-intake.md`, issue-03).
- Don't make the front door mandatory in a way that blocks experts — `/new-component` etc. stay direct.

## References

- [`../../README.md`](../../README.md); `issue-01-element-classifier-agent.md`,
  `issue-03-decision-rule-and-routing.md`; `.claude/commands/new-component.md`, `new-registry-item.md`,
  `new-theme.md`; `AskUserQuestion`.
