# `dashboard-tile-markdown` — a markdown dashboard tile with a real editor

A `DashboardTileKind` that renders GitHub-flavoured markdown with `MarkdownView`
(`@elabs-ai/components-ai`, sanitised) and edits it with `MarkdownEditor`
(`@elabs-ai/components-editor`, WYSIWYG with the slash menu) in a full-size dialog. Copy-owned,
not a package import: the dashboard subpath never imports `ai` or `editor` (`dashboard-reuse`
rule, D6) — this block is the sanctioned way to put them inside a sheet.

## Replacing the built-in text tile

```tsx
import { createMarkdownTileKind } from "@/components/dashboard-tile-markdown/dashboard-tile-markdown";

const TILES = [
  ...Object.values(builtInTiles).filter((k) => k.kind !== "text"),
  createMarkdownTileKind("text"), // same `kind`, same `{ body, align }` content shape
];
```

Every existing `text` tile keeps rendering (the markdown subset is a superset of the
built-in inline markup) and gains the editor.

## Live values — `${{ … }}` placeholders

| Placeholder                               | Resolved by                                    |
| ----------------------------------------- | ---------------------------------------------- |
| `${{variables.name}}`                     | the sheet's variable                           |
| `${{selection.Field}}`                    | the field's selected values (`All` when none)  |
| `${{selection.count('Field')}}`           | how many values are selected                   |
| `${{=expression}}`                        | `host.markdown.evaluate(expression)`           |
| `${{dim:ID:Title}}` / `${{msr:ID:Title}}` | `host.markdown.evaluate(…)` (a BI master item) |

Placeholders re-resolve on every selection or variable change. The host seam is
`DashboardProvider`'s `host` prop:

```tsx
<DashboardProvider
  spec={spec}
  tiles={TILES}
  host={{
    markdown: {
      evaluate: (expr) => engine.evaluate(expr), // sync or async
      items: masterMeasures.map((m) => ({ id: m.id, label: m.title, group: "Measures" })),
    },
  }}
>
```

Without an evaluator a host placeholder renders as its title — the sheet never breaks.

## The editor dialog

Double-click the tile in edit mode or press its **Edit content** button. Left: an insert
rail (sheet variables, selection fields, host items — click inserts at the caret). Middle:
the WYSIWYG editor. Right: the live preview with placeholders resolved (below `lg`, a
footer toggle swaps the two). **⌘/Ctrl+S** saves, **Escape** cancels.

## Config form

`align`, `padding` (0–8 spacing steps) and `baseHeadingLevel` (the prose rung a `#` maps
to; default 2 so tile headings sit below the sheet title) in the properties panel.

## Dependencies

`@elabs-ai/components-ai` (`MarkdownView`), `@elabs-ai/components-editor` (`MarkdownEditor`;
import `@elabs-ai/components-editor/monaco-environment` once at your app entry),
`@elabs-ai/components-charts/dashboard`, `@elabs-ai/components-ui`.

## Smoke story

`apps/docs/stories/blocks/dashboard-tile-markdown.stories.tsx`, "Dashboard / Recipes".
