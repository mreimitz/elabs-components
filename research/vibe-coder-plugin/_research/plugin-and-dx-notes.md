# Plugin & DX Research Notes — guided "vibe-coding" experience for brand-ui

> Research for a guided developer-experience PLUGIN that helps a non-expert go from a
> vague idea (or an existing app) to brand-ui-correct UI, delivered through Anthropic's
> Claude tooling (Claude Code + Cowork).
>
> **Date:** 2026-06-06 · **Scope:** current (2025–2026) sources, official Anthropic docs
> prioritized. Every non-obvious claim is cited inline; full URL list in **Sources**.
>
> **Confidence note up front:** Areas 1, 3, 4 (Claude Code plugins, Skills, spec-driven
> intake) are very well documented. Area 2 (Cowork plugins) is **newer and thinner** — the
> product shipped plugin support as a _research preview_ on 2026-01-30 and several specifics
> (private marketplaces, org management, the exact visual-widget surface area inside Cowork)
> are explicitly "coming in the weeks ahead" per Anthropic, so treat those as moving targets.
> Where Cowork specifics are unconfirmed I say so explicitly.

---

## TL;DR decision-relevant findings

1. **A Cowork plugin IS a Claude Code plugin.** Same on-disk format (`.claude-plugin/plugin.json`
   - `skills/` + `commands/` + `.mcp.json` + `agents/` + `hooks/`), same marketplace mechanism,
     one repo serves both surfaces. Anthropic's own `knowledge-work-plugins` repo states the plugins
     are "Built for Claude Cowork, also compatible with Claude Code." So **build one plugin, ship to both.**
     [knowledge-work-plugins README] [code.claude.com/plugins]
2. **The big surface difference: hooks and sub-agents run only in Cowork.** In plain chat
   (web / Desktop Chat tab) the bundled _skills_ fire but "Hooks and sub-agents run only in Cowork,
   so they appear grayed out in chat." Claude Code runs everything. So a guided flow that relies on
   sub-agents or hooks is a **Cowork-or-Code** feature, not a chat feature. [support.claude.com — Use plugins]
3. **You get native guided UI for free: `AskUserQuestion`.** Claude can render multiple-choice
   clarifying questions (1–4 questions/call, 2–4 options each, optional multi-select, always an
   "Other" free-text). This is the built-in primitive for a staged interview — no custom UI needed.
   [platform.claude.com — Handle approvals and user input]
4. **Spec-driven intake is a solved, copyable pattern.** GitHub **Spec Kit** (`Constitution →
Specify → [Clarify] → Plan → [Analyze] → Tasks → Implement`) is the reference design; its
   `/clarify` does a 10-category ambiguity scan and asks ≤5 targeted questions, writing answers back
   into the spec. v0/Lovable/Bolt do the same intake informally ("ask me clarifying questions" → plan
   mode). Borrow the _structure_ (each stage emits a markdown artifact that feeds the next).
   [github.github.com/spec-kit] [Lovable prompting docs]
5. **Visual feedback loop = the Cowork artifact/widget + brand-ui Storybook.** The proven loop is
   _propose → preview (render real options) → pick → refine_. Tools generate 4–10 visual options and
   let you select-an-element-and-comment. For brand-ui specifically, the strongest move is to render
   real components (Storybook MCP / live preview) rather than mock images, because the system is
   token-driven and already has six-theme verification tooling.
   [nxcode — vibe design tools 2026] [Lovable vs v0]
6. **Brownfield migration is the higher-risk stream and the tooling is mature.** Approach =
   repo-scan (framework / existing UI lib / styling / component inventory) → map to target →
   **AST codemods** (jscodeshift, ast-grep, OpenRewrite for JVM, hypermod / codemod.com registries) →
   **strangler-fig** incremental rollout behind a façade, with dry-runs + review gates. AI's role in
   2025–2026 is real but **assistive at scale**: Google reported ~50% time savings and 80–87% of edits
   AI-generated on internal migrations; the emerging consensus (Codemod, Mike Mason) is that generic
   coding agents hit a ceiling on cross-repo consistency, so you pair an agent with **deterministic
   codemods + guardrails**. For a plugin: generate the codemod, don't hand-migrate file-by-file.
   [arxiv 2501.06972] [codemod.com blog] [martinfowler — codemods]
7. **Recommended shape for brand-ui:** one git-hosted plugin (marketplace.json + the plugin dir) with
   (a) a _greenfield_ guided skill chain that leans on `AskUserQuestion` + spec artifacts + Storybook
   preview, and (b) a _brownfield_ skill chain that scans the repo and emits codemods, not edits.
   Skills carry the portable expertise (work in chat too); commands are the explicit entry points;
   sub-agents/hooks add the Cowork-grade orchestration (RCA, visual-QA, validation gates). This mirrors
   the existing local `qps-toolkit` plugin almost exactly (see §1.6).

---

# 1. Claude Code plugins (current)

## 1.1 What a plugin is

A plugin is "a self-contained directory of components that extends Claude Code with custom
functionality. Plugin components include skills, agents, hooks, MCP servers, LSP servers, and
monitors." ([code.claude.com — Plugins reference]). Plugins are the **shareable / versioned**
counterpart to standalone `.claude/` config; the docs frame the choice as:

| Approach                    | Skill names          | Best for                                                                                         |
| --------------------------- | -------------------- | ------------------------------------------------------------------------------------------------ |
| **Standalone** (`.claude/`) | `/hello`             | personal workflows, project-specific, quick experiments                                          |
| **Plugin**                  | `/plugin-name:hello` | sharing with team/community, versioned releases, reuse across projects, marketplace distribution |

