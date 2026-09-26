"use client";

import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ComponentProps,
  type ElementRef,
  type HTMLAttributes,
  type KeyboardEvent,
} from "react";
import { useDirection } from "@radix-ui/react-direction";
import useEmblaCarousel, { type UseEmblaCarouselType } from "embla-carousel-react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { cn } from "../../lib/cn";
import { Button } from "../button";
import { useLocale } from "../locale-provider";

/**
 * True when the keyboard event's target already owns arrow-key semantics of
 * its own (a text field's caret, a contenteditable's selection) — the
 * carousel must not steal ArrowLeft/ArrowRight from a form control that
 * happens to live inside the active slide.
 */
function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

type CarouselApi = UseEmblaCarouselType[1];
type CarouselOptions = NonNullable<Parameters<typeof useEmblaCarousel>[0]>;
type CarouselPlugin = NonNullable<Parameters<typeof useEmblaCarousel>[1]>;

interface CarouselProps {
  opts?: CarouselOptions;
  plugins?: CarouselPlugin;
  orientation?: "horizontal" | "vertical";
  setApi?: (api: CarouselApi) => void;
}

interface CarouselContextValue extends CarouselProps {
  carouselRef: ReturnType<typeof useEmblaCarousel>[0];
  api: CarouselApi;
  scrollPrev: () => void;
  scrollNext: () => void;
  scrollTo: (index: number) => void;
  canScrollPrev: boolean;
  canScrollNext: boolean;
  /** Index of the selected snap (slide). */
  selectedIndex: number;
  /** How many snaps (slides) there are. */
  snapCount: number;
}

const CarouselContext = createContext<CarouselContextValue | null>(null);

function useCarousel() {
  const ctx = useContext(CarouselContext);
  if (!ctx) throw new Error("useCarousel must be used within <Carousel />");
  return ctx;
}

/**
 * Root carousel region. Carries `role="region" aria-roledescription="carousel"`
 * plus an `aria-label` — it defaults to `"Carousel"` so the region always has an
 * accessible name (issue #279), but **consumers should pass a specific
 * `aria-label`** (e.g. `"Product photos"`) describing what the carousel actually
 * shows, since AT users otherwise can't distinguish multiple carousels on a page.
 */
export const Carousel = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement> & CarouselProps>(
  function Carousel(
    {
      orientation = "horizontal",
      opts,
      setApi,
      plugins,
      className,
      children,
      // A carousel region MUST have an accessible name (WAI-ARIA APG) —
      // aria-roledescription changes the announcement, it does not name the
      // landmark. Default is overridable; pass a specific label ("Product
      // photos") when the carousel's purpose isn't generic. Issue #279.
      "aria-label": ariaLabel,
      ...props
    },
    ref,
  ) {
    const { t } = useLocale();
    const resolvedAriaLabel = ariaLabel ?? t("ui.carousel.label");
    const [carouselRef, api] = useEmblaCarousel(
      { ...opts, axis: orientation === "horizontal" ? "x" : "y" },
      plugins,
    );
    const [canScrollPrev, setCanScrollPrev] = useState(false);
    const [canScrollNext, setCanScrollNext] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [snapCount, setSnapCount] = useState(0);
    const dir = useDirection();

    const onSelect = useCallback((a: CarouselApi) => {
      if (!a) return;
      setCanScrollPrev(a.canScrollPrev());
      setCanScrollNext(a.canScrollNext());
      setSelectedIndex(a.selectedScrollSnap());
      setSnapCount(a.scrollSnapList().length);
    }, []);

    const scrollPrev = useCallback(() => api?.scrollPrev(), [api]);
    const scrollNext = useCallback(() => api?.scrollNext(), [api]);
    const scrollTo = useCallback((index: number) => api?.scrollTo(index), [api]);

    const onKeyDown = useCallback(
      (e: KeyboardEvent<HTMLDivElement>) => {
        // Don't steal ArrowLeft/ArrowRight from a text field's caret or a
        // contenteditable's selection inside the active slide.
        if (isEditableTarget(e.target)) return;

        if (orientation === "vertical") {
          if (e.key === "ArrowUp") {
            e.preventDefault();
            scrollPrev();
          } else if (e.key === "ArrowDown") {
            e.preventDefault();
            scrollNext();
          }
          return;
        }

        // Horizontal: the PHYSICAL key maps to the visually-adjacent slide,
        // which flips with writing direction — in RTL, ArrowLeft moves toward
        // the next slide (visually to the left of the current one), not prev.
        const isRtl = dir === "rtl";
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          if (isRtl) {
            scrollNext();
          } else {
            scrollPrev();
          }
        } else if (e.key === "ArrowRight") {
          e.preventDefault();
          if (isRtl) {
            scrollPrev();
          } else {
            scrollNext();
          }
        }
      },
      [orientation, dir, scrollPrev, scrollNext],
    );

    useEffect(() => {
      if (api && setApi) setApi(api);
    }, [api, setApi]);
    useEffect(() => {
      if (!api) return;
      onSelect(api);
      api.on("reInit", onSelect);
      api.on("select", onSelect);
      return () => {
        api.off("reInit", onSelect);
        api.off("select", onSelect);
      };
    }, [api, onSelect]);

    return (
      <CarouselContext.Provider
        value={{
          carouselRef,
          api,
          opts,
          orientation,
          scrollPrev,
          scrollNext,
          scrollTo,
          canScrollPrev,
          canScrollNext,
          selectedIndex,
          snapCount,
        }}
      >
        <div
          ref={ref}
          onKeyDownCapture={onKeyDown}
          className={cn("relative", className)}
          role="region"
          aria-roledescription="carousel"
          aria-label={resolvedAriaLabel}
          {...props}
        >
          {children}
        </div>
      </CarouselContext.Provider>
    );
  },
);

