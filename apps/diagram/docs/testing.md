# Atlas local verification

Atlas is excluded from the monorepo's standard Turbo tasks. A successful repository check does not establish that this app builds or that its browser workflows work.

From the repository root, run these gates sequentially:

```sh
pnpm --filter @elabs-ai/diagram typecheck:local
pnpm --filter @elabs-ai/diagram lint:local
pnpm --filter @elabs-ai/diagram build:local
pnpm brand-ui audit --strict apps/diagram/src
```

Typecheck and build both copy the theme sources. Finish them before starting browser checks; running them together or during browser checks can cause transient filesystem or Vite reload failures.

## Regression checks

Use an isolated checkout with dependencies installed. The browser checks create disposable workspace files; the reference check also temporarily changes a catalog entry and restores it. Run them sequentially against the server belonging to that same checkout. Do not point these checks at a workspace someone is editing.

Start the server from `apps/diagram` in one terminal:

```sh
node scripts/copy-themes.mjs
pnpm exec vite --host 127.0.0.1 --port 5410 --strictPort
```

In another terminal, start at the repository root. The existing Home app supplies Playwright:

```sh
export PLAYWRIGHT_MODULE="$(pnpm --dir apps/home exec node --input-type=module -e "console.log(import.meta.resolve('@playwright/test'))")"
cd apps/diagram
export ATLAS_URL=http://127.0.0.1:5410
export DIAGRAM_URL="$ATLAS_URL"

node --test scripts/tests/reference-regressions.test.mjs
node --test scripts/tests/home-titles.test.mjs
node --test scripts/tests/yaml-context.test.mjs
node --test scripts/tests/visual-core.test.mjs
node --test scripts/tests/visual-layout.test.mjs
node --test scripts/tests/visual-completions.test.mjs
node --test scripts/tests/story-completions.test.mjs
node --test scripts/tests/story-dialect.test.mjs
node --test scripts/tests/story-runtime.test.mjs
node --test scripts/tests/story-markdown.test.mjs
node --test scripts/tests/endpoint-metadata.test.mjs
node --test scripts/tests/reference-endpoints.test.mjs
node --test scripts/tests/node-details.test.mjs
node --test scripts/tests/component-resolver.test.mjs
node --test scripts/tests/inline-expansion.test.mjs
node --test scripts/tests/composite-navigation.test.mjs
node --test scripts/tests/composite-ports.test.mjs
node --test scripts/tests/catalog-generic.test.mjs
node --test scripts/tests/live-view-url.test.mjs
node scripts/tests/reference-browser.mjs
for title_form in block anchored aliased flow anchored-multiline; do
  ATLAS_TITLE_FORM="$title_form" node scripts/tests/home-browser.mjs
done
node tests/sidebar-search.mjs
node tests/tab-bar.mjs
node tests/lens-navigation.mjs
node tests/editor-completions.mjs
node tests/visual-authoring.mjs
node tests/visual-mcp.mjs
node tests/diff-editor-lifecycle.mjs
node tests/details-card.mjs
node tests/component-references.mjs
node tests/inline-expansion.mjs
node tests/composite-interactions.mjs
node tests/composite-ports.mjs
node tests/story-interactions.mjs
STORY_MOTION=1 node tests/story-interactions.mjs
node tests/story-room.mjs
node tests/story-example.mjs
node tests/catalog-generic.mjs
node tests/live-view.mjs
node tests/live-view-shell.mjs
node scripts/check-view-mode.mjs
node tests/lens-recovery.mjs
node tests/lens-motion.mjs
```

