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
import { iconSheetHash, iconSheetVendor } from "../icons/icon-sheet";
import { useHash } from "../routes/use-hash";

/**
 * Left-nav sections for the diagram app shell. "Examples" stays label-only
 * for now (DG-13 fills it with the YAML example gallery). "Icon packs"
 * (DG-04) lists every vendored pack with its icon count; clicking one
 * navigates to the "#icons" dev route (app.tsx's hash router) filtered to
 * that vendor. The pack the hash names is marked active (`isActive` paints the row,
 * `aria-current` names it for assistive technology) — wave-1 review M4.
 */
export function SidebarNav() {
  const activePack = iconSheetVendor(useHash());
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
                {/* A link, not a button: it navigates (wave-0 review, DG-04 note). */}
                <SidebarMenuButton
                  asChild
                  isActive={activePack === pack}
                  tooltip={`${pack} (${count} icons)`}
                >
                  <a
                    href={iconSheetHash(pack)}
                    aria-current={activePack === pack ? "page" : undefined}
                  >
                    <Package aria-hidden="true" />
                    <span>{pack}</span>
                  </a>
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
