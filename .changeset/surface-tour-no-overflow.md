---
"@elabs-ai/components-ui": patch
---

**`SurfaceTour`** no longer makes the page scroll sideways when it spans the full width of the viewport. The sticky tab strip used to reach 8 px past the tour on each side (`-mx-2 px-2`), so a tour mounted without a page gutter was 8 px wider than the screen at every width. The strip now lines up with the frame under it. In a page with a gutter nothing visible changes: the strip still covers the frame's edges while the tour scrolls under it.
