import {
  forwardRef,
  useCallback,
  useRef,
  type ComponentPropsWithoutRef,
  type ElementRef,
  type HTMLAttributes,
  type MutableRefObject,
  type ReactNode,
} from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/cn";
import { Heading, Text } from "../typography";

/**
 * The first keyboard-reachable control inside a dialog, EXCLUDING the
 * `DialogBody` wrapper itself. Deliberately a pragmatic selector rather than a
 * full tabbability implementation — Radix owns focus trapping; this only
 * reorders the opening target (see `DialogContent`'s `onOpenAutoFocus`).
 */
const TABBABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"]):not([data-slot="dialog-body"])',
].join(",");

export const dialogContentVariants = cva(
  // `grid-cols-[minmax(0,1fr)]` (NOT the implicit `auto` column): grid items
  // default to `min-width:auto`, so a `nowrap`/`truncate` child or a long
  // unbreakable token (a file path, a URL) sets the column's min-content size and
  // pushes the dialog past its `max-w-*`. A `minmax(0,1fr)` column floors that at
  // 0, so inner `truncate`/`w-full` shrink instead of overflowing (#regression).
  //
  // Height/scroll (#341). Two mutually-exclusive regimes, picked by ANATOMY —
  // never by a `scroll` prop (`.claude/rules/component-api.md`: `cva` is for
  // visual axes, behaviour is composition):
  //   1. NO `DialogBody` — the content box itself caps at the viewport
  //      (`max-h-…` + `overflow-y-auto`) and scrolls as one column. Before this,
  //      a taller-than-viewport dialog overflowed past BOTH viewport edges and
  //      its top was unreachable (the `-translate-y-1/2` centring).
  //   2. WITH a `DialogBody` — the `has-[…]` pair turns the content box into a
  //      3-row grid (`auto | minmax(0,1fr) | auto`) and stops it scrolling, so a
  //      fixed header and footer sandwich a body that owns the scroll. The pair
  //      is INERT for every dialog that has no `DialogBody`.
  // `size="full"`'s own `h-/max-h-/overflow-hidden` still wins — cva emits the
  // base first, so tailwind-merge resolves the later variant utilities over it.
  "fixed left-1/2 top-1/2 z-50 grid grid-cols-[minmax(0,1fr)] w-full -translate-x-1/2 -translate-y-1/2 gap-4 max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain has-[[data-slot=dialog-body]]:overflow-hidden has-[[data-slot=dialog-body]]:grid-rows-[auto_minmax(0,1fr)_auto] rounded-xl bg-card p-6 text-card-foreground shadow-ring-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
  {
    variants: {
      size: {
        sm: "max-w-sm",
        lg: "max-w-lg",
        xl: "max-w-3xl",
        full: "max-w-[95vw] h-[90vh] max-h-[90vh] overflow-hidden",
      },
    },
    defaultVariants: { size: "lg" },
  },
);

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogPortal = DialogPrimitive.Portal;
export const DialogClose = DialogPrimitive.Close;

export const DialogOverlay = forwardRef<
  ElementRef<typeof DialogPrimitive.Overlay>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(function DialogOverlay({ className, ...props }, ref) {
  return (
    <DialogPrimitive.Overlay
      ref={ref}
      data-slot="dialog-overlay"
      className={cn(
        "fixed inset-0 z-50 bg-foreground/50 backdrop-blur-sm",
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
        className,
      )}
      {...props}
    />
  );
});

export const DialogContent = forwardRef<
  ElementRef<typeof DialogPrimitive.Content>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Content> &
    VariantProps<typeof dialogContentVariants>
