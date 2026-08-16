/**
 * Basic app-shell scaffold (copy-owned block) using the @elabs-ai/components-ui sidebar
 * primitive. For richer shells see the sidebar-02 / sidebar-04 / sidebar-05
 * blocks. Depends on installed @elabs-ai/components-ui + lucide-react.
 */
"use client";

import { useState } from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@elabs-ai/components-ui";
import { BarChart3, FileText, Home, Settings } from "lucide-react";

const nav = [
  { id: "overview", label: "Overview", icon: Home },
  { id: "reports", label: "Reports", icon: BarChart3 },
  { id: "docs", label: "Docs", icon: FileText },
  { id: "settings", label: "Settings", icon: Settings },
];

export default function AppShellPage() {
  const [active, setActive] = useState("overview");
  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader className="px-3 py-2 font-semibold">Acme</SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {nav.map((n) => (
                  <SidebarMenuItem key={n.id}>
                    <SidebarMenuButton
                      isActive={active === n.id}
                      tooltip={n.label}
                      onClick={() => setActive(n.id)}
                    >
                      <n.icon />
                      <span>{n.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>
      <SidebarInset>
        <header className="flex h-14 items-center gap-2 border-b px-4">
          <SidebarTrigger />
          <span className="text-sm font-medium capitalize">{active}</span>
        </header>
        <div className="p-6 text-sm text-muted-foreground">
          Replace this with your page content.
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
