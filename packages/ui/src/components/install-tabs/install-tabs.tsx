"use client";

/**
 * InstallTabs — every way to bring brand-ui in, one tab strip.
 *
 * Ships no site copy, no URL and no install command of its own (`i18n-strings`,
 * `remote-origins`): every command, option and prompt is a prop. `TabsList`'s
 * `overflow-x-auto` (shared by every `Tabs` variant) makes the strip scroll
 * horizontally once it no longer fits — no bespoke mobile layout needed.
 */
import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "../../lib/cn";
import { useControllableState } from "../../lib/use-controllable-state";
import { Button } from "../button";
import { CommandChip } from "../command-chip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../tabs";
import { Textarea } from "../textarea";
import { useCopyToClipboard } from "../../lib/use-copy-to-clipboard";

/** One option in the `pnpm add` or `Copy-own` select — the exact command it resolves to. */
export interface InstallTabsSelectOption {
  id: string;
  label: string;
  command: string;
}

/** One host-specific tab (Claude Code, Cursor, …), one or more commands top to bottom. */
export interface InstallTabsHostTab {
  id: string;
  label: string;
  commands: { label: string; command: string }[];
}

export interface InstallTabsLabels {
  packagesTab: string;
  copyOwnTab: string;
  promptTab: string;
  packageSelectAriaLabel: string;
  blockSelectAriaLabel: string;
  packageCommandLabel: string;
  blockCommandLabel: string;
  /** `aria-label` of the read-only prompt textarea. */
  promptAriaLabel: string;
  promptCopyLabel: string;
  promptCopiedLabel: string;
}

export const DEFAULT_INSTALL_TABS_LABELS: InstallTabsLabels = {
  packagesTab: "pnpm add",
  copyOwnTab: "Copy-own",
  promptTab: "Prompt",
  packageSelectAriaLabel: "Archetype",
  blockSelectAriaLabel: "Block",
  packageCommandLabel: "Install",
  blockCommandLabel: "Add block",
  promptAriaLabel: "Agent prompt",
  promptCopyLabel: "Copy prompt",
  promptCopiedLabel: "Copied",
};

export interface InstallTabsProps extends HTMLAttributes<HTMLDivElement> {
  /** The `pnpm add` tab's per-archetype options; the first is the default selection. */
  packageOptions: InstallTabsSelectOption[];
  /** The `Copy-own` tab's per-block options; the first is the default selection. */
  blockOptions: InstallTabsSelectOption[];
  /** One tab per host, in order, between `Copy-own` and `Prompt`. */
  hostTabs: InstallTabsHostTab[];
  /** The multi-line agent prompt shown (read-only) on the `Prompt` tab. */
  prompt: string;
  /** Selected tab id (controlled): `"packages"`, `"copy-own"`, a host id, or `"prompt"`. */
  value?: string;
  /** Initially selected tab id (uncontrolled). Default: `"packages"`. */
  defaultValue?: string;
  onValueChange?: (id: string) => void;
  /** Selected `pnpm add` archetype id (controlled). */
  packageValue?: string;
  onPackageValueChange?: (id: string) => void;
  /** Selected `Copy-own` block id (controlled). */
  blockValue?: string;
  onBlockValueChange?: (id: string) => void;
  onCommandCopy?: (command: string, copied: boolean) => void;
  onPromptCopy?: (copied: boolean) => void;
  labels?: Partial<InstallTabsLabels>;
}

