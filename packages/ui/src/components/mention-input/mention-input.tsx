"use client";

import {
  createContext,
  forwardRef,
  use,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type HTMLAttributes,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  type TextareaHTMLAttributes,
} from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "../../lib/cn";
import { mergeRefs } from "../../lib/merge-refs";
import { findTriggerQuery } from "../../lib/trigger-query";
import { useLocale } from "../locale-provider";
import { Popover, PopoverAnchor, PopoverContent } from "../popover";
import { Textarea } from "../textarea";
import {
  defaultMentionFilter,
  insertMention,
  mentionAt,
  mentionEnd,
  remapMentions,
  type Mention,
  type MentionOption,
  type MentionValue,
} from "./mention-value";

export type { Mention, MentionOption, MentionValue };

const EMPTY_VALUE: MentionValue = { text: "", mentions: [] };

// ---------------------------------------------------------------------------
// Context — state / actions / meta (component-api.md provider-injection shape)
// ---------------------------------------------------------------------------

export interface MentionInputContextValue {
  state: {
    value: MentionValue;
    /** The in-progress query WITHOUT the trigger char; `null` when closed. */
    query: string | null;
    open: boolean;
    /** Index into `filtered`; `-1` when nothing is highlighted. */
    activeIndex: number;
    /** DOM id of the highlighted option; `undefined` when nothing is. */
    activeId?: string;
    filtered: MentionOption[];
  };
  actions: {
    insert: (option: MentionOption) => void;
    close: () => void;
    setActiveIndex: (index: number) => void;
  };
  meta: {
    trigger: string;
    listId: string;
    /**
     * The id `MentionInputTextarea` puts on its element. Advisory only — with
     * `asChild`, Radix `Slot` lets a consumer-supplied `id` on the child win
     * (child props are merged OVER slot props), so the component itself never
     * resolves the field through this id; it holds a real ref.
     */
    textareaId: string;
    optionId: (index: number) => string;
  };
}

const MentionInputContext = createContext<MentionInputContextValue | null>(null);

/** Read the surrounding `MentionInput`'s state, actions and ids. */
export function useMentionInput(): MentionInputContextValue {
  const ctx = use(MentionInputContext);
  if (!ctx) {
    throw new Error("useMentionInput must be used inside a <MentionInput>.");
  }
  return ctx;
}

// ---------------------------------------------------------------------------
// Query detection
// ---------------------------------------------------------------------------

/** Next enabled index in `list`, wrapping; `-1` when none is selectable. */
function step(list: MentionOption[], from: number, direction: 1 | -1): number {
  const count = list.length;
  if (count === 0) return -1;
  for (let i = 1; i <= count; i++) {
    const index = (((from + direction * i) % count) + count) % count;
    if (!list[index]?.disabled) return index;
  }
  return -1;
}

function firstEnabled(list: MentionOption[]): number {
  const index = list.findIndex((o) => !o.disabled);
  return index;
}

function lastEnabled(list: MentionOption[]): number {
  for (let i = list.length - 1; i >= 0; i--) {
    if (!list[i]?.disabled) return i;
  }
  return -1;
}

// ---------------------------------------------------------------------------
// Caret / overlay mirror
// ---------------------------------------------------------------------------

/**
 * Computed properties the mirror has to copy verbatim for its glyph metrics to
 * land on the same pixels as the textarea's. Anything that changes where a
 * character starts belongs here.
 */
const MIRRORED_PROPERTIES = [
  "boxSizing",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "borderTopWidth",
  "borderRightWidth",
  "borderBottomWidth",
  "borderLeftWidth",
  "fontFamily",
  "fontSize",
  "fontWeight",
  "fontStyle",
  "fontVariant",
  "fontStretch",
  "fontFeatureSettings",
  "fontVariationSettings",
  "letterSpacing",
  "lineHeight",
  "textTransform",
  "textIndent",
  "wordSpacing",
  "textAlign",
  "direction",
  "tabSize",
  // Wrapping, copied rather than assumed: forcing `word-break: break-word` when
  // the field says `normal` breaks long words one line early in the mirror.
  "whiteSpace",
  "overflowWrap",
  "wordBreak",
] as const satisfies readonly (keyof CSSStyleDeclaration & string)[];

