"use client";

import { type MouseEvent, type ReactNode } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../alert-dialog";
import { buttonVariants } from "../button";
import { cn } from "../../lib/cn";
import { useLocale } from "../locale-provider";
import { Spinner } from "../spinner";

export interface ConfirmDialogProps {
  /** Controlled open state — the app owns it. */
  open: boolean;
  /** Fires on cancel, Escape, and any other Radix dismissal. */
  onOpenChange: (open: boolean) => void;
  /** What is about to happen, as a question or a statement. */
  title: ReactNode;
  /**
   * The consequence, spelled out. **Required**: `AlertDialogContent` is
   * inaccessible to screen-reader users without a description (Radix warns), and
   * a confirmation whose only text is its title cannot state what is at stake.
   */
  description: ReactNode;
  /**
   * The confirm action's label. States the CONSEQUENCE ("Delete skill"), never
   * "OK" — a label that names the outcome is the last chance to catch a mistake.
   * Defaults to a generic "Confirm", which you should almost always replace.
   */
  confirmLabel?: ReactNode;
  /** The safe action's label. Defaults to "Cancel". */
  cancelLabel?: ReactNode;
  /** Runs when the confirm action is activated. */
  onConfirm: () => void;
  /** Runs when the safe action is activated (in addition to `onOpenChange`). */
  onCancel?: () => void;
  /** Visual tone of the CONFIRM action only. The dialog chrome never changes. */
  tone?: "default" | "destructive";
  /**
   * The confirm request is in flight: the action swaps its label for a spinner
   * and reports `aria-busy`. It deliberately stays ENABLED
   * (`.claude/rules/interaction-guidelines.md`, Forms — a submit is never
   * pre-disabled); repeat activations are ignored while it is set.
   */
  loading?: boolean;
  /** Extra body content between the description and the actions. */
  children?: ReactNode;
  className?: string;
}

/**
 * A destructive/irreversible confirmation (#341).
 *
 * Built on `AlertDialog`, not `Dialog`, and that is the entire point of it
 * existing as a named component rather than a recipe: `AlertDialogContent`
 * prevents its own open-autofocus and focuses the mounted `AlertDialogCancel`
 * instead, so **initial focus lands on the safe action** — but only if a Cancel
 * is actually mounted, which a hand-rolled confirmation routinely forgets (and a
 * plain `Dialog` cannot do at all). `ConfirmDialog` always renders one, so the
 * wrong choice is unrepresentable. It also inherits `AlertDialog`'s refusal to
 * dismiss on an outside click.
 *
 * Cancel is FIRST in the DOM so assistive tech reads the safe action first;
 * `AlertDialogFooter`'s `flex-col-reverse sm:flex-row sm:justify-end` still
 * paints the confirm action bottom-right on every breakpoint.
 *
 * **Confirming does not close the dialog** — `onConfirm` fires and the app sets
 * `open={false}` when it is ready (immediately for a synchronous action, after
 * the request for an async one, which is what makes `loading` coherent).
 * Cancelling closes through `onOpenChange(false)` as usual.
 *
 * ```tsx
 * <ConfirmDialog
 *   open={open}
 *   onOpenChange={setOpen}
 *   tone="destructive"
 *   title={`Delete ${skill.name}?`}
 *   description={`Removing it also deletes its ${skill.runs} saved runs. This cannot be undone.`}
 *   confirmLabel={`Delete ${skill.name}`}
 *   onConfirm={() => { deleteSkill(); setOpen(false); }}
 * />
 * ```
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  tone = "default",
  loading = false,
  children,
  className,
}: ConfirmDialogProps) {
  const { t } = useLocale();

  function handleConfirm(event: MouseEvent<HTMLButtonElement>) {
    // Radix's Action is a `Dialog.Close`; preventing the default stops it
    // closing so the app stays in charge of `open` (and an in-flight request
    // keeps its spinner on screen).
    event.preventDefault();
    if (loading) return;
    onConfirm();
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent data-slot="confirm-dialog" className={className}>
        <AlertDialogHeader>
          <AlertDialogTitle data-slot="confirm-dialog-title">{title}</AlertDialogTitle>
          <AlertDialogDescription data-slot="confirm-dialog-description">
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {children}
        <AlertDialogFooter>
          <AlertDialogCancel data-slot="confirm-dialog-cancel" onClick={onCancel}>
            {cancelLabel ?? t("ui.confirmDialog.cancel")}
          </AlertDialogCancel>
          <AlertDialogAction
            data-slot="confirm-dialog-confirm"
            className={cn(tone === "destructive" && buttonVariants({ variant: "destructive" }))}
            aria-busy={loading || undefined}
            onClick={handleConfirm}
          >
            {/* `text-current` so the spinner inherits the action's foreground
                token instead of `Spinner`'s muted default, which would drop
                below 3:1 on a filled button. */}
            {loading ? <Spinner className="text-current" label={t("loading")} /> : null}
            {confirmLabel ?? t("ui.confirmDialog.confirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
