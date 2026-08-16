---
description: Scaffold a new component in a @brand package — after first checking for an existing component/block and recommending reuse/extend/merge/replace/create
argument-hint: <package> <ComponentName> [one-line purpose]
allowed-tools: Read, Edit, Write, Grep, Glob, Bash(pnpm:*), mcp__storybook__*
---

You are creating a new component in the brand-ui monorepo.

Inputs: `$ARGUMENTS` (target package, component name, and optionally a purpose).
If the **purpose** is missing, ask for it once. Do not ask anything else you can
infer from the repo.

## Step 1 — Discover & dedupe (BLOCKING — do this before writing anything)

A component system rots when near-duplicates pile up. Before scaffolding,
determine whether the same or a similar capability already exists, and decide
what to do about it. **Do not create any files until this is resolved.**

1. **Search for the requested capability** — by name AND by concept, not just an
   exact string:
   - **If the Storybook dev server is running**, call
     `mcp__storybook__list-all-documentation` (`withStoryIds:true`) to enumerate
     every documented component across all `@elabs/components-*` packages, then
     `mcp__storybook__get-documentation` on candidates to compare real props/variants
     — this is the fastest, most reliable dedupe signal. If the server is down, use
     the source-reading fallback below. See @.claude/rules/storybook-mcp.md.
   - Read every package barrel: `packages/*/src/index.ts` (the public surface).
   - `Glob` component folders: `packages/*/src/**` and registry source under
     `registry/components/**`, `registry/blocks/**`; read `registry/registry.json`.
   - `Grep` for the name, its singular/plural, and synonyms / sibling concepts.
     Examples: Modal -> dialog, sheet, drawer, popover, overlay; Combobox ->
     select, autocomplete, command; Toast -> notification, snackbar, alert, sonner;
     Table/Grid -> data-table; Tabs -> segmented, toggle-group; Avatar -> user, badge.
   - Also match by **UI role / primitive**: overlay, form control, layout shell,
     data view, chat element, flow node, marketing section; Radix dialog, TanStack
     Table, `@xyflow/react`, etc.

2. **Compare** each candidate match. Read it and note: where it lives
   (package/registry), what it does, its props/variants, the primitive it uses,
   and precisely how it differs from the request (capability gap, API shape,
   styling, accessibility, package boundary).

3. **Classify the overlap and recommend ONE action:**
   - **Reuse as-is** — an existing component already covers this. Create nothing;
     point the user to it with the import path.
   - **Extend** — mostly covered; the only gap is a new variant/prop/size. Add it
     to the existing component instead of creating a new one.
   - **Merge** — the request overlaps an existing component (or two existing ones
     overlap). Propose a single unified API, which one to keep, and what to
     deprecate.
   - **Replace** — an existing component is legacy/inferior and should be
     superseded. Note migration impact (who imports it; barrel/registry updates).
   - **Create new** — genuinely distinct (different role, primitive, or package).
     Proceed to scaffold.

4. **Report & confirm.** Present a compact findings table:

   | Existing item | Location | Overlap | Key differences |
   | ------------- | -------- | ------- | --------------- |

   ...followed by your single recommended action and a one-line rationale. Then
   **ask the user to confirm** the action (reuse / extend / merge / replace /
   create new) before continuing. If you found no meaningful match, say so in one
   line and proceed to create new.

5. **Don't duplicate non-component primitives either:** a `cn` helper already
   exists (`@elabs/components-ui/lib/cn`), icons live in `@elabs/components-icons`, tokens in
   `@elabs/components-tokens`. Reuse them; never re-add a local copy.

Only continue below when the confirmed action is **create new** (full scaffold)
or **extend** (modify the existing component + add its story/test coverage). For
**merge/replace**, follow that plan instead of scaffolding a fresh folder; for
**reuse**, stop and hand the user the import.

## Step 2 — Pick the package

Choose the target package under `packages/` (ui, data, ai, flow, maps, charts,
marketing, editor, viewer, blueprint). If unclear from the name/purpose, ask which package. Keep app
UI in `@elabs/components-ui`, marketing in `@elabs/components-marketing`, code-editor surfaces
(Monaco) in `@elabs/components-editor`, surfaces that display a file the app did not
write (uploads, signed URLs, agent output) in `@elabs/components-viewer`,
geospatial/MapLibre surfaces in `@elabs/components-maps`,
and decorative blueprint-theme drawing furniture
(graph paper, sheet frames, dimension lines, marks) in `@elabs/components-blueprint`.

## Step 3 — Scaffold the files

1. Create `packages/<pkg>/src/components/<kebab-name>/` (for `@elabs/components-ui`) or
   `packages/<pkg>/src/<kebab-name>/` (other packages — match that package's
   layout).
2. Create, following the repo pattern:
   - `<kebab-name>.tsx` — the component
   - `index.ts` — re-export the component + its public types
   - `<kebab-name>.stories.tsx` — at least a Default story (`tags: ["autodocs"]`).
     If the Storybook dev server is running, call
     `mcp__storybook__get-storybook-story-instructions` first for the
     framework-correct story + interaction-test patterns; else copy a sibling story.
   - `<kebab-name>.test.tsx` — at least one smoke test (render + key behavior)

## Step 4 — Implement

Read `@.claude/rules/component-api.md`, `@.claude/rules/styling-and-tokens.md`,
`@.claude/rules/accessibility.md`. Then:

- `forwardRef` + spread `...props` + accept `className`, merged with `cn()`
- **semantic tokens only** (`bg-primary`, `text-muted-foreground`) — never raw hex
- if a new visual concept needs a new `--token`, scaffold it into **all theme
  blocks** in `packages/tokens/src/themes.css` (not just `:root`) so the
  theme-token-parity gate (`pnpm theme-parity:check`, #89) passes by construction
- `class-variance-authority` if the component has meaningful variants
- prefer a Radix primitive for any interactive/overlay behavior
- export all public types

## Step 5 — Wire up & verify

1. Add the export to the package barrel `packages/<pkg>/src/index.ts`.
2. Verify against `@.claude/rules/quality-gates.md`.
3. Run `pnpm --filter @elabs/components-<pkg> typecheck` and the package tests; fix issues.
4. **Verify the story.** If the Storybook dev server is running, run
   `mcp__storybook__run-story-tests` on the new story (fix until green) and
   `mcp__storybook__preview-stories` to show the user the rendered result (spot-check
   `light` + `dark`); otherwise run `pnpm --filter @elabs/components-docs test-storybook`. See
   @.claude/rules/storybook-mcp.md.
5. **Regenerate the manifest AND its downstream generators**: `pnpm agent-docs`
   (not just `pnpm manifest`) — the new export must reach
   `component-inventory.md`, `llms.txt`, `brand-ui-context.md`, the `pnpm
gen`-owned doc regions and package READMEs, not just `brand-ui.manifest.json`
   (#396). This runs automatically at commit time via `.githooks/pre-commit`
   when the commit touches `packages/*/src/**` — running it here just surfaces
   the result before you commit.
6. In your summary, note what was added (or extended/merged/replaced), the
   dedupe decision and why, and any follow-ups.

Keep the implementation clean and minimal — no speculative props, no one-off
styles. Match the surrounding code style.