function readMirrorStyle(textarea: HTMLTextAreaElement): CSSProperties {
  const computed = getComputedStyle(textarea);
  const style: Record<string, string | number> = {};
  for (const property of MIRRORED_PROPERTIES) {
    style[property] = computed[property] as string;
  }

  const borderX =
    Number.parseFloat(computed.borderLeftWidth || "0") +
    Number.parseFloat(computed.borderRightWidth || "0");
  // Whatever the box is wider than its content area, minus the borders, is the
  // vertical scrollbar. Fold it into the padding or every wrapped line in the
  // mirror breaks a few characters later than it does in the field.
  const scrollbar = Math.max(0, textarea.offsetWidth - textarea.clientWidth - borderX);

  return {
    ...(style as CSSProperties),
    position: "absolute",
    left: textarea.offsetLeft,
    top: textarea.offsetTop,
    width: textarea.offsetWidth,
    height: textarea.offsetHeight,
    paddingRight: Number.parseFloat(computed.paddingRight || "0") + scrollbar,
    borderStyle: "solid",
    borderColor: "transparent",
    // A textarea already computes `pre-wrap`; the fallback only covers a host
    // that reset it, and an environment (jsdom) that resolves nothing.
    whiteSpace: computed.whiteSpace || "pre-wrap",
    overflow: "hidden",
    margin: 0,
  };
}

/** Split the text into plain runs and mention runs, in document order. */
function buildRuns(
  value: MentionValue,
  trigger: string,
): Array<{ key: string; text: string; mention?: Mention }> {
  const runs: Array<{ key: string; text: string; mention?: Mention }> = [];
  const ordered = [...value.mentions].sort((a, b) => a.start - b.start);
  let cursor = 0;
  for (const mention of ordered) {
    if (mention.start > cursor) {
      runs.push({ key: `t${cursor}`, text: value.text.slice(cursor, mention.start) });
    }
    const end = mentionEnd(mention, trigger);
    runs.push({ key: `m${mention.start}`, text: value.text.slice(mention.start, end), mention });
    cursor = end;
  }
  if (cursor < value.text.length) {
    runs.push({ key: `t${cursor}`, text: value.text.slice(cursor) });
  }
  return runs;
}

// ---------------------------------------------------------------------------
// MentionInput (root + provider + Popover)
// ---------------------------------------------------------------------------

export interface MentionInputProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  "onChange" | "defaultValue"
> {
  /** The roster the popup offers. */
  options: MentionOption[];
  /** Controlled value. */
  value?: MentionValue;
  /** Uncontrolled initial value. */
  defaultValue?: MentionValue;
  /** Called with the whole value whenever text or mentions change. */
  onValueChange?: (value: MentionValue) => void;
  /** Trigger character. Default `"@"`. */
  trigger?: string;
  /**
   * Which options survive the current query. Defaults to
   * `defaultMentionFilter`; pass `() => true` when the roster is fetched
   * app-side from `onQueryChange`.
   */
  filter?: (option: MentionOption, query: string) => boolean;
  /** The query changed. `null` means the popup closed. */
  onQueryChange?: (query: string | null) => void;
  /** Controlled popup state. */
  open?: boolean;
  /** Called when the popup wants to open or close. */
  onOpenChange?: (open: boolean) => void;
  children: ReactNode;
}

/**
 * MentionInput — an `@`-mention text field built on a real `<textarea>`.
 *
 * The field stays a native textarea (so IME, paste, undo, spellcheck, mobile
 * keyboards and `FormData` all keep working) and mentions are tracked as
 * offsets beside it. The suggestion popup is this component's own listbox
 * driven by `aria-activedescendant`, so **focus never leaves the textarea** —
 * a popup that took focus would take the caret with it.
 */
