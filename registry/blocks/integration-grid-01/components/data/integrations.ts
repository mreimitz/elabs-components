import {
  Boxes,
  Calendar,
  FileText,
  Mail,
  MessageSquare,
  Video,
  type LucideIcon,
} from "lucide-react";

export interface Integration {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  connected: boolean;
}

export const INTEGRATIONS: Integration[] = [
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
