<!-- GENERATED FILE — do not edit by hand.
     Source: brand-ui.manifest.json (via `pnpm inventory`).
     Regenerate after any component/token change; the inventory:check gate fails on drift. -->

# brand-ui component inventory

The full component/hook surface, generated from the manifest. `*` marks a cva default value. Subpath-exported items show their import path.

**Themes (2):** qlik-dark, qlik-bright (default)
**Radius:** `calc(var(--radius-base) * (1 - var(--decoration-factor)))` · **Tokens:** 154

## Packages

| Package | Path | Components | Hooks | Purpose |
| --- | --- | --: | --: | --- |
| `@qlik-coe-emea/qlabs-components-tokens` | packages/tokens | 18 | 6 | Semantic CSS-variable themes + ThemeProvider/useTheme. |
| `@qlik-coe-emea/qlabs-components-icons` | packages/icons | 31 | 0 | Brand/product-vocabulary icons + BrandLogo (generic glyphs use lucide-react). |
| `@qlik-coe-emea/qlabs-components-ui` | packages/ui | 355 | 14 | Foundation + app UI (Button, Card, Dialog, Tabs, AppShell, …). |
| `@qlik-coe-emea/qlabs-components-data` | packages/data | 5 | 0 | TanStack DataTable, FilterBar, SearchInput, FacetFilter, ColumnPicker. |
| `@qlik-coe-emea/qlabs-components-ai` | packages/ai | 443 | 13 | ChatShell, Conversation, Message, PromptInput, Tool, Reasoning, citations. |
| `@qlik-coe-emea/qlabs-components-flow` | packages/flow | 23 | 7 | Branded React Flow canvas, nodes, edges, controls, inspector. |
| `@qlik-coe-emea/qlabs-components-maps` | packages/maps | 12 | 1 | MapLibre GL maps: MapCanvas, markers, popups, controls, routes, arcs, GeoJSON, clusters. |
| `@qlik-coe-emea/qlabs-components-charts` | packages/charts | 130 | 32 | MetricCard, MetricGrid, ChartCard, ChartFrame (expand/flip/download). |
| `@qlik-coe-emea/qlabs-components-marketing` | packages/marketing | 6 | 0 | Hero, FeatureGrid, UseCaseCard, StatsBand, CTASection, LogoStrip. |
| `@qlik-coe-emea/qlabs-components-editor` | packages/editor | 8 | 1 | Token-themed Monaco editor: CodeEditor, DiffEditor, CodeWorkspace. |
| `@qlik-coe-emea/qlabs-components-viewer` | packages/viewer | 19 | 2 | FileViewer — any file (image, text, JSON, CSV) via a pluggable adapter registry. |

## @qlik-coe-emea/qlabs-components-tokens

> Semantic CSS-variable themes + ThemeProvider/useTheme.

| Name | Kind | Variants | Import | Notes |
| --- | --- | --- | --- | --- |
| DECORATION_LEVELS | component |  | `@qlik-coe-emea/qlabs-components-tokens` |  |
| DecorationProvider | component |  | `@qlik-coe-emea/qlabs-components-tokens` | Sets the `--decoration` dial (0–10) for a region — reprographic texture, orthogonal to color. |
| DEFAULT_DECORATION_LEVEL | component |  | `@qlik-coe-emea/qlabs-components-tokens` |  |
| DEFAULT_DENSITY | component |  | `@qlik-coe-emea/qlabs-components-tokens` |  |
| DEFAULT_MOTION_PREFERENCE | component |  | `@qlik-coe-emea/qlabs-components-tokens` |  |
| DEFAULT_TASTE_PROFILE | component |  | `@qlik-coe-emea/qlabs-components-tokens` |  |
| DEFAULT_TASTE_REGISTER | component |  | `@qlik-coe-emea/qlabs-components-tokens` |  |
| DEFAULT_THEME | component |  | `@qlik-coe-emea/qlabs-components-tokens` |  |
| DENSITIES | component |  | `@qlik-coe-emea/qlabs-components-tokens` |  |
| DENSITY_META | component |  | `@qlik-coe-emea/qlabs-components-tokens` |  |
| MOTION_PREFERENCE_META | component |  | `@qlik-coe-emea/qlabs-components-tokens` |  |
| MOTION_PREFERENCES | component |  | `@qlik-coe-emea/qlabs-components-tokens` |  |
| PAUSED_THEMES | component |  | `@qlik-coe-emea/qlabs-components-tokens` |  |
| TASTE_REGISTER_META | component |  | `@qlik-coe-emea/qlabs-components-tokens` |  |
| TASTE_REGISTERS | component |  | `@qlik-coe-emea/qlabs-components-tokens` |  |
| THEME_META | component |  | `@qlik-coe-emea/qlabs-components-tokens` |  |
| ThemeProvider | component |  | `@qlik-coe-emea/qlabs-components-tokens` | Writes `data-theme` on a root element and persists the choice; `useTheme()` reads/sets it. |
| THEMES | component |  | `@qlik-coe-emea/qlabs-components-tokens` |  |
| useDecoration | hook |  | `@qlik-coe-emea/qlabs-components-tokens` |  |
| useDensity | hook |  | `@qlik-coe-emea/qlabs-components-tokens` |  |
| useMotionPreference | hook |  | `@qlik-coe-emea/qlabs-components-tokens` |  |
| useReducedMotion | hook |  | `@qlik-coe-emea/qlabs-components-tokens` |  |
| useTasteProfile | hook |  | `@qlik-coe-emea/qlabs-components-tokens` |  |
| useTheme | hook |  | `@qlik-coe-emea/qlabs-components-tokens` |  |

## @qlik-coe-emea/qlabs-components-icons

> Brand/product-vocabulary icons + BrandLogo (generic glyphs use lucide-react).

| Name | Kind | Variants | Import | Notes |
| --- | --- | --- | --- | --- |
| AppIcon | component |  | `@qlik-coe-emea/qlabs-components-icons` | The standard app/brand mark for app chrome — theme-aware, morphs mark↔lockup on sidebar collapse. |
| BookmarkIcon | component |  | `@qlik-coe-emea/qlabs-components-icons` |  |
| BrandLogo | component |  | `@qlik-coe-emea/qlabs-components-icons` | The product's mark/lockup, drawn from tokens so it adapts to every theme. |
| ChartAreaIcon | component |  | `@qlik-coe-emea/qlabs-components-icons` |  |
| ChartBarIcon | component |  | `@qlik-coe-emea/qlabs-components-icons` |  |
| ChartComboIcon | component |  | `@qlik-coe-emea/qlabs-components-icons` |  |
| ChartLineIcon | component |  | `@qlik-coe-emea/qlabs-components-icons` |  |
| ChartPieIcon | component |  | `@qlik-coe-emea/qlabs-components-icons` |  |
| ChartScatterIcon | component |  | `@qlik-coe-emea/qlabs-components-icons` |  |
| ChatIcon | component |  | `@qlik-coe-emea/qlabs-components-icons` |  |
| DashboardIcon | component |  | `@qlik-coe-emea/qlabs-components-icons` |  |
| DataConnectionIcon | component |  | `@qlik-coe-emea/qlabs-components-icons` |  |
| DataModelIcon | component |  | `@qlik-coe-emea/qlabs-components-icons` |  |
| DatasetIcon | component |  | `@qlik-coe-emea/qlabs-components-icons` |  |
| DimensionIcon | component |  | `@qlik-coe-emea/qlabs-components-icons` |  |
| FilterPaneIcon | component |  | `@qlik-coe-emea/qlabs-components-icons` |  |
| FlowIcon | component |  | `@qlik-coe-emea/qlabs-components-icons` |  |
| GaugeIcon | component |  | `@qlik-coe-emea/qlabs-components-icons` |  |
| Icon | component |  | `@qlik-coe-emea/qlabs-components-icons` | The brand/product-vocabulary icon primitive — 24×24, stroke = currentColor, so it themes with text. |
| InsightIcon | component |  | `@qlik-coe-emea/qlabs-components-icons` |  |
| KpiIcon | component |  | `@qlik-coe-emea/qlabs-components-icons` |  |
| MeasureIcon | component |  | `@qlik-coe-emea/qlabs-components-icons` |  |
| PipelineIcon | component |  | `@qlik-coe-emea/qlabs-components-icons` |  |
| PivotIcon | component |  | `@qlik-coe-emea/qlabs-components-icons` |  |
| SearchIcon | component |  | `@qlik-coe-emea/qlabs-components-icons` |  |
| SheetIcon | component |  | `@qlik-coe-emea/qlabs-components-icons` |  |
| SparklesIcon | component |  | `@qlik-coe-emea/qlabs-components-icons` |  |
| StoryIcon | component |  | `@qlik-coe-emea/qlabs-components-icons` |  |
| TableIcon | component |  | `@qlik-coe-emea/qlabs-components-icons` |  |
| TrendDownIcon | component |  | `@qlik-coe-emea/qlabs-components-icons` |  |
| TrendUpIcon | component |  | `@qlik-coe-emea/qlabs-components-icons` |  |

## @qlik-coe-emea/qlabs-components-ui

> Foundation + app UI (Button, Card, Dialog, Tabs, AppShell, …).

