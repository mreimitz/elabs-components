import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ComponentProps,
  type HTMLAttributes,
  type KeyboardEvent,
} from "react";
import useEmblaCarousel, { type UseEmblaCarouselType } from "embla-carousel-react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { cn } from "../../lib/cn";
import { Button } from "../button";

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
  canScrollPrev: boolean;
  canScrollNext: boolean;
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
      "aria-label": ariaLabel = "Carousel",
      ...props
    },
    ref,
  ) {
    const [carouselRef, api] = useEmblaCarousel(
      { ...opts, axis: orientation === "horizontal" ? "x" : "y" },
      plugins,
    );
    const [canScrollPrev, setCanScrollPrev] = useState(false);
    const [canScrollNext, setCanScrollNext] = useState(false);

    const onSelect = useCallback((a: CarouselApi) => {
      if (!a) return;
      setCanScrollPrev(a.canScrollPrev());
      setCanScrollNext(a.canScrollNext());
    }, []);

    const scrollPrev = useCallback(() => api?.scrollPrev(), [api]);
    const scrollNext = useCallback(() => api?.scrollNext(), [api]);

    const onKeyDown = useCallback(
      (e: KeyboardEvent<HTMLDivElement>) => {
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          scrollPrev();
        } else if (e.key === "ArrowRight") {
          e.preventDefault();
          scrollNext();
        }
      },
      [scrollPrev, scrollNext],
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
          canScrollPrev,
          canScrollNext,
        }}
      >
        <div
          ref={ref}
          onKeyDownCapture={onKeyDown}
          className={cn("relative", className)}
          role="region"
          aria-roledescription="carousel"
          aria-label={ariaLabel}
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

export function CarouselPrevious({ className, ...props }: ComponentProps<typeof Button>) {
  const { scrollPrev, canScrollPrev, orientation } = useCarousel();
  return (
    <Button
      variant="outline"
      size="icon"
      disabled={!canScrollPrev}
      onClick={scrollPrev}
      aria-label="Previous slide"
      className={cn(
        "absolute size-8 rounded-full",
        orientation === "horizontal"
          ? "-start-12 top-1/2 -translate-y-1/2"
          : "-top-12 left-1/2 -translate-x-1/2 rotate-90",
        className,
      )}
      {...props}
    >
      <ArrowLeft className="size-4" data-rtl-flip />
    </Button>
  );
}

export function CarouselNext({ className, ...props }: ComponentProps<typeof Button>) {
  const { scrollNext, canScrollNext, orientation } = useCarousel();
  return (
    <Button
      variant="outline"
      size="icon"
      disabled={!canScrollNext}
      onClick={scrollNext}
      aria-label="Next slide"
      className={cn(
        "absolute size-8 rounded-full",
        orientation === "horizontal"
          ? "-end-12 top-1/2 -translate-y-1/2"
          : "-bottom-12 left-1/2 -translate-x-1/2 rotate-90",
        className,
      )}
      {...props}
    >
      <ArrowRight className="size-4" data-rtl-flip />
    </Button>
  );
}

export type { CarouselApi };
