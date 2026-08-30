# Playbooks (archetype composition recipes)

One page per app archetype: which `@elabs-ai/components-*` building blocks it's made of,
how they wire together, and a minimal working example. Playbooks answer the
question templates can't: **"why these components, in this order, wired this
way"** — so a developer (or a coding agent) composes correctly on the first
try instead of reverse-engineering the playground demos.

The index below is GENERATED from each playbook's own YAML front matter
(`pnpm gen`, gated by `pnpm gen:check`) — add a playbook, don't edit the table.

<!-- brand-ui:gen:playbooks:start -->

| Archetype        | Intent                                                                                         | Playbook                                   | Template source                |
| ---------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------ | ------------------------------ |
| `ai-assistant`   | Chat-first surface rendering rich agent output (markdown, reasoning, tools, sources)           | [`ai-assistant.md`](./ai-assistant.md)     | `templates/ai-assistant.tsx`   |
| `dashboard`      | KPI overview screen — metrics first, charts second, records last                               | [`dashboard.md`](./dashboard.md)           | `templates/dashboard.tsx`      |
| `data-app`       | Tool-first table surface for browsing and operating on records                                 | [`data-app.md`](./data-app.md)             | `templates/data-app.tsx`       |
| `flow-workspace` | Node-and-edge canvas for editing a pipeline or workflow, with a selection inspector            | [`flow-workspace.md`](./flow-workspace.md) | `templates/flow-workspace.tsx` |
| `marketing`      | Standalone pitch page — nav → hero → proof → capability → relevance → trust → ask              | [`marketing.md`](./marketing.md)           | `templates/marketing.tsx`      |
| `settings`       | Multi-section settings portal — sectioned nav, a form per section, guarded destructive actions | [`settings.md`](./settings.md)             | `templates/settings.tsx`       |

<!-- brand-ui:gen:playbooks:end -->

## How to use a playbook

1. **Pick the archetype** that matches what you're building — run
   `brand-ui search <what you are building>` (it matches playbooks by intent and
   keywords), or `/new-app` for a guided pick.
2. **Start from the generated template source** (`templates/<archetype>.tsx`) —
   the full composition, derived from its Storybook story by `pnpm gen:templates`
   (single source of truth, so it never drifts from what Storybook renders).
3. **Follow the playbook's wiring order** to swap the placeholder data for yours.
4. Decisions the playbook doesn't list as **yours** are already made —
   don't re-make them (that's the point).

## Conventions every playbook assumes

- App root wrapped in `<ThemeProvider defaultTheme="…">` from `@elabs-ai/components-tokens`.
- Semantic tokens only (`bg-background`, `text-muted-foreground`, …) — no raw hex.
- Generic icons from `lucide-react`; brand marks from `@elabs-ai/components-icons`.
- Loading → `Skeleton`/`LoadingState`, empty → `EmptyState`, error →
  `ErrorState` (all `@elabs-ai/components-ui`) — never a blank region.
- brand-ui is presentation-only: model calls, fetching, and transport belong
  to your app (see `docs/DECISIONS.md` D5).

## Adding a playbook (auto-registered, gated)

A playbook is discoverable only because it carries machine-readable front matter.
Create `docs/playbooks/<archetype>.md` starting with:

```yaml
---
archetype: <archetype> # must equal the file name
intent: "One sentence an agent can match a user's request against"
keywords: [a, few, free-text, terms]
packages: ["@elabs-ai/components-ui", "…"]
---
```

Then run `pnpm agent-docs`. That folds it into `brand-ui.manifest.json`, the
generated agent context, `brand-ui search`, the `brand-ui` MCP `search` tool, and
the table above — no other manual edit. `pnpm playbooks:check` fails CI if the
front matter is missing/incomplete, if the archetype is unknown to the engine, or
if the regeneration was skipped.

_Related: `research/define-to-build/` (the requirements these answer),
`skills/brand-ui/` (agent-facing component skill). The enterprise-gap working
papers that specified the machine-readable follow-on were removed when this
fork was debranded._
