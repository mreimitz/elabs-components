# elabs-ai.com homepage — concept (2026-09-18)

Scope: replace "Storybook as the front door" with a real homepage for brand-ui, keep Storybook as the reference. Inputs: the repo at 4.2.0 (13 packages, 52 registry blocks, 7 archetype playbooks + 10 templates, 8 theme families, CLI + hosted MCP + Claude Code plugin + skills, A2UI and DashboardSpec), the 2026-09-17 Storybook/MCP review, and a same-day survey of 18 competing library homepages (§2).

## 1. Diagnosis

Storybook is the right _reference_ and the wrong _front door_. A first-time visitor lands on a sidebar with 2,300 entries and a package list; nothing on that screen says why the library exists, nothing moves, and the thing that makes brand-ui unusual (an agent can query, scaffold, audit and even _emit_ UI against it) is invisible. The 09-17 review fixed the broken pages, but a fixed Storybook is still a catalogue. Catalogues are for people who have already decided.

What the homepage has to do that Storybook cannot:

1. Make the case in one screen, with the product itself as the proof.
2. Serve two visitors at once: a human deciding whether to adopt, and a coding agent that arrived via `llms.txt` or a pasted link.
3. Show breadth _as one system_ — chat, grid, chart, canvas, map, editor, terminal, process map re-skinned together by one theme switch. No competitor has the package breadth to make this argument; it is ours to make.
4. Route people out fast: to a template, to the MCP, to Storybook, to GitHub.

Storybook stays exactly where it is, mounted under `/storybook` (or `storybook.elabs-ai.com`), linked from every component mention on the homepage.

## 2. What the field does (survey of 18 homepages, 2026-09-18)

| Pattern                                            | Who does it best                                                                                                  | Take                                                                                    |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| The page _is_ the demo — no screenshots            | shadcn (one composed dashboard bento), Radix, Kibo                                                                | Adopt. Every pixel below the hero is a live component.                                  |
| Whole surfaces, not widgets                        | Vercel AI Elements (Chatbot / IDE / Workflow examples)                                                            | Adopt and extend: we have seven archetypes, they have four.                             |
| Brand-theme thumbnails                             | HeroUI (Netflix, Spotify, Airbnb presets)                                                                         | Adopt as a hero-level switch that re-skins the _whole page_, not a thumbnail row.       |
| Command as CTA                                     | assistant-ui (`npx assistant-ui init`), AI Elements                                                               | Adopt: `claude mcp add --transport http brand-ui https://elabs-ai.com/mcp` is a button. |
| Dual install path in one sentence                  | 21st.dev ("paste it in the terminal / paste it in chat"), Aceternity ("copy, paste, or build with your AI agent") | Adopt, but show both paths running, not described.                                      |
| Agent artifacts named concretely, high on the page | Mantine (section 2: llms.txt, skills, MCP)                                                                        | Adopt and go further: installable units with per-host buttons, not prose.               |
| Interaction affordance labels                      | Tremor ("Hover me / Click me / Open me")                                                                          | Adopt sparingly in the surface tour.                                                    |
| Ownership one-liner                                | Catalyst ("a disappearing UI kit"), Park UI ("Make it yours")                                                     | Adopt; we already have "source you're meant to read and edit".                          |

What nobody does yet, and what this concept is built around:

- Nobody lets the visitor watch an agent _do_ the demo. 21st.dev uses a video. We can run the actual loop on the page: prompt → hosted MCP → rendered surface.
- Nobody shows a theme switch re-skinning chat + grid + chart + map + canvas at once.
- Nobody renders UI _from agent output_ live. A2UI (`brand-ui a2ui schema`) and DashboardSpec mean an agent can emit a JSON surface and the library renders it. That is a different category from "MCP tells the agent the props".
- Nobody states scope honestly. "Presentation layer; never owns model calls, streaming or transport" (D5) is a trust line no AI-adjacent library writes.
- Nobody has one-click MCP install on the homepage. It lives in docs, FAQ or a sub-page everywhere.
- Several "AI-ready" homepages render empty to a fetcher (ReUI). Ours must be clean HTML with `llms.txt` linked in the hero.

Weaknesses to avoid: MCP in the footer; social-proof-only pages with no product on them; "open source" headline next to a "Buy now" button; 10–13 feature sections (the good pages have 3–6); theming shown only as a dark-mode toggle; blurring "UI for AI apps" with "UI usable by AI agents" — we say both, separately.

