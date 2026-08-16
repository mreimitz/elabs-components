# 04 · End-user skills, functions & plugin architecture

> Part of the **vibe-coder-plugin** pack. The skill/command/agent/function/MCP surface the plugin
> exposes to internal vibe coders (new + reused), how they compose, and how the plugin is architected,
> packaged, and distributed. Working packages **VP-01** (foundation) and **VP-04** (visual engine).

## The end-user skill surface

Today's 5 skills are aimed at _using/maintaining the library_. The product needs a small set of
**front-door, user-invocable** skills that route a non-expert into the right flow, backed by the
existing skills.

| Skill                                      | Status  | Audience   | What it does                                                                                                                                                                                          |
| ------------------------------------------ | ------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`brand-ui-start`**                       | **new** | end user   | The router / concierge. "What do you want to do?" → **build a new app** (`new-app`), **improve an existing app** (`migrate`), or **just help me use brand-ui** (`brand-ui`). One obvious entry point. |
| **`new-app`**                              | **new** | end user   | The greenfield guided build (doc 02): staged interview → `app-spec.md` → scaffold.                                                                                                                    |
| **`migrate`**                              | **new** | end user   | The brownfield flow (doc 03): scan → analysis → plan → codemod-driven migration.                                                                                                                      |
| `brand-ui`                                 | exists  | consumer   | Discover/compose components, tokens, rules (used _inside_ both flows + standalone).                                                                                                                   |
| `brand-ui-audit`                           | exists  | both       | Cross-theme visual + a11y/contrast check (the "is it good?" gate in both flows).                                                                                                                      |
| `brand-ui-theme`                           | exists  | both       | Create/retune a theme (the brand step of `new-app`; the theming cutover of `migrate`).                                                                                                                |
| `brand-ui-component` / `brand-ui-registry` | exists  | maintainer | Extend the library itself (not the end-user front door; invoked when a flow hits a "gap" component).                                                                                                  |

Design each skill **thin** (progressive disclosure: short `SKILL.md` + `reference/*` files + bundled
scripts) so context stays lean and the heavy lifting is deterministic code (below), not prose.

## The functions (the deterministic engine)

The flows must not be hand-wavy LLM steps — they call **`@qlik-coe-emea/qlabs-components-cli` functions** so behavior is
repeatable and reviewable. Today the CLI has `info / search / docs / audit / manifest`. The product
adds:

| Function                        | New?       | Powers     | Does                                                                                                       |
| ------------------------------- | ---------- | ---------- | ---------------------------------------------------------------------------------------------------------- |
| `brand-ui info / search / docs` | exists     | both flows | project context, find components, real props                                                               |
| `brand-ui audit`                | exists     | both       | static + (via skill) rendered cross-theme check                                                            |
| `brand-ui manifest`             | exists     | both       | the ground-truth index (enriched by WP-03)                                                                 |
| `brand-ui context`              | WP-03 (E7) | both       | emit ground truth into the new/target repo's agent files                                                   |
| **`brand-ui scaffold`**         | **new**    | greenfield | spec → files: template (WP-13) + playbooks (WP-09) + theme + shell + gates + context                       |
| **`brand-ui scan`**             | **new**    | brownfield | read-only repo profile (framework, UI lib, styling, component inventory, usage freq)                       |
| **`brand-ui map` / `analyze`**  | **new**    | brownfield | map existing components → brand-ui via the manifest; classify (direct/props/compose/gap/drop); risk+effort |
| **`brand-ui codemod`**          | **new**    | brownfield | generate/dry-run/apply AST codemods (jscodeshift/ast-grep) from the mapping                                |

These are the same "thin skill + deterministic backend" pattern brand-ui already uses (per
`docs/CONCEPT-ai-skills.md`) — extended with scaffold/scan/map/codemod.

## Subagents

| Subagent            | New?   | Role                                                                      |
| ------------------- | ------ | ------------------------------------------------------------------------- |
| `scaffold-builder`  | new    | generates the greenfield app files from the spec (isolated, then audited) |
| `repo-scanner`      | new    | read-only brownfield inventory                                            |
| `migration-analyst` | new    | mapping/analysis (reuses the `root-cause-analyst` + audit methodology)    |
| `codemod-runner`    | new    | generate → dry-run → diff → apply, per phase                              |
| `brand-ui-reviewer` | exists | the final cross-theme/a11y health gate in both flows                      |