export const MentionInput = forwardRef<HTMLDivElement, MentionInputProps>(function MentionInput(
  {
    options,
    value: valueProp,
    defaultValue,
    onValueChange,
    trigger = "@",
    filter = defaultMentionFilter,
    onQueryChange,
    open: openProp,
    onOpenChange,
    className,
    children,
    ...props
  },
  ref,
) {
  const uid = useId();
  const listId = `${uid}-listbox`;
  const textareaId = `${uid}-textarea`;
  const optionId = useCallback((index: number) => `${uid}-option-${index}`, [uid]);

  const rootRef = useRef<HTMLDivElement>(null);
  const mergedRootRef = useMemo(() => mergeRefs<HTMLDivElement>(ref, rootRef), [ref]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ------------------------------------------------------------------
  // Controlled / uncontrolled value
  // ------------------------------------------------------------------
  const isControlled = valueProp !== undefined;
  const [internalValue, setInternalValue] = useState<MentionValue>(defaultValue ?? EMPTY_VALUE);
  const value = isControlled ? valueProp : internalValue;

  const commit = useCallback(
    (next: MentionValue) => {
      if (!isControlled) setInternalValue(next);
      onValueChange?.(next);
    },
    [isControlled, onValueChange],
  );

  // ------------------------------------------------------------------
  // Caret
  // ------------------------------------------------------------------
  const [caret, setCaret] = useState(() => (defaultValue?.text ?? "").length);
  const pendingCaretRef = useRef<number | null>(null);

  const applyCaret = useCallback((position: number) => {
    pendingCaretRef.current = position;
    setCaret(position);
    // Pure caret moves change no value, so React may skip the re-render that
    // would flush `pendingCaretRef` — set it here as well. Value changes still
    // need the post-commit pass below, because React writes the new `value`
    // into the DOM after this point and that resets the selection.
    textareaRef.current?.setSelectionRange(position, position);
  }, []);

  useLayoutEffect(() => {
    const position = pendingCaretRef.current;
    if (position === null) return;
    pendingCaretRef.current = null;
    textareaRef.current?.setSelectionRange(position, position);
  });

  // ------------------------------------------------------------------
  // Query / open state
  // ------------------------------------------------------------------
  const queryInfo = useMemo(
    () =>
      findTriggerQuery(value.text, caret, trigger, {
        isTriggerConsumed: (start) => mentionAt(value, start, trigger) !== undefined,
      }),
    [value, caret, trigger],
  );

  // Escape (and an outside dismissal) suppress the popup for the run it was
  // dismissed on, without touching the text — the query is still there, the
  // user just said they are done with the roster for now.
  const [dismissedStart, setDismissedStart] = useState<number | null>(null);
  useEffect(() => {
    if (queryInfo === null && dismissedStart !== null) setDismissedStart(null);
  }, [queryInfo, dismissedStart]);

  const derivedOpen = queryInfo !== null && dismissedStart !== queryInfo.start;
  const open = openProp ?? derivedOpen;
  const query = open && queryInfo ? queryInfo.query : null;

  const setOpen = useCallback(
    (next: boolean) => {
      onOpenChange?.(next);
      if (!next) setDismissedStart(queryInfo?.start ?? null);
    },
    [onOpenChange, queryInfo],
  );

  const onQueryChangeRef = useRef(onQueryChange);
  useEffect(() => {
    onQueryChangeRef.current = onQueryChange;
  }, [onQueryChange]);
  useEffect(() => {
    onQueryChangeRef.current?.(query);
  }, [query]);

  // ------------------------------------------------------------------
  // Filtering + highlight
  // ------------------------------------------------------------------
  const filtered = useMemo(
    () => (open && query !== null ? options.filter((option) => filter(option, query)) : []),
    [open, query, options, filter],
  );

  const [activeIndexState, setActiveIndexState] = useState(0);

  /**
   * The highlight is RESOLVED during render, never repaired in an effect.
   *
   * `aria-activedescendant` and the option's `aria-selected` must be written in
   * the same commit, or the attribute names an element that does not exist yet
   * — the generalised form of cmdk's `selectedItemId` hole (see the docblock in
   * `../command/command.tsx`). Clamping here means a stale index from before a
   * filter keystroke can never reach the DOM, not even for one frame.
   */
  const activeIndex = useMemo(() => {
    const candidate = filtered[activeIndexState];
    if (candidate && !candidate.disabled) return activeIndexState;
    return firstEnabled(filtered);
  }, [filtered, activeIndexState]);

  // Reset the *stored* index when the query changes so the next arrow press
  // starts from the top. Safe as an effect precisely because the resolved value
  // above is already correct in the intervening commit.
  useEffect(() => {
    setActiveIndexState(0);
  }, [query]);

  const activeId = activeIndex >= 0 ? optionId(activeIndex) : undefined;

  // ------------------------------------------------------------------
  // Actions
  // ------------------------------------------------------------------
  const insert = useCallback(
    (option: MentionOption) => {
      if (option.disabled || !queryInfo) return;
      const result = insertMention(value, option, trigger, queryInfo.start, caret);
      commit(result.value);
      applyCaret(result.caret);
    },
    [queryInfo, value, trigger, caret, commit, applyCaret],
  );

  const close = useCallback(() => {
    setOpen(false);
  }, [setOpen]);

  const removeMention = useCallback(
    (mention: Mention) => {
      const end = mentionEnd(mention, trigger);
      const nextText = value.text.slice(0, mention.start) + value.text.slice(end);
      commit({ text: nextText, mentions: remapMentions(value, nextText, trigger) });
      applyCaret(mention.start);
    },
    [value, trigger, commit, applyCaret],
  );

  // ------------------------------------------------------------------
  // Textarea event handlers (owned here, handed to MentionInputTextarea)
  // ------------------------------------------------------------------
  const syncCaret = useCallback((element: HTMLTextAreaElement) => {
    setCaret(element.selectionStart ?? 0);
  }, []);

  const handleChange = useCallback(
    (element: HTMLTextAreaElement) => {
      const nextText = element.value;
      commit({ text: nextText, mentions: remapMentions(value, nextText, trigger) });
      setCaret(element.selectionStart ?? nextText.length);
    },
    [commit, value, trigger],
  );

  const handleKeyDownCapture = useCallback(
    (event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
      const element = event.currentTarget;
      const position = element.selectionStart ?? 0;
      const hasRange = element.selectionStart !== element.selectionEnd;

      if (open) {
        switch (event.key) {
          case "ArrowDown":
            event.preventDefault();
            setActiveIndexState(step(filtered, activeIndex, 1));
            return;
          case "ArrowUp":
            event.preventDefault();
            setActiveIndexState(step(filtered, activeIndex < 0 ? 0 : activeIndex, -1));
            return;
          case "Home":
            event.preventDefault();
            setActiveIndexState(firstEnabled(filtered));
            return;
          case "End":
            event.preventDefault();
            setActiveIndexState(lastEnabled(filtered));
            return;
          case "Enter":
          case "Tab": {
            const option = activeIndex >= 0 ? filtered[activeIndex] : undefined;
            if (option && !option.disabled) {
              // Capture phase, so `defaultPrevented` is already true when a
              // host handler (PromptInput's Enter→submit) runs in the bubble
              // phase on this same element and this same SyntheticEvent.
              event.preventDefault();
              insert(option);
            }
            return;
          }
          case "Escape":
            event.preventDefault();
            close();
            return;
          default:
            break;
        }
      }

      // Chip atomicity. A range selection is ordinary text editing — the user
      // asked for exactly those characters, mentions included.
      if (hasRange || event.metaKey || event.ctrlKey || event.altKey) return;

      if (event.key === "Backspace") {
        const mention = mentionAt(value, position - 1, trigger);
        if (mention) {
          event.preventDefault();
          removeMention(mention);
        }
        return;
      }
      if (event.key === "Delete") {
        const mention = mentionAt(value, position, trigger);
        if (mention) {
          event.preventDefault();
          removeMention(mention);
        }
        return;
      }
      if (event.key === "ArrowLeft" && !event.shiftKey) {
        const mention = mentionAt(value, position - 1, trigger);
        if (mention && position - 1 > mention.start) {
          event.preventDefault();
          applyCaret(mention.start);
        }
        return;
      }
      if (event.key === "ArrowRight" && !event.shiftKey) {
        const mention = mentionAt(value, position, trigger);
        if (mention) {
          event.preventDefault();
          applyCaret(mentionEnd(mention, trigger));
        }
      }
    },
    [open, filtered, activeIndex, insert, close, value, trigger, removeMention, applyCaret],
  );

  // ------------------------------------------------------------------
  // Mirror geometry (caret anchor + chip overlay)
  // ------------------------------------------------------------------
  const [mirrorStyle, setMirrorStyle] = useState<CSSProperties | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const caretMarkerRef = useRef<HTMLSpanElement>(null);
  const [caretRect, setCaretRect] = useState({ left: 0, top: 0, height: 0 });

  /**
   * Re-snapshot the field's metrics whenever anything that MOVES A GLYPH can
   * have changed.
   *
   * A one-shot snapshot is not enough and the failure is visible, not
   * theoretical: the very first layout effect runs before the theme attribute
   * has been applied, so it captures the `:root` fallback font — the chip wash
   * then renders in a different typeface from the text it is supposed to sit
   * behind and runs ~14% wide (measured: 143.3px vs 125.5px for the same
   * string). Exactly the same drift happens at runtime whenever a `ThemeSwitcher`
   * changes `data-theme`, a density dial changes the type scale, or a web font
   * finishes loading. So the snapshot is re-taken on all of them.
   */
  const remeasureMirror = useCallback(() => {
    const element = textareaRef.current;
    if (!element) return;
    const next = readMirrorStyle(element);
    setMirrorStyle((previous) =>
      previous && JSON.stringify(previous) === JSON.stringify(next) ? previous : next,
    );
  }, []);

  useLayoutEffect(() => {
    remeasureMirror();
  }, [remeasureMirror, value.text]);

  useLayoutEffect(() => {
    const element = textareaRef.current;
    if (!element) return;
    const teardown: Array<() => void> = [];

    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(remeasureMirror);
      observer.observe(element);
      teardown.push(() => observer.disconnect());
    }

    if (typeof MutationObserver !== "undefined") {
      // The field's own classes/inline styles.
      const fieldObserver = new MutationObserver(remeasureMirror);
      fieldObserver.observe(element, {
        attributes: true,
        attributeFilter: ["class", "style"],
      });
      teardown.push(() => fieldObserver.disconnect());

      // Theme / density / decoration switches re-resolve the INHERITED font and
      // type scale, and a stale snapshot misaligns every chip on the surface.
      const rootObserver = new MutationObserver(remeasureMirror);
      for (const node of [document.documentElement, document.body]) {
        rootObserver.observe(node, {
          attributes: true,
          attributeFilter: ["data-theme", "data-density", "data-decoration", "class", "style"],
        });
      }
      teardown.push(() => rootObserver.disconnect());
    }

    // A web font landing after first paint changes every advance width. This
    // arm is intentionally kept as unpinned defence-in-depth: five isolation
    // attempts (issue #405) could not construct a scenario where removing it
    // alone turns any test red — it is covered only compositely by the
    // ResizeObserver/MutationObserver arms above. Do not delete it on the
    // strength of "no test notices"; see #405 for the full mutation audit and
    // the maintainer's keep decision (ADR 0023 §6).
    let cancelled = false;
    void document.fonts?.ready
      .then(() => {
        if (!cancelled) remeasureMirror();
      })
      .catch(() => undefined);
    teardown.push(() => {
      cancelled = true;
    });

    return () => {
      for (const fn of teardown) fn();
    };
  }, [remeasureMirror]);

  useLayoutEffect(() => {
    if (!open) return;
    const marker = caretMarkerRef.current;
    const root = rootRef.current;
    if (!marker || !root) return;
    const rect = marker.getClientRects()[0] ?? marker.getBoundingClientRect();
    const rootRect = root.getBoundingClientRect();
    const next = {
      left: rect.left - rootRect.left,
      top: rect.top - rootRect.top,
      height: rect.height,
    };
    setCaretRect((previous) =>
      previous.left === next.left && previous.top === next.top && previous.height === next.height
        ? previous
        : next,
    );
  }, [open, caret, value.text, mirrorStyle, scrollTop]);

  const runs = useMemo(() => buildRuns(value, trigger), [value, trigger]);

  // ------------------------------------------------------------------
  // Context
  // ------------------------------------------------------------------
  const contextValue = useMemo<MentionInputContextValue>(
    () => ({
      state: { value, query, open, activeIndex, activeId, filtered },
      actions: { insert, close, setActiveIndex: setActiveIndexState },
      meta: { trigger, listId, textareaId, optionId },
    }),
    [
      value,
      query,
      open,
      activeIndex,
      activeId,
      filtered,
      insert,
      close,
      trigger,
      listId,
      textareaId,
      optionId,
    ],
  );

  const textareaContextValue = useMemo<TextareaWiring>(
    () => ({
      textareaRef,
      textareaId,
      listId,
      open,
      activeId,
      value: value.text,
      onValueInput: handleChange,
      onCaretSync: syncCaret,
      onKeyDownCapture: handleKeyDownCapture,
      onDismiss: close,
      onScrollSync: setScrollTop,
    }),
    [
      textareaId,
      listId,
      open,
      activeId,
      value.text,
      handleChange,
      syncCaret,
      handleKeyDownCapture,
      close,
    ],
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <MentionInputContext value={contextValue}>
        <TextareaWiringContext value={textareaContextValue}>
          <div
            ref={mergedRootRef}
            data-slot="mention-input"
            className={cn("relative", className)}
            {...props}
          >
            {children}

            {/*
              Chip overlay — decorative, painted ON TOP of the field.
              Every run is `text-transparent`; only a mention run paints a
              background, and it is a 10% wash, so the real glyphs in the
              textarea below stay legible and stay the ONLY copy of the text
              (native selection, IME and spellcheck are untouched). It sits on
              top rather than behind because a textarea's own background is
              opaque (`bg-background`), which would hide anything underneath.
            */}
            {mirrorStyle ? (
              <div
                data-slot="mention-input-overlay"
                aria-hidden="true"
                className="pointer-events-none select-none text-transparent"
                style={{ ...mirrorStyle, zIndex: 1 }}
              >
                <div style={{ transform: `translateY(${-scrollTop}px)` }}>
                  {runs.map((run) =>
                    run.mention ? (
                      <span
                        key={run.key}
                        data-slot="mention-input-chip"
                        className="box-decoration-clone rounded-sm bg-primary/10"
                      >
                        {run.text}
                      </span>
                    ) : (
                      <span key={run.key}>{run.text}</span>
                    ),
                  )}
                </div>
              </div>
            ) : null}

            {/* Caret measurement mirror — laid out, never painted. */}
            {open && mirrorStyle ? (
              <div
                data-slot="mention-input-caret-mirror"
                aria-hidden="true"
                className="pointer-events-none select-none"
                style={{ ...mirrorStyle, visibility: "hidden", zIndex: -1 }}
              >
                <div style={{ transform: `translateY(${-scrollTop}px)` }}>
                  {value.text.slice(0, caret)}
                  <span ref={caretMarkerRef}>{value.text.slice(caret) || "."}</span>
                </div>
              </div>
            ) : null}

            <PopoverAnchor asChild>
              <span
                data-slot="mention-input-anchor"
                aria-hidden="true"
                className="pointer-events-none absolute"
                style={{
                  left: caretRect.left,
                  top: caretRect.top,
                  width: 0,
                  height: caretRect.height,
                }}
              />
            </PopoverAnchor>
          </div>
        </TextareaWiringContext>
      </MentionInputContext>
    </Popover>
  );
});

