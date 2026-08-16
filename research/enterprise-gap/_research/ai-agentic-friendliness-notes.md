# AI / Agentic Friendliness for a React Component Library — Research Notes

> Raw research for the enterprise-gap synthesis. Topic-by-topic deep notes on what makes a
> React component library legible to AI coding agents ("vibe coding": Claude Code, Cursor, v0,
> Lovable, bolt.new, Copilot). Goal: agents can **discover**, **understand**, and **correctly
> use/extend** the library with minimal hallucination. Every non-obvious claim is sourced; URLs
> are inline and collected at the end. Currency target: 2025–2026.

**Date compiled:** 2026-06-06. **Status of sources:** primary/canonical docs preferred (shadcn,
Storybook, Anthropic, Figma, llmstxt.org, agents.md, W3C DTCG). A few practitioner blogs are
cited and flagged as opinion, not standard.

**Uncertainty flags up front (do not over-state these in synthesis):**

- The "~10x throughput" and "feature work in an afternoon" figures come from a single agency
  marketing blog (designproject.io) with no published methodology — treat as anecdote, not data.
- Storybook's MCP/AI features are explicitly **experimental/preview** and **React-only** as of
  Storybook 10.4; APIs may change.
- `.cursorrules` (single legacy file) is deprecated by Cursor in favor of `.cursor/rules/*.mdc`;
  exact deprecation timing not re-verified here — flagged in §6.
- Date stamps on a couple of secondary blogs (e.g. a Dec 2025 Codrops piece, a May 2026
  designproject.io piece) are as displayed by the publisher; not independently audited.

---

## 0. The core thesis (why this matters)

