"use client";

import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ComponentProps,
  type CSSProperties,
} from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { PanelLeftIcon } from "lucide-react";
import { cn } from "../../lib/cn";
import { useIsMobile } from "../../lib/use-mobile";
import { Button } from "../button";
import { useCollapsiblePanel } from "../collapsible-panel";
import { Input } from "../input";
import { useLocale } from "../locale-provider";
import { Separator } from "../separator";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "../sheet";
import { Skeleton } from "../skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../tooltip";

const SIDEBAR_COOKIE_NAME = "sidebar_state";
const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;
const SIDEBAR_WIDTH = "16rem";
const SIDEBAR_WIDTH_MOBILE = "18rem";
const SIDEBAR_WIDTH_ICON = "3rem";
const SIDEBAR_KEYBOARD_SHORTCUT = "b";

type SidebarContextProps = {
  state: "expanded" | "collapsed";
  open: boolean;
  setOpen: (open: boolean) => void;
  openMobile: boolean;
  setOpenMobile: (open: boolean) => void;
  isMobile: boolean;
  toggleSidebar: () => void;
};

const SidebarContext = createContext<SidebarContextProps | null>(null);

export function useSidebar() {
  const context = useContext(SidebarContext);
  if (!context) throw new Error("useSidebar must be used within a SidebarProvider.");
  return context;
}

export const SidebarProvider = forwardRef<
  HTMLDivElement,
  ComponentProps<"div"> & {
    defaultOpen?: boolean;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    /**
     * Drives the frame's inset treatment from an ANCESTOR the whole frame can
     * see — `SidebarInset` (#342 fix) reads it as `data-variant` on this
     * wrapper via `group-data-[variant=inset]/sidebar-wrapper:`, which reaches
     * regardless of DOM order (unlike the legacy `peer-*` combinator, which
     * only matches a Sidebar that comes AFTER). Optional and unset by
     * default, so an existing caller that only sets `variant` on `Sidebar`
     * is unaffected.
     */
    variant?: "sidebar" | "floating" | "inset";
    /**
     * Default `"app"` — today's behaviour, byte-identical. `"nested"` is for
     * a `SidebarProvider` a compound component (e.g. `ContextRail`, ADR 0035
     * §4) mounts internally so `useSidebar()` reports ITS OWN state to its
     * own parts: it still provides `SidebarContext` and the two
     * `--sidebar-width*` custom properties (which survive `display:
     * contents`), but renders no frame box, no `data-slot`/`data-variant`/
     * `data-state`, registers no global `⌘B`/`Ctrl+B` listener, and writes no
     * `sidebar_state` cookie — so a nested rail can never be mistaken for a
     * second app frame. See the emission table in ADR 0035 §4.
     */
    frame?: "app" | "nested";
  }
