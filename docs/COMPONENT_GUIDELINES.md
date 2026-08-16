# Component guidelines

How to build components that fit brand-ui. The authoritative, enforced version
lives in `.claude/rules/` — this is the human-readable companion.

## Folder pattern

```
component-name/
  component-name.tsx     # implementation
  component-name.stories.tsx
  component-name.test.tsx
  index.ts               # public re-exports
```

`@qlik-coe-emea/qlabs-components-ui` nests components under `src/components/`; the other packages place
them directly under `src/`. Match the package you're in.

## API conventions

- Extend the relevant intrinsic props and spread `...props` onto the root.
- Always accept `className`; merge with `cn()` last.
- `forwardRef` whenever a DOM ref is meaningful.
- Variants via `class-variance-authority`; export `xxxVariants`.
- Prefer compound components and Radix `asChild` over boolean-prop explosions.
- Export every public type.
- Add `"use client"` to components that use hooks/effects and may run in RSC apps.

## Styling

- Semantic token utilities only (`bg-primary`, `text-muted-foreground`,
  `border-border`, `bg-surface`, `ring-ring`). **No raw hex** outside
  `themes.css`.
- Visible focus on every interactive element.
- Keep the DOM shallow; avoid wrapper soup.

## Quality gates

Every component must pass the checklist in `.claude/rules/quality-gates.md`:
types exported, composable, semantic tokens, theme-safe, accessible, story, test,
barrel export, no paid deps. Run `/review-component <path>` to audit.

## Do / don't

- ✅ Compose primitives; reuse tokens; keep props minimal and obvious.
- ❌ Hardcode colors; mix marketing into app UI; add a paid dependency; build a
  closed abstraction that can't be edited.