([code.claude.com — Plugins], "When to use plugins vs standalone configuration"). Plugin skills are
**always namespaced** (`/my-plugin:hello`) to prevent collisions; the namespace is the `name` field.

## 1.2 Directory structure (the canonical anatomy)

Only `plugin.json` lives inside `.claude-plugin/`; **everything else is at the plugin root** (a
documented "common mistake" is nesting `commands/`/`skills/` inside `.claude-plugin/`).
([code.claude.com — Plugins], "Plugin structure overview")

```
my-plugin/
├── .claude-plugin/
│   └── plugin.json        # manifest (only this file goes here)
├── skills/                # <name>/SKILL.md  — model-invoked Agent Skills
├── commands/              # flat .md files — slash commands (legacy/explicit; use skills/ for new)
├── agents/                # custom sub-agent definitions
├── hooks/                 # hooks.json — event handlers
├── .mcp.json              # bundled MCP server configs
├── .lsp.json              # LSP servers for code intelligence
├── monitors/              # monitors.json — background watchers
├── bin/                   # executables added to Bash PATH while enabled
└── settings.json          # default settings applied when enabled (e.g. force an agent as main thread)
```

(table from [code.claude.com — Plugins], "Plugin structure overview")

**`plugin.json` fields:** `name` (required, = namespace), `description` (shown in plugin manager),
`version` (optional — _if set, users only get updates when you bump it; if omitted and distributed via
git, the commit SHA is the version and every commit is a new version_), `author`, plus optional
`homepage`/`repository`/`license`/`keywords`. ([code.claude.com — Plugins], manifest table + version note)

## 1.3 The components, and what each is good for

- **Skills** (`skills/<name>/SKILL.md`) — _model-invoked_; Claude auto-uses them based on task context.
  Support progressive disclosure + bundled scripts/resources (see §3). This is where **portable domain
  expertise** lives, and it's the component that **also works in plain chat** (see §2).
  ([code.claude.com — Plugins], "Add Skills to your plugin")
- **Commands** (`commands/*.md`) — flat markdown; become explicit `/plugin:command` slash commands the
  _user_ triggers. The docs say "Use `skills/` for new plugins," but real plugins (incl. Anthropic's and
  the local `qps-toolkit`) still use `commands/` heavily as the **explicit entry points / orchestrators**.
- **Sub-agents** (`agents/*.md`) — separate context windows with their own system prompt, tool
  allow-list, and model; good for staged work (a "finder" agent vs a "builder" agent), parallelism, and
  isolation. ([code.claude.com — Subagents])
- **Hooks** (`hooks/hooks.json`) — event handlers (`SessionStart`, `PreToolUse`, `PostToolUse`, etc.) that
  run shell commands; receive hook input as JSON on stdin. Used for guardrails (lint after Write/Edit,
  bootstrap on session start). ([code.claude.com — Plugins], "Migrate hooks")
- **MCP servers** (`.mcp.json`) — wire in external tools; a plugin can **bundle its own MCP server**
  (e.g. a zero-dependency Python server exposing typed tools). ([code.claude.com — Plugins], MCP section)
- **LSP** (`.lsp.json`), **monitors** (`monitors/monitors.json`), **`bin/`**, **`settings.json`** —
  language intelligence, background log/file watchers, PATH executables, and default settings
  (only `agent` + `subagentStatusLine` keys honored today; `agent` can make a plugin agent the main thread).
  ([code.claude.com — Plugins], LSP / monitors / settings sections)

**`${CLAUDE_PLUGIN_ROOT}`** is the env var plugins use to reference their own files portably (seen in
hook commands and `.mcp.json` args in the local `qps-toolkit` plugin — see §1.6).

## 1.4 Marketplaces, install & distribution

- A **marketplace** is "a catalog that lets you distribute plugins to others … centralized discovery,
  version tracking, automatic updates, and support for multiple source types (git repositories, local
  paths, …)." You author a **`marketplace.json`** that lists your plugins + where to find them, host it on
  git (GitHub/GitLab/etc.), and users add it. ([code.claude.com — Plugin marketplaces], Overview)
- **User flow (Claude Code):**
  ```bash
  claude plugin marketplace add anthropics/knowledge-work-plugins   # add catalog
  claude plugin install sales@knowledge-work-plugins                # install one plugin
  ```
  Updates: push to the repo; users run `/plugin marketplace update`. ([knowledge-work-plugins README];
  [code.claude.com — Plugin marketplaces])
- **Private / internal distribution:** host the marketplace in a **private repo** to keep plugins internal
  to a team. ([code.claude.com — Plugins], "Share your plugins")
