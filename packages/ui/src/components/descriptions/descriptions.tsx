// a2ui.exposed: yes
import { createContext, forwardRef, use, type HTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/cn";

const descriptionsVariants = cva("grid gap-x-6 gap-y-3 text-sm", {
  variants: {
    columns: {
      1: "grid-cols-1",
      2: "grid-cols-1 sm:grid-cols-2",
      3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
    },
  },
  defaultVariants: {
    columns: 1,
  },
});

type DescriptionsLayout = "horizontal" | "vertical";

interface DescriptionsContextValue {
  layout: DescriptionsLayout;
}

const DescriptionsContext = createContext<DescriptionsContextValue>({ layout: "horizontal" });

export interface DescriptionsProps
  extends HTMLAttributes<HTMLDListElement>, VariantProps<typeof descriptionsVariants> {
  /**
   * Number of columns at the widest breakpoint. Collapses to a single column
   * on small screens. Default 1.
   */
  columns?: 1 | 2 | 3;
  /**
   * `horizontal` places the label beside the value; `vertical` stacks the
   * label above the value. Default `horizontal`.
   */
  layout?: DescriptionsLayout;
}

/**
 * Descriptions — a responsive definition list of label↔value pairs.
 *
 * Renders a native `<dl>`; compose with `DescriptionsItem` (`<dt>`/`<dd>`).
 * `columns` controls the grid; `layout` controls label placement per item.
 */
export const Descriptions = forwardRef<HTMLDListElement, DescriptionsProps>(function Descriptions(
  { columns = 1, layout = "horizontal", className, children, ...props },
  ref,
) {
  return (
    <DescriptionsContext value={{ layout }}>
      <dl ref={ref} className={cn(descriptionsVariants({ columns }), className)} {...props}>
        {children}
      </dl>
    </DescriptionsContext>
  );
});

export interface DescriptionsItemProps extends HTMLAttributes<HTMLDivElement> {
  /** The term / label for this entry. */
  label: React.ReactNode;
  /**
   * When the value is numeric, set this so the value uses `tabular-nums`
   * for aligned digits.
   */
  numeric?: boolean;
}

/**
 * DescriptionsItem — one label↔value pair (`<dt>` + `<dd>`) inside `Descriptions`.
 */
export const DescriptionsItem = forwardRef<HTMLDivElement, DescriptionsItemProps>(
  function DescriptionsItem({ label, numeric, className, children, ...props }, ref) {
    const { layout } = use(DescriptionsContext);
    return (
      <div
        ref={ref}
        className={cn(
          "min-w-0",
          layout === "horizontal" ? "flex items-baseline gap-3" : "flex flex-col gap-0.5",
          className,
        )}
        {...props}
      >
        <dt className={cn("text-muted-foreground", layout === "horizontal" && "w-1/3 shrink-0")}>
          {label}
        </dt>
        <dd className={cn("min-w-0 break-words text-foreground", numeric && "tabular-nums")}>
          {children}
        </dd>
      </div>
    );
  },
);
