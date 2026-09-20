"use client";

/**
 * PromptCard — a multi-line prompt a visitor copies into their coding agent. `CommandChip` is a
 * single line; a prompt is a short brief, so it gets a readable block and one copy button.
 * A site-local composition of library parts (Card, Button, useCopyToClipboard) — no new styles.
 */
import { Check, Copy } from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  useCopyToClipboard,
} from "@elabs-ai/components-ui";
import { cn } from "@elabs-ai/components-ui/lib/cn";
import { startCopy } from "../../content/start-copy";

const copy = startCopy.prompt;

export function PromptCard({
  prompt,
  title = copy.title,
  hint = copy.hint,
  compact = false,
  className,
}: {
  prompt: string;
  title?: string;
  hint?: string;
  /** Detail pages: the prompt is secondary to the examples, so it scrolls in a short box. */
  compact?: boolean;
  className?: string;
}) {
  const { copied, copy: copyText } = useCopyToClipboard();
  return (
    <Card data-slot="prompt-card" className={className}>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <CardTitle>{title}</CardTitle>
          <CardDescription>{hint}</CardDescription>
        </div>
        <Button
          type="button"
          size="sm"
          onClick={() => void copyText(prompt)}
          aria-live="polite"
          className="shrink-0"
        >
          {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
          {copied ? copy.copied : copy.copy}
        </Button>
      </CardHeader>
      <CardContent>
        {/* tabIndex: a scrollable region must be reachable by keyboard. */}
        <pre
          tabIndex={0}
          aria-label={title}
          className={cn(
            "overflow-auto rounded-md border border-border bg-muted p-4 font-mono text-meta whitespace-pre-wrap text-foreground focus-ring",
            compact && "max-h-48",
          )}
        >
          {prompt}
        </pre>
      </CardContent>
    </Card>
  );
}
