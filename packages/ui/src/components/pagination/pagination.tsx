import { forwardRef, type ComponentProps } from "react";
import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react";
import { cn } from "../../lib/cn";
import { buttonVariants } from "../button";
import { useLocale } from "../locale-provider";

export function Pagination({ className, ...props }: ComponentProps<"nav">) {
  return (
    <nav
      role="navigation"
      aria-label="pagination"
      className={cn("mx-auto flex w-full justify-center", className)}
      {...props}
    />
  );
}
export const PaginationContent = forwardRef<HTMLUListElement, ComponentProps<"ul">>(
  function PaginationContent({ className, ...props }, ref) {
    return (
      <ul ref={ref} className={cn("flex flex-row items-center gap-1", className)} {...props} />
    );
  },
);
export const PaginationItem = forwardRef<HTMLLIElement, ComponentProps<"li">>(
  function PaginationItem(props, ref) {
    return <li ref={ref} {...props} />;
  },
);
type PaginationLinkProps = { isActive?: boolean } & ComponentProps<"a">;
export function PaginationLink({ className, isActive, ...props }: PaginationLinkProps) {
  return (
    <a
      aria-current={isActive ? "page" : undefined}
      className={cn(
        buttonVariants({ variant: isActive ? "outline" : "ghost", size: "icon" }),
        "cursor-pointer",
        className,
      )}
      {...props}
    />
  );
}
export function PaginationPrevious({ className, ...props }: ComponentProps<"a">) {
  const { t } = useLocale();
  return (
    <a
      aria-label={t("ui.pagination.previous")}
      className={cn(buttonVariants({ variant: "ghost" }), "gap-1 ps-2.5 cursor-pointer", className)}
      {...props}
    >
      <ChevronLeft className="size-4" data-rtl-flip />
      <span>{t("previous")}</span>
    </a>
  );
}
export function PaginationNext({ className, ...props }: ComponentProps<"a">) {
  const { t } = useLocale();
  return (
    <a
      aria-label={t("ui.pagination.next")}
      className={cn(buttonVariants({ variant: "ghost" }), "gap-1 pe-2.5 cursor-pointer", className)}
      {...props}
    >
      <span>{t("next")}</span>
      <ChevronRight className="size-4" data-rtl-flip />
    </a>
  );
}
export function PaginationEllipsis({ className, ...props }: ComponentProps<"span">) {
  const { t } = useLocale();
  return (
    <span
      aria-hidden
      className={cn("flex size-9 items-center justify-center", className)}
      {...props}
    >
      <MoreHorizontal className="size-4" />
      <span className="sr-only">{t("ui.pagination.morePages")}</span>
    </span>
  );
}
