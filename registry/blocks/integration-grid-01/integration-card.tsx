"use client";

import { Badge, Button, Card, CardContent, CardFooter } from "@elabs-ai/components-ui";
import type { Integration } from "./data/integrations";

export interface IntegrationCardProps {
  integration: Integration;
}

/** One connect-your-tools card: icon/logo + name + description + connection status + action. */
export function IntegrationCard({ integration }: IntegrationCardProps) {
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
