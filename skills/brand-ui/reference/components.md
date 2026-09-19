# Which component, and import or copy-own

Load this when choosing between components for a need, or deciding whether to import a
package or copy a registry block into the app.

Compose, don't reinvent. App shell = `SidebarProvider` + `Sidebar` + `SidebarInset`.
Dashboard = `MetricGrid` + `DataTable`. Assistant = `ChatShell` + AI elements.
Pipeline = `CanvasShell` + `FlowNode`/`FlowEdge`. Prefer built-in variants
(`variant="outline"`, `size="sm"`) to custom styles.

## Component selection

| Need                   | Use (package)                                                                                                                                                                                                                           |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Action                 | `Button` variants (`@elabs-ai/components-ui`)                                                                                                                                                                                           |
| Form inputs            | `Input`, `Select`, `Combobox`, `Checkbox`, `RadioGroup`, `Switch`, `Slider`, `Textarea`, `InputOTP`, `Calendar`, `DatePicker`, `Form` (`@elabs-ai/components-ui`)                                                                       |
| Grouped input + addon  | `InputGroup` + `InputGroupInput`/`InputGroupTextarea` + `InputGroupAddon` (`@elabs-ai/components-ui`)                                                                                                                                   |
| 2–5 option toggle      | `ToggleGroup` (`@elabs-ai/components-ui`)                                                                                                                                                                                               |
| Data table             | `DataTable` + `SearchInput`/`FacetFilter`/`ColumnPicker` (`@elabs-ai/components-data`)                                                                                                                                                  |
| Display                | `Card`, `Badge`, `Avatar`, `Table`, `Progress`, `Skeleton` (`@elabs-ai/components-ui`)                                                                                                                                                  |
| Icons                  | **`lucide-react`** (default — generic UI glyphs) · `@elabs-ai/components-icons` (`Icon`/`createIcon`/`BrandLogo` — brand/product icons). No other icon set; see the brand-ui icons rule                                                 |
| Navigation             | `Sidebar`, `NavigationMenu`, `Breadcrumb`, `Tabs`, `Pagination` (`@elabs-ai/components-ui`)                                                                                                                                             |
| App shell              | `SidebarProvider`/`Sidebar`/`SidebarInset` + `sidebar-02/04/05` blocks                                                                                                                                                                  |
| Overlays               | `Dialog`, `Sheet`, `Drawer`, `AlertDialog`, `Popover`, `Tooltip`, `HoverCard`                                                                                                                                                           |
| Command palette        | `Command` inside `Dialog`                                                                                                                                                                                                               |
| Feedback               | `Alert`, `Sonner` toast, `EmptyState`, `ErrorState`, `LoadingState`, `Spinner`                                                                                                                                                          |
| AI / chat              | `ChatShell`, `Conversation`, `Message`, `PromptInput`, `Reasoning`, `Tool`, `Sources` (`@elabs-ai/components-ai`)                                                                                                                       |
| Flow canvas            | `CanvasShell`, `FlowNode`, `FlowEdge`, `ZoomControls`, `InspectorPanel` (`@elabs-ai/components-flow`)                                                                                                                                   |
| KPIs / charts          | `MetricCard`, `MetricGrid`, `ChartCard`, `ChartFrame` + 13 chart types (`@elabs-ai/components-charts`) — see Charts section below                                                                                                       |
| Marketing              | `Hero`, `FeatureGrid`, `StatsBand`, `CTASection`, `LogoStrip` (`@elabs-ai/components-marketing`)                                                                                                                                        |
| Code editor            | `CodeEditor`, `DiffEditor`, `CodeWorkspace` (`@elabs-ai/components-editor`; import `@elabs-ai/components-editor/monaco-environment` once)                                                                                               |
| Markdown authoring     | `MarkdownWorkspace`, `MarkdownEditor`, `MarkdownPreview`, `Timeline`, `MetricBlock` (`@elabs-ai/components-editor/markdown`); `parseFrontmatter`/`serializeFrontmatter` (`@elabs-ai/components-editor/markdown/frontmatter`, YAML only) |
| File / document viewer | `FileViewer` + `FileViewerProvider`/`FileViewerToolbar`/`FileViewerContent` (`@elabs-ai/components-viewer`) — images, text, JSON, CSV today; formats are added by registering an adapter                                                |

Confirm exact names with `brand-ui search`; the registry also has copy-own blocks
(`brand-ui search` shows `registry:*` items).

## Two consumption modes

1. **Import (stable primitives):** `import { Button, Card } from "@elabs-ai/components-ui"`.
   Once at the app root: `import "@elabs-ai/components-tokens/styles.css"` and wrap in
   `<ThemeProvider defaultTheme="light">`. React Flow consumers also
   `import "@xyflow/react/dist/style.css"`.
2. **Copy-own (prototype blocks):** `npx shadcn@latest add <registry-url>/<item>.json`.
   After adding, **read the files** and fix imports to the project's alias, verify
   composition against the Critical rules, and remove any raw colors.