## 3. Positioning

**One sentence (humble register):**

> brand-ui is an open-source React component system for the screens that are hard to build — data grids, dashboards, chat with tool calls, node canvases, maps, editors, terminals, process maps — all on one token system, and readable by coding agents through a CLI, an MCP server and a manifest.

**Two audiences, two senses of "AI", stated separately:**

|               | Human developer                                       | Coding agent                                                      |
| ------------- | ----------------------------------------------------- | ----------------------------------------------------------------- |
| Arrives via   | link, search, GitHub                                  | `llms.txt`, MCP `info`, a pasted URL                              |
| Wants in 10 s | "Is this real? Does it look good? Can I re-brand it?" | packages, routine, import lines, story URLs                       |
| We give them  | live surfaces, theme switch, install tabs             | the same page as clean HTML + `llms.txt` + `.well-known/mcp.json` |

"AI" sense 1: brand-ui renders AI apps (chat, reasoning, tools, sources, artifacts, agent canvas, A2UI).
"AI" sense 2: brand-ui is built to be _used by_ agents (CLI, MCP, plugin, skills, audit, manifest).
Both are true; the page keeps them in separate sections so neither is diluted.

**Proof points we can state without hype** (all verified in repo/README): 13 packages under one token system; 52 registry blocks, shadcn-compatible; 7 archetype playbooks with templates; 8 downloadable brand themes (Claude, ClickHouse, Graphite, Heap, Ocean, Qlik, Salesforce, Snowflake); axe runs on every story as a blocking check on a tightening ratchet; automated gates for token discipline, contrast, dep direction, focus rings, motion, bundle weight; hosted MCP with `info / search / docs / tokens / chart_for`; `audit --strict` as definition of done.

Tone rules: no superlatives, no "the #1 anything", no "revolutionary". Let the switch, the counters and the live loop do the claiming. Numbers are generated at build time from the manifest, never typed by hand.

## 4. The concept: "One system, every hard screen — for you and for your agent"

The page is one continuous argument in six movements. Every movement is live UI built with brand-ui itself (the marketing package gets extended where needed — the homepage becomes the dogfood surface for `@elabs-ai/components-marketing`).

### 4.1 Hero — the switch (above the fold)

Layout: left column headline + two CTAs + agent CTA; right two-thirds a **live composed app shell** (the `Layout/App shell — Flagship` composition: sidebar, KPI row, chart, data table, a chat panel with a tool call in progress, a small flow canvas in a tile).

The hero control is a **theme-family switch** (Default · Ocean · Qlik · Snowflake · Salesforce · Claude · ClickHouse · Graphite · Heap) plus a mode toggle. Switching re-skins the entire page — every section below, not just the hero — with a 300 ms token crossfade. That single interaction is the pitch: one stylesheet change, whole product re-branded. Under the switch, a one-line caption: "Every screen on this page is the library. Switching themes changes one stylesheet."

Secondary dials (density, decoration, motion) exposed as a small "dials" popover — the review called the dial set unique; show it, don't bury it.

Copy (draft):

- H1: **The hard screens, one system.**
- Sub: React components for dashboards, data grids, AI chat, node canvases, maps, editors and process maps — on one token system, and legible to coding agents.
- CTA 1: `Get started` · CTA 2: `Open a template` · CTA 3 (command chip): `claude mcp add --transport http brand-ui https://elabs-ai.com/mcp` with a copy button and a small "Cursor / VS Code / Codex" dropdown that swaps the snippet.
- Trust strip under the CTAs: npm version · GitHub stars · "MIT" · "axe on every story" — generated.

### 4.2 Movement 2 — the surface tour (use-case driven)

Seven tabs = seven archetypes, each a **full, interactive** template rendered inline at real size (not a thumbnail), each with the same three affordances: `Open in Storybook` · `Copy prompt` · `Scaffold` (`brand-ui scaffold <archetype>` / registry command).