>(function SidebarProvider(
  {
    defaultOpen = true,
    open: openProp,
    onOpenChange: setOpenProp,
    variant,
    frame = "app",
    className,
    style,
    children,
    ...props
  },
  ref,
) {
  const isNested = frame === "nested";
  const isMobile = useIsMobile();
  const [openMobile, setOpenMobile] = useState(false);

  const [_open, _setOpen] = useState(defaultOpen);
  const open = openProp ?? _open;
  const setOpen = useCallback(
    (value: boolean | ((value: boolean) => boolean)) => {
      const openState = typeof value === "function" ? value(open) : value;
      if (setOpenProp) setOpenProp(openState);
      else _setOpen(openState);
      // A nested provider (ADR 0035 §4) is not the app frame, so it must not
      // persist ITS state as if it were — only `frame="app"` (the default)
      // owns the `sidebar_state` cookie.
      if (!isNested && typeof document !== "undefined") {
        document.cookie = `${SIDEBAR_COOKIE_NAME}=${openState}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}`;
      }
    },
    [setOpenProp, open, isNested],
  );

  const toggleSidebar = useCallback(() => {
    return isMobile ? setOpenMobile((o) => !o) : setOpen((o) => !o);
  }, [isMobile, setOpen]);

  useEffect(() => {
    // Same reasoning as the cookie write above: the global keyboard shortcut
    // belongs to the ONE app frame, not to every nested provider a compound
    // component happens to mount.
    if (isNested) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === SIDEBAR_KEYBOARD_SHORTCUT && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        toggleSidebar();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isNested, toggleSidebar]);

  const state = open ? "expanded" : "collapsed";

  const contextValue = useMemo<SidebarContextProps>(
    () => ({ state, open, setOpen, isMobile, openMobile, setOpenMobile, toggleSidebar }),
    [state, open, setOpen, isMobile, openMobile, toggleSidebar],
  );

  return (
    <SidebarContext.Provider value={contextValue}>
      <TooltipProvider delayDuration={0}>
        <div
          ref={ref}
          // `data-slot`/`data-variant`/`data-state`/`group/sidebar-wrapper`
          // (in the class list below) are ADR 0035 §8 refinement 3's
          // `frame="app"` surface. `frame="nested"` (ADR 0035 §4, Task 9A)
          // omits all four: a nested rail's own state must never drive the
          // outer frame's geometry through the same group name or be mistaken
          // for a second "sidebar wrapper" by a selector/test targeting the
          // slot. The literal string "sidebar-wrapper" stays below (as a
          // conditional value) so `pnpm data-slot:check` still sees this
          // module's declaration.
          data-slot={isNested ? undefined : "sidebar-wrapper"}
          data-variant={isNested ? undefined : variant}
          data-state={isNested ? undefined : state}
          style={
            {
              // These two custom properties are the ONE thing a nested
              // provider still emits (ADR 0035 §4) — they survive `display:
              // contents` because custom properties inherit down the DOM
              // tree regardless of the box an element generates, which is
              // exactly how a nested rail publishes its width to whatever it
              // wraps. Never move them onto a child.
              "--sidebar-width": SIDEBAR_WIDTH,
              "--sidebar-width-icon": SIDEBAR_WIDTH_ICON,
              ...style,
            } as CSSProperties
          }
          className={cn(
            // The wrapper spans the WHOLE app frame — chrome AND content — so its
            // ink is the ordinary page ink, not the chrome's. `Sidebar` (desktop
            // and mobile) sets `text-sidebar-foreground` on itself, so the chrome
            // is covered without painting chrome ink onto the canvas. Putting the
            // chrome ink here was invisible only while a theme happened to give
            // `--sidebar` and `--background` the same polarity: a theme with dark
            // chrome under a light canvas rendered near-white text on the canvas
            // for every element that inherits its colour (outline Buttons, list
            // rows). See the chrome<canvas elevation invariant in
            // .claude/rules/styling-and-tokens.md.
            // Omitted under `frame="nested"` — a nested provider is a pure
            // context + custom-property carrier, not a second frame box.
            !isNested && "group/sidebar-wrapper flex min-h-svh w-full text-foreground",
            // The frame's OWN `variant` is authoritative once set (ADR 0035 §8
            // refinement 4): resolved in JS, not by a CSS descendant match, so
            // a nested rail three levels down that happens to render
            // `variant="inset"` can never repaint THIS frame's ground merely
            // because `:has()` is depth-unlimited. `has-data-[variant=inset]`
            // stays as the fallback ONLY while this provider's own `variant`
            // is unset, which is exactly every existing caller (this prop
            // didn't exist before #342) — so they render exactly as today.
            // Also omitted under `frame="nested"`, same reasoning as above.
            !isNested &&
              (variant === undefined
                ? "has-data-[variant=inset]:bg-sidebar"
                : variant === "inset" && "bg-sidebar"),
            // `frame="nested"` renders no box of its own: `display: contents`
            // (the literal Tailwind class, never an inline style or a
            // concatenated name) removes this element from layout while
            // keeping its children — and the custom properties above —
            // reachable.
            isNested && "contents",
            className,
          )}
          {...props}
        >
          {children}
        </div>
      </TooltipProvider>
    </SidebarContext.Provider>
  );
});

export const Sidebar = forwardRef<
  HTMLDivElement,
  ComponentProps<"div"> & {
    side?: "left" | "right";
    variant?: "sidebar" | "floating" | "inset";
    collapsible?: "offcanvas" | "icon" | "none";
  }