| Name | Kind | Variants | Import | Notes |
| --- | --- | --- | --- | --- |
| Accordion | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| AccordionContent | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| AccordionItem | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| AccordionTrigger | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| AdvancedGroup | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| Alert | component | variant=default*\|info\|success\|warning\|destructive | `@qlik-coe-emea/qlabs-components-ui` |  |
| AlertDescription | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| AlertDialog | component |  | `@qlik-coe-emea/qlabs-components-ui` | Confirmation overlay for destructive / irreversible actions — friction proportional to consequence. |
| AlertDialogAction | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| AlertDialogCancel | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| AlertDialogContent | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| AlertDialogDescription | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| AlertDialogFooter | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| AlertDialogHeader | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| AlertDialogPortal | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| AlertDialogTitle | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| AlertDialogTrigger | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| AlertTitle | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| AppShell | component |  | `@qlik-coe-emea/qlabs-components-ui` | Top-level application frame — sidebar + header + content region. |
| AppSidebar | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| AspectRatio | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| AttributionPanel | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| ATTRIBUTIONS | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| Avatar | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| AvatarFallback | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| AvatarImage | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| Badge | component | variant=default*\|secondary\|outline\|success\|warning\|destructive\|info | `@qlik-coe-emea/qlabs-components-ui` | Compact status/label chip (status, count, category). |
| BentoGrid | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| BentoGridItem | component | hero=true\|false* · interactive=true\|false* | `@qlik-coe-emea/qlabs-components-ui` |  |
| BoundedNumber | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| Breadcrumb | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| BreadcrumbEllipsis | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| BreadcrumbItem | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| BreadcrumbLink | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| BreadcrumbList | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| BreadcrumbPage | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| BreadcrumbSeparator | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| Button | component | variant=default*\|secondary\|destructive\|outline\|outline-subtle\|ghost\|link · size=sm\|default*\|lg\|icon\|icon-sm\|icon-lg | `@qlik-coe-emea/qlabs-components-ui` | Primary action trigger — the canonical way to invoke an action. |
| ButtonGroup | component | orientation=horizontal*\|vertical | `@qlik-coe-emea/qlabs-components-ui` |  |
| ButtonGroupSeparator | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| ButtonGroupText | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| Calendar | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| Card | component | interactive=true\|false* | `@qlik-coe-emea/qlabs-components-ui` | Surface grouping related content into a bordered, padded block. |
| CardAction | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| CardContent | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| CardDescription | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| CardFooter | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| CardHeader | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| CardTitle | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| Carousel | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| CarouselContent | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| CarouselItem | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| CarouselNext | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| CarouselPrevious | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| CATEGORY_LABEL | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| ChangeReview | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| ChangeReviewHeader | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| ChangeReviewHunk | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| ChangeReviewList | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| ChangeReviewProvenance | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| ChangeReviewProvider | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| Checkbox | component |  | `@qlik-coe-emea/qlabs-components-ui` | Binary on/off toggle within a form (multi-select within a group). |
| Collapsible | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| CollapsibleContent | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| CollapsibleTrigger | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| COLOR_TOKENS | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| ColorPicker | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| Combobox | component |  | `@qlik-coe-emea/qlabs-components-ui` | Searchable single/multi select — Select with typeahead over a large or async option set. |
| Command | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| CommandDialog | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| CommandEmpty | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| CommandGroup | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| CommandInput | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| CommandItem | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| CommandList | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| CommandSeparator | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| CommandShortcut | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| ConfirmDialog | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| ContextMenu | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| ContextMenuCheckboxItem | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| ContextMenuContent | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| ContextMenuGroup | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| ContextMenuItem | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| ContextMenuLabel | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| ContextMenuRadioGroup | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| ContextMenuRadioItem | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| ContextMenuSeparator | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| ContextMenuShortcut | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| ContextMenuSub | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| ContextMenuSubContent | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| ContextMenuSubTrigger | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| ContextMenuTrigger | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| COPY_FEEDBACK_MS | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| CopyableValue | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| DatePicker | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| DateRangePicker | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| DEFAULT_MESSAGES | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| DEFAULT_THEME_PAIR | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| Descriptions | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| DescriptionsItem | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| Dialog | component |  | `@qlik-coe-emea/qlabs-components-ui` | Modal overlay for focused tasks/flows that block the page until dismissed. |
| DialogBody | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| DialogClose | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| DialogContent | component | size=sm\|lg*\|xl\|full | `@qlik-coe-emea/qlabs-components-ui` |  |
| DialogDescription | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| DialogFooter | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| DialogHeader | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| DialogOverlay | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| DialogPortal | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| DialogSection | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| DialogTitle | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| DialogTrigger | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| DOCUMENT_ADDRESS_KINDS | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| Drawer | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| DrawerClose | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| DrawerContent | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| DrawerDescription | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| DrawerFooter | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| DrawerHeader | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| DrawerPortal | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| DrawerTitle | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| DrawerTrigger | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| DropdownMenu | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| DropdownMenuCheckboxItem | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| DropdownMenuContent | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| DropdownMenuGroup | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| DropdownMenuItem | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| DropdownMenuLabel | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| DropdownMenuPortal | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| DropdownMenuRadioGroup | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| DropdownMenuRadioItem | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| DropdownMenuSeparator | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| DropdownMenuShortcut | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| DropdownMenuSub | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| DropdownMenuSubContent | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| DropdownMenuSubTrigger | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| DropdownMenuTrigger | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| EmptyState | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| ErrorState | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| ExpandDialog | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| ExpandDialogContent | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| ExpandDialogHeader | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| ExpandDialogPanes | component | detailPlacement=side*\|bottom · stackBelow=never*\|sm\|md\|lg | `@qlik-coe-emea/qlabs-components-ui` |  |
| FieldRow | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| FILE_CATEGORY_ICONS | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| FileUpload | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| FileUploadDropzone | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| FileUploadItem | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| FileUploadList | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| FilterChip | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| Form | component |  | `@qlik-coe-emea/qlabs-components-ui` | Validated form scaffold (Field/Label/Control/Message) wiring inputs to a schema. |
| FormControl | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| FormDescription | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| FormField | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| FormItem | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| FormLabel | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| FormMessage | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| Heading | component | size=display\|title*\|subtitle | `@qlik-coe-emea/qlabs-components-ui` |  |
| HoverCard | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| HoverCardContent | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| HoverCardTrigger | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| IconButton | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| Input | component |  | `@qlik-coe-emea/qlabs-components-ui` | Single-line text field — the base form input. |
| InputGroup | component | variant=outline*\|surface\|card | `@qlik-coe-emea/qlabs-components-ui` |  |
| InputGroupAddon | component | align=inline-start*\|inline-end\|block-start\|block-end | `@qlik-coe-emea/qlabs-components-ui` |  |
| InputGroupButton | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| InputGroupInput | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| InputGroupText | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| InputGroupTextarea | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| InputOTP | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| InputOTPGroup | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| InputOTPSeparator | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| InputOTPSlot | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| Kbd | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| KeyValueEditor | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| Label | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| LinkPreview | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| LinkPreviewCard | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| ListEditor | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| LoadingState | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| LocaleProvider | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| MatchHighlight | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| MentionInput | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| MentionInputContent | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| MentionInputEmpty | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| MentionInputItem | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| MentionInputList | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| MentionInputTextarea | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| Menubar | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| MenubarCheckboxItem | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| MenubarContent | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| MenubarGroup | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| MenubarItem | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| MenubarMenu | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| MenubarPortal | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| MenubarRadioGroup | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| MenubarRadioItem | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| MenubarSeparator | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| MenubarShortcut | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| MenubarSub | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| MenubarSubContent | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| MenubarSubTrigger | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| MenubarTrigger | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| MetricCard | component |  | `@qlik-coe-emea/qlabs-components-ui` | Single KPI tile — label, value, delta/trend. |
| ModelPicker | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| NavigationMenu | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| NavigationMenuContent | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| NavigationMenuItem | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| NavigationMenuLink | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| NavigationMenuList | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| NavigationMenuTrigger | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| NavigationMenuViewport | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| NavMain | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| NavNotifications | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| NavUser | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| NumberInput | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| PageShell | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| Pagination | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| PaginationContent | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| PaginationEllipsis | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| PaginationItem | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| PaginationLink | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| PaginationNext | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| PaginationPrevious | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| Popover | component |  | `@qlik-coe-emea/qlabs-components-ui` | Anchored, dismissible floating panel for lightweight contextual content. |
| PopoverAnchor | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| PopoverContent | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| PopoverTrigger | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| Progress | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| PROSE_HEADING_REM | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| PROSE_HEADING_TRACKING | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| PROSE_HEADING_WEIGHT | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| ProseBlockquote | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| ProseHeading | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| ProseInlineCode | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| ProseLink | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| ProseList | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| ProseListItem | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| ProseText | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| RadioGroup | component |  | `@qlik-coe-emea/qlabs-components-ui` | Mutually-exclusive single choice from a small visible set. |
| RadioGroupItem | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| Rating | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| ResizableHandle | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| ResizablePanel | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| ResizablePanelGroup | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| ResultCount | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| Reveal | component | appear=fade\|up*\|down\|left\|right\|zoom · speed=fast\|base\|slow* | `@qlik-coe-emea/qlabs-components-ui` |  |
| RevealGroup | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| RevisionTimeline | component | density=comfortable*\|compact | `@qlik-coe-emea/qlabs-components-ui` |  |
| ScrollArea | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| ScrollBar | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| SectionHeader | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| SegmentedField | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| Select | component |  | `@qlik-coe-emea/qlabs-components-ui` | Single-choice dropdown from a known set of options. |
| SelectContent | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| SelectGroup | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| SelectItem | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| SelectLabel | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| SelectSeparator | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| SelectTrigger | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| SelectValue | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| Separator | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| Sheet | component |  | `@qlik-coe-emea/qlabs-components-ui` | Edge-anchored panel (left/right/top/bottom) for secondary flows beside the page. |
| SheetClose | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| SheetContent | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| SheetDescription | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| SheetFooter | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| SheetHeader | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| SheetPortal | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| SheetTitle | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| SheetTrigger | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| Sidebar | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| SidebarContent | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| SidebarFooter | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| SidebarGroup | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| SidebarGroupAction | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| SidebarGroupContent | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| SidebarGroupLabel | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| SidebarHeader | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| SidebarInput | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| SidebarInset | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| SidebarMenu | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| SidebarMenuAction | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| SidebarMenuBadge | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| SidebarMenuButton | component | variant=default*\|outline · size=default*\|sm\|lg | `@qlik-coe-emea/qlabs-components-ui` |  |
| SidebarMenuItem | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| SidebarMenuSkeleton | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| SidebarMenuSub | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| SidebarMenuSubButton | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| SidebarMenuSubItem | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| SidebarProvider | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| SidebarRail | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| SidebarSeparator | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| SidebarTrigger | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| Skeleton | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| Slider | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| SliderNumber | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| Spinner | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| SplitPanel | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| StatePanel | component | kind=empty*\|error\|loading | `@qlik-coe-emea/qlabs-components-ui` |  |
| STATUS_LABELS | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| STATUS_ROLE | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| STATUS_TONE_ICONS | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| STATUS_TONES | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| StatusBadge | component | status=pending\|running\|complete\|awaiting-approval\|denied\|failed\|skipped · tone=neutral\|info\|success\|warning\|destructive · size=sm\|md* | `@qlik-coe-emea/qlabs-components-ui` |  |
| STATUSES | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| StatusIcon | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| STREAMDOWN_TRANSLATION_KEYS | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| Switch | component |  | `@qlik-coe-emea/qlabs-components-ui` | Immediate on/off setting toggle (applies on change, not on submit). |
| Table | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| TableBody | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| TableCaption | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| TableCell | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| TableFooter | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| TableHead | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| TableHeader | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| TableRow | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| Tabs | component |  | `@qlik-coe-emea/qlabs-components-ui` | Switch between peer views in the same context without navigating away. |
| TabsContent | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| TabsList | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| TabsTrigger | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| TagInput | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| TeamSwitcher | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| Text | component | variant=lead\|body*\|caption\|meta\|kpi\|code · tone=default*\|muted\|primary | `@qlik-coe-emea/qlabs-components-ui` |  |
| TEXT_ROLE_REM | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| Textarea | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| ThemeSwitcher | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| Timeline | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| TimelineItem | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| TimelineRoot | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| Toaster | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| Toggle | component | variant=default*\|outline\|segmented · size=default*\|sm\|lg | `@qlik-coe-emea/qlabs-components-ui` |  |
| ToggleGroup | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| ToggleGroupItem | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| Toolbar | component | orientation=horizontal*\|vertical | `@qlik-coe-emea/qlabs-components-ui` | A dense row of controls that acts on nearby content, collapsed into ONE tab stop with arrow-key navigation between the controls. |
| ToolbarButton | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| ToolbarSeparator | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| ToolbarSlot | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| ToolbarToggleGroup | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| ToolbarToggleItem | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| Tooltip | component |  | `@qlik-coe-emea/qlabs-components-ui` | Transient hover/focus hint with supplementary (non-essential) text. |
| TooltipContent | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| TooltipProvider | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| TooltipTrigger | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| TopNav | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| Transfer | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| Tree | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| TreeSelect | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| useCollapsiblePanel | hook |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| useCommandActiveItemId | hook |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| useCopyToClipboard | hook |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| useDialogDismissGuard | hook |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| useFileUpload | hook |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| useFormField | hook |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| useIsMobile | hook |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| useLocale | hook |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| useMentionInput | hook |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| useSidebar | hook |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| useStreamdownTranslations | hook |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| useThemeTransition | hook |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| useTreeKeyboard | hook |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| useVirtualListbox | hook |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| ViewToolbar | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| ViewToolbarFilters | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| VirtualSelect | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| Wizard | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| WizardNav | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| WizardStep | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |
| WizardSteps | component |  | `@qlik-coe-emea/qlabs-components-ui` |  |

