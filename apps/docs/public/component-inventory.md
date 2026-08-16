<!-- GENERATED FILE — do not edit by hand.
     Source: brand-ui.manifest.json (via `pnpm inventory`).
     Regenerate after any component/token change; the inventory:check gate fails on drift. -->

# brand-ui component inventory

The full component/hook surface, generated from the manifest. `*` marks a cva default value. Subpath-exported items show their import path.

**Themes (1):** dark
**Radius:** `calc(var(--radius-base) * (1 - var(--decoration-factor)))` · **Tokens:** 169

## Packages

| Package | Path | Components | Hooks | Purpose |
| --- | --- | --: | --: | --- |
| `@elabs/components-tokens` | packages/tokens | 19 | 6 | Semantic CSS-variable themes + ThemeProvider/useTheme. |
| `@elabs/components-icons` | packages/icons | 31 | 0 | Brand/product-vocabulary icons + BrandLogo (generic glyphs use lucide-react). |
| `@elabs/components-ui` | packages/ui | 354 | 14 | Foundation + app UI (Button, Card, Dialog, Tabs, AppShell, …). |
| `@elabs/components-data` | packages/data | 5 | 0 | TanStack DataTable, FilterBar, SearchInput, FacetFilter, ColumnPicker. |
| `@elabs/components-ai` | packages/ai | 443 | 13 | ChatShell, Conversation, Message, PromptInput, Tool, Reasoning, citations. |
| `@elabs/components-flow` | packages/flow | 23 | 7 | Branded React Flow canvas, nodes, edges, controls, inspector. |
| `@elabs/components-maps` | packages/maps | 12 | 1 | MapLibre GL maps: MapCanvas, markers, popups, controls, routes, arcs, GeoJSON, clusters. |
| `@elabs/components-charts` | packages/charts | 130 | 32 | MetricCard, MetricGrid, ChartCard, ChartFrame (expand/flip/download). |
| `@elabs/components-marketing` | packages/marketing | 6 | 0 | Hero, FeatureGrid, UseCaseCard, StatsBand, CTASection, LogoStrip. |
| `@elabs/components-editor` | packages/editor | 8 | 1 | Token-themed Monaco editor: CodeEditor, DiffEditor, CodeWorkspace. |
| `@elabs/components-viewer` | packages/viewer | 19 | 2 | FileViewer — any file (image, text, JSON, CSV) via a pluggable adapter registry. |

## @elabs/components-tokens

> Semantic CSS-variable themes + ThemeProvider/useTheme.

| Name | Kind | Variants | Import | Notes |
| --- | --- | --- | --- | --- |
| BUILT_IN_THEME_DEFINITIONS | component |  | `@elabs/components-tokens` |  |
| BUILT_IN_THEME_META | component |  | `@elabs/components-tokens` |  |
| BUILT_IN_THEMES | component |  | `@elabs/components-tokens` |  |
| DECORATION_LEVELS | component |  | `@elabs/components-tokens` |  |
| DecorationProvider | component |  | `@elabs/components-tokens` | Sets the `--decoration` dial (0–10) for a region — reprographic texture, orthogonal to color. |
| DEFAULT_DECORATION_LEVEL | component |  | `@elabs/components-tokens` |  |
| DEFAULT_DENSITY | component |  | `@elabs/components-tokens` |  |
| DEFAULT_MOTION_PREFERENCE | component |  | `@elabs/components-tokens` |  |
| DEFAULT_TASTE_PROFILE | component |  | `@elabs/components-tokens` |  |
| DEFAULT_TASTE_REGISTER | component |  | `@elabs/components-tokens` |  |
| DEFAULT_THEME | component |  | `@elabs/components-tokens` |  |
| DENSITIES | component |  | `@elabs/components-tokens` |  |
| DENSITY_META | component |  | `@elabs/components-tokens` |  |
| MOTION_PREFERENCE_META | component |  | `@elabs/components-tokens` |  |
| MOTION_PREFERENCES | component |  | `@elabs/components-tokens` |  |
| TASTE_REGISTER_META | component |  | `@elabs/components-tokens` |  |
| TASTE_REGISTERS | component |  | `@elabs/components-tokens` |  |
| THEME_TOKEN_NAMES | component |  | `@elabs/components-tokens` |  |
| ThemeProvider | component |  | `@elabs/components-tokens` | Writes `data-theme` on a root element and persists the choice; `useTheme()` reads/sets it. |
| useDecoration | hook |  | `@elabs/components-tokens` |  |
| useDensity | hook |  | `@elabs/components-tokens` |  |
| useMotionPreference | hook |  | `@elabs/components-tokens` |  |
| useReducedMotion | hook |  | `@elabs/components-tokens` |  |
| useTasteProfile | hook |  | `@elabs/components-tokens` |  |
| useTheme | hook |  | `@elabs/components-tokens` |  |

## @elabs/components-icons

> Brand/product-vocabulary icons + BrandLogo (generic glyphs use lucide-react).

| Name | Kind | Variants | Import | Notes |
| --- | --- | --- | --- | --- |
| AppIcon | component |  | `@elabs/components-icons` | The standard app/brand mark for app chrome — theme-aware, morphs mark↔lockup on sidebar collapse. |
| BookmarkIcon | component |  | `@elabs/components-icons` |  |
| BrandLogo | component |  | `@elabs/components-icons` | The product's mark/lockup, drawn from tokens so it adapts to every theme. |
| ChartAreaIcon | component |  | `@elabs/components-icons` |  |
| ChartBarIcon | component |  | `@elabs/components-icons` |  |
| ChartComboIcon | component |  | `@elabs/components-icons` |  |
| ChartLineIcon | component |  | `@elabs/components-icons` |  |
| ChartPieIcon | component |  | `@elabs/components-icons` |  |
| ChartScatterIcon | component |  | `@elabs/components-icons` |  |
| ChatIcon | component |  | `@elabs/components-icons` |  |
| DashboardIcon | component |  | `@elabs/components-icons` |  |
| DataConnectionIcon | component |  | `@elabs/components-icons` |  |
| DataModelIcon | component |  | `@elabs/components-icons` |  |
| DatasetIcon | component |  | `@elabs/components-icons` |  |
| DimensionIcon | component |  | `@elabs/components-icons` |  |
| FilterPaneIcon | component |  | `@elabs/components-icons` |  |
| FlowIcon | component |  | `@elabs/components-icons` |  |
| GaugeIcon | component |  | `@elabs/components-icons` |  |
| Icon | component |  | `@elabs/components-icons` | The brand/product-vocabulary icon primitive — 24×24, stroke = currentColor, so it themes with text. |
| InsightIcon | component |  | `@elabs/components-icons` |  |
| KpiIcon | component |  | `@elabs/components-icons` |  |
| MeasureIcon | component |  | `@elabs/components-icons` |  |
| PipelineIcon | component |  | `@elabs/components-icons` |  |
| PivotIcon | component |  | `@elabs/components-icons` |  |
| SearchIcon | component |  | `@elabs/components-icons` |  |
| SheetIcon | component |  | `@elabs/components-icons` |  |
| SparklesIcon | component |  | `@elabs/components-icons` |  |
| StoryIcon | component |  | `@elabs/components-icons` |  |
| TableIcon | component |  | `@elabs/components-icons` |  |
| TrendDownIcon | component |  | `@elabs/components-icons` |  |
| TrendUpIcon | component |  | `@elabs/components-icons` |  |

## @elabs/components-ui

> Foundation + app UI (Button, Card, Dialog, Tabs, AppShell, …).

