# 01 · Plugin landscape — Code plugin vs Cowork plugin, and what brand-ui needs

> Part of the **vibe-coder-plugin** pack. Answers the core question: _is this a Claude Code plugin, a
> Cowork plugin, or both — and what do we actually need to build?_ Full sourced notes:
> [`_research/plugin-and-dx-notes.md`](./_research/plugin-and-dx-notes.md).

## The short answer: one plugin, both surfaces

A **Cowork plugin and a Claude Code plugin are the same on-disk artifact.** Both are a directory with
`.claude-plugin/plugin.json` plus any of `skills/`, `commands/`, `agents/`, `hooks/`, and a bundled
`.mcp.json`, distributed through a **git-hosted marketplace** (`marketplace.json`). Anthropic's own
knowledge-work plugins are described as "built for Claude Cowork, also compatible with Claude Code."
So the decision isn't "Code _or_ Cowork" — it's **build one plugin and ship it to both**, with the
_guided experience_ designed for the Cowork surface and the _in-repo execution_ equally at home in
Code.

**brand-ui already ships this plugin** — `.claude-plugin/plugin.json` (name `brand-ui`, v0.1.0,
pointing at `./skills` + `./agents`) and a `marketplace.json`. This stream **extends** that plugin; it
does not start a new one.

## What runs where (the one trade-off that matters)

Not every plugin capability is available on every surface. This shapes the design:

| Capability                              | Plain chat (claude.ai) | **Cowork**     | **Claude Code** |
| --------------------------------------- | ---------------------- | -------------- | --------------- |
| **Skills** (SKILL.md)                   | ✅                     | ✅             | ✅              |
| **MCP servers** (bundled)               | ✅                     | ✅             | ✅              |
| **Slash commands**                      | ✅ (as skills)         | ✅             | ✅              |
| **Subagents**                           | ❌ (grayed out)        | ✅             | ✅              |
| **Hooks** (deterministic gates)         | ❌                     | ✅             | ✅              |
| **File/repo access + shell**            | limited                | ✅ (workspace) | ✅ (the repo)   |
| **Guided multi-step + visual feedback** | partial                | ✅ (best)      | ✅              |

Implication: **the guided greenfield/brownfield experiences depend on subagents + hooks + file access,
so they are Cowork/Code features, not plain-chat features.** Skills + MCP are the portable core that
works everywhere; everything richer layers on top in Cowork/Code.

## Distribution & maturity (a flagged moving target)

- **Claude Code:** mature. Install via the CLI / `/plugin marketplace add <repo>` then `/plugin`;
  marketplaces are git repos. brand-ui's marketplace is already wired.
- **Cowork:** newer — plugins shipped as a **2026 research preview**; install is UI-based
  (Customize → Plugins), currently **local**, with **private/org marketplaces "coming."** Treat Cowork
  distribution + any Cowork-specific UI APIs as **moving targets**; don't hard-depend on unreleased
  org-management features.

## Surface roles for brand-ui

| Surface         | Primary role in this product                                                                                                                           | Why                                                                                                                 |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| **Cowork**      | The **guided experience** — staged interview, visual feedback, planning, scaffolding into the workspace, and the brownfield scan/analysis conversation | It has files + shell + subagents + hooks + a conversational/visual canvas, and targets the non-expert "vibe coder." |
| **Claude Code** | **In-repo execution** — scaffolding, codemods, audits, gate-enforced edits inside an existing project                                                  | Devs already live in the repo/terminal; same skills/CLI run here.                                                   |
| **Plain chat**  | **Lightweight Q&A** — "which brand-ui component for X", token lookups                                                                                  | Skills + MCP only; no guided flow.                                                                                  |

One plugin serves all three; the flows degrade gracefully (a chat user gets answers; a Cowork/Code
user gets the full guided build).

## What brand-ui already has vs. what this stream adds

**Already shipped** (the foundation — don't rebuild):

- The plugin + marketplace (`.claude-plugin/`).
- 5 skills: `brand-ui` (consumer), `brand-ui-component`, `brand-ui-audit`, `brand-ui-theme`,
  `brand-ui-registry`; 1 persona agent (`brand-ui-reviewer`).
- The `@qlik-coe-emea/qlabs-components-cli` engine (`info`/`search`/`docs`/`audit`/`manifest`) + the generated manifest.
- Multi-harness skill build (`scripts/build-skills.mjs`).

**This stream adds** (the experience layer):

1. A **greenfield guided-build skill** (`new-app`) — the staged interview → spec → scaffold flow (doc 02).
2. A **brownfield migrate skill** (`migrate`) — repo scan → analysis → codemod-driven migration (doc 03).
3. A **visual-feedback-loop pattern** shared by both (propose → preview → pick → refine), using
   `AskUserQuestion` + the **Storybook-MCP real-component renders** + artifacts (doc 02).
4. The **engine glue** to make those deterministic: scan/scaffold/codemod functions on `@qlik-coe-emea/qlabs-components-cli`,
   reusing the manifest + context + playbooks + templates (doc 04).

## Recommendation

1. **Extend the existing `brand-ui` plugin** into a "guided" plugin; keep it ONE artifact for both
   Cowork and Code. Don't fork a separate Cowork plugin.
2. **Design the two flows as skills** (`new-app`, `migrate`) that orchestrate subagents + the CLI
   engine; gate their generated output with the WP-10 hooks so it's born compliant.
3. **Lean on portable primitives for the visual loop** (`AskUserQuestion`, Storybook-MCP renders,
   artifacts) and treat any richer Cowork-only widget API as optional enhancement, not a dependency.
4. **Sequence on the enterprise-gap substrate** — the flows are far better once WP-03 (manifest/context),
   WP-09 (playbooks), and WP-13 (templates) exist; the plugin foundation + greenfield flow can start in
   parallel, brownfield benefits from manifest/guidance landing first.

---

_Sources: [`_research/plugin-and-dx-notes.md`](./_research/plugin-and-dx-notes.md) (Claude Code
plugins, Cowork plugins, marketplaces, surface capabilities — cited)._