>(function DialogContent({ className, children, size, onOpenAutoFocus, ...props }, ref) {
  const contentRef = useRef<HTMLDivElement | null>(null);
  const setRefs = useCallback(
    (node: HTMLDivElement | null) => {
      contentRef.current = node;
      if (typeof ref === "function") ref(node);
      else if (ref) (ref as MutableRefObject<HTMLDivElement | null>).current = node;
    },
    [ref],
  );

  /**
   * A `DialogBody` carries `tabIndex={0}` so a keyboard user can scroll it — but
   * being the first tab stop would also make the scroll WRAPPER the dialog's
   * opening focus target, which paints a focus ring around the whole body on
   * open and skips the first field. Skip past it to the first real control
   * INSIDE the body. Inert for dialogs with no `DialogBody`, so nothing that
   * shipped before changes.
   *
   * Two things this deliberately does NOT do, both because getting them wrong
   * strands the keyboard:
   *   * It only prevents Radix's default once a candidate has *actually taken*
   *     focus. A selector match is not proof of focusability — a `display:none`
   *     candidate (the ubiquitous `<input type="file" hidden>`) swallows
   *     `.focus()`, so preventing the default for it would leave focus on the
   *     TRIGGER, outside the modal.
   *   * It gives up when the body holds no focusable control at all. Radix's own
   *     fallback then focuses the body — which is the right target for a
   *     text-only scroll region, and better than reaching past it to the
   *     footer's primary action.
   */
  const handleOpenAutoFocus = useCallback(
    (event: Event) => {
      onOpenAutoFocus?.(event);
      if (event.defaultPrevented) return;
      const body = contentRef.current?.querySelector<HTMLElement>('[data-slot="dialog-body"]');
      if (!body) return;
      for (const candidate of body.querySelectorAll<HTMLElement>(TABBABLE)) {
        candidate.focus({ preventScroll: true });
        if (candidate.ownerDocument.activeElement !== candidate) continue;
        event.preventDefault();
        return;
      }
    },
    [onOpenAutoFocus],
  );

  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        ref={setRefs}
        data-slot="dialog-content"
        className={cn(dialogContentVariants({ size }), className)}
        onOpenAutoFocus={handleOpenAutoFocus}
        {...props}
      >
        {children}
        <DialogPrimitive.Close
          data-slot="dialog-close"
          className="absolute end-4 top-4 rounded-md p-1 text-muted-foreground opacity-70 transition-opacity hover:opacity-100 focus-ring"
          aria-label="Close"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPortal>
  );
});

export function DialogHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-1.5 text-start", className)}
      {...props}
    />
  );
}

export function DialogFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)}
      {...props}
    />
  );
}

export const DialogTitle = forwardRef<
  ElementRef<typeof DialogPrimitive.Title>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(function DialogTitle({ className, ...props }, ref) {
  return (
    <DialogPrimitive.Title
      ref={ref}
      data-slot="dialog-title"
      className={cn("text-title leading-none", className)}
      {...props}
    />
  );
});

