import { LayoutTemplate, Shapes } from "lucide-react";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
} from "@elabs-ai/components-ui";

/**
 * Left-nav sections for the diagram app shell. Both groups render label-only
 * for now — DG-13 fills "Examples" with the YAML example gallery, DG-04 fills
 * "Icon packs" with the vendor icon browser. Empty `SidebarMenu`s keep the
 * group chrome (label, spacing) in place so those items slot straight in.
 */
export function SidebarNav() {
  return (
    <>
      <SidebarGroup>
        <SidebarGroupLabel>
          <LayoutTemplate aria-hidden="true" />
          Examples
        </SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu />
        </SidebarGroupContent>
      </SidebarGroup>
      <SidebarGroup>
        <SidebarGroupLabel>
          <Shapes aria-hidden="true" />
          Icon packs
        </SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu />
        </SidebarGroupContent>
      </SidebarGroup>
    </>
  );
}