export const CarouselContent = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  function CarouselContent({ className, ...props }, ref) {
    const { carouselRef, orientation } = useCarousel();
    return (
      <div ref={carouselRef} className="overflow-hidden">
        <div
          ref={ref}
          className={cn(
            "flex",
            orientation === "horizontal" ? "-ms-4" : "-mt-4 flex-col",
            className,
          )}
          {...props}
        />
      </div>
    );
  },
);

export const CarouselItem = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  function CarouselItem({ className, ...props }, ref) {
    const { orientation } = useCarousel();
    return (
      <div
        ref={ref}
        role="group"
        aria-roledescription="slide"
        className={cn(
          "min-w-0 shrink-0 grow-0 basis-full",
          orientation === "horizontal" ? "ps-4" : "pt-4",
          className,
        )}
        {...props}
      />
    );
  },
);

export const CarouselPrevious = forwardRef<
  ElementRef<typeof Button>,
  ComponentProps<typeof Button>
>(function CarouselPrevious({ className, ...props }, ref) {
  const { scrollPrev, canScrollPrev, orientation } = useCarousel();
  const { t } = useLocale();
  return (
    <Button
      ref={ref}
      variant="outline"
      size="icon"
      disabled={!canScrollPrev}
      onClick={scrollPrev}
      aria-label={t("previousSlide")}
      className={cn(
        "absolute size-8 rounded-full",
        // Inset on narrow screens (no room for the button to sit outside
        // the carousel box without overflowing horizontally); pushed
        // outside the box only from `sm` up, where there's margin for it.
        orientation === "horizontal"
          ? "start-2 top-1/2 -translate-y-1/2 sm:-start-12"
          : "top-2 left-1/2 -translate-x-1/2 rotate-90 sm:-top-12",
        className,
      )}
      {...props}
    >
      <ArrowLeft className="size-4" data-rtl-flip />
    </Button>
  );
});

export const CarouselNext = forwardRef<ElementRef<typeof Button>, ComponentProps<typeof Button>>(
  function CarouselNext({ className, ...props }, ref) {
    const { scrollNext, canScrollNext, orientation } = useCarousel();
    const { t } = useLocale();
    return (
      <Button
        ref={ref}
        variant="outline"
        size="icon"
        disabled={!canScrollNext}
        onClick={scrollNext}
        aria-label={t("nextSlide")}
        className={cn(
          "absolute size-8 rounded-full",
          orientation === "horizontal"
            ? "end-2 top-1/2 -translate-y-1/2 sm:-end-12"
            : "bottom-2 left-1/2 -translate-x-1/2 rotate-90 sm:-bottom-12",
          className,
        )}
        {...props}
      >
        <ArrowRight className="size-4" data-rtl-flip />
      </Button>
    );
  },
);

/**
 * One dot per slide, the selected one `aria-current="true"` — a `Slides`
 * group of real buttons, so the position is both visible and operable
 * (click, Tab + Enter). Renders nothing while the carousel has a single
 * slide. Place it under `CarouselContent`.
 */
export const CarouselDots = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  function CarouselDots({ className, ...props }, ref) {
    const { selectedIndex, snapCount, scrollTo } = useCarousel();
    const { t } = useLocale();
    if (snapCount < 2) return null;
    return (
      <div
        ref={ref}
        role="group"
        aria-label={t("ui.carousel.dots")}
        data-slot="carousel-dots"
        className={cn("flex items-center justify-center gap-1", className)}
        {...props}
      >
        {Array.from({ length: snapCount }, (_, index) => (
          <button
            key={index}
            type="button"
            aria-current={index === selectedIndex ? "true" : undefined}
            aria-label={t("ui.carousel.goToSlide", { index: index + 1, count: snapCount })}
            onClick={() => scrollTo(index)}
            data-slot="carousel-dot"
            className={cn(
              "focus-ring flex size-6 items-center justify-center rounded-full",
              "before:size-2 before:rounded-full before:bg-border-strong before:transition-[background-color,transform] before:duration-base before:content-['']",
              "hover:before:bg-muted-foreground",
              "aria-[current=true]:before:scale-125 aria-[current=true]:before:bg-primary",
            )}
          />
        ))}
      </div>
    );
  },
);

/** Read the carousel's position from a sibling control (a “3 / 7” counter). */
export function useCarouselPosition(): { selectedIndex: number; snapCount: number } {
  const { selectedIndex, snapCount } = useCarousel();
  return { selectedIndex, snapCount };
}

export type { CarouselApi };