// ---------------------------------------------------------------------------
// MentionInputTextarea
// ---------------------------------------------------------------------------

interface TextareaWiring {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  textareaId: string;
  listId: string;
  open: boolean;
  activeId?: string;
  value: string;
  onValueInput: (element: HTMLTextAreaElement) => void;
  onCaretSync: (element: HTMLTextAreaElement) => void;
  onKeyDownCapture: (event: ReactKeyboardEvent<HTMLTextAreaElement>) => void;
  onDismiss: () => void;
  onScrollSync: (scrollTop: number) => void;
}

const TextareaWiringContext = createContext<TextareaWiring | null>(null);

export interface MentionInputTextareaProps extends Omit<
  TextareaHTMLAttributes<HTMLTextAreaElement>,
  "value" | "defaultValue"
> {
  /**
   * Render the consumer's own textarea-rendering component instead of a
   * `Textarea` — e.g. `PromptInputTextarea`. The child must ultimately render a
   * real `<textarea>`; everything this component needs is spread onto it.
   */
  asChild?: boolean;
}

/**
 * The field itself — a real `<textarea>` carrying the combobox semantics.
 *
 * The mention interception is bound as **`onKeyDownCapture`**, not `onKeyDown`.
 * Under `asChild`, Radix `Slot` merges CHILD handlers over slot handlers and
 * runs the child's **first**. So when the child binds `onKeyDown` directly on
 * the host element, a bubble-phase handler here would fire *after* it — the
 * child's Enter→submit would win and the popup would never see the key. React
 * dispatches an element's capture pass before its bubble pass and shares one
 * `SyntheticEvent` between them, so `preventDefault()` here is already visible
 * as `event.defaultPrevented` when the child's handler runs.
 *
 * **Scope of the hazard, stated precisely** (an earlier version of this comment
 * overclaimed): it applies to a child that binds `onKeyDown` on a *host
 * element*. It does NOT apply to `PromptInputTextarea`, which is a *component*
 * that destructures `onKeyDown` out of its own props, calls it first and bails
 * on `defaultPrevented` (`packages/ai/src/prompt-input.tsx`) — that composition
 * works with either binding. The capture binding is what makes the raw-host
 * case correct too, and that is the case the locking test exercises: see
 * "T8 Slot handler-order contract" in `mention-input.test.tsx`, which fails if
 * this is ever moved to `onKeyDown`.
 */