>(function Sidebar(
  { side = "left", variant = "sidebar", collapsible = "offcanvas", className, children, ...props },
  ref,
) {
  const { isMobile, openMobile, setOpenMobile, open, setOpen } = useSidebar();
  const { t } = useLocale();

  // The collapse mechanism (gap spacer + fixed slide) is the canonical
  // useCollapsiblePanel hook (#190, research 09 §B.2) — Sidebar passes its
  // literal width/collapse/slide utilities (Tailwind scans THIS file for
  // them) and gets back its original class fragments byte-identically.
  const panel = useCollapsiblePanel({
    side,
    open,
    onOpenChange: setOpen,
    widthClassName: "w-(--sidebar-width)",
    spacerCollapsedClassName: "group-data-[collapsible=offcanvas]:w-0",
    containerSlideClassNames: {
      left: "left-0 group-data-[collapsible=offcanvas]:left-[calc(var(--sidebar-width)*-1)]",
      right: "right-0 group-data-[collapsible=offcanvas]:right-[calc(var(--sidebar-width)*-1)]",
    },
  });

  if (collapsible === "none") {
    return (
      <div
        ref={ref}
        data-slot="sidebar"
        className={cn(
          "flex h-full w-(--sidebar-width) flex-col bg-sidebar text-sidebar-foreground",
          className,
        )}
        {...props}
      >
        {children}
      </div>
    );
  }

  if (isMobile) {
    return (
      <Sheet open={openMobile} onOpenChange={setOpenMobile} {...props}>
        <SheetContent
          data-sidebar="sidebar"
          data-slot="sidebar"
          data-mobile="true"
          side={side}
          className="w-[var(--sidebar-width)] bg-sidebar p-0 text-sidebar-foreground [&>button]:hidden"
          style={{ "--sidebar-width": SIDEBAR_WIDTH_MOBILE } as CSSProperties}
        >
          <SheetHeader className="sr-only">
            <SheetTitle>{t("ui.sidebar.title")}</SheetTitle>
            <SheetDescription>Displays the mobile sidebar.</SheetDescription>
          </SheetHeader>
          <div className="flex h-full w-full flex-col">{children}</div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <div
      ref={ref}
      className="group peer hidden text-sidebar-foreground md:block"
      data-state={panel.attrs["data-state"]}
      data-collapsible={panel.state === "collapsed" ? collapsible : ""}
      data-variant={variant}
      data-side={panel.attrs["data-side"]}
      data-slot="sidebar"
    >
      <div
        data-slot="sidebar-gap"
        className={cn(
          panel.spacerClassName,
          "group-data-[side=right]:rotate-180",
          variant === "floating" || variant === "inset"
            ? "group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)+(--spacing(4)))]"
            : "group-data-[collapsible=icon]:w-(--sidebar-width-icon)",
        )}
      />
      <div
        data-slot="sidebar-container"
        className={cn(
          panel.containerClassName,
          variant === "floating" || variant === "inset"
            ? "p-2 group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)+(--spacing(4))+2px)]"
            : // `border-sidebar-border`, not the inherited canvas `--border`:
              // this edge is CHROME, so it takes the chrome edge token — the
              // same one the `floating` variant's inner surface and
              // `SidebarSeparator` already use. Left to the canvas token it was
              // a near-white hairline (light: L 0.88), invisible against the
              // page but a bright line as soon as the rail sits on a
              // `bg-sidebar` ground — which is exactly what an `inset` frame
              // puts behind it, measured at the dashboard shell's right-hand
              // `ContextRail`.
              "group-data-[collapsible=icon]:w-(--sidebar-width-icon) border-sidebar-border group-data-[side=left]:border-r group-data-[side=right]:border-l",
          className,
        )}
        {...props}
      >
        <div
          data-sidebar="sidebar"
          data-slot="sidebar-inner"
          className="flex h-full w-full flex-col bg-sidebar group-data-[variant=floating]:rounded-lg group-data-[variant=floating]:border group-data-[variant=floating]:border-sidebar-border group-data-[variant=floating]:shadow-sm"
        >
          {children}
        </div>
      </div>
    </div>
  );
});

export const SidebarTrigger = forwardRef<HTMLButtonElement, ComponentProps<typeof Button>>(
  function SidebarTrigger({ className, onClick, ...props }, ref) {
    const { isMobile, open, openMobile, toggleSidebar } = useSidebar();
    // `toggleSidebar` flips `openMobile` below the mobile breakpoint and `open`
    // above it, so the state this button EXPOSES has to be read the same way —
    // reporting the desktop `open` on a mobile viewport would announce the
    // opposite of what the button does.
    const expanded = isMobile ? openMobile : open;
    return (
      <Button
        ref={ref}
        data-sidebar="trigger"
        data-slot="sidebar-trigger"
        variant="ghost"
        size="icon"
        // A disclosure control must EXPOSE the state it toggles (WCAG 4.1.2).
        // This button's whole accessible name is the static "Toggle Sidebar"
        // below, so without this attribute nothing tells a screen-reader user
        // whether the rail is currently open — and no axe rule catches it,
        // because a <button> has no REQUIRED expanded state.
        //
        // `aria-controls` is deliberately omitted, not forgotten: on mobile the
        // sidebar renders into a `Sheet` that is not in the document while
        // closed, so the attribute would point at an absent id — worse than
        // leaving it off. Spread last, so a caller that really does own a
        // stable target can still supply both.
        aria-expanded={expanded}
        className={cn("size-7", className)}
        onClick={(event) => {
          onClick?.(event);
          toggleSidebar();
        }}
        {...props}
      >
        <PanelLeftIcon />
        <span className="sr-only">Toggle Sidebar</span>
      </Button>
    );
  },
);

export const SidebarRail = forwardRef<HTMLButtonElement, ComponentProps<"button">>(
  function SidebarRail({ className, ...props }, ref) {
    const { toggleSidebar } = useSidebar();
    return (
      <button
        ref={ref}
        data-sidebar="rail"
        data-slot="sidebar-rail"
        aria-label="Toggle Sidebar"
        tabIndex={-1}
        onClick={toggleSidebar}
        title="Toggle Sidebar"
        className={cn(
          "absolute inset-y-0 z-20 hidden w-4 -translate-x-1/2 transition-all ease-linear group-data-[side=left]:-right-4 group-data-[side=right]:left-0 after:absolute after:inset-y-0 after:left-1/2 after:w-[2px] hover:after:bg-sidebar-border sm:flex",
          "in-data-[side=left]:cursor-w-resize in-data-[side=right]:cursor-e-resize",
          "[[data-side=left][data-collapsible=offcanvas]_&]:-right-2 [[data-side=right][data-collapsible=offcanvas]_&]:-left-2",
          className,
        )}
        {...props}
      />
    );
  },
);

/**
 * Which sides of the floating "inset" surface get a gutter, once an ancestor
 * drives the treatment (`SidebarProvider variant="inset"`, or the legacy
 * immediately-preceding `Sidebar variant="inset"`).
 *
 * - `"auto"` (default) — today's rule, unchanged: a gutter on every side
 *   except the leading edge (`m-2 ms-0`, because the classic layout puts the
 *   sidebar there), plus the leading edge's gutter returns (`ms-2`) once that
 *   sidebar collapses and its own gap closes.
 * - `"none"` — no gutter margin (the unconditional radius/shadow below still
 *   apply).
 * - An object — pick sides explicitly. `{ start: true, bottom: true }` is the
 *   "flush rail" geometry: a leading + bottom gutter only, no top, no
 *   trailing, because the trailing edge sits flush against a rail — a tab
 *   must touch the page it belongs to.
 *
 * PRECEDENCE (fix round 1, #342): a caller composing BOTH mechanisms at once
 * — `SidebarProvider variant="inset"` AND a LEFT `Sidebar variant="inset"`,
 * the shape a left-hand shell (e.g. the sidebar-02 rebuild) uses — never hits
 * a class-order race, because the ancestor-scoped and legacy peer-scoped
 * margin classes are BOTH derived from this same `gutter` value, so whenever
 * both selectors match they emit identical declarations instead of competing
 * ones; the resolved geometry is always exactly what `gutter` says, decided
 * by this prop, never by the generated stylesheet's rule order.
 */
export type SidebarInsetGutter =
  | "auto"
  | "none"
  | { top?: boolean; bottom?: boolean; start?: boolean; end?: boolean };

export interface SidebarInsetProps extends ComponentProps<"main"> {
  gutter?: SidebarInsetGutter;
}

// Each side is a COMPLETE literal utility string, one per SELECTOR SCOPE:
// `ancestor` (`group-data-…/sidebar-wrapper:`, reaches a `SidebarProvider
// variant="inset"` regardless of DOM order — the #342 fix) and `legacy`
// (`peer-data-…:`, reaches a `Sidebar variant="inset"` that immediately
// precedes this element — every caller before #342). Both scopes read the
// SAME `gutter` value below, which is what keeps them from ever disagreeing.
// Tailwind's content scanner only recognises literal class text in source —
// never a name assembled by concatenation/interpolation
// (.claude/rules/styling-and-tokens.md) — so the object form below picks
// among these literals, it never builds one.
const SIDEBAR_INSET_GUTTER_SIDE_CLASS = {
  top: {
    ancestor: "md:group-data-[variant=inset]/sidebar-wrapper:mt-2",
    legacy: "md:peer-data-[variant=inset]:mt-2",
  },
  bottom: {
    ancestor: "md:group-data-[variant=inset]/sidebar-wrapper:mb-2",
    legacy: "md:peer-data-[variant=inset]:mb-2",
  },
  start: {
    ancestor: "md:group-data-[variant=inset]/sidebar-wrapper:ms-2",
    legacy: "md:peer-data-[variant=inset]:ms-2",
  },
  end: {
    ancestor: "md:group-data-[variant=inset]/sidebar-wrapper:me-2",
    legacy: "md:peer-data-[variant=inset]:me-2",
  },
} as const;

// "auto" is its own complete literal pair, not composed from the map above,
// because it also carries the collapsed-state clause: the sidebar's own gap
// closes on collapse, so the inset's leading margin has to come back.
const SIDEBAR_INSET_GUTTER_AUTO_CLASS = {
  ancestor:
    "md:group-data-[variant=inset]/sidebar-wrapper:m-2 md:group-data-[variant=inset]/sidebar-wrapper:ms-0 md:group-data-[variant=inset]/sidebar-wrapper:group-data-[state=collapsed]/sidebar-wrapper:ms-2",
  legacy:
    "md:peer-data-[variant=inset]:m-2 md:peer-data-[variant=inset]:ms-0 md:peer-data-[variant=inset]:peer-data-[state=collapsed]:ms-2",
} as const;

function sidebarInsetGutterClassName(
  gutter: SidebarInsetGutter,
  scope: "ancestor" | "legacy",
): string {
  if (gutter === "auto") return SIDEBAR_INSET_GUTTER_AUTO_CLASS[scope];
  if (gutter === "none") return "";
  return cn(
    gutter.top && SIDEBAR_INSET_GUTTER_SIDE_CLASS.top[scope],
    gutter.bottom && SIDEBAR_INSET_GUTTER_SIDE_CLASS.bottom[scope],
    gutter.start && SIDEBAR_INSET_GUTTER_SIDE_CLASS.start[scope],
    gutter.end && SIDEBAR_INSET_GUTTER_SIDE_CLASS.end[scope],
  );
}

export const SidebarInset = forwardRef<HTMLDivElement, SidebarInsetProps>(function SidebarInset(
  { className, gutter = "auto", ...props },
  ref,
) {
  return (
    <main
      ref={ref}
      data-slot="sidebar-inset"
      className={cn(
        "relative flex w-full flex-1 flex-col bg-background",
        // Ancestor-scoped (#342 fix): `group/sidebar-wrapper` spans the whole
        // frame, so this reaches a right-hand or reordered `Sidebar` the old
        // peer-* combinator could not (it only matches a sibling that comes
        // AFTER). Reads `SidebarProvider`'s own `data-variant`/`data-state`.
        // Radius/shadow are unconditional here — not gated by `gutter`.
        "md:group-data-[variant=inset]/sidebar-wrapper:rounded-xl md:group-data-[variant=inset]/sidebar-wrapper:shadow-sm",
        sidebarInsetGutterClassName(gutter, "ancestor"),
        // Legacy peer rule — reaches a shell that sets `variant` only on
        // `Sidebar` (every caller before #342). Radius/shadow unconditional
        // here too; the margin is driven by the SAME `gutter` value as the
        // ancestor rule above (fix round 1, #342), so a caller composing both
        // mechanisms at once never hits a stylesheet-order race — whichever
        // selector matches emits the identical declaration.
        "md:peer-data-[variant=inset]:rounded-xl md:peer-data-[variant=inset]:shadow-sm",
        sidebarInsetGutterClassName(gutter, "legacy"),
        className,
      )}
      {...props}
    />
  );
});

export const SidebarInput = forwardRef<HTMLInputElement, ComponentProps<typeof Input>>(
  function SidebarInput({ className, ...props }, ref) {
    return (
      <Input
        ref={ref}
        data-slot="sidebar-input"
        data-sidebar="input"
        className={cn("h-8 w-full bg-background shadow-none", className)}
        {...props}
      />
    );
  },
);

export const SidebarHeader = forwardRef<HTMLDivElement, ComponentProps<"div">>(
  function SidebarHeader({ className, ...props }, ref) {
    return (
      <div
        ref={ref}
        data-slot="sidebar-header"
        data-sidebar="header"
        className={cn("flex flex-col gap-2 p-2", className)}
        {...props}
      />
    );
  },
);

export const SidebarFooter = forwardRef<HTMLDivElement, ComponentProps<"div">>(
  function SidebarFooter({ className, ...props }, ref) {
    return (
      <div
        ref={ref}
        data-slot="sidebar-footer"
        data-sidebar="footer"
        className={cn("flex flex-col gap-2 p-2", className)}
        {...props}
      />
    );
  },
);

export const SidebarSeparator = forwardRef<HTMLDivElement, ComponentProps<typeof Separator>>(
  function SidebarSeparator({ className, ...props }, ref) {
    return (
      <Separator
        ref={ref}
        data-slot="sidebar-separator"
        data-sidebar="separator"
        className={cn("mx-2 w-auto bg-sidebar-border", className)}
        {...props}
      />
    );
  },
);

export const SidebarContent = forwardRef<HTMLDivElement, ComponentProps<"div">>(
  function SidebarContent({ className, ...props }, ref) {
    return (
      <div
        ref={ref}
        data-slot="sidebar-content"
        data-sidebar="content"
        className={cn(
          "flex min-h-0 flex-1 flex-col gap-2 overflow-auto group-data-[collapsible=icon]:overflow-hidden",
          className,
        )}
        {...props}
      />
    );
  },
);

export const SidebarGroup = forwardRef<HTMLDivElement, ComponentProps<"div">>(function SidebarGroup(
  { className, ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      data-slot="sidebar-group"
      data-sidebar="group"
      className={cn("relative flex w-full min-w-0 flex-col p-2", className)}
      {...props}
    />
  );
});

export const SidebarGroupLabel = forwardRef<
  HTMLDivElement,
  ComponentProps<"div"> & { asChild?: boolean }
>(function SidebarGroupLabel({ className, asChild = false, ...props }, ref) {
  const Comp = asChild ? Slot : "div";
  return (
    <Comp
      ref={ref}
      data-slot="sidebar-group-label"
      data-sidebar="group-label"
      className={cn(
        "flex h-8 shrink-0 items-center rounded-md px-2 text-meta font-medium text-sidebar-muted-foreground focus-ring [--focus-ring-color:var(--sidebar-ring)] transition-[opacity] duration-base ease-linear [&>svg]:size-4 [&>svg]:shrink-0",
        "group-data-[collapsible=icon]:hidden",
        className,
      )}
      {...props}
    />
  );
});

export const SidebarGroupAction = forwardRef<
  HTMLButtonElement,
  ComponentProps<"button"> & { asChild?: boolean }
>(function SidebarGroupAction({ className, asChild = false, ...props }, ref) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      ref={ref}
      data-slot="sidebar-group-action"
      data-sidebar="group-action"
      className={cn(
        "absolute end-3 top-3.5 flex aspect-square w-5 items-center justify-center rounded-md p-0 text-sidebar-foreground focus-ring [--focus-ring-color:var(--sidebar-ring)] transition-transform hover:bg-sidebar-accent hover:text-sidebar-accent-foreground [&>svg]:size-4 [&>svg]:shrink-0 after:absolute after:-inset-2 md:after:hidden",
        "group-data-[collapsible=icon]:hidden",
        className,
      )}
      {...props}
    />
  );
});

