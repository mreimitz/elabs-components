"use client";

import type { ReactNode } from "react";
import {
  Button,
  Card,
  EmptyListIllustration,
  ErrorIllustration,
  FirstRunIllustration,
  NoAccessIllustration,
  NoResultsIllustration,
  OfflineIllustration,
  StatePanel,
} from "@elabs-ai/components-ui";

export type EmptyStateKind =
  | "first-run"
  | "no-results"
  | "empty-list"
  | "error"
  | "offline"
  | "no-access";

export interface EmptyStateScreenProps {
  kind: EmptyStateKind;
  /** The primary way out. Omit it and the state offers only the secondary one. */
  onPrimary?: () => void;
  onSecondary?: () => void;
  /** What was searched for, quoted back in the no-results state. */
  query?: string;
  className?: string;
}

const COPY: Record<
  EmptyStateKind,
  {
    title: (query?: string) => string;
    description: string;
    primary: string;
    secondary?: string;
    panel: "empty" | "error";
    art: ReactNode;
  }
> = {
  "first-run": {
    title: () => "Plan your first route",
    description:
      "Import last week's orders and see the plan we would have made. It takes about ten minutes.",
    primary: "Import orders",
    secondary: "Use sample data",
    panel: "empty",
    art: <FirstRunIllustration />,
  },
  "no-results": {
    title: (query) => (query ? `Nothing matches “${query}”` : "Nothing matches these filters"),
    description:
      "Check the spelling, or clear a filter — references are matched exactly, names loosely.",
    primary: "Clear filters",
    panel: "empty",
    art: <NoResultsIllustration />,
  },
  "empty-list": {
    title: () => "No exceptions today",
    description:
      "Every shipment is inside its promise. New exceptions appear here the moment one slips.",
    primary: "See all shipments",
    panel: "empty",
    art: <EmptyListIllustration />,
  },
  error: {
    title: () => "We could not load your shipments",
    description:
      "Nothing is lost — the data is safe and this is on our side. Try again, or check the status page.",
    primary: "Try again",
    secondary: "Open the status page",
    panel: "error",
    art: <ErrorIllustration />,
  },
  offline: {
    title: () => "You are offline",
    description: "You can keep scanning. Everything syncs when the connection is back.",
    primary: "Retry now",
    panel: "empty",
    art: <OfflineIllustration />,
  },
  "no-access": {
    title: () => "You do not have access to Billing",
    description:
      "Only owners and admins can see invoices. Ask Ada Okonkwo, the workspace owner, for the Admin role.",
    primary: "Request access",
    secondary: "Go back",
    panel: "empty",
    art: <NoAccessIllustration />,
  },
};

/**
 * One state a screen can be in when it has nothing to show — each says what happened, whether
 * anything is lost, and the way out. Six kinds, one component, so an app's empty screens read
 * as one family.
 */
export function EmptyStateScreen({
  kind,
  onPrimary,
  onSecondary,
  query,
  className,
}: EmptyStateScreenProps) {
  const copy = COPY[kind];
  return (
    <StatePanel
      actions={
        <>
          <Button onClick={onPrimary}>{copy.primary}</Button>
          {copy.secondary ? (
            <Button onClick={onSecondary} variant="outline">
              {copy.secondary}
            </Button>
          ) : null}
        </>
      }
      className={className}
      description={copy.description}
      illustration={copy.art}
      kind={copy.panel}
      title={copy.title(query)}
      titleAs="h2"
    />
  );
}

/** All six, side by side — the reference sheet. */
export function EmptyStates() {
  return (
    <div className="@container" data-slot="empty-states">
      <ul className="grid grid-cols-1 gap-4 @3xl:grid-cols-2 @6xl:grid-cols-3">
        {(Object.keys(COPY) as EmptyStateKind[]).map((kind) => (
          <li key={kind}>
            <Card className="h-full p-6">
              <EmptyStateScreen
                kind={kind}
                query={kind === "no-results" ? "SH-99999" : undefined}
              />
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
