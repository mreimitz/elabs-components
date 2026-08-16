"use client";

/**
 * Gallery — an OUTPUT-oriented image gallery for AI results / chat surfaces.
 *
 * A `Card` that renders a single image, or a thumbnail grid that collapses the
 * overflow into a "+N more" tile, and opens a unified lightbox `Dialog` with a
 * `Carousel` and a right-side metadata panel that tracks the active slide.
 *
 * Distinct from the other image surfaces in this package — don't merge them:
 *   - `attachments.tsx` — composer INPUT (removable, file-typed thumbnails).
 *   - `asset-preview.tsx` — a SINGLE asset in the context rail (type-switched).
 *   - `image.tsx` — a base64 `<img>` wrapper for AI-SDK generated images.
 * Gallery is the multi-image lightbox: expand / download / carousel / metadata.
 *
 * The data model is framework-agnostic (plain `{ src, alt, … }`) — it does NOT
 * couple to the AI-SDK message model. Map a `UIMessage` part onto `GalleryImage`
 * in the app or a thin adapter.
 */

import {
  AspectRatio,
  Button,
  Card,
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  Skeleton,
  downloadUrl,
  type CarouselApi,
} from "@elabs-ai/components-ui";
import { cn } from "@elabs-ai/components-ui/lib/cn";
import { useLocale } from "@elabs-ai/components-ui";
import { useReducedMotion } from "@elabs-ai/components-tokens";
import { Download, ImageOff, Maximize2 } from "lucide-react";
import {
  createContext,
  forwardRef,
  use,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type HTMLAttributes,
  type ReactNode,
} from "react";

/** One labelled metadata row rendered in the detail panel `<dl>`. */
export interface GalleryMetaItem {
  /** Field label (rendered muted, in the `<dt>`). */
  label: string;
  /** Field value — a string in the common case; `ReactNode` allows a link/badge. */
  value: ReactNode;
}

/** A single gallery image plus its optional metadata. */
export interface GalleryImage {
  /** Full-resolution source shown in the lightbox and standalone tile. */
  src: string;
  /** Required alt text (a11y). Pass `""` to mark the image decorative. */
  alt: string;
  /** Cheaper thumbnail for the grid; falls back to `src`. */
  thumbnailSrc?: string;
  /** Headline shown in the panel; also feeds the dialog's accessible name. */
  title?: string;
  /** Long-form copy shown under the title in the detail panel. */
  description?: string;
  /** Structured key/value rows rendered as a `<dl>` in the detail panel. */
  meta?: GalleryMetaItem[];
  /** Overrides `src` for the download (e.g. a signed full-res URL). */
  downloadUrl?: string;
  /** Suggested download filename. */
  downloadName?: string;
}

export interface GalleryProps extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  /** Images to display. `0` → empty state, `1` → standalone, `≥2` → grid. */
  images: GalleryImage[];
  /** Thumbnails to show before collapsing the rest into a "+N more" tile. @default 5 */
  maxVisible?: number;
  /** Aspect ratio for grid tiles and the standalone image. @default 1 (square) */
  aspectRatio?: number;
  /** Hide every download affordance (e.g. rights-restricted assets). @default false */
  hideDownload?: boolean;
  /**
   * The set is still arriving (loading-states.md `loading` signal). Renders
   * skeleton tiles in the grid footprint instead of the empty state, and fills
   * the gap up to `expectedCount` (or `maxVisible`) while images stream in.
   * @default false
   */
  loading?: boolean;
  /**
   * Total images expected once the set finishes arriving. When
   * `images.length < expectedCount`, the arrived tiles render alongside
   * skeleton tiles for the missing ones, so the grid fills in place (no reflow).
   */
  expectedCount?: number;
  /**
   * Replace the default metadata body in the detail panel. Receives the
   * currently-active image, so it stays in sync with the carousel. The panel
   * chrome + title heading remain.
   */
  renderMeta?: (image: GalleryImage, index: number) => ReactNode;
}

