"use client";

import { Button, useLocale } from "@elabs-ai/components-ui";
import { cn } from "@elabs-ai/components-ui/lib/cn";
import Ansi from "ansi-to-react";
import "./terminal-ansi.css";
import { CheckIcon, CopyIcon, TerminalIcon, Trash2Icon } from "lucide-react";
import type { ComponentProps, HTMLAttributes } from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

interface TerminalContextType {
  output: string;
  isStreaming: boolean;
  autoScroll: boolean;
  onClear?: () => void;
}

const TerminalContext = createContext<TerminalContextType>({
  autoScroll: true,
  isStreaming: false,
  output: "",
});

export type TerminalHeaderProps = HTMLAttributes<HTMLDivElement>;

export const TerminalHeader = ({ className, children, ...props }: TerminalHeaderProps) => (
  <div
    className={cn(
      "flex items-center justify-between border-terminal-border border-b px-4 py-2",
      className,
    )}
    data-slot="terminal-header"
    {...props}
  >
    {children}
  </div>
);

export type TerminalTitleProps = HTMLAttributes<HTMLDivElement>;

export const TerminalTitle = ({ className, children, ...props }: TerminalTitleProps) => (
  <div
    className={cn("flex items-center gap-2 text-body text-terminal-muted", className)}
    data-slot="terminal-title"
    {...props}
  >
    <TerminalIcon className="size-4" />
    {children ?? "Terminal"}
  </div>
);

export type TerminalStatusProps = HTMLAttributes<HTMLDivElement>;

export const TerminalStatus = ({ className, children, ...props }: TerminalStatusProps) => {
  const { isStreaming } = useContext(TerminalContext);

  if (!isStreaming) {
    return null;
  }

  return (
    <div
      className={cn("flex items-center gap-2 text-meta text-terminal-muted", className)}
      data-slot="terminal-status"
      {...props}
    >
      {children}
    </div>
  );
};

export type TerminalActionsProps = HTMLAttributes<HTMLDivElement>;

export const TerminalActions = ({ className, children, ...props }: TerminalActionsProps) => (
  <div className={cn("flex items-center gap-1", className)} data-slot="terminal-actions" {...props}>
    {children}
  </div>
);

export type TerminalCopyButtonProps = ComponentProps<typeof Button> & {
  onCopy?: () => void;
  onError?: (error: Error) => void;
  timeout?: number;
};

export const TerminalCopyButton = ({
  onCopy,
  onError,
  timeout = 2000,
  children,
  className,
  ...props
}: TerminalCopyButtonProps) => {
  const { t } = useLocale();
  const [isCopied, setIsCopied] = useState(false);
  const timeoutRef = useRef<number>(0);
  const { output } = useContext(TerminalContext);

  const copyToClipboard = useCallback(async () => {
    if (typeof window === "undefined" || !navigator?.clipboard?.writeText) {
      onError?.(new Error("Clipboard API not available"));
      return;
    }

    try {
      await navigator.clipboard.writeText(output);
      setIsCopied(true);
      onCopy?.();
      timeoutRef.current = window.setTimeout(() => setIsCopied(false), timeout);
    } catch (error) {
      onError?.(error as Error);
    }
  }, [output, onCopy, onError, timeout]);

  useEffect(
    () => () => {
      window.clearTimeout(timeoutRef.current);
    },
    [],
  );

  const Icon = isCopied ? CheckIcon : CopyIcon;

  return (
    <Button
      aria-label={t("copy")}
      className={cn(
        "size-7 shrink-0 text-terminal-muted hover:bg-terminal-selection hover:text-terminal-foreground",
        className,
      )}
      data-slot="terminal-copy-button"
      onClick={copyToClipboard}
      size="icon"
      title={t("copy")}
      variant="ghost"
      {...props}
    >
      {children ?? <Icon size={14} />}
    </Button>
  );
};

export type TerminalClearButtonProps = ComponentProps<typeof Button>;

