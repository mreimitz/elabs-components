# Workspace search

The sidebar searches file titles, file names, paths, ancestor folders, and diagram content.
Every query word must match somewhere in a file. Clearing the search restores the tree's
previous expanded state. `/` opens and focuses search; Escape clears it, then returns focus
on desktop or closes the phone sheet.

Titles keep their beginning visible. The tree measures every title highlight after changes
to the query and when its available width changes. Hidden title matches receive additional
evidence even when another field also matches. Each field receives its own explanation;
queries matching three or more fields are covered as well.

Evidence labels occupy their own line so nested folders cannot squeeze a match behind a long
label. Each distinct match has a bounded snippet: preceding text truncates from the start,
following text truncates from the end, and the matching word can wrap. Distant matches in a
long description get separate snippets. The full title and field values remain available to
assistive technology, and the full field value is available on hover.

## Browser regression check

Start the app's Vite server on a dedicated port, then run `tests/sidebar-search.mjs` with
`DIAGRAM_URL` pointing to that server and Playwright available as `PLAYWRIGHT_MODULE` (package
specifier or module file URL). `SEARCH_EVIDENCE_DIR` optionally saves screenshots. The check
uses its own browser context and virtual workspace fixtures; it does not create or change
workspace files.

Coverage includes light/dark at 1440, 1280 and 390 pixels, folder depths one through three,
incremental typing/backspace, rail resizing, multi-field queries, very long descriptions,
long matched words, false-positive title evidence, no-results, keyboard focus and Escape,
plus the existing spec-check page. The output records the number of geometry checks and any
missing visible terms.
