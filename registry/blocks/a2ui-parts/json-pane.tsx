"use client";

/**
 * The wire view: the JSON an agent has sent so far, with a caret while it is still arriving.
 * Follows the tail while streaming, so the newest tokens stay in view.
 */
import { cn } from "@elabs-ai/components-ui/lib/cn";
import { useEffect, useRef } from "react";

export function JsonPane({
  text,
  isStreaming = false,
  label = "Surface JSON",
  className,
}: {
  text: string;
  isStreaming?: boolean;
  label?: string;
  className?: string;
}) {
  const ref = useRef<HTMLPreElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (el && isStreaming) el.scrollTop = el.scrollHeight;
  }, [text, isStreaming]);
  return (
    <pre
      aria-label={label}
      className={cn(
        "h-full overflow-auto bg-surface-muted p-3 text-code leading-relaxed text-foreground focus-ring-inset",
        className,
      )}
      ref={ref}
      // Scrollable region: reachable by keyboard.
      tabIndex={0}
    >
      <code>{text}</code>
      {isStreaming ? (
        <span
          aria-hidden="true"
          className="ms-0.5 inline-block h-4 w-2 animate-pulse bg-primary align-text-bottom motion-reduce:animate-none"
        />
      ) : null}
    </pre>
  );
}