| Tab              | What the visitor sees                                                                                     | Interaction hint         |
| ---------------- | --------------------------------------------------------------------------------------------------------- | ------------------------ |
| Dashboard        | KPI cards, AutoChart, DataTable; a **sheet** variant: drag a tile, switch to edit mode                    | "Drag a tile"            |
| AI assistant     | Streaming transcript with reasoning, tool call, sources, an artifact panel; a message arrives on tab open | "Expand the tool call"   |
| Data app         | Virtualized 50k-row DataTable with facets, column picker, bulk actions                                    | "Filter 50,000 rows"     |
| Flow workspace   | React Flow canvas with branded nodes, minimap, inspector                                                  | "Select a node"          |
| Process explorer | Process map + variant explorer + case list (nobody else ships this)                                       | "Pick a variant"         |
| Settings         | Sectioned settings with guarded danger zone                                                               | "Try the guarded delete" |
| Marketing        | The page you are on, as a template                                                                        | "You're looking at it"   |

Each tab carries a one-line _use case_, not a feature list: "A back-office team browsing 2M orders", "An ops analyst finding why 12% of cases take twice as long", "A copilot that shows its work". Use-case copy is how the section stays humble: it describes the reader's problem, not our product.

### 4.3 Movement 3 — "Ask your agent" (the live loop)

The section nobody else has. Left: a prompt box pre-filled with a rotating example ("Build me a KPI overview for churn with a trend and a movers list"). Right: a three-step trace that runs when the visitor presses Run:

1. `search "kpi overview churn"` → the hosted MCP answers with playbook, template and block ids (real call to `/mcp`, shown as a compact tool-call card from `@elabs-ai/components-ai`).
2. `docs KpiMovers` → props and intent (real call).
3. Render → the resulting block appears in the theme currently selected.

No model is called. Step 3 uses a small curated map from example prompt → block ids, so the page stays a presentation layer (D5) and works offline behind a proxy. The honesty line sits right under it: "brand-ui never owns model calls. This demo calls the same hosted MCP your agent would; the picking was done ahead of time."

Second half of the section, **"Or let the agent emit the UI"**: an A2UI surface JSON on the left (editable), the rendered surface on the right, live via `validateA2uiSurface` + the renderer. A "Load example" button pulls `brand-ui a2ui example`. Same for DashboardSpec with a second tab. This is the moment for the agent-native claim, and it is demonstrable rather than asserted.

### 4.4 Movement 4 — "Works with your agent" (the matrix)

A grid of installable units, each with a per-host action:

| Unit                                              | What it gives an agent                                                                                                                             | Action                                                       |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Hosted MCP `elabs-ai.com/mcp`                     | info · search · docs · tokens · chart_for, nothing to install                                                                                      | Add to Claude Code / Cursor / VS Code / Codex (snippet swap) |
| Local MCP / CLI `npx -y @elabs-ai/components-cli` | same + `audit --strict`, `scaffold`, `dashboard-spec`, `a2ui`                                                                                      | copy                                                         |
| Claude Code plugin + 11 skills                    | `/plugin marketplace add mreimitz/elabs-components`                                                                                                | copy                                                         |
| `llms.txt` + per-package spokes                   | routing map for agents without MCP                                                                                                                 | link                                                         |
| shadcn-compatible registry, 52 blocks             | `npx shadcn@latest add <registry-url>/kpi-movers-01.json` (registry moves from GitHub Pages to `elabs-ai.com/r` so the URL is short and on-domain) | copy                                                         |
| Manifest (`brand-ui.manifest.json`)               | 255 tokens, every prop, intent, anti-patterns                                                                                                      | link                                                         |

Then the _routine_ in one line, the same one the MCP `info` tool prints: `info → search → docs → build → audit --strict`. Agents that read this page get the route; humans see that the route exists.

### 4.5 Movement 5 — "One token system" (why it holds together)

Three live panels, small:

- **Tokens → everything.** Hover a token chip (`--primary`, `--surface-2`, `--chart-3`) and every element on the page using it lights up. Tokens are the mechanism behind the hero switch; this section explains it.
- **Eight themes, none of them the menu.** The 8 families as swatches with their type stack; "Write a stylesheet, register it, done. `brand-ui create-theme` scaffolds one." Link to the theme skill.
- **Gates, not guidelines.** A compact list generated from `docs/GATES.md`: axe on every story (blocking), contrast, token discipline, dep-direction, focus-ring contract, motion tokens, bundle weight. Each with its rule name. This is the "trust" band and it replaces testimonials, which we don't have and don't need yet.

### 4.6 Movement 6 — "Two ways in" and the ask

