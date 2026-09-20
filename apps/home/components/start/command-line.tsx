"use client";

/**
 * CommandLine — one copyable command offered for pnpm and npm. `CommandChip`'s host chooser is
 * the package-manager switch, so a visitor without pnpm is never handed a command that fails.
 */
import { CommandChip } from "@elabs-ai/components-ui";
import { heroCopy } from "../../content/copy";
import { startCopy } from "../../content/start-copy";

export function CommandLine({
  label,
  command,
  npm,
}: {
  label: string;
  command: string;
  /** The npm form; omit for a command that is the same in both (npx, /plugin …). */
  npm?: string;
}) {
  const hosts = npm
    ? [
        { id: "npm", label: "npm", command: npm },
        { id: "pnpm", label: "pnpm", command },
      ]
    : [{ id: "cmd", label, command }];
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-meta font-semibold text-muted-foreground">{label}</span>
      <CommandChip
        aria-label={label}
        hosts={hosts}
        labels={{
          copy: heroCopy.chip.copy,
          copied: heroCopy.chip.copied,
          selectFallback: heroCopy.chip.selectFallback,
          chooseHost: npm ? startCopy.routes.pm : label,
          menuLabel: npm ? startCopy.routes.pm : label,
        }}
        className="w-full"
      />
    </div>
  );
}