interface GalleryContextValue {
  images: GalleryImage[];
  maxVisible: number;
  aspectRatio: number;
  hideDownload: boolean;
  /** The set is still arriving — render skeleton tiles to fill the gap. */
  incoming: boolean;
  /** How many skeleton tiles to append after the arrived images. */
  skeletonCount: number;
  renderMeta?: GalleryProps["renderMeta"];
  state: { open: boolean; activeIndex: number };
  actions: {
    open: (index: number) => void;
    close: () => void;
    setActiveIndex: (index: number) => void;
    setOpen: (open: boolean) => void;
  };
}

const GalleryContext = createContext<GalleryContextValue | null>(null);

function useGallery(): GalleryContextValue {
  const ctx = use(GalleryContext);
  if (!ctx) throw new Error("useGallery must be used within <Gallery />");
  return ctx;
}

function triggerDownload(image: GalleryImage): void {
  void downloadUrl(image.downloadUrl ?? image.src, image.downloadName);
}

/**
 * `<img>` with a `Skeleton` placeholder until it loads (loading-states.md — the
 * box is already reserved by `AspectRatio`, so no CLS) and a token-styled
 * fallback box when the source fails to load.
 */
function GalleryImg({
  src,
  alt,
  className,
  loading,
  showSkeleton = true,
}: {
  src: string;
  alt: string;
  className?: string;
  loading?: "lazy" | "eager";
  /**
   * Show the `Skeleton` placeholder until load. Only meaningful inside a
   * space-reserved box (`AspectRatio`); the lightbox sets `false` because the
   * slide isn't sized to the image, so an `absolute inset-0` skeleton would fill
   * the whole padded slide rather than the image footprint.
   */
  showSkeleton?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  // Cached images can finish before React attaches `onLoad` — read `complete`.
  useEffect(() => {
    if (imgRef.current?.complete) setLoaded(true);
  }, []);

  if (failed) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center gap-1 bg-muted text-muted-foreground",
          className,
        )}
        {...(alt ? { role: "img", "aria-label": alt } : { "aria-hidden": true })}
      >
        <ImageOff className="size-6" aria-hidden="true" />
      </div>
    );
  }

  return (
    <>
      {showSkeleton && !loaded ? (
        <Skeleton className="absolute inset-0 size-full rounded-none" />
      ) : null}
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        loading={loading}
        onError={() => setFailed(true)}
        onLoad={() => setLoaded(true)}
        className={className}
      />
    </>
  );
}

/** Round, frosted icon button that downloads `image`. */
function GalleryDownloadButton({
  image,
  className,
  tabIndex,
}: {
  image: GalleryImage;
  className?: string;
  /** Off-screen carousel slides pass -1 so they're not phantom tab stops. */
  tabIndex?: number;
}) {
  const { t } = useLocale();

  return (
    <Button
      type="button"
      size="icon-sm"
      variant="outline"
      tabIndex={tabIndex}
      aria-label={t("ai.gallery.downloadImage")}
      className={cn("rounded-full bg-background/80 backdrop-blur-sm", className)}
      onClick={(event) => {
        event.stopPropagation();
        triggerDownload(image);
      }}
    >
      <Download aria-hidden="true" />
    </Button>
  );
}

const HOVER_TOOLBAR =
  "opacity-0 transition-opacity duration-fast ease-standard group-hover:opacity-100 group-focus-within:opacity-100 motion-reduce:transition-none";

// "Comes closer" hover for a tile: a gentle scale-up + drop shadow, plus a 3D
// tilt that tracks the cursor. Movement (tilt + scale) is gated by
// useReducedMotion — the shadow still responds ("reduced != none", like Card).
// The wrapper carries `group relative` (toolbar reveal + absolute children) and
// NO overflow, so the shadow and the inner control's focus ring aren't clipped.
const TILT_PERSPECTIVE = 800; // px — larger = subtler tilt
const TILT_MAX_DEG = 6;
const TILT_SCALE = 1.04;
const tiltTransform = (rotateX: number, rotateY: number, scale: number) =>
  `perspective(${TILT_PERSPECTIVE}px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(${scale})`;
