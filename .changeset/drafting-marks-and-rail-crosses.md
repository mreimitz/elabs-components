---
"@elabs-ai/components-ui": minor
"@elabs-ai/components-tokens": minor
---

Header-band design elements for the hairline family.

- **ui** — `DraftingMarks`: a quiet construction drawing (two guides crossing at a station point, the arcs struck from it, a dot field, a dimension tick, registration crosses, two small token-inked accents) pinned to one corner of a hero or header band and faded away from it. Decorative and inert; `anchor` picks the corner, `accent={false}` keeps it in rule ink, `--drafting-marks-fade` swaps the falloff.
- **tokens** — `hairline-rails` draws a solid registration cross where a rail meets a seam rule (`--hairline-cross-size`); new `--deco-fade-corner` / `--deco-fade-corner-tight` masks.