| Name | Kind | Variants | Import | Notes |
| --- | --- | --- | --- | --- |
| Accordion | component |  | `@elabs/components-ui` |  |
| AccordionContent | component |  | `@elabs/components-ui` |  |
| AccordionItem | component |  | `@elabs/components-ui` |  |
| AccordionTrigger | component |  | `@elabs/components-ui` |  |
| AdvancedGroup | component |  | `@elabs/components-ui` |  |
| Alert | component | variant=default*\|info\|success\|warning\|destructive | `@elabs/components-ui` |  |
| AlertDescription | component |  | `@elabs/components-ui` |  |
| AlertDialog | component |  | `@elabs/components-ui` | Confirmation overlay for destructive / irreversible actions — friction proportional to consequence. |
| AlertDialogAction | component |  | `@elabs/components-ui` |  |
| AlertDialogCancel | component |  | `@elabs/components-ui` |  |
| AlertDialogContent | component |  | `@elabs/components-ui` |  |
| AlertDialogDescription | component |  | `@elabs/components-ui` |  |
| AlertDialogFooter | component |  | `@elabs/components-ui` |  |
| AlertDialogHeader | component |  | `@elabs/components-ui` |  |
| AlertDialogPortal | component |  | `@elabs/components-ui` |  |
| AlertDialogTitle | component |  | `@elabs/components-ui` |  |
| AlertDialogTrigger | component |  | `@elabs/components-ui` |  |
| AlertTitle | component |  | `@elabs/components-ui` |  |
| AppShell | component |  | `@elabs/components-ui` | Top-level application frame — sidebar + header + content region. |
| AppSidebar | component |  | `@elabs/components-ui` |  |
| AspectRatio | component |  | `@elabs/components-ui` |  |
| AttributionPanel | component |  | `@elabs/components-ui` |  |
| ATTRIBUTIONS | component |  | `@elabs/components-ui` |  |
| Avatar | component |  | `@elabs/components-ui` |  |
| AvatarFallback | component |  | `@elabs/components-ui` |  |
| AvatarImage | component |  | `@elabs/components-ui` |  |
| Badge | component | variant=default*\|secondary\|outline\|success\|warning\|destructive\|info | `@elabs/components-ui` | Compact status/label chip (status, count, category). |
| BentoGrid | component |  | `@elabs/components-ui` |  |
| BentoGridItem | component | hero=true\|false* · interactive=true\|false* | `@elabs/components-ui` |  |
| BoundedNumber | component |  | `@elabs/components-ui` |  |
| Breadcrumb | component |  | `@elabs/components-ui` |  |
| BreadcrumbEllipsis | component |  | `@elabs/components-ui` |  |
| BreadcrumbItem | component |  | `@elabs/components-ui` |  |
| BreadcrumbLink | component |  | `@elabs/components-ui` |  |
| BreadcrumbList | component |  | `@elabs/components-ui` |  |
| BreadcrumbPage | component |  | `@elabs/components-ui` |  |
| BreadcrumbSeparator | component |  | `@elabs/components-ui` |  |
| Button | component | variant=default*\|secondary\|destructive\|outline\|outline-subtle\|ghost\|link · size=sm\|default*\|lg\|icon\|icon-sm\|icon-lg | `@elabs/components-ui` | Primary action trigger — the canonical way to invoke an action. |
| ButtonGroup | component | orientation=horizontal*\|vertical | `@elabs/components-ui` |  |
| ButtonGroupSeparator | component |  | `@elabs/components-ui` |  |
| ButtonGroupText | component |  | `@elabs/components-ui` |  |
| Calendar | component |  | `@elabs/components-ui` |  |
| Card | component | interactive=true\|false* | `@elabs/components-ui` | Surface grouping related content into a bordered, padded block. |
| CardAction | component |  | `@elabs/components-ui` |  |
| CardContent | component |  | `@elabs/components-ui` |  |
| CardDescription | component |  | `@elabs/components-ui` |  |
| CardFooter | component |  | `@elabs/components-ui` |  |
| CardHeader | component |  | `@elabs/components-ui` |  |
| CardTitle | component |  | `@elabs/components-ui` |  |
| Carousel | component |  | `@elabs/components-ui` |  |
| CarouselContent | component |  | `@elabs/components-ui` |  |
| CarouselItem | component |  | `@elabs/components-ui` |  |
| CarouselNext | component |  | `@elabs/components-ui` |  |
| CarouselPrevious | component |  | `@elabs/components-ui` |  |
| CATEGORY_LABEL | component |  | `@elabs/components-ui` |  |
| ChangeReview | component |  | `@elabs/components-ui` |  |
| ChangeReviewHeader | component |  | `@elabs/components-ui` |  |
| ChangeReviewHunk | component |  | `@elabs/components-ui` |  |
| ChangeReviewList | component |  | `@elabs/components-ui` |  |
| ChangeReviewProvenance | component |  | `@elabs/components-ui` |  |
| ChangeReviewProvider | component |  | `@elabs/components-ui` |  |
| Checkbox | component |  | `@elabs/components-ui` | Binary on/off toggle within a form (multi-select within a group). |
| Collapsible | component |  | `@elabs/components-ui` |  |
| CollapsibleContent | component |  | `@elabs/components-ui` |  |
| CollapsibleTrigger | component |  | `@elabs/components-ui` |  |
| COLOR_TOKENS | component |  | `@elabs/components-ui` |  |
| ColorPicker | component |  | `@elabs/components-ui` |  |
| Combobox | component |  | `@elabs/components-ui` | Searchable single/multi select — Select with typeahead over a large or async option set. |
| Command | component |  | `@elabs/components-ui` |  |
| CommandDialog | component |  | `@elabs/components-ui` |  |
| CommandEmpty | component |  | `@elabs/components-ui` |  |
| CommandGroup | component |  | `@elabs/components-ui` |  |
| CommandInput | component |  | `@elabs/components-ui` |  |
| CommandItem | component |  | `@elabs/components-ui` |  |
| CommandList | component |  | `@elabs/components-ui` |  |
| CommandSeparator | component |  | `@elabs/components-ui` |  |
| CommandShortcut | component |  | `@elabs/components-ui` |  |
| ConfirmDialog | component |  | `@elabs/components-ui` |  |
| ContextMenu | component |  | `@elabs/components-ui` |  |
| ContextMenuCheckboxItem | component |  | `@elabs/components-ui` |  |
| ContextMenuContent | component |  | `@elabs/components-ui` |  |
| ContextMenuGroup | component |  | `@elabs/components-ui` |  |
| ContextMenuItem | component |  | `@elabs/components-ui` |  |
| ContextMenuLabel | component |  | `@elabs/components-ui` |  |
| ContextMenuRadioGroup | component |  | `@elabs/components-ui` |  |
| ContextMenuRadioItem | component |  | `@elabs/components-ui` |  |
| ContextMenuSeparator | component |  | `@elabs/components-ui` |  |
| ContextMenuShortcut | component |  | `@elabs/components-ui` |  |
| ContextMenuSub | component |  | `@elabs/components-ui` |  |
| ContextMenuSubContent | component |  | `@elabs/components-ui` |  |
| ContextMenuSubTrigger | component |  | `@elabs/components-ui` |  |
| ContextMenuTrigger | component |  | `@elabs/components-ui` |  |
| COPY_FEEDBACK_MS | component |  | `@elabs/components-ui` |  |
| CopyableValue | component |  | `@elabs/components-ui` |  |
| DatePicker | component |  | `@elabs/components-ui` |  |
| DateRangePicker | component |  | `@elabs/components-ui` |  |
| DEFAULT_MESSAGES | component |  | `@elabs/components-ui` |  |
| Descriptions | component |  | `@elabs/components-ui` |  |
| DescriptionsItem | component |  | `@elabs/components-ui` |  |
| Dialog | component |  | `@elabs/components-ui` | Modal overlay for focused tasks/flows that block the page until dismissed. |
| DialogBody | component |  | `@elabs/components-ui` |  |
| DialogClose | component |  | `@elabs/components-ui` |  |
| DialogContent | component | size=sm\|lg*\|xl\|full | `@elabs/components-ui` |  |
| DialogDescription | component |  | `@elabs/components-ui` |  |
| DialogFooter | component |  | `@elabs/components-ui` |  |
| DialogHeader | component |  | `@elabs/components-ui` |  |
| DialogOverlay | component |  | `@elabs/components-ui` |  |
| DialogPortal | component |  | `@elabs/components-ui` |  |
| DialogSection | component |  | `@elabs/components-ui` |  |
| DialogTitle | component |  | `@elabs/components-ui` |  |
| DialogTrigger | component |  | `@elabs/components-ui` |  |
| DOCUMENT_ADDRESS_KINDS | component |  | `@elabs/components-ui` |  |
| Drawer | component |  | `@elabs/components-ui` |  |
| DrawerClose | component |  | `@elabs/components-ui` |  |
| DrawerContent | component |  | `@elabs/components-ui` |  |
| DrawerDescription | component |  | `@elabs/components-ui` |  |
| DrawerFooter | component |  | `@elabs/components-ui` |  |
| DrawerHeader | component |  | `@elabs/components-ui` |  |
| DrawerPortal | component |  | `@elabs/components-ui` |  |
| DrawerTitle | component |  | `@elabs/components-ui` |  |
| DrawerTrigger | component |  | `@elabs/components-ui` |  |
| DropdownMenu | component |  | `@elabs/components-ui` |  |
| DropdownMenuCheckboxItem | component |  | `@elabs/components-ui` |  |
| DropdownMenuContent | component |  | `@elabs/components-ui` |  |
| DropdownMenuGroup | component |  | `@elabs/components-ui` |  |
| DropdownMenuItem | component |  | `@elabs/components-ui` |  |
| DropdownMenuLabel | component |  | `@elabs/components-ui` |  |
| DropdownMenuPortal | component |  | `@elabs/components-ui` |  |
| DropdownMenuRadioGroup | component |  | `@elabs/components-ui` |  |
| DropdownMenuRadioItem | component |  | `@elabs/components-ui` |  |
| DropdownMenuSeparator | component |  | `@elabs/components-ui` |  |
| DropdownMenuShortcut | component |  | `@elabs/components-ui` |  |
| DropdownMenuSub | component |  | `@elabs/components-ui` |  |
| DropdownMenuSubContent | component |  | `@elabs/components-ui` |  |
| DropdownMenuSubTrigger | component |  | `@elabs/components-ui` |  |
| DropdownMenuTrigger | component |  | `@elabs/components-ui` |  |
| EmptyState | component |  | `@elabs/components-ui` |  |
| ErrorState | component |  | `@elabs/components-ui` |  |
| ExpandDialog | component |  | `@elabs/components-ui` |  |
| ExpandDialogContent | component |  | `@elabs/components-ui` |  |
| ExpandDialogHeader | component |  | `@elabs/components-ui` |  |
| ExpandDialogPanes | component | detailPlacement=side*\|bottom · stackBelow=never*\|sm\|md\|lg | `@elabs/components-ui` |  |
| FieldRow | component |  | `@elabs/components-ui` |  |
| FILE_CATEGORY_ICONS | component |  | `@elabs/components-ui` |  |
| FileUpload | component |  | `@elabs/components-ui` |  |
| FileUploadDropzone | component |  | `@elabs/components-ui` |  |
| FileUploadItem | component |  | `@elabs/components-ui` |  |
| FileUploadList | component |  | `@elabs/components-ui` |  |
| FilterChip | component |  | `@elabs/components-ui` |  |
| Form | component |  | `@elabs/components-ui` | Validated form scaffold (Field/Label/Control/Message) wiring inputs to a schema. |
| FormControl | component |  | `@elabs/components-ui` |  |
| FormDescription | component |  | `@elabs/components-ui` |  |
| FormField | component |  | `@elabs/components-ui` |  |
| FormItem | component |  | `@elabs/components-ui` |  |
| FormLabel | component |  | `@elabs/components-ui` |  |
| FormMessage | component |  | `@elabs/components-ui` |  |
| Heading | component | size=display\|title*\|subtitle | `@elabs/components-ui` |  |
| HoverCard | component |  | `@elabs/components-ui` |  |
| HoverCardContent | component |  | `@elabs/components-ui` |  |
| HoverCardTrigger | component |  | `@elabs/components-ui` |  |
| IconButton | component |  | `@elabs/components-ui` |  |
| Input | component |  | `@elabs/components-ui` | Single-line text field — the base form input. |
| InputGroup | component | variant=outline*\|surface\|card | `@elabs/components-ui` |  |
| InputGroupAddon | component | align=inline-start*\|inline-end\|block-start\|block-end | `@elabs/components-ui` |  |
| InputGroupButton | component |  | `@elabs/components-ui` |  |
| InputGroupInput | component |  | `@elabs/components-ui` |  |
| InputGroupText | component |  | `@elabs/components-ui` |  |
| InputGroupTextarea | component |  | `@elabs/components-ui` |  |
| InputOTP | component |  | `@elabs/components-ui` |  |
| InputOTPGroup | component |  | `@elabs/components-ui` |  |
| InputOTPSeparator | component |  | `@elabs/components-ui` |  |
| InputOTPSlot | component |  | `@elabs/components-ui` |  |
| Kbd | component |  | `@elabs/components-ui` |  |
| KeyValueEditor | component |  | `@elabs/components-ui` |  |
| Label | component |  | `@elabs/components-ui` |  |
| LinkPreview | component |  | `@elabs/components-ui` |  |
| LinkPreviewCard | component |  | `@elabs/components-ui` |  |
| ListEditor | component |  | `@elabs/components-ui` |  |
| LoadingState | component |  | `@elabs/components-ui` |  |
| LocaleProvider | component |  | `@elabs/components-ui` |  |
| MatchHighlight | component |  | `@elabs/components-ui` |  |
| MentionInput | component |  | `@elabs/components-ui` |  |
| MentionInputContent | component |  | `@elabs/components-ui` |  |
| MentionInputEmpty | component |  | `@elabs/components-ui` |  |
| MentionInputItem | component |  | `@elabs/components-ui` |  |
| MentionInputList | component |  | `@elabs/components-ui` |  |
| MentionInputTextarea | component |  | `@elabs/components-ui` |  |
| Menubar | component |  | `@elabs/components-ui` |  |
| MenubarCheckboxItem | component |  | `@elabs/components-ui` |  |
| MenubarContent | component |  | `@elabs/components-ui` |  |
| MenubarGroup | component |  | `@elabs/components-ui` |  |
| MenubarItem | component |  | `@elabs/components-ui` |  |
| MenubarMenu | component |  | `@elabs/components-ui` |  |
| MenubarPortal | component |  | `@elabs/components-ui` |  |
| MenubarRadioGroup | component |  | `@elabs/components-ui` |  |
| MenubarRadioItem | component |  | `@elabs/components-ui` |  |
| MenubarSeparator | component |  | `@elabs/components-ui` |  |
| MenubarShortcut | component |  | `@elabs/components-ui` |  |
| MenubarSub | component |  | `@elabs/components-ui` |  |
| MenubarSubContent | component |  | `@elabs/components-ui` |  |
| MenubarSubTrigger | component |  | `@elabs/components-ui` |  |
| MenubarTrigger | component |  | `@elabs/components-ui` |  |
| MetricCard | component |  | `@elabs/components-ui` | Single KPI tile — label, value, delta/trend. |
| ModelPicker | component |  | `@elabs/components-ui` |  |
| NavigationMenu | component |  | `@elabs/components-ui` |  |
| NavigationMenuContent | component |  | `@elabs/components-ui` |  |
| NavigationMenuItem | component |  | `@elabs/components-ui` |  |
| NavigationMenuLink | component |  | `@elabs/components-ui` |  |
| NavigationMenuList | component |  | `@elabs/components-ui` |  |
| NavigationMenuTrigger | component |  | `@elabs/components-ui` |  |
| NavigationMenuViewport | component |  | `@elabs/components-ui` |  |
| NavMain | component |  | `@elabs/components-ui` |  |
| NavNotifications | component |  | `@elabs/components-ui` |  |
| NavUser | component |  | `@elabs/components-ui` |  |
| NumberInput | component |  | `@elabs/components-ui` |  |
| PageShell | component |  | `@elabs/components-ui` |  |
| Pagination | component |  | `@elabs/components-ui` |  |
| PaginationContent | component |  | `@elabs/components-ui` |  |
| PaginationEllipsis | component |  | `@elabs/components-ui` |  |
| PaginationItem | component |  | `@elabs/components-ui` |  |
| PaginationLink | component |  | `@elabs/components-ui` |  |
| PaginationNext | component |  | `@elabs/components-ui` |  |
| PaginationPrevious | component |  | `@elabs/components-ui` |  |
| Popover | component |  | `@elabs/components-ui` | Anchored, dismissible floating panel for lightweight contextual content. |
| PopoverAnchor | component |  | `@elabs/components-ui` |  |
| PopoverContent | component |  | `@elabs/components-ui` |  |
| PopoverTrigger | component |  | `@elabs/components-ui` |  |
| Progress | component |  | `@elabs/components-ui` |  |
| PROSE_HEADING_REM | component |  | `@elabs/components-ui` |  |
| PROSE_HEADING_TRACKING | component |  | `@elabs/components-ui` |  |
| PROSE_HEADING_WEIGHT | component |  | `@elabs/components-ui` |  |
| ProseBlockquote | component |  | `@elabs/components-ui` |  |
| ProseHeading | component |  | `@elabs/components-ui` |  |
| ProseInlineCode | component |  | `@elabs/components-ui` |  |
| ProseLink | component |  | `@elabs/components-ui` |  |
| ProseList | component |  | `@elabs/components-ui` |  |
| ProseListItem | component |  | `@elabs/components-ui` |  |
| ProseText | component |  | `@elabs/components-ui` |  |
| RadioGroup | component |  | `@elabs/components-ui` | Mutually-exclusive single choice from a small visible set. |
| RadioGroupItem | component |  | `@elabs/components-ui` |  |
| Rating | component |  | `@elabs/components-ui` |  |
| ResizableHandle | component |  | `@elabs/components-ui` |  |
| ResizablePanel | component |  | `@elabs/components-ui` |  |
| ResizablePanelGroup | component |  | `@elabs/components-ui` |  |
| ResultCount | component |  | `@elabs/components-ui` |  |
| Reveal | component | appear=fade\|up*\|down\|left\|right\|zoom · speed=fast\|base\|slow* | `@elabs/components-ui` |  |
| RevealGroup | component |  | `@elabs/components-ui` |  |
| RevisionTimeline | component | density=comfortable*\|compact | `@elabs/components-ui` |  |
| ScrollArea | component |  | `@elabs/components-ui` |  |
| ScrollBar | component |  | `@elabs/components-ui` |  |
| SectionHeader | component |  | `@elabs/components-ui` |  |
| SegmentedField | component |  | `@elabs/components-ui` |  |
| Select | component |  | `@elabs/components-ui` | Single-choice dropdown from a known set of options. |
| SelectContent | component |  | `@elabs/components-ui` |  |
| SelectGroup | component |  | `@elabs/components-ui` |  |
| SelectItem | component |  | `@elabs/components-ui` |  |
| SelectLabel | component |  | `@elabs/components-ui` |  |
| SelectSeparator | component |  | `@elabs/components-ui` |  |
| SelectTrigger | component |  | `@elabs/components-ui` |  |
| SelectValue | component |  | `@elabs/components-ui` |  |
| Separator | component |  | `@elabs/components-ui` |  |
| Sheet | component |  | `@elabs/components-ui` | Edge-anchored panel (left/right/top/bottom) for secondary flows beside the page. |
| SheetClose | component |  | `@elabs/components-ui` |  |
| SheetContent | component |  | `@elabs/components-ui` |  |
| SheetDescription | component |  | `@elabs/components-ui` |  |
| SheetFooter | component |  | `@elabs/components-ui` |  |
| SheetHeader | component |  | `@elabs/components-ui` |  |
| SheetPortal | component |  | `@elabs/components-ui` |  |
| SheetTitle | component |  | `@elabs/components-ui` |  |
| SheetTrigger | component |  | `@elabs/components-ui` |  |
| Sidebar | component |  | `@elabs/components-ui` |  |
| SidebarContent | component |  | `@elabs/components-ui` |  |
| SidebarFooter | component |  | `@elabs/components-ui` |  |
| SidebarGroup | component |  | `@elabs/components-ui` |  |
| SidebarGroupAction | component |  | `@elabs/components-ui` |  |
| SidebarGroupContent | component |  | `@elabs/components-ui` |  |
| SidebarGroupLabel | component |  | `@elabs/components-ui` |  |
| SidebarHeader | component |  | `@elabs/components-ui` |  |
| SidebarInput | component |  | `@elabs/components-ui` |  |
| SidebarInset | component |  | `@elabs/components-ui` |  |
| SidebarMenu | component |  | `@elabs/components-ui` |  |
| SidebarMenuAction | component |  | `@elabs/components-ui` |  |
| SidebarMenuBadge | component |  | `@elabs/components-ui` |  |
| SidebarMenuButton | component | variant=default*\|outline · size=default*\|sm\|lg | `@elabs/components-ui` |  |
| SidebarMenuItem | component |  | `@elabs/components-ui` |  |
| SidebarMenuSkeleton | component |  | `@elabs/components-ui` |  |
| SidebarMenuSub | component |  | `@elabs/components-ui` |  |
| SidebarMenuSubButton | component |  | `@elabs/components-ui` |  |
| SidebarMenuSubItem | component |  | `@elabs/components-ui` |  |
| SidebarProvider | component |  | `@elabs/components-ui` |  |
| SidebarRail | component |  | `@elabs/components-ui` |  |
| SidebarSeparator | component |  | `@elabs/components-ui` |  |
| SidebarTrigger | component |  | `@elabs/components-ui` |  |
| Skeleton | component |  | `@elabs/components-ui` |  |
| Slider | component |  | `@elabs/components-ui` |  |
| SliderNumber | component |  | `@elabs/components-ui` |  |
| Spinner | component |  | `@elabs/components-ui` |  |
| SplitPanel | component |  | `@elabs/components-ui` |  |
| StatePanel | component | kind=empty*\|error\|loading | `@elabs/components-ui` |  |
| STATUS_LABELS | component |  | `@elabs/components-ui` |  |
| STATUS_ROLE | component |  | `@elabs/components-ui` |  |
| STATUS_TONE_ICONS | component |  | `@elabs/components-ui` |  |
| STATUS_TONES | component |  | `@elabs/components-ui` |  |
| StatusBadge | component | status=pending\|running\|complete\|awaiting-approval\|denied\|failed\|skipped · tone=neutral\|info\|success\|warning\|destructive · size=sm\|md* | `@elabs/components-ui` |  |
| STATUSES | component |  | `@elabs/components-ui` |  |
| StatusIcon | component |  | `@elabs/components-ui` |  |
| STREAMDOWN_TRANSLATION_KEYS | component |  | `@elabs/components-ui` |  |
| Switch | component |  | `@elabs/components-ui` | Immediate on/off setting toggle (applies on change, not on submit). |
| Table | component |  | `@elabs/components-ui` |  |
| TableBody | component |  | `@elabs/components-ui` |  |
| TableCaption | component |  | `@elabs/components-ui` |  |
| TableCell | component |  | `@elabs/components-ui` |  |
| TableFooter | component |  | `@elabs/components-ui` |  |
| TableHead | component |  | `@elabs/components-ui` |  |
| TableHeader | component |  | `@elabs/components-ui` |  |
| TableRow | component |  | `@elabs/components-ui` |  |
| Tabs | component |  | `@elabs/components-ui` | Switch between peer views in the same context without navigating away. |
| TabsContent | component |  | `@elabs/components-ui` |  |
| TabsList | component |  | `@elabs/components-ui` |  |
| TabsTrigger | component |  | `@elabs/components-ui` |  |
| TagInput | component |  | `@elabs/components-ui` |  |
| TeamSwitcher | component |  | `@elabs/components-ui` |  |
| Text | component | variant=lead\|body*\|caption\|meta\|kpi\|code · tone=default*\|muted\|primary | `@elabs/components-ui` |  |
| TEXT_ROLE_REM | component |  | `@elabs/components-ui` |  |
| Textarea | component |  | `@elabs/components-ui` |  |
| ThemeSwitcher | component |  | `@elabs/components-ui` |  |
| Timeline | component |  | `@elabs/components-ui` |  |
| TimelineItem | component |  | `@elabs/components-ui` |  |
| TimelineRoot | component |  | `@elabs/components-ui` |  |
| Toaster | component |  | `@elabs/components-ui` |  |
| Toggle | component | variant=default*\|outline\|segmented · size=default*\|sm\|lg | `@elabs/components-ui` |  |
| ToggleGroup | component |  | `@elabs/components-ui` |  |
| ToggleGroupItem | component |  | `@elabs/components-ui` |  |
| Toolbar | component | orientation=horizontal*\|vertical | `@elabs/components-ui` | A dense row of controls that acts on nearby content, collapsed into ONE tab stop with arrow-key navigation between the controls. |
| ToolbarButton | component |  | `@elabs/components-ui` |  |
| ToolbarSeparator | component |  | `@elabs/components-ui` |  |
| ToolbarSlot | component |  | `@elabs/components-ui` |  |
| ToolbarToggleGroup | component |  | `@elabs/components-ui` |  |
| ToolbarToggleItem | component |  | `@elabs/components-ui` |  |
| Tooltip | component |  | `@elabs/components-ui` | Transient hover/focus hint with supplementary (non-essential) text. |
| TooltipContent | component |  | `@elabs/components-ui` |  |
| TooltipProvider | component |  | `@elabs/components-ui` |  |
| TooltipTrigger | component |  | `@elabs/components-ui` |  |
| TopNav | component |  | `@elabs/components-ui` |  |
| Transfer | component |  | `@elabs/components-ui` |  |
| Tree | component |  | `@elabs/components-ui` |  |
| TreeSelect | component |  | `@elabs/components-ui` |  |
| useCollapsiblePanel | hook |  | `@elabs/components-ui` |  |
| useCommandActiveItemId | hook |  | `@elabs/components-ui` |  |
| useCopyToClipboard | hook |  | `@elabs/components-ui` |  |
| useDialogDismissGuard | hook |  | `@elabs/components-ui` |  |
| useFileUpload | hook |  | `@elabs/components-ui` |  |
| useFormField | hook |  | `@elabs/components-ui` |  |
| useIsMobile | hook |  | `@elabs/components-ui` |  |
| useLocale | hook |  | `@elabs/components-ui` |  |
| useMentionInput | hook |  | `@elabs/components-ui` |  |
| useSidebar | hook |  | `@elabs/components-ui` |  |
| useStreamdownTranslations | hook |  | `@elabs/components-ui` |  |
| useThemeTransition | hook |  | `@elabs/components-ui` |  |
| useTreeKeyboard | hook |  | `@elabs/components-ui` |  |
| useVirtualListbox | hook |  | `@elabs/components-ui` |  |
| ViewToolbar | component |  | `@elabs/components-ui` |  |
| ViewToolbarFilters | component |  | `@elabs/components-ui` |  |
| VirtualSelect | component |  | `@elabs/components-ui` |  |
| Wizard | component |  | `@elabs/components-ui` |  |
| WizardNav | component |  | `@elabs/components-ui` |  |
| WizardStep | component |  | `@elabs/components-ui` |  |
| WizardSteps | component |  | `@elabs/components-ui` |  |