## @qlik-coe-emea/qlabs-components-data

> TanStack DataTable, FilterBar, SearchInput, FacetFilter, ColumnPicker.

| Name | Kind | Variants | Import | Notes |
| --- | --- | --- | --- | --- |
| ColumnPicker | component |  | `@qlik-coe-emea/qlabs-components-data` |  |
| DataTable | component |  | `@qlik-coe-emea/qlabs-components-data` | TanStack-backed data grid with sorting, filtering, pagination and a render-prop toolbar. |
| FacetFilter | component |  | `@qlik-coe-emea/qlabs-components-data` |  |
| FilterBar | component |  | `@qlik-coe-emea/qlabs-components-data` |  |
| SearchInput | component |  | `@qlik-coe-emea/qlabs-components-data` | Controlled search box that drives a DataTable's global filter. |

## @qlik-coe-emea/qlabs-components-ai

> ChatShell, Conversation, Message, PromptInput, Tool, Reasoning, citations.

| Name | Kind | Variants | Import | Notes |
| --- | --- | --- | --- | --- |
| Agent | component |  | `@qlik-coe-emea/qlabs-components-ai` | Accordion-shaped disclosure describing a sub-agent: its instructions, tools and output. |
| AgentContent | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| AgentHeader | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| AgentInstructions | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| AgentMessage | component | emphasis=default*\|answer | `@qlik-coe-emea/qlabs-components-ai` |  |
| AgentOutput | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| AgentStep | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| AgentTimeline | component |  | `@qlik-coe-emea/qlabs-components-ai` | Chronological rail of agent steps and checkpoints — what the agent did, in order. |
| AgentTool | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| AgentTools | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| ApprovalCard | component |  | `@qlik-coe-emea/qlabs-components-ai` | The named human-in-the-loop variant of Confirmation — a titled, described approve/deny card. |
| ApprovalCardAccepted | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| ApprovalCardAction | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| ApprovalCardActions | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| ApprovalCardApprove | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| ApprovalCardDeny | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| ApprovalCardDescription | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| ApprovalCardRejected | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| ApprovalCardRequest | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| ApprovalCardTitle | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| Artifact | component |  | `@qlik-coe-emea/qlabs-components-ai` | Panel surface for a durable object the agent produced (document, code, preview) with title, description and actions. |
| ArtifactAction | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| ArtifactActions | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| ArtifactClose | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| ArtifactContent | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| ArtifactDescription | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| ArtifactHeader | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| ArtifactTitle | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| AssetPreview | component |  | `@qlik-coe-emea/qlabs-components-ai` | Type-keyed preview of ONE produced asset — markdown/code/sql/csv/image — inside the Artifact chrome. |
| Attachment | component |  | `@qlik-coe-emea/qlabs-components-ai` | One user-supplied file/source chip — media-category icon, preview, hover details and a remove affordance. |
| AttachmentEmpty | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| AttachmentHoverCard | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| AttachmentHoverCardContent | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| AttachmentHoverCardTrigger | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| AttachmentInfo | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| AttachmentPreview | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| AttachmentRemove | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| Attachments | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| AudioPlayer | component |  | `@qlik-coe-emea/qlabs-components-ai` | Themed audio transport for generated/recorded speech, built on media-chrome's MediaController. |
| AudioPlayerControlBar | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| AudioPlayerDurationDisplay | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| AudioPlayerElement | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| AudioPlayerMuteButton | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| AudioPlayerPlayButton | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| AudioPlayerSeekBackwardButton | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| AudioPlayerSeekForwardButton | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| AudioPlayerTimeDisplay | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| AudioPlayerTimeRange | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| AudioPlayerVolumeRange | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| BrandMotionConfig | component |  | `@qlik-coe-emea/qlabs-components-ai` | Feeds descendant Motion components the brand transition (duration/ease mirrored from the motion tokens). |
| Canvas | component |  | `@qlik-coe-emea/qlabs-components-ai` | The in-chat agent workspace graph surface (React Flow) — the canvas an agent renders inside a conversation (ADR 0018). |
| ChainOfThought | component |  | `@qlik-coe-emea/qlabs-components-ai` | Step-by-step live reasoning trace with per-step status and search results. |
| ChainOfThoughtContent | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| ChainOfThoughtHeader | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| ChainOfThoughtImage | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| ChainOfThoughtSearchResult | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| ChainOfThoughtSearchResults | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| ChainOfThoughtStep | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| ChatGreeting | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| ChatShell | component |  | `@qlik-coe-emea/qlabs-components-ai` | Assistant/chat application frame composing the conversation + composer surfaces. |
| Checkpoint | component |  | `@qlik-coe-emea/qlabs-components-ai` | A restore-point divider in a transcript — a labelled rule the user can jump back to. |
| CheckpointIcon | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| CheckpointTrigger | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| CodeBlock | component |  | `@qlik-coe-emea/qlabs-components-ai` | Shiki-highlighted code block with a copy button, filename and language selector. |
| CodeBlockActions | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| CodeBlockContainer | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| CodeBlockContent | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| CodeBlockCopyButton | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| CodeBlockFilename | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| CodeBlockHeader | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| CodeBlockLanguageSelector | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| CodeBlockLanguageSelectorContent | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| CodeBlockLanguageSelectorItem | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| CodeBlockLanguageSelectorTrigger | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| CodeBlockLanguageSelectorValue | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| CodeBlockTitle | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| Commit | component |  | `@qlik-coe-emea/qlabs-components-ai` | A version-control commit rendered in chat — hash, author, message and changed files. |
| CommitActions | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| CommitAuthor | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| CommitAuthorAvatar | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| CommitContent | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| CommitCopyButton | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| CommitFile | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| CommitFileAdditions | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| CommitFileChanges | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| CommitFileDeletions | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| CommitFileIcon | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| CommitFileInfo | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| CommitFilePath | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| CommitFiles | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| CommitFileStatus | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| CommitHash | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| CommitHeader | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| CommitInfo | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| CommitMessage | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| CommitMetadata | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| CommitSeparator | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| CommitTimestamp | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| Composer | component |  | `@qlik-coe-emea/qlabs-components-ai` | The standard chat input — a PromptInput pre-assembled with attachments, tools and submit. |
| Confirmation | component |  | `@qlik-coe-emea/qlabs-components-ai` | In-conversation approve/deny request for an action the agent wants a human to authorize. |
| ConfirmationAccepted | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| ConfirmationAction | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| ConfirmationActions | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| ConfirmationApprove | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| ConfirmationDeny | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| ConfirmationDescription | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| ConfirmationRejected | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| ConfirmationRequest | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| ConfirmationTitle | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| Connection | component |  | `@qlik-coe-emea/qlabs-components-ai` | The in-flight connection line drawn while the user drags a new edge on the Canvas. |
| Context | component |  | `@qlik-coe-emea/qlabs-components-ai` | Context-window usage readout for a model turn — used vs max tokens, with a hover breakdown. |
| ContextCacheUsage | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| ContextContent | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| ContextContentBody | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| ContextContentFooter | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| ContextContentHeader | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| ContextInputUsage | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| ContextOutputUsage | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| ContextPanel | component |  | `@qlik-coe-emea/qlabs-components-ai` | The chat workspace's right context rail — sources, produced assets and a root↔detail drill-in. |
| ContextPanelBody | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| ContextPanelDetail | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| ContextPanelHeader | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| ContextPanelProvider | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| ContextPanelSection | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| ContextPanelTrigger | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| ContextReasoningUsage | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| ContextTrigger | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| Controls | component |  | `@qlik-coe-emea/qlabs-components-ai` | Zoom / fit / lock controls for the agent workspace Canvas. |
| Conversation | component |  | `@qlik-coe-emea/qlabs-components-ai` | Auto-stick-to-bottom chat transcript region. |
| ConversationContent | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| ConversationDownload | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| ConversationEmptyState | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| ConversationScrollButton | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| Edge | component |  | `@qlik-coe-emea/qlabs-components-ai` | A connection between two workspace-graph nodes — animated/temporary or committed. |
| EMPTY_CELL | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| EnvironmentVariable | component |  | `@qlik-coe-emea/qlabs-components-ai` | One environment variable row — name, masked value, required flag and copy. |
| EnvironmentVariableCopyButton | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| EnvironmentVariableGroup | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| EnvironmentVariableName | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| EnvironmentVariableRequired | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| EnvironmentVariables | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| EnvironmentVariablesContent | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| EnvironmentVariablesHeader | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| EnvironmentVariablesTitle | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| EnvironmentVariablesToggle | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| EnvironmentVariableValue | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| EvidenceChip | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| FileTree | component |  | `@qlik-coe-emea/qlabs-components-ai` | Hierarchical file/folder list for a workspace — `code` (IDE source tree) or `document` (produced assets) look. |
| FileTreeActions | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| FileTreeFile | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| FileTreeFolder | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| FileTreeIcon | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| FileTreeName | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| Gallery | component |  | `@qlik-coe-emea/qlabs-components-ai` | Image/asset grid with a +N overflow tile that opens a lightbox Dialog (carousel + metadata). |
| GroupedParts | component |  | `@qlik-coe-emea/qlabs-components-ai` | Renders an ordered message part list, folding adjacent reasoning/tool parts into collapsible traces. |
| Image | component |  | `@qlik-coe-emea/qlabs-components-ai` | Renders a model-generated image from its base64 payload. |
| InlineCitation | component |  | `@qlik-coe-emea/qlabs-components-ai` | Inline source marker whose hover card carries the quote and the source carousel. |
| InlineCitationCard | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| InlineCitationCardBody | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| InlineCitationCardTrigger | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| InlineCitationCarousel | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| InlineCitationCarouselContent | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| InlineCitationCarouselHeader | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| InlineCitationCarouselIndex | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| InlineCitationCarouselItem | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| InlineCitationCarouselNext | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| InlineCitationCarouselPrev | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| InlineCitationQuote | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| InlineCitationSource | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| InlineCitationText | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| InteractiveTerminal | component |  | `@qlik-coe-emea/qlabs-components-ai` | Streaming terminal surface for agent shell output, with an optional input line. |
| JSXPreview | component |  | `@qlik-coe-emea/qlabs-components-ai` | Escape-hatch renderer for agent-emitted JSX STRINGS — maximum flexibility, least safety (D2). |
| JSXPreviewContent | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| JSXPreviewError | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| JSXPreviewSkeleton | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| LocalReferencedSourcesContext | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| MarkdownView | component |  | `@qlik-coe-emea/qlabs-components-ai` | Branded, read-only renderer for a produced markdown document (not a code view). |
| Message | component |  | `@qlik-coe-emea/qlabs-components-ai` | One conversation turn — `from` decides the side, fill and slot; wraps the turn's content. |
| MessageAction | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| MessageActions | component | appearance=plain*\|bar · reveal=always*\|hover | `@qlik-coe-emea/qlabs-components-ai` |  |
| MessageAvatar | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| MessageBranch | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| MessageBranchContent | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| MessageBranchNext | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| MessageBranchPage | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| MessageBranchPrevious | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| MessageBranchSelector | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| MessageContent | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| MessageEdit | component |  | `@qlik-coe-emea/qlabs-components-ai` | Edit-in-place for a user message — swaps the bubble between content and an editor. |
| MessageEditContent | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| MessageEditForm | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| MessageEditProvider | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| MessageEditTrigger | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| MessageFeedback | component | compact=true\|false* | `@qlik-coe-emea/qlabs-components-ai` | Thumbs up/down on a single assistant message. |
| MessageForm | component |  | `@qlik-coe-emea/qlabs-components-ai` | A model-emitted, zod-validated form rendered inside a chat message; returns structured values on submit. |
| MessageFormDescription | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| MessageFormFallback | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| MessageFormField | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| MessageFormFields | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| MessageFormProvider | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| MessageFormRoot | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| MessageFormSubmit | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| MessageFormTitle | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| MessageHeader | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| MessageResponse | component |  | `@qlik-coe-emea/qlabs-components-ai` | Renders streamed assistant markdown (Streamdown) inside a Message. |
| MessageTable | component |  | `@qlik-coe-emea/qlabs-components-ai` | A model-emitted, column-oriented data table rendered as message content. |
| MessageTableFallback | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| MessageToolbar | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| MicSelector | component |  | `@qlik-coe-emea/qlabs-components-ai` | Input-device picker for voice capture — a searchable Command list in a Popover. |
| MicSelectorContent | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| MicSelectorEmpty | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| MicSelectorInput | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| MicSelectorItem | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| MicSelectorLabel | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| MicSelectorList | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| MicSelectorTrigger | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| MicSelectorValue | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| MODEL_SELECTOR_LOGO_BASE_URL | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| ModelSelector | component |  | `@qlik-coe-emea/qlabs-components-ai` | Command-palette picker for the active model, grouped by provider. |
| ModelSelectorContent | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| ModelSelectorDialog | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| ModelSelectorEmpty | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| ModelSelectorGroup | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| ModelSelectorInput | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| ModelSelectorItem | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| ModelSelectorList | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| ModelSelectorLogo | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| ModelSelectorLogoGroup | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| ModelSelectorName | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| ModelSelectorSeparator | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| ModelSelectorShortcut | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| ModelSelectorTrigger | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| Node | component |  | `@qlik-coe-emea/qlabs-components-ai` | A workspace-graph node — a Card with source/target handles, headed and slotted. |
| NodeAction | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| NodeContent | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| NodeDescription | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| NodeFooter | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| NodeHeader | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| NodeTitle | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| NodeToolbar | component |  | `@qlik-coe-emea/qlabs-components-ai` | The contextual action bar attached to a selected workspace-graph node. |
| OpenIn | component |  | `@qlik-coe-emea/qlabs-components-ai` | A menu that hands the current prompt off to an external chat product via a deep link. |
| OpenInChatGPT | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| OpenInClaude | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| OpenInContent | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| OpenInCursor | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| OpenInItem | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| OpenInLabel | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| OpenInScira | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| OpenInSeparator | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| OpenInT3 | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| OpenInTrigger | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| OpenInv0 | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| PackageInfo | component |  | `@qlik-coe-emea/qlabs-components-ai` | A dependency and its version change — name, current→new version and change type. |
| PackageInfoChangeType | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| PackageInfoContent | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| PackageInfoDependencies | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| PackageInfoDependency | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| PackageInfoDescription | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| PackageInfoHeader | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| PackageInfoName | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| PackageInfoVersion | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| Panel | component |  | `@qlik-coe-emea/qlabs-components-ai` | A floating overlay panel pinned to a corner of the workspace Canvas. |
| Persona | component |  | `@qlik-coe-emea/qlabs-components-ai` | The animated agent avatar/presence mark (Rive), used as the assistant's identity. |
| PERSONA_SOURCES | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| Plan | component |  | `@qlik-coe-emea/qlabs-components-ai` | A Card-shaped, collapsible plan the agent proposes before it starts executing. |
| PlanAction | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| PlanContent | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| PlanDescription | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| PlanFooter | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| PlanHeader | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| PlanTitle | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| PlanTrigger | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| PRODUCED_ASSET_ICONS | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| ProducedAssetTree | component |  | `@qlik-coe-emea/qlabs-components-ai` | The `document`-flavoured tree of assets the agent produced, for the context rail. |
| PromptInput | component |  | `@qlik-coe-emea/qlabs-components-ai` | Chat composer FORM (Enter submits) emitting a message to the app's runtime. |
| PromptInputActionAddAttachments | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| PromptInputActionAddScreenshot | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| PromptInputActionMenu | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| PromptInputActionMenuContent | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| PromptInputActionMenuItem | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| PromptInputActionMenuTrigger | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| PromptInputBody | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| PromptInputButton | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| PromptInputCommand | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| PromptInputCommandEmpty | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| PromptInputCommandGroup | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| PromptInputCommandInput | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| PromptInputCommandItem | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| PromptInputCommandList | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| PromptInputCommandSeparator | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| PromptInputFooter | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| PromptInputHeader | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| PromptInputHoverCard | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| PromptInputHoverCardContent | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| PromptInputHoverCardTrigger | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| PromptInputProvider | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| PromptInputSelect | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| PromptInputSelectContent | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| PromptInputSelectItem | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| PromptInputSelectTrigger | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| PromptInputSelectValue | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| PromptInputStop | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| PromptInputSubmit | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| PromptInputTab | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| PromptInputTabBody | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| PromptInputTabItem | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| PromptInputTabLabel | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| PromptInputTabsList | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| PromptInputTextarea | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| PromptInputTools | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| Queue | component |  | `@qlik-coe-emea/qlabs-components-ai` | The pending work list — queued user messages and agent to-dos, grouped and collapsible. |
| QueueItem | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| QueueItemAction | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| QueueItemActions | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| QueueItemAttachment | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| QueueItemContent | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| QueueItemDescription | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| QueueItemFile | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| QueueItemImage | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| QueueItemIndicator | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| QueueList | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| QueueSection | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| QueueSectionContent | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| QueueSectionLabel | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| QueueSectionTrigger | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| Reasoning | component |  | `@qlik-coe-emea/qlabs-components-ai` | Collapsible 'thinking' disclosure that auto-opens while the model streams and reports elapsed duration. |
| ReasoningContent | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| ReasoningTrigger | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| Sandbox | component |  | `@qlik-coe-emea/qlabs-components-ai` | Collapsible, tabbed view of the files/commands a code-running tool worked on. |
| SandboxContent | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| SandboxHeader | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| SandboxTabContent | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| SandboxTabs | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| SandboxTabsBar | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| SandboxTabsList | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| SandboxTabsTrigger | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| SchemaDisplay | component |  | `@qlik-coe-emea/qlabs-components-ai` | An HTTP endpoint contract in chat — method, path, parameters, request and response shapes. |
| SchemaDisplayBody | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| SchemaDisplayContent | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| SchemaDisplayDescription | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| SchemaDisplayExample | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| SchemaDisplayHeader | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| SchemaDisplayMethod | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| SchemaDisplayParameter | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| SchemaDisplayParameters | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| SchemaDisplayPath | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| SchemaDisplayProperty | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| SchemaDisplayRequest | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| SchemaDisplayResponse | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| SelectionToolbar | component |  | `@qlik-coe-emea/qlabs-components-ai` | A floating toolbar over selected transcript text, offering Quote as the default action. |
| Shimmer | component |  | `@qlik-coe-emea/qlabs-components-ai` | Motion-aware shimmering TEXT affordance for an in-progress ("Thinking…") line. |
| Snippet | component |  | `@qlik-coe-emea/qlabs-components-ai` | One-line copyable command or value, built on the ui InputGroup. |
| SnippetAddon | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| SnippetCopyButton | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| SnippetInput | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| SnippetText | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| Source | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| SourceList | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| Sources | component |  | `@qlik-coe-emea/qlabs-components-ai` | Collapsible citation list for the sources an answer was grounded in. |
| SourcesContent | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| SourcesTrigger | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| SpeechInput | component |  | `@qlik-coe-emea/qlabs-components-ai` | Push-to-talk capture for the composer — Web Speech API where available, MediaRecorder elsewhere. |
| StackTrace | component |  | `@qlik-coe-emea/qlabs-components-ai` | A parsed error stack — error type, message and frames, with internals folded away. |
| StackTraceActions | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| StackTraceContent | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| StackTraceCopyButton | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| StackTraceError | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| StackTraceErrorMessage | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| StackTraceErrorType | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| StackTraceExpandButton | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| StackTraceFrames | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| StackTraceHeader | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| StreamingSuggestions | component |  | `@qlik-coe-emea/qlabs-components-ai` | The suggestion strip while the set is still being generated. |
| Suggestion | component |  | `@qlik-coe-emea/qlabs-components-ai` | One tappable follow-up prompt the user can send with a click. |
| SuggestionLoading | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| Suggestions | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| Task | component |  | `@qlik-coe-emea/qlabs-components-ai` | Collapsed "what got done" run summary, rendered on the canonical AgentTimeline rail. |
| TaskContent | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| TaskItem | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| TaskItemFile | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| TaskTrigger | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| Terminal | component |  | `@qlik-coe-emea/qlabs-components-ai` | Read-only ANSI console output with copy/clear actions and stick-to-bottom streaming. |
| TerminalActions | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| TerminalClearButton | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| TerminalContent | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| TerminalCopyButton | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| TerminalHeader | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| TerminalStatus | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| TerminalTitle | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| Test | component |  | `@qlik-coe-emea/qlabs-components-ai` | One test-case row inside a test-results block — name, status and duration. |
| TestDuration | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| TestError | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| TestErrorMessage | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| TestErrorStack | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| TestName | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| TestResults | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| TestResultsContent | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| TestResultsDuration | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| TestResultsHeader | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| TestResultsMeta | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| TestResultsProgress | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| TestResultsSummary | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| TestStatus | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| TestSuite | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| TestSuiteContent | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| TestSuiteName | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| TestSuiteStats | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| Tool | component |  | `@qlik-coe-emea/qlabs-components-ai` | Renders one AI SDK ToolUIPart — header (type + state), the input, and the output or error. |
| Toolbar | component |  | `@qlik-coe-emea/qlabs-components-ai` | A dense row of controls that acts on nearby content, collapsed into ONE tab stop with arrow-key navigation between the controls. |
| ToolContent | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| ToolDetails | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| ToolHeader | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| ToolInput | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| ToolOutput | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| ToolResultCard | component |  | `@qlik-coe-emea/qlabs-components-ai` | The artifact a tool PRODUCED, presented as the headline — raised surface, no border, children carry the payload. Its header row is title \| actions \| status, where actions are scoped to the whole artifact (expand, download, open). |
| Transcription | component |  | `@qlik-coe-emea/qlabs-components-ai` | Time-coded speech segments, highlighted against playback position and seekable. |
| TranscriptionSegment | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| useAssetPreviewRenderer | hook |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| useAttachmentContext | hook |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| useAttachmentsContext | hook |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| useAudioDevices | hook |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| useContextPanel | hook |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| useJSXPreview | hook |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| useMessageEdit | hook |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| usePromptInputAttachments | hook |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| usePromptInputController | hook |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| usePromptInputReferencedSources | hook |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| useProviderAttachments | hook |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| useReasoning | hook |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| UserMessage | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| useVoiceSelector | hook |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| VoiceSelector | component |  | `@qlik-coe-emea/qlabs-components-ai` | Voice picker for speech output — searchable list with per-voice attributes and preview. |
| VoiceSelectorAccent | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| VoiceSelectorAge | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| VoiceSelectorAttributes | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| VoiceSelectorBullet | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| VoiceSelectorContent | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| VoiceSelectorDescription | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| VoiceSelectorDialog | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| VoiceSelectorEmpty | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| VoiceSelectorGender | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| VoiceSelectorGroup | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| VoiceSelectorInput | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| VoiceSelectorItem | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| VoiceSelectorList | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| VoiceSelectorName | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| VoiceSelectorPreview | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| VoiceSelectorSeparator | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| VoiceSelectorShortcut | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| VoiceSelectorTrigger | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| WebPreview | component |  | `@qlik-coe-emea/qlabs-components-ai` | Framed preview of a URL the agent produced, with a URL bar and a console drawer. |
| WebPreviewBody | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| WebPreviewConsole | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| WebPreviewNavigation | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| WebPreviewNavigationButton | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |
| WebPreviewUrl | component |  | `@qlik-coe-emea/qlabs-components-ai` |  |

