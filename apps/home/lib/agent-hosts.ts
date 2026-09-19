/**
 * Per-host forms around the generated install commands/URL (`install.json` carries the Claude
 * Code and stdio forms; the host wrappers are each host's own documented syntax). Shared by the
 * hero's command chip and the shell's agent dock.
 */
import { install } from "./content";
import { heroCopy } from "../content/copy";

export const AGENT_HOSTS = [
  { id: "claude-code", label: heroCopy.chip.hosts.claudeCode, command: install.hostedMcp.command },
  { id: "cursor", label: heroCopy.chip.hosts.cursor, command: install.localMcp.command },
  {
    id: "vscode",
    label: heroCopy.chip.hosts.vscode,
    command: `code --add-mcp '${JSON.stringify({ name: "brand-ui", type: "http", url: install.hostedMcp.url })}'`,
  },
  {
    id: "codex",
    label: heroCopy.chip.hosts.codex,
    command: `codex mcp add brand-ui -- ${install.localMcp.command}`,
  },
  { id: "url", label: heroCopy.chip.hosts.url, command: install.hostedMcp.url },
];
