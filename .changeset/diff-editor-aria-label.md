---
"@elabs-ai/components-editor": minor
---

`DiffEditor` takes an `ariaLabel` prop that names both sides' focusable surfaces (" (original)" / " (modified)"). Monaco re-derives each side's name from the changed options on every diff-level `updateOptions`, blanking both when `originalAriaLabel`/`modifiedAriaLabel` are missing — the component now re-sends them with every update it makes.
