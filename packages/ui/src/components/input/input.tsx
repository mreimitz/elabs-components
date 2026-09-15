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
        "flex h-control w-full rounded-control border border-input bg-input-background text-foreground px-3 py-1 text-sm shadow-input transition-[color,background-color,border-color,box-shadow] duration-fast ease-standard",
        "placeholder:text-muted-foreground",
        "focus-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
        "disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-muted disabled:border-border",
        "aria-[invalid=true]:border-destructive aria-[invalid=true]:ring-destructive",
        "file:border-0 file:bg-transparent file:text-sm file:font-medium",
        className,
      )}
      {...props}
    />
  );
});
