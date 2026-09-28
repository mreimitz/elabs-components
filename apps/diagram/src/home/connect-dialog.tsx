/**
 * DG-23 — "Connect an LLM" (R1 scope box, kept). Every string it shows comes from
 * `connect-info.ts`, which copies `mcp/README.md` (DG-35): the endpoint, the Claude Code
 * command, the Claude Desktop `mcp-remote` config, and the prompts the server actually serves.
 */
import { useEffect, useRef, useState } from "react";
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
  selectFallback: "Selected — press Ctrl+C or ⌘C to copy",
} as const;

interface SnippetBlockProps {
  text: string;
  copyLabel: string;
}

/** How long the "Selected — press Ctrl+C…" status stays before clearing itself. */
const SELECT_FALLBACK_TIMEOUT_MS = 4000;

/**
 * A multi-line block with its own named copy button (`CommandChip` only copies one line). Always
 * wraps (`whitespace-pre-wrap break-words`) instead of scrolling: a fixed-width dialog can always
 * fit an arbitrarily long command or URL by wrapping, but a horizontal scrollbar most platforms
 * hide cannot, so readable text beats preserved JSON indentation. Nothing here scrolls, so there
 * is no `role="region"`/`tabIndex` scroll-region pattern to add. When the clipboard is unavailable,
 * it selects its own text instead: a manual copy then takes one keystroke, the same fallback
 * `CommandChip` offers. That status clears itself after `SELECT_FALLBACK_TIMEOUT_MS` — otherwise
 * it would stay on screen indefinitely once the person has moved on (e.g. to copy the other
 * snippet in this dialog instead).
 */
function SnippetBlock({ text, copyLabel }: SnippetBlockProps) {
  const { copied, copy } = useCopyToClipboard();
  // `Text`'s ref types to its default element; it renders a <div> here (`as="div"`).
  const textRef = useRef<HTMLParagraphElement>(null);
  const [selectedManually, setSelectedManually] = useState(false);
  useEffect(() => {
    if (!selectedManually) return;
    const timer = window.setTimeout(() => setSelectedManually(false), SELECT_FALLBACK_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [selectedManually]);
  const onCopy = () => {
    void copy(text).then((ok) => {
      setSelectedManually(!ok);
      if (!ok && textRef.current && typeof window !== "undefined") {
        window.getSelection()?.selectAllChildren(textRef.current);
      }
    });
  };
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-start gap-2 rounded-md border border-input bg-card p-3 shadow-xs">
        <Text
          ref={textRef}
          variant="code"
          as="div"
          translate="no"
          className="min-w-0 flex-1 whitespace-pre-wrap break-words"
        >
          {text}
        </Text>
        <Button variant="ghost" size="icon-sm" aria-label={copyLabel} onClick={onCopy}>
          {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
        </Button>
      </div>
      {/* Always mounted so the announcement is not missed; only its text changes. */}
      <span role="status" aria-live="polite" className="sr-only">
        {copied ? CONNECT_LABELS.copied : selectedManually ? CONNECT_LABELS.selectFallback : ""}
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
      <DialogContent size="xl">
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
            {/* SnippetBlock, not CommandChip: the command is longer than the dialog is wide, and
                CommandChip always truncates it (no way to read what is about to run). */}
            <SnippetBlock text={CLAUDE_CODE_COMMAND} copyLabel={CONNECT_LABELS.copyClaudeCode} />
          </DialogSection>
          <DialogSection
            title={CONNECT_LABELS.claudeDesktop}
            description={CONNECT_LABELS.claudeDesktopHint}
          >
            <SnippetBlock
              text={CLAUDE_DESKTOP_CONFIG}
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