const TILT_REST = tiltTransform(0, 0, 1);

function GalleryTilt({ className, children }: { className?: string; children: ReactNode }) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const rect = useRef<DOMRect | null>(null);
  const raf = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (raf.current != null) cancelAnimationFrame(raf.current);
    },
    [],
  );

  // Reduced motion: no tilt/scale; the shadow alone signals the lift.
  if (reduced) {
    return (
      <div
        className={cn(
          "group relative rounded-lg transition-shadow duration-base ease-standard hover:z-10 hover:shadow-xl",
          className,
        )}
      >
        {children}
      </div>
    );
  }

  const write = (transform: string) => {
    if (ref.current) ref.current.style.transform = transform;
  };

  return (
    <div
      ref={ref}
      style={{ transform: TILT_REST }}
      onPointerEnter={() => {
        // Cache geometry once per hover (no per-move layout read); grow on enter.
        rect.current = ref.current?.getBoundingClientRect() ?? null;
        write(tiltTransform(0, 0, TILT_SCALE));
      }}
      onPointerMove={(event) => {
        const r = rect.current;
        if (!r) return;
        const px = (event.clientX - r.left) / r.width - 0.5;
        const py = (event.clientY - r.top) / r.height - 0.5;
        if (raf.current != null) cancelAnimationFrame(raf.current);
        raf.current = requestAnimationFrame(() =>
          write(tiltTransform(-py * TILT_MAX_DEG, px * TILT_MAX_DEG, TILT_SCALE)),
        );
      }}
      onPointerLeave={() => {
        if (raf.current != null) cancelAnimationFrame(raf.current);
        write(TILT_REST);
      }}
      className={cn(
        "group relative rounded-lg transition-[transform,box-shadow] duration-base ease-standard hover:z-10 hover:shadow-2xl",
        className,
      )}
    >
      {children}
    </div>
  );
}

function GalleryEmpty() {
  return (
    <div className="flex min-h-32 flex-col items-center justify-center gap-2 p-6 text-center text-muted-foreground">
      <ImageOff className="size-6" aria-hidden="true" />
      <p className="text-body">No images</p>
    </div>
  );
}

/** The single-image branch — a framed image with an always-on expand button. */
function GallerySingle() {
  const { t } = useLocale();
  const { images, aspectRatio, hideDownload, actions } = useGallery();
  const image = images[0];
  if (!image) return null;

  return (
    <GalleryTilt>
      <AspectRatio ratio={aspectRatio} className="overflow-hidden rounded-lg">
        <GalleryImg
          src={image.src}
          alt={image.alt}
          loading="lazy"
          className="size-full object-cover"
        />
      </AspectRatio>
      <div className="absolute end-2 top-2 z-10 flex items-center gap-1">
        {hideDownload ? null : <GalleryDownloadButton image={image} className={HOVER_TOOLBAR} />}
        <Button
          type="button"
          size="icon-sm"
          variant="outline"
          aria-label={t("ai.gallery.expandImage")}
          className="rounded-full bg-background/80 backdrop-blur-sm"
          onClick={() => actions.open(0)}
        >
          <Maximize2 aria-hidden="true" />
        </Button>
      </div>
    </GalleryTilt>
  );
}

