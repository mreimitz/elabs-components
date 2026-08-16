"use client";

/**
 * ContextPanel — the chat workspace's right context rail (#193, research 09).
 *
 * A compound, lifted-state component (doc-13): `ContextPanelProvider` lifts ALL
 * state ({ open, view, selectedAsset }) so an external trigger (e.g. an
 * app-header `ContextPanelTrigger`) can drive the panel from anywhere inside
 * the provider. The panel itself is ALWAYS MOUNTED and collapses via the
 * canonical `useCollapsiblePanel` width tween (one collapse implementation —
 * never a conditional mount, which can't animate). Root ↔ detail drill-in is a
 * v1 CSS two-pane translateX track behind the future `useViewTransition` seam
 * (research view-transitions/01-design.md §6.1): `openDetail`/`back` are
 * already shaped as `mutate`-callbacks and the panes carry stable
 * `data-vt-pane` identities, so the v2 swap is internal-only.
 *
 * ChatShell stays generic: compose `<ContextPanel>` as a SIBLING of
 * `<ChatShell>` under a workspace-wrapping `<ContextPanelProvider>` (the
 * Sidebar / SidebarInset relationship). Below the mobile breakpoint the panel
 * degrades to a `@elabs-ai/components-ui` `<Sheet side="right">` driven by the same state.
 */
