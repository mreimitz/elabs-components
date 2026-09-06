/**
 * Zone 3 of three — the reading pane. The one place on this screen that holds a
 * whole thing rather than a summary of many.
 *
 * It is a LABELLED LANDMARK whose name is the subject of the open message, not
 * a fixed word like "Reading pane". That is the difference between "there is a
 * region here" and "the region is showing Welcome to the Northwind pilot": a
 * screen-reader user moving between landmarks hears what they are about to
 * read, and the name changes when the selection does.
 */
"use client";

import { useId, type ComponentProps } from "react";
import { Archive, Mail, Reply, Trash2 } from "lucide-react";
import {
  Avatar,
  AvatarFallback,
  Badge,
  Button,
  cn,
  IconButton,
  Skeleton,
  StatePanel,
} from "@elabs-ai/components-ui";
import { NAV_GROUPS } from "./nav-items";
import { formatFull, type MailMessage } from "./messages";

/** Label id -> its display word, read off the same nav data the rail renders. */
const LABEL_NAMES: Record<string, string> = (() => {
  const names: Record<string, string> = {};
  for (const group of NAV_GROUPS) {
    for (const item of group.items) names[item.id] = item.label;
  }
  return names;
})();

/** Two-letter monogram for the sender's avatar. */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((part) => part.charAt(0).toUpperCase()).join("");
}

export interface MailReadingPaneProps extends ComponentProps<"section"> {
  /** The open message, or `undefined` for the no-selection state. */
  message?: MailMessage;
  /** No renderable content yet — renders a layout-shaped skeleton. */
  loading?: boolean;
}

export function MailReadingPane({
  message,
  loading = false,
  className,
  ...props
}: MailReadingPaneProps) {
  const headingId = useId();

  return (
    <section
      data-slot="mail-reading-pane"
      // Named by the subject when there is one; a static fallback only when
      // there is nothing to name it after. `aria-labelledby` points at the real
      // <h1>, so the two can never drift apart.
      {...(message ? { "aria-labelledby": headingId } : { "aria-label": "Reading pane" })}
      // The drill-down half of the mobile behaviour: below `md` this zone is
      // present only while a message is open. From `md` up it is always there,
      // showing its no-selection state when nothing is picked.
      className={cn(
        "hidden min-w-0 flex-1 flex-col bg-background",
        "group-data-[reading=open]/mail:flex md:flex",
        className,
      )}
      {...props}
    >
      {loading ? (
        <div
          role="status"
          aria-live="polite"
          className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden p-6"
        >
          <span className="sr-only">Loading the message…</span>
          <Skeleton className="h-7 w-2/3" />
          <div className="flex items-center gap-3">
            <Skeleton className="size-9 rounded-full" />
            <Skeleton className="h-4 w-48" />
          </div>
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-11/12" />
          <Skeleton className="h-4 w-9/12" />
        </div>
      ) : !message ? (
        <div className="flex min-h-0 flex-1 items-center justify-center p-6">
          <StatePanel
            kind="empty"
            icon={<Mail aria-hidden="true" />}
            title="No message selected"
            description="Pick a message from the list to read it here."
          />
        </div>
      ) : (
        <>
          <div className="flex shrink-0 flex-col gap-3 border-b border-border-strong px-6 py-4">
            <div className="flex items-start gap-2">
              <h1 id={headingId} className="min-w-0 flex-1 text-title text-balance text-foreground">
                {message.subject}
              </h1>
              <div className="flex shrink-0 items-center gap-1">
                <Button variant="outline" size="sm">
                  <Reply aria-hidden="true" />
                  Reply
                </Button>
                {/* `pointer-coarse:size-11` is the touch floor, and ONLY the
                    touch floor — asking about the input device rather than
                    using a width breakpoint as a proxy for it. */}
                <IconButton
                  label="Archive this message"
                  icon={<Archive />}
                  className="pointer-coarse:size-11"
                />
                <IconButton
                  label="Move this message to trash"
                  icon={<Trash2 />}
                  className="pointer-coarse:size-11"
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Avatar className="size-9 shrink-0">
                <AvatarFallback>{initials(message.from.name)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="truncate text-body font-medium text-foreground">
                  {message.from.name}
                </div>
                <div className="truncate text-meta font-normal text-muted-foreground">
                  {message.from.email}
                </div>
              </div>
              <time
                dateTime={message.receivedAt}
                className="shrink-0 text-meta tabular-nums text-muted-foreground"
              >
                {formatFull(message.receivedAt)}
              </time>
            </div>

            {message.labels && message.labels.length > 0 ? (
              <ul className="flex flex-wrap items-center gap-1">
                {message.labels.map((label) => (
                  <li key={label}>
                    {/* A filled plate that also carries its own word — a
                        redundant boundary, and no colour-only claim. */}
                    <Badge variant="secondary">{LABEL_NAMES[label] ?? label}</Badge>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          <div
            data-slot="mail-reading-pane-body"
            tabIndex={0}
            // `focus-ring-inset`, not `focus-ring`: both of the plain rung's
            // layers are drawn OUTSIDE the element's box, and this port sits
            // inside `SidebarInset`'s `overflow-hidden` — so the ring and its
            // contour would be clipped away and a keyboard user would get no
            // indicator at all on a deliberately focusable region (WCAG 2.1.1,
            // axe `scrollable-region-focusable`).
            className="min-h-0 flex-1 overflow-y-auto px-6 py-5 focus-ring-inset"
          >
            {/* `max-w-prose` because this really is multi-paragraph prose in a
                wide container — the case the `measure` convention exists for. */}
            <div className="flex max-w-prose flex-col gap-4 text-body text-foreground">
              {message.body.split("\n\n").map((paragraph, index) => (
                // eslint-disable-next-line react/no-array-index-key -- paragraphs have no id; order IS their identity
                <p key={index}>{paragraph}</p>
              ))}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
