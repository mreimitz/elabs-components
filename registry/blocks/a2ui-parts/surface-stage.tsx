"use client";

/**
 * One agent turn on screen: the surface as it streams in, a status line that says what state it
 * is in, and a replay control. Everything inside the frame is drawn by `A2uiSurface` from data —
 * the stage adds no pixels to it.
 */
import { A2uiSurface, type A2uiActionHandler, type A2uiSurfaceSpec } from "@elabs-ai/components-ai";
import { Badge, Button, Progress } from "@elabs-ai/components-ui";
import { cn } from "@elabs-ai/components-ui/lib/cn";
import { RotateCcw, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import { showcaseCatalog } from "@/components/a2ui-parts/catalog";
import {
  useStreamedSurface,
  type StreamedSurface,
} from "@/components/a2ui-parts/use-streamed-surface";

export interface SurfaceStageProps {
  /** Who is speaking and about what ("Support agent · refund R-2207"). */
  label: string;
  spec: A2uiSurfaceSpec;
  onAction?: A2uiActionHandler;
  /** Stream on mount and on every new spec. Default `true`. */
  stream?: boolean;
  /** Receives the stream, e.g. to show the same JSON in a pane beside the stage. */
  children?: (stream: StreamedSurface) => ReactNode;
  className?: string;
  surfaceClassName?: string;
}

export function SurfaceStage({
  label,
  spec,
  onAction,
  stream = true,
  children,
  className,
  surfaceClassName,
}: SurfaceStageProps) {
  const streamed = useStreamedSurface(spec, { autoStart: stream });
  return (
    <section
      aria-label={label}
      className={cn("flex min-w-0 flex-col gap-3", className)}
      data-slot="a2ui-surface-stage"
    >
      <header className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 text-body-sm font-semibold text-foreground">
          <Sparkles aria-hidden="true" className="size-4 text-primary" />
          {label}
        </span>
        <Badge variant={streamed.isStreaming ? "info" : "success"}>
          {streamed.isStreaming
            ? `Streaming · ${Math.round(streamed.progress * 100)} %`
            : "Validated · rendered"}
        </Badge>
        <Button
          className="ms-auto"
          disabled={streamed.isStreaming}
          onClick={streamed.replay}
          size="sm"
          variant="ghost"
        >
          <RotateCcw aria-hidden="true" />
          Replay
        </Button>
      </header>
      <Progress
        aria-label="Surface received"
        className={cn("h-1", streamed.isStreaming ? "opacity-100" : "opacity-0")}
        value={Math.round(streamed.progress * 100)}
      />
      <div className="flex min-w-0 flex-col gap-4 @3xl:flex-row">
        <A2uiSurface
          catalog={showcaseCatalog}
          className={cn("min-w-0 flex-1", surfaceClassName)}
          isStreaming={streamed.isStreaming}
          onAction={onAction}
          surface={streamed.text}
        />
        {children ? children(streamed) : null}
      </div>
    </section>
  );
}