- **Local dev / testing:** `claude --plugin-dir ./my-plugin` (also accepts a `.zip`, v2.1.128+), or
  `--plugin-url <zip-url>` for a hosted archive; `/reload-plugins` hot-reloads skills/agents/hooks/MCP/LSP
  without restart. `claude plugin validate` checks the manifest (run before submitting). A
  _skills-directory plugin_ (`claude plugin init my-tool` → `~/.claude/skills/my-tool/`) auto-loads with no
  marketplace step. ([code.claude.com — Plugins], "Test your plugins locally" / "Develop a plugin in your
  skills directory")
- **Community marketplaces:** `claude-plugins-official` (curated by Anthropic, present in every install) and
  `claude-community` (public submissions after review, added via `/plugin marketplace add
anthropics/claude-plugins-community`). Submit via in-app forms (claude.ai/settings/plugins/submit or
  platform.claude.com/plugins/submit). ([code.claude.com — Plugins], "Submit your plugin")

## 1.5 What plugins are best suited for

Packaging **repeatable, opinionated workflows + the context/tools they need** so a team gets consistent
outcomes without each person configuring skills/agents/hooks/MCP by hand. The knowledge-work repo frames it
as: "tell Claude how you like work done, which tools and data to pull from, how to handle critical
workflows, and what slash commands to expose." ([knowledge-work-plugins README], "Why Plugins"). That is
_exactly_ a guided design-system DX plugin: encode the brand-ui rules, expose `/brand-ui:new-screen`-style
entry points, wire the Storybook MCP, and add guardrail hooks.

## 1.6 Grounding: a real multi-component plugin on this machine (`qps-toolkit`)

Inspected at `/.remote-plugins/.../qps-toolkit` (v2.1.1). It is a near-perfect template for what
brand-ui would ship, and demonstrates the full component set working in both Code and Cowork:

```
qps-toolkit/
├── .claude-plugin/plugin.json   # manifest: name, version, rich multi-line description, repo, license, keywords
├── skills/                      # 7 sub-skills (qlik-customer-onboard, qlik-ui-design, qlik-diagram, …)
├── commands/                    # 22 slash commands incl. 4 cross-skill ORCHESTRATORS (/qlik-pitch, /qlik-rfp, …)
├── agents/                      # 4 specialist sub-agents (visual-qa, fact-check, competitive-intel, theme-live-validator)
├── hooks/hooks.json             # SessionStart (bootstrap) + PostToolUse on Write|Edit (lint + visual-QA preflight)
├── mcp/server.py + .mcp.json    # bundled zero-dependency Python MCP server ("qps-assets") exposing typed tools
└── shared/                      # cross-skill shared assets
```

Key patterns worth copying:

- **Skills = capabilities, commands = orchestrators.** Single-purpose skills, plus a few high-level
  slash commands that _chain_ skills into a packaged deliverable.
- **Hooks reference `${CLAUDE_PLUGIN_ROOT}`** so they're path-portable:
  `"command": "bash \"${CLAUDE_PLUGIN_ROOT}\"/hooks/session_start.sh"`.
- **PostToolUse `matcher: "Write|Edit"`** runs a lint + a visual-QA preflight after every file write — a
  ready-made hook pattern for enforcing token/theme rules on generated brand-ui code.
- **Bundled MCP server** turns an internal asset library into typed tools — directly analogous to giving
  the agent a typed "brand-ui component picker / registry resolver."

---

# 2. Cowork plugins (Claude desktop knowledge-work mode)

## 2.1 What Cowork is

Claude Cowork is Anthropic's **desktop agentic system for knowledge work** — "the same capability [as
Claude Code] with a simplified experience, designed for where non-technical knowledge work happens."
It runs on the desktop, reads/edits/creates files in folders you grant, and "completes tasks without the
user coordinating each step." It's explicitly positioned as built-around-the-_outcome_, not the prompt, and
is aimed at non-developers. Available on all paid plans via the Claude desktop app.
([anthropic.com — Claude Cowork]; [claude.com/product/cowork])

## 2.2 What a Cowork plugin is, and how it differs from a Claude Code plugin

**Same artifact, different surfaces.** Plugin support shipped in Cowork on **2026-01-30** as a _research
preview for all paid users_. A Cowork plugin "bundle[s] any skills, connectors, slash commands, and
sub-agents together to turn Claude into a specialist." Every component is **file-based (markdown + JSON,
no code/build steps)**, and the same plugins are usable in Claude Code. ([claude.com/blog — Customize
Cowork with plugins]; [knowledge-work-plugins README])

The structure Anthropic documents for these plugins is identical to the Claude Code plugin format:

```
plugin-name/
├── .claude-plugin/plugin.json   # Manifest
├── .mcp.json                    # Tool connections (connectors)
├── commands/                    # slash commands you invoke explicitly
└── skills/                      # domain knowledge Claude draws on automatically
```

([knowledge-work-plugins README], "How Plugins Work")

**The differences that matter for design:**

- **Component availability by surface (critical).** Per the Help Center: "You can install and use plugins
  in chat on the web, the Chat tab in Claude Desktop, and Claude Cowork. The skills bundled in a plugin
  work across all three. **Hooks and sub-agents run only in Cowork, so they appear grayed out in chat.**"
  Claude Code runs all components. → If the guided flow needs sub-agents (e.g. a separate RCA/QA agent) or
  hooks (e.g. enforce-tokens-on-write), those features are **Cowork/Code-only**; the chat surface degrades
  to skills-only. ([support.claude.com — Use plugins in Claude])
- **Install UX.** Cowork: Customize → Plugins → Browse plugins → Install (or upload a custom `.plugin`
  file); browse the catalog at **claude.com/plugins**. Claude Code: the CLI `marketplace add` / `install`.
  ([support.claude.com — Use plugins]; [claude.com/blog — Cowork plugins])
- **Distribution maturity (moving target).** "Plugins are currently saved **locally** to your machine.
  Better support for org-wide sharing and management (**private plugin marketplaces**, etc.) are coming in
  the weeks ahead." Team/Enterprise org-distribution exists in the Help Center but is newer than the Code
  marketplace flow. ([claude.com/blog — Cowork plugins]; [support.claude.com — Manage plugins for your org])
