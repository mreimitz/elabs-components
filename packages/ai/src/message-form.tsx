"use client";

/**
 * MessageForm — a model-emittable form rendered inside a chat message.
 *
 * The model emits a serializable `FormSpec` (see `message-form-spec.ts`); the
 * user fills it; the app receives structured `{ formName, values }` on submit.
 *
 * Design bar (mirrors AutoChart + ChangeReview):
 * - Spec-driven, zod-validated. The model is the author; it never chooses look.
 * - Never throws on model output. A malformed spec → `MessageFormFallback`.
 * - Streaming-tolerant. Half-arrived fields are dropped (not fatal); an empty
 *   spec while streaming shows a skeleton, never a crash.
 * - Compound + lifted state, controlled AND uncontrolled (the ChangeReview
 *   pattern): `MessageFormProvider` owns the values; the parts read a context.
 * - Tokens only; keyboard-operable; inline errors; focus the first error on
 *   submit; a submitted form renders inert with its values visible (a chat
 *   message is a historical record).
 *
 * Composes `@elabs/components-ui` inputs — it does NOT re-invent field primitives.
 *
 * Compound structure (named exports, the Card/CardHeader convention):
 *   <MessageFormProvider>   — lifted state (values + errors + actions)
 *     <MessageFormRoot>     — the <form> element (never nest inside another form)
 *       <MessageFormFields> — every field, or place <MessageFormField> yourself
 *       <MessageFormSubmit> — submit button / submitting spinner / submitted note
 */

