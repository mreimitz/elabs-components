---
"@elabs-ai/components-editor": patch
---

Fix: `CodeEditor` now finds and neutralizes Monaco's `iPadShowKeyboard` touch-keyboard proxy `<textarea>` (`aria-hidden="true"`, `tabindex="-1"`) instead of only labelling the first textarea in the DOM, resolving a critical axe `label` violation on touch-emulated viewports.
