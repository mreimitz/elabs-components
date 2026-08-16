"use client";

/**
 * SelectionToolbar — a floating toolbar over selected transcript text.
 *
 * Wrap a transcript region; when the user selects text inside it, a small
 * toolbar floats above the selection with a single default action: Quote.
 * `onQuote(selectedText)` fires — the consumer prepends a `>`-prefixed
 * blockquote into the composer. Positioned with the `@elabs-ai/components-ui` Popover
 * primitives (a virtual anchor at the selection rect); dismisses when the
 * selection collapses. Presentational only.
 */

import {
  forwardRef,
  useCallback,
  useEffect,
  useRef,
  useState,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import { Quote } from "lucide-react";
import { Button, Popover, PopoverAnchor, PopoverContent } from "@elabs-ai/components-ui";
import { cn } from "@elabs-ai/components-ui/lib/cn";
import { useLocale } from "@elabs-ai/components-ui";

/** A captured selection snapshot: the trimmed text + its viewport rect. */
export interface SelectionSnapshot {
  text: string;
  rect: { top: number; left: number; width: number; height: number };
}

function isEditableNode(node: Node | null): boolean {
  let el: Node | null = node;
  while (el) {
    if (el instanceof HTMLElement) {
      const tag = el.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || el.isContentEditable) return true;
    }
    el = el.parentNode;
  }
  return false;
}

/**
 * Read the current selection if it is a non-empty range fully inside
 * `container` (and not inside a form field / editor). Returns `null` otherwise.
 * Exported for testing + custom integrations.
 */
export function readSelectionWithin(container: HTMLElement | null): SelectionSnapshot | null {
  if (!container || typeof window === "undefined") return null;
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) return null;

  const text = selection.toString().trim();
  if (text.length === 0) return null;

  const { anchorNode, focusNode } = selection;
  if (!anchorNode || !focusNode) return null;
  if (!container.contains(anchorNode) || !container.contains(focusNode)) return null;
  if (isEditableNode(anchorNode)) return null;

  const rect = selection.getRangeAt(0).getBoundingClientRect();
  if (rect.width <= 0 && rect.height <= 0) return null;

  return {
    text,
    rect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
  };
}

export interface SelectionToolbarProps extends HTMLAttributes<HTMLDivElement> {
  /** Called with the selected text when the user clicks Quote. */
  onQuote?: (selectedText: string) => void;
  /** Quote button label. @default "Quote" */
  quoteLabel?: string;
  /** Extra toolbar controls rendered after the Quote button. */
  actions?: ReactNode;
  /** Disable selection detection entirely. */
  disabled?: boolean;
  /** The transcript region to watch for selections. */
  children: ReactNode;
}

/**
 * Wraps a region and shows a floating Quote toolbar over selected text.
 * The wrapper renders inline (`display: contents` is avoided — it's a real
 * relative box) so the anchor + portal position correctly.
 */
export const SelectionToolbar = forwardRef<HTMLDivElement, SelectionToolbarProps>(
  function SelectionToolbar(
    { onQuote, quoteLabel = "Quote", actions, disabled = false, className, children, ...props },
    ref,
  ) {
    const { t } = useLocale();
    const containerRef = useRef<HTMLDivElement | null>(null);
    const [snapshot, setSnapshot] = useState<SelectionSnapshot | null>(null);
    const open = snapshot !== null;

    const setContainer = useCallback(
      (node: HTMLDivElement | null) => {
        containerRef.current = node;
        if (typeof ref === "function") ref(node);
        else if (ref) ref.current = node;
      },
      [ref],
    );

    const refresh = useCallback(() => {
      if (disabled) return;
      setSnapshot(readSelectionWithin(containerRef.current));
    }, [disabled]);

    const dismiss = useCallback(() => setSnapshot(null), []);

    // Open after the user finishes selecting; close when the selection collapses.
    useEffect(() => {
      if (disabled || typeof document === "undefined") return;
      const onSelectionChange = () => {
        const sel = window.getSelection();
        if (!sel || sel.isCollapsed || sel.toString().trim().length === 0) dismiss();
      };
      const onScroll = () => dismiss();
      const onKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") dismiss();
      };
      document.addEventListener("selectionchange", onSelectionChange);
      window.addEventListener("scroll", onScroll, true);
      document.addEventListener("keydown", onKeyDown);
      return () => {
        document.removeEventListener("selectionchange", onSelectionChange);
        window.removeEventListener("scroll", onScroll, true);
        document.removeEventListener("keydown", onKeyDown);
      };
    }, [disabled, dismiss]);

    const handleQuote = () => {
      if (snapshot) onQuote?.(snapshot.text);
      dismiss();
    };

    const rect = snapshot?.rect;

    return (
      <div
        ref={setContainer}
        className={cn("relative", className)}
        onPointerUp={refresh}
        onKeyUp={refresh}
        {...props}
      >
        {children}

        <Popover open={open} onOpenChange={(next) => (next ? undefined : dismiss())}>
          {/* Virtual anchor positioned at the selection rect (viewport coords). */}
          <PopoverAnchor asChild>
            <span
              aria-hidden="true"
              className="pointer-events-none fixed"
              style={
                rect
                  ? { top: rect.top, left: rect.left, width: rect.width, height: rect.height }
                  : { top: 0, left: 0, width: 0, height: 0 }
              }
            />
          </PopoverAnchor>
          <PopoverContent
            side="top"
            align="center"
            sideOffset={8}
            // On open, let focus move to the Quote button so the action is
            // keyboard-reachable (a11y: mouse-operable ⇒ keyboard-operable). The
            // captured snapshot text drives the quote, so a grayed selection is
            // fine. On close, DON'T return focus to the anchor (it's an
            // aria-hidden virtual span) — prevent that jump.
            onCloseAutoFocus={(e) => e.preventDefault()}
            className="flex w-auto items-center gap-1 p-1"
            role="toolbar"
            aria-label={t("ai.selectionToolbar.label")}
          >
            <Button size="sm" variant="ghost" onClick={handleQuote}>
              <Quote aria-hidden="true" className="size-4" />
              {quoteLabel}
            </Button>
            {actions}
          </PopoverContent>
        </Popover>
      </div>
    );
  },
);
