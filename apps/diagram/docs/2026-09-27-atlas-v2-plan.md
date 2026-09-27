# Atlas — v2 product plan for apps/diagram

Date: 2026-09-27 · Status: decided with the maintainer (rounds 1–6 of questions, 2026-09-27); §9 lists what is still assumed · Builds on: `2026-09-26-plan.md` (v1, DG-01…19 all done), `2026-09-27-harvest-inventory.md` · Track: `../roadmap/README.md` § Atlas (DG-20 …)

## 1. What Atlas is

**Atlas** is the app's name from now on (title bar, home, share links). v1 proved the pipeline: YAML → FlowSpec → canvas, with zones, owners, providers, edges, legend, inspector, export, walkthrough. The maintainer's verdict: a good MVP that needs a lot of refinement, visually and functionally, and six things it lacks. v2 turns the MVP into a product a presales person opens every day:

> A workspace of architecture diagrams, built from a catalog of primitives and reusable components, that you write in YAML with real IntelliSense, watch come alive with data flowing through it, and walk a customer through as a story.

### The six asks, and what each becomes

| #   | Ask                                                               | Becomes                                                                                                                                                                                                                 |
| --- | ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | IntelliSense in the YAML editor                                   | **Language service** (§5): keys/enums from the schema, ids after `->`/`from:`/`to:`/`parent:`/`at:`/story targets, icons + components with rendered previews, snippets, quick-fixes                                     |
| 2   | Hierarchy: primitives → components → diagrams, reuse by reference | **Composition** (§4): `use:` nodes, live read-only references, collapsed composite with drill-down or expanded inline, dotted inner ids                                                                                 |
| 3   | Walkthrough with smooth zoom                                      | **Story engine** (§6): camera choreography (zoom-to-fit, follow-the-edge), narration + callouts, `story:` in YAML, autoplay, present mode with speaker notes, per-step export, share link, recording                    |
| 4   | Animated bubbles on connectors                                    | **Flow particles** (§7): cadence from `schedule`, look from `kind`, density from `volume`/`metrics`; always on, honours OS reduced motion; static in export                                                             |
| 5   | Homepage, recents, folders                                        | **Workspace + Home** (§3): a folder on disk served by a Vite middleware, folder tree, live thumbnails, components with usages, health tiles, start-from                                                                 |
| 6   | Every icon has name, description, docs link; hover card           | **Catalog** (§4.1): `catalog/<vendor>.yaml` metadata, filled by an LLM session through the MCP server (§11) and curated, overridable per node, editable in-app; the details card shows name, description, "Open docs ↗" |

Plus the maintainer's overall bar: **a full, impressive experience** — visual references are cloud reference architectures (structure), flat depth accents (elevation, provider tints, hairline rulers — the "quiet engineering" language of elabs-ai.com), editorial infographic (typography, callouts, title block), and a live-ops feel (particles, glow during stories, status).

## 2. Decisions (2026-09-27)

