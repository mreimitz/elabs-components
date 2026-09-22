---
"@elabs-ai/components-ai": patch
"@elabs-ai/components-cli": patch
---

Component descriptions are written for the people reading them.

Every catalogue page now leads with a sentence about what the component is for.
Where no purpose was authored, the site used to fall back to whatever JSDoc sat
at the top of a story file, which surfaced maintainer shorthand — roadmap
codes, seeded-random notes, import bans — as if it were product copy; 196 more
pages had no lead at all. Candidate leads are now filtered (roadmap/ADR/issue
refs, fixtures, story ids, repo paths, breadcrumbs, dates) and the fallback
chain is purpose, then registry description, then docs description, then the
component's own JSDoc.

Published surfaces that carry these descriptions move with it: the A2UI
catalogue and its JSON schema gain a summary per component, and the CLI's
component metadata picks up the authored purposes. No API, export or component
shape changes.
