<!-- GENERATED FILE — do not edit by hand.
     Source: brand-ui.manifest.json (via `pnpm inventory`).
     Regenerate after any component/token change; the inventory:check gate fails on drift. -->

# brand-ui component inventory

The full component/hook surface, generated from the manifest. `*` marks a cva default value. Subpath-exported items show their import path.

**Themes (2):** dark, light (default)
**Radius:** `calc(var(--radius-base) * (1 - var(--decoration-factor)))` · **Tokens:** 169

## Packages

| Package | Path | Components | Hooks | Purpose |
| --- | --- | --: | --: | --- |
| `@elabs-ai/components-tokens` | packages/tokens | 19 | 6 | Semantic CSS-variable themes + ThemeProvider/useTheme. |
| `@elabs-ai/components-icons` | packages/icons | 31 | 0 | Brand/product-vocabulary icons + BrandLogo (generic glyphs use lucide-react). |
| `@elabs-ai/components-ui` | packages/ui | 354 | 14 | Foundation + app UI (Button, Card, Dialog, Tabs, AppShell, …). |
| `@elabs-ai/components-data` | packages/data | 5 | 0 | TanStack DataTable, FilterBar, SearchInput, FacetFilter, ColumnPicker. |
| `@elabs-ai/components-ai` | packages/ai | 446 | 14 | ChatShell, Conversation, Message, PromptInput, Tool, Reasoning, citations. |
| `@elabs-ai/components-flow` | packages/flow | 23 | 7 | Branded React Flow canvas, nodes, edges, controls, inspector. |
| `@elabs-ai/components-maps` | packages/maps | 12 | 1 | MapLibre GL maps: MapCanvas, markers, popups, controls, routes, arcs, GeoJSON, clusters. |
| `@elabs-ai/components-charts` | packages/charts | 130 | 32 | MetricCard, MetricGrid, ChartCard, ChartFrame (expand/flip/download). |
| `@elabs-ai/components-marketing` | packages/marketing | 6 | 0 | Hero, FeatureGrid, UseCaseCard, StatsBand, CTASection, LogoStrip. |
| `@elabs-ai/components-editor` | packages/editor | 8 | 1 | Token-themed Monaco editor: CodeEditor, DiffEditor, CodeWorkspace. |
| `@elabs-ai/components-viewer` | packages/viewer | 19 | 2 | FileViewer — any file (image, text, JSON, CSV) via a pluggable adapter registry. |

## @elabs-ai/components-tokens

> Semantic CSS-variable themes + ThemeProvider/useTheme.

| Name | Kind | Variants | Import | Notes |
| --- | --- | --- | --- | --- |
| BUILT_IN_THEME_DEFINITIONS | component |  | `@elabs-ai/components-tokens` |  |
| BUILT_IN_THEME_META | component |  | `@elabs-ai/components-tokens` |  |
| BUILT_IN_THEMES | component |  | `@elabs-ai/components-tokens` |  |
| DECORATION_LEVELS | component |  | `@elabs-ai/components-tokens` |  |
| DecorationProvider | component |  | `@elabs-ai/components-tokens` | Sets the `--decoration` dial (0–10) for a region — reprographic texture, orthogonal to color. |
| DEFAULT_DECORATION_LEVEL | component |  | `@elabs-ai/components-tokens` |  |
| DEFAULT_DENSITY | component |  | `@elabs-ai/components-tokens` |  |
| DEFAULT_MOTION_PREFERENCE | component |  | `@elabs-ai/components-tokens` |  |
| DEFAULT_TASTE_PROFILE | component |  | `@elabs-ai/components-tokens` |  |
| DEFAULT_TASTE_REGISTER | component |  | `@elabs-ai/components-tokens` |  |
| DEFAULT_THEME | component |  | `@elabs-ai/components-tokens` |  |
| DENSITIES | component |  | `@elabs-ai/components-tokens` |  |
| DENSITY_META | component |  | `@elabs-ai/components-tokens` |  |
| MOTION_PREFERENCE_META | component |  | `@elabs-ai/components-tokens` |  |
| MOTION_PREFERENCES | component |  | `@elabs-ai/components-tokens` |  |
| TASTE_REGISTER_META | component |  | `@elabs-ai/components-tokens` |  |
| TASTE_REGISTERS | component |  | `@elabs-ai/components-tokens` |  |
| THEME_TOKEN_NAMES | component |  | `@elabs-ai/components-tokens` |  |
| ThemeProvider | component |  | `@elabs-ai/components-tokens` | Writes `data-theme` on a root element and persists the choice; `useTheme()` reads/sets it. |
| useDecoration | hook |  | `@elabs-ai/components-tokens` |  |
| useDensity | hook |  | `@elabs-ai/components-tokens` |  |
| useMotionPreference | hook |  | `@elabs-ai/components-tokens` |  |
| useReducedMotion | hook |  | `@elabs-ai/components-tokens` |  |
| useTasteProfile | hook |  | `@elabs-ai/components-tokens` |  |
| useTheme | hook |  | `@elabs-ai/components-tokens` |  |

## @elabs-ai/components-icons

> Brand/product-vocabulary icons + BrandLogo (generic glyphs use lucide-react).

| Name | Kind | Variants | Import | Notes |
| --- | --- | --- | --- | --- |
| AppIcon | component |  | `@elabs-ai/components-icons` | The standard app/brand mark for app chrome — theme-aware, morphs mark↔lockup on sidebar collapse. |
| BookmarkIcon | component |  | `@elabs-ai/components-icons` |  |
| BrandLogo | component |  | `@elabs-ai/components-icons` | The product's mark/lockup, drawn from tokens so it adapts to every theme. |
| ChartAreaIcon | component |  | `@elabs-ai/components-icons` |  |
| ChartBarIcon | component |  | `@elabs-ai/components-icons` |  |
| ChartComboIcon | component |  | `@elabs-ai/components-icons` |  |
| ChartLineIcon | component |  | `@elabs-ai/components-icons` |  |
| ChartPieIcon | component |  | `@elabs-ai/components-icons` |  |
| ChartScatterIcon | component |  | `@elabs-ai/components-icons` |  |
| ChatIcon | component |  | `@elabs-ai/components-icons` |  |
| DashboardIcon | component |  | `@elabs-ai/components-icons` |  |
| DataConnectionIcon | component |  | `@elabs-ai/components-icons` |  |
| DataModelIcon | component |  | `@elabs-ai/components-icons` |  |
| DatasetIcon | component |  | `@elabs-ai/components-icons` |  |
| DimensionIcon | component |  | `@elabs-ai/components-icons` |  |
| FilterPaneIcon | component |  | `@elabs-ai/components-icons` |  |
| FlowIcon | component |  | `@elabs-ai/components-icons` |  |
| GaugeIcon | component |  | `@elabs-ai/components-icons` |  |
| Icon | component |  | `@elabs-ai/components-icons` | The brand/product-vocabulary icon primitive — 24×24, stroke = currentColor, so it themes with text. |
| InsightIcon | component |  | `@elabs-ai/components-icons` |  |
| KpiIcon | component |  | `@elabs-ai/components-icons` |  |
| MeasureIcon | component |  | `@elabs-ai/components-icons` |  |
| PipelineIcon | component |  | `@elabs-ai/components-icons` |  |
| PivotIcon | component |  | `@elabs-ai/components-icons` |  |
| SearchIcon | component |  | `@elabs-ai/components-icons` |  |
| SheetIcon | component |  | `@elabs-ai/components-icons` |  |
| SparklesIcon | component |  | `@elabs-ai/components-icons` |  |
| StoryIcon | component |  | `@elabs-ai/components-icons` |  |
| TableIcon | component |  | `@elabs-ai/components-icons` |  |
| TrendDownIcon | component |  | `@elabs-ai/components-icons` |  |
| TrendUpIcon | component |  | `@elabs-ai/components-icons` |  |

## @elabs-ai/components-ui

> Foundation + app UI (Button, Card, Dialog, Tabs, AppShell, …).

