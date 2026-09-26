---
"@elabs-ai/components-ui": minor
"@elabs-ai/components-marketing": minor
"@elabs-ai/components-editor": patch
---

The Pages templates now stand on real components instead of hand-rolled markup.

- **`SiteShell`** (new, `Layout/SiteShell`): the website counterpart to `AppShell` — skip link, `SiteShellHeader` (sticky by default; `asChild` for a navbar that renders its own `<header>`), `SiteShellMain` (the skip target) and `SiteShellFooter`. The `site-frame` block is built on it, so every page template gets a pinned header.
- **`TableOfContents`** + **`useScrollSpy`** (new, `Navigation/TableOfContents`): the “On this page” list. Follows the reader’s scroll position (last heading past the reading line; last entry once the document is scrolled to its end), one accent marker that slides between entries, smooth-scroll on click with the hash updated and focus handed to the section; `activeId` for a controlled list, `title={null}` to drop the eyebrow, `offset` to match your sticky chrome. Localized via `ui.tableOfContents.title`.
- **`Timeline`** grows a `variant="plain"` (a chronology with no status vocabulary; `current` marks the step you are on, `aria-current="step"`), an `orientation` (`vertical` | `horizontal` | `responsive` — horizontal once the container passes `@3xl`), a `label` slot (a date, a version) that becomes a left column from `@2xl` (`--timeline-label-width`), and per-item `nodeSize` / `node` for a custom marker. The root and items now carry `data-slot="timeline"` / `timeline-item`. The `about-story-01` milestones and the `changelog-01` release rail are built on it.
- **`Tabs`** grows a `variant="rail"` for `TabsList` / `TabsTrigger`: a vertical list of full-width triggers with an accent rail on the active one, for feature tabs and settings-style side navigation (`orientation="vertical"` on the root). Used by `marketing-features-03`.
- **`Avatar`**: new `AvatarGroup` (overlapping stack with an overflow count), `AvatarFallback` takes a `name` and derives the initials, and `initialsOf()` is exported so consumers stop writing their own.
- **`Carousel`**: new `CarouselDots` (localized via `ui.carousel.dots` / `ui.carousel.goToSlide`) and `useCarouselPosition()` for a custom position indicator.
- **`TagInput`**: `normalize`, `addOnBlur`, `renderTag`, `tagVariant`, `inputMode` and `aria-describedby` pass-through, so an email list can validate and tint each address.
- `NavUser` uses `AvatarFallback name` instead of its own initials rule.
- **`@elabs-ai/components-marketing`**: `LogoStrip` grows `layout="marquee"` (`marqueeSeconds`, pauses on hover/focus and under reduced motion, play/pause control with `labels`) and `muted` for greyscale logos; `lucide-react` is now a dependency of the package.
- `@elabs-ai/components-editor`: the markdown-outline TOC is now `MarkdownTableOfContents`; `TableOfContents` stays as a deprecated alias so nothing breaks.