import {
  createContext,
  forwardRef,
  use,
  useCallback,
  useId,
  useMemo,
  useState,
  type FormEvent,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import { Check } from "lucide-react";
import {
  Badge,
  Button,
  Checkbox,
  Input,
  Label,
  NumberInput,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  Spinner,
  Textarea,
} from "@elabs/components-ui";
import { cn } from "@elabs/components-ui/lib/cn";
import { useLocale } from "@elabs/components-ui";

import {
  fieldLabel,
  initialFormValues,
  normalizeFormSpec,
  optionLabel,
  optionValue,
  validateForm,
  type FieldSpec,
  type FormSpec,
  type FormSubmitState,
  type FormValue,
  type FormValues,
  type NormalizedFormSpec,
} from "./message-form-spec";

// ─── Context ────────────────────────────────────────────────────────────────

interface MessageFormContextValue {
  spec: NormalizedFormSpec;
  values: FormValues;
  /** Per-field error text, only populated after a submit attempt. */
  errors: Record<string, string | null>;
  setValue: (name: string, value: FormValue) => void;
  submit: () => void;
  reset: () => void;
  /** True once submit has been attempted (drives error visibility). */
  attempted: boolean;
  submitted: boolean;
  submitting: boolean;
  disabled: boolean;
  streaming: boolean;
  formId: string;
  headingId: string;
}

const MessageFormContext = createContext<MessageFormContextValue | null>(null);

function useMessageFormContext(): MessageFormContextValue {
  const ctx = use(MessageFormContext);
  if (!ctx) {
    throw new Error("MessageForm sub-components must be rendered inside <MessageFormProvider>.");
  }
  return ctx;
}

/** Stable DOM id for a field's primary control (used for label + focus). */
function controlId(formId: string, name: string): string {
  return `${formId}-field-${name}`;
}
function descId(formId: string, name: string): string {
  return `${formId}-desc-${name}`;
}
function errorId(formId: string, name: string): string {
  return `${formId}-error-${name}`;
}

/** The effective value for a field (state value, else its default). */
function effectiveValue(field: FieldSpec, values: FormValues): FormValue {
  const v = values[field.name];
  if (v !== undefined) return v;
  if (field.default !== undefined) return field.default;
  if (field.type === "boolean") return false;
  if (field.type === "multi-enum") return [];
  return undefined;
}

// ─── Provider ───────────────────────────────────────────────────────────────

export interface MessageFormProviderProps {
  /** A validated/normalized spec (a plain `FormSpec` also satisfies this). */
  spec: NormalizedFormSpec;
  /**
   * Controlled values. When provided the component is controlled and `onChange`
   * is the only way to update state.
   */
  values?: FormValues;
  /** Called with the next full values object on any field change. */
  onChange?: (values: FormValues) => void;
  /** Called with `{ formName, values }` when a valid form is submitted. */
  onSubmit?: (state: FormSubmitState) => void;
  /** Disable every control (form is not interactable). */
  disabled?: boolean;
  /** Terminal submitted state: controls are inert, values visible, no submit. */
  submitted?: boolean;
  /** In-flight submit: controls disabled, the submit button shows a spinner. */
  submitting?: boolean;
  /** The spec is still streaming in (renders a skeleton when no fields yet). */
  streaming?: boolean;
  children: ReactNode;
}

/**
 * Lifts the form values. Controlled (pass `values`) or uncontrolled.
 * Derives `isControlled = values !== undefined` and never flips modes.
 */
export function MessageFormProvider({
  spec,
  values: valuesProp,
  onChange,
  onSubmit,
  disabled = false,
  submitted = false,
  submitting = false,
  streaming = false,
  children,
}: MessageFormProviderProps) {
  const formId = useId();
  const headingId = `${formId}-title`;

  const isControlled = valuesProp !== undefined;
  const [internalValues, setInternalValues] = useState<FormValues>(() =>
    initialFormValues(spec.fields),
  );
  const [attempted, setAttempted] = useState(false);

  const resolvedValues = isControlled ? (valuesProp as FormValues) : internalValues;

  const setValue = useCallback(
    (name: string, value: FormValue) => {
      const base = isControlled ? (valuesProp as FormValues) : internalValues;
      const next: FormValues = { ...base, [name]: value };
      if (!isControlled) setInternalValues(next);
      onChange?.(next);
    },
    [isControlled, valuesProp, internalValues, onChange],
  );

  const submit = useCallback(() => {
    setAttempted(true);
    // Build the effective values (defaults folded in) for validation + payload.
    const merged: FormValues = { ...resolvedValues };
    for (const field of spec.fields) merged[field.name] = effectiveValue(field, resolvedValues);

    const errs = validateForm(spec.fields, merged);
    const firstInvalid = spec.fields.find((f) => errs[f.name]);
    if (firstInvalid) {
      // Focus the first field with an error (a11y: don't leave the user hunting).
      if (typeof document !== "undefined") {
        const el = document.getElementById(controlId(formId, firstInvalid.name));
        el?.focus();
      }
      return;
    }
    onSubmit?.({ formName: spec.formName, values: merged });
  }, [resolvedValues, spec.fields, spec.formName, formId, onSubmit]);

  const reset = useCallback(() => {
    setAttempted(false);
    const seeded = initialFormValues(spec.fields);
    if (!isControlled) setInternalValues(seeded);
    onChange?.(seeded);
  }, [isControlled, spec.fields, onChange]);

  // Errors only surface after a submit attempt; then they live-update on change.
  const errors = useMemo<Record<string, string | null>>(() => {
    if (!attempted) return {};
    const merged: FormValues = { ...resolvedValues };
    for (const field of spec.fields) merged[field.name] = effectiveValue(field, resolvedValues);
    return validateForm(spec.fields, merged);
  }, [attempted, resolvedValues, spec.fields]);

  const value = useMemo<MessageFormContextValue>(
    () => ({
      spec,
      values: resolvedValues,
      errors,
      setValue,
      submit,
      reset,
      attempted,
      submitted,
      submitting,
      disabled,
      streaming,
      formId,
      headingId,
    }),
    [
      spec,
      resolvedValues,
      errors,
      setValue,
      submit,
      reset,
      attempted,
      submitted,
      submitting,
      disabled,
      streaming,
      formId,
      headingId,
    ],
  );

  return <MessageFormContext.Provider value={value}>{children}</MessageFormContext.Provider>;
}

// ─── Field control renderers ──────────────────────────────────────────────────

interface FieldControlProps {
  field: FieldSpec;
  value: FormValue;
  invalid: boolean;
  disabled: boolean;
  readOnly: boolean;
  id: string;
  /** Id of the field's visible label (used by grouped controls' aria-labelledby). */
  labelId: string;
  describedBy: string | undefined;
  setValue: (name: string, value: FormValue) => void;
}

function StringControl({
  field,
  value,
  invalid,
  disabled,
  readOnly,
  id,
  describedBy,
  setValue,
}: FieldControlProps & { field: Extract<FieldSpec, { type: "string" }> }) {
  const text = value === undefined ? "" : String(value);
  const commonAria = {
    id,
    "aria-invalid": invalid || undefined,
    "aria-describedby": describedBy,
    "aria-required": field.required || undefined,
    required: field.required,
  } as const;

  if (field.multiline) {
    return (
      <Textarea
        {...commonAria}
        name={field.name}
        value={text}
        disabled={disabled}
        readOnly={readOnly}
        maxLength={field.maxLength}
        onChange={(e) => setValue(field.name, e.target.value)}
      />
    );
  }

  // Map the format hint → input type + autofill/keyboard hints.
  const inputType =
    field.format === "email"
      ? "email"
      : field.format === "uri"
        ? "url"
        : field.format === "date"
          ? "date"
          : field.format === "date-time"
            ? "datetime-local"
            : "text";
  const spellCheck = field.format === "email" || field.format === "uri" ? false : undefined;
  const inputMode = field.format === "email" ? "email" : field.format === "uri" ? "url" : undefined;

  return (
    <Input
      {...commonAria}
      type={inputType}
      name={field.name}
      value={text}
      disabled={disabled}
      readOnly={readOnly}
      minLength={field.minLength}
      maxLength={field.maxLength}
      spellCheck={spellCheck}
      inputMode={inputMode}
      onChange={(e) => setValue(field.name, e.target.value)}
    />
  );
}

function NumberControl({
  field,
  value,
  invalid,
  disabled,
  readOnly,
  id,
  describedBy,
  setValue,
}: FieldControlProps & { field: Extract<FieldSpec, { type: "number" | "integer" }> }) {
  const num = typeof value === "number" ? value : null;
  return (
    <NumberInput
      id={id}
      name={field.name}
      value={num}
      min={field.min}
      max={field.max}
      step={field.type === "integer" ? 1 : undefined}
      disabled={disabled}
      readOnly={readOnly}
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy}
      aria-required={field.required || undefined}
      onValueChange={(next) => setValue(field.name, next ?? undefined)}
    />
  );
}

