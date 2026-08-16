"use client";

import { useCallback, useState } from "react";

export interface UseDialogDismissGuardOptions {
  /**
   * Does the dialog currently hold unsaved changes? **App-owned** — brand-ui is
   * a presentation layer (`docs/DECISIONS.md` §D5) and cannot know what "dirty"
   * means for your form. Compute it (a `react-hook-form` `isDirty`, a deep
   * compare, a store flag) and pass it in.
   */
  dirty: boolean;
  /** Close the dialog — the app sets its own `open` state to `false`. */
  onClose: () => void;
  /**
   * Open the dialog. Only needed when a `DialogTrigger` (rather than the app)
   * opens it, because Radix routes that through the same `onOpenChange`.
   */
  onOpen?: () => void;
}

export interface DialogDismissGuard {
  /**
   * Spread onto `<Dialog onOpenChange={…}>`. Intercepts EVERY user dismissal —
   * Escape, overlay click, the built-in close ✕ and any `DialogClose` — because
   * Radix funnels all four through `onOpenChange(false)`.
   */
  onOpenChange: (open: boolean) => void;
  /** Controlled `open` for the discard confirmation. */
  confirmOpen: boolean;
  /** Controlled `onOpenChange` for the discard confirmation. */
  onConfirmOpenChange: (open: boolean) => void;
  /** Confirm the discard: closes the confirmation AND calls `onClose()`. */
  confirmDiscard: () => void;
}

/**
 * Warn before a dialog with unsaved changes is dismissed (#341).
 *
 * `.claude/rules/interaction-guidelines.md` (Forms) requires warning before
 * navigating away from unsaved changes; this is that rule for dialogs, as a HOOK
 * rather than a prop because the component must not own app state — the app owns
 * `open` and decides what `dirty` means (D5).
 *
 * ## The asymmetry is structural, not a flag
 *
 * A **user dismissal** reaches Radix's `onOpenChange`, so the guard sees it and
 * can hold the dialog open. A **programmatic close** (the app setting its own
 * `open` to `false` after a successful save) never touches the guard, so it is
 * unobservable here and closes silently. That is exactly the wanted behaviour,
 * and it falls out of the wiring — there is no "skip the guard" option to get
 * wrong.
 *
 * The name is literal: it guards DISMISSALS routed through the returned
 * `onOpenChange`. It is not a navigation blocker and it cannot intercept a tab
 * close, a router navigation, or an `open` prop that the app flips itself.
 *
 * ```tsx
 * const [open, setOpen] = useState(false);
 * const guard = useDialogDismissGuard({
 *   dirty,
 *   onClose: () => setOpen(false),
 *   onOpen: () => setOpen(true),
 * });
 *
 * <Dialog open={open} onOpenChange={guard.onOpenChange}>…</Dialog>
 * <ConfirmDialog
 *   open={guard.confirmOpen}
 *   onOpenChange={guard.onConfirmOpenChange}
 *   onConfirm={guard.confirmDiscard}
 *   tone="destructive"
 *   title="Discard changes?"
 *   description="Your edits to this project have not been saved."
 *   confirmLabel="Discard"
 * />
 * ```
 *
 * The `ConfirmDialog` is a SIBLING of the guarded dialog, not a child of it.
 */
export function useDialogDismissGuard({
  dirty,
  onClose,
  onOpen,
}: UseDialogDismissGuardOptions): DialogDismissGuard {
  const [confirmOpen, setConfirmOpen] = useState(false);

  const onOpenChange = useCallback(
    (open: boolean) => {
      // Opening is never guarded; a `DialogTrigger` routes through here too.
      if (open) {
        onOpen?.();
        return;
      }
      if (dirty) {
        setConfirmOpen(true);
        return;
      }
      onClose();
    },
    [dirty, onClose, onOpen],
  );

  const confirmDiscard = useCallback(() => {
    setConfirmOpen(false);
    onClose();
  }, [onClose]);

  return { onOpenChange, confirmOpen, onConfirmOpenChange: setConfirmOpen, confirmDiscard };
}
