import { Package } from "lucide-react";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@elabs-ai/components-ui";
// DG-04: the vendored icon packs (public/icons/index.json), per-pack counts.
import { ICON_PACKS } from "../icons/register-packs";

/**
 * Left-nav sections for the diagram app shell. "Examples" stays label-only
 * for now (DG-13 fills it with the YAML example gallery). "Icon packs"
 * (DG-04) lists every vendored pack with its icon count; clicking one
 * navigates to the "#icons" dev route (app.tsx's hash router) filtered to
 * that vendor.
 */
export function SidebarNav() {
  return (
    <>
      <SidebarGroup>
        <SidebarGroupLabel>Examples</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu />
        </SidebarGroupContent>
      </SidebarGroup>
      <SidebarGroup>
        <SidebarGroupLabel>Icon packs</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            {ICON_PACKS.map(({ pack, count }) => (
              <SidebarMenuItem key={pack}>
                <SidebarMenuButton
                  tooltip={`${pack} (${count} icons)`}
                  onClick={() => {
                    window.location.hash = `#icons/${pack}`;
                  }}
                >
                  <Package aria-hidden="true" />
                  <span>{pack}</span>
                </SidebarMenuButton>
                <SidebarMenuBadge>{count}</SidebarMenuBadge>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </>
  );
}
