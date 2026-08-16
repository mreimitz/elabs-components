/**
 * sidebar-02 — primary navigation.
 * Re-exports the shared `NavMain` primitive from `@elabs/components-ui` so this block
 * no longer maintains its own copy (issue #99).
 *
 * The block-local alias `DashboardNavigation` is preserved for back-compat
 * so `app-sidebar.tsx` does not need to change its import name.
 */
export { NavMain as default, NavMain as DashboardNavigation } from "@elabs/components-ui";
export type {
  NavMainProps as DashboardNavigationProps,
  NavMainRoute as Route,
} from "@elabs/components-ui";