| Check                 | What it exercises                                                                                                                      |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Reference Node checks | Migration preserves compiled drawings, catalog appearances and copied stand-ins; invalid CLI inputs do not partially write files.      |
| Reference browser     | Live catalog metadata, inspector controls, subtitle clear/restore, retained keyboard focus and Backspace safety.                       |
| Component resolver    | Reference inheritance, missing and invalid files, bounded cycles/depth, shared dependency discovery and fresh contents across calls.   |
| Inline expansion      | Namespaced instances, real inner endpoints, bounded projection, read-only imported content, manual fallback and source preservation.   |
| Home Node checks      | YAML title-copy semantics, comments, line endings, template preservation and copy markers.                                             |
| Home browser          | Real template copies, distinct names across navigation surfaces, Retry focus, clipboard fallback and phone layouts.                    |
| Sidebar search        | Matching names and content, visible evidence at nested widths, sequential queries, keyboard access and folder-state restoration.       |
| YAML context          | Scalar replacement, comments, quotes, flow mappings, array values and layout-dependent schema traversal.                               |
| Editor completions    | Real Monaco popup, references, inherited metadata, icon previews, snippets, provider lifecycle and collapsed inner endpoints.          |
| Tab bar               | Tab overflow and selection, responsive visibility, keyboard focus, close confirmation, and sidebar/theme controls.                     |
| View mode             | Personal overrides, external edits, mode changes, mobile canvas, presentation controls and thumbnail readiness.                        |
| Lens navigation       | Fresh loads paint one lens; rapid reversals, mid-morph tab changes, stable tab positions, delayed A-B-A reads, Back/Forward and Retry. |
| Lens interactions     | Shipped diagrams, routing geometry, read-only write/history guards, keyboard drill-down, refit and export.                             |
| Lens motion           | First switch, resize, reversal, shared camera, persistent controls and reduced motion, with frame measurements.                        |

`CATALOG_EVIDENCE` saves real MCP catalog creation/update results, both theme/phone cases and axe scans. These checks create temporary catalog vendor files and verify that SSE refreshes do not reload the page or create duplicate stores.

`DETAILS_EVIDENCE` and `COMPONENT_EVIDENCE` save detail-card and workspace-reference browser results. Detail-card checks cover measured description expansion, safe links, empty overrides, read-only interaction and axe at desktop/phone widths in both themes. Component checks exercise live referenced-file changes, stale navigation guards and actual MCP rejection without partial writes.

`INLINE_EVIDENCE` saves the expanded-template checks in both themes at desktop and phone widths. They use disposable copies, verify original parent/component hashes, and exercise imported-content write guards and the manual-layout fallback. Run them after changing compiler origins or manual-layout interactions.

`STORY_EVIDENCE` saves story playback, keyboard, temporary expansion and camera checks. Run `story-interactions.mjs` once normally for the reduced-motion theme/phone matrix and once with `STORY_MOTION=1` for real camera animation. `story-example.mjs` records the shipped six-step ClickHouse example, verifies flow following and checks unchanged source bytes. `STORY_ROOM_EVIDENCE` saves `story-room.mjs` checks for expanded legends and navigation at 390, 900 and 1440 pixels; this runner needs `PLAYWRIGHT_MODULE` to resolve `@playwright/test`, including its `expect` export. Choose a separate evidence folder for each run. Run navigation and editor regressions after changing the playback lifecycle.

`COMPOSITE_EVIDENCE` saves real expansion and nested inspection checks, including parent text/model/history preservation and child write refusal. `PORT_EVIDENCE` saves exact SVG endpoint comparisons against named handles in both layout directions and themes. Wait for visible, laid-out nodes before measuring geometry; edge routes can appear before staged nodes become visible.

`LIVE_EVIDENCE` saves live-picture construction, invalid/missing recovery, reference refresh and theme/phone checks. The shell companion checks retained dirty text, unload protection, external-change conflicts and cancellation of post-unmount thumbnail work. Run both after changing the shared SSE connection or autosave lifecycle.

