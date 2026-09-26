"use client";

import {
  forwardRef,
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type HTMLAttributes,
  type MouseEvent,
  type ReactNode,
} from "react";
import { useReducedMotion } from "@elabs-ai/components-tokens";
import { cn } from "../../lib/cn";
import { useLocale } from "../locale-provider";
import { Text } from "../typography";
import { useScrollSpy, type UseScrollSpyOptions } from "./use-scroll-spy";

export interface TableOfContentsItem {
  /** The id of the section (or heading) element this entry jumps to. */
  id: string;
  label: ReactNode;
  /** Nesting depth; `2` and `3` indent under the previous `1`. @default 1 */
  level?: 1 | 2 | 3;
}

export interface TableOfContentsProps
  extends Omit<HTMLAttributes<HTMLElement>, "title">, Pick<UseScrollSpyOptions, "offset"> {
  items: TableOfContentsItem[];
  /** Controlled current entry. Leave unset and the list follows the scroll position. */
  activeId?: string;
  /** Fires when the current entry changes — from scrolling or from a click. */
  onActiveChange?: (id: string) => void;
  /** Eyebrow above the list; `null` hides it (the `aria-label` stays). Defaults to the localized “On this page”. */
  title?: ReactNode;
  /**
   * `"smooth"` (default) scrolls the section into view with a smooth scroll
   * (an instant jump under reduced motion) and moves focus to it; `"native"`
   * leaves the anchor to the browser.
   */
  scroll?: "smooth" | "native";
}

const LEVEL_INDENT: Record<NonNullable<TableOfContentsItem["level"]>, string> = {
  1: "ps-4",
  2: "ps-8",
  3: "ps-12",
};

/**
 * The “On this page” list beside long-form content: one link per section,
 * the current one marked by a sliding accent rail (WCAG 1.4.1: also
 * `aria-current` and weight, never colour alone). Current follows the reader’s
 * scroll position via `useScrollSpy`, or the `activeId` you control.
 *
 * Give each section `id={item.id}` — and `scroll-mt-*` matching `offset`
 * when sticky chrome sits above the content, so a jump lands below it.
 */
export const TableOfContents = forwardRef<HTMLElement, TableOfContentsProps>(
  function TableOfContents(
    {
      items,
      activeId: activeProp,
      onActiveChange,
      title,
      scroll = "smooth",
      offset = 96,
      className,
      ...props
    },
    ref,
  ) {
    const { t } = useLocale();
    const defaultTitle = t("ui.tableOfContents.title");
    const heading = title === undefined ? defaultTitle : title;
    const isControlled = activeProp !== undefined;
    const ids = items.map((item) => item.id);
    const [spied, setSpied] = useScrollSpy(ids, { offset, enabled: !isControlled });
    const activeId = isControlled ? activeProp : spied;
    const reducedMotion = useReducedMotion();

    const listRef = useRef<HTMLOListElement>(null);
    const [marker, setMarker] = useState<{ top: number; height: number } | null>(null);

    // Announce spy-driven changes to the owner (clicks announce themselves).
    const lastAnnounced = useRef<string | undefined>(undefined);
    useLayoutEffect(() => {
      if (activeId !== undefined && activeId !== lastAnnounced.current) {
        lastAnnounced.current = activeId;
        onActiveChange?.(activeId);
      }
    }, [activeId, onActiveChange]);

    // The accent marker is one element that MOVES to the current link, so the
    // change reads as a slide rather than a blink. Measured from the list.
    useLayoutEffect(() => {
      const list = listRef.current;
      if (!list) return;
      const measure = () => {
        const link = activeId
          ? list.querySelector<HTMLElement>(`[data-toc-id="${CSS.escape(activeId)}"]`)
          : null;
        if (!link) {
          setMarker(null);
          return;
        }
        const listBox = list.getBoundingClientRect();
        const box = link.getBoundingClientRect();
        setMarker({ top: box.top - listBox.top, height: box.height });
      };
      measure();
      if (typeof ResizeObserver !== "function") return;
      const ro = new ResizeObserver(measure);
      ro.observe(list);
      return () => ro.disconnect();
    }, [activeId, items]);

    const onClick = useCallback(
      (event: MouseEvent<HTMLAnchorElement>, id: string) => {
        if (scroll !== "smooth") return;
        if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey) return;
        const target = document.getElementById(id);
        if (!target) return;
        event.preventDefault();
        const smooth = !reducedMotion;
        // Pin the current entry while the scroll is in flight; the spy would
        // otherwise flash every section it passes through.
        // A jump scroll still reports through the observer a frame later.
        setSpied(id, smooth ? 900 : 150);
        onActiveChange?.(id);
        target.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "start" });
        if (typeof window !== "undefined" && window.history?.replaceState) {
          window.history.replaceState(null, "", `#${id}`);
        }
        // Hand keyboard focus to the section, as a skip link does.
        if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
        target.focus({ preventScroll: true });
      },
      [scroll, reducedMotion, setSpied, onActiveChange],
    );

    return (
      <nav
        ref={ref}
        aria-label={typeof title === "string" ? title : defaultTitle}
        className={cn("flex flex-col gap-3", className)}
        data-slot="table-of-contents"
        {...props}
      >
        {heading !== null ? (
          <Text as="span" data-slot="table-of-contents-title" tone="muted" variant="eyebrow">
            {heading}
          </Text>
        ) : null}
        <ol
          ref={listRef}
          className="relative flex flex-col border-s border-border-strong"
          data-slot="table-of-contents-list"
        >
          <span
            aria-hidden="true"
            className={cn(
              "absolute -start-px w-0.5 bg-primary transition-[top,height,opacity] duration-base ease-standard motion-reduce:transition-none",
              marker ? "opacity-100" : "opacity-0",
            )}
            data-slot="table-of-contents-marker"
            style={marker ? { top: marker.top, height: marker.height } : undefined}
          />
          {items.map((item) => {
            const current = item.id === activeId;
            return (
              <li data-slot="table-of-contents-item" key={item.id}>
                <a
                  aria-current={current ? "location" : undefined}
                  className={cn(
                    "block py-1.5 pe-2 text-body transition-colors duration-fast focus-ring",
                    LEVEL_INDENT[item.level ?? 1],
                    current
                      ? "font-medium text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                  data-toc-id={item.id}
                  href={`#${item.id}`}
                  onClick={(event) => onClick(event, item.id)}
                >
                  {item.label}
                </a>
              </li>
            );
          })}
        </ol>
      </nav>
    );
  },
);
