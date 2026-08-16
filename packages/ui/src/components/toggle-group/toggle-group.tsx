import {
  createContext,
  forwardRef,
  useContext,
  type ComponentPropsWithoutRef,
  type ElementRef,
} from "react";
import * as ToggleGroupPrimitive from "@radix-ui/react-toggle-group";
import { type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/cn";
import { toggleVariants } from "../toggle";

type ToggleVariantProps = VariantProps<typeof toggleVariants>;
const ToggleGroupContext = createContext<ToggleVariantProps>({
  size: "default",
  variant: "default",
});

export const ToggleGroup = forwardRef<
  ElementRef<typeof ToggleGroupPrimitive.Root>,
  ComponentPropsWithoutRef<typeof ToggleGroupPrimitive.Root> & ToggleVariantProps
>(function ToggleGroup({ className, variant, size, children, ...props }, ref) {
  return (
    <ToggleGroupPrimitive.Root
      ref={ref}
      className={cn(
        "flex items-center gap-1",
        // Segmented groups carry the TabsList track (recessed muted fill);
        // the raised active segment comes from the item variant.
        variant === "segmented" && "gap-0 rounded-lg bg-muted p-1 text-muted-foreground",
        className,
      )}
      {...props}
    >
      <ToggleGroupContext.Provider value={{ variant, size }}>
        {children}
      </ToggleGroupContext.Provider>
    </ToggleGroupPrimitive.Root>
  );
});

export const ToggleGroupItem = forwardRef<
  ElementRef<typeof ToggleGroupPrimitive.Item>,
  ComponentPropsWithoutRef<typeof ToggleGroupPrimitive.Item> & ToggleVariantProps
>(function ToggleGroupItem({ className, children, variant, size, ...props }, ref) {
  const ctx = useContext(ToggleGroupContext);
  return (
    <ToggleGroupPrimitive.Item
      ref={ref}
      className={cn(
        toggleVariants({ variant: ctx.variant ?? variant, size: ctx.size ?? size }),
        className,
      )}
      {...props}
    >
      {children}
    </ToggleGroupPrimitive.Item>
  );
});
