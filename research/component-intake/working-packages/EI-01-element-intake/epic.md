---
TYPE: epic (tracking issue)
TITLE: "[dx] EI-01 — Element intake: one /new-element front door + element-classifier agent + decision rule"
LABELS: type:feature, severity:P1, area:governance, area:ai, area:registry, needs-triage
---

## Summary

Add a single entry point you call with a rough idea — **`/new-element`** — that **classifies what the
idea should become** and **routes** to the right builder, backed by a read-only **`element-classifier`**
agent that scans the whole library first. Closes the gap that `/new-component` only triages _overlap_
(reuse/extend/merge/replace) and silently assumes a package component, with no routing to
`/new-registry-item` (block/template), `/new-theme` (token), the icon flow, or playbooks. Design +
decision model: [`../../README.md`](../../README.md).

**Scope:** the `/new-element` command (front door), the `element-classifier` agent (scan + classify,
read-only), and `.claude/rules/element-intake.md` (the canonical decision tree) — plus wiring
`/new-component` and the maintainer skills to route through the door.

**Out of scope:** changing the builders themselves (`/new-component`, `/new-registry-item`, `/new-theme`
keep doing the building); the DTCG/token work (WP-04); the plugin's own UX (it _reuses_ this classifier).

## Why P1

It's the front door for every future addition to the library — it makes "what should this be?" a
one-call, scan-grounded decision instead of tribal knowledge, and it stops mis-filed artifacts (a block
scaffolded as a package component, a token built as a component) at intake. High leverage, low blast
radius (additive; the existing builders are unchanged).

## Decisions taken (see README for the full model)

1. **One front door, existing builders behind it** — `/new-element` routes to `/new-component` /
   `/new-registry-item` / `/new-theme` / icon / hook / playbook; experts can still call those directly.
2. **A dedicated read-only classifier agent** — the exhaustive scan lives in `element-classifier` (not
   inline), so it's reusable (the plugin calls it too) and keeps the front door lean. Finders report,
   builders fix.
3. **Two-axis decision model** — overlap (reuse/extend/merge/replace) × kind (primitive vs composition;
   package vs registry; component vs block vs template vs token/icon/hook/playbook), with **ownership
   (stable-shared vs prototype-tweak)** as the deciding axis per `registry.md`.

## Child issues

- **issue-01-element-classifier-agent** — the read-only `element-classifier` (library-cartographer) agent:
  scans every package barrel + `brand-ui.manifest.json` + `llms.txt` + registry + live stories, returns
  the structured classification (the two axes + placement + recommended route + findings table). `model:
opus`; escalates to `design-system-architect` for new-package/subpath calls. _(P1)_
- **issue-02-new-element-command** — the `/new-element` front-door command: interview → invoke the
  classifier → present + `AskUserQuestion` confirm → hand off to the matching builder with the
  classifier's notes. _(P1)_
- **issue-03-decision-rule-and-routing** — author `.claude/rules/element-intake.md` (the canonical
  decision tree, one source for command + agent + skills), and wire it in: a `/new-component` "Step 0"
  pointer to the door, and routing notes in `brand-ui-component` / `brand-ui-registry`. _(P1)_

## Definition of done

- `/new-element "<idea>"` returns a single recommended route + a findings table, after a real
  whole-library scan; on confirm it hands off to the correct builder (or stops with an import for reuse).
- The classifier never builds; it cites where each match lives (package/registry) and why the idea is/
  isn't a component, a block, a token, etc.
- The decision tree exists once (`element-intake.md`) and the command, the agent, and the skills all
  reference it (no divergent copies — WP-12 consistency).
- `/new-component`, `/new-registry-item`, `/new-theme` still work standalone; `/new-component` points to
  the door as the recommended entry.

## Dependencies

Builds on `.claude/commands/new-component.md` + `new-registry-item.md` + `new-theme.md`, the
`brand-ui-component`/`brand-ui-registry` skills, `.claude/rules/registry.md` + `conceptual-framing.md`,
and the agent set. Consumes the **agent-docs ground truth** (enterprise-gap **doc 11** — manifest +
`llms.txt`); pairs with **WP-10** (born-compliant scaffolding + gates), **WP-12** (one decisions source),
**WP-13** (dedupe/merge outcomes). Reused by the **vibe-coder-plugin** (same classifier for end-users).

> **See also — composition patterns** ([adoption record](../../../enterprise-gap/13-composition-patterns-adoption.md)): the `/new-element`/`/new-component` flow applies the **composition patterns** (compound + lifted state).
