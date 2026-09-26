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

`@elabs-ai/components-{tokens,ui,icons,flow,editor}` (workspace), `@xyflow/react`, `elkjs`, `monaco-editor`, `lucide-react` (same version as the monorepo: `^0.577.0`), `class-variance-authority` (`^0.7.1`, already listed in `apps/diagram/package.json` L23; wave 1's node and zone variants use it), `react`, `react-dom`; later items add `yaml` (DG-09) and `html-to-image@1.11.11` (DG-17). Dev: `vite`, `@vitejs/plugin-react`, `@tailwindcss/vite`, `@elabs-ai/components-eslint-config`, `@elabs-ai/components-typescript-config`, `eslint`, `typescript`. Nothing else.

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
// nodes/use-zone-autofit.ts — fitZones L74, useZoneAutofit L162
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
- **Typing into Monaco.** agent-browser `type` and `fill` do not reach Monaco's input. Click the line, then `press` keys (`End`, `Backspace`, one `press` per character). Monaco auto-closes quotes and braces.
- **Hidden canvas.** A canvas hidden while it lays out uses `opacity-0` plus `inert` (see React Flow engine facts), so check it with `el.closest("[inert]")`, not with `visibility`.
- **Console errors.** `agent-browser errors --clear` did not clear the list, and the list includes other origins. Hook errors in the page instead (an `error` listener plus a `console.error` wrapper that push to `window.__errs`).
- **StrictMode.** `src/main.tsx` renders in `<StrictMode>` (L18), so in dev every effect runs twice on mount: effect code must be idempotent, and a line an effect logs appears twice on first load.
