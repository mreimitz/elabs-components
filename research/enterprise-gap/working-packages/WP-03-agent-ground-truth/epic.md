---
TYPE: epic (tracking issue)
TITLE: "[ai] WP-03 — Agent ground-truth: enriched manifest, context generator, MCP, index"
LABELS: type:tech-debt, severity:P1, area:ai, area:docs, needs-triage
---

## Summary

brand-ui is already ahead of most public libraries on agent-tooling, so this package **deepens** the
existing layer rather than rebuilding it. Four verified gaps: (1) `brand-ui.manifest.json` is an
_index_ (`{name, kind, module}`) — it carries no resolved prop tables, no descriptions/defaults, no
**relationships/anti-patterns**; `brand-ui docs` regex-extracts the raw `Props` interface on demand
but never expands `cva` variants. (2) The only live ground-truth MCP is the **Storybook addon-mcp,
which exists only while the dev server runs** and is React-only. (3) There's no static, browsable
component index for humans/agents skimming the repo, and no per-component a11y/token notes surfaced.
(4) There's **no context generator** — nothing emits the manifest's ground truth into the files agents
already read (`CLAUDE.md` / `AGENTS.md` / `.cursor/rules`), so a fresh session with the dev server down
has no always-present ground truth (gap E7, the AgnosticUI `ag context` idea). This makes the agent
layer best-in-class.

## Why this matters

The research (doc 02) is blunt: the highest-leverage, most-distinctive agent metadata is the stuff
**types can't encode** — relationships ("can't sit next to X"), state→token mapping, and
**anti-patterns** ("two primary buttons", "destructive without confirm"). Types say what's _possible_;
anti-patterns say what's _wrong_. brand-ui has the manifest plumbing already; enriching it is high
payoff for moderate effort.

## Child issues

- **issue-01-enrich-manifest** — generate resolved prop tables (react-docgen-typescript), expand
  `cva` variant values, include descriptions/defaults; make `brand-ui docs` print them. _(P1)_
- **issue-02-component-meta-antipatterns** — add a per-component `*.meta.json` (or manifest `meta`)
  carrying purpose, relationships, state→token mapping, and anti-patterns; surface in `docs`/skill.
  _(P1)_
- **issue-04-context-generator** — a `brand-ui context` command (AgnosticUI `ag context`-style) that
  generates the manifest's ground truth into the files agents already read (`CLAUDE.md` / `AGENTS.md` /
  `.cursor/rules`) as a portable, MCP-free, version-controlled context file. **Do this before the
  MCP** — it's the cheaper, more portable first step for E3/E7. _(P1)_
- **issue-03-persistent-mcp-and-index** — stand up the roadmap's persistent `brand-ui` MCP server
  over the CLI engine, and generate a static browsable component index with a11y/token notes. _(P1,
  after issue-04.)_

## Definition of done

- `brand-ui docs <Component>` returns resolved props (incl. expanded variants), defaults,
  descriptions, **and** relationships/anti-patterns.
- `brand-ui context` emits a committed context file into the agent-read locations; it is **generated +
  stale-gated** (via WP-10), never hand-edited.
- An always-on `brand-ui` MCP (not dev-server-bound) exposes search/docs/tokens/audit.
- A generated, committed component index page exists (humans + agents), with per-component a11y/token
  notes.
- **Enforcement (DoD rule):** the manifest, context file, and index are regenerated automatically and
  a CI stale-check fails on drift (machinery built in WP-10) — none of this is a manual step.
- Closes **E1, E3, E7, D1, D2**; lays groundwork for **E5** (llms.txt) and feeds **WP-09** (playbooks).

## Dependencies

Depends on **WP-01** (CI to keep the generated manifest/index/context fresh) and pairs with **WP-10**
(which builds the auto-regenerate + stale-gate machinery these artifacts rely on). Independent of
WP-04; can run in parallel. **Blocks WP-09** (playbooks compose from the enriched manifest + context
surface).