## @qlik-coe-emea/qlabs-components-flow

> Branded React Flow canvas, nodes, edges, controls, inspector.

| Name | Kind | Variants | Import | Notes |
| --- | --- | --- | --- | --- |
| Background | component |  | `@qlik-coe-emea/qlabs-components-flow` |  |
| CanvasShell | component |  | `@qlik-coe-emea/qlabs-components-flow` | Branded React Flow canvas wrapper with token-driven background + sane defaults. |
| Controls | component |  | `@qlik-coe-emea/qlabs-components-flow` | Zoom / fit / lock controls for the agent workspace Canvas. |
| FLOW_ALL_SIDE_HANDLES | component |  | `@qlik-coe-emea/qlabs-components-flow` |  |
| FLOW_GROUP_NODE_TYPE | component |  | `@qlik-coe-emea/qlabs-components-flow` |  |
| FlowButtonEdge | component |  | `@qlik-coe-emea/qlabs-components-flow` |  |
| FlowEdge | component |  | `@qlik-coe-emea/qlabs-components-flow` |  |
| FlowFloatingEdge | component |  | `@qlik-coe-emea/qlabs-components-flow` |  |
| FlowGroupNode | component |  | `@qlik-coe-emea/qlabs-components-flow` |  |
| FlowMiniMap | component |  | `@qlik-coe-emea/qlabs-components-flow` |  |
| FlowNode | component |  | `@qlik-coe-emea/qlabs-components-flow` | Branded custom React Flow node (title/subtitle/kind/icon/tone). |
| FlowPlaceholderNode | component |  | `@qlik-coe-emea/qlabs-components-flow` |  |
| FlowSmartEdge | component |  | `@qlik-coe-emea/qlabs-components-flow` |  |
| HANDLE_SIDES | component |  | `@qlik-coe-emea/qlabs-components-flow` |  |
| HelperLines | component |  | `@qlik-coe-emea/qlabs-components-flow` |  |
| InspectorPanel | component |  | `@qlik-coe-emea/qlabs-components-flow` |  |
| Legend | component |  | `@qlik-coe-emea/qlabs-components-flow` |  |
| MiniMap | component |  | `@qlik-coe-emea/qlabs-components-flow` |  |
| Panel | component |  | `@qlik-coe-emea/qlabs-components-flow` | A floating overlay panel pinned to a corner of the workspace Canvas. |
| Position | component |  | `@qlik-coe-emea/qlabs-components-flow` |  |
| ReactFlow | component |  | `@qlik-coe-emea/qlabs-components-flow` |  |
| ReactFlowProvider | component |  | `@qlik-coe-emea/qlabs-components-flow` |  |
| useAutoLayout | hook |  | `@qlik-coe-emea/qlabs-components-flow` |  |
| useEdgesState | hook |  | `@qlik-coe-emea/qlabs-components-flow` |  |
| useFlowGroups | hook |  | `@qlik-coe-emea/qlabs-components-flow` |  |
| useFlowLayout | hook |  | `@qlik-coe-emea/qlabs-components-flow` |  |
| useHelperLines | hook |  | `@qlik-coe-emea/qlabs-components-flow` |  |
| useNodesState | hook |  | `@qlik-coe-emea/qlabs-components-flow` |  |
| useReactFlow | hook |  | `@qlik-coe-emea/qlabs-components-flow` |  |
| ZoomControls | component |  | `@qlik-coe-emea/qlabs-components-flow` |  |

