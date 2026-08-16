import {
  forwardRef,
  useEffect,
  useMemo,
  useRef,
  type ComponentPropsWithoutRef,
  type ElementRef,
} from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "../../lib/cn";
import { mergeRefs } from "../../lib/merge-refs";

export const Select = SelectPrimitive.Root;
export const SelectGroup = SelectPrimitive.Group;
export const SelectValue = SelectPrimitive.Value;

/** Sub-pixel layout rounding — an element is only "clipped" beyond this. */
const CLIP_SLACK_PX = 1;

function isClipped(el: Element) {
  return (
    el.scrollWidth > el.clientWidth + CLIP_SLACK_PX ||
    el.scrollHeight > el.clientHeight + CLIP_SLACK_PX
  );
}

/**
 * The trigger's visible text, ONE SEGMENT PER CHILD NODE joined by a space, so
 * a prefix/badge beside `SelectValue` reads `"Env: Staging"` — a bare
 * `textContent` read concatenates the DOM's text nodes with no separator and
 * produces `"Env:Staging"`.
 */
function composeTriggerText(node: HTMLElement) {
  return Array.from(node.childNodes)
    .map((child) => child.textContent?.replace(/\s+/gu, " ").trim() ?? "")
    .filter(Boolean)
    .join(" ");
}

export type SelectTriggerProps = ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger> & {
  size?: "sm" | "default";
  /**
   * Auto-set a native `title` from the trigger's rendered text — but ONLY
   * while that text is actually clipped (default `true`).
   *
   * Set `false` when the trigger is a `TooltipTrigger`: the native tooltip and
   * the Radix one would otherwise both appear on hover. A caller-supplied
   * `title` also disables it (an explicit `title` is never overridden).
   */
  autoTitle?: boolean;
};

/**
 * `[&>span]:line-clamp-1` clips the rendered `SelectValue` — necessary so a
 * long/composed label doesn't blow out the trigger's width. To keep clipped
 * text recoverable, the trigger MEASURES its content and sets a native `title`
 * only while something is genuinely cut off, so it's readable on mouse hover
 * with zero extra code.
 *
 * The measurement is not cosmetic: an unconditional `title` becomes the
 * button's accessible name, which would paper over a real "this combobox has
 * no name" a11y failure with the field's own VALUE — a value is not a name.
 * Label the trigger properly (`aria-label`/`aria-labelledby`) regardless.
 *
 * `title` also never reaches keyboard users — for that, wrap the trigger in
 * `Tooltip`/`TooltipTrigger asChild`/`TooltipContent` and pass
 * `autoTitle={false}` (see the `LongComposedLabel` story), which Radix opens
 * on keyboard focus too.
 */
export const SelectTrigger = forwardRef<
  ElementRef<typeof SelectPrimitive.Trigger>,
  SelectTriggerProps
>(function SelectTrigger(
  { className, children, size = "default", title, autoTitle = true, ...props },
  ref,
) {
  const innerRef = useRef<HTMLButtonElement>(null);
  const mergedRef = useMemo(() => mergeRefs(ref, innerRef), [ref]);

  useEffect(() => {
    if (!autoTitle) return;
    if (title !== undefined) return; // caller owns `title` — never override it
    const node = innerRef.current;
    if (!node) return;

    const sync = () => {
      // The clamp lives on the child spans, but a long unbroken value can also
      // overflow the trigger box itself — check both.
      const clipped = isClipped(node) || Array.from(node.children).some(isClipped);
      const text = clipped ? composeTriggerText(node) : "";
      if (text) node.title = text;
      else node.removeAttribute("title");
    };
    sync();

    // The selected item's text isn't a React child of this component — Radix
    // portals it into the (child) `SelectValue` node from `SelectContent`
    // asynchronously, on its OWN commit, so a one-shot read here can run
    // before that text lands. Observe the subtree instead of trusting this
    // component's own render cycle. (Attributes are deliberately NOT observed:
    // `sync` writes `title`, which would otherwise re-enter.)
    const observer = new MutationObserver(sync);
    observer.observe(node, { childList: true, subtree: true, characterData: true });

    // Clipping is a function of WIDTH, so it has to be re-measured when the
    // trigger resizes, not only when its text changes.
    const resizeObserver =
      typeof ResizeObserver === "function" ? new ResizeObserver(sync) : undefined;
    resizeObserver?.observe(node);

    return () => {
      observer.disconnect();
      resizeObserver?.disconnect();
    };
  }, [autoTitle, title]);

  return (
    <SelectPrimitive.Trigger
      ref={mergedRef}
      data-size={size}
      title={title}
      className={cn(
        "flex w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm",
        size === "sm" ? "h-8" : "h-9",
        "placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 focus:ring-offset-background",
        // No `disabled:cursor-*` override — disabled controls keep the arrow
        // automatically (interaction-guidelines.md), matching Combobox's
        // Button-based trigger (`disabled:pointer-events-none`) (#343).
        "disabled:opacity-50 disabled:border-border [&>span]:line-clamp-1",
        className,
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <ChevronDown className="size-4 opacity-50" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
});

export const SelectContent = forwardRef<
  ElementRef<typeof SelectPrimitive.Content>,
  ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(function SelectContent({ className, children, position = "popper", ...props }, ref) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        ref={ref}
        position={position}
        className={cn(
          "relative z-50 max-h-96 min-w-[8rem] overflow-hidden rounded-md bg-popover text-popover-foreground shadow-ring-md",
          "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95",
          "data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2",
          position === "popper" &&
            "data-[side=bottom]:translate-y-1 data-[side=top]:-translate-y-1",
          className,
        )}
        {...props}
      >
        <SelectPrimitive.ScrollUpButton className="flex cursor-default items-center justify-center py-1">
          <ChevronUp className="size-4" />
        </SelectPrimitive.ScrollUpButton>
        <SelectPrimitive.Viewport
          className={cn(
            "p-1",
            position === "popper" &&
              "h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)]",
          )}
        >
          {children}
        </SelectPrimitive.Viewport>
        <SelectPrimitive.ScrollDownButton className="flex cursor-default items-center justify-center py-1">
          <ChevronDown className="size-4" />
        </SelectPrimitive.ScrollDownButton>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
});

export const SelectLabel = forwardRef<
  ElementRef<typeof SelectPrimitive.Label>,
  ComponentPropsWithoutRef<typeof SelectPrimitive.Label>
>(function SelectLabel({ className, ...props }, ref) {
  return (
    <SelectPrimitive.Label
      ref={ref}
      className={cn("px-2 py-1.5 text-xs font-semibold text-muted-foreground", className)}
      {...props}
    />
  );
});

export const SelectItem = forwardRef<
  ElementRef<typeof SelectPrimitive.Item>,
  ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(function SelectItem({ className, children, ...props }, ref) {
  return (
    <SelectPrimitive.Item
      ref={ref}
      className={cn(
        "relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 ps-2 pe-8 text-sm outline-none transition-colors duration-fast",
        "focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        className,
      )}
      {...props}
    >
      <span className="absolute end-2 flex size-3.5 items-center justify-center">
        <SelectPrimitive.ItemIndicator>
          <Check className="size-4" />
        </SelectPrimitive.ItemIndicator>
      </span>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  );
});

export const SelectSeparator = forwardRef<
  ElementRef<typeof SelectPrimitive.Separator>,
  ComponentPropsWithoutRef<typeof SelectPrimitive.Separator>
>(function SelectSeparator({ className, ...props }, ref) {
  return (
    <SelectPrimitive.Separator
      ref={ref}
      className={cn("-mx-1 my-1 h-px bg-border", className)}
      {...props}
    />
  );
});
