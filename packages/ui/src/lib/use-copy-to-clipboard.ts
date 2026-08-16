"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** How long the transient "copied" state stays true before it resets. */
export const COPY_FEEDBACK_MS = 1500;

export interface UseCopyToClipboardOptions {
  /** ms the `copied` flag stays true. Default: {@link COPY_FEEDBACK_MS}. */
  resetAfterMs?: number;
}

export interface CopyToClipboard {
  /** True for `resetAfterMs` after a successful copy. */
  copied: boolean;
  /** Writes `text` to the clipboard. Resolves `false` when it could not. */
  copy: (text: string) => Promise<boolean>;
}

/**
 * Copy-to-clipboard with a transient confirmation flag.
 *
 * One implementation for the whole library — the copy button in
 * `@qlik-coe-emea/qlabs-components-editor` and `CopyableValue` share it, so the
 * timing, the unmount cleanup and the "no clipboard here" answer are defined
 * once instead of re-derived per component.
 *
 * `navigator.clipboard` is absent under SSR, in jsdom, and in any insecure
 * (non-`https`, non-`localhost`) context. That is reported as `false` rather
 * than thrown: a copy affordance failing is a papercut, not a crash, and the
 * caller decides whether to say anything about it. The deprecated
 * `document.execCommand("copy")` fallback is deliberately not used.
 */
export function useCopyToClipboard(options?: UseCopyToClipboardOptions): CopyToClipboard {
  const resetAfterMs = options?.resetAfterMs ?? COPY_FEEDBACK_MS;
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // A component that unmounts inside the feedback window must not have its
  // state set afterwards, and a second copy must restart the window, not race
  // the first one's reset.
  useEffect(
    () => () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }
    },
    [],
  );

  const copy = useCallback(
    async (text: string): Promise<boolean> => {
      if (typeof navigator === "undefined" || !navigator.clipboard) {
        return false;
      }
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        return false;
      }
      setCopied(true);
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        setCopied(false);
      }, resetAfterMs);
      return true;
    },
    [resetAfterMs],
  );

  return { copied, copy };
}
