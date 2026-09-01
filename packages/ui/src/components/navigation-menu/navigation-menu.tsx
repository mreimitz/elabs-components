import {
  createContext,
  forwardRef,
  useContext,
  useId,
  useMemo,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type ElementRef,
  type PointerEvent as ReactPointerEvent,
} from "react";
import * as NavigationMenuPrimitive from "@radix-ui/react-navigation-menu";
import { cva } from "class-variance-authority";
import { ChevronDown } from "lucide-react";
import { cn } from "../../lib/cn";

/**
 * Residual of #54 (issue #85, fix round 1 → round 2): a pointer move onto a
 * trigger arms `@radix-ui/react-navigation-menu`'s root-level hover-intent
 * open timer (`openTimerRef`, default `delayDuration` 200ms — confirmed
 * unchanged through `@radix-ui/react-navigation-menu@1.2.22`, the current
 * latest stable). Neither the click-open path (root `onItemSelect`) nor any
 * dismiss path (Escape, outside-click, focus-out — all funnelled through one
 * `ROOT_CONTENT_DISMISS` handler → `onItemDismiss`) clears that timer, so it
 * fires later and silently reopens the panel even after an explicit
 * dismissal.
 *
 * Round 1 ran Radix's own `onTriggerLeave` cancellation path (a synthetic
 * `pointerout`) on every click. That clears the stray open timer, but
 * `onTriggerLeave` does two things, not one — it ALSO unconditionally arms
 * Radix's 150ms close timer (`startCloseTimer`/`closeTimerRef`), which
 * nothing then cancels for a click-opened (or keyboard/touch-opened) menu,
 * since it never gets a real pointerenter on its content. Every click-opened
 * menu silently closed itself ~150ms later. No supported, finer-grained Radix
 * API exists to clear only the open timer — the 6 context callbacks
 * (`onTriggerEnter`/`onTriggerLeave`/`onContentEnter`/`onContentLeave`/
 * `onItemSelect`/`onItemDismiss`) are the only reachable surface, and none of
 * the internal refs (`openTimerRef`, `closeTimerRef`, `wasClickCloseRef`,
 * `wasEscapeCloseRef`) are exported.
 *
 * Round 2 fix: stop reaching into Radix's internal timers via synthetic
 * events entirely. `NavigationMenu` takes over `value`/`onValueChange` as a
 * controlled proxy (transparent to a consumer's own controlled/uncontrolled
 * usage) and rejects, ONCE, a reopen request for an item that was just
 * dismissed (value → "") while a REAL mouse pointer was still resting on its
 * trigger — exactly the #85 scenario (dismissed inside the hover-intent
 * window, pointer never left). The guard is a one-shot, pointer-scoped
 * suppression per item (`suppressReopenForRef` in `NavigationMenu`, armed by
 * `NavigationMenuItemValueContext` + a small guard context), cleared the
 * instant ANY of the following happens, so it can never block a genuine
 * interaction: (a) the real pointer leaves that trigger (a fresh hover-intent
 * cycle is legitimate — Radix's own `wasEscapeCloseRef`/`wasClickCloseRef`
 * guards reset on the same real pointerenter), or (b) any click on that
 * trigger (`noteExplicitActivation`, which runs synchronously before Radix's
 * own `onItemSelect` in the same click dispatch, per
 * `composeEventHandlers(props.onClick, () => context.onItemSelect(...))` in
 * `@radix-ui/react-navigation-menu`'s Trigger). A pure keyboard sequence never
 * touches this guard at all (no pointer event ever marks the trigger as
 * "resting"), so it cannot regress keyboard or touch entry — see the 3
 * scenarios locked in `navigation-menu.test.tsx` (pointer dismiss stays
 * dismissed, click-open survives past the close-timer delay with no pointer
 * movement, keyboard open/Escape/no-reopen).
 *
 * `NavigationMenuItem` is wrapped (was a bare re-export) purely so its
 * resolved item value — the same value Radix's OWN auto-`useId()` fallback
 * would otherwise compute internally and never expose — is available to
 * `NavigationMenuTrigger` without inventing a new public prop or reaching
 * into Radix's non-exported item context.
 *
 * Tracked upstream: https://github.com/radix-ui/primitives/issues (file and
 * link the specific issue here once opened — non-blocking, parallel to this
 * interim fix; confirmed still present in 1.2.22, the latest stable release
 * as of this fix).
 */
type NavigationMenuGuard = {
  notePointerPresence(itemValue: string, present: boolean): void;
  noteExplicitActivation(itemValue: string): void;
  /** One-shot: returns true (and clears the flag) iff this reopen should be swallowed. */
  consumeSuppressionFlag(itemValue: string): boolean;
};

const NavigationMenuGuardContext = createContext<NavigationMenuGuard | null>(null);
const NavigationMenuItemValueContext = createContext<string | undefined>(undefined);

