---
"@elabs-ai/components-ui": patch
---

`Command`'s inline list no longer scrolls the whole page. cmdk auto-highlights an item on mount, on every keystroke and on every arrow-key press, and calls the browser's native `scrollIntoView({ block: "nearest" })` on it — which walks every scrollable ancestor, the window included, so a `Command` mounted below the fold used to jump the page to it. Selection scrolling now stays inside the list: keyboard navigation still brings the active item into view, but only by scrolling the list itself.
