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

**Not re-exported by flow** (import from `@xyflow/react` directly — the app lists it as a dependency): `getNodesBounds`, `getViewportForBounds`, `useStore`, `getIntersectingNodes` (via `useReactFlow().getIntersectingNodes`). Record as a gap in DG-17/DG-15 findings.
Stylesheet once, in the app CSS: `@import "@xyflow/react/dist/style.css";`.
`FlowGroupNode` reads live child counts from the store; children need `parentId` + `extent: "parent"`, and **parents must precede children** in the nodes array.

## editor — `@elabs-ai/components-editor`

```ts
import { CodeEditor } from "@elabs-ai/components-editor";
// props (code-editor.tsx L43–88): value?, defaultValue?, onChange?(value), language?: string ("yaml"), path?, readOnly?, height?,
//   options?: monaco IStandaloneEditorConstructionOptions, ariaLabel?, ariaInvalid?, ariaDescribedBy?,
//   contextMenu?: "brand"|"monaco"|"none", onMount?(editor, monacoApi), actions?: EditorAction[]
```

Markers (DG-12): keep `editor` and `monacoApi` from `onMount`, then
`monacoApi.editor.setModelMarkers(editor.getModel()!, "arch-diagram", markers)` with `{ startLineNumber, startColumn, endLineNumber, endColumn, message, severity: monacoApi.MarkerSeverity.Error | Warning | Info }`. Reveal: `editor.revealLineInCenter(n)`; decorations: `editor.createDecorationsCollection([...])`. `monaco-editor` is the editor package's peer — the app lists it.

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

## Allowed app dependencies

`@elabs-ai/components-{tokens,ui,icons,flow,editor}` (workspace), `@xyflow/react`, `elkjs`, `monaco-editor`, `lucide-react` (same version as the monorepo: `^0.577.0`), `react`, `react-dom`; later items add `yaml` (DG-09) and `html-to-image@1.11.11` (DG-17). Dev: `vite`, `@vitejs/plugin-react`, `@tailwindcss/vite`, `@elabs-ai/components-eslint-config`, `@elabs-ai/components-typescript-config`, `eslint`, `typescript`. Nothing else.

## Repo commands you will run

- Root: `pnpm install` (after adding the app), `pnpm typecheck`, `pnpm lint`, `pnpm check`, `pnpm check:test` — the app must **not** appear in turbo's task list for the first two.
- App: `pnpm --filter @elabs-ai/diagram dev | build:local | typecheck:local | lint:local`.
- Audit: `pnpm brand-ui audit --strict apps/diagram/src`.