## @elabs/components-data

> TanStack DataTable, FilterBar, SearchInput, FacetFilter, ColumnPicker.

| Name | Kind | Variants | Import | Notes |
| --- | --- | --- | --- | --- |
| ColumnPicker | component |  | `@elabs/components-data` |  |
| DataTable | component |  | `@elabs/components-data` | TanStack-backed data grid with sorting, filtering, pagination and a render-prop toolbar. |
| FacetFilter | component |  | `@elabs/components-data` |  |
| FilterBar | component |  | `@elabs/components-data` |  |
| SearchInput | component |  | `@elabs/components-data` | Controlled search box that drives a DataTable's global filter. |

## @elabs/components-ai

> ChatShell, Conversation, Message, PromptInput, Tool, Reasoning, citations.

| Name | Kind | Variants | Import | Notes |
| --- | --- | --- | --- | --- |
| Agent | component |  | `@elabs/components-ai` | Accordion-shaped disclosure describing a sub-agent: its instructions, tools and output. |
| AgentContent | component |  | `@elabs/components-ai` |  |
| AgentHeader | component |  | `@elabs/components-ai` |  |
| AgentInstructions | component |  | `@elabs/components-ai` |  |
| AgentMessage | component | emphasis=default*\|answer | `@elabs/components-ai` |  |
| AgentOutput | component |  | `@elabs/components-ai` |  |
| AgentStep | component |  | `@elabs/components-ai` |  |
| AgentTimeline | component |  | `@elabs/components-ai` | Chronological rail of agent steps and checkpoints — what the agent did, in order. |
| AgentTool | component |  | `@elabs/components-ai` |  |
| AgentTools | component |  | `@elabs/components-ai` |  |
| ApprovalCard | component |  | `@elabs/components-ai` | The named human-in-the-loop variant of Confirmation — a titled, described approve/deny card. |
| ApprovalCardAccepted | component |  | `@elabs/components-ai` |  |
| ApprovalCardAction | component |  | `@elabs/components-ai` |  |
| ApprovalCardActions | component |  | `@elabs/components-ai` |  |
| ApprovalCardApprove | component |  | `@elabs/components-ai` |  |
| ApprovalCardDeny | component |  | `@elabs/components-ai` |  |
| ApprovalCardDescription | component |  | `@elabs/components-ai` |  |
| ApprovalCardRejected | component |  | `@elabs/components-ai` |  |
| ApprovalCardRequest | component |  | `@elabs/components-ai` |  |
| ApprovalCardTitle | component |  | `@elabs/components-ai` |  |
| Artifact | component |  | `@elabs/components-ai` | Panel surface for a durable object the agent produced (document, code, preview) with title, description and actions. |
| ArtifactAction | component |  | `@elabs/components-ai` |  |
| ArtifactActions | component |  | `@elabs/components-ai` |  |
| ArtifactClose | component |  | `@elabs/components-ai` |  |
| ArtifactContent | component |  | `@elabs/components-ai` |  |
| ArtifactDescription | component |  | `@elabs/components-ai` |  |
| ArtifactHeader | component |  | `@elabs/components-ai` |  |
| ArtifactTitle | component |  | `@elabs/components-ai` |  |
| AssetPreview | component |  | `@elabs/components-ai` | Type-keyed preview of ONE produced asset — markdown/code/sql/csv/image — inside the Artifact chrome. |
| Attachment | component |  | `@elabs/components-ai` | One user-supplied file/source chip — media-category icon, preview, hover details and a remove affordance. |
| AttachmentEmpty | component |  | `@elabs/components-ai` |  |
| AttachmentHoverCard | component |  | `@elabs/components-ai` |  |
| AttachmentHoverCardContent | component |  | `@elabs/components-ai` |  |
| AttachmentHoverCardTrigger | component |  | `@elabs/components-ai` |  |
| AttachmentInfo | component |  | `@elabs/components-ai` |  |
| AttachmentPreview | component |  | `@elabs/components-ai` |  |
| AttachmentRemove | component |  | `@elabs/components-ai` |  |
| Attachments | component |  | `@elabs/components-ai` |  |
| AudioPlayer | component |  | `@elabs/components-ai` | Themed audio transport for generated/recorded speech, built on media-chrome's MediaController. |
| AudioPlayerControlBar | component |  | `@elabs/components-ai` |  |
| AudioPlayerDurationDisplay | component |  | `@elabs/components-ai` |  |
| AudioPlayerElement | component |  | `@elabs/components-ai` |  |
| AudioPlayerMuteButton | component |  | `@elabs/components-ai` |  |
| AudioPlayerPlayButton | component |  | `@elabs/components-ai` |  |
| AudioPlayerSeekBackwardButton | component |  | `@elabs/components-ai` |  |
| AudioPlayerSeekForwardButton | component |  | `@elabs/components-ai` |  |
| AudioPlayerTimeDisplay | component |  | `@elabs/components-ai` |  |
| AudioPlayerTimeRange | component |  | `@elabs/components-ai` |  |
| AudioPlayerVolumeRange | component |  | `@elabs/components-ai` |  |
| BrandMotionConfig | component |  | `@elabs/components-ai` | Feeds descendant Motion components the brand transition (duration/ease mirrored from the motion tokens). |
| Canvas | component |  | `@elabs/components-ai` | The in-chat agent workspace graph surface (React Flow) — the canvas an agent renders inside a conversation (ADR 0018). |
| ChainOfThought | component |  | `@elabs/components-ai` | Step-by-step live reasoning trace with per-step status and search results. |
| ChainOfThoughtContent | component |  | `@elabs/components-ai` |  |
| ChainOfThoughtHeader | component |  | `@elabs/components-ai` |  |
| ChainOfThoughtImage | component |  | `@elabs/components-ai` |  |
| ChainOfThoughtSearchResult | component |  | `@elabs/components-ai` |  |
| ChainOfThoughtSearchResults | component |  | `@elabs/components-ai` |  |
| ChainOfThoughtStep | component |  | `@elabs/components-ai` |  |
| ChatGreeting | component |  | `@elabs/components-ai` |  |
| ChatShell | component |  | `@elabs/components-ai` | Assistant/chat application frame composing the conversation + composer surfaces. |
| Checkpoint | component |  | `@elabs/components-ai` | A restore-point divider in a transcript — a labelled rule the user can jump back to. |
| CheckpointIcon | component |  | `@elabs/components-ai` |  |
| CheckpointTrigger | component |  | `@elabs/components-ai` |  |
| CodeBlock | component |  | `@elabs/components-ai` | Shiki-highlighted code block with a copy button, filename and language selector. |
| CodeBlockActions | component |  | `@elabs/components-ai` |  |
| CodeBlockContainer | component |  | `@elabs/components-ai` |  |
| CodeBlockContent | component |  | `@elabs/components-ai` |  |
| CodeBlockCopyButton | component |  | `@elabs/components-ai` |  |
| CodeBlockFilename | component |  | `@elabs/components-ai` |  |
| CodeBlockHeader | component |  | `@elabs/components-ai` |  |
| CodeBlockLanguageSelector | component |  | `@elabs/components-ai` |  |
| CodeBlockLanguageSelectorContent | component |  | `@elabs/components-ai` |  |
| CodeBlockLanguageSelectorItem | component |  | `@elabs/components-ai` |  |
| CodeBlockLanguageSelectorTrigger | component |  | `@elabs/components-ai` |  |
| CodeBlockLanguageSelectorValue | component |  | `@elabs/components-ai` |  |
| CodeBlockTitle | component |  | `@elabs/components-ai` |  |
| Commit | component |  | `@elabs/components-ai` | A version-control commit rendered in chat — hash, author, message and changed files. |
| CommitActions | component |  | `@elabs/components-ai` |  |
| CommitAuthor | component |  | `@elabs/components-ai` |  |
| CommitAuthorAvatar | component |  | `@elabs/components-ai` |  |
| CommitContent | component |  | `@elabs/components-ai` |  |
| CommitCopyButton | component |  | `@elabs/components-ai` |  |
| CommitFile | component |  | `@elabs/components-ai` |  |
| CommitFileAdditions | component |  | `@elabs/components-ai` |  |
| CommitFileChanges | component |  | `@elabs/components-ai` |  |
| CommitFileDeletions | component |  | `@elabs/components-ai` |  |
| CommitFileIcon | component |  | `@elabs/components-ai` |  |
| CommitFileInfo | component |  | `@elabs/components-ai` |  |
| CommitFilePath | component |  | `@elabs/components-ai` |  |
| CommitFiles | component |  | `@elabs/components-ai` |  |
| CommitFileStatus | component |  | `@elabs/components-ai` |  |
| CommitHash | component |  | `@elabs/components-ai` |  |
| CommitHeader | component |  | `@elabs/components-ai` |  |
| CommitInfo | component |  | `@elabs/components-ai` |  |
| CommitMessage | component |  | `@elabs/components-ai` |  |
| CommitMetadata | component |  | `@elabs/components-ai` |  |
| CommitSeparator | component |  | `@elabs/components-ai` |  |
| CommitTimestamp | component |  | `@elabs/components-ai` |  |
| Composer | component |  | `@elabs/components-ai` | The standard chat input — a PromptInput pre-assembled with attachments, tools and submit. |
| Confirmation | component |  | `@elabs/components-ai` | In-conversation approve/deny request for an action the agent wants a human to authorize. |
| ConfirmationAccepted | component |  | `@elabs/components-ai` |  |
| ConfirmationAction | component |  | `@elabs/components-ai` |  |
| ConfirmationActions | component |  | `@elabs/components-ai` |  |
| ConfirmationApprove | component |  | `@elabs/components-ai` |  |
| ConfirmationDeny | component |  | `@elabs/components-ai` |  |
| ConfirmationDescription | component |  | `@elabs/components-ai` |  |
| ConfirmationRejected | component |  | `@elabs/components-ai` |  |
| ConfirmationRequest | component |  | `@elabs/components-ai` |  |
| ConfirmationTitle | component |  | `@elabs/components-ai` |  |
| Connection | component |  | `@elabs/components-ai` | The in-flight connection line drawn while the user drags a new edge on the Canvas. |
| Context | component |  | `@elabs/components-ai` | Context-window usage readout for a model turn — used vs max tokens, with a hover breakdown. |
| ContextCacheUsage | component |  | `@elabs/components-ai` |  |
| ContextContent | component |  | `@elabs/components-ai` |  |
| ContextContentBody | component |  | `@elabs/components-ai` |  |
| ContextContentFooter | component |  | `@elabs/components-ai` |  |
| ContextContentHeader | component |  | `@elabs/components-ai` |  |
| ContextInputUsage | component |  | `@elabs/components-ai` |  |
| ContextOutputUsage | component |  | `@elabs/components-ai` |  |
| ContextPanel | component |  | `@elabs/components-ai` | The chat workspace's right context rail — sources, produced assets and a root↔detail drill-in. |
| ContextPanelBody | component |  | `@elabs/components-ai` |  |
| ContextPanelDetail | component |  | `@elabs/components-ai` |  |
| ContextPanelHeader | component |  | `@elabs/components-ai` |  |
| ContextPanelProvider | component |  | `@elabs/components-ai` |  |
| ContextPanelSection | component |  | `@elabs/components-ai` |  |
| ContextPanelTrigger | component |  | `@elabs/components-ai` |  |
| ContextReasoningUsage | component |  | `@elabs/components-ai` |  |
| ContextTrigger | component |  | `@elabs/components-ai` |  |
| Controls | component |  | `@elabs/components-ai` | Zoom / fit / lock controls for the agent workspace Canvas. |
| Conversation | component |  | `@elabs/components-ai` | Auto-stick-to-bottom chat transcript region. |
| ConversationContent | component |  | `@elabs/components-ai` |  |
| ConversationDownload | component |  | `@elabs/components-ai` |  |
| ConversationEmptyState | component |  | `@elabs/components-ai` |  |
| ConversationScrollButton | component |  | `@elabs/components-ai` |  |
| Edge | component |  | `@elabs/components-ai` | A connection between two workspace-graph nodes — animated/temporary or committed. |
| EMPTY_CELL | component |  | `@elabs/components-ai` |  |
| EnvironmentVariable | component |  | `@elabs/components-ai` | One environment variable row — name, masked value, required flag and copy. |
| EnvironmentVariableCopyButton | component |  | `@elabs/components-ai` |  |
| EnvironmentVariableGroup | component |  | `@elabs/components-ai` |  |
| EnvironmentVariableName | component |  | `@elabs/components-ai` |  |
| EnvironmentVariableRequired | component |  | `@elabs/components-ai` |  |
| EnvironmentVariables | component |  | `@elabs/components-ai` |  |
| EnvironmentVariablesContent | component |  | `@elabs/components-ai` |  |
| EnvironmentVariablesHeader | component |  | `@elabs/components-ai` |  |
| EnvironmentVariablesTitle | component |  | `@elabs/components-ai` |  |
| EnvironmentVariablesToggle | component |  | `@elabs/components-ai` |  |
| EnvironmentVariableValue | component |  | `@elabs/components-ai` |  |
| EvidenceChip | component |  | `@elabs/components-ai` |  |
| FileTree | component |  | `@elabs/components-ai` | Hierarchical file/folder list for a workspace — `code` (IDE source tree) or `document` (produced assets) look. |
| FileTreeActions | component |  | `@elabs/components-ai` |  |
| FileTreeFile | component |  | `@elabs/components-ai` |  |
| FileTreeFolder | component |  | `@elabs/components-ai` |  |
| FileTreeIcon | component |  | `@elabs/components-ai` |  |
| FileTreeName | component |  | `@elabs/components-ai` |  |
| Gallery | component |  | `@elabs/components-ai` | Image/asset grid with a +N overflow tile that opens a lightbox Dialog (carousel + metadata). |
| GroupedParts | component |  | `@elabs/components-ai` | Renders an ordered message part list, folding adjacent reasoning/tool parts into collapsible traces. |
| Image | component |  | `@elabs/components-ai` | Renders a model-generated image from its base64 payload. |
| InlineCitation | component |  | `@elabs/components-ai` | Inline source marker whose hover card carries the quote and the source carousel. |
| InlineCitationCard | component |  | `@elabs/components-ai` |  |
| InlineCitationCardBody | component |  | `@elabs/components-ai` |  |
| InlineCitationCardTrigger | component |  | `@elabs/components-ai` |  |
| InlineCitationCarousel | component |  | `@elabs/components-ai` |  |
| InlineCitationCarouselContent | component |  | `@elabs/components-ai` |  |
| InlineCitationCarouselHeader | component |  | `@elabs/components-ai` |  |
| InlineCitationCarouselIndex | component |  | `@elabs/components-ai` |  |
| InlineCitationCarouselItem | component |  | `@elabs/components-ai` |  |
| InlineCitationCarouselNext | component |  | `@elabs/components-ai` |  |
| InlineCitationCarouselPrev | component |  | `@elabs/components-ai` |  |
| InlineCitationQuote | component |  | `@elabs/components-ai` |  |
| InlineCitationSource | component |  | `@elabs/components-ai` |  |
| InlineCitationText | component |  | `@elabs/components-ai` |  |
| InteractiveTerminal | component |  | `@elabs/components-ai` | Streaming terminal surface for agent shell output, with an optional input line. |
| JSXPreview | component |  | `@elabs/components-ai` | Escape-hatch renderer for agent-emitted JSX STRINGS — maximum flexibility, least safety (D2). |
| JSXPreviewContent | component |  | `@elabs/components-ai` |  |
| JSXPreviewError | component |  | `@elabs/components-ai` |  |
| JSXPreviewSkeleton | component |  | `@elabs/components-ai` |  |
| LocalReferencedSourcesContext | component |  | `@elabs/components-ai` |  |
| MarkdownView | component |  | `@elabs/components-ai` | Branded, read-only renderer for a produced markdown document (not a code view). |
| Message | component |  | `@elabs/components-ai` | One conversation turn — `from` decides the side, fill and slot; wraps the turn's content. |
| MessageAction | component |  | `@elabs/components-ai` |  |
| MessageActions | component | appearance=plain*\|bar · reveal=always*\|hover | `@elabs/components-ai` |  |
| MessageAvatar | component |  | `@elabs/components-ai` |  |
| MessageBranch | component |  | `@elabs/components-ai` |  |
| MessageBranchContent | component |  | `@elabs/components-ai` |  |
| MessageBranchNext | component |  | `@elabs/components-ai` |  |
| MessageBranchPage | component |  | `@elabs/components-ai` |  |
| MessageBranchPrevious | component |  | `@elabs/components-ai` |  |
| MessageBranchSelector | component |  | `@elabs/components-ai` |  |
| MessageContent | component |  | `@elabs/components-ai` |  |
| MessageEdit | component |  | `@elabs/components-ai` | Edit-in-place for a user message — swaps the bubble between content and an editor. |
| MessageEditContent | component |  | `@elabs/components-ai` |  |
| MessageEditForm | component |  | `@elabs/components-ai` |  |
| MessageEditProvider | component |  | `@elabs/components-ai` |  |
| MessageEditTrigger | component |  | `@elabs/components-ai` |  |
| MessageFeedback | component | compact=true\|false* | `@elabs/components-ai` | Thumbs up/down on a single assistant message. |
| MessageForm | component |  | `@elabs/components-ai` | A model-emitted, zod-validated form rendered inside a chat message; returns structured values on submit. |
| MessageFormDescription | component |  | `@elabs/components-ai` |  |
| MessageFormFallback | component |  | `@elabs/components-ai` |  |
| MessageFormField | component |  | `@elabs/components-ai` |  |
| MessageFormFields | component |  | `@elabs/components-ai` |  |
| MessageFormProvider | component |  | `@elabs/components-ai` |  |
| MessageFormRoot | component |  | `@elabs/components-ai` |  |
| MessageFormSubmit | component |  | `@elabs/components-ai` |  |
| MessageFormTitle | component |  | `@elabs/components-ai` |  |
| MessageHeader | component |  | `@elabs/components-ai` |  |
| MessageResponse | component |  | `@elabs/components-ai` | Renders streamed assistant markdown (Streamdown) inside a Message. |
| MessageTable | component |  | `@elabs/components-ai` | A model-emitted, column-oriented data table rendered as message content. |
| MessageTableFallback | component |  | `@elabs/components-ai` |  |
| MessageToolbar | component |  | `@elabs/components-ai` |  |
| MicSelector | component |  | `@elabs/components-ai` | Input-device picker for voice capture — a searchable Command list in a Popover. |
| MicSelectorContent | component |  | `@elabs/components-ai` |  |
| MicSelectorEmpty | component |  | `@elabs/components-ai` |  |
| MicSelectorInput | component |  | `@elabs/components-ai` |  |
| MicSelectorItem | component |  | `@elabs/components-ai` |  |
| MicSelectorLabel | component |  | `@elabs/components-ai` |  |
| MicSelectorList | component |  | `@elabs/components-ai` |  |
| MicSelectorTrigger | component |  | `@elabs/components-ai` |  |
| MicSelectorValue | component |  | `@elabs/components-ai` |  |
| MODEL_SELECTOR_LOGO_BASE_URL | component |  | `@elabs/components-ai` |  |
| ModelSelector | component |  | `@elabs/components-ai` | Command-palette picker for the active model, grouped by provider. |
| ModelSelectorContent | component |  | `@elabs/components-ai` |  |
| ModelSelectorDialog | component |  | `@elabs/components-ai` |  |
| ModelSelectorEmpty | component |  | `@elabs/components-ai` |  |
| ModelSelectorGroup | component |  | `@elabs/components-ai` |  |
| ModelSelectorInput | component |  | `@elabs/components-ai` |  |
| ModelSelectorItem | component |  | `@elabs/components-ai` |  |
| ModelSelectorList | component |  | `@elabs/components-ai` |  |
| ModelSelectorLogo | component |  | `@elabs/components-ai` |  |
| ModelSelectorLogoGroup | component |  | `@elabs/components-ai` |  |
| ModelSelectorName | component |  | `@elabs/components-ai` |  |
| ModelSelectorSeparator | component |  | `@elabs/components-ai` |  |
| ModelSelectorShortcut | component |  | `@elabs/components-ai` |  |
| ModelSelectorTrigger | component |  | `@elabs/components-ai` |  |
| Node | component |  | `@elabs/components-ai` | A workspace-graph node — a Card with source/target handles, headed and slotted. |
| NodeAction | component |  | `@elabs/components-ai` |  |
| NodeContent | component |  | `@elabs/components-ai` |  |
| NodeDescription | component |  | `@elabs/components-ai` |  |
| NodeFooter | component |  | `@elabs/components-ai` |  |
| NodeHeader | component |  | `@elabs/components-ai` |  |
| NodeTitle | component |  | `@elabs/components-ai` |  |
| NodeToolbar | component |  | `@elabs/components-ai` | The contextual action bar attached to a selected workspace-graph node. |
| OpenIn | component |  | `@elabs/components-ai` | A menu that hands the current prompt off to an external chat product via a deep link. |
| OpenInChatGPT | component |  | `@elabs/components-ai` |  |
| OpenInClaude | component |  | `@elabs/components-ai` |  |
| OpenInContent | component |  | `@elabs/components-ai` |  |
| OpenInCursor | component |  | `@elabs/components-ai` |  |
| OpenInItem | component |  | `@elabs/components-ai` |  |
| OpenInLabel | component |  | `@elabs/components-ai` |  |
| OpenInScira | component |  | `@elabs/components-ai` |  |
| OpenInSeparator | component |  | `@elabs/components-ai` |  |
| OpenInT3 | component |  | `@elabs/components-ai` |  |
| OpenInTrigger | component |  | `@elabs/components-ai` |  |
| OpenInv0 | component |  | `@elabs/components-ai` |  |
| PackageInfo | component |  | `@elabs/components-ai` | A dependency and its version change — name, current→new version and change type. |
| PackageInfoChangeType | component |  | `@elabs/components-ai` |  |
| PackageInfoContent | component |  | `@elabs/components-ai` |  |
| PackageInfoDependencies | component |  | `@elabs/components-ai` |  |
| PackageInfoDependency | component |  | `@elabs/components-ai` |  |
| PackageInfoDescription | component |  | `@elabs/components-ai` |  |
| PackageInfoHeader | component |  | `@elabs/components-ai` |  |
| PackageInfoName | component |  | `@elabs/components-ai` |  |
| PackageInfoVersion | component |  | `@elabs/components-ai` |  |
| Panel | component |  | `@elabs/components-ai` | A floating overlay panel pinned to a corner of the workspace Canvas. |
| Persona | component |  | `@elabs/components-ai` | The animated agent avatar/presence mark (Rive), used as the assistant's identity. |
| PERSONA_SOURCES | component |  | `@elabs/components-ai` |  |
| Plan | component |  | `@elabs/components-ai` | A Card-shaped, collapsible plan the agent proposes before it starts executing. |
| PlanAction | component |  | `@elabs/components-ai` |  |
| PlanContent | component |  | `@elabs/components-ai` |  |
| PlanDescription | component |  | `@elabs/components-ai` |  |
| PlanFooter | component |  | `@elabs/components-ai` |  |
| PlanHeader | component |  | `@elabs/components-ai` |  |
| PlanTitle | component |  | `@elabs/components-ai` |  |
| PlanTrigger | component |  | `@elabs/components-ai` |  |
| PRODUCED_ASSET_ICONS | component |  | `@elabs/components-ai` |  |
| ProducedAssetTree | component |  | `@elabs/components-ai` | The `document`-flavoured tree of assets the agent produced, for the context rail. |
| PromptInput | component |  | `@elabs/components-ai` | Chat composer FORM (Enter submits) emitting a message to the app's runtime. |
| PromptInputActionAddAttachments | component |  | `@elabs/components-ai` |  |
| PromptInputActionAddScreenshot | component |  | `@elabs/components-ai` |  |
| PromptInputActionMenu | component |  | `@elabs/components-ai` |  |
| PromptInputActionMenuContent | component |  | `@elabs/components-ai` |  |
| PromptInputActionMenuItem | component |  | `@elabs/components-ai` |  |
| PromptInputActionMenuTrigger | component |  | `@elabs/components-ai` |  |
| PromptInputBody | component |  | `@elabs/components-ai` |  |
| PromptInputButton | component |  | `@elabs/components-ai` |  |
| PromptInputCommand | component |  | `@elabs/components-ai` |  |
| PromptInputCommandEmpty | component |  | `@elabs/components-ai` |  |
| PromptInputCommandGroup | component |  | `@elabs/components-ai` |  |
| PromptInputCommandInput | component |  | `@elabs/components-ai` |  |
| PromptInputCommandItem | component |  | `@elabs/components-ai` |  |
| PromptInputCommandList | component |  | `@elabs/components-ai` |  |
| PromptInputCommandSeparator | component |  | `@elabs/components-ai` |  |
| PromptInputFooter | component |  | `@elabs/components-ai` |  |
| PromptInputHeader | component |  | `@elabs/components-ai` |  |
| PromptInputHoverCard | component |  | `@elabs/components-ai` |  |
| PromptInputHoverCardContent | component |  | `@elabs/components-ai` |  |
| PromptInputHoverCardTrigger | component |  | `@elabs/components-ai` |  |
| PromptInputProvider | component |  | `@elabs/components-ai` |  |
| PromptInputSelect | component |  | `@elabs/components-ai` |  |
| PromptInputSelectContent | component |  | `@elabs/components-ai` |  |
| PromptInputSelectItem | component |  | `@elabs/components-ai` |  |
| PromptInputSelectTrigger | component |  | `@elabs/components-ai` |  |
| PromptInputSelectValue | component |  | `@elabs/components-ai` |  |
| PromptInputStop | component |  | `@elabs/components-ai` |  |
| PromptInputSubmit | component |  | `@elabs/components-ai` |  |
| PromptInputTab | component |  | `@elabs/components-ai` |  |
| PromptInputTabBody | component |  | `@elabs/components-ai` |  |
| PromptInputTabItem | component |  | `@elabs/components-ai` |  |
| PromptInputTabLabel | component |  | `@elabs/components-ai` |  |
| PromptInputTabsList | component |  | `@elabs/components-ai` |  |
| PromptInputTextarea | component |  | `@elabs/components-ai` |  |
| PromptInputTools | component |  | `@elabs/components-ai` |  |
| Queue | component |  | `@elabs/components-ai` | The pending work list — queued user messages and agent to-dos, grouped and collapsible. |
| QueueItem | component |  | `@elabs/components-ai` |  |
| QueueItemAction | component |  | `@elabs/components-ai` |  |
| QueueItemActions | component |  | `@elabs/components-ai` |  |
| QueueItemAttachment | component |  | `@elabs/components-ai` |  |
| QueueItemContent | component |  | `@elabs/components-ai` |  |
| QueueItemDescription | component |  | `@elabs/components-ai` |  |
| QueueItemFile | component |  | `@elabs/components-ai` |  |
| QueueItemImage | component |  | `@elabs/components-ai` |  |
| QueueItemIndicator | component |  | `@elabs/components-ai` |  |
| QueueList | component |  | `@elabs/components-ai` |  |
| QueueSection | component |  | `@elabs/components-ai` |  |
| QueueSectionContent | component |  | `@elabs/components-ai` |  |
| QueueSectionLabel | component |  | `@elabs/components-ai` |  |
| QueueSectionTrigger | component |  | `@elabs/components-ai` |  |
| Reasoning | component |  | `@elabs/components-ai` | Collapsible 'thinking' disclosure that auto-opens while the model streams and reports elapsed duration. |
| ReasoningContent | component |  | `@elabs/components-ai` |  |
| ReasoningTrigger | component |  | `@elabs/components-ai` |  |
| Sandbox | component |  | `@elabs/components-ai` | Collapsible, tabbed view of the files/commands a code-running tool worked on. |
| SandboxContent | component |  | `@elabs/components-ai` |  |
| SandboxHeader | component |  | `@elabs/components-ai` |  |
| SandboxTabContent | component |  | `@elabs/components-ai` |  |
| SandboxTabs | component |  | `@elabs/components-ai` |  |
| SandboxTabsBar | component |  | `@elabs/components-ai` |  |
| SandboxTabsList | component |  | `@elabs/components-ai` |  |
| SandboxTabsTrigger | component |  | `@elabs/components-ai` |  |
| SchemaDisplay | component |  | `@elabs/components-ai` | An HTTP endpoint contract in chat — method, path, parameters, request and response shapes. |
| SchemaDisplayBody | component |  | `@elabs/components-ai` |  |
| SchemaDisplayContent | component |  | `@elabs/components-ai` |  |
| SchemaDisplayDescription | component |  | `@elabs/components-ai` |  |
| SchemaDisplayExample | component |  | `@elabs/components-ai` |  |
| SchemaDisplayHeader | component |  | `@elabs/components-ai` |  |
| SchemaDisplayMethod | component |  | `@elabs/components-ai` |  |
| SchemaDisplayParameter | component |  | `@elabs/components-ai` |  |
| SchemaDisplayParameters | component |  | `@elabs/components-ai` |  |
| SchemaDisplayPath | component |  | `@elabs/components-ai` |  |
| SchemaDisplayProperty | component |  | `@elabs/components-ai` |  |
| SchemaDisplayRequest | component |  | `@elabs/components-ai` |  |
| SchemaDisplayResponse | component |  | `@elabs/components-ai` |  |
| SelectionToolbar | component |  | `@elabs/components-ai` | A floating toolbar over selected transcript text, offering Quote as the default action. |
| Shimmer | component |  | `@elabs/components-ai` | Motion-aware shimmering TEXT affordance for an in-progress ("Thinking…") line. |
| Snippet | component |  | `@elabs/components-ai` | One-line copyable command or value, built on the ui InputGroup. |
| SnippetAddon | component |  | `@elabs/components-ai` |  |
| SnippetCopyButton | component |  | `@elabs/components-ai` |  |
| SnippetInput | component |  | `@elabs/components-ai` |  |
| SnippetText | component |  | `@elabs/components-ai` |  |
| Source | component |  | `@elabs/components-ai` |  |
| SourceList | component |  | `@elabs/components-ai` |  |
| Sources | component |  | `@elabs/components-ai` | Collapsible citation list for the sources an answer was grounded in. |
| SourcesContent | component |  | `@elabs/components-ai` |  |
| SourcesTrigger | component |  | `@elabs/components-ai` |  |
| SpeechInput | component |  | `@elabs/components-ai` | Push-to-talk capture for the composer — Web Speech API where available, MediaRecorder elsewhere. |
| StackTrace | component |  | `@elabs/components-ai` | A parsed error stack — error type, message and frames, with internals folded away. |
| StackTraceActions | component |  | `@elabs/components-ai` |  |
| StackTraceContent | component |  | `@elabs/components-ai` |  |
| StackTraceCopyButton | component |  | `@elabs/components-ai` |  |
| StackTraceError | component |  | `@elabs/components-ai` |  |
| StackTraceErrorMessage | component |  | `@elabs/components-ai` |  |
| StackTraceErrorType | component |  | `@elabs/components-ai` |  |
| StackTraceExpandButton | component |  | `@elabs/components-ai` |  |
| StackTraceFrames | component |  | `@elabs/components-ai` |  |
| StackTraceHeader | component |  | `@elabs/components-ai` |  |
| StreamingSuggestions | component |  | `@elabs/components-ai` | The suggestion strip while the set is still being generated. |
| Suggestion | component |  | `@elabs/components-ai` | One tappable follow-up prompt the user can send with a click. |
| SuggestionLoading | component |  | `@elabs/components-ai` |  |
| Suggestions | component |  | `@elabs/components-ai` |  |
| Task | component |  | `@elabs/components-ai` | Collapsed "what got done" run summary, rendered on the canonical AgentTimeline rail. |
| TaskContent | component |  | `@elabs/components-ai` |  |
| TaskItem | component |  | `@elabs/components-ai` |  |
| TaskItemFile | component |  | `@elabs/components-ai` |  |
| TaskTrigger | component |  | `@elabs/components-ai` |  |
| Terminal | component |  | `@elabs/components-ai` | Read-only ANSI console output with copy/clear actions and stick-to-bottom streaming. |
| TerminalActions | component |  | `@elabs/components-ai` |  |
| TerminalClearButton | component |  | `@elabs/components-ai` |  |
| TerminalContent | component |  | `@elabs/components-ai` |  |
| TerminalCopyButton | component |  | `@elabs/components-ai` |  |
| TerminalHeader | component |  | `@elabs/components-ai` |  |
| TerminalStatus | component |  | `@elabs/components-ai` |  |
| TerminalTitle | component |  | `@elabs/components-ai` |  |
| Test | component |  | `@elabs/components-ai` | One test-case row inside a test-results block — name, status and duration. |
| TestDuration | component |  | `@elabs/components-ai` |  |
| TestError | component |  | `@elabs/components-ai` |  |
| TestErrorMessage | component |  | `@elabs/components-ai` |  |
| TestErrorStack | component |  | `@elabs/components-ai` |  |
| TestName | component |  | `@elabs/components-ai` |  |
| TestResults | component |  | `@elabs/components-ai` |  |
| TestResultsContent | component |  | `@elabs/components-ai` |  |
| TestResultsDuration | component |  | `@elabs/components-ai` |  |
| TestResultsHeader | component |  | `@elabs/components-ai` |  |
| TestResultsMeta | component |  | `@elabs/components-ai` |  |
| TestResultsProgress | component |  | `@elabs/components-ai` |  |
| TestResultsSummary | component |  | `@elabs/components-ai` |  |
| TestStatus | component |  | `@elabs/components-ai` |  |
| TestSuite | component |  | `@elabs/components-ai` |  |
| TestSuiteContent | component |  | `@elabs/components-ai` |  |
| TestSuiteName | component |  | `@elabs/components-ai` |  |
| TestSuiteStats | component |  | `@elabs/components-ai` |  |
| Tool | component |  | `@elabs/components-ai` | Renders one AI SDK ToolUIPart — header (type + state), the input, and the output or error. |
| Toolbar | component |  | `@elabs/components-ai` | A dense row of controls that acts on nearby content, collapsed into ONE tab stop with arrow-key navigation between the controls. |
| ToolContent | component |  | `@elabs/components-ai` |  |
| ToolDetails | component |  | `@elabs/components-ai` |  |
| ToolHeader | component |  | `@elabs/components-ai` |  |
| ToolInput | component |  | `@elabs/components-ai` |  |
| ToolOutput | component |  | `@elabs/components-ai` |  |
| ToolResultCard | component |  | `@elabs/components-ai` | The artifact a tool PRODUCED, presented as the headline — raised surface, no border, children carry the payload. Its header row is title \| actions \| status, where actions are scoped to the whole artifact (expand, download, open). |
| Transcription | component |  | `@elabs/components-ai` | Time-coded speech segments, highlighted against playback position and seekable. |
| TranscriptionSegment | component |  | `@elabs/components-ai` |  |
| useAssetPreviewRenderer | hook |  | `@elabs/components-ai` |  |
| useAttachmentContext | hook |  | `@elabs/components-ai` |  |
| useAttachmentsContext | hook |  | `@elabs/components-ai` |  |
| useAudioDevices | hook |  | `@elabs/components-ai` |  |
| useContextPanel | hook |  | `@elabs/components-ai` |  |
| useJSXPreview | hook |  | `@elabs/components-ai` |  |
| useMessageEdit | hook |  | `@elabs/components-ai` |  |
| usePromptInputAttachments | hook |  | `@elabs/components-ai` |  |
| usePromptInputController | hook |  | `@elabs/components-ai` |  |
| usePromptInputReferencedSources | hook |  | `@elabs/components-ai` |  |
| useProviderAttachments | hook |  | `@elabs/components-ai` |  |
| useReasoning | hook |  | `@elabs/components-ai` |  |
| UserMessage | component |  | `@elabs/components-ai` |  |
| useVoiceSelector | hook |  | `@elabs/components-ai` |  |
| VoiceSelector | component |  | `@elabs/components-ai` | Voice picker for speech output — searchable list with per-voice attributes and preview. |
| VoiceSelectorAccent | component |  | `@elabs/components-ai` |  |
| VoiceSelectorAge | component |  | `@elabs/components-ai` |  |
| VoiceSelectorAttributes | component |  | `@elabs/components-ai` |  |
| VoiceSelectorBullet | component |  | `@elabs/components-ai` |  |
| VoiceSelectorContent | component |  | `@elabs/components-ai` |  |
| VoiceSelectorDescription | component |  | `@elabs/components-ai` |  |
| VoiceSelectorDialog | component |  | `@elabs/components-ai` |  |
| VoiceSelectorEmpty | component |  | `@elabs/components-ai` |  |
| VoiceSelectorGender | component |  | `@elabs/components-ai` |  |
| VoiceSelectorGroup | component |  | `@elabs/components-ai` |  |
| VoiceSelectorInput | component |  | `@elabs/components-ai` |  |
| VoiceSelectorItem | component |  | `@elabs/components-ai` |  |
| VoiceSelectorList | component |  | `@elabs/components-ai` |  |
| VoiceSelectorName | component |  | `@elabs/components-ai` |  |
| VoiceSelectorPreview | component |  | `@elabs/components-ai` |  |
| VoiceSelectorSeparator | component |  | `@elabs/components-ai` |  |
| VoiceSelectorShortcut | component |  | `@elabs/components-ai` |  |
| VoiceSelectorTrigger | component |  | `@elabs/components-ai` |  |
| WebPreview | component |  | `@elabs/components-ai` | Framed preview of a URL the agent produced, with a URL bar and a console drawer. |
| WebPreviewBody | component |  | `@elabs/components-ai` |  |
| WebPreviewConsole | component |  | `@elabs/components-ai` |  |
| WebPreviewNavigation | component |  | `@elabs/components-ai` |  |
| WebPreviewNavigationButton | component |  | `@elabs/components-ai` |  |
| WebPreviewUrl | component |  | `@elabs/components-ai` |  |

