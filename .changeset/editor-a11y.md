---
"@elabs-ai/components-editor": patch
---

`CodeEditor` now hides Monaco's `iPadShowKeyboard` touch-keyboard proxy `<textarea>` from the accessibility tree (`aria-hidden` + `tabindex="-1"`) instead of leaving it exposed with no accessible name, fixing a critical axe `label` violation on every touch-device visitor.

The Monaco theme bridge's inactive line-number color now clears 4.5:1 AA contrast against the editor background in every theme (previously ~2.5:1 in light, ~3.4:1 in dark at a flat 60%-alpha `muted-foreground`), so leaving line numbers on no longer fails text contrast.

The dimmed final-line-number color (`editorLineNumber.dimmedForeground`, used whenever a file ends in a newline under Monaco's `renderFinalNewline: "dimmed"` default) now reuses that same AA-clamped color instead of Monaco's unset-key fallback, which re-dimmed it by another 40% alpha and dropped it back under 4.5:1.
