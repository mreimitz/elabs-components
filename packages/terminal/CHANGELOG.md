# @elabs-ai/components-terminal

## 5.0.0

### Minor Changes

- 3a3b59a: Created apps download less and install cleanly. `ui`, `icons`, `ai`, `data`, `flow`, `maps`, `charts`, `marketing`, `viewer` and `terminal` now build one output file per source module (entry points, `exports` and type declarations are unchanged), so an app's bundler keeps only the components it imports: the `dashboard` template's first JavaScript download drops from 609 KB to 147 KB gzip. `@elabs-ai/components-charts` moves `@visx/brush` to 4.0.1-alpha.0 like the rest of visx, which ends the `ERESOLVE` peer warnings npm printed for React 19 apps. `brand-ui create` writes the app's CI workflow for the package manager that ran it: `npm ci` for an app created with `npx`, otherwise `pnpm/action-setup` pinned to the pnpm major that created it (the old workflow failed for npm apps, and for pnpm apps without a `packageManager` field). The app's CLAUDE.md lists that package manager's commands and says to commit the lockfile, and `create --install` under pnpm now installs with pnpm (it picked npm).

### Patch Changes

- 94f1e0e: Accessibility fixes behind the blocking axe gate, across the screens the generative-surface merge brought in. `AccordionTrigger` gains `headingLevel` (2–6, default 3): Radix hardcodes its header as an `h3`, which skips a level whenever an accordion sits directly under the page heading. An outline `Button` now pins its own `text-foreground`, so it stays legible on a coloured band instead of inheriting that band's ink against its own `bg-background` plate (1.06:1 before). `ProcessKpiStrip`'s inline ribbon keeps its label/value pairs one element deep inside the list, with the trend inside the value, so the definition list is well-formed. Faint ANSI output (SGR 2) moves from 0.5 to 0.7 opacity — 4.2:1 was under AA on the terminal surface.

  Registry blocks: section headings under a page title are `h2` (office insight feed, trace waterfall, score explanation, dependency web, project cards, kanban board, product detail, run review), a `Select` inside a field carries its label as an accessible name (contact, profile, market desk), a tooltip'd toolbar toggle self-provides its tooltip provider (process explorer), the cart total rule is a border instead of a separator inside the list, and marketing copy on a coloured plate, faded wordmarks and team roles use ink rungs that reach 4.5:1.

- Updated dependencies [3951d51]
- Updated dependencies [5646c7f]
- Updated dependencies [779c040]
- Updated dependencies [f0155e5]
- Updated dependencies [015b988]
- Updated dependencies [431e9a2]
- Updated dependencies [fc40636]
- Updated dependencies [817dd16]
- Updated dependencies [e52e84c]
- Updated dependencies [dbee30e]
- Updated dependencies [f024c7a]
- Updated dependencies [4386ae3]
- Updated dependencies [8a807dc]
- Updated dependencies [a2aff19]
- Updated dependencies [87e58d7]
- Updated dependencies [3a3b59a]
- Updated dependencies [a514030]
- Updated dependencies [4e07999]
- Updated dependencies [94f1e0e]
- Updated dependencies [18f063e]
- Updated dependencies [6271b00]
  - @elabs-ai/components-ui@5.0.0
  - @elabs-ai/components-tokens@5.0.0

## 4.2.0

### Patch Changes

- Updated dependencies [a3a69f7]
  - @elabs-ai/components-ui@4.2.0
  - @elabs-ai/components-tokens@4.2.0