export const MentionInputTextarea = forwardRef<HTMLTextAreaElement, MentionInputTextareaProps>(
  function MentionInputTextarea(
    {
      asChild,
      className,
      // The seven handlers this component owns are destructured OUT of `props`
      // so `{...props}` can be spread BEFORE them without clobbering them.
      // Spreading props last (the obvious reading of "spread ...props onto the
      // root") silently replaced the component's own wiring: a consumer passing
      // `onChange` used to knock out `wiring.onValueInput`, and since the value
      // is provider-controlled that left the field completely inert. Consumer
      // handlers still run — each one is invoked from inside its counterpart —
      // and every NON-handler prop (`id`, `name`, `aria-*`, `placeholder`, …)
      // still wins, because the spread sits after those defaults.
      onChange,
      onKeyDownCapture,
      onSelect,
      onKeyUp,
      onClick,
      onScroll,
      onBlur,
      ...props
    },
    ref,
  ) {
    const wiring = use(TextareaWiringContext);
    if (!wiring) {
      throw new Error("MentionInputTextarea must be used inside a <MentionInput>.");
    }
    const mergedRef = useMemo(
      () => mergeRefs<HTMLTextAreaElement>(ref, wiring.textareaRef),
      [ref, wiring.textareaRef],
    );

    const Comp = asChild ? Slot : Textarea;

    return (
      <Comp
        ref={mergedRef}
        id={wiring.textareaId}
        data-slot="mention-input-textarea"
        // Machine-readable open state. It is a `data-` attribute rather than
        // `aria-expanded` because `aria-expanded` is NOT in `textbox`'s
        // supported-property set — see the ARIA note below.
        data-state={wiring.open ? "open" : "closed"}
        // The field stays an implicit `textbox`. `role="combobox"` on a
        // `<textarea>` is invalid per ARIA in HTML (`<textarea>` allows no role
        // override) and axe's `aria-allowed-role` — enabled by default — flags
        // it on every story; `aria-expanded` on a textbox is worse still
        // (`aria-allowed-attr`, CRITICAL). All four attributes below ARE in
        // `textbox`'s supported set, so this arrangement is both spec-valid and
        // axe-clean while keeping the announcement that matters: with
        // `aria-activedescendant` on a textbox, AT reads the highlighted option
        // as the user arrows through the roster.
        aria-autocomplete="list"
        aria-haspopup="listbox"
        // Only while the popup is mounted: the listbox lives in a Radix portal
        // that unmounts on close, and an `aria-controls` pointing at a removed
        // node is a dangling reference.
        aria-controls={wiring.open ? wiring.listId : undefined}
        aria-activedescendant={wiring.activeId}
        autoComplete="off"
        value={wiring.value}
        className={cn("relative z-0", className)}
        {...props}
        onChange={(event) => {
          wiring.onValueInput(event.currentTarget);
          onChange?.(event);
        }}
        onKeyDownCapture={(event) => {
          wiring.onKeyDownCapture(event);
          onKeyDownCapture?.(event);
        }}
        onSelect={(event) => {
          wiring.onCaretSync(event.currentTarget);
          onSelect?.(event);
        }}
        onKeyUp={(event) => {
          wiring.onCaretSync(event.currentTarget);
          onKeyUp?.(event);
        }}
        onClick={(event) => {
          wiring.onCaretSync(event.currentTarget);
          onClick?.(event);
        }}
        onScroll={(event) => {
          wiring.onScrollSync(event.currentTarget.scrollTop);
          onScroll?.(event);
        }}
        onBlur={(event) => {
          wiring.onDismiss();
          onBlur?.(event);
        }}
      />
    );
  },
);