import {
  Button,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  useCollapsiblePanel,
  useIsMobile,
  useLocale,
  type FileSource,
} from "@elabs-ai/components-ui";
import { cn } from "@elabs-ai/components-ui/lib/cn";
import { ChevronLeftIcon, PanelRightIcon } from "lucide-react";
import type { ComponentProps, CSSProperties, HTMLAttributes, ReactNode, RefObject } from "react";
import {
  createContext,
  forwardRef,
  use,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";

const CONTEXT_PANEL_COOKIE_NAME = "context_panel_state";
const CONTEXT_PANEL_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;
const CONTEXT_PANEL_WIDTH = "20rem";
const CONTEXT_PANEL_WIDTH_MOBILE = "20rem";

/** Closed asset-type enum shared by the tree (`ProducedAssetTree`) and the preview (`AssetPreview`). */
export type ContextAssetType = "markdown" | "code" | "sql" | "csv" | "image";

/** One produced asset — the unit the drill-in focuses (research 09 §B.1). */
export interface ContextAsset {
  id: string;
  name: string;
  path?: string;
  type: ContextAssetType;
  /** Inline content: source text — or, for `image`, the image src URL. */
  content?: string;
  /** Optional Shiki language for `code` assets (defaults to "typescript"). */
  language?: string;
  /**
   * The file itself, when the asset IS one — a `File`, a `Blob`, a URL, a
   * buffer. Carried so a `renderPreview` injection (below) can hand it to
   * something that opens files, such as `@elabs-ai/components-viewer`'s
   * `FileViewer`, without the asset first being turned into a string.
   *
   * `ContextAssetType` is deliberately NOT widened to cover PDFs, Office files
   * or video: this union describes what THIS package can draw, and every format
   * beyond it arrives through the injection seam rather than by growing a case
   * per format here (ADR 0024 §6).
   */
  source?: FileSource;
  /** MIME type, when known — helps a renderer that detects by media type. */
  mediaType?: string;
}

/**
 * Draw the body of an asset preview.
 *
 * Return `null` to decline and let `AssetPreview` fall through to its own
 * type-keyed rendering, which is what makes this additive: an injection that
 * handles PDFs only leaves markdown, code and CSV exactly as they were.
 */
export type AssetPreviewRenderer = (asset: ContextAsset) => ReactNode | null;

export type ContextPanelView = "root" | "detail";

export interface ContextPanelContextValue {
  /** Lifted state (doc-13 `state` / `actions` / `meta` interface). */
  state: {
    open: boolean;
    view: ContextPanelView;
    selectedAsset: ContextAsset | null;
  };
  actions: {
    /** Toggle the panel (the inline collapse on desktop, the Sheet on mobile). */
    toggle: () => void;
    setOpen: (open: boolean | ((open: boolean) => boolean)) => void;
    /** Drill into one asset (root → detail). Focus moves to the BACK control. */
    openDetail: (asset: ContextAsset) => void;
    /** Return to the root view; focus is restored to the originating row. */
    back: () => void;
  };
  meta: {
    isMobile: boolean;
    openMobile: boolean;
    setOpenMobile: (open: boolean) => void;
    /**
     * The injected preview renderer, if the provider was given one.
     * `AssetPreview` reads it from here so a page can teach the whole rail a
     * new format in one place instead of at every call site.
     */
    renderPreview?: AssetPreviewRenderer;
  };
}

const ContextPanelContext = createContext<ContextPanelContextValue | null>(null);

interface ContextPanelInternalValue {
  panelId: string;
  titleId: string;
  /** The element focus moves to on `openDetail` (the BACK control). */
  detailFocusRef: RefObject<HTMLElement | null>;
}

const ContextPanelInternalContext = createContext<ContextPanelInternalValue | null>(null);

export function useContextPanel(): ContextPanelContextValue {
  const context = use(ContextPanelContext);
  if (!context) throw new Error("useContextPanel must be used within a ContextPanelProvider.");
  return context;
}

/**
 * The renderer injected into the surrounding `ContextPanelProvider`, if any.
 *
 * Unlike `useContextPanel()` this does NOT throw outside a provider:
 * `AssetPreview` is usable on its own (a preview pane in a page, a story), and
 * "no provider" simply means nobody injected anything.
 */
export function useAssetPreviewRenderer(): AssetPreviewRenderer | undefined {
  return use(ContextPanelContext)?.meta.renderPreview;
}

function useContextPanelInternal(): ContextPanelInternalValue {
  const context = use(ContextPanelInternalContext);
  if (!context) {
    throw new Error("ContextPanel components must be used within a ContextPanelProvider.");
  }
  return context;
}

export interface ContextPanelProviderProps {
  children: ReactNode;
  /** Uncontrolled initial open state. Default `true`. */
  defaultOpen?: boolean;
  /** Controlled open state (`isControlled = open !== undefined`, never flips). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Controlled view (root ↔ detail). */
  view?: ContextPanelView;
  onViewChange?: (view: ContextPanelView) => void;
  /** Uncontrolled initial view. Default `"root"`. */
  defaultView?: ContextPanelView;
  /** Controlled selected asset. */
  selectedAsset?: ContextAsset | null;
  onSelectedAssetChange?: (asset: ContextAsset | null) => void;
  /** Uncontrolled initial selected asset. Default `null`. */
  defaultSelectedAsset?: ContextAsset | null;
  /**
   * Draw an asset's preview body yourself.
   *
   * The seam that lets this package show formats it cannot parse — a PDF, a
   * spreadsheet, a video — without importing a domain sibling
   * (`@elabs-ai/components-ai` and
   * `@elabs-ai/components-viewer` are peers in the layer graph and
   * may never import each other). The consuming app owns the edge:
   *
   * ```tsx
   * <ContextPanelProvider
   *   renderPreview={(asset) =>
   *     asset.source ? <FileViewer source={asset.source} /> : null
   *   }
   * >
   * ```
   *
   * Return `null` to decline, and the built-in type-keyed rendering runs
   * exactly as before — so an injection is additive, never a replacement.
   */
  renderPreview?: AssetPreviewRenderer;
}

/**
 * Lifts the panel state above the workspace so siblings outside the panel's
 * frame (the app-header trigger) can read/drive it — no prop-drilling, no
 * page-level `useState`, no conditional mount (research 09 §B.1/§C.2).
 */
export function ContextPanelProvider({
  children,
  defaultOpen = true,
  open: openProp,
  onOpenChange,
  view: viewProp,
  onViewChange,
  defaultView = "root",
  selectedAsset: selectedAssetProp,
  onSelectedAssetChange,
  defaultSelectedAsset = null,
  renderPreview,
}: ContextPanelProviderProps) {
  const isMobile = useIsMobile();
  const [openMobile, setOpenMobile] = useState(false);

  // Controlled/uncontrolled per component-api.md: controlled iff the prop is
  // provided; the mode never flips mid-life.
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const openControlled = openProp !== undefined;
  const open = openControlled ? openProp : uncontrolledOpen;

  const [uncontrolledView, setUncontrolledView] = useState<ContextPanelView>(defaultView);
  const viewControlled = viewProp !== undefined;
  const view = viewControlled ? viewProp : uncontrolledView;

  const [uncontrolledAsset, setUncontrolledAsset] = useState<ContextAsset | null>(
    defaultSelectedAsset,
  );
  const assetControlled = selectedAssetProp !== undefined;
  const selectedAsset = assetControlled ? selectedAssetProp : uncontrolledAsset;

  const panelId = useId();
  const titleId = useId();
  /** Where focus returns on `back()` — the originating tree row (09 §B.5). */
  const returnFocusRef = useRef<HTMLElement | null>(null);
  /** Where focus lands on `openDetail()` — the BACK control in the header. */
  const detailFocusRef = useRef<HTMLElement | null>(null);

  const setOpen = useCallback(
    (value: boolean | ((open: boolean) => boolean)) => {
      const next = typeof value === "function" ? value(open) : value;
      if (!openControlled) setUncontrolledOpen(next);
      onOpenChange?.(next);
      // Persistence: the SidebarProvider cookie pattern (research 09 §B.1).
      if (typeof document !== "undefined") {
        document.cookie = `${CONTEXT_PANEL_COOKIE_NAME}=${next}; path=/; max-age=${CONTEXT_PANEL_COOKIE_MAX_AGE}`;
      }
    },
    [onOpenChange, open, openControlled],
  );

  const toggle = useCallback(() => {
    if (isMobile) setOpenMobile((o) => !o);
    else setOpen((o) => !o);
  }, [isMobile, setOpen]);

  const setView = useCallback(
    (next: ContextPanelView) => {
      if (!viewControlled) setUncontrolledView(next);
      onViewChange?.(next);
    },
    [onViewChange, viewControlled],
  );

  const setSelectedAsset = useCallback(
    (next: ContextAsset | null) => {
      if (!assetControlled) setUncontrolledAsset(next);
      onSelectedAssetChange?.(next);
    },
    [assetControlled, onSelectedAssetChange],
  );

  const openDetail = useCallback(
    (asset: ContextAsset) => {
      // Drilling while collapsed auto-opens first (research 09 §G.1).
      if (isMobile) setOpenMobile(true);
      else if (!open) setOpen(true);
      // Stash the originating row so back() can restore focus (09 §B.5).
      if (typeof document !== "undefined" && document.activeElement instanceof HTMLElement) {
        returnFocusRef.current = document.activeElement;
      }
      // The v2 `useViewTransition` seam: this state change is the `mutate`
      // callback a future vt.run({ recipe: "nav-forward" }) will wrap (09 §B.3).
      setView("detail");
      setSelectedAsset(asset);
      // Focus management is independent of the animation (VT guardrail §8):
      // land on the BACK control after the swap, never on transition end.
      requestAnimationFrame(() => detailFocusRef.current?.focus());
    },
    [isMobile, open, setOpen, setSelectedAsset, setView],
  );

  const back = useCallback(() => {
    // The v2 seam: the `mutate` a future vt.run({ recipe: "nav-back" }) wraps.
    setView("root");
    requestAnimationFrame(() => {
      const target = returnFocusRef.current;
      if (target?.isConnected) target.focus();
    });
  }, [setView]);

  const contextValue = useMemo<ContextPanelContextValue>(
    () => ({
      state: { open, view, selectedAsset },
      actions: { toggle, setOpen, openDetail, back },
      meta: { isMobile, openMobile, setOpenMobile, renderPreview },
    }),
    [
      back,
      isMobile,
      open,
      openDetail,
      openMobile,
      renderPreview,
      selectedAsset,
      setOpen,
      toggle,
      view,
    ],
  );

  const internalValue = useMemo<ContextPanelInternalValue>(
    () => ({ panelId, titleId, detailFocusRef }),
    [panelId, titleId],
  );

  return (
    <ContextPanelContext.Provider value={contextValue}>
      <ContextPanelInternalContext.Provider value={internalValue}>
        {children}
      </ContextPanelInternalContext.Provider>
    </ContextPanelContext.Provider>
  );
}

export interface ContextPanelProps extends ComponentProps<"div"> {
  /** Expanded panel width (any CSS length). Default `"20rem"`. */
  width?: string;
}

/**
 * The always-mounted shell. On desktop it animates its OWN width via the
 * canonical `useCollapsiblePanel` two-element tween — bounded to the SHELL
 * (a relative group + absolute container), not the viewport (09 §B.2). Below
 * the mobile breakpoint it renders a `Sheet side="right"` with the same
 * children, driven by the same provider (09 §B.4).
 */
export const ContextPanel = forwardRef<HTMLDivElement, ContextPanelProps>(function ContextPanel(
  { width = CONTEXT_PANEL_WIDTH, className, style, children, ...props },
  ref,
) {
  const { state, actions, meta } = useContextPanel();
  const { panelId } = useContextPanelInternal();

  const panel = useCollapsiblePanel({
    side: "right",
    open: state.open,
    onOpenChange: actions.setOpen,
    widthClassName: "w-(--context-panel-width)",
    spacerCollapsedClassName: "group-data-[state=collapsed]:w-0",
    containerSlideClassNames: {
      left: "left-0 group-data-[state=collapsed]:left-[calc(var(--context-panel-width)*-1)]",
      right: "right-0 group-data-[state=collapsed]:right-[calc(var(--context-panel-width)*-1)]",
    },
  });

  if (meta.isMobile) {
    return (
      <Sheet open={meta.openMobile} onOpenChange={meta.setOpenMobile}>
        <SheetContent
          id={panelId}
          side="right"
          data-slot="context-panel"
          data-mobile="true"
          className="w-(--context-panel-width) gap-0 p-0"
          style={{ "--context-panel-width": CONTEXT_PANEL_WIDTH_MOBILE } as CSSProperties}
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Context panel</SheetTitle>
            <SheetDescription>Displays the chat context panel.</SheetDescription>
          </SheetHeader>
          <div className="flex h-full w-full flex-col">{children}</div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <div
      ref={ref}
      id={panelId}
      data-slot="context-panel"
      // Collapsed container is inert (09 §B.5 — Sidebar gets this free via
      // `hidden`; the right rail must do it explicitly).
      inert={state.open ? undefined : true}
      className={cn("group relative hidden overflow-hidden md:block", className)}
      style={{ "--context-panel-width": width, ...style } as CSSProperties}
      {...panel.attrs}
      {...props}
    >
      <div data-slot="context-panel-gap" className={panel.spacerClassName} />
      <div
        data-slot="context-panel-container"
        // The deliberate Sidebar divergence (09 §B.2): bound to the shell, not
        // the viewport — `absolute` within the relative group, full height.
        className={cn(panel.containerClassName, "absolute inset-y-0 flex h-full border-s")}
      >
        {/* Detail-tier surface: raised `card`, robust across themes (#193). */}
        <div data-slot="context-panel-inner" className="flex h-full w-full flex-col bg-card">
          {children}
        </div>
      </div>
    </div>
  );
});

export type ContextPanelTriggerProps = ComponentProps<typeof Button>;

/** Toggle button — placeable ANYWHERE inside the provider (e.g. the app header). */
export const ContextPanelTrigger = forwardRef<HTMLButtonElement, ContextPanelTriggerProps>(
  function ContextPanelTrigger({ className, onClick, children, ...props }, ref) {
    const { t } = useLocale();
    const { state, actions, meta } = useContextPanel();
    const { panelId } = useContextPanelInternal();
    const expanded = meta.isMobile ? meta.openMobile : state.open;
    return (
      <Button
        ref={ref}
        data-slot="context-panel-trigger"
        variant="ghost"
        size="icon"
        aria-expanded={expanded}
        aria-controls={panelId}
        aria-label={t("ai.contextPanel.toggle")}
        className={cn("size-7", className)}
        onClick={(event) => {
          onClick?.(event);
          actions.toggle();
        }}
        {...props}
      >
        {children ?? <PanelRightIcon aria-hidden="true" />}
      </Button>
    );
  },
);

export interface ContextPanelHeaderProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  /** Root-view title. Default `"Context"`. */
  title?: ReactNode;
}

/**
 * Title row. In the detail view it hosts the BACK control (a real button —
 * "tab-panel swap", not a breadcrumb) and shows the focused asset's name.
 */
export const ContextPanelHeader = forwardRef<HTMLDivElement, ContextPanelHeaderProps>(
  function ContextPanelHeader({ title = "Context", className, children, ...props }, ref) {
    const { t } = useLocale();
    const { state, actions } = useContextPanel();
    const { titleId, detailFocusRef } = useContextPanelInternal();
    const isDetail = state.view === "detail";
    return (
      <div
        ref={ref}
        data-slot="context-panel-header"
        className={cn("flex h-12 shrink-0 items-center gap-2 border-b px-3", className)}
        {...props}
      >
        {isDetail ? (
          <Button
            ref={(node) => {
              detailFocusRef.current = node;
            }}
            type="button"
            variant="ghost"
            size="sm"
            data-slot="context-panel-back"
            aria-label={t("ai.contextPanel.back")}
            className="gap-1 px-2 text-muted-foreground"
            onClick={() => actions.back()}
          >
            <ChevronLeftIcon className="size-4" aria-hidden="true" data-rtl-flip />
            Back
          </Button>
        ) : null}
        <h2 id={titleId} className="min-w-0 truncate text-title">
          {isDetail ? (state.selectedAsset?.name ?? title) : title}
        </h2>
        {children ? <div className="ms-auto flex items-center gap-1">{children}</div> : null}
      </div>
    );
  },
);

export interface ContextPanelBodyProps extends HTMLAttributes<HTMLDivElement> {
  /** Root view — the labelled sections (status / grounding / produced assets). */
  root: ReactNode;
  /** Detail view — typically `<ContextPanelDetail><AssetPreview …/></ContextPanelDetail>`. */
  detail: ReactNode;
  /** Accessible name of the region. Default `"Context"`. */
  label?: string;
}

/**
 * The two-view container that owns the drill-in. v1: a CSS-gated two-pane
 * translateX track (both panes mounted, transform-only, `duration-base` +
 * explicit `motion-reduce:` neutralizer). The off-screen pane is `aria-hidden`
 * AND `inert` so Tab can't land in it mid-slide (09 §B.3/§B.5). The panes'
 * `data-vt-pane` identities are the v2 `useViewTransition` seam.
 */
export const ContextPanelBody = forwardRef<HTMLDivElement, ContextPanelBodyProps>(
  function ContextPanelBody({ root, detail, label = "Context", className, ...props }, ref) {
    const { state } = useContextPanel();
    const isDetail = state.view === "detail";

    // Announce, don't steal focus mid-animation (09 §B.5). Skip the initial view.
    const [announcement, setAnnouncement] = useState("");
    const previousView = useRef(state.view);
    useEffect(() => {
      if (previousView.current === state.view) return;
      previousView.current = state.view;
      setAnnouncement(
        state.view === "detail"
          ? `Showing ${state.selectedAsset?.name ?? "asset detail"}`
          : "Back to context",
      );
    }, [state.selectedAsset, state.view]);

    return (
      <div
        ref={ref}
        role="region"
        aria-label={label}
        data-slot="context-panel-body"
        className={cn("relative min-h-0 flex-1 overflow-hidden", className)}
        {...props}
      >
        <div aria-live="polite" className="sr-only">
          {announcement}
        </div>
        <div
          data-slot="context-panel-track"
          className="flex h-full w-[200%] transition-transform duration-base ease-standard motion-reduce:transition-none"
          style={{ transform: isDetail ? "translateX(-50%)" : "translateX(0)" }}
        >
          <div
            data-vt-pane="root"
            aria-hidden={isDetail}
            inert={isDetail ? true : undefined}
            className="flex h-full w-1/2 flex-col gap-5 overflow-y-auto p-4"
          >
            {root}
          </div>
          <div
            data-vt-pane="detail"
            aria-hidden={!isDetail}
            inert={isDetail ? undefined : true}
            className="h-full w-1/2 overflow-y-auto"
          >
            {detail}
          </div>
        </div>
      </div>
    );
  },
);

export interface ContextPanelSectionProps extends HTMLAttributes<HTMLElement> {
  /** Section label — a quiet `text-meta` heading, not a box (research 08). */
  label?: ReactNode;
}

/** A labelled root-view section (status / grounding / produced assets). */
export const ContextPanelSection = forwardRef<HTMLElement, ContextPanelSectionProps>(
  function ContextPanelSection({ label, className, children, ...props }, ref) {
    return (
      <section
        ref={ref}
        data-slot="context-panel-section"
        className={cn("flex shrink-0 flex-col gap-2", className)}
        {...props}
      >
        {label ? <h3 className="text-meta text-muted-foreground">{label}</h3> : null}
        {children}
      </section>
    );
  },
);

export type ContextPanelDetailProps = HTMLAttributes<HTMLDivElement>;

/** The focused single-asset view — hosts `<AssetPreview>` (research 04 §5). */
export const ContextPanelDetail = forwardRef<HTMLDivElement, ContextPanelDetailProps>(
  function ContextPanelDetail({ className, ...props }, ref) {
    return (
      <div
        ref={ref}
        data-slot="context-panel-detail"
        className={cn("flex min-h-full flex-col p-4", className)}
        {...props}
      />
    );
  },
);
