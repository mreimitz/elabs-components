import { createElement, type ReactElement } from "react";
import type { LucideIcon } from "lucide-react";
import { Server } from "lucide-react";
import { Database } from "lucide-react";
import { HardDrive } from "lucide-react";
import { Cloud } from "lucide-react";
import { Users } from "lucide-react";
import { User } from "lucide-react";
import { Globe } from "lucide-react";
import { Lock } from "lucide-react";
import { Shield } from "lucide-react";
import { Key } from "lucide-react";
import { Network } from "lucide-react";
import { Router } from "lucide-react";
import { Mail } from "lucide-react";
import { MessageSquare } from "lucide-react";
import { File } from "lucide-react";
import { Folder } from "lucide-react";
import { Cpu } from "lucide-react";
import { Layers } from "lucide-react";
import { Box } from "lucide-react";
import { Workflow } from "lucide-react";
import { GitBranch } from "lucide-react";
import { Terminal } from "lucide-react";
import { Monitor } from "lucide-react";
import { Smartphone } from "lucide-react";
import { Building } from "lucide-react";
import { Factory } from "lucide-react";
import { Warehouse } from "lucide-react";
import { Plug } from "lucide-react";
import { Cable } from "lucide-react";
import { Radio } from "lucide-react";
import { Activity } from "lucide-react";
import { BarChart3 } from "lucide-react";
import { Table } from "lucide-react";
import { Brain } from "lucide-react";
import { Bot } from "lucide-react";
import { Webhook } from "lucide-react";
import { Timer } from "lucide-react";
import { Calendar } from "lucide-react";
import { AlertTriangle } from "lucide-react";
import { Check } from "lucide-react";

/**
 * The `lucide/<name>` reserved vendor (icon-name.ts) — generic glyphs used
 * as node/actor icons in the YAML dialect (e.g. `icon: lucide/users`).
 * Conventions ban a barrel re-export of `lucide-react`, so this is an
 * explicit, closed map: one named import per icon, one entry per name.
 */
export const LUCIDE_ICONS = {
  server: Server,
  database: Database,
  "hard-drive": HardDrive,
  cloud: Cloud,
  users: Users,
  user: User,
  globe: Globe,
  lock: Lock,
  shield: Shield,
  key: Key,
  network: Network,
  router: Router,
  mail: Mail,
  "message-square": MessageSquare,
  file: File,
  folder: Folder,
  cpu: Cpu,
  layers: Layers,
  box: Box,
  workflow: Workflow,
  "git-branch": GitBranch,
  terminal: Terminal,
  monitor: Monitor,
  smartphone: Smartphone,
  building: Building,
  factory: Factory,
  warehouse: Warehouse,
  plug: Plug,
  cable: Cable,
  radio: Radio,
  activity: Activity,
  "bar-chart": BarChart3,
  table: Table,
  brain: Brain,
  bot: Bot,
  webhook: Webhook,
  timer: Timer,
  calendar: Calendar,
  "alert-triangle": AlertTriangle,
  check: Check,
} as const;

export type LucideIconName = keyof typeof LUCIDE_ICONS;

export interface LucideByNameProps {
  /** A key of {@link LUCIDE_ICONS} (the part after `lucide/` in an icon name). */
  name: string;
  size?: number | string;
  className?: string;
}

/** Renders the mapped Lucide component for `name`, or `null` when `name` is
 *  not in {@link LUCIDE_ICONS} — the caller (`ServiceLogo`'s monogram
 *  fallback path doesn't cover `lucide/*`, so the icon sheet and any node
 *  renderer treat a `null` return as "nothing to draw"). Built with
 *  `createElement` (not JSX) so this file can stay a plain `.ts` module,
 *  matching the item's `touches` list. */
export function LucideByName({ name, size, className }: LucideByNameProps): ReactElement | null {
  const Icon: LucideIcon | undefined = (LUCIDE_ICONS as Record<string, LucideIcon>)[name];
  if (!Icon) return null;
  return createElement(Icon, { size, className });
}
