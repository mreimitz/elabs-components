"use client";

/**
 * TerminalSlashMenu — the console skin's `/`-command palette for the
 * agent-session family (#117, work unit T12, the last unit in the family).
 *
 * The person types `/` at the start of a line and sees the console's own
 * registered commands, narrowed as they keep typing, without ever leaving the
 * composer's `<textarea>` — the same trigger-driven-palette shape
 * `MentionInput` (`@`, `@elabs-ai/components-ui`) and `PromptInputSlash` (`/`,
 * `@elabs-ai/components-ai`) already ship, reproduced here because
 * `@elabs-ai/components-terminal` and `@elabs-ai/components-ai` are layer-2 DAG
 * siblings that may not import each other
 * (`.claude/rules/terminal-components.md` § Reuse means promotion).
 *
 * ## What this wraps, and why it cannot be a compound component
 *
 * `PromptInputSlash` is a Root + `PromptInputSlashTextarea` compound pair,
 * because `PromptInputTextarea` is one interchangeable part of a composable
 * `PromptInput`. `TerminalComposer` (T11) is NOT compound — it is a single,
 * already-landed, already-verified component that owns its whole card (well +
 * mode/effort controls + shortcut footer) and forwards only ONE ref, to its
 * root `TerminalSurface` div. Restructuring it into parts is explicitly out of
 * scope for this unit (a far larger change than a palette needs) — so this
 * component instead RENDERS the whole `TerminalComposer` itself and layers the
 * popover around it, using the one additive prop authorised for this unit:
 * `TerminalComposerProps.textareaRef`, a plain ref to the real `<textarea>`
 * DOM node.
 *
 * ## Reuse — the promoted trigger vocabulary, verbatim
 *
 * `SlashCommand` / `defaultSlashCommandFilter` / `stepIndex`
 * (`lib/slash-command.ts`) and `findTriggerQuery` / `replaceTriggerRun`
 * (`lib/trigger-query.ts`), all `@elabs-ai/components-ui`, are used exactly as
 * shipped — none of the five is re-declared here. `findTriggerQuery` is called
 * with `boundary: "line-start"` (its own doc: `"/help"` opens, `"cd /usr"` does
 * not) — the word-boundary default is `MentionInput`'s rule, not this one's.
 * The trigger run is DERIVED from the composer's committed text + caret on
 * every change, never intercepted at a `/` keydown — see that function's own
 * docblock for why a keydown-driven trigger breaks IME composition, undo,
 * spellcheck and paste.
 *
 * ## `onValueChange`, not `onChange` — a divergence, not a new shape
 *
 * `TerminalComposer` mirrors the native platform (`value`/`onChange`) because
 * it IS a text input. This wrapper cannot: selecting a command must SPLICE
 * `"/" + command.name + " "` over the typed query programmatically, with no
 * real keystroke behind it, so the value channel has to be a plain callback a
 * component can call directly. `PromptInputSlash` already accepted the
 * identical trade for the identical reason (`{ text, caret }`, not a
 * `ChangeEvent`) — this is the same divergence, not a new one invented here.
 * Typing and selection both funnel through this ONE channel (unlike
 * `PromptInputSlash`, whose compound `Textarea` sub-part lets typing bypass
 * the root entirely) because there is no sub-part for typing to bypass
 * through — `TerminalComposer` is monolithic, so this wrapper owns both paths.
 *
 * ## Two DOM writes a React prop seam cannot reach
 *
 * `TerminalComposer` exposes no `onKeyDown`/`aria-*` seam for its internal
 * textarea (only `onChange` and, as of this unit, `textareaRef`). Two things
 * this component needs are therefore done directly on the DOM node the new
 * ref hands back — never via `querySelector` (a selector is for consumers, a
 * ref is for the caret math the T11 handoff named this prop for), never by
 * restructuring `TerminalComposer`:
 *
 * 1. **Arrow/Enter/Escape interception is a raw, capture-phase
 *    `addEventListener`, not a React prop.** `TerminalComposer`'s own
 *    Enter-to-submit and Escape-to-stop run in its private `onKeyDown`, which
 *    does not check `event.defaultPrevented` before firing — so merely
 *    calling `preventDefault()` from a sibling React handler would still let
 *    `commitSubmit()`/`onStop()` fire underneath a selection. A listener
 *    registered directly on the target textarea node runs in the DOM's
 *    AT_TARGET phase, strictly before the native event ever bubbles up to
 *    wherever React's own root listener re-dispatches `TerminalComposer`'s
 *    synthetic `onKeyDown` — so `stopPropagation()` there keeps the native
 *    event from ever reaching React's dispatch at all while the palette is
 *    open, with no risk of a double-fire.
 * 2. **The combobox ARIA quintet (`aria-autocomplete`, `aria-haspopup`,
 *    `aria-controls`, `aria-activedescendant`) is written with
 *    `setAttribute`/`removeAttribute` in a `useLayoutEffect`.** Same reason:
 *    no prop seam exists to pass them through `TerminalComposer`, and they
 *    must land on the exact node screen readers query for combobox state.
 *
 * ## Anchoring — a virtual anchor, not a wrapping div
 *
 * The popover is anchored to the textarea directly via Radix's
 * `PopoverAnchor virtualRef={textareaRef}` (renders no DOM node at all —
 * `@radix-ui/react-popper`'s `Anchor` returns `null` whenever `virtualRef` is
 * given and just republishes that ref's `getBoundingClientRect()` to the
 * popper). This is what makes "anchored to the composer's textarea" literal
 * rather than "anchored to the whole composer card" — no extra wrapping
 * element is needed around anything `TerminalComposer` renders.
 *
 * ## Colour — repainted onto the terminal ground, like `TerminalOverlay`
 *
 * The list is registered-command CONTENT, not app chrome (unlike
 * `TerminalComposer`'s own mode menu, whose `DropdownMenuContent` keeps the
 * ordinary popover tokens because picking an operating mode is chrome, not
 * console output — see that component's module doc). So this popover follows
 * `TerminalOverlay`'s precedent instead: `PopoverContent`'s default
 * `bg-popover`/`text-popover-foreground` (calibrated against `--card`, not
 * `--terminal-background`) is overridden with `bg-terminal-background` /
 * `text-terminal-foreground` / the `code` type role, and its `shadow-ring-md`
 * elevation is left untouched — a floating surface takes a ring rung and never
 * a border (`.claude/rules/styling-and-tokens.md` § Elevation).
 *
 * ## The active row's second channel
 *
 * `aria-selected` already tells assistive tech which row is active.
 * `bg-terminal-selection` alone would be a colour-only visual cue for a
 * SIGHTED user (WCAG 1.4.1) — exactly the failure this package's colour rule
 * calls out. The fix mirrors `TerminalPermission`'s already-reviewed
 * `ACTIVE_OPTION_GLYPH` pattern: a `❯` glyph (this family's established
 * "this one is current" mark) renders only on the active row, in a
 * FIXED-WIDTH reserved slot so the name column never shifts sideways when it
 * appears or disappears — genuine presence/absence, not a colour swapped
 * under a same-width mark. `aria-hidden`, because `aria-selected` already
 * carries the meaning to assistive tech.
 *
 * ## The name column is a grid track, never `ch` arithmetic
 *
 * Per this package's fidelity axis, alignment is a CSS grid track
 * (`grid-cols-[9rem_minmax(0,1fr)]`), not character-count math — the same
 * reason `TerminalRow`'s gutter is a track rather than padding. `minmax(0,
 * 1fr)` on the description column is load-bearing for the same reason it is
 * on `TerminalRow`: a bare `1fr` refuses to shrink below its content and a
 * long description would blow the row out of the popover instead of
 * truncating.
 *
 * ## What upstream's grammar is, and what this deliberately does not add
 *
 * Per the work order: arrow keys wrap at both ends and clamp into a narrowed
 * list (never dangle past the end), Enter selects, Escape closes without
 * selecting. Home/End and Tab-to-select (both present in the ai-package
 * sibling) are deliberately NOT added here — the work order scoped exactly
 * this set, and the promoted `SlashCommand` vocabulary carries no vendor
 * command set or `disabled` state for this component to invent handling for.
 */
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
} from "@elabs-ai/components-ui";
import type { ChangeEvent, ForwardedRef, RefObject } from "react";
import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { TerminalComposer, type TerminalComposerProps } from "./terminal-composer";

