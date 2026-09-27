# DG-35: Atlas MCP server findings

These were found while building the Atlas MCP server on 2026-09-27, on `diagram/dg-35-mcp`
(from `diagram/atlas-integrate` 282f6f60), in the R1 scope: 12 tools, the `author-diagram`
prompt, no tab bridge, no resources. Every call below went over HTTP JSON-RPC to a dev server
on :5197; the browser parts ran in Chromium through `agent-browser`.

There are no library gaps: the server is app code under `apps/diagram/server/` and uses no
`@elabs-ai/components-*` API.

## The proof session (step 9, adapted to R1)

A scratch Node script played the model. It asked for `author-diagram` with the item's three
sentences (a retailer on AWS Lambda behind API Gateway, orders in DynamoDB streamed to
Snowflake, staff on Qlik Cloud dashboards, customers from the internet).

| #   | Method                      | Tool             | Answer | ms  | What happened                                                                             |
| --- | --------------------------- | ---------------- | ------ | --- | ----------------------------------------------------------------------------------------- |
| 1   | `initialize`                |                  | ok     | 10  | `2025-06-18`, capabilities `{ tools, prompts }`                                           |
| 2   | `notifications/initialized` |                  | 202    | 1   | no body                                                                                   |
| 3   | `prompts/get`               |                  | ok     | 2   | `author-diagram`, one user message of 3 788 characters                                    |
| 4   | `tools/list`                |                  | ok     | 1   | 12 tools                                                                                  |
| 5   | `tools/call`                | `workspace_tree` | ok     | 3   | `components`, `examples` and four example files                                           |
| 6   | `tools/call`                | `spec_validate`  | ok     | 4   | the draft: `ok: false`, `unknown-endpoint` at `flows[2].to`, line 55, col 13 (on purpose) |
| 7   | `tools/call`                | `spec_validate`  | ok     | 2   | after the fix (`dynamo` → `orders`): `ok: true`, no issues                                |
| 8   | `tools/call`                | `diagram_create` | ok     | 5   | `proof/retail.yaml`, 1 298 bytes, no warnings                                             |
| 9   | `tools/call`                | `compose_set`    | ok     | 17  | `flow:orders->warehouse` → `{ label: "Orders, streamed", animated: true }`                |
| 10  | `tools/call`                | `diagram_read`   | ok     | 2   | the flow line reads `{ label: "Orders, streamed", kind: data, animated: true }`           |
| 11  | `tools/call`                | `diagram_trash`  | ok     | 10  | `_trash/2026-09-27T13-30-40-021Z-proof` (deleted afterwards)                              |
| 12  | `tools/call`                | `workspace_tree` | ok     | 2   | back to the examples only                                                                 |

The tab had `#d/proof/retail.yaml` open before step 9. It showed "Order stream" before the
`compose_set`, and "Orders, streamed" two seconds after it, with no reload by hand: DG-21's live
reload redraws the open file on every MCP write. `DG-35-proof.png` is that tab after the fix
(1440 × 900): three zones, seven nodes, six flows, and the animated dashed flow into Snowflake.

## Decisions and deviations

### 1. The R1 box cut the tab bridge and resources

- **Not built:** step 7 (`tab-bridge.mjs`, `tools/render.mjs`, `diagram_open`, `diagram_render`,
  `story_present`, `POST /render-result`, `events.send`, `onServerEvent`, `tab-requests.ts`),
  `resources.mjs` and `write-story.md`.
- **Capabilities** are `{ tools: {}, prompts: {} }`. `resources/list` still answers
  `{ resources: [] }` from an empty stub in `workspace-plugin.mjs`, and `resources/read` answers
  `-32002 Resource not found` (ran for `atlas://schema/v0`).
- `handler.mjs`'s header comment says so; the rest of the file is the reference's.

### 2. The prompt's step 5 names the tab URL

- **Why:** without `diagram_render`, the user sees the diagram only in the tab. A new file does
  not open itself there.
- **What I chose:** the prompt tells the model to ask the user to look at the open tab, and
  gives the route `#d/<path>` with the default dev-server URL as an example. The item does not
  settle how the model points the user at a new file; naming the route is the smallest
  instruction that works with DG-22's router.

### 3. Claude Desktop: the `mcp-remote` form only

- **Why:** the orchestrator ruled that Claude Desktop's config starts local commands, so the
  README shows the `mcp-remote` block as the one form, with a line saying it is not verified.
- **Effect on the step-8 check:** `grep -c '"url": "http://localhost:5180/mcp"'` answers `0`,
  not `1`. The `mcp-remote` line answers `1`, and the Claude Code line answers `1`.
- DG-23 is not merged, so there is no `connect-info.ts` to compare against. The README says it is
  the source; DG-23 copies it.

### 4. The proof session opened the tab before the fix

- **Item order:** create, then `compose_set`, then open the tab and screenshot.
- **What I did:** create, open the tab, then `compose_set`, then screenshot. The end state is the
  same. This order also shows the prompt's claim that the open tab redraws after an MCP write.

## Problems found in other items (not fixed here)

### 5. Duplicate React key in the canvas skeleton

- **Where:** `src/panes/canvas-pane.tsx` L145 keys the loading skeleton's zones by their class
  string, and two of them are `"col-span-2 h-36"`.
- **Evidence:** every document open logs React's "Encountered two children with the same key"
  error in the console (seen on `examples/lakehouse-aws.yaml`). This item does not touch
  `canvas-pane.tsx`, so the error predates it.
- **Why not fixed:** `canvas-pane.tsx` is outside this item's `touches`.

### 6. Vite's "Assets in public directory" warning now also comes from the server

- `icon-names.ts` imports `public/icons/index.json` directly since the React-free split.
  `server-surface.ts` loads it through `ssrLoadModule`, so the dev-server log prints Vite's
  "Assets in public directory cannot be imported from JavaScript" warning on server loads too
  (16 times over this session's restarts and edits). `register-packs.ts` already did this in the
  browser (verified-apis, "Atlas wave 1"). It is harmless; the JSON still loads.
