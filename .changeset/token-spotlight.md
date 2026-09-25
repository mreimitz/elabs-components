---
"@elabs-ai/components-ui": patch
---

`TokenSpotlight`'s match outline is now drawn with the compound ring (`--ring-contour` outline plus `--ring` box-shadow) instead of a single `--ring` outline, so the mark clears contrast in every theme instead of measuring as low as ~1.35:1.

Each chip's accessible name is now just its label (e.g. "Primary"), never led by the resolved colour value. The resolved value moved to the chip's own `aria-describedby`, and the repeated hint sentence is now given once, as the chip row's own description, instead of being duplicated inside every chip.
