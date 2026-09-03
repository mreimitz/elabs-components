import type { Meta, StoryObj } from "@storybook/react-vite";
import { Globe, Home, Settings, Sparkles } from "lucide-react";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "../sidebar";
import { NavUser } from "../nav-user";
import { TeamSwitcher } from "../team-switcher";
import { AppSidebar } from "./app-sidebar";

const meta = {
  title: "Layout/AppSidebar",
  component: AppSidebar,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "The opinionated application sidebar — the raw primitive set it composes is `Layout/Sidebar`; see [Choosing between similar components](?path=/docs/docs-choosing-between-similar-components--docs). `AppSidebar` wraps the `Sidebar` → `SidebarHeader` → `SidebarContent` → `SidebarFooter` skeleton behind typed `header` / `footer` slots with the navigation as `children`, and forwards every `Sidebar` prop. The registry’s sidebar blocks import this rather than rebuilding the skeleton.",
      },
    },
  },
  decorators: [
    (Story) => (
      <SidebarProvider>
        <div className="flex h-dvh w-full">
          <Story />
          <SidebarInset className="flex flex-col p-6 text-body text-muted-foreground">
            Main content area
          </SidebarInset>
        </div>
      </SidebarProvider>
    ),
  ],
} satisfies Meta<typeof AppSidebar>;
export default meta;
type Story = StoryObj<typeof meta>;

const sampleTeams = [
  { name: "Acme Inc.", logo: Sparkles, plan: "Enterprise" },
  { name: "Beta Corp.", logo: Globe, plan: "Free" },
];

const sampleUser = { name: "Jane Doe", email: "jane@example.com" };

const navItems = [
  { title: "Home", icon: Home, url: "#" },
  { title: "Settings", icon: Settings, url: "#" },
];

export const Default: Story = {
  render: () => (
    <AppSidebar
      header={<TeamSwitcher teams={sampleTeams} />}
      footer={<NavUser user={sampleUser} />}
    >
      <SidebarGroup>
        <SidebarGroupContent>
          <SidebarMenu>
            {navItems.map((item) => (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton asChild>
                  <a href={item.url}>
                    <item.icon />
                    <span>{item.title}</span>
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </AppSidebar>
  ),
};

export const HeaderOnly: Story = {
  name: "Header only (no footer)",
  render: () => (
    <AppSidebar header={<TeamSwitcher teams={sampleTeams} />}>
      <SidebarGroup>
        <SidebarGroupContent>
          <SidebarMenu>
            {navItems.map((item) => (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton asChild>
                  <a href={item.url}>
                    <item.icon />
                    <span>{item.title}</span>
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </AppSidebar>
  ),
};

export const FooterOnly: Story = {
  name: "Footer only (no header)",
  render: () => (
    <AppSidebar footer={<NavUser user={sampleUser} />}>
      <SidebarGroup>
        <SidebarGroupContent>
          <SidebarMenu>
            {navItems.map((item) => (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton asChild>
                  <a href={item.url}>
                    <item.icon />
                    <span>{item.title}</span>
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </AppSidebar>
  ),
};
