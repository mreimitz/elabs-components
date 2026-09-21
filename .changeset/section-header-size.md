---
"@elabs-ai/components-ui": minor
---

`SectionHeader` gains `size`.

- **ui** — `size="lg"` sets the title on the display rung (`text-display`) and keeps the description at a readable measure, for the sections of a long page a reader scans by its headings (a landing page, a docs overview). `"default"` is today's `text-title` and stays the default, so every existing caller is unchanged. Visual only: the heading level is still `as`.