const TRIGGER = "/";

/**
 * A structural echo of `@radix-ui/rect`'s `Measurable` (Radix's own
 * `PopoverAnchor virtualRef` type), written locally rather than importing
 * from a Radix internal package this package does not declare as a
 * dependency. `HTMLTextAreaElement` already satisfies this shape — the cast
 * below exists only because `RefObject<Measurable>` is non-nullable while our
 * ref is `RefObject<HTMLTextAreaElement | null>` before the textarea mounts;
 * Radix's own implementation reads `virtualRef?.current` defensively, so a
 * `null` current is handled at runtime regardless of the declared type.
 */
interface Measurable {
  getBoundingClientRect(): DOMRect;
}

/**
 * Merge multiple refs into one callback ref. A private, ~10-line copy rather
 * than a cross-package import — `mergeRefs` lives in `@elabs-ai/components-ui`'s
 * `lib/` but is not exported from its barrel or any subpath today, and adding
 * one is a subpath-export decision this change is not scoped to make
 * (`.claude/rules/component-api.md` § "Subpath exports"). The identical copy
 * already exists in `@elabs-ai/components-ai`'s `prompt-input-slash.tsx` for
 * the exact same reason.
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

export interface TerminalSlashMenuProps extends Omit<
  TerminalComposerProps,
  "value" | "defaultValue" | "onChange"
> {
  /** The registered commands the palette offers. No vendor command set is shipped. */
  commands: SlashCommand[];
  /** The composer's current text. Always controlled — see the module doc for why. */
  value: string;
  /**
   * The text changed — by typing, or by selecting a command (which splices
   * `"/" + command.name + " "` over the typed query and reports the caret
   * that follows it, the same `{ text, caret }` shape `replaceTriggerRun`
   * returns).
   */
  onValueChange: (next: { text: string; caret: number }) => void;
  /** Which commands survive the current query. @default defaultSlashCommandFilter */
  filter?: (command: SlashCommand, query: string) => boolean;
  /** A command was chosen (fires alongside, not instead of, `onValueChange`). */
  onSelectCommand?: (command: SlashCommand) => void;
  /** The popup opened or closed. */
  onOpenChange?: (open: boolean) => void;
}