## MCP & hooks

- **MCP:** the persistent **`brand-ui` MCP** (WP-03) provides always-on ground truth (search/docs/
  tokens) to the flows; the **Storybook MCP** provides the **real-component visual renders** (doc 02).
  The plugin declares both in its `.mcp.json`.
- **Hooks:** reuse the **WP-10 gates** (manifest/registration/stale + types-only). Scaffolded _and_
  migrated code is born compliant — the flows can't emit drift. (Hooks run in Cowork/Code, not chat.)

## How it composes

```
                       ┌──────────── brand-ui-start (router) ────────────┐
   user intent ──────► │  build new   │   improve existing   │  just help │
                       └──────┬───────┴──────────┬───────────┴─────┬──────┘
                              ▼                   ▼                 ▼
                          new-app             migrate            brand-ui
                              │                   │                 │
        AskUserQuestion + visual loop      scan→map→plan→codemod    discover/compose
                              │                   │                 │
            ┌─────────────────┴─────────┐ ┌───────┴────────┐        │
            ▼                           ▼ ▼                ▼         ▼
     @qlik-coe-emea/qlabs-components-cli scaffold        scan / map / codemod   manifest / context / docs
     (template+playbook+theme)  (subagents + AST)      (ground truth)
            │                           │                          │
            ▼                           ▼                          ▼
        WP-10 gates + brand-ui-audit (born-compliant, cross-theme verified) + Storybook-MCP previews
```

## Plugin architecture & distribution

- **One plugin, extend the existing one.** Keep `.claude-plugin/plugin.json` (name `brand-ui`); add the
  new skills under `skills/`, the new subagents under `agents/`, commands under `commands/`, hooks under
  `hooks/`, and the two MCPs in `.mcp.json`. Use `${CLAUDE_PLUGIN_ROOT}` for bundled script/asset paths
  (the qps-toolkit plugin on this machine is a working template for exactly this shape).
- **Both surfaces from one artifact.** Same plugin installs in Claude Code (CLI/marketplace — already
  wired) and Cowork (UI install). Skills + MCP work in both (and chat); subagents + hooks light up in
  Cowork/Code.
- **Distribution:** the repo's `marketplace.json` is the internal marketplace. Code: `/plugin
marketplace add Qlik-CoE-EMEA/qlabs-components` → install `brand-ui`. Cowork: UI install (research
  preview; private/org marketplaces "coming" — flagged moving target). Keep it internal/UNLICENSED.
- **Reuse, don't rebuild.** The plugin is the _experience shell_; the substance comes from the
  enterprise-gap substrate (manifest WP-03, playbooks WP-09, templates WP-13, guidance WP-12, gates
  WP-10, widgets WP-05). The multi-harness `scripts/build-skills.mjs` already mirrors skills to
  Cursor/Codex/etc.
- **Versioning:** bump the plugin via Changesets (enterprise-gap WP-07); the plugin version travels
  with the library.

## Honest notes

- **The new CLI functions (`scaffold`/`scan`/`map`/`codemod`) don't exist yet** — only
  `info/search/docs/audit/manifest` do. They're the build in VP-01/02/03.
- **Cowork distribution + any Cowork-only visual API are a 2026 preview / moving target** — rely on the
  portable visual mechanisms (AskUserQuestion, Storybook-MCP renders, artifacts).
- **The flows' quality is bounded by the substrate** — they're far better once WP-03/09/12/13 land.

---

_Related: [`01-plugin-landscape.md`](./01-plugin-landscape.md), [`02-greenfield-guided-flow.md`](./02-greenfield-guided-flow.md),
[`03-brownfield-migration-flow.md`](./03-brownfield-migration-flow.md); enterprise-gap WP-03/05/09/10/12/13.
Sources: [`_research/plugin-and-dx-notes.md`](./_research/plugin-and-dx-notes.md)._
