---
name: brand-ui-component
description: Create or extend a component IN the brand-ui monorepo (maintainer workflow). Use when adding a new primitive or block to @elabs/components-ui, @elabs/components-data, @elabs/components-ai, @elabs/components-flow, @elabs/components-maps, @elabs/components-charts, @elabs/components-marketing, @elabs/components-editor, or @elabs/components-viewer, when extending an existing component, or when the user says "new component", "add a component to the library", or "scaffold a <Name>". Enforces the dedupe gate (reuse before create), the component API rules, the quality gates, and re-generates the component manifest. For consuming a component in an app, use the `brand-ui` skill instead.
user-invocable: true
argument-hint: "<package> <Name> [purpose]"
allowed-tools:
  - Bash(pnpm brand-ui *)
  - Bash(pnpm --filter *)
  - Bash(pnpm agent-docs)
---

# brand-ui-component (maintainer)

Add or extend a component in the monorepo. Runs the project's own workflow; this
skill is the portable front door to `.claude/commands/new-component.md` and the
`component-builder` / `review-component` agents.

## 1. Dedupe gate (before writing anything)

Search first — don't duplicate. `brand-ui search <name/concept>` and check the
registry. If something close exists, decide with the user: **reuse**, **extend**,
**merge**, **replace**, or (only if truly new) **create**. This mirrors
`/new-component`'s analysis step.

## 2. Place it correctly

App UI → `@elabs/components-ui`; data-dense → `@elabs/components-data`; chat/AI → `@elabs/components-ai`; canvas →
`@elabs/components-flow`; geospatial/MapLibre map → `@elabs/components-maps`; KPI/chart → `@elabs/components-charts`;
landing → `@elabs/components-marketing`; code
editor (Monaco) → `@elabs/components-editor` (markdown authoring/preview + frontmatter utils
on the `@elabs/components-editor/markdown` + `@elabs/components-editor/markdown/frontmatter` subpaths);
displaying a file the app did not write (upload, signed URL, agent output) → `@elabs/components-viewer`
(a new FORMAT is an adapter registration, not a new component);
One direction of dependency:
`tokens → ui/icons → data/ai/flow/maps/charts/marketing/editor/viewer`.
Import across packages via `@elabs/components-*`, never relative paths.

## 3. Build to the rules

Follow `.claude/rules/component-api.md`, `styling-and-tokens.md`, `accessibility.md`:

- `forwardRef` + spread `...props` + `className` merged with `cn()` last.
- Variants via `class-variance-authority`; export the `xxxVariants` fn and all
  public types.
- Semantic tokens only — no raw hex outside `themes.css`.
- Radix for interactive/overlay behavior; visible focus ring; correct roles/labels.
- Compound components over boolean-prop explosions; `"use client"` when it uses hooks.

Co-locate `name.tsx`, `index.ts`, `name.stories.tsx` (with `tags: ["autodocs"]`),
`name.test.tsx`. Add the barrel export in the package's `src/index.ts`.

## 4. Quality gate + manifest

- `pnpm --filter @elabs/components-<pkg> typecheck test` (and `lint`) must pass.
- Verify it renders in both themes (Storybook).
- Run `pnpm agent-docs` so the new component lands in the manifest AND its 5
  downstream generators (inventory/llms/context/gen — `component-inventory.md`,
  `llms.txt`, `brand-ui-context.md`, the `pnpm gen`-owned doc regions, package
  READMEs) — not just the manifest alone (#396). In practice this already runs
  automatically at commit time via `.githooks/pre-commit`
  (`scripts/run-agent-docs-cascade.mjs`) when the commit touches
  `packages/*/src/**`; run it by hand here only to see the result before
  committing, or in an environment without the git hook wired.
- Audit it: `pnpm brand-ui audit packages/<pkg>/src/components/<name>` and, for
  visual/contrast, the `brand-ui-audit` skill.

## 5. Done = quality gates pass

Types exported, composable, semantic tokens, theme-safe, accessible, story + smoke
test, barrel export, green typecheck/lint/test (see `.claude/rules/quality-gates.md`).
Findings during the work → `/file-issue`, don't silently patch unrelated things.

## Composition patterns

Build compound, not configurable: avoid boolean-prop modes (use explicit variants),
share a context not props, lift state into a provider exposing `state`/`actions`/`meta`,
prefer children over render-props. Keep `forwardRef`; prefer `use()`. See
`.claude/rules/component-api.md` → Composition patterns.
