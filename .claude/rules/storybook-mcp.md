# Storybook MCP (agent access to live stories)

`@storybook/addon-mcp` runs a Model-Context-Protocol server **inside** the Storybook
dev server, giving agents a ground-truth view of brand-ui as it actually renders
(real props, real stories, live previews, real interaction + a11y tests) instead of
guessing from source. Prefer it for discovery, story authoring, preview and testing.

## Two MCP servers (pick by what you need)

brand-ui exposes **two** MCP servers; they are complementary, not alternatives:

- **`brand-ui` (persistent, always-on)** — server `brand-ui` in `.mcp.json`, started by
  `brand-ui mcp` (stdio); tools `mcp__brand-ui__{info,search,docs,tokens,audit}`. It is a
  dependency-free transport over the CLI engine / committed manifest, so it answers
  **even with the Storybook dev server DOWN**. Reach for it for the **API** (props,
  expanded cva variants, per-component intent/anti-patterns, tokens, search, static
  audit) — the anti-hallucination ground truth. It re-reads the manifest per call, so it
  is always fresh once `pnpm manifest` has run (the pre-commit hook + `manifest:check`
  gate keep it fresh automatically). See `docs/CONCEPT-ai-skills.md` and the Storybook
  doc page "Docs/brand-ui MCP Server". This is the WP-03 #81 server.
- **`storybook` (ephemeral, dev-server-bound)** — the rest of this rule. Reach for it for
  the **rendered** view: real previews, interaction + axe a11y tests, three-theme checks.
  Only exists while `pnpm storybook` runs.

> Rule of thumb: **brand-ui MCP** to know _what exists and how to use it_; **Storybook
> MCP** to _see it render and test it_. When Storybook is down, brand-ui MCP (or the
> CLI) still answers — never block on the dev server just to look up a prop.

## Availability — the golden rule

- **The tools exist ONLY while `pnpm storybook` is running** (`storybook dev -p 6006
--exact-port` → `http://localhost:6006/mcp`). When it is down, the `mcp__storybook__*`
  tools simply do not exist.
- **Start the dev server when you need it.** Storybook is the primary way to verify
  components (render, interaction + a11y tests, three-theme checks) and the only way to
  reach the `mcp__storybook__*` tools. If you're testing/reviewing UI or need those
  tools and the server is down, **start it** — `pnpm storybook` (or
  `pnpm --filter @qlik-coe-emea/qlabs-components-docs dev`) in the background — then drive it, and **stop it
  when you're done**. Don't start it for work that has nothing to do with the UI.
- **Every instruction below is conditional:** _if_ the tools are available, use them;
  _otherwise_ start the server or use the named fallback.
- The addon is **experimental** (React-only); tool names/behavior may change in a
  Storybook upgrade. That's why subagent `tools:` allowlists use the
  `mcp__storybook__*` wildcard, not enumerated names.

## Server name & tools

Registered in repo-root `.mcp.json` as server **`storybook`**, so tools are
`mcp__storybook__<name>`. If the server is ever renamed, every `mcp__storybook__*`
reference (here, `CLAUDE.md`, subagent `tools:` lines, `settings.json`) must change.

- **Docs / discovery** — `mcp__storybook__list-all-documentation` (enumerate every
  documented component; pass `withStoryIds:true` for exact story IDs),
  `mcp__storybook__get-documentation` (one component's real prop/TS types + first
  stories — the anti-hallucination tool), `mcp__storybook__get-documentation-for-story`
  (full code for one specific variant).
- **Dev** — `mcp__storybook__get-storybook-story-instructions` (framework-correct
  story + interaction-test patterns — call **before** writing a `*.stories.tsx`),
  `mcp__storybook__preview-stories` (live preview URLs; pass `globals={theme:'<slug>'}`;
  always surface the URL to the user).
- **Test** — `mcp__storybook__run-story-tests` (runs the given stories as real-browser
  interaction tests **+ axe a11y** and returns a markdown report). Same engine as
  `pnpm --filter @qlik-coe-emea/qlabs-components-docs test-storybook`. **Always scope it to specific stories** —
  never "run all".

## Story IDs

Derived from each story's `title`: kebab-cased, segments joined by `-`, `--` before the
export. e.g. `title:"Foundation/Button"` → `foundation-button--default`;
`title:"Disclosure/Accordion"` → `disclosure-accordion--default`. Use
`list-all-documentation` with `withStoryIds:true` to get exact IDs.

## Themes (three; default `qlik-bright`)

Always pass the **CSS slug**, never the display name:
`qlik-bright`, `qlik-dark`.

- `preview-stories`: `globals={theme:'qlik-dark'}`.
- Manual URL: `/?path=/story/<storyId>&globals=theme:<slug>` (iframe:
  `iframe.html?id=<storyId>&globals=theme:<slug>`).

## Workflow by pillar

- **ADD / DEV** — `list-all-documentation` (dedupe: does it already exist across
  `@qlik-coe-emea/qlabs-components-*`?) → `get-documentation` / `get-documentation-for-story` (real props,
  copy a validated usage) → `get-storybook-story-instructions` (before authoring a
  story) → build → `preview-stories` (show the user the rendered result).
- **TEST (self-healing loop)** — `run-story-tests` scoped to the touched stories →
  fix failures (interaction + a11y) → re-run until green. If it returns "Tests are
  already running" or is otherwise unavailable, **retry once, then run the CLI
  fallback below** — do NOT skip the interaction+axe gate or substitute screenshots +
  manual contrast math for a real a11y pass.
- **REVIEW** — `run-story-tests` (objective interaction + axe report) + `preview-stories`
  across both themes; report the exact **story ID + theme slug**.

## Fallbacks (when the tools are unavailable)

- Discovery → read `packages/*/src/index.ts` barrels + Glob `packages/*/src/**`.
- Real props → Read the component `.tsx` + its exported types.
- Story authoring → copy a sibling `*.stories.tsx`.
- Tests → `pnpm --filter @qlik-coe-emea/qlabs-components-docs test-storybook` (or `pnpm --filter <pkg> test`).
  Use this **also when the MCP runner is busy** ("Tests are already running"), not only
  when it's down — a UI change still needs a real interaction + axe pass before you call
  a11y/theme-safety verified.

## Issue handoff

Findings from story-based checks must cite the exact **story ID + theme slug** (and the
`preview-stories` URL when available) so `brand-ui-root-cause-analyst` can reproduce precisely.
See @.claude/rules/issue-workflow.md.