export const SidebarGroupContent = forwardRef<HTMLDivElement, ComponentProps<"div">>(
  function SidebarGroupContent({ className, ...props }, ref) {
    return (
      <div
        ref={ref}
        data-slot="sidebar-group-content"
        data-sidebar="group-content"
        className={cn("w-full text-body", className)}
        {...props}
      />
    );
  },
);

export const SidebarMenu = forwardRef<HTMLUListElement, ComponentProps<"ul">>(function SidebarMenu(
  { className, ...props },
  ref,
) {
  return (
    <ul
      ref={ref}
      data-slot="sidebar-menu"
      data-sidebar="menu"
      className={cn("flex w-full min-w-0 flex-col gap-1", className)}
      {...props}
    />
  );
});

export const SidebarMenuItem = forwardRef<HTMLLIElement, ComponentProps<"li">>(
  function SidebarMenuItem({ className, ...props }, ref) {
    return (
      <li
        ref={ref}
        data-slot="sidebar-menu-item"
        data-sidebar="menu-item"
        className={cn("group/menu-item relative", className)}
        {...props}
      />
    );
  },
);

export const sidebarMenuButtonVariants = cva(
  "peer/menu-button relative flex w-full items-center gap-2 overflow-hidden rounded-md p-2 text-start text-body text-sidebar-foreground focus-ring [--focus-ring-color:var(--sidebar-ring)] transition-[width,height,padding] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground active:bg-sidebar-accent active:text-sidebar-accent-foreground disabled:pointer-events-none disabled:opacity-50 group-has-data-[sidebar=menu-action]/menu-item:pe-8 aria-disabled:pointer-events-none aria-disabled:opacity-50 data-[active=true]:bg-sidebar-accent data-[active=true]:font-semibold data-[active=true]:text-sidebar-accent-foreground data-[active=true]:[&>svg]:text-sidebar-primary data-[active=true]:before:pointer-events-none data-[active=true]:before:absolute data-[active=true]:before:inset-y-1.5 data-[active=true]:before:start-0 data-[active=true]:before:w-1 data-[active=true]:before:rounded-full data-[active=true]:before:bg-sidebar-primary data-[state=open]:hover:bg-sidebar-accent data-[state=open]:hover:text-sidebar-accent-foreground group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:p-2! [&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        // A 1px outline drawn as the ring layer, not a `border` — the button sits
        // in a fixed-height menu row, so an edge that took layout space would
        // change its metrics. `shadow-hairline` reads --shadow-ring-color, so the
        // sidebar retints it (chrome has its own edge tokens) instead of
        // hand-rolling `shadow-[0_0_0_1px_…]`.
        outline:
          "bg-background shadow-hairline [--shadow-ring-color:var(--sidebar-border)] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground hover:[--shadow-ring-color:var(--sidebar-accent)]",
      },
      size: {
        default: "h-8 text-body",
        sm: "h-7 text-meta",
        lg: "h-12 text-body group-data-[collapsible=icon]:p-0!",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export const SidebarMenuButton = forwardRef<
  HTMLButtonElement,
  ComponentProps<"button"> & {
    asChild?: boolean;
    isActive?: boolean;
    tooltip?: string | ComponentProps<typeof TooltipContent>;
  } & VariantProps<typeof sidebarMenuButtonVariants>
>(function SidebarMenuButton(
  {
    asChild = false,
    isActive = false,
    variant = "default",
    size = "default",
    tooltip,
    className,
    ...props
  },
  ref,
) {
  const Comp = asChild ? Slot : "button";
  const { isMobile, state } = useSidebar();

  const button = (
    <Comp
      ref={ref}
      data-slot="sidebar-menu-button"
      data-sidebar="menu-button"
      data-size={size}
      data-active={isActive}
      className={cn(sidebarMenuButtonVariants({ variant, size }), className)}
      {...props}
    />
  );

  if (!tooltip) return button;
  const tooltipProps = typeof tooltip === "string" ? { children: tooltip } : tooltip;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent
        side="right"
        align="center"
        hidden={state !== "collapsed" || isMobile}
        {...tooltipProps}
      />
    </Tooltip>
  );
});

