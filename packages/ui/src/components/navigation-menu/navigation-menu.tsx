import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from "react";
import * as NavigationMenuPrimitive from "@radix-ui/react-navigation-menu";
import { cva } from "class-variance-authority";
import { ChevronDown } from "lucide-react";
import { cn } from "../../lib/cn";

export const NavigationMenu = forwardRef<
  ElementRef<typeof NavigationMenuPrimitive.Root>,
  ComponentPropsWithoutRef<typeof NavigationMenuPrimitive.Root>
>(function NavigationMenu({ className, children, ...props }, ref) {
  return (
    <NavigationMenuPrimitive.Root
      ref={ref}
      className={cn("relative z-10 flex max-w-max flex-1 items-center justify-center", className)}
      {...props}
    >
      {children}
      <NavigationMenuViewport />
    </NavigationMenuPrimitive.Root>
  );
});

export const NavigationMenuList = forwardRef<
  ElementRef<typeof NavigationMenuPrimitive.List>,
  ComponentPropsWithoutRef<typeof NavigationMenuPrimitive.List>
>(function NavigationMenuList({ className, ...props }, ref) {
  return (
    <NavigationMenuPrimitive.List
      ref={ref}
      className={cn("group flex flex-1 list-none items-center justify-center gap-1", className)}
      {...props}
    />
  );
});

export const NavigationMenuItem = NavigationMenuPrimitive.Item;

export const navigationMenuTriggerStyle = cva(
  "group inline-flex h-9 w-max items-center justify-center rounded-md bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:outline-none disabled:pointer-events-none disabled:opacity-50 data-[state=open]:bg-accent",
);

export const NavigationMenuTrigger = forwardRef<
  ElementRef<typeof NavigationMenuPrimitive.Trigger>,
  ComponentPropsWithoutRef<typeof NavigationMenuPrimitive.Trigger>
>(function NavigationMenuTrigger({ className, children, onClick, ...props }, ref) {
  return (
    <NavigationMenuPrimitive.Trigger
      ref={ref}
      className={cn(navigationMenuTriggerStyle(), "group", className)}
      onClick={(event) => {
        onClick?.(event);
        cancelStrayHoverIntentTimer(event.currentTarget);
      }}
      {...props}
    >
      {children}
      <ChevronDown
        className="relative top-px ms-1 size-3 transition-transform duration-base ease-standard group-data-[state=open]:rotate-180"
        aria-hidden="true"
      />
    </NavigationMenuPrimitive.Trigger>
  );
});

/**
 * Residual of #54 (issue #85): a pointer move onto a trigger — including the
 * one `userEvent.click()`/a real mouse click synthesizes before the click
 * itself — arms `@radix-ui/react-navigation-menu`'s root-level hover-intent
 * open timer (`openTimerRef`, default `delayDuration` 200ms). Neither the
 * click-open path (root `onItemSelect`) nor any dismiss path (Escape,
 * outside-click, focus-out — all funnelled through one `ROOT_CONTENT_DISMISS`
 * handler) clears that timer, so it fires later and silently reopens the
 * panel even after an explicit dismissal
 * (@radix-ui/react-navigation-menu@1.2.14's index.mjs: root `onTriggerEnter`
 * ~111-114 arms it, `onTriggerLeave` ~116-119 is the ONLY place that clears
 * it, `onItemSelect` ~122-124 and the `ROOT_CONTENT_DISMISS` handler ~537-548
 * do not).
 *
 * Interim fix (option 2 of the issue) until upstream cancels it itself: run
 * Radix's OWN `onTriggerLeave` cancellation path on every click, the same
 * mechanism #54's story-level `unhover()` exercises by hand. Radix's
 * `NavigationMenuTrigger` derives its `onPointerLeave` prop from the native
 * `pointerout` event (`registerDirectEvent("onPointerLeave", ["pointerout",
 * "pointerover"])` in React DOM) rather than a literal `pointerleave`, so a
 * `pointerout` is what must be dispatched for React to invoke it.
 * `PointerEvent` is used when the environment provides it (every real target
 * browser); a plain `MouseEvent` with a manually attached `pointerType` is
 * the fallback so this also works in a jsdom test environment or an older
 * browser lacking `window.PointerEvent` — mirroring `@testing-library/user-event`'s
 * own polyfill for the same gap. `relatedTarget` is left unset (outside the
 * trigger's subtree) so React's enter/leave computation treats this as a
 * genuine leave.
 *
 * Deliberately scoped to cancelling the stray timer, not to reimplementing
 * Radix's hover-intent state machine or touching `delayDuration` — an
 * earlier attempt at `delayDuration={0}` regressed the menu to never opening
 * (0/10), by racing the click's own toggle against an effectively-instant
 * timer. Manually verified this fix does not reintroduce that: rapid
 * repeated click-open/click-close cycles (also locked by a test in
 * `navigation-menu.test.tsx`) still land the menu in the expected state
 * every time.
 *
 * Tracked upstream: https://github.com/radix-ui/primitives/issues (file and
 * link the specific issue here once opened — non-blocking, parallel to this
 * interim fix per the issue's option 1).
 */
function cancelStrayHoverIntentTimer(trigger: HTMLButtonElement) {
  const PointerEventCtor =
    typeof window !== "undefined" && typeof window.PointerEvent === "function"
      ? window.PointerEvent
      : undefined;
  const leaveEvent = PointerEventCtor
    ? new PointerEventCtor("pointerout", { bubbles: true, cancelable: true, pointerType: "mouse" })
    : new MouseEvent("pointerout", { bubbles: true, cancelable: true });
  if (!PointerEventCtor) {
    Object.defineProperty(leaveEvent, "pointerType", { value: "mouse", configurable: true });
  }
  trigger.dispatchEvent(leaveEvent);
}

export const NavigationMenuContent = forwardRef<
  ElementRef<typeof NavigationMenuPrimitive.Content>,
  ComponentPropsWithoutRef<typeof NavigationMenuPrimitive.Content>
>(function NavigationMenuContent({ className, ...props }, ref) {
  return (
    <NavigationMenuPrimitive.Content
      ref={ref}
      className={cn(
        "left-0 top-0 w-full p-2 md:absolute md:w-auto",
        "data-[motion^=from-]:animate-in data-[motion^=to-]:animate-out data-[motion^=from-]:fade-in data-[motion^=to-]:fade-out",
        "data-[motion=from-end]:slide-in-from-right-2 data-[motion=from-start]:slide-in-from-left-2 data-[motion=to-end]:slide-out-to-right-2 data-[motion=to-start]:slide-out-to-left-2",
        "data-[motion^=from-]:[--tw-ease:var(--ease-entrance)]",
        className,
      )}
      {...props}
    />
  );
});

export const NavigationMenuLink = NavigationMenuPrimitive.Link;

export const NavigationMenuViewport = forwardRef<
  ElementRef<typeof NavigationMenuPrimitive.Viewport>,
  ComponentPropsWithoutRef<typeof NavigationMenuPrimitive.Viewport>
>(function NavigationMenuViewport({ className, ...props }, ref) {
  return (
    <div className="absolute left-0 top-full flex justify-center">
      <NavigationMenuPrimitive.Viewport
        ref={ref}
        className={cn(
          "relative mt-1.5 h-[var(--radix-navigation-menu-viewport-height)] w-full overflow-hidden rounded-md border bg-popover text-popover-foreground shadow md:w-[var(--radix-navigation-menu-viewport-width)]",
          "origin-top transition-[width,height] duration-base ease-standard data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:zoom-in-90 data-[state=closed]:zoom-out-95",
          className,
        )}
        {...props}
      />
    </div>
  );
});
