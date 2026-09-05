/**
 * sidebar-02 — notifications popover.
 * Re-exports the shared `NavNotifications` primitive from `@elabs-ai/components-ui` so this
 * block no longer maintains its own copy (issue #99).
 */
export { NavNotifications as NotificationsPopover } from "@elabs-ai/components-ui";
export type { NavNotificationsProps, NavNotification } from "@elabs-ai/components-ui";