## @elabs/components-flow

> Branded React Flow canvas, nodes, edges, controls, inspector.

| Name | Kind | Variants | Import | Notes |
| --- | --- | --- | --- | --- |
| Background | component |  | `@elabs/components-flow` |  |
| CanvasShell | component |  | `@elabs/components-flow` | Branded React Flow canvas wrapper with token-driven background + sane defaults. |
| Controls | component |  | `@elabs/components-flow` | Zoom / fit / lock controls for the agent workspace Canvas. |
| FLOW_ALL_SIDE_HANDLES | component |  | `@elabs/components-flow` |  |
| FLOW_GROUP_NODE_TYPE | component |  | `@elabs/components-flow` |  |
| FlowButtonEdge | component |  | `@elabs/components-flow` |  |
| FlowEdge | component |  | `@elabs/components-flow` |  |
| FlowFloatingEdge | component |  | `@elabs/components-flow` |  |
| FlowGroupNode | component |  | `@elabs/components-flow` |  |
| FlowMiniMap | component |  | `@elabs/components-flow` |  |
| FlowNode | component |  | `@elabs/components-flow` | Branded custom React Flow node (title/subtitle/kind/icon/tone). |
| FlowPlaceholderNode | component |  | `@elabs/components-flow` |  |
| FlowSmartEdge | component |  | `@elabs/components-flow` |  |
| HANDLE_SIDES | component |  | `@elabs/components-flow` |  |
| HelperLines | component |  | `@elabs/components-flow` |  |
| InspectorPanel | component |  | `@elabs/components-flow` |  |
| Legend | component |  | `@elabs/components-flow` |  |
| MiniMap | component |  | `@elabs/components-flow` |  |
| Panel | component |  | `@elabs/components-flow` | A floating overlay panel pinned to a corner of the workspace Canvas. |
| Position | component |  | `@elabs/components-flow` |  |
| ReactFlow | component |  | `@elabs/components-flow` |  |
| ReactFlowProvider | component |  | `@elabs/components-flow` |  |
| useAutoLayout | hook |  | `@elabs/components-flow` |  |
| useEdgesState | hook |  | `@elabs/components-flow` |  |
| useFlowGroups | hook |  | `@elabs/components-flow` |  |
| useFlowLayout | hook |  | `@elabs/components-flow` |  |
| useHelperLines | hook |  | `@elabs/components-flow` |  |
| useNodesState | hook |  | `@elabs/components-flow` |  |
| useReactFlow | hook |  | `@elabs/components-flow` |  |
| ZoomControls | component |  | `@elabs/components-flow` |  |