export const NavigationMenu = forwardRef<
  ElementRef<typeof NavigationMenuPrimitive.Root>,
  ComponentPropsWithoutRef<typeof NavigationMenuPrimitive.Root>
>(function NavigationMenu(
  { className, children, value: valueProp, defaultValue, onValueChange, ...props },
  ref,
) {
  const isControlled = valueProp !== undefined;
  const [internalValue, setInternalValue] = useState(defaultValue ?? "");
  const currentValue = isControlled ? (valueProp as string) : internalValue;
  const currentValueRef = useRef(currentValue);
  currentValueRef.current = currentValue;

  // itemValue currently under a resting, real (mouse) pointer — at most one
  // at a time in practice, since a real pointer can only be inside one
  // trigger's bounds.
  const pointerPresentForRef = useRef<string | null>(null);
  // One-shot: the itemValue whose next reopen request should be swallowed.
  const suppressReopenForRef = useRef<string | null>(null);

  const guard = useMemo<NavigationMenuGuard>(
    () => ({
      notePointerPresence(itemValue, present) {
        if (present) {
          pointerPresentForRef.current = itemValue;
          return;
        }
        if (pointerPresentForRef.current === itemValue) pointerPresentForRef.current = null;
        // A genuine leave ends the suspicious window this guard exists for —
        // any future reopen must come from a fresh interaction (a new
        // hover-intent cycle after re-entering, or a click), both legitimate.
        if (suppressReopenForRef.current === itemValue) suppressReopenForRef.current = null;
      },
      noteExplicitActivation(itemValue) {
        if (suppressReopenForRef.current === itemValue) suppressReopenForRef.current = null;
      },
      consumeSuppressionFlag(itemValue) {
        if (suppressReopenForRef.current === itemValue) {
          suppressReopenForRef.current = null;
          return true;
        }
        return false;
      },
    }),
    [],
  );

  const handleValueChange = (next: string) => {
    const previous = currentValueRef.current;
    if (next === "") {
      if (previous !== "" && pointerPresentForRef.current === previous) {
        // Dismissed while a real pointer still rests on its trigger, inside
        // the hover-intent window — the #85 defect. Arm the one-shot guard
        // against exactly this item's next reopen request.
        suppressReopenForRef.current = previous;
      }
    } else if (guard.consumeSuppressionFlag(next)) {
      return; // Swallow the stray reopen — stay on `previous` (closed).
    }
    if (!isControlled) setInternalValue(next);
    onValueChange?.(next);
  };

  return (
    <NavigationMenuGuardContext.Provider value={guard}>
      <NavigationMenuPrimitive.Root
        ref={ref}
        value={currentValue}
        onValueChange={handleValueChange}
        className={cn("relative z-10 flex max-w-max flex-1 items-center justify-center", className)}
        {...props}
      >
        {children}
        <NavigationMenuViewport />
      </NavigationMenuPrimitive.Root>
    </NavigationMenuGuardContext.Provider>
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

export const NavigationMenuItem = forwardRef<
  ElementRef<typeof NavigationMenuPrimitive.Item>,
  ComponentPropsWithoutRef<typeof NavigationMenuPrimitive.Item>
>(function NavigationMenuItem({ value: valueProp, ...props }, ref) {
  const autoValue = useId();
  const value = valueProp ?? autoValue;
  return (
    <NavigationMenuItemValueContext.Provider value={value}>
      <NavigationMenuPrimitive.Item ref={ref} value={value} {...props} />
    </NavigationMenuItemValueContext.Provider>
  );
});

export const navigationMenuTriggerStyle = cva(
  "group inline-flex h-9 w-max items-center justify-center rounded-md bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:outline-none disabled:pointer-events-none disabled:opacity-50 data-[state=open]:bg-accent",
);

export const NavigationMenuTrigger = forwardRef<
  ElementRef<typeof NavigationMenuPrimitive.Trigger>,
  ComponentPropsWithoutRef<typeof NavigationMenuPrimitive.Trigger>
>(function NavigationMenuTrigger(
  { className, children, onClick, onPointerEnter, onPointerLeave, ...props },
  ref,
) {
  const itemValue = useContext(NavigationMenuItemValueContext);
  const guard = useContext(NavigationMenuGuardContext);

  const notePointer = (event: ReactPointerEvent<HTMLButtonElement>, present: boolean) => {
    if (itemValue !== undefined && guard && event.pointerType === "mouse") {
      guard.notePointerPresence(itemValue, present);
    }
  };

  return (
    <NavigationMenuPrimitive.Trigger
      ref={ref}
      className={cn(navigationMenuTriggerStyle(), "group", className)}
      onPointerEnter={(event) => {
        onPointerEnter?.(event);
        notePointer(event, true);
      }}
      onPointerLeave={(event) => {
        onPointerLeave?.(event);
        notePointer(event, false);
      }}
      onClick={(event) => {
        if (itemValue !== undefined) guard?.noteExplicitActivation(itemValue);
        onClick?.(event);
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