export const TerminalSlashMenu = forwardRef<HTMLDivElement, TerminalSlashMenuProps>(
  function TerminalSlashMenu(
    {
      commands,
      value,
      onValueChange,
      filter = defaultSlashCommandFilter,
      onSelectCommand,
      onOpenChange,
      textareaRef: textareaRefProp,
      ...composerProps
    },
    ref,
  ) {
    const { t } = useLocale();
    const uid = useId();
    const listId = `${uid}-listbox`;
    const optionId = useCallback((index: number) => `${uid}-option-${index}`, [uid]);

    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const mergedTextareaRef = useMemo(
      () => mergeRefs<HTMLTextAreaElement>(textareaRefProp, textareaRef),
      [textareaRefProp],
    );

    // ------------------------------------------------------------------
    // Caret — tracked from the composer's own DOM, since `TerminalComposer`
    // forwards only `onChange`. `keyup`/`click` are raw listeners for the
    // same reason (mirrors MentionInput's onChange/onSelect/onKeyUp/onClick
    // quartet, minus the two props this composer does not expose).
    // ------------------------------------------------------------------
    const [caret, setCaret] = useState(() => value.length);
    const pendingCaretRef = useRef<number | null>(null);

    const syncCaret = useCallback(() => {
      setCaret(textareaRef.current?.selectionStart ?? 0);
    }, []);

    // Post-commit pass: only after `value` has actually re-rendered into the
    // DOM can the caret be restored (mirrors `MentionInput`/`PromptInputSlash`).
    useLayoutEffect(() => {
      const position = pendingCaretRef.current;
      if (position === null) return;
      pendingCaretRef.current = null;
      textareaRef.current?.setSelectionRange(position, position);
    });

    useEffect(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.addEventListener("keyup", syncCaret);
      el.addEventListener("click", syncCaret);
      return () => {
        el.removeEventListener("keyup", syncCaret);
        el.removeEventListener("click", syncCaret);
      };
    }, [syncCaret]);

    // ------------------------------------------------------------------
    // Query / open state
    // ------------------------------------------------------------------
    const queryInfo = useMemo(
      () => findTriggerQuery(value, caret, TRIGGER, { boundary: "line-start" }),
      [value, caret],
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
    // from before a filter keystroke can never reach the DOM — a re-filter
    // that shortens the list clamps into range in the same commit.
    const activeIndex = useMemo(() => {
      if (filtered.length === 0) return -1;
      if (activeIndexState < 0 || activeIndexState >= filtered.length) return 0;
      return activeIndexState;
    }, [filtered, activeIndexState]);

    useEffect(() => {
      setActiveIndexState(0);
    }, [query]);

    const activeCommand = activeIndex >= 0 ? filtered[activeIndex] : undefined;
    const activeId = activeIndex >= 0 ? optionId(activeIndex) : undefined;

    // ------------------------------------------------------------------
    // The combobox ARIA quintet — no React prop seam reaches the composer's
    // internal textarea, so it is written directly. See the module doc.
    // ------------------------------------------------------------------
    useLayoutEffect(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.setAttribute("aria-autocomplete", "list");
      el.setAttribute("aria-haspopup", "listbox");
      if (open) {
        el.setAttribute("aria-controls", listId);
      } else {
        el.removeAttribute("aria-controls");
      }
      if (activeId) {
        el.setAttribute("aria-activedescendant", activeId);
      } else {
        el.removeAttribute("aria-activedescendant");
      }
    }, [open, listId, activeId]);

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
        onSelectCommand?.(command);
      },
      [queryInfo, value, caret, onValueChange, onSelectCommand],
    );

    const close = useCallback(() => setOpen(false), [setOpen]);

    // ------------------------------------------------------------------
    // Arrow/Enter/Escape interception — a raw, capture-phase listener on the
    // real textarea node. See the module doc for why this cannot be a React
    // `onKeyDown` prop.
    // ------------------------------------------------------------------
    useEffect(() => {
      const el = textareaRef.current;
      if (!el || !open) return;

      const handleKeyDown = (event: KeyboardEvent) => {
        switch (event.key) {
          case "ArrowDown":
            event.preventDefault();
            event.stopPropagation();
            setActiveIndexState(stepIndex(filtered.length, activeIndex, 1));
            return;
          case "ArrowUp":
            event.preventDefault();
            event.stopPropagation();
            setActiveIndexState(stepIndex(filtered.length, activeIndex < 0 ? 0 : activeIndex, -1));
            return;
          case "Enter":
            if (activeCommand) {
              event.preventDefault();
              event.stopPropagation();
              select(activeCommand);
            }
            return;
          case "Escape":
            event.preventDefault();
            event.stopPropagation();
            close();
            return;
          default:
            return;
        }
      };

      el.addEventListener("keydown", handleKeyDown, true);
      return () => el.removeEventListener("keydown", handleKeyDown, true);
    }, [open, filtered.length, activeIndex, activeCommand, select, close]);

    const handleComposerChange = useCallback(
      (event: ChangeEvent<HTMLTextAreaElement>) => {
        syncCaret();
        onValueChange({
          text: event.target.value,
          caret: event.target.selectionStart ?? event.target.value.length,
        });
      },
      [onValueChange, syncCaret],
    );

    return (
      <Popover open={open} onOpenChange={(next) => !next && setOpen(false)}>
        <PopoverAnchor
          // Radix's declared type wants a non-nullable `Measurable`; its own
          // implementation reads `virtualRef?.current` defensively, so a
          // nullable ref (true before the textarea mounts) is safe at runtime.
          virtualRef={textareaRef as unknown as RefObject<Measurable>}
        />
        <TerminalComposer
          {...composerProps}
          ref={ref}
          value={value}
          onChange={handleComposerChange}
          textareaRef={mergedTextareaRef}
        />
        <PopoverContent
          data-slot="terminal-slash-menu-content"
          // A plain container, not a dialog — the listbox inside carries all
          // the semantics (same rationale as `MentionInputContent`/
          // `PromptInputSlash`'s own `PopoverContent`).
          role="presentation"
          align="start"
          side="top"
          sideOffset={8}
          className="w-72 rounded-md bg-terminal-background p-0 text-code font-mono text-terminal-foreground shadow-ring-md"
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
          <div
            id={listId}
            role="listbox"
            aria-label={t("terminal.slashMenu.listLabel")}
            data-slot="terminal-slash-menu-list"
            className="flex max-h-64 flex-col gap-0.5 overflow-y-auto p-1"
          >
            {filtered.map((command, index) => {
              const isActive = index === activeIndex;
              return (
                <div
                  key={command.name}
                  id={optionId(index)}
                  role="option"
                  aria-selected={isActive}
                  data-slot="terminal-slash-menu-item"
                  data-active={isActive || undefined}
                  className={cn(
                    "grid cursor-pointer select-none grid-cols-[9rem_minmax(0,1fr)] items-baseline gap-x-3 rounded-sm px-2 py-1.5",
                    isActive && "bg-terminal-selection",
                  )}
                  // Keep the caret where it is: a mousedown inside the portal
                  // would otherwise blur the textarea before the click lands
                  // (same rationale as `MentionInputItem`/`PromptInputCommandItem`).
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => select(command)}
                >
                  <span className="flex min-w-0 items-center gap-1 truncate">
                    {/*
                     * The active marker: reserved fixed width so its presence
                     * or absence never shifts the name text sideways — see
                     * the module doc "The active row's second channel".
                     * `aria-hidden`: `aria-selected` above already carries
                     * this to assistive tech.
                     */}
                    <span
                      aria-hidden="true"
                      className="inline-block w-3 shrink-0 text-terminal-accent"
                    >
                      {isActive ? "❯" : null}
                    </span>
                    {command.icon ? (
                      <span
                        aria-hidden="true"
                        className="flex shrink-0 items-center text-terminal-muted [&_svg]:size-4"
                      >
                        {command.icon}
                      </span>
                    ) : null}
                    <span className="truncate">
                      {TRIGGER}
                      {command.name}
                    </span>
                  </span>
                  {/*
                   * `--terminal-selection` is only guaranteed AA for
                   * `--terminal-foreground` (9.80:1) and `--terminal-ansi-white`
                   * (6.09:1) — see that token's own comment in `themes.css`.
                   * `--terminal-muted` (authored against `--terminal-background`)
                   * measures 3.61:1 on the selection band, a real axe failure a
                   * unit test cannot see (jsdom computes no contrast). The
                   * active row upgrades to `--terminal-foreground`; only the
                   * resting rows keep the muted ink.
                   */}
                  <span
                    className={cn(
                      "truncate",
                      isActive ? "text-terminal-foreground" : "text-terminal-muted",
                    )}
                  >
                    {command.description}
                  </span>
                </div>
              );
            })}
          </div>
          {filtered.length === 0 ? (
            // A SIBLING of the listbox, never a child — a `role="listbox"`
            // may only own `option`/`group` children (same rationale as
            // `MentionInputEmpty`). Reuses the generic `noResults` key
            // (`MentionInputEmpty`'s own default) rather than minting a new
            // one — this package's own reuse rule prefers a generic key.
            <div
              data-slot="terminal-slash-menu-empty"
              className="px-3 py-2 text-meta text-terminal-muted"
            >
              {t("noResults")}
            </div>
          ) : null}
        </PopoverContent>
      </Popover>
    );
  },
);

TerminalSlashMenu.displayName = "TerminalSlashMenu";
