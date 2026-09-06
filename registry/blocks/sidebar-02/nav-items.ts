/**
 * Nav data for the dashboard shell, router-agnostic by construction. Every nav
 * entry renders as a plain `<a href>` in `dashboard-sidebar.tsx`; swap the
 * element for your router's link and keep this matcher:
 *   <NavLink to={item.href}>            (react-router)
 *   <Link href={item.href}>             (next/link)
 * `isPathActive` is exported so the semantics survive the swap.
 */
import type { LucideIcon } from "lucide-react";
import {
  Banknote,
  Home,
  Inbox,
  Library,
  Package2,
  PackageCheck,
  ShoppingBag,
  TicketPercent,
  TrendingUp,
  Users,
} from "lucide-react";

export interface NavItem {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  items?: NavItem[];
}

/**
 * Which nav entry the current route lights.
 *
 * DELIBERATELY DUPLICATED from the `app-shell` block rather than imported from
 * it. Registry blocks are copy-owned: a cross-block import would resolve in
 * this source tree and then break for anyone who ran `npx shadcn add sidebar-02`
 * without also installing `app-shell`. Six lines of duplication is the correct
 * price for an item that installs on its own. Keep the two copies identical.
 *
 * The root-path guard and the trailing separator in the prefix test are belt
 * AND braces, measured rather than assumed: with the separator in place no
 * route can start with `//`, so deleting the guard alone changes no outcome —
 * and with the guard in place a separator-less prefix test changes none either.
 * Both are kept because dropping BOTH lights the root entry on every route
 * (watched fail on the `Nested Route` story). Do not "simplify" one away on the
 * grounds that its own mutation was survivable.
 */
export function isPathActive(itemHref: string, activePath: string): boolean {
  if (itemHref === activePath) return true;
  if (itemHref === "/") return false; // the root would otherwise match everything
  return activePath.startsWith(`${itemHref}/`);
}

export const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "Store",
    items: [
      { id: "overview", label: "Overview", href: "/", icon: Home },
      {
        id: "orders",
        label: "Orders",
        href: "/orders",
        icon: ShoppingBag,
        items: [
          // Every entry carries a DISTINCT glyph. In the collapsed rail the icon
          // IS the whole entry, so two sub-routes sharing their parent's glyph
          // are indistinguishable to a sighted scan even when their tooltips and
          // accessible names are correct.
          { id: "orders-open", label: "Open", href: "/orders/open", icon: Inbox },
          {
            id: "orders-fulfilled",
            label: "Fulfilled",
            href: "/orders/fulfilled",
            icon: PackageCheck,
          },
        ],
      },
      {
        id: "products",
        label: "Products",
        href: "/products",
        icon: Package2,
        items: [
          {
            id: "products-catalogue",
            label: "Catalogue",
            href: "/products/catalogue",
            icon: Library,
          },
          {
            id: "products-discounts",
            label: "Discounts",
            href: "/products/discounts",
            icon: TicketPercent,
          },
        ],
      },
      { id: "customers", label: "Customers", href: "/customers", icon: Users },
    ],
  },
  {
    label: "Insight",
    items: [
      { id: "analytics", label: "Analytics", href: "/analytics", icon: TrendingUp },
      { id: "payouts", label: "Payouts", href: "/payouts", icon: Banknote },
    ],
  },
];
