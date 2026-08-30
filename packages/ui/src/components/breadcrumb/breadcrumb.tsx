import { forwardRef, type ComponentProps, type ReactNode } from "react";
import { Slot } from "@radix-ui/react-slot";
import { ChevronRight, MoreHorizontal } from "lucide-react";
import { cn } from "../../lib/cn";
import { useLocale } from "../locale-provider";

export const Breadcrumb = forwardRef<HTMLElement, ComponentProps<"nav">>(
  function Breadcrumb(props, ref) {
    return <nav ref={ref} aria-label="breadcrumb" {...props} />;
  },
);
export const BreadcrumbList = forwardRef<HTMLOListElement, ComponentProps<"ol">>(
  function BreadcrumbList({ className, ...props }, ref) {
    return (
      <ol
        ref={ref}
        className={cn(
          "flex flex-wrap items-center gap-1.5 break-words text-sm text-muted-foreground",
          className,
        )}
        {...props}
      />
    );
  },
);
export const BreadcrumbItem = forwardRef<HTMLLIElement, ComponentProps<"li">>(
  function BreadcrumbItem({ className, ...props }, ref) {
    return (
      <li ref={ref} className={cn("inline-flex items-center gap-1.5", className)} {...props} />
    );
  },
);
export const BreadcrumbLink = forwardRef<
  HTMLAnchorElement,
  ComponentProps<"a"> & { asChild?: boolean }
>(function BreadcrumbLink({ className, asChild, ...props }, ref) {
  const Comp = asChild ? Slot : "a";
  return (
    <Comp
      ref={ref}
      className={cn("transition-colors duration-fast hover:text-foreground", className)}
      {...props}
    />
  );
});
export const BreadcrumbPage = forwardRef<HTMLSpanElement, ComponentProps<"span">>(
  function BreadcrumbPage({ className, ...props }, ref) {
    return (
      <span
        ref={ref}
        role="link"
        aria-disabled="true"
        aria-current="page"
        className={cn("font-medium text-foreground", className)}
        {...props}
      />
    );
  },
);
export function BreadcrumbSeparator({ children, className, ...props }: ComponentProps<"li">) {
  return (
    <li
      role="presentation"
      aria-hidden="true"
      className={cn("[&>svg]:size-3.5", className)}
      {...props}
    >
      {children ?? <ChevronRight />}
    </li>
  );
}
export function BreadcrumbEllipsis({ className, ...props }: ComponentProps<"span">) {
  const { t } = useLocale();
  return (
    <span
      role="presentation"
      aria-hidden="true"
      className={cn("flex size-9 items-center justify-center", className)}
      {...props}
    >
      <MoreHorizontal className="size-4" />
      <span className="sr-only">{t("more")}</span>
    </span>
  );
}
export function BreadcrumbItems({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