## @elabs/components-maps

> MapLibre GL maps: MapCanvas, markers, popups, controls, routes, arcs, GeoJSON, clusters.

| Name | Kind | Variants | Import | Notes |
| --- | --- | --- | --- | --- |
| MapArc | component |  | `@elabs/components-maps` |  |
| MapCanvas | component |  | `@elabs/components-maps` | Root MapLibre canvas — theme-aware basemap; the ref is the raw MapLibre Map. |
| MapClusterLayer | component |  | `@elabs/components-maps` | Clusters dense point data into count bubbles that split apart as you zoom in. |
| MapControls | component |  | `@elabs/components-maps` |  |
| MapGeoJSON | component |  | `@elabs/components-maps` |  |
| MapMarker | component |  | `@elabs/components-maps` | A point on the map, optionally carrying content, a label, a popup or a tooltip. |
| MapMarkerContent | component |  | `@elabs/components-maps` |  |
| MapMarkerLabel | component |  | `@elabs/components-maps` |  |
| MapMarkerPopup | component |  | `@elabs/components-maps` |  |
| MapMarkerTooltip | component |  | `@elabs/components-maps` |  |
| MapPopup | component |  | `@elabs/components-maps` | Standalone anchored popup on the map (not bound to a marker). |
| MapRoute | component |  | `@elabs/components-maps` |  |
| useMap | hook |  | `@elabs/components-maps` |  |

