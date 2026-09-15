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
 *       <SchemaFormTestAction> — OPT-IN: a form/group-level "Test connection"
 *                                 affordance, independent of field validity,
 *                                 never gating submit (not in the default
 *                                 `SchemaForm` composition — place it yourself)
 *       <SchemaFormSubmit> — submit button / submitting spinner / submitted note
 *
 * `fromJsonSchema()` (`from-json-schema.ts`) is a separate, narrow adapter
 * that maps a documented JSON Schema subset onto this module's `FieldSpec`
 * vocabulary — see that file's doc comment for exactly what it supports.
 */

import {
  createContext,
  forwardRef,
  memo,
  use,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
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
import { StatusBadge } from "../status-badge";
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
  fieldLabel,
  normalizeFormSpec,
  optionLabel,
  optionValue,
  type FieldSpec,
  type FormSpec,
  type FormSubmitState,
  type FormValue,
  type FormValues,
  type GroupFieldSpec,
  type GroupItemSpec,
  type NormalizedFormSpec,
} from "./schema-form-spec";
import {
  SchemaFormStore,
  useBranchHasError,
  useEffectiveValues,
  useFieldSnapshot,
  useSchemaFormMeta,
  useVisibleFieldNames,
  type SchemaFormStoreProps,
} from "./schema-form-store";

// ─── Context (carries only the STABLE store instance — see schema-form-store.ts) ──

const SchemaFormStoreContext = createContext<SchemaFormStore | null>(null);

function useSchemaFormStore(): SchemaFormStore {
  const store = use(SchemaFormStoreContext);
  if (!store) {
    throw new Error("SchemaForm sub-components must be rendered inside <SchemaFormProvider>.");
  }
  return store;
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

  const storeProps: SchemaFormStoreProps = {
    spec,
    valuesProp,
    onChange,
    onSubmit,
    disabled,
    submitted,
    submitting,
    loading,
    error,
  };
  // Created once (lazy initializer) and then kept in sync on every render via
  // `syncProps` below — see schema-form-store.ts's module doc comment for why
  // the store, not React context, is what field-level readers subscribe to.
  const [store] = useState(() => new SchemaFormStore(storeProps, formId));
  // `syncProps` runs here, IN render, so a non-memoized descendant
  // re-rendering this same pass reads fresh values; the resulting `changed`
  // flag is only ACTED ON (`store.notify()`) from the layout effect below —
  // see `syncProps`'s doc comment for why calling it synchronously here
  // instead would trip React's "setState while rendering a different
  // component" guard against an already-mounted, memoized `SchemaFormField`.
  const changed = store.syncProps(storeProps);
  useLayoutEffect(() => {
    if (changed) store.notify();
  });

  // The field to focus after an invalid submit. `store.submit()` calls this
  // listener synchronously (in the same click/Enter handler that also flips
  // `attempted`, which is what makes an error-containing `AdvancedGroup`
  // branch open itself — see `AdvancedGroupBranch`), so React batches both
  // updates into ONE commit; the actual `.focus()` call happens from the
  // `useEffect` below, which runs AFTER that commit (and after Radix has
  // mounted the newly-open group) — a synchronous `document.getElementById`
  // right here would run against the PRE-update DOM and could never find a
  // control that only exists once the just-opened disclosure mounts its
  // content. A fresh object on every call (not just the name) guarantees the
  // effect re-fires even when the SAME field is invalid on consecutive
  // submit attempts, where a primitive dependency wouldn't change.
  const [pendingFocus, setPendingFocus] = useState<{ name: string } | null>(null);
  useEffect(() => store.onPendingFocus((name) => setPendingFocus({ name })), [store]);
  useEffect(() => {
    if (!pendingFocus || typeof document === "undefined") return;
    const el = document.getElementById(controlId(store.formId, pendingFocus.name));
    el?.focus();
  }, [pendingFocus, store]);

  return <SchemaFormStoreContext value={store}>{children}</SchemaFormStoreContext>;
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

/** A stable per-file id, since `FormValue`'s `File[]` carries no id of its own (unlike `FileUpload`'s own `UploadFile`). */
function fileIdentity(file: File): string {
  return `${file.name}-${file.size}-${file.lastModified}`;
}

function FileControl({
  field,
  value,
  disabled,
  id,
  labelId,
  describedBy,
  setValue,
}: FieldControlProps & { field: Extract<FieldSpec, { type: "file" }> }) {
  // Bind `FileUpload` to the field's OWN value rather than letting it manage
  // uncontrolled internal state: an externally-seeded `values` prop (a
  // controlled `SchemaForm`, or a spec swap that reseeds `values`) must show
  // up in the picker, and `setValue` must stay the single source of truth —
  // otherwise the picker's internal file list and the form's submitted
  // `values[field.name]` can silently diverge.
  const controlledFiles = useMemo(() => {
    const selected = Array.isArray(value) ? (value as File[]) : [];
    return selected.map((file) => ({
      id: fileIdentity(file),
      file,
    }));
  }, [value]);
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
      files={controlledFiles}
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
          <GroupTabsBranch group={group} />
        </TabsContent>
      ))}
    </Tabs>
  );
}