| Name | Kind | Variants | Import | Notes |
| --- | --- | --- | --- | --- |
| Accordion | component |  | `@elabs-ai/components-ui` |  |
| AccordionContent | component |  | `@elabs-ai/components-ui` |  |
| AccordionItem | component |  | `@elabs-ai/components-ui` |  |
| AccordionTrigger | component |  | `@elabs-ai/components-ui` |  |
| AdvancedGroup | component |  | `@elabs-ai/components-ui` |  |
| Alert | component | variant=default*\|info\|success\|warning\|destructive | `@elabs-ai/components-ui` |  |
| AlertDescription | component |  | `@elabs-ai/components-ui` |  |
| AlertDialog | component |  | `@elabs-ai/components-ui` | Confirmation overlay for destructive / irreversible actions — friction proportional to consequence. |
| AlertDialogAction | component |  | `@elabs-ai/components-ui` |  |
| AlertDialogCancel | component |  | `@elabs-ai/components-ui` |  |
| AlertDialogContent | component |  | `@elabs-ai/components-ui` |  |
| AlertDialogDescription | component |  | `@elabs-ai/components-ui` |  |
| AlertDialogFooter | component |  | `@elabs-ai/components-ui` |  |
| AlertDialogHeader | component |  | `@elabs-ai/components-ui` |  |
| AlertDialogPortal | component |  | `@elabs-ai/components-ui` |  |
| AlertDialogTitle | component |  | `@elabs-ai/components-ui` |  |
| AlertDialogTrigger | component |  | `@elabs-ai/components-ui` |  |
| AlertTitle | component |  | `@elabs-ai/components-ui` |  |
| AppShell | component |  | `@elabs-ai/components-ui` | Top-level application frame — sidebar + header + content region. |
| AppSidebar | component |  | `@elabs-ai/components-ui` |  |
| AspectRatio | component |  | `@elabs-ai/components-ui` |  |
| AttributionPanel | component |  | `@elabs-ai/components-ui` |  |
| ATTRIBUTIONS | component |  | `@elabs-ai/components-ui` |  |
| Avatar | component |  | `@elabs-ai/components-ui` |  |
| AvatarFallback | component |  | `@elabs-ai/components-ui` |  |
| AvatarImage | component |  | `@elabs-ai/components-ui` |  |
| Badge | component | variant=default*\|secondary\|outline\|success\|warning\|destructive\|info | `@elabs-ai/components-ui` | Compact status/label chip (status, count, category). |
| BentoGrid | component |  | `@elabs-ai/components-ui` |  |
| BentoGridItem | component | hero=true\|false* · interactive=true\|false* | `@elabs-ai/components-ui` |  |
| BoundedNumber | component |  | `@elabs-ai/components-ui` |  |
| Breadcrumb | component |  | `@elabs-ai/components-ui` |  |
| BreadcrumbEllipsis | component |  | `@elabs-ai/components-ui` |  |
| BreadcrumbItem | component |  | `@elabs-ai/components-ui` |  |
| BreadcrumbLink | component |  | `@elabs-ai/components-ui` |  |
| BreadcrumbList | component |  | `@elabs-ai/components-ui` |  |
| BreadcrumbPage | component |  | `@elabs-ai/components-ui` |  |
| BreadcrumbSeparator | component |  | `@elabs-ai/components-ui` |  |
| Button | component | variant=default*\|secondary\|destructive\|outline\|outline-subtle\|ghost\|link · size=sm\|default*\|lg\|icon\|icon-sm\|icon-lg | `@elabs-ai/components-ui` | Primary action trigger — the canonical way to invoke an action. |
| ButtonGroup | component | orientation=horizontal*\|vertical | `@elabs-ai/components-ui` |  |
| ButtonGroupSeparator | component |  | `@elabs-ai/components-ui` |  |
| ButtonGroupText | component |  | `@elabs-ai/components-ui` |  |
| Calendar | component |  | `@elabs-ai/components-ui` |  |
| Card | component | interactive=true\|false* | `@elabs-ai/components-ui` | Surface grouping related content into a bordered, padded block. |
| CardAction | component |  | `@elabs-ai/components-ui` |  |
| CardContent | component |  | `@elabs-ai/components-ui` |  |
| CardDescription | component |  | `@elabs-ai/components-ui` |  |
| CardFooter | component |  | `@elabs-ai/components-ui` |  |
| CardHeader | component |  | `@elabs-ai/components-ui` |  |
| CardTitle | component |  | `@elabs-ai/components-ui` |  |
| Carousel | component |  | `@elabs-ai/components-ui` |  |
| CarouselContent | component |  | `@elabs-ai/components-ui` |  |
| CarouselItem | component |  | `@elabs-ai/components-ui` |  |
| CarouselNext | component |  | `@elabs-ai/components-ui` |  |
| CarouselPrevious | component |  | `@elabs-ai/components-ui` |  |
| CATEGORY_LABEL | component |  | `@elabs-ai/components-ui` |  |
| ChangeReview | component |  | `@elabs-ai/components-ui` |  |
| ChangeReviewHeader | component |  | `@elabs-ai/components-ui` |  |
| ChangeReviewHunk | component |  | `@elabs-ai/components-ui` |  |
| ChangeReviewList | component |  | `@elabs-ai/components-ui` |  |
| ChangeReviewProvenance | component |  | `@elabs-ai/components-ui` |  |
| ChangeReviewProvider | component |  | `@elabs-ai/components-ui` |  |
| Checkbox | component |  | `@elabs-ai/components-ui` | Binary on/off toggle within a form (multi-select within a group). |
| Collapsible | component |  | `@elabs-ai/components-ui` |  |
| CollapsibleContent | component |  | `@elabs-ai/components-ui` |  |
| CollapsibleTrigger | component |  | `@elabs-ai/components-ui` |  |
| COLOR_TOKENS | component |  | `@elabs-ai/components-ui` |  |
| ColorPicker | component |  | `@elabs-ai/components-ui` |  |
| Combobox | component |  | `@elabs-ai/components-ui` | Searchable single/multi select — Select with typeahead over a large or async option set. |
| Command | component |  | `@elabs-ai/components-ui` |  |
| CommandDialog | component |  | `@elabs-ai/components-ui` |  |
| CommandEmpty | component |  | `@elabs-ai/components-ui` |  |
| CommandGroup | component |  | `@elabs-ai/components-ui` |  |
| CommandInput | component |  | `@elabs-ai/components-ui` |  |
| CommandItem | component |  | `@elabs-ai/components-ui` |  |
| CommandList | component |  | `@elabs-ai/components-ui` |  |
| CommandSeparator | component |  | `@elabs-ai/components-ui` |  |
| CommandShortcut | component |  | `@elabs-ai/components-ui` |  |
| ConfirmDialog | component |  | `@elabs-ai/components-ui` |  |
| ContextMenu | component |  | `@elabs-ai/components-ui` |  |
| ContextMenuCheckboxItem | component |  | `@elabs-ai/components-ui` |  |
| ContextMenuContent | component |  | `@elabs-ai/components-ui` |  |
| ContextMenuGroup | component |  | `@elabs-ai/components-ui` |  |
| ContextMenuItem | component |  | `@elabs-ai/components-ui` |  |
| ContextMenuLabel | component |  | `@elabs-ai/components-ui` |  |
| ContextMenuRadioGroup | component |  | `@elabs-ai/components-ui` |  |
| ContextMenuRadioItem | component |  | `@elabs-ai/components-ui` |  |
| ContextMenuSeparator | component |  | `@elabs-ai/components-ui` |  |
| ContextMenuShortcut | component |  | `@elabs-ai/components-ui` |  |
| ContextMenuSub | component |  | `@elabs-ai/components-ui` |  |
| ContextMenuSubContent | component |  | `@elabs-ai/components-ui` |  |
| ContextMenuSubTrigger | component |  | `@elabs-ai/components-ui` |  |
| ContextMenuTrigger | component |  | `@elabs-ai/components-ui` |  |
| COPY_FEEDBACK_MS | component |  | `@elabs-ai/components-ui` |  |
| CopyableValue | component |  | `@elabs-ai/components-ui` |  |
| DatePicker | component |  | `@elabs-ai/components-ui` |  |
| DateRangePicker | component |  | `@elabs-ai/components-ui` |  |
| DEFAULT_MESSAGES | component |  | `@elabs-ai/components-ui` |  |
| Descriptions | component |  | `@elabs-ai/components-ui` |  |
| DescriptionsItem | component |  | `@elabs-ai/components-ui` |  |
| Dialog | component |  | `@elabs-ai/components-ui` | Modal overlay for focused tasks/flows that block the page until dismissed. |
| DialogBody | component |  | `@elabs-ai/components-ui` |  |
| DialogClose | component |  | `@elabs-ai/components-ui` |  |
| DialogContent | component | size=sm\|lg*\|xl\|full | `@elabs-ai/components-ui` |  |
| DialogDescription | component |  | `@elabs-ai/components-ui` |  |
| DialogFooter | component |  | `@elabs-ai/components-ui` |  |
| DialogHeader | component |  | `@elabs-ai/components-ui` |  |
| DialogOverlay | component |  | `@elabs-ai/components-ui` |  |
| DialogPortal | component |  | `@elabs-ai/components-ui` |  |
| DialogSection | component |  | `@elabs-ai/components-ui` |  |
| DialogTitle | component |  | `@elabs-ai/components-ui` |  |
| DialogTrigger | component |  | `@elabs-ai/components-ui` |  |
| DOCUMENT_ADDRESS_KINDS | component |  | `@elabs-ai/components-ui` |  |
| Drawer | component |  | `@elabs-ai/components-ui` |  |
| DrawerClose | component |  | `@elabs-ai/components-ui` |  |
| DrawerContent | component |  | `@elabs-ai/components-ui` |  |
| DrawerDescription | component |  | `@elabs-ai/components-ui` |  |
| DrawerFooter | component |  | `@elabs-ai/components-ui` |  |
| DrawerHeader | component |  | `@elabs-ai/components-ui` |  |
| DrawerPortal | component |  | `@elabs-ai/components-ui` |  |
| DrawerTitle | component |  | `@elabs-ai/components-ui` |  |
| DrawerTrigger | component |  | `@elabs-ai/components-ui` |  |
| DropdownMenu | component |  | `@elabs-ai/components-ui` |  |
| DropdownMenuCheckboxItem | component |  | `@elabs-ai/components-ui` |  |
| DropdownMenuContent | component |  | `@elabs-ai/components-ui` |  |
| DropdownMenuGroup | component |  | `@elabs-ai/components-ui` |  |
| DropdownMenuItem | component |  | `@elabs-ai/components-ui` |  |
| DropdownMenuLabel | component |  | `@elabs-ai/components-ui` |  |
| DropdownMenuPortal | component |  | `@elabs-ai/components-ui` |  |
| DropdownMenuRadioGroup | component |  | `@elabs-ai/components-ui` |  |
| DropdownMenuRadioItem | component |  | `@elabs-ai/components-ui` |  |
| DropdownMenuSeparator | component |  | `@elabs-ai/components-ui` |  |
| DropdownMenuShortcut | component |  | `@elabs-ai/components-ui` |  |
| DropdownMenuSub | component |  | `@elabs-ai/components-ui` |  |
| DropdownMenuSubContent | component |  | `@elabs-ai/components-ui` |  |
| DropdownMenuSubTrigger | component |  | `@elabs-ai/components-ui` |  |
| DropdownMenuTrigger | component |  | `@elabs-ai/components-ui` |  |
| EmptyState | component |  | `@elabs-ai/components-ui` |  |
| ErrorState | component |  | `@elabs-ai/components-ui` |  |
| ExpandDialog | component |  | `@elabs-ai/components-ui` |  |
| ExpandDialogContent | component |  | `@elabs-ai/components-ui` |  |
| ExpandDialogHeader | component |  | `@elabs-ai/components-ui` |  |
| ExpandDialogPanes | component | detailPlacement=side*\|bottom · stackBelow=never*\|sm\|md\|lg | `@elabs-ai/components-ui` |  |
| FieldRow | component |  | `@elabs-ai/components-ui` |  |
| FILE_CATEGORY_ICONS | component |  | `@elabs-ai/components-ui` |  |
| FileUpload | component |  | `@elabs-ai/components-ui` |  |
| FileUploadDropzone | component |  | `@elabs-ai/components-ui` |  |
| FileUploadItem | component |  | `@elabs-ai/components-ui` |  |
| FileUploadList | component |  | `@elabs-ai/components-ui` |  |
| FilterChip | component |  | `@elabs-ai/components-ui` |  |
| Form | component |  | `@elabs-ai/components-ui` | Validated form scaffold (Field/Label/Control/Message) wiring inputs to a schema. |
| FormControl | component |  | `@elabs-ai/components-ui` |  |
| FormDescription | component |  | `@elabs-ai/components-ui` |  |
| FormField | component |  | `@elabs-ai/components-ui` |  |
| FormItem | component |  | `@elabs-ai/components-ui` |  |
| FormLabel | component |  | `@elabs-ai/components-ui` |  |
| FormMessage | component |  | `@elabs-ai/components-ui` |  |
| Heading | component | size=display\|title*\|subtitle | `@elabs-ai/components-ui` |  |
| HoverCard | component |  | `@elabs-ai/components-ui` |  |
| HoverCardContent | component |  | `@elabs-ai/components-ui` |  |
| HoverCardTrigger | component |  | `@elabs-ai/components-ui` |  |
| IconButton | component |  | `@elabs-ai/components-ui` |  |
| Input | component |  | `@elabs-ai/components-ui` | Single-line text field — the base form input. |
| InputGroup | component | variant=outline*\|surface\|card | `@elabs-ai/components-ui` |  |
| InputGroupAddon | component | align=inline-start*\|inline-end\|block-start\|block-end | `@elabs-ai/components-ui` |  |
| InputGroupButton | component |  | `@elabs-ai/components-ui` |  |
| InputGroupInput | component |  | `@elabs-ai/components-ui` |  |
| InputGroupText | component |  | `@elabs-ai/components-ui` |  |
| InputGroupTextarea | component |  | `@elabs-ai/components-ui` |  |
| InputOTP | component |  | `@elabs-ai/components-ui` |  |
| InputOTPGroup | component |  | `@elabs-ai/components-ui` |  |
| InputOTPSeparator | component |  | `@elabs-ai/components-ui` |  |
| InputOTPSlot | component |  | `@elabs-ai/components-ui` |  |
| Kbd | component |  | `@elabs-ai/components-ui` |  |
| KeyValueEditor | component |  | `@elabs-ai/components-ui` |  |
| Label | component |  | `@elabs-ai/components-ui` |  |
| LinkPreview | component |  | `@elabs-ai/components-ui` |  |
| LinkPreviewCard | component |  | `@elabs-ai/components-ui` |  |
| ListEditor | component |  | `@elabs-ai/components-ui` |  |
| LoadingState | component |  | `@elabs-ai/components-ui` |  |
| LocaleProvider | component |  | `@elabs-ai/components-ui` |  |
| MatchHighlight | component |  | `@elabs-ai/components-ui` |  |
| MentionInput | component |  | `@elabs-ai/components-ui` |  |
| MentionInputContent | component |  | `@elabs-ai/components-ui` |  |
| MentionInputEmpty | component |  | `@elabs-ai/components-ui` |  |
| MentionInputItem | component |  | `@elabs-ai/components-ui` |  |
| MentionInputList | component |  | `@elabs-ai/components-ui` |  |
| MentionInputTextarea | component |  | `@elabs-ai/components-ui` |  |
| Menubar | component |  | `@elabs-ai/components-ui` |  |
| MenubarCheckboxItem | component |  | `@elabs-ai/components-ui` |  |
| MenubarContent | component |  | `@elabs-ai/components-ui` |  |
| MenubarGroup | component |  | `@elabs-ai/components-ui` |  |
| MenubarItem | component |  | `@elabs-ai/components-ui` |  |
| MenubarMenu | component |  | `@elabs-ai/components-ui` |  |
| MenubarPortal | component |  | `@elabs-ai/components-ui` |  |
| MenubarRadioGroup | component |  | `@elabs-ai/components-ui` |  |
| MenubarRadioItem | component |  | `@elabs-ai/components-ui` |  |
| MenubarSeparator | component |  | `@elabs-ai/components-ui` |  |
| MenubarShortcut | component |  | `@elabs-ai/components-ui` |  |
| MenubarSub | component |  | `@elabs-ai/components-ui` |  |
| MenubarSubContent | component |  | `@elabs-ai/components-ui` |  |
| MenubarSubTrigger | component |  | `@elabs-ai/components-ui` |  |
| MenubarTrigger | component |  | `@elabs-ai/components-ui` |  |
| MetricCard | component |  | `@elabs-ai/components-ui` | Single KPI tile — label, value, delta/trend. |
| ModelPicker | component |  | `@elabs-ai/components-ui` |  |
| NavigationMenu | component |  | `@elabs-ai/components-ui` |  |
| NavigationMenuContent | component |  | `@elabs-ai/components-ui` |  |
| NavigationMenuItem | component |  | `@elabs-ai/components-ui` |  |
| NavigationMenuLink | component |  | `@elabs-ai/components-ui` |  |
| NavigationMenuList | component |  | `@elabs-ai/components-ui` |  |
| NavigationMenuTrigger | component |  | `@elabs-ai/components-ui` |  |
| NavigationMenuViewport | component |  | `@elabs-ai/components-ui` |  |
| NavMain | component |  | `@elabs-ai/components-ui` |  |
| NavNotifications | component |  | `@elabs-ai/components-ui` |  |
| NavUser | component |  | `@elabs-ai/components-ui` |  |
| NumberInput | component |  | `@elabs-ai/components-ui` |  |
| PageShell | component |  | `@elabs-ai/components-ui` |  |
| Pagination | component |  | `@elabs-ai/components-ui` |  |
| PaginationContent | component |  | `@elabs-ai/components-ui` |  |
| PaginationEllipsis | component |  | `@elabs-ai/components-ui` |  |
| PaginationItem | component |  | `@elabs-ai/components-ui` |  |
| PaginationLink | component |  | `@elabs-ai/components-ui` |  |
| PaginationNext | component |  | `@elabs-ai/components-ui` |  |
| PaginationPrevious | component |  | `@elabs-ai/components-ui` |  |
| Popover | component |  | `@elabs-ai/components-ui` | Anchored, dismissible floating panel for lightweight contextual content. |
| PopoverAnchor | component |  | `@elabs-ai/components-ui` |  |
| PopoverContent | component |  | `@elabs-ai/components-ui` |  |
| PopoverTrigger | component |  | `@elabs-ai/components-ui` |  |
| Progress | component |  | `@elabs-ai/components-ui` |  |
| PROSE_HEADING_REM | component |  | `@elabs-ai/components-ui` |  |
| PROSE_HEADING_TRACKING | component |  | `@elabs-ai/components-ui` |  |
| PROSE_HEADING_WEIGHT | component |  | `@elabs-ai/components-ui` |  |
| ProseBlockquote | component |  | `@elabs-ai/components-ui` |  |
| ProseHeading | component |  | `@elabs-ai/components-ui` |  |
| ProseInlineCode | component |  | `@elabs-ai/components-ui` |  |
| ProseLink | component |  | `@elabs-ai/components-ui` |  |
| ProseList | component |  | `@elabs-ai/components-ui` |  |
| ProseListItem | component |  | `@elabs-ai/components-ui` |  |
| ProseText | component |  | `@elabs-ai/components-ui` |  |
| RadioGroup | component |  | `@elabs-ai/components-ui` | Mutually-exclusive single choice from a small visible set. |
| RadioGroupItem | component |  | `@elabs-ai/components-ui` |  |
| Rating | component |  | `@elabs-ai/components-ui` |  |
| ResizableHandle | component |  | `@elabs-ai/components-ui` |  |
| ResizablePanel | component |  | `@elabs-ai/components-ui` |  |
| ResizablePanelGroup | component |  | `@elabs-ai/components-ui` |  |
| ResultCount | component |  | `@elabs-ai/components-ui` |  |
| Reveal | component | appear=fade\|up*\|down\|left\|right\|zoom · speed=fast\|base\|slow* | `@elabs-ai/components-ui` |  |
| RevealGroup | component |  | `@elabs-ai/components-ui` |  |
| RevisionTimeline | component | density=comfortable*\|compact | `@elabs-ai/components-ui` |  |
| ScrollArea | component |  | `@elabs-ai/components-ui` |  |
| ScrollBar | component |  | `@elabs-ai/components-ui` |  |
| SectionHeader | component |  | `@elabs-ai/components-ui` |  |
| SegmentedField | component |  | `@elabs-ai/components-ui` |  |
| Select | component |  | `@elabs-ai/components-ui` | Single-choice dropdown from a known set of options. |
| SelectContent | component |  | `@elabs-ai/components-ui` |  |
| SelectGroup | component |  | `@elabs-ai/components-ui` |  |
| SelectItem | component |  | `@elabs-ai/components-ui` |  |
| SelectLabel | component |  | `@elabs-ai/components-ui` |  |
| SelectSeparator | component |  | `@elabs-ai/components-ui` |  |
| SelectTrigger | component |  | `@elabs-ai/components-ui` |  |
| SelectValue | component |  | `@elabs-ai/components-ui` |  |
| Separator | component |  | `@elabs-ai/components-ui` |  |
| Sheet | component |  | `@elabs-ai/components-ui` | Edge-anchored panel (left/right/top/bottom) for secondary flows beside the page. |
| SheetClose | component |  | `@elabs-ai/components-ui` |  |
| SheetContent | component |  | `@elabs-ai/components-ui` |  |
| SheetDescription | component |  | `@elabs-ai/components-ui` |  |
| SheetFooter | component |  | `@elabs-ai/components-ui` |  |
| SheetHeader | component |  | `@elabs-ai/components-ui` |  |
| SheetPortal | component |  | `@elabs-ai/components-ui` |  |
| SheetTitle | component |  | `@elabs-ai/components-ui` |  |
| SheetTrigger | component |  | `@elabs-ai/components-ui` |  |
| Sidebar | component |  | `@elabs-ai/components-ui` |  |
| SidebarContent | component |  | `@elabs-ai/components-ui` |  |
| SidebarFooter | component |  | `@elabs-ai/components-ui` |  |
| SidebarGroup | component |  | `@elabs-ai/components-ui` |  |
| SidebarGroupAction | component |  | `@elabs-ai/components-ui` |  |
| SidebarGroupContent | component |  | `@elabs-ai/components-ui` |  |
| SidebarGroupLabel | component |  | `@elabs-ai/components-ui` |  |
| SidebarHeader | component |  | `@elabs-ai/components-ui` |  |
| SidebarInput | component |  | `@elabs-ai/components-ui` |  |
| SidebarInset | component |  | `@elabs-ai/components-ui` |  |
| SidebarMenu | component |  | `@elabs-ai/components-ui` |  |
| SidebarMenuAction | component |  | `@elabs-ai/components-ui` |  |
| SidebarMenuBadge | component |  | `@elabs-ai/components-ui` |  |
| SidebarMenuButton | component | variant=default*\|outline · size=default*\|sm\|lg | `@elabs-ai/components-ui` |  |
| SidebarMenuItem | component |  | `@elabs-ai/components-ui` |  |
| SidebarMenuSkeleton | component |  | `@elabs-ai/components-ui` |  |
| SidebarMenuSub | component |  | `@elabs-ai/components-ui` |  |
| SidebarMenuSubButton | component |  | `@elabs-ai/components-ui` |  |
| SidebarMenuSubItem | component |  | `@elabs-ai/components-ui` |  |
| SidebarProvider | component |  | `@elabs-ai/components-ui` |  |
| SidebarRail | component |  | `@elabs-ai/components-ui` |  |
| SidebarSeparator | component |  | `@elabs-ai/components-ui` |  |
| SidebarTrigger | component |  | `@elabs-ai/components-ui` |  |
| Skeleton | component |  | `@elabs-ai/components-ui` |  |
| Slider | component |  | `@elabs-ai/components-ui` |  |
| SliderNumber | component |  | `@elabs-ai/components-ui` |  |
| Spinner | component |  | `@elabs-ai/components-ui` |  |
| SplitPanel | component |  | `@elabs-ai/components-ui` |  |
| StatePanel | component | kind=empty*\|error\|loading | `@elabs-ai/components-ui` |  |
| STATUS_LABELS | component |  | `@elabs-ai/components-ui` |  |
| STATUS_ROLE | component |  | `@elabs-ai/components-ui` |  |
| STATUS_TONE_ICONS | component |  | `@elabs-ai/components-ui` |  |
| STATUS_TONES | component |  | `@elabs-ai/components-ui` |  |
| StatusBadge | component | status=pending\|running\|complete\|awaiting-approval\|denied\|failed\|skipped · tone=neutral\|info\|success\|warning\|destructive · size=sm\|md* | `@elabs-ai/components-ui` |  |
| STATUSES | component |  | `@elabs-ai/components-ui` |  |
| StatusIcon | component |  | `@elabs-ai/components-ui` |  |
| STREAMDOWN_TRANSLATION_KEYS | component |  | `@elabs-ai/components-ui` |  |
| Switch | component |  | `@elabs-ai/components-ui` | Immediate on/off setting toggle (applies on change, not on submit). |
| Table | component |  | `@elabs-ai/components-ui` |  |
| TableBody | component |  | `@elabs-ai/components-ui` |  |
| TableCaption | component |  | `@elabs-ai/components-ui` |  |
| TableCell | component |  | `@elabs-ai/components-ui` |  |
| TableFooter | component |  | `@elabs-ai/components-ui` |  |
| TableHead | component |  | `@elabs-ai/components-ui` |  |
| TableHeader | component |  | `@elabs-ai/components-ui` |  |
| TableRow | component |  | `@elabs-ai/components-ui` |  |
| Tabs | component |  | `@elabs-ai/components-ui` | Switch between peer views in the same context without navigating away. |
| TabsContent | component |  | `@elabs-ai/components-ui` |  |
| TabsList | component |  | `@elabs-ai/components-ui` |  |
| TabsTrigger | component |  | `@elabs-ai/components-ui` |  |
| TagInput | component |  | `@elabs-ai/components-ui` |  |
| TeamSwitcher | component |  | `@elabs-ai/components-ui` |  |
| Text | component | variant=lead\|body*\|caption\|meta\|kpi\|code · tone=default*\|muted\|primary | `@elabs-ai/components-ui` |  |
| TEXT_ROLE_REM | component |  | `@elabs-ai/components-ui` |  |
| Textarea | component |  | `@elabs-ai/components-ui` |  |
| ThemeSwitcher | component |  | `@elabs-ai/components-ui` |  |
| Timeline | component |  | `@elabs-ai/components-ui` |  |
| TimelineItem | component |  | `@elabs-ai/components-ui` |  |
| TimelineRoot | component |  | `@elabs-ai/components-ui` |  |
| Toaster | component |  | `@elabs-ai/components-ui` |  |
| Toggle | component | variant=default*\|outline\|segmented · size=default*\|sm\|lg | `@elabs-ai/components-ui` |  |
| ToggleGroup | component |  | `@elabs-ai/components-ui` |  |
| ToggleGroupItem | component |  | `@elabs-ai/components-ui` |  |
| Toolbar | component | orientation=horizontal*\|vertical | `@elabs-ai/components-ui` | A dense row of controls that acts on nearby content, collapsed into ONE tab stop with arrow-key navigation between the controls. |
| ToolbarButton | component |  | `@elabs-ai/components-ui` |  |
| ToolbarSeparator | component |  | `@elabs-ai/components-ui` |  |
| ToolbarSlot | component |  | `@elabs-ai/components-ui` |  |
| ToolbarToggleGroup | component |  | `@elabs-ai/components-ui` |  |
| ToolbarToggleItem | component |  | `@elabs-ai/components-ui` |  |
| Tooltip | component |  | `@elabs-ai/components-ui` | Transient hover/focus hint with supplementary (non-essential) text. |
| TooltipContent | component |  | `@elabs-ai/components-ui` |  |
| TooltipProvider | component |  | `@elabs-ai/components-ui` |  |
| TooltipTrigger | component |  | `@elabs-ai/components-ui` |  |
| TopNav | component |  | `@elabs-ai/components-ui` |  |
| Transfer | component |  | `@elabs-ai/components-ui` |  |
| Tree | component |  | `@elabs-ai/components-ui` |  |
| TreeSelect | component |  | `@elabs-ai/components-ui` |  |
| useCollapsiblePanel | hook |  | `@elabs-ai/components-ui` |  |
| useCommandActiveItemId | hook |  | `@elabs-ai/components-ui` |  |
| useCopyToClipboard | hook |  | `@elabs-ai/components-ui` |  |
| useDialogDismissGuard | hook |  | `@elabs-ai/components-ui` |  |
| useFileUpload | hook |  | `@elabs-ai/components-ui` |  |
| useFormField | hook |  | `@elabs-ai/components-ui` |  |
| useIsMobile | hook |  | `@elabs-ai/components-ui` |  |
| useLocale | hook |  | `@elabs-ai/components-ui` |  |
| useMentionInput | hook |  | `@elabs-ai/components-ui` |  |
| useSidebar | hook |  | `@elabs-ai/components-ui` |  |
| useStreamdownTranslations | hook |  | `@elabs-ai/components-ui` |  |
| useThemeTransition | hook |  | `@elabs-ai/components-ui` |  |
| useTreeKeyboard | hook |  | `@elabs-ai/components-ui` |  |
| useVirtualListbox | hook |  | `@elabs-ai/components-ui` |  |
| ViewToolbar | component |  | `@elabs-ai/components-ui` |  |
| ViewToolbarFilters | component |  | `@elabs-ai/components-ui` |  |
| VirtualSelect | component |  | `@elabs-ai/components-ui` |  |
| Wizard | component |  | `@elabs-ai/components-ui` |  |
| WizardNav | component |  | `@elabs-ai/components-ui` |  |
| WizardStep | component |  | `@elabs-ai/components-ui` |  |
| WizardSteps | component |  | `@elabs-ai/components-ui` |  |

