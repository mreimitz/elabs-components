"use client";

import { Button, useCopyToClipboard } from "@elabs/components-ui";
import { cn } from "@elabs/components-ui/lib/cn";
import { CheckIcon, CopyIcon } from "lucide-react";
import { useCallback, type ComponentProps } from "react";

export interface CopyButtonProps extends Omit<ComponentProps<typeof Button>, "value"> {
  /** Text written to the clipboard on click. */
  value: string;
  /** Show the "Copy" / "Copied" label next to the icon. Defaults to true. */
  label?: boolean;
}

/**
 * Brand-ui copy-to-clipboard button with a transient "Copied" state. Shared by
 * the editor toolbar and workspace so the copy affordance is defined once.
 */
export function CopyButton({ value, label = true, className, ...props }: CopyButtonProps) {
  // Clipboard write + transient flag come from the shared `@elabs/components-ui`
  // hook, so this button and `CopyableValue` cannot drift on timing or on what
  // happens where there is no clipboard.
  const { copied, copy } = useCopyToClipboard();

  const onClick = useCallback(() => {
    void copy(value);
  }, [copy, value]);

  return (
    <Button
      variant="ghost"
      size="sm"
      {...props}
      type="button"
      className={cn("h-7 gap-1.5", className)}
      onClick={onClick}
      aria-label={copied ? "Copied" : "Copy"}
    >
      {copied ? (
        <CheckIcon
          key={String(copied)}
          className="size-4 text-success animate-in fade-in zoom-in-95 duration-fast ease-entrance"
          aria-hidden="true"
        />
      ) : (
        <CopyIcon className="size-4" aria-hidden="true" />
      )}
      {label ? <span className="text-xs">{copied ? "Copied" : "Copy"}</span> : null}
    </Button>
  );
}
