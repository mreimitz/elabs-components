# YAML language service

The editor offers schema keys/enums, live document IDs, catalog icons and references,
workspace references, and node/zone/flow/component snippets. Workspace lookup searches
diagram titles and inserts the actual `ws/…` filename without its YAML extension.

ID suggestions and hover read the current YAML buffer. Catalog references inherit title,
kind, icon and description through the same `suppliedBy` function as the diagram; explicit
fields take precedence, including empty strings. Catalog parts inherit missing kind and
description from their icon entry. Qualified endpoints are added only from a graph compiled
from the exact current buffer, so an older diagram cannot supply stale inner IDs.

The component snippet inserts a node with `id`, `ref: ws/…` and `expand`, with two Monaco
tab stops for ID and reference. It defaults to the collapsed view and uses the shipped tenant diagram as its editable example. Story/step snippets
remain dependent on the story grammar; this change does not invent that grammar. Quick-fixes,
workspace thumbnail previews, outline and definition navigation are outside this slice.

Providers belong to one editor/model pair. Both completion and hover discard results after
cancellation, buffer edits, model replacement or disposal. Completion also rechecks read-only
state after catalog readiness; informational hover remains available in a read-only editor.
Both providers are released once on editor/model disposal, and release is idempotent.

API contracts were checked in `packages/editor/src/code-editor/code-editor.tsx` (`onMount`
passes the real Monaco namespace) and the installed Monaco declarations: completion/hover
providers return disposables, models expose `onWillDispose`, and editors expose `onDidDispose`.
Documentation uses untrusted Markdown with HTML disabled and local catalog icon paths.

Validation commands from `apps/diagram`:

- `node --test scripts/tests/endpoint-metadata.test.mjs scripts/tests/yaml-context.test.mjs`
- `DIAGRAM_URL=http://localhost:5423 node tests/editor-completions.mjs`
- `pnpm typecheck:local`, `pnpm lint:local`, `pnpm build:local`

The browser suite uses a disposable workspace file, actual Monaco keyboard acceptance,
hover images and snippet selections in light/dark, and held catalog readiness to prove
provider cancellation/disposal. It preserves workspace files outside its own fixture.