export const DialogDescription = forwardRef<
  ElementRef<typeof DialogPrimitive.Description>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(function DialogDescription({ className, ...props }, ref) {
  return (
    <DialogPrimitive.Description
      ref={ref}
      data-slot="dialog-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  );
});

export type DialogBodyProps = HTMLAttributes<HTMLDivElement>;

/**
 * The dialog's scroll owner (#341).
 *
 * Placing a `DialogBody` between `DialogHeader` and `DialogFooter` switches
 * `DialogContent` into its fixed-header/footer regime (see
 * `dialogContentVariants`): the header and footer stay put and ONLY this region
 * scrolls, so the primary action never scrolls out of view. Without it a dialog
 * behaves exactly as before — the anatomy is the switch, there is no `scroll`
 * prop.
 *
 * `overscroll-contain` stops the scroll chaining to the page underneath
 * (`.claude/rules/interaction-guidelines.md`, Touch & overscroll).
 *
 * **The `p-1`/`-m-1`/`scroll-p-1` trio reserves a focus-ring gutter (#425).**
 * Per CSS Overflow 3, authoring only `overflow-y-auto` still makes this a
 * two-axis scroll container (the `visible` axis computes to `auto` too), and a
 * scroll container clips at its **padding box**. With no padding of its own,
 * that padding box IS the content box, so a full-width child's border box
 * lands exactly on the clip edge — leaving 0px for a focus ring, which is
 * `box-shadow` (ink overflow: never part of the scrollable region, so it is
 * simply cut, not merely scrolled out of reach). `p-1` moves the scrollport
 * 4px outward on every side — enough for the library's widest outward paint
 * (`ring-2 ring-offset-2` = 4px) — and `-m-1` pulls the border box back by the
 * same amount so body content stays flush with `DialogHeader`/`DialogFooter`
 * instead of indenting 4px against them. `scroll-p-1` keeps a keyboard-driven
 * scroll-into-view (Tab landing on a control currently outside the scrollport)
 * from placing that control flush against the scrollport edge again.
 *
 * Two consumer-facing consequences: a larger `className` padding (e.g. `p-6`)
 * still wins through `tailwind-merge`, with the border box remaining 4px
 * outward; but **`className="p-0"` re-opens the bug** — the merge kills `p-1`
 * while `-m-1` survives — so a consumer who genuinely wants no gutter must
 * clear both sides with `className="m-0 p-0"`.
 *
 * Known, accepted residual: at `data-density="compact"`, `--spacing` is
 * `0.222rem` (`density.css:97`), so `p-1` is 3.55px against a 4px ring — a
 * 0.45px shortfall on the outermost edge of a 2px stroke. Do not "fix" this
 * with a fixed-px override; that would break the density dial's contract.
 */
export const DialogBody = forwardRef<HTMLDivElement, DialogBodyProps>(function DialogBody(
  { className, tabIndex, ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      data-slot="dialog-body"
      // A scroll container must be keyboard-operable (WCAG 2.1.1; axe's
      // `scrollable-region-focusable`). A body holding only text has no focusable
      // child to scroll from, so the region itself takes the tab stop. Pass
      // `tabIndex={-1}` to opt out when the body always contains its own
      // focusable content.
      tabIndex={tabIndex ?? 0}
      className={cn(
        "-m-1 min-h-0 overflow-y-auto overscroll-contain p-1 scroll-p-1 focus-ring",
        className,
      )}
      {...props}
    />
  );
});

export interface DialogSectionProps extends Omit<HTMLAttributes<HTMLElement>, "title"> {
  /** The section heading. States what the group of fields is for. */
  title: ReactNode;
  /** One line of supporting context under the heading. */
  description?: ReactNode;
  /**
   * Semantic heading level. `DialogTitle` renders an `<h2>`, so a section is an
   * `<h3>` by default and an `<h4>` when nested a rung deeper.
   */
  level?: 3 | 4;
  /** Section-scoped actions, aligned to the inline end of the heading row. */
  actions?: ReactNode;
}

/**
 * A real section heading inside a dialog (#341).
 *
 * The recurring downstream defect was section labels rendering at the same size
 * as the field labels beneath them, which flattens a long form into one
 * undifferentiated list. The rungs are distinct BY TOKEN, not by eye:
 * `DialogTitle` `text-title` (1.25rem) > `DialogSection` `text-subtitle` (1rem) >
 * `Label` `text-body` (0.875rem).
 *
 * Deliberately NOT `SectionHeader` (`../section-header`): that is the page-level
 * `<h2>` row with an eyebrow, one rung too loud and one level too high inside a
 * dialog whose title already owns the `<h2>`.
 */
export const DialogSection = forwardRef<HTMLElement, DialogSectionProps>(function DialogSection(
  { className, title, description, level = 3, actions, children, ...props },
  ref,
) {
  return (
    <section
      ref={ref}
      data-slot="dialog-section"
      className={cn("flex flex-col gap-3", className)}
      {...props}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <Heading level={level} size="subtitle" data-slot="dialog-section-title">
            {title}
          </Heading>
          {description ? (
            <Text variant="caption" tone="muted" data-slot="dialog-section-description">
              {description}
            </Text>
          ) : null}
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </div>
      {children}
    </section>
  );
});
