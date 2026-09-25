"use client";

import {
  forwardRef,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ForwardedRef,
  type HTMLAttributes,
  type ReactElement,
  type ReactNode,
  type Ref,
} from "react";
import { Braces, ChevronDown, CircleAlert, CircleCheck, RotateCcw } from "lucide-react";
import { cn } from "../../lib/cn";
import { useControllableState } from "../../lib/use-controllable-state";
import { Badge } from "../badge";
import { Button } from "../button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../dropdown-menu";
import { Textarea } from "../textarea";
import { lineOfParseError, locateJsonPath, offsetOfLine } from "./locate-json-path";

/** One problem a validator reports — the shape the A2UI validator uses. */
export interface SpecPlaygroundError {
  /** JSON-path-like address of the problem (`root.children[2].props.label`, `$.tiles[0]`). */
  path: string;
  /** The validator's machine-readable code (`missing-prop`, `overlap`, …). */
  code: string;
  message: string;
}

/** What `validate` returns: the typed spec, or the validator's own errors. */
export type SpecPlaygroundValidation<TSpec> =
  | { ok: true; spec: TSpec }
  | { ok: false; errors: readonly SpecPlaygroundError[] };

/** An entry in the `Load example` menu. */
export interface SpecPlaygroundExample {
  id: string;
  label: string;
  /** The JSON text loaded into the editor. */
  value: string;
}

/** The playground's status: what the last validated text turned out to be. */
export type SpecPlaygroundStatus = "valid" | "invalid" | "parse-error";

/** Every string the playground renders — pass your own to localize it. */
export interface SpecPlaygroundLabels {
  /** Accessible name of the default textarea editor. */
  editor: string;
  /** Accessible name of the rendered-result region. */
  preview: string;
  /** Accessible name of the error list. */
  errors: string;
  /** Trigger of the examples menu. */
  loadExample: string;
  /** Resets the editor to its initial text. */
  reset: string;
  /** Status chip: the text validates. */
  valid: string;
  /** Status chip: the validator reported `count` errors. */
  errorCount: (count: number) => string;
  /** Status chip: the text is not JSON. */
  parseError: string;
  /** Shown over the render when it is the last valid spec, not the current text. */
  showingLastValid: string;
  /** Shown in the render pane before any text has validated. */
  nothingValid: string;
  /** Suffix naming the editor line an error points at. */
  line: (line: number) => string;
}

export const DEFAULT_SPEC_PLAYGROUND_LABELS: SpecPlaygroundLabels = {
  editor: "Spec (JSON)",
  preview: "Rendered result",
  errors: "Problems",
  loadExample: "Load example",
  reset: "Reset",
  valid: "Valid",
  errorCount: (count) => (count === 1 ? "1 error" : `${count} errors`),
  parseError: "Parse error",
  showingLastValid: "Showing last valid",
  nothingValid: "Nothing valid to render yet.",
  line: (line) => `line ${line}`,
};

export interface SpecPlaygroundProps<TSpec> extends Omit<
  HTMLAttributes<HTMLDivElement>,
  "onChange" | "defaultValue"
> {
  /** The JSON text (controlled). */
  value?: string;
  /** Initial JSON text (uncontrolled); also what `Reset` restores. Default: the first example. */
  defaultValue?: string;
  /** Called with the new text on every edit, example load and reset. */
  onChange?: (value: string) => void;
  /** Checks the parsed JSON; the errors shown are exactly the ones it returns. */
  validate: (json: unknown) => SpecPlaygroundValidation<TSpec>;
  /** Renders a validated spec. */
  render: (spec: TSpec) => ReactNode;
  /** Entries of the `Load example` menu (the menu is hidden without any). */
  examples?: readonly SpecPlaygroundExample[];
  /**
   * The editor. Bind it to `value`/`onChange` yourself. Default: a `Textarea`, so the
   * playground works without a code editor.
   */
  editor?: ReactNode;
  /**
   * Called when an error is chosen, with the editor line its path resolves to — move a custom
   * editor's caret there. The default textarea handles this itself.
   */
  onErrorSelect?: (error: SpecPlaygroundError, line: number | undefined) => void;
  /** Milliseconds between the last edit and validation. Default 250. */
  debounceMs?: number;
  labels?: Partial<SpecPlaygroundLabels>;
}

