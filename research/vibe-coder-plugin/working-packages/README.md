# Working packages — backlog for the vibe-coder-plugin stream

Turns the designs in [`../01`](../01-plugin-landscape.md)–[`../04`](../04-skills-functions-architecture.md)
into issue/PR-shaped markdown, organized by working package (**VP-**, to avoid colliding with the
enterprise-gap **WP-** numbers). Same conventions as the enterprise-gap backlog: one file → one GitHub
artifact; `epic.md` is the tracking issue; bodies follow the repo's agent-finding template; **finders
report, builders fix**.

> **Executing?** Follow [`../00-HANDOVER.md`](../00-HANDOVER.md).

## Working packages

| VP        | Title                                         | Phase                                | Builds                                                                                   | Files                |
| --------- | --------------------------------------------- | ------------------------------------ | ---------------------------------------------------------------------------------------- | -------------------- |
| **VP-01** | Plugin foundation (one plugin, both surfaces) | first                                | router skill `brand-ui-start`, plugin wiring (skills/agents/hooks/MCP), CLI engine stubs | epic + 2 issues      |
| **VP-02** | Greenfield `new-app` guided flow              | after VP-01                          | the staged interview + visual loop + `brand-ui scaffold` (born-compliant)                | epic + 2 issues      |
| **VP-03** | Brownfield `migrate` flow                     | after VP-01 (+ enterprise-gap WP-03) | `scan`/`map`/`codemod` + analysis/plan + phased execution                                | epic + 2 issues      |
| **VP-04** | Visual feedback-loop engine                   | with VP-02                           | the reusable propose→preview→pick→refine pattern (Storybook-MCP renders + artifacts)     | epic (issues inline) |

## Hard dependency on the enterprise-gap stream

These VPs **consume** enterprise-gap WPs — schedule accordingly (don't rebuild):

- **WP-03** (enriched manifest + context generator + MCP) — ground truth for both flows; the `migrate`
  mapping quality depends on it.
- **WP-09** (playbooks) + **WP-13** (templates) + **WP-05** (real widgets/charts) — what the greenfield
  scaffold assembles.
- **WP-12** (guidance) + **WP-10** (gates) — so generated/migrated code is born compliant.
- **WP-07** (Changesets) — plugin versioning.

Sensible order: enterprise-gap **NOW/NEXT** (esp. WP-03/09/10/13) in flight → **VP-01 + VP-02 + VP-04**
(greenfield) → **VP-03** (brownfield, once the manifest/guidance are solid).

## Note on scope & maturity

Design-stage proposals (no implementation here). Two flagged realities from the research: the new CLI
functions (`scaffold`/`scan`/`map`/`codemod`) **don't exist yet**, and **Cowork plugin distribution +
any Cowork-only visual API are a 2026 research preview** — rely on portable visual mechanisms
(`AskUserQuestion`, Storybook-MCP renders, artifacts). See
[`../_research/plugin-and-dx-notes.md`](../_research/plugin-and-dx-notes.md).
