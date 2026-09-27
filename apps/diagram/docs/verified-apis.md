# Verified library APIs for apps/diagram

Verified against `main` @ cec46c39 on 2026-09-26 by reading the source. **Every DG item imports exactly these names.** If a name below is missing when you run `typecheck:local`, the library changed: stop, re-verify in the source file named here, and report — do not guess a replacement.

## How to work a DG item (for any agent tier)

1. Read the item file, this document, and `2026-09-26-plan.md` §2 (D1–D14).
2. Work the numbered **Steps** in order. After each step run its **Check** and paste the output into your report. A failing check stops the item.
3. Touch only files in the item's `touches`. Need another file? Stop and report.
4. Never install a dependency the item does not list.
5. "Done" = every Acceptance line proven with a screenshot/recording from the running dev server (`pnpm --filter @elabs-ai/diagram dev`, http://localhost:5180). Typecheck-green is not done.
6. When the library lacks something: write it into `docs/findings/DG-NN-<topic>.md` (what, where you needed it, proposed API), work around it in the app with a `// P4: library gap — <what>` comment, and continue.

## tokens — `@elabs-ai/components-tokens`

```ts
import {
  ThemeProvider,
  useTheme,
  BUILT_IN_THEME_DEFINITIONS,
  defineTheme,
  type ThemeDefinition,
} from "@elabs-ai/components-tokens";
// ThemeProvider props: { children, themes?: ThemeDefinition[] (REPLACES the registry — spread built-ins), defaultTheme?: string }
// useTheme(): { theme: string, setTheme(theme: string), themes: readonly string[], ... }
```

CSS (source: `packages/tokens/package.json` exports): only three subpaths exist —

```css
@import "@elabs-ai/components-tokens/styles.css"; /* the engine + neutral :root */
@import "@elabs-ai/components-tokens/themes/light.css";
@import "@elabs-ai/components-tokens/themes/dark.css";
```

**Brand theme families are NOT package subpaths.** They live in the repo at `themes/<slug>/` (`qlik`, `clickhouse`, `salesforce`, `snowflake`, `ocean`, `graphite`, `heap`, `claude`) and are used by **copying the folder into the app** (`themes/README.md` steps 1–4):

```
themes/qlik/qlik-fonts.css  themes/qlik/qlik-light.css  themes/qlik/qlik-dark.css  themes/qlik/fonts/  themes/qlik/theme.ts
```

`theme.ts` exports `qlikThemes: ThemeDefinition[]` with values `"qlik-light"` / `"qlik-dark"`. Import order in the app CSS: engine → light/dark → `<slug>-fonts.css` → `<slug>-light.css` → `<slug>-dark.css`; then, once, the dark-variant line listing **every** dark theme registered:

```css
@custom-variant dark (&:where([data-theme="dark"], [data-theme="dark"] *, [data-theme="qlik-dark"], [data-theme="qlik-dark"] *));
```

`apps/home` copies families with `scripts/gen-home-themes.mjs` at postinstall into a git-ignored `apps/home/themes/`. The diagram app does the same (its own small copy script, git-ignored `apps/diagram/src/themes/`).

## ui — `@elabs-ai/components-ui` (all from the root barrel `packages/ui/src/index.ts`)

```ts
import {
  // shell (packages/ui/src/components/sidebar/index.ts)
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuBadge,
  SidebarInset,
  SidebarTrigger,
  SidebarRail,
  SidebarSeparator,
  useSidebar,
  // split (packages/ui/src/components/resizable/index.ts — react-resizable-panels)
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
  // controls
  Button,
  IconButton,
  Badge,
  StatusBadge,
  Heading,
  Text,
  Kbd,
  Input,
  Label,
  Switch,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  AlertDialog /* + AlertDialog* parts */,
  HoverCard /* + HoverCard* parts */,
  Combobox,
  TagInput,
  StatePanel,
  Skeleton,
  Toaster,
  toast /* sonner re-export, packages/ui/src/components/sonner */,
  // forms (packages/ui/src/components/schema-form/index.ts)
  SchemaForm,
  fromJsonSchema,
  normalizeFormSpec,
  type FormSpec,
  type FieldSpec,
  type FormValues,
  cn,
} from "@elabs-ai/components-ui";
```

Verify any prop you are unsure of with `pnpm brand-ui docs <Component>` or by opening the component file — never from memory.

### ui wave-2 names (DG-12, DG-13)

Verified against `packages/ui/src/` @ ee5c91dc on 2026-09-26 by reading the source. Index lines are `packages/ui/src/index.ts`.

```ts
import {
  cn, // L17
  Badge, // L165
  Button, // L169
  ConfirmDialog, // L182; confirm-dialog.tsx props L19–56, function L91
  Kbd, // L212
  ScrollArea, // L242 — see the gap below
  SidebarMenuButton, // sidebar L249; sidebar.tsx L763: asChild?, isActive? (L767), tooltip? (L768)
  StatePanel, // L257
  StatusBadge, // L258; status-badge.tsx CustomStatus { label, tone, icon? } L82–87; size "sm" | "md" L295–299
  type CustomStatus,
  ThemeSwitcher, // L267
  ToggleGroup, // L272; toggle-group.tsx L21, variant "segmented" L32
  ToggleGroupItem, // toggle-group.tsx L44
  Text, // L279
} from "@elabs-ai/components-ui";
```

- **ConfirmDialog** is controlled: `open`, `onOpenChange`, `title`, `description` (required), `confirmLabel?`, `cancelLabel?`, `onConfirm`, `onCancel?`, `tone?: "default" | "destructive"`, `loading?`. The confirm button calls `event.preventDefault()` (L108–113), so the dialog stays open until the app sets `open` to false in `onConfirm`.
- **SidebarMenuButton** `isActive` only writes `data-active` (the look). Set `aria-current` yourself. Its `tooltip` is hidden unless the sidebar is collapsed (L806).
- **Gap:** `ScrollArea` wraps its content in Radix's `display: table` div, which grows to the longest line and defeats `truncate` (seen in the browser during DG-12 hardening). Use a plain `max-h-* overflow-y-auto` box for a list of long messages and record it as a P4 gap.

## icons — `@elabs-ai/components-icons`

```ts
import {
  ServiceLogo,
  registerServiceLogos,
  clearServiceLogos,
  AppIcon,
  type ServiceLogoRegistry,
} from "@elabs-ai/components-icons";
// registerServiceLogos({ "aws/lambda": { src: "/icons/aws/lambda.svg", label: "AWS Lambda" } })
// <ServiceLogo name="aws/lambda" size={40} variant="brand" | "mono" decorative />
// Unknown name → monogram fallback with aria-label. `src` must be same-origin (Vite `public/` → "/icons/...").
// variant="mono" on a `src` entry applies CSS grayscale (service-logo.tsx L126).
```

Generic glyphs: named imports from `lucide-react` only (`import { Database } from "lucide-react"`), never a barrel.

## flow — `@elabs-ai/components-flow`

```ts
import {
  CanvasShell, // props = ReactFlowProps + { background?: boolean (default true), helperLines?: boolean, fitViewKey?, fitViewKeyOptions? }
  FlowNode,
  FlowGroupNode,
  FlowEdge, // built-ins; type keys "brand", "group", "brand"
  FlowNodeCard, // props: { tone?: FlowTone, emphasis?: FlowEmphasis, selected?: boolean } & div props — the node box
  FlowPort, // props: Omit<HandleProps,"id"> & { port?: string; id?: string } → handle id "in:<port>" / "out:<port>"
  flowPortId, // (type: "source"|"target", port) => "out:x" | "in:x"
  FlowToneIndicator,
  resolveFlowTone,
  flowToneVariants,
  type FlowTone,
  type FlowToneInput,
  type FlowEmphasis,
  type FlowNodeBaseData, // { title: string; icon?: ReactNode; tone?: FlowToneInput; emphasis?: FlowEmphasis }
  FlowEdgePath,
  EdgeLabelPill, // every custom edge draws its path through FlowEdgePath
  FlowSmartEdge,
  FlowFloatingEdge,
  FlowWeightedEdge,
  useFlowGroups, // returns { groupNodes(ids, opts?), groupSelection(opts?), ungroup(id), collapseGroup(id), expandGroup(id), toggleCollapse(id) }
  layoutFlowElk, // (nodes, edges, options) => Promise<{ nodes, edges }>; options: { direction?: "TB"|"LR"|..., edgeRouting?: "orthogonal"|"splines", feedbackEdges?, nodeSpacing?, rankSpacing?, groups?: {id, children: string[]}[], backbone? }
  layoutFlow,
  pinBackbone,
  InspectorPanel, // props: { title?, children, onClose?, emptyMessage?, hasSelection? }
  Legend, // categorical: { items: { label: string; color: string }[], title?, className? } — NO custom swatch renderer (gap, DG-08)
  FlowMiniMap,
  ZoomControls, // ZoomControls({ position = "bottom-right", className })
  // React Flow re-exports
  ReactFlow,
  ReactFlowProvider,
  Background,
  Panel,
  Position,
  MarkerType,
  Handle,
  NodeResizer,
  NodeToolbar,
  EdgeLabelRenderer,
  getSmoothStepPath,
  getBezierPath,
  getStraightPath,
  useReactFlow,
  useNodesState,
  useEdgesState,
  useUpdateNodeInternals,
  type Node,
  type Edge,
  type NodeProps,
  type EdgeProps,
  type NodeChange,
  type EdgeChange,
} from "@elabs-ai/components-flow";
```

**Not re-exported by flow** (import from `@xyflow/react` directly — the app lists it as a dependency): `getNodesBounds`, `getViewportForBounds`, `useStore`, `getIntersectingNodes` (via `useReactFlow().getIntersectingNodes`), and — checked against `packages/flow/src/index.ts` @ ee5c91dc — `useNodesInitialized`, `useNodes`, `useEdges` (flow re-exports only `useNodesState`/`useEdgesState`, index.ts L42–43), `useInternalNode` and the `FitViewOptions` type (`@xyflow/react` 12.11.1 `dist/esm/index.d.ts`: `useNodes` L16, `useEdges` L17, `useNodesInitialized` L24, `useInternalNode` L29, types L36 → `types/general.d.ts` L72). Import each with a `// P4: library gap — …` comment. Record as a gap in DG-17/DG-15 findings.
Stylesheet once, in the app CSS: `@import "@xyflow/react/dist/style.css";`.
`FlowGroupNode` reads live child counts from the store; children need `parentId` + `extent: "parent"`, and **parents must precede children** in the nodes array.

### Layout (DG-11)

Verified against `packages/flow/src/` @ ee5c91dc on 2026-09-26 by reading the source. The one-line `layoutFlowElk` summary in the block above leaves out `loadEngine` and the result's `engine`; this is the full surface.

```ts
import {
  layoutFlowElk, // index.ts L77; flow-layout/layout-flow-elk.ts L319: (nodes, edges, options?) => Promise<FlowLayoutElkResult>
  type FlowElkEngine, // index.ts L78; layout-flow-elk.ts L83: { layout(graph: FlowElkGraph): Promise<FlowElkGraph> } — `new ELK()` satisfies it
  type FlowElkGraph, // index.ts L79; layout-flow-elk.ts L66: ELK JSON { id, x?, y?, width?, height?, layoutOptions?, children?, edges? }
  type FlowLayoutElkOptions, // index.ts L80; layout-flow-elk.ts L38–63: direction? ("TB" default), edgeRouting?, feedbackEdges?, nodeSpacing? (48), rankSpacing? (72),
  //                            groups?: { id, children: string[] }[], backbone?, loadEngine?: () => Promise<FlowElkEngine> (L62)
  type FlowLayoutElkResult, // index.ts L81; layout-flow-elk.ts L88–94: layoutFlow's result (nodes, edges, backEdges, selfLoops) + engine: "elk" | "dagre" (L93)
  collapseGroup, // use-flow-groups/index.ts L2–13; group-operations.ts L228: (nodes, edges, groupId) => { nodes, edges }
  expandGroup, // group-operations.ts L308 — the exact inverse of collapseGroup
  toggleGroupCollapsed,
  isFlowGroupProxyEdge,
  CanvasShell, // canvas-shell.tsx: fitViewKey L57, fitViewKeyOptions?: FitViewOptions L59, fitViewAnchorNodeIds L68
} from "@elabs-ai/components-flow";
```

- **Engine.** Without `loadEngine`, `loadDefaultEngine` (L126) imports `elkjs/lib/elk-api.js` plus `elk-worker.min.js` and runs inline. A `loadEngine` that rejects, or an ELK that throws, falls back to dagre with `engine: "dagre"` and a development-only warning (`warnFallback` L140; catch L330–340). DG-11 passes `loadEngine: () => import("elkjs/lib/elk.bundled.js").then(({ default: ELK }) => new ELK())` — elkjs 0.12.0 ships `lib/elk.bundled.js` and `lib/elk.bundled.d.ts`, and elkjs is already an app dependency.
- **Groups.** `elk.hierarchyHandling` is `INCLUDE_CHILDREN` whenever a group is passed (L195); group padding is fixed at `[top=60,left=16,bottom=16,right=16]` (L104); every child comes back with `extent: "parent"` (L359). There are no per-group layout options (a per-zone direction needs the graph decorated inside `loadEngine`) — a P4 gap.
- **Collapse.** `collapseGroup` sets the group to a fixed 220 × 48 chip (`OVERVIEW_WIDTH`/`OVERVIEW_HEIGHT`, group-operations.ts L21–22), writes `data.collapsed`, `data.childCount` and a private snapshot under `__flowGroupCollapsedState` (L59, L279–284; shape L45–57), hides the descendants and reroutes crossing edges to proxy edges marked `__flowGroupProxy` (L63, L253). The pure functions work on arrays; the `useFlowGroups` hook wraps them for a live canvas.
- **Accessible names.** CanvasShell names every node through `useMeasuredNodes` (canvas-shell.tsx L22, L146) and `useNamedNodes` (L21): `defaultNodeAriaLabel` (`canvas-shell/node-aria-label.ts:21`, internal, not exported) uses `node.ariaLabel` when set, otherwise `data.title` alone. Set `ariaLabel` on the node to add the kind.
- **Ports.** `flowPortId(type, port)` is `flow-port/flow-port.tsx:16` (`"out:<port>"` / `"in:<port>"`).

### React Flow engine facts

Read in `@xyflow/react` 12.11.1 and `@xyflow/system` 0.0.78 (the versions in the pnpm store @ ee5c91dc):

- **Node visibility.** Every node wrapper gets an inline `visibility: hasDimensions ? 'visible' : 'hidden'`, then `...node.style` (`@xyflow/react` `dist/esm/index.mjs` L2342–2343). A hidden ancestor does not hide measured nodes, because their own inline `visible` wins; a class such as `invisible` on the node loses to the inline style. Hide a node with `style.visibility`; hide a whole canvas with `opacity-0` plus `inert`.
- **Measured.** `useNodesInitialized()` (`dist/esm/index.d.ts` L24; `hooks/useNodesInitialized.d.ts` L38) turns true once every node has dimensions. A hidden browser tab never measures (see Browser checks).
- **Fit.** `fitViewport` clamps to the store's `minZoom` unless the call passes `minZoom`, and its `padding` defaults to 0.1 (`@xyflow/system` `dist/esm/index.js` L427, L433). `FitViewOptions` (`@xyflow/react` `dist/esm/types/general.d.ts` L72) is `FitViewOptionsBase` from `@xyflow/system`, whose `padding` may be a number, a `px`/`%` string, or per side `{ top, right, bottom, left, x, y }` (`@xyflow/system` `dist/esm/types/general.d.ts` L137–146, `padding?` L151). React Flow's default `minZoom` is 0.5 (`@xyflow/react` `dist/esm/index.mjs` L3702) and its default `zIndexMode` is `'basic'` (same line).
- **Z-order.** In the default `zIndexMode` (`'basic'`) React Flow lifts children above their parent and edges touching a child above the parent too (`getElevatedEdgeZIndex`, `@xyflow/system` `dist/esm/index.js` L1000–1007), so the compiler sets no `zIndex`.
- **Selection lift (wave-2 review M3).** With `elevateNodesOnSelect` (default true) a selected node gets `SELECTED_NODE_Z = 1000` and its children and edges follow (`@xyflow/system` `dist/esm/index.mjs` L1535, L1704–1709). The canvas passes `elevateNodesOnSelect={false}` (`panes/canvas-pane.tsx`), which is what keeps the edge labels' fixed z 1000 on top.
- **Move events (wave-2 review M1).** `onMoveStart`/`onMoveEnd` receive `event.sourceEvent`, which is `null` for React Flow's own zoom buttons (`scaleBy`) and minimap (`scaleTo`) as well as for `setViewport` (`@xyflow/system` `dist/esm/index.mjs` L2780, L2814). "The user moved" is therefore detected as "the viewport no longer equals the last fit" (`layout/use-diagram-layout.ts`, `refit`).

### elkjs facts (wave-2 review M2, M5)

Read in `elkjs` 0.12.0 `lib/elk-worker.js`:

- **`org.eclipse.elk.json.edgeCoords: ROOT`** makes edge sections and edge labels come back in root coordinates (declared L68612, registered L68736, values L68865–68870, resolved per element and inherited from the JSON parent L77392–77401). `layout/run-elk.ts` sets it on the root; `shapeCoords` stays default because node positions are read parent-relative.
- **An edge label needs `text`.** A label with only `width`/`height` is ignored: it stays at (0,0) and gets no space (importer L77222). The app sets `text` to the edge id.
- **Size minimum.** `elk.nodeSize.constraints: "[MINIMUM_SIZE]"` plus `elk.nodeSize.minimum: "(w, h)"` are registered for `layered` (L47165, L47208); the app passes each zone's measured header minimum (`layout/zone-header-width.ts`).
- **Ports at the handles.** `elk.portConstraints: FIXED_POS` with a port at the handle's own point; `FIXED_SIDE` alone spreads two ports on one side to 1/3 and 2/3.

## editor — `@elabs-ai/components-editor`

```ts
import { CodeEditor } from "@elabs-ai/components-editor";
// props (code-editor.tsx L38–89): value?, defaultValue?, onChange?(value), language?: string ("yaml"), path?, readOnly?, height?,
//   options?: monaco IStandaloneEditorConstructionOptions, ariaLabel?, ariaInvalid?, ariaDescribedBy?,
//   contextMenu?: "brand"|"monaco"|"none", onMount?(editor, monacoApi), actions?: EditorAction[]
```

Markers (DG-12): keep `editor` and `monacoApi` from `onMount`, then
`monacoApi.editor.setModelMarkers(editor.getModel()!, "arch-diagram", markers)` with `{ startLineNumber, startColumn, endLineNumber, endColumn, message, severity: monacoApi.MarkerSeverity.Error | Warning | Info }`. Reveal: `editor.revealLineInCenter(n)`; decorations: `editor.createDecorationsCollection([...])`. `monaco-editor` is the editor package's peer — the app lists it.

### CodeEditor in DG-12

Verified against `packages/editor/src/` @ ee5c91dc and `monaco-editor` 0.55.1 on 2026-09-26 by reading the source.

```ts
import {
  CodeEditor,
  type CodeEditorProps,
  type MonacoCodeEditor,
} from "@elabs-ai/components-editor";
// editor index.ts L14–18 · code-editor/code-editor.tsx: CodeEditorProps L38–89 — options L57, ariaLabel L64,
//   ariaInvalid L66, ariaDescribedBy L68, contextMenu L74, onMount(editor, monacoApi) L76 · CodeEditor L144
```

- `options` is spread into Monaco's construction options (L222) and re-applied with `editor.updateOptions` whenever its identity changes (effect L338–341): keep it a module constant.
- A controlled `value` reaches the model through the smallest `executeEdits` span (L305–322), not `setValue()`, so undo and the cursor survive a store update.
- `onMount(editor, monacoApi)` is called at L263. `MonacoCodeEditor` (L25) is exported; the Monaco namespace type is not — use `Parameters<NonNullable<CodeEditorProps["onMount"]>>[1]`.
- The aria props are stamped on Monaco's `<textarea>` at mount (L228–236) and re-stamped by an effect (L360–371); `aria-invalid` is written as `String(bool)`.
- Monaco is loaded by a dynamic `import("monaco-editor")` (L203): there is no `window.monaco`. Reach the editor and the API only through `onMount`.
- **Gap:** Monaco 0.55.1 turns `editContext` on by default in Chromium (`monaco-editor/esm/vs/editor/common/config/editorOptions.js` L3135). The focused element is then an EditContext `<div>`, not the textarea, so the stamped `aria-invalid`/`aria-describedby` never reach assistive tech. `options={{ editContext: false }}` puts the textarea back. Record it as a P4 gap.

## State (DG-12): no store library

`zustand` is **not** used anywhere in the repo (checked all `package.json`s). Do not add it. Use a plain module store:

```ts
// src/state/create-store.ts — dependency-free
export function createStore<T>(initial: T) {
  let state = initial;
  const subs = new Set<() => void>();
  return {
    get: () => state,
    set: (patch: Partial<T> | ((s: T) => Partial<T>)) => {
      state = { ...state, ...(typeof patch === "function" ? patch(state) : patch) };
      subs.forEach((f) => f());
    },
    subscribe: (f: () => void) => {
      subs.add(f);
      return () => subs.delete(f);
    },
  };
}
// components: const nodes = useSyncExternalStore(store.subscribe, () => store.get().nodes);
```

The snapshot function must return a value that is stable between changes (a field of the state, never a new object or array built in the selector), or React re-renders forever. DG-12 builds this as `src/state/create-store.ts` with a `Store<T>` interface and a `useDiagram(select)` hook over `useSyncExternalStore`.

## Allowed app dependencies

`@elabs-ai/components-{tokens,ui,icons,flow,editor}` (workspace), `@xyflow/react`, `elkjs`, `monaco-editor`, `lucide-react` (same version as the monorepo: `^0.577.0`), `class-variance-authority` (`^0.7.1`, already listed in `apps/diagram/package.json` L23; wave 1's node and zone variants use it), `react`, `react-dom`; later items add `yaml` (DG-09). `html-to-image@1.11.11` was allowed for DG-17 but is **not** added: one export of the seed took 4.6 s and made an SVG of 80 million characters here, so DG-17 inlines computed styles itself (DG-17 findings §1). Wave 3 (DG-14 … DG-18) adds no dependency. Dev: `vite`, `@vitejs/plugin-react`, `@tailwindcss/vite`, `@elabs-ai/components-eslint-config`, `@elabs-ai/components-typescript-config`, `eslint`, `typescript`. Nothing else.

## Repo commands you will run

- Root: `pnpm install` (after adding the app), `pnpm typecheck`, `pnpm lint`, `pnpm check`, `pnpm check:test` — the app must **not** appear in turbo's task list for the first two.
- App: `pnpm --filter @elabs-ai/diagram dev | build:local | typecheck:local | lint:local`.
- Audit: `pnpm brand-ui audit --strict apps/diagram/src`.

## yaml (DG-09)

Verified against `yaml` 2.9.1 (`node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/`, already in the pnpm store) on 2026-09-26 by reading the `.d.ts` files and running it. DG-09 adds it to the app: `pnpm --filter @elabs-ai/diagram add yaml@^2.9.1`. Not `js-yaml` — it keeps no source positions.

```ts
import { LineCounter, isAlias, isMap, isScalar, isSeq, parseDocument, type Document } from "yaml";
// index.d.ts: L2 Document · L7 isAlias/isMap/isScalar/isSeq · L16 LineCounter · L19 parseDocument
// parseDocument(text, { lineCounter, prettyErrors: true, uniqueKeys: true }) → Document.Parsed
//   (public-api.d.ts L21; options.d.ts L31 lineCounter, L37 prettyErrors, L63 uniqueKeys — default true)
// doc.contents (doc/Document.d.ts L27) · doc.errors: YAMLError[] (L30) · doc.warnings: YAMLWarning[] (L42) · doc.toJS() (L129)
// YAMLError { name, code: ErrorCode, message, pos: [number, number], linePos? } (errors.d.ts L7–14; ErrorCode union L2)
// new LineCounter().linePos(offset) → { line, col }, both 1-based (parse/line-counter.d.ts L6–22)
// node.range: [start, value-end, node-end] (nodes/Node.d.ts L19–20, L28–33) — use [0] and [1]
// alias.resolve(doc) (nodes/Alias.d.ts L26) · YAMLMap.items: Pair[] (nodes/YAMLMap.d.ts L21)
// pair.key, pair.value (may be null) (nodes/Pair.d.ts L13, L15) · YAMLSeq.items (nodes/YAMLSeq.d.ts L12)
// scalar.value (nodes/Scalar.d.ts L25), scalar.range (L8)
```

Behaviour (run, not only read): a repeated key is an **error** with code `DUPLICATE_KEY`; an unknown tag such as `!shout` is a **warning** (`TAG_RESOLVE_FAILED`); with `prettyErrors: true` the first message line ends in ` at line L, column C:` — strip it before showing the message. `linePos` numbering is what Monaco markers use (DG-12).

**Do not write text back through the Document** (run on 2026-09-26 against DG-09's `valid-full.yaml` fixture): `doc.set("direction", "TB"); String(doc)` keeps the inline comment on the changed line, but re-flows every flow sequence (`[pii]` becomes `[ pii ]`) and moves a comment that trails a block key (`flows: # …`) onto its own line — 29 of 78 lines differ and the text grows to 87 lines. DG-12 edits text by splicing the new value at DG-09's source-map offsets instead.

## ui/definition (DG-09)

Verified against `packages/ui/src/lib/definition/` on main @ e3d2b7d3 on 2026-09-26. Subpath export `@elabs-ai/components-ui/definition` (`packages/ui/package.json` L27–30 workspace source, L48–51 publish), React-free by test (`purity.test.ts` L36). Under `apps/diagram/src/spec/` import **only this subpath**, never the root barrel.

```ts
import {
  defineComponent, // component-definition.ts L184–217: defineComponent<P>()({ id, version, label, description?, groups, fields, codeOnly, targets })
  field, // field.ts L320–371: string({ min, max }), number, integer({ min, max }), boolean, enum({ values }), color, responsive,
  //        object({ fields, open? }), array({ of }), union({ of }); shared options required/default/description (L70–83)
  headerGroup, // groups/header.ts L13–26: title, subtitle, description
  type HeaderGroupProps,
  statusGroup, // groups/status.ts L22–31: statusGroup.fields.status.values = STATUS_TONES (lib/status-tone.ts L12)
  validateProps, // validate.ts L202: (def, input, { path? }) → ValidationResult — never throws
  type SpecIssue, // issues.ts L14–22: { path, code, message, severity?: "error" | "warning" }
  toJsonSchema, // generate/json-schema.ts L108–140: draft 2020-12 object schema
  type JsonSchema,
} from "@elabs-ai/components-ui/definition";
// ValidationResult (issues.ts L27–29): { ok: true, value, issues } | { ok: false, issues }
```

- `validateProps` codes: `out-of-range` (validate.ts L93), `wrong-type` (L99), `not-in-enum` (L130), `unknown-prop` (L142, L173, L261), `missing-prop` (L160, L271), `not-an-object` (L214), `deprecated-prop` (L234, L247). `options.path` prefixes every issue path. DG-09 re-grades severities with its own table (`src/spec/dialect/issues.ts`), so `unknown-prop` is a warning there.
- `toJsonSchema` adds `$schema` + `title` on **every** call (json-schema.ts L133) and `additionalProperties: false` (L138); `object({ open: true })` → `additionalProperties: true` (L59–72); `union` → `anyOf` (L79–80). There is no fragment mode: strip `$schema`/`title` before putting a result under `$defs`.
- **Gaps** (write around them with `// P4: library gap — …`; listed in `docs/findings/DG-09-definition-gaps.md`): `FieldKind` is closed (field.ts L23–33) — no recursive/`$ref`, no map-of kind; `StringFieldOptions` has `min`/`max`, no `pattern` (L85–88); `appliesWhen` names a sibling field only (L50–52) and `toJsonSchema` never emits it; `SpecIssueSeverity` has no `"info"` (issues.ts L11).
- `SpecPlayground` reads `SpecPlaygroundError { path, code, message }` (`packages/ui/src/components/spec-playground/spec-playground.tsx` L31–37); DG-09's `ArchIssue` is a superset and can be passed as is.

ui names used by the DG-09 `#spec-check` view, all from the root barrel `packages/ui/src/index.ts` (index lines re-checked @ ee5c91dc):

```ts
import {
  Badge, // index.ts L165; badge.tsx L54–85 variant: default | secondary | outline | success | warning | destructive | info
  Heading, // index.ts L279; typography.tsx L110–113 level?: 1–6
  StatusBadge, // index.ts L258; status-badge.tsx L305–310 { status: Status | CustomStatus, hideIcon?, appearance? }; children replace the label; STATUSES L60 (complete, failed, …)
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow, // index.ts L261; table/index.ts (+ TableFooter); intrinsic table-element props
  Text, // index.ts L279; typography.tsx L36–69 variant (… caption, code = text-code font-mono), tone default | muted | primary, as?: "p" | "span" | "div"
} from "@elabs-ai/components-ui";
```

## App names (wave 1)

The app's own modules after DG-03 … DG-08, read in `apps/diagram/src/` @ ee5c91dc on 2026-09-26. Wave-2 items import these by relative path; never copy them.

```ts
// nodes/arch-node-data.ts — ArchNodeKind L12, ArchNodeVariant ("icon" | "card") L15, ArchNodeData L17,
//   ARCH_NODE_TYPE L37 ("arch/service" … "arch/note"), ArchNodeType L46, ArchNode L48, ArchMarkedKind L51,
//   ARCH_KIND_DEFAULT_ICON L58, ARCH_KIND_LABEL L67
// nodes/node-types.ts — archNodeTypes L21 (the six node kinds + the zone)
// nodes/service-node.tsx — archNodeAriaLabel(kind, title) L63
// nodes/zone-data.ts — ZoneKind L10, ZoneOwner L21, ZoneData L23, ZONE_NODE_TYPE ("arch/zone") L42, ZoneNode L44,
//   isZoneNode(node) L47, ZONE_HEADER_HEIGHT 44 L63, ZONE_PADDING 16 L64, ZONE_MIN_WIDTH / ZONE_MIN_HEIGHT L65–66
// nodes/zone-variants.ts — defaultVariants { owner: "customer", kind: "generic" } L50
// nodes/use-zone-autofit.ts — fitZones L74, useZoneAutofit L162 (L70 and L165 @ 62aa5f55)
// nodes/zone-node.tsx — side ports "in" (left) / "out" (right) L165–166; collapse button named
//   "Collapse <title>" / "Expand <title>" L239–245 · nodes/actor-node.tsx — side ports L24–25
// edges/data-flow-edge-data.ts — FlowKind L4, FlowLineStyle L7, FlowSecure L10, FlowDirection L16,
//   DataFlowEdgeData L19, FLOW_EDGE_TYPE_KEY ("arch/flow") L42, DataFlowEdge L45
// edges/edge-types.ts — archEdgeTypes L8 · edges/edge-style.ts — edgeMarkers L129, edgeAriaLabel L147
// chrome/title-block.tsx — TitleBlock({ title, description, meta, headingLevel = 2 }) L30
// chrome/diagram-legend.tsx — DiagramLegend({ mode }) L213 · chrome/build-legend.ts — LegendMode L14
// icons/icon-sheet.tsx — iconSheetHash L41, iconSheetVendor L46 · icons/register-packs.ts — ICON_PACKS L28
```

- Two different `isZoneNode`s exist: `nodes/zone-data.ts` L47 is a type guard for `"arch/zone"`; `edges/zone-endpoint.ts` L11 also accepts `"group"`. Layout and canvas code uses the `nodes/` one.
- `DiagramLegend` reads `useNodes()`/`useEdges()` (L215) and `buildLegend` does not skip hidden elements, so the legend counts every edge in React Flow's store, hidden ones and collapse proxies included.

## FlowSpec core (DG-10 … DG-13)

**Planned names — none of these exist until its item merges.** Taken from the hardened item files (built and checked in a scratch tree during hardening); DG-09's names come from its item file (`roadmap/DG-09-dialect-parser-validator-schema.md`, line numbers of that file), because DG-09 is not built yet.

```ts
// DG-09 — src/spec/dialect (import from the folder's index.ts)
//   types.ts: ZONE_KINDS, ZONE_OWNERS, FLOW_KINDS, FLOW_SECURE; ArchZoneSpec (item L161), ArchNodeSpec (L178),
//     ArchFlowSpec (L196), ArchNoteSpec (L214), ArchStyleSpec (L220), ArchDiagram (L225)
//   ids.ts: ID_SOURCE (L249) · issues.ts: ArchIssueSeverity "error" | "warning" | "info" (L535), ArchIssue
//   source-map.ts: SourceRange (L603), SourceMap (L609; `values` L613), locate(map, path, "key" | "value") (L645)
//   parse.ts: ParsedArchYaml (L683), parseArchYaml(text) (L696) · index.ts: checkArchYaml(text, iconNames) (L1278)
// DG-10 — src/spec/flow-spec (pure: no React, no @elabs-ai/components-*; `import type { Node, Edge } from "@xyflow/react"` only)
//   FLOW_SPEC_VERSION, FlowSpec, FlowSpecNode, FlowSpecEdge, FlowSpecDefinition(s), FlowSpecIssue,
//   validateFlowSpec, toReactFlow, pickPort, ReactFlowGraph, fromReactFlow
// DG-10 — src/spec/compile: ARCH_DEFINITIONS, NODE_TYPE_KEY, ZONE_TYPE_KEY, FLOW_TYPE_KEY (arch-definitions.ts);
//   compileArch(ast) → ArchCompileResult, ArchCompileView, DEFAULT_ZONE_OWNER (compile-arch.ts);
//   createArchRegistry() → ArchRegistry { nodeTypes, edgeTypes, definitions, decorate(graph) } (registry.ts)
// DG-10 — src/icons/icon-names.ts: ICON_NAMES · src/state/compile-text.ts: compileText(text) → CompiledDiagram
//   { ast, spec, graph, view, origin, issues: DiagramIssue[], ok }, archRegistry, IssueStage
// DG-11 — src/layout: runElk, decorateElkGraph, DiagramDirection (run-elk.ts); NOTE_GAP, noteLayoutEdges,
//   placeNotesBeside (place-notes.ts); layoutDiagram, relayoutVisible, layoutManual, followZoneDirection
//   (layout-from-spec.ts); useDiagramLayout(options) → LayoutStatus, FIT_MIN_ZOOM = 0.1 (use-diagram-layout.ts)
// DG-12 — src/state: createStore → Store<T> (create-store.ts); setTopLevelScalar, TopLevelScalarKey (edit-text.ts);
//   diagramStore, diagramActions { setText, loadText, setTopLevel, select, requestLayout }, useDiagram(select),
//   COMPILE_DEBOUNCE_MS = 150 (diagram-store.ts); structureKey, patchGraph, stageGraph, elementRanges,
//   elementAt (pipeline.ts) · src/panes/issues-panel.tsx: IssuesPanel, SEVERITY_STATUS ·
//   src/chrome/fit-padding.ts: chromeFitPadding(pane, nodes)
// DG-13 — src/examples/index.ts: EXAMPLES: readonly DiagramExample[] ({ id, label, description, text })
```

If a hardened item and this list disagree, the item file wins; report the difference.

## Vite `?raw` (DG-10, DG-13)

`import text from "./lakehouse-aws.yaml?raw"` gives the file as a `string`: Vite 6.4.3 declares `*?raw` in `vite/client.d.ts` L243, which reaches the app through `src/vite-env.d.ts` (`/// <reference types="vite/client" />`). That file does not exist @ ee5c91dc — DG-09 adds it (the app's `tsconfig.json` lists only `react` and `react-dom` in `types`). The repo's Prettier formats `.yaml` (only `pnpm-lock.yaml` is in `.prettierignore`), so run it on every example file.

## Browser checks

What hardening wave 2 learned about checking the app in a browser (agent-browser against `pnpm --filter @elabs-ai/diagram dev`, http://localhost:5180, `--strictPort`):

- **Visible tab first.** Before reading any result, `document.visibilityState` must be `"visible"`. In a hidden tab neither `requestAnimationFrame` nor `ResizeObserver` fires, so React Flow never measures a node, `useNodesInitialized()` stays false and no layout runs. A screenshot forces a frame and can look fine anyway. Open a new tab; never read results from a hidden one.
- **Fresh state.** `agent-browser reload` did not reset the app during hardening; `open` the URL again with a throwaway query (`/?t=2`).
- **Reading app state.** Run `await import("/src/state/diagram-store.ts")` inside an async IIFE in the page: Vite serves the same module instance the app uses, so it is the live store.
- **After a hot update, find the app's own module URL** (wave-3 hardening). Once a file changed while the dev server ran, the app imports `/src/…?t=<n>`, and a plain `import("/src/state/diagram-store.ts")` loads a second, empty instance (`__changed()` returned `[]`, a manual layout read as auto). Restart the dev server after the last file change, or import through the URL the page actually loaded:

  ```js
  const imp = (p) =>
    import(
      performance
        .getEntriesByType("resource")
        .map((e) => e.name)
        .find((n) => n.includes(p)) ?? p
    );
  const { diagramStore } = await imp("/src/state/diagram-store.ts");
  ```

- **Typing into Monaco.** agent-browser `type` and `fill` do not reach Monaco's input. Click the line, then `press` keys (`End`, `Backspace`, one `press` per character). Monaco auto-closes quotes and braces.
- **Hidden canvas.** A canvas hidden while it lays out uses `opacity-0` plus `inert` (see React Flow engine facts), so check it with `el.closest("[inert]")`, not with `visibility`.
- **Console errors.** `agent-browser errors --clear` did not clear the list, and the list includes other origins. Hook errors in the page instead (an `error` listener plus a `console.error` wrapper that push to `window.__errs`).
- **StrictMode.** `src/main.tsx` renders in `<StrictMode>` (L18), so in dev every effect runs twice on mount: effect code must be idempotent, and a line an effect logs appears twice on first load.

## Wave 3 (DG-14 … DG-18)

Read at `diagram/integrate` 62aa5f55 on 2026-09-26 during wave-3 hardening, and used by the code on branches `diagram/harden3-w3-dg14` … `-dg18` (typechecked there). `main` has moved on in `packages/` since; builders branch from `diagram/integrate`, so these lines are the ones that apply. Where an item file gives a line too, the item wins; report a difference.

### Library names

```ts
// ui — index lines are packages/ui/src/index.ts @ 62aa5f55
import {
  cn, // L17
  useIsMobile, // L28; lib/use-mobile.ts L32 — a viewport query, (breakpoint = MOBILE_BREAKPOINT)
  Badge, // L165; badge.tsx L105, variant "outline" L63
  Button, // L169; button.tsx L67, variant "link" L46, size "sm" L49, asChild L64
  ConfirmDialog, // L182; confirm-dialog.tsx L91 — no trigger, focus falls to <body> on close (DG-15/16 findings)
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem, // L192; dropdown-menu.tsx L6, L7, L110, L131
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent, // L10, L13 (does not size an icon), L34
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuCheckboxItem, // L11, L53, L81
  DropdownMenuLabel,
  DropdownMenuSeparator, // L151, L164; DropdownMenuContent has no max height (L120)
  HoverCard, // L207; hover-card.tsx L5–8 — trigger-only, no anchor, no portal: NOT usable from the canvas (DG-18 §1)
  IconButton, // L208; icon-button.tsx L17 props, `label` L30 (aria-label + tooltip), sizes "icon" | "icon-sm" | "icon-lg" L15, L61
  Popover,
  PopoverAnchor,
  PopoverContent, // L233; popover.tsx L5, L7 (Radix anchor, takes `virtualRef`), L9 (portaled, L14)
  SchemaFormProvider,
  SchemaFormRoot,
  SchemaFormFields, // L241; schema-form.tsx L170 (props L141), L1273, L849
  type FormSpec,
  type FieldSpec,
  type FormValue,
  type FormValues, // schema-form-spec.ts L333, L206, L340, L350
  Toaster,
  toast, // L255; sonner.tsx L80, L103 — a toast published before <Toaster /> subscribes is dropped
  ToggleGroup,
  ToggleGroupItem, // L272; toggle-group.tsx L21 (variant "segmented" L32), L44; toggle.tsx size "sm" L49
  Heading,
  Text, // L279; typography.tsx L122 (level, size), L74 (variant "meta" | "eyebrow" …, tone "muted")
} from "@elabs-ai/components-ui";

// ui/definition — packages/ui/src/lib/definition
//   FieldTier L37, FieldOptions.tier? L78, appliesWhen? L79 (AppliesWhen L50: equals | in), AnyField L197 (field.ts);
//   AnyComponentDefinition (component-definition.ts L69, fields L75); exported from lib/definition/index.ts L11, L59

// flow — packages/flow/src/index.ts @ 62aa5f55
import {
  CanvasShell, // L7; canvas-shell.tsx CanvasShellProps L25 (= ReactFlowProps + its own), className L71 (on the
  //   data-slot="canvas-shell" root, L148), DEFAULT_ARIA_LABEL_CONFIG L86 spread under the caller's at L152
  FLOW_EDGE_DEFAULTS, // L18 via flow-edge-path/index.ts; flow-edge-defaults.ts L31: strokeWidth 1.5, selectedWidthIncrease 1.5
  InspectorPanel, // L26; inspector-panel.tsx L45, props L9–36
  collapseGroup,
  expandGroup,
  toggleGroupCollapsed, // L30 → use-flow-groups/index.ts L5–7; group-operations.ts L228, L308, L343
  Panel,
  useReactFlow, // L37, L41 (re-exported from @xyflow/react)
  type Node,
  type Edge, // L46
} from "@elabs-ai/components-flow";

// tokens
import { useReducedMotion } from "@elabs-ai/components-tokens"; // index.ts L15; theme-provider.tsx L1105
// themes.css L3234–3257: prefers-reduced-motion / data-motion-pref clamp every animation and transition

// lucide-react ^0.577.0, named imports used by wave 3 (all typecheck):
//   ChevronLeft, ChevronRight, ChevronsDownUp, ChevronsUpDown, ExternalLink, ListOrdered, Minimize2, Presentation, X
```

- **Not re-exported by flow and not needed:** `getNodesBounds`, `getViewportForBounds` (DG-17 measures the drawn elements instead), `useInternalNode` (DG-07's existing P4 note). Wave 3 imports nothing new from `@xyflow/react` directly.
- **React Flow 12.11.1 facts** (`dist/esm/types/component-props.d.ts`): `onBeforeDelete` L217, `deleteKeyCode` L275, `onNodeDragStart` L63, `onNodeDragStop` L67, `onSelectionDragStart` L140, `onSelectionDragStop` L144; `getInternalNode` (`types/instance.d.ts:55`, `positionAbsolute` is updated in place while dragging — copy it), `getIntersectingNodes` (L113). The delete key listener is document-wide (`dist/esm/index.mjs:1238`); arrow-key moves go through `moveSelectedNodes` (L1711–1748) and fire no drag event. `onNodeMouseEnter`/`onNodeMouseLeave` are mouse events, not pointer events. Two `Panel`s at one position overlap (`dist/style.css:291–295`).
- **Radix:** `@radix-ui/react-dialog` 1.1.15 focuses the (null) trigger on close (`dist/index.mjs:146–148`); a trigger-less Popover does the same. Return focus yourself (DG-14's `focusCanvasElement`).

### App names added by wave 3 (planned)

**None of these exist until their item merges.** Lines are on `diagram/harden3-w3-merge` (341ab807), the merged proof of DG-14 … DG-18.

```ts
// DG-14 — state/diagram-store.ts: TextEditFn L142, editActions L144 { applyEdit L150, editEntry L163,
//   deleteElements L173, setInspectorOpen L181, revealInEditor L185 } (fileActions L192 is DG-16's)
//   state/pipeline.ts (62aa5f55): structureKey L18, patchGraph L77, unstage L134, stageGraph L147, keepSelection L212
//   state/entries.ts: DiagramEntry L8, entryOf L15, pathsToDelete L39
//   spec/dialect/write-back.ts: TextEdit L18, WriteValue L25, EntryPatch L33, applyEdits L36, yamlScalar L66, valueAt L101,
//     SetKeysOptions L222, setEntryKeys L279, setFlowKeys L317, removeEntries L379 (DG-15 appends EntryKeysPatch L425,
//     setEntriesKeys L433, moveEntry L478)
//   spec/dialect/form-spec.ts: UNSET L13, EntryFormOptions L15, entryFormSpec L80, entryFormValues L125, seedFormSpec L144,
//     entryFormPatch L168
//   panes/canvas-props.ts: CanvasProps L9 (= Partial<CanvasShellProps>), mergeCanvasProps L11
//   panes/focus-canvas.ts: focusCanvasElement(id) L20 · panes/use-canvas-delete.ts: useCanvasDelete L47
//   panes/inspector-pane.tsx: InspectorPane L144 · shell/diagram-shell.tsx: WORKSPACE_ID = "diagram-workspace"
//   shell/top-bar.tsx: COMPACT_BELOW = 1440 (was 1024)
// DG-15 — layout/layout-edits.ts: Point L20, Placement L26, Move L32, manualEdit L66, autoEdit L108
//   layout/reparent.ts: dropTarget L31, slotBelow L45, dropsOf L76, afterGesture L108
//   layout/layout-bridge.ts: LayoutPrompt L13, layoutBridge L77, useLayoutPrompt L104
//   layout/use-manual-layout.ts: useManualLayout L57 · layout/layout-controls.tsx: LayoutControls L59, LayoutMenuItems L119
// DG-16 — state/history.ts: HISTORY_LIMIT L20, COALESCE_MS L22, installHistory L70, historyActions L113,
//     useHistoryCounts L133, onHistoryKeyDown L159
//   io/share-url.ts: DOC_PARAM L11, MAX_DOC_BYTES L14, encodeDoc L30, decodeDoc L36, docParam L63, shareUrl L68,
//     loadSharedDoc L80, takeBootFailure L91
//   io/files.ts: YAML_ACCEPT L9, yamlFileName L12, readYamlFile L24, downloadYaml L32, guardUnload L43
//   io/document-controls.tsx: DocumentControls L88, DocumentMenuItems L248
// DG-17 — io/export.ts: PictureScale L26, PictureOptions L28, Picture L34, pictureOfCanvas L603, svgBlob L664,
//     pngBlob L672, pictureFileName L699, saveBlob L711
//   io/export-menu.tsx: ExportMenu L161, ExportMenuItems L180
// DG-18 — interaction/interaction-store.ts: CardOpener L13, InteractionState L15, CARD_OPEN_DELAY_MS L23,
//     CARD_CLOSE_DELAY_MS L25, ZoneHandlers L35, interactionActions L42, useInteraction L84
//   interaction/steps.ts: WalkFlow L9, WalkStep L18, walkSteps L28, litNodeIds L58
//   interaction/presentation-mode.ts: PRESENT_PARAM L7, isPresenting L17, presentingHash L22, editingHash L28,
//     enterPresentation L36, exitPresentation L40, markPresented L45, takePresentReturn L50
//   interaction/details-card.tsx: detailKind L34, DetailsCard L72 · interaction/step-player.tsx: StepPlayer L58
//   interaction/use-canvas-interaction.ts: DIMMED L24, collapseAllZones L60, expandAllZones L69, useCanvasInteraction L100
//   interaction/canvas-overlays.tsx: InteractionOverlays L26 · interaction/interaction-controls.tsx: InteractionControls L34,
//     InteractionMenuItems L79 · interaction/presentation-view.tsx: PresentationView L17
```

Existing app names wave 3 imports (62aa5f55): `ArchMark` (`nodes/arch-mark.tsx:31`, props L7); `ArchNodeData` L17, `ARCH_NODE_TYPE` L37, `ArchMarkedKind` L51, `ARCH_KIND_DEFAULT_ICON` L58, `ARCH_KIND_LABEL` L67 (`nodes/arch-node-data.ts`); `DataFlowEdgeData` (`edges/data-flow-edge-data.ts:19`); `KIND_STROKE` (`edges/edge-style.ts:65`); `createStore` (`state/create-store.ts:8`); `useHash` (`routes/use-hash.ts:8`); `parseArchYaml` (`spec/dialect/parse.ts:15`); `COMPILE_DEBOUNCE_MS` L14, `diagramStore` L56, `diagramActions` L76, `useDiagram` L119 (`state/diagram-store.ts`); `layoutDiagram` L238, `layoutManual` L292 (`layout/layout-from-spec.ts`); `useDiagramLayout` (`layout/use-diagram-layout.ts:137`); `fitZones` L70, `useZoneAutofit` L165 (`nodes/use-zone-autofit.ts`); `isZoneNode` (`nodes/zone-data.ts:47`).

### Wave-3 rules the names above rely on

- **Seams.** DG-14 lays four `// DG-NN import slot`s in `shell/top-bar.tsx` and two in `panes/canvas-pane.tsx`, three canvas prop slices (`deleteProps`, `layoutProps`, `interactionProps`) merged by `mergeCanvasProps`, and one `<Toaster />` in `main.tsx`. DG-15 … DG-18 replace only their own slot lines; DG-16 alone edits `main.tsx` and appends `fileActions` under a `// ── DG-16` marker in the store.
- **DG-12's rules** hold for every wave-3 writer: node and edge writes are updaters plus `keepSelection`; the only fit is the existing layout path (`requestLayout`, or a fresh canvas mount); `deleteKeyCode` changes only in DG-14.
- **DG-17 ↔ DG-18 contract.** Anything that must never be in an exported picture carries `data-diagram-export="exclude"` or is portaled; view dimming is only `data-dimmed`, which the exporter resets.
- **Merge rule.** Whichever of DG-15 and DG-17 merges second removes the then-unused `DropdownMenuItem,` import from `top-bar.tsx` (TS6133).
