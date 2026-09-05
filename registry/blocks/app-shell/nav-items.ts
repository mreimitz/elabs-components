/**
 * Nav data, router-agnostic by construction. Every nav entry renders as a plain
 * `<a href>` in `app-nav-rail.tsx`; swap the element for your router's link and keep
 * this matcher:
 *   <NavLink to={item.href}>            (react-router)
 *   <Link href={item.href}>             (next/link)
 * `isPathActive` is exported so the semantics survive the swap.
 */
import type { LucideIcon } from "lucide-react";
import { Activity, BookOpen, Home, ListChecks, Plug } from "lucide-react";

export interface NavItem {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  items?: NavItem[];
}

export function isPathActive(itemHref: string, activePath: string): boolean {
  if (itemHref === activePath) return true;
  if (itemHref === "/") return false; // the root would otherwise match everything
  return activePath.startsWith(`${itemHref}/`);
}

export const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "Workspace",
    items: [
      { id: "overview", label: "Overview", href: "/", icon: Home },
      {
        id: "runs",
        label: "Runs",
        href: "/runs",
        icon: ListChecks,
        items: [
          { id: "runs-active", label: "Active", href: "/runs/active", icon: ListChecks },
          { id: "runs-completed", label: "Completed", href: "/runs/completed", icon: ListChecks },
        ],
      },
      { id: "activity", label: "Activity", href: "/activity", icon: Activity },
    ],
  },
  {
    label: "Resources",
    items: [
      { id: "docs", label: "Documentation", href: "/docs", icon: BookOpen },
      { id: "integrations", label: "Integrations", href: "/integrations", icon: Plug },
    ],
  },
];
