"use client";

/**
 * SchemaForm — a spec-driven configuration-form renderer (issue #22).
 *
 * A product describes a form (connector settings, environment variables, an
 * auth method picker) as data; SchemaForm renders it; the app receives
 * structured `{ formName, values }` on submit. This is the GENERAL, app-UI
 * sibling of `@elabs-ai/components-ai`'s chat-scoped `MessageForm` — see
 * `schema-form-spec.ts` for why the two stay separate schemas rather than one
 * generalized union.
 *
 * Design bar (mirrors MessageForm/AutoChart/ChangeReview):
 * - Spec-driven, zod-validated. The spec author never chooses look.
 * - Never throws on bad input. A malformed spec → `SchemaFormFallback`.
 * - Compound + lifted state, controlled AND uncontrolled: `SchemaFormProvider`
 *   owns the values; the parts read a context.
 * - Tokens only; keyboard-operable; inline errors; focus the first error on
 *   submit; a submitted form renders inert with its values visible.
 * - Submit control is NEVER natively `disabled` while transiently blocked
 *   (submitting) — `aria-disabled` + a click/submit handler guard, so a
 *   keyboard user is never dropped from the focus order right after they
 *   used it (interaction-guidelines.md). An explicit, caller-set `disabled`
 *   (the whole form is read-only) stays native — that is a deliberate,
 *   durable removal from the tab order, not a transient auto-flip.
 *
 * Composes `@elabs-ai/components-ui` inputs (`ListEditor`, `KeyValueEditor`,
 * `FileUpload`, `AdvancedGroup`, `Tabs`) — it does NOT re-invent field
 * primitives.
 *
 * Compound structure (named exports, the Card/CardHeader convention):
 *   <SchemaFormProvider>   — lifted state (values + errors + actions)
 *     <SchemaFormRoot>     — the <form> element (never nest inside another form)
 *       <SchemaFormFields> — every field, or place <SchemaFormField> yourself
 *       <SchemaFormSubmit> — submit button / submitting spinner / submitted note
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
  type MouseEvent,
  type ReactNode,
} from "react";
import { Check } from "lucide-react";
import { cn } from "../../lib/cn";
import { useLocale } from "../locale-provider";
import { Badge } from "../badge";
import { Button } from "../button";
import { Checkbox } from "../checkbox";
import { Input } from "../input";
import { Label } from "../label";
import { NumberInput } from "../number-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../select";
import { Skeleton } from "../skeleton";
import { Spinner } from "../spinner";
import { Textarea } from "../textarea";
import { ListEditor } from "../list-editor";
import { KeyValueEditor, type KeyValueRow } from "../key-value-editor";
import {
  FileUpload,
  FileUploadDropzone,
  FileUploadList,
  FileUploadItem,
  useFileUpload,
} from "../file-upload";
import { AdvancedGroup } from "../advanced-group";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../tabs";

import {
  checkFileIssue,
  collectValidatableFields,
  fieldLabel,
  findFieldByName,
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
  type GroupFieldSpec,
  type NormalizedFormSpec,
} from "./schema-form-spec";

// ─── Context ────────────────────────────────────────────────────────────────

interface SchemaFormContextValue {
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
  loading: boolean;
  /** A terminal, form-level submission error (e.g. "Couldn't save settings"). */
  error: ReactNode;
  formId: string;
  headingId: string;
}

const SchemaFormContext = createContext<SchemaFormContextValue | null>(null);

