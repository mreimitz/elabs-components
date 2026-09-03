import type { Meta, StoryObj } from "@storybook/react-vite";
import { Home, Inbox, Search, Settings } from "lucide-react";
import { Sidebar } from "./sidebar";
import {
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "./sidebar";

const meta = {
  title: "Layout/Sidebar",
  component: Sidebar,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "The sidebar PRIMITIVE set you assemble yourself — an application sidebar with typed `header` / `footer` / nav slots is `Layout/AppSidebar`, which composes exactly these parts; see [Choosing between similar components](?path=/docs/docs-choosing-between-similar-components--docs). `SidebarProvider` owns the open state (⌘B / Ctrl+B, persisted in a `sidebar_state` cookie); `Sidebar` takes `side`, `variant` and a `collapsible` mode of `offcanvas` / `icon` / `none`; `SidebarHeader` / `SidebarContent` / `SidebarFooter` / `SidebarMenu*` are the parts. Reach for these only when the shell is bespoke.",
      },
    },
  },
} satisfies Meta<typeof Sidebar>;
export default meta;
type Story = StoryObj<typeof meta>;

const items = [
  { title: "Home", icon: Home },
  { title: "Inbox", icon: Inbox },
  { title: "Search", icon: Search },
  { title: "Settings", icon: Settings },
];

export const Default: Story = {
  render: () => (
    <div className="h-[480px]">
      <SidebarProvider>
        <Sidebar collapsible="icon">
          <SidebarHeader className="px-3 py-2 font-semibold">Brand UI</SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Platform</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {items.map((item, i) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton isActive={i === 0} tooltip={item.title}>
                        <item.icon />
                        <span>{item.title}</span>
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
            <span className="text-body font-medium">Dashboard</span>
          </header>
          <div className="p-6 text-body text-muted-foreground">
            Main content. Press ⌘/Ctrl+B to toggle.
          </div>
        </SidebarInset>
      </SidebarProvider>
    </div>
  ),
};
