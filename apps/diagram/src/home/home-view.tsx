/** One browse surface for workspace documents, reusable content and the product catalog. */
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Heading,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  StatePanel,
  SheetTrigger,
  Text,
  cn,
} from "@elabs-ai/components-ui";
import {
  ArrowLeft,
  ArrowRight,
  Boxes,
  ChevronDown,
  Clock3,
  FileBox,
  FilePlus,
  FolderTree,
  Grid2X2,
  LayoutTemplate,
  Library,
  List,
  Plus,
  Search,
  X,
} from "lucide-react";
import { useWorkspace, workspaceActions } from "../workspace/workspace-store";
import { openDoc } from "../shell/mode-store";
import { catalogService } from "../catalog/catalog-service";
import { refreshSearchIndex } from "../workspace/search-index";
import type { Route } from "../routes/use-hash";
import { browseResults, useBrowserItems, type BrowseItem } from "./browser-model";
import {
  browserActions,
  browserParams,
  browserScroll,
  browserStateStore,
  rememberBrowserScroll,
  useBrowserState,
  type BrowserCollection,
  type BrowserState,
} from "./browser-state";
import { useBrowserHistory } from "./browser-history";
import { BrowserResultsView, kindLabel } from "./browser-results";
import { BrowserPreview } from "./browser-preview";
import { BrowserNavigation } from "./browser-navigation";
import { ConnectDialog } from "./connect-dialog";
import { createAndOpen, START_LABELS } from "./start-from";

const LABELS = {
  catalogOffline: "Showing the bundled catalog",
  catalogStale: "Showing the last available catalog",
  retryCatalog: "Retry catalog",
  retryContents: "Retry content search",
  new: "New",
  newDiagram: "New diagram",
  fromTemplate: "From template",
  searchEverything: "Search everything",
  catalogIsPartiallyAvailableSomeEntriesCould:
    "Catalog is partially available. Some entries could not be loaded.",
  someDocumentContentsCouldNotBeSearched:
    "Some document contents could not be searched. Matching names remain available.",
  browseCatalog: "Browse catalog",
  workspaceUnavailable: "Workspace unavailable",
  retryWorkspace: "Retry workspace",
  searchingContentsResultsMayStillBeArriving: "Searching contents… Results may still be arriving.",
  workspace: "Workspace",
  browseDiagrams: "Browse diagrams",
  exploreTemplates: "Explore templates",
  previous: "Previous",
  next: "Next",
  inspectThisItemBeforeOpeningOrReusing: "Inspect this item before opening or reusing it.",
  searchLibrary: "Search library",
  searchDiagramsComponentsCatalog: "Search diagrams, components, catalog…",
  clearSearch: "Clear search",
  libraryCollections: "Library collections",
  viewLayout: "View layout",
  catalogEntryNotFound: "Catalog entry not found",
  thisReferenceIsNoLongerAvailableIn: "This reference is no longer available in the catalog.",
  folderBreadcrumbs: "Folder breadcrumbs",
  findingYourLibrary: "Finding your library…",
  previousPage: "Previous page",
  nextPage: "Next page",
  browseLibrary: "Browse library",
  libraryNavigation: "Library navigation",
  libraryResults: "Library results",
  browseDescription: "Choose a collection, folder or catalog vendor.",
} as const;

const collections = [
  { id: "recent", label: "Recent", icon: Clock3, hint: "Pick up where you left off." },
  {
    id: "diagrams",
    label: "Diagrams",
    icon: FileBox,
    hint: "Your architectures, all in one place.",
  },
  {
    id: "components",
    label: "Components",
    icon: Boxes,
    hint: "Reusable building blocks from your workspace.",
  },
  {
    id: "templates",
    label: "Templates",
    icon: LayoutTemplate,
    hint: "A starting point for your next diagram.",
  },
  {
    id: "catalog",
    label: "Catalog",
    icon: Library,
    hint: "Products and parts for your architecture.",
  },
] as const;

function BrowserSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger size="sm" aria-label={label} className="w-auto min-w-28 max-w-48 shrink-0">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function HomeView({ route }: { route?: Route }) {
  const state = useBrowserState();
  const {
    items,
    folders,
    indexReady,
    indexErrors,
    catalogLoaded,
    catalogProblems,
    catalogError,
    catalogLive,
    treeError,
  } = useBrowserItems();
  const tree = useWorkspace((s) => s.tree);
  const history = useBrowserHistory();
  const [query, setQuery] = useState(state.query);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [navigationOpen, setNavigationOpen] = useState(false);
  const scroll = useRef<HTMLDivElement>(null);
  const previewTrigger = useRef<HTMLElement | null>(null);
  const detailOrigin = useRef<string | null>(null);
  const priorBrowse = useRef<BrowserState | null>(null);
  const queryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hash = typeof window === "undefined" ? "#home" : window.location.hash;
  const collection = collections.find((c) => c.id === state.collection) ?? collections[0];
  const results = useMemo(
    () => browseResults(items, state, history, folders),
    [items, state, history, folders],
  );
  const vendors = useMemo(
    () =>
      [
        ...new Set(items.flatMap((item) => (item.source === "catalog" ? [item.vendor] : []))),
      ].sort(),
    [items],
  );
  const catalogKinds = [
    ...new Set(
      items.flatMap((item) =>
        item.source === "catalog" && item.catalog.kind ? [item.catalog.kind] : [],
      ),
    ),
  ].sort();
  const catalogTags = [
    ...new Set(items.flatMap((item) => (item.source === "catalog" ? item.catalog.tags : []))),
  ].sort();
  const catalogDetail =
    route?.kind === "catalog" && route.vendor && route.entry
      ? `catalog:${route.vendor}/${route.entry}`
      : null;
  const selected = items.find((item) => item.id === (previewId ?? catalogDetail));
  const searching = state.query.trim() !== "";
  const loading =
    (!tree && !treeError && state.collection !== "catalog") ||
    (!catalogLoaded && (state.collection === "catalog" || searching));

  useEffect(() => {
    if (queryTimer.current) clearTimeout(queryTimer.current);
    setQuery(state.query);
  }, [state.query]);
  useEffect(() => {
    const pane = scroll.current;
    if (pane) pane.scrollTop = browserScroll(hash);
    return () => {
      if (pane) rememberBrowserScroll(hash, pane.scrollTop);
    };
  }, [hash]);
  useEffect(
    () => () => {
      if (queryTimer.current) clearTimeout(queryTimer.current);
    },
    [],
  );

  const update = (patch: Partial<BrowserState>, replace = false) => {
    if (scroll.current) rememberBrowserScroll(hash, scroll.current.scrollTop);
    browserActions.patch(patch);
    const nextHash = `#home${browserParams(browserStateStore.get())}`;
    if (replace) {
      const oldURL = window.location.href;
      window.history.replaceState(null, "", nextHash);
      window.dispatchEvent(
        new HashChangeEvent("hashchange", { oldURL, newURL: window.location.href }),
      );
    } else window.location.hash = nextHash;
    setPreviewId(null);
  };
  const search = (value: string) => {
    setQuery(value);
    if (queryTimer.current) clearTimeout(queryTimer.current);
    if (!state.query && value && !priorBrowse.current) priorBrowse.current = { ...state };
    queryTimer.current = setTimeout(() => {
      if (!value && priorBrowse.current) {
        const previous = priorBrowse.current;
        priorBrowse.current = null;
        update({ ...previous, query: "" }, true);
      } else update({ query: value }, true);
    }, 120);
  };
  const changeCollection = (value: string) => {
    if (queryTimer.current) clearTimeout(queryTimer.current);
    priorBrowse.current = null;
    update({
      collection: value as BrowserCollection,
      query: "",
      folder: "",
      vendor: "",
      sort: value === "recent" ? "recent" : "name",
    });
  };
  const showPreview = (item: BrowseItem) => {
    previewTrigger.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setPreviewId(item.id);
  };
  const openItem = (item: BrowseItem) => {
    previewTrigger.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (scroll.current) rememberBrowserScroll(hash, scroll.current.scrollTop);
    if (item.source === "catalog") {
      detailOrigin.current = hash;
      window.location.hash = `#catalog/${encodeURIComponent(item.vendor)}/${encodeURIComponent(item.catalog.slug)}`;
    } else if (item.kind === "template") showPreview(item);
    else openDoc(item.path, { mode: "view" });
  };
  const closePreview = () => {
    setPreviewId(null);
    if (catalogDetail) {
      if (detailOrigin.current) {
        detailOrigin.current = null;
        window.history.back();
      } else update({ collection: "catalog" }, true);
    }
  };
  const newDiagram = () => {
    if (creating) return;
    setCreating(true);
    void createAndOpen(() => workspaceActions.create("", START_LABELS.untitled)).finally(() =>
      setCreating(false),
    );
  };
  const workspaceResults = results.items.filter((result) => result.item.source === "workspace");
  const catalogResults = results.items.filter((result) => result.item.source === "catalog");
  const showGroups = searching && state.collection === "recent";

  const navigateLibrary = (patch: Partial<BrowserState>) => {
    if (queryTimer.current) clearTimeout(queryTimer.current);
    priorBrowse.current = null;
    setNavigationOpen(false);
    update(patch);
  };
  const navigation = (
    <BrowserNavigation
      state={state}
      folders={folders}
      vendors={vendors}
      onNavigate={navigateLibrary}
    />
  );

  return (
    <div data-slot="home-browser" className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
      <aside className="hidden w-56 shrink-0 flex-col border-e border-border bg-surface-muted/30 md:flex">
        <div
          data-slot="browser-navigation"
          role="region"
          aria-label={LABELS.libraryNavigation}
          tabIndex={0}
          className="min-h-0 flex-1 overflow-y-auto p-3 focus-ring-inset"
        >
          {navigation}
        </div>
        <div className="shrink-0 border-t border-border p-3">
          <ConnectDialog />
        </div>
      </aside>
      <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <header
          data-slot="browser-toolbar"
          className="shrink-0 border-b border-border bg-background"
        >
          <div className="flex items-center gap-2 px-3 py-3 sm:px-4">
            <div className="relative min-w-0 flex-1">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute start-3 top-3 size-4 text-muted-foreground"
              />
              <Input
                type="search"
                aria-label={LABELS.searchLibrary}
                placeholder={LABELS.searchDiagramsComponentsCatalog}
                value={query}
                onChange={(event) => search(event.target.value)}
                className="h-10 pe-10 ps-10"
              />
              {query ? (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={LABELS.clearSearch}
                  onClick={() => search("")}
                  className="absolute end-1 top-1"
                >
                  <X aria-hidden="true" />
                </Button>
              ) : null}
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button aria-disabled={creating} className="shrink-0">
                  <Plus aria-hidden="true" />
                  {LABELS.new}
                  <ChevronDown aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={newDiagram}>
                  <FilePlus aria-hidden="true" />
                  {LABELS.newDiagram}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => changeCollection("templates")}>
                  <LayoutTemplate aria-hidden="true" />
                  {LABELS.fromTemplate}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div className="flex min-w-0 items-center gap-2 px-3 pb-3 sm:px-4">
            <Sheet open={navigationOpen} onOpenChange={setNavigationOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="shrink-0 md:hidden">
                  <FolderTree aria-hidden="true" />
                  <span>{LABELS.browseLibrary}</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="flex w-72 max-w-full flex-col gap-3">
                <SheetHeader>
                  <SheetTitle>{LABELS.browseLibrary}</SheetTitle>
                  <SheetDescription className="sr-only">
                    {LABELS.browseDescription}
                  </SheetDescription>
                </SheetHeader>
                <div className="min-h-0 flex-1 overflow-y-auto">{navigation}</div>
                <div className="shrink-0 border-t border-border pt-3">
                  <ConnectDialog />
                </div>
              </SheetContent>
            </Sheet>
            <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto">
              <Text variant="meta" tone="muted" className="hidden shrink-0 pe-2 sm:block">
                {results.total} {results.total === 1 ? "item" : "items"}
              </Text>
              {searching && state.collection !== "recent" ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="shrink-0"
                  onClick={() => update({ collection: "recent", folder: "", vendor: "" })}
                >
                  {LABELS.searchEverything}
                </Button>
              ) : null}
              {state.collection === "catalog" || searching ? (
                <BrowserSelect
                  label="Vendor"
                  value={state.vendor || "all"}
                  options={[
                    { value: "all", label: "All vendors" },
                    ...vendors.map((vendor) => ({ value: vendor, label: vendor })),
                  ]}
                  onChange={(vendor) => update({ vendor: vendor === "all" ? "" : vendor })}
                />
              ) : null}
              {state.collection === "catalog" ? (
                <>
                  <BrowserSelect
                    label="Catalog type"
                    value={state.catalogKind || "all"}
                    options={[
                      { value: "all", label: "All types" },
                      ...catalogKinds.map((kind) => ({ value: kind, label: kind })),
                    ]}
                    onChange={(catalogKind) =>
                      update({ catalogKind: catalogKind === "all" ? "" : catalogKind })
                    }
                  />
                  <BrowserSelect
                    label="Catalog tag"
                    value={state.tag || "all"}
                    options={[
                      { value: "all", label: "All tags" },
                      ...catalogTags.map((tag) => ({ value: tag, label: tag })),
                    ]}
                    onChange={(tag) => update({ tag: tag === "all" ? "" : tag })}
                  />
                </>
              ) : null}
              {searching || state.collection === "recent" ? (
                <Text variant="meta" tone="muted" className="shrink-0">
                  {searching ? "Sorted by relevance" : "Last opened"}
                </Text>
              ) : (
                <BrowserSelect
                  label="Sort results"
                  value={state.sort === "recent" ? "name" : state.sort}
                  options={[
                    { value: "name", label: "Name A–Z" },
                    ...(state.collection !== "catalog"
                      ? [{ value: "modified", label: "Last modified" }]
                      : []),
                  ]}
                  onChange={(sort) => update({ sort: sort as BrowserState["sort"] })}
                />
              )}
            </div>
            <div
              role="group"
              aria-label={LABELS.viewLayout}
              className="flex shrink-0 gap-1 rounded-md bg-surface-muted p-1"
            >
              {(
                [
                  { id: "grid", label: "Grid view", icon: Grid2X2 },
                  { id: "table", label: "Table view", icon: List },
                ] as const
              ).map(({ id, label, icon: Icon }) => (
                <Button
                  key={id}
                  variant={state.layout === id ? "outline" : "ghost"}
                  size="icon-sm"
                  aria-label={label}
                  aria-pressed={state.layout === id}
                  onClick={() => browserActions.patch({ layout: id })}
                >
                  <Icon aria-hidden="true" />
                </Button>
              ))}
            </div>
          </div>
        </header>
        <div className="flex shrink-0 flex-col gap-2 empty:hidden [&:not(:empty)]:border-b [&:not(:empty)]:border-border [&:not(:empty)]:p-3">
          {catalogError ? (
            <div
              role="status"
              className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-surface-muted px-3 py-2"
            >
              <div>
                <Text variant="caption">
                  {catalogLive ? LABELS.catalogStale : LABELS.catalogOffline}
                </Text>
                <Text variant="meta" tone="muted">
                  {catalogError}
                </Text>
              </div>
              <Button variant="outline" size="sm" onClick={() => void catalogService.retry()}>
                {LABELS.retryCatalog}
              </Button>
            </div>
          ) : null}
          {catalogProblems.length > 0 ? (
            <div role="status" className="rounded-md bg-surface-muted px-3 py-2">
              <Text variant="caption">{LABELS.catalogIsPartiallyAvailableSomeEntriesCould}</Text>
              <Text variant="meta" tone="muted">
                {catalogProblems.join(" · ")}
              </Text>
            </div>
          ) : null}
          {searching && indexErrors.length > 0 ? (
            <div role="status" className="rounded-md bg-surface-muted px-3 py-2">
              <Text variant="caption">{LABELS.someDocumentContentsCouldNotBeSearched}</Text>
              <Text variant="meta" tone="muted">
                {indexErrors.join(" · ")}
              </Text>
              {tree ? (
                <Button size="sm" variant="outline" onClick={() => void refreshSearchIndex(tree)}>
                  {LABELS.retryContents}
                </Button>
              ) : null}
            </div>
          ) : null}
          {catalogDetail && catalogLoaded && !selected ? (
            <StatePanel
              kind="empty"
              title={LABELS.catalogEntryNotFound}
              description={LABELS.thisReferenceIsNoLongerAvailableIn}
              actions={
                <Button variant="outline" onClick={() => update({ collection: "catalog" }, true)}>
                  {LABELS.browseCatalog}
                </Button>
              }
            />
          ) : null}
          {treeError ? (
            <div
              role="alert"
              className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-surface-muted px-3 py-2"
            >
              <div>
                <Text>{LABELS.workspaceUnavailable}</Text>
                <Text variant="caption" tone="muted">
                  {treeError}
                </Text>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void workspaceActions.refreshTree().catch(() => undefined)}
              >
                {LABELS.retryWorkspace}
              </Button>
            </div>
          ) : null}
          {searching && !indexReady ? (
            <Text role="status" aria-live="polite" variant="caption" tone="muted">
              {LABELS.searchingContentsResultsMayStillBeArriving}
            </Text>
          ) : null}
        </div>
        <div
          ref={scroll}
          data-slot="browser-results-scroll"
          role="region"
          aria-label={LABELS.libraryResults}
          tabIndex={0}
          className="min-h-0 min-w-0 flex-1 overflow-auto overscroll-contain p-3 focus-ring-inset sm:p-4"
        >
          <div className="flex flex-col gap-5" aria-live="polite" aria-busy={loading}>
            {results.total === 0 ? (
              loading || (searching && !indexReady) ? (
                <StatePanel kind="loading" title={LABELS.findingYourLibrary} />
              ) : (
                <StatePanel
                  kind="empty"
                  titleAs="h3"
                  icon={<collection.icon aria-hidden="true" />}
                  title={
                    searching
                      ? "No matching items"
                      : state.collection === "recent"
                        ? "Your next idea starts here"
                        : "Nothing here yet"
                  }
                  description={
                    searching
                      ? "Try another name, reference or phrase, or search all collections."
                      : state.collection === "recent"
                        ? "Diagrams and catalog entries you open will appear here."
                        : "Browse another folder or create a diagram to get started."
                  }
                  actions={
                    <div className="flex flex-wrap justify-center gap-2">
                      <Button variant="outline" onClick={() => changeCollection("diagrams")}>
                        {LABELS.browseDiagrams}
                      </Button>
                      <Button variant="outline" onClick={() => changeCollection("templates")}>
                        {LABELS.exploreTemplates}
                      </Button>
                    </div>
                  }
                  className="min-h-64"
                />
              )
            ) : showGroups ? (
              <>
                {[
                  {
                    label: "Workspace",
                    count: results.workspaceCount,
                    entries: workspaceResults,
                  },
                  { label: "Catalog", count: results.catalogCount, entries: catalogResults },
                ].map((group) =>
                  group.entries.length ? (
                    <section
                      key={group.label}
                      className="flex flex-col gap-4"
                      aria-label={`${group.label} results`}
                    >
                      <div className="flex items-center gap-2">
                        <Heading level={3} size="subtitle">
                          {group.label}
                        </Heading>
                        <Text variant="meta" tone="muted">
                          {group.count}
                        </Text>
                      </div>
                      <BrowserResultsView
                        results={group.entries}
                        layout={state.layout}
                        recent={false}
                        onOpen={openItem}
                        onPreview={showPreview}
                      />
                    </section>
                  ) : null,
                )}
              </>
            ) : (
              <BrowserResultsView
                results={results.items}
                layout={state.layout}
                recent={state.collection === "recent" && !searching}
                onOpen={openItem}
                onPreview={showPreview}
              />
            )}
          </div>
        </div>
        <footer
          data-slot="browser-footer"
          className="flex min-h-12 shrink-0 items-center justify-between gap-2 border-t border-border bg-background px-3 py-2 sm:px-4"
        >
          <Text variant="meta" tone="muted">
            {results.total} {results.total === 1 ? "item" : "items"}
            {results.pageCount > 1 ? ` · Page ${results.page} of ${results.pageCount}` : ""}
          </Text>
          {results.pageCount > 1 ? (
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                aria-label={LABELS.previousPage}
                disabled={results.page <= 1}
                onClick={() => update({ page: results.page - 1 })}
              >
                <ArrowLeft aria-hidden="true" />
                <span className="hidden sm:inline">{LABELS.previous}</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                aria-label={LABELS.nextPage}
                disabled={results.page >= results.pageCount}
                onClick={() => update({ page: results.page + 1 })}
              >
                <span className="hidden sm:inline">{LABELS.next}</span>
                <ArrowRight aria-hidden="true" />
              </Button>
            </div>
          ) : null}
        </footer>
      </section>
      <Sheet
        open={Boolean(selected)}
        onOpenChange={(open) => {
          if (!open) closePreview();
        }}
      >
        <SheetContent
          onCloseAutoFocus={(event) => {
            if (previewTrigger.current?.isConnected) {
              event.preventDefault();
              previewTrigger.current.focus();
            }
          }}
          className={cn("flex w-full max-w-full flex-col gap-6 sm:max-w-lg")}
        >
          <SheetHeader className="pe-6">
            <Text variant="meta" tone="muted">
              {selected ? `${kindLabel(selected)} preview` : "Preview"}
            </Text>
            <SheetTitle className="break-words">{selected?.title}</SheetTitle>
            <SheetDescription className="sr-only">
              {LABELS.inspectThisItemBeforeOpeningOrReusing}
            </SheetDescription>
          </SheetHeader>
          {selected ? <BrowserPreview key={selected.id} item={selected} /> : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