/**
 * One tab branch's visible fields — its own `useVisibleFieldNames`
 * subscription, so a `visibleWhen` inside THIS branch re-evaluates
 * independent of `GroupTabsControl`'s (and its parent `SchemaFormField`'s)
 * own re-render.
 */
function GroupTabsBranch({ group }: { group: GroupItemSpec }) {
  const store = useSchemaFormStore();
  const visibleNames = useVisibleFieldNames(store, group.fields);
  return (
    <>
      {visibleNames.map((name) => (
        <SchemaFormField key={name} name={name} />
      ))}
    </>
  );
}

/**
 * One `variant: "advanced"` branch. Radix's `CollapsibleContent` UNMOUNTS its
 * children while closed, so a required field inside a still-collapsed branch
 * is invisible to both `document.getElementById` (submit's focus step) and
 * the user — reveal the branch automatically the moment it holds a
 * validation error. "Controlled with override": the derived open state
 * (`hasError`) drives the disclosure until the user explicitly toggles it
 * themselves, at which point their choice takes over for good (an ordinary
 * disclosure never re-imposes itself over a deliberate user action).
 */
function AdvancedGroupBranch({ group }: { group: GroupItemSpec }) {
  const store = useSchemaFormStore();
  const hasError = useBranchHasError(store, group.fields);
  const visibleNames = useVisibleFieldNames(store, group.fields);
  const [manualOpen, setManualOpen] = useState<boolean | undefined>(undefined);
  const open = manualOpen ?? hasError;
  return (
    <AdvancedGroup
      title={group.label}
      summary={group.description}
      open={open}
      onOpenChange={setManualOpen}
    >
      {visibleNames.map((name) => (
        <SchemaFormField key={name} name={name} />
      ))}
    </AdvancedGroup>
  );
}

