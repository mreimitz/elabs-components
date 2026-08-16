"use client";

import { Badge } from "@elabs-ai/components-ui";
import type { CarouselApi } from "@elabs-ai/components-ui";
import { Carousel, CarouselContent, CarouselItem } from "@elabs-ai/components-ui";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@elabs-ai/components-ui";
import { cn } from "@elabs-ai/components-ui/lib/cn";
import { useLocale } from "@elabs-ai/components-ui";
import { ArrowLeftIcon, ArrowRightIcon, BadgeCheckIcon } from "lucide-react";
import type { ComponentProps } from "react";
import { createContext, useCallback, useContext, useEffect, useState } from "react";

export type InlineCitationProps = ComponentProps<"span">;

export const InlineCitation = ({ className, ...props }: InlineCitationProps) => (
  <span className={cn("group inline items-center gap-1", className)} {...props} />
);

export type InlineCitationTextProps = ComponentProps<"span">;

export const InlineCitationText = ({ className, ...props }: InlineCitationTextProps) => (
  <span className={cn("transition-colors group-hover:bg-accent", className)} {...props} />
);

export type InlineCitationCardProps = ComponentProps<typeof HoverCard>;

export const InlineCitationCard = (props: InlineCitationCardProps) => (
  <HoverCard closeDelay={0} openDelay={0} {...props} />
);

/**
 * A cited source: a bare string — a URL, or any opaque id / human label — or a
 * labelled object.
 *
 * Non-URL sources are first-class. An agent citing a warehouse table, a document
 * id, an uploaded file or a wiki page has no hostname to show, and must not have
 * to synthesize a fake URL to satisfy the chip.
 */
export type InlineCitationSourceRef =
  | string
  | {
      /** Opaque identifier, shown when there is no `label` and no `url`. */
      id?: string;
      /** Human-readable label — wins over any hostname derived from `url`. */
      label?: string;
      /** Optional link; its hostname is the fallback label. */
      url?: string;
    };

/** The URL's hostname when `value` parses as one, else `value` itself. Never throws. */
const hostnameOrRaw = (value: string): string => {
  try {
    return new URL(value).hostname || value;
  } catch {
    return value;
  }
};

/**
 * The chip label for a source ref. Exported so consumers can render the same
 * label elsewhere (a footnote list, a tooltip) without re-deriving the rules.
 */
export const inlineCitationSourceLabel = (source: InlineCitationSourceRef): string => {
  if (typeof source === "string") {
    return hostnameOrRaw(source);
  }
  // `||` not `??` — an upstream field that is present but EMPTY (`label: ""`)
  // must still fall through, or the chip renders with no label at all.
  return source.label || (source.url ? hostnameOrRaw(source.url) : source.id || "unknown");
};

export type InlineCitationCardTriggerProps = ComponentProps<typeof Badge> & {
  sources: InlineCitationSourceRef[];
};

export const InlineCitationCardTrigger = ({
  sources,
  className,
  ...props
}: InlineCitationCardTriggerProps) => (
  <HoverCardTrigger asChild>
    <Badge
      // The 08 §C.1 evidence channel: the green wash marks "grounded" — green
      // is reserved for evidence/answer/favourable (research 11 §B.4).
      className={cn(
        "ms-1 rounded-full border-success/40 bg-success/10 text-success-text",
        className,
      )}
      variant="outline"
      {...props}
    >
      <BadgeCheckIcon aria-hidden="true" className="size-3" />
      {sources[0] ? (
        <>
          {inlineCitationSourceLabel(sources[0])} {sources.length > 1 && `+${sources.length - 1}`}
        </>
      ) : (
        "unknown"
      )}
    </Badge>
  </HoverCardTrigger>
);

export type EvidenceChipProps = InlineCitationCardTriggerProps;

/**
 * EvidenceChip — the named front door for the inline evidence interaction
 * (research 11 §B.4): the re-skinned `InlineCitationCardTrigger` (green
 * "grounded" wash). Use inside an `InlineCitationCard` (HoverCard) — it reuses
 * the citation carousel wholesale; it is not a new primitive.
 */
export const EvidenceChip = InlineCitationCardTrigger;

export type InlineCitationCardBodyProps = ComponentProps<"div">;

export const InlineCitationCardBody = ({ className, ...props }: InlineCitationCardBodyProps) => (
  <HoverCardContent className={cn("relative w-80 p-0", className)} {...props} />
);

const CarouselApiContext = createContext<CarouselApi | undefined>(undefined);

const useCarouselApi = () => {
  const context = useContext(CarouselApiContext);
  return context;
};

