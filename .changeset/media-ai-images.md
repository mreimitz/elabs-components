---
"@elabs-ai/components-ai": minor
---

Changed: Gallery, Attachments, AssetPreview, Queue and ModelProviderLogo now render through the ui `Image` / `Video` primitives (a token-styled error fallback instead of a broken-image glyph).

Deprecated: `Image` → `GeneratedImage` and `ImageProps` → `GeneratedImageProps`. The old names remain as aliases until the next major.