export const SidebarMenuAction = forwardRef<
  HTMLButtonElement,
  ComponentProps<"button"> & { asChild?: boolean; showOnHover?: boolean }
>(function SidebarMenuAction({ className, asChild = false, showOnHover = false, ...props }, ref) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      ref={ref}
      data-slot="sidebar-menu-action"
      data-sidebar="menu-action"
      className={cn(
        "absolute end-1 top-1.5 flex aspect-square w-5 items-center justify-center rounded-md p-0 text-sidebar-foreground focus-ring [--focus-ring-color:var(--sidebar-ring)] transition-transform hover:bg-sidebar-accent hover:text-sidebar-accent-foreground peer-hover/menu-button:text-sidebar-accent-foreground [&>svg]:size-4 [&>svg]:shrink-0 after:absolute after:-inset-2 md:after:hidden",
        "group-data-[collapsible=icon]:hidden",
        showOnHover &&
          "group-focus-within/menu-item:opacity-100 group-hover/menu-item:opacity-100 data-[state=open]:opacity-100 peer-data-[active=true]/menu-button:text-sidebar-accent-foreground md:opacity-0",
        className,
      )}
      {...props}
    />
  );
});

export const SidebarMenuBadge = forwardRef<HTMLDivElement, ComponentProps<"div">>(
  function SidebarMenuBadge({ className, ...props }, ref) {
    return (
      <div
        ref={ref}
        data-slot="sidebar-menu-badge"
        data-sidebar="menu-badge"
        className={cn(
          "pointer-events-none absolute end-1 flex h-5 min-w-5 select-none items-center justify-center rounded-md px-1 text-meta font-medium tabular-nums text-sidebar-foreground",
          "peer-hover/menu-button:text-sidebar-accent-foreground peer-data-[active=true]/menu-button:text-sidebar-accent-foreground",
          "peer-data-[size=sm]/menu-button:top-1 peer-data-[size=default]/menu-button:top-1.5 peer-data-[size=lg]/menu-button:top-2.5",
          "group-data-[collapsible=icon]:hidden",
          className,
        )}
        {...props}
      />
    );
  },
);

