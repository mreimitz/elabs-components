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
node scripts/tests/reference-browser.mjs
for title_form in block anchored aliased flow anchored-multiline; do
  ATLAS_TITLE_FORM="$title_form" node scripts/tests/home-browser.mjs
done
node tests/sidebar-search.mjs
node scripts/check-view-mode.mjs
node tests/lens-recovery.mjs
node tests/lens-motion.mjs
```

| Check                 | What it exercises                                                                                                                 |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Reference Node checks | Migration preserves compiled drawings, catalog appearances and copied stand-ins; invalid CLI inputs do not partially write files. |
| Reference browser     | Live catalog metadata, inspector controls, subtitle clear/restore, retained keyboard focus and Backspace safety.                  |
| Home Node checks      | YAML title-copy semantics, comments, line endings, template preservation and copy markers.                                        |
| Home browser          | Real template copies, distinct names across navigation surfaces, Retry focus, clipboard fallback and phone layouts.               |
| Sidebar search        | Matching names and content, visible evidence at nested widths, sequential queries, keyboard access and folder-state restoration.  |
| View mode             | Personal overrides, external edits, mode changes, mobile canvas, presentation controls and thumbnail readiness.                   |
| Lens interactions     | Shipped diagrams, routing geometry, read-only write/history guards, keyboard drill-down, refit and export.                        |
| Lens motion           | First switch, resize, reversal, shared camera, persistent controls and reduced motion, with frame measurements.                   |

`ATLAS_EVIDENCE` saves Home/reference screenshots. `SEARCH_EVIDENCE_DIR`, `VIEW_EVIDENCE` and `LENS_EVIDENCE_DIR` save the respective stream's artifacts. Choose separate output folders. The development routes `#dev/spec-check` and `#dev/lens-check` expose the specification and lens fixtures; fixture counts grow as regressions are added.

Run motion measurements without concurrent builds or other browser suites on the same machine. Record source-ready preparation separately from a switch requested during document loading, and retain the full request-to-settle time for that loading case. A smooth tween does not establish that the first click responds promptly.

Browser checks complement independent review. Inspect affected surfaces at desktop and phone widths in settled light and dark themes, including keyboard focus and disabled states. Keep results tied to the commit tested, and repeat relevant checks after integrating overlapping workstreams.

When a browser check reads a store directly, import the exact module URL loaded by Vite, including its update query, and assert the current document identity first. A bare import after a hot update can create a separate store instance. Await asynchronous predicates explicitly. Both lens renderers can remain mounted during a transition, so scope canvas locators to the intended lens and wait for its actual visible state. Set up saved edits in the technical lens with Edit enabled.
