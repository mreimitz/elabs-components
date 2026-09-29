# Home browser redesign

Status: implemented and locally verified on 2026-09-29. Parallel workstreams: data/search, browser UI, shell/catalog integration.

## Outcome

Home becomes the primary place to find, preview, open and reuse diagrams, components,
templates and catalog entries. Recent is the default landing view. Grid and table are
two presentations of the same results, filters, sorting and actions.

This supersedes the earlier DG-23 constraint that Home has no search. It does not reopen
deferred platform/accounts, server deployment, PPTX or phase-B onboarding work.

## Baseline findings before implementation

- Home currently stacks Recent, Folders and Components; the same file can appear in
  several sections. Search is only in the sidebar. Catalog is a separate experience.
- Large thumbnail cards consume most of the first screen, especially on phones.
  Thumbnails often contain large amounts of empty canvas and tiny unreadable diagrams.
- Recent mixes opened paths with recently modified files and excludes templates.
  There are no recorded opened timestamps, so it cannot honestly display “Opened …”.
- Current local inventory: nine workspace files, six folders; 682 catalog products/parts
  across 13 vendors, excluding 40 Lucide glyphs. Catalog currently renders all 682 cards.
- 227 catalog products have no description. The redesign must not invent descriptions
  or hide those entries. Fallback metadata can show vendor, capability or reference.
- Workspace content search already exists, with match explanations and mtime caching.
  Catalog search is simpler and lacks description/capability matching.

## Implementation scope

1. Browse/reuse first, or full file management including rename/move/delete/bulk actions?
   Recommendation: browse/reuse first; retain existing management through the workspace.
2. Catalog detail plus Copy reference/YAML only, or also explicit Add to diagram?
   Recommendation: detail and copy first, with explicit-target insertion as a separately
   validated follow-on. Never silently insert into the last active document.

The user authorized implementation. Proceed with browse/reuse and catalog preview/reference copying; full file management and explicit-target insertion remain deferred.

## Recommended experience

Use a unified library browser, rather than a welcome dashboard or an OS file-manager clone.
Keep the current Home name in the app navigation; use the current collection as the main
content heading. No oversized welcome hero, metrics tiles or setup instructions in the
primary browsing area.

```text
Icon rail | Document tabs (when open)
          | Home > Components > Qlik > SaaS
          | Library tree       | Search…                         New ▾
          | Recent             | Filters · Sort             Grid | Table
          | Diagrams           | -------------------------------------
          | Components         | Results scroll here; table header stays
          |   Qlik             | visible. Preview opens on request.
          |     SaaS           |
          | Templates          | -------------------------------------
          | Catalog > vendors  | Count / page              Previous Next
```

- **Recent:** genuinely opened items, newest first, with a type indicator. Extend local
  history to include workspace files and catalog details. Merely hovering or selecting
  a preview does not mark an item opened. Migrate existing ordered paths without inventing
  timestamps. Never fill Recent with files the user has not opened.
- **Diagrams:** all non-template, non-component workspace diagrams, with folder browsing.
- **Components:** reusable workspace diagrams, with preview, location and usage details.
- **Templates:** preview before creating a uniquely named copy. Viewing never edits the
  template. This remains distinct from ordinary document opening.
- **Catalog:** products and reusable parts, with vendor, capability/type and tag filters;
  real icon and reference ID. Generic Lucide glyphs stay in the icon picker.
- **Folders:** a dedicated, independently scrolling Home tree contains all workspace
  subfolders and catalog vendors. The global application sidebar remains collapsed by
  default. The toolbar breadcrumb reflects the selected collection and full folder path.

Opening an existing diagram/component always uses view mode. Creation intentionally opens
edit mode. Primary titles/cards open their destination with one click or Enter. A separately
labelled Preview action opens an on-demand detail panel; no double-click or hover required.
Preview never auto-opens merely because the user entered Home.

### Search

- Search from Recent defaults to all resource types, not only recent history. Search in
  another collection clearly shows its scope, with an explicit Search everything option.
- Match workspace titles, filenames, paths, descriptions and indexed diagram contents.
  Match catalog labels, IDs, vendor, aliases, tags, capability and descriptions.
- Rank exact names/IDs before prefixes and broader content matches. Apply common token
  and accent handling across sources. Show the actual matching text, not just a truncated
  title. A title-only match must also remain visible at narrow widths.
- Mixed search results identify their type and group by Workspace and Catalog, with counts,
  so hundreds of catalog hits do not bury a matching user diagram.
- Search is immediate after indexing, with a short debounce. Show “Searching contents…”
  while enrichment is incomplete; do not claim there are no matches prematurely.
- Clear restores the prior collection, folder and scroll position. Back restores browser
  state after opening a result. No new global keyboard shortcut conflicts with the editor.

### Grid, table and previews

