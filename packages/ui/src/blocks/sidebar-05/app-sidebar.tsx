/** sidebar-05 — double-sided sidebar (copy-owned block). Adapted from blocks.so
 *  (ephraim duncan). Icons mapped from @tabler/icons-react to lucide-react. */
"use client";

import type React from "react";
import { useState } from "react";
import {
  Activity,
  Archive,
  BarChart3,
  Bell,
  Bug,
  ChevronRight,
  Cloud,
  Database,
  Eye,
  FileText,
  Fingerprint,
  Folder,
  Folders,
  Package2,
  GitCommitHorizontal,
  GitMerge,
  GitPullRequest,
  Globe,
  Hexagon,
  Home,
  Key,
  Lock,
  Package,
  PackageOpen,
  Play,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Star,
  Target,
  Terminal,
  User,
  UserPlus,
  Webhook,
  Workflow,
  X,
} from "lucide-react";
import {
  NavUser,
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  TeamSwitcher,
  cn,
} from "@elabs-ai/components-ui";

const data = {
  user: { name: "ephraim", email: "ephraim@blocks.so", avatar: "" },
  teams: [
    { name: "OpenAI", logo: Sparkles, plan: "Enterprise" },
    { name: "Anthropic", logo: Star, plan: "Pro" },
    { name: "Google", logo: Globe, plan: "Free" },
    { name: "Meta", logo: Hexagon, plan: "Free" },
  ],
};

interface NavItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  hasSubItems?: boolean;
  route?: string;
  subItems?: {
    id: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    description?: string;
  }[];
}

const sidebarItems: NavItem[] = [
  {
    id: "overview",
    label: "Overview",
    icon: Home,
    hasSubItems: true,
    subItems: [
      {
        id: "dashboard",
        label: "Dashboard",
        icon: BarChart3,
        description: "Project overview and activity",
      },
      {
        id: "activity",
        label: "Activity",
        icon: Activity,
        description: "Recent commits and changes",
      },
      {
        id: "insights",
        label: "Insights",
        icon: Target,
        description: "Code analytics and metrics",
      },
    ],
  },
  {
    id: "repositories",
    label: "Repositories",
    icon: Folders,
    badge: "12",
    hasSubItems: true,
    subItems: [
      {
        id: "all-repos",
        label: "All Repositories",
        icon: Folder,
        description: "Browse all your repositories",
      },
      { id: "starred", label: "Starred", icon: Star, description: "Your starred repositories" },
      { id: "archived", label: "Archived", icon: Archive, description: "Archived repositories" },
    ],
  },
  {
    id: "pull-requests",
    label: "Pull Requests",
    icon: GitPullRequest,
    badge: "3",
    hasSubItems: true,
    subItems: [
      { id: "open-prs", label: "Open", icon: GitPullRequest, description: "Open pull requests" },
      {
        id: "review",
        label: "Review Requests",
        icon: Eye,
        description: "PRs awaiting your review",
      },
      { id: "merged", label: "Merged", icon: GitMerge, description: "Recently merged PRs" },
    ],
  },
  {
    id: "issues",
    label: "Issues",
    icon: Bug,
    badge: "7",
    hasSubItems: true,
    subItems: [
      { id: "open-issues", label: "Open Issues", icon: Bug, description: "Active issues and bugs" },
      {
        id: "assigned",
        label: "Assigned to Me",
        icon: UserPlus,
        description: "Issues assigned to you",
      },
      {
        id: "created",
        label: "Created by Me",
        icon: GitCommitHorizontal,
        description: "Issues you've created",
      },
    ],
  },
  {
    id: "actions",
    label: "Actions",
    icon: Workflow,
    hasSubItems: true,
    subItems: [
      {
        id: "workflows",
        label: "Workflows",
        icon: Play,
        description: "CI/CD workflows and pipelines",
      },
      { id: "runners", label: "Runners", icon: Terminal, description: "Self-hosted runners" },
      { id: "deployments", label: "Deployments", icon: Cloud, description: "Deployment history" },
    ],
  },
  {
    id: "packages",
    label: "Packages",
    icon: Package,
    hasSubItems: true,
    subItems: [
      {
        id: "published",
        label: "Published",
        icon: PackageOpen,
        description: "Your published packages",
      },
      {
        id: "containers",
        label: "Container Registry",
        icon: Database,
        description: "Docker images and containers",
      },
      { id: "npm", label: "npm Packages", icon: Package2, description: "Node.js packages" },
    ],
  },
  {
    id: "security",
    label: "Security",
    icon: Lock,
    badge: "2",
    hasSubItems: true,
    subItems: [
      {
        id: "alerts",
        label: "Security Alerts",
        icon: ShieldAlert,
        description: "Vulnerability alerts",
      },
      {
        id: "advisories",
        label: "Advisories",
        icon: ShieldCheck,
        description: "Security advisories",
      },
      { id: "secrets", label: "Secrets", icon: Fingerprint, description: "Repository secrets" },
    ],
  },
  {
    id: "settings",
    label: "Settings",
    icon: Settings,
    hasSubItems: true,
    subItems: [
      { id: "profile", label: "Profile", icon: User, description: "Your profile settings" },
      {
        id: "notifications",
        label: "Notifications",
        icon: Bell,
        description: "Notification preferences",
      },
      { id: "webhooks", label: "Webhooks", icon: Webhook, description: "Webhook configurations" },
      { id: "api-keys", label: "API Keys", icon: Key, description: "Personal access tokens" },
    ],
  },
  { id: "docs", label: "Documentation", icon: FileText, hasSubItems: false, route: "/docs" },
];

