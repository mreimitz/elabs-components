---
"@elabs-ai/components-ui": patch
---

`InstallTabs`' "Copy prompt" button swapped its own visible label on a successful copy but
had no live region, so a screen-reader/keyboard user got no announcement. It now renders an
always-mounted `role="status" aria-live="polite"` span next to the button (matching
`CommandChip`'s existing pattern) that announces `promptCopiedLabel` on success and stays
empty on a rejected/unavailable clipboard write.