## @elabs-ai/components-data

> TanStack DataTable, FilterBar, SearchInput, FacetFilter, ColumnPicker.

| Name | Kind | Variants | Import | Notes |
| --- | --- | --- | --- | --- |
| ColumnPicker | component |  | `@elabs-ai/components-data` |  |
| DataTable | component |  | `@elabs-ai/components-data` | TanStack-backed data grid with sorting, filtering, pagination and a render-prop toolbar. |
| FacetFilter | component |  | `@elabs-ai/components-data` |  |
| FilterBar | component |  | `@elabs-ai/components-data` |  |
| SearchInput | component |  | `@elabs-ai/components-data` | Controlled search box that drives a DataTable's global filter. |

## @elabs-ai/components-ai

> ChatShell, Conversation, Message, PromptInput, Tool, Reasoning, citations.

| Name | Kind | Variants | Import | Notes |
| --- | --- | --- | --- | --- |
| Agent | component |  | `@elabs-ai/components-ai` | Accordion-shaped disclosure describing a sub-agent: its instructions, tools and output. |
| AgentContent | component |  | `@elabs-ai/components-ai` |  |
| AgentHeader | component |  | `@elabs-ai/components-ai` |  |
| AgentInstructions | component |  | `@elabs-ai/components-ai` |  |
| AgentMessage | component | emphasis=default*\|answer | `@elabs-ai/components-ai` |  |
| AgentOutput | component |  | `@elabs-ai/components-ai` |  |
| AgentStep | component |  | `@elabs-ai/components-ai` |  |
| AgentTimeline | component |  | `@elabs-ai/components-ai` | Chronological rail of agent steps and checkpoints — what the agent did, in order. |
| AgentTool | component |  | `@elabs-ai/components-ai` |  |
| AgentTools | component |  | `@elabs-ai/components-ai` |  |
| ApprovalCard | component |  | `@elabs-ai/components-ai` | The named human-in-the-loop variant of Confirmation — a titled, described approve/deny card. |
| ApprovalCardAccepted | component |  | `@elabs-ai/components-ai` |  |
| ApprovalCardAction | component |  | `@elabs-ai/components-ai` |  |
| ApprovalCardActions | component |  | `@elabs-ai/components-ai` |  |
| ApprovalCardApprove | component |  | `@elabs-ai/components-ai` |  |
| ApprovalCardDeny | component |  | `@elabs-ai/components-ai` |  |
| ApprovalCardDescription | component |  | `@elabs-ai/components-ai` |  |
| ApprovalCardRejected | component |  | `@elabs-ai/components-ai` |  |
| ApprovalCardRequest | component |  | `@elabs-ai/components-ai` |  |
| ApprovalCardTitle | component |  | `@elabs-ai/components-ai` |  |
| Artifact | component |  | `@elabs-ai/components-ai` | Panel surface for a durable object the agent produced (document, code, preview) with title, description and actions. |
| ArtifactAction | component |  | `@elabs-ai/components-ai` |  |
| ArtifactActions | component |  | `@elabs-ai/components-ai` |  |
| ArtifactClose | component |  | `@elabs-ai/components-ai` |  |
| ArtifactContent | component |  | `@elabs-ai/components-ai` |  |
| ArtifactDescription | component |  | `@elabs-ai/components-ai` |  |
| ArtifactHeader | component |  | `@elabs-ai/components-ai` |  |
| ArtifactTitle | component |  | `@elabs-ai/components-ai` |  |
| AssetPreview | component |  | `@elabs-ai/components-ai` | Type-keyed preview of ONE produced asset — markdown/code/sql/csv/image — inside the Artifact chrome. |
| Attachment | component |  | `@elabs-ai/components-ai` | One user-supplied file/source chip — media-category icon, preview, hover details and a remove affordance. |
| AttachmentEmpty | component |  | `@elabs-ai/components-ai` |  |
| AttachmentHoverCard | component |  | `@elabs-ai/components-ai` |  |
| AttachmentHoverCardContent | component |  | `@elabs-ai/components-ai` |  |
| AttachmentHoverCardTrigger | component |  | `@elabs-ai/components-ai` |  |
| AttachmentInfo | component |  | `@elabs-ai/components-ai` |  |
| AttachmentPreview | component |  | `@elabs-ai/components-ai` |  |
| AttachmentRemove | component |  | `@elabs-ai/components-ai` |  |
| Attachments | component |  | `@elabs-ai/components-ai` |  |
| AudioPlayer | component |  | `@elabs-ai/components-ai` | Themed audio transport for generated/recorded speech, built on media-chrome's MediaController. |
| AudioPlayerControlBar | component |  | `@elabs-ai/components-ai` |  |
| AudioPlayerDurationDisplay | component |  | `@elabs-ai/components-ai` |  |
| AudioPlayerElement | component |  | `@elabs-ai/components-ai` |  |
| AudioPlayerMuteButton | component |  | `@elabs-ai/components-ai` |  |
| AudioPlayerPlayButton | component |  | `@elabs-ai/components-ai` |  |
| AudioPlayerSeekBackwardButton | component |  | `@elabs-ai/components-ai` |  |
| AudioPlayerSeekForwardButton | component |  | `@elabs-ai/components-ai` |  |
| AudioPlayerTimeDisplay | component |  | `@elabs-ai/components-ai` |  |
| AudioPlayerTimeRange | component |  | `@elabs-ai/components-ai` |  |
| AudioPlayerVolumeRange | component |  | `@elabs-ai/components-ai` |  |
| BrandMotionConfig | component |  | `@elabs-ai/components-ai` | Feeds descendant Motion components the brand transition (duration/ease mirrored from the motion tokens). |
| Canvas | component |  | `@elabs-ai/components-ai` | The in-chat agent workspace graph surface (React Flow) — the canvas an agent renders inside a conversation (ADR 0018). |
| ChainOfThought | component |  | `@elabs-ai/components-ai` | Step-by-step live reasoning trace with per-step status and search results. |
| ChainOfThoughtContent | component |  | `@elabs-ai/components-ai` |  |
| ChainOfThoughtHeader | component |  | `@elabs-ai/components-ai` |  |
| ChainOfThoughtImage | component |  | `@elabs-ai/components-ai` |  |
| ChainOfThoughtSearchResult | component |  | `@elabs-ai/components-ai` |  |
| ChainOfThoughtSearchResults | component |  | `@elabs-ai/components-ai` |  |
| ChainOfThoughtStep | component |  | `@elabs-ai/components-ai` |  |
| ChatGreeting | component |  | `@elabs-ai/components-ai` | The centered, display-scale first-run greeting for an empty chat scene — a headline, not a status message. |
| ChatShell | component |  | `@elabs-ai/components-ai` | Assistant/chat application frame composing the conversation + composer surfaces. |
| Checkpoint | component |  | `@elabs-ai/components-ai` | A restore-point divider in a transcript — a labelled rule the user can jump back to. |
| CheckpointIcon | component |  | `@elabs-ai/components-ai` |  |
| CheckpointTrigger | component |  | `@elabs-ai/components-ai` |  |
| CodeBlock | component |  | `@elabs-ai/components-ai` | Shiki-highlighted code block with a copy button, filename and language selector. |
| CodeBlockActions | component |  | `@elabs-ai/components-ai` |  |
| CodeBlockContainer | component |  | `@elabs-ai/components-ai` |  |
| CodeBlockContent | component |  | `@elabs-ai/components-ai` |  |
| CodeBlockCopyButton | component |  | `@elabs-ai/components-ai` |  |
| CodeBlockFilename | component |  | `@elabs-ai/components-ai` |  |
| CodeBlockHeader | component |  | `@elabs-ai/components-ai` |  |
| CodeBlockLanguageSelector | component |  | `@elabs-ai/components-ai` |  |
| CodeBlockLanguageSelectorContent | component |  | `@elabs-ai/components-ai` |  |
| CodeBlockLanguageSelectorItem | component |  | `@elabs-ai/components-ai` |  |
| CodeBlockLanguageSelectorTrigger | component |  | `@elabs-ai/components-ai` |  |
| CodeBlockLanguageSelectorValue | component |  | `@elabs-ai/components-ai` |  |
| CodeBlockTitle | component |  | `@elabs-ai/components-ai` |  |
| Commit | component |  | `@elabs-ai/components-ai` | A version-control commit rendered in chat — hash, author, message and changed files. |
| CommitActions | component |  | `@elabs-ai/components-ai` |  |
| CommitAuthor | component |  | `@elabs-ai/components-ai` |  |
| CommitAuthorAvatar | component |  | `@elabs-ai/components-ai` |  |
| CommitContent | component |  | `@elabs-ai/components-ai` |  |
| CommitCopyButton | component |  | `@elabs-ai/components-ai` |  |
| CommitFile | component |  | `@elabs-ai/components-ai` |  |
| CommitFileAdditions | component |  | `@elabs-ai/components-ai` |  |
| CommitFileChanges | component |  | `@elabs-ai/components-ai` |  |
| CommitFileDeletions | component |  | `@elabs-ai/components-ai` |  |
| CommitFileIcon | component |  | `@elabs-ai/components-ai` |  |
| CommitFileInfo | component |  | `@elabs-ai/components-ai` |  |
| CommitFilePath | component |  | `@elabs-ai/components-ai` |  |
| CommitFiles | component |  | `@elabs-ai/components-ai` |  |
| CommitFileStatus | component |  | `@elabs-ai/components-ai` |  |
| CommitHash | component |  | `@elabs-ai/components-ai` |  |
| CommitHeader | component |  | `@elabs-ai/components-ai` |  |
| CommitInfo | component |  | `@elabs-ai/components-ai` |  |
| CommitMessage | component |  | `@elabs-ai/components-ai` |  |
| CommitMetadata | component |  | `@elabs-ai/components-ai` |  |
| CommitSeparator | component |  | `@elabs-ai/components-ai` |  |
| CommitTimestamp | component |  | `@elabs-ai/components-ai` |  |
| Composer | component |  | `@elabs-ai/components-ai` | The standard chat input — a PromptInput pre-assembled with attachments, tools and submit. |
| Confirmation | component |  | `@elabs-ai/components-ai` | In-conversation approve/deny request for an action the agent wants a human to authorize. |
| ConfirmationAccepted | component |  | `@elabs-ai/components-ai` |  |
| ConfirmationAction | component |  | `@elabs-ai/components-ai` |  |
| ConfirmationActions | component |  | `@elabs-ai/components-ai` |  |
| ConfirmationApprove | component |  | `@elabs-ai/components-ai` |  |
| ConfirmationDeny | component |  | `@elabs-ai/components-ai` |  |
| ConfirmationDescription | component |  | `@elabs-ai/components-ai` |  |
| ConfirmationRejected | component |  | `@elabs-ai/components-ai` |  |
| ConfirmationRequest | component |  | `@elabs-ai/components-ai` |  |
| ConfirmationTitle | component |  | `@elabs-ai/components-ai` |  |
| Connection | component |  | `@elabs-ai/components-ai` | The in-flight connection line drawn while the user drags a new edge on the Canvas. |
| Context | component |  | `@elabs-ai/components-ai` | Context-window usage readout for a model turn — used vs max tokens, with a hover breakdown. |
| ContextCacheUsage | component |  | `@elabs-ai/components-ai` |  |
| ContextContent | component |  | `@elabs-ai/components-ai` |  |
| ContextContentBody | component |  | `@elabs-ai/components-ai` |  |
| ContextContentFooter | component |  | `@elabs-ai/components-ai` |  |
| ContextContentHeader | component |  | `@elabs-ai/components-ai` |  |
| ContextInputUsage | component |  | `@elabs-ai/components-ai` |  |
| ContextOutputUsage | component |  | `@elabs-ai/components-ai` |  |
| ContextPanel | component |  | `@elabs-ai/components-ai` | The chat workspace's right context rail — sources, produced assets and a root↔detail drill-in. |
| ContextPanelBody | component |  | `@elabs-ai/components-ai` |  |
| ContextPanelDetail | component |  | `@elabs-ai/components-ai` |  |
| ContextPanelHeader | component |  | `@elabs-ai/components-ai` |  |
| ContextPanelProvider | component |  | `@elabs-ai/components-ai` |  |
| ContextPanelSection | component |  | `@elabs-ai/components-ai` |  |
| ContextPanelTrigger | component |  | `@elabs-ai/components-ai` |  |
| ContextReasoningUsage | component |  | `@elabs-ai/components-ai` |  |
| ContextTrigger | component |  | `@elabs-ai/components-ai` |  |
| Controls | component |  | `@elabs-ai/components-ai` | Zoom / fit / lock controls for the agent workspace Canvas. |
| Conversation | component |  | `@elabs-ai/components-ai` | Auto-stick-to-bottom chat transcript region. |
| ConversationContent | component |  | `@elabs-ai/components-ai` |  |
| ConversationDownload | component |  | `@elabs-ai/components-ai` |  |
| ConversationEmptyState | component |  | `@elabs-ai/components-ai` |  |
| ConversationScrollButton | component |  | `@elabs-ai/components-ai` |  |
| Edge | component |  | `@elabs-ai/components-ai` | A connection between two workspace-graph nodes — animated/temporary or committed. |
| EMPTY_CELL | component |  | `@elabs-ai/components-ai` |  |
| EnvironmentVariable | component |  | `@elabs-ai/components-ai` | One environment variable row — name, masked value, required flag and copy. |
| EnvironmentVariableCopyButton | component |  | `@elabs-ai/components-ai` |  |
| EnvironmentVariableGroup | component |  | `@elabs-ai/components-ai` |  |
| EnvironmentVariableName | component |  | `@elabs-ai/components-ai` |  |
| EnvironmentVariableRequired | component |  | `@elabs-ai/components-ai` |  |
| EnvironmentVariables | component |  | `@elabs-ai/components-ai` |  |
| EnvironmentVariablesContent | component |  | `@elabs-ai/components-ai` |  |
| EnvironmentVariablesHeader | component |  | `@elabs-ai/components-ai` |  |
| EnvironmentVariablesTitle | component |  | `@elabs-ai/components-ai` |  |
| EnvironmentVariablesToggle | component |  | `@elabs-ai/components-ai` |  |
| EnvironmentVariableValue | component |  | `@elabs-ai/components-ai` |  |
| EvidenceChip | component |  | `@elabs-ai/components-ai` |  |
| FileTree | component |  | `@elabs-ai/components-ai` | Hierarchical file/folder list for a workspace — `code` (IDE source tree) or `document` (produced assets) look. |
| FileTreeActions | component |  | `@elabs-ai/components-ai` |  |
| FileTreeFile | component |  | `@elabs-ai/components-ai` |  |
| FileTreeFolder | component |  | `@elabs-ai/components-ai` |  |
| FileTreeIcon | component |  | `@elabs-ai/components-ai` |  |
| FileTreeName | component |  | `@elabs-ai/components-ai` |  |
| Gallery | component |  | `@elabs-ai/components-ai` | Image/asset grid with a +N overflow tile that opens a lightbox Dialog (carousel + metadata). |
| GroupedParts | component |  | `@elabs-ai/components-ai` | Renders an ordered message part list, folding adjacent reasoning/tool parts into collapsible traces. |
| Image | component |  | `@elabs-ai/components-ai` | Renders a model-generated image from its base64 payload. |
| InlineCitation | component |  | `@elabs-ai/components-ai` | Inline source marker whose hover card carries the quote and the source carousel. |
| InlineCitationCard | component |  | `@elabs-ai/components-ai` |  |
| InlineCitationCardBody | component |  | `@elabs-ai/components-ai` |  |
| InlineCitationCardTrigger | component |  | `@elabs-ai/components-ai` |  |
| InlineCitationCarousel | component |  | `@elabs-ai/components-ai` |  |
| InlineCitationCarouselContent | component |  | `@elabs-ai/components-ai` |  |
| InlineCitationCarouselHeader | component |  | `@elabs-ai/components-ai` |  |
| InlineCitationCarouselIndex | component |  | `@elabs-ai/components-ai` |  |
| InlineCitationCarouselItem | component |  | `@elabs-ai/components-ai` |  |
| InlineCitationCarouselNext | component |  | `@elabs-ai/components-ai` |  |
| InlineCitationCarouselPrev | component |  | `@elabs-ai/components-ai` |  |
| InlineCitationQuote | component |  | `@elabs-ai/components-ai` |  |
| InlineCitationSource | component |  | `@elabs-ai/components-ai` |  |
| InlineCitationText | component |  | `@elabs-ai/components-ai` |  |
| InteractiveTerminal | component |  | `@elabs-ai/components-ai` | Streaming terminal surface for agent shell output, with an optional input line. |
| JSXPreview | component |  | `@elabs-ai/components-ai` | Escape-hatch renderer for agent-emitted JSX STRINGS — maximum flexibility, least safety (D2). |
| JSXPreviewContent | component |  | `@elabs-ai/components-ai` |  |
| JSXPreviewError | component |  | `@elabs-ai/components-ai` |  |
| JSXPreviewSkeleton | component |  | `@elabs-ai/components-ai` |  |
| LocalReferencedSourcesContext | component |  | `@elabs-ai/components-ai` |  |
| MarkdownView | component |  | `@elabs-ai/components-ai` | Branded, read-only renderer for a produced markdown document (not a code view). |
| Message | component |  | `@elabs-ai/components-ai` | One conversation turn — `from` decides the side, fill and slot; wraps the turn's content. |
| MessageAction | component |  | `@elabs-ai/components-ai` |  |
| MessageActions | component | appearance=plain*\|bar · reveal=always*\|hover | `@elabs-ai/components-ai` |  |
| MessageAvatar | component |  | `@elabs-ai/components-ai` |  |
| MessageBranch | component |  | `@elabs-ai/components-ai` |  |
| MessageBranchContent | component |  | `@elabs-ai/components-ai` |  |
| MessageBranchNext | component |  | `@elabs-ai/components-ai` |  |
| MessageBranchPage | component |  | `@elabs-ai/components-ai` |  |
| MessageBranchPrevious | component |  | `@elabs-ai/components-ai` |  |
| MessageBranchSelector | component |  | `@elabs-ai/components-ai` |  |
| MessageCompare | component |  | `@elabs-ai/components-ai` |  |
| MessageCompareColumn | component |  | `@elabs-ai/components-ai` |  |
| MessageCompareProvider | component |  | `@elabs-ai/components-ai` |  |
| MessageContent | component |  | `@elabs-ai/components-ai` |  |
| MessageEdit | component |  | `@elabs-ai/components-ai` | Edit-in-place for a user message — swaps the bubble between content and an editor. |
| MessageEditContent | component |  | `@elabs-ai/components-ai` |  |
| MessageEditForm | component |  | `@elabs-ai/components-ai` |  |
| MessageEditProvider | component |  | `@elabs-ai/components-ai` |  |
| MessageEditTrigger | component |  | `@elabs-ai/components-ai` |  |
| MessageFeedback | component | compact=true\|false* | `@elabs-ai/components-ai` | Thumbs up/down on a single assistant message. |
| MessageForm | component |  | `@elabs-ai/components-ai` | A model-emitted, zod-validated form rendered inside a chat message; returns structured values on submit. |
| MessageFormDescription | component |  | `@elabs-ai/components-ai` |  |
| MessageFormFallback | component |  | `@elabs-ai/components-ai` |  |
| MessageFormField | component |  | `@elabs-ai/components-ai` |  |
| MessageFormFields | component |  | `@elabs-ai/components-ai` |  |
| MessageFormProvider | component |  | `@elabs-ai/components-ai` |  |
| MessageFormRoot | component |  | `@elabs-ai/components-ai` |  |
| MessageFormSubmit | component |  | `@elabs-ai/components-ai` |  |
| MessageFormTitle | component |  | `@elabs-ai/components-ai` |  |
| MessageHeader | component |  | `@elabs-ai/components-ai` |  |
| MessageResponse | component |  | `@elabs-ai/components-ai` | Renders streamed assistant markdown (Streamdown) inside a Message. |
| MessageTable | component |  | `@elabs-ai/components-ai` | A model-emitted, column-oriented data table rendered as message content. |
| MessageTableFallback | component |  | `@elabs-ai/components-ai` |  |
| MessageToolbar | component |  | `@elabs-ai/components-ai` |  |
| MicSelector | component |  | `@elabs-ai/components-ai` | Input-device picker for voice capture — a searchable Command list in a Popover. |
| MicSelectorContent | component |  | `@elabs-ai/components-ai` |  |
| MicSelectorEmpty | component |  | `@elabs-ai/components-ai` |  |
| MicSelectorInput | component |  | `@elabs-ai/components-ai` |  |
| MicSelectorItem | component |  | `@elabs-ai/components-ai` |  |
| MicSelectorLabel | component |  | `@elabs-ai/components-ai` |  |
| MicSelectorList | component |  | `@elabs-ai/components-ai` |  |
| MicSelectorTrigger | component |  | `@elabs-ai/components-ai` |  |
| MicSelectorValue | component |  | `@elabs-ai/components-ai` |  |
| MODEL_SELECTOR_LOGO_BASE_URL | component |  | `@elabs-ai/components-ai` |  |
| ModelSelector | component |  | `@elabs-ai/components-ai` | Command-palette picker for the active model, grouped by provider. |
| ModelSelectorContent | component |  | `@elabs-ai/components-ai` |  |
| ModelSelectorDialog | component |  | `@elabs-ai/components-ai` |  |
| ModelSelectorEmpty | component |  | `@elabs-ai/components-ai` |  |
| ModelSelectorGroup | component |  | `@elabs-ai/components-ai` |  |
| ModelSelectorInput | component |  | `@elabs-ai/components-ai` |  |
| ModelSelectorItem | component |  | `@elabs-ai/components-ai` |  |
| ModelSelectorList | component |  | `@elabs-ai/components-ai` |  |
| ModelSelectorLogo | component |  | `@elabs-ai/components-ai` |  |
| ModelSelectorLogoGroup | component |  | `@elabs-ai/components-ai` |  |
| ModelSelectorName | component |  | `@elabs-ai/components-ai` |  |
| ModelSelectorSeparator | component |  | `@elabs-ai/components-ai` |  |
| ModelSelectorShortcut | component |  | `@elabs-ai/components-ai` |  |
| ModelSelectorTrigger | component |  | `@elabs-ai/components-ai` |  |
| Node | component |  | `@elabs-ai/components-ai` | A workspace-graph node — a Card with source/target handles, headed and slotted. |
| NodeAction | component |  | `@elabs-ai/components-ai` |  |
| NodeContent | component |  | `@elabs-ai/components-ai` |  |
| NodeDescription | component |  | `@elabs-ai/components-ai` |  |
| NodeFooter | component |  | `@elabs-ai/components-ai` |  |
| NodeHeader | component |  | `@elabs-ai/components-ai` |  |
| NodeTitle | component |  | `@elabs-ai/components-ai` |  |
| NodeToolbar | component |  | `@elabs-ai/components-ai` | The contextual action bar attached to a selected workspace-graph node. |
| OpenIn | component |  | `@elabs-ai/components-ai` | A menu that hands the current prompt off to an external chat product via a deep link. |
| OpenInChatGPT | component |  | `@elabs-ai/components-ai` |  |
| OpenInClaude | component |  | `@elabs-ai/components-ai` |  |
| OpenInContent | component |  | `@elabs-ai/components-ai` |  |
| OpenInCursor | component |  | `@elabs-ai/components-ai` |  |
| OpenInItem | component |  | `@elabs-ai/components-ai` |  |
| OpenInLabel | component |  | `@elabs-ai/components-ai` |  |
| OpenInScira | component |  | `@elabs-ai/components-ai` |  |
| OpenInSeparator | component |  | `@elabs-ai/components-ai` |  |
| OpenInT3 | component |  | `@elabs-ai/components-ai` |  |
| OpenInTrigger | component |  | `@elabs-ai/components-ai` |  |
| OpenInv0 | component |  | `@elabs-ai/components-ai` |  |
| PackageInfo | component |  | `@elabs-ai/components-ai` | A dependency and its version change — name, current→new version and change type. |
| PackageInfoChangeType | component |  | `@elabs-ai/components-ai` |  |
| PackageInfoContent | component |  | `@elabs-ai/components-ai` |  |
| PackageInfoDependencies | component |  | `@elabs-ai/components-ai` |  |
| PackageInfoDependency | component |  | `@elabs-ai/components-ai` |  |
| PackageInfoDescription | component |  | `@elabs-ai/components-ai` |  |
| PackageInfoHeader | component |  | `@elabs-ai/components-ai` |  |
| PackageInfoName | component |  | `@elabs-ai/components-ai` |  |
| PackageInfoVersion | component |  | `@elabs-ai/components-ai` |  |
| Panel | component |  | `@elabs-ai/components-ai` | A floating overlay panel pinned to a corner of the workspace Canvas. |
| Persona | component |  | `@elabs-ai/components-ai` | The animated agent avatar/presence mark (Rive), used as the assistant's identity. |
| PERSONA_SOURCES | component |  | `@elabs-ai/components-ai` |  |
| Plan | component |  | `@elabs-ai/components-ai` | A Card-shaped, collapsible plan the agent proposes before it starts executing. |
| PlanAction | component |  | `@elabs-ai/components-ai` |  |
| PlanContent | component |  | `@elabs-ai/components-ai` |  |
| PlanDescription | component |  | `@elabs-ai/components-ai` |  |
| PlanFooter | component |  | `@elabs-ai/components-ai` |  |
| PlanHeader | component |  | `@elabs-ai/components-ai` |  |
| PlanTitle | component |  | `@elabs-ai/components-ai` |  |
| PlanTrigger | component |  | `@elabs-ai/components-ai` |  |
| PRODUCED_ASSET_ICONS | component |  | `@elabs-ai/components-ai` |  |
| ProducedAssetTree | component |  | `@elabs-ai/components-ai` | The `document`-flavoured tree of assets the agent produced, for the context rail. |
| PromptInput | component |  | `@elabs-ai/components-ai` | Chat composer FORM (Enter submits) emitting a message to the app's runtime. |
| PromptInputActionAddAttachments | component |  | `@elabs-ai/components-ai` |  |
| PromptInputActionAddScreenshot | component |  | `@elabs-ai/components-ai` |  |
| PromptInputActionMenu | component |  | `@elabs-ai/components-ai` |  |
| PromptInputActionMenuContent | component |  | `@elabs-ai/components-ai` |  |
| PromptInputActionMenuItem | component |  | `@elabs-ai/components-ai` |  |
| PromptInputActionMenuTrigger | component |  | `@elabs-ai/components-ai` |  |
| PromptInputBody | component |  | `@elabs-ai/components-ai` |  |
| PromptInputButton | component |  | `@elabs-ai/components-ai` |  |
| PromptInputCommand | component |  | `@elabs-ai/components-ai` |  |
| PromptInputCommandEmpty | component |  | `@elabs-ai/components-ai` |  |
| PromptInputCommandGroup | component |  | `@elabs-ai/components-ai` |  |
| PromptInputCommandInput | component |  | `@elabs-ai/components-ai` |  |
| PromptInputCommandItem | component |  | `@elabs-ai/components-ai` |  |
| PromptInputCommandList | component |  | `@elabs-ai/components-ai` |  |
| PromptInputCommandSeparator | component |  | `@elabs-ai/components-ai` |  |
| PromptInputFooter | component |  | `@elabs-ai/components-ai` |  |
| PromptInputHeader | component |  | `@elabs-ai/components-ai` |  |
| PromptInputHoverCard | component |  | `@elabs-ai/components-ai` |  |
| PromptInputHoverCardContent | component |  | `@elabs-ai/components-ai` |  |
| PromptInputHoverCardTrigger | component |  | `@elabs-ai/components-ai` |  |
| PromptInputProvider | component |  | `@elabs-ai/components-ai` |  |
| PromptInputSelect | component |  | `@elabs-ai/components-ai` |  |
| PromptInputSelectContent | component |  | `@elabs-ai/components-ai` |  |
| PromptInputSelectItem | component |  | `@elabs-ai/components-ai` |  |
| PromptInputSelectTrigger | component |  | `@elabs-ai/components-ai` |  |
| PromptInputSelectValue | component |  | `@elabs-ai/components-ai` |  |
| PromptInputStop | component |  | `@elabs-ai/components-ai` |  |
| PromptInputSubmit | component |  | `@elabs-ai/components-ai` |  |
| PromptInputTab | component |  | `@elabs-ai/components-ai` |  |
| PromptInputTabBody | component |  | `@elabs-ai/components-ai` |  |
| PromptInputTabItem | component |  | `@elabs-ai/components-ai` |  |
| PromptInputTabLabel | component |  | `@elabs-ai/components-ai` |  |
| PromptInputTabsList | component |  | `@elabs-ai/components-ai` |  |
| PromptInputTextarea | component |  | `@elabs-ai/components-ai` |  |
| PromptInputTools | component |  | `@elabs-ai/components-ai` |  |
| Queue | component |  | `@elabs-ai/components-ai` | The pending work list — queued user messages and agent to-dos, grouped and collapsible. |
| QueueItem | component |  | `@elabs-ai/components-ai` |  |
| QueueItemAction | component |  | `@elabs-ai/components-ai` |  |
| QueueItemActions | component |  | `@elabs-ai/components-ai` |  |
| QueueItemAttachment | component |  | `@elabs-ai/components-ai` |  |
| QueueItemContent | component |  | `@elabs-ai/components-ai` |  |
| QueueItemDescription | component |  | `@elabs-ai/components-ai` |  |
| QueueItemFile | component |  | `@elabs-ai/components-ai` |  |
| QueueItemImage | component |  | `@elabs-ai/components-ai` |  |
| QueueItemIndicator | component |  | `@elabs-ai/components-ai` |  |
| QueueList | component |  | `@elabs-ai/components-ai` |  |
| QueueSection | component |  | `@elabs-ai/components-ai` |  |
| QueueSectionContent | component |  | `@elabs-ai/components-ai` |  |
| QueueSectionLabel | component |  | `@elabs-ai/components-ai` |  |
| QueueSectionTrigger | component |  | `@elabs-ai/components-ai` |  |
| Reasoning | component |  | `@elabs-ai/components-ai` | Collapsible 'thinking' disclosure that auto-opens while the model streams and reports elapsed duration. |
| ReasoningContent | component |  | `@elabs-ai/components-ai` |  |
| ReasoningTrigger | component |  | `@elabs-ai/components-ai` |  |
| Sandbox | component |  | `@elabs-ai/components-ai` | Collapsible, tabbed view of the files/commands a code-running tool worked on. |
| SandboxContent | component |  | `@elabs-ai/components-ai` |  |
| SandboxHeader | component |  | `@elabs-ai/components-ai` |  |
| SandboxTabContent | component |  | `@elabs-ai/components-ai` |  |
| SandboxTabs | component |  | `@elabs-ai/components-ai` |  |
| SandboxTabsBar | component |  | `@elabs-ai/components-ai` |  |
| SandboxTabsList | component |  | `@elabs-ai/components-ai` |  |
| SandboxTabsTrigger | component |  | `@elabs-ai/components-ai` |  |
| SchemaDisplay | component |  | `@elabs-ai/components-ai` | An HTTP endpoint contract in chat — method, path, parameters, request and response shapes. |
| SchemaDisplayBody | component |  | `@elabs-ai/components-ai` |  |
| SchemaDisplayContent | component |  | `@elabs-ai/components-ai` |  |
| SchemaDisplayDescription | component |  | `@elabs-ai/components-ai` |  |
| SchemaDisplayExample | component |  | `@elabs-ai/components-ai` |  |
| SchemaDisplayHeader | component |  | `@elabs-ai/components-ai` |  |
| SchemaDisplayMethod | component |  | `@elabs-ai/components-ai` |  |
| SchemaDisplayParameter | component |  | `@elabs-ai/components-ai` |  |
| SchemaDisplayParameters | component |  | `@elabs-ai/components-ai` |  |
| SchemaDisplayPath | component |  | `@elabs-ai/components-ai` |  |
| SchemaDisplayProperty | component |  | `@elabs-ai/components-ai` |  |
| SchemaDisplayRequest | component |  | `@elabs-ai/components-ai` |  |
| SchemaDisplayResponse | component |  | `@elabs-ai/components-ai` |  |
| SelectionToolbar | component |  | `@elabs-ai/components-ai` | A floating toolbar over selected transcript text, offering Quote as the default action. |
| Shimmer | component |  | `@elabs-ai/components-ai` | Motion-aware shimmering TEXT affordance for an in-progress ("Thinking…") line. |
| Snippet | component |  | `@elabs-ai/components-ai` | One-line copyable command or value, built on the ui InputGroup. |
| SnippetAddon | component |  | `@elabs-ai/components-ai` |  |
| SnippetCopyButton | component |  | `@elabs-ai/components-ai` |  |
| SnippetInput | component |  | `@elabs-ai/components-ai` |  |
| SnippetText | component |  | `@elabs-ai/components-ai` |  |
| Source | component |  | `@elabs-ai/components-ai` |  |
| SourceList | component |  | `@elabs-ai/components-ai` |  |
| Sources | component |  | `@elabs-ai/components-ai` | Collapsible citation list for the sources an answer was grounded in. |
| SourcesContent | component |  | `@elabs-ai/components-ai` |  |
| SourcesTrigger | component |  | `@elabs-ai/components-ai` |  |
| SpeechInput | component |  | `@elabs-ai/components-ai` | Push-to-talk capture for the composer — Web Speech API where available, MediaRecorder elsewhere. |
| StackTrace | component |  | `@elabs-ai/components-ai` | A parsed error stack — error type, message and frames, with internals folded away. |
| StackTraceActions | component |  | `@elabs-ai/components-ai` |  |
| StackTraceContent | component |  | `@elabs-ai/components-ai` |  |
| StackTraceCopyButton | component |  | `@elabs-ai/components-ai` |  |
| StackTraceError | component |  | `@elabs-ai/components-ai` |  |
| StackTraceErrorMessage | component |  | `@elabs-ai/components-ai` |  |
| StackTraceErrorType | component |  | `@elabs-ai/components-ai` |  |
| StackTraceExpandButton | component |  | `@elabs-ai/components-ai` |  |
| StackTraceFrames | component |  | `@elabs-ai/components-ai` |  |
| StackTraceHeader | component |  | `@elabs-ai/components-ai` |  |
| StreamingSuggestions | component |  | `@elabs-ai/components-ai` | The suggestion strip while the set is still being generated. |
| Suggestion | component |  | `@elabs-ai/components-ai` | One tappable follow-up prompt the user can send with a click. |
| SuggestionLoading | component |  | `@elabs-ai/components-ai` |  |
| Suggestions | component |  | `@elabs-ai/components-ai` |  |
| Task | component |  | `@elabs-ai/components-ai` | Collapsed "what got done" run summary, rendered on the canonical AgentTimeline rail. |
| TaskContent | component |  | `@elabs-ai/components-ai` |  |
| TaskItem | component |  | `@elabs-ai/components-ai` |  |
| TaskItemFile | component |  | `@elabs-ai/components-ai` |  |
| TaskTrigger | component |  | `@elabs-ai/components-ai` |  |
| Terminal | component |  | `@elabs-ai/components-ai` | Read-only ANSI console output with copy/clear actions and stick-to-bottom streaming. |
| TerminalActions | component |  | `@elabs-ai/components-ai` |  |
| TerminalClearButton | component |  | `@elabs-ai/components-ai` |  |
| TerminalContent | component |  | `@elabs-ai/components-ai` |  |
| TerminalCopyButton | component |  | `@elabs-ai/components-ai` |  |
| TerminalHeader | component |  | `@elabs-ai/components-ai` |  |
| TerminalStatus | component |  | `@elabs-ai/components-ai` |  |
| TerminalTitle | component |  | `@elabs-ai/components-ai` |  |
| Test | component |  | `@elabs-ai/components-ai` | One test-case row inside a test-results block — name, status and duration. |
| TestDuration | component |  | `@elabs-ai/components-ai` |  |
| TestError | component |  | `@elabs-ai/components-ai` |  |
| TestErrorMessage | component |  | `@elabs-ai/components-ai` |  |
| TestErrorStack | component |  | `@elabs-ai/components-ai` |  |
| TestName | component |  | `@elabs-ai/components-ai` |  |
| TestResults | component |  | `@elabs-ai/components-ai` |  |
| TestResultsContent | component |  | `@elabs-ai/components-ai` |  |
| TestResultsDuration | component |  | `@elabs-ai/components-ai` |  |
| TestResultsHeader | component |  | `@elabs-ai/components-ai` |  |
| TestResultsMeta | component |  | `@elabs-ai/components-ai` |  |
| TestResultsProgress | component |  | `@elabs-ai/components-ai` |  |
| TestResultsSummary | component |  | `@elabs-ai/components-ai` |  |
| TestStatus | component |  | `@elabs-ai/components-ai` |  |
| TestSuite | component |  | `@elabs-ai/components-ai` |  |
| TestSuiteContent | component |  | `@elabs-ai/components-ai` |  |
| TestSuiteName | component |  | `@elabs-ai/components-ai` |  |
| TestSuiteStats | component |  | `@elabs-ai/components-ai` |  |
| Tool | component |  | `@elabs-ai/components-ai` | Renders one AI SDK ToolUIPart — header (type + state), the input, and the output or error. |
| Toolbar | component |  | `@elabs-ai/components-ai` | A dense row of controls that acts on nearby content, collapsed into ONE tab stop with arrow-key navigation between the controls. |
| ToolContent | component |  | `@elabs-ai/components-ai` |  |
| ToolDetails | component |  | `@elabs-ai/components-ai` |  |
| ToolHeader | component |  | `@elabs-ai/components-ai` |  |
| ToolInput | component |  | `@elabs-ai/components-ai` |  |
| ToolOutput | component |  | `@elabs-ai/components-ai` |  |
| ToolResultCard | component |  | `@elabs-ai/components-ai` | The artifact a tool PRODUCED, presented as the headline — raised surface, no border, children carry the payload. Its header row is title \| actions \| status, where actions are scoped to the whole artifact (expand, download, open). |
| Transcription | component |  | `@elabs-ai/components-ai` | Time-coded speech segments, highlighted against playback position and seekable. |
| TranscriptionSegment | component |  | `@elabs-ai/components-ai` |  |
| useAssetPreviewRenderer | hook |  | `@elabs-ai/components-ai` |  |
| useAttachmentContext | hook |  | `@elabs-ai/components-ai` |  |
| useAttachmentsContext | hook |  | `@elabs-ai/components-ai` |  |
| useAudioDevices | hook |  | `@elabs-ai/components-ai` |  |
| useContextPanel | hook |  | `@elabs-ai/components-ai` |  |
| useJSXPreview | hook |  | `@elabs-ai/components-ai` |  |
| useMessageCompare | hook |  | `@elabs-ai/components-ai` |  |
| useMessageEdit | hook |  | `@elabs-ai/components-ai` |  |
| usePromptInputAttachments | hook |  | `@elabs-ai/components-ai` |  |
| usePromptInputController | hook |  | `@elabs-ai/components-ai` |  |
| usePromptInputReferencedSources | hook |  | `@elabs-ai/components-ai` |  |
| useProviderAttachments | hook |  | `@elabs-ai/components-ai` |  |
| useReasoning | hook |  | `@elabs-ai/components-ai` |  |
| UserMessage | component |  | `@elabs-ai/components-ai` |  |
| useVoiceSelector | hook |  | `@elabs-ai/components-ai` |  |
| VoiceSelector | component |  | `@elabs-ai/components-ai` | Voice picker for speech output — searchable list with per-voice attributes and preview. |
| VoiceSelectorAccent | component |  | `@elabs-ai/components-ai` |  |
| VoiceSelectorAge | component |  | `@elabs-ai/components-ai` |  |
| VoiceSelectorAttributes | component |  | `@elabs-ai/components-ai` |  |
| VoiceSelectorBullet | component |  | `@elabs-ai/components-ai` |  |
| VoiceSelectorContent | component |  | `@elabs-ai/components-ai` |  |
| VoiceSelectorDescription | component |  | `@elabs-ai/components-ai` |  |
| VoiceSelectorDialog | component |  | `@elabs-ai/components-ai` |  |
| VoiceSelectorEmpty | component |  | `@elabs-ai/components-ai` |  |
| VoiceSelectorGender | component |  | `@elabs-ai/components-ai` |  |
| VoiceSelectorGroup | component |  | `@elabs-ai/components-ai` |  |
| VoiceSelectorInput | component |  | `@elabs-ai/components-ai` |  |
| VoiceSelectorItem | component |  | `@elabs-ai/components-ai` |  |
| VoiceSelectorList | component |  | `@elabs-ai/components-ai` |  |
| VoiceSelectorName | component |  | `@elabs-ai/components-ai` |  |
| VoiceSelectorPreview | component |  | `@elabs-ai/components-ai` |  |
| VoiceSelectorSeparator | component |  | `@elabs-ai/components-ai` |  |
| VoiceSelectorShortcut | component |  | `@elabs-ai/components-ai` |  |
| VoiceSelectorTrigger | component |  | `@elabs-ai/components-ai` |  |
| WebPreview | component |  | `@elabs-ai/components-ai` | Framed preview of a URL the agent produced, with a URL bar and a console drawer. |
| WebPreviewBody | component |  | `@elabs-ai/components-ai` |  |
| WebPreviewConsole | component |  | `@elabs-ai/components-ai` |  |
| WebPreviewNavigation | component |  | `@elabs-ai/components-ai` |  |
| WebPreviewNavigationButton | component |  | `@elabs-ai/components-ai` |  |
| WebPreviewUrl | component |  | `@elabs-ai/components-ai` |  |