/** One thumbnail in the grid — a button that opens the lightbox at `index`. */
function GalleryTile({ image, index }: { image: GalleryImage; index: number }) {
  const { images, aspectRatio, hideDownload, actions } = useGallery();
  const total = images.length;
  const label = image.title ?? (image.alt || `Image ${index + 1} of ${total}`);

  return (
    <GalleryTilt>
      <button
        type="button"
        onClick={() => actions.open(index)}
        aria-label={label}
        className="block w-full rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <AspectRatio ratio={aspectRatio} className="overflow-hidden rounded-lg">
          {/* Decorative: the button carries the accessible name. */}
          <GalleryImg
            src={image.thumbnailSrc ?? image.src}
            alt=""
            loading="lazy"
            className="size-full object-cover"
          />
        </AspectRatio>
      </button>
      {hideDownload ? null : (
        <GalleryDownloadButton
          image={image}
          className={cn("absolute end-2 top-2 z-10", HOVER_TOOLBAR)}
        />
      )}
    </GalleryTilt>
  );
}

/** The "+N more" tile — same footprint as a thumbnail; opens the carousel. */
function GalleryOverflowTile() {
  const { images, maxVisible, aspectRatio, actions } = useGallery();
  const total = images.length;
  const count = total - maxVisible;

  return (
    <GalleryTilt>
      <button
        type="button"
        onClick={() => actions.open(maxVisible)}
        aria-label={`Show all ${total} images`}
        className="block w-full rounded-lg border border-border bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <AspectRatio ratio={aspectRatio} className="overflow-hidden rounded-lg">
          <span className="flex size-full items-center justify-center text-subtitle text-muted-foreground transition-colors duration-fast ease-standard group-hover:text-foreground motion-reduce:transition-none">
            +{count} more
          </span>
        </AspectRatio>
      </button>
    </GalleryTilt>
  );
}

/** A grid tile placeholder — same footprint as a thumbnail, shown while loading. */
function GallerySkeletonTile() {
  const { aspectRatio } = useGallery();
  return (
    <AspectRatio ratio={aspectRatio} className="overflow-hidden rounded-lg">
      <Skeleton className="size-full rounded-none" />
    </AspectRatio>
  );
}

/**
 * The all-skeleton grid for the loading-from-empty case (no images yet).
 * Decorative — the loading announcement comes from the persistent live region on
 * the always-mounted `Card` (so it fires reliably; ARIA22).
 */
function GallerySkeletonGrid() {
  const { skeletonCount } = useGallery();
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" aria-hidden="true">
      {Array.from({ length: Math.max(1, skeletonCount) }).map((_, i) => (
        <GallerySkeletonTile key={`skeleton-${i}`} />
      ))}
    </div>
  );
}

function GalleryGrid() {
  const { images, maxVisible, incoming, skeletonCount } = useGallery();
  const total = images.length;

  // While the set is still arriving, render the arrived tiles plus skeleton
  // tiles for the missing ones — no "+N more" collapse until the set settles.
  if (incoming) {
    return (
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {images.map((image, index) => (
          <GalleryTile key={`${image.src}-${index}`} image={image} index={index} />
        ))}
        {Array.from({ length: skeletonCount }).map((_, i) => (
          <GallerySkeletonTile key={`skeleton-${i}`} />
        ))}
      </div>
    );
  }

  const hasOverflow = total > maxVisible;
  const visible = hasOverflow ? images.slice(0, maxVisible) : images;

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {visible.map((image, index) => (
        <GalleryTile key={`${image.src}-${index}`} image={image} index={index} />
      ))}
      {hasOverflow ? <GalleryOverflowTile /> : null}
    </div>
  );
}