// ---------------------------------------------------------------------------
// MentionInputContent / List / Item / Empty
// ---------------------------------------------------------------------------

export type MentionInputContentProps = React.ComponentPropsWithoutRef<typeof PopoverContent>;

/** The floating panel. Never takes focus — the caret has to stay in the field. */
export const MentionInputContent = forwardRef<
  React.ElementRef<typeof PopoverContent>,
  MentionInputContentProps
>(function MentionInputContent({ className, align = "start", ...props }, ref) {
  const { meta } = useMentionInput();
  const wiring = use(TextareaWiringContext);

  return (
    <PopoverContent
      ref={ref}
      data-slot="mention-input-content"
      align={align}
      // Radix `PopoverContent` defaults to `role="dialog"`, which is wrong here
      // twice over: a combobox popup is not a dialog, and an unnamed dialog is
      // an axe `aria-dialog-name` violation (serious). The panel is a plain
      // container — the `role="listbox"` inside carries all the semantics.
      role="presentation"
      // No border, no ring: PopoverContent already carries `shadow-ring-md`.
      className={cn("w-72 p-0", className)}
      onOpenAutoFocus={(event) => event.preventDefault()}
      onCloseAutoFocus={(event) => event.preventDefault()}
      onPointerDownOutside={(event) => {
        // Clicking the field itself only moves the caret; it must not count as
        // a dismissal, or the popup would fight the caret it depends on.
        const target = event.detail.originalEvent.target as Node | null;
        if (target && wiring?.textareaRef.current?.contains(target)) event.preventDefault();
        props.onPointerDownOutside?.(event);
      }}
      id={`${meta.listId}-content`}
      {...props}
    />
  );
});

