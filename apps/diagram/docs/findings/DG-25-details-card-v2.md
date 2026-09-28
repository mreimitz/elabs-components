# Details card v2

The card reads real compiled node data and the live catalog. A node's `catalogEntry` identifies its product even when its display icon is overridden; custom nodes retain the icon-based catalog fallback. Catalog parts inherit missing description/docs from their source icon through the shared catalog precedence function. Explicit empty node description/docs suppress inherited content.

Descriptions remain plain text with preserved line breaks. There is no light Markdown parser in the allowed UI dependencies; introducing a document editor or a second parser for this card would add unnecessary weight. More/Less is shown from measured rendered overflow, not a character count, and resets when another node's card opens. If a live catalog edit makes More unnecessary while it owns focus, focus moves to the description before the button disappears. The existing virtual anchor, hover timing, keyboard opening and Escape focus return remain intact. Card dimensions follow Radix's available space on small screens.

Status uses a word and a distinct glyph. Documentation links accept only absolute HTTP(S), open a new tab with `noopener noreferrer`, and disclose that behavior in their accessible name. The unverified-link note belongs only to an inherited catalog link. Internal catalog and diagram links use the existing route encoder. Composite links require a normalized, nonbroken workspace path.

The R1 scope excludes metrics and composite thumbnails. No new grammar or synthetic dev-only data path was added. The composite card uses the existing `component`, `broken` and `pending` contracts; the reference resolver can supply richer metadata through those same contracts later.

## Focused checks

- `node --test scripts/tests/node-details.test.mjs` covers catalog identity, part inheritance, own/legacy/catalog precedence, explicit clearing, statuses, composite paths and unsafe protocols.
- `node tests/details-card.mjs` uses disposable real YAML diagrams and a temporary part in the isolated checkout's existing Qlik parts file, restoring its original bytes afterwards. It checks keyboard/hover behavior, live catalog refresh without document writes, composite navigation, both themes and desktop/390px widths. `DIAGRAM_URL` selects the isolated app server; `DETAILS_EVIDENCE` saves screenshots/results.

## Separate catalog-development finding

Adding a new catalog YAML file on the existing Vite server can invalidate the eager catalog glob and reload the page despite the workspace plugin's data-file hot-update suppression. The observed page imported two differently timestamped `diagram-store.ts` modules: one held the seed document and one held the requested document. The loading boundary remained visible while the hidden canvas held the requested nodes. This belongs to the catalog creation workstream; the details tests edit an existing parts file and restore it, avoiding a new glob member. A future catalog-creation regression must prove that a newly created vendor updates the running UI without a reload or duplicate store.

## Validation

Seven resolver tests passed. The browser suite passed 40 checks across Light/Dark and 1440/390px, including four scoped axe scans with no violations. The local-mode smoke passed Home → recent diagram → YAML edit/autosave → present/exit → SVG download. Typecheck, local build, strict audit and changed-file formatting passed; lint has no errors and the 11 inherited warnings. Build retains the existing large-chunk and unresolved fragment warnings. No library package files changed.