## @qlik-coe-emea/qlabs-components-maps

> MapLibre GL maps: MapCanvas, markers, popups, controls, routes, arcs, GeoJSON, clusters.

| Name | Kind | Variants | Import | Notes |
| --- | --- | --- | --- | --- |
| MapArc | component |  | `@qlik-coe-emea/qlabs-components-maps` |  |
| MapCanvas | component |  | `@qlik-coe-emea/qlabs-components-maps` | Root MapLibre canvas — theme-aware basemap; the ref is the raw MapLibre Map. |
| MapClusterLayer | component |  | `@qlik-coe-emea/qlabs-components-maps` | Clusters dense point data into count bubbles that split apart as you zoom in. |
| MapControls | component |  | `@qlik-coe-emea/qlabs-components-maps` |  |
| MapGeoJSON | component |  | `@qlik-coe-emea/qlabs-components-maps` |  |
| MapMarker | component |  | `@qlik-coe-emea/qlabs-components-maps` | A point on the map, optionally carrying content, a label, a popup or a tooltip. |
| MapMarkerContent | component |  | `@qlik-coe-emea/qlabs-components-maps` |  |
| MapMarkerLabel | component |  | `@qlik-coe-emea/qlabs-components-maps` |  |
| MapMarkerPopup | component |  | `@qlik-coe-emea/qlabs-components-maps` |  |
| MapMarkerTooltip | component |  | `@qlik-coe-emea/qlabs-components-maps` |  |
| MapPopup | component |  | `@qlik-coe-emea/qlabs-components-maps` | Standalone anchored popup on the map (not bound to a marker). |
| MapRoute | component |  | `@qlik-coe-emea/qlabs-components-maps` |  |
| useMap | hook |  | `@qlik-coe-emea/qlabs-components-maps` |  |