- Default grid: compact, consistent preview proportions, quiet borders, restrained spacing,
  two-line titles with access to the full name, and clear secondary metadata. Diagram
  previews should fit diagram bounds rather than include unnecessary canvas chrome.
- Catalog grid uses icons and compact product metadata, not empty diagram-shaped previews.
  Missing previews use a designed fallback. Never run hundreds of live React Flow canvases.
- Table: Name, Type, Location/vendor and relevant date; scope-specific columns such as
  capability or usage. No fabricated owner, modified date or document size for catalog items.
  Long names have more room than in cards. Name sorting and row actions remain keyboard usable.
- Grid/table preference persists locally. Switching preserves query, filters, sort, selection
  and the visible item where possible. Recent sorts by opened order; other collections default
  to name, with modified sorting available only for workspace resources.
- Detail preview: title, full description and actual diagram preview for documents/components;
  product icon, metadata, docs and copy actions for catalog entries. Usage is loaded on demand.
- New menu contains New diagram and From template. Connect an LLM moves to secondary Help/
  workspace setup access rather than occupying a primary action beside browsing.

### Sidebar and responsive behavior

- Entering Home collapses the global left sidebar to the icon rail; mobile closes its sheet.
  Remember the previous non-Home sidebar state and restore it on exit. Do not rewrite the
  user's document sidebar preference. Explicitly expanding it on Home remains possible.
- Use the same browser for existing Catalog navigation; preserve old catalog/vendor/entry
  deep links and history. Do not retain a second independent catalog list implementation.
- At 390px, search stays directly available, the tree opens from Browse library in a
  labelled sheet, filters scroll horizontally within their row, and preview opens as a sheet. Grid becomes one column. Table prioritizes name
  and type without horizontal page overflow. On desktop the optional preview is a side panel.
- First visit: a concise empty Recent state with Browse diagrams and Explore templates.
  Catalog remains usable even when the workspace is empty or its API fails.

## Technical plan

1. Add an app-owned discriminated browse model with stable `workspace:<path>` and
   `catalog:<name>` IDs. Preserve distinct permissions/actions and optional metadata.
   Do not turn catalog entries into fake filesystem files.
2. Adapt existing workspace tree, thumbnail helpers and catalog store. Consolidate content
   reads behind the existing mtime cache; bound read concurrency and cancel stale searches.
   Component usage must not trigger a second full-workspace scan on every keystroke.
3. Add typed browser route state for collection/folder/query/filters/sort, with backwards
   compatibility for existing hashes. Persist only view preference/history locally; namespace
   history to the workspace and handle invalid/stale storage defensively.
4. Compose existing brand-ui Tree, Breadcrumb, Input, Table, dropdowns and Sheet.
   Share result/action semantics between grid and table. Keep app-specific logic in Diagram.
5. Use bounded result rendering (proposed pages of 48 items in both modes), lazy thumbnail
   loading and cached metadata. Begin with the existing local APIs; no new search service.
6. Preserve successful data when one source fails. Show source-specific retry, stale-preview
   fallback, safe missing-file behavior and clipboard/action failure feedback.

## Delivery sequence

1. Implement the approved direction for desktop/mobile, grid/table,
   Recent, mixed search and Catalog. Build one representative visual slice for review before
   implementing every collection. Include real long titles and missing descriptions.
2. Implement shared browse model, route/history state and unified search contracts/tests.
3. Implement the browsing shell, grid/table and sidebar lifecycle. Integrate document,
   component/template and catalog adapters; remove superseded Home sections.
4. Add preview/reuse actions within approved scope. Validate transitions and history return.
5. Independent functional and brand-ui/accessibility review; fix findings, repeat targeted
   browser checks, run repository gates, then merge the completed workstream to origin/main
   under the user's existing merge authorization.

Implementation can split into three owned streams after contract approval: data/search,
browser UI/shell, and preview/catalog actions. Integration and review stay with the orchestrator.

## Acceptance criteria

- Home opens to Recent; all five collections are directly reachable without scrolling.
- Catalog products/parts participate in browsing and global search, with correct detail links.
- Search finds an item by title, filename, content reference and catalog alias; every result
  explains what matched. Partial loading/failure is distinguishable from zero results.
- Grid/table show identical result sets and preserve state. Back from an opened item restores
  collection, query, filters and scroll. Reload preserves the documented preferences.
- Existing files open in view mode; browsing/search/preview performs no document writes.
- Enter/exit Home handles sidebar state as specified. Preview controls never open automatically.
- No viewport overflow at 390, 768 and 1440px; both themes, keyboard-only access, visible focus,
  labelled controls and reduced motion are checked in the browser.
- At least 1,000 mixed fixture items: no more than 48 result cards/rows mounted per page;
  warm search results update within 200ms after debounce on the documented local test machine.
  Record cold indexing separately; no API read per result per keystroke.