function BooleanControl({
  field,
  value,
  disabled,
  id,
  describedBy,
  setValue,
}: FieldControlProps & { field: Extract<FieldSpec, { type: "boolean" }> }) {
  // Checkbox + clickable label share ONE hit target (no dead zone).
  return (
    <div className="flex items-center gap-2">
      <Checkbox
        id={id}
        name={field.name}
        checked={value === true}
        disabled={disabled}
        aria-describedby={describedBy}
        aria-required={field.required || undefined}
        onCheckedChange={(checked) => setValue(field.name, checked === true)}
      />
      <Label htmlFor={id} className="flex items-center gap-1 font-normal">
        {fieldLabel(field)}
        {field.required && (
          <span aria-hidden="true" className="text-destructive-text">
            *
          </span>
        )}
      </Label>
    </div>
  );
}

function EnumControl({
  field,
  value,
  invalid,
  disabled,
  id,
  describedBy,
  setValue,
}: FieldControlProps & { field: Extract<FieldSpec, { type: "enum" }> }) {
  const { t } = useLocale();
  const current = typeof value === "string" && value.length > 0 ? value : undefined;
  return (
    <Select value={current} disabled={disabled} onValueChange={(v) => setValue(field.name, v)}>
      <SelectTrigger
        id={id}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        aria-required={field.required || undefined}
      >
        <SelectValue placeholder={t("ai.messageForm.selectPlaceholder")} />
      </SelectTrigger>
      <SelectContent>
        {field.options.map((option) => (
          <SelectItem key={optionValue(option)} value={optionValue(option)}>
            {optionLabel(option)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function MultiEnumControl({
  field,
  value,
  disabled,
  id,
  labelId,
  describedBy,
  setValue,
}: FieldControlProps & { field: Extract<FieldSpec, { type: "multi-enum" }> }) {
  const selected = Array.isArray(value) ? value : [];
  const toggle = (optValue: string, checked: boolean) => {
    const next = checked ? [...selected, optValue] : selected.filter((v) => v !== optValue);
    setValue(field.name, next);
  };
  return (
    // The group is the focus-first-error target (id + tabIndex=-1). It is named
    // by the field's visible label via aria-labelledby — NOT aria-label — so no
    // single checkbox ends up with two <label for> associations.
    <div
      role="group"
      id={id}
      tabIndex={-1}
      aria-labelledby={labelId}
      aria-describedby={describedBy}
      className="flex flex-col gap-2 focus:outline-none"
    >
      {field.options.map((option) => {
        const optValue = optionValue(option);
        const optionId = `${id}-${optValue}`;
        return (
          <div key={optValue} className="flex items-center gap-2">
            <Checkbox
              id={optionId}
              checked={selected.includes(optValue)}
              disabled={disabled}
              onCheckedChange={(checked) => toggle(optValue, checked === true)}
            />
            <Label htmlFor={optionId} className="font-normal">
              {optionLabel(option)}
            </Label>
          </div>
        );
      })}
    </div>
  );
}

// ─── Field ────────────────────────────────────────────────────────────────────

export interface MessageFormFieldProps extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  /** The field's `name` (its key in the spec + values). */
  name: string;
}

/**
 * Renders one field by name: label, control, description, inline error.
 * Boolean fields render their own inline label (checkbox + label), so the
 * standalone `<Label>` above is suppressed for them.
 */
export const MessageFormField = forwardRef<HTMLDivElement, MessageFormFieldProps>(
  function MessageFormField({ name, className, ...props }, ref) {
    const ctx = useMessageFormContext();
    const field = ctx.spec.fields.find((f) => f.name === name);
    if (!field) return null;

    const id = controlId(ctx.formId, name);
    const labelId = `${ctx.formId}-label-${name}`;
    const value = effectiveValue(field, ctx.values);
    const error = ctx.errors[name] ?? null;
    const invalid = Boolean(error);
    const controlDisabled = ctx.disabled || ctx.submitted || ctx.submitting;
    const readOnly = ctx.submitted;
    const description = field.description;
    const hasDesc = Boolean(description);
    const describedBy =
      [hasDesc ? descId(ctx.formId, name) : null, invalid ? errorId(ctx.formId, name) : null]
        .filter(Boolean)
        .join(" ") || undefined;

    const controlProps: FieldControlProps = {
      field,
      value,
      invalid,
      disabled: controlDisabled,
      readOnly,
      id,
      labelId,
      describedBy,
      setValue: ctx.setValue,
    };

    const isBoolean = field.type === "boolean";
    // A multi-enum renders a checkbox group named via aria-labelledby, so its
    // label must NOT use htmlFor (which would associate with a single control).
    const isGroupField = field.type === "multi-enum";

    return (
      <div ref={ref} className={cn("flex flex-col gap-1.5", className)} {...props}>
        {!isBoolean && (
          <Label
            id={labelId}
            htmlFor={isGroupField ? undefined : id}
            className="flex items-center gap-1"
          >
            {fieldLabel(field)}
            {field.required && (
              <span aria-hidden="true" className="text-destructive-text">
                *
              </span>
            )}
          </Label>
        )}

        {field.type === "string" && <StringControl {...controlProps} field={field} />}
        {(field.type === "number" || field.type === "integer") && (
          <NumberControl {...controlProps} field={field} />
        )}
        {field.type === "boolean" && <BooleanControl {...controlProps} field={field} />}
        {field.type === "enum" && <EnumControl {...controlProps} field={field} />}
        {field.type === "multi-enum" && <MultiEnumControl {...controlProps} field={field} />}

        {hasDesc && (
          <p id={descId(ctx.formId, name)} className="text-caption text-muted-foreground">
            {description}
          </p>
        )}
        {invalid && (
          <p id={errorId(ctx.formId, name)} className="text-caption text-destructive-text">
            {error}
          </p>
        )}
      </div>
    );
  },
);

// ─── Fields (all) ─────────────────────────────────────────────────────────────

export type MessageFormFieldsProps = HTMLAttributes<HTMLDivElement>;

/** Renders every field in the spec, in order. A skeleton while streaming empty. */
export const MessageFormFields = forwardRef<HTMLDivElement, MessageFormFieldsProps>(
  function MessageFormFields({ className, ...props }, ref) {
    const { spec, streaming } = useMessageFormContext();

    if (spec.fields.length === 0 && streaming) {
      return (
        <div ref={ref} className={cn("flex flex-col gap-4", className)} {...props}>
          <span className="sr-only" role="status" aria-live="polite">
            Loading form…
          </span>
          <div aria-hidden="true" className="flex flex-col gap-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex flex-col gap-1.5">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-9 w-full" />
              </div>
            ))}
          </div>
        </div>
      );
    }

    return (
      <div ref={ref} className={cn("flex flex-col gap-4", className)} {...props}>
        {spec.fields.map((field) => (
          <MessageFormField key={field.name} name={field.name} />
        ))}
      </div>
    );
  },
);

// ─── Submit ───────────────────────────────────────────────────────────────────

export interface MessageFormSubmitProps extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  /** Submit button label (overrides `spec.submitLabel`). @default "Submit" */
  label?: string;
}

/**
 * The submit affordance. Enabled until the request starts (validation runs on
 * click), then a spinner. A submitted form shows an inert "Submitted" note.
 */
export const MessageFormSubmit = forwardRef<HTMLDivElement, MessageFormSubmitProps>(
  function MessageFormSubmit({ label, className, ...props }, ref) {
    const { spec, submitting, submitted, disabled } = useMessageFormContext();

    if (submitted) {
      return (
        <div ref={ref} className={cn("flex items-center", className)} {...props}>
          <Badge variant="success" aria-live="polite">
            <Check aria-hidden="true" className="size-3" />
            Submitted
          </Badge>
        </div>
      );
    }

    const text = label ?? spec.submitLabel ?? "Submit";
    return (
      <div ref={ref} className={cn("flex items-center", className)} {...props}>
        <Button type="submit" disabled={disabled || submitting} aria-busy={submitting || undefined}>
          {submitting && <Spinner aria-hidden="true" className="text-current" />}
          {submitting ? "Submitting…" : text}
        </Button>
      </div>
    );
  },
);

// ─── Root (the <form> element) ────────────────────────────────────────────────

export type MessageFormRootProps = Omit<HTMLAttributes<HTMLFormElement>, "onSubmit">;

/**
 * The `<form>` element wired to the context's `submit`. Never nest inside
 * another `<form>` — compose it as its own message-body block.
 */
export const MessageFormRoot = forwardRef<HTMLFormElement, MessageFormRootProps>(
  function MessageFormRoot({ className, children, ...props }, ref) {
    const { t } = useLocale();
    const { submit, headingId, spec, disabled, submitting } = useMessageFormContext();
    const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (disabled || submitting) return;
      submit();
    };
    return (
      <form
        ref={ref}
        noValidate
        onSubmit={handleSubmit}
        aria-labelledby={spec.title ? headingId : undefined}
        aria-label={spec.title ? undefined : spec.formName || t("ai.messageForm.label")}
        className={cn("flex w-full flex-col gap-4", className)}
        {...props}
      >
        {children}
      </form>
    );
  },
);

