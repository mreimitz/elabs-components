# brand-ui AI Skills

An installable skill layer that supercharges UI work with brand-ui — for **two
audiences**: developers building apps _with_ `@qlik-coe-emea/qlabs-components-*`, and maintainers extending
the library itself. Concept and rationale: [CONCEPT-ai-skills.md](./CONCEPT-ai-skills.md).

## What ships

| Skill                     | Audience              | What it does                                                                                                                                                                                                                                                                                                                                                                       |
| ------------------------- | --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`brand-ui-start`**      | everyone (front door) | The router/concierge. One question → build a NEW app (`brand-ui-new-app`), improve an EXISTING app (`brand-ui-migrate`), or just USE brand-ui (`brand-ui`). Entry point: `/brand-ui-start`.                                                                                                                                                                                        |
| **`brand-ui`**            | consumer              | Auto-triggers when building UI with `@qlik-coe-emea/qlabs-components-*`. Live project context, real component API, composition patterns, token rules, theming.                                                                                                                                                                                                                     |
| **`brand-ui-audit`**      | both                  | Deterministic static lint **+** rendered cross-theme WCAG-contrast & visual review. Phased, token-referenced findings → `/file-issue`.                                                                                                                                                                                                                                             |
| **`brand-ui-component`**  | maintainer            | Scaffold/extend a component with the dedupe gate + quality gates + manifest refresh.                                                                                                                                                                                                                                                                                               |
| **`brand-ui-theme`**      | maintainer + consumer | Create/retune themes and global tokens (radius, surfaces, re-brand).                                                                                                                                                                                                                                                                                                               |
| **`brand-ui-registry`**   | maintainer            | Curate the shadcn-compatible registry (package vs block, validate, build).                                                                                                                                                                                                                                                                                                         |
| **`brand-ui-new-app`**    | consumer              | Define-to-build: guided interview (quick 3-question or full 7-stage) → `app-spec.md` → annotated scaffold from template + playbook + starter `CLAUDE.md`. Entry point: `/new-app`.                                                                                                                                                                                                 |
| **`brand-ui-migrate`**    | consumer              | Brownfield adoption: profile the repo, map every component to a verdict, emit `migration/{repo-profile,analysis,plan}.md`, then walk the strangler-fig phases with the user approving each. Read-only until the plan is approved. Entry point: `/brand-ui-migrate`.                                                                                                                |
| **`brand-ui-enterprise`** | consumer              | Enterprise design-judgment layer over brand-ui: classify the surface (professional/consumer/marketing), pick the app-shell archetype (tool/workspace vs admin console), stand up the mandatory baseline (shell, theme switcher, settings, toasts, detail panel), model objects → screens. Defers props to `brand-ui`, scoring to `brand-ui-audit`, scaffold to `brand-ui-new-app`. |

Plus the brand-ui **subagents** — Claude Code/Cowork agents shipped via the
plugin (`plugin.json` → `"agents": "./.claude/agents"`). The headline evaluator:

| Agent                   | What it does                                                                                                                                                                                                                                                                                                          |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`brand-ui-reviewer`** | The honest evaluator. One entry point that bundles the deterministic detector + cross-theme visual review + accessibility/ethics into a two-pass, scored health report, then routes findings to `/file-issue`. Read-only. Invoke as a subagent (`@brand-ui-reviewer`) or it runs the `brand-ui-audit` skill's rubric. |

…alongside the rest of `.claude/agents/` (component-builder, accessibility-reviewer,
root-cause-analyst, design-system-architect, docs-writer, registry-curator, and the
`repo-architect-*` cluster). Subagents activate in Claude Code + Cowork, not plain chat.

Backed by the **`@qlik-coe-emea/qlabs-components-cli`** engine (`packages/cli`) — the deterministic backend
the skills call so they never guess:

```bash
brand-ui info            # project context: packages, themes, tokens, registry, rules
brand-ui search <query>  # find components / hooks / registry items
brand-ui docs <Comp>     # the component's REAL props, read from source
brand-ui manifest --write# regenerate brand-ui.manifest.json (ground truth)
brand-ui audit <path>    # static token/style lint
```

The vibe-coder-plugin experience engine (deterministic backend for the
greenfield/brownfield flows; `scaffold` is implemented, `scan`/`map`/`codemod`
fill out in VP-03):

```bash
brand-ui scaffold <app-spec.md>          # plan a born-compliant app from an app-spec
brand-ui scaffold <app-spec.md> \
  --write <dir> [--dry-run] [--force]    # …and EMIT it (see below)
brand-ui scan [path]           # read-only repo profile: framework, UI lib, styling, components
brand-ui map <scan.json>       # map existing components → brand-ui via the manifest
brand-ui codemod <map.json>    # plan AST codemods [--dry-run|--apply] — read-only until VP-03
```

