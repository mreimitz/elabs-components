/**
 * Nav data for the mail shell, router-agnostic by construction. Every entry
 * renders as a plain `<a href>` in `mail-nav-rail.tsx`; swap the element for
 * your router's link and keep this matcher:
 *   <NavLink to={item.href}>            (react-router)
 *   <Link href={item.href}>             (next/link)
 * `isPathActive` is exported so the semantics survive the swap.
 *
 * Mailboxes and labels are ONE vocabulary here — both are just filters over the
 * same message store, and a mail client that puts them in two different widgets
 * teaches that they behave differently. They are two groups of the same nav, so
 * the rail (and `isPathActive`) treats them identically.
 */
import type { LucideIcon } from "lucide-react";
import {
  Archive,
  Briefcase,
  Clock,
  Flag,
  Inbox,
  Plane,
  Receipt,
  Star,
  UserRound,
} from "lucide-react";

export interface MailboxItem {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  /** Unread messages waiting in this mailbox. `0`/absent renders no count. */
  unread?: number;
}

/**
 * Which nav entry the current route lights.
 *
 * DELIBERATELY DUPLICATED from the `app-shell` and `sidebar-02` blocks rather
 * than imported from either. Registry blocks are copy-owned: a cross-block
 * import would resolve in this source tree and then break for anyone who ran
 * `npx shadcn add sidebar-04` without also installing the other item. Six lines
 * of duplication is the correct price for an item that installs on its own.
 * Keep the copies identical.
 *
 * The root-path guard and the trailing separator in the prefix test are belt
 * AND braces, measured rather than assumed: with the separator in place no
 * route can start with `//`, so deleting the guard alone changes no outcome —
 * and with the guard in place a separator-less prefix test changes none either.
 * Both are kept because dropping BOTH lights the root entry on every route. Do
 * not "simplify" one away on the grounds that its own mutation was survivable.
 */
export function isPathActive(itemHref: string, activePath: string): boolean {
  if (itemHref === activePath) return true;
  if (itemHref === "/") return false; // the root would otherwise match everything
  return activePath.startsWith(`${itemHref}/`);
}

/**
 * The rail's two groups.
 *
 * Every entry carries a DISTINCT glyph — in the collapsed rail the icon IS the
 * whole entry, so two entries sharing one glyph are indistinguishable to a
 * sighted scan even when their tooltips and accessible names are correct.
 *
 * The label rows carry a glyph rather than the coloured square a mail client
 * usually gives them, and that is a deliberate correction of this block's
 * previous version. A square whose HUE is the whole message is a colour-only
 * graphical mark: it has to clear 3:1 against every surface it can land on
 * (WCAG 1.4.11) and it has to survive greyscale (1.4.1). The old squares were
 * raw palette literals (`bg-green-400 dark:bg-green-300`), which are banned
 * outright here — and neither the chart ramp nor `--primary` carries the 3:1
 * guarantee either. Only the status tones do, and "Travel" is not a status. A
 * glyph beside the word answers both rules without borrowing a token that means
 * something else.
 */
export const NAV_GROUPS: { label: string; items: MailboxItem[] }[] = [
  {
    label: "Mailboxes",
    items: [
      { id: "inbox", label: "Inbox", href: "/inbox", icon: Inbox, unread: 4 },
      { id: "starred", label: "Starred", href: "/starred", icon: Star },
      { id: "important", label: "Important", href: "/important", icon: Flag, unread: 1 },
      { id: "scheduled", label: "Scheduled", href: "/scheduled", icon: Clock },
      { id: "archive", label: "Archive", href: "/archive", icon: Archive },
    ],
  },
  {
    label: "Labels",
    items: [
      { id: "personal", label: "Personal", href: "/label/personal", icon: UserRound },
      { id: "work", label: "Work", href: "/label/work", icon: Briefcase },
      { id: "travel", label: "Travel", href: "/label/travel", icon: Plane },
      { id: "receipts", label: "Receipts", href: "/label/receipts", icon: Receipt },
    ],
  },
];
