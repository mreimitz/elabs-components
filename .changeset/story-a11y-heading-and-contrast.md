---
"@elabs-ai/components-ui": patch
"@elabs-ai/components-process": patch
"@elabs-ai/components-terminal": patch
---

Accessibility fixes behind the blocking axe gate, across the screens the generative-surface merge brought in. `AccordionTrigger` gains `headingLevel` (2–6, default 3): Radix hardcodes its header as an `h3`, which skips a level whenever an accordion sits directly under the page heading. An outline `Button` now pins its own `text-foreground`, so it stays legible on a coloured band instead of inheriting that band's ink against its own `bg-background` plate (1.06:1 before). `ProcessKpiStrip`'s inline ribbon keeps its label/value pairs one element deep inside the list, with the trend inside the value, so the definition list is well-formed. Faint ANSI output (SGR 2) moves from 0.5 to 0.7 opacity — 4.2:1 was under AA on the terminal surface.

Registry blocks: section headings under a page title are `h2` (office insight feed, trace waterfall, score explanation, dependency web, project cards, kanban board, product detail, run review), a `Select` inside a field carries its label as an accessible name (contact, profile, market desk), a tooltip'd toolbar toggle self-provides its tooltip provider (process explorer), the cart total rule is a border instead of a separator inside the list, and marketing copy on a coloured plate, faded wordmarks and team roles use ink rungs that reach 4.5:1.