// ─── Title + Description ──────────────────────────────────────────────────────

export type MessageFormTitleProps = HTMLAttributes<HTMLParagraphElement>;

/** The form heading. Its id is the `<form>`'s `aria-labelledby` target. */
export const MessageFormTitle = forwardRef<HTMLParagraphElement, MessageFormTitleProps>(
  function MessageFormTitle({ className, children, ...props }, ref) {
    const { headingId, spec } = useMessageFormContext();
    const content = children ?? spec.title;
    if (!content) return null;
    return (
      <p
        ref={ref}
        id={headingId}
        className={cn("text-subtitle font-semibold text-foreground text-balance", className)}
        {...props}
      >
        {content}
      </p>
    );
  },
);

export type MessageFormDescriptionProps = HTMLAttributes<HTMLParagraphElement>;

/** Supplemental description under the title. */
export const MessageFormDescription = forwardRef<HTMLParagraphElement, MessageFormDescriptionProps>(
  function MessageFormDescription({ className, children, ...props }, ref) {
    const { spec } = useMessageFormContext();
    const content = children ?? spec.description;
    if (!content) return null;
    return (
      <p
        ref={ref}
        className={cn("text-body text-muted-foreground text-pretty", className)}
        {...props}
      >
        {content}
      </p>
    );
  },
);

