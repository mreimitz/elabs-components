import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "../../lib/cn";

export type InputProps = InputHTMLAttributes<HTMLInputElement>;

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, type = "text", ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      type={type}
      className={cn(
        "flex h-control w-full rounded-control border border-input bg-input-background text-foreground px-3 py-1 text-body shadow-input transition-[color,background-color,border-color,box-shadow] duration-fast ease-standard",
        "placeholder:text-muted-foreground",
        "focus-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background focus-visible:border-input-focus",
        // One disabled mechanism (opacity fade), matching every `Button`
        // variant — `disabled:bg-muted` used to also fire here, stacking a
        // fill swap on top of the fade (#286); `disabled:border-border` stays,
        // it is the separate/subtle "not editable" edge, not a fill.
        "disabled:cursor-not-allowed disabled:opacity-50 disabled:border-border",
        "aria-[invalid=true]:border-destructive aria-[invalid=true]:ring-destructive",
        "file:border-0 file:bg-transparent file:text-body file:font-medium",
        className,
      )}
      {...props}
    />
  );
});
