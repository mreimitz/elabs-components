import { forwardRef, type HTMLAttributes, type ReactNode } from "react";
import { cn } from "@elabs/components-ui/lib/cn";

export interface TitleBlockField {
  label: string;
  value: ReactNode;
}

export interface TitleBlockProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  /** Heading shown in the title row (repurposes the native `title` slot). */
  title?: ReactNode;
  scale?: string;
  sheet?: string;
  revision?: string;
  drawnBy?: string;
  date?: string;
  /** Optional brand mark / logo slot, shown beside the title. */
  logo?: ReactNode;
  /** Extra metadata cells appended after the standard ones. */
  fields?: TitleBlockField[];
}

/**
 * Drafting title-block strip: a ruled grid of metadata cells (scale / sheet /
 * revision / drawn-by / date) plus an optional title row. Informational, so it
 * is a labelled group; the dividing rules are borders (no extra ARIA). Designed
 * to dock into a {@link BlueprintFrame}.
 */
export const TitleBlock = forwardRef<HTMLDivElement, TitleBlockProps>(function TitleBlock(
  { title, scale, sheet, revision, drawnBy, date, logo, fields = [], className, ...props },
  ref,
) {
  const cells: TitleBlockField[] = [
    scale != null ? { label: "Scale", value: scale } : null,
    sheet != null ? { label: "Sheet", value: sheet } : null,
    revision != null ? { label: "Rev", value: revision } : null,
    drawnBy != null ? { label: "Drawn", value: drawnBy } : null,
    date != null ? { label: "Date", value: date } : null,
    ...fields,
  ].filter(Boolean) as TitleBlockField[];

  return (
    <div
      ref={ref}
      data-slot="title-block"
      role="group"
      aria-label="Title block"
      className={cn("border border-rule bg-card font-mono text-foreground", className)}
      {...props}
    >
      {title || logo ? (
        <div className="flex items-center justify-between gap-3 border-b border-rule px-3 py-2">
          <span className="text-sm font-semibold uppercase tracking-wide">{title}</span>
          {logo ? <span className="shrink-0">{logo}</span> : null}
        </div>
      ) : null}
      {cells.length ? (
        <div className="grid grid-cols-2 sm:grid-cols-3">
          {cells.map((c, i) => (
            <div key={i} className="border-b border-r border-rule px-3 py-1.5">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {c.label}
              </div>
              <div className="text-xs">{c.value}</div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
});
