# 02 · What makes a component library "vibe-coding" / agentic-friendly

> Part of the **enterprise-gap** research pack. This distills what makes a library legible to AI
> coding agents (Claude Code, Cursor, v0, Lovable, bolt, Copilot) so they can **discover**,
> **understand**, and **correctly use/extend** it with minimal hallucination. Full sourced notes
> (~60 citations) live in
> [`_research/ai-agentic-friendliness-notes.md`](./_research/ai-agentic-friendliness-notes.md).
> brand-ui is unusually mature here, so the gap analysis ([`03`](./03-gap-analysis.md)) focuses on
> what's _missing_, not what's absent.

## The core thesis: remove the judgment step

A human opens Storybook, brings product context, and applies judgment. **An agent brings none of
that** — it pattern-matches on whatever it saw most during training and ships that, which is how
codebases accumulate components that "look right but quietly drift from your system" (new variants,
reinvented disabled states, rounded-off spacing).

The fix is to **make every "use this / don't use this" explicit and machine-readable**, and give
agents **ground-truth** access to the real prop surface, real examples, and real tokens. Two framings
recur across the 2025–2026 literature:

- **Anti-hallucination via ground truth.** The most-repeated instruction in the whole ecosystem is
  some variant of _never invent a prop — verify it against the real type/manifest/docs first._
  Storybook's recommended `AGENTS.md` snippet says it verbatim. (brand-ui's `storybook-mcp` rule and
  its "never guess props — run `brand-ui docs`" instruction are this principle, already implemented.)
- **The design system as a "productivity coefficient"** (Figma): paired with an MCP/ground-truth
  interface, the system makes AI output relevant and on-brand, creating a flywheel. Figma's 2025
  data: 68% of developers use AI to write code, but only 32% trust the output — "because context is
  everything."

Everything below is a concrete way to supply that context.

## The agent-context surfaces (the levers)

### 1. Source visibility — let the agent read the real code

shadcn's defining bet is **distributing source, not a package**: components land as editable code an
LLM can read, "rather than relying on black-box npm packages." The implication for an
_imported-package_ library is sharp: **agents can't see into `dist/`**, so the library must export
**TypeScript source** and/or ship machine-readable metadata to recover the visibility a copy-paste
lib gets for free. brand-ui does both (TS-source exports _and_ a registry) — a strong position.

### 2. A registry as a machine-readable install contract

The shadcn `registry.json` / `registry-item.json` schema is itself a manifest: what a block is, what
it depends on, where its files go, what tokens it needs. CLI 3.0 (Aug 2025) added **namespaced
registries** (`@acme/item`), **private/auth** registries (the enterprise path), search/discovery
commands, errors written "for users and LLMs", and a `meta` field as an extension point for custom
agent hints. This is the highest-leverage way to be consumable by _all_ the AI builders at once.

### 3. MCP for the library — ground-truth props/examples/tests

MCP is the transport; the win is that it returns the **actual prop surface + real example code +
(Storybook) real test results**, not prose. Four surfaces matter:

- **Storybook `addon-mcp`** — an MCP server _inside_ the dev server. Toolsets: **Docs**
  (`list-all-documentation`, `get-documentation` → props + first stories), **Development**
  (story-writing instructions, previews), **Testing** (`run-story-tests` → real-browser interaction +
  axe a11y → a _self-healing_ generate→test→fix loop). **Experimental / React-only**, and **only
  exists while the dev server runs.** (brand-ui already wires this — its single strongest agent
  asset.)
- **Context7** — version-pinned live docs over MCP for public libs.
- **Figma Dev Mode MCP + Code Connect** — design-side ground truth (see lever 7).
- **Custom-elements-manifest MCP** (`bennypowers/cem`) — the same pattern for web components.

The catch for brand-ui: the Storybook MCP is **ephemeral** (dev-server-bound) and React-only. A
persistent, always-on ground-truth interface (a thin MCP/CLI over the manifest) is the durable
version.

