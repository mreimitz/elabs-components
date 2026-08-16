import type { Meta, StoryObj } from "@storybook/react-vite";
import { AppShell } from "./app-shell";
import { TopNav } from "../top-nav";
import { PageShell } from "../page-shell";
import { SectionHeader } from "../section-header";
import { Button } from "../button";

const meta = {
  title: "Layout/App Shell/Basic",
  component: AppShell,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof AppShell>;
export default meta;
type Story = StoryObj<typeof meta>;

const nav = ["Dashboard", "Projects", "Reports", "Settings"];

export const Default: Story = {
  render: () => (
    <div className="h-[600px]">
      <AppShell
        sidebar={
          <nav className="flex h-full w-60 flex-col gap-1 border-e border-sidebar-border bg-sidebar p-3 text-sidebar-foreground">
            <div className="px-2 pb-3 font-semibold">Brand UI</div>
            {nav.map((n, i) => (
              <button
                key={n}
                className={
                  "rounded-md px-3 py-2 text-start text-body font-medium " +
                  (i === 0
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60")
                }
              >
                {n}
              </button>
            ))}
          </nav>
        }
        topNav={
          <TopNav end={<Button size="sm">Invite</Button>}>
            <span className="text-body font-medium">Dashboard</span>
          </TopNav>
        }
      >
        <PageShell
          header={
            <SectionHeader
              title="Overview"
              description="A lightweight generic shell. For full sidebar behavior use the Sidebar primitive."
            />
          }
        >
          <div className="rounded-xl border bg-card p-6 text-body text-muted-foreground">
            Main content area.
          </div>
        </PageShell>
      </AppShell>
    </div>
  ),
};
