---
"@elabs-ai/components-ui": patch
---

`IntegrationMatrix` and `CommandChip` accessibility and visual fixes:

- Every row's copy button in `IntegrationMatrix` now gets its own accessible name (the row's action label appended to `CommandChip`'s copy label), instead of every row sharing the identical "Copy command" name.
- `IntegrationMatrix`'s rows now expose `role="list"`/`"listitem"` with per-cell `sr-only` column labels, so assistive tech gets a row/column association for Unit / Gives you / Actions.
- The routine step's explanation now opens from a real button via a Popover (not a hover-only Tooltip on a non-interactive span), so it's reachable on tap.
- `IntegrationMatrix`'s data-row divider now uses the strong border rung (`border-border-strong`), matching the header row, since it's the only cue separating same-surface rows.
- `CommandChip`'s command text and `IntegrationMatrix`'s routine-step tokens now carry `translate="no"`, so browser page-translation can't mangle a command before it's copied.