// ─── Fallback ─────────────────────────────────────────────────────────────────

export interface MessageFormFallbackProps extends HTMLAttributes<HTMLDivElement> {
  /** Short human reason the form could not render. */
  message?: string;
}

/**
 * Shown when the spec is unusable. Mirrors `ChartFallback`: a calm, bordered
 * status box with a short reason — never a thrown error.
 */
export const MessageFormFallback = forwardRef<HTMLDivElement, MessageFormFallbackProps>(
  function MessageFormFallback(
    { message = "This form could not be displayed.", className, ...props },
    ref,
  ) {
    return (
      <div
        ref={ref}
        role="status"
        aria-live="polite"
        className={cn(
          // Sole structural cue is the border (no fill) — reads in every theme.
          "flex items-center justify-center rounded-md border border-border-strong px-4 py-6 text-center text-body text-muted-foreground",
          className,
        )}
        {...props}
      >
        {message}
      </div>
    );
  },
);

// ─── Root convenience component ────────────────────────────────────────────────

export interface MessageFormProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  "onSubmit" | "onChange" | "title"
> {
  /** The serializable form specification produced by an LLM tool-call. */
  spec: FormSpec | unknown;
  /** Controlled values (`{ [fieldName]: value }`). Omit for uncontrolled. */
  values?: FormValues;
  /** Called with the next full values object on any change. */
  onChange?: (values: FormValues) => void;
  /** Called with `{ formName, values }` on a valid submit. */
  onSubmit?: (state: FormSubmitState) => void;
  /** Submit button label (overrides `spec.submitLabel`). */
  submitLabel?: string;
  /** Disable every control. */
  disabled?: boolean;
  /** Terminal submitted state: inert, values visible, submit replaced. */
  submitted?: boolean;
  /** In-flight submit: controls disabled, spinner on submit. */
  submitting?: boolean;
  /** The spec is still streaming (renders a skeleton when no fields yet). */
  streaming?: boolean;
}

