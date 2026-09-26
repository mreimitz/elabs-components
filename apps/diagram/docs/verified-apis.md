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

ui names used by the DG-09 `#spec-check` view, all from the root barrel `packages/ui/src/index.ts`:

```ts
import {
  Badge, // index.ts L163; badge.tsx L54–85 variant: default | secondary | outline | success | warning | destructive | info
  Heading, // index.ts L275; typography.tsx L110–113 level?: 1–6
  StatusBadge, // index.ts L255; status-badge.tsx L305–310 { status: Status | CustomStatus, hideIcon?, appearance? }; children replace the label; STATUSES L60 (complete, failed, …)
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow, // index.ts L258; table/index.ts (+ TableFooter); intrinsic table-element props
  Text, // index.ts L275; typography.tsx L36–69 variant (… caption, code = text-code font-mono), tone default | muted | primary, as?: "p" | "span" | "div"
} from "@elabs-ai/components-ui";
```
