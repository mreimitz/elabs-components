"use client";
/**
 * AgentLoopPrompt (RM-099) — the ai `PromptInput` in "example" mode: a `Select` of the curated
 * prompts fills the textarea; the text is editable, but a `Tooltip` says only the listed prompts
 * run. Enter in the textarea (or the Run button) submits. The textarea is provider-controlled so
 * the prompt text stays visible after a run instead of clearing like a chat composer.
 */
import { useEffect, useId, useRef, type RefObject } from "react";
import { Info } from "lucide-react";
import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  PromptInputProvider,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
  usePromptInputController,
} from "@elabs-ai/components-ai";
import {
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@elabs-ai/components-ui";
import type { AgentLoopPromptEntry } from "./prompt-map";

export type AgentLoopPromptLabels = {
  promptLabel: string;
  promptPlaceholder: string;
  selectLabel: string;
  onlyListedHint: string;
  onlyListedTrigger: string;
  run: string;
};

export type AgentLoopPromptProps = {
  prompts: AgentLoopPromptEntry[];
  selectedId: string;
  onSelect: (id: string) => void;
  onRun: () => void;
  running: boolean;
  /** Bumped after every run so the text is restored once the form has cleared itself. */
  runCount: number;
  labels: AgentLoopPromptLabels;
  textareaRef?: RefObject<HTMLTextAreaElement | null>;
};

/**
 * Keeps the provider's text on the selected prompt after a pick, and restores it after each
 * run — `PromptInput`'s own submit handling clears the provider text before `AgentLoop` ever
 * bumps `runCount` (RM-099's "restored once the form has cleared itself"). Restoring always to
 * `selected.text` used to silently discard whatever the visitor had typed (#566): a run always
 * runs the SELECTED prompt regardless of the textarea's text (disclosed by `onlyListedHint`,
 * and re-surfaced as the actually-run prompt in `AgentLoop`'s status line), so there is no
 * reason to also erase their edit from view. Instead this snapshots the text visible right
 * before Run fires (`preRunValue`, updated during render — see the guard below) and restores
 * THAT, which reproduces the old behaviour when the textarea was untouched and preserves an
 * edit otherwise. Picking a DIFFERENT prompt (a `text` change) still always resets to it.
 */
function SyncText({ text, runCount }: { text: string; runCount: number }) {
  const controller = usePromptInputController();
  const { value, setInput } = controller.textInput;
  const preRunValue = useRef(text);
  const lastRunCount = useRef(runCount);
  // Render-time snapshot: skipped on the very render a run just cleared the text, so that
  // cleared "" never overwrites the snapshot the effect below is about to restore.
  if (runCount === lastRunCount.current) {
    preRunValue.current = value;
  }
  useEffect(() => {
    setInput(text);
  }, [text, setInput]);
  useEffect(() => {
    if (runCount === lastRunCount.current) return;
    lastRunCount.current = runCount;
    setInput(preRunValue.current);
  }, [runCount, setInput]);
  return null;
}

export function AgentLoopPrompt({
  prompts,
  selectedId,
  onSelect,
  onRun,
  running,
  runCount,
  labels,
  textareaRef,
}: AgentLoopPromptProps) {
  const selectId = useId();
  const textId = useId();
  const selected = prompts.find((p) => p.id === selectedId) ?? prompts[0]!;
  return (
    <div data-slot="agent-loop-prompt" className="flex w-full min-w-0 flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={selectId}>{labels.selectLabel}</Label>
        <Select value={selected.id} onValueChange={onSelect} disabled={running}>
          <SelectTrigger id={selectId} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {prompts.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.text}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <PromptInputProvider initialInput={selected.text}>
        <SyncText text={selected.text} runCount={runCount} />
        <div className="flex items-center gap-1.5">
          <Label htmlFor={textId}>{labels.promptLabel}</Label>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger
                type="button"
                aria-label={labels.onlyListedTrigger}
                className="focus-ring inline-flex size-6 items-center justify-center rounded-sm text-muted-foreground"
              >
                <Info aria-hidden="true" size={14} />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">{labels.onlyListedHint}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <PromptInput
          onSubmit={(_message, event) => {
            event.preventDefault();
            if (!running) onRun();
          }}
        >
          <PromptInputBody>
            <PromptInputTextarea
              id={textId}
              ref={textareaRef}
              placeholder={labels.promptPlaceholder}
              aria-describedby={`${textId}-hint`}
            />
          </PromptInputBody>
          <PromptInputFooter>
            <PromptInputTools>
              <span id={`${textId}-hint`} className="sr-only">
                {labels.onlyListedHint}
              </span>
            </PromptInputTools>
            <PromptInputSubmit aria-label={labels.run} disabled={running} />
          </PromptInputFooter>
        </PromptInput>
      </PromptInputProvider>
    </div>
  );
}
