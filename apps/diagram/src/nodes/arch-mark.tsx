import { forwardRef, type HTMLAttributes } from "react";
import { ServiceLogo } from "@elabs-ai/components-icons";
import { cn } from "@elabs-ai/components-ui";
import { parseIconName } from "../icons/icon-name";
import { LUCIDE_ICONS, LucideByName } from "../icons/lucide-map";

export interface ArchMarkProps extends HTMLAttributes<HTMLSpanElement> {
  /** A `vendor/name` icon name. Unset → the generic `lucide/box` glyph. */
  icon?: string;
  /** Pixel size of the square mark. @default 40 */
  size?: number;
  /** `ServiceLogo`'s look for a vendored mark; a Lucide glyph is always `currentColor`. */
  variant?: "brand" | "mono";
}

const FALLBACK_GLYPH = "box";

const isLucideName = (name: string) => Object.prototype.hasOwnProperty.call(LUCIDE_ICONS, name);

/**
 * A node's mark from its icon NAME (plan D4): `lucide/<name>` → the Lucide glyph
 * (`LucideByName`, drawn in `currentColor`, so a `data-flow-tone-part="mark"` on this
 * element tints it); any other `vendor/name` → the vendored `ServiceLogo` (its monogram
 * fallback covers an unknown name). The mark is decorative (the node's title names it),
 * so `ServiceLogo` gets `decorative` and Lucide glyphs are `aria-hidden` by default.
 *
 * P4: library gap — flow's `FlowNodeBaseData.icon` is a `ReactNode`, so JSON node data
 * cannot name its mark; the library has no name-to-mark resolver spanning `ServiceLogo`
 * and Lucide. This component is that resolver, app-side.
 */
export const ArchMark = forwardRef<HTMLSpanElement, ArchMarkProps>(function ArchMark(
  { icon, size = 40, variant = "brand", className, ...props },
  ref,
) {
  const parsed = icon ? parseIconName(icon) : null;
  let mark;
  if (!icon) {
    mark = <LucideByName name={FALLBACK_GLYPH} size={size} />;
  } else if (parsed?.vendor === "lucide") {
    mark = (
      <LucideByName name={isLucideName(parsed.name) ? parsed.name : FALLBACK_GLYPH} size={size} />
    );
  } else {
    mark = <ServiceLogo decorative name={icon} size={size} variant={variant} />;
  }
  return (
    <span
      ref={ref}
      className={cn("inline-flex shrink-0 items-center justify-center", className)}
      data-slot="arch-mark"
      {...props}
    >
      {mark}
    </span>
  );
});
