"use client";

import type { ComponentProps } from "react";
import { BellIcon } from "lucide-react";
import { Avatar, AvatarFallback } from "../avatar";
import { Button } from "../button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../dropdown-menu";
import { useLocale } from "../locale-provider";
import { cn } from "../../lib/cn";

export interface NavNotification {
  id: string;
  /** Two-letter fallback initials for the avatar. */
  fallback: string;
  text: string;
  time: string;
}

export interface NavNotificationsProps {
  notifications: NavNotification[];
  /** Label for the "view all" footer item. @default "View all notifications" */
  viewAllLabel?: string;
  /**
   * Which side of the trigger the menu opens on.
   *
   * The default is `"right"`, which is right for the surface this component was
   * extracted from — a bell sitting in a left-hand nav rail. It is WRONG for a
   * trigger at the end of a top bar: Radix collision-handling then flips the
   * menu back across the trigger and it covers the controls beside it. Set
   * `side="bottom"` (usually with `align="end"`) for a top-bar bell.
   *
   * @default "right"
   */
  side?: ComponentProps<typeof DropdownMenuContent>["side"];
  /**
   * How the menu aligns along that side. Radix's own default is `"center"`;
   * pass `"end"` so a top-bar menu hangs from the trigger's outer edge instead
   * of straddling it.
   */
  align?: ComponentProps<typeof DropdownMenuContent>["align"];
  /**
   * Extra classes for the component ROOT — the bell trigger — merged last, so a
   * caller can override the shipped `rounded-full` (`component-api.md`).
   *
   * There is deliberately NO seam for the portalled menu surface: nothing needs
   * one today, and an unused prop is a worse API than a missing one. The one
   * thing a caller used to reach for it (dropping the rail's vertical inset for
   * a top-bar menu) is now derived from `side` instead — see below.
   */
  className?: string;
}

/**
 * Notifications dropdown button. Shared primitive from sidebar-02 (issue #99).
 * Renders a bell-icon ghost button that opens a dropdown listing recent
 * notifications.
 *
 * Placement is caller-owned via `side`/`align`; the defaults are the original
 * rail placement, so every existing call site renders unchanged. `className`
 * styles the trigger, not the menu.
 */
export function NavNotifications({
  notifications,
  viewAllLabel = "View all notifications",
  side = "right",
  align,
  className,
}: NavNotificationsProps) {
  const { t } = useLocale();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn("rounded-full", className)}
          aria-label="Open notifications"
        >
          <BellIcon className="size-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side={side}
        align={align}
        className={cn(
          // The vertical inset belongs to the SIDE-opening rail placement, where
          // the menu runs alongside its trigger and needs clearance from it. A
          // menu that opens above or below the trigger is already clear of it,
          // and the inset would just hang it 24px off the bar. Derived from
          // `side` rather than exposed as a second className seam.
          (side === "left" || side === "right") && "my-6",
          "w-80",
        )}
      >
        <DropdownMenuLabel>{t("ui.navNotifications.label")}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {notifications.map(({ id, fallback, text, time }) => (
          <DropdownMenuItem key={id} className="flex items-start gap-3">
            <Avatar className="size-8">
              <AvatarFallback>{fallback}</AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
              <span className="text-sm font-medium">{text}</span>
              <span className="text-xs text-muted-foreground">{time}</span>
            </div>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem className="justify-center text-sm text-muted-foreground">
          {viewAllLabel}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
