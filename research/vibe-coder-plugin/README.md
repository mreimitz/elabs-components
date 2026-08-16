# vibe-coder-plugin · a guided plugin experience for internal vibe coders

A research + design pack for turning **brand-ui** from "a component library with some AI skills" into a
**guided plugin product** that optimizes the development experience for internal vibe coders. Two
flagship experiences:

1. **Greenfield — "build me an app."** Claude (in Cowork) guides the user from a vague idea to a
   concrete spec (high-level → detail), with **visual feedback loops** at each step, then scaffolds a
   repo that already applies brand-ui best practices (tokens, app shell, templates, playbooks, gates).
2. **Brownfield — "improve my existing app."** A full **repo scan + deep analysis** of an existing
   codebase, producing a concrete **migration/enhancement plan** to convert it onto brand-ui — executed
   with **generated codemods** and incremental, review-gated rollout.

This pack is a **sibling stream** to [`../enterprise-gap/`](../enterprise-gap/): that stream hardens
the _library + tooling foundation_; this stream builds the _end-user experience_ on top of it.

Compiled 2026-06-06.

> **Handing this to an agent to build later?** Give it **[`00-HANDOVER.md`](./00-HANDOVER.md)** — a
> 3-phase build runbook: (1) create the issue/PR concept, (2) push it all to GitHub, (3) then implement
> each issue in dependency order as a PR that `Closes #N`.

## The headline recommendation

- **Build ONE plugin, ship to both surfaces.** A Cowork plugin and a Claude Code plugin are the **same
  on-disk artifact** (`.claude-plugin/plugin.json` + `skills/` + `commands/` + `agents/` + `hooks/` +
  `.mcp.json`, distributed via a git-hosted marketplace). brand-ui **already ships this plugin**
  (`.claude-plugin/`, name `brand-ui`, v0.1.0). You extend it — you don't start over.
- **Cowork is the home of the guided experience; Code is the home of in-repo execution.** Skills + MCP
  run everywhere (including plain chat); **hooks + subagents run only in Cowork/Code**. So the
  staged-interview + visual-feedback flow is a **Cowork-first** feature, while scaffolding/codemods run
  great in either.
- **The two flows are skills, backed by the same engine.** A `new-app` (greenfield) skill and a
  `migrate` (brownfield) skill, both driven by the existing `@qlik-coe-emea/qlabs-components-cli` + manifest + (planned) context
  generator — reusing the substrate the enterprise-gap stream is already building.
- **brand-ui has a unique visual-feedback advantage:** its **Storybook MCP can render _real_
  components in all six themes** — so "preview your options" shows actual brand-ui UI, not mock images.

## Read in this order

1. **[`01-plugin-landscape.md`](./01-plugin-landscape.md)** — Claude Code plugin vs Cowork plugin
   (they're the same artifact), the trade-offs, what brand-ui already has, and the recommendation.
2. **[`02-greenfield-guided-flow.md`](./02-greenfield-guided-flow.md)** — the "describe → spec →
   scaffold" experience: the staged interview, the visual feedback loops, and the best-practice
   scaffold output.
3. **[`03-brownfield-migration-flow.md`](./03-brownfield-migration-flow.md)** — the "scan → analyze →
   migrate" experience: repo scan, mapping analysis, codemod-driven incremental migration.
4. **[`04-skills-functions-architecture.md`](./04-skills-functions-architecture.md)** — the end-user
   skills/commands/agents/CLI functions/MCP inventory (new + reuse), and the plugin architecture,
   packaging, and distribution.
5. **[`working-packages/`](./working-packages/)** — the backlog (VP-01…VP-04) as issue/PR-shaped
   markdown, plus [`00-HANDOVER.md`](./00-HANDOVER.md).

Full sourced research: [`_research/plugin-and-dx-notes.md`](./_research/plugin-and-dx-notes.md).

## How this depends on the enterprise-gap stream

The plugin experience is only as good as the substrate it sits on. It **consumes** these
enterprise-gap working packages (don't rebuild them here):

| This stream needs…                                                       | Provided by (enterprise-gap)                             |
| ------------------------------------------------------------------------ | -------------------------------------------------------- |
| Real component ground truth (props, anti-patterns) the flows reason over | WP-03 (enriched manifest)                                |
| Composition recipes the greenfield flow assembles                        | WP-09 (playbooks)                                        |
| Whole-app starting points the scaffold drops in                          | WP-13 (registry templates) + WP-05 (real widgets/charts) |
| "How & when to use what" the flows apply                                 | WP-12 (guidance)                                         |
| Auto-registration/gates so generated code is born compliant              | WP-10 (enforcement)                                      |
| The agent ground-truth interface (context file / MCP)                    | WP-03 (context generator + MCP)                          |

So sequencing: the plugin's **foundation + greenfield flow** can start alongside enterprise-gap NEXT;
the **brownfield flow** benefits from the manifest/guidance being in place first.

## Scope & honesty note

This is **design + research**, not implementation — consistent with the enterprise-gap pack. The
backlog hands the build to a later agent. Two flagged uncertainties from the research: **Cowork plugin
distribution is a 2026 research preview** (local install; private/org marketplaces "coming"), and
**inline visual-widget rendering owned by a plugin is not a documented API** — the reliable visual
mechanisms today are `AskUserQuestion` (multiple-choice, previewable), the **Storybook-MCP real
renders**, and generated artifacts/files. Design accordingly; treat Cowork-specific visual APIs as a
moving target.
