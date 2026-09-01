"use client";

/**
 * PromptInputSlash — a slash-command palette for the chat composer.
 *
 * Reuses the generic trigger machinery `@elabs-ai/components-ui` ships at
 * `lib/trigger-query.ts` (`findTriggerQuery` / `replaceTriggerRun`) with
 * `trigger: "/"` and `boundary: "line-start"` — the same algorithm
 * `MentionInput` runs with `trigger: "@"` and the `"word"` boundary. See
 * docs/decisions/2026-09-01-brainless-adoption-architecture.md § 5: this
 * package NEVER re-implements trigger detection, and never imports the
 * markdown-scoped slash menu in `@elabs-ai/components-editor` (that would be
 * a sideways edge in the one-way dependency graph).
 *
 * Rendering goes through the existing `PromptInputCommand*` parts (thin
 * `cmdk` wrappers), controlled rather than driven by `cmdk`'s own keyboard
 * handling — the caret must stay in the composer's `<textarea>` the whole
 * time, so every keystroke (Arrow/Home/End/Enter/Escape) is intercepted on
 * the textarea itself and only the *highlighted* `value` is pushed into
 * `PromptInputCommand`. `aria-activedescendant` is read back via
 * `PromptInputCommand`'s existing `onActiveItemIdChange` seam (the doc-block
 * on `PromptInputCommandItem` names this exact composition) rather than by
 * guessing a DOM id — `cmdk` assigns each item's `id` internally and
 * overwrites any id a consumer passes.
 *
 * `SlashCommand`, `defaultSlashCommandFilter` and the index-stepping helper
 * (`stepIndex`, formerly this file's private `step`) are promoted to
 * `@elabs-ai/components-ui` (T0 — the terminal CLI look-alike family's own
 * palette, issue #117, reuses the same model; `ui` is the one legal shared
 * home for two layer-2 DAG siblings — see
 * docs/decisions/2026-09-01-brainless-adoption-architecture.md § 4).
 */
import {
  createContext,
  forwardRef,
  use,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ForwardedRef,
  type HTMLAttributes,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  type RefObject,
} from "react";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
  cn,
  defaultSlashCommandFilter,
  findTriggerQuery,
  replaceTriggerRun,
  stepIndex,
  useLocale,
  type SlashCommand,
  type TriggerBoundary,
} from "@elabs-ai/components-ui";

import {
  PromptInputCommand,
  PromptInputCommandEmpty,
  PromptInputCommandItem,
  PromptInputCommandList,
  PromptInputTextarea,
  type PromptInputTextareaProps,
} from "./prompt-input";

const TRIGGER = "/";

// ---------------------------------------------------------------------------
// Small local helpers (deliberately NOT shared — see the doc-comments below)
// ---------------------------------------------------------------------------

/**
 * Merge multiple refs into one callback ref. A private, ~10-line copy rather
 * than a cross-package import: `mergeRefs` lives in `@elabs-ai/components-ui`'s
 * `lib/` but is not exported from its barrel or any subpath today, and adding
 * one is a subpath-export decision this change is not scoped to make (see
 * `.claude/rules/component-api.md` § "Subpath exports"). Ordinary React
 * ref-composition boilerplate, not the trigger algorithm this file exists to
 * avoid re-implementing.
 */
type MaybeRef<T> = ForwardedRef<T> | undefined;

// prettier-ignore
function mergeRefs<T>(
  ...refs: Array<MaybeRef<T>>
) {
  return (node: T | null) => {
    for (const ref of refs) {
      if (typeof ref === "function") ref(node);
      else if (ref) (ref as { current: T | null }).current = node;
    }
  };
}

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------
//
// `SlashCommand` and `defaultSlashCommandFilter` moved to
// `@elabs-ai/components-ui` (`lib/slash-command.ts`) — see the promotion
// note at the top of this file.

export interface PromptInputSlashProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  "onSelect" | "children"
> {
  /** The registered commands the palette offers. */
  commands: SlashCommand[];
  /** The composer's current text — must match what the wrapped textarea renders. */
  value: string;
  /** Ref to the composer's `<textarea>` (usually the one `PromptInputSlashTextarea` renders). */
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  /**
   * Only trigger at the start of a line (index 0, or right after `"\n"`).
   * `false` falls back to `MentionInput`'s word-boundary rule.
   * @default true
   */
  lineStartOnly?: boolean;
  /** Which commands survive the current query. @default defaultSlashCommandFilter */
  filter?: (command: SlashCommand, query: string) => boolean;
  /**
   * A command was chosen — apply the spliced `{ text, caret }` to your own
   * controlled value (the same shape `replaceTriggerRun` returns). The
   * splice inserts `"/" + command.name + " "` in place of the typed query.
   */
  onValueChange: (next: { text: string; caret: number }) => void;
  /** A command was chosen (fires alongside, not instead of, `onValueChange`). */
  onSelect?: (command: SlashCommand) => void;
  /** The popup opened or closed. */
  onOpenChange?: (open: boolean) => void;
  children: ReactNode;
}

