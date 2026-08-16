"use client";

import { forwardRef, type ComponentProps, type ReactNode } from "react";
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader } from "../sidebar";

export interface AppSidebarProps extends ComponentProps<typeof Sidebar> {
  /**
   * Content rendered inside `<SidebarHeader>`. Typically a `TeamSwitcher`
   * or a logo + title combination.
   */
  header?: ReactNode;
  /**
   * Content rendered inside `<SidebarFooter>`. Typically a `NavUser` or
   * a `TeamSwitcher` placed at the bottom.
   */
  footer?: ReactNode;
  /**
   * Main navigation content rendered inside `<SidebarContent>`. Pass one or
   * more `<SidebarGroup>` / `<SidebarMenu>` compositions here.
   */
  children?: ReactNode;
}

/**
 * Parameterized application sidebar shell. Composes `@radix-ui` `Sidebar`
 * primitives with typed `header`, `footer`, and `children` slots.
 *
 * Registry blocks (`sidebar-02`, `sidebar-04`, `sidebar-05`) should import
 * this instead of constructing the `Sidebar` → `SidebarHeader` →
 * `SidebarContent` → `SidebarFooter` skeleton themselves.
 *
 * @example
 * ```tsx
 * <AppSidebar
 *   header={<TeamSwitcher teams={teams} />}
 *   footer={<NavUser user={currentUser} />}
 * >
 *   <SidebarGroup>…</SidebarGroup>
 * </AppSidebar>
 * ```
 */
export const AppSidebar = forwardRef<HTMLDivElement, AppSidebarProps>(function AppSidebar(
  { header, footer, children, ...props },
  ref,
) {
  return (
    <Sidebar ref={ref} {...props}>
      {header != null && <SidebarHeader>{header}</SidebarHeader>}
      <SidebarContent>{children}</SidebarContent>
      {footer != null && <SidebarFooter>{footer}</SidebarFooter>}
    </Sidebar>
  );
});