/** Default detail-panel body: description + a `<dl>` of `meta` rows. */
function GalleryDetailPanel({
  image,
  index,
  renderMeta,
}: {
  image: GalleryImage;
  index: number;
  renderMeta?: GalleryProps["renderMeta"];
}) {
  const custom = renderMeta?.(image, index);
  if (custom != null) {
    return <div className="flex flex-col gap-4">{custom}</div>;
  }

  const hasMeta = image.meta != null && image.meta.length > 0;
  const hasBody = Boolean(image.description) || hasMeta;

  if (!hasBody) {
    return <p className="text-body text-muted-foreground">No details</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      {image.description ? (
        <p className="text-body text-muted-foreground">{image.description}</p>
      ) : null}
      {hasMeta ? (
        <dl className="flex flex-col gap-3">
          {image.meta?.map((item, i) => (
            <div key={`${item.label}-${i}`} className="flex flex-col gap-0.5">
              <dt className="text-meta text-muted-foreground">{item.label}</dt>
              <dd className="text-body text-foreground">{item.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  );
}

/** The lightbox carousel — one slide per image; syncs `activeIndex` on select. */
function GalleryCarousel() {
  const { t } = useLocale();
  const { images, state, actions, hideDownload } = useGallery();
  const [api, setApi] = useState<CarouselApi>();
  const showArrows = images.length > 1;
  const { setActiveIndex } = actions;
  // Capture the open-at index ONCE (the modal remounts the carousel each open).
  // Tying opts.startIndex to the live activeIndex hands Embla a changed options
  // object on every slide (it deep-compares) → constant reInit → the native
  // slide animation never plays. A stable opts keeps Embla's scroll intact;
  // activeIndex flows one-way (carousel select → panel), never back into opts.
  const [startIndex] = useState(() => state.activeIndex);
  const opts = useMemo(() => ({ startIndex, loop: false }), [startIndex]);

  useEffect(() => {
    if (!api) return;
    const onSelect = () => setActiveIndex(api.selectedScrollSnap());
    onSelect();
    api.on("select", onSelect);
    api.on("reInit", onSelect);
    return () => {
      api.off("select", onSelect);
      api.off("reInit", onSelect);
    };
  }, [api, setActiveIndex]);

  // The dialog animates in (zoom-in-95); re-measure once laid out so Embla
  // aligns and lands on the opened slide.
  useEffect(() => {
    if (!api) return;
    const raf = requestAnimationFrame(() => api.reInit());
    return () => cancelAnimationFrame(raf);
  }, [api]);

  return (
    <Carousel
      setApi={setApi}
      opts={opts}
      className="relative w-full"
      aria-label={t("ai.gallery.label")}
    >
      <CarouselContent>
        {images.map((image, index) => (
          <CarouselItem
            key={`${image.src}-${index}`}
            aria-label={`${index + 1} of ${images.length}`}
          >
            <div className="group/slide relative flex items-center justify-center px-4">
              <GalleryImg
                src={image.src}
                alt={image.alt}
                showSkeleton={false}
                className="max-h-[80vh] w-auto max-w-full object-contain"
              />
              {hideDownload ? null : (
                <GalleryDownloadButton
                  image={image}
                  // Off-screen slides stay in the DOM (Embla); keep only the
                  // active slide's download button in the tab order.
                  tabIndex={index === state.activeIndex ? 0 : -1}
                  className="absolute end-14 top-3 opacity-0 transition-opacity duration-fast ease-standard group-hover/slide:opacity-100 group-focus-within/slide:opacity-100 motion-reduce:transition-none"
                />
              )}
            </div>
          </CarouselItem>
        ))}
      </CarouselContent>
      {showArrows ? (
        <>
          <CarouselPrevious className="start-4" />
          <CarouselNext className="end-4" />
        </>
      ) : null}
    </Carousel>
  );
}

function GalleryModal() {
  const { images, state, actions, renderMeta } = useGallery();
  const total = images.length;
  const active = images[state.activeIndex];

  const fallbackTitle = active
    ? active.alt || `Image ${state.activeIndex + 1} of ${total}`
    : "Image preview";

  return (
    <Dialog open={state.open} onOpenChange={actions.setOpen}>
      <DialogContent
        size="full"
        className="grid grid-rows-[minmax(0,3fr)_minmax(0,2fr)] gap-0 overflow-hidden p-0 md:grid-cols-[minmax(0,1fr)_22rem] md:grid-rows-1"
      >
        <div className="relative flex min-h-0 items-center justify-center overflow-hidden bg-muted">
          {active ? <GalleryCarousel /> : null}
        </div>
        <aside className="flex min-h-0 flex-col overflow-y-auto border-border bg-card p-6 max-md:border-t md:border-s">
          {active?.title ? (
            <DialogTitle className="pe-8 text-title">{active.title}</DialogTitle>
          ) : (
            <DialogTitle className="sr-only">{fallbackTitle}</DialogTitle>
          )}
          <DialogDescription className="sr-only">
            {total > 1
              ? `Image ${state.activeIndex + 1} of ${total}. Use the arrow keys to browse.`
              : "Image preview"}
          </DialogDescription>
          {active ? (
            <div className="mt-4 flex-1">
              <GalleryDetailPanel
                image={active}
                index={state.activeIndex}
                renderMeta={renderMeta}
              />
            </div>
          ) : null}
        </aside>
        {/* Carousel navigation only changes the title's text, which doesn't
            re-announce. A polite live region orients screen-reader users on each
            slide change. (sr-only is position:absolute, so it adds no grid cell.) */}
        <span className="sr-only" role="status" aria-live="polite">
          {active && total > 1
            ? `${active.title ?? active.alt} — image ${state.activeIndex + 1} of ${total}`
            : ""}
        </span>
      </DialogContent>
    </Dialog>
  );
}

export const Gallery = forwardRef<HTMLDivElement, GalleryProps>(function Gallery(
  {
    images,
    maxVisible = 5,
    aspectRatio = 1,
    hideDownload = false,
    loading = false,
    expectedCount,
    renderMeta,
    className,
    ...props
  },
  ref,
) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const openAt = useCallback((index: number) => {
    setActiveIndex(index);
    setOpen(true);
  }, []);
  const close = useCallback(() => setOpen(false), []);

  // The set is "incoming" while it's still arriving — either an explicit
  // `loading` flag, or fewer images than the `expectedCount`. Fill the grid up
  // to the target (capped at the visible footprint) with skeleton tiles.
  const target = expectedCount ?? (loading ? maxVisible : undefined);
  const incoming = target !== undefined && images.length < target;
  const skeletonCount = incoming ? Math.max(0, Math.min(target, maxVisible) - images.length) : 0;

  // Loading announcement: the live region must exist BEFORE its text appears
  // (ARIA22), so the `sr-only` status span below is always mounted and its label
  // is set one tick later via this effect — reliable on NVDA + Chrome.
  const loadingFromEmpty = incoming && images.length === 0;
  const [liveMsg, setLiveMsg] = useState("");
  useEffect(() => {
    setLiveMsg(loadingFromEmpty ? "Loading images" : "");
  }, [loadingFromEmpty]);

  const value = useMemo<GalleryContextValue>(
    () => ({
      images,
      maxVisible,
      aspectRatio,
      hideDownload,
      incoming,
      skeletonCount,
      renderMeta,
      state: { open, activeIndex },
      actions: { open: openAt, close, setActiveIndex, setOpen },
    }),
    [
      images,
      maxVisible,
      aspectRatio,
      hideDownload,
      incoming,
      skeletonCount,
      renderMeta,
      open,
      activeIndex,
      openAt,
      close,
    ],
  );

  let body: ReactNode;
  if (images.length === 0) {
    body = incoming ? <GallerySkeletonGrid /> : <GalleryEmpty />;
  } else if (incoming) {
    body = <GalleryGrid />;
  } else if (images.length === 1) {
    body = <GallerySingle />;
  } else {
    body = <GalleryGrid />;
  }

  return (
    <GalleryContext.Provider value={value}>
      <Card ref={ref} className={cn("p-2", className)} {...props}>
        <span className="sr-only" role="status" aria-live="polite">
          {liveMsg}
        </span>
        {body}
      </Card>
      {images.length > 0 ? <GalleryModal /> : null}
    </GalleryContext.Provider>
  );
});
