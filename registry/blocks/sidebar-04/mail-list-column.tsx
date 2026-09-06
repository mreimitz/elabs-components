/**
 * Zone 2 of three — the message list. The column that answers "which message am
 * I looking at"; the reading pane beside it answers "what does it say".
 *
 * Two things here are load-bearing and easy to lose when copying:
 *
 * 1. **Every row is a real `<a href>`**, not a button. A message has a URL —
 *    people ⌘-click it into a tab, middle-click it, copy the link, land on it
 *    from a search result. The click handler intercepts ONLY an unmodified
 *    primary click, so every one of those browser behaviours still works. Swap
 *    the `<a>` for your router's `<Link>` and delete the handler's
 *    `preventDefault` branch.
 * 2. **Unread is never colour alone.** The dot is a graphical mark, so it uses a
 *    STATUS tone (guaranteed >= 3:1 on every surface it can land on) rather than
 *    `--primary`, which carries no such guarantee — but the dot is not the
 *    channel that matters. The subject also goes semibold, and the row carries
 *    an `sr-only` "Unread" word folded into its accessible name, so the state
 *    survives greyscale AND reaches assistive tech.
 */
"use client";

import { useId, useMemo, useState, type ComponentProps } from "react";
import { Inbox, SearchX } from "lucide-react";
import { Button, cn, Skeleton, StatePanel } from "@elabs-ai/components-ui";
import { SearchInput } from "@elabs-ai/components-data";
import { formatDay, messageHref, type MailMessage } from "./messages";

export interface MailListColumnProps extends Omit<ComponentProps<"aside">, "onSelect"> {
  messages: MailMessage[];
  /** Id of the message the reading pane is showing. */
  selectedId?: string;
  /** Called with the id of the row that was opened. */
  onSelect?: (id: string) => void;
  /** No renderable content yet — renders layout-shaped skeleton rows. */
  loading?: boolean;
  /** Zone heading — the mailbox this list is showing. @default "Inbox" */
  heading?: string;
}