### 4. Machine-readable component metadata — manifests & type extraction

Two ways agents read "real" props instead of guessing:

- **Type extraction** (`react-docgen-typescript`): exported, **TSDoc-commented** props become
  _automatically_ machine-readable — types are the cheapest manifest; Storybook autodocs renders them.
  Un-exported/undocumented props are invisible.
- **A generated manifest** (Storybook's, or a custom JSON) served over MCP.
- **(the novel bit) hand-authored intent metadata** — a per-component descriptor carrying the things
  types _cannot_ encode: **relationships** ("can't sit next to X"), **state→token mapping**, and
  **anti-patterns** ("two primary buttons side by side", "destructive without a confirm step"). Types
  tell an agent _what's possible_; anti-patterns tell it _what's wrong_.

brand-ui builds a `brand-ui.manifest.json` — but (verified) it's an **index** (name/kind/module),
not a prop/relationship/anti-pattern store; props are pulled on demand by a regex over source. That's
real anti-hallucination, but shallow — the richest, most agent-distinctive layer (relationships +
anti-patterns + resolved prop tables) is the open opportunity.

### 5. Design tokens for agents — DTCG JSON

A typed, named, **described** token graph is a machine-readable theming contract: an agent reads it to
pick the right semantic value instead of hardcoding hex. The strongest guidance is to **name tokens
in intent-English** (`emphasis`, `subtle`) with a one-line `$description` each — which is exactly what
DTCG's `$description` field is for. brand-ui's tokens are semantic CSS variables (good for in-code
reasoning) but **not a DTCG JSON source of truth**, so they don't round-trip to design tools or parse
as the structured format the ecosystem is standardizing on.

### 6. Portable agent-guidance files — AGENTS.md is the lingua franca

**AGENTS.md** (OpenAI, mid-2025; now under the Linux Foundation's Agentic AI Foundation) is the
cross-tool "README for agents" — schema-free Markdown, nested files in monorepos (closest wins),
read by Codex, Cursor, Copilot, Jules, Gemini CLI, and ~60k repos. The behavioral guarantee worth
exploiting: **agents will auto-run the build/test commands you list and fix failures before
finishing.** Best practice is a lean root file + linked detailed rules (brand-ui's `CLAUDE.md` +
`@.claude/rules/*` is exactly this).

> **Correction to a common assumption:** brand-ui **does** ship an `AGENTS.md` (a tool-agnostic
> mirror of CLAUDE.md). So this lever is _present_ — but (verified) it carries a doc inaccuracy of its
> own (it says "four themes" while the system ships six; the false `ci.yml` claim is in `README.md`,
> **not** AGENTS.md — see [`03`](./03-gap-analysis.md)), and it doesn't yet list the agent-runnable
> command contract that makes AGENTS.md self-validating.

### 7. Design-to-code — Figma Code Connect

The design-side equivalent of lever 3's anti-hallucination: instead of guessing a JSX mapping, the
agent gets _your_ component + props from a Code Connect mapping surfaced over the Figma MCP. Relevant
only if a design-driven workflow is in scope; for a code-first/agent-first internal library it's a
lower priority.

### 8. Deterministic scaffolding & guardrails — make bad output impossible

The recurring insight: **agents are non-deterministic; put determinism around them.**

- **Scaffolding CLIs/skills** so "new component" is one command emitting the exact file set (tsx +
  index + stories + test + barrel + tokens) — removing per-file variance.
- **Consistent, predictable APIs as a property** — uniform `forwardRef` + `className`/`cn()` +
  spread `...props` + `cva` + exported types means an agent that learns one component generalizes to
  all. The opposite (boolean-prop explosions, bespoke APIs) forces re-learning each time.
- **Lint/typecheck/test gates the agent runs itself** + **hooks that block bad output** (reject a raw
  hex, block a force-push) — strictly stronger than a _rule_, because they're enforced regardless of
  the model.
- **"Examples as tests."** Stories double as executable specs; a missing example = a missing agent
  capability. "AI uses design systems exactly as documented — gaps in examples, states & constraints
  lead directly to unpredictable UI output" (Storybook).

brand-ui's quality-gates rule, six hooks (including a _completion-claim gate_ and a
_component-boundary/token_ check), `/new-component` scaffolding, and "story + smoke test = done" are
**textbook** implementations of this lever — arguably ahead of most public libraries.

### 9. v0 / Lovable / bolt consumability

These builders are **shadcn + Tailwind native**, so anything Tailwind-v4 + Radix + cva + `cn` +
registry-shaped is already structurally consumable. Custom systems come in via copy-paste, GitHub
integration, or package install; **publishing a shadcn-compatible registry** is the single
highest-leverage way to reach all of them. brand-ui is already shaped right; the only external-facing
adds (public/namespaced registry endpoint, llms.txt) are low priority while it's internal.

### 10. Discoverable docs for agents — llms.txt

`llms.txt` (Jeremy Howard, Sept 2024) is a curated, strictly-ordered Markdown index at the site root
naming the LLM-relevant docs, with `.md` page twins and an `llms-full.txt` expansion; it complements
(doesn't replace) sitemap/robots and is consumed _on demand at inference_. It helps web-doc discovery
but does **not** give the real prop surface — that's manifests/MCP/types. For an internal,
code-distributed library, an llms.txt-style index has value mainly if docs are hosted for
cross-agent/external discovery.

## Agent-legible vs agent-hostile — the checklist

**Legible (do):** single source of truth with multiple views · ground-truth prop access (never make
the agent guess) · consistent predictable APIs · runnable examples that double as tests ·
intent-named _described_ tokens (DTCG) · explicit relationships + anti-patterns in metadata ·
portable guidance (AGENTS.md) + deterministic scaffolding + self-validating gates · source
visibility · errors written for LLMs.

**Hostile (avoid):** opaque `dist/`-only packages · inconsistent/bespoke APIs & boolean-prop
explosions · undocumented/un-exported props · opaque/positional token names with no descriptions ·
"clever" abstractions that block reading/editing · no examples for key states · docs only as
rendered HTML · guidance locked to one agent.

## Two productized patterns worth stealing: context generators & playbooks

Two mechanisms from the field deserve their own treatment because they package the levers above into
something concrete — and **AgnosticUI** ([agnosticui.com](https://www.agnosticui.com/),
[GitHub v2](https://github.com/AgnosticUI/agnosticui)) is the cleanest current example. AgnosticUI v2
rebranded itself "the AI-native UI kit": copy-owned local source (lever 1) + a context generator +
playbooks. It doesn't out-engineer a mature system like brand-ui, but it productizes two ideas brand-ui
hasn't.

### A. The context generator (`ag context`) — ground truth as a generated file, not (only) a server

AgnosticUI ships `ag context`: **one command that emits an agent-context file** carrying exact
component locations, prop types, import paths, and an "Agentic Intent" section — auto-detecting the
target tool (Claude/Cursor/Copilot/Windsurf/Gemini). Its explicit stance is _"No MCP setup"_: a
generated, version-controlled context file is cheaper and more portable than a live MCP server, and it
lands the ground truth directly in the files agents already read.

This reframes lever 3's MCP debate. The two are not either/or; they're sequential:

- **Context file first** — generate the manifest's ground truth into `CLAUDE.md` / `AGENTS.md` /
  `.cursor/rules` / an `llms.txt`. Zero runtime, every harness, works offline, diffable in git. For an
  internal library this is the higher-ROI _first_ move (and it's cheaper than the persistent MCP the
  brand-ui roadmap proposed).
- **MCP second** — a live server for richer, interactive querying (search/docs/tokens/audit) once the
  static file isn't enough.

The deeper point: the context file should be **generated and stale-checked**, never hand-maintained —
which connects directly to the "enforcement over reminders" theme in doc 03 (a generated context file
that drifts is worse than none).

### B. Playbooks — composition _recipes_, not just component references

AgnosticUI's sharpest idea. Beyond per-component docs, it ships **Playbooks** — prompt-ready recipes
for whole patterns (Login, Onboarding Wizard, Dashboard, Data Grid, Support Center, Blog, Landing),
each with a `PROMPT-3-FRAMEWORKS.md` and an **intent schema** that maps a user intent ("build a
dashboard") to the exact component assembly. Their line: _"it has the full recipe, not just a
component reference."_

The insight is real and matches doc 02's whole thesis: **agents rarely fail on the `Button` API — they
fail on the whole-screen composition.** brand-ui already _has_ composition patterns (app shell =
`SidebarProvider`+`Sidebar`+`SidebarInset`; dashboard = `MetricGrid`+`DataTable`; assistant =
`ChatShell`+AI elements), but as **prose inside a skill**, not as packaged, prompt-ready, intent-mapped
playbooks an agent can invoke. Productizing them is one of the highest-leverage agent upgrades available
(doc 03 gap E8; roadmap WP-09).

### C. The frontier (know it, probably don't build it yet): generative / server-driven UI

A second paradigm is emerging that's distinct from "make the agent aware of _your_ library." Here the
agent **emits a UI** rather than writing JSX against components: AgnosticUI's SDUI / `AgNode[]` schema
graph + `llm-prompt-guide.md`, Google's **A2UI**
([A2UI](https://developers.googleblog.com/introducing-a2ui-an-open-project-for-agent-driven-interfaces/)),
**MCP Apps** (tools return rendered UI in the conversation,
[modelcontextprotocol.io, Jan 2026](https://blog.modelcontextprotocol.io/posts/2026-01-26-mcp-apps/)),
and CopilotKit AG-UI. This is a bigger architectural bet (a schema layer + renderers + CI gates) and
is likely _out of scope_ for an internal-tools standard today — but it's the direction the frontier is
moving, and worth tracking. (See also local-first agent-doc tooling like
[neuledge/context](https://github.com/neuledge/context) and Context7 for the "aware-of-library" side.)

**The two paradigms, kept distinct:** (1) **aware-of-library** — the agent builds _with_ your
components correctly (context generators, MCP, manifests, llms.txt, playbooks); this is brand-ui's
lane and where every gap in doc 03 sits. (2) **generative UI** — the agent _emits_ the interface
(SDUI, A2UI, MCP Apps); a future option, not a current gap. **A2UI specifically gets a full deep-dive
and a concrete support concept in [`05-a2ui-concept.md`](./05-a2ui-concept.md) (actioned as WP-11)** —
it turns out brand-ui is unusually well-suited to be an A2UI catalog/renderer because the protocol is
"agents describe _what_, renderers decide _how_ via tokens," which is brand-ui's exact model.

## The one-line takeaway for brand-ui

brand-ui is **ahead of most public libraries** on source-ownership, registry, Storybook-MCP,
skills/commands/subagents/hooks, and deterministic gates (levers 1, 2, 3, 8). It is **behind on the
portable, tool-neutral, structured-data surfaces**: a _persistent_ ground-truth interface (not just
the ephemeral Storybook MCP) — best approached as a **generated context file first, MCP second** — a
**richer manifest** (resolved props + relationships + anti-patterns), **DTCG token export**, an
**AGENTS.md that lists a real, runnable command contract**, and **packaged playbooks** instead of
prose composition patterns. And — the theme that ties them together (doc 03) — all of this only holds
if it is **generated and enforced by gates/hooks, never left as a manual reminder**. Those are where
doc 03 concentrates the agent-friendliness gaps.

---

_Sources: see
[`_research/ai-agentic-friendliness-notes.md`](./_research/ai-agentic-friendliness-notes.md) for the
full inline-cited research (shadcn registry/MCP/CLI 3.0, llms.txt, Storybook addon-mcp & manifests,
react-docgen, Custom Elements Manifest, DTCG, agents.md, Anthropic Agent Skills, Figma Code Connect,
v0/Lovable/bolt)._