| #   | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ---- | ----------------------------------------------------------------------- | ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| V1  | **Hierarchy:** primitives (icons/glyphs, node kinds, zone kinds — shipped) → **components** (reusable sub-diagrams, `workspace/components/**`) → **diagrams**. Any diagram can be promoted to a component (moved into `components/`).                                                                                                                                                                                                                                                                                                     |
| V2  | **References are live and read-only.** `use: components/<path>` renders the source; changing the source changes every diagram that uses it, automatically. No per-instance overrides except `title`, `expand`, position.                                                                                                                                                                                                                                                                                                                  |
| V3  | **Two renderings per instance:** collapsed composite node (drill-down on double-click/Enter with a zoom-in transition and breadcrumb; peek thumbnail on hover) or expanded inline as a zone; `expand:` per instance, switchable on the canvas with a transition.                                                                                                                                                                                                                                                                          |
| V4  | **Inner ids are addressable:** flows may target `tenant.qca`; when collapsed, the edge ends at the composite's border on a small labelled port.                                                                                                                                                                                                                                                                                                                                                                                           |
| V5  | **Storage:** `apps/diagram/workspace/` on disk, read and written by a Vite dev middleware (`/api/workspace/*`). `components/` is the only root `use:` resolves from; everything else is free-form folders of diagrams. Git-versioned. No production backend.                                                                                                                                                                                                                                                                              |
| V6  | **Saving:** autosave (debounced) — the file is the truth; in-session undo; a Versions drawer from `git log` when the workspace is in Git.                                                                                                                                                                                                                                                                                                                                                                                                 |
| V7  | **View mode first:** opening a diagram shows the canvas full-width with story/present controls; **Edit** (key `E`) slides in the YAML editor and inspector. Several diagrams open as **tabs** in the top bar (dirty markers, ⌘W).                                                                                                                                                                                                                                                                                                         |
| V8  | **Home:** recent diagrams as live thumbnails (SVG snapshot saved on save), folder tree + component library side by side (components show "used in N"), start-from (blank / template / _describe it_ — hook only, see V13), health tiles (diagrams, components, usages, broken references, icons without descriptions), search across everything.                                                                                                                                                                                          |
| V9  | **Catalog metadata:** every catalog entry (icon or part) has `name`, `description`, `docs` (URL); nodes inherit and may override `description`/`docs`. Filled per vendor by an LLM session using the MCP tools `catalog.missing` / `catalog.update` (a prompt file in `mcp/prompts/` drives it), curated by the maintainer, stored in `catalog/<vendor>.yaml`, editable in-app with write-back. No API key anywhere.                                                                                                                      |
| V10 | **Catalog UX:** today's `#icons/<vendor>` pages become catalog pages (description, docs, "used in N diagrams", inline metadata edit); a catalog panel with drag-to-canvas (drops into the zone under the pointer and writes the YAML); ⌘K command palette insert.                                                                                                                                                                                                                                                                         |
| V11 | **Story:** `story:` section in YAML (steps with targets, title, markdown narration, callouts, duration); smooth camera (zoom-to-fit the step's elements, follow-the-edge for flows); rest dims; ←/→, play/pause/scrub, autoplay/kiosk loop; present mode with speaker notes (presenter window); one PNG/SVG per step; shareable story link (`#present&step=1`); WebM/GIF recording.                                                                                                                                                       |
| V12 | **Particles:** always on (no in-app switch); paused for OS reduced-motion; never in exports. Cadence from `schedule` (real-time = continuous stream · hourly = pulse ~2 s · nightly batch = one large blob ~6 s · on-demand = only while hovered), look from `kind` (data dots · request small arrows · access a user glyph · control dashed ticks · network faint dashes), density/size from a new `volume: low                                                                                                                          | medium   | high | <number>`and, when present,`metrics.throughput`.                        |
| V13 | **Live-ops semantics in YAML:** `status: ok                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | degraded | down | planned`on nodes/zones (dot + tone;`planned`ghosted/dashed),`phase: now | next | later`with a phase slider that dims/reveals, optional demo`metrics: {latency, throughput}` shown in the details card and feeding particle density; glow/highlight during stories. |
| V14 | **Atlas is an MCP server, not an AI client** (maintainer, 2026-09-27): the app never calls a model and holds no API key. The Vite dev server exposes `/mcp` (Streamable HTTP, same dependency-free JSON-RPC pattern as `packages/cli/lib/mcp.mjs` + `mcp-http.mjs`) so any LLM session (Claude Code, Claude Desktop, the brand-ui plugin) can list, read, create, compose, validate, render and present diagrams and curate the catalog. Home's "Describe it" becomes "Connect an LLM" (the MCP URL + a copyable client config). See §11. |
| V15 | **Visual bar:** cloud reference-architecture structure + flat depth accents + editorial infographic typography + live-ops feel. Every v1 surface gets a visual pass against this bar (§8, DG-20).                                                                                                                                                                                                                                                                                                                                         |

## 3. Experience design

### 3.1 Information architecture

```
Atlas
├── Home                     recents · folder tree · components · health · start-from · search
├── Workspace  (folder tree in the sidebar, always available)
│   ├── components/…         components (sub-diagrams); each shows "used in"
│   └── <any folders>/…      diagrams
├── Catalog                  vendors (aws, azure, …, k8s, generic) · parts · components; metadata edit
└── Diagram  [tabs]          View (default) ⇄ Edit (E)
    ├── canvas               zones, nodes, composites, particles, legend, title block, minimap, zoom
    ├── story bar            steps, play/pause, scrub, present, record
    ├── editor (Edit)        Monaco YAML + language service · problems
    └── inspector (Edit)     definition-driven form for the selection; catalog card for composites
```

The shell stays the **dashboard app shell** (v1). The sidebar's rail gets four sections: Home, Workspace (tree), Catalog, Settings. The top bar becomes: tabs (open diagrams) · view/edit toggle · story controls (view) or direction/layout/style (edit) · export · present · theme.

### 3.2 Home

- **Hero row:** search (`⌘K` also opens it), "New diagram", "New from template", "Connect an LLM" (a dialog with the MCP URL, a copyable Claude Code / Claude Desktop config block, and the three prompt files, V14/§11).
- **Recents:** cards with the saved SVG thumbnail (rendered on save at 480×270, light theme), title, folder path, last edited, a status chip if references are broken.
- **Two columns below:** the folder tree (expand, rename, move by drag, new folder; deletion moves to `_trash/`, never `rm`) and **Components** (thumbnail, name, description, "used in N diagrams" → click lists them).
- **Health tiles:** diagrams · components · usages · broken references · catalog entries without description — each tile links to the list that fixes it.

### 3.3 Diagram — view mode

- Canvas full-width. Top bar: tabs · **Edit** · story bar (if `story:` present) · **Present** · Export · theme.
- Hover on a node: the **details card** — mark, name, kind/provider eyebrow, description (markdown, 3 lines then "more"), `Open docs ↗` (new tab), status/metrics row when present; for a composite: a mini thumbnail (peek) and "Open component".
- Double-click/Enter on a composite: **drill-down** — camera zooms into the node, the child diagram cross-fades in, breadcrumb `Landscape › Qlik Cloud tenant` at the top; Esc or the crumb zooms back. Inside a component you are in view mode of that component (read-only unless it is opened in its own tab).
- Particles run (V12). Phase slider appears when any `phase:` exists.

### 3.4 Diagram — edit mode

- `E` or **Edit**: editor slides in from the left (40 %), inspector from the right (280 px); canvas stays live.
- Editor: language service (§5), problems panel, selection sync (v1), ⌘S is a no-op with a toast "Autosaved" (V6).
- Inspector: v1 form + `description`, `docs`, `status`, `phase`, `metrics`; for a composite instance: `use`, `expand`, `title` and a link to the source.
- Drag from the catalog panel onto a zone → the node is written into that zone's `children:` at the drop point (manual layout) or appended (auto layout).

### 3.5 Story and present

- **Story bar** (view mode, bottom-centre): step chips with titles, ◀ ▶, play/pause, scrub, autoplay toggle, "Present".
- Each step: the camera **animates** (600 ms, ease-in-out) to fit the step's `targets` (nodes, zones, edges, or a composite); for a single flow target the camera **follows the edge** while a particle travels it; everything not targeted dims to 35 %; `callouts` render as numbered editorial leaders pinned to elements; `text` shows in the caption (view) or presenter panel (present).
- **Present mode:** full-screen canvas, caption strip, keyboard ←/→/Space/Esc, presenter window (`window.open`, speaker notes + next step + timer) via `BroadcastChannel`.
- **Outputs:** per-step PNG/SVG (each framed exactly like the camera), story link `#present&step=n[&autoplay]`, WebM recording via `MediaRecorder` on the canvas element (GIF via a worker encoder only if WebM is not enough — decide in the item).

### 3.6 Catalog

- Vendor pages: grid with mark, name, one-line description; click → entry page: description (editable), docs link (editable), "used in" list, the YAML snippet to copy, aliases.
- Parts: catalog entries that are more than an icon (preset node: kind, icon, name, description, docs, badges) — e.g. `qlik/data-gateway` as a part with its real description. Stored in `catalog/parts/*.yaml`.
- Components section: the workspace's `components/` with thumbnails.

## 4. Composition model

### 4.1 Catalog (primitives + parts)

```yaml
# catalog/aws.yaml (generated once, curated)
lambda:
  name: AWS Lambda
  description: Run code without provisioning servers; pay per request.
  docs: https://docs.aws.amazon.com/lambda/
  kind: service # default node kind for this entry
  tags: [compute, serverless]
```

`catalog/parts/qlik-data-gateway.yaml` may add `subtitle`, `badges`, `defaults`. The icon index (`public/icons/index.json`) and the catalog merge into one **catalog service** the app, the validator and the language service all read.

### 4.2 Components and references

```yaml
# workspace/components/qlik-cloud-tenant.yaml — a normal diagram, promoted by location
diagram: "1"
title: Qlik Cloud tenant
component: { icon: qlik/cloud, description: A standard Qlik Cloud tenant with SSO, Talend DI and Analytics }
zones: …   nodes: …   flows: …

# workspace/customers/acme/landscape.yaml
nodes:
  - id: tenant
    use: components/qlik-cloud-tenant      # live, read-only reference
    expand: false                          # collapsed composite; true = inline zone
    title: Qlik Cloud (EU)                 # the only overrides: title, expand, position
flows:
  - erp -> tenant.qtdi: CDC via Data Gateway   # dotted inner id
```

Resolution: the workspace service resolves `use:` recursively (cycle = error), caches by path + mtime, and pushes a "source changed" event so open diagrams re-render (V2). Collapsed: the composite node shows the component's icon, title, child count and the ports needed by inner-targeted flows. Expanded: the component's zones/nodes are inlined under a zone titled by the instance, ids prefixed `tenant.`; inner flows render; layout treats it as a zone. Broken reference: a `destructive`-toned placeholder node with the path, listed in Home's health tile.

### 4.3 Dialect v1 additions (superset of v0)

- Top level: `component:` (marks + describes a component), `story:` (§6), `phases:` (optional labels).
- Nodes: `use`, `expand`, `description`, `docs`, `status`, `phase`, `metrics`.
- Zones: `description`, `docs`, `status`, `phase`.
- Flows: `volume`, `phase`; `schedule` gains `on-demand`.
- Ids: dotted inner ids valid only through a `use:` node.
- Version: `diagram: "1"`; v0 files load with a one-time upgrade (only the version key changes).

## 5. Language service (editor)

A Monaco **completion + hover + code-action provider** registered in `CodeEditor`'s `onMount`, fed by: the JSON Schema (keys, enums, docs strings), the live AST (ids with title + icon), the catalog service (icons with rendered previews via `ServiceLogo` in the suggestion detail — Monaco supports HTML in `documentation`; render the SVG inline), the workspace index (components for `use:`), and snippets (`node`, `zone`, `flow`, `story-step`). Quick-fixes: unknown id → "did you mean" (Levenshtein over ids), unknown icon → nearest catalog match, missing `expand` → insert. Hover on an icon name shows the catalog card. Path-aware: completion for `use:` walks `workspace/components/`.

## 6. Story engine

```yaml
story:
  autoplay: false
  steps:
    - title: Sources land in the lake
      targets: [erp, mssql, gateway] # nodes, zones, flows (by "a -> b"), or a composite
      text: |
        The gateway dials **out** only — no inbound ports.
      callouts: [{ at: gateway, text: Outbound 443 only }]
      duration: 8 # seconds when autoplaying
    - title: Load into Snowflake
      targets: ["gateway -> qtdi", "qtdi -> wh"] # two flows: camera follows each in turn
```

Camera: `fitBounds(targets, padding, 600ms)`; follow-the-edge = interpolate the viewport centre along the edge path over the step's particle travel time. The engine is a pure state machine (`step`, `t`, `playing`) consumed by the canvas (highlight/dim), the story bar, the presenter window and the exporter.

## 7. Flow particles

One `<canvas>` overlay in the React Flow viewport (transform-synced), drawing every visible edge's particles per frame (`requestAnimationFrame`, capped at 60 fps, skipped off-screen). Per edge: a cadence profile from `schedule`, a sprite from `kind`, a density from `volume`/`metrics.throughput`, speed scaled by zoom so motion reads the same at any level. Reduced motion → no overlay. Export → overlay excluded. Stories → particles on non-targeted edges fade with the dimming.

## 8. Visual pass (the "impressive" bar)

A dedicated item (DG-20) before features: zone frames with corner labels and hairline rulers, provider tints as soft header gradients, elevation rungs (canvas < zone < node), typography rungs from the title block down to edge chips, edge chips as editorial callouts, a title block with description/source line, a proper empty state, loading skeletons, and motion tokens for every transition (camera, drill-down, expand, panels). Reviewed with the maintainer on the three v1 examples plus one composite example before any feature item starts.

## 11. The Atlas MCP server (V14)

**Why:** the dialect was designed to be LLM-friendly; the natural author of a diagram is a Claude session with the customer context in front of it. Atlas therefore exposes itself as an MCP server; the app stays the renderer, the editor and the presenter.

**Transport and shape:** `GET/POST /mcp` on the dev server (Vite middleware, DG-35), Streamable HTTP, JSON-RPC 2.0 implemented like `packages/cli/lib/mcp.mjs` (pure `handleMessage`, an HTTP adapter, no SDK dependency); `initialize`, `tools/list`, `tools/call`, `resources/list`, `resources/read`, `prompts/list`, `prompts/get`. Localhost only; a session id per client; no auth (single-user dev tool, §9.1).

**Tools (v1):**

| Group     | Tool                                      | What it does                                                                                                                                                                       |
| --------- | ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| workspace | `workspace.tree`                          | folders, diagrams, components with titles and mtimes                                                                                                                               |
|           | `diagram.read` / `diagram.write`          | YAML in/out by path (write = the same atomic write the app uses; the open tab live-reloads)                                                                                        |
|           | `diagram.create`                          | from a title + optional template or a structured `{ zones, nodes, flows }` object → YAML on disk                                                                                   |
|           | `diagram.move` / `diagram.trash`          | with the same safety as the UI                                                                                                                                                     |
| spec      | `spec.schema`                             | the dialect JSON Schema (v1)                                                                                                                                                       |
|           | `spec.validate`                           | issues `{ path, code, message, line, col }` for a YAML text — the LLM fixes before writing                                                                                         |
|           | `spec.compile`                            | the resolved model (ids, zones, flows, composites) as JSON — for questions like "what talks to what?"                                                                              |
| compose   | `compose.add_nodes` / `add_flows` / `set` | surgical edits through the same write-back the inspector uses (comments and order preserved)                                                                                       |
|           | `compose.use_component`                   | insert a `use:` node                                                                                                                                                               |
|           | `story.set_steps`                         | write or replace the `story:` block                                                                                                                                                |
| catalog   | `catalog.search` / `catalog.get`          | icons, parts, components with metadata                                                                                                                                             |
|           | `catalog.missing` / `catalog.update`      | entries lacking description/docs; write-back — how the catalog gets filled                                                                                                         |
| render    | `diagram.render`                          | PNG (base64 image content) of a diagram: the server asks the open app tab over the SSE channel to export; if no tab is open it says so. This is how a session _sees_ what it made. |
|           | `diagram.open` / `story.present`          | tell the open tab to navigate to a diagram / start a story — for live demos driven from a chat                                                                                     |

**Resources:** `atlas://workspace/<path>` (YAML), `atlas://catalog/<vendor>`, `atlas://schema/v1`. **Prompts:** `author-diagram` (from a prose description, with the dialect cheat-sheet), `fill-catalog <vendor>`, `write-story <path>`.

**Skill for the brand-ui plugin:** `mcp/skills/atlas/SKILL.md` teaches a Claude Code session the workflow (validate → write → render → look → fix), so the maintainer's own tooling picks it up.

## 9. Assumptions — decided by the maintainer's "do it as you think best" (2026-09-27)

All eight below stand as decisions unless he objects; plus three more resolved the same way: (a) ~~the catalog LLM pass uses an API key~~ **superseded 2026-09-27: no API key; the catalog is filled by an LLM session through the MCP server (§11)**; (b) the v1 `#icons/*` sheet and the sidebar "Icon packs" group are replaced by the Catalog (`#icons/*` redirects); (c) DG-20's visual pass is the first item and needs his explicit acceptance before wave 1.

1. Single user, single workspace; no auth; the dev middleware is only ever reached from localhost.
2. Thumbnails are light-theme SVGs stored beside the diagram as `<name>.thumb.svg` (Git-tracked; small).
3. A component may itself use components (nesting allowed, cycles rejected); drill-down goes as deep as the tree.
4. Moving/renaming a component file rewrites `use:` paths in every diagram that references it (the workspace service does it; Git shows the diff).
5. The catalog LLM pass runs once as a script with a key from `.env` (not in the app), output committed; V14 stays a stub in the app.
6. Present mode's presenter window is optional; single-screen presenting works with the caption strip alone.
7. WebM is the recording format; GIF only if you ask for it.
8. Keyboard: `E` edit, `P` present, `⌘K` palette, `⌘W` close tab, `←/→` story, `Esc` back/up.

## 10. Track

`../roadmap/README.md` § Atlas lists DG-20 … DG-35 with waves (DG-35 = the MCP server, wave 1). Items are hardened (verified imports, Steps→Check, skeletons, stop conditions) before their wave starts, as v1 established; DG-20 (visual pass) and DG-21 (workspace service) are hardened first.
