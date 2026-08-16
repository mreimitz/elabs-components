import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "../../lib/cn";

/** Keyboard key hint, e.g. <Kbd>⌘K</Kbd>. */
export const Kbd = forwardRef<HTMLElement, HTMLAttributes<HTMLElement>>(function Kbd(
  { className, ...props },
  ref,
) {
  return (
    <kbd
      translate="no"
      ref={ref}
      className={cn(
        "inline-flex h-5 min-w-5 select-none items-center justify-center gap-1 rounded border bg-muted px-1.5 font-mono text-[0.7rem] font-medium text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
});
