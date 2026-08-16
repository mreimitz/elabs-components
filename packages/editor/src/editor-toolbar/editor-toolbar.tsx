"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@elabs/components-ui";
import { cn } from "@elabs/components-ui/lib/cn";
import { forwardRef, type HTMLAttributes, type ReactNode } from "react";
import { CopyButton } from "../copy-button";
import { EDITOR_LANGUAGES, type EditorLanguage } from "../lib/languages";

export interface EditorToolbarProps extends HTMLAttributes<HTMLDivElement> {
  /** Filename shown on the left (e.g. "index.ts"). */
  filename?: ReactNode;
  /** Active language id; shows a language picker when `onLanguageChange` is set. */
  language?: string;
  /** Called when the user picks a language. Omit to hide the picker. */
  onLanguageChange?: (language: string) => void;
  /** Languages offered in the picker. Defaults to {@link EDITOR_LANGUAGES}. */
  languages?: EditorLanguage[];
  /** Text copied by the copy button. Omit to hide the button. */
  copyValue?: string;
  /** Extra actions rendered before the copy button (brand-ui buttons, etc.). */
  actions?: ReactNode;
}

/**
 * Brand-ui chrome for the editors — the part that genuinely reuses our
 * components. Renders a filename label, an optional language `Select` and a copy
 * `Button`. The editing surface itself is Monaco; this is the frame around it.
 */
export const EditorToolbar = forwardRef<HTMLDivElement, EditorToolbarProps>(function EditorToolbar(
  {
    filename,
    language,
    onLanguageChange,
    languages = EDITOR_LANGUAGES,
    copyValue,
    actions,
    className,
    ...props
  },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn(
        "flex h-10 shrink-0 items-center gap-2 border-b border-border bg-surface px-3",
        className,
      )}
      {...props}
    >
      {filename != null ? (
        <span className="truncate text-sm font-medium text-foreground">{filename}</span>
      ) : null}

      <div className="ml-auto flex items-center gap-1.5">
        {actions}

        {onLanguageChange ? (
          <Select value={language} onValueChange={onLanguageChange}>
            <SelectTrigger size="sm" className="h-7 w-[140px]" aria-label="Language">
              <SelectValue placeholder="Language" />
            </SelectTrigger>
            <SelectContent>
              {languages.map((l) => (
                <SelectItem key={l.id} value={l.id}>
                  {l.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}

        {copyValue != null ? <CopyButton value={copyValue} /> : null}
      </div>
    </div>
  );
});