- Empty workspace, no history, missing thumbnails, long titles, missing descriptions,
  deleted recent items, failed catalog/workspace source and corrupt local storage are covered.
- No blocking review findings; scoped tests, typecheck, lint, formatting and required repo
  gates pass. CI status is reported separately from local validation.

## Scope limits and trade-offs

Browse/reuse delivers a coherent entrypoint with fewer destructive-action states. Full
management is a viable second phase but adds selection, bulk operations, undo/conflicts and
folder permissions. Account/shared history, favorites, drag/drop, catalog authoring, semantic
AI search and metadata enrichment are not assumed in this proposal.

Preserve user-authored files and source descriptions. This is a Home/browser redesign, not a
catalog content-writing exercise or a change to the diagram layout engine.

## Implementation and verification — 2026-09-29

Implemented in three parallel owned streams (data/search, browser UI/previews, shell/routes),
followed by independent read-only UX/accessibility review. The app uses existing UI primitives;
no backend, public schema, dependency or library API change is needed. Home and legacy Catalog
routes share one browser. Workspace files remain separate from catalog resources.

Verified locally:

- 506 diagram tests, including six browser-model/history/search tests; 98 repository gates
  and 470 gate fixtures pass. App typecheck passes; lint has zero errors and the existing
  11 warnings. Static brand-ui audit has zero blocking findings.
- Browser interaction suite passes in light and dark at 1440, 768 and 390px: search by
  content/accented title, actual preview, keyboard focus return, view-mode opening,
  opened history, catalog details, identical grid/table IDs, pagination, and zero document
  writes or page exceptions. Axe finds no serious/critical violations in the browser surface.
- Simulated workspace and catalog failures retain usable bundled catalog entries; explicit
  retries recover. This case also runs with reduced motion enabled.
- Sidebar browser proof covers prior-open/prior-closed desktop restoration, explicit Home
  expansion, Catalog transitions, and mobile sheet closure/reopening.
- Existing component-preview regression passes in both themes at desktop/phone widths;
  22 existing diagram navigation checks pass without writes or browser errors.
- Warm model search over 1,002 mixed items takes about 7ms in the local Node test; results
  are capped at 48 per page and indexing at eight concurrent reads. This is model timing,
  not a claim about cold indexing or all users' browser frame times.

Regression checks caught and fixed nested folder paths, catalog-detail close losing its
origin, missing tab-panel associations, synthetic hash events without URLs, and out-of-range
pagination controls, and inert Recent/search sort controls. Browser screenshots and machine-readable evidence are stored in the
local test output directory (`HOME_EVIDENCE`); they are not product source assets.

Independent review rechecked the pagination and sort fixes; no blocking findings remain.
Its four light/dark desktop/mobile Axe scans report zero violations. The adapted template
browser regression also passes YAML preservation, unique copy titles, visible copy markers,
folder/component usage links, keyboard retry recovery and clipboard fallback expiration.

Known unrelated baseline: the developer spec-check gallery expects 13 flows for the Qlik
Talend pipeline fixture while its current source renders 16. This redesign does not change
that fixture or its gallery expectation; that check was removed from the Home-specific
browser script rather than treating it as Home behavior.

## Explorer structure revision — 2026-09-29

The user requested a file-browser layout after reviewing the first Home implementation.
This revision supersedes collection tabs and the page-wide scrolling layout:

- The existing toolbar row now holds a location breadcrumb, including nested folders or
  catalog vendor. No second Home title or repeated collection heading occupies content space.
- A 224px desktop navigation pane contains Recent, the complete workspace folder hierarchy,
  Components, Templates, and Catalog vendors. Selection and breadcrumb follow Back/Forward.
- Search/New and the compact filter row remain above the results; pagination remains below.
  Only the results and navigation tree scroll. Table headers stay visible above scrolled rows.
- Mobile uses a Browse library sheet; selecting a destination closes it. Grid/table,
  preview, true recents, view-mode opening and nonfatal source failure/retry remain unchanged.

`tests/home-explorer.mjs` proves viewport containment, fixed controls, sticky headers,
nested folder selection/breadcrumb history, mobile navigation and both themes. The existing
Home library regression now uses the navigation tree and retains search/preview/history/
catalog/error recovery coverage.

Revision verification: 506 diagram tests, 98 repository checks and 470 gate fixtures pass;
typecheck, production build and strict static audit pass. Lint retains the existing 11
warnings with no errors. The full Home interaction matrix and dedicated explorer proof
pass in light/dark at 1440, 768 and 390px, including independently scrolling panes, fixed
controls, sticky table headers, deep breadcrumb overflow handling, and mobile navigation.
The independent review reports no open findings after the narrow breadcrumb fix. Existing
sidebar lifecycle and 22 diagram navigation checks also pass.