## @elabs/components-charts

> MetricCard, MetricGrid, ChartCard, ChartFrame (expand/flip/download).

| Name | Kind | Variants | Import | Notes |
| --- | --- | --- | --- | --- |
| Area | component |  | `@elabs/components-charts` |  |
| AreaChart | component |  | `@elabs/components-charts` | Cumulative or part-of-whole trend over time — a filled line. |
| AreaChartLoading | component |  | `@elabs/components-charts` |  |
| AutoChart | component |  | `@elabs/components-charts` | Spec-driven chart — hand it a serializable ChartSpec and it picks and renders the right chart. |
| Bar | component |  | `@elabs/components-charts` |  |
| BarChart | component |  | `@elabs/components-charts` | Categorical comparison — composed from Bar + BarXAxis/BarYAxis inside its provider. |
| BarXAxis | component |  | `@elabs/components-charts` |  |
| BarYAxis | component |  | `@elabs/components-charts` |  |
| Candlestick | component |  | `@elabs/components-charts` |  |
| CandlestickChart | component |  | `@elabs/components-charts` |  |
| CHART_CLIP_PASSTHROUGH | component |  | `@elabs/components-charts` |  |
| ChartBrush | component |  | `@elabs/components-charts` |  |
| ChartBrushLayout | component |  | `@elabs/components-charts` |  |
| ChartBrushSelectionOverlay | component |  | `@elabs/components-charts` |  |
| ChartBrushTrackOverlay | component |  | `@elabs/components-charts` |  |
| ChartCard | component |  | `@elabs/components-charts` | Titled card surface around a chart — header, description, and the chart body. |
| ChartConfigProvider | component |  | `@elabs/components-charts` |  |
| ChartDatapointLayer | component |  | `@elabs/components-charts` |  |
| ChartDatapointProvider | component |  | `@elabs/components-charts` |  |
| ChartFallback | component |  | `@elabs/components-charts` |  |
| ChartFrame | component |  | `@elabs/components-charts` | Opt-in chart wrapper adding expand / flip-to-table / download-CSV to any chart child. |
| ChartLegend | component |  | `@elabs/components-charts` | Series key with label, value and an optional progress bar; pattern-aware under decoration. |
| ChartLegendHoverProvider | component |  | `@elabs/components-charts` |  |
| ChartLoadingLabel | component |  | `@elabs/components-charts` |  |
| ChartMarkers | component |  | `@elabs/components-charts` |  |
| ChartProvider | component |  | `@elabs/components-charts` |  |
| ChartRevealClip | component |  | `@elabs/components-charts` |  |
| ChartStatFlow | component |  | `@elabs/components-charts` |  |
| ChartTooltip | component |  | `@elabs/components-charts` | Hover readout for the point/series under the pointer. |
| ChartTooltipBox | component |  | `@elabs/components-charts` |  |
| ChartTooltipContent | component |  | `@elabs/components-charts` |  |
| ChartTooltipDot | component |  | `@elabs/components-charts` |  |
| ChartTooltipIndicator | component |  | `@elabs/components-charts` |  |
| ChoroplethChart | component |  | `@elabs/components-charts` | Region-shaded map for a measure that is defined per geographic area. |
| ChoroplethFeatureComponent | component |  | `@elabs/components-charts` |  |
| ChoroplethGraticule | component |  | `@elabs/components-charts` |  |
| ChoroplethProvider | component |  | `@elabs/components-charts` |  |
| ChoroplethTooltip | component |  | `@elabs/components-charts` |  |
| ComposedChart | component |  | `@elabs/components-charts` | One cartesian frame that layers several series types (bars + lines + areas) together. |
| DateTicker | component |  | `@elabs/components-charts` |  |
| DEFAULT_CHART_CONFIG | component |  | `@elabs/components-charts` |  |
| DEFAULT_CHART_LIFECYCLE | component |  | `@elabs/components-charts` |  |
| DEFAULT_CHART_STATUS | component |  | `@elabs/components-charts` |  |
| DEFAULT_HOVER_OFFSET | component |  | `@elabs/components-charts` |  |
| DEFAULT_MAX_INTERACTIVE_DATAPOINTS | component |  | `@elabs/components-charts` |  |
| DEFAULT_Y_AXIS_ID | component |  | `@elabs/components-charts` |  |
| DEFAULT_Y_DOMAIN_TWEEN_MS | component |  | `@elabs/components-charts` |  |
| FunnelChart | component |  | `@elabs/components-charts` | Stage-by-stage drop-off through an ordered pipeline. |
| Gantt | component | density=comfortable*\|compact | `@elabs/components-charts` | Schedule grid — tasks as bars over time, with a task table beside them. |
| GANTT_NOMINAL_VIEWPORT_PX | component |  | `@elabs/components-charts` |  |
| GANTT_UNIT_MS | component |  | `@elabs/components-charts` |  |
| Gauge | component |  | `@elabs/components-charts` | Single-value dial against a known range — a KPI with an explicit ceiling. |
| GradientDarkgreenGreen | component |  | `@elabs/components-charts` |  |
| GradientLightgreenGreen | component |  | `@elabs/components-charts` |  |
| GradientOrangeRed | component |  | `@elabs/components-charts` |  |
| GradientPinkBlue | component |  | `@elabs/components-charts` |  |
| GradientPinkRed | component |  | `@elabs/components-charts` |  |
| GradientPurpleOrange | component |  | `@elabs/components-charts` |  |
| GradientPurpleTeal | component |  | `@elabs/components-charts` |  |
| GradientSteelPurple | component |  | `@elabs/components-charts` |  |
| GradientTealBlue | component |  | `@elabs/components-charts` |  |
| Grid | component |  | `@elabs/components-charts` |  |
| Legend | component |  | `@elabs/components-charts` |  |
| LegendItemComponent | component |  | `@elabs/components-charts` |  |
| LegendLabel | component |  | `@elabs/components-charts` |  |
| LegendMarker | component |  | `@elabs/components-charts` |  |
| LegendProgress | component |  | `@elabs/components-charts` |  |
| LegendValue | component |  | `@elabs/components-charts` |  |
| Line | component |  | `@elabs/components-charts` |  |
| LinearGradient | component |  | `@elabs/components-charts` |  |
| LineChart | component |  | `@elabs/components-charts` | Trend over a continuous (usually time) axis. |
| LineChartLoading | component |  | `@elabs/components-charts` |  |
| LineLoadingPulseStroke | component |  | `@elabs/components-charts` |  |
| LiveLine | component |  | `@elabs/components-charts` |  |
| LiveLineChart | component |  | `@elabs/components-charts` |  |
| LiveXAxis | component |  | `@elabs/components-charts` |  |
| LiveYAxis | component |  | `@elabs/components-charts` |  |
| MarkerGroup | component |  | `@elabs/components-charts` |  |
| MarkerTooltipContent | component |  | `@elabs/components-charts` |  |
| MetricCard | component |  | `@elabs/components-charts` | Single KPI tile — label, value, delta/trend. |
| MetricGrid | component |  | `@elabs/components-charts` | Responsive grid of KPI tiles — the summary row at the top of a dashboard. |
| MIN_DATAPOINT_TARGET_SIZE | component |  | `@elabs/components-charts` |  |
| PatternArea | component |  | `@elabs/components-charts` |  |
| PatternCircles | component |  | `@elabs/components-charts` |  |
| PatternHexagons | component |  | `@elabs/components-charts` |  |
| PatternLines | component |  | `@elabs/components-charts` |  |
| PatternWaves | component |  | `@elabs/components-charts` |  |
| PieCenter | component |  | `@elabs/components-charts` |  |
| PieCenterShell | component |  | `@elabs/components-charts` |  |
| PieChart | component |  | `@elabs/components-charts` | Part-of-whole split across a handful of categories. |
| PieProvider | component |  | `@elabs/components-charts` |  |
| PieSlice | component |  | `@elabs/components-charts` |  |
| PROFIT_LOSS_LEGEND_ITEMS | component |  | `@elabs/components-charts` |  |
| PROFIT_LOSS_NEGATIVE_COLOR | component |  | `@elabs/components-charts` |  |
| PROFIT_LOSS_POSITIVE_COLOR | component |  | `@elabs/components-charts` |  |
| PROFIT_LOSS_TOOLTIP_LABEL_FALLBACK | component |  | `@elabs/components-charts` |  |
| ProfitLossLegend | component |  | `@elabs/components-charts` |  |
| ProfitLossLegendHoverProvider | component |  | `@elabs/components-charts` |  |
| ProfitLossLine | component |  | `@elabs/components-charts` |  |
| RadarArea | component |  | `@elabs/components-charts` |  |
| RadarAxis | component |  | `@elabs/components-charts` |  |
| RadarChart | component |  | `@elabs/components-charts` | Multi-metric profile comparison on a shared radial axis. |
| RadarGrid | component |  | `@elabs/components-charts` |  |
| RadarLabels | component |  | `@elabs/components-charts` |  |
| RadarProvider | component |  | `@elabs/components-charts` |  |
| RadialGradient | component |  | `@elabs/components-charts` |  |
| Ring | component |  | `@elabs/components-charts` |  |
| RingCenter | component |  | `@elabs/components-charts` |  |
| RingChart | component |  | `@elabs/components-charts` |  |
| RingProvider | component |  | `@elabs/components-charts` |  |
| SankeyChart | component |  | `@elabs/components-charts` | Flow diagram — how quantity moves between stages or nodes. |
| SankeyLink | component |  | `@elabs/components-charts` |  |
| SankeyNode | component |  | `@elabs/components-charts` |  |
| SankeyProvider | component |  | `@elabs/components-charts` |  |
| SankeyTooltip | component |  | `@elabs/components-charts` |  |
| Scatter | component |  | `@elabs/components-charts` |  |
| ScatterChart | component |  | `@elabs/components-charts` | Point cloud for correlation between two continuous measures. |
| SegmentBackground | component |  | `@elabs/components-charts` |  |
| SegmentLineFrom | component |  | `@elabs/components-charts` |  |
| SegmentLineTo | component |  | `@elabs/components-charts` |  |
| SeriesBar | component |  | `@elabs/components-charts` |  |
| SeriesMarkers | component |  | `@elabs/components-charts` |  |
| SeriesPointMarker | component |  | `@elabs/components-charts` |  |
| Sparkline | component |  | `@elabs/components-charts` | Tiny, axis-less trend that lives inside a KPI tile or a table cell. |
| StaticChartPreviewProvider | component |  | `@elabs/components-charts` |  |
| useActivateDatapoint | hook |  | `@elabs/components-charts` |  |
| useActiveMarkers | hook |  | `@elabs/components-charts` |  |
| useAnimatedYDomains | hook |  | `@elabs/components-charts` |  |
| useChart | hook |  | `@elabs/components-charts` |  |
| useChartConfig | hook |  | `@elabs/components-charts` |  |
| useChartDatapointsEnabled | hook |  | `@elabs/components-charts` |  |
| useChartHover | hook |  | `@elabs/components-charts` |  |
| useChartInteraction | hook |  | `@elabs/components-charts` |  |
| useChartLegendHover | hook |  | `@elabs/components-charts` |  |
| useChartStable | hook |  | `@elabs/components-charts` |  |
| useChoropleth | hook |  | `@elabs/components-charts` |  |
| useChoroplethZoom | hook |  | `@elabs/components-charts` |  |
| useHighDecoration | hook |  | `@elabs/components-charts` |  |
| useHighDecorationOf | hook |  | `@elabs/components-charts` |  |
| useLegend | hook |  | `@elabs/components-charts` |  |
| useLegendItem | hook |  | `@elabs/components-charts` |  |
| usePie | hook |  | `@elabs/components-charts` |  |
| usePieHover | hook |  | `@elabs/components-charts` |  |
| usePieStable | hook |  | `@elabs/components-charts` |  |
| useProfitLossLegendHover | hook |  | `@elabs/components-charts` |  |
| useRadar | hook |  | `@elabs/components-charts` |  |
| useRadarHover | hook |  | `@elabs/components-charts` |  |
| useRadarStable | hook |  | `@elabs/components-charts` |  |
| useRegisterDatapointTargets | hook |  | `@elabs/components-charts` |  |
| useResolvedRadius | hook |  | `@elabs/components-charts` |  |
| useResolvedRadiusOf | hook |  | `@elabs/components-charts` |  |
| useRing | hook |  | `@elabs/components-charts` |  |
| useRingHover | hook |  | `@elabs/components-charts` |  |
| useRingStable | hook |  | `@elabs/components-charts` |  |
| useSankey | hook |  | `@elabs/components-charts` |  |
| useStaticChartPreview | hook |  | `@elabs/components-charts` |  |
| useYScale | hook |  | `@elabs/components-charts` |  |
| XAxis | component |  | `@elabs/components-charts` |  |
| Y_AXIS_DEFAULT_TICK_COUNT | component |  | `@elabs/components-charts` |  |
| Y_AXIS_MAX_TICK_COUNT | component |  | `@elabs/components-charts` |  |
| Y_AXIS_MIN_TICK_COUNT | component |  | `@elabs/components-charts` |  |
| YAxis | component |  | `@elabs/components-charts` |  |

