import { useLayoutEffect, useRef, useState, type Ref } from "react";
import { resolveThemeIsDark, useTheme } from "@elabs-ai/components-tokens";

/**
 * What a vendor mark paints as `brand` in a dark theme (wave-2 review M6):
 * - `{ src }` — the vendor's own dark-background variant (reversed, white, "for dark
 *   backgrounds"), vendored under `public/icons/<vendor>/dark/` (provenance:
 *   `THIRD_PARTY_ICONS.md`);
 * - `"mono"` — the vendor publishes no dark variant, so the mark falls back to the mono
 *   mask in the surrounding text colour (it loses its brand colour but stays visible);
 * - `"keep"` — the mark's own colours already clear 3:1 on the dark surfaces.
 */
export type DarkMark = { src: string } | "mono" | "keep";

export interface VendorMarkProps {
  /** The mark's light-theme asset — the one `ServiceLogo` would render from `src` today. */
  src: string;
  dark: DarkMark;
  /** `ServiceLogo`'s numeric size; the image's intrinsic width and height. */
  size: number;
  variant: "brand" | "mono";
}

/**
 * The body of a `ServiceLogo` render callback for a vendor mark whose own ink vanishes
 * on a dark surface (`register-packs.ts`). `ServiceLogo` wraps whatever this returns in
 * its `aria-hidden` inner span and keeps the accessible name (or `decorative`) on its
 * root, so the name and role behave exactly as for a `src` mark.
 *
 * - `mono` (every theme): the mark's own file as a CSS mask over `currentColor`, so it
 *   takes the surrounding text colour — `text-muted-foreground` in a zone header.
 * - `brand`: the same `<img>` `ServiceLogo` renders for a `src` mark while the theme is
 *   light; in a dark theme, the `dark` choice above.
 */
export function VendorMark({ src, dark, size, variant }: VendorMarkProps) {
  if (variant === "mono") return <MaskMark src={src} />;
  if (dark === "keep") return <ImageMark src={src} size={size} />;
  return <ThemedBrandMark src={src} dark={dark} size={size} />;
}

/** `resolveThemeIsDark` on the rendered mark, re-read whenever `useTheme()` reports a
 *  theme change (the provider writes `data-theme` before that render). */
function ThemedBrandMark({ src, dark, size }: { src: string; dark: DarkMark; size: number }) {
  const { theme } = useTheme();
  const node = useRef<HTMLElement | null>(null);
  // First paint: the document's theme (no element yet); the layout effect then reads the
  // mark's own element, so a scoped `data-theme` subtree is honoured too.
  const [isDark, setIsDark] = useState(() => resolveThemeIsDark());
  useLayoutEffect(() => {
    setIsDark(resolveThemeIsDark(node.current));
  }, [theme]);
  const setNode = (el: HTMLElement | null) => {
    node.current = el;
  };

  if (!isDark || dark === "keep") return <ImageMark ref={setNode} src={src} size={size} />;
  if (dark === "mono") return <MaskMark ref={setNode} src={src} />;
  return <ImageMark ref={setNode} src={dark.src} size={size} />;
}

/** Exactly `ServiceLogo`'s own `<img>` for a `src` mark in `brand` (service-logo.tsx). */
function ImageMark({ src, size, ref }: { src: string; size: number; ref?: Ref<HTMLImageElement> }) {
  return (
    <img
      ref={ref}
      src={src}
      alt=""
      width={size}
      height={size}
      className="size-full object-contain"
    />
  );
}

/** The mark's file as an alpha mask over `currentColor`. The inline style carries only
 *  the mask URL, never a colour. */
function MaskMark({ src, ref }: { src: string; ref?: Ref<HTMLSpanElement> }) {
  const mask = `url("${src}")`;
  return (
    <span
      ref={ref}
      className="block size-full bg-current mask-contain mask-center mask-no-repeat"
      style={{ maskImage: mask, WebkitMaskImage: mask }}
    />
  );
}