`scaffold` reads the fenced `json` **Machine spec** block out of an `app-spec.md`
(the same schema + validator `pnpm app-spec:check` gates), applies it to the
archetype template, and — with `--write` — emits a **runnable** app: `index.html`,
`src/App.tsx`, `src/main.tsx` (`ThemeProvider` + the token stylesheet),
`src/styles.css` (the `@import` + one `@source` per installed package),
`vite.config.ts` (react + `@tailwindcss/vite`), `tsconfig.json`, `app-spec.md`,
`CLAUDE.md`, `AGENTS.md`, `brand-ui-context.md` (the manifest-derived component
inventory), `eslint.config.js`, a GitHub Actions quality workflow (`brand-ui.yml`
— typecheck, lint, `brand-ui audit`) and `package.json`. Without `--write` it is read-only. Everything the spec doesn't
answer stays a `TODO(spec):` comment and is reported back. A spec with
`"standalone": true` also gets the GitHub-Packages install handoff (`.npmrc`,
`pnpm add`, engine peers **at the ranges the packages declare**, the CSS lines —
`docs/CONSUMING.md` §1-4). Emitting into a folder that already holds some of those
files is reported `partial` (exit 1), never a silent success. The
`brand-ui-scaffold-builder` subagent drives spec → emit → typecheck / lint /
`brand-ui audit` → report.

The published CLI **ships the archetype templates** (`files: ["templates", …]`,
copied by `prepack` — `packages/cli/scripts/bundle-assets.mjs`) alongside the
manifest, so `scaffold --write` works in a consuming project with no brand-ui
checkout. Locked by `packages/cli/test/packaging.test.mjs`.

Every command accepts `--json` (agent-consumable). In this monorepo:
`pnpm brand-ui <cmd>`. In a consuming project, install the CLI first — it's a
private GitHub Packages dependency (`pnpm add -D @qlik-coe-emea/qlabs-components-cli`, see
`docs/CONSUMING.md` §1 + §7a) — then `pnpm exec brand-ui <cmd>`.

## Ground truth, no drift

`brand-ui.manifest.json` is generated from the package barrels + `themes.css`
tokens + the registry. Regenerate it in `build` (or `pnpm manifest`) so the
`brand-ui` skill's knowledge of components/props/tokens can never lag the code —
the "read the package, don't trust memory" guarantee.

## Install

**Claude Code (plugin):**

```
/plugin marketplace add Qlik-CoE-EMEA/qlabs-components
/plugin            # then install "brand-ui"
```

Skills load automatically; start with `/brand-ui-start` (the front-door router).
`brand-ui-audit`/`-component`/`-theme`/`-registry`/`-new-app` are also invokable as
slash commands. Subagents + the Storybook MCP (auto-adopted from the repo-root
`.mcp.json`) light up here too.

**Cowork (research preview):** the same one plugin installs via the Cowork UI —
skills, subagents, and MCP all work. Private/org marketplaces are a moving target
in the 2026 preview, so install is UI-driven; don't hard-depend on org-marketplace
features. (Skills + MCP work in plain chat; subagents + hooks need Code/Cowork.)

**Other harnesses (Cursor, Codex, Gemini CLI, Copilot):**

```
npx skills add Qlik-CoE-EMEA/qlabs-components        # reads skills/ directly
```

Or commit per-harness copies: `node scripts/build-skills.mjs` (source of truth
stays `skills/`; `--clean` removes them).

## Layout

```
skills/                       # canonical skills (source of truth)
  brand-ui-start/             # the front-door router (build-new / improve / use-it)
  brand-ui/                   # consumer skill + reference/{rules,composition,theming}.md
  brand-ui-audit/             # audit skill + reference/{contrast-audit,anti-patterns,ux-evaluation}.md
  brand-ui-component/  brand-ui-theme/  brand-ui-registry/  brand-ui-new-app/
.claude/agents/               # brand-ui subagents (shipped via plugin.json "agents")
.claude-plugin/               # plugin.json (skills + agents) + marketplace.json
.mcp.json                     # Storybook MCP (auto-adopted as the plugin's MCP config)
packages/cli/                 # @qlik-coe-emea/qlabs-components-cli — the engine (info/search/docs/manifest/audit + scaffold/scan/map/codemod)
brand-ui.manifest.json        # generated ground truth
scripts/check-plugin.mjs      # plugin-manifest gate (pnpm plugin:check)
scripts/build-skills.mjs      # optional multi-harness mirror
```

## Roadmap (not yet built)

- Phase 3 option: a `brand-ui` **MCP server** wrapping the same CLI engine
  (search/docs/tokens/audit) for harnesses that prefer MCP.
- Per-package generated `docs/` for richer prop/usage extraction.
- intent-style persona agents bundling the reviewers.
