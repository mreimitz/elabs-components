/** sidebar-02 — dashboard sidebar (copy-owned block). Adapted from blocks.so
 *  (ephraim duncan). framer-motion removed (plain fade); next/link -> <a>. */
"use client";

import {
  Activity,
  DollarSign,
  Home,
  Infinity as InfinityIcon,
  Link as LinkIcon,
  Package2,
  Percent,
  PieChart,
  Settings,
  ShoppingBag,
  Sparkles,
  Store,
  TrendingUp,
  Users,
} from "lucide-react";
import { AppSidebar, SidebarTrigger, cn, useSidebar } from "@elabs-ai/components-ui";
import { Logo } from "./logo";
import DashboardNavigation, { type Route } from "./nav-main";
import { NotificationsPopover } from "./nav-notifications";
import { TeamSwitcher } from "./team-switcher";

const sampleNotifications = [
  {
    id: "1",
    fallback: "OM",
    text: "New order received.",
    time: "10m ago",
  },
  {
    id: "2",
    fallback: "JL",
    text: "Server upgrade completed.",
    time: "1h ago",
  },
  {
    id: "3",
    fallback: "HH",
    text: "New user signed up.",
    time: "2h ago",
  },
];

const dashboardRoutes: Route[] = [
  { id: "home", title: "Home", icon: <Home className="size-4" />, link: "#" },
  {
    id: "products",
    title: "Products",
    icon: <Package2 className="size-4" />,
    link: "#",
    subs: [
      { title: "Catalogue", link: "#" },
      { title: "Checkout Links", link: "#" },
      { title: "Discounts", link: "#" },
    ],
  },
  {
    id: "usage-billing",
    title: "Usage Billing",
    icon: <PieChart className="size-4" />,
    link: "#",
    subs: [
      { title: "Meters", link: "#" },
      { title: "Events", link: "#" },
    ],
  },
  { id: "benefits", title: "Benefits", icon: <Sparkles className="size-4" />, link: "#" },
  { id: "customers", title: "Customers", icon: <Users className="size-4" />, link: "#" },
  {
    id: "sales",
    title: "Sales",
    icon: <ShoppingBag className="size-4" />,
    link: "#",
    subs: [
      { title: "Orders", link: "#" },
      { title: "Subscriptions", link: "#" },
    ],
  },
  { id: "storefront", title: "Storefront", icon: <Store className="size-4" />, link: "#" },
  { id: "analytics", title: "Analytics", icon: <TrendingUp className="size-4" />, link: "#" },
  {
    id: "finance",
    title: "Finance",
    icon: <DollarSign className="size-4" />,
    link: "#",
    subs: [
      { title: "Incoming", link: "#" },
      { title: "Outgoing", link: "#" },
      { title: "Payout Account", link: "#" },
    ],
  },
  {
    id: "settings",
    title: "Settings",
    icon: <Settings className="size-4" />,
    link: "#",
    subs: [
      { title: "General", link: "#" },
      { title: "Webhooks", link: "#" },
      { title: "Custom Fields", link: "#" },
    ],
  },
];

// Reference icons retained for parity with the source data shape.
void Activity;
void InfinityIcon;
void LinkIcon;
void Percent;

const teams = [
  { name: "Alpha Inc.", logo: Logo, plan: "Free" },
  { name: "Beta Corp.", logo: Logo, plan: "Free" },
  { name: "Gamma Tech", logo: Logo, plan: "Free" },
];

export function DashboardSidebar() {
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";

  const header = (
    <div
      className={cn(
        "flex md:pt-3.5",
        isCollapsed
          ? "flex-row items-center justify-between gap-y-4 md:flex-col md:items-start md:justify-start"
          : "flex-row items-center justify-between",
      )}
    >
      <a href="#" className="flex items-center gap-2">
        <Logo className="h-8 w-8" />
        {!isCollapsed && <span className="font-semibold text-sidebar-foreground">Acme</span>}
      </a>
      <div
        className={cn(
          "flex items-center gap-2 animate-in fade-in",
          isCollapsed ? "flex-row md:flex-col-reverse" : "flex-row",
        )}
      >
        <NotificationsPopover notifications={sampleNotifications} />
        <SidebarTrigger />
      </div>
    </div>
  );

  return (
    <AppSidebar
      variant="inset"
      collapsible="icon"
      header={header}
      footer={<TeamSwitcher teams={teams} />}
    >
      <DashboardNavigation routes={dashboardRoutes} className="gap-4 px-2 py-4" />
    </AppSidebar>
  );
}