Install tabs: `pnpm add` (packages) · `npx shadcn add` (copy-own blocks) · `Claude Code` · `Cursor` · `v0/Lovable`-style prompt. Below, four route cards: **Adopt** (Getting Started) · **Point your agent** (MCP page) · **Re-brand** (Theme guide) · **Read the source** (GitHub). Footer: Storybook, changelog, npm, license, attribution panel (the shipped `AttributionPanel` component, which is on-brand for the project).

## 5. What makes it feel exceptional without saying so

- **The whole page re-themes.** One control, nine brands, everything moves. That is the memorable moment and it is 100% real.
- **Real size, real data.** Templates render at product size with plausible data (no lorem, no "Item 1"). Numbers are consistent across tiles (the churn KPI equals the chart's last point).
- **Motion is a token.** Section reveals, tab transitions and the theme crossfade all use the library's motion tokens and respect `prefers-reduced-motion` via the motion dial. The page demonstrates the motion system by using it.
- **Interaction hints, once.** Tremor-style "Drag a tile" labels appear once per tab and disappear on first interaction.
- **Ambient agent presence.** The AI-assistant tab's transcript streams a short reply when the tab opens; the tool-call card expands on hover. The terminal package renders the `brand-ui audit` output as a real terminal session block (registry: `terminal-session-mid-turn`).
- **Under 3 s to interactive on a mid laptop.** Heavy packages (Monaco, MapLibre, React Flow, Milkdown) load per tab on demand; hero uses charts + data + ai only. Budget enforced by the existing bundle-weight gate extended to the site.
- **It reads perfectly with JS off.** Server-rendered HTML, every section's copy present, `llms.txt` in `<head>` and in the hero. An agent fetching the page gets the argument and the routine.

## 5a. Visual and motion concept

The rule that keeps this honest: every effect on the page is made of things the library already owns — the token system, the decoration dial's masked grounds, the motion tokens (`--duration-*`, `--ease-*`, `--motion-factor`), the elevation ramp, the Paper foundation. Nothing is a one-off marketing trick; if an effect is worth having, it lands in `@elabs-ai/components-marketing` as a block. That is also why it will feel coherent: the page and the components move by the same clock.

### Art direction

- **Register:** "product, not poster". Large type, generous whitespace, one accent from the active theme, near-monochrome ground. The colour on the page comes from the components, not from the page decoration. Closest references: Linear's depth without its darkness; shadcn's restraint; the Qlik theme when selected should look like Qlik Cloud, not like a site about Qlik Cloud.
- **Type:** the theme's own stack (Source Sans 3 under Qlik, the family's face elsewhere). Display sizes only in the hero and movement headers; body stays at product scale so the live surfaces don't look toy-sized next to the copy.
- **Ground:** three stacked layers, all token-driven, all `transform`/`opacity` only:
  1. **Base** — `--background`.
  2. **Ambient field** — a slow radial mesh of two or three theme colours (`--primary`, `--chart-2`, `--surface-3`) at very low alpha, blurred, masked to a vignette exactly the way `decoration.css` masks its grounds (on a `::before` layer, never on the host). It drifts ~40 px over 20 s on a linear loop. Switching the theme re-colours the field through the same crossfade as everything else, so the background is visibly "the tokens" too.
  3. **Drafting texture** — the decoration dial's paper/hatch ground, at the theme's default decoration level. The hero's dials popover lets the visitor turn it up and watch the ground and the chart fills change together. This is the one place on the web where "decoration" is a demonstrable system property rather than a vibe.

### Depth and parallax

Parallax is used as depth, not as spectacle: three planes, small offsets, driven by scroll position (CSS `animation-timeline: scroll()` where supported, `motion` `useScroll` fallback), all under `--motion-factor`.

| Plane                            | Parallax rate | What lives there                                                                                                                                                          |
| -------------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ground (ambient field + texture) | 0.15×         | the two background layers above                                                                                                                                           |
| Content                          | 1×            | copy, controls, the live surfaces                                                                                                                                         |
| Float                            | 1.2×          | a few detached elements: the tool-call card that "escapes" the hero chat panel, a KPI tile, a flow node — each a real component, each casting the elevation ramp's shadow |

The float plane is the "living composition" moment: in the hero, two or three components sit slightly outside the app-shell frame at a different rate, so scrolling reveals that the shell is made of parts. They settle back into the tour tabs further down (see choreography). Offsets stay under 60 px total; anything more reads as a slideshow.

