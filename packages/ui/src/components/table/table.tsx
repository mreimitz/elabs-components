import {
  forwardRef,
  type HTMLAttributes,
  type TdHTMLAttributes,
  type ThHTMLAttributes,
} from "react";
import { cn } from "../../lib/cn";

export const Table = forwardRef<HTMLTableElement, HTMLAttributes<HTMLTableElement>>(function Table(
  { className, ...props },
  ref,
) {
  return (
    <div className="relative w-full overflow-auto">
      <table ref={ref} className={cn("w-full caption-bottom text-body", className)} {...props} />
    </div>
  );
});
export const TableHeader = forwardRef<
  HTMLTableSectionElement,
  HTMLAttributes<HTMLTableSectionElement>
>(function TableHeader({ className, ...props }, ref) {
  // border-border-strong: the header-row bottom divider is the ONLY structural
  // cue between the header and the first data row on a shared card/background
  // surface (TableHeader itself carries no fill). Decision test: "If deleted,
  // could a sighted user still tell header from body?" No → border-strong.
  return (
    <thead
      ref={ref}
      className={cn("[&_tr]:border-b [&_tr]:border-border-strong", className)}
      {...props}
    />
  );
});
export const TableBody = forwardRef<
  HTMLTableSectionElement,
  HTMLAttributes<HTMLTableSectionElement>
>(function TableBody({ className, ...props }, ref) {
  return <tbody ref={ref} className={cn("[&_tr:last-child]:border-0", className)} {...props} />;
});
export const TableFooter = forwardRef<
  HTMLTableSectionElement,
  HTMLAttributes<HTMLTableSectionElement>
>(function TableFooter({ className, ...props }, ref) {
  // border-t stays on plain `border`: the footer's bg-surface-muted/50 fill is
  // a redundant cue — deleting the border still leaves a visible region change.
  // Decision test: "If deleted, could a sighted user still tell footer from
  // body?" Yes (fill differs) → redundant boundary → border.
  return (
    <tfoot
      ref={ref}
      className={cn("border-t bg-surface-muted/50 font-medium", className)}
      {...props}
    />
  );
});
export const TableRow = forwardRef<HTMLTableRowElement, HTMLAttributes<HTMLTableRowElement>>(
  function TableRow({ className, ...props }, ref) {
    return (
      <tr
        ref={ref}
        className={cn(
          // border-border-strong: each row divider is the ONLY structural cue
          // between adjacent rows on a shared card/background surface (no fill
          // alternation on the plain Table primitive). Decision test: "If
          // deleted, could a sighted user still tell the two rows apart?" No
          // (no fill change) → load-bearing → border-strong.
          "border-b border-border-strong transition-colors duration-fast ease-standard hover:bg-surface-muted/50 data-[state=selected]:bg-accent",
          className,
        )}
        {...props}
      />
    );
  },
);
export const TableHead = forwardRef<HTMLTableCellElement, ThHTMLAttributes<HTMLTableCellElement>>(
  function TableHead({ className, ...props }, ref) {
    return (
      <th
        ref={ref}
        className={cn(
          "h-10 px-3 text-start align-middle font-medium text-muted-foreground",
          className,
        )}
        {...props}
      />
    );
  },
);
export const TableCell = forwardRef<HTMLTableCellElement, TdHTMLAttributes<HTMLTableCellElement>>(
  function TableCell({ className, ...props }, ref) {
    return <td ref={ref} className={cn("px-3 py-2 align-middle", className)} {...props} />;
  },
);
export const TableCaption = forwardRef<
  HTMLTableCaptionElement,
  HTMLAttributes<HTMLTableCaptionElement>
>(function TableCaption({ className, ...props }, ref) {
  return (
    <caption
      ref={ref}
      className={cn("mt-4 text-body text-muted-foreground", className)}
      {...props}
    />
  );
});