export function SidebarMenuSkeleton({
  className,
  showIcon = false,
  ...props
}: ComponentProps<"div"> & { showIcon?: boolean }) {
  const width = useMemo(() => `${Math.floor(Math.random() * 40) + 50}%`, []);
  return (
    <div
      data-slot="sidebar-menu-skeleton"
      data-sidebar="menu-skeleton"
      className={cn("flex h-8 items-center gap-2 rounded-md px-2", className)}
      {...props}
    >
      {/* `bg-sidebar-accent`, overriding `Skeleton`'s own `bg-muted`. `--muted`
          is a CANVAS token: in the light theme it is a near-white
          `oklch(0.968 …)` sitting on this sidebar's dark `oklch(0.3 …)` ground,
          which measures 12.42:1 — the placeholder becomes the loudest thing on
          a screen that has nothing loaded yet. The sidebar's own quiet rung
          measures 1.26:1 on light and 1.29:1 on dark, i.e. a placeholder in
          both themes instead of an inversion in one. */}
      {showIcon && (
        <Skeleton
          className="size-4 rounded-md bg-sidebar-accent"
          data-sidebar="menu-skeleton-icon"
        />
      )}
      <Skeleton
        className="h-4 max-w-(--skeleton-width) flex-1 bg-sidebar-accent"
        data-sidebar="menu-skeleton-text"
        style={{ "--skeleton-width": width } as CSSProperties}
      />
    </div>
  );
}

