/**
 * sidebar-02 — primary navigation.
 * Re-exports the shared `NavMain` primitive from `@qlik-coe-emea/qlabs-components-ui` so this block
 * no longer maintains its own copy (issue #99).
 *
 * The block-local alias `DashboardNavigation` is preserved for back-compat
 * so `app-sidebar.tsx` does not need to change its import name.
 */
export {
  NavMain as default,
  NavMain as DashboardNavigation,
} from "@qlik-coe-emea/qlabs-components-ui";
export type {
  NavMainProps as DashboardNavigationProps,
  NavMainRoute as Route,
} from "@qlik-coe-emea/qlabs-components-ui";