export const InstallTabs = forwardRef<HTMLDivElement, InstallTabsProps>(function InstallTabs(
  {
    packageOptions,
    blockOptions,
    hostTabs,
    prompt,
    value,
    defaultValue,
    onValueChange,
    packageValue,
    onPackageValueChange,
    blockValue,
    onBlockValueChange,
    onCommandCopy,
    onPromptCopy,
    labels: labelsProp,
    className,
    ...props
  },
  ref,
) {
  const labels = { ...DEFAULT_INSTALL_TABS_LABELS, ...labelsProp };
  const [tabId, setTabId] = useControllableState(value, defaultValue ?? "packages", onValueChange);
  const [pkgId, setPkgId] = useControllableState(
    packageValue,
    packageOptions[0]?.id ?? "",
    onPackageValueChange,
  );
  const [blockId, setBlockId] = useControllableState(
    blockValue,
    blockOptions[0]?.id ?? "",
    onBlockValueChange,
  );
  const { copied: promptCopied, copy: copyPrompt } = useCopyToClipboard();

  const selectedPackage = packageOptions.find((o) => o.id === pkgId) ?? packageOptions[0];
  const selectedBlock = blockOptions.find((o) => o.id === blockId) ?? blockOptions[0];

  return (
    <div
      ref={ref}
      data-slot="install-tabs"
      className={cn("flex flex-col gap-4", className)}
      {...props}
    >
      <Tabs value={tabId} onValueChange={setTabId}>
        <TabsList variant="underline">
          <TabsTrigger value="packages">{labels.packagesTab}</TabsTrigger>
          <TabsTrigger value="copy-own">{labels.copyOwnTab}</TabsTrigger>
          {hostTabs.map((host) => (
            <TabsTrigger key={host.id} value={host.id}>
              {host.label}
            </TabsTrigger>
          ))}
          <TabsTrigger value="prompt">{labels.promptTab}</TabsTrigger>
        </TabsList>

        <TabsContent value="packages" className="flex flex-col gap-3">
          <Select value={pkgId} onValueChange={setPkgId}>
            <SelectTrigger
              data-slot="install-tabs-package-select"
              aria-label={labels.packageSelectAriaLabel}
              className="min-w-48"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {packageOptions.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedPackage ? (
            <CommandChip
              hosts={[
                {
                  id: "value",
                  label: labels.packageCommandLabel,
                  command: selectedPackage.command,
                },
              ]}
              onCopyCommand={onCommandCopy}
            />
          ) : null}
        </TabsContent>

        <TabsContent value="copy-own" className="flex flex-col gap-3">
          <Select value={blockId} onValueChange={setBlockId}>
            <SelectTrigger
              data-slot="install-tabs-block-select"
              aria-label={labels.blockSelectAriaLabel}
              className="min-w-48"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {blockOptions.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedBlock ? (
            <CommandChip
              hosts={[
                { id: "value", label: labels.blockCommandLabel, command: selectedBlock.command },
              ]}
              onCopyCommand={onCommandCopy}
            />
          ) : null}
        </TabsContent>

        {hostTabs.map((host) => (
          <TabsContent key={host.id} value={host.id} className="flex flex-col gap-2">
            {host.commands.map((command) => (
              <CommandChip
                key={command.label}
                hosts={[{ id: "value", label: command.label, command: command.command }]}
                onCopyCommand={onCommandCopy}
              />
            ))}
          </TabsContent>
        ))}

        <TabsContent value="prompt" className="flex flex-col gap-3">
          <Textarea
            readOnly
            value={prompt}
            rows={4}
            aria-label={labels.promptAriaLabel}
            data-slot="install-tabs-prompt"
            className="resize-none font-mono text-code"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="self-start"
            data-slot="install-tabs-prompt-copy"
            onClick={() => {
              void copyPrompt(prompt).then((ok) => onPromptCopy?.(ok));
            }}
          >
            {promptCopied ? labels.promptCopiedLabel : labels.promptCopyLabel}
          </Button>
          {/* Always mounted so the announcement is not missed (ARIA22); only its text changes,
              driven from the same `promptCopied` state as the label above — mirrors CommandChip.
              The one live region for this copy: never add a second. */}
          <span
            role="status"
            aria-live="polite"
            className="sr-only"
            data-slot="install-tabs-prompt-status"
          >
            {promptCopied ? labels.promptCopiedLabel : ""}
          </span>
        </TabsContent>
      </Tabs>
    </div>
  );
});