## @qlik-coe-emea/qlabs-components-charts

> MetricCard, MetricGrid, ChartCard, ChartFrame (expand/flip/download).

| Name | Kind | Variants | Import | Notes |
| --- | --- | --- | --- | --- |
| Area | component |  | `@qlik-coe-emea/qlabs-components-charts` |  |
| AreaChart | component |  | `@qlik-coe-emea/qlabs-components-charts` | Cumulative or part-of-whole trend over time — a filled line. |
| AreaChartLoading | component |  | `@qlik-coe-emea/qlabs-components-charts` |  |
| AutoChart | component |  | `@qlik-coe-emea/qlabs-components-charts` | Spec-driven chart — hand it a serializable ChartSpec and it picks and renders the right chart. |
| Bar | component |  | `@qlik-coe-emea/qlabs-components-charts` |  |
| BarChart | component |  | `@qlik-coe-emea/qlabs-components-charts` | Categorical comparison — composed from Bar + BarXAxis/BarYAxis inside its provider. |
| BarXAxis | component |  | `@qlik-coe-emea/qlabs-components-charts` |  |
| BarYAxis | component |  | `@qlik-coe-emea/qlabs-components-charts` |  |
| Candlestick | component |  | `@qlik-coe-emea/qlabs-components-charts` |  |
| CandlestickChart | component |  | `@qlik-coe-emea/qlabs-components-charts` |  |
| CHART_CLIP_PASSTHROUGH | component |  | `@qlik-coe-emea/qlabs-components-charts` |  |
| ChartBrush | component |  | `@qlik-coe-emea/qlabs-components-charts` |  |
| ChartBrushLayout | component |  | `@qlik-coe-emea/qlabs-components-charts` |  |
| ChartBrushSelectionOverlay | component |  | `@qlik-coe-emea/qlabs-components-charts` |  |
| ChartBrushTrackOverlay | component |  | `@qlik-coe-emea/qlabs-components-charts` |  |
| ChartCard | component |  | `@qlik-coe-emea/qlabs-components-charts` | Titled card surface around a chart — header, description, and the chart body. |
| ChartConfigProvider | component |  | `@qlik-coe-emea/qlabs-components-charts` |  |
| ChartDatapointLayer | component |  | `@qlik-coe-emea/qlabs-components-charts` |  |
| ChartDatapointProvider | component |  | `@qlik-coe-emea/qlabs-components-charts` |  |
| ChartFallback | component |  | `@qlik-coe-emea/qlabs-components-charts` |  |
| ChartFrame | component |  | `@qlik-coe-emea/qlabs-components-charts` | Opt-in chart wrapper adding expand / flip-to-table / download-CSV to any chart child. |
| ChartLegend | component |  | `@qlik-coe-emea/qlabs-components-charts` | Series key with label, value and an optional progress bar; pattern-aware under decoration. |
| ChartLegendHoverProvider | component |  | `@qlik-coe-emea/qlabs-components-charts` |  |
| ChartLoadingLabel | component |  | `@qlik-coe-emea/qlabs-components-charts` |  |
| ChartMarkers | component |  | `@qlik-coe-emea/qlabs-components-charts` |  |
| ChartProvider | component |  | `@qlik-coe-emea/qlabs-components-charts` |  |
| ChartRevealClip | component |  | `@qlik-coe-emea/qlabs-components-charts` |  |
| ChartStatFlow | component |  | `@qlik-coe-emea/qlabs-components-charts` |  |
| ChartTooltip | component |  | `@qlik-coe-emea/qlabs-components-charts` | Hover readout for the point/series under the pointer. |
| ChartTooltipBox | component |  | `@qlik-coe-emea/qlabs-components-charts` |  |
| ChartTooltipContent | component |  | `@qlik-coe-emea/qlabs-components-charts` |  |
| ChartTooltipDot | component |  | `@qlik-coe-emea/qlabs-components-charts` |  |
| ChartTooltipIndicator | component |  | `@qlik-coe-emea/qlabs-components-charts` |  |
| ChoroplethChart | component |  | `@qlik-coe-emea/qlabs-components-charts` | Region-shaded map for a measure that is defined per geographic area. |
| ChoroplethFeatureComponent | component |  | `@qlik-coe-emea/qlabs-components-charts` |  |
| ChoroplethGraticule | component |  | `@qlik-coe-emea/qlabs-components-charts` |  |
| ChoroplethProvider | component |  | `@qlik-coe-emea/qlabs-components-charts` |  |
| ChoroplethTooltip | component |  | `@qlik-coe-emea/qlabs-components-charts` |  |
| ComposedChart | component |  | `@qlik-coe-emea/qlabs-components-charts` | One cartesian frame that layers several series types (bars + lines + areas) together. |
| DateTicker | component |  | `@qlik-coe-emea/qlabs-components-charts` |  |
| DEFAULT_CHART_CONFIG | component |  | `@qlik-coe-emea/qlabs-components-charts` |  |
| DEFAULT_CHART_LIFECYCLE | component |  | `@qlik-coe-emea/qlabs-components-charts` |  |
| DEFAULT_CHART_STATUS | component |  | `@qlik-coe-emea/qlabs-components-charts` |  |
| DEFAULT_HOVER_OFFSET | component |  | `@qlik-coe-emea/qlabs-components-charts` |  |
| DEFAULT_MAX_INTERACTIVE_DATAPOINTS | component |  | `@qlik-coe-emea/qlabs-components-charts` |  |
| DEFAULT_Y_AXIS_ID | component |  | `@qlik-coe-emea/qlabs-components-charts` |  |
| DEFAULT_Y_DOMAIN_TWEEN_MS | component |  | `@qlik-coe-emea/qlabs-components-charts` |  |
| FunnelChart | component |  | `@qlik-coe-emea/qlabs-components-charts` | Stage-by-stage drop-off through an ordered pipeline. |
| Gantt | component | density=comfortable*\|compact | `@qlik-coe-emea/qlabs-components-charts` | Schedule grid — tasks as bars over time, with a task table beside them. |
| GANTT_NOMINAL_VIEWPORT_PX | component |  | `@qlik-coe-emea/qlabs-components-charts` |  |
| GANTT_UNIT_MS | component |  | `@qlik-coe-emea/qlabs-components-charts` |  |
| Gauge | component |  | `@qlik-coe-emea/qlabs-components-charts` | Single-value dial against a known range — a KPI with an explicit ceiling. |
| GradientDarkgreenGreen | component |  | `@qlik-coe-emea/qlabs-components-charts` |  |
| GradientLightgreenGreen | component |  | `@qlik-coe-emea/qlabs-components-charts` |  |
| GradientOrangeRed | component |  | `@qlik-coe-emea/qlabs-components-charts` |  |
| GradientPinkBlue | component |  | `@qlik-coe-emea/qlabs-components-charts` |  |
| GradientPinkRed | component |  | `@qlik-coe-emea/qlabs-components-charts` |  |
| GradientPurpleOrange | component |  | `@qlik-coe-emea/qlabs-components-charts` |  |
| GradientPurpleTeal | component |  | `@qlik-coe-emea/qlabs-components-charts` |  |
| GradientSteelPurple | component |  | `@qlik-coe-emea/qlabs-components-charts` |  |
| GradientTealBlue | component |  | `@qlik-coe-emea/qlabs-components-charts` |  |
| Grid | component |  | `@qlik-coe-emea/qlabs-components-charts` |  |
| Legend | component |  | `@qlik-coe-emea/qlabs-components-charts` |  |
| LegendItemComponent | component |  | `@qlik-coe-emea/qlabs-components-charts` |  |
| LegendLabel | component |  | `@qlik-coe-emea/qlabs-components-charts` |  |
| LegendMarker | component |  | `@qlik-coe-emea/qlabs-components-charts` |  |
| LegendProgress | component |  | `@qlik-coe-emea/qlabs-components-charts` |  |
| LegendValue | component |  | `@qlik-coe-emea/qlabs-components-charts` |  |
| Line | component |  | `@qlik-coe-emea/qlabs-components-charts` |  |
| LinearGradient | component |  | `@qlik-coe-emea/qlabs-components-charts` |  |
| LineChart | component |  | `@qlik-coe-emea/qlabs-components-charts` | Trend over a continuous (usually time) axis. |
| LineChartLoading | component |  | `@qlik-coe-emea/qlabs-components-charts` |  |
| LineLoadingPulseStroke | component |  | `@qlik-coe-emea/qlabs-components-charts` |  |
| LiveLine | component |  | `@qlik-coe-emea/qlabs-components-charts` |  |
| LiveLineChart | component |  | `@qlik-coe-emea/qlabs-components-charts` |  |
| LiveXAxis | component |  | `@qlik-coe-emea/qlabs-components-charts` |  |
| LiveYAxis | component |  | `@qlik-coe-emea/qlabs-components-charts` |  |
| MarkerGroup | component |  | `@qlik-coe-emea/qlabs-components-charts` |  |
| MarkerTooltipContent | component |  | `@qlik-coe-emea/qlabs-components-charts` |  |
| MetricCard | component |  | `@qlik-coe-emea/qlabs-components-charts` | Single KPI tile — label, value, delta/trend. |
| MetricGrid | component |  | `@qlik-coe-emea/qlabs-components-charts` | Responsive grid of KPI tiles — the summary row at the top of a dashboard. |
| MIN_DATAPOINT_TARGET_SIZE | component |  | `@qlik-coe-emea/qlabs-components-charts` |  |
| PatternArea | component |  | `@qlik-coe-emea/qlabs-components-charts` |  |
| PatternCircles | component |  | `@qlik-coe-emea/qlabs-components-charts` |  |
| PatternHexagons | component |  | `@qlik-coe-emea/qlabs-components-charts` |  |
| PatternLines | component |  | `@qlik-coe-emea/qlabs-components-charts` |  |
| PatternWaves | component |  | `@qlik-coe-emea/qlabs-components-charts` |  |
| PieCenter | component |  | `@qlik-coe-emea/qlabs-components-charts` |  |
| PieCenterShell | component |  | `@qlik-coe-emea/qlabs-components-charts` |  |
| PieChart | component |  | `@qlik-coe-emea/qlabs-components-charts` | Part-of-whole split across a handful of categories. |
| PieProvider | component |  | `@qlik-coe-emea/qlabs-components-charts` |  |
| PieSlice | component |  | `@qlik-coe-emea/qlabs-components-charts` |  |
| PROFIT_LOSS_LEGEND_ITEMS | component |  | `@qlik-coe-emea/qlabs-components-charts` |  |
| PROFIT_LOSS_NEGATIVE_COLOR | component |  | `@qlik-coe-emea/qlabs-components-charts` |  |
| PROFIT_LOSS_POSITIVE_COLOR | component |  | `@qlik-coe-emea/qlabs-components-charts` |  |
| PROFIT_LOSS_TOOLTIP_LABEL_FALLBACK | component |  | `@qlik-coe-emea/qlabs-components-charts` |  |
| ProfitLossLegend | component |  | `@qlik-coe-emea/qlabs-components-charts` |  |
| ProfitLossLegendHoverProvider | component |  | `@qlik-coe-emea/qlabs-components-charts` |  |
| ProfitLossLine | component |  | `@qlik-coe-emea/qlabs-components-charts` |  |
| RadarArea | component |  | `@qlik-coe-emea/qlabs-components-charts` |  |
| RadarAxis | component |  | `@qlik-coe-emea/qlabs-components-charts` |  |
| RadarChart | component |  | `@qlik-coe-emea/qlabs-components-charts` | Multi-metric profile comparison on a shared radial axis. |
| RadarGrid | component |  | `@qlik-coe-emea/qlabs-components-charts` |  |
| RadarLabels | component |  | `@qlik-coe-emea/qlabs-components-charts` |  |
| RadarProvider | component |  | `@qlik-coe-emea/qlabs-components-charts` |  |
| RadialGradient | component |  | `@qlik-coe-emea/qlabs-components-charts` |  |
| Ring | component |  | `@qlik-coe-emea/qlabs-components-charts` |  |
| RingCenter | component |  | `@qlik-coe-emea/qlabs-components-charts` |  |
| RingChart | component |  | `@qlik-coe-emea/qlabs-components-charts` |  |
| RingProvider | component |  | `@qlik-coe-emea/qlabs-components-charts` |  |
| SankeyChart | component |  | `@qlik-coe-emea/qlabs-components-charts` | Flow diagram — how quantity moves between stages or nodes. |
| SankeyLink | component |  | `@qlik-coe-emea/qlabs-components-charts` |  |
| SankeyNode | component |  | `@qlik-coe-emea/qlabs-components-charts` |  |
| SankeyProvider | component |  | `@qlik-coe-emea/qlabs-components-charts` |  |
| SankeyTooltip | component |  | `@qlik-coe-emea/qlabs-components-charts` |  |
| Scatter | component |  | `@qlik-coe-emea/qlabs-components-charts` |  |
| ScatterChart | component |  | `@qlik-coe-emea/qlabs-components-charts` | Point cloud for correlation between two continuous measures. |
| SegmentBackground | component |  | `@qlik-coe-emea/qlabs-components-charts` |  |
| SegmentLineFrom | component |  | `@qlik-coe-emea/qlabs-components-charts` |  |
| SegmentLineTo | component |  | `@qlik-coe-emea/qlabs-components-charts` |  |
| SeriesBar | component |  | `@qlik-coe-emea/qlabs-components-charts` |  |
| SeriesMarkers | component |  | `@qlik-coe-emea/qlabs-components-charts` |  |
| SeriesPointMarker | component |  | `@qlik-coe-emea/qlabs-components-charts` |  |
| Sparkline | component |  | `@qlik-coe-emea/qlabs-components-charts` | Tiny, axis-less trend that lives inside a KPI tile or a table cell. |
| StaticChartPreviewProvider | component |  | `@qlik-coe-emea/qlabs-components-charts` |  |
| useActivateDatapoint | hook |  | `@qlik-coe-emea/qlabs-components-charts` |  |
| useActiveMarkers | hook |  | `@qlik-coe-emea/qlabs-components-charts` |  |
| useAnimatedYDomains | hook |  | `@qlik-coe-emea/qlabs-components-charts` |  |
| useChart | hook |  | `@qlik-coe-emea/qlabs-components-charts` |  |
| useChartConfig | hook |  | `@qlik-coe-emea/qlabs-components-charts` |  |
| useChartDatapointsEnabled | hook |  | `@qlik-coe-emea/qlabs-components-charts` |  |
| useChartHover | hook |  | `@qlik-coe-emea/qlabs-components-charts` |  |
| useChartInteraction | hook |  | `@qlik-coe-emea/qlabs-components-charts` |  |
| useChartLegendHover | hook |  | `@qlik-coe-emea/qlabs-components-charts` |  |
| useChartStable | hook |  | `@qlik-coe-emea/qlabs-components-charts` |  |
| useChoropleth | hook |  | `@qlik-coe-emea/qlabs-components-charts` |  |
| useChoroplethZoom | hook |  | `@qlik-coe-emea/qlabs-components-charts` |  |
| useHighDecoration | hook |  | `@qlik-coe-emea/qlabs-components-charts` |  |
| useHighDecorationOf | hook |  | `@qlik-coe-emea/qlabs-components-charts` |  |
| useLegend | hook |  | `@qlik-coe-emea/qlabs-components-charts` |  |
| useLegendItem | hook |  | `@qlik-coe-emea/qlabs-components-charts` |  |
| usePie | hook |  | `@qlik-coe-emea/qlabs-components-charts` |  |
| usePieHover | hook |  | `@qlik-coe-emea/qlabs-components-charts` |  |
| usePieStable | hook |  | `@qlik-coe-emea/qlabs-components-charts` |  |
| useProfitLossLegendHover | hook |  | `@qlik-coe-emea/qlabs-components-charts` |  |
| useRadar | hook |  | `@qlik-coe-emea/qlabs-components-charts` |  |
| useRadarHover | hook |  | `@qlik-coe-emea/qlabs-components-charts` |  |
| useRadarStable | hook |  | `@qlik-coe-emea/qlabs-components-charts` |  |
| useRegisterDatapointTargets | hook |  | `@qlik-coe-emea/qlabs-components-charts` |  |
| useResolvedRadius | hook |  | `@qlik-coe-emea/qlabs-components-charts` |  |
| useResolvedRadiusOf | hook |  | `@qlik-coe-emea/qlabs-components-charts` |  |
| useRing | hook |  | `@qlik-coe-emea/qlabs-components-charts` |  |
| useRingHover | hook |  | `@qlik-coe-emea/qlabs-components-charts` |  |
| useRingStable | hook |  | `@qlik-coe-emea/qlabs-components-charts` |  |
| useSankey | hook |  | `@qlik-coe-emea/qlabs-components-charts` |  |
| useStaticChartPreview | hook |  | `@qlik-coe-emea/qlabs-components-charts` |  |
| useYScale | hook |  | `@qlik-coe-emea/qlabs-components-charts` |  |
| XAxis | component |  | `@qlik-coe-emea/qlabs-components-charts` |  |
| Y_AXIS_DEFAULT_TICK_COUNT | component |  | `@qlik-coe-emea/qlabs-components-charts` |  |
| Y_AXIS_MAX_TICK_COUNT | component |  | `@qlik-coe-emea/qlabs-components-charts` |  |
| Y_AXIS_MIN_TICK_COUNT | component |  | `@qlik-coe-emea/qlabs-components-charts` |  |
| YAxis | component |  | `@qlik-coe-emea/qlabs-components-charts` |  |