## @elabs-ai/components-flow

> Branded React Flow canvas, nodes, edges, controls, inspector.

| Name | Kind | Variants | Import | Notes |
| --- | --- | --- | --- | --- |
| Background | component |  | `@elabs-ai/components-flow` |  |
| CanvasShell | component |  | `@elabs-ai/components-flow` | Branded React Flow canvas wrapper with token-driven background + sane defaults. |
| Controls | component |  | `@elabs-ai/components-flow` | Zoom / fit / lock controls for the agent workspace Canvas. |
| FLOW_ALL_SIDE_HANDLES | component |  | `@elabs-ai/components-flow` |  |
| FLOW_GROUP_NODE_TYPE | component |  | `@elabs-ai/components-flow` |  |
| FlowButtonEdge | component |  | `@elabs-ai/components-flow` |  |
| FlowEdge | component |  | `@elabs-ai/components-flow` |  |
| FlowFloatingEdge | component |  | `@elabs-ai/components-flow` |  |
| FlowGroupNode | component |  | `@elabs-ai/components-flow` |  |
| FlowMiniMap | component |  | `@elabs-ai/components-flow` |  |
| FlowNode | component |  | `@elabs-ai/components-flow` | Branded custom React Flow node (title/subtitle/kind/icon/tone). |
| FlowPlaceholderNode | component |  | `@elabs-ai/components-flow` |  |
| FlowSmartEdge | component |  | `@elabs-ai/components-flow` |  |
| HANDLE_SIDES | component |  | `@elabs-ai/components-flow` |  |
| HelperLines | component |  | `@elabs-ai/components-flow` |  |
| InspectorPanel | component |  | `@elabs-ai/components-flow` |  |
| Legend | component |  | `@elabs-ai/components-flow` |  |
| MiniMap | component |  | `@elabs-ai/components-flow` |  |
| Panel | component |  | `@elabs-ai/components-flow` | A floating overlay panel pinned to a corner of the workspace Canvas. |
| Position | component |  | `@elabs-ai/components-flow` |  |
| ReactFlow | component |  | `@elabs-ai/components-flow` |  |
| ReactFlowProvider | component |  | `@elabs-ai/components-flow` |  |
| useAutoLayout | hook |  | `@elabs-ai/components-flow` |  |
| useEdgesState | hook |  | `@elabs-ai/components-flow` |  |
| useFlowGroups | hook |  | `@elabs-ai/components-flow` |  |
| useFlowLayout | hook |  | `@elabs-ai/components-flow` |  |
| useHelperLines | hook |  | `@elabs-ai/components-flow` |  |
| useNodesState | hook |  | `@elabs-ai/components-flow` |  |
| useReactFlow | hook |  | `@elabs-ai/components-flow` |  |
| ZoomControls | component |  | `@elabs-ai/components-flow` |  |

