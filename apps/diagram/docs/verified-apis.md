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

## Atlas wave 1 — home and details card (DG-23, DG-25)

Read at `diagram/atlas-integrate` 61702bd1 on 2026-09-27 while hardening DG-23 and DG-25. The reference code on branch `diagram/harden-w1-ui` (ca4311b0 and 87201017, never merged) imports every name below and passes `typecheck:local`, `lint:local` (the 12-warning baseline), `prettier --check apps/diagram` and `brand-ui audit --strict apps/diagram/src`; Home and the card were checked in a browser on :5193 in light and dark. Where an item file gives a line too, the item wins; report a difference.

### Library names

```ts
// ui — index lines are packages/ui/src/index.ts @ 61702bd1
import {
  cn, // L17
  useCopyToClipboard, // L52–57; lib/use-copy-to-clipboard.ts, COPY_FEEDBACK_MS is the "Copied" window
  Badge, // L165
  Button, // L169; sizes sm | default | lg | icon | icon-sm | icon-lg; variant "link" + asChild for an <a>
  Card,
  CardMedia, // L172; card.tsx cardVariants L20 (`interactive` adds hover + `focus-ring`), Card L195,
  //   cardMediaVariants L372 (`flex min-h-40 items-center justify-center p-6`, ground hatch | dots | none), CardMedia L404
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem, // L180; command.tsx CommandDialog L240 forwards `filter` (cmdk's) and `title` (sr-only DialogTitle),
  //   CommandInput L256, CommandList L282, CommandEmpty L300, CommandGroup L318, CommandItem L367
  CommandTrigger, // L181; command-trigger.tsx props L6, L41 — the "Search … ⌘K" button (label, onClick)
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogSection, // L189; dialog.tsx L72, L73, L95 (size sm | lg | xl | full; xl = max-w-3xl), L182, L202, L216,
  //   DialogBody L271, DialogSection L321 (title, description, level 3 | 4, actions)
  MetricCard, // L224; metric-card.tsx props L132, MetricCard L235 — ui is its home (ADR 0012); charts re-exports it
  Popover,
  PopoverAnchor,
  PopoverTrigger,
  PopoverContent, // L233; popover.tsx L5–9, default classes `w-72 p-4 shadow-popover`
  StatePanel, // L257; state-panel.tsx L12, props L46, L122 (kind empty | error | loading, icon, title, titleAs, description)
  StatusBadge,
  type CustomStatus, // L258; status-badge.tsx CustomStatus L82 { label, tone: StatusTone, icon? }, StatusBadge L325 (size sm | md)
  toast, // L255; sonner.tsx L103
  Heading,
  Text, // L279; typography.tsx textVariants L36 (lead | body | caption | meta | kpi | kpi-sm | eyebrow | code;
  //   tone default | muted | primary), Text L74 (`as` p | span | div), headingVariants L84, Heading L122 (level, size)
  formatLastOpened, // L282; workspace-picker-state.ts L38 (date, locale, now?) → "26 minutes ago"
  useLocale, // L218; locale-provider.tsx L238 → { locale }
  CommandChip, // L284; command-chip.tsx CommandChipHost L18, CommandChipLabels L28, defaults L41, props L49, L70
  Image, // L315; image.tsx ImageProps L37, Image L66
} from "@elabs-ai/components-ui";

// lucide-react 0.577.0 names the reference code imports (all typecheck): Boxes, Check, CircleCheck, CircleDashed,
//   CircleX, Copy, ExternalLink, FilePlus, Folder, Layers, LayoutTemplate, Link2Off, Plug, Shapes, TriangleAlert,
//   Waypoints, Workflow. NOT declared in 0.577.0: CheckCircle2, FileWarning.
```

### Library facts that decide the design

- **MetricCard `size="sm"` is label and value only** (`metric-card.tsx` L297, `compact`): it drops the icon, delta, sparkline and `description`. Home's tiles put their jump link in `description`, so they use the default size. A string `value` renders verbatim ("—" works). `loading` shows the tile's own skeleton; pass `announceLoading={false}` so a row of five tiles does not make five live regions.
- **ui `Image`** needs `alt` (`""` = decorative). `aspectRatio` reserves a framed box with a skeleton; `fallback` renders on a terminal error or an empty `src`, so a missing thumbnail needs no existence check. `fit` defaults to `"contain"`. The `media-reuse` rule scans only `packages/*/src`; the app uses `Image` anyway (ADR 0041).
- **No light markdown renderer in the allowed packages.** Editor's `MarkdownPreview` pulls in the Monaco package. DG-25 renders a description as plain text (`whitespace-pre-line`, a blank line = a paragraph) with a 3-line clamp and a More/Less button.
- **Copy buttons.** `CommandChip` copies one line: with a single host it shows no dropdown, and `labels.copy` names the button ("Copy Claude Code command"). A multi-line block (the Claude Desktop JSON) uses `useCopyToClipboard` plus an icon `Button` with its own `aria-label`. Editor's `CopyButton` names every button "Copy", so two on one dialog cannot be told apart.
- **`EmptyState` is deprecated** — use `StatePanel kind="empty"`.
- **Reading a module that may not exist yet: an eager glob.** `import.meta.glob<T>("../catalog/catalog-service.ts", { eager: true })` is `{}` while the file is missing and the module once it lands — no failing import, no later edit. Typed by `vite/client` (`src/vite-env.d.ts`); precedent `dev/spec-check-view.tsx` L20. Proven on :5193 both ways (the tile read "0" with the file present and "—" with the pattern pointed at a missing file).
- **cmdk filtering.** `CommandDialog filter={(value, search) => number}`: give each `CommandItem` `value={path}` (unique) and rank inside the filter; `keywords` alone cannot weight fields.
- **Stretched link (a whole card is one link or one button).** Put the `<a>` (or `<button>`) inside the heading with `after:absolute after:inset-0 after:rounded-lg focus-visible:outline-none focus-visible:after:focus-ring-static`; the `Card` gets `relative` and **no** `overflow-hidden` (it would clip the ring); clip the media instead (`CardMedia … overflow-hidden rounded-t-lg`). Precedents: `packages/ui/src/components/side-dock/side-dock.tsx` L389–400, `packages/data/src/data-table/data-table.tsx` L4173.
- **Lint `conventions/focus-ring-only`** accepts `outline-none` only when the same class string also has `focus-ring`, `focus-ring-within`, `focus-ring-inset` or `focus-ring-static` (its regex does not match `focus-ring-static-inset`).
- **Lint `no-index-key-reorderable`** fires on `.map((p, i) => <… key={i}>)` over split paragraphs — render one `Text` with `whitespace-pre-line` instead.

### App names Home and the card use (existing @ 61702bd1)

```ts
// DG-21 — workspace/client.ts: WorkspaceFile L14 { path, title | null, kind, mtime, size, hasThumb }, WorkspaceTree L28
//   { folders, files }, getTree L106, fileUrl L111 (a `?path=` URL, so append `&v=<mtime>`), thumbPathOf L116
//   (`a/b.yaml` → `a/b.thumb.png` since d2f7f0e2; it was `.thumb.svg` at 61702bd1 — never hard-code the suffix),
//   readFile L121 → { text, mtime }, createUniqueFile L161 (folder, name, text) → path
//   (`name.yaml`, then `name-2.yaml` … `name-99.yaml`)
// DG-21 — workspace/workspace-store.ts: RECENTS_KEY L31, RECENTS_LIMIT L33 (12), WorkspaceState L43 { tree | null,
//   recents, current, dirty, save, savedAt, conflict, … }, useWorkspace L95 (selector), folderOf L100, currentFolder L110,
//   workspaceActions L210 { refreshTree L212, open L222, saveNow L254, create L318 (folder, title) → path, rename L327,
//   move L334, trash L349, loadVersions L366 }
// DG-21 facts: live reload refreshes the tree on SSE open and on every event; a thumbnail is written only after a save
//   with a clean compile, in the light theme, at most every 10 s (use-autosave.ts THUMB_INTERVAL_MS); since d2f7f0e2
//   it is a 480×270 PNG (about 25 KB) served as image/png. The server sends `Cache-Control: no-store` and ignores
//   unknown query params. No example has a thumbnail until someone edits and saves it.
// examples/index.ts: DiagramExample L9, EXAMPLES L23 (id, label, description, path) — no `text`; the YAML lives in the
//   workspace, so a template copy reads it with readFile(example.path).
// spec/dialect: parseArchYaml (parse.ts L15), normalizeArch (normalize.ts L59) → .ast for ids, labels, icons.
// DG-18 — interaction/details-card.tsx: detailKind L34, DetailsCard L72 (anchoring, delays, Esc and focus return stay).
// nodes/arch-node-data.ts: ArchNodeData already has `description?` and `href?` (the node's own link).
```

### Names planned by other items (verify after they merge)

**None of these exist at 61702bd1.** The reference branch stubs them in `src/routes/dg22-stubs.ts` and `src/catalog/catalog-service.ts`; builders import the real modules.

