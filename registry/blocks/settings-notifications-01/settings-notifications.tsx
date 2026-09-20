"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Switch,
} from "@elabs-ai/components-ui";

export type NotificationChannel = "email" | "push" | "chat";

export interface NotificationEvent {
  id: string;
  title: string;
  detail: string;
  /** Cannot be turned off on this channel (security and billing mail, say). */
  locked?: NotificationChannel[];
}

export interface SettingsNotificationsProps {
  events?: NotificationEvent[];
  channels?: { id: NotificationChannel; label: string }[];
  defaultValue?: Record<string, NotificationChannel[]>;
  onChange?: (value: Record<string, NotificationChannel[]>) => void;
}

const DEFAULT_EVENTS: NotificationEvent[] = [
  {
    id: "exception",
    title: "A shipment misses its promise",
    detail: "The moment the estimate passes the promised date.",
  },
  { id: "mention", title: "Someone mentions you", detail: "In a shipment note or an incident." },
  {
    id: "digest",
    title: "Morning digest",
    detail: "What changed overnight, at 07:00 in your time zone.",
  },
  {
    id: "security",
    title: "Security alerts",
    detail: "New sign-ins and changes to your account.",
    locked: ["email"],
  },
  {
    id: "billing",
    title: "Invoices and failed payments",
    detail: "Sent to workspace owners and admins.",
    locked: ["email"],
  },
];

const DEFAULT_VALUE: Record<string, NotificationChannel[]> = {
  exception: ["email", "push"],
  mention: ["push", "chat"],
  digest: ["email"],
  security: ["email", "push"],
  billing: ["email"],
};

/**
 * Notifications — a matrix of what against where. Every switch has a full accessible name,
 * and a locked cell says why it is locked instead of looking broken.
 */
export function SettingsNotifications({
  events = DEFAULT_EVENTS,
  channels = [
    { id: "email", label: "Email" },
    { id: "push", label: "Push" },
    { id: "chat", label: "Chat" },
  ],
  defaultValue = DEFAULT_VALUE,
  onChange,
}: SettingsNotificationsProps) {
  const [value, setValue] = useState(defaultValue);
  const toggle = (eventId: string, channel: NotificationChannel, on: boolean) => {
    const current = value[eventId] ?? [];
    const next = {
      ...value,
      [eventId]: on ? [...current, channel] : current.filter((c) => c !== channel),
    };
    setValue(next);
    onChange?.(next);
  };
  const quiet = events.filter((event) => (value[event.id] ?? []).length === 0);

  return (
    <Card className="mx-auto w-full max-w-3xl" data-slot="settings-notifications">
      <CardHeader>
        <CardTitle>Notifications</CardTitle>
        <CardDescription>
          {quiet.length === 0
            ? "Everything reaches you somewhere."
            : `${quiet.length === 1 ? "One thing reaches" : `${quiet.length} things reach`} you nowhere: ${quiet
                .map((event) => event.title.toLowerCase())
                .join("; ")}.`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <table className="w-full border-separate border-spacing-0">
          <caption className="sr-only">Which events notify you on which channel</caption>
          <thead>
            <tr>
              <th
                className="pb-3 text-start text-meta font-medium text-muted-foreground"
                scope="col"
              >
                Event
              </th>
              {channels.map((channel) => (
                <th
                  className="w-20 pb-3 text-center text-meta font-medium text-muted-foreground"
                  key={channel.id}
                  scope="col"
                >
                  {channel.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {events.map((event) => (
              <tr key={event.id}>
                <th className="border-t border-border py-3 pe-4 text-start font-normal" scope="row">
                  <span className="block text-body font-medium">{event.title}</span>
                  <span className="block text-meta text-muted-foreground">{event.detail}</span>
                </th>
                {channels.map((channel) => {
                  const locked = event.locked?.includes(channel.id) ?? false;
                  return (
                    <td className="border-t border-border py-3 text-center" key={channel.id}>
                      <Switch
                        aria-label={`${event.title}, by ${channel.label.toLowerCase()}${locked ? " (always on)" : ""}`}
                        checked={locked || (value[event.id] ?? []).includes(channel.id)}
                        disabled={locked}
                        onCheckedChange={(on) => toggle(event.id, channel.id, on)}
                        title={
                          locked ? "Always on: we must be able to reach you about this." : undefined
                        }
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
