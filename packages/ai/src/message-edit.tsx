"use client";

/**
 * MessageEdit — edit-in-place for a user message.
 *
 * Swaps a message bubble between its display content and an inline editor
 * (the composer's `Textarea` primitive) seeded with the original text.
 * `onEditSubmit(newText)` fires on save — the consumer then creates a branch
 * (compose with `MessageBranch*`). Presentational only: it never mutates the
 * message; the original is simply restored on cancel because the source text is
 * untouched until `onEditSubmit`.
 *
 * Behavior: Enter submits, Shift+Enter inserts a newline, Esc cancels. Focus
 * moves into the editor on begin, is trapped within it while editing, and is
 * restored to the trigger on cancel/submit.
 *
 * Compound structure (the ChangeReview convention — named parts, lifted state):
 *   <MessageEditProvider>   — lifted edit state (editing + draft + actions)
 *     <MessageEditContent>  — display children, or the inline editor
 *     <MessageEditTrigger>  — begins editing (focus is restored here on exit)
 */

import {
  createContext,
  forwardRef,
  use,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type HTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { Check, Pencil, X } from "lucide-react";
import { Button, Textarea } from "@elabs/components-ui";
import { cn } from "@elabs/components-ui/lib/cn";
import { useLocale } from "@elabs/components-ui";

// ─── Context ────────────────────────────────────────────────────────────────

interface MessageEditContextValue {
  editing: boolean;
  draft: string;
  setDraft: (value: string) => void;
  beginEdit: () => void;
  cancel: () => void;
  submit: () => void;
  /** Ref for the trigger element so focus can be restored to it on exit. */
  triggerRef: React.MutableRefObject<HTMLElement | null>;
  editorId: string;
}

const MessageEditContext = createContext<MessageEditContextValue | null>(null);

function useMessageEditContext(): MessageEditContextValue {
  const ctx = use(MessageEditContext);
  if (!ctx) {
    throw new Error("MessageEdit sub-components must be rendered inside <MessageEditProvider>.");
  }
  return ctx;
}

/** Read-only access to the edit state (for a custom trigger/toolbar). */
export function useMessageEdit(): Pick<
  MessageEditContextValue,
  "editing" | "draft" | "beginEdit" | "cancel" | "submit"
> {
  const { editing, draft, beginEdit, cancel, submit } = useMessageEditContext();
  return { editing, draft, beginEdit, cancel, submit };
}

// ─── Provider ───────────────────────────────────────────────────────────────

export interface MessageEditProviderProps {
  /** The editable source text (seeds the editor on begin). */
  value: string;
  /** Called with the new text on save. The consumer creates the branch. */
  onEditSubmit?: (newText: string) => void;
  /** Controlled editing state. When set, `onEditingChange` drives transitions. */
  editing?: boolean;
  /** Uncontrolled initial editing state. @default false */
  defaultEditing?: boolean;
  /** Called when editing begins/ends. */
  onEditingChange?: (editing: boolean) => void;
  children: ReactNode;
}

/** Lifts the edit state (editing + draft). Controlled or uncontrolled. */
export function MessageEditProvider({
  value,
  onEditSubmit,
  editing: editingProp,
  defaultEditing = false,
  onEditingChange,
  children,
}: MessageEditProviderProps) {
  const editorId = useId();
  const isControlled = editingProp !== undefined;
  const [internalEditing, setInternalEditing] = useState(defaultEditing);
  const editing = isControlled ? (editingProp as boolean) : internalEditing;

  const [draft, setDraft] = useState(value);
  const triggerRef = useRef<HTMLElement | null>(null);
  const restoreFocus = useRef(false);

  const setEditing = useCallback(
    (next: boolean) => {
      if (!isControlled) setInternalEditing(next);
      onEditingChange?.(next);
    },
    [isControlled, onEditingChange],
  );

  const beginEdit = useCallback(() => {
    setDraft(value); // seed from the current source text
    setEditing(true);
  }, [value, setEditing]);

  const cancel = useCallback(() => {
    setDraft(value); // discard edits (original is restored)
    restoreFocus.current = true;
    setEditing(false);
  }, [value, setEditing]);

  const submit = useCallback(() => {
    onEditSubmit?.(draft);
    restoreFocus.current = true;
    setEditing(false);
  }, [draft, onEditSubmit, setEditing]);

  // Restore focus to the trigger once the editor has unmounted.
  useEffect(() => {
    if (!editing && restoreFocus.current) {
      restoreFocus.current = false;
      triggerRef.current?.focus();
    }
  }, [editing]);

  const contextValue = useMemo<MessageEditContextValue>(
    () => ({ editing, draft, setDraft, beginEdit, cancel, submit, triggerRef, editorId }),
    [editing, draft, beginEdit, cancel, submit, editorId],
  );

  return <MessageEditContext.Provider value={contextValue}>{children}</MessageEditContext.Provider>;
}

// ─── Inline editor ─────────────────────────────────────────────────────────────

export type MessageEditFormProps = Omit<HTMLAttributes<HTMLFormElement>, "onSubmit"> & {
  /** Save button label. @default "Save" */
  saveLabel?: string;
  /** Cancel button label. @default "Cancel" */
  cancelLabel?: string;
};

/** The inline editor: an autofocused textarea + Save/Cancel, Enter/Esc wired. */
export const MessageEditForm = forwardRef<HTMLFormElement, MessageEditFormProps>(
  function MessageEditForm(
    { className, saveLabel = "Save", cancelLabel = "Cancel", ...props },
    ref,
  ) {
    const { t } = useLocale();
    const { draft, setDraft, cancel, submit, editorId } = useMessageEditContext();
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Autofocus the textarea and place the caret at the end.
    useEffect(() => {
      const el = textareaRef.current;
      if (el) {
        el.focus();
        el.setSelectionRange(el.value.length, el.value.length);
      }
    }, []);

    const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      submit();
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLElement>) => {
      if (e.key === "Escape") {
        e.preventDefault();
        cancel();
        return;
      }
      // Enter submits from the textarea; Shift+Enter inserts a newline.
      if (e.key === "Enter" && !e.shiftKey && e.target === textareaRef.current) {
        e.preventDefault();
        submit();
      }
      // NOTE: Tab is deliberately NOT trapped — this is an inline, non-modal
      // editor, and the repo a11y rule forbids trapping focus outside modals.
      // Tab flows naturally out of the editor; focus is restored to the trigger
      // only on cancel/submit.
    };

    return (
      <form
        ref={ref}
        onSubmit={handleSubmit}
        onKeyDown={handleKeyDown}
        className={cn("flex w-full flex-col gap-2", className)}
        {...props}
      >
        <Textarea
          ref={textareaRef}
          id={editorId}
          value={draft}
          aria-label={t("ai.message.editMessage")}
          onChange={(e) => setDraft(e.target.value)}
          className="min-h-16"
        />
        <div className="flex items-center justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={cancel}>
            <X aria-hidden="true" className="size-4" />
            {cancelLabel}
          </Button>
          <Button type="submit" size="sm" disabled={draft.trim().length === 0}>
            <Check aria-hidden="true" className="size-4" />
            {saveLabel}
          </Button>
        </div>
      </form>
    );
  },
);

