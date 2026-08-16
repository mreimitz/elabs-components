import {
  createContext,
  forwardRef,
  use,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type ElementRef,
  type HTMLAttributes,
  type ReactNode,
  type RefObject,
} from "react";
import { Command as CommandPrimitive, useCommandState } from "cmdk";
import { Search } from "lucide-react";
import { cn } from "../../lib/cn";
import { mergeRefs } from "../../lib/merge-refs";
import { Dialog, DialogContent } from "../dialog";

/** cmdk's own marker attribute on an item row — the scope for the id lookup. */
const CMDK_ITEM_SELECTOR = '[cmdk-item=""][aria-selected="true"]';

/** Distinguishes "no `<Command>` ancestor" from "nothing is highlighted". */
const NO_COMMAND_PROVIDER = Symbol("no-command-provider");

const CommandActiveItemIdContext = createContext<string | undefined | typeof NO_COMMAND_PROVIDER>(
  NO_COMMAND_PROVIDER,
);

/**
 * Resolves the DOM `id` of the currently highlighted `CommandItem`, publishes
 * it on a context and reports it to `Command`'s `onActiveItemIdChange`.
 *
 * It renders no DOM of its own, and it deliberately does NOT simply forward
 * cmdk's `state.selectedItemId`. cmdk only recomputes that field inside a
 * `schedule(7, …)` callback queued from `setState("value", …)`, and its own
 * `selectFirstItem()` runs INSIDE the layout-effect flush that drains that
 * queue — so the callback executes before React has committed the new
 * `aria-selected` attribute and cmdk's `getSelectedItem()` DOM query finds
 * nothing. The field therefore stays `undefined` for BOTH cases that matter
 * here: the item auto-highlighted on mount, and the item re-highlighted after
 * every filter keystroke. (cmdk's own `Command.Input` inherits the same hole —
 * it renders no `aria-activedescendant` in either state. Verified against
 * cmdk 1.1.1 in jsdom and Chromium.)
 *
 * Reading the committed DOM from a post-commit `useEffect` — the same query
 * cmdk itself uses, just at a point where the attribute exists — closes both
 * gaps. `state.selectedItemId` is kept as a fallback and as one of the change
 * triggers.
 */
function CommandActiveItemProvider({
  rootRef,
  onChange,
  children,
}: {
  rootRef: RefObject<HTMLDivElement | null>;
  onChange?: (id: string | undefined) => void;
  children: ReactNode;
}) {
  const value = useCommandState((state) => state.value);
  const selectedItemId = useCommandState((state) => state.selectedItemId);
  const filteredCount = useCommandState((state) => state.filtered.count);

  const [activeId, setActiveId] = useState<string | undefined>(undefined);

  // The callback lives in a ref so an inline arrow prop doesn't re-fire the
  // effect on every render.
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // `undefined` is a legitimate reported value ("nothing highlighted"), so the
  // "not reported yet" sentinel has to be something else.
  const lastReportedRef = useRef<string | undefined | typeof NO_COMMAND_PROVIDER>(
    NO_COMMAND_PROVIDER,
  );

  useEffect(() => {
    const element = rootRef.current?.querySelector<HTMLElement>(CMDK_ITEM_SELECTOR);
    const next = element?.id ?? selectedItemId ?? undefined;

    setActiveId(next);
    if (lastReportedRef.current !== next) {
      lastReportedRef.current = next;
      onChangeRef.current?.(next);
    }
  }, [value, selectedItemId, filteredCount, rootRef]);

  return <CommandActiveItemIdContext value={activeId}>{children}</CommandActiveItemIdContext>;
}

export interface CommandProps extends ComponentPropsWithoutRef<typeof CommandPrimitive> {
  /**
   * Reports the DOM `id` cmdk assigned to the currently highlighted item, so
   * an input rendered OUTSIDE this `Command` tree (a composer textarea, a
   * combobox trigger) can set `aria-activedescendant` without querying
   * `[role="option"]` positionally. Fires with `undefined` when nothing is
   * highlighted.
   *
   * cmdk owns each item's `id`/`role`/`aria-selected` and applies them AFTER
   * the consumer spread, so a consumer-supplied `id` on `CommandItem` is
   * silently dropped (`CommandItem` warns about this in development) — this
   * callback is the supported way to obtain it. See also the
   * `useCommandActiveItemId` hook for reading the same value from a
   * descendant already inside the `<Command>` tree.
   *
   * It fires for EVERY highlight change, including the item cmdk
   * auto-highlights on mount and the one it re-highlights after each filter
   * keystroke — the two states cmdk's own `state.selectedItemId` misses.
   */
  onActiveItemIdChange?: (id: string | undefined) => void;
}

export const Command = forwardRef<ElementRef<typeof CommandPrimitive>, CommandProps>(
  function Command({ className, children, onActiveItemIdChange, ...props }, ref) {
    const innerRef = useRef<HTMLDivElement>(null);
    const mergedRef = useMemo(() => mergeRefs<HTMLDivElement>(ref, innerRef), [ref]);

    return (
      <CommandPrimitive
        ref={mergedRef}
        data-slot="command"
        className={cn(
          "flex size-full flex-col overflow-hidden rounded-md bg-popover text-popover-foreground",
          className,
        )}
        {...props}
      >
        <CommandActiveItemProvider rootRef={innerRef} onChange={onActiveItemIdChange}>
          {children}
        </CommandActiveItemProvider>
      </CommandPrimitive>
    );
  },
);

