"use client";

/**
 * IterationTemplateDialog — author a `:::iterate` / `:::pivot` per-cell TEMPLATE
 * in a focused modal (the #223 template modal). Composes `@elabs-ai/components-ui` `Dialog`
 * with the existing `MarkdownWorkspace` (source / split / preview-edit), so the
 * template is edited with the same toolbar + live preview as any document.
 *
 * Controlled: drive `open` / `onOpenChange`; seed `template`; receive the edited
 * markdown via `onSave`. The library does not own where the template is stored —
 * the caller (a slash command, or the node-view `⋯` re-edit menu) wires it back.
 */
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@elabs-ai/components-ui";
import { useEffect, useState, type ReactNode } from "react";

import { MarkdownWorkspace, type MarkdownWorkspaceMode } from "../markdown-workspace";
import { IterationEditContext, type IterationEditRequest } from "./edit-context";

export interface IterationTemplateDialogProps {
  /** Whether the dialog is open. */
  open: boolean;
  /** Open-state change handler (Radix Dialog contract). */
  onOpenChange: (open: boolean) => void;
  /** The initial template markdown (the directive body). */
  template: string;
  /** Called with the edited template when the user saves. */
  onSave: (template: string) => void;
  /** Tunes the title + helper copy. Default `"iterate"`. */
  kind?: "iterate" | "pivot";
  /** Initial workspace mode. Default `"split"`. */
  mode?: MarkdownWorkspaceMode;
}

export function IterationTemplateDialog({
  open,
  onOpenChange,
  template,
  onSave,
  kind = "iterate",
  mode = "split",
}: IterationTemplateDialogProps) {
  const [draft, setDraft] = useState(template);

  // Re-seed the draft whenever the dialog (re)opens against a new template.
  useEffect(() => {
    if (open) setDraft(template);
  }, [open, template]);

  const unit = kind === "pivot" ? "cell" : "row";

  const save = () => {
    onSave(draft);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] w-[min(48rem,92vw)] max-w-none flex-col">
        <DialogHeader>
          <DialogTitle>Edit {kind === "pivot" ? "pivot" : "iteration"} template</DialogTitle>
          <DialogDescription>
            The per-{unit} template. Use <code>{"{{token}}"}</code> placeholders (e.g.{" "}
            <code>{"{{item.name}}"}</code>) — each is filled per {unit} when the block renders.
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1">
          <MarkdownWorkspace
            value={draft}
            onChange={setDraft}
            defaultMode={mode}
            className="h-full"
            aria-label="Iteration template editor"
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={save}>Save template</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * One-liner wiring for the node-view `⋯` re-edit: provides the
 * {@link IterationEditContext} handler AND renders the `IterationTemplateDialog`
 * it opens. Wrap your `MarkdownEditor` / `MarkdownWorkspace` in it to enable the
 * `⋯` "Edit template…" affordance on `:::iterate` / `:::pivot` node-views.
 */
export function IterationTemplateProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<IterationEditRequest | null>(null);
  return (
    <IterationEditContext.Provider value={setRequest}>
      {children}
      <IterationTemplateDialog
        open={request != null}
        onOpenChange={(next) => {
          if (!next) setRequest(null);
        }}
        template={request?.template ?? ""}
        kind={request?.kind ?? "iterate"}
        onSave={(template) => request?.onSave(template)}
      />
    </IterationEditContext.Provider>
  );
}
