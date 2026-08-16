/**
 * Integration Grid — the "connect your tools" page block.
 *
 * A common professional surface (settings → integrations, marketplace) with no
 * brand-ui block today: a responsive grid of integration cards (icon/logo +
 * name + description + a connect/manage action + connection status), under a
 * page header with an "Add integration" action. Compose Card + Button + Badge +
 * SectionHeader only — logos are consumer-supplied (Lucide placeholders here).
 *
 * Compose-only from @qlik-coe-emea/qlabs-components-* primitives; semantic tokens only; reads in all
 * three themes. Verify with globals=theme:<slug>.
 */
import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  Plus,
  type LucideIcon,
  Calendar,
  Mail,
  MessageSquare,
  Video,
  FileText,
  Boxes,
} from "lucide-react";
import { Badge, Button, Card, CardContent, CardFooter, SectionHeader } from "./index";

interface Integration {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  connected: boolean;
}

const INTEGRATIONS: Integration[] = [
  {
    id: "gmail",
    name: "Gmail",
    description: "Send, receive and manage email from your workspace.",
    icon: Mail,
    connected: true,
  },
  {
    id: "meet",
    name: "Google Meet",
    description: "Start and join video calls without leaving the app.",
    icon: Video,
    connected: true,
  },
  {
    id: "slack",
    name: "Slack",
    description: "Push alerts and updates to your team channels.",
    icon: MessageSquare,
    connected: false,
  },
  {
    id: "calendar",
    name: "Calendar",
    description: "Sync events and deadlines two ways.",
    icon: Calendar,
    connected: false,
  },
  {
    id: "notion",
    name: "Notion",
    description: "Capture and organize docs alongside your data.",
    icon: FileText,
    connected: false,
  },
  {
    id: "warehouse",
    name: "Warehouse",
    description: "Connect Snowflake / BigQuery as a source.",
    icon: Boxes,
    connected: true,
  },
];

function IntegrationCard({ integration }: { integration: Integration }) {
  const Icon = integration.icon;
  return (
    <Card className="flex flex-col">
      <CardContent className="flex-1 space-y-3 p-5">
        <div className="flex items-center justify-between gap-2">
          <span className="grid size-10 place-items-center rounded-lg border bg-surface-muted text-foreground">
            <Icon className="size-5" aria-hidden="true" />
          </span>
          {integration.connected ? (
            <Badge variant="success">Connected</Badge>
          ) : (
            <Badge variant="outline">Not connected</Badge>
          )}
        </div>
        <div className="space-y-1">
          <h3 className="text-body font-semibold text-foreground">{integration.name}</h3>
          <p className="text-body text-muted-foreground">{integration.description}</p>
        </div>
      </CardContent>
      <CardFooter className="gap-2 border-t pt-4">
        {integration.connected ? (
          <>
            <Button variant="outline" size="sm">
              Manage
            </Button>
            <Button variant="ghost" size="sm" className="text-muted-foreground">
              Disconnect
            </Button>
          </>
        ) : (
          <Button size="sm">Connect</Button>
        )}
      </CardFooter>
    </Card>
  );
}

function IntegrationGrid() {
  return (
    <div className="space-y-6 bg-background p-6 text-foreground">
      <SectionHeader
        eyebrow="Settings"
        title="Integrations"
        description="Connect the tools your team already uses."
        actions={
          <Button size="sm">
            <Plus className="size-4" aria-hidden="true" />
            Add integration
          </Button>
        }
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {INTEGRATIONS.map((i) => (
          <IntegrationCard key={i.id} integration={i} />
        ))}
      </div>
    </div>
  );
}

const meta = {
  title: "Patterns/Blocks/Integration Grid",
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "A responsive grid of integration cards (icon + name + description + connect/manage action + connection status) under a page header with an Add action — the canonical 'connect your tools' surface. Logos are consumer-supplied (Lucide placeholders here). Compose Card + Button + Badge + SectionHeader; semantic tokens only; reads in all three themes.",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { render: () => <IntegrationGrid /> };