`EDITOR_EVIDENCE` saves completion screenshots and results, including story snippets, schema keys and quoted flow-target completion in inline and block lists. `ATLAS_EVIDENCE` saves Home/reference screenshots. `SEARCH_EVIDENCE_DIR`, `VIEW_EVIDENCE` and `LENS_EVIDENCE_DIR` save the respective stream's artifacts. Choose separate output folders. The development routes `#dev/spec-check` and `#dev/lens-check` expose the specification and lens fixtures; fixture counts grow as regressions are added.

Run motion measurements without concurrent builds or other browser suites on the same machine. Record source-ready preparation separately from a switch requested during document loading, and retain the full request-to-settle time for that loading case. A smooth tween does not establish that the first click responds promptly.

Browser checks complement independent review. Inspect affected surfaces at desktop and phone widths in settled light and dark themes, including keyboard focus and disabled states. Keep results tied to the commit tested, and repeat relevant checks after integrating overlapping workstreams.

When a browser check reads a store directly, import the exact module URL loaded by Vite, including its update query, and assert the current document identity first. A bare import after a hot update can create a separate store instance. Await asynchronous predicates explicitly. Both lens renderers can remain mounted during a transition, so scope canvas locators to the intended lens and wait for its actual visible state. Set up saved edits in the technical lens with Edit enabled.

`NAVIGATION_EVIDENCE` saves cold-load screenshots and navigation results. These checks deliberately do not toggle lenses to normalize the initial render. They delay file responses to prove that obsolete reads cannot replace the selected document.

The diff lifecycle check stresses rapid preview closure while a normal YAML editor remains mounted. The local Monaco 0.55.1 patch keeps global hover and markdown services at the standalone service lifetime; it is a repository dependency repair, separate from the published DiffEditor view-model cancellation fix.

## Style profiles and lens integration

Run `node --test scripts/tests/style-profiles.test.mjs` for loader/cascade/config/schema and renderer contract checks. With the isolated server running, `DIAGRAM_URL=http://localhost:5444 node tests/style-mcp.mjs` proves server validation and `DIAGRAM_URL=http://localhost:5444 node tests/style-profiles.mjs` checks actual four-theme paint, read-only switching, mid-morph theme changes and config reload. The browser check temporarily replaces `workspace/atlas.config.yaml` and restores it in `finally`; use only the test checkout. Optional `STYLE_EVIDENCE` saves screenshots and JSON.

## Offline interactive publishing

The normal `build:local` also builds the self-contained viewer template. In an isolated checkout with the server running, use:

```sh
node --test scripts/tests/publish-snapshot.test.mjs scripts/tests/flow-observer.test.mjs
PUBLISH_EVIDENCE=/tmp/atlas-publish DIAGRAM_URL=http://localhost:5442 node tests/publish-viewer.mjs
PUBLISH_EVIDENCE=/tmp/atlas-publish node tests/publish-controls.mjs
```

Install the existing Playwright Chromium, Firefox and WebKit engines before this matrix. The first script downloads actual menu exports, records raw/gzip sizes (budget: 3 MiB gzip), compares fixed-profile paint against the authoring app and opens each file offline at 1440 and 390 pixels. Four diagrams across three engines yield 24 cases. It waits for both canvas and chrome to settle before screenshots. The second script reuses the generated adversarial artifact for six interaction cases and nine tampered-file refusals. Both reject external network attempts and unexpected browser errors.

Notes and metrics, including inherited note nodes and nested referenced content, are excluded. Required targets removed by that policy fail export rather than silently changing the story. Public narrative remains. The immutable publishing theme/profile and authored initial technical drawing are retained; transient camera/expansion choices are not. See [DG-43](findings/DG-43.md) for privacy and build boundaries.

The installed React Flow ESM observer patch has eight lifecycle/coalescing regressions. After changing it, also run `tests/lens-navigation.mjs`, `tests/composite-interactions.mjs`, `tests/story-interactions.mjs` and `scripts/check-view-mode.mjs` sequentially against the isolated server. Do not run builds or edit source during these browser checks: Vite reloads invalidate transient-state evidence. This patch is repository-local, not an upstream UMD or release guarantee.
