import { createContext, forwardRef, useContext, type ComponentProps } from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "../../lib/cn";
import { SkipLink } from "../skip-link";

interface SiteShellContextValue {
  mainId: string;
}

const SiteShellContext = createContext<SiteShellContextValue>({ mainId: "main-content" });

export interface SiteShellProps extends ComponentProps<"div"> {
  /**
   * The `<SiteShellMain>` region's id and the skip link's target. Override it
   * when a page mounts more than one shell. @default "main-content"
   */
  mainId?: string;
}

/**
 * Website layout — the counterpart to `AppShell` for a marketing site, docs
 * site or any route the DOCUMENT scrolls: a full-height column of
 * `SiteShellHeader` (sticky by default), `SiteShellMain` and `SiteShellFooter`,
 * with the skip link every site owes a keyboard user (WCAG 2.4.1) rendered
 * first. Pure layout — bring your own navbar, footer and banners; anything
 * before the header (an announcement bar) scrolls away, the header stays.
 */
export const SiteShell = forwardRef<HTMLDivElement, SiteShellProps>(function SiteShell(
  { mainId = "main-content", className, children, ...props },
  ref,
) {
  return (
    <SiteShellContext.Provider value={{ mainId }}>
      <div
        ref={ref}
        className={cn("flex min-h-svh flex-col bg-background text-foreground", className)}
        data-slot="site-shell"
        {...props}
      >
        <SkipLink targetId={mainId} />
        {children}
      </div>
    </SiteShellContext.Provider>
  );
});

export interface SiteShellHeaderProps extends ComponentProps<"header"> {
  /** Pin the header to the top of the viewport while the page scrolls. @default true */
  sticky?: boolean;
  /**
   * Render the child element as the header (Radix Slot) — for a navbar block
   * that already renders its own `<header>` landmark and surface. The shell
   * then adds only the positioning; the child keeps its own fill and hairline.
   */
  asChild?: boolean;
}

/**
 * The site header slot. Without `asChild` it is a `<header>` with a
 * translucent, blurred fill and a bottom hairline, so content sliding beneath
 * it stays legible; with `asChild` the child element is the header.
 */
export const SiteShellHeader = forwardRef<HTMLElement, SiteShellHeaderProps>(
  function SiteShellHeader({ sticky = true, asChild = false, className, ...props }, ref) {
    const Comp = asChild ? Slot : "header";
    return (
      // header-band-exempt: a positioning slot — the navbar it wraps carries `h-header`
      <Comp
        ref={ref}
        className={cn(
          sticky && "sticky top-0 z-40",
          !asChild && "border-b border-border-strong bg-background/85 backdrop-blur",
          className,
        )}
        data-slot="site-shell-header"
        data-sticky={sticky ? "" : undefined}
        {...props}
      />
    );
  },
);

export type SiteShellMainProps = ComponentProps<"main">;

/**
 * The `<main>` landmark and skip-link target: `id` from the shell, `tabIndex={-1}`
 * so focus actually lands here. Grows to push the footer to the bottom of short pages.
 */
export const SiteShellMain = forwardRef<HTMLElement, SiteShellMainProps>(function SiteShellMain(
  { className, ...props },
  ref,
) {
  const { mainId } = useContext(SiteShellContext);
  return (
    <main
      ref={ref}
      id={mainId}
      tabIndex={-1}
      className={cn("flex flex-1 flex-col outline-none", className)}
      data-slot="site-shell-main"
      {...props}
    />
  );
});

export interface SiteShellFooterProps extends ComponentProps<"footer"> {
  /** Render the child element as the footer (Radix Slot) — for a footer block with its own `<footer>`. */
  asChild?: boolean;
}

/** The site footer slot; a plain `<footer>` landmark unless `asChild`. */
export const SiteShellFooter = forwardRef<HTMLElement, SiteShellFooterProps>(
  function SiteShellFooter({ asChild = false, className, ...props }, ref) {
    const Comp = asChild ? Slot : "footer";
    return <Comp ref={ref} className={className} data-slot="site-shell-footer" {...props} />;
  },
);