// ---------------------------------------------------------------------------
// Wiring context — private plumbing between the root and its `Textarea` part
// (component-api.md: "compound components share a context, not props").
// ---------------------------------------------------------------------------

interface PromptInputSlashWiring {
  open: boolean;
  /**
   * The REAL DOM id `cmdk` assigned to the listbox, read back off the
   * rendered node — `cmdk`'s `CommandList` forces its own internally
   * generated `id` after spreading consumer props (the same override
   * `CMDK_OVERRIDDEN_ITEM_PROPS` documents for `CommandItem`), so a
   * self-minted id passed as a prop is silently dropped.
   */
  listDomId?: string;
  /** DOM id of the highlighted `PromptInputCommandItem`, from `onActiveItemIdChange`. */
  activeId?: string;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  syncCaret: (element: HTMLTextAreaElement) => void;
  onKeyDown: (event: ReactKeyboardEvent<HTMLTextAreaElement>) => void;
}

const PromptInputSlashWiringContext = createContext<PromptInputSlashWiring | null>(null);

// ---------------------------------------------------------------------------
// PromptInputSlash (root — provider + Popover, mirrors MentionInput's shape)
// ---------------------------------------------------------------------------

/**
 * PromptInputSlash — wrap the composer's textarea (rendered via
 * `PromptInputSlashTextarea`) to add a `/`-triggered command palette.
 *
 * ```tsx
 * const textareaRef = useRef<HTMLTextAreaElement>(null);
 * const [text, setText] = useState("");
 *
 * <PromptInputSlash
 *   commands={commands}
 *   value={text}
 *   textareaRef={textareaRef}
 *   onValueChange={({ text }) => setText(text)}
 * >
 *   <PromptInputSlashTextarea value={text} onChange={(e) => setText(e.target.value)} />
 * </PromptInputSlash>
 * ```
 */