/**
 * The DOM `id` of the currently highlighted `CommandItem`. Must be called
 * from a component rendered inside a `<Command>` tree; returns `undefined`
 * when nothing is highlighted (or when there is no `<Command>` ancestor).
 * Reports exactly the same value as `Command`'s `onActiveItemIdChange`
 * callback, for a consumer that is already a descendant (rather than an
 * external input above the tree).
 */
export function useCommandActiveItemId(): string | undefined {
  const id = use(CommandActiveItemIdContext);
  return id === NO_COMMAND_PROVIDER ? undefined : id;
}

export function CommandDialog({
  children,
  filter,
  ...props
}: ComponentPropsWithoutRef<typeof Dialog> & {
  /** Custom cmdk ranking (e.g. strict substring instead of fuzzy). */
  filter?: ComponentPropsWithoutRef<typeof CommandPrimitive>["filter"];
}) {
  return (
    <Dialog {...props}>
      <DialogContent className="overflow-hidden p-0">
        <Command
          filter={filter}
          className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-input-wrapper]_svg]:size-5 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-3"
        >
          {children}
        </Command>
      </DialogContent>
    </Dialog>
  );
}

export const CommandInput = forwardRef<
  ElementRef<typeof CommandPrimitive.Input>,
  ComponentPropsWithoutRef<typeof CommandPrimitive.Input>
>(function CommandInput({ className, ...props }, ref) {
  return (
    <div className="flex items-center border-b px-3" cmdk-input-wrapper="">
      <Search className="me-2 size-4 shrink-0 opacity-50" />
      <CommandPrimitive.Input
        ref={ref}
        data-slot="command-input"
        className={cn(
          "flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        {...props}
      />
    </div>
  );
});

export const CommandList = forwardRef<
  ElementRef<typeof CommandPrimitive.List>,
  ComponentPropsWithoutRef<typeof CommandPrimitive.List>
>(function CommandList({ className, ...props }, ref) {
  return (
    <CommandPrimitive.List
      ref={ref}
      data-slot="command-list"
      className={cn("max-h-[300px] overflow-y-auto overflow-x-hidden", className)}
      {...props}
    />
  );
});

export const CommandEmpty = forwardRef<
  ElementRef<typeof CommandPrimitive.Empty>,
  ComponentPropsWithoutRef<typeof CommandPrimitive.Empty>
>(function CommandEmpty(props, ref) {
  return (
    <CommandPrimitive.Empty
      ref={ref}
      data-slot="command-empty"
      className="py-6 text-center text-sm"
      {...props}
    />
  );
});

export const CommandGroup = forwardRef<
  ElementRef<typeof CommandPrimitive.Group>,
  ComponentPropsWithoutRef<typeof CommandPrimitive.Group>
>(function CommandGroup({ className, ...props }, ref) {
  return (
    <CommandPrimitive.Group
      ref={ref}
      data-slot="command-group"
      className={cn(
        "overflow-hidden p-1 text-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
});

export const CommandSeparator = forwardRef<
  ElementRef<typeof CommandPrimitive.Separator>,
  ComponentPropsWithoutRef<typeof CommandPrimitive.Separator>
>(function CommandSeparator({ className, ...props }, ref) {
  return (
    <CommandPrimitive.Separator
      ref={ref}
      data-slot="command-separator"
      className={cn("-mx-1 h-px bg-border", className)}
      {...props}
    />
  );
});

/**
 * Props cmdk owns and applies AFTER a consumer spread — see the `Command`
 * `onActiveItemIdChange` docblock. Passing any of these is a silent no-op;
 * `CommandItem` warns once per key in development.
 */
const CMDK_OVERRIDDEN_ITEM_PROPS = ["id", "role", "aria-selected"] as const;
const warnedAboutOverriddenItemProps = new Set<string>();

export const CommandItem = forwardRef<
  ElementRef<typeof CommandPrimitive.Item>,
  ComponentPropsWithoutRef<typeof CommandPrimitive.Item>
>(function CommandItem({ className, ...props }, ref) {
  if (process.env.NODE_ENV !== "production") {
    for (const key of CMDK_OVERRIDDEN_ITEM_PROPS) {
      if (key in props && !warnedAboutOverriddenItemProps.has(key)) {
        warnedAboutOverriddenItemProps.add(key);
        // oxlint-disable-next-line no-console
        console.warn(
          `CommandItem: "${key}" is assigned internally by cmdk, so the value you passed is ` +
            'ignored. Use <Command onActiveItemIdChange> (or the "useCommandActiveItemId" hook) ' +
            "to read the DOM id of the highlighted item instead — see " +
            "packages/ui/src/components/command/command.tsx.",
        );
      }
    }
  }

  return (
    <CommandPrimitive.Item
      ref={ref}
      data-slot="command-item"
      className={cn(
        "relative flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors duration-fast data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50 [&_svg]:size-4",
        className,
      )}
      {...props}
    />
  );
});

export function CommandShortcut({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      data-slot="command-shortcut"
      className={cn("ms-auto text-xs tracking-widest text-muted-foreground", className)}
      {...props}
    />
  );
}
