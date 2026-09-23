"use client";

import { cva, type VariantProps } from "class-variance-authority";
import { ImageOff } from "lucide-react";
import {
  forwardRef,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ImgHTMLAttributes,
  type ReactNode,
} from "react";
import { cn } from "../../lib/cn";
import { mergeRefs } from "../../lib/merge-refs";
import { AspectRatio } from "../aspect-ratio";
import { useLocale } from "../locale-provider";
import { Skeleton } from "../skeleton";

/** How the image fills its box — the CSS `object-fit` value. Never sizing. */
export type ImageFit = "contain" | "cover" | "fill" | "none" | "scale-down";

/** Visual `fit` axis only: emits `object-*` classes, never width/height. */
export const imageVariants = cva("block max-w-full", {
  variants: {
    fit: {
      contain: "object-contain",
      cover: "object-cover",
      fill: "object-fill",
      none: "object-none",
      "scale-down": "object-scale-down",
    },
  },
  defaultVariants: { fit: "contain" },
});

export interface ImageProps
  extends Omit<ImgHTMLAttributes<HTMLImageElement>, "alt">, VariantProps<typeof imageVariants> {
  /** Required. `""` marks the image decorative (no live region, `aria-hidden` fallback). */
  alt: string;
  /** CSS `object-fit` of the image inside its box. @default "contain" */
  fit?: ImageFit;
  /**
   * Show a `Skeleton` in a reserved box until the image decodes. A box can
   * only be reserved when its size is known, so the default is on only with
   * both `width` and `height`, or an `aspectRatio`.
   * @default Boolean(width && height) || aspectRatio !== undefined
   */
  showSkeleton?: boolean;
  /** Reserve a box of this ratio (e.g. `16 / 9`); the image fills it. */
  aspectRatio?: number;
  /**
   * Rendered instead of the default `ImageOff` box after a terminal load error
   * (or when `src` is empty). `null` renders nothing.
   */
  fallback?: ReactNode;
}

type ImageStatus = "loading" | "loaded" | "error";

/**
 * Token-styled `<img>`. The `<img>` is always the root (ref, `className`,
 * `style`, `data-slot="image"` land on it); a frame is added only when a box
 * must be reserved, decided from props so it never remounts mid-load.
 */
export const Image = forwardRef<HTMLImageElement, ImageProps>(function Image(
  {
    alt,
    fit,
    showSkeleton,
    aspectRatio,
    fallback,
    className,
    src,
    width,
    height,
    onLoad,
    onError,
    ...props
  },
  forwardedRef,
) {
  const { t } = useLocale();
  const imgRef = useRef<HTMLImageElement>(null);
  const ref = useMemo(() => mergeRefs(imgRef, forwardedRef), [forwardedRef]);

  const hasSize = Boolean(width && height);
  const shouldSkeleton = showSkeleton ?? (hasSize || aspectRatio !== undefined);
  const framed = shouldSkeleton || aspectRatio !== undefined;

  // Status is keyed to the src it was observed for, so a new src resets to
  // "loading" during render — no effect-to-sync, no stale "error".
  const [state, setState] = useState<{ status: ImageStatus; forSrc: typeof src }>({
    status: "loading",
    forSrc: src,
  });
  const status: ImageStatus = !src ? "error" : state.forSrc === src ? state.status : "loading";

  const pending = shouldSkeleton && status === "loading";

  // The live region must exist BEFORE its text appears (ARIA22): mounted with
  // the frame, text set one tick later.
  const [announce, setAnnounce] = useState(false);
  useEffect(() => setAnnounce(pending), [pending]);

  // A cached / instant data-URL decode can finish before React attaches
  // `onLoad` — read `complete` once mounted (and per src).
  useEffect(() => {
    const img = imgRef.current;
    if (!img?.complete) return;
    if (img.naturalWidth > 0) setState({ status: "loaded", forSrc: src });
    else if (img.currentSrc) setState({ status: "error", forSrc: src });
  }, [src]);

  let content: ReactNode;
  if (status === "error") {
    content =
      fallback !== undefined ? (
        fallback
      ) : (
        <span
          data-slot="image-fallback"
          data-status="error"
          className={cn(
            "flex items-center justify-center bg-muted text-muted-foreground",
            framed && "size-full",
            className,
          )}
          style={{ width, height }}
          {...(alt ? { role: "img", "aria-label": alt } : { "aria-hidden": true })}
        >
          <ImageOff className="size-6 max-h-full max-w-full" aria-hidden="true" />
        </span>
      );
  } else {
    content = (
      <img
        data-slot="image"
        {...props}
        ref={ref}
        src={src}
        alt={alt ?? ""}
        width={width}
        height={height}
        data-status={status}
        className={cn(imageVariants({ fit }), framed && "size-full", className)}
        onLoad={(event) => {
          setState({ status: "loaded", forSrc: src });
          onLoad?.(event);
        }}
        onError={(event) => {
          setState({ status: "error", forSrc: src });
          onError?.(event);
        }}
      />
    );
  }

  // No box to reserve — the bare <img> is the root, so a `className` like
  // "w-full" resolves against the real parent.
  if (!framed) return content;

  const frameChildren = (
    <>
      {shouldSkeleton && alt !== "" ? (
        <span className="sr-only" role="status" aria-live="polite">
          {announce ? t("loading") : ""}
        </span>
      ) : null}
      {pending ? (
        <Skeleton
          data-slot="image-skeleton"
          className="absolute inset-0 size-full rounded-[inherit]"
        />
      ) : null}
      {content}
    </>
  );

  if (aspectRatio !== undefined) {
    return (
      <AspectRatio ratio={aspectRatio} data-slot="image-frame" className="relative overflow-hidden">
        {frameChildren}
      </AspectRatio>
    );
  }

  return (
    <span
      data-slot="image-frame"
      className={cn("relative max-w-full", hasSize ? "inline-block" : "block size-full")}
      style={hasSize ? { width, height } : undefined}
    >
      {frameChildren}
    </span>
  );
});

Image.displayName = "Image";
