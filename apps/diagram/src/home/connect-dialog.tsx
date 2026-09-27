/**
 * DG-23 — "Connect an LLM" (R1 scope box, kept). Every string it shows comes from
 * `connect-info.ts`, which copies `mcp/README.md` (DG-35): the endpoint, the Claude Code
 * command, the Claude Desktop `mcp-remote` config, and the prompts the server actually serves.
 */
import {
  Button,
  CommandChip,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogSection,
  DialogTitle,
  DialogTrigger,
  Text,
  useCopyToClipboard,
} from "@elabs-ai/components-ui";
import { Check, Copy, Plug } from "lucide-react";
import {
  ATLAS_MCP_URL,
  ATLAS_PROMPTS,
  CLAUDE_CODE_COMMAND,
  CLAUDE_DESKTOP_CONFIG,
} from "./connect-info";

/** The dialog's strings, in one place (`conventions/i18n-strings`). */
export const CONNECT_LABELS = {
  trigger: "Connect an LLM",
  title: "Connect an LLM",
  description:
    "Atlas is also an MCP server: point an LLM session at it to read, write and validate the diagrams in this workspace.",
  serverUrl: "Server URL",
  copyServerUrl: "Copy server URL",
  claudeCode: "Claude Code",
  claudeCodeDescription: "Run this once in a terminal.",
  copyClaudeCode: "Copy Claude Code command",
  claudeDesktop: "Claude Desktop",
  claudeDesktopHint: "Add this to claude_desktop_config.json, then restart Claude Desktop.",
  copyClaudeDesktopConfig: "Copy Claude Desktop config",
  copied: "Copied",
  prompts: "Prompts",
} as const;

interface SnippetBlockProps {
  text: string;
  label: string;
  copyLabel: string;
}

/** A multi-line block with its own named copy button (`CommandChip` only copies one line). */
function SnippetBlock({ text, label, copyLabel }: SnippetBlockProps) {
  const { copied, copy } = useCopyToClipboard();
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-start gap-2 rounded-md border border-input bg-card p-3 shadow-xs">
        <Text
          variant="code"
          as="div"
          role="region"
          aria-label={label}
          tabIndex={0}
          translate="no"
          className="min-w-0 flex-1 overflow-x-auto whitespace-pre focus-ring-inset"
        >
          {text}
        </Text>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={copyLabel}
          onClick={() => void copy(text)}
        >
          {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
        </Button>
      </div>
      <span role="status" aria-live="polite" className="sr-only">
        {copied ? CONNECT_LABELS.copied : ""}
      </span>
    </div>
  );
}

/** `<name> <required-arg> [optional-arg]`, code-styled (a client's prompt picker shorthand). */
function promptSignature(prompt: (typeof ATLAS_PROMPTS)[number]): string {
  const args = prompt.arguments
    .map((argument) => (argument.required ? `<${argument.name}>` : `[${argument.name}]`))
    .join(" ");
  return args === "" ? prompt.name : `${prompt.name} ${args}`;
}

/** "Connect an LLM" (plan V14): the MCP endpoint, two client snippets and the prompts. */
export function ConnectDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Plug aria-hidden="true" />
          {CONNECT_LABELS.trigger}
        </Button>
      </DialogTrigger>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{CONNECT_LABELS.title}</DialogTitle>
          <DialogDescription>{CONNECT_LABELS.description}</DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-6">
          <DialogSection title={CONNECT_LABELS.serverUrl}>
            <CommandChip
              hosts={[{ id: "server", label: CONNECT_LABELS.serverUrl, command: ATLAS_MCP_URL }]}
              labels={{ copy: CONNECT_LABELS.copyServerUrl, copied: CONNECT_LABELS.copied }}
            />
          </DialogSection>
          <DialogSection
            title={CONNECT_LABELS.claudeCode}
            description={CONNECT_LABELS.claudeCodeDescription}
          >
            <CommandChip
              hosts={[
                {
                  id: "claude-code",
                  label: CONNECT_LABELS.claudeCode,
                  command: CLAUDE_CODE_COMMAND,
                },
              ]}
              labels={{ copy: CONNECT_LABELS.copyClaudeCode, copied: CONNECT_LABELS.copied }}
            />
          </DialogSection>
          <DialogSection
            title={CONNECT_LABELS.claudeDesktop}
            description={CONNECT_LABELS.claudeDesktopHint}
          >
            <SnippetBlock
              text={CLAUDE_DESKTOP_CONFIG}
              label={CONNECT_LABELS.claudeDesktop}
              copyLabel={CONNECT_LABELS.copyClaudeDesktopConfig}
            />
          </DialogSection>
          <DialogSection title={CONNECT_LABELS.prompts}>
            <ul className="flex flex-col gap-3">
              {ATLAS_PROMPTS.map((prompt) => (
                <li key={prompt.name}>
                  <Text variant="code" as="div" translate="no" className="text-foreground">
                    {promptSignature(prompt)}
                  </Text>
                  <Text variant="caption" tone="muted">
                    {prompt.description}
                  </Text>
                </li>
              ))}
            </ul>
          </DialogSection>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