export const PromptInputSlash = forwardRef<HTMLDivElement, PromptInputSlashProps>(
  function PromptInputSlash(
    {
      commands,
      value,
      textareaRef,
      lineStartOnly = true,
      filter = defaultSlashCommandFilter,
      onValueChange,
      onSelect,
      onOpenChange,
      className,
      children,
      ...props
    },
    ref,
  ) {
    const { t } = useLocale();

    const rootRef = useRef<HTMLDivElement>(null);
    const mergedRootRef = useMemo(() => mergeRefs<HTMLDivElement>(ref, rootRef), [ref]);

    // ------------------------------------------------------------------
    // Caret — tracked from the wrapped textarea's own DOM events, exactly
    // like `MentionInput`'s `syncCaret`/`applyCaret` pair.
    // ------------------------------------------------------------------
    const [caret, setCaret] = useState(() => value.length);
    const pendingCaretRef = useRef<number | null>(null);

    const syncCaret = useCallback((element: HTMLTextAreaElement) => {
      setCaret(element.selectionStart ?? 0);
    }, []);

    // Post-commit pass: only after `value` has actually re-rendered into the
    // DOM can the caret be restored — see MentionInput's identical comment.
    useLayoutEffect(() => {
      const position = pendingCaretRef.current;
      if (position === null) return;
      pendingCaretRef.current = null;
      // `setSelectionRange` fires a native `select` event, which
      // `PromptInputSlashTextarea`'s `onSelect` handler already routes to
      // `syncCaret` — no need to call `setCaret` here too (mirrors
      // `MentionInput`'s identical caret-restore effect).
      textareaRef.current?.setSelectionRange(position, position);
    });

    // ------------------------------------------------------------------
    // Query / open state
    // ------------------------------------------------------------------
    const boundary: TriggerBoundary = lineStartOnly ? "line-start" : "word";

    const queryInfo = useMemo(
      () => findTriggerQuery(value, caret, TRIGGER, { boundary }),
      [value, caret, boundary],
    );

    // Escape (and an outside dismissal) suppress the popup for the run it was
    // dismissed on, without touching the text — same rationale as MentionInput.
    const [dismissedStart, setDismissedStart] = useState<number | null>(null);
    useEffect(() => {
      if (queryInfo === null && dismissedStart !== null) setDismissedStart(null);
    }, [queryInfo, dismissedStart]);

    const open = queryInfo !== null && dismissedStart !== queryInfo.start;
    const query = open && queryInfo ? queryInfo.query : null;

    const setOpen = useCallback(
      (next: boolean) => {
        onOpenChange?.(next);
        if (!next) setDismissedStart(queryInfo?.start ?? null);
      },
      [onOpenChange, queryInfo],
    );

    // ------------------------------------------------------------------
    // Filtering + highlight
    // ------------------------------------------------------------------
    const filtered = useMemo(
      () => (query !== null ? commands.filter((command) => filter(command, query)) : []),
      [query, commands, filter],
    );

    const [activeIndexState, setActiveIndexState] = useState(0);

    // Resolved DURING render, never repaired in an effect, so a stale index
    // from before a filter keystroke can never reach the DOM — see the
    // identical rationale in `MentionInput`'s `activeIndex` docblock.
    const activeIndex = useMemo(() => {
      if (filtered.length === 0) return -1;
      if (activeIndexState < 0 || activeIndexState >= filtered.length) return 0;
      return activeIndexState;
    }, [filtered, activeIndexState]);

    useEffect(() => {
      setActiveIndexState(0);
    }, [query]);

    const activeCommand = activeIndex >= 0 ? filtered[activeIndex] : undefined;
    const [activeDomId, setActiveDomId] = useState<string | undefined>(undefined);

    // The listbox lives inside `PopoverContent`, which UNMOUNTS on close — its
    // `onActiveItemIdChange` never fires again to report "no active item", so
    // without this the textarea would keep pointing `aria-activedescendant`
    // at a node that no longer exists.
    useEffect(() => {
      if (!open) setActiveDomId(undefined);
    }, [open]);

    // The REAL DOM id `cmdk` assigns to the listbox (see `listDomId`'s
    // docblock on `PromptInputSlashWiring`) — read off the rendered node
    // rather than trusted from a prop we pass in, since `cmdk` overwrites it.
    const [listDomId, setListDomId] = useState<string | undefined>(undefined);
    const handleListRef = useCallback((node: HTMLDivElement | null) => {
      setListDomId(node?.id);
    }, []);

    // `PromptInputCommand` is controlled (`value=`), so `cmdk`'s own pointer
    // hover / mount-time auto-select report back here instead of self-applying
    // — keep mouse and keyboard highlighting as one source of truth.
    const handleActiveValueChange = useCallback(
      (nextValue: string) => {
        const index = filtered.findIndex((command) => command.name === nextValue);
        if (index >= 0) setActiveIndexState(index);
      },
      [filtered],
    );

    // ------------------------------------------------------------------
    // Actions
    // ------------------------------------------------------------------
    const select = useCallback(
      (command: SlashCommand) => {
        if (!queryInfo) return;
        const insertText = `${TRIGGER}${command.name} `;
        const result = replaceTriggerRun(value, queryInfo.start, caret, insertText);
        pendingCaretRef.current = result.caret;
        onValueChange(result);
        onSelect?.(command);
      },
      [queryInfo, value, caret, onValueChange, onSelect],
    );

    const close = useCallback(() => setOpen(false), [setOpen]);

    const handleKeyDown = useCallback(
      (event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
        if (!open) return;
        switch (event.key) {
          case "ArrowDown":
            event.preventDefault();
            setActiveIndexState(stepIndex(filtered.length, activeIndex, 1));
            return;
          case "ArrowUp":
            event.preventDefault();
            setActiveIndexState(stepIndex(filtered.length, activeIndex < 0 ? 0 : activeIndex, -1));
            return;
          case "Home":
            event.preventDefault();
            setActiveIndexState(0);
            return;
          case "End":
            event.preventDefault();
            setActiveIndexState(filtered.length - 1);
            return;
          case "Enter":
          case "Tab": {
            if (activeCommand) {
              event.preventDefault();
              select(activeCommand);
            }
            return;
          }
          case "Escape":
            event.preventDefault();
            close();
            textareaRef.current?.focus();
            return;
          default:
            return;
        }
      },
      [open, filtered.length, activeIndex, activeCommand, select, close, textareaRef],
    );

    const wiring = useMemo<PromptInputSlashWiring>(
      () => ({
        open,
        listDomId,
        activeId: activeDomId,
        textareaRef,
        syncCaret,
        onKeyDown: handleKeyDown,
      }),
      [open, listDomId, activeDomId, textareaRef, syncCaret, handleKeyDown],
    );

    return (
      <PromptInputSlashWiringContext value={wiring}>
        <Popover open={open} onOpenChange={(next) => !next && setOpen(false)}>
          <PopoverAnchor asChild>
            <div
              ref={mergedRootRef}
              data-slot="prompt-input-slash"
              className={cn("relative", className)}
              {...props}
            >
              {children}
            </div>
          </PopoverAnchor>
          <PopoverContent
            data-slot="prompt-input-slash-content"
            // A plain container, not a dialog — the listbox inside carries all
            // the semantics (same rationale as `MentionInputContent`).
            role="presentation"
            align="start"
            side="top"
            sideOffset={8}
            className="w-72 p-0"
            onOpenAutoFocus={(event) => event.preventDefault()}
            onCloseAutoFocus={(event) => event.preventDefault()}
            onPointerDownOutside={(event) => {
              // Clicking the field itself only moves the caret; it must not
              // count as a dismissal, or the popup would fight the caret it
              // depends on (same rationale as `MentionInputContent`).
              const target = event.detail.originalEvent.target as Node | null;
              if (target && textareaRef.current?.contains(target)) event.preventDefault();
            }}
          >
            <PromptInputCommand
              shouldFilter={false}
              value={activeCommand?.name ?? ""}
              onValueChange={handleActiveValueChange}
              onActiveItemIdChange={setActiveDomId}
              data-slot="prompt-input-slash-command"
            >
              <PromptInputCommandList
                ref={handleListRef}
                // `cmdk`'s `CommandList` reads its accessible name off its own
                // `label` prop (defaulting to "Suggestions"), not `aria-label`
                // — an `aria-label` prop would land in the spread `cmdk`
                // overwrites, same as the `id` it also owns.
                label={t("ai.promptInputSlash.listLabel")}
                data-slot="prompt-input-slash-list"
              >
                {filtered.length === 0 ? (
                  <PromptInputCommandEmpty data-slot="prompt-input-slash-empty">
                    {t("ai.promptInputSlash.empty")}
                  </PromptInputCommandEmpty>
                ) : (
                  filtered.map((command) => (
                    <PromptInputCommandItem
                      key={command.name}
                      value={command.name}
                      data-slot="prompt-input-slash-item"
                      onSelect={() => select(command)}
                      // The field keeps focus — select on mousedown, before a
                      // click on a non-focusable row could ever move it.
                      onMouseDown={(event) => event.preventDefault()}
                    >
                      {command.icon ? (
                        <span
                          aria-hidden="true"
                          className="flex size-5 shrink-0 items-center justify-center text-muted-foreground [&_svg]:size-4"
                        >
                          {command.icon}
                        </span>
                      ) : null}
                      {/* Fixed-width name column: the selection moving never
                          shifts the description text under the user's eyes. */}
                      <span className="w-28 shrink-0 truncate text-body">
                        {TRIGGER}
                        {command.name}
                      </span>
                      {command.description ? (
                        <span className="truncate text-meta text-muted-foreground">
                          {command.description}
                        </span>
                      ) : null}
                    </PromptInputCommandItem>
                  ))
                )}
              </PromptInputCommandList>
            </PromptInputCommand>
          </PopoverContent>
        </Popover>
      </PromptInputSlashWiringContext>
    );
  },
);

