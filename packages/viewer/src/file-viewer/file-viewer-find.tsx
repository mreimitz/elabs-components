"use client";

/**
 * Find-in-document — the viewer's own Ctrl/Cmd+F.
 *
 * It paints through the SAME highlight layer citations use (`source: "search"`),
 * so a document never grows two mark systems that disagree about what a mark
 * looks like. Only which one is CURRENT differs, and that lives on its own knob
 * (`find.activeIndex`) so an app controlling citations does not have to honour
 * every keystroke of a search it never asked for.
 *
 * **Not a `role="toolbar"`.** A toolbar is one tab stop with roving arrow keys,
 * and an `<input>` inside one has its Left/Right stolen from the caret. This is
 * `role="search"` — the same call `FileViewerToolbar` already made.
 */

import {
  cn,
  IconButton,
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  Separator,
  useLocale,
} from "@elabs-ai/components-ui";
import { CaseSensitiveIcon, ChevronDownIcon, ChevronUpIcon, SearchIcon, XIcon } from "lucide-react";
import {
  forwardRef,
  useEffect,
  useRef,
  type HTMLAttributes,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";

import { FIND_MATCH_LIMIT } from "../core/highlight";
import { useFileViewer } from "./file-viewer-context";

/** Whether a keyboard event is the platform's find shortcut. */
export function isFindShortcut(event: {
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
}): boolean {
  // Either modifier, not `navigator.platform`: a Mac driven by an external PC
  // keyboard sends Ctrl, and sniffing the platform gets that reader wrong.
  return event.key.toLowerCase() === "f" && (event.metaKey || event.ctrlKey);
}

export type FileViewerFindProps = HTMLAttributes<HTMLDivElement>;

/**
 * The search row. Renders nothing until `actions.openFind()` (or Ctrl/Cmd+F on
 * the frame) opens it, and nothing at all for a document whose adapter cannot
 * paint a range — an affordance that could never highlight anything is worse
 * than no affordance at all.
 */
export const FileViewerFind = forwardRef<HTMLDivElement, FileViewerFindProps>(
  function FileViewerFind({ className, ...props }, ref) {
    const { state, actions, meta } = useFileViewer();
    const { t, formatNumber } = useLocale();
    const input = useRef<HTMLInputElement>(null);
    const find = state.find;
    const open = find.open && meta.canFind;
    const { registerFind } = actions;

    // Announce that there IS somewhere to type. The frame only takes Ctrl/Cmd+F
    // away from the browser once this has run — a shortcut swallowed with no box
    // to show leaves a keyboard reader with no find at all. Registered on mount
    // rather than when open, because the box is closed at exactly the moment the
    // shortcut has to be decided.
    useEffect(() => registerFind(), [registerFind]);

    // A find box that does not take the caret sends the next keystroke to the
    // document behind it — the one thing every reader expects not to happen.
    useEffect(() => {
      if (open) input.current?.focus();
    }, [open]);

    if (!open) return null;

    const hasQuery = find.query.length > 0;
    const hasMatches = find.matches > 0;

    const onKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Escape") {
        event.preventDefault();
        // Stopped here: an Escape meant for the find box must not also close a
        // Dialog the viewer happens to be sitting in.
        event.stopPropagation();
        actions.closeFind();
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        if (event.shiftKey) actions.previousFindMatch();
        else actions.nextFindMatch();
      }
    };

    return (
      <div
        ref={ref}
        data-slot="file-viewer-find"
        role="search"
        aria-label={t("viewer.find.label")}
        className={cn(
          // The divider is the only cue between this row and the content below
          // it — same fill, no elevation change (WCAG 1.4.11, strong rung).
          "border-border-strong flex shrink-0 items-center gap-2 border-b px-3 py-2",
          className,
        )}
        {...props}
      >
        <InputGroup className="h-8 max-w-72">
          <InputGroupAddon>
            <SearchIcon aria-hidden="true" />
          </InputGroupAddon>
          <InputGroupInput
            ref={input}
            // Not `type="search"`: the browser's own clear affordance is
            // unlabelled and unthemeable, and this row already carries a close
            // control that does something more useful.
            type="text"
            value={find.query}
            aria-label={t("viewer.find.label")}
            placeholder={t("viewer.find.placeholder")}
            autoComplete="off"
            spellCheck={false}
            onChange={(event) => actions.setFindQuery(event.target.value)}
            onKeyDown={onKeyDown}
          />
          <InputGroupAddon align="inline-end">
            {/* A real toggle button, so the state is announced rather than
                inferred from a colour change. */}
            <InputGroupButton
              size="icon-xs"
              aria-pressed={find.caseSensitive}
              aria-label={t("viewer.find.caseSensitive")}
              title={t("viewer.find.caseSensitive")}
              onClick={() => actions.setFindCaseSensitive(!find.caseSensitive)}
            >
              <CaseSensitiveIcon aria-hidden="true" />
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>

        {/* ONE live region for the whole result state: "3 of 12" and "No
            matches" replace each other rather than sitting side by side, so a
            fruitless search never reads as "0 of 0". */}
        <span
          role="status"
          aria-live="polite"
          className="text-meta text-muted-foreground min-w-0 flex-1 truncate tabular-nums"
        >
          {!hasQuery
            ? null
            : hasMatches
              ? t("viewer.find.count", {
                  index: formatNumber(find.activeIndex + 1),
                  total: formatNumber(Math.min(find.matches, FIND_MATCH_LIMIT)),
                })
              : t("viewer.find.none")}
          {find.truncated
            ? ` ${t("viewer.find.capped", {
                limit: formatNumber(FIND_MATCH_LIMIT),
                total: formatNumber(find.matches),
              })}`
            : null}
        </span>

        {/* `aria-disabled`, never the native attribute: a focused control that
            becomes `disabled` is dropped from the focus order, so a reader who
            tabbed to Next and then cleared the query would have focus silently
            fall to <body>. The actions are the real guard — both no-op with no
            matches (see interaction-guidelines.md). */}
        <IconButton
          variant="ghost"
          size="icon-sm"
          aria-disabled={!hasMatches}
          label={t("viewer.find.previous")}
          icon={<ChevronUpIcon aria-hidden="true" />}
          onClick={actions.previousFindMatch}
        />
        <IconButton
          variant="ghost"
          size="icon-sm"
          aria-disabled={!hasMatches}
          label={t("viewer.find.next")}
          icon={<ChevronDownIcon aria-hidden="true" />}
          onClick={actions.nextFindMatch}
        />
        <Separator orientation="vertical" className="h-4" />
        <IconButton
          variant="ghost"
          size="icon-sm"
          label={t("viewer.find.close")}
          icon={<XIcon aria-hidden="true" />}
          onClick={actions.closeFind}
        />
      </div>
    );
  },
);
