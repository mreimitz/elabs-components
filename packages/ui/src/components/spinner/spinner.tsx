"use client";

import { forwardRef } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "../../lib/cn";
import { useLocale } from "../locale-provider";

export interface SpinnerProps extends React.SVGProps<SVGSVGElement> {
  /** Accessible label; defaults to the localized "Loading…" microcopy. */
  label?: string;
}

/** Indeterminate spinner with an accessible label. */
export const Spinner = forwardRef<SVGSVGElement, SpinnerProps>(function Spinner(
  { className, label, ...props },
  ref,
) {
  const { t } = useLocale();
  return (
    <Loader2
      ref={ref}
      data-slot="spinner"
      role="status"
      aria-label={label ?? t("ui.spinner.label")}
      className={cn("size-4 animate-spin text-muted-foreground", className)}
      {...props}
    />
  );
});
