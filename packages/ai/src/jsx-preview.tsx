"use client";

import { Skeleton } from "@elabs/components-ui";
import { cn } from "@elabs/components-ui/lib/cn";
import { AlertCircle } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import {
  createContext,
  memo,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { TProps as JsxParserProps } from "react-jsx-parser";
import JsxParser from "react-jsx-parser";

/**
 * The readiness of the preview, derived from the input (see loading-states.md):
 * - `idle`    — nothing requested yet (empty input, never rendered). Renders nothing.
 * - `pending` — not-ready: `loading`, `isStreaming`, OR syntactically incomplete
 *               input (a half-arrived tag). Builds up best-effort; the error slot
 *               is suppressed; the skeleton shows until the first successful paint.
 * - `ready`   — settled, parseable input is rendering.
 * - `error`   — settled AND genuinely invalid input (the only state that surfaces
 *               `JSXPreviewError`).
 */
export type JSXPreviewStatus = "idle" | "pending" | "ready" | "error";

interface JSXPreviewContextValue {
  jsx: string;
  processedJsx: string;
  isStreaming: boolean;
  loading: boolean;
  status: JSXPreviewStatus;
  hasRendered: boolean;
  error: Error | null;
  setError: (error: Error | null) => void;
  setHasRendered: (value: boolean) => void;
  components: JsxParserProps["components"];
  bindings: JsxParserProps["bindings"];
  onErrorProp?: (error: Error) => void;
}

const JSXPreviewContext = createContext<JSXPreviewContextValue | null>(null);

const TAG_REGEX = /<\/?([a-zA-Z][a-zA-Z0-9]*)\s*([^>]*?)(\/)?>/;

export const useJSXPreview = () => {
  const context = useContext(JSXPreviewContext);
  if (!context) {
    throw new Error("JSXPreview components must be used within JSXPreview");
  }
  return context;
};

const matchJsxTag = (code: string) => {
  if (code.trim() === "") {
    return null;
  }

  const match = code.match(TAG_REGEX);

  if (!match || match.index === undefined) {
    return null;
  }

  const [fullMatch = "", tagName = "", attributes = "", selfClosing] = match;

  let type: "self-closing" | "closing" | "opening";
  if (selfClosing) {
    type = "self-closing";
  } else if (fullMatch.startsWith("</")) {
    type = "closing";
  } else {
    type = "opening";
  }

  return {
    attributes: attributes.trim(),
    endIndex: match.index + fullMatch.length,
    startIndex: match.index,
    tag: fullMatch,
    tagName,
    type,
  };
};

const stripIncompleteTag = (text: string) => {
  // Find the last '<' that isn't part of a complete tag
  const lastOpen = text.lastIndexOf("<");
  if (lastOpen === -1) {
    return text;
  }

  const afterOpen = text.slice(lastOpen);
  // If there's no closing '>' after the last '<', it's an incomplete tag
  if (!afterOpen.includes(">")) {
    return text.slice(0, lastOpen);
  }

  return text;
};

const completeJsxTag = (code: string) => {
  const stack: string[] = [];
  let result = "";
  let currentPosition = 0;

  while (currentPosition < code.length) {
    const match = matchJsxTag(code.slice(currentPosition));
    if (!match) {
      // No more tags found, strip any trailing incomplete tag
      result += stripIncompleteTag(code.slice(currentPosition));
      break;
    }
    const { tagName, type, endIndex } = match;

    // Include any text content before this tag
    result += code.slice(currentPosition, currentPosition + endIndex);

    if (type === "opening") {
      stack.push(tagName);
    } else if (type === "closing") {
      stack.pop();
    }

    currentPosition += endIndex;
  }

  return (
    result +
    [...stack]
      .reverse()
      .map((tag) => `</${tag}>`)
      .join("")
  );
};

export type JSXPreviewProps = ComponentProps<"div"> & {
  jsx: string;
  /** Content is arriving incrementally — build up, suppress transient errors. */
  isStreaming?: boolean;
  /**
   * No renderable content yet (fetch-then-show). Forces the `pending` state so
   * `JSXPreviewSkeleton` shows until `jsx` arrives. Orthogonal to `isStreaming`.
   */
  loading?: boolean;
  components?: JsxParserProps["components"];
  bindings?: JsxParserProps["bindings"];
  onError?: (error: Error) => void;
};

export const JSXPreview = memo(
  ({
    jsx,
    isStreaming = false,
    loading = false,
    components,
    bindings,
    onError,
    className,
    children,
    ...props
  }: JSXPreviewProps) => {
    const [prevJsx, setPrevJsx] = useState(jsx);
    const [error, setError] = useState<Error | null>(null);
    const [hasRendered, setHasRendered] = useState(false);

    // Clear the terminal error when jsx changes (derived state pattern)
    if (jsx !== prevJsx) {
      setPrevJsx(jsx);
      setError(null);
    }

    // The tag-balanced best-effort of the current input. When it differs from the
    // raw jsx, the input ends mid-tag → it is INCOMPLETE (still streaming / being
    // typed), not invalid. This is the timer-free "not-ready" signal.
    const completed = useMemo(() => completeJsxTag(jsx), [jsx]);
    const isIncomplete = jsx.trim() !== "" && completed !== jsx;

    const processedJsx = useMemo(() => {
      if (loading) return "";
      return isStreaming || isIncomplete ? completed : jsx;
    }, [jsx, isStreaming, loading, isIncomplete, completed]);

    const status = useMemo<JSXPreviewStatus>(() => {
      if (loading) return "pending";
      if (jsx.trim() === "") return hasRendered ? "ready" : "idle";
      if (isStreaming || isIncomplete) return "pending";
      return error != null ? "error" : "ready";
    }, [jsx, isStreaming, loading, isIncomplete, error, hasRendered]);

    const contextValue = useMemo(
      () => ({
        bindings,
        components,
        error,
        hasRendered,
        isStreaming,
        jsx,
        loading,
        onErrorProp: onError,
        processedJsx,
        setError,
        setHasRendered,
        status,
      }),
      [
        bindings,
        components,
        error,
        hasRendered,
        isStreaming,
        jsx,
        loading,
        onError,
        processedJsx,
        status,
      ],
    );

    return (
      <JSXPreviewContext.Provider value={contextValue}>
        <div className={cn("relative", className)} {...props}>
          {children}
        </div>
      </JSXPreviewContext.Provider>
    );
  },
);

JSXPreview.displayName = "JSXPreview";

export type JSXPreviewContentProps = Omit<ComponentProps<"div">, "children">;

export const JSXPreviewContent = memo(({ className, ...props }: JSXPreviewContentProps) => {
  const { processedJsx, status, components, bindings, setError, setHasRendered, onErrorProp } =
    useJSXPreview();
  const lastGoodJsxRef = useRef("");
  // `erroredJsx` is committed in an effect (never during render). The parser
  // reports errors synchronously DURING its own render, so `handleError` only
  // stashes a ref — committing state there would be a setState-in-render.
  const [erroredJsx, setErroredJsx] = useState<string | null>(null);
  const pendingErrorRef = useRef<{ jsx: string; error: Error } | null>(null);

  // Reset the per-input error flag synchronously when the content changes.
  const prevProcessedRef = useRef(processedJsx);
  if (prevProcessedRef.current !== processedJsx) {
    prevProcessedRef.current = processedJsx;
    if (erroredJsx !== null) setErroredJsx(null);
  }
  const hadError = erroredJsx === processedJsx;

  const handleError = useCallback(
    (error: Error) => {
      pendingErrorRef.current = { error, jsx: processedJsx };
    },
    [processedJsx],
  );

  // After commit, reconcile the parse outcome. A fresh error becomes terminal
  // (surfaces `JSXPreviewError`) ONLY when settled — for a `pending` input it is
  // held silently (build-up keeps going behind the last good render). A clean
  // render records the last-good JSX and marks the first paint.
  useEffect(() => {
    const failed = pendingErrorRef.current?.jsx === processedJsx;
    if (failed) {
      const { error } = pendingErrorRef.current!;
      pendingErrorRef.current = null;
      if (erroredJsx !== processedJsx) setErroredJsx(processedJsx);
      if (status !== "pending") {
        setError(error);
        onErrorProp?.(error);
      }
    } else if (erroredJsx !== processedJsx && processedJsx.trim() !== "") {
      lastGoodJsxRef.current = processedJsx;
      setHasRendered(true);
    }
  }, [processedJsx, status, erroredJsx, setError, setHasRendered, onErrorProp]);

  // The error slot and the skeleton own the "error" / nothing-yet states.
  if (status !== "ready" && status !== "pending") {
    return null;
  }

  // While pending, a failed parse falls back to the last good render (which may
  // be empty on first paint — the skeleton covers that).
  const displayJsx = hadError ? lastGoodJsxRef.current : processedJsx;

  return (
    <div className={cn("jsx-preview-content", className)} {...props}>
      <JsxParser
        bindings={bindings}
        components={components}
        jsx={displayJsx}
        onError={handleError}
        renderInWrapper={false}
      />
    </div>
  );
});

JSXPreviewContent.displayName = "JSXPreviewContent";

export type JSXPreviewSkeletonProps = ComponentProps<"div">;

/**
 * The not-ready placeholder (loading-states.md §slot anatomy). Renders a
 * layout-shaped `Skeleton` while the preview is `pending` and nothing has
 * painted yet — so a streaming/incomplete surface BUILDS UP behind a skeleton
 * instead of flashing the error box. Pass `children` to override the shape.
 */
export const JSXPreviewSkeleton = memo(
  ({ className, children, ...props }: JSXPreviewSkeletonProps) => {
    const { status, hasRendered } = useJSXPreview();

    // Show only before the first successful paint; once content builds up, the
    // partial render is its own affordance (no skeleton-over-content).
    const show = !hasRendered && status === "pending";

    // The live region must exist in the DOM BEFORE its text appears, or NVDA
    // skips the announcement (ARIA22). So the wrapper is ALWAYS rendered (it
    // collapses to `sr-only` when idle) and the label is set one tick later via
    // an effect — guaranteeing an empty region precedes the "Loading…" text.
    const [announce, setAnnounce] = useState(false);
    useEffect(() => setAnnounce(show), [show]);

    return (
      <div
        className={cn(show ? "space-y-2" : "sr-only", className)}
        role="status"
        aria-live="polite"
        {...props}
      >
        <span className="sr-only">{announce ? "Loading preview…" : ""}</span>
        {show
          ? (children ?? (
              <>
                <Skeleton className="h-20 w-full" />
                <div className="grid grid-cols-3 gap-2">
                  <Skeleton className="h-16" />
                  <Skeleton className="h-16" />
                  <Skeleton className="h-16" />
                </div>
              </>
            ))
          : null}
      </div>
    );
  },
);

JSXPreviewSkeleton.displayName = "JSXPreviewSkeleton";

export type JSXPreviewErrorProps = ComponentProps<"div"> & {
  children?: ReactNode | ((error: Error) => ReactNode);
};

const renderChildren = (
  children: ReactNode | ((error: Error) => ReactNode),
  error: Error,
): ReactNode => {
  if (typeof children === "function") {
    return children(error);
  }
  return children;
};

export const JSXPreviewError = memo(({ className, children, ...props }: JSXPreviewErrorProps) => {
  const { status, error } = useJSXPreview();

  // Terminal failures only — never while loading / streaming / incomplete.
  if (status !== "error" || !error) {
    return null;
  }

  return (
    <div
      // The status wash is the separation gesture (#194, research 08 §B.1):
      // `bg-destructive/10` + the destructive ink/icon already mark the region,
      // and the alpha-wash survives blueprint (token-inequality escape from the
      // drawn-not-filled rule), so the old `border border-destructive/50` was
      // redundant on every theme — dropped. Text + icon use `text-destructive-text`
      // (the on-surface destructive ink ramp) — raw `text-destructive` fails AA on
      // the wash (3.86:1) and goes near-white in dark; the *-text token is
      // AA-guaranteed and keeps the destructive cue in every theme.
      className={cn(
        "flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-body text-destructive-text",
        className,
      )}
      role="alert"
      {...props}
    >
      {children ? (
        renderChildren(children, error)
      ) : (
        <>
          <AlertCircle className="size-4 shrink-0" />
          <span>{error.message}</span>
        </>
      )}
    </div>
  );
});

JSXPreviewError.displayName = "JSXPreviewError";