### Theme switch — the signature transition

- Uses the View Transitions API when available (`document.startViewTransition`), so the whole document crossfades in one paint: 380 ms (`--duration-slow`), `--ease-standard`. Fallback: a `transition` on `color`/`background-color`/`border-color`/`fill`/`stroke` scoped to the page root, same duration.
- The ambient field and the float plane get a **+120 ms stagger** so the ground lands after the content — the eye sees the components change first, then the room around them. That single detail is what makes it feel like a re-brand rather than a filter.
- The switch control itself is a segmented row of nine swatches, each swatch a tiny two-tone chip (`--primary` over `--background` of that family), with the family's wordmark on hover. Keyboard: arrow keys move, Enter applies, and `?theme=qlik` is a shareable URL state.

### Scroll choreography (movement by movement)

1. **Hero** — copy fades up (`--ease-entrance`, 24 px travel, 260 ms) in three staggered groups (headline → sub → CTAs, 60 ms apart). The app shell mounts already visible, but its data streams in: KPI numbers count up over 600 ms, the chart draws its line, the chat panel receives one message and a tool call opens. This takes ~1.5 s and never repeats; it is the page's only "intro".
2. **Hero → tour** — as the visitor scrolls, the float-plane components drift toward the tour and the hero shell dims by 10 % (opacity only). The tour's tab bar is **sticky** at the top once reached; the section header fades while the surface stays.
3. **Tour** — tab switches are a shared-element transition where possible (the frame stays, the content crossfades 260 ms). Each surface's first reveal plays its own natural entrance (rows populate, nodes lay out, the process map animates its edges once). Interaction hints ("Drag a tile") fade in after 800 ms and out on first pointer event.
4. **Agent loop** — the three trace steps appear as the real responses arrive, each card sliding in from the left (`slide-in-from-left-6`), the rendered block scaling in from 0.97 on the right. Since the MCP answers in <1 s, a minimum 350 ms per step is enforced so the sequence is readable.
5. **Matrix / tokens / gates** — plain staggered fade-ups on enter (IntersectionObserver, once). The token panel's hover-highlight is a 160 ms outline pulse on every element that consumes the hovered token; the ambient field also tints toward that token while hovered, which quietly proves it is the same variable.
6. **Install / routes** — no motion beyond hover-lift (≥4 px) on the route cards.

Section boundaries: no hard rules or bands. Movements are separated by the ambient field shifting hue slightly (a different pair of theme colours per movement, interpolated by scroll), so the page reads as one continuous surface whose light changes as you go.

### Restraint rules (so it stays fast and calm)

- Animate `transform` and `opacity` only; the ambient field is a single blurred element, not a canvas or WebGL. Target: no long task >50 ms after load, 60 fps on a mid laptop, Lighthouse perf ≥ 90.
- Everything rides `--motion-factor`: OS reduced-motion, or the motion dial at "reduced", removes parallax, count-ups, drift and staggers; theme switch becomes a plain crossfade; the tour still works. Verified by an e2e run with `prefers-reduced-motion: reduce`.
- No scroll-jacking, no pinned sections longer than one viewport, no autoplaying loops other than the 20 s ambient drift (which is also under the gate).
- Nothing animates inside a control (the decoration policy already forbids painting controls; the same applies to motion here).
- One intro, once. Return visits (same session) skip the hero stream-in.

### Reference frames (for the implementing agent)

- Hero, Qlik theme, light: Source Sans 3 display, `--primary` green as the only accent, chart line draws in, chat tool-call card floating 24 px outside the shell's right edge with a `shadow-lg`.
- Same viewport after switching to Claude dark: the ambient field warms, the shell's surfaces step to the dark ramp, the float components keep their positions. Nothing else on screen changes size or place — that stillness is the proof.
- Tour, process explorer: the process map's edges animate once from source to sink, then rest.

## 6. Architecture

```
apps/
  docs/     Storybook (unchanged) → served at /storybook
  home/     the website (new)      → served at /
```

