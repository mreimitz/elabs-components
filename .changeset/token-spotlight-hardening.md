---
"@elabs-ai/components-ui": patch
---

Harden `TokenSpotlight`: `scanForConsumers`'s JSDoc now documents that an SVG consumer is
returned as its `<svg>` root (an `SVGSVGElement`) even though `onDone` stays typed
`HTMLElement[]` for compatibility; unhovering or switching chips now clears
`data-token-consumer` marks in the same idle-time slices used to write them, instead of one
synchronous pass, so clearing a large consumer set is never a long task either; and a new
opt-in `maxMarks` prop caps how many elements a token spotlight will mark (unset by default,
matching `scanLimit`'s existing opt-in shape) for hosts where a token like `--foreground` or
`--border` would otherwise flood the page with hundreds of marks.