function GroupAdvancedControl({ field }: { field: GroupFieldSpec }) {
  return (
    <div className="flex flex-col gap-3">
      {field.groups.map((group) => (
        <AdvancedGroupBranch key={group.key} group={group} />
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
 *
 * Enforces its OWN `visibleWhen` (returns `null` when hidden) rather than
 * trusting the caller to have filtered it out first: the documented custom-
 * layout composition (`SchemaFormProvider` + the parts, see `SchemaForm`'s
 * own doc comment) lets a consumer place `<SchemaFormField name="…" />`
 * directly, bypassing `SchemaFormFields`'/`GroupTabsControl`'s/
 * `AdvancedGroupBranch`'s own `isFieldVisible` filters — without this check
 * the same spec would render a hidden field in a custom layout while
 * validation/submission (which always excludes it) disagree.
 */
export const SchemaFormField = memo(
  forwardRef<HTMLDivElement, SchemaFormFieldProps>(function SchemaFormField(
    { name, className, ...props },
    ref,
  ) {
    // Hooks run unconditionally, ahead of the `!field`/`!visible` early
    // returns below (rules-of-hooks) — this is exactly what makes typing in
    // field A skip re-rendering field B: `useFieldSnapshot` bails out (via
    // `useSyncExternalStore`'s `Object.is` check on the cached snapshot) for
    // every OTHER mounted `SchemaFormField`, so only the field whose own
    // snapshot changed re-renders.
    const store = useSchemaFormStore();
    const meta = useSchemaFormMeta(store);
    const snapshot = useFieldSnapshot(store, name);
    const field = store.getField(name);
    if (!field) return null;
    if (!snapshot.visible) return null;

    const id = controlId(meta.formId, name);
    const labelId = `${meta.formId}-label-${name}`;
    const invalid = snapshot.invalid;
    const description = field.description;
    const hasDesc = Boolean(description);
    const describedBy =
      [hasDesc ? descId(meta.formId, name) : null, invalid ? errorId(meta.formId, name) : null]
        .filter(Boolean)
        .join(" ") || undefined;

    const controlProps: FieldControlProps = {
      field,
      value: snapshot.value,
      invalid,
      disabled: snapshot.disabled,
      readOnly: snapshot.readOnly,
      id,
      labelId,
      describedBy,
      setValue: store.setValue,
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
          <p id={descId(meta.formId, name)} className="text-caption text-muted-foreground">
            {description}
          </p>
        )}
        {invalid && (
          <p id={errorId(meta.formId, name)} className="text-caption text-destructive-text">
            {snapshot.errorText}
          </p>
        )}
      </div>
    );
  }),
);

// ─── Fields (all) ─────────────────────────────────────────────────────────────

export type SchemaFormFieldsProps = HTMLAttributes<HTMLDivElement>;

/** Renders every top-level field in the spec, in order. A skeleton while `loading` with no fields. */
export const SchemaFormFields = forwardRef<HTMLDivElement, SchemaFormFieldsProps>(
  function SchemaFormFields({ className, ...props }, ref) {
    const store = useSchemaFormStore();
    const meta = useSchemaFormMeta(store);
    const visibleNames = useVisibleFieldNames(store, meta.spec.fields);
    const { spec, loading } = meta;

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
        {visibleNames.map((name) => (
          <SchemaFormField key={name} name={name} />
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
    const store = useSchemaFormStore();
    const { error } = useSchemaFormMeta(store);
    if (!error) return null;
    return (
      <div
        ref={ref}
        role="alert"
        // #F2: the `bg-destructive/10` wash alone measures 1.18:1 (light) /
        // 1.09:1 (dark) against the form ground — the earlier "the wash already
        // marks the region" reasoning (styling-and-tokens.md's own decision
        // test: "if I deleted this line, could a sighted user still tell the
        // two regions apart?") had a measured answer of no, so the wash was the
        // SOLE structural cue and dropping the border was wrong. Restore the
        // boundary as an accent RAIL (`border-s-2 border-s-destructive`), not a
        // full border — the gate permits rails, and a rail is the idiom the
        // rest of the repo already uses for a destructive/error box that keeps
        // its wash (`MermaidDiagram`'s error panel, `packages/editor/src/mermaid-diagram/mermaid-diagram.tsx`).
        // `border-s-destructive` is the FILL rung (styling-and-tokens.md "status
        // rung"), guaranteed >=3:1 against every surface token — measured here
        // at 4.70:1 (light) / 4.71:1 (dark) against `--background`.
        data-slot="schema-form-error"
        className={cn(
          "rounded-md border-s-2 border-s-destructive bg-destructive/10 px-3 py-2 text-body text-destructive-text",
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
    const store = useSchemaFormStore();
    const { spec, submitting, submitted, disabled, loading } = useSchemaFormMeta(store);

    if (submitted) {
      return (
        <Badge variant="success" aria-live="polite" className="w-fit">
          <Check aria-hidden="true" className="size-3" />
          {t("ui.schemaForm.submitted")}
        </Badge>
      );
    }

    const text = label ?? spec.submitLabel ?? t("ui.schemaForm.submit");
    // The spec is still loading (`SchemaFormFields` shows a skeleton, not the
    // real fields yet) — blocked exactly like `submitting`: transient, so
    // `aria-disabled` + a handler guard, never the native attribute (see the
    // module doc comment). Submitting while the fields haven't rendered would
    // validate/submit whatever placeholder `values` happen to exist.
    const blocked = submitting || loading;

    const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
      // aria-disabled does not block activation the way the native attribute
      // does, so the handler (and SchemaFormRoot's onSubmit) has to.
      if (blocked) {
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
        aria-disabled={blocked || undefined}
        aria-busy={submitting || undefined}
        onClick={handleClick}
        className={cn(blocked && "cursor-not-allowed", className)}
        {...props}
      >
        {submitting && <Spinner aria-hidden="true" className="text-current" />}
        {submitting ? t("ui.schemaForm.submitting") : text}
      </Button>
    );
  },
);

// ─── Test action (a form/group-level async action, e.g. "Test connection") ────

/**
 * `SchemaFormTestAction`'s lifecycle: `idle` → `pending` while `onTest` is in
 * flight → `success`/`failure` once it settles. Deliberately local component
 * state, NOT part of the `SchemaFormStore` — so it can never affect field
 * validity or gate `submit()` (issue #22 maintainer ruling, 2026-09-01: a
 * form/group-level test-action slot, kept separate from field validity and
 * never gating submit — not per-field `validateAsync` in the validation
 * engine).
 */
export type SchemaFormTestActionStatus = "idle" | "pending" | "success" | "failure";

export interface SchemaFormTestActionProps extends Omit<HTMLAttributes<HTMLDivElement>, "onError"> {
  /**
   * Runs the test (e.g. calls an API with the fields typed so far). Receives
   * the form's CURRENT effective values — the same object `validateForm`
   * would resolve against — but this call is entirely independent of
   * validation: a field that is currently invalid, or an unrelated required
   * field left empty, never blocks a test run. Resolve to signal success;
   * reject (an `Error`, or throw) to signal failure — a rejected `Error`'s
   * `message` becomes the shown failure reason.
   */
  onTest: (values: FormValues) => void | Promise<void>;
  /** Button label. @default "Test connection" */
  label?: string;
  /** Label shown while pending. @default "Testing…" */
  pendingLabel?: string;
  /** Label shown on success. @default "Connected" */
  successLabel?: string;
  /** Fallback failure label when the rejection carries no message. @default "Test failed" */
  failureLabel?: string;
}

/**
 * A form- or group-level "Test connection" affordance: an async action the
 * user can run to verify the values typed so far (e.g. hit a connector's
 * `/ping` endpoint) BEFORE submitting. Place it anywhere inside a
 * `SchemaFormProvider` tree — directly under `SchemaFormRoot` for a
 * form-level test, or beside a `SchemaFormField` inside a `group` branch (a
 * `TabsContent`/`AdvancedGroup`) for a per-credential-set test. Not part of
 * `SchemaForm`'s default composition — an opt-in part a consumer places, the
 * same way a custom layout composes `SchemaFormField` directly.
 *
 * Deliberately NOT wired into `errors`/`validateForm`/`submit()` — its
 * pending/success/failure state is entirely local, so it can never block or
 * silently gate the form's own submit control.
 */
export const SchemaFormTestAction = forwardRef<HTMLDivElement, SchemaFormTestActionProps>(
  function SchemaFormTestAction(
    { onTest, label, pendingLabel, successLabel, failureLabel, className, ...props },
    ref,
  ) {
    const { t } = useLocale();
    const store = useSchemaFormStore();
    const { disabled: formDisabled, loading, submitted, submitting } = useSchemaFormMeta(store);
    const effectiveValues = useEffectiveValues(store);
    const [status, setStatus] = useState<SchemaFormTestActionStatus>("idle");
    const [failureMessage, setFailureMessage] = useState<string | null>(null);

    // Always mirrors the LATEST `effectiveValues` (updated every render) so
    // an in-flight `onTest` can tell, once it settles, whether the values it
    // was called with are still current — a plain closure over
    // `effectiveValues` would only ever see the snapshot from the render
    // that started the request.
    const latestEffectiveValuesRef = useRef(effectiveValues);
    latestEffectiveValuesRef.current = effectiveValues;
    // The specific values snapshot the CURRENT `status` describes — set at
    // the moment a test starts, read both by the async completion (to
    // detect "edited while pending") and by the effect below (to detect
    // "edited after success/failure").
    const testedValuesRef = useRef<FormValues | null>(null);

    const pending = status === "pending";
    // Transient (pending) block uses aria-disabled + a handler guard, never
    // native `disabled` — same reasoning as SchemaFormSubmit's OWN pending
    // state: a keyboard user who just activated THIS button must not be
    // dropped from the tab order right after they used it. `pending` (this
    // button's own in-flight test) and `loading` (the spec itself still
    // loading — pre-existing, matches SchemaFormSubmit's `blocked`) are both
    // "I am mid-task" states, so they stay transient.
    //
    // `submitting`/`submitted` are a DIFFERENT kind of state: they describe
    // the FORM's submit action, not this button's own. This button is a
    // bystander to that action the same way a `SchemaFormField` is — never
    // the control the user just activated — so both go native `disabled`
    // below, exactly like `SchemaFormField`'s `controlDisabled = ctx.disabled
    // || ctx.submitted || ctx.submitting`. (Contrast `SchemaFormSubmit`,
    // where `submitting` IS the button's own state and stays transient — the
    // two controls are not interchangeable here.)
    const transientlyBlocked = loading || pending;
    const nativelyBlocked = formDisabled || submitted || submitting;

    // PR #119 review thread 0 (chatgpt-codex-connector): once the tested
    // values go stale — the user edited a field after this status settled —
    // discard the now-inaccurate success/failure and return to idle rather
    // than keep describing values that no longer exist.
    useEffect(() => {
      if (
        (status === "success" || status === "failure") &&
        testedValuesRef.current !== effectiveValues
      ) {
        setStatus("idle");
        setFailureMessage(null);
      }
    }, [effectiveValues, status]);

    const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
      if (nativelyBlocked || transientlyBlocked) {
        e.preventDefault();
        return;
      }
      const testedValues = effectiveValues;
      testedValuesRef.current = testedValues;
      setStatus("pending");
      setFailureMessage(null);
      void (async () => {
        try {
          await onTest(testedValues);
          // The values changed WHILE the request was in flight — discard
          // this now-stale result and go back to idle rather than report
          // success/failure for a snapshot the user has already moved on
          // from (also covers the "resolved after a NEWER click" case,
          // since that click's own `testedValuesRef.current` write already
          // moved this promise's `testedValues` out of date).
          if (latestEffectiveValuesRef.current !== testedValues) {
            setStatus("idle");
            return;
          }
          setStatus("success");
        } catch (err) {
          if (latestEffectiveValuesRef.current !== testedValues) {
            setStatus("idle");
            return;
          }
          setStatus("failure");
          setFailureMessage(err instanceof Error ? err.message : null);
        }
      })();
    };

    return (
      <div
        ref={ref}
        data-slot="schema-form-test-action"
        className={cn("flex flex-wrap items-center gap-2", className)}
        {...props}
      >
        <Button
          type="button"
          variant="outline"
          disabled={nativelyBlocked}
          aria-disabled={transientlyBlocked || undefined}
          aria-busy={pending || undefined}
          onClick={handleClick}
          className={cn(transientlyBlocked && "cursor-not-allowed")}
        >
          {pending && <Spinner aria-hidden="true" className="text-current" />}
          {pending
            ? (pendingLabel ?? t("ui.schemaForm.testAction.pending"))
            : (label ?? t("ui.schemaForm.testAction.label"))}
        </Button>
        {status === "success" && (
          <StatusBadge status="complete" aria-live="polite">
            {successLabel ?? t("ui.schemaForm.testAction.success")}
          </StatusBadge>
        )}
        {status === "failure" && (
          <StatusBadge status="failed" role="alert">
            {failureMessage ?? failureLabel ?? t("ui.schemaForm.testAction.failure")}
          </StatusBadge>
        )}
      </div>
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
    const store = useSchemaFormStore();
    const { headingId, spec, disabled, submitting, loading } = useSchemaFormMeta(store);
    const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      // The submit control's `aria-disabled` is a signal, not a lock — this is
      // the actual guard against a double/blocked submit. `loading` blocks it
      // too (see `SchemaFormSubmit`): the fields are still a skeleton, so
      // there is nothing real to validate/submit yet.
      if (disabled || submitting || loading) return;
      store.submit();
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
    const store = useSchemaFormStore();
    const { headingId, spec } = useSchemaFormMeta(store);
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
    const store = useSchemaFormStore();
    const { spec } = useSchemaFormMeta(store);
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
  // Memoized on `spec`'s reference: a parent re-rendering with the SAME spec
  // object (the common case once a spec is loaded) must not re-walk/re-
  // validate it on every keystroke elsewhere in the app — `SchemaFormStore`
  // itself already relies on `spec` reference-equality to skip its own
  // recompute (see `syncProps`), so this keeps that contract meaningful one
  // level up.
  const result = useMemo(() => normalizeFormSpec(spec), [spec]);
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
