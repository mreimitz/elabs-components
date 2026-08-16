import { Loader2 } from "lucide-react";
import { cn } from "../../lib/cn";

export interface SpinnerProps extends React.SVGProps<SVGSVGElement> {
  /** Accessible label; defaults to "Loading". */
  label?: string;
}

/** Indeterminate spinner with an accessible label. */
export function Spinner({ className, label = "Loading", ...props }: SpinnerProps) {
  return (
    <Loader2
      role="status"
      aria-label={label}
      className={cn("size-4 animate-spin text-muted-foreground", className)}
      {...props}
    />
  );
}
