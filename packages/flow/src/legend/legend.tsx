import { cn } from "@qlik-coe-emea/qlabs-components-ui/lib/cn";

export interface LegendItem {
  label: string;
  /** Any CSS color or token reference, e.g. "var(--chart-1)". */
  color: string;
}

export interface LegendProps {
  items: LegendItem[];
  title?: string;
  className?: string;
}

/** Small legend mapping colors/types to labels for a canvas or chart. */
export function Legend({ items, title, className }: LegendProps) {
  return (
    <div
      className={cn(
        "rounded-lg bg-surface-elevated/90 p-3 text-xs shadow-ring-sm backdrop-blur",
        className,
      )}
    >
      {title ? <div className="mb-1.5 font-medium text-foreground">{title}</div> : null}
      <ul className="space-y-1">
        {items.map((item) => (
          <li key={item.label} className="flex items-center gap-2 text-muted-foreground">
            <span
              aria-hidden="true"
              className="size-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: item.color }}
            />
            {item.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