export function MailListColumn({
  messages,
  selectedId,
  onSelect,
  loading = false,
  heading = "Inbox",
  className,
  ...props
}: MailListColumnProps) {
  const headingId = useId();
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return messages;
    return messages.filter(
      (message) =>
        message.subject.toLowerCase().includes(needle) ||
        message.from.name.toLowerCase().includes(needle) ||
        message.preview.toLowerCase().includes(needle),
    );
  }, [messages, query]);

  return (
    <aside
      data-slot="mail-list-column"
      // A real landmark, labelled by its own visible heading, so a screen-reader
      // user can jump between "the list" and "the message" instead of walking
      // the whole shell.
      aria-labelledby={headingId}
      // Below `md` the shell is a drill-down rather than two columns: this zone
      // takes the whole width until a message is open, and hands it over when
      // one is. The hide is scoped INSIDE `max-md:` rather than left to fight
      // `md:flex` in the cascade — an earlier revision wrote
      // `group-data-[reading=open]/mail:hidden md:flex` and asserted that `md:`
      // won. It does not: measured at a 1200px viewport with a message open,
      // this element computed `display: none`, i.e. the desktop three-zone
      // layout silently lost its middle zone. Tailwind v4 sorts the
      // `group-data-*` variant AFTER the `md` breakpoint, so the two rules have
      // equal specificity and the LAST one wins. Nesting the hide in a
      // `max-md:` media query removes the contest: above `md` the rule does not
      // exist at all.
      //
      // The trailing rule is the SOLE structural cue between two same-ground
      // zones, so it takes the strong rung (WCAG 1.4.11).
      className={cn(
        "flex min-w-0 flex-1 flex-col border-e border-border-strong bg-background",
        "max-md:group-data-[reading=open]/mail:hidden md:w-80 md:flex-none",
        className,
      )}
      {...props}
    >
      {/* Matches the top bar's 3.5rem row so the two zones share one horizon. */}
      <div className="flex h-14 shrink-0 items-center gap-2 border-b border-border-strong px-3">
        <h2 id={headingId} className="min-w-0 truncate text-subtitle text-foreground">
          {heading}
        </h2>
        <span className="ms-auto shrink-0 text-meta tabular-nums text-muted-foreground">
          {messages.length}
        </span>
      </div>

      <div className="shrink-0 px-3 py-2">
        <SearchInput
          value={query}
          onValueChange={setQuery}
          label="Search messages"
          placeholder="Search messages…"
        />
      </div>

      {loading ? (
        <div
          role="status"
          aria-live="polite"
          className="flex min-h-0 flex-1 flex-col gap-1 overflow-hidden px-2 pb-2"
        >
          <span className="sr-only">Loading messages…</span>
          {/* Layout-shaped: the same box a real row occupies, so nothing jumps
              when the data lands. */}
          {Array.from({ length: 7 }, (_, index) => (
            <Skeleton key={index} className="h-20 w-full" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {/* Two different empties, two different ways OUT — an empty state that
              names the absence and stops there leaves the reader stuck in the
              state it is describing. Filtered: the way out is the search box, so
              the action clears it (and really does, in-block). Nothing at all:
              there is no action to offer, so it says what will appear here
              instead of inventing a button. Each carries its own glyph, because
              "your search is too narrow" and "this mailbox is empty" are
              different news. */}
          {query ? (
            <StatePanel
              kind="empty"
              icon={<SearchX aria-hidden="true" />}
              title="Nothing matches that search"
              description="Try a shorter word, or clear the search to see every message."
              actions={
                // NOT "Clear search": `SearchInput` already ships an icon
                // button with exactly that accessible name a few pixels above,
                // and two controls with one name in one view is ambiguous to
                // anyone navigating by name. This one says what happens.
                <Button variant="outline" size="sm" onClick={() => setQuery("")}>
                  Show every message
                </Button>
              }
            />
          ) : (
            <StatePanel
              kind="empty"
              icon={<Inbox aria-hidden="true" />}
              title="Nothing here"
              description="New messages in this mailbox will show up in this list."
            />
          )}
        </div>
      ) : (
        <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto px-2 pb-2">
          {filtered.map((message) => {
            const selected = message.id === selectedId;
            return (
              <li key={message.id}>
                <a
                  href={messageHref(message.id)}
                  // The selection is ANNOUNCED, not merely tinted —
                  // `aria-current="page"` is the non-colour channel that
                  // survives greyscale and reaches assistive tech.
                  aria-current={selected ? "page" : undefined}
                  onClick={(event) => {
                    // Intercept only the click a router would intercept. A
                    // ⌘/Ctrl-click, a shift-click or a middle click must keep
                    // the browser's own meaning — that is the whole reason this
                    // row is an anchor and not a button. Delete this block when
                    // you swap in your framework's <Link>.
                    if (event.defaultPrevented) return;
                    if (event.button !== 0) return;
                    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                    event.preventDefault();
                    onSelect?.(message.id);
                  }}
                  className={cn(
                    "flex w-full flex-col gap-0.5 rounded-md px-2 py-2 text-start",
                    // Clipped by the scroll port above, so the inset rung.
                    "focus-ring-inset",
                    // The rail is reserved on EVERY row (transparent when the
                    // row is not the selection) so lighting it up shifts no
                    // text. Without it, hover and selection paint the same fill
                    // and a pointer makes every row look chosen.
                    "border-s-2 border-s-transparent",
                    "hover:bg-accent hover:text-accent-foreground",
                    selected && "border-s-primary bg-accent text-accent-foreground",
                  )}
                >
                  <span className="flex w-full items-center gap-2">
                    {/* The mark, and only the mark: the row's real unread
                        channels are the semibold subject and the `sr-only` word
                        below. `bg-info` because a colour-only shape must clear
                        3:1 on every surface it can land on and only the status
                        tones carry that guarantee. The reserved box keeps read
                        and unread rows on the same grid. */}
                    <span
                      aria-hidden="true"
                      className={cn(
                        "size-2 shrink-0 rounded-full",
                        message.unread ? "bg-info" : "bg-transparent",
                      )}
                    />
                    <span
                      className={cn(
                        "min-w-0 flex-1 truncate text-body",
                        message.unread ? "font-semibold" : "font-normal",
                      )}
                    >
                      {message.from.name}
                    </span>
                    <time
                      dateTime={message.receivedAt}
                      className="shrink-0 text-meta tabular-nums text-muted-foreground"
                    >
                      {formatDay(message.receivedAt)}
                    </time>
                  </span>
                  <span
                    className={cn(
                      "truncate ps-4 text-body",
                      message.unread ? "font-semibold text-foreground" : "font-normal",
                    )}
                  >
                    {message.subject}
                  </span>
                  {/* `caption`, not `meta`. This line is a fragment of the
                      message itself — prose, not a label — and the scale
                      already has a rung for exactly that: `caption` is 13px /
                      18px at weight 400 with no tracking, where `meta` is 12px
                      / 16px at weight 500 with 0.01em. Reaching for
                      `text-meta font-normal` invented a fourth rung the scale
                      does not have (12/16/400/0.01em) and put a hand-rolled
                      weight in front of the role. Reading it beside the 12px
                      `meta` timestamp is also the right hierarchy: the preview
                      is content, the timestamp is metadata. */}
                  <span className="line-clamp-2 ps-4 text-caption text-muted-foreground">
                    {message.preview}
                  </span>
                  {message.unread ? <span className="sr-only">Unread</span> : null}
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </aside>
  );
}
