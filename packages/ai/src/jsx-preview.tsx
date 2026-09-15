"use client";

import { Skeleton } from "@elabs-ai/components-ui";
import { cn } from "@elabs-ai/components-ui/lib/cn";
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

/**
 * HTML elements that must never render from agent/model-authored JSX: script
 * execution, style/link/meta/base injection, and embeddable third-party
 * surfaces (iframe/object/embed) or a form that could post data out. Merged
 * with `react-jsx-parser`'s own default (`script`) via `blacklistedTags`.
 */
const JSX_PREVIEW_BLACKLISTED_TAGS = [
  "script",
  "style",
  "iframe",
  "form",
  "object",
  "embed",
  "link",
  "meta",
  "base",
];

export const useJSXPreview = () => {
  const context = useContext(JSXPreviewContext);
  if (!context) {
    throw new Error("JSXPreview components must be used within JSXPreview");
  }
  return context;
};

const TAG_NAME_START = /[a-zA-Z]/;
const TAG_NAME_CHAR = /[a-zA-Z0-9]/;

interface JsxTagMatch {
  tagName: string;
  type: "opening" | "closing" | "self-closing";
  endIndex: number;
}

/**
 * Finds the next complete JSX tag at or after `fromIndex`, tracking brace
 * depth and quoted strings so a `>` inside an attribute expression (e.g.
 * `onClick={() => foo()}`) is never mistaken for the tag's own closing
 * bracket (the previous plain regex did exactly that). Walks the ORIGINAL
 * string by absolute index — no per-iteration substring slicing — so one
 * pass over the whole input is linear.
 */
function findNextJsxTag(code: string, fromIndex: number): JsxTagMatch | null {
  const len = code.length;
  let i = fromIndex;

  while (i < len) {
    if (code[i] !== "<") {
      i++;
      continue;
    }

    let j = i + 1;
    const closing = code[j] === "/";
    if (closing) j++;

    const nameStart = j;
    if (!TAG_NAME_START.test(code[nameStart] ?? "")) {
      i++;
      continue;
    }
    j++;
    while (j < len && TAG_NAME_CHAR.test(code[j] ?? "")) {
      j++;
    }
    const tagName = code.slice(nameStart, j);

    let depth = 0;
    let quote: string | null = null;
    let k = j;
    let closedAt = -1;
    let selfClosing = false;

    while (k < len) {
      const ch = code[k];
      if (quote) {
        if (ch === quote) quote = null;
        k++;
        continue;
      }
      if (ch === '"' || ch === "'") {
        quote = ch;
        k++;
        continue;
      }
      if (ch === "{") {
        depth++;
        k++;
        continue;
      }
      if (ch === "}") {
        depth = Math.max(0, depth - 1);
        k++;
        continue;
      }
      if (depth === 0 && ch === ">") {
        let p = k - 1;
        while (p > j && code[p] === " ") p--;
        selfClosing = code[p] === "/";
        closedAt = k + 1;
        break;
      }
      k++;
    }

    // No closing '>' yet for this tag at this depth — it is incomplete, not
    // a match; the caller treats everything from here on as trailing text.
    if (closedAt === -1) {
      return null;
    }

    return {
      endIndex: closedAt,
      tagName,
      type: closing ? "closing" : selfClosing ? "self-closing" : "opening",
    };
  }

  return null;
}

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
  let position = 0;

  while (position < code.length) {
    const match = findNextJsxTag(code, position);
    if (!match) {
      // No more complete tags ahead; everything past `position` is trailing
      // text (possibly a mid-typed tag), handled by stripIncompleteTag below.
      break;
    }

    if (match.type === "opening") {
      stack.push(match.tagName);
    } else if (match.type === "closing") {
      stack.pop();
    }

    position = match.endIndex;
  }

  return (
    code.slice(0, position) +
    stripIncompleteTag(code.slice(position)) +
    [...stack]
      .reverse()
      .map((tag) => `</${tag}>`)
      .join("")
  );
};

/** How often `completeJsxTag` may re-run while content is still streaming in. */
const STREAM_RECOMPUTE_THROTTLE_MS = 80;

/**
 * Tag-balances `jsx` like `completeJsxTag`, but while `isStreaming` is true it
 * skips a fresh (expensive, whole-string) recompute more often than once per
 * `STREAM_RECOMPUTE_THROTTLE_MS` — otherwise every incoming token re-scans the
 * entire accumulated string from scratch. Settled input (`isStreaming` false)
 * always recomputes immediately so the final render is exact.
 */
function useCompletedJsx(jsx: string, isStreaming: boolean): string {
  const cacheRef = useRef({ jsx, result: completeJsxTag(jsx), time: 0 });

  return useMemo(() => {
    const cache = cacheRef.current;
    if (jsx === cache.jsx) return cache.result;

    const now = Date.now();
    if (isStreaming && now - cache.time < STREAM_RECOMPUTE_THROTTLE_MS) {
      return cache.result;
    }

    const result = completeJsxTag(jsx);
    cacheRef.current = { jsx, result, time: now };
    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- cacheRef is a stable ref, not reactive state
  }, [jsx, isStreaming]);
}

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
    // typed), not invalid. This is the timer-free "not-ready" signal. Throttled
    // while streaming so every incoming token doesn't re-scan the whole string.
    const completed = useCompletedJsx(jsx, isStreaming);
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
        allowUnknownElements={false}
        bindings={bindings}
        blacklistedTags={JSX_PREVIEW_BLACKLISTED_TAGS}
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
      // and the alpha-wash survives high decoration (token-inequality escape from the
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