- **Authoring helper.** Anthropic ships a **`cowork-plugin-management`** plugin (a.k.a. "Plugin
  Create/Customize") whose skills (`create-cowork-plugin`, `cowork-plugin-customizer`) _guide you through
  building/customizing a plugin from inside a Cowork session_ and deliver a `.plugin` file. (Confirmed
  present as loadable skills in this environment; listed in the knowledge-work repo + blog.)
  ([knowledge-work-plugins README]; [claude.com/blog — Cowork plugins])

## 2.3 Guided / conversational / visual capabilities in Cowork

- **Conversational, outcome-first, multi-step** is the core model — "you set the goal and Claude delivers
  finished, professional work." Good fit for a wizard-style intake. ([claude.com/blog — Cowork plugins])
- **Artifacts / files as the deliverable + preview.** Cowork's job is to _produce files_ in granted
  folders (docs, code, decks). In this very environment the Cowork tool surface includes
  `create_artifact` / `update_artifact` / `list_artifacts` and a `present_files` card UI, and a separate
  **`visualize`** tool (`show_widget`) renders inline SVG/HTML widgets, charts, mockups, and interactive
  forms in the chat — i.e. there _is_ an inline-visual channel for "show options / wireframes" loops.
  (Observed tool availability in this session; **treat the exact widget API as environment-specific /
  preview**, not a stable documented contract — Anthropic has not published a formal Cowork "widget SDK".)
- **`AskUserQuestion`** (see §3.4 and §5) gives structured multiple-choice prompts on every surface that
  runs the agent loop — the cleanest native primitive for guided branching.

**Uncertainty flag:** Public Anthropic docs describe Cowork plugins' _components_ (skills/commands/
connectors/sub-agents) and install/management, but do **not** publish a stable, documented "visual plugin
widget" extension point that a third-party plugin can target. The inline-widget rendering I can observe is
part of the host environment, not (as far as current docs show) a plugin-authored UI surface. Plan the
guided UI around **`AskUserQuestion` + artifacts/files + real component previews (Storybook)**, which are
documented/stable, and treat richer custom inline widgets as a nice-to-have that may need the host's
`visualize`/artifact surface rather than a plugin-owned API.

## 2.4 Can the same skills/MCP serve both Code and Cowork?

**Yes for skills and MCP.** Skills are portable across chat/Cowork/Code; MCP connectors (`.mcp.json`) wire
tools in both. **Hooks + sub-agents are Cowork/Code-only** (grayed out in chat). So the cross-surface
contract is: _skills + MCP = everywhere the agent runs; hooks + sub-agents = Cowork & Code._
([support.claude.com — Use plugins]; [knowledge-work-plugins README])

---

# 3. Skills, sub-agents, hooks for GUIDED multi-step experiences

## 3.1 Agent Skills + progressive disclosure (the mechanism)

A Skill packages "instructions, metadata, and optional resources (scripts, templates) that Claude uses
automatically when relevant." Skills load in three levels: (1) **metadata** (`name` + `description`,
~100 tokens, always in the system prompt); (2) **instructions** (the `SKILL.md` body, <5k tokens, loaded
when triggered); (3) **resources & code** (bundled files/scripts, "effectively unlimited," loaded only when
referenced; scripts run via bash and only their _output_ enters context).
([platform.claude.com — Agent Skills], "Three types of Skill content")

Why this matters for a guided wizard: you can ship a **large, staged interview + lots of reference material
(brand-ui catalog, token rules, codemod templates) with near-zero idle context cost.** The agent pulls each
stage's detail (e.g. `STAGE_2_LAYOUT.md`, `scripts/scan_repo.py`) only when it reaches that step. This is
the same "onboarding guide" model Anthropic uses for its document skills.