## @elabs/components-marketing

> Hero, FeatureGrid, UseCaseCard, StatsBand, CTASection, LogoStrip.

| Name | Kind | Variants | Import | Notes |
| --- | --- | --- | --- | --- |
| CTASection | component |  | `@elabs/components-marketing` | Closing conversion band — one message, one action. |
| FeatureGrid | component |  | `@elabs/components-marketing` | Grid of capability cards below the hero. |
| Hero | component |  | `@elabs/components-marketing` | Above-the-fold marketing headline, subcopy and the primary call to action. |
| LogoStrip | component |  | `@elabs/components-marketing` |  |
| StatsBand | component |  | `@elabs/components-marketing` |  |
| UseCaseCard | component |  | `@elabs/components-marketing` |  |

## @elabs/components-editor

> Token-themed Monaco editor: CodeEditor, DiffEditor, CodeWorkspace.

| Name | Kind | Variants | Import | Notes |
| --- | --- | --- | --- | --- |
| CodeEditor | component |  | `@elabs/components-editor` | Monaco-backed editable code editor (controlled/uncontrolled), themed from tokens. |
| CodeWorkspace | component |  | `@elabs/components-editor` |  |
| CopyButton | component |  | `@elabs/components-editor` |  |
| DiffEditor | component |  | `@elabs/components-editor` |  |
| EDITOR_LANGUAGES | component |  | `@elabs/components-editor` |  |
| EditorContextMenu | component |  | `@elabs/components-editor` |  |
| EditorToolbar | component |  | `@elabs/components-editor` |  |
| MarkdownEditor | component |  | `@elabs/components-editor` |  |
| useDataTheme | hook |  | `@elabs/components-editor` |  |
| Bibliography | component |  | `@elabs/components-editor/markdown` |  |
| Blockquote | component |  | `@elabs/components-editor/markdown` |  |
| BRAND_DIRECTIVES | component |  | `@elabs/components-editor/markdown` |  |
| BRAND_SLASH_COMMANDS | component |  | `@elabs/components-editor/markdown` |  |
| CALC_FENCE_SEED | component |  | `@elabs/components-editor/markdown` |  |
| CalcBlock | component |  | `@elabs/components-editor/markdown` |  |
| CalcInline | component |  | `@elabs/components-editor/markdown` |  |
| DECISION_STATUSES | component |  | `@elabs/components-editor/markdown` |  |
| DecisionCard | component |  | `@elabs/components-editor/markdown` |  |
| DEFAULT_TEMPLATE | component |  | `@elabs/components-editor/markdown` |  |
| DocumentOutline | component |  | `@elabs/components-editor/markdown` |  |
| ENTITY_KINDS | component |  | `@elabs/components-editor/markdown` |  |
| EntityCard | component |  | `@elabs/components-editor/markdown` |  |
| EntityChip | component |  | `@elabs/components-editor/markdown` |  |
| FootnoteList | component |  | `@elabs/components-editor/markdown` |  |
| Heading | component |  | `@elabs/components-editor/markdown` |  |
| InlineCode | component |  | `@elabs/components-editor/markdown` |  |
| IterationBlock | component |  | `@elabs/components-editor/markdown` |  |
| IterationBuilderDialog | component |  | `@elabs/components-editor/markdown` |  |
| IterationBuilderProvider | component |  | `@elabs/components-editor/markdown` |  |
| IterationEditContext | component |  | `@elabs/components-editor/markdown` |  |
| IterationTemplateDialog | component |  | `@elabs/components-editor/markdown` |  |
| IterationTemplateProvider | component |  | `@elabs/components-editor/markdown` |  |
| KnowledgeCard | component |  | `@elabs/components-editor/markdown` |  |
| Link | component |  | `@elabs/components-editor/markdown` |  |
| List | component |  | `@elabs/components-editor/markdown` |  |
| ListItem | component |  | `@elabs/components-editor/markdown` |  |
| MARKDOWN_HEADING_REM | component |  | `@elabs/components-editor/markdown` |  |
| MARKDOWN_HEADING_TRACKING | component |  | `@elabs/components-editor/markdown` |  |
| MARKDOWN_HEADING_WEIGHT | component |  | `@elabs/components-editor/markdown` |  |
| MARKDOWN_MEASURE | component |  | `@elabs/components-editor/markdown` |  |
| MarkdownEditor | component |  | `@elabs/components-editor/markdown` |  |
| MarkdownPreview | component |  | `@elabs/components-editor/markdown` |  |
| MarkdownToolbar | component |  | `@elabs/components-editor/markdown` |  |
| MarkdownWorkspace | component |  | `@elabs/components-editor/markdown` |  |
| MathBlock | component |  | `@elabs/components-editor/markdown` |  |
| MathInline | component |  | `@elabs/components-editor/markdown` |  |
| MermaidDiagram | component |  | `@elabs/components-editor/markdown` |  |
| MermaidWorkspace | component |  | `@elabs/components-editor/markdown` |  |
| MetricBlock | component |  | `@elabs/components-editor/markdown` |  |
| MonacoSlashMenu | component |  | `@elabs/components-editor/markdown` |  |
| SlashMenu | component |  | `@elabs/components-editor/markdown` |  |
| TableOfContents | component |  | `@elabs/components-editor/markdown` |  |
| Text | component |  | `@elabs/components-editor/markdown` |  |
| Timeline | component |  | `@elabs/components-editor/markdown` |  |
| useMarkdownOutline | hook |  | `@elabs/components-editor/markdown` |  |

