"use client";

// a2ui.exposed: yes
import {
  forwardRef,
  useCallback,
  useMemo,
  useRef,
  useState,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { X } from "lucide-react";
import { cn } from "../../lib/cn";
import { Badge, type BadgeProps } from "../badge";
import { InputGroup } from "../input-group";

export interface TagInputProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  "defaultValue" | "onChange"
> {
  /** Controlled tag list. */
  value?: string[];
  /** Uncontrolled initial tag list. */
  defaultValue?: string[];
  /** Called when the tag list changes. */
  onValueChange?: (value: string[]) => void;
  /** Maximum number of tags allowed. */
  max?: number;
  /**
   * Validate a candidate tag before it is added.
   * Return `true` to accept, `false` to silently reject, or a string
   * to reject and show as an inline error message.
   */
  validate?: (tag: string) => boolean | string;
  /**
   * Characters (or strings) that trigger tag creation in addition to Enter.
   * Defaults to `[","]`.
   */
  delimiter?: string[];
  /** Allow duplicate tags (default false). */
  allowDuplicates?: boolean;
  /** Placeholder text for the entry field. */
  placeholder?: string;
  /** Whether the input is disabled. */
  disabled?: boolean;
  /** id for the underlying text input (useful for external <label>). */
  id?: string;
  /** Name forwarded to the underlying input. */
  name?: string;
  /** aria-label for the underlying text input. */
  "aria-label"?: string;
  /** aria-labelledby for the underlying text input. */
  "aria-labelledby"?: string;
  /** aria-describedby for the underlying text input (a hint under the field). */
  "aria-describedby"?: string;
  /** `inputMode` of the underlying text input (`"email"` for an address list). */
  inputMode?: InputHTMLAttributes<HTMLInputElement>["inputMode"];
  /**
   * Canonical form of a tag before it is compared and stored — lower-casing
   * an e-mail address, say. Runs after trimming.
   */
  normalize?: (tag: string) => string;
  /** Commit whatever is typed when the field loses focus (default false). */
  addOnBlur?: boolean;
  /**
   * The chip's content. Default: the tag text. Use it to put a control beside
   * the tag (a role picker per address); the remove button stays the input's.
   */
  renderTag?: (tag: string, index: number) => ReactNode;
  /**
   * The chip's `Badge` look per tag — a flagged address can read
   * `{ variant: "destructive", appearance: "tint" }`. Default: `secondary`.
   */
  tagVariant?: (tag: string, index: number) => Pick<BadgeProps, "variant" | "appearance">;
}

/**
 * TagInput — chip-style multi-value text entry.
 *
 * Controlled via `value`/`onValueChange`; uncontrolled via `defaultValue`.
 * Enter + configurable delimiters (default `[","]`) add a tag.
 * Backspace on an empty field removes the last tag.
 * Inline validation errors render with `role="alert"`.
 */
export const TagInput = forwardRef<HTMLDivElement, TagInputProps>(function TagInput(
  {
    value: valueProp,
    defaultValue,
    onValueChange,
    max,
    validate,
    delimiter = [","],
    allowDuplicates = false,
    placeholder,
    disabled,
    id,
    name,
    "aria-label": ariaLabel,
    "aria-labelledby": ariaLabelledby,
    "aria-describedby": ariaDescribedby,
    inputMode,
    normalize,
    addOnBlur = false,
    renderTag,
    tagVariant,
    className,
    ...props
  },
  ref,
) {
  const isControlled = valueProp !== undefined;
  const [internalTags, setInternalTags] = useState<string[]>(defaultValue ?? []);
  const [inputValue, setInputValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const tags = useMemo(
    () => (isControlled ? (valueProp ?? []) : internalTags),
    [isControlled, valueProp, internalTags],
  );

  const commit = useCallback(
    (next: string[]) => {
      if (!isControlled) setInternalTags(next);
      onValueChange?.(next);
    },
    [isControlled, onValueChange],
  );

  const addTag = useCallback(
    (raw: string) => {
      const trimmed = raw.trim();
      const tag = normalize ? normalize(trimmed) : trimmed;
      if (!tag) return;

      if (max !== undefined && tags.length >= max) {
        setError(`Maximum of ${max} tags reached.`);
        return;
      }

      if (!allowDuplicates && tags.includes(tag)) {
        setError("Duplicate tag.");
        return;
      }

      if (validate) {
        const result = validate(tag);
        if (result === false) return;
        if (typeof result === "string") {
          setError(result);
          return;
        }
      }

      setError(null);
      commit([...tags, tag]);
      setInputValue("");
    },
    [tags, max, allowDuplicates, validate, normalize, commit],
  );

  const removeTag = useCallback(
    (index: number) => {
      const next = tags.filter((_, i) => i !== index);
      setError(null);
      commit(next);
    },
    [tags, commit],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        // Always prevent form submission when used inside a <form>
        e.preventDefault();
        addTag(inputValue);
        return;
      }

      if (e.key === "Backspace" && inputValue === "" && tags.length > 0) {
        e.preventDefault();
        removeTag(tags.length - 1);
        return;
      }

      // Check delimiter characters (e.g. comma)
      for (const delim of delimiter) {
        if (delim.length === 1 && e.key === delim) {
          e.preventDefault();
          addTag(inputValue);
          return;
        }
      }
    },
    [inputValue, tags, delimiter, addTag, removeTag],
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      // Handle paste or typed multi-char delimiters
      const hasDelimiter = delimiter.some((d) => val.includes(d));
      if (hasDelimiter) {
        const parts = val.split(new RegExp(`[${delimiter.map((d) => escapeRegex(d)).join("")}]`));
        const toAdd = parts.slice(0, -1);
        const remaining = parts[parts.length - 1] ?? "";
        for (const part of toAdd) {
          addTag(part);
        }
        setInputValue(remaining);
      } else {
        setInputValue(val);
        setError(null);
      }
    },
    [delimiter, addTag],
  );

  const atMax = max !== undefined && tags.length >= max;

  return (
    <div
      ref={ref}
      data-slot="tag-input"
      className={cn("flex flex-col gap-1", className)}
      {...props}
    >
      <InputGroup
        className="h-auto min-h-9 flex-wrap gap-1 px-2 py-1 cursor-text"
        onClick={() => inputRef.current?.focus()}
      >
        {tags.map((tag, i) => (
          <Badge
            key={`${tag}-${i}`}
            variant="secondary"
            {...tagVariant?.(tag, i)}
            className="gap-1 pe-1 shrink-0"
            data-tag={tag}
          >
            {renderTag ? renderTag(tag, i) : <span className="max-w-[12rem] truncate">{tag}</span>}
            <button
              type="button"
              aria-label={`Remove ${tag}`}
              disabled={disabled}
              onClick={(e) => {
                e.stopPropagation();
                removeTag(i);
              }}
              className={cn(
                "rounded-full p-0.5 transition-colors",
                "hover:bg-secondary-foreground/20 focus-ring",
                "disabled:pointer-events-none disabled:opacity-50",
              )}
            >
              <X className="size-3" aria-hidden="true" />
            </button>
          </Badge>
        ))}
        <input
          ref={inputRef}
          id={id}
          name={name}
          type="text"
          value={inputValue}
          placeholder={atMax ? undefined : placeholder}
          disabled={disabled || atMax}
          aria-label={ariaLabel}
          aria-labelledby={ariaLabelledby}
          aria-describedby={ariaDescribedby}
          inputMode={inputMode}
          aria-invalid={error ? "true" : undefined}
          data-slot="input-group-control"
          className={cn(
            "min-w-[6rem] flex-1 bg-transparent text-body outline-none",
            "placeholder:text-muted-foreground",
            "disabled:cursor-not-allowed disabled:opacity-50",
          )}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onBlur={addOnBlur && inputValue.trim() ? () => addTag(inputValue) : undefined}
          autoComplete="off"
          spellCheck={false}
        />
      </InputGroup>
      {error && (
        // #124: running text (the validation message) — ink rung.
        <p role="alert" className="text-meta text-destructive-text">
          {error}
        </p>
      )}
    </div>
  );
});

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