// ---------------------------------------------------------------------------
// PromptInputSlashTextarea
// ---------------------------------------------------------------------------

export type PromptInputSlashTextareaProps = PromptInputTextareaProps;

/**
 * The composer's `<textarea>`, carrying the combobox semantics the palette
 * needs. A thin wrapper around `PromptInputTextarea` — every prop you'd pass
 * that component still works; this one additionally merges in the palette's
 * `ref`, caret tracking and `aria-activedescendant`.
 *
 * Must be rendered inside a `<PromptInputSlash>`.
 */
export const PromptInputSlashTextarea = forwardRef<
  HTMLTextAreaElement,
  PromptInputSlashTextareaProps
>(function PromptInputSlashTextarea(
  { onChange, onKeyDown, onSelect, onKeyUp, onClick, className, ...props },
  ref,
) {
  const wiring = use(PromptInputSlashWiringContext);
  if (!wiring) {
    throw new Error("PromptInputSlashTextarea must be used inside a <PromptInputSlash>.");
  }
  const mergedRef = useMemo(
    () => mergeRefs<HTMLTextAreaElement>(ref, wiring.textareaRef),
    [ref, wiring.textareaRef],
  );

  return (
    <PromptInputTextarea
      ref={mergedRef}
      data-slot="prompt-input-slash-textarea"
      aria-autocomplete="list"
      aria-haspopup="listbox"
      // Only while the popup is mounted: the listbox lives in a Radix portal
      // that unmounts on close, and an `aria-controls` pointing at a removed
      // node is a dangling reference (same rationale as `MentionInputTextarea`).
      aria-controls={wiring.open ? wiring.listDomId : undefined}
      aria-activedescendant={wiring.activeId}
      className={cn("relative z-0", className)}
      {...props}
      onChange={(event) => {
        wiring.syncCaret(event.currentTarget);
        onChange?.(event);
      }}
      onKeyDown={(event) => {
        wiring.onKeyDown(event);
        onKeyDown?.(event);
      }}
      onSelect={(event) => {
        wiring.syncCaret(event.currentTarget);
        onSelect?.(event);
      }}
      onKeyUp={(event) => {
        wiring.syncCaret(event.currentTarget);
        onKeyUp?.(event);
      }}
      onClick={(event) => {
        wiring.syncCaret(event.currentTarget);
        onClick?.(event);
      }}
    />
  );
});