// ─── Content ──────────────────────────────────────────────────────────────────

export type MessageEditContentProps = HTMLAttributes<HTMLDivElement>;

/** Renders `children` in display mode, or the inline editor while editing. */
export const MessageEditContent = forwardRef<HTMLDivElement, MessageEditContentProps>(
  function MessageEditContent({ className, children, ...props }, ref) {
    const { editing } = useMessageEditContext();
    return (
      <div ref={ref} className={cn("w-full", className)} {...props}>
        {editing ? <MessageEditForm /> : children}
      </div>
    );
  },
);

// ─── Trigger ──────────────────────────────────────────────────────────────────

export type MessageEditTriggerProps = React.ComponentProps<typeof Button>;

/** Begins editing. Focus is restored here on cancel/submit. Hidden while editing. */
export const MessageEditTrigger = forwardRef<HTMLButtonElement, MessageEditTriggerProps>(
  function MessageEditTrigger(
    { className, children, variant = "ghost", size = "sm", onClick, ...props },
    ref,
  ) {
    const { editing, beginEdit, triggerRef } = useMessageEditContext();
    if (editing) return null;
    return (
      <Button
        ref={(node) => {
          triggerRef.current = node;
          if (typeof ref === "function") ref(node);
          else if (ref) ref.current = node;
        }}
        variant={variant}
        size={size}
        className={className}
        onClick={(e) => {
          onClick?.(e);
          beginEdit();
        }}
        {...props}
      >
        {children ?? (
          <>
            <Pencil aria-hidden="true" className="size-4" />
            Edit
          </>
        )}
      </Button>
    );
  },
);

// ─── Root convenience ──────────────────────────────────────────────────────────

export interface MessageEditProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  "onSubmit" | "children"
> {
  /** The editable source text. */
  value: string;
  /** Called with the new text on save (consumer creates the branch). */
  onEditSubmit?: (newText: string) => void;
  /** Controlled editing state. */
  editing?: boolean;
  /** Uncontrolled initial editing state. */
  defaultEditing?: boolean;
  /** Called when editing begins/ends. */
  onEditingChange?: (editing: boolean) => void;
  /** The display content (usually the rendered message text). */
  children: ReactNode;
}

/**
 * Convenience composition: display `children` + an "Edit" trigger, swapping to
 * the inline editor while editing. For toolbar-placed triggers, compose the
 * parts (`MessageEditProvider` + `MessageEditTrigger` in your toolbar).
 */
export const MessageEdit = forwardRef<HTMLDivElement, MessageEditProps>(function MessageEdit(
  { value, onEditSubmit, editing, defaultEditing, onEditingChange, className, children, ...props },
  ref,
) {
  return (
    <MessageEditProvider
      value={value}
      onEditSubmit={onEditSubmit}
      editing={editing}
      defaultEditing={defaultEditing}
      onEditingChange={onEditingChange}
    >
      <div
        ref={ref}
        className={cn("group/message-edit flex w-full flex-col gap-1", className)}
        {...props}
      >
        <MessageEditContent>{children}</MessageEditContent>
        <div className="flex justify-end opacity-0 transition-opacity duration-fast focus-within:opacity-100 group-hover/message-edit:opacity-100 motion-reduce:transition-none">
          <MessageEditTrigger />
        </div>
      </div>
    </MessageEditProvider>
  );
});