## @elabs-ai/components-maps

> MapLibre GL maps: MapCanvas, markers, popups, controls, routes, arcs, GeoJSON, clusters.

| Name | Kind | Variants | Import | Notes |
| --- | --- | --- | --- | --- |
| MapArc | component |  | `@elabs-ai/components-maps` |  |
| MapCanvas | component |  | `@elabs-ai/components-maps` | Root MapLibre canvas — theme-aware basemap; the ref is the raw MapLibre Map. |
| MapClusterLayer | component |  | `@elabs-ai/components-maps` | Clusters dense point data into count bubbles that split apart as you zoom in. |
| MapControls | component |  | `@elabs-ai/components-maps` |  |
| MapGeoJSON | component |  | `@elabs-ai/components-maps` |  |
| MapMarker | component |  | `@elabs-ai/components-maps` | A point on the map, optionally carrying content, a label, a popup or a tooltip. |
| MapMarkerContent | component |  | `@elabs-ai/components-maps` |  |
| MapMarkerLabel | component |  | `@elabs-ai/components-maps` |  |
| MapMarkerPopup | component |  | `@elabs-ai/components-maps` |  |
| MapMarkerTooltip | component |  | `@elabs-ai/components-maps` |  |
| MapPopup | component |  | `@elabs-ai/components-maps` | Standalone anchored popup on the map (not bound to a marker). |
| MapRoute | component |  | `@elabs-ai/components-maps` |  |
| useMap | hook |  | `@elabs-ai/components-maps` |  |