export const TerminalClearButton = ({
  children,
  className,
  ...props
}: TerminalClearButtonProps) => {
  const { onClear } = useContext(TerminalContext);

  if (!onClear) {
    return null;
  }

  // No generic "clear" key exists yet in @elabs-ai/components-ui's messages.ts
  // (that file is out of scope for the #116 move) — literal until a follow-up
  // adds one and this can become `t("clear")` like TerminalCopyButton's `t("copy")`.
  return (
    <Button
      aria-label="Clear" // i18n-exempt: see note above — no generic "clear" locale key yet
      className={cn(
        "size-7 shrink-0 text-terminal-muted hover:bg-terminal-selection hover:text-terminal-foreground",
        className,
      )}
      data-slot="terminal-clear-button"
      onClick={onClear}
      size="icon"
      title="Clear" // i18n-exempt: see note above — no generic "clear" locale key yet
      variant="ghost"
      {...props}
    >
      {children ?? <Trash2Icon size={14} />}
    </Button>
  );
};

export type TerminalContentProps = HTMLAttributes<HTMLDivElement>;

export const TerminalContent = ({ className, children, ...props }: TerminalContentProps) => {
  const { output, isStreaming, autoScroll } = useContext(TerminalContext);
  const { t } = useLocale();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoScroll && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [output, autoScroll]);

  return (
    <div
      className={cn("max-h-96 overflow-auto p-4 font-mono text-code leading-relaxed", className)}
      data-slot="terminal-content"
      ref={containerRef}
      {...props}
    >
      {/*
       * The ONE live region for this component's `isStreaming` rung
       * (`loading-states.md`: exactly one per not-ready region, never one per
       * box). It is mounted unconditionally and its TEXT is what changes,
       * because a live region has to exist before its content changes for the
       * change to be announced reliably. It sits outside `children` so a
       * caller who replaces the default `<pre>` still gets it.
       *
       * Without it the only streaming signal is the blinking cursor block
       * below, which is purely visual — a screen-reader user attached to a
       * running build or deploy log had no indication anything was arriving.
       */}
      <span role="status" aria-live="polite" className="sr-only">
        {isStreaming ? t("terminal.output.streaming") : ""}
      </span>
      {children ?? (
        <pre className="whitespace-pre-wrap break-words">
          {/* `useClasses` swaps ansi-to-react's default inline `rgb(...)` styles
              (anser's own hardcoded palette) for `ansi-<name>-fg`/`-bg` classes,
              which terminal-ansi.css maps onto `--terminal-ansi-*` — see that
              file's header. Without it ANSI colour is themeless (issue #115
              defect 2). */}
          <Ansi useClasses>{output}</Ansi>
          {isStreaming && (
            <span className="ml-0.5 inline-block h-4 w-2 animate-pulse bg-terminal-cursor" />
          )}
        </pre>
      )}
    </div>
  );
};

export type TerminalProps = HTMLAttributes<HTMLDivElement> & {
  output: string;
  isStreaming?: boolean;
  autoScroll?: boolean;
  onClear?: () => void;
};

export const Terminal = ({
  output,
  isStreaming = false,
  autoScroll = true,
  onClear,
  className,
  children,
  ...props
}: TerminalProps) => {
  const contextValue = useMemo(
    () => ({ autoScroll, isStreaming, onClear, output }),
    [autoScroll, isStreaming, onClear, output],
  );

  return (
    <TerminalContext.Provider value={contextValue}>
      <div
        className={cn(
          "flex flex-col overflow-hidden rounded-lg border border-terminal-border bg-terminal-background text-terminal-foreground shadow-sm",
          className,
        )}
        data-slot="terminal"
        {...props}
      >
        {children ?? (
          <>
            <TerminalHeader>
              <TerminalTitle />
              <div className="flex items-center gap-1">
                <TerminalStatus />
                <TerminalActions>
                  <TerminalCopyButton />
                  {onClear && <TerminalClearButton />}
                </TerminalActions>
              </div>
            </TerminalHeader>
            <TerminalContent />
          </>
        )}
      </div>
    </TerminalContext.Provider>
  );
};
