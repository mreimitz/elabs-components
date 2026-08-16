/** sidebar-04 — double-sided mail sidebar (copy-owned block). Adapted from
 *  blocks.so (ephraim duncan). Tabler icons mapped to lucide. */
"use client";

import * as React from "react";
import { Archive, Box, Clock, Flag, Inbox, Star } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInput,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@qlik-coe-emea/qlabs-components-ui";
import { NavUser } from "@qlik-coe-emea/qlabs-components-ui";
import { useMail } from "./mail-context";

const data = {
  user: { name: "ephraim", email: "ephraim@blocks.so", avatar: "" },
  navMain: [
    { title: "Inbox", url: "#", icon: Inbox, isActive: true },
    { title: "Starred", url: "#", icon: Star, isActive: false },
    { title: "Important", url: "#", icon: Flag, isActive: false },
    { title: "Scheduled", url: "#", icon: Clock, isActive: false },
    { title: "Archive", url: "#", icon: Archive, isActive: false },
  ],
  labels: [
    { title: "Personal", color: "bg-green-400 dark:bg-green-300" },
    { title: "Work", color: "bg-blue-400 dark:bg-blue-300" },
    { title: "Travel", color: "bg-orange-400 dark:bg-orange-300" },
    { title: "Receipts", color: "bg-purple-400 dark:bg-purple-300" },
  ],
  mails: [
    {
      name: "Nora Patel",
      email: "nora@acme.co",
      subject: "Welcome to Acme Mail",
      date: "08:15 AM",
      teaser:
        "Hi there — here's a quick tour of your new inbox.\nPin, label, and schedule messages to stay organized.",
    },
    {
      name: "Stripe",
      email: "no-reply@stripe.com",
      subject: "Your payout has arrived",
      date: "Yesterday",
      teaser:
        "A payout of $3,245.90 was sent to your bank account.\nView details in your dashboard.",
    },
    {
      name: "GitHub",
      email: "noreply@github.com",
      subject: "New activity on acme/app",
      date: "Tue",
      teaser:
        "3 pull requests need your review. CI passed on main.\nClick to open the review queue.",
    },
    {
      name: "Ava Chen",
      email: "ava.chen@example.com",
      subject: "Agenda for Friday standup",
      date: "Mon",
      teaser:
        "Let's cover onboarding, billing bugs, and Q4 goals.\nReply with anything you want to add.",
    },
    {
      name: "Figma",
      email: "updates@figma.com",
      subject: "What's new in Figma",
      date: "Sep 12",
      teaser:
        "Variables, auto layout improvements, and dev mode updates.\nWatch the recap to learn more.",
    },
    {
      name: "Linear",
      email: "bot@linear.app",
      subject: "[ACME-432] Edit modal broken",
      date: "Sep 11",
      teaser: "Issue created by Wendy. Repro steps included.\nSeverity: high, priority: P1.",
    },
    {
      name: "Airbnb",
      email: "booking@airbnb.com",
      subject: "Your trip to Kyoto",
      date: "Sep 10",
      teaser: "Get ready for your stay. Check-in details and local recommendations inside.",
    },
    {
      name: "Notion",
      email: "team@notion.so",
      subject: "Weekly team recap",
      date: "Sep 09",
      teaser:
        "Marketing shipped pricing page revamp. Eng closed 14 issues.\nSee full notes in the doc.",
    },
  ],
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const [activeItem, setActiveItem] = React.useState(data.navMain[0]);
  const [mails, setMails] = React.useState(data.mails);
  const [query, setQuery] = React.useState("");
  const { setOpen } = useSidebar();
  const { setSelectedMail } = useMail();

  const filteredMails = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return mails;
    return mails.filter((m) =>
      [m.name, m.email, m.subject, m.teaser].join("\n").toLowerCase().includes(q),
    );
  }, [mails, query]);

  return (
    <div className="flex" {...props}>
      {/* Icon rail */}
      <Sidebar
        style={{ "--sidebar-width": "12rem" } as React.CSSProperties}
        collapsible="none"
        className="border-e p-2 px-1"
      >
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" asChild className="md:h-8 md:p-0">
                <a href="#">
                  <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-accent text-sidebar-accent-foreground">
                    <Box className="size-4" />
                  </div>
                  <div className="grid flex-1 text-start text-body leading-tight">
                    <span className="truncate font-medium">Acme Inc</span>
                    <span className="truncate text-meta">Enterprise</span>
                  </div>
                </a>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent className="px-1.5 md:px-0">
              <SidebarMenu>
                {data.navMain.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      onClick={() => {
                        setActiveItem(item);
                        const shuffled = [...data.mails].sort(() => Math.random() - 0.5);
                        setMails(shuffled.slice(0, Math.max(5, Math.floor(Math.random() * 8) + 1)));
                        setOpen(true);
                      }}
                      isActive={activeItem?.title === item.title}
                      className="px-2.5 md:px-2"
                    >
                      <item.icon />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
          <SidebarGroup>
            <SidebarGroupLabel className="px-1.5 text-meta md:px-0">Labels</SidebarGroupLabel>
            <SidebarGroupContent className="px-1.5 md:px-0">
              <SidebarMenu>
                {data.labels.map((label) => (
                  <SidebarMenuItem key={label.title}>
                    <SidebarMenuButton asChild className="px-2.5 md:px-2">
                      <div className="flex items-center gap-3">
                        <div className={`h-3 w-3 rounded ${label.color}`} />
                        <span>{label.title}</span>
                      </div>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <NavUser user={data.user} />
        </SidebarFooter>
      </Sidebar>

      {/* Mail list */}
      <Sidebar collapsible="none" className="hidden min-w-96 flex-1 border-e md:flex">
        <SidebarHeader className="gap-3.5 border-b p-4">
          <div className="flex w-full items-center justify-between">
            <div className="text-subtitle font-medium text-foreground">{activeItem?.title}</div>
          </div>
          <SidebarInput
            placeholder="Type to search..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup className="px-0 pt-0">
            <SidebarGroupContent>
              {filteredMails.length === 0 && (
                <div className="p-4 text-body text-muted-foreground">No results</div>
              )}
              {filteredMails.map((mail) => (
                <a
                  href="#"
                  key={mail.email}
                  onClick={(e) => {
                    e.preventDefault();
                    setSelectedMail(mail);
                  }}
                  className="flex flex-col items-start gap-2 whitespace-nowrap border-b p-4 text-body leading-tight hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                >
                  <div className="flex w-full items-center gap-2">
                    <span>{mail.name}</span>
                    <span className="ms-auto text-meta">{mail.date}</span>
                  </div>
                  <span className="font-medium">{mail.subject}</span>
                  <span className="line-clamp-2 w-[260px] whitespace-break-spaces text-meta">
                    {mail.teaser}
                  </span>
                </a>
              ))}
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>
    </div>
  );
}