export interface MentionInputListProps extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  /**
   * Either static nodes, or a render function called once per filtered option.
   * The function form is the one to reach for — the parent has to hand each
   * option back, which is exactly what `children`-as-a-function is for.
   */
  children?: ReactNode | ((option: MentionOption, index: number) => ReactNode);
}

/** The listbox. Owns the accessible name and the option mapping. */
export const MentionInputList = forwardRef<HTMLDivElement, MentionInputListProps>(
  function MentionInputList({ className, children, ...props }, ref) {
    const { t } = useLocale();
    const { state, meta } = useMentionInput();

    return (
      <div
        ref={ref}
        id={meta.listId}
        data-slot="mention-input-list"
        role="listbox"
        aria-label={t("ui.mentionInput.listLabel")}
        className={cn("max-h-60 overflow-y-auto p-1", className)}
        {...props}
      >
        {typeof children === "function"
          ? state.filtered.map((option, index) => children(option, index))
          : children}
      </div>
    );
  },
);

export interface MentionInputItemProps extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  option: MentionOption;
  children?: ReactNode;
}

/**
 * One option row.
 *
 * The row derives its own index from the provider's `filtered` list rather than
 * accepting one, so its `id` and `aria-selected` can never disagree with the
 * `aria-activedescendant` the field is publishing.
 */