## @elabs/components-viewer

> FileViewer — any file (image, text, JSON, CSV) via a pluggable adapter registry.

| Name | Kind | Variants | Import | Notes |
| --- | --- | --- | --- | --- |
| ACTIVE_HIGHLIGHT_SELECTOR | component |  | `@elabs/components-viewer` |  |
| DEFAULT_ZOOM | component |  | `@elabs/components-viewer` |  |
| FileViewer | component |  | `@elabs/components-viewer` | Render a file the app did not write (upload, signed URL, agent output) — detects the format, loads the matching adapter on demand, draws it with brand-ui components. |
| FileViewerContent | component |  | `@elabs/components-viewer` |  |
| FileViewerEmpty | component |  | `@elabs/components-viewer` |  |
| FileViewerError | component |  | `@elabs/components-viewer` |  |
| FileViewerFind | component |  | `@elabs/components-viewer` |  |
| FileViewerFrame | component |  | `@elabs/components-viewer` |  |
| FileViewerHighlightStatus | component |  | `@elabs/components-viewer` |  |
| FileViewerPager | component |  | `@elabs/components-viewer` |  |
| FileViewerProvider | component |  | `@elabs/components-viewer` |  |
| FileViewerRotate | component |  | `@elabs/components-viewer` |  |
| FileViewerSkeleton | component |  | `@elabs/components-viewer` |  |
| FileViewerToolbar | component |  | `@elabs/components-viewer` |  |
| FileViewerZoom | component |  | `@elabs/components-viewer` |  |
| FIND_MATCH_LIMIT | component |  | `@elabs/components-viewer` |  |
| PROTOCOL_VERSION | component |  | `@elabs/components-viewer` |  |
| useFileViewer | hook |  | `@elabs/components-viewer` |  |
| useScrollActiveHighlightIntoView | hook |  | `@elabs/components-viewer` |  |
| VIEWER_ZOOM_STEPS | component |  | `@elabs/components-viewer` |  |
| ViewerError | component |  | `@elabs/components-viewer` |  |

---

_Generated by `@elabs/components-cli`. The live, queryable surface is `brand-ui docs <Component>` (real props) and, when the Storybook dev server is up, the `mcp__storybook__*` tools._