type Checked<TSpec> =
  | { status: "valid"; spec: TSpec; errors: readonly SpecPlaygroundError[] }
  | { status: "invalid" | "parse-error"; errors: readonly SpecPlaygroundError[] };

function check<TSpec>(
  text: string,
  validate: (json: unknown) => SpecPlaygroundValidation<TSpec>,
): Checked<TSpec> {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { status: "parse-error", errors: [{ path: "", code: "parse-error", message }] };
  }
  const result = validate(json);
  return result.ok
    ? { status: "valid", spec: result.spec, errors: [] }
    : { status: "invalid", errors: result.errors };
}

function SpecPlaygroundInner<TSpec>(
  {
    value: valueProp,
    defaultValue,
    onChange,
    validate,
    render,
    examples = [],
    editor,
    onErrorSelect,
    debounceMs = 250,
    labels: labelsProp,
    className,
    ...props
  }: SpecPlaygroundProps<TSpec>,
  ref: ForwardedRef<HTMLDivElement>,
) {
  const labels = { ...DEFAULT_SPEC_PLAYGROUND_LABELS, ...labelsProp };
  const initial = defaultValue ?? examples[0]?.value ?? "";
  const [resetValue] = useState(initial);
  const [value, setValue] = useControllableState(valueProp, initial, onChange);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Validation trails the text by `debounceMs`; the first render validates immediately.
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    if (settled === value) return;
    const timer = setTimeout(() => setSettled(value), debounceMs);
    return () => clearTimeout(timer);
  }, [value, settled, debounceMs]);

  const checked = useMemo(() => check(settled, validate), [settled, validate]);

  // The last spec that validated — kept on screen while the current text does not. Updated in an
  // effect, never mutated during render: a render can be re-run or discarded (React concurrent
  // rendering) before it commits, and a ref write in the render body would still take effect.
  const [lastValid, setLastValid] = useState<{ spec: TSpec } | null>(
    checked.status === "valid" ? { spec: checked.spec } : null,
  );
  useEffect(() => {
    if (checked.status === "valid") setLastValid({ spec: checked.spec });
  }, [checked]);
  const shown = checked.status === "valid" ? { spec: checked.spec } : lastValid;
  const stale = checked.status !== "valid" && shown !== null;

  const lineOf = (error: SpecPlaygroundError) =>
    error.code === "parse-error"
      ? lineOfParseError(settled, error.message)
      : locateJsonPath(settled, error.path);

  const selectError = (error: SpecPlaygroundError) => {
    const line = lineOf(error);
    if (onErrorSelect) return onErrorSelect(error, line);
    const textarea = textareaRef.current;
    if (!textarea) return;
    const offset = line === undefined ? 0 : offsetOfLine(textarea.value, line);
    textarea.focus();
    textarea.setSelectionRange(offset, offset);
  };

  // `useId()`, never a shared literal — two id-less instances must not collide on the same DOM id.
  const generatedId = useId();
  const errorListId = `${props.id ?? generatedId}-errors`;
  const hasErrors = checked.errors.length > 0;

  return (
    <div
      ref={ref}
      data-slot="spec-playground"
      data-status={checked.status}
      className={cn("grid min-w-0 gap-4 lg:grid-cols-2", className)}
      {...props}
    >
      <div data-slot="spec-playground-source" className="flex min-w-0 flex-col gap-3">
        <div data-slot="spec-playground-toolbar" className="flex flex-wrap items-center gap-2">
          <span role="status" aria-live="polite" className="me-auto">
            <Badge
              data-slot="spec-playground-status"
              data-status={checked.status}
              variant={
                checked.status === "valid"
                  ? "success"
                  : checked.status === "invalid"
                    ? "destructive"
                    : "warning"
              }
              className="gap-1"
            >
              {checked.status === "valid" ? (
                <CircleCheck aria-hidden="true" size={14} />
              ) : checked.status === "invalid" ? (
                <CircleAlert aria-hidden="true" size={14} />
              ) : (
                <Braces aria-hidden="true" size={14} />
              )}
              {checked.status === "valid"
                ? labels.valid
                : checked.status === "invalid"
                  ? labels.errorCount(checked.errors.length)
                  : labels.parseError}
            </Badge>
          </span>
          {examples.length > 0 ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" data-slot="spec-playground-examples">
                  {labels.loadExample}
                  <ChevronDown aria-hidden="true" size={14} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {examples.map((example) => (
                  <DropdownMenuItem
                    key={example.id}
                    data-example-id={example.id}
                    onSelect={() => setValue(example.value)}
                  >
                    {example.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
          <Button
            variant="ghost"
            size="sm"
            data-slot="spec-playground-reset"
            onClick={() => setValue(resetValue)}
          >
            <RotateCcw aria-hidden="true" size={14} />
            {labels.reset}
          </Button>
        </div>
        <div data-slot="spec-playground-editor" className="min-h-80 min-w-0">
          {editor ?? (
            <Textarea
              ref={textareaRef}
              data-slot="spec-playground-textarea"
              aria-label={labels.editor}
              aria-invalid={hasErrors || undefined}
              aria-describedby={hasErrors ? errorListId : undefined}
              spellCheck={false}
              value={value}
              onChange={(event) => setValue(event.target.value)}
              className="h-80 min-h-80 resize-y font-mono text-code"
            />
          )}
        </div>
        {hasErrors ? (
          <ol
            id={errorListId}
            aria-label={labels.errors}
            data-slot="spec-playground-errors"
            className="flex flex-col gap-1"
          >
            {checked.errors.map((error) => {
              const line = lineOf(error);
              return (
                <li key={`${error.path}|${error.code}|${error.message}`}>
                  <button
                    type="button"
                    data-slot="spec-playground-error"
                    data-path={error.path}
                    data-code={error.code}
                    onClick={() => selectError(error)}
                    className="focus-ring flex w-full min-w-0 flex-wrap items-baseline gap-x-2 rounded-md border-s-2 border-s-destructive px-2 py-1 text-start text-caption hover:bg-muted"
                  >
                    {error.path ? <code className="font-mono text-code">{error.path}</code> : null}
                    <span className="font-mono text-code text-destructive-text">{error.code}</span>
                    <span className="min-w-0 break-words text-muted-foreground">
                      {error.message}
                    </span>
                    {line !== undefined ? (
                      <span className="text-meta text-muted-foreground">{labels.line(line)}</span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ol>
        ) : null}
      </div>
      <section
        aria-label={labels.preview}
        data-slot="spec-playground-preview"
        data-stale={stale ? "" : undefined}
        className="flex min-w-0 flex-col gap-2"
      >
        {stale ? (
          <Badge variant="outline" data-slot="spec-playground-stale" className="self-start">
            {labels.showingLastValid}
          </Badge>
        ) : null}
        {shown ? (
          render(shown.spec)
        ) : (
          <p className="text-caption text-muted-foreground">{labels.nothingValid}</p>
        )}
      </section>
    </div>
  );
}

/**
 * A live spec editor: JSON on the left, what it renders on the right (stacked below 1024 px).
 * Edits are validated after a short pause by the host's own `validate`; its errors are listed
 * under the editor (`path · code · message`, click to jump to the line) and the render keeps
 * the last valid spec, marked as such, until the text validates again. The editor, validator
 * and renderer all come from the host — this component owns only the loop between them.
 */
export const SpecPlayground = forwardRef(SpecPlaygroundInner) as <TSpec>(
  props: SpecPlaygroundProps<TSpec> & { ref?: Ref<HTMLDivElement> },
) => ReactElement;
(SpecPlayground as { displayName?: string }).displayName = "SpecPlayground";