export function AppSidebar() {
  const [activeItem, setActiveItem] = useState<string | null>("overview");
  const [selectedSubItem, setSelectedSubItem] = useState<string | null>(null);
  const activeItemData = sidebarItems.find((item) => item.id === activeItem);

  const handleItemClick = (item: NavItem) => {
    if (item.hasSubItems) {
      const isActive = activeItem === item.id;
      setActiveItem(isActive ? null : item.id);
      if (isActive) setSelectedSubItem(null);
    } else {
      setActiveItem(null);
      setSelectedSubItem(null);
    }
  };

  return (
    <div className="flex h-dvh bg-background">
      <Sidebar side="left" variant="sidebar" collapsible="none" className="w-64 border-e">
        <SidebarHeader>
          <TeamSwitcher teams={data.teams} />
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {sidebarItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeItem === item.id;
                  const chevron = (
                    <ChevronRight
                      className={cn(
                        "h-4 w-4 shrink-0 transition-transform",
                        isActive && "rotate-90",
                      )}
                    />
                  );
                  return (
                    <SidebarMenuItem key={item.id}>
                      <SidebarMenuButton
                        isActive={isActive}
                        className="h-10 w-full px-3"
                        onClick={() => handleItemClick(item)}
                      >
                        <div className="flex min-w-0 flex-1 items-center gap-3">
                          <Icon className="h-4 w-4 shrink-0" />
                          <span className="truncate">{item.label}</span>
                        </div>
                        <div className="ms-auto flex min-w-fit shrink-0 items-center gap-1">
                          {(item.badge || item.hasSubItems) &&
                            (item.badge ? (
                              <SidebarMenuBadge
                                className={cn("min-w-fit", item.hasSubItems && "gap-x-3")}
                              >
                                {item.badge}
                                {item.hasSubItems && chevron}
                              </SidebarMenuBadge>
                            ) : (
                              chevron
                            ))}
                        </div>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <NavUser user={data.user} />
        </SidebarFooter>
      </Sidebar>

      {activeItem && activeItemData?.subItems && (
        <Sidebar
          side="left"
          variant="sidebar"
          collapsible="none"
          className="w-72 animate-in slide-in-from-left-5 border-e duration-base ease-entrance"
        >
          <SidebarHeader className="flex flex-row items-center justify-between border-b px-4">
            <h3 className="font-medium">{activeItemData.label}</h3>
            <button
              onClick={() => setActiveItem(null)}
              className="flex h-6 w-6 items-center justify-center rounded-md p-0 hover:bg-sidebar-accent"
              aria-label="Close panel"
            >
              <X className="h-4 w-4" />
            </button>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  {activeItemData.subItems.map((subItem) => {
                    const SubIcon = subItem.icon;
                    const isSelected = selectedSubItem === subItem.id;
                    return (
                      <SidebarMenuItem key={subItem.id}>
                        <SidebarMenuButton
                          isActive={isSelected}
                          className="h-auto w-full justify-start gap-3 px-3 py-2"
                          onClick={() => setSelectedSubItem(isSelected ? null : subItem.id)}
                        >
                          <SubIcon className="mt-0.5 h-5 w-5 shrink-0 self-start" />
                          <div className="min-w-0 flex-1 text-start">
                            <div className="font-medium">{subItem.label}</div>
                            {subItem.description && (
                              <div className="mt-0.5 text-xs text-muted-foreground">
                                {subItem.description}
                              </div>
                            )}
                          </div>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>
      )}
    </div>
  );
}