export const MentionInputItem = forwardRef<HTMLDivElement, MentionInputItemProps>(
  function MentionInputItem({ option, className, children, ...props }, ref) {
    const { state, actions, meta } = useMentionInput();
    const index = state.filtered.findIndex((candidate) => candidate.id === option.id);
    const isActive = index >= 0 && index === state.activeIndex;

    return (
      <div
        ref={ref}
        id={index >= 0 ? meta.optionId(index) : undefined}
        data-slot="mention-input-item"
        role="option"
        aria-selected={isActive}
        aria-disabled={option.disabled || undefined}
        data-active={isActive || undefined}
        className={cn(
          "relative flex cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5",
          "text-body outline-none transition-colors duration-fast motion-reduce:transition-none",
          "data-[active=true]:bg-accent data-[active=true]:text-accent-foreground",
          "aria-disabled:pointer-events-none aria-disabled:opacity-50 [&_svg]:size-4",
          className,
        )}
        // Keep the caret where it is: a mousedown inside the portal would
        // otherwise blur the textarea before the click ever lands.
        onMouseDown={(event) => {
          event.preventDefault();
          props.onMouseDown?.(event);
        }}
        onClick={(event) => {
          actions.insert(option);
          props.onClick?.(event);
        }}
        onMouseEnter={(event) => {
          if (!option.disabled && index >= 0) actions.setActiveIndex(index);
          props.onMouseEnter?.(event);
        }}
        {...props}
      >
        {children ?? (
          <span className="flex min-w-0 flex-col">
            <span className="truncate">{option.label}</span>
            {option.description ? (
              <span className="truncate text-meta text-muted-foreground">{option.description}</span>
            ) : null}
          </span>
        )}
      </div>
    );
  },
);

export type MentionInputEmptyProps = HTMLAttributes<HTMLDivElement>;

/**
 * The "nothing matches" line. A **sibling** of the listbox, never a child —
 * a `role="listbox"` may only own `option` and `group` children.
 */
export const MentionInputEmpty = forwardRef<HTMLDivElement, MentionInputEmptyProps>(
  function MentionInputEmpty({ className, children, ...props }, ref) {
    const { t } = useLocale();
    const { state } = useMentionInput();
    if (state.filtered.length > 0) return null;

    return (
      <div
        ref={ref}
        data-slot="mention-input-empty"
        className={cn("py-6 text-center text-body text-muted-foreground", className)}
        {...props}
      >
        {children ?? t("noResults")}
      </div>
    );
  },
);