AI agents do not consume a component library the way a human does. A human opens Storybook,
brings product context, and applies judgment. An agent "brings none of that. It pattern-matches
on whatever's most visible — usually whatever it saw most often during training — and ships
that," which is how codebases accumulate components that "look right but quietly drift from your
system" (new variants, rounded spacing, reinvented disabled states)
([designproject.io, Agentic design system](https://designproject.io/blog/agentic-design-system/)).

The fix is to remove the judgment step: make every "use this / don't use this" **explicit and
machine-readable**, and give agents **ground-truth** access to the real prop surface, real
examples, and real tokens. Two recurring framings in the 2025–2026 literature:

- **Anti-hallucination via ground truth.** The single most-repeated instruction across the
  ecosystem is some variant of: _never invent a prop; verify it against the real
  type/manifest/docs first._ Storybook's own recommended `AGENTS.md` snippet says, verbatim:
  "**CRITICAL: Never hallucinate component properties!** Before using ANY property on a
  component from a design system (including common-sounding ones like `shadow`, etc.), you MUST
  use the MCP tools to check if the property is actually documented for that component"
  ([Storybook MCP overview](https://storybook.js.org/docs/ai/mcp/overview)).
- **Design system as a "productivity coefficient."** Figma: "Paired with MCP servers, design
  systems become a productivity coefficient for AI-powered workflows, ensuring that AI agents
  produce output that's relevant and on brand," creating a flywheel where "AI strengthens your
  design system, which powers better AI code generation"
  ([Figma, Design Systems and AI](https://www.figma.com/blog/design-systems-ai-mcp/)). Figma's
  2025 AI report: 68% of developers use AI to write code, but only 32% trust the output —
  "because context is everything" (same source).

The mechanisms below are the concrete ways to supply that context.

---

## 1. shadcn/ui registry + MCP — copy-owned source as the agent-native distribution model

### 1.1 Why "copy-owned" source suits agents

shadcn's defining choice is **distribution of source, not a package**: components are installed
_into_ the consumer's repo as editable code rather than imported from `node_modules`. The
ecosystem consensus (and shadcn's own positioning) is that this is _AI-native_: "open code for
LLMs to read, understand, and improve"; "by owning the actual source code rather than relying on
black-box npm packages, LLM agents can better understand and work with your codebase"; "a
shared, composable interface … is predictable for both your team and LLMs"
([RedMonk, Revenge of Copypasta](https://redmonk.com/kholterhoff/2025/04/22/ui-component-libraries-shadcn-ui-and-the-revenge-of-copypasta/);
[shadcn.io](https://www.shadcn.io/); search-aggregated shadcn positioning). Practical
implication for an _imported-package_ library (like brand-ui's `@qlik-coe-emea/qlabs-components-*`): agents can't see
into `dist/`, so the library must export **TypeScript source** and/or ship machine-readable
metadata (manifests, llms.txt, MCP) to make up the visibility gap a copy-paste lib gets for free.

### 1.2 The registry: `registry.json` + `registry-item.json`

The registry is a JSON contract the shadcn CLI resolves. Two schemas
([registry.json](https://ui.shadcn.com/docs/registry/registry-json);
[registry-item.json](https://ui.shadcn.com/docs/registry/registry-item-json)):

- **`registry.json`** — top-level: `name`, `homepage`, and an `items[]` array of registry items.
  A large registry can be split across files via `include`. There is a published JSON Schema
  (`https://ui.shadcn.com/schema/registry.json`).
- **`registry-item.json`** — per item. Key fields:
  - `$schema`, `name` (unique id), `title` (short human label), `description` (longer).
  - `type` — one of: `registry:base` (entire design system), `registry:block` (multi-file
    feature), `registry:component` (simple component), `registry:ui` (single-file primitive,
    imports `@/lib/utils`), `registry:lib`, `registry:hook`, `registry:page` (file-based route,
    requires `target`), `registry:file` (misc, requires `target`), `registry:font`,
    `registry:style` (e.g. "new-york"), `registry:theme`, `registry:item` (universal).
  - `dependencies` (npm, `name@version` supported), `devDependencies`.
  - `registryDependencies` — other registry items. Three forms: bare name for default shadcn
    items (`"button"`), **namespaced** (`"@acme/input-form"`), or **URL**
    (`"https://example.com/r/editor.json"`). The CLI auto-resolves remote deps.
  - `files[]` — each has `path` (relative to repo root, **must exist on disk**), `type`, and
    optional `target`. `target` supports placeholders resolved against the consumer's
    `components.json` aliases: `@components/`, `@ui/`, `@lib/`, `@hooks/` (e.g.
    `@ui/ai/prompt-input.tsx` installs under the user's configured `ui` dir at
    `ai/prompt-input.tsx`). `@utils/` is unsupported (utils is a file, not a dir).
  - Theming: `cssVars` (`theme` / `light` / `dark` blocks) — preferred for Tailwind v4; the old
    `tailwind.config` field is **deprecated**. Also `css` (raw rules: `@layer`, `@utility`,
    `@keyframes`, `@plugin`), `envVars` (writes `.env.local`, dev-only), `font` (for
    `registry:font`), `docs` (CLI message on install), `categories`, and `meta` (arbitrary
    key/value — **a hook for custom agent metadata**).

Agent relevance: this schema is itself a **machine-readable manifest** of what a block is, what
it depends on, where its files go, and what tokens it needs — exactly the structured data an
agent needs to install correctly. The `meta` field is an extension point for agent-specific
hints.

### 1.3 CLI 3.0 (August 2025): namespaced registries, private/auth, discovery, better LLM errors

shadcn CLI 3.0 (Aug 2025) rewrote the registry engine
([changelog 2025-08](https://ui.shadcn.com/docs/changelog/2025-08-cli-3-mcp)):

- **Namespaced registries** — install via `@registry/name`. Configured in `components.json`
  under `registries`, e.g. `{"@acme":"https://acme.com/r/{name}.json"}`. Decentralized (no
  central registrar); teams can carve namespaces by function (`@design`, `@engineering`,
  `@marketing`). A single item can depend across namespaces (`@shadcn/card`, `@v0/chart`,
  `@acme/data-table`, `@lib/data-fetcher`, `@ai/analytics-prompt`) and the CLI resolves each
  from its source.
- **Private registries / auth** — per-registry `headers` with env interpolation
  (`"Authorization":"Bearer ${REGISTRY_TOKEN}"`); supports basic auth, bearer, API-key query
  params, custom headers. This is the enterprise distribution path for a proprietary lib.
- **Search & discovery commands** — `shadcn view @ns/item` (preview code + deps before install),
  `shadcn search @ns -q "dark"`, `shadcn list @ns`. These map directly onto the MCP browse/search
  tools.
- **Improved error handling "for users and LLMs"** — the CLI emits actionable errors (unknown
  registry, missing env vars) and registry authors can return **custom error messages** "to help
  users and AI agents understand and fix issues quickly." Designing errors for agents is itself
  an agent-friendliness property.

### 1.4 The shadcn MCP server (first cut April 2025; rebuilt Aug 2025)

([MCP Server docs](https://ui.shadcn.com/docs/mcp); changelog above). The MCP server "acts as a
bridge between your AI assistant, component registries and the shadcn CLI." Capabilities exposed
to the agent: **Browse** (list components/blocks/templates across any configured registry),
**Search** (by name/functionality across multiple sources), **Install via natural language**
("add a login form"), **multi-registry** (public + private + namespaced). Flow: Registry
Connection → Natural Language → AI Processing → Component Delivery. Works with **any
shadcn-compatible registry, zero config** for the default shadcn registry.

- Setup: `npx shadcn@latest mcp init` (or per-client). For **Claude Code** add to `.mcp.json`:
  `{"mcpServers":{"shadcn":{"command":"npx","args":["shadcn@latest","mcp"]}}}`, then `/mcp` to
  verify "Connected." Cursor (`.cursor/mcp.json`), VS Code/Copilot (`.vscode/mcp.json`,
  `"servers"` key), Codex (`~/.codex/config.toml`) all documented.
- The key shift the docs emphasize: from CLI-as-you-know-the-commands to **agentic** — "You
  direct an AI assistant with high-level, natural language goals, and the assistant
  intelligently uses the CLI on your behalf" (LogRocket / shadcn.io framing). ~7 tools surfaced
  after install.

### 1.5 Supporting machinery worth noting

shadcn also ships an **`llms.txt`** (`https://ui.shadcn.com/llms.txt`), a **Skills** doc section,
a **Figma** integration page, and a **registry MCP** sub-page — i.e. shadcn deliberately spans
_all_ the agent-context surfaces in this report at once (registry + MCP + llms.txt + skills).
This is the reference template for "agent-native distribution."

---

## 2. llms.txt and llms-full.txt — curated, machine-readable docs index

### 2.1 What it is / origin

Proposed **September 3, 2024 by Jeremy Howard (co-founder, Answer.AI)**
([Answer.AI post](https://www.answer.ai/posts/2024-09-03-llmstxt.html);
[llmstxt.org](https://llmstxt.org/)). A **Markdown** file at the site root (`/llms.txt`) that
"outlines the information that a model may want to retrieve (with links) when assembling context
for LLM prompts relevant to a website." Problem solved: context windows are too small to ingest
whole sites, and HTML→clean-text conversion (nav, ads, JS) is "difficult and imprecise." Site
authors know best, so they curate the LLM-relevant context.

### 2.2 Strict format (it is parseable, not freeform)

Sections in a **required order** ([llmstxt.org](https://llmstxt.org/)):

1. **H1** with the project/site name — _the only required section_.
2. A **blockquote** with a short summary of key info.
3. Zero+ Markdown sections (paragraphs/lists, **no headings**) with details / how to interpret.
4. Zero+ **H2-delimited "file lists"** — each a Markdown list of `[name](url): optional notes`.
5. A special **`## Optional`** H2 — links there "can be skipped if a shorter context is needed"
   (secondary info). This gives tooling a built-in way to trim context.

It deliberately uses Markdown (not XML) because the files are read by LLMs/agents, while still
being regex/parser-friendly.

### 2.3 The companion conventions

- **Clean `.md` versions of pages** at the same URL + `.md` suffix (URLs without a filename →
  `index.html.md`). e.g. a docs HTML page and its `…html.md` twin. nbdev now generates `.md`
  versions by default.
- **Expanded context files** — tooling can inline the linked content into single files. FastHTML
  publishes `llms-ctx.txt` (without Optional URLs) and `llms-ctx-full.txt` (with them), built by
  the `llms_txt2ctx` CLI. The widely-seen **`llms-full.txt`** convention (e.g. Mintlify) is the
  "single comprehensive file for feeding entire documentation into AI coding assistants"
  ([Mintlify](https://www.mintlify.com/blog/simplifying-docs-with-llms-txt)).

### 2.4 llms.txt vs sitemap.xml vs robots.txt

([llmstxt.org, "Existing standards"](https://llmstxt.org/)) — same root-path convention as
`/robots.txt` and `/sitemap.xml`, but distinct purpose:

- vs **robots.txt**: robots controls _access_ for crawlers; llms.txt provides _curated context_,
  used **on demand at inference** (when a user pulls a lib's docs into a project), not primarily
  for training.
- vs **sitemap.xml**: sitemap lists _all_ indexable human pages — no LLM-readable versions, no
  external links, and in aggregate too large for a context window with lots of irrelevant noise.
  llms.txt is a _curated_ subset + external links.

### 2.5 Adoption / tooling

Vercel and Stripe cited as early adopters; Mintlify auto-generates `/llms.txt` + `/llms-full.txt`
for hosted docs (SearchEngineLand; Mintlify). Tooling: `llms_txt2ctx` (CLI + Python), a JS
implementation, `vitepress-plugin-llms`, `docusaurus-plugin-llms`, Drupal recipe, `llms-txt-php`.
Directories exist (llmstxt.site, directory.llmstxt.cloud). For a **component library**, the
pattern is: an llms.txt that names the packages, links each component's `.md` doc + a usage
example + the token reference, with secondary material under `## Optional`. shadcn ships one
(`ui.shadcn.com/llms.txt`).

> **Caveat to surface:** llms.txt is a _proposal/community spec_, not a ratified web standard;
> support is "use it if your tool/agent fetches it." It helps web-doc discovery but does **not**
> give an agent the _real prop surface from your code_ — that's what manifests/MCP/types do (§3,§4).

---

## 3. MCP for component libraries & docs — ground-truth props/examples (anti-hallucination)

MCP (Model Context Protocol, modelcontextprotocol.io) is the open protocol letting agents call
external tools/data. Four MCP surfaces matter for a component library:

### 3.1 Storybook `@storybook/addon-mcp` — MCP server _inside_ the Storybook dev server

([Storybook MCP overview](https://storybook.js.org/docs/ai/mcp/overview);
[storybookjs/mcp](https://github.com/storybookjs/mcp);
[blog](https://storybook.js.org/blog/storybook-mcp-for-react/)). **Experimental / preview,
React-only** (docs toolset depends on React **manifests**; Vue/Angular/WC/Svelte planned).

- **Install:** `npx storybook add @storybook/addon-mcp`. With the dev server running, the MCP
  endpoint is at `http://localhost:6006/mcp` (a browser page lists available tools + a manifest
  debugger). Wire to an agent via `npx mcp-add --type http --url http://localhost:6006/mcp
--scope project` (or per-agent config).
- **Three toolsets:**
  - **Docs** (anti-hallucination): `list-all-documentation` (index of components + unattached
    docs), `get-documentation` (a component's **props + first 3 stories + index of the rest +
    extra docs**), `get-documentation-for-story` (full code for one story when the summary isn't
    enough).
  - **Development:** `get-storybook-story-instructions` (framework-correct patterns for writing
    stories/interaction tests — call _before_ authoring), `preview-stories` (renders previews in
    the agent chat via MCP Apps, else returns Storybook links).
  - **Testing:** `run-story-tests` (runs stories as **real-browser interaction tests + axe a11y**,
    returns a markdown report; instructs the agent to interpret + fix). This enables a
    **self-healing loop**: generate → test → fix a11y/interaction failures → re-run until green.
- **Value prop (quoted):** by "exposing component metadata, stories, prop types, usage examples,
  and documentation in an optimized, token-efficient format," agents "build UI that aligns with
  your team's design system instead of generating generic or inconsistent code"
  ([blog/codrops summaries](https://tympanus.net/codrops/2025/12/09/supercharge-your-design-system-with-llms-and-storybook-mcp/)).
- **Composition:** multiple Storybooks can be composed; if composed Storybooks ship manifests,
  the MCP server merges their content so the agent sees the combined catalog.
- **The recommended `AGENTS.md` rule** (verbatim, see §0) is the canonical "never hallucinate a
  prop; query `list-all-documentation` → `get-documentation`; only use documented props; verify
  via docs/example stories; story name ≠ prop name" instruction. **This is brand-ui's
  storybook-mcp rule, validated against the source.**

### 3.2 Storybook **manifests** (the data layer under the MCP)

([Storybook AI / manifests](https://storybook.js.org/docs/ai/manifests)) — Storybook generates
machine-readable manifests (React-only in preview) describing components, props, and stories;
the MCP docs toolset answers from these. So Storybook is doing react-docgen-style extraction (§4)
and serving it over MCP. (Manifests can also be shared/published for composition.)

### 3.3 Context7 (upstash) — up-to-date, version-specific library docs over MCP

([upstash/context7](https://github.com/upstash/context7);
[trevorlasn writeup](https://www.trevorlasn.com/blog/context7-mcp)). Injects current,
version-pinned docs + code examples into the context window so the model isn't guessing from
training data. Two tools: `resolve-library-id` (name → Context7 id like `/vercel/next.js/v15.0.0`,
ranked by trust score + doc coverage) and `get-library-docs` (id + optional topic → doc chunks +
examples, token-limited, default ~5000). Trigger by adding `use context7` to a prompt. Hosted
endpoint `https://mcp.context7.com/mcp` (API key via `CONTEXT7_API_KEY`) or local via npx.
**Relevance:** a public library can be _indexed by Context7_ so any agent gets current docs; an
internal lib can run the same pattern privately. Positioned explicitly as "stop LLM
hallucinations with live docs."

### 3.4 Figma Dev Mode MCP server + Code Connect (design→code ground truth) — see §9.

### 3.5 Custom-elements / web-component MCP (`bennypowers/cem`)

For web components, `bennypowers/cem` is "the standards-based toolkit for Web Components:
Generate Custom Elements Manifests, Dev Server, LSP, **and MCP** for your app or design system"
([github](https://github.com/bennypowers/cem)). Confirms the pattern generalizes beyond React:
generate a manifest (§4) and serve it over MCP so agents query real component metadata.

> **Pattern across all four:** the MCP server is the _transport_; the real anti-hallucination win
> is that it returns **the actual prop surface + real example code + (Storybook) real test
> results**, not prose. brand-ui already runs a Storybook MCP — this is the strongest single
> agent-friendliness asset it has, _but_ it only exists while `pnpm storybook` is running.

---

## 4. Machine-readable component metadata — manifests & type extraction

Two ways agents read "real" prop surfaces instead of guessing: extract from types, or ship a
manifest.

### 4.1 react-docgen / react-docgen-typescript (extraction)

([Storybook TS docgen](https://storybook.js.org/docs/configure/integration/typescript);
[autodocs](https://storybook.js.org/docs/writing-docs/autodocs/)). `react-docgen-typescript`
analyzes a component's TS prop interfaces/types and extracts **prop names, types, descriptions
(from TSDoc/JSDoc), and default values**. Storybook consumes this to auto-fill **`argTypes`**
(name, description, control, defaultValue) and to render **Autodocs** prop tables. Config lives
in `.storybook/main.ts` under `typescript.reactDocgen` (`'react-docgen-typescript'` for richer
type resolution vs the faster `'react-docgen'`), with `reactDocgenTypescriptOptions` for compiler
opts + `propFilter`. Output objects: `docgenInfo` (raw) and a processed `propDef` (≈
`StrictArgDefs`). **Implication:** exported, well-typed props with TSDoc comments become
_automatically_ machine-readable — types are the cheapest manifest. Undocumented/un-exported
props are invisible to this path.

### 4.2 Custom Elements Manifest (CEM) — the web-components standard

([custom-elements-manifest.open-wc.org](https://custom-elements-manifest.open-wc.org/);
[intro blog](https://custom-elements-manifest.open-wc.org/blog/intro/);
[Dave Rupert, "killer feature"](https://daverupert.com/2025/10/custom-elements-manifest-killer-feature/)).
A standardized **`custom-elements.json`** describing each element's properties, methods,
attributes, inheritance, **slots, CSS shadow parts, CSS custom properties**, and module exports.
Generated by `@custom-elements-manifest/analyzer` (plugin system to add arbitrary metadata) or
`bennypowers/cem`. Powers IDE autocomplete/red-squiggles, framework-wrapper generation, README +
component docs, and Storybook story generation. "You should be shipping a manifest with your web
components" ([dev.to](https://dev.to/stuffbreaker/you-should-be-shipping-a-manifest-with-your-web-components-2da0)).
React has **no single equivalent standard** — the de facto stand-ins are exported TS types +
react-docgen output + Storybook manifests; some teams hand-roll a JSON descriptor.

### 4.3 Hand-authored component metadata (the "agentic component" file)

The practitioner pattern (designproject.io; "AI Component Metadata" Claude skill by
Chris/Cris Achiardi): co-locate a **`*.meta.json`** per component with explicit fields agents
can't infer ([designproject.io](https://designproject.io/blog/agentic-design-system/);
[ai-component-metadata skill](https://github.com/cris-achiardi/claude-skills/tree/main/skills/ai-component-metadata)).
Example fields for a Button: `category` (atom), `purpose` (one-line intent),
`variants` (each with a reason), `props`, `relationships` (parent contexts; what it can't sit
next to), `tokens` (which token each state maps to), `commonPatterns`, and crucially
**`antiPatterns`** ("two primary buttons side by side", "buttons used for navigation",
"destructive variant without a confirm step"). The "three pillars" they name: **Props,
Relationships, Tokens**; plus four captured decisions: state↔token mapping, variants,
accessibility, **purpose & anti-patterns**. _Treat this blog as opinion/marketing_, but the
**anti-pattern + relationship metadata** idea is the genuinely novel bit vs types/manifests
(types tell you _what's possible_, not _what's wrong_).

> **Net:** for a React lib, the realistic metadata stack is (a) exported, TSDoc-commented,
> `cva`-typed props (auto-extracted), (b) a generated manifest (Storybook's, or a custom JSON),
> served over MCP, and optionally (c) per-component intent/anti-pattern metadata for the stuff
> types can't encode. brand-ui already builds a `brand-ui.manifest.json` via `pnpm manifest` —
> that's exactly this layer; the question for synthesis is whether it carries
> relationships/anti-patterns or just structure.

---

## 5. Design tokens for agents — DTCG / W3C JSON + Style Dictionary

### 5.1 DTCG format, now stable (2025.10)

([W3C DTCG](https://www.w3.org/community/design-tokens/);
[Design Tokens Format Module 2025.10](https://www.designtokens.org/tr/drafts/format/);
[Style Dictionary DTCG](https://styledictionary.com/info/dtcg/)). The Design Tokens Community
Group published the **first stable version of the spec (2025.10) on October 28, 2025** — a
"production-ready, vendor-neutral format for sharing design decisions across tools and
platforms." JSON interchange; recommended media type `application/design-tokens+json`; file
extensions `.tokens` / `.tokens.json`. Token props are **`$`-prefixed**: `$value`, `$type`,
`$description` (legacy format used `value`/`type`/`comment`). 2025.10 made some values
**structured objects** — dimension/duration are `{ "value": 16, "unit": "px" }`; color carries
`colorSpace`, a `components` array, `alpha`, and a hex fallback.

### 5.2 Style Dictionary

([styledictionary.com](https://styledictionary.com/info/tokens/)). Build tool that transforms a
token source of truth into platform outputs (CSS vars, JS, iOS/Android, etc.). **v4+ has
first-class DTCG support** (you can use DTCG or legacy, but not mixed in one instance); v5 is
current (zeroheight migration note). Tokens Studio (Figma) reads/writes DTCG.

### 5.3 Why structured tokens help agents

- A typed, named token graph is a **machine-readable theming contract**: an agent can read it to
  pick the right semantic value rather than hardcoding hex. Figma's MCP work explicitly has
  agents "apply design tokens automatically" and even "suggest where to use design tokens" and
  audit token usage in code vs design ([Figma DS+AI](https://www.figma.com/blog/design-systems-ai-mcp/)).
- **Name tokens in intent-English, not implementation.** The strongest practitioner guidance:
  good tokens are "written in English the agent can reason about — `emphasis`, `default`,
  `subtle`, `core-grey-200` — not arbitrary names like `color-1` or `brandBlue`"; bad/positional
  names (`primary/secondary/tertiary`, `blue-1/2/3`) "tell the agent nothing about _when_ to use
  which," and **every token should carry a one-line description**
  ([designproject.io](https://designproject.io/blog/agentic-design-system/)). This mirrors
  DTCG's `$description`. (Opinion source, but consistent with Figma's official "variables should
  describe intent" line and DTCG's description field.)

> **Relevance:** brand-ui's tokens live as CSS variables in `themes.css` + `@theme inline`.
> They're semantic (good), but they are **not currently a DTCG JSON source of truth** — for
> agents (and design-tool round-tripping) a DTCG export would make the theming contract directly
> parseable. Flag for synthesis: CSS-vars-only is human/agent-readable in code but not the
> tool-interoperable structured format the rest of the ecosystem is standardizing on.

---

## 6. Agent-guidance files in repos — AGENTS.md, CLAUDE.md, Cursor rules

### 6.1 AGENTS.md — the cross-tool standard

([agents.md](https://agents.md/); [InfoQ](https://www.infoq.com/news/2025/08/agents-md/)).
Introduced by **OpenAI mid-2025** (emerged from OpenAI Codex, Amp, Jules/Google, Cursor,
Factory). "A simple, open format for guiding coding agents … think of it as a **README for
agents**." Deliberately **schema-free**: "just standard Markdown … any headings you like; the
agent simply parses the text." Lives at repo root; **monorepos use nested AGENTS.md** and the
**closest file to the edited file wins** (OpenAI's own monorepo had 88 of them; explicit user
chat prompts override everything).

- **What good ones contain** (agents.md "Cover what matters"): project overview; **build & test
  commands**; **code style**; **testing instructions**; security considerations; PR/commit
  guidelines; dev-environment tips; "anything you'd tell a new teammate." The site's example
  shows exact `pnpm` commands, Vitest patterns, lint commands, PR title format, and notably
  "**Add or update tests for the code you change, even if nobody asked**."
- **Behavioral guarantees to lean on:** "Will the agent run testing commands found in AGENTS.md
  automatically? **Yes — if you list them.** The agent will attempt to execute relevant
  programmatic checks and fix failures before finishing the task." (agents.md FAQ.) → listing
  `typecheck/lint/test` makes the agent self-validate.
- **Adoption / governance:** "used by over **60k open-source projects**"; compatible with a long
  list of agents (Codex, Jules, Factory, Aider, goose, opencode, Zed, Warp, VS Code, Devin,
  Junie, Amp, Cursor, RooCode, Gemini CLI, Copilot coding agent, Windsurf, Augment, …). Now
  **stewarded by the Agentic AI Foundation under the Linux Foundation** (launched Dec 2025;
  founding members include Anthropic, OpenAI, Block) ([agents.md](https://agents.md/);
  [OpenAI AAIF](https://openai.com/index/agentic-ai-foundation/)).

### 6.2 CLAUDE.md (Claude Code) and the rule-import pattern

Claude Code reads **`CLAUDE.md`** as project memory; Storybook's own setup doc tells you to put
agent instructions in "`AGENTS.md` (or `CLAUDE.md`, if you're using Claude)"
([Storybook MCP overview](https://storybook.js.org/docs/ai/mcp/overview)). Claude Code supports
**`@import` of other files** into CLAUDE.md (code.claude.com memory docs) — which is exactly
brand-ui's structure (lean `CLAUDE.md` + `@.claude/rules/*.md`). Best-practice consensus across
the ecosystem: keep the root file lean and link detailed rules; co-locate nested files near the
code they govern.

### 6.3 Cursor rules / `.cursorrules` (legacy) → `.cursor/rules/*.mdc`

Cursor historically used a single root **`.cursorrules`**; current Cursor uses **`.cursor/rules/`
`.mdc` files** (project-scoped, with frontmatter for globs/always-apply). `.cursorrules` is
widely described as **deprecated/legacy** in favor of the rules dir. _(Exact deprecation date not
re-verified in this pass — flag.)_ Many teams now symlink/duplicate or just author **AGENTS.md**
since Cursor reads it too (agents.md lists Cursor as compatible).

### 6.4 Convergence

The clear 2025–2026 direction: **AGENTS.md as the portable lingua franca**, with tool-specific
files (CLAUDE.md, `.cursor/rules`) either importing from or coexisting with it. Migration tip
from agents.md: `mv AGENT.md AGENTS.md && ln -s AGENTS.md AGENT.md` (symlink for back-compat).

> **Relevance:** brand-ui has a strong `CLAUDE.md` + imported rules but (per the provided context)
> **no `AGENTS.md`** — so non-Claude agents (Cursor/Copilot/Codex) don't get the guidance. That's
> a concrete, cheap gap: ship an AGENTS.md (or symlink) carrying the same conventions.

---

## 7. Skills & slash commands — shipping deterministic agent tooling with the library

### 7.1 Anthropic Agent Skills (SKILL.md)

([Anthropic engineering, "Equipping agents…"](https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills),
Oct 16 2025; [Claude Code skills docs](https://code.claude.com/docs/en/skills)). A **skill = a
directory with a `SKILL.md`** whose YAML frontmatter requires `name` + `description` (optional:
`disable-model-invocation`, `allowed-tools`, …). Core design principle: **progressive
disclosure** —

1. At startup the agent preloads only every skill's `name` + `description` into the system prompt
   (cheap; lets it decide _when_ to use a skill).
2. If relevant, it reads the full `SKILL.md` body.
3. `SKILL.md` can reference **additional bundled files** (e.g. `reference.md`, `forms.md`) read
   only as needed — so bundled context is "effectively unbounded" without bloating the window.
   Skills can also **bundle executable code** the agent runs as a tool (deterministic, repeatable —
   the article's example runs a Python script to extract PDF form fields without loading it into
   context). "Building a skill … is like putting together an onboarding guide for a new hire."
   Authoring guidance: start from eval (find capability gaps on real tasks), structure for scale
   (split big SKILL.md; code as tool _and_ doc), iterate with Claude (ask it to capture successful
   approaches / self-reflect on failures). Security: install only from trusted sources; audit
   bundled code/instructions. Supported across Claude.ai, Claude Code, Agent SDK, and the Developer
   Platform; **published as an open standard ("Agent Skills", agentskills.io) Dec 18 2025**.

### 7.2 Slash commands, subagents, hooks (Claude Code building blocks)

([code.claude.com docs](https://code.claude.com/docs/en/skills); ecosystem explainers).

- **Slash commands ↔ skills:** custom slash commands have been **merged into skills**; both give
  `/command-name`, and if a skill and command share a name the **skill wins**. Skills are
  **auto-invoked** by description-matching unless `disable-model-invocation: true`.
- **Subagents:** isolated, expert task delegation; skills can be wired into custom subagents.
- **Hooks:** "tie deterministic code to specific moments in time" — _always_ run X at exactly
  this point (e.g. before write / after edit). This is the deterministic-guardrail mechanism
  (see §8).
- **Plugins:** add `.claude-plugin/plugin.json` to bundle skills + agents + hooks + MCP servers
  into one shareable package (marketplace-distributable).

### 7.3 shadcn "Skills"

shadcn ships its own **Skills** docs section (`ui.shadcn.com/docs/skills`) alongside the CLI/MCP —
i.e. a library can distribute skills so agents scaffold/use it deterministically. Combined with
the registry MCP, that's "skill teaches the workflow + MCP fetches the real components."

> **Relevance:** brand-ui already ships skills (`skills/brand-ui`, `skills/brand-ui-component`),
> slash commands (`/new-component`, `/review-component`, `/file-issue`, `/session-retro`, …),
> subagents (finders, `root-cause-analyst`, `component-builder`, `session-reviewer`), and hooks
> (boundary/raw-color, check-package-registered, force-push block). This is a **mature instance**
> of exactly the §7/§8 pattern — arguably ahead of most public libraries. Synthesis should note
> what's _missing_ (e.g. portability of these to non-Claude agents) rather than that it's absent.

---

## 8. Deterministic scaffolding & guardrails — make bad output impossible, not just discouraged

The recurring insight: **agents are non-deterministic; put determinism around them.** Mechanisms
the literature/tooling converge on:

- **Codegen/scaffolding CLIs & skills** so a "new component" is one command that emits the _exact_
  file set (tsx, index, stories, test) with tokens + barrel export wired — removing per-file
  variance. designproject.io's whole arc is "turn the process into a Claude skill … building a
  new component is a single command … the skill handles the schema, file structure, … metadata
  template." shadcn's CLI/registry is the install-side analog.
- **Consistent, predictable component APIs as an agent-friendliness _property_.** "A shared,
  composable interface … is predictable for both your team and LLMs"
  ([shadcn positioning, RedMonk](https://redmonk.com/kholterhoff/2025/04/22/ui-component-libraries-shadcn-ui-and-the-revenge-of-copypasta/)).
  Consistency (every component: `forwardRef` + `className` via `cn()` + spread `...props` +
  `cva` variants + exported types) means an agent that learns one component generalizes to all —
  the opposite is "boolean prop explosions" and bespoke APIs it must re-learn each time.
- **Lint / format / typecheck gates** as the automatic validation the agent _runs itself_. Both
  AGENTS.md (agents.md FAQ: it "will attempt to execute relevant programmatic checks and fix
  failures before finishing") and Storybook MCP (`run-story-tests` self-healing loop) bake this
  in. Examples in the agents.md sample: "Run `pnpm lint` and `pnpm test` before committing,"
  "Fix any test or type errors until the whole suite is green."
- **Hooks that block bad output** (deterministic, can't be argued with by the model). Claude Code
  hooks run code at fixed lifecycle points — e.g. reject a write that introduces a raw hex color,
  or block a force-push. This is strictly stronger than a _rule_ ("please don't"), because it's
  enforced regardless of the model's behavior.
- **"Examples as tests."** Stories double as executable specs: the Storybook MCP runs stories as
  interaction + a11y tests, so an example that renders/behaves correctly _is_ the regression
  guard. Brad Frost / Storybook framing: agent-readiness = **coverage** (machine-readable
  patterns via normalized examples + composition rules) **+ validation** (tests + human review),
  in a self-updating loop ([Brad Frost, Storybook MCP](https://bradfrost.com/blog/post/storybook-mcp-with-dominic-nguyen/);
  search summary). Storybook's own line: "AI is beginning to use design systems **exactly as
  documented**. Gaps in examples, states & constraints lead directly to unpredictable UI output"
  ([Storybook on X](https://x.com/storybookjs/status/1996694824330686861)). → Missing example =
  missing capability.

> **Relevance:** brand-ui's quality-gates rule, hooks, and "story + smoke test as part of done"
> are textbook §8. The honest-completion rule ("only call it validated if its primary path was
> executed") is itself a guardrail against the classic agent failure mode of claiming green
> without running. Strong fit; synthesis can cite this section as "already implemented."

---

## 9. Design-to-code for agents — Figma MCP / Code Connect; v0 / Lovable / bolt.new

### 9.1 Figma Dev Mode MCP server

([Figma blog, "Introducing our Dev Mode MCP server"](https://www.figma.com/blog/introducing-figma-mcp-server/);
[Guide](https://help.figma.com/hc/en-us/articles/32132100833559-Guide-to-the-Figma-MCP-server)).
Brings Figma context into agentic IDEs (Copilot/VS Code, Cursor, Windsurf, Claude Code). When a
frame is inspected, the server sends **components, styles, variables, variable code syntax**, and
(if set up) **Code Connect** mappings to the agent. Without Code Connect it still provides
styling context so the agent writes "design-informed code from scratch." Newer features:
**automated design-system rule generation** — "scan your codebase and output a structured rules
file — outlining token definitions, component libraries, style hierarchies, and naming
conventions" that acts as a system-level guide; plus **annotations** (accessibility/interaction/
content context that flows into codegen) ([Figma DS+AI](https://www.figma.com/blog/design-systems-ai-mcp/)).

### 9.2 Code Connect — linking Figma components to real code

([Code Connect](https://help.figma.com/hc/en-us/articles/23920389749655-Code-Connect);
[developers docs](https://developers.figma.com/docs/figma-mcp-server/code-connect-integration/)).
Maps design components to their **codebase implementations**, via **UI** (in-Figma, language-
agnostic, quick) or **CLI** (in-repo). Both feed the **same MCP infrastructure**, so "the Figma
MCP server enhances its output by including real implementation details from your codebase,
helping AI agents generate code that's consistent with your actual component library." Code
Connect UI now surfaces example code previews from your connected source files. **This is the
design-side equivalent of §3's anti-hallucination:** instead of the agent guessing a JSX
mapping, it gets _your_ component + props.

### 9.3 v0 / Lovable / bolt.new / Replit consumption

([Design Systems ♡ Lovable/Bolt/v0/Replit](https://www.designsystemscollective.com/design-systems-lovable-bolt-v0-and-replit-50a0a197bc35);
[Lovable vs Bolt vs v0](https://techsy.io/en/blog/lovable-vs-bolt-vs-v0); shadcn.io). Key facts:

- These tools are **deeply optimized for shadcn/ui + Tailwind** — "knowing how to reason with
  those components." v0 "generates production-quality React components using shadcn/ui and
  Tailwind"; "every app Lovable generates uses React + shadcn/ui + Tailwind CSS." → If your lib
  _is_ shadcn-shaped (Tailwind tokens, Radix, cva, `cn`), these builders already speak it.
- **Three ways to bring a custom design system in:** (1) **copy-paste** React components into the
  prompt (works in Lovable/Bolt/Replit); (2) **GitHub integration** — connect a public repo and
  it pulls "only what's needed"; (3) **package install** — "the most powerful and scalable
  approach is bringing your full design system into the project as a package."
- **Registry distribution reaches them too:** "Claude Code, Cursor, Windsurf, Lovable, v0 — and
  other MCP-ready AI tools can connect to 6,000+ shadcn/ui blocks…"; ecosystems like
  shadcnregistry.com / Creative Tim explicitly market blocks as **"AI ready for v0, Lovable and
  Bolt."** → publishing a **shadcn-compatible registry** is the single highest-leverage way to be
  consumable by _all_ of them at once.
- **What library authors do to be consumable:** stay on the shadcn/Tailwind/Radix idiom; ship a
  registry; expose llms.txt + docs `.md`; (optionally) Code Connect for the Figma side. v0 also
  has an **"Open in v0"** registry hook (shadcn `registry/open-in-v0` docs).

> **Relevance:** brand-ui is already Tailwind v4 + Radix + cva + `cn` + registry — i.e.
> structurally "v0/Lovable-shaped." The gaps for design-to-code are the **Figma Code Connect**
> mapping (no evidence brand-ui has one) and possibly a public/namespaced registry endpoint +
> llms.txt for external builders. Internal-only use lowers the priority of the external-builder
> angle, but Code Connect would still help any design-driven workflow.

---

## 10. Patterns & anti-patterns — what makes a library agent-legible vs agent-hostile

### Agent-LEGIBLE (do)

- **Single source of truth, multiple views.** Same components: humans browse Storybook, agents
  query manifests/MCP — "so the same button means the same thing in Figma, in code, and in Claude
  Code" ([designproject.io](https://designproject.io/blog/agentic-design-system/); Storybook MCP).
- **Ground-truth prop access; never make the agent guess.** Export every public prop/type; serve
  them via MCP/manifest; the canonical rule is "never hallucinate a property … verify it's
  documented" ([Storybook](https://storybook.js.org/docs/ai/mcp/overview)).
- **Consistent, predictable APIs** (uniform `forwardRef`/`className`/`...props`/`cva`/exported
  types) so one learned pattern generalizes ([RedMonk/shadcn](https://redmonk.com/kholterhoff/2025/04/22/ui-component-libraries-shadcn-ui-and-the-revenge-of-copypasta/)).
- **Real, runnable examples that double as tests** (stories → interaction + a11y); "gaps in
  examples, states & constraints lead directly to unpredictable UI output"
  ([Storybook on X](https://x.com/storybookjs/status/1996694824330686861)).
- **Intent-named, described tokens** (`emphasis`/`subtle`, `$description`) over positional/opaque
  names; structured (DTCG) where possible ([designproject.io](https://designproject.io/blog/agentic-design-system/);
  [W3C DTCG](https://www.designtokens.org/tr/drafts/format/)).
- **Explicit relationships + anti-patterns in metadata** — the thing types/manifests can't
  encode ("two primary buttons side by side"; "destructive without a confirm")
  ([designproject.io](https://designproject.io/blog/agentic-design-system/)).
- **Discoverable docs for agents** — llms.txt + `.md` page twins + Context7 indexing
  ([llmstxt.org](https://llmstxt.org/); [Context7](https://github.com/upstash/context7)).
- **Portable guidance + deterministic tooling** — AGENTS.md (cross-tool) + skills/slash-commands
  for scaffolding + hooks/lint/typecheck gates that self-validate
  ([agents.md](https://agents.md/); [Anthropic Skills](https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills)).
- **Source visibility** — export TS source (or copy-own via registry) so the agent can read the
  implementation, not a black-box `dist/` (shadcn thesis).
- **Errors written for LLMs** — actionable, fix-suggesting error messages
  ([shadcn CLI 3.0](https://ui.shadcn.com/docs/changelog/2025-08-cli-3-mcp)).

### Agent-HOSTILE (avoid)

- **Opaque packages** — only shipping compiled `dist/`, no types/manifest/MCP → the agent can't
  see the API and invents one.
- **Inconsistent / bespoke APIs & boolean-prop explosions** — every component a new dialect to
  re-learn; prefer composition (component-api guidance, shadcn idiom).
- **Undocumented / un-exported props** — invisible to react-docgen and to the agent; it guesses
  from naming conventions ("`shadow`?") — the exact failure Storybook's rule warns about.
- **Opaque/positional token names** (`color-1`, `brandBlue`, `primary/secondary/tertiary`) with
  no descriptions — agent can't reason about _when_ to use which
  ([designproject.io](https://designproject.io/blog/agentic-design-system/)).
- **"Magic"/clever abstractions** that prevent reading/editing the component (cuts against
  source-ownership; shadcn explicitly optimizes against lock-in).
- **No examples for key states** → no agent capability for those states; output drifts
  ([Storybook on X](https://x.com/storybookjs/status/1996694824330686861)).
- **Docs only as rendered HTML** (nav/ads/JS), no llms.txt/`.md` → expensive, lossy ingestion
  ([llmstxt.org](https://llmstxt.org/)).
- **Guidance locked to one agent** (only CLAUDE.md, no AGENTS.md) → other agents fly blind.
- **Asking AI to generate without design-system context** = "like asking a new engineer to start
  shipping code before onboarding. It might technically work — but it won't align"
  ([Figma DS+AI](https://www.figma.com/blog/design-systems-ai-mcp/)).

### Published guidance to cite ("AI-friendly design systems / MCP for design systems")

- Figma — _Design Systems and AI: Why MCP Servers Are The Unlock_ (Aug 6 2025): design system as
  "productivity coefficient"; the DS↔AI flywheel; 68%/32% use-vs-trust stat.
  https://www.figma.com/blog/design-systems-ai-mcp/
- Anthropic — _Equipping agents for the real world with Agent Skills_ (Oct 16 2025): progressive
  disclosure, code-as-tool, authoring/eval guidance.
  https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills
- Storybook — _MCP server_ docs + _Storybook MCP for React_ blog: toolsets, self-healing loop,
  the "never hallucinate props" AGENTS.md rule. https://storybook.js.org/docs/ai/mcp/overview
- Brad Frost — _Agentic Design Systems in 2026_ + _Storybook MCP with Dominic Nguyen_:
  coverage + validation as the two pillars of agent-readiness.
  https://bradfrost.com/blog/post/agentic-design-systems-in-2026/
- designproject.io — _Agentic design system_ (the three pillars + anti-pattern metadata + build
  order). **Practitioner/marketing — useful framing, unverified metrics.**
  https://designproject.io/blog/agentic-design-system/
- shadcn — registry + MCP docs + CLI 3.0 changelog (the reference implementation of agent-native
  distribution). https://ui.shadcn.com/docs/mcp

---

## 11. Synthesis seeds (for the gap-analysis doc — not conclusions)

Mapping the above onto brand-ui's known posture (from project context, **not** re-verified in
code here):

| Agent-friendliness lever           | Ecosystem standard                  | brand-ui today (per context)                  | Likely gap                                 |
| ---------------------------------- | ----------------------------------- | --------------------------------------------- | ------------------------------------------ |
| Source visibility                  | shadcn copy-own / TS source export  | exports TS source + registry                  | strong                                     |
| Registry                           | shadcn `registry.json` + namespaces | has `registry/` + validate                    | check namespace/MCP-served                 |
| Component MCP                      | Storybook addon-mcp                 | runs Storybook MCP                            | only while dev server up; React-only       |
| Real props                         | react-docgen + manifests            | Storybook autodocs + `brand-ui.manifest.json` | check manifest carries props/anti-patterns |
| llms.txt / `.md` docs              | llmstxt.org                         | not mentioned                                 | **likely missing**                         |
| Context7 indexing                  | upstash/context7                    | n/a (internal)                                | low priority if internal                   |
| Design tokens format               | DTCG JSON + Style Dictionary        | CSS vars in `themes.css`                      | **no DTCG source of truth**                |
| Per-component intent/anti-patterns | `*.meta.json` pattern               | unknown                                       | possible add                               |
| AGENTS.md                          | agents.md (cross-tool)              | has CLAUDE.md + rules, **no AGENTS.md**       | **cheap, high-value add**                  |
| Skills/commands/subagents/hooks    | Anthropic Skills                    | mature (skills, commands, subagents, hooks)   | strong; check portability                  |
| Deterministic gates                | lint/typecheck/test + hooks         | quality-gates + hooks                         | strong                                     |
| Figma Code Connect                 | Figma MCP + Code Connect            | not mentioned                                 | possible add (design-driven flows)         |
| v0/Lovable/bolt consumable         | shadcn/Tailwind idiom + registry    | already Tailwind/Radix/cva/registry           | strong; external endpoint optional         |

**Highest-leverage, lowest-cost candidates** (to validate in synthesis): (a) ship an **AGENTS.md**
(or symlink to CLAUDE.md) for non-Claude agents; (b) a **DTCG token export** (Style Dictionary)
as a structured theming contract; (c) **llms.txt + `.md` docs** if any external/cross-agent
discovery is wanted; (d) consider **anti-pattern/relationship metadata** in the manifest (the one
thing types can't encode); (e) **Figma Code Connect** if design-to-code is in scope. brand-ui is
already strong on source-ownership, registry, Storybook-MCP, skills/commands/hooks, and
deterministic gates — i.e. it is _ahead_ of most public libraries on §1/§7/§8 and behind on the
_portable, tool-neutral, structured-data_ surfaces (§2/§5/§6-AGENTS.md/§9-CodeConnect).

---

## Sources

**shadcn registry + MCP + CLI 3.0**

- https://ui.shadcn.com/docs/registry/registry-json
- https://ui.shadcn.com/docs/registry/registry-item-json
- https://ui.shadcn.com/docs/registry/namespace
- https://ui.shadcn.com/docs/mcp
- https://ui.shadcn.com/docs/registry/mcp
- https://ui.shadcn.com/docs/changelog/2025-08-cli-3-mcp
- https://ui.shadcn.com/docs (introduction; "AI-Ready / open code")
- https://ui.shadcn.com/llms.txt
- https://redmonk.com/kholterhoff/2025/04/22/ui-component-libraries-shadcn-ui-and-the-revenge-of-copypasta/
- https://www.shadcn.io/ (AI-native positioning)
- https://blog.logrocket.com/ai-shadcn-components/

**llms.txt / llms-full.txt**

- https://llmstxt.org/
- https://www.answer.ai/posts/2024-09-03-llmstxt.html
- https://www.mintlify.com/blog/simplifying-docs-with-llms-txt
- https://searchengineland.com/llms-txt-proposed-standard-453676
- https://python.useinstructor.com/blog/2025/03/19/instructor-adopts-llms-txt/

**Storybook MCP / manifests**

- https://storybook.js.org/docs/ai/mcp/overview
- https://storybook.js.org/docs/ai/manifests
- https://storybook.js.org/blog/storybook-mcp-for-react/
- https://github.com/storybookjs/mcp
- https://www.npmjs.com/package/@storybook/addon-mcp
- https://tympanus.net/codrops/2025/12/09/supercharge-your-design-system-with-llms-and-storybook-mcp/
- https://x.com/storybookjs/status/1996694824330686861

**Context7**

- https://github.com/upstash/context7
- https://www.trevorlasn.com/blog/context7-mcp
- https://context7.com/

**Component metadata / type extraction / CEM**

- https://storybook.js.org/docs/configure/integration/typescript
- https://storybook.js.org/docs/writing-docs/autodocs/
- https://custom-elements-manifest.open-wc.org/
- https://custom-elements-manifest.open-wc.org/blog/intro/
- https://github.com/bennypowers/cem
- https://dev.to/stuffbreaker/you-should-be-shipping-a-manifest-with-your-web-components-2da0
- https://daverupert.com/2025/10/custom-elements-manifest-killer-feature/
- https://github.com/cris-achiardi/claude-skills/tree/main/skills/ai-component-metadata

**Design tokens (DTCG / Style Dictionary)**

- https://www.w3.org/community/design-tokens/
- https://www.w3.org/community/design-tokens/2025/10/28/design-tokens-specification-reaches-first-stable-version/
- https://www.designtokens.org/tr/drafts/format/
- https://styledictionary.com/info/dtcg/
- https://styledictionary.com/info/tokens/
- https://docs.tokens.studio/manage-settings/token-format

**Agent-guidance files (AGENTS.md / CLAUDE.md / Cursor)**

- https://agents.md/
- https://www.infoq.com/news/2025/08/agents-md/
- https://openai.com/index/agentic-ai-foundation/
- https://developers.openai.com/codex/guides/agents-md
- https://code.claude.com/docs/en/mcp
- (Cursor rules: .cursor/rules/\*.mdc — deprecation of .cursorrules flagged, date unverified)

**Skills / slash commands / subagents / hooks**

- https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills
- https://code.claude.com/docs/en/skills
- https://www.anthropic.com/news/skills
- https://agentskills.io/ (open standard, Dec 18 2025)
- https://ui.shadcn.com/docs/skills

**Design-to-code (Figma MCP / Code Connect; v0 / Lovable / bolt)**

- https://www.figma.com/blog/introducing-figma-mcp-server/
- https://www.figma.com/blog/design-systems-ai-mcp/
- https://help.figma.com/hc/en-us/articles/23920389749655-Code-Connect
- https://developers.figma.com/docs/figma-mcp-server/code-connect-integration/
- https://help.figma.com/hc/en-us/articles/32132100833559-Guide-to-the-Figma-MCP-server
- https://github.com/figma/mcp-server-guide
- https://www.designsystemscollective.com/design-systems-lovable-bolt-v0-and-replit-50a0a197bc35
- https://techsy.io/en/blog/lovable-vs-bolt-vs-v0
- https://www.digitalapplied.com/blog/v0-lovable-bolt-ai-app-builder-comparison

**Patterns / "AI-friendly design system" guidance**

- https://designproject.io/blog/agentic-design-system/ (practitioner; metrics unverified)
- https://bradfrost.com/blog/post/agentic-design-systems-in-2026/
- https://bradfrost.com/blog/post/storybook-mcp-with-dominic-nguyen/
- https://bradfrost.com/blog/post/ai-and-design-systems/
- https://www.designsystemscollective.com/codebase-indexing-for-design-systems-agents-c0f6b563a39e
- https://aianddesign.systems/ (Brad Frost / TJ Pitre / Ian Frost course)