/**
 * Convenience composition: `Provider → Root(form) → title/description → Fields →
 * Submit`. For a custom layout, compose `MessageFormProvider` + the parts.
 * A malformed spec renders `MessageFormFallback` (never throws).
 */
export const MessageForm = forwardRef<HTMLDivElement, MessageFormProps>(function MessageForm(
  {
    spec,
    values,
    onChange,
    onSubmit,
    submitLabel,
    disabled,
    submitted,
    submitting,
    streaming,
    className,
    ...props
  },
  ref,
) {
  const result = normalizeFormSpec(spec);
  if (!result.ok) {
    return (
      <MessageFormFallback ref={ref} message={result.reason} className={className} {...props} />
    );
  }

  const normalized = result.spec;
  const empty = normalized.fields.length === 0;

  // Not streaming + no fields → the spec is structurally valid but useless.
  if (empty && !streaming) {
    return (
      <MessageFormFallback
        ref={ref}
        message="This form has no fields to fill in."
        className={className}
        {...props}
      />
    );
  }

  return (
    <MessageFormProvider
      spec={normalized}
      values={values}
      onChange={onChange}
      onSubmit={onSubmit}
      disabled={disabled}
      submitted={submitted}
      submitting={submitting}
      streaming={streaming}
    >
      <div ref={ref} className={cn("w-full", className)} {...props}>
        <MessageFormRoot>
          {(normalized.title || normalized.description) && (
            <div className="flex flex-col gap-1">
              <MessageFormTitle />
              <MessageFormDescription />
            </div>
          )}
          <MessageFormFields />
          <MessageFormSubmit label={submitLabel} />
        </MessageFormRoot>
      </div>
    </MessageFormProvider>
  );
});