- **Framework:** Next.js (App Router, static export where possible) or Vite + SSG. Recommendation: **Next.js** — Vercel-native, RSC for the static shell, per-tab dynamic imports for heavy packages, `/mcp` route stays where it is (`api/mcp.mjs` moves to the site app; Storybook loses the API dir). Alternative if you want zero framework: Vite + `vite-plugin-ssr`; more wiring, no real upside on Vercel.
- **Two Vercel projects, one domain:** `apps/home` is its own project (`elabs-home`) and owns `elabs-ai.com`; Storybook keeps the existing project and is reached through a rewrite `/storybook/:path*` → the Storybook project's URL. Independent deploy cadence per app, both release-only. (Settled in the roadmap track, RM-089/RM-105; implementation plan: `roadmap/home/`.)
- **Dogfooding is a rule, checked:** the site imports only `@elabs-ai/*` packages and registry blocks; `pnpm check` gets a rule that fails on raw colours or non-token classes in `apps/home`. `audit --strict` runs on the site in CI. The marketing package grows what the homepage needs (theme switch band, surface tabs, agent-loop trace, install tabs, gates band) so the homepage is also the marketing archetype's flagship template.
- **Generated, not typed:** counts, package list, theme list, gates list, CLI verbs, routine — all from `brand-ui.manifest.json` / `docs/GATES.md` at build time (`scripts/gen.mjs` gains a `site` target). Stale numbers are how front pages lose credibility (see the 09-17 review §10).
- **Agent surface on the site:** `/llms.txt` (fixed generator, hosted MCP first), `/.well-known/mcp.json`, `<link rel="alternate">`, OG image rendered from the hero composition per theme (9 OG variants, generated), `robots.txt`, sitemap.
- **Prompt map for §4.3:** `content/agent-loop.json` (in the site app) — example prompt → MCP calls to show → block ids to render. Small, reviewable, no model.

## 7. Phasing

| Phase                                   | Ships                                                                                              | Acceptance                                                                                                            |
| --------------------------------------- | -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| 0 — Route split (½ day)                 | `apps/home` skeleton, Storybook under `/storybook`, `/mcp` unchanged, OG/meta/llms.txt/.well-known | Old deep links `?path=` still resolve (redirect `/?path=…` → `/storybook/?path=…`); `curl /llms.txt` shows hosted MCP |
| 1 — Hero + switch + routes (2–3 days)   | Movements 1 and 6; theme switch re-skins page; install tabs                                        | Lighthouse ≥ 90 perf/a11y; switch works in all 9 families × 2 modes; site passes `audit --strict`                     |
| 2 — Surface tour (3–4 days)             | Movement 2, all seven tabs from the existing templates, lazy loaded                                | Each tab interactive within 1 s of click; every "Open in Storybook" link resolves                                     |
| 3 — Agent loop + A2UI (2–3 days)        | Movement 3 live against `/mcp`; A2UI/DashboardSpec editors                                         | Real JSON-RPC calls visible in network tab; invalid A2UI shows validator errors inline                                |
| 4 — Tokens/gates band + polish (2 days) | Movement 5, token highlighting, motion, reduced-motion path, JS-off read                           | Page readable with JS disabled; reduced-motion removes all non-essential motion                                       |
| 5 — Marketing package uplift            | New blocks promoted from the site into `@elabs-ai/components-marketing` + registry                 | `brand-ui search "theme switch"` finds them                                                                           |

Total: ~2 weeks of agent-driven work; each phase is one work package with its own acceptance line (fits the `/next-wp` runner).

## 8. Decisions (settled 2026-09-18)

1. **Name on the page:** **brand-ui** is the marketing name and wordmark; "by elabs-ai" as the maker line; `@elabs-ai/*` appears only in install snippets.
2. **Storybook URL:** `/storybook` via rewrite; both apps keep their own deploy cadence. `/?path=…` deep links redirect to `/storybook/?path=…`.
3. **Hero composition:** the app-shell flagship (breadth is the argument).
4. **Agent-loop honesty line:** visible, directly under the demo.
5. **Stars/downloads counters:** deferred; the trust strip ships without them and the slot is generated so they can be switched on later.

## 9. Not in scope

Testimonials, pricing, Pro tiers, blog, newsletter. Nothing on the page should ask for anything but a `git clone` or a `claude mcp add`.

Related: `docs/review/2026-09-17-storybook-and-hosted-mcp-review.md` (the §6 work list is a prerequisite for phase 0's link hygiene), `docs/playbooks/marketing.md`, `docs/DECISIONS.md` D5.