export type InlineCitationCarouselProps = ComponentProps<typeof Carousel>;

export const InlineCitationCarousel = ({
  className,
  children,
  ...props
}: InlineCitationCarouselProps) => {
  const [api, setApi] = useState<CarouselApi>();

  return (
    <CarouselApiContext.Provider value={api}>
      <Carousel className={cn("w-full", className)} setApi={setApi} {...props}>
        {children}
      </Carousel>
    </CarouselApiContext.Provider>
  );
};

export type InlineCitationCarouselContentProps = ComponentProps<"div">;

export const InlineCitationCarouselContent = (props: InlineCitationCarouselContentProps) => (
  <CarouselContent {...props} />
);

export type InlineCitationCarouselItemProps = ComponentProps<"div">;

export const InlineCitationCarouselItem = ({
  className,
  ...props
}: InlineCitationCarouselItemProps) => (
  <CarouselItem className={cn("w-full space-y-2 p-4 ps-8", className)} {...props} />
);

export type InlineCitationCarouselHeaderProps = ComponentProps<"div">;

export const InlineCitationCarouselHeader = ({
  className,
  ...props
}: InlineCitationCarouselHeaderProps) => (
  <div
    className={cn(
      "flex items-center justify-between gap-2 rounded-t-md bg-secondary p-2",
      className,
    )}
    {...props}
  />
);

export type InlineCitationCarouselIndexProps = ComponentProps<"div">;

export const InlineCitationCarouselIndex = ({
  children,
  className,
  ...props
}: InlineCitationCarouselIndexProps) => {
  const api = useCarouselApi();
  const [current, setCurrent] = useState(0);
  const [count, setCount] = useState(0);

  const syncState = useCallback(() => {
    if (!api) {
      return;
    }
    setCount(api.scrollSnapList().length);
    setCurrent(api.selectedScrollSnap() + 1);
  }, [api]);

  useEffect(() => {
    if (!api) {
      return;
    }

    syncState();

    api.on("select", syncState);

    return () => {
      api.off("select", syncState);
    };
  }, [api, syncState]);

  return (
    <div
      className={cn(
        "flex flex-1 items-center justify-end px-3 py-1 text-muted-foreground text-xs",
        className,
      )}
      {...props}
    >
      {children ?? `${current}/${count}`}
    </div>
  );
};

export type InlineCitationCarouselPrevProps = ComponentProps<"button">;

export const InlineCitationCarouselPrev = ({
  className,
  ...props
}: InlineCitationCarouselPrevProps) => {
  const { t } = useLocale();
  const api = useCarouselApi();

  const handleClick = useCallback(() => {
    if (api) {
      api.scrollPrev();
    }
  }, [api]);

  return (
    <button
      aria-label={t("previous")}
      className={cn("shrink-0", className)}
      onClick={handleClick}
      type="button"
      {...props}
    >
      <ArrowLeftIcon className="size-4 text-muted-foreground" data-rtl-flip />
    </button>
  );
};

export type InlineCitationCarouselNextProps = ComponentProps<"button">;

export const InlineCitationCarouselNext = ({
  className,
  ...props
}: InlineCitationCarouselNextProps) => {
  const { t } = useLocale();
  const api = useCarouselApi();

  const handleClick = useCallback(() => {
    if (api) {
      api.scrollNext();
    }
  }, [api]);

  return (
    <button
      aria-label={t("next")}
      className={cn("shrink-0", className)}
      onClick={handleClick}
      type="button"
      {...props}
    >
      <ArrowRightIcon className="size-4 text-muted-foreground" data-rtl-flip />
    </button>
  );
};

export type InlineCitationSourceProps = ComponentProps<"div"> & {
  title?: string;
  url?: string;
  description?: string;
};

export const InlineCitationSource = ({
  title,
  url,
  description,
  className,
  children,
  ...props
}: InlineCitationSourceProps) => (
  <div className={cn("space-y-1", className)} {...props}>
    {title && <h4 className="truncate font-medium text-sm leading-tight">{title}</h4>}
    {url && <p className="truncate break-all text-muted-foreground text-xs">{url}</p>}
    {description && (
      <p className="line-clamp-3 text-muted-foreground text-sm leading-relaxed">{description}</p>
    )}
    {children}
  </div>
);

export type InlineCitationQuoteProps = ComponentProps<"blockquote">;

export const InlineCitationQuote = ({
  children,
  className,
  ...props
}: InlineCitationQuoteProps) => (
  <blockquote
    className={cn("border-muted border-s-2 ps-3 text-muted-foreground text-sm italic", className)}
    {...props}
  >
    {children}
  </blockquote>
);