## @qlik-coe-emea/qlabs-components-marketing

> Hero, FeatureGrid, UseCaseCard, StatsBand, CTASection, LogoStrip.

| Name | Kind | Variants | Import | Notes |
| --- | --- | --- | --- | --- |
| CTASection | component |  | `@qlik-coe-emea/qlabs-components-marketing` | Closing conversion band — one message, one action. |
| FeatureGrid | component |  | `@qlik-coe-emea/qlabs-components-marketing` | Grid of capability cards below the hero. |
| Hero | component |  | `@qlik-coe-emea/qlabs-components-marketing` | Above-the-fold marketing headline, subcopy and the primary call to action. |
| LogoStrip | component |  | `@qlik-coe-emea/qlabs-components-marketing` |  |
| StatsBand | component |  | `@qlik-coe-emea/qlabs-components-marketing` |  |
| UseCaseCard | component |  | `@qlik-coe-emea/qlabs-components-marketing` |  |

## @qlik-coe-emea/qlabs-components-editor

> Token-themed Monaco editor: CodeEditor, DiffEditor, CodeWorkspace.

| Name | Kind | Variants | Import | Notes |
| --- | --- | --- | --- | --- |
| CodeEditor | component |  | `@qlik-coe-emea/qlabs-components-editor` | Monaco-backed editable code editor (controlled/uncontrolled), themed from tokens. |
| CodeWorkspace | component |  | `@qlik-coe-emea/qlabs-components-editor` |  |
| CopyButton | component |  | `@qlik-coe-emea/qlabs-components-editor` |  |
| DiffEditor | component |  | `@qlik-coe-emea/qlabs-components-editor` |  |
| EDITOR_LANGUAGES | component |  | `@qlik-coe-emea/qlabs-components-editor` |  |
| EditorContextMenu | component |  | `@qlik-coe-emea/qlabs-components-editor` |  |
| EditorToolbar | component |  | `@qlik-coe-emea/qlabs-components-editor` |  |
| MarkdownEditor | component |  | `@qlik-coe-emea/qlabs-components-editor` |  |
| useDataTheme | hook |  | `@qlik-coe-emea/qlabs-components-editor` |  |
| Bibliography | component |  | `@qlik-coe-emea/qlabs-components-editor/markdown` |  |
| Blockquote | component |  | `@qlik-coe-emea/qlabs-components-editor/markdown` |  |
| BRAND_DIRECTIVES | component |  | `@qlik-coe-emea/qlabs-components-editor/markdown` |  |
| BRAND_SLASH_COMMANDS | component |  | `@qlik-coe-emea/qlabs-components-editor/markdown` |  |
| CALC_FENCE_SEED | component |  | `@qlik-coe-emea/qlabs-components-editor/markdown` |  |
| CalcBlock | component |  | `@qlik-coe-emea/qlabs-components-editor/markdown` |  |
| CalcInline | component |  | `@qlik-coe-emea/qlabs-components-editor/markdown` |  |
| DECISION_STATUSES | component |  | `@qlik-coe-emea/qlabs-components-editor/markdown` |  |
| DecisionCard | component |  | `@qlik-coe-emea/qlabs-components-editor/markdown` |  |
| DEFAULT_TEMPLATE | component |  | `@qlik-coe-emea/qlabs-components-editor/markdown` |  |
| DocumentOutline | component |  | `@qlik-coe-emea/qlabs-components-editor/markdown` |  |
| ENTITY_KINDS | component |  | `@qlik-coe-emea/qlabs-components-editor/markdown` |  |
| EntityCard | component |  | `@qlik-coe-emea/qlabs-components-editor/markdown` |  |
| EntityChip | component |  | `@qlik-coe-emea/qlabs-components-editor/markdown` |  |
| FootnoteList | component |  | `@qlik-coe-emea/qlabs-components-editor/markdown` |  |
| Heading | component |  | `@qlik-coe-emea/qlabs-components-editor/markdown` |  |
| InlineCode | component |  | `@qlik-coe-emea/qlabs-components-editor/markdown` |  |
| IterationBlock | component |  | `@qlik-coe-emea/qlabs-components-editor/markdown` |  |
| IterationBuilderDialog | component |  | `@qlik-coe-emea/qlabs-components-editor/markdown` |  |
| IterationBuilderProvider | component |  | `@qlik-coe-emea/qlabs-components-editor/markdown` |  |
| IterationEditContext | component |  | `@qlik-coe-emea/qlabs-components-editor/markdown` |  |
| IterationTemplateDialog | component |  | `@qlik-coe-emea/qlabs-components-editor/markdown` |  |
| IterationTemplateProvider | component |  | `@qlik-coe-emea/qlabs-components-editor/markdown` |  |
| KnowledgeCard | component |  | `@qlik-coe-emea/qlabs-components-editor/markdown` |  |
| Link | component |  | `@qlik-coe-emea/qlabs-components-editor/markdown` |  |
| List | component |  | `@qlik-coe-emea/qlabs-components-editor/markdown` |  |
| ListItem | component |  | `@qlik-coe-emea/qlabs-components-editor/markdown` |  |
| MARKDOWN_HEADING_REM | component |  | `@qlik-coe-emea/qlabs-components-editor/markdown` |  |
| MARKDOWN_HEADING_TRACKING | component |  | `@qlik-coe-emea/qlabs-components-editor/markdown` |  |
| MARKDOWN_HEADING_WEIGHT | component |  | `@qlik-coe-emea/qlabs-components-editor/markdown` |  |
| MARKDOWN_MEASURE | component |  | `@qlik-coe-emea/qlabs-components-editor/markdown` |  |
| MarkdownEditor | component |  | `@qlik-coe-emea/qlabs-components-editor/markdown` |  |
| MarkdownPreview | component |  | `@qlik-coe-emea/qlabs-components-editor/markdown` |  |
| MarkdownToolbar | component |  | `@qlik-coe-emea/qlabs-components-editor/markdown` |  |
| MarkdownWorkspace | component |  | `@qlik-coe-emea/qlabs-components-editor/markdown` |  |
| MathBlock | component |  | `@qlik-coe-emea/qlabs-components-editor/markdown` |  |
| MathInline | component |  | `@qlik-coe-emea/qlabs-components-editor/markdown` |  |
| MermaidDiagram | component |  | `@qlik-coe-emea/qlabs-components-editor/markdown` |  |
| MermaidWorkspace | component |  | `@qlik-coe-emea/qlabs-components-editor/markdown` |  |
| MetricBlock | component |  | `@qlik-coe-emea/qlabs-components-editor/markdown` |  |
| MonacoSlashMenu | component |  | `@qlik-coe-emea/qlabs-components-editor/markdown` |  |
| SlashMenu | component |  | `@qlik-coe-emea/qlabs-components-editor/markdown` |  |
| TableOfContents | component |  | `@qlik-coe-emea/qlabs-components-editor/markdown` |  |
| Text | component |  | `@qlik-coe-emea/qlabs-components-editor/markdown` |  |
| Timeline | component |  | `@qlik-coe-emea/qlabs-components-editor/markdown` |  |
| useMarkdownOutline | hook |  | `@qlik-coe-emea/qlabs-components-editor/markdown` |  |

