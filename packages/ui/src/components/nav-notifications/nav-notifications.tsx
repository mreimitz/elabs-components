"use client";

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
}

/**
 * Sidebar notifications dropdown button. Shared primitive from sidebar-02 (issue #99).
 * Renders a bell-icon ghost button that opens a dropdown listing recent notifications.
 */
export function NavNotifications({
  notifications,
  viewAllLabel = "View all notifications",
}: NavNotificationsProps) {
  const { t } = useLocale();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full"
          aria-label="Open notifications"
        >
          <BellIcon className="size-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="right" className="my-6 w-80">
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
