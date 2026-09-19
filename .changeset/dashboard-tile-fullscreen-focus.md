---
"@elabs-ai/components-charts": patch
---

**Dashboard tiles:** closing **Full screen** now always returns keyboard focus to the tile, even if the full-screen view is closed very quickly. The tile's "More actions" menu restores focus to its own button after its closing animation ends. When the view was closed before that, focus landed on "More actions" instead of the tile. That happened on slow machines and under load. The menu now leaves focus to the full-screen view when you choose Full screen.
