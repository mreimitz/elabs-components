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

`@elabs-ai/components-ui` nests components under `src/components/`; the other packages place
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

## Chart cards (ChartCard / ChartFrame)

`ChartCard`/`ChartFrame` follow a fixed, four-part card contract (lieflat):
write `title` as the **conclusion**, not the chart type ("Revenue is up 8% QoQ",
not "Revenue chart"); put what each series means in **prose, in `description`**
— that prose IS the legend; the chart itself is the body; and an optional
`source` prop renders a fourth, all-caps letter-spaced attribution row
(`text-chart-source`) — `ChartFrame` also carries it into the expand modal and,
for a plain string, into the downloaded CSV as a trailing `# source: …`
comment row. Pair the sibling `text-chart-value` role with `tabular-nums` for
in-chart data-label values (weight 800, vs. the lighter axis-label weight).

## Quality gates

Every component must pass the checklist in `.claude/rules/quality-gates.md`:
types exported, composable, semantic tokens, theme-safe, accessible, story, test,
barrel export, no paid deps. Run `/review-component <path>` to audit.

## Do / don't

- ✅ Compose primitives; reuse tokens; keep props minimal and obvious.
- ❌ Hardcode colors; mix marketing into app UI; add a paid dependency; build a
  closed abstraction that can't be edited.