## @qlik-coe-emea/qlabs-components-viewer

> FileViewer — any file (image, text, JSON, CSV) via a pluggable adapter registry.

| Name | Kind | Variants | Import | Notes |
| --- | --- | --- | --- | --- |
| ACTIVE_HIGHLIGHT_SELECTOR | component |  | `@qlik-coe-emea/qlabs-components-viewer` |  |
| DEFAULT_ZOOM | component |  | `@qlik-coe-emea/qlabs-components-viewer` |  |
| FileViewer | component |  | `@qlik-coe-emea/qlabs-components-viewer` | Render a file the app did not write (upload, signed URL, agent output) — detects the format, loads the matching adapter on demand, draws it with brand-ui components. |
| FileViewerContent | component |  | `@qlik-coe-emea/qlabs-components-viewer` |  |
| FileViewerEmpty | component |  | `@qlik-coe-emea/qlabs-components-viewer` |  |
| FileViewerError | component |  | `@qlik-coe-emea/qlabs-components-viewer` |  |
| FileViewerFind | component |  | `@qlik-coe-emea/qlabs-components-viewer` |  |
| FileViewerFrame | component |  | `@qlik-coe-emea/qlabs-components-viewer` |  |
| FileViewerHighlightStatus | component |  | `@qlik-coe-emea/qlabs-components-viewer` |  |
| FileViewerPager | component |  | `@qlik-coe-emea/qlabs-components-viewer` |  |
| FileViewerProvider | component |  | `@qlik-coe-emea/qlabs-components-viewer` |  |
| FileViewerRotate | component |  | `@qlik-coe-emea/qlabs-components-viewer` |  |
| FileViewerSkeleton | component |  | `@qlik-coe-emea/qlabs-components-viewer` |  |
| FileViewerToolbar | component |  | `@qlik-coe-emea/qlabs-components-viewer` |  |
| FileViewerZoom | component |  | `@qlik-coe-emea/qlabs-components-viewer` |  |
| FIND_MATCH_LIMIT | component |  | `@qlik-coe-emea/qlabs-components-viewer` |  |
| PROTOCOL_VERSION | component |  | `@qlik-coe-emea/qlabs-components-viewer` |  |
| useFileViewer | hook |  | `@qlik-coe-emea/qlabs-components-viewer` |  |
| useScrollActiveHighlightIntoView | hook |  | `@qlik-coe-emea/qlabs-components-viewer` |  |
| VIEWER_ZOOM_STEPS | component |  | `@qlik-coe-emea/qlabs-components-viewer` |  |
| ViewerError | component |  | `@qlik-coe-emea/qlabs-components-viewer` |  |

---

_Generated by `@qlik-coe-emea/qlabs-components-cli`. The live, queryable surface is `brand-ui docs <Component>` (real props) and, when the Storybook dev server is up, the `mcp__storybook__*` tools._
