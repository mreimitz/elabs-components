---
"@elabs-ai/components-ui": minor
"@elabs-ai/components-editor": patch
---

The Pages templates now stand on real components instead of hand-rolled markup.

- **`SiteShell`** (new, `Layout/SiteShell`): the website counterpart to `AppShell` — skip link, `SiteShellHeader` (sticky by default; `asChild` for a navbar that renders its own `<header>`), `SiteShellMain` (the skip target) and `SiteShellFooter`. The `site-frame` block is built on it, so every page template gets a pinned header.
- **`TableOfContents`** + **`useScrollSpy`** (new, `Navigation/TableOfContents`): the “On this page” list. Follows the reader’s scroll position (last heading past the reading line; last entry once the document is scrolled to its end), one accent marker that slides between entries, smooth-scroll on click with the hash updated and focus handed to the section; `activeId` for a controlled list, `title={null}` to drop the eyebrow, `offset` to match your sticky chrome. Localized via `ui.tableOfContents.title`.
- **`Timeline`** grows a `variant="plain"` (a chronology with no status vocabulary; `current` marks the step you are on, `aria-current="step"`), an `orientation` (`vertical` | `horizontal` | `responsive` — horizontal once the container passes `@3xl`), and a `label` slot (a date, a version) that becomes a left column from `@2xl` (`--timeline-label-width`). The root and items now carry `data-slot="timeline"` / `timeline-item`. The `about-story-01` milestones and the `changelog-01` release rail are built on it.
- `@elabs-ai/components-editor`: the markdown-outline TOC is now `MarkdownTableOfContents`; `TableOfContents` stays as a deprecated alias so nothing breaks.
