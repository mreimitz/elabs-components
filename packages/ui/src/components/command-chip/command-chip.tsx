"use client";

import { forwardRef, useRef, useState, type HTMLAttributes } from "react";
import { Check, ChevronDown, Copy } from "lucide-react";
import { cn } from "../../lib/cn";
import { useControllableState } from "../../lib/use-controllable-state";
import { useCopyToClipboard } from "../../lib/use-copy-to-clipboard";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "../dropdown-menu";

/** One install target: the host a visitor runs the command in, and the exact command. */
export interface CommandChipHost {
  /** Stable id, reported to `onValueChange`. */
  id: string;
  /** Host name shown in the menu and on the trigger. */
  label: string;
  /** The exact text shown in the chip and written to the clipboard. */
  command: string;
}

/** Every string the chip renders — pass your own to localize it. */
export interface CommandChipLabels {
  /** Accessible name of the copy button. */
  copy: string;
  /** Announced (and shown to sighted users as the check icon) after a successful copy. */
  copied: string;
  /** Announced when the clipboard is unavailable and the command is selected instead. */
  selectFallback: string;
  /** Accessible name prefix of the host trigger (the current host follows it). */
  chooseHost: string;
  /** Heading of the host menu. */
  menuLabel: string;
}

export const DEFAULT_COMMAND_CHIP_LABELS: CommandChipLabels = {
  copy: "Copy command",
  copied: "Copied",
  selectFallback: "Command selected — press Ctrl+C or ⌘C to copy",
  chooseHost: "Install for",
  menuLabel: "Install for",
};

export interface CommandChipProps extends Omit<HTMLAttributes<HTMLDivElement>, "onCopy"> {
  /** The hosts to choose between; the first is the default selection. */
  hosts: CommandChipHost[];
  /** Selected host id (controlled). */
  value?: string;
  /** Initially selected host id (uncontrolled). Default: the first host. */
  defaultValue?: string;
  /** Fires when the visitor picks another host. */
  onValueChange?: (id: string) => void;
  /** Fires after a copy attempt with the command and whether the clipboard accepted it. */
  onCopyCommand?: (command: string, copied: boolean) => void;
  /** Override any rendered string. */
  labels?: Partial<CommandChipLabels>;
}

/**
 * A one-line install command in a monospace chip: pick the host (Claude Code, Cursor, …) from a
 * menu, copy the exact command. When the page has no clipboard access (insecure origin, denied
 * permission) the command text is selected instead so the visitor can copy it by hand; either
 * outcome is announced through an always-mounted live region.
 */
export const CommandChip = forwardRef<HTMLDivElement, CommandChipProps>(function CommandChip(
  {
    hosts,
    value,
    defaultValue,
    onValueChange,
    onCopyCommand,
    labels: labelsProp,
    className,
    ...props
  },
  ref,
) {
  const labels = { ...DEFAULT_COMMAND_CHIP_LABELS, ...labelsProp };
  const [selectedId, setSelectedId] = useControllableState(
    value,
    defaultValue ?? hosts[0]?.id ?? "",
    onValueChange,
  );
  const host = hosts.find((h) => h.id === selectedId) ?? hosts[0];
  const { copied, copy } = useCopyToClipboard();
  const commandRef = useRef<HTMLElement>(null);
  const [selectedManually, setSelectedManually] = useState(false);

  if (!host) return null;

  const onCopy = () => {
    void copy(host.command).then((ok) => {
      setSelectedManually(!ok);
      if (!ok && commandRef.current && typeof window !== "undefined") {
        // No clipboard here: select the command so a manual copy takes one keystroke.
        const selection = window.getSelection();
        selection?.selectAllChildren(commandRef.current);
      }
      onCopyCommand?.(host.command, ok);
    });
  };

  return (
    <div
      ref={ref}
      data-slot="command-chip"
      data-copied={copied ? "" : undefined}
      className={cn(
        "inline-flex max-w-full min-w-0 items-center gap-1 rounded-md border border-input bg-card p-1 shadow-xs",
        className,
      )}
      {...props}
    >
      {hosts.length > 1 ? (
        <DropdownMenu>
          <DropdownMenuTrigger
            data-slot="command-chip-host"
            aria-label={`${labels.chooseHost}: ${host.label}`}
            className="inline-flex shrink-0 items-center gap-1 rounded-sm px-2 py-1 text-meta text-muted-foreground hover:bg-accent hover:text-accent-foreground focus-ring"
          >
            {host.label}
            <ChevronDown aria-hidden="true" className="size-3.5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuLabel>{labels.menuLabel}</DropdownMenuLabel>
            <DropdownMenuRadioGroup value={host.id} onValueChange={setSelectedId}>
              {hosts.map((h) => (
                <DropdownMenuRadioItem key={h.id} value={h.id}>
                  {h.label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
      <code
        ref={commandRef}
        data-slot="command-chip-command"
        // translate="no" so browser page-translation never mangles a shell command
        // before a visitor pastes it (same precedent as Kbd, LinkPreview's domain span).
        translate="no"
        className="min-w-0 flex-1 truncate px-2 font-mono text-code text-foreground"
        title={host.command}
      >
        {host.command}
      </code>
      <button
        type="button"
        data-slot="command-chip-copy"
        aria-label={labels.copy}
        onClick={onCopy}
        className="inline-flex size-7 shrink-0 items-center justify-center rounded-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground focus-ring"
      >
        {copied ? (
          <Check aria-hidden="true" className="size-4" />
        ) : (
          <Copy aria-hidden="true" className="size-4" />
        )}
      </button>
      {/* Always mounted so the announcement is not missed (ARIA22); only its text changes. */}
      <span role="status" aria-live="polite" className="sr-only" data-slot="command-chip-status">
        {copied ? labels.copied : selectedManually ? labels.selectFallback : ""}
      </span>
    </div>
  );
});
