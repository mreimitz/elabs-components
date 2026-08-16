"use client";

import { Button } from "@elabs/components-ui";
import { ScrollArea, ScrollBar } from "@elabs/components-ui";
import { cn } from "@elabs/components-ui/lib/cn";
import type { ComponentProps, HTMLAttributes } from "react";
import { useCallback } from "react";

import { Shimmer } from "./shimmer";

export type SuggestionsProps = ComponentProps<typeof ScrollArea>;

export const Suggestions = ({ className, children, ...props }: SuggestionsProps) => (
  <ScrollArea className="w-full overflow-x-auto whitespace-nowrap" {...props}>
    <div className={cn("flex w-max flex-nowrap items-center gap-2", className)}>{children}</div>
    <ScrollBar className="hidden" orientation="horizontal" />
  </ScrollArea>
);

export type SuggestionProps = Omit<ComponentProps<typeof Button>, "onClick"> & {
  suggestion: string;
  onClick?: (suggestion: string) => void;
};

export const Suggestion = ({
  suggestion,
  onClick,
  className,
  // The soft tinted pill (#194, research 02 §3a BTN-2 / 08 §C.1): `secondary`
  // = borderless `bg-secondary` fill; the pill shape comes from `rounded-full`
  // below. The harsh `outline` (strong `--input` boundary) is for form-adjacent
  // controls, not chips.
  variant = "secondary",
  size = "sm",
  children,
  ...props
}: SuggestionProps) => {
  const handleClick = useCallback(() => {
    onClick?.(suggestion);
  }, [onClick, suggestion]);

  return (
    <Button
      className={cn("cursor-pointer rounded-full px-4", className)}
      onClick={handleClick}
      size={size}
      type="button"
      variant={variant}
      {...props}
    >
      {children || suggestion}
    </Button>
  );
};

export type SuggestionLoadingProps = HTMLAttributes<HTMLDivElement> & {
  /** Shimmering label shown while the suggestion set is still generating. */
  label?: string;
};

/**
 * A non-interactive trailing chip that shimmers while suggestions stream in.
 * Shaped like a `Suggestion` pill; composes `Shimmer` (motion-reduce aware) and
 * announces via `role="status"`. Render it after the chips while loading.
 */
export const SuggestionLoading = ({
  label = "Thinking…",
  className,
  ...props
}: SuggestionLoadingProps) => (
  <div
    role="status"
    aria-live="polite"
    className={cn(
      "inline-flex h-8 shrink-0 items-center rounded-full bg-secondary px-4 text-body",
      className,
    )}
    {...props}
  >
    <Shimmer as="span" className="text-secondary-foreground">
      {label}
    </Shimmer>
  </div>
);

export type StreamingSuggestionsProps = Omit<SuggestionsProps, "children"> & {
  /** The suggestions to render. As this array grows, new chips appear in place. */
  suggestions: string[];
  /** While true, a shimmering trailing chip is shown until the set settles. */
  loading?: boolean;
  /** Click handler for a suggestion chip. */
  onSuggestionClick?: (suggestion: string) => void;
  /** Label for the trailing loading chip. @default "Thinking…" */
  loadingLabel?: string;
};

/**
 * Suggestions that appear progressively while a generator streams. Each chip
 * fades in on mount (existing chips don't re-animate — keys are the suggestion
 * text); a shimmering trailing chip shows until `loading` flips false.
 */
export const StreamingSuggestions = ({
  suggestions,
  loading = false,
  onSuggestionClick,
  loadingLabel,
  ...props
}: StreamingSuggestionsProps) => (
  <Suggestions {...props}>
    {suggestions.map((s) => (
      <Suggestion
        key={s}
        suggestion={s}
        onClick={onSuggestionClick}
        className="animate-in fade-in-0 slide-in-from-bottom-1 duration-fast ease-entrance motion-reduce:animate-none"
      />
    ))}
    {loading && <SuggestionLoading label={loadingLabel} />}
  </Suggestions>
);