**SKILL.md essentials:** required `name` (≤64 chars, lowercase/numbers/hyphens, no "anthropic"/"claude") and
`description` (≤1024 chars; _must state what it does AND when to use it_ — this is what drives auto-invocation
and is the #1 authoring lever). ([platform.claude.com — Agent Skills], "Skill structure")
Frontmatter can also gate invocation: `disable-model-invocation: true` makes a skill user-invoke-only, and
skills accept `$ARGUMENTS`. ([code.claude.com — Plugins], Quickstart skill example)

## 3.2 Running a staged interview / wizard with skills

The pattern that works (and that the local `qps-toolkit` skills + Spec Kit both implement):

1. **One orchestrator skill/command** owns the flow ("guided intake") and is the explicit entry point.
2. Each **stage is its own section/file** loaded progressively; the skill instructs Claude to ask, capture,
   and **write the answer into a growing spec artifact** before advancing (so nothing is lost and the user
   can stop/resume).
3. **Deterministic steps run as bundled scripts** (repo scan, validation, scaffold) rather than free-form
   generation — cheaper + reliable. ([platform.claude.com — Agent Skills], Level-3 scripts)
4. **Gate transitions** ("don't proceed to Plan until the spec has no `[NEEDS CLARIFICATION]` left") —
   directly mirrors Spec Kit's `/clarify` gate (§4).

## 3.3 Sub-agents for staged/parallel work

Sub-agents have isolated context + their own tool allow-list + model, so they're the natural unit for the
"finder reports / builder fixes" separation, for parallel exploration, and for keeping a noisy task (repo
scan, visual QA) out of the main thread. (The local plugin uses dedicated `visual-qa`, `fact-check`,
`competitive-intel`, `theme-live-validator` agents.) **Caveat:** sub-agents don't run in plain chat — they
require Cowork or Code. ([code.claude.com — Subagents]; [support.claude.com — Use plugins])

## 3.4 Hooks + `AskUserQuestion` for guidance & guardrails

- **Hooks** enforce the rails deterministically: a `PostToolUse` `matcher:"Write|Edit"` hook can lint
  generated code for raw-hex/token violations and reject/auto-fix; a `SessionStart` hook can bootstrap
  context. (Pattern lifted from `qps-toolkit/hooks/hooks.json`.) Cowork/Code only.
- **`AskUserQuestion`** is the built-in interactive-prompt tool: Claude emits 1–4 questions, each with a
  `header` (≤12 chars) and 2–4 options, optional `multiSelect`, always an "Other" free-text, 60s timeout.
  It's "especially common in plan mode, where Claude explores … and asks questions before proposing a
  plan." This is the single most important primitive for a non-expert wizard — it turns a vague brief into a
  series of low-effort multiple-choice decisions. ([platform.claude.com — Handle approvals and user input];
  [code.claude.com — agent-sdk/user-input])

## 3.5 Best practice: guiding a NON-expert from vague idea → concrete spec

Synthesis of Anthropic's Skills best-practices + Spec Kit + v0/Lovable behavior:

- **Default to a plan/clarify phase before building.** Lovable's own guidance: enter "Plan mode" and tell
  it "Ask me any questions you need to fully understand what I want." ([lovable.dev — prompting bible])
- **Ask few, high-leverage questions, as multiple-choice with a recommended default.** Spec Kit caps at 5
  and presents recommended answers with reasoning; `AskUserQuestion` is built for ≤4 at a time. Don't
  interrogate — branch.
- **Make scope visible and incremental.** Show the high-level shape first (screens/sections), confirm, then
  drill into one piece at a time — the "breadth before depth" advice for v0/Lovable. ([nxcode — vibe design tools])
- **Persist a living spec artifact** the user can read and edit; every answer is written back (Spec Kit's
  `## Clarifications` section pattern). ([deepwiki — Spec-Driven Development Workflow])
- **Translate jargon.** A non-expert says "a dashboard for sales"; the skill maps that to concrete brand-ui
  components (MetricGrid, DataTable, FilterBar) and _confirms in plain language_.

---

# 4. Guided requirement elicitation & spec-driven development

## 4.1 How v0 / Lovable / Bolt do intake

- **Lovable** is the most intake-heavy: design-first, conversational, and the **only one of the three that
  proactively asks clarifying questions** before building; its "Plan mode" explicitly solicits questions to
  pin requirements up front, which makes features "land closer to your true intent with less back-and-forth."
  ([xda — vibe coding in Bolt/v0/Lovable]; [lovable.dev — prompting bible]; [lovable docs — prompting])
- **Bolt** is code-first/fast-iteration — scaffolds immediately, fewer questions. **v0** is
  component/frontend-first — plain-language (or screenshot) → production React + Tailwind + shadcn/ui, with a
  tight "say what to change, see it instantly" loop. ([techsy — Lovable vs Bolt vs v0]; [prismetric — v0])
- Common arc across all three: **vague prompt → (clarify) → high-level structure → iterative detail**, with
  refinement done conversationally ("make the sidebar narrower," "warmer palette"). ([nxcode — vibe design tools])

**Takeaway for brand-ui:** copy _Lovable's_ posture (ask first, structured) rather than Bolt's (build first),
because a non-expert + a strict design system needs the spec pinned before generation, and brand-ui already
has the "production component" advantage v0 leans on.

## 4.2 GitHub Spec Kit / spec-driven development (the reference architecture)

Spec Kit is "a toolkit for Spec-Driven Development … Instead of jumping straight to code, you describe _what_
to build, refine it through structured phases, and let your AI coding agent implement it." It's agent-agnostic
(30 integrations incl. Claude) and each phase emits a **markdown artifact that feeds the next**.
([github.github.com/spec-kit])

**The pipeline:** `Constitution → Specify → [Clarify] → Plan → [Analyze] → Tasks → Implement`
([deepwiki — SDD Workflow])

- **`/constitution`** — project's non-negotiable principles in `memory/constitution.md`; later phases are
  checked against it (conflicts are automatically CRITICAL). _For brand-ui this maps perfectly to the
  token/theme/a11y rules — the constitution IS the design-system contract._
- **`/specify`** — high-level prompt → full spec focused on **what & why, not tech**; underspecified areas are
  tagged `[NEEDS CLARIFICATION]`.
- **`/clarify`** (optional gate) — scans **10 ambiguity categories** (functional scope, domain model, UX flow,
  non-functional, integration, edge cases, constraints, terminology, completion signals, placeholders), asks
  **≤5 targeted questions one at a time with recommended answers**, and writes each accepted answer into a
  `## Clarifications` section. ([analyze.md / clarify docs via search]; [deepwiki — SDD Workflow])
- **`/plan`** — high-level tech direction → detailed implementation plan respecting architecture/constraints.
- **`/analyze`** (optional gate, after `/tasks`) — cross-artifact consistency + **constitution-compliance**
  check; flags inconsistencies/duplications/violations. ([github — analyze.md])
- **`/tasks`** → actionable task list → **`/implement`**.
- **Workflows** = YAML, multi-step, resumable pipelines that orchestrate the above with **human review gates**.
  ([github blog — spec-driven development]; spec-kit `/workflows`)

This is the single best blueprint to adapt: the guided brand-ui flow ≈ _Constitution (brand-ui rules already
exist) → Specify (what screen) → Clarify (AskUserQuestion) → Plan (which components/layout) → Implement
(scaffold with @qlik-coe-emea/qlabs-components-\* + registry)_, with `/analyze`-style token/theme/a11y gates at the end. There's even a
community **brownfield** preset ("FX→.NET … end-to-end migration across 7 phases") showing SDD applied to
migration. ([github.github.com/spec-kit], "Make it your own"; [augmentcode — SDD for brownfield])

## 4.3 PRD-from-conversation patterns

The reusable recipe: (1) free-form brief; (2) bounded clarifying round (multiple-choice, recommended
defaults, ≤5); (3) synthesize a structured spec/PRD artifact (goals, non-goals, screens, components,
data, states, acceptance criteria); (4) explicit human approval gate; (5) only then scaffold. The
`product-management:write-spec` skill in the knowledge-work repo and Spec Kit both implement this; the brand-ui
repo's own `issue-workflow`/`root-cause-analyst` rules are the same "diagnose → structured artifact → build
from it" philosophy.

---

# 5. Visual interaction feedback loops in agentic flows

## 5.1 The core loop: propose → preview → pick → refine

The pattern every vibe-coding tool uses: **generate multiple options, render them, let the user select +
comment, iterate.** Concretely:

- **Multiple visual options up front.** "Tools like v0, Lovable, and Bolt generate 4–10 design options from a
  single prompt"; the advice is _breadth first_ — explore options before refining the first output.
  ([nxcode — vibe design tools 2026])
- **Live, instant preview.** v0 "responds instantly to commands like 'add a search bar' or 'make this button
  green,' and updates the design right away with a fast … visual feedback loop." ([nxcode — vibe design tools])
- **Select-an-element-and-comment.** In Lovable "you can select an element directly from the preview and
  reference it in your chat message," linking feedback to a specific UI element. ([nxcode — vibe design tools];
  community feature-request describing "visual live preview + visual-edit mode" as the differentiator —
  [github community discussion #183385])
- **Conversational refinement** ("narrower sidebar," "warmer palette," "add search bar"). ([nxcode])

## 5.2 Mechanisms available inside Claude tooling for this loop

1. **`AskUserQuestion`** — multiple-choice option-picking (the _decision_ half of the loop). Render each
   option's name; can be multi-select. Best for "which layout pattern / which density / which entry point."
   ([platform.claude.com — user input])
2. **Real component preview via Storybook MCP (brand-ui-specific superpower).** brand-ui already runs
   `@storybook/addon-mcp` exposing `mcp__storybook__preview-stories` (live preview URLs, per-theme via
   `globals=theme:<slug>`) and `run-story-tests` (interaction + a11y). That means the agent can render the
   **actual proposed components in all six themes** and hand the user a real preview URL — strictly better
   than mock images for a token-driven system. (brand-ui `CLAUDE.md` / `.claude/rules/storybook-mcp.md`.)
3. **Artifacts / inline widgets (host surface).** Cowork can emit file artifacts and (in this environment)
   render inline SVG/HTML mockups/wireframes via a `visualize`/`show_widget` surface and `present_files`
   cards — usable to show wireframes or option thumbnails before generating real code. _Stability caveat
   per §2.3: this is host-provided, not a documented plugin-owned widget API._
4. **Generate → screenshot → critique sub-agent.** A `visual-qa`-style sub-agent (as in `qps-toolkit`) can
   render and screenshot output, then feed a critique back into the loop — an automated "preview + feedback"
   leg that doesn't depend on the user eyeballing every option. (Cowork/Code only.)

## 5.3 Recommended feedback-loop design for brand-ui

Wireframe-first for _layout_ decisions (cheap, fast, via AskUserQuestion + a simple inline mock), then
**real-component preview** for _fidelity_ decisions (Storybook MCP, six-theme). Keep refinement
conversational and **element-scoped** where possible. Always end with the objective gate (token/theme/a11y
checks) so "looks right" is verified, not asserted — consistent with brand-ui's own quality-gates rule.

---

# 6. Brownfield migration to a design system / component library

> This is the harder, higher-risk stream. The tooling is mature; the durable lesson from 2025–2026 is
> **pair an AI agent with deterministic codemods + guardrails — don't free-hand the migration.**

## 6.1 The migration playbook (repo-scan → map → transform → roll out)

**Step 1 — Scan & inventory.** Detect framework, existing UI library, styling approach (CSS-in-JS / Tailwind /
CSS modules), and build a **component inventory** (what's used, where, how often). Modern agent scanners build
an **AST/Repo-Map** for this: Aider "pioneered the Repository Map pattern that uses tree-sitter to parse code
into AST and extract function signatures and class definitions," letting agents understand a whole repo without
manual file selection; Windsurf uses "codemaps." ([medium — State of AI Coding Agents 2026]; search synthesis)

**Step 2 — Map old → target.** Build a mapping table (legacy `<Button variant="primary">` →
`@qlik-coe-emea/qlabs-components-ui Button`, legacy color → semantic token, etc.). Established design systems ship exactly this as
**codemods** for breaking changes — "libraries like MUI and Chakra UI provide codemods to help consumers
transition," and "Atlassian provide[s] codemod tools to migrate frontend components while ensuring
consistency." ([medium — codemods for migration]; [hypermod — automating DS evolution])

**Step 3 — Transform with AST codemods (not text edits).** "Codemods are scripts that automate large-scale
code transformations by parsing code into an AST, allowing precise and context-aware modifications that reduce
the risk of human error." Tooling:

- **jscodeshift** — Facebook's JS/TS codemod toolkit; the most common choice; AST find-and-transform.
  ([github — facebook/jscodeshift]; [jscodeshift.com])
- **ast-grep** — fast, pattern-based structural search/replace (often compared with jscodeshift for codemod
  work). (search synthesis; [hypermod blog])
- **OpenRewrite** — the JVM-ecosystem equivalent (recipes for Java/Spring/etc.) — relevant if any backend or
  JVM UI is in scope. (area brief; widely used for JVM migrations)
- **hypermod.io** & **codemod.com** — registries/platforms of reusable codemods + **AI-assisted codemod
  generation** ("build AST-powered codemods or generate them with AI"). ([hypermod.io]; [codemod.com])

**Step 4 — Roll out incrementally (strangler-fig).** Don't big-bang. The Strangler Fig pattern = **Transform,
Coexist, Eliminate**: build the new implementation for one slice, run old + new behind a **façade** (e.g. a
Vite proxy), then delete the legacy path. Codemods do the mechanical transform per slice.
([stevekinney — Strangler Fig]; [martinfowler — codemods for API refactoring])

**Step 5 — Risk management / guardrails.** Dry-runs, approval gates, audit logs, rollbacks, and CI checks per
slice. Enterprise codemod platforms ship these "by default … dry runs, approval gates, audit logs, rollbacks,
and integrations with GitHub and Jira." ([codemod.com blog])

## 6.2 How AI agents are used for large-scale migration in 2025–2026

- **Real, measurable leverage — but assistive.** Google's internal study ("How is Google using AI for internal
  code migrations?", FSE 2025): for the JUnit3→JUnit4 migration, ~87% of AI-generated code was committed with
  no changes; across a 39-migration case study, **74% of code changes and 69% of edits were LLM-generated**;
  developers estimated a **~50% reduction in total migration time** vs prior manual efforts. Migrations
  included 32→64-bit ID changes across a 500M-line codebase and Joda→java.time.
  ([arxiv 2501.06972]; [theregister — Google halving migration time])
- **Generic agents hit a ceiling at scale; vertical/codemod tooling fills the gap.** Codemod's thesis (and Mike
  Mason's 2026 piece) is that single-developer coding agents are great locally but struggle with **cross-repo
  consistency, drift, and large blast radius**; the answer is **specialized "micro-agents" + a deep semantic
  (compiler-aware) model + orchestration/guardrails**, capturing migration knowledge as **reusable, versioned,
  tested codemods**. "General coding agents create. Codemod micro agents maintain."
  ([codemod.com blog]; [mikemason.ca — AI coding agents Jan 2026])
- **AI-generated codemods are the sweet spot for a plugin.** Use the LLM to _write/adapt the codemod_ from a
  natural-language description (and from the repo scan), then run the deterministic codemod across the
  codebase — combining AI breadth with AST reliability. Several established design systems already ship
  AI-assisted codemod workflows. ([hypermod blog]; [chimurai — AI-assisted jscodeshift])
- **Spec-driven migration.** SDD is being applied to brownfield: Spec Kit has migration presets (e.g. FX→.NET
  7-phase) and there are explicit "SDD for brownfield enterprise codebases" guides — i.e. write the migration
  _spec_ first, then let the agent execute against it with gates. ([github.github.com/spec-kit];
  [augmentcode — SDD for brownfield])

## 6.3 Implication for the brand-ui brownfield plugin

A brownfield skill chain should: **scan** (build component/styling inventory via AST) → **map** existing UI to
`@qlik-coe-emea/qlabs-components-*` + tokens → **generate codemods** (jscodeshift/ast-grep) for the mechanical 80% rather than editing
files one-by-one → **drive a strangler-fig rollout** slice-by-slice with **dry-runs + the repo's own
token/theme/a11y gates** (which already exist) as the review gate → file anything ambiguous as an issue
(matches the repo's finder-reports/builder-fixes rule). The codemods become **reusable assets** for the next app.

---

## Cross-cutting recommendation (how this all composes into ONE plugin)

- **One git-hosted plugin + `marketplace.json`,** installable in Claude Code (CLI) and Cowork (Customize →
  Plugins / claude.com/plugins), private-repo-hosted for internal-only.
- **Skills** carry the portable expertise (greenfield guided intake; brownfield scan+migrate; the brand-ui
  rule "constitution") — these also work in plain chat.
- **Commands** are the explicit entry points / orchestrators (`/brand-ui:new-screen`, `/brand-ui:migrate`),
  Spec-Kit-style staged pipelines that emit artifacts and gate transitions.
- **Sub-agents** add Cowork/Code-grade isolation (repo-scanner, root-cause-analyst, visual-QA) — gracefully
  absent in chat.
- **Hooks** enforce the token/theme/a11y rails on every Write/Edit (Cowork/Code).
- **Bundled MCP** exposes brand-ui as typed tools (component picker / registry resolver / Storybook preview),
  analogous to `qps-toolkit`'s `qps-assets` server.
- **Guided UX** = `AskUserQuestion` (decisions) + a living spec artifact (Spec Kit clarify pattern) + **real
  six-theme component previews via the existing Storybook MCP** (fidelity), not mock screenshots.
- **Brownfield** = AST scan → mapping → **AI-generated deterministic codemods** → strangler-fig rollout with
  dry-runs and the repo's existing quality gates.

---

## Sources

**Claude Code plugins (official)**

- Create plugins — https://code.claude.com/docs/en/plugins (canonical for https://docs.claude.com/en/docs/claude-code/plugins)
- Plugins reference — https://code.claude.com/docs/en/plugins-reference
- Create & distribute a plugin marketplace — https://code.claude.com/docs/en/plugin-marketplaces
- Subagents — https://code.claude.com/docs/en/sub-agents
- Community catalog — https://github.com/anthropics/claude-plugins-community

**Cowork (official + reporting)**

- Claude Cowork product — https://www.anthropic.com/product/claude-cowork ; https://claude.com/product/cowork
- Customize Cowork with plugins (blog, 2026-01-30) — https://claude.com/blog/cowork-plugins
- Use plugins in Claude (Help Center) — https://support.claude.com/en/articles/13837440-use-plugins-in-claude
- Manage plugins for your organization (Help Center) — https://support.claude.com/en/articles/13837433-manage-claude-cowork-plugins-for-your-organization
- Get started with Claude Cowork — https://support.claude.com/en/articles/13345190-getting-started-with-cowork
- knowledge-work-plugins (Anthropic open-source plugins; format + install) — https://github.com/anthropics/knowledge-work-plugins
- The New Stack — Anthropic brings plugins to Cowork — https://thenewstack.io/anthropic-brings-plugins-to-cowork/
- The Decoder — Cowork gets plugins (2026-01-30) — https://the-decoder.com/anthropics-cowork-gets-plugins-that-turn-claude-into-a-specialized-assistant-for-knowledge-workers/

**Skills / sub-agents / interactive input (official)**

- Agent Skills overview (progressive disclosure, levels) — https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview
- Agent Skills best practices — https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices
- Engineering: Equipping agents with Agent Skills — https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills
- Handle approvals and user input (AskUserQuestion) — https://platform.claude.com/docs/en/agent-sdk/user-input ; https://code.claude.com/docs/en/agent-sdk/user-input

**Spec-driven development / elicitation**

- GitHub Spec Kit docs — https://github.github.com/spec-kit/
- Spec Kit repo — https://github.com/github/spec-kit
- SDD workflow (DeepWiki) — https://deepwiki.com/github/spec-kit/5-spec-driven-development-workflow
- analyze.md command — https://github.com/github/spec-kit/blob/main/templates/commands/analyze.md
- GitHub Blog — spec-driven development with AI — https://github.blog/ai-and-ml/generative-ai/spec-driven-development-with-ai-get-started-with-a-new-open-source-toolkit/
- SDD for brownfield enterprise codebases (Augment) — https://www.augmentcode.com/guides/spec-driven-development-brownfield-codebases

**v0 / Lovable / Bolt intake + visual loop**

- Lovable prompting bible — https://lovable.dev/blog/2025-01-16-lovable-prompting-handbook
- Lovable prompting docs — https://docs.lovable.dev/prompting/prompting-one
- Lovable vs v0 — https://lovable.dev/guides/lovable-vs-v0
- XDA — vibe coding in Bolt, v0, Lovable — https://www.xda-developers.com/tried-vibe-coding-a-real-app-in-bolt-v0-and-lovable/
- TECHSY — Lovable vs Bolt vs v0 — https://techsy.io/en/blog/lovable-vs-bolt-vs-v0
- NxCode — Vibe design tools 2026 (Stitch vs v0 vs Lovable vs Bolt) — https://www.nxcode.io/resources/news/vibe-design-tools-compared-stitch-v0-lovable-2026
- v0 guide (Prismetric) — https://www.prismetric.com/what-is-vercel-v0/
- GitHub community discussion — visual live preview / visual-edit feature request — https://github.com/orgs/community/discussions/183385

**Brownfield migration / codemods / AI at scale**

- Google — How is Google using AI for internal code migrations? (arXiv 2501.06972) — https://arxiv.org/html/2501.06972v1 ; FSE 2025 — https://conf.researchr.org/details/fse-2025/fse-2025-industry-papers/14/Migrating-Code-At-Scale-With-LLMs-At-Google
- The Register — Google halving code migration time with AI — https://www.theregister.com/2025/01/16/google_ai_code_migration/
- Codemod — Solving enterprise code maintenance with specialized agents — https://codemod.com/blog/codemod-and-coding-agents
- Hypermod — Automating design system evolution with codemods — https://www.hypermod.io/blog/7-automating-design-system-evolution ; https://www.hypermod.io/
- Martin Fowler — Refactoring with codemods to automate API changes — https://martinfowler.com/articles/codemods-api-refactoring.html
- facebook/jscodeshift — https://github.com/facebook/jscodeshift ; https://jscodeshift.com/
- Steve Kinney — The Strangler Fig Pattern — https://stevekinney.com/courses/enterprise-ui/strangler-fig-introduction
- Medium — Codemods for code migration (beginner's guide) — https://medium.com/@vasanthancomrads/codemods-for-code-migration-a-beginners-guide-to-smarter-refactoring-be90d3c60e41
- Mike Mason — AI coding agents Jan 2026 (orchestration not autonomy) — https://mikemason.ca/writing/ai-coding-agents-jan-2026/
- Medium (Dave Patten) — State of AI Coding Agents 2026 — https://medium.com/@dave-patten/the-state-of-ai-coding-agents-2026-from-pair-programming-to-autonomous-ai-teams-b11f2b39232a
- AI-assisted jscodeshift codemods (Chimurai) — https://chimurai.medium.com/vibe-code-your-jscodeshift-codemod-in-minutes-c7c20cdc6ba1

**Local grounding (this machine)**

- `qps-toolkit` plugin (v2.1.1) — real multi-component plugin: `.claude-plugin/plugin.json`, `skills/` (7),
  `commands/` (22 incl. orchestrators), `agents/` (4), `hooks/hooks.json` (SessionStart + PostToolUse Write|Edit),
  bundled `mcp/server.py` + `.mcp.json`. Inspected on disk under `/.remote-plugins/`.
- brand-ui repo rules — `CLAUDE.md`, `.claude/rules/storybook-mcp.md`, `.claude/rules/quality-gates.md`,
  `.claude/rules/issue-workflow.md` (Storybook MCP preview/test, six-theme gates, finder→RCA→builder workflow).