## @elabs-ai/components-charts

> MetricCard, MetricGrid, ChartCard, ChartFrame (expand/flip/download).

| Name | Kind | Variants | Import | Notes |
| --- | --- | --- | --- | --- |
| Area | component |  | `@elabs-ai/components-charts` |  |
| AreaChart | component |  | `@elabs-ai/components-charts` | Cumulative or part-of-whole trend over time — a filled line. |
| AreaChartLoading | component |  | `@elabs-ai/components-charts` |  |
| AutoChart | component |  | `@elabs-ai/components-charts` | Spec-driven chart — hand it a serializable ChartSpec and it picks and renders the right chart. |
| Bar | component |  | `@elabs-ai/components-charts` |  |
| BarChart | component |  | `@elabs-ai/components-charts` | Categorical comparison — composed from Bar + BarXAxis/BarYAxis inside its provider. |
| BarXAxis | component |  | `@elabs-ai/components-charts` |  |
| BarYAxis | component |  | `@elabs-ai/components-charts` |  |
| Candlestick | component |  | `@elabs-ai/components-charts` |  |
| CandlestickChart | component |  | `@elabs-ai/components-charts` |  |
| CHART_CLIP_PASSTHROUGH | component |  | `@elabs-ai/components-charts` |  |
| ChartBrush | component |  | `@elabs-ai/components-charts` |  |
| ChartBrushLayout | component |  | `@elabs-ai/components-charts` |  |
| ChartBrushSelectionOverlay | component |  | `@elabs-ai/components-charts` |  |
| ChartBrushTrackOverlay | component |  | `@elabs-ai/components-charts` |  |
| ChartCard | component |  | `@elabs-ai/components-charts` | Titled card surface around a chart — header, description, and the chart body. |
| ChartConfigProvider | component |  | `@elabs-ai/components-charts` |  |
| ChartDatapointLayer | component |  | `@elabs-ai/components-charts` | The keyboard/AT half of the chart interaction contract — real buttons in a sibling layer over the aria-hidden chart SVG (#349). |
| ChartDatapointProvider | component |  | `@elabs-ai/components-charts` | Opt-in wrapper that makes a chart's datapoints activatable — mounted only when the consumer passes onDatapointClick or copyValueOnActivate. |
| ChartFallback | component |  | `@elabs-ai/components-charts` |  |
| ChartFrame | component |  | `@elabs-ai/components-charts` | Opt-in chart wrapper adding expand / flip-to-table / download-CSV to any chart child. |
| ChartLegend | component |  | `@elabs-ai/components-charts` | Series key with label, value and an optional progress bar; pattern-aware under decoration. |
| ChartLegendHoverProvider | component |  | `@elabs-ai/components-charts` |  |
| ChartLoadingLabel | component |  | `@elabs-ai/components-charts` |  |
| ChartMarkers | component |  | `@elabs-ai/components-charts` |  |
| ChartProvider | component |  | `@elabs-ai/components-charts` |  |
| ChartRevealClip | component |  | `@elabs-ai/components-charts` |  |
| ChartStatFlow | component |  | `@elabs-ai/components-charts` |  |
| ChartTooltip | component |  | `@elabs-ai/components-charts` | Hover readout for the point/series under the pointer. |
| ChartTooltipBox | component |  | `@elabs-ai/components-charts` |  |
| ChartTooltipContent | component |  | `@elabs-ai/components-charts` |  |
| ChartTooltipDot | component |  | `@elabs-ai/components-charts` |  |
| ChartTooltipIndicator | component |  | `@elabs-ai/components-charts` |  |
| ChoroplethChart | component |  | `@elabs-ai/components-charts` | Region-shaded map for a measure that is defined per geographic area. |
| ChoroplethFeatureComponent | component |  | `@elabs-ai/components-charts` |  |
| ChoroplethGraticule | component |  | `@elabs-ai/components-charts` |  |
| ChoroplethProvider | component |  | `@elabs-ai/components-charts` |  |
| ChoroplethTooltip | component |  | `@elabs-ai/components-charts` |  |
| ComposedChart | component |  | `@elabs-ai/components-charts` | One cartesian frame that layers several series types (bars + lines + areas) together. |
| DateTicker | component |  | `@elabs-ai/components-charts` |  |
| DEFAULT_CHART_CONFIG | component |  | `@elabs-ai/components-charts` |  |
| DEFAULT_CHART_LIFECYCLE | component |  | `@elabs-ai/components-charts` |  |
| DEFAULT_CHART_STATUS | component |  | `@elabs-ai/components-charts` |  |
| DEFAULT_HOVER_OFFSET | component |  | `@elabs-ai/components-charts` |  |
| DEFAULT_MAX_INTERACTIVE_DATAPOINTS | component |  | `@elabs-ai/components-charts` |  |
| DEFAULT_Y_AXIS_ID | component |  | `@elabs-ai/components-charts` |  |
| DEFAULT_Y_DOMAIN_TWEEN_MS | component |  | `@elabs-ai/components-charts` |  |
| FunnelChart | component |  | `@elabs-ai/components-charts` | Stage-by-stage drop-off through an ordered pipeline. |
| Gantt | component | density=comfortable*\|compact | `@elabs-ai/components-charts` | Schedule grid — tasks as bars over time, with a task table beside them. |
| GANTT_NOMINAL_VIEWPORT_PX | component |  | `@elabs-ai/components-charts` |  |
| GANTT_UNIT_MS | component |  | `@elabs-ai/components-charts` |  |
| Gauge | component |  | `@elabs-ai/components-charts` | Single-value dial against a known range — a KPI with an explicit ceiling. |
| GradientDarkgreenGreen | component |  | `@elabs-ai/components-charts` |  |
| GradientLightgreenGreen | component |  | `@elabs-ai/components-charts` |  |
| GradientOrangeRed | component |  | `@elabs-ai/components-charts` |  |
| GradientPinkBlue | component |  | `@elabs-ai/components-charts` |  |
| GradientPinkRed | component |  | `@elabs-ai/components-charts` |  |
| GradientPurpleOrange | component |  | `@elabs-ai/components-charts` |  |
| GradientPurpleTeal | component |  | `@elabs-ai/components-charts` |  |
| GradientSteelPurple | component |  | `@elabs-ai/components-charts` |  |
| GradientTealBlue | component |  | `@elabs-ai/components-charts` |  |
| Grid | component |  | `@elabs-ai/components-charts` |  |
| Legend | component |  | `@elabs-ai/components-charts` |  |
| LegendItemComponent | component |  | `@elabs-ai/components-charts` |  |
| LegendLabel | component |  | `@elabs-ai/components-charts` |  |
| LegendMarker | component |  | `@elabs-ai/components-charts` |  |
| LegendProgress | component |  | `@elabs-ai/components-charts` |  |
| LegendValue | component |  | `@elabs-ai/components-charts` |  |
| Line | component |  | `@elabs-ai/components-charts` |  |
| LinearGradient | component |  | `@elabs-ai/components-charts` |  |
| LineChart | component |  | `@elabs-ai/components-charts` | Trend over a continuous (usually time) axis. |
| LineChartLoading | component |  | `@elabs-ai/components-charts` |  |
| LineLoadingPulseStroke | component |  | `@elabs-ai/components-charts` |  |
| LiveLine | component |  | `@elabs-ai/components-charts` |  |
| LiveLineChart | component |  | `@elabs-ai/components-charts` |  |
| LiveXAxis | component |  | `@elabs-ai/components-charts` |  |
| LiveYAxis | component |  | `@elabs-ai/components-charts` |  |
| MarkerGroup | component |  | `@elabs-ai/components-charts` |  |
| MarkerTooltipContent | component |  | `@elabs-ai/components-charts` |  |
| MetricCard | component |  | `@elabs-ai/components-charts` | Single KPI tile — label, value, delta/trend. |
| MetricGrid | component |  | `@elabs-ai/components-charts` | Responsive grid of KPI tiles — the summary row at the top of a dashboard. |
| MIN_DATAPOINT_TARGET_SIZE | component |  | `@elabs-ai/components-charts` |  |
| PatternArea | component |  | `@elabs-ai/components-charts` |  |
| PatternCircles | component |  | `@elabs-ai/components-charts` |  |
| PatternHexagons | component |  | `@elabs-ai/components-charts` |  |
| PatternLines | component |  | `@elabs-ai/components-charts` |  |
| PatternWaves | component |  | `@elabs-ai/components-charts` |  |
| PieCenter | component |  | `@elabs-ai/components-charts` |  |
| PieCenterShell | component |  | `@elabs-ai/components-charts` |  |
| PieChart | component |  | `@elabs-ai/components-charts` | Part-of-whole split across a handful of categories. |
| PieProvider | component |  | `@elabs-ai/components-charts` |  |
| PieSlice | component |  | `@elabs-ai/components-charts` |  |
| PROFIT_LOSS_LEGEND_ITEMS | component |  | `@elabs-ai/components-charts` |  |
| PROFIT_LOSS_NEGATIVE_COLOR | component |  | `@elabs-ai/components-charts` |  |
| PROFIT_LOSS_POSITIVE_COLOR | component |  | `@elabs-ai/components-charts` |  |
| PROFIT_LOSS_TOOLTIP_LABEL_FALLBACK | component |  | `@elabs-ai/components-charts` |  |
| ProfitLossLegend | component |  | `@elabs-ai/components-charts` |  |
| ProfitLossLegendHoverProvider | component |  | `@elabs-ai/components-charts` |  |
| ProfitLossLine | component |  | `@elabs-ai/components-charts` |  |
| RadarArea | component |  | `@elabs-ai/components-charts` |  |
| RadarAxis | component |  | `@elabs-ai/components-charts` |  |
| RadarChart | component |  | `@elabs-ai/components-charts` | Multi-metric profile comparison on a shared radial axis. |
| RadarGrid | component |  | `@elabs-ai/components-charts` |  |
| RadarLabels | component |  | `@elabs-ai/components-charts` |  |
| RadarProvider | component |  | `@elabs-ai/components-charts` |  |
| RadialGradient | component |  | `@elabs-ai/components-charts` |  |
| Ring | component |  | `@elabs-ai/components-charts` |  |
| RingCenter | component |  | `@elabs-ai/components-charts` |  |
| RingChart | component |  | `@elabs-ai/components-charts` |  |
| RingProvider | component |  | `@elabs-ai/components-charts` |  |
| SankeyChart | component |  | `@elabs-ai/components-charts` | Flow diagram — how quantity moves between stages or nodes. |
| SankeyLink | component |  | `@elabs-ai/components-charts` |  |
| SankeyNode | component |  | `@elabs-ai/components-charts` |  |
| SankeyProvider | component |  | `@elabs-ai/components-charts` |  |
| SankeyTooltip | component |  | `@elabs-ai/components-charts` |  |
| Scatter | component |  | `@elabs-ai/components-charts` |  |
| ScatterChart | component |  | `@elabs-ai/components-charts` | Point cloud for correlation between two continuous measures. |
| SegmentBackground | component |  | `@elabs-ai/components-charts` |  |
| SegmentLineFrom | component |  | `@elabs-ai/components-charts` |  |
| SegmentLineTo | component |  | `@elabs-ai/components-charts` |  |
| SeriesBar | component |  | `@elabs-ai/components-charts` |  |
| SeriesMarkers | component |  | `@elabs-ai/components-charts` |  |
| SeriesPointMarker | component |  | `@elabs-ai/components-charts` |  |
| Sparkline | component |  | `@elabs-ai/components-charts` | Tiny, axis-less trend that lives inside a KPI tile or a table cell. |
| StaticChartPreviewProvider | component |  | `@elabs-ai/components-charts` |  |
| useActivateDatapoint | hook |  | `@elabs-ai/components-charts` |  |
| useActiveMarkers | hook |  | `@elabs-ai/components-charts` |  |
| useAnimatedYDomains | hook |  | `@elabs-ai/components-charts` |  |
| useChart | hook |  | `@elabs-ai/components-charts` |  |
| useChartConfig | hook |  | `@elabs-ai/components-charts` |  |
| useChartDatapointsEnabled | hook |  | `@elabs-ai/components-charts` |  |
| useChartHover | hook |  | `@elabs-ai/components-charts` |  |
| useChartInteraction | hook |  | `@elabs-ai/components-charts` |  |
| useChartLegendHover | hook |  | `@elabs-ai/components-charts` |  |
| useChartStable | hook |  | `@elabs-ai/components-charts` |  |
| useChoropleth | hook |  | `@elabs-ai/components-charts` |  |
| useChoroplethZoom | hook |  | `@elabs-ai/components-charts` |  |
| useHighDecoration | hook |  | `@elabs-ai/components-charts` |  |
| useHighDecorationOf | hook |  | `@elabs-ai/components-charts` |  |
| useLegend | hook |  | `@elabs-ai/components-charts` |  |
| useLegendItem | hook |  | `@elabs-ai/components-charts` |  |
| usePie | hook |  | `@elabs-ai/components-charts` |  |
| usePieHover | hook |  | `@elabs-ai/components-charts` |  |
| usePieStable | hook |  | `@elabs-ai/components-charts` |  |
| useProfitLossLegendHover | hook |  | `@elabs-ai/components-charts` |  |
| useRadar | hook |  | `@elabs-ai/components-charts` |  |
| useRadarHover | hook |  | `@elabs-ai/components-charts` |  |
| useRadarStable | hook |  | `@elabs-ai/components-charts` |  |
| useRegisterDatapointTargets | hook |  | `@elabs-ai/components-charts` |  |
| useResolvedRadius | hook |  | `@elabs-ai/components-charts` |  |
| useResolvedRadiusOf | hook |  | `@elabs-ai/components-charts` |  |
| useRing | hook |  | `@elabs-ai/components-charts` |  |
| useRingHover | hook |  | `@elabs-ai/components-charts` |  |
| useRingStable | hook |  | `@elabs-ai/components-charts` |  |
| useSankey | hook |  | `@elabs-ai/components-charts` |  |
| useStaticChartPreview | hook |  | `@elabs-ai/components-charts` |  |
| useYScale | hook |  | `@elabs-ai/components-charts` |  |
| XAxis | component |  | `@elabs-ai/components-charts` |  |
| Y_AXIS_DEFAULT_TICK_COUNT | component |  | `@elabs-ai/components-charts` |  |
| Y_AXIS_MAX_TICK_COUNT | component |  | `@elabs-ai/components-charts` |  |
| Y_AXIS_MIN_TICK_COUNT | component |  | `@elabs-ai/components-charts` |  |
| YAxis | component |  | `@elabs-ai/components-charts` |  |

## @elabs-ai/components-marketing

> Hero, FeatureGrid, UseCaseCard, StatsBand, CTASection, LogoStrip.

| Name | Kind | Variants | Import | Notes |
| --- | --- | --- | --- | --- |
| CTASection | component |  | `@elabs-ai/components-marketing` | Closing conversion band — one message, one action. |
| FeatureGrid | component |  | `@elabs-ai/components-marketing` | Grid of capability cards below the hero. |
| Hero | component |  | `@elabs-ai/components-marketing` | Above-the-fold marketing headline, subcopy and the primary call to action. |
| LogoStrip | component |  | `@elabs-ai/components-marketing` |  |
| StatsBand | component |  | `@elabs-ai/components-marketing` |  |
| UseCaseCard | component |  | `@elabs-ai/components-marketing` |  |

## @elabs-ai/components-editor

> Token-themed Monaco editor: CodeEditor, DiffEditor, CodeWorkspace.

| Name | Kind | Variants | Import | Notes |
| --- | --- | --- | --- | --- |
| CodeEditor | component |  | `@elabs-ai/components-editor` | Monaco-backed editable code editor (controlled/uncontrolled), themed from tokens. |
| CodeWorkspace | component |  | `@elabs-ai/components-editor` |  |
| CopyButton | component |  | `@elabs-ai/components-editor` |  |
| DiffEditor | component |  | `@elabs-ai/components-editor` |  |
| EDITOR_LANGUAGES | component |  | `@elabs-ai/components-editor` |  |
| EditorContextMenu | component |  | `@elabs-ai/components-editor` |  |
| EditorToolbar | component |  | `@elabs-ai/components-editor` |  |
| MarkdownEditor | component |  | `@elabs-ai/components-editor` |  |
| useDataTheme | hook |  | `@elabs-ai/components-editor` |  |
| Bibliography | component |  | `@elabs-ai/components-editor/markdown` |  |
| Blockquote | component |  | `@elabs-ai/components-editor/markdown` |  |
| BRAND_DIRECTIVES | component |  | `@elabs-ai/components-editor/markdown` |  |
| BRAND_SLASH_COMMANDS | component |  | `@elabs-ai/components-editor/markdown` |  |
| CALC_FENCE_SEED | component |  | `@elabs-ai/components-editor/markdown` |  |
| CalcBlock | component |  | `@elabs-ai/components-editor/markdown` |  |
| CalcInline | component |  | `@elabs-ai/components-editor/markdown` |  |
| DECISION_STATUSES | component |  | `@elabs-ai/components-editor/markdown` |  |
| DecisionCard | component |  | `@elabs-ai/components-editor/markdown` |  |
| DEFAULT_TEMPLATE | component |  | `@elabs-ai/components-editor/markdown` |  |
| DocumentOutline | component |  | `@elabs-ai/components-editor/markdown` |  |
| ENTITY_KINDS | component |  | `@elabs-ai/components-editor/markdown` |  |
| EntityCard | component |  | `@elabs-ai/components-editor/markdown` |  |
| EntityChip | component |  | `@elabs-ai/components-editor/markdown` |  |
| FootnoteList | component |  | `@elabs-ai/components-editor/markdown` |  |
| Heading | component |  | `@elabs-ai/components-editor/markdown` |  |
| InlineCode | component |  | `@elabs-ai/components-editor/markdown` |  |
| IterationBlock | component |  | `@elabs-ai/components-editor/markdown` |  |
| IterationBuilderDialog | component |  | `@elabs-ai/components-editor/markdown` |  |
| IterationBuilderProvider | component |  | `@elabs-ai/components-editor/markdown` |  |
| IterationEditContext | component |  | `@elabs-ai/components-editor/markdown` |  |
| IterationTemplateDialog | component |  | `@elabs-ai/components-editor/markdown` |  |
| IterationTemplateProvider | component |  | `@elabs-ai/components-editor/markdown` |  |
| KnowledgeCard | component |  | `@elabs-ai/components-editor/markdown` |  |
| Link | component |  | `@elabs-ai/components-editor/markdown` |  |
| List | component |  | `@elabs-ai/components-editor/markdown` |  |
| ListItem | component |  | `@elabs-ai/components-editor/markdown` |  |
| MARKDOWN_HEADING_REM | component |  | `@elabs-ai/components-editor/markdown` |  |
| MARKDOWN_HEADING_TRACKING | component |  | `@elabs-ai/components-editor/markdown` |  |
| MARKDOWN_HEADING_WEIGHT | component |  | `@elabs-ai/components-editor/markdown` |  |
| MARKDOWN_MEASURE | component |  | `@elabs-ai/components-editor/markdown` |  |
| MarkdownEditor | component |  | `@elabs-ai/components-editor/markdown` |  |
| MarkdownPreview | component |  | `@elabs-ai/components-editor/markdown` |  |
| MarkdownToolbar | component |  | `@elabs-ai/components-editor/markdown` |  |
| MarkdownWorkspace | component |  | `@elabs-ai/components-editor/markdown` |  |
| MathBlock | component |  | `@elabs-ai/components-editor/markdown` |  |
| MathInline | component |  | `@elabs-ai/components-editor/markdown` |  |
| MermaidDiagram | component |  | `@elabs-ai/components-editor/markdown` |  |
| MermaidWorkspace | component |  | `@elabs-ai/components-editor/markdown` |  |
| MetricBlock | component |  | `@elabs-ai/components-editor/markdown` |  |
| MonacoSlashMenu | component |  | `@elabs-ai/components-editor/markdown` |  |
| SlashMenu | component |  | `@elabs-ai/components-editor/markdown` |  |
| TableOfContents | component |  | `@elabs-ai/components-editor/markdown` |  |
| Text | component |  | `@elabs-ai/components-editor/markdown` |  |
| Timeline | component |  | `@elabs-ai/components-editor/markdown` |  |
| useMarkdownOutline | hook |  | `@elabs-ai/components-editor/markdown` |  |

## @elabs-ai/components-viewer

> FileViewer — any file (image, text, JSON, CSV) via a pluggable adapter registry.

| Name | Kind | Variants | Import | Notes |
| --- | --- | --- | --- | --- |
| ACTIVE_HIGHLIGHT_SELECTOR | component |  | `@elabs-ai/components-viewer` |  |
| DEFAULT_ZOOM | component |  | `@elabs-ai/components-viewer` |  |
| FileViewer | component |  | `@elabs-ai/components-viewer` | Render a file the app did not write (upload, signed URL, agent output) — detects the format, loads the matching adapter on demand, draws it with brand-ui components. |
| FileViewerContent | component |  | `@elabs-ai/components-viewer` |  |
| FileViewerEmpty | component |  | `@elabs-ai/components-viewer` |  |
| FileViewerError | component |  | `@elabs-ai/components-viewer` |  |
| FileViewerFind | component |  | `@elabs-ai/components-viewer` |  |
| FileViewerFrame | component |  | `@elabs-ai/components-viewer` |  |
| FileViewerHighlightStatus | component |  | `@elabs-ai/components-viewer` |  |
| FileViewerPager | component |  | `@elabs-ai/components-viewer` |  |
| FileViewerProvider | component |  | `@elabs-ai/components-viewer` |  |
| FileViewerRotate | component |  | `@elabs-ai/components-viewer` |  |
| FileViewerSkeleton | component |  | `@elabs-ai/components-viewer` |  |
| FileViewerToolbar | component |  | `@elabs-ai/components-viewer` |  |
| FileViewerZoom | component |  | `@elabs-ai/components-viewer` |  |
| FIND_MATCH_LIMIT | component |  | `@elabs-ai/components-viewer` |  |
| PROTOCOL_VERSION | component |  | `@elabs-ai/components-viewer` |  |
| useFileViewer | hook |  | `@elabs-ai/components-viewer` |  |
| useScrollActiveHighlightIntoView | hook |  | `@elabs-ai/components-viewer` |  |
| VIEWER_ZOOM_STEPS | component |  | `@elabs-ai/components-viewer` |  |
| ViewerError | component |  | `@elabs-ai/components-viewer` |  |

---

_Generated by `@elabs-ai/components-cli`. The live, queryable surface is `brand-ui docs <Component>` (real props) and, when the Storybook dev server is up, the `mcp__storybook__*` tools._
