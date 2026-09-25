---
"@elabs-ai/components-ui": patch
---

`InstallTabs`' Prompt tab "Copy prompt" button now carries an always-mounted `role="status" aria-live="polite"` region next to its visible label, both driven from the same successful-copy state, so a screen-reader user is told the copy worked — previously nothing announced it, mirroring the pattern `CommandChip` already used.