```ts
// DG-22 (its steps 1, 3, 4, 6) — routes/use-hash.ts: parseRoute(hash) → { kind: "home" } |
//   { kind: "doc", path, present?, step? } | { kind: "catalog", vendor?, entry? } | { kind: "settings" } |
//   { kind: "dev", name }; toHash(route); `#` and `#home` → home.
//   openDoc(path) (step 3; DG-22 names no module — find it by name). shell/mode-store.ts: mode "view" | "edit" per
//   document (setter not named). shell/workspace-tree.tsx: the folder tree. shell/keymap.ts: ⌘K opens a ui Command
//   palette (its file is not named).
// DG-24 (orchestrator contract, 2026-09-27) — catalog/catalog-service.ts:
//   CatalogEntry { name, vendor, slug, label, description?, docs?, kind?, tags, aliases, part?, curated,
//     docsUnverified?, iconPath? } — `name` is the `vendor/slug` key a node's `icon:` holds; `label` the product name
//   catalogService { ready, get, search, suggest, vendors, stats(): { total, withoutDescription, docsUnverified },
//     update, subscribe }; useCatalogEntry(name) → CatalogEntry | undefined
//   R1 (built on diagram/harden-r1-catalog, see "R1 reference" below): no `update`; adds state(), all() and
//     useCatalog() → { entries, problems, loaded, live }.
```

### Names DG-23 and DG-25 add (reference branch at 87201017)

```ts
// DG-23 — home/connect-info.ts: ATLAS_MCP_URL L9, ATLAS_MCP_NAME L12, CLAUDE_CODE_COMMAND L15,
//     CLAUDE_DESKTOP_CONFIG L23, AtlasPrompt L29, ATLAS_PROMPTS L39
//   home/search.ts: SearchEntry L19, ReadText L42, indexText L51, buildIndex L82, rankEntry L108, diagramFilter L124,
//     matchOf L133, resolvesTo L149, WorkspaceHealth L153, workspaceHealth L163, usersOf L181, refreshSearchIndex L196,
//     useSearchIndex L207
//   home/recent-card.tsx RecentCard L55 · home/health-tiles.tsx catalogModule L36 (eager glob),
//     useCatalogWithoutDescription L43, HomeSectionId L52, HealthTiles L74
//   home/start-from.tsx NewDiagramButton L48, TemplatePicker L108 · home/connect-dialog.tsx ConnectDialog L89
//   home/diagram-search.tsx DiagramSearchGroup L35, DiagramSearchDialog L71 · home/components-panel.tsx ComponentsPanel L71
//   home/home-view.tsx HomeView L62
// DG-25 — nodes/arch-node-data.ts: ArchNodeStatus L18, ArchNodeMetrics L21 (ArchNodeData gains docs?, status?, metrics?)
//   interaction/node-details.ts: detailKind L22 and safeHref L27 (moved from details-card), componentPathOf L42,
//     NodeDetails L47, resolveNodeDetails L92, formatMetric L128
//   fixtures/details-fixture.ts: DETAILS_FIXTURE_PARAM L11 ("details-fixture"), withDetailsFixture L32
```

## Atlas wave 1 — server, MCP, catalog (DG-35, DG-24)

> **R1 scope (2026-09-27):** the release plan cut DG-35's tab bridge (render, open, present) and every MCP resource, and DG-24's in-app catalog edit. The measurements below stay true and are kept for the items that bring those back. The localhost guard (`server/local-guard.mjs`) is already on `/api/workspace` (`aaead782`). With the tab bridge cut, the named-event plumbing it brought (`createEvents().send(type, data)`, `onServerEvent`) is DG-24's in R1; the last subsection, "R1 reference", is the catalog as built on DG-35's R1 branch.

Read at `diagram/atlas-integrate` 61702bd1 (DG-21 merged). Reference code: branch `diagram/harden-w1-mcp` (0a34f7de, 4c005572) — typechecked (`0` errors), linted (`✖ 12 problems (0 errors, 12 warnings)`, the baseline), Prettier-clean, and driven on a dev server at :5192. "Ran" below means the output was observed; "read" means taken from source only.

### Vite 6.4.3 — running app code in the dev server

- **`ViteDevServer.ssrLoadModule(url: string, opts?: { fixStacktrace?: boolean }): Promise<Record<string, any>>`** — `vite/dist/node/index.d.ts` L3105–3107; the server method is `dep-Dm0c1Wj2.js` L38633–38635, and the implementation at L25310 runs `server.environments.ssr` through `SSRCompatModuleRunner` (L25345: `hmr: false`, `ESModulesEvaluator`).
- **It works from a plugin's `configureServer` for a `.ts` file under `src/`.** Ran: `server/spec-bridge.mjs` calls `server.ssrLoadModule("/src/server-surface.ts")` lazily per request. It loaded the parser, the validator, `compileArch`, `validateFlowSpec`, `buildArchSchema` and `index.json`, and validated `examples/lakehouse-aws.yaml` (`ok: true`, 2 info issues) and a broken text (`unknown-endpoint` error at line 9, col 10). Never call it in the body of `configureServer` itself: call it per request.
- **Edits reach the next call without a restart.** On a watcher `change`, `environment.moduleGraph.onFileChange(file)` runs for every environment (L38798). `invalidateModule` (L47663) clears the SSR result, and the runner re-imports. Ran: an edit to `src/spec/dialect/validate.ts` (two imports below the surface module) changed `spec_validate`'s message on the next call; reverting it changed the message back. The log shows `(ssr) page reload src/spec/dialect/validate.ts`. **Do not add a cache in the bridge.**
- **A plugin's middleware runs BEFORE Vite's own host check and CORS.** `_createServer` (L38813–38825) runs the `configureServer` hooks, then `rejectInvalidRequestMiddleware`, `corsMiddleware`, and `hostCheckMiddleware` (L32320, `isHostAllowedWithoutCache` L32262). `/api/workspace` (DG-21) and `/mcp` therefore get neither check.
  - Ran: with `Host: evil.example:5192`, the answer was the app's own 403 text, not Vite's "Blocked request".
  - DG-21 as merged accepts a cross-origin `text/plain` POST, because `readJson` ignores `Content-Type`. That is a localhost CSRF: any web page could trash or move workspace files. Read, not exploited; the reference guard answers 403.
  - **Fix:** `server/local-guard.mjs` `refuseNonLocal(req)` (reference L32). It requires `Host` to be localhost, 127.0.0.1 or [::1], and `Origin`, when present, to equal `http://<Host>`. Mount it on both `/api/workspace` and `/mcp`.
  - Ran (guard in place):

    | Request                         | Result |
    | ------------------------------- | ------ |
    | Same-origin EventSource         | opens  |
    | Same-origin POST                | 200    |
    | No Origin (curl, Claude Code)   | 200    |
    | `Origin: http://localhost:3000` | 403    |
    | `Origin: https://evil.example`  | 403    |

- **Server-side `.mjs` imports `yaml` 2.9.1.** Ran: `import { parse, parseDocument } from "yaml"` from `apps/diagram/server/` resolves, because the app depends on it.
  - A `parseDocument(…)` + `doc.setIn([...], value)` + `doc.toString({ lineWidth: 0, flowCollectionPadding: false })` round trip keeps a header comment and inline comments. It appends new keys in block style.
  - `doc.createNode(["a", "b"], { flow: true })` writes `[a, b]`. Without `flowCollectionPadding: false`, the output is `[ a, b ]`.
  - This is fine for catalog files the server owns. It is **not** fine for diagrams: write-back.ts L1–10 bans Document round trips there.
- **Node 22.22.0 `fetch` HEAD with a timeout.** Ran: `fetch(url, { method: "HEAD", redirect: "follow", signal: AbortSignal.timeout(5000) })` against `https://docs.aws.amazon.com/lambda/` → `200` in 322 ms. An unreachable host rejects with `TimeoutError` "The operation was aborted due to timeout".
- A browser import of `/public/icons/index.json` logs Vite's "Assets in public directory cannot be imported from JavaScript" warning once per load. `register-packs.ts` has always done this; it is harmless (the JSON plugin still serves it).

### React-free (Node-safe) vs not — measured by imports

- **Node-safe:**
  - `src/spec/dialect/**`: `yaml`, and `@elabs-ai/components-ui/definition` (a pure subpath);
  - `src/spec/flow-spec/**`: type-only `@xyflow/react`;
  - `src/spec/compile/compile-arch.ts` and `arch-definitions.ts`;
  - `src/state/edit-text.ts`: imports `parseArchYaml` only;
  - `src/state/entries.ts`: type-only imports;
  - `src/spec/dialect/write-back.ts`.
- **Not Node-safe:**
  - `src/spec/compile/registry.ts`: React node components and `@elabs-ai/components-flow`;
  - `src/state/compile-text.ts`: the registry, plus `icons/icon-names.ts` → `lucide-map.ts` (lucide-react) and `register-packs.ts` (React, `@elabs-ai/components-icons`);
  - `src/state/diagram-store.ts`: `useSyncExternalStore` and a `?raw` seed;
  - `src/icons/*`, except `lucide-names.ts` and `icon-names.ts` after the split.
- **The split (reference commit 0a34f7de):**
  - `src/spec/check-text.ts` `checkText(text, iconNames)` (L46) is `compileText` minus `toReactFlow`/`decorate`. It uses `ARCH_DEFINITIONS` (`compile/arch-definitions.ts` L108; `createArchRegistry().definitions` is that same object, `registry.ts` L115).
  - `DiagramIssue` (L23) and `IssueStage` (L20) moved there; `compile-text.ts` re-exports them.
  - `src/icons/lucide-names.ts` `LUCIDE_NAMES` (L7) and `LucideIconName` (L50) are plain strings. `lucide-map.ts` types its map `as const satisfies Record<LucideIconName, LucideIcon>`.
  - `src/icons/icon-names.ts` `ICON_NAMES` now imports `index.json` and `LUCIDE_NAMES` directly.
  - `src/server-surface.ts` is the one module the server loads (`checkDiagram` L22, plus re-exports).
  - Ran: the app still renders the seed (19 nodes, 14 edges, no page errors).

### MCP wire conventions (`packages/cli/lib/mcp.mjs`, `mcp-http.mjs`)

- **Protocol.** `PROTOCOL_VERSION = "2024-11-05"` L46; `SUPPORTED_PROTOCOL_VERSIONS = ["2025-06-18", "2025-03-26", PROTOCOL_VERSION]` L53; `SERVER_INFO` L60.
  - `initialize` echoes a supported requested version, else answers `PROTOCOL_VERSION` (the oldest).
  - Atlas answers its newest (`2025-06-18`) instead, as the spec's SHOULD says. Ran: asking for `1999-01-01` gets back `2025-06-18`.
- **Helpers** L248–250 `result` / `error` / `textContent`. **Tools** `TOOLS` L137: `{ name, description, inputSchema: { type: "object", properties, required?, additionalProperties: false } }`.
- **Errors.**

  | Case               | Answer                                                                      |
  | ------------------ | --------------------------------------------------------------------------- |
  | Tool failure       | a RESULT `{ content: [{ type: "text", text }], isError: true }` (e.g. L305) |
  | Unknown tool       | `-32602 "Unknown tool: <name>"` (L654)                                      |
  | Unknown method     | `-32601 "Method not found: <m>"` (L659), but a notification gets no answer  |
  | Not an object      | `-32600 "Invalid Request"` (L628)                                           |
  | Unparsable JSON    | `-32700 "Parse error"` (stdio L685; HTTP 400, `mcp-http.mjs` L68–76)        |
  | Empty batch        | HTTP 400 `-32600` (L80–84)                                                  |
  | Only notifications | 202 with no body (L87)                                                      |