function useSchemaFormContext(): SchemaFormContextValue {
  const ctx = use(SchemaFormContext);
  if (!ctx) {
    throw new Error("SchemaForm sub-components must be rendered inside <SchemaFormProvider>.");
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

/** The effective value for a field (state value, else its default/empty). */
function effectiveValue(field: FieldSpec, values: FormValues): FormValue {
  const v = values[field.name];
  if (v !== undefined) return v;
  if (field.type === "group") return field.default ?? field.groups[0]?.key;
  if ("default" in field && field.default !== undefined) return field.default;
  if (field.type === "boolean") return false;
  if (field.type === "multi-enum" || field.type === "list") return [];
  if (field.type === "key-value") return [];
  if (field.type === "file") return [];
  return undefined;
}

// ─── Provider ───────────────────────────────────────────────────────────────

export interface SchemaFormProviderProps {
  /** A validated/normalized spec (a plain `FormSpec` also satisfies this). */
  spec: NormalizedFormSpec;
  /**
   * Controlled values. When provided the component is controlled and
   * `onChange` is the only way to update state.
   */
  values?: FormValues;
  /** Called with the next full values object on any field change. */
  onChange?: (values: FormValues) => void;
  /** Called with `{ formName, values }` when a valid form is submitted. */
  onSubmit?: (state: FormSubmitState) => void;
  /** Disable every control (form is read-only). A deliberate, durable state. */
  disabled?: boolean;
  /** Terminal submitted state: controls are inert, values visible, no submit. */
  submitted?: boolean;
  /** In-flight submit: controls transiently blocked, submit shows a spinner. */
  submitting?: boolean;
  /** No fields to render yet (e.g. the spec is still being fetched) → skeleton. */
  loading?: boolean;
  /** A terminal, form-level submission error rendered above the submit control. */
  error?: ReactNode;
  children: ReactNode;
}

/**
 * Lifts the form values. Controlled (pass `values`) or uncontrolled.
 * Derives `isControlled = values !== undefined` and never flips modes.
 */
export function SchemaFormProvider({
  spec,
  values: valuesProp,
  onChange,
  onSubmit,
  disabled = false,
  submitted = false,
  submitting = false,
  loading = false,
  error = null,
  children,
}: SchemaFormProviderProps) {
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

  const mergedValues = useCallback(
    (base: FormValues) => {
      const merged: FormValues = { ...base };
      const fill = (fields: FieldSpec[]) => {
        for (const field of fields) {
          merged[field.name] = effectiveValue(field, merged);
          if (field.type === "group") {
            for (const group of field.groups) fill(group.fields);
          }
        }
      };
      fill(spec.fields);
      return merged;
    },
    [spec.fields],
  );

  const submit = useCallback(() => {
    setAttempted(true);
    const merged = mergedValues(resolvedValues);

    const errs = validateForm(spec.fields, merged);
    const invalidNames = Object.keys(errs).filter((name) => errs[name]);
    if (invalidNames.length > 0) {
      // Focus the first field with an error (a11y: don't leave the user hunting).
      const firstInvalid = collectValidatableFields(spec.fields, merged).find((f) => errs[f.name]);
      if (firstInvalid && typeof document !== "undefined") {
        const el = document.getElementById(controlId(formId, firstInvalid.name));
        el?.focus();
      }
      return;
    }
    onSubmit?.({ formName: spec.formName, values: merged });
  }, [resolvedValues, mergedValues, spec.fields, spec.formName, formId, onSubmit]);

  const reset = useCallback(() => {
    setAttempted(false);
    const seeded = initialFormValues(spec.fields);
    if (!isControlled) setInternalValues(seeded);
    onChange?.(seeded);
  }, [isControlled, spec.fields, onChange]);

  // Errors only surface after a submit attempt; then they live-update on change.
  const errors = useMemo<Record<string, string | null>>(() => {
    if (!attempted) return {};
    return validateForm(spec.fields, mergedValues(resolvedValues));
  }, [attempted, resolvedValues, mergedValues, spec.fields]);

  const value = useMemo<SchemaFormContextValue>(
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
      loading,
      error,
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
      loading,
      error,
      formId,
      headingId,
    ],
  );

  return <SchemaFormContext value={value}>{children}</SchemaFormContext>;
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
        <SelectValue placeholder={t("ui.schemaForm.selectPlaceholder")} />
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
  const { t } = useLocale();
  const selected = Array.isArray(value) ? (value as string[]) : [];
  const toggle = (optValue: string, checked: boolean) => {
    const next = checked ? [...selected, optValue] : selected.filter((v) => v !== optValue);
    setValue(field.name, next);
  };
  return (
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
      {field.options.length === 0 && (
        <p className="text-body text-muted-foreground">{t("noResults")}</p>
      )}
    </div>
  );
}

function ListControl({
  field,
  value,
  disabled,
  id,
  labelId,
  describedBy,
  setValue,
}: FieldControlProps & { field: Extract<FieldSpec, { type: "list" }> }) {
  const items = Array.isArray(value) ? (value as string[]) : [];
  return (
    <ListEditor
      id={id}
      aria-labelledby={labelId}
      aria-describedby={describedBy}
      value={items}
      max={field.maxItems}
      placeholder={field.itemPlaceholder}
      disabled={disabled}
      onValueChange={(next) => setValue(field.name, next)}
    />
  );
}

function KeyValueControl({
  field,
  value,
  disabled,
  id,
  labelId,
  describedBy,
  setValue,
}: FieldControlProps & { field: Extract<FieldSpec, { type: "key-value" }> }) {
  const rows = Array.isArray(value) ? (value as KeyValueRow[]) : [];
  return (
    <KeyValueEditor
      id={id}
      aria-labelledby={labelId}
      aria-describedby={describedBy}
      value={rows}
      keyPlaceholder={field.keyPlaceholder}
      valuePlaceholder={field.valuePlaceholder}
      disabled={disabled}
      onValueChange={(next) => setValue(field.name, next)}
    />
  );
}

/** Lists the currently-selected files with per-file wrong-type/too-large state. Reads `FileUpload`'s own context. */
function FileControlList({ field }: { field: Extract<FieldSpec, { type: "file" }> }) {
  const { files } = useFileUpload();
  if (files.length === 0) return null;
  return (
    <FileUploadList>
      {files.map((uploadFile) => {
        const issue = checkFileIssue(uploadFile.file, field);
        return (
          <FileUploadItem
            key={uploadFile.id}
            uploadFile={uploadFile}
            status={issue ? "error" : "success"}
            errorMessage={issue?.message}
          />
        );
      })}
    </FileUploadList>
  );
}

function FileControl({
  field,
  disabled,
  id,
  labelId,
  describedBy,
  setValue,
}: FieldControlProps & { field: Extract<FieldSpec, { type: "file" }> }) {
  return (
    <FileUpload
      id={id}
      aria-labelledby={labelId}
      aria-describedby={describedBy}
      accept={field.accept}
      multiple={field.multiple}
      // NOT `maxSize={field.maxSize}` — `FileUpload.addFiles` enforces `maxSize`
      // by silently DROPPING an oversized file before it ever reaches `files`
      // state, which would make the "too large" designed state below
      // unreachable (the file the user picked would just vanish with no
      // feedback). Enforcement instead happens entirely in `checkFileIssue`
      // below, which renders the oversized file WITH an error item.
      maxFiles={field.multiple ? field.maxFiles : 1}
      disabled={disabled}
      onFilesChange={(list) =>
        setValue(
          field.name,
          list.map((u) => u.file),
        )
      }
    >
      <FileUploadDropzone />
      <FileControlList field={field} />
    </FileUpload>
  );
}

// ─── Group control (tabs / advanced) ───────────────────────────────────────────

function GroupTabsControl({
  field,
  value,
  disabled,
  id,
  labelId,
  describedBy,
  setValue,
}: FieldControlProps & { field: GroupFieldSpec }) {
  const active =
    (typeof value === "string" ? value : undefined) ?? field.default ?? field.groups[0]?.key;
  return (
    <Tabs
      value={active}
      onValueChange={(next) => setValue(field.name, next)}
      id={id}
      aria-labelledby={labelId}
      aria-describedby={describedBy}
    >
      <TabsList>
        {field.groups.map((group) => (
          <TabsTrigger key={group.key} value={group.key} disabled={disabled}>
            {group.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {field.groups.map((group) => (
        <TabsContent key={group.key} value={group.key} className="flex flex-col gap-4 pt-3">
          {group.description && (
            <p className="text-caption text-muted-foreground">{group.description}</p>
          )}
          {group.fields.map((child) => (
            <SchemaFormField key={child.name} name={child.name} />
          ))}
        </TabsContent>
      ))}
    </Tabs>
  );
}

function GroupAdvancedControl({ field }: { field: GroupFieldSpec }) {
  return (
    <div className="flex flex-col gap-3">
      {field.groups.map((group) => (
        <AdvancedGroup key={group.key} title={group.label} summary={group.description}>
          {group.fields.map((child) => (
            <SchemaFormField key={child.name} name={child.name} />
          ))}
        </AdvancedGroup>
      ))}
    </div>
  );
}

// ─── Field ────────────────────────────────────────────────────────────────────

export interface SchemaFormFieldProps extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  /** The field's `name` (its key in the spec + values). Resolved anywhere in the tree, including inside `group` branches. */
  name: string;
}

/**
 * Renders one field by name: label, control, description, inline error.
 * Boolean fields render their own inline label (checkbox + label); `group`
 * fields render their OWN label/description internally (a Tabs strip or a
 * stack of disclosures isn't a single labelled control), so the standalone
 * `<Label>` above is suppressed for both.
 */
export const SchemaFormField = forwardRef<HTMLDivElement, SchemaFormFieldProps>(
  function SchemaFormField({ name, className, ...props }, ref) {
    const ctx = useSchemaFormContext();
    const field = findFieldByName(ctx.spec.fields, name);
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
    const isGroup = field.type === "group";
    // A multi-value control renders a labelled REGION, not one focusable
    // element with a native label association (a checkbox group, a list/
    // key-value editor's several rows, a file dropzone, tabs, or a stack of
    // disclosures) — its label must NOT use htmlFor, only aria-labelledby.
    const isRegionField =
      field.type === "multi-enum" ||
      field.type === "list" ||
      field.type === "key-value" ||
      field.type === "file" ||
      isGroup;

    return (
      <div
        ref={ref}
        data-slot="schema-form-field"
        className={cn("flex flex-col gap-1.5", className)}
        {...props}
      >
        {!isBoolean && (
          <Label
            id={labelId}
            htmlFor={isRegionField ? undefined : id}
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
        {field.type === "list" && <ListControl {...controlProps} field={field} />}
        {field.type === "key-value" && <KeyValueControl {...controlProps} field={field} />}
        {field.type === "file" && <FileControl {...controlProps} field={field} />}
        {field.type === "group" && field.variant === "tabs" && (
          <GroupTabsControl {...controlProps} field={field} />
        )}
        {field.type === "group" && field.variant === "advanced" && (
          <GroupAdvancedControl field={field} />
        )}

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

export type SchemaFormFieldsProps = HTMLAttributes<HTMLDivElement>;

/** Renders every top-level field in the spec, in order. A skeleton while `loading` with no fields. */
export const SchemaFormFields = forwardRef<HTMLDivElement, SchemaFormFieldsProps>(
  function SchemaFormFields({ className, ...props }, ref) {
    const { spec, loading } = useSchemaFormContext();

    if (spec.fields.length === 0 && loading) {
      return (
        <div
          ref={ref}
          data-slot="schema-form-fields"
          className={cn("flex flex-col gap-4", className)}
          {...props}
        >
          <SchemaFormSkeletonAnnouncement />
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
      <div
        ref={ref}
        data-slot="schema-form-fields"
        className={cn("flex flex-col gap-4", className)}
        {...props}
      >
        {spec.fields.map((field) => (
          <SchemaFormField key={field.name} name={field.name} />
        ))}
      </div>
    );
  },
);

function SchemaFormSkeletonAnnouncement() {
  const { t } = useLocale();
  return (
    <span className="sr-only" role="status" aria-live="polite">
      {t("loading")}
    </span>
  );
}

// ─── Error (form-level, terminal) ───────────────────────────────────────────────

export type SchemaFormErrorProps = HTMLAttributes<HTMLDivElement>;

/** A terminal, form-level submission error (e.g. "Couldn't save settings"). Renders nothing when absent. */
export const SchemaFormError = forwardRef<HTMLDivElement, SchemaFormErrorProps>(
  function SchemaFormError({ className, ...props }, ref) {
    const { error } = useSchemaFormContext();
    if (!error) return null;
    return (
      <div
        ref={ref}
        role="alert"
        // The status wash is the separation gesture (styling-and-tokens.md
        // "Surface separation"): `bg-destructive/10` + `text-destructive-text`
        // already mark the region as distinct from the surrounding form, so a
        // bare `border` on top was a redundant boundary — dropped. Mirrors the
        // terminal-error boxes in `@elabs-ai/components-ai` (`JSXPreviewError`, `TestError`).
        data-slot="schema-form-error"
        className={cn(
          "rounded-md bg-destructive/10 px-3 py-2 text-body text-destructive-text",
          className,
        )}
        {...props}
      >
        {error}
      </div>
    );
  },
);

// ─── Submit ───────────────────────────────────────────────────────────────────

export interface SchemaFormSubmitProps extends Omit<HTMLAttributes<HTMLButtonElement>, "children"> {
  /** Submit button label (overrides `spec.submitLabel`). @default "Submit" */
  label?: string;
}

/**
 * The submit affordance. Enabled until the request starts (validation runs on
 * click), then transiently blocked. `submitting` uses `aria-disabled` + a
 * click-handler guard — NEVER the native `disabled` attribute — so a focused
 * button is never dropped from the tab order right after the user activates
 * it (see the module doc comment / interaction-guidelines.md). The explicit,
 * caller-set `disabled` (read-only form) stays native: that is a deliberate,
 * durable state, not a transient auto-flip. A submitted form shows an inert
 * "Submitted" note instead of a button.
 */
export const SchemaFormSubmit = forwardRef<HTMLButtonElement, SchemaFormSubmitProps>(
  function SchemaFormSubmit({ label, className, onClick, ...props }, ref) {
    const { t } = useLocale();
    const { spec, submitting, submitted, disabled } = useSchemaFormContext();

    if (submitted) {
      return (
        <Badge variant="success" aria-live="polite" className="w-fit">
          <Check aria-hidden="true" className="size-3" />
          {t("ui.schemaForm.submitted")}
        </Badge>
      );
    }

    const text = label ?? spec.submitLabel ?? t("ui.schemaForm.submit");

    const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
      // aria-disabled does not block activation the way the native attribute
      // does, so the handler (and SchemaFormRoot's onSubmit) has to.
      if (submitting) {
        e.preventDefault();
        return;
      }
      onClick?.(e);
    };

    return (
      <Button
        ref={ref}
        type="submit"
        data-slot="schema-form-submit"
        disabled={disabled}
        aria-disabled={submitting || undefined}
        aria-busy={submitting || undefined}
        onClick={handleClick}
        className={cn(submitting && "cursor-not-allowed", className)}
        {...props}
      >
        {submitting && <Spinner aria-hidden="true" className="text-current" />}
        {submitting ? t("ui.schemaForm.submitting") : text}
      </Button>
    );
  },
);

// ─── Root (the <form> element) ────────────────────────────────────────────────

export type SchemaFormRootProps = Omit<HTMLAttributes<HTMLFormElement>, "onSubmit">;

/**
 * The `<form>` element wired to the context's `submit`. Never nest inside
 * another `<form>` — compose it as its own top-level block.
 */
export const SchemaFormRoot = forwardRef<HTMLFormElement, SchemaFormRootProps>(
  function SchemaFormRoot({ className, children, ...props }, ref) {
    const { t } = useLocale();
    const { submit, headingId, spec, disabled, submitting } = useSchemaFormContext();
    const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      // The submit control's `aria-disabled` is a signal, not a lock — this is
      // the actual guard against a double/blocked submit.
      if (disabled || submitting) return;
      submit();
    };
    return (
      <form
        ref={ref}
        data-slot="schema-form-root"
        noValidate
        onSubmit={handleSubmit}
        aria-labelledby={spec.title ? headingId : undefined}
        aria-label={spec.title ? undefined : spec.formName || t("ui.schemaForm.label")}
        className={cn("flex w-full flex-col gap-4", className)}
        {...props}
      >
        {children}
      </form>
    );
  },
);

// ─── Title + Description ──────────────────────────────────────────────────────

export type SchemaFormTitleProps = HTMLAttributes<HTMLParagraphElement>;

/** The form heading. Its id is the `<form>`'s `aria-labelledby` target. */
export const SchemaFormTitle = forwardRef<HTMLParagraphElement, SchemaFormTitleProps>(
  function SchemaFormTitle({ className, children, ...props }, ref) {
    const { headingId, spec } = useSchemaFormContext();
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

export type SchemaFormDescriptionProps = HTMLAttributes<HTMLParagraphElement>;

/** Supplemental description under the title. */
export const SchemaFormDescription = forwardRef<HTMLParagraphElement, SchemaFormDescriptionProps>(
  function SchemaFormDescription({ className, children, ...props }, ref) {
    const { spec } = useSchemaFormContext();
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

export interface SchemaFormFallbackProps extends HTMLAttributes<HTMLDivElement> {
  /** Short human reason the form could not render. */
  message?: string;
}

/**
 * Shown when the spec is unusable. Mirrors `MessageFormFallback`: a calm,
 * bordered status box with a short reason — never a thrown error.
 */
export const SchemaFormFallback = forwardRef<HTMLDivElement, SchemaFormFallbackProps>(
  function SchemaFormFallback(
    { message = "This form could not be displayed.", className, ...props },
    ref,
  ) {
    return (
      <div
        ref={ref}
        role="status"
        aria-live="polite"
        data-slot="schema-form-fallback"
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

export interface SchemaFormProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  "onSubmit" | "onChange" | "title"
> {
  /** The serializable form specification. */
  spec: FormSpec | unknown;
  /** Controlled values (`{ [fieldName]: value }`). Omit for uncontrolled. */
  values?: FormValues;
  /** Called with the next full values object on any change. */
  onChange?: (values: FormValues) => void;
  /** Called with `{ formName, values }` on a valid submit. */
  onSubmit?: (state: FormSubmitState) => void;
  /** Submit button label (overrides `spec.submitLabel`). */
  submitLabel?: string;
  /** Disable every control (the whole form is read-only). */
  disabled?: boolean;
  /** Terminal submitted state: inert, values visible, submit replaced. */
  submitted?: boolean;
  /** In-flight submit: controls transiently blocked, spinner on submit. */
  submitting?: boolean;
  /** No fields to render yet (spec still loading) → skeleton. */
  loading?: boolean;
  /** A terminal, form-level submission error rendered above the submit control. */
  error?: ReactNode;
}

/**
 * Convenience composition: `Provider → Root(form) → title/description →
 * Fields → Error → Submit`. For a custom layout, compose `SchemaFormProvider`
 * + the parts. A malformed spec renders `SchemaFormFallback` (never throws).
 */
export const SchemaForm = forwardRef<HTMLDivElement, SchemaFormProps>(function SchemaForm(
  {
    spec,
    values,
    onChange,
    onSubmit,
    submitLabel,
    disabled,
    submitted,
    submitting,
    loading,
    error,
    className,
    ...props
  },
  ref,
) {
  const result = normalizeFormSpec(spec);
  if (!result.ok) {
    return (
      <SchemaFormFallback ref={ref} message={result.reason} className={className} {...props} />
    );
  }

  const normalized = result.spec;
  const empty = normalized.fields.length === 0;

  if (empty && !loading) {
    return (
      <SchemaFormFallback
        ref={ref}
        message="This form has no fields to fill in."
        className={className}
        {...props}
      />
    );
  }

  return (
    <SchemaFormProvider
      spec={normalized}
      values={values}
      onChange={onChange}
      onSubmit={onSubmit}
      disabled={disabled}
      submitted={submitted}
      submitting={submitting}
      loading={loading}
      error={error}
    >
      <div ref={ref} data-slot="schema-form" className={cn("w-full", className)} {...props}>
        <SchemaFormRoot>
          {(normalized.title || normalized.description) && (
            <div className="flex flex-col gap-1">
              <SchemaFormTitle />
              <SchemaFormDescription />
            </div>
          )}
          <SchemaFormFields />
          <SchemaFormError />
          <SchemaFormSubmit label={submitLabel} />
        </SchemaFormRoot>
      </div>
    </SchemaFormProvider>
  );
});