export const SidebarMenuSub = forwardRef<HTMLUListElement, ComponentProps<"ul">>(
  function SidebarMenuSub({ className, ...props }, ref) {
    return (
      <ul
        ref={ref}
        data-slot="sidebar-menu-sub"
        data-sidebar="menu-sub"
        className={cn(
          "mx-3.5 flex min-w-0 translate-x-px flex-col gap-1 border-s border-sidebar-border px-2.5 py-0.5",
          "group-data-[collapsible=icon]:hidden",
          className,
        )}
        {...props}
      />
    );
  },
);

export const SidebarMenuSubItem = forwardRef<HTMLLIElement, ComponentProps<"li">>(
  function SidebarMenuSubItem({ className, ...props }, ref) {
    return (
      <li
        ref={ref}
        data-slot="sidebar-menu-sub-item"
        data-sidebar="menu-sub-item"
        className={cn("group/menu-sub-item relative", className)}
        {...props}
      />
    );
  },
);

export const SidebarMenuSubButton = forwardRef<
  HTMLAnchorElement,
  ComponentProps<"a"> & { asChild?: boolean; size?: "sm" | "md"; isActive?: boolean }
>(function SidebarMenuSubButton(
  { asChild = false, size = "md", isActive = false, className, ...props },
  ref,
) {
  const Comp = asChild ? Slot : "a";
  return (
    <Comp
      ref={ref}
      data-slot="sidebar-menu-sub-button"
      data-sidebar="menu-sub-button"
      data-size={size}
      data-active={isActive}
      className={cn(
        "relative flex h-7 min-w-0 -translate-x-px items-center gap-2 overflow-hidden rounded-md px-2 text-sidebar-foreground focus-ring [--focus-ring-color:var(--sidebar-ring)] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground active:bg-sidebar-accent active:text-sidebar-accent-foreground disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 [&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:text-sidebar-accent-foreground",
        "data-[active=true]:bg-sidebar-accent data-[active=true]:font-semibold data-[active=true]:text-sidebar-accent-foreground data-[active=true]:before:pointer-events-none data-[active=true]:before:absolute data-[active=true]:before:inset-y-1.5 data-[active=true]:before:start-0 data-[active=true]:before:w-1 data-[active=true]:before:rounded-full data-[active=true]:before:bg-sidebar-primary",
        size === "sm" && "text-meta",
        size === "md" && "text-body",
        "group-data-[collapsible=icon]:hidden",
        className,
      )}
      {...props}
    />
  );
});