- **HTTP.** Stateless: no `Mcp-Session-Id`. `GET` → 405 `Allow: POST, OPTIONS` (L62–66). The CLI's `OPTIONS` → 204 with `Access-Control-Allow-Origin: *` (L30–36, L60–61) is **wrong for Atlas**, which writes local files: send no CORS headers and answer every non-POST with 405.
- **Atlas reference** (`server/mcp/`):
  - `handleMessage(msg, ctx)` is **async** (`handler.mjs` L96);
  - `checkArgs(schema, value)` (L28) covers the JSON-Schema subset the tools use;
  - an unknown resource answers `-32002` (MCP's "resource not found");
  - `createMcpMiddleware(ctx)` (`http.mjs` L50) is a Connect handler. `server.middlewares.use("/mcp", …)` strips the prefix, so `req.url === "/"`.
  - `createToolRegistry()` (`tools/index.mjs` L22) checks `TOOL_NAME = /^[a-zA-Z0-9_-]{1,64}$/` (L18) and duplicates.
  - Ran:

    | Request                            | Result                                                                                                                                                      |
    | ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
    | `initialize`                       | `{ protocolVersion: "2025-06-18", capabilities: { tools: {}, resources: {}, prompts: {} }, serverInfo: { name: "atlas", version: "0.1.0" }, instructions }` |
    | `notifications/initialized`        | 202                                                                                                                                                         |
    | `ping`                             | `{}`                                                                                                                                                        |
    | `tools/list`                       | 8 tools                                                                                                                                                     |
    | `/mcp/x`                           | 404                                                                                                                                                         |
    | batch of a ping and a notification | a one-element array                                                                                                                                         |

- **Names.** Claude Code shows a tool as `mcp__<server>__<tool>`, and the API's tool-name rule is `^[a-zA-Z0-9_-]{1,64}$`. Wire names therefore use underscores: `diagram_read`, not `diagram.read`.

### Workspace service (DG-21) as the MCP tools call it

- **`server/workspace-fs.mjs` exports:**

  | Name                                               | Line |
  | -------------------------------------------------- | ---- |
  | `ROOT`                                             | L25  |
  | `TRASH`                                            | L27  |
  | `COMPONENTS`                                       | L29  |
  | `MAX_TEXT_BYTES = 1_000_000`                       | L31  |
  | `WorkspaceError(status, message, extra)`           | L40  |
  | `safe`                                             | L98  |
  | `relOf`                                            | L131 |
  | `list()`                                           | L157 |
  | `read(rel)`                                        | L191 |
  | `write(rel, text, { overwrite, base, exclusive })` | L213 |
  | `mkdir`                                            | L249 |
  | `move(from, to, { overwrite })`                    | L262 |
  | `trash(rel)`                                       | L299 |
  | `writeThumb`                                       | L321 |
  | `versions`                                         | L370 |
  | `readVersion`                                      | L380 |

- **Ran through MCP:**

  | Call                                | Result                                                     |
  | ----------------------------------- | ---------------------------------------------------------- |
  | `diagram_create` (new path)         | `{ path, mtime, size, warnings: [] }`                      |
  | `diagram_create` again              | `"… already exists. (code: exists)"`                       |
  | `diagram_write` with `base` = mtime | written                                                    |
  | `diagram_write` with a stale `base` | `"… changed on disk. (code: changed)"`                     |
  | `diagram_move`                      | `{ from, to }`                                             |
  | `diagram_trash` of a folder         | `{ path, trashedTo: "_trash/<stamp>-_probe" }`             |
  | `diagram_read("../package.json")`   | `"'..' is not allowed in a workspace path."`               |
  | `diagram_create` with an error      | `"Nothing was written: the YAML has errors.\n- line 9: …"` |

  A `WorkspaceError`'s `extra.code` is appended as `(code: …)`. `mtime` is a float (`1790509408492.415`) and round-trips through JSON exactly.

- **SSE hub** `createEvents(watcher)`: `workspace-plugin.mjs` L88; `broadcast` L92 writes only `data:` frames; `connect` L129.
- **Tab side.** `live-reload.ts` `startLiveReload` L80 listens only through `source.onmessage` (L100), so a **named** event (`event: atlas-request`) never reaches it. Still true on `diagram/dg-35-mcp` ca71854a; DG-24's R1 reference adds `onServerEvent` (see "R1 reference").
- **Opening a file.** `workspaceActions.open(path)` is `workspace-store.ts` L222, and `workspaceStore.get().current?.path` is the open file. `diagramActions.load(text, path)` (`diagram-store.ts` L116) bumps `loadCount`. `canvas-pane.tsx` L86 remounts `ReactFlowProvider key={loadCount}`, and the new canvas starts `inert` (L288, `shown` L218).
  - **Race:** `canvasDrawn()` (`io/export.ts` L93) checks `[inert]` synchronously. Called in the same task as `open`, it can resolve on the OLD canvas. Wait two animation frames first.

### DG-17 exporter (for `diagram_render`) — lines at 61702bd1

The `io/export.ts` lines moved since the wave-3 table above:

| Name                                                                                      | Line |
| ----------------------------------------------------------------------------------------- | ---- |
| `PictureScale = 1 \| 2 \| 3`                                                              | L26  |
| `PictureOptions { transparent? }`                                                         | L28  |
| `Picture { svg, width, height }`                                                          | L34  |
| `CANVAS_WAIT_MS = 10_000`                                                                 | L84  |
| `canvasDrawn()`                                                                           | L93  |
| `pictureOfCanvas(title, options)` (throws "There is no diagram on the canvas to export.") | L760 |
| `svgBlob`                                                                                 | L821 |
| `pngBlob(picture, scale) → { blob, width, height }`                                       | L829 |
| `pictureFileName`                                                                         | L856 |
| `saveBlob`                                                                                | L868 |

`export-menu.tsx` L89–96 composes them as `canvasDrawn().then(() => pictureOfCanvas(title, { transparent }))`, then `pngBlob(p, scale)`. A background tab never lays out, so a render needs a visible tab. **Present:** `enterPresentation()` is `interaction/presentation-mode.ts` L36 (it sets the hash).

### Catalog inputs (DG-24)

- **`public/icons/index.json`**: `{ "<vendor>/<stem>": { path: "/icons/<vendor>/<stem>.svg", label, pack } }`, with 667 keys, sorted.
  - It is written by `scripts/build-icon-index.mjs` (60 lines; `labels.json` overrides L32; sort L53; write L56).
  - 12 vendor folders: aws 273, azure 291, clickhouse 2, databricks 4, gcp 46, k8s 31, microsoft 2, oracle 2, qlik 8, salesforce 3, sap 3, snowflake 2.
  - The small packs: `clickhouse/{clickhouse, clickpipes}`, `databricks/{databricks, delta, unity-catalog, workspace}`, `microsoft/{microsoft, sql-server}`, `oracle/{db, oracle}`, `qlik/{answers, automate, automl, cloud, data-gateway, qlik, sense-enterprise, talend-cloud}`, `salesforce/{data-cloud, mulesoft, salesforce}`, `sap/{btp, s4hana, sap}`, `snowflake/{snowflake, warehouse}`.
- `register-packs.ts`: `IconIndexEntry` L8, `ICON_INDEX` L25, `ICON_PACKS` L30.
- **Validator.** `validate.ts` `validateArch(ast, iconNames)` L7. The unknown-icon block is at L150–159 at 61702bd1: code `"unknown-icon"` at `joinPath(e.path, "icon")`, severity `warning` (`issues.ts`). `unknown-provider` derives providers from `iconNames` (L161–171).
  - `ArchIssue` (`issues.ts` L46) is `{ path, code, message, severity, range? }`. Reference 4c005572 adds `suggestion?: string`.
  - `src/spec/dialect/nearest-name.ts`: `editDistance` L7, `nearestName(name, names)` L24 (limit `max(2, ⌊len/3⌋)`; the same vendor wins a tie).
  - Ran: `aws/lamda` → `aws/lambda`; `azure/cosmosdb` → `azure/cosmos-db`; `lucide/userz` → `lucide/user`; `nothing/close` → none. Fixtures assert `code @ line:col` only, so the longer message breaks none.
- **Node fields v0** (for part snippets):
  - `NodeInput` (`definitions.ts` L158): `id`, `type`, `variant`, `icon`, `badges`, `class`, `tone`, `href`, `text`, `parent`, `position`, plus `headerGroup` `title` / `subtitle` / `description` (`packages/ui/src/lib/definition/groups/header.ts` L13).
  - The node type union is `ArchNodeType` (`spec/dialect/types.ts` L35, `NODE_TYPES` L12), which is React-free. `nodes/arch-node-data.ts` `ArchNodeKind` L12 is the same union.
- **v1 icon sheet.**
  - `icons/icon-sheet.tsx`: `IconSheetProps` L23, `iconSheetHash` L41, `iconSheetVendor` L46.
  - `app.tsx` L150–160 renders it for `#icons` / `#icons/<vendor>`.
  - DG-22 (planned) moves routing to `parseRoute(hash)` with `{ kind: "catalog", vendor?, entry? }` and a placeholder `EmptyState`.
  - Built since (ca71854a): `routes/use-hash.ts` `parseRoute` / `toHash`; the sheet is `#dev/icons[/<vendor>]`, and `app.tsx` `RouteView`'s `case "catalog"` rendered a placeholder `CatalogPage` until DG-24's R1 reference replaced it.
- **ui for the pages** (`packages/ui/src/index.ts`):
  - Lines: `Badge` L165 (variants `default`, `secondary`, `outline`, `success`, `warning`, `destructive`, `info`), `Button` L169, `Card*` L172, `CopyableValue` L185, `Dialog` L189, `EmptyState` L193 (`{ title, description?, icon?, actions?, className? }`), `Input` L209, `Kbd` L212, `Label` L215, `ScrollArea` L242, `Select` L245, `Skeleton` L250, `toast` / `Toaster` L255, `StatePanel` L257, `TagInput` L264, `Textarea` L266, `ToggleGroup` / `ToggleGroupItem` L272, `Tooltip` L274, `Heading` / `Text` L279.
  - `TagInput` props: `value?`, `defaultValue?`, `onValueChange?`, `max?`, `validate?`, `delimiter?`, `placeholder?`.
  - `ServiceLogo` (`packages/icons/src/service-logo.tsx` L97; props L70): `{ name, size?, label?, variant?: "brand" | "mono", logos?, decorative? }`.

### Reference e551aa09 — compose, prompts, resources, tab bridge (ran)

Same branch, typechecked, `0` lint errors, Prettier-clean; driven over HTTP JSON-RPC on :5192 and, for the tab bridge, with a real browser tab.

- **Compose** (`server/mcp/tools/compose.mjs` L75) edits text through `write-back.ts`, then gates with `assertValid`, then writes with `base` = the mtime it read.
  - `appendEntries(text, listPath, items)` (`write-back.ts` L538) and `nodeItem` / `flowItem` (`spec/dialect/entry-text.ts` L16 / L35) are new; `server-surface.ts` re-exports them.
  - Ran, one file: `compose_add_nodes` into a zone and at the top level (created the missing `nodes:` list), `compose_add_flows` (created `flows:`; wrote `- a -> b`, `- a -> b: Write`, `- a -> b: { label: Read, kind: data, secure: tls }`), `compose_set` on a node, on a flow (`{ label: HTTPS, step: 1 }`), on `""` (a new top-level key lands after `title:` with `{ after: "title" }`), and `null` removing a key. A `# comment` on `title:` survived every edit.
  - Ran, refusals: `flow:api->nope` → `"No flow api -> nope."`; a flow to an unknown id → `"Nothing was written: … (unknown-endpoint at flows[3].to)"`; a misspelt icon writes, with the warning's `suggestion: "aws/dynamodb"`.
  - `spec_compile` returned nodes with their `parent` and flows with their `form` (`shorthand`).
- **Prompts** (`server/mcp/prompts.mjs` `createPrompts` L44, files under `mcp/prompts/*.md` with YAML frontmatter, read on every call). Ran: `prompts/list` → `author-diagram (description*, path)`, `write-story (path*)`; a missing required argument → `-32602 "Missing argument: description"`; an unknown name → `-32602 "Unknown prompt: nope"`; no `{{…}}` left in the text.
- **Resources** (`server/mcp/resources.mjs` `createResources` L56). Ran: 5 resources (4 workspace files + `atlas://schema/v0`, 16 000 bytes, `application/schema+json`); a missing file → `-32002 "Resource not found: atlas://workspace/nope.yaml"`.
- **The author-diagram cheat-sheet** (the prompt's YAML block) validates: `{ ok: true, issues: [] }`.
- **Tab bridge.**
  - Server: `createEvents` gains `send(type, data)` (`workspace-plugin.mjs` L143; writes `event: <type>`, returns the client count; in R1 DG-24 adds it, see "R1 reference"), `POST /api/workspace/render-result` (L224, body limit 16 MB), `server/mcp/tab-bridge.mjs` `createTabBridge(hub)` (L27; `TAB_EVENT = "atlas-request"`, `TAB_TIMEOUT_MS = 15_000`).
  - Tab: `live-reload.ts` `onServerEvent(type, listener)` (L64) and `src/workspace/tab-requests.ts` `useTabRequests()` (L109).
  - **`useLiveReload()` must be mounted above the hash router** (`App`), not in `SidebarNav`: `#present` renders `PresentationView` without the shell, which closed the stream. The reference moves it.
  - Ran (15 tools listed):

    | Case                                     | Result                                                                |
    | ---------------------------------------- | --------------------------------------------------------------------- |
    | `diagram_render`, no tab                 | `isError` "No Atlas tab is open. …" in 38 ms                          |
    | `diagram_render` the open file           | PNG 2588×1148, 203 ms, correct picture                                |
    | `diagram_render` ANOTHER file            | opened it; PNG 999×1582 of the new file (no stale canvas), 342 ms     |
    | `story_present`                          | `{ path, title, steps: 5 }`; tab at `#present`, sidebar gone          |
    | `diagram_render` `svg` while presenting  | answered (stream alive), 110 ms                                       |
    | tab reports `visibilityState = "hidden"` | `isError` "The Atlas tab is in the background, …" in 36 ms            |
    | tab never answers                        | `isError` "The Atlas tab did not answer within 15 s." after 15 053 ms |

  - Not run: two tabs at once (first answer wins by design), and a real OS-level background window (the hidden case was simulated by overriding `document.visibilityState`).

### Reference c43d185d — after merging `diagram/atlas-integrate` 9581961f (ran)

- **Merge** (f59d9d08): two conflicts, both resolved by keeping both sides — `verified-apis.md` (the DG-23/DG-25 section first, this one after) and `workspace-plugin.mjs` (9581961f's PNG-sized `MAX_JSON_BYTES = Math.ceil((MAX_THUMB_BYTES * 4) / 3) + 64 * 1024` beside DG-35's `MAX_RENDER_BYTES`). Typecheck `0`, lint `0 errors, 12 warnings`, Prettier clean.
- **Thumbnails are binary since d2f7f0e2** (`<name>.thumb.png`, `thumbPathOf`; `workspace-fs.mjs` `read()` now also returns `bytes`). `workspace.list()` lists diagrams only, so `workspace_tree` and `resources/list` never show a thumbnail (ran: 5 resources, 0 `.png`). A direct read would have returned PNG bytes as UTF-8 text; c43d185d routes every MCP read through `readDiagram(path)` (`server/mcp/tools/workspace.mjs`). Ran:

  | Call                                                                | Answer                                                                           |
  | ------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
  | `diagram_read { path: "examples/lakehouse-aws.thumb.png" }`         | `isError` `Only .yaml diagrams can be read: "examples/lakehouse-aws.thumb.png".` |
  | `resources/read atlas://workspace/examples/lakehouse-aws.thumb.png` | `-32602`, same message                                                           |
  | `diagram_read { path: "../package.json" }`                          | `isError` `Only .yaml diagrams can be read: "../package.json".`                  |
  | `diagram_read { path: "../x.yaml" }`                                | `isError` `'..' is not allowed in a workspace path.`                             |
  | `diagram_read { path: "examples/lakehouse-aws.yaml" }`              | 3 367 characters of text                                                         |

- Tab bridge after the merge (real tab on :5192): `diagram_render` of `examples/qlik-cloud-data-gateway.yaml` → PNG 1198×1416 in 341 ms; with the tab closed → "No Atlas tab is open…" in 32 ms. `tools/list` still 15 names.

### Reference 03deda60 — the catalog service, routes, MCP tools and pages (DG-24, ran)

Commits 590550e8 (service, routes, tools, resource, prompt), de559ebc (docs check refuses private addresses), 03deda60 (pages, one snippet builder). Typecheck `0`, lint `0 errors, 12 warnings`, audit `0/0/0`, Prettier clean. Probe data under `catalog/` was deleted after each run.

- **`yaml` 2.9.1 in a server `.mjs`**: `import { isMap, parseDocument } from "yaml"` works (the app already depends on it). Writing through the Document API keeps every comment and untouched line with `doc.contents.flow = false`, arrays `flow = true`, `toString({ lineWidth: 0, flowCollectionPadding: false })`. **A file's header comment attaches to the first key**: inserting a key before it carries the header down, so new entries are appended (`entryMap`).
- **Merge at request time** (`server/catalog-fs.mjs` `readAll(iconNames)`, iconNames = the app's `ICON_NAMES` through the spec bridge): `GET /api/catalog/all` → 708 entries (667 icons + 40 `lucide/*` + 1 part), 13 vendors, 120 ms. A part whose slug is also an icon, and a part whose `icon:` is unknown, are skipped and listed in `problems`. `build-icon-index.mjs` is not needed.
- **Routes**: a foreign `Origin` → `403` (the DG-35 guard); an unknown route → `404`; `PUT /api/catalog/entry?name=aws/api-gateway` → `{ entry, docsUnverified }` with `curated: true`, 5 ms; `PUT` on a part → `400` "`<name>` is a part: edit catalog/parts/`<vendor>`.yaml by hand.".
- **MCP** (19 tools): `catalog_missing { vendor: "nope" }` → `isError` listing the 12 packs; `{ vendor: "aws" }` → `total: 272` (one curated); `after` skips past a slug. `catalog_update` with 8 entries, 364 ms: 3 written, `lambda` in `skippedCurated`, `amplify` in `docsUnverified` (a real 404), 4 `rejected` (not an icon, 141 characters, `http://`, `https://localhost/…`); a bad `kind` → schema `isError`. `catalog_get aws/dynamo` → `No catalog entry "aws/dynamo". Close: aws/dynamodb.`; `catalog_search gateway` → 7 results; `resources/read atlas://catalog/aws` → `application/yaml`, `atlas://catalog/azure` (no file) → `-32002`. `prompts/get fill-catalog {}` → `-32602 Missing argument: vendor`.
- **Docs check**: HEAD, then GET on 403/405, `redirect: "manual"`, 5 s timeout, `status < 400` = reachable. The host is resolved first (`node:dns/promises` `lookup`, all addresses) and a loopback/private/link-local/CGNAT answer is never fetched: `https://localtest.me/` (resolves to `::1` and `127.0.0.1`) → unreachable in 62 ms with no request; `https://docs.aws.amazon.com/lambda/` → reachable, 336 ms.
- **Watch**: one `event: catalog` `data: {"vendor":"aws"}` per MCP write and per hand edit of `catalog/parts/qlik.yaml` (100 ms debounce). **Vite reloads the whole page on any change under `catalog/`** ("(client) page reload catalog/aws.yaml", measured twice) until `handleHotUpdate` returns `[]` for `CATALOG_ROOT` too; with it, the tab kept its state, got one `subscribe` notification and the new text (`aws/batch` description) without a reload. The same reload happens for `docs/*.md` edits (seen in the log; not changed).
- **Tab** (`src/catalog/catalog-service.ts`, real browser on :5192): `catalogService.get("aws/glue")` right after import → `undefined`; `await catalogService.ready()` (5 ms) first, then it has the description. `stats()` → `{ total: 668, withoutDescription: 662, docsUnverified: 1 }` (lucide excluded); `suggest("aws/dynamo")` → `aws/dynamodb`.
- **Pages** (v1 hash wiring on the reference only): `#catalog/aws` grid of 273 with names and one-liners; `#catalog/aws/dynamodb` edit → Save wrote `curated: true` and the new description to `catalog/aws.yaml`; an `http://` docs URL → `role="alert"` "aws/dynamodb: docs must be an https:// URL."; Edit moves focus to "Product name", Cancel returns it to Edit; `#catalog/qlik/data-gateway-direct` shows the part read-only with its snippet; `#catalog/aws/dynamo` → "No catalog entry “aws/dynamo”" with a link to `aws/dynamodb`. Dark theme checked on `#catalog/qlik`. Inside DG-22's shell the top bar owns the page `<h1>` (`shell/top-bar.tsx` L224 on 7515caf2), so the pages start at `<h2>`.
- **Seeds and parts** (4bcef440): 12 seed files (a two-line header comment and `{}`) plus 15 parts in `catalog/parts/{qlik,snowflake,databricks,clickhouse,sap,generic}.yaml` → `/api/catalog/all` 722 entries (667 icons, 40 `lucide/*`, 15 parts), 13 vendors besides `lucide`, `problems: []`; `catalog_missing aws` → `total: 273` from `activate`. The 15 parts' `catalog_get` snippets under `diagram: 0` pass `spec_validate` (`ok`). A seed keeps its header after a server write, and the written file passes Prettier.

### R1 reference — `diagram/harden-r1-catalog` on `diagram/dg-35-mcp` ca71854a (DG-24, ran)

The R1 catalog, built on DG-20/21/22/35 as they are: read-only pages, MCP the only writer, no catalog resource. Commits 60c0c538 (read model), 2bd2858b (route, named event), 13c64fc9 (seeds, parts), 3b14615d (MCP tools, prompt, snippet), 7f3c2611 (suggestions), 4d232644 (service, `onServerEvent`), fcc651b3 (pages in `RouteView`), 5565d72b (three filled entries); review fixes 19fab088 (a part is curated only with `curated: true`), bf69d513 (prompt: own words, generic glyphs left out), 1d773e89 (visible ↗, the part hint), 6964a94f (Qlik Data Gateway's own help page). Typecheck `0`, lint `0 errors, 12 warnings`, audit `--strict` exit 0, Prettier clean on all 39 touched files; nothing outside `apps/diagram/`. Dev server on :5201.

- **Names and lines at 5565d72b:**
  - `server/catalog-fs.mjs`: `CATALOG_ROOT` L28, `KINDS` L33, `MAX_DESCRIPTION = 140` L36, `MAX_BATCH = 25` L37, `packs` L61, `vendorOf` L74, `readAll(iconNames)` L120, `search` L193, `docsProblem` L209, `docsReachable` L254, `missing` L295, `update(vendor, patches)` L390. The one writer; there is no `by` argument, and `readVendorText` / `vendorFiles` (the old catalog resource) are gone.
  - `server/workspace-plugin.mjs`: `createEvents` L102, `send(type, data)` L148, `catalogRoute` L236 (only `GET /all`), `watchCatalog` L246 (started at L280), the route mounted at L294 (`refuseNonLocal` first; `/api/workspace` is L285), `handleHotUpdate` returns `[]` for `CATALOG_ROOT` at L314. On a base with `diagram/atlas-integrate` 02792752 the hook is `hotUpdate` (Vite 6 calls the legacy `handleHotUpdate` only for edits, not for a created, moved or deleted file): the catalog line goes into `hotUpdate`.
  - `server/mcp/tools/index.mjs` `TOOL_GROUPS` L22 gains `catalogTools`; `catalog.mjs` names `catalog_search` L30, `catalog_get` L51, `catalog_missing` L79, `catalog_update` L105.
  - `src/workspace/live-reload.ts` `onServerEvent(type, listener)` L65 (`addEventListener` on every open `EventSource`; `onmessage` never sees a named event). The stream is `ShellServices` (`shell/diagram-shell.tsx` L64), which `App` renders once above `RouteView` (`app.tsx` L459): every route hears `catalog`, presentation included (dry run on `&present`: the new description arrived within 1.2 s).
  - `src/catalog/catalog-service.ts`: `CATALOG_URL` L18, `CATALOG_EVENT` L20, `CatalogEntry` L29, `catalogService` L127 (`ready` L129, `state` L132, `get` L135, `all` L138, `suggest` L158, `vendors` L162, `stats` L172, `subscribe` L184), `useCatalogEntry` L194, `useCatalog` L201. `state().live` is `true` once `/api/catalog/all` loaded, `false` on the bundled-index fallback.
  - `src/catalog/entry-snippet.ts` `entrySnippet` L17 (re-exported by `server-surface.ts`); `catalog-view.tsx` `CATALOG_LABELS` L12, `CatalogView` L39; `entry-view.tsx` `ENTRY_LABELS` L27, `EntryView` L65.
  - `src/app.tsx` `RouteView` `case "catalog"` L420; `routes/use-hash.ts` maps bare `#icons[/<vendor>]` to the catalog at L113 (its comment L112); `shell/top-bar.tsx` owns the one `<h1>` (L224), so the pages start at `<h2>`.
- **HTTP** (`node:http`, forged headers): `GET /api/catalog/all` 200 in 15 ms (6 ms warm), 722 entries (667 icons, 40 `lucide/*`, 15 parts), `problems: []`; `Origin: https://evil.example` → 403; `Origin: http://localhost:3000` → 403; `Host: evil.example` → 403 "This server only answers requests addressed to localhost."; `GET /nope` → 404; `PUT /entry` → 404 "No route PUT /api/catalog/entry.". In the tab: 18 ms, 147 669 bytes of JSON.
- **MCP**: `initialize` capabilities `{ tools: {}, prompts: {} }`; `tools/list` 16 names in 1–2 ms (15 ms on the first call); `prompts/list` → `author-diagram(description*, path)`, `fill-catalog(vendor*)`; `prompts/get fill-catalog { vendor: "aws" }` → 2 641 characters, no `{{` left, the N5 line present; `resources/list` → `[]`; `resources/read atlas://catalog/aws` → `-32002`.
  - `catalog_update` with 7 entries, 354 ms: `api-gateway`, `batch`, `amplify` written, `amplify` in `docsUnverified` (a real 404), 4 `rejected` (141 characters, `http://`, `https://localhost/x`, not an icon). After `curated: true` by hand, `batch` lands in `skippedCurated` and the file is unchanged. A bad `kind` → schema `isError`. The probe restored `aws.yaml`.
  - `catalog_get aws/dynamo` → `isError` "No catalog entry "aws/dynamo". Close: aws/dynamodb."; an unfilled entry's title is the index label (`aws/dynamodb` → `Dynamodb`). `catalog_search gateway` → 8 names in 4 ms (three `aws`, two `azure`, `qlik/data-gateway` and its two parts). The 15 parts' snippets pass `spec_validate`.
  - Suggestions: `aws/lamda` → `aws/lambda`, `azure/cosmosdb` → `azure/cosmos-db`, `lucide/userz` → `lucide/user`, `nothing/close` → none.
- **Named event**: a hand edit of `catalog/parts/qlik.yaml` → one `event: catalog` `data: {"vendor":"qlik"}` frame; no "page reload" for any `catalog/` file in the dev log. With a tab on `#catalog/aws/athena`, one `catalog_update` changed "No description yet." to the new text without a reload, and a `git checkout` of the file changed it back.
- **Fill (three entries, real loop)**: `aws/glue`, `azure/virtual-networks`, `qlik/data-gateway`, 1 entry per call, 195–285 ms each (the docs check dominates). 6964a94f rewrote `qlik/data-gateway`'s docs through `catalog_update` (169 ms) from the Qlik Cloud help root (`HEAD` 302) to the "Data gateways" page (`…/Sense_Hub/Gateways/setting-up-gateways.htm`, 200, both gateways). On help.qlik.com a made-up page answers 302 to `/en-US/cloud-services?msg=na`, which `docsReachable` counts as reachable (status < 400): for Qlik the check does not prove the page exists; open it. `catalog_missing` then: aws 272 of 273, azure 290 of 291, qlik 7 of 8.
- **Browser** (:5201, 1440×900, light and dark): `#catalog` 682 tiles (lucide hidden), `#catalog/aws` 273, `#catalog/aws/glue` shows the description, "Open docs (opens in a new tab)" with `target="_blank"` and `rel="noopener noreferrer"`, the text badge "Not checked yet", tags, the file hint and the snippet. Tab order on the entry page after the shell: breadcrumb "Catalog", "aws", "Open docs", "Copy YAML", each with a visible ring. Copy YAML hands the snippet to `navigator.clipboard.writeText` (headless Chrome denies the write itself). `#catalog/aws/glu` → "Did you mean aws/glue?" with a link. `#icons/aws` → the aws grid; `#dev/icons` → the sheet. `#dev/spec-check` → 37 of 37. Switching from `#home` to `#catalog` renders 682 tiles in 765 ms, `#catalog/aws` in 632 ms, an entry in 57 ms; a cold load of `#catalog` from the dev server has first contentful paint at 888 ms.
- **Review fixes** (ran on :5217 at 6964a94f, 1440×900): `/api/catalog/all` → 722 entries, 15 parts, 0 of them curated, `problems: []`; `#catalog/qlik/data-gateway-direct` → badges "Part", "service", "Not checked yet" and "To correct this part or mark it checked, edit catalog/parts/qlik.yaml and set curated: true there."; `prompts/get fill-catalog { vendor: "aws" }` → 2 850 characters with the own-words and glyph lines; "Open docs ↗" keeps the accessible name "Open docs (opens in a new tab)".
  - Keyboard on a fresh `#catalog`: after the shell's 8 controls, the search box, "All" (`aria-current="page"`), the 13 vendor links, then the first tile (`#catalog/azure/abs-member`), each `:focus-visible` with the ring. Enter on a tile opens its entry page; focus falls to `<body>` (the tile unmounts; DG-22's router moves no focus), and the next Tab lands on the breadcrumb "Catalog" (the browser keeps its sequential-navigation start point).
  - Greyscale (`filter: grayscale(1)`, light): the current vendor link is a filled grey button with no border, the others white and outlined (fill ≈ `oklch(0.875 …)` against `oklch(0.985 …)`, a weak contrast but a different shape); every badge is text.
  - Copy YAML with `navigator.clipboard.writeText` stubbed: the string `- id: glue\n  icon: aws/glue\n  title: AWS Glue\n`, the button reads "Copied"; appended as-is under `nodes:` (`diagram: 0`, `title: Copy check`) it passes `spec_validate` (`ok: true`, no issues).
  - With a tab open on `#home` and `window.__mark = 1`, a `catalog_update` (310 ms) logged no "page reload" and `__mark` stayed 1. With no tab open the grep proves nothing (nothing to reload).
- **Local-mode smoke (N2)**: Home → a workspace diagram → E (editor) → typed into the title → ⌘S wrote it to disk → Present (`&present`, Esc back) → Export PNG 1× (2581 × 884 px, 274 326 bytes). No page errors; the console shows React's known duplicate-key error from `canvas-pane.tsx` L145 (`"col-span-2 h-36"` twice), fixed on `diagram/atlas-integrate` 84453231 and not on this base.
- **`vite build` + `vite preview`**: the app loads; `/api/catalog/all` is the SPA's HTML there, so the service falls back to the bundled index: 667 tiles from 12 vendors, no parts, no descriptions, `POST /mcp` → 404 (`GET /mcp` answers the SPA's HTML). That is the R1 behaviour without the dev server.

## DG-26 — reference-first nodes (Part 1b, built 2026-09-28)

The sub-section below is the reviser's pre-build line-by-line audit (`.evidence/dg-26-amend/final-verified-apis.md`), carried in verbatim as the record of what Part 1b started from. It predates the maintainer's 2026-09-27 ruling being fully applied and predates 1b.12 (fixtures, spec-check rows); line numbers in it are as of the commits it names, not the tip of `diagram/ref-1b`. Where the actual build differs:

- **Gateway nodes** use the GENERAL `catalog/qlik/data-gateway` entry (the maintainer's ruling, restated in this dispatch), not the `-direct`/`-movement` parts an earlier partial build had used; §"Catalog and references" below still lists the two parts as they exist in the catalog (both remain valid entries — only the workspace files' choice changed).
- **`refFirstText`** ships as `refFirstText(text, catalog, choices?)` — `choices` maps a node id to a catalog name or `"custom"`, and a node not named defaults to trying its own written `icon:` as the catalog name (the audit below, written before this signature was finalized, does not cover it).
- **1b.12** added two fixtures (`valid-ref-catalog.yaml`, `issue-ref-missing.yaml`) and two `#dev/spec-check` tables ("Reference-first", 5 rows; "Catalog bundle", 1 row) on top of the 37 checks the audit's baseline (`0.2`) measured; the page reads "75 of 75 checks pass" on the built branch (review round 1 F4 — corrected from an earlier "72 of 72" count taken before later fixture additions).
- The seven workspace files' reference-first shape (55 catalog references: tenant 4, clickhouse 5, lakehouse 12, gateway 7, onprem 6, landscape 8, pipeline 13) matches the audit's 1b.8 model exactly — confirmed against the actual migration, not just modeled.
- **Where the "Measured" section below (§ read-only scratchpad scripts) disagrees with the maintainer's 2026-09-27 ruling** (review round 1 F4): that section predates the ruling and is carried in verbatim as a record of what the audit started from — it is not the built grammar. The built `SEGMENT_RE` (`src/spec/dialect/ids.ts`) **rejects** a leading `"_"` segment, so `ws/_drafts/x` is `bad-ref`, not accepted; and a trailing `.yaml`/`.yml` (any case) on the last segment is **stripped**, not rejected, so `ws/x.yaml` is a valid reference to the same file as `ws/x`. Read every `ws/_drafts/…` and `ws/….yaml`/`.yml` line under "Measured" with that correction.

## DG-26 (hardened 2026-09-27, amended for reference-first nodes)

Read on `main` `96a105da` and re-checked at `d21be4dc` (= `origin/main` late on 2026-09-27; `git diff --quiet 96a105da d21be4dc -- apps/diagram` exits 0). Under `apps/diagram/` the tree equals `1e5de2c9`; its last code change there is `c8fed5b7`. It contains DG-68 (merge `2d196060`, follow-ups `1daceb9c`), the port dots (`807c4034`) and the catalog crumbs (`4af6a3e0`, `63b42e8d`). Compared with the hardening's basis `f5891537`, lines moved only in `src/panes/canvas-pane.tsx`, `src/nodes/service-node.tsx` and `src/catalog/entry-view.tsx`; the numbers below are the new ones. The maintainer's ruling and answers are `roadmap/CURRENT.md:38` (item 1d). The 32 anchors of DG-26 step 0.3 each printed exactly one line on `96a105da` and again on `d21be4dc`. Paths are relative to `apps/diagram/` unless rooted at the repo. DG-69 and DG-70 (CURRENT.md:18) are not on `main`; once they merge, find lines in `catalog-fs.mjs`, `catalog-service.ts`, `catalog.mjs`, `compose.mjs`, `live-reload.ts` and `SKILL.md` by their quoted text.

### Dialect: types, definitions, ids, issues

- `src/spec/dialect/types.ts:2` header "Dialect v0 vocabulary …"; `:5` `export const DIALECT_VERSION = "0";`; `:117` `ArchDiagram`; `:118` `version: typeof DIALECT_VERSION`.
- `src/spec/dialect/definitions.ts:41` `const TONES = statusGroup.fields.status.values;` (`packages/ui/src/lib/status-tone.ts:12` `STATUS_TONES`, which includes `destructive`).
- `src/spec/dialect/definitions.ts:44` `OPEN_ENTRY = field.object({ fields: {}, open: true })`; `:45-51` `POSITION`; `:52-55` `CLASS_LIST`; `:57-72` `RootInput` (`:58` `diagram: "0" | 0;`; `:67-68` `zones`/`nodes` typed `readonly Record<string, unknown>[]`; `:70` `styles?: Record<string, unknown>`).
- `src/spec/dialect/definitions.ts:74-121` `ROOT_DEF` (`:78` description "brand-ui architecture diagram, dialect v0."; `:81-85` `diagram` enum, `:82` `values: ["0", 0]`; `:94` `theme`; `:109` `styles: OPEN_ENTRY`).
- `src/spec/dialect/definitions.ts:137-163` `ZONE_DEF` (`:141` `groups: [headerGroup]`); `:179-205` `NODE_DEF` (`:183` `groups: [headerGroup]`; `:186` type default "service"; `:188` icon; `:189` badges); `:222-249` `FLOW_DEF` (`:228-229` free-string `from`/`to`; `:240` free-string `schedule`).
- `packages/ui/src/lib/definition/field.ts:13-15` a `FieldMap<P>` field's value type "must match the prop's type exactly (readonly and mutable arrays count as the same)"; `:37` `FieldTier`; `:82` `FieldOptions.description`; `:84-87` `StringFieldOptions` (`min`, `max`); `:116-120` `ObjectFieldOptions` (`fields`, `open`); `:122-127` `ArrayFieldOptions`; `:243-250` `ObjectValue` (optional keys for fields without `required: true`, an index signature when `open`); `:299` `FieldMap`; `:356-358` `field.object`; `:361-363` `field.array`.
- `src/spec/dialect/ids.ts:4` `ID_SOURCE` (no `.`, no `:`); `:5` `ID_RE`; `:8` `ARROW_PATTERN` (groups 1 from, 2 arrow, 3 to); `:10` `ARROW_RE` (flag `d`); `:12-16` `ARROW_DIRECTION`. The file has no imports.
- `src/spec/dialect/issues.ts:7-36` `ISSUE_SEVERITY`, 28 codes (`:12` `unsupported-version` error; `:27` `missing-owner` warning; `:29` `unknown-endpoint` error; `:30` `zone-endpoint` info); `:41-44` `KEY_ANCHORED`; `:46-54` `ArchIssue` (`:52-53` `suggestion`, "a replacement value for the key at `path`"); `:56-58` `issue(code, path, message)`.
- `src/spec/dialect/nearest-name.ts:24-40` `nearestName(name, names)`: limit `max(2, floor(name.length / 3))`; same vendor wins a tie by half an edit (`:32-33`); then alphabetical order.
- `src/spec/dialect/form-spec.ts:13` `export const UNSET = "__unset";`; `:80` `entryFormSpec(def, options)`; `:89` a field without `tier` goes to Advanced; `:108-114` `defaultsOf`; `:125-138` `entryFormValues(spec, def, written)` = `toFormValue(written[name] ?? defaults[name])`, else `UNSET` for an enum (`:135`), so an unwritten `type` shows "service"; `:144` `seedFormSpec`; `:168-190` `entryFormPatch`.
- `packages/ui/src/components/schema-form/schema-form.tsx:732` renders a field's `description` as its help text.

### Dialect: normalize, validate, parse, write-back, schema

- `src/spec/dialect/normalize.ts:16` `type Rec`; `:24-25` `ZONE_ONLY`/`NODE_ONLY` from `Object.keys(X_DEF.fields)` (own fields only; `headerGroup` fields excluded), so a key added to `NODE_DEF.fields` alone is node-only and a key added to both classifies nothing.
- `src/spec/dialect/normalize.ts:55-57` `pick`; `:59` `normalizeArch(raw, map)`; `:60-71` not-a-diagram (message `:67`); `:72-83` `if (String(raw.diagram) !== DIALECT_VERSION)` returns `unsupported-version` at path `diagram`, no AST (message `:79`); `:86-90` `check(def, rec, path)`; `:92` `rootBad`.
- `src/spec/dialect/normalize.ts:102-183` `readEntry(entry, path, forced, nestParent)`: `:109-124` classification only when unforced (`:112` node keys); `:125` `check(kind === "zone" ? ZONE_DEF : NODE_DEF, entry, path)`; `:127-136` `bad-id`; `:137-146` `parent-conflict`; `:147` `parent`; `:148-158` `common` (`:152` `title ?? id`); `:159-167` zone push; `:168-171` children read unforced; `:172-181` node push (`:175` `type ?? "service"`). `:185-186` top-level `zones:`/`nodes:` forced; `:192-209` `endsFrom` (`:204-208` `direction`); `:216`, `:226` bad-flow messages; `:299` `version: DIALECT_VERSION`; `:301` `description` (DG-68).
- `src/spec/dialect/validate.ts:8` `validateArch(ast, iconNames)`; `:74-86` `missing-owner`; `:103` flow loop; `:104` end loop; `:106-113` `zone-endpoint`; `:114-118` `unknown-endpoint`; `:151-165` `unknown-icon` with a `nearestName` suggestion; `:180-190` `unknown-note-target`.
- `src/spec/dialect/index.ts:9-16` `ArchCheckResult`; `:18-39` `checkArchYaml(text, iconNames)` (validates only with an AST, `:26`); `:41-43` re-exports `parseArchYaml`, `normalizeArch`, `validateArch`; `:51` `export * from "./types"`.
- `src/spec/dialect/parse.ts:15` `parseArchYaml`; `:48` `raw` is `undefined` on a YAML error.
- `src/spec/dialect/write-back.ts:1-11` no `yaml` Document round trip; `:36-46` `applyEdits`; `:61-65` and `:66-78` `yamlScalar` (exported; quotes only when a plain scalar would not read back the same); `:101-108` `valueAt`; `:110-116` `KeyInfo`; `:118-126` `MapInfo`; `:143-156` `mapAt`; `:182-199` `removeKey` (private; drops the whole line with a trailing comment); `:202-220` `replaceValue` (private); `:279-291` `setEntryKeys(text, path, patch, options?)` → `string | null` (`""` = top level). No helper renames a key.
- `src/spec/dialect/entry-text.ts:16-23` `nodeItem` sorts only `id` first.
- `src/spec/dialect/schema.ts:25-28` `withIdPattern`; `:30-33` `withoutPosition`; `:35` `buildArchSchema`; `:36` `const node = withIdPattern(fragment(NODE_DEF));`; `:41-51` `zoneWith`; `:64`, `:72` `ARROW_PATTERN`; `:84-85` `zonesBase`/`nodesBase`; `:89` title "(dialect v0)"; `:102-114` root `if`/`then`/`else` (`:106`, `:112`); `:115-124` 8 `$defs`.
- `scripts/build-schema.mjs:3` `runnerImport`; `:15-18` writes `schema/arch-diagram.v0.schema.json`; `:20` logs `<file>: <n> $defs`. `package.json:11` `typecheck:local`; `:12` `lint:local`; `:13` `"schema:build": "node scripts/build-schema.mjs && prettier --write schema/arch-diagram.v0.schema.json"`; no test script. `schema/` holds only `arch-diagram.v0.schema.json`.
- Repo `package.json:20` `"format:check": "prettier --check ."`; `.github/workflows/ci.yml:49` runs it; `.prettierignore` has no `apps/diagram` entry. `src/dev/spec-check-view.tsx:20-28` globs fixtures incl. `*.yaml.txt` (comment `:21`); `:31-34` `SAME_AST`; `:78` `compileText`; `:123` caption "Dialect v0 fixtures".

### Compile and rendering

- `src/spec/check-text.ts:34-45` `CheckedText`; `:46` `checkText(text, iconNames)`; `:49-51` null AST; `:52` `compileArch(checked.ast)`; `:53` `validateFlowSpec`.
- `src/state/compile-text.ts:18` `archRegistry`; `:34-40` `compileText(text)` → `checkText(text, ICON_NAMES)`. Call sites: `src/state/diagram-store.ts:60`, `:87`, `:122`; `src/dev/spec-check-view.tsx:78`; `src/io/document-controls.tsx:74`.
- `src/spec/compile/compile-arch.ts:36-47` `CompiledNodeData`; `:49-58` `CompiledZoneData`; `:60-73` `CompiledFlowData`; `:75-87` `ArchCompileView`; `:97-100` `compact`; `:165` `compileArch(ast)`; `:166` `manual`; `:167-169` `firstById`; `:170-171` `zoneIds`/`nodeIds`; `:175` `origin`; `:177-182` `add`; `:188-194` `ownerOf`; `:222-247` node loop (`:223` `applyStyles`; `:225-236` the data object; `:230` variant; `:240` `NODE_TYPE_KEY[node.type]`); `:253` notes drop an unknown `at`; `:275-278` `endpoints`, unknown ends skipped, key `${flow.from}->${flow.to}`; `:292` `floating`; `:295` edge origin; `:297` id.
- `src/spec/compile/arch-definitions.ts:16-23` `NODE_TYPE_KEY`; `:33-37` `ALL_PORTS`; `:39-50` `NODE_FIELDS`; `:52-61` `ZONE_FIELDS`; `:63-75` `FLOW_FIELDS`; `:77-87` `node()`; `:89-105` `ARCH_DEFINITION_LIST`.
- `src/spec/flow-spec/types.ts:18` `FlowSpecNode` (no `draggable`); `:59` `FlowFieldKind`; `:71` unknown data keys allowed.
- `src/spec/compile/registry.ts:64-67` `Equals`/`Assert`; `:69-87` `VocabularyParity` (`:80`, `:83`); `:90-94` `MARKED_KIND`; `:116` `decorate` (`:117-119` titles; `:124-128` zones; `:129` `MARKED_KIND` lookup).
- `src/nodes/arch-node-data.ts:17-34` `ArchNodeData`; `:37-44` `ARCH_NODE_TYPE`; `:58-64` `ARCH_KIND_DEFAULT_ICON` (service `lucide/box`, actor `lucide/user`, datastore `lucide/database`, queue `lucide/layers`, external `lucide/globe`).
- `src/nodes/service-node.tsx:143` and `:185` draw `icon ?? ARCH_KIND_DEFAULT_ICON[kind]`; `:99` `archNodeAriaLabel`; `:166-168` and `:197-198` both layouts draw `data.subtitle`; `:268` `export function ServiceNode(…)` (ends `:308`), `:302` `kind="service"`; `:14` imports `composite-mock`. `src/interaction/details-card.tsx:127` the same default for the card's mark; `:34-36` `detailKind` is undefined outside `ARCH_NODE_TYPE`.
- `src/nodes/node-types.ts:14`, `:32` `// end DG-06`.
- `src/panes/canvas-pane.tsx:52` "This diagram uses a newer format"; `:54` "Atlas cannot draw format ${version} yet. …"; `:104-107` `issueVersion` (`:106` `/Dialect "([^"]*)"/`); `:148` `unsupportedVersion`; `:37` imports `withCompositeMock`.
- `node_modules/@xyflow/system` 0.0.78 `dist/umd/types/nodes.d.ts:36` `draggable?`, `:39` `deletable?`.

### State, autosave, live reload, layout, inspector

- `src/workspace/workspace-store.ts:258-277` `open()` (`:266` `readFile`; `:268-274` `workspaceStore.set`; `:275` `diagramActions.load`); `:283-293` `attach`; `:330-359` `checkDisk`; `:379` `create` writes `diagram: "0"`. `readFile(path)` is called at `:145`, `:266`, `:286` and `:337`.
- `src/workspace/use-autosave.ts:25` `AUTOSAVE_DELAY_MS = 800`; `:133` dirty = `text !== loadedText`. `src/state/history.ts:49-66` compares `state.text`.
- `src/state/diagram-store.ts:9` seed `?raw` import from `../../workspace/examples/`; `:47` `loadCount`; `:59-76` `initialState` (`:60` `compileText(text)` at module load); `:78` `diagramStore`; `:82` `pending`; `:84-98` `compileNow` (module-private); `:100` `diagramActions`; `:116-134` `load` (`:127` `loadCount + 1`).
- `src/workspace/live-reload.ts:5-6` names `onWorkspaceEvent` as DG-26's hook ("re-resolve `use:`"); `:34-40` `onWorkspaceEvent`; `:138-146` `onopen` (`:140` `if (opened)`); `:161` listeners; `:171` `useLiveReload`.
- `src/workspace/client.ts:48-52` `WorkspaceEvent`; `:57-66` `WorkspaceApiError`; `:116-118` `thumbPathOf`; `:121-127` `readFile` (mtime = `Number(X-Workspace-Mtime)`, 0 without the header); `server/workspace-plugin.mjs:192` sets the header.
- `src/shell/diagram-shell.tsx:55` "Local workspace"; `:76` `useLiveReload();`.
- `src/state/entries.ts:8-12` `DiagramEntry`; `:15-32` `entryOf`; `:39-75` `pathsToDelete` (`:67` flows by exact end).
- `src/panes/use-canvas-delete.ts:47-59` `onBeforeDelete`; `src/layout/layout-edits.ts:42` `LAYOUT_AFTER`; `:53-58` `writable()`; `src/layout/reparent.ts:32-40` `dropTarget`; `:243-259` `dropsOf` (`:251` zone filter).
- `src/panes/inspector-pane.tsx:27-35` `INSPECTOR_LABELS` (`:34` `kind: { zone: "Zone", node: "Node", flow: "Flow", note: "Note" }`); `:37-40` `COMMON`; `:47-70` `FORMS` (`:57-65` node: `entryFormSpec(NODE_DEF, { ...COMMON, omit: ["parent", "position"], readOnly: ["id"], multiline: ["description", "text"] })` at `:59-64`); `:76-84` `writtenKeys`; `:103-126` `EntryForm` (`:106` `entryFormValues(spec, def, written)`; `:121` aria-label); `:155-156` the seed bumps only when `compiledText` changes; `:173` title `${INSPECTOR_LABELS.kind[entry.kind]} · ${entry.id}`; `:194` key `${entry.id}:${seed.n}`.
- `src/fixtures/composite-mock.ts:7`, `:10` comments naming `use:`.

### Server, MCP

- `src/server-surface.ts:6-7` imports `checkText`, `ICON_NAMES`; `:22` re-exports `entrySnippet`; `:26-28` `checkDiagram(text)` = `checkText(text, ICON_NAMES)`.
- `server/spec-bridge.mjs:13` `SURFACE`; `:28-42` `validate` (`:30` `surface.checkDiagram(text)`); `:49-58` `assertValid` (`:54` `(${i.code} at ${i.path})`; `:55` "Nothing was written: the YAML has errors."); `:60` returns `{ load, validate, assertValid }`.
- `server/workspace-fs.mjs:24-25` `ROOT` (`apps/diagram/workspace`); `:26-27` `TRASH = "_trash"`; `:28` "The only root `use:` resolves from …"; `:29` `COMPONENTS`; `:35` `DIAGRAM_FILE = /\.ya?ml$/i`; `:64` `titleOf(text)`; `:100-127` `safe()` refuses a NUL (`:102`), absolute paths and `..` (`:103` turns `\` into `/`); `:130-139` `relOf`; `:169` `list()` skips dotfiles and symlinks; `:173` skips the root `_trash`; `:180` `title: titleOf(text)`; `:181` kind `component` under `components/`; `:197` `read(rel)`; `:274`, `:309` refuse to move or trash `components/`.
- `server/mcp/tools/workspace.mjs:29` `workspace_tree`; `:37` `diagram_read`; `:53` `diagram_write`; `:76` `diagram_create`; `:88` `diagram: "0"`; `:100` `diagram_move`; `:113` `diagram_trash`. No tool is named `workspace_list`.
- `server/mcp/tools/compose.mjs:13-25` `NODE_FIELDS` (`:17` icon "vendor/name, e.g. aws/lambda or lucide/users."; no `ref`, `expand`, `docs`, `status`); `:41-53` `editFile(path, ctx, edit)` (`:44` `const { ast } = surface.checkDiagram(file.text);`; `:45` "does not parse as a diagram"; `:50` `assertValid`; `:51` `workspace.write`; `:52` `return { ...written, warnings };`); `:56-68` `resolveTarget` (`:58` `->`/`<->` only); `:77-83` `compose_set`; `:104-107` `compose_add_nodes`; `:118` `required: ["id"]`; `:119` `additionalProperties: false`. `server/mcp/tools/index.mjs:12` "DG-26 `compose_use_component`".
- `server/mcp/tools/spec.mjs:37` `(await ctx.bridge.load()).checkDiagram(text)`; `:44` "(v0)". `server/mcp/tools/catalog.mjs:31-34` `catalog_search` (`:33` "Use a result's `icon` as a node's icon:"); `:50-77` `catalog_get` (`:53-54` "a ready-to-paste node in dialect v0"; `:73` `surface.entrySnippet(entry)`).
- `server/workspace-plugin.mjs:236-243` `GET /api/catalog/all` → `readAll((await bridge.load()).ICON_NAMES)`; `:246-266` `watchCatalog`; `:303-304` MCP resources are an R1-cut stub; `:314-317` `hotUpdate` (`:315` workspace, `:316` catalog → `[]`).
- `mcp/prompts/author-diagram.md:14` "(dialect v0)"; `:25` `workspace_tree`; `:25-27` loop step 2 (icons); `:43` "## Dialect v0 cheat-sheet"; `:46` `diagram: "0"`. `mcp/skills/atlas/SKILL.md:8`, `:33`; `mcp/README.md:63`; `src/catalog/entry-snippet.ts:2`, `:19`; `src/examples/index.ts:5-6`.

### Catalog and references (amendment)

- `server/catalog-fs.mjs:121-192` `readAll(iconNames)`: `:125-139` one entry per icon name (`:132` `label: icon?.label ?? slug`; `:135` `icon: name`); `:140-156` vendor files overlay `metadata` (`:100-111`: `name` → `label`, `description`, `docs`, `kind`, `tags`, `aliases`, `docs_unverified`); `:157-190` parts (`:169-170` a known icon name; `:177` `label: slug`, then metadata; `:179` `icon`; `:183-186` `part: { subtitle, badges }`); a part copies nothing from its icon entry and carries no `iconPath`; `:191` `{ entries, problems }`. `:34` `KINDS`; `:36` `LUCIDE_VENDOR`; `:40` `SLUG`; `:66-72` `yamlFiles`; `:85-94` `parseCatalog`.
- `src/catalog/catalog-service.ts:9-10` fallback comment; `:12` imports React; `:16` imports `public/icons/index.json`; `:21-22` `LUCIDE_VENDOR`; `:24-27` `CatalogPart`; `:29-52` `CatalogEntry`; `:60-73` `indexEntries`; `:85` initial state; `:98-115` `load()` (`:103-108` live; `:112` index-only fallback while not live; no sequence guard); `:117-121` `ensureLoaded`; `:123` reload on the `catalog` event; `:127` `catalogService`; `:184-190` `subscribe`.
- `src/catalog/entry-snippet.ts:8-14` `SnippetEntry`; `:17-28` `entrySnippet` (`:22` `icon: e.icon`; `:23` `title: e.label`). `src/catalog/entry-view.tsx:18` imports it; `:32` `snippetHeading: "Use it in a diagram"`; `:152` calls it.
- `src/icons/icon-names.ts:6` prose "Every icon name the YAML may use: …"; `:13-16` `ICON_NAMES`.
- Named vendor entries, the only three: `catalog/aws.yaml:3-8` `glue` (`:6` docs); `catalog/azure.yaml:3-6` `virtual-networks`; `catalog/qlik.yaml:3-8` `data-gateway`. No vendor file sets `kind`.
- Parts: `catalog/parts/generic.yaml:2-7` `users` (icon `lucide/users`, kind actor); `catalog/parts/clickhouse.yaml:5-7` `cloud`; `catalog/parts/qlik.yaml:3-10` `data-gateway-direct` (icon `qlik/data-gateway`, subtitle "Direct Access", badges `[customer-hosted]`); `:11-18` `data-gateway-movement`.

### Naming: workspace, folders, file names (amendment)

- `src/shell/workspace-tree.tsx:96` rename changes the file name, never the title; `:112-113` a file row's hover text is title + file name; `:117` "A name cannot be empty or contain “/”."; `:396` file rows show `entry.title`; `:442` folder rows show `entry.name`; `:470-472` a name is valid unless empty, containing `/` or `\`, or `.`/`..`. `src/io/files.ts:13-22` `yamlFileName` slugs a new diagram's title.
- `src/shell/rail-nav.tsx:31` "Workspace"; `docs/2026-09-27-atlas-v2-plan.md:211` "Single user, single workspace". No workspace name exists; the maintainer chose the literal root `ws` (`roadmap/CURRENT.md:38`).
- `workspace/README.md:18-20` rule 1 ("`components/` is the only root `use:` resolves from"); `:21-23` rule 2 (`_trash/`).

### Workspace files

- Examples line 1: `# yaml-language-server: $schema=../../schema/arch-diagram.v0.schema.json`; `diagram: "0"` at clickhouse-cloud-stack :7, lakehouse-aws :2, qlik-cloud-data-gateway :9, qlik-sense-enterprise-onprem :8. `diagram: "1"` at landscape :13, pipeline :12, tenant :11.
- `workspace/templates/qlik-cloud-customer-landscape.yaml:62-66` `gateway` ("Qlik Data Gateway – Direct Access"); `:67-68` comments naming `use:`; `:79-81` `tenant` (`:80` `use: components/qlik-cloud-tenant`); `:130-143` flows.
- `workspace/templates/qlik-talend-cloud-pipeline.yaml:82-86` `replicate` (`:83` `icon: qlik/qlik # intended: a Qlik Replicate icon; the icon index has none`); `:94-98` `nia` (`aws/ec2`); `:99-103` `lakehouse` (`aws/ec2-auto-scaling`).
- `workspace/examples/lakehouse-aws.yaml:38-41` `nat` (`:39` `icon: aws/virtual-private-cloud`); `:92-95` `qlik-cloud`. `workspace/examples/qlik-sense-enterprise-onprem.yaml:105-109` `licensing` (`:107` `icon: qlik/qlik`). `workspace/examples/qlik-cloud-data-gateway.yaml:40-43` the gateway ("Data Movement").
- `workspace/components/qlik-cloud-tenant.yaml:6` comment `use: components/qlik-cloud-tenant`; `:17-24` `component:`.
- A fixed-string `grep -rnwF 'use:'` over `src server mcp workspace scripts` hits `src/workspace/live-reload.ts:6`, `src/icons/icon-names.ts:6` (prose), `src/fixtures/composite-mock.ts:7`, `:10`, `server/workspace-fs.mjs:28`, landscape `:67`, `:68`, `:80`, `workspace/README.md:18`, tenant `:6`.
- The maintainer's commits: `577aaea2` (gateway `direction: LR`), `fc142231` (clickhouse `direction: LR`), `1daceb9c` (DG-68 follow-ups), `c8fed5b7` (onprem `nodeStyle: icon`).

### Planning documents

- `roadmap/CURRENT.md:3` this file wins; `:8` R1 order (`68, 69, 70, 26, 23`); `:17` DG-26 to the front, migration included; `:18` DG-69 and DG-70 before DG-26; `:20` the Demo Banking / MCP Sales app landscape; `:28` stale untracked-docs note; `:34` DG-68 done; `:35` `diagram/view-direction`, now "view mode is read-only" (workflow `wf_dd7f6f14-215`); `:36` catalog crumbs on `main` `4af6a3e0`; `:38` 1d, the ruling and the answers (file name, `ws`, stand-ins custom: `nat`, `replicate`, `licensing`; templates editable; "Building now … Parts 1a then 1b of the amended DG-26 draft"); `:39` lens-switch slice; `:42-50` audit follow-ups (`:43` template edit, `:44` MCP vs dialect 1, `:47` static preview, `:48` "(yaml-syntax at )", `:49` 7 unused exports, `:50` no tests).
- `roadmap/DG-28-language-service.md:20` banner: complete `catalog/<pack>/<entry>` and `<workspace>/<folder>/…/<diagram>`, "showing each diagram's title".
- `~/.claude/open-decisions/elabs-components.md:260-261` "may the newer-format templates be edited in the app?", "Status: open"; the next entry records the path answers as RESOLVED.
- `diagram/ref-1a` (worktree `.claude/worktrees/ref-1a`), tip `b160c773`: `src/spec/dialect/ids.ts:25` `WORKSPACE_REF_ROOT = "ws"`; `:35` `SEGMENT_SOURCE = "(?!_|\\.\\.?(?:/|$))[^/]+"`; `:41` `FILE_SEGMENT_SOURCE`; `:43` `DIAGRAM_REF_SOURCE`; `src/panes/inspector-pane.tsx:35` label "Component".

### Measured (read-only scripts in the session scratchpad; nothing written in the repo)

- `readAll` with the 707 icon names: 722 entries, 15 parts, 0 problems; `aws/rds` label "Rds"; `qlik/data-gateway` "Qlik Data Gateway".
- The 1a.3 grammar, compiled with and without `u`: accepts `ws/components/qlik-cloud-tenant`, `ws/Demo Banking/MCP Sales app landscape`, `ws/drafts/v1.2 draft`, `ws/_drafts/x`, `ws/Überblick/Karte`; rejects `ws`, `ws/_trash`, `ws/_trash/x`, `ws/a//b`, `ws/a/../b`, `ws/.hidden/x`, `ws/x.yaml`, `ws/x.YML`, `ws/a\b`, `workspace/components/x`, `components/x`.
- The reference-first model of step 1b.8 (not the implementation): 55 catalog references (tenant 4, clickhouse 5, lakehouse 12, gateway 7, onprem 6, landscape 8, pipeline 13), 1 diagram reference, 25 custom; 22 keys drop (16 `title`, 5 `type`, 1 `docs`); 986 lines become 964; diff 55 insertions, 77 deletions. Gateways on their parts: 24 keys drop, 962 lines.
