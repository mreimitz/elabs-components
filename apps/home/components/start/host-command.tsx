"use client";

/** The hosted-MCP line per host — the same chip the hero and the agent dock show. */
import { CommandChip } from "@elabs-ai/components-ui";
import { AGENT_HOSTS } from "../../lib/agent-hosts";
import { heroCopy } from "../../content/copy";

export function HostCommand() {
  const { chip } = heroCopy;
  return (
    <CommandChip
      aria-label={chip.label}
      hosts={AGENT_HOSTS}
      labels={{
        copy: chip.copy,
        copied: chip.copied,
        selectFallback: chip.selectFallback,
        chooseHost: chip.chooseHost,
        menuLabel: chip.menuLabel,
      }}
      className="w-full"
    />
  );
}
