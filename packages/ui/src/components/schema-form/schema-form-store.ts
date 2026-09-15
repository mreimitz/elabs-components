"use client";

/**
 * schema-form-store.ts — the per-field external store backing `SchemaForm`
 * (perf review §3.4: "one context carries all values → every keystroke
 * re-renders every field and re-runs isFieldVisible across the spec").
 *
 * One `SchemaFormStore` instance lives for a `SchemaFormProvider`'s whole
 * lifetime (created once via a lazy `useState` initializer in
 * `schema-form.tsx`). It owns `values`/`attempted` and derives
 * `effectiveValues`/`errors` from them, exactly as the previous
 * `useMemo`-based implementation did — the FORMULAS are unchanged (see
 * `computeMergedValues`, ported byte-for-byte from the old `mergedValues`
 * closure). What changes is how a component reads them:
 *
 * - `SchemaFormField` subscribes to its OWN `FieldSnapshot` via
 *   `useFieldSnapshot(name)` (a `useSyncExternalStore` selector). The
 *   snapshot is cached per field name and a fresh compute that is
 *   field-by-field equal to the cached one returns the CACHED object —
 *   `useSyncExternalStore`'s own `Object.is` bail-out then skips re-
 *   rendering that field when an unrelated field's keystroke fires the
 *   store's `emit()`. `SchemaFormField` is also wrapped in `memo()`, so a
 *   parent container re-rendering (see below) does not cascade into it
 *   either, as long as the `name`/`className`/`...props` it was given
 *   didn't change.
 * - Containers that list CHILDREN by name (`SchemaFormFields`,
 *   `GroupTabsControl`'s per-branch content, `AdvancedGroupBranch`) read
 *   `useVisibleFieldNames(fields)` — a cached `string[]` that only changes
 *   reference when the VISIBLE SET actually changes, not on every
 *   keystroke — so typing in one field doesn't even cause its siblings'
 *   list container to reconcile new elements for them.
 * - `useSchemaFormMeta()` covers the slow-changing, form-wide flags
 *   (`disabled`/`submitted`/`submitting`/`loading`/`error`/`attempted`/
 *   `spec`) as ONE cached object — stable across ordinary typing, so a
 *   component reading only these (e.g. `SchemaFormRoot`) doesn't re-render
 *   on every keystroke either.
 * - `useEffectiveValues()` exposes the full merged/stripped values object
 *   with the SAME reference-stability contract the old `useMemo` gave
 *   `SchemaFormTestAction` (which compares it by `!==` to detect "the user
 *   edited while a test was in flight") — unaffected by this refactor.
 *
 * Every derived getter is a plain, synchronous function of the store's
 * current `props`/`internalValues`/`attempted` — none of this maintains
 * parallel state that could drift from `values`.
 */

import { useCallback, useSyncExternalStore, type ReactNode } from "react";
import {
  collectValidatableFields,
  isFieldVisible,
  initialFormValues,
  validateForm,
  type FieldSpec,
  type FormSubmitState,
  type FormValue,
  type FormValues,
  type GroupFieldSpec,
  type GroupItemSpec,
  type NormalizedFormSpec,
} from "./schema-form-spec";

// ─── Pure helpers (spec + values → values), no React ───────────────────────

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

/** Remove every field's key (recursively, including nested group branches) from `values`. */
function stripFields(fields: FieldSpec[], values: FormValues): void {
  for (const field of fields) {
    delete values[field.name];
    if (field.type === "group") {
      for (const group of field.groups) stripFields(group.fields, values);
    }
  }
}

/** The active branch of a `variant: "tabs"` group, given its own (possibly-just-computed) value. */
function activeTabBranch(field: GroupFieldSpec, activeKey: FormValue): GroupItemSpec | undefined {
  const key = typeof activeKey === "string" ? activeKey : undefined;
  return (
    field.groups.find((g) => g.key === key) ??
    field.groups.find((g) => g.key === field.default) ??
    field.groups[0]
  );
}

/**
 * `values` with every field's default/empty fallback applied and every
 * currently-hidden field's subtree stripped. Ported byte-for-byte from the
 * previous `SchemaFormProvider`'s `mergedValues` closure — see that
 * implementation's history for the full reasoning on why hidden fields are
 * stripped rather than merely skipped.
 */
function computeMergedValues(fields: FieldSpec[], base: FormValues): FormValues {
  const merged: FormValues = { ...base };
  const fill = (fs: FieldSpec[]) => {
    for (const field of fs) {
      if (!isFieldVisible(field, merged)) {
        delete merged[field.name];
        if (field.type === "group") {
          for (const group of field.groups) stripFields(group.fields, merged);
        }
        continue;
      }
      merged[field.name] = effectiveValue(field, merged);
      if (field.type !== "group") continue;
      if (field.variant === "tabs") {
        const active = activeTabBranch(field, merged[field.name]);
        for (const group of field.groups) {
          if (group === active) fill(group.fields);
          else stripFields(group.fields, merged);
        }
      } else {
        for (const group of field.groups) fill(group.fields);
      }
    }
  };
  fill(fields);
  return merged;
}

/** Does any field in this branch (including nested group branches) currently have an error? */
function branchHasError(fields: FieldSpec[], errors: Record<string, string | null>): boolean {
  for (const field of fields) {
    if (errors[field.name]) return true;
    if (field.type === "group") {
      for (const group of field.groups) {
        if (branchHasError(group.fields, errors)) return true;
      }
    }
  }
  return false;
}

function buildFieldMap(fields: FieldSpec[]): Map<string, FieldSpec> {
  const map = new Map<string, FieldSpec>();
  const walk = (fs: FieldSpec[]) => {
    for (const field of fs) {
      map.set(field.name, field);
      if (field.type === "group") {
        for (const group of field.groups) walk(group.fields);
      }
    }
  };
  walk(fields);
  return map;
}

function sameNames(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

// ─── Store ──────────────────────────────────────────────────────────────────

export interface SchemaFormStoreProps {
  spec: NormalizedFormSpec;
  valuesProp: FormValues | undefined;
  onChange?: (values: FormValues) => void;
  onSubmit?: (state: FormSubmitState) => void;
  disabled: boolean;
  submitted: boolean;
  submitting: boolean;
  loading: boolean;
  error: ReactNode;
}

export interface FieldSnapshot {
  value: FormValue;
  invalid: boolean;
  errorText: string | null;
  visible: boolean;
  disabled: boolean;
  readOnly: boolean;
}

export interface SchemaFormMeta {
  spec: NormalizedFormSpec;
  formId: string;
  headingId: string;
  disabled: boolean;
  submitted: boolean;
  submitting: boolean;
  loading: boolean;
  error: ReactNode;
  attempted: boolean;
}

const EMPTY_ERRORS: Record<string, string | null> = {};

function fieldSnapshotEqual(a: FieldSnapshot, b: FieldSnapshot): boolean {
  return (
    Object.is(a.value, b.value) &&
    a.invalid === b.invalid &&
    a.errorText === b.errorText &&
    a.visible === b.visible &&
    a.disabled === b.disabled &&
    a.readOnly === b.readOnly
  );
}

function metaEqual(a: SchemaFormMeta, b: SchemaFormMeta): boolean {
  return (
    a.spec === b.spec &&
    a.formId === b.formId &&
    a.headingId === b.headingId &&
    a.disabled === b.disabled &&
    a.submitted === b.submitted &&
    a.submitting === b.submitting &&
    a.loading === b.loading &&
    a.error === b.error &&
    a.attempted === b.attempted
  );
}

/** See the module doc comment for the full design rationale. */
export class SchemaFormStore {
  private props: SchemaFormStoreProps;
  private internalValues: FormValues;
  private attempted = false;
  private readonly listeners = new Set<() => void>();
  private readonly pendingFocusListeners = new Set<(name: string) => void>();
  readonly formId: string;
  readonly headingId: string;

  private mergedCache: { base: FormValues; fields: FieldSpec[]; result: FormValues } | null = null;
  private errorsCache: {
    merged: FormValues;
    fields: FieldSpec[];
    attempted: boolean;
    result: Record<string, string | null>;
  } | null = null;
  private metaCache: SchemaFormMeta | null = null;
  private fieldMapCache: { fields: FieldSpec[]; map: Map<string, FieldSpec> } | null = null;
  private readonly fieldSnapshotCache = new Map<string, FieldSnapshot>();
  private readonly namesCache = new WeakMap<
    FieldSpec[],
    { effective: FormValues; names: string[] }
  >();

  constructor(props: SchemaFormStoreProps, formId: string) {
    this.props = props;
    this.formId = formId;
    this.headingId = `${formId}-title`;
    this.internalValues = initialFormValues(props.spec.fields);
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  /** Fires once, with the field's own name, whenever an invalid submit should move focus to it. */
  onPendingFocus(listener: (name: string) => void): () => void {
    this.pendingFocusListeners.add(listener);
    return () => {
      this.pendingFocusListeners.delete(listener);
    };
  }

  private emit(): void {
    for (const listener of this.listeners) listener();
  }

  /**
   * Sync the latest render's props/closures. Called unconditionally on every
   * `SchemaFormProvider` render, DURING that render (not an effect) — so a
   * non-memoized descendant re-rendering in this SAME pass (`SchemaFormRoot`,
   * `SchemaFormFields`, …) reads the fresh values via `getMeta`/
   * `getFieldSnapshot`, not last render's. It deliberately does NOT call
   * `emit()` itself — that would call an already-mounted, `memo`-wrapped
   * `SchemaFormField`'s `useSyncExternalStore` listener synchronously WHILE
   * `SchemaFormProvider` (a different component) is still rendering, which
   * React explicitly disallows ("Cannot update a component while rendering a
   * different component"). The caller instead reads the returned `changed`
   * flag and calls `notify()` from a `useLayoutEffect` — i.e. after this
   * whole render has committed — to wake any memoized subscriber that this
   * render's own top-down reconciliation skipped over.
   */
  syncProps(next: SchemaFormStoreProps): boolean {
    const prev = this.props;
    const formNameChanged = next.spec.formName !== prev.spec.formName;
    this.props = next;
    if (next.valuesProp === undefined && formNameChanged) {
      this.internalValues = initialFormValues(next.spec.fields);
    }
    return (
      formNameChanged ||
      prev.spec !== next.spec ||
      prev.valuesProp !== next.valuesProp ||
      prev.disabled !== next.disabled ||
      prev.submitted !== next.submitted ||
      prev.submitting !== next.submitting ||
      prev.loading !== next.loading ||
      prev.error !== next.error
    );
  }

  /** Wakes every subscriber outside of any component's render phase (see `syncProps`). */
  notify(): void {
    this.emit();
  }

  private get isControlled(): boolean {
    return this.props.valuesProp !== undefined;
  }

  private getFieldMap(): Map<string, FieldSpec> {
    const fields = this.props.spec.fields;
    if (this.fieldMapCache && this.fieldMapCache.fields === fields) return this.fieldMapCache.map;
    const map = buildFieldMap(fields);
    this.fieldMapCache = { fields, map };
    return map;
  }

  getField(name: string): FieldSpec | undefined {
    return this.getFieldMap().get(name);
  }

  getValues(): FormValues {
    return this.isControlled ? (this.props.valuesProp as FormValues) : this.internalValues;
  }

  /** The merged/stripped values every visibility check and submit resolves against. Reference-stable when nothing changed (SchemaFormTestAction relies on this to detect a stale in-flight test). */
  getEffectiveValues(): FormValues {
    const base = this.getValues();
    const fields = this.props.spec.fields;
    if (this.mergedCache && this.mergedCache.base === base && this.mergedCache.fields === fields) {
      return this.mergedCache.result;
    }
    const result = computeMergedValues(fields, base);
    this.mergedCache = { base, fields, result };
    return result;
  }

  /** Empty until the first submit attempt (`EMPTY_ERRORS`, a stable reference); live-updates after. */
  getErrors(): Record<string, string | null> {
    if (!this.attempted) return EMPTY_ERRORS;
    const merged = this.getEffectiveValues();
    const fields = this.props.spec.fields;
    if (
      this.errorsCache &&
      this.errorsCache.merged === merged &&
      this.errorsCache.fields === fields &&
      this.errorsCache.attempted === this.attempted
    ) {
      return this.errorsCache.result;
    }
    const result = validateForm(fields, merged);
    this.errorsCache = { merged, fields, attempted: this.attempted, result };
    return result;
  }

  /** The slow-changing, form-wide flags — cached so ordinary typing never changes this object's reference. */
  getMeta(): SchemaFormMeta {
    const next: SchemaFormMeta = {
      spec: this.props.spec,
      formId: this.formId,
      headingId: this.headingId,
      disabled: this.props.disabled,
      submitted: this.props.submitted,
      submitting: this.props.submitting,
      loading: this.props.loading,
      error: this.props.error,
      attempted: this.attempted,
    };
    if (this.metaCache && metaEqual(this.metaCache, next)) return this.metaCache;
    this.metaCache = next;
    return next;
  }

  /** One field's reactive data. Cached per name — returns the SAME object when nothing about this field changed, so `useSyncExternalStore` bails out of re-rendering it. */
  getFieldSnapshot(name: string): FieldSnapshot {
    const field = this.getField(name);
    const merged = this.getEffectiveValues();
    const values = this.getValues();
    const errors = this.getErrors();
    const errorText = errors[name] ?? null;
    const next: FieldSnapshot = {
      value: field ? effectiveValue(field, values) : undefined,
      invalid: Boolean(errorText),
      errorText,
      visible: field ? isFieldVisible(field, merged) : false,
      disabled: this.props.disabled || this.props.submitted || this.props.submitting,
      readOnly: this.props.submitted,
    };
    const prev = this.fieldSnapshotCache.get(name);
    if (prev && fieldSnapshotEqual(prev, next)) return prev;
    this.fieldSnapshotCache.set(name, next);
    return next;
  }

  /**
   * Names of `fields` that are currently visible (top-level filter of
   * exactly that array — a `group`'s own branches call this again with
   * their OWN `fields`, which is what lets a branch react to a nested
   * `visibleWhen` independent of its ancestor `SchemaFormField`'s own
   * re-render). Cached by array reference, so a caller whose visible SET
   * didn't change gets back the SAME array across an unrelated keystroke.
   */
  getVisibleNames(fields: FieldSpec[]): string[] {
    const effective = this.getEffectiveValues();
    const cached = this.namesCache.get(fields);
    if (cached && cached.effective === effective) return cached.names;
    const names = fields
      .filter((field) => isFieldVisible(field, effective))
      .map((field) => field.name);
    const stable = cached && sameNames(cached.names, names) ? cached.names : names;
    this.namesCache.set(fields, { effective, names: stable });
    return stable;
  }

  getBranchHasError(fields: FieldSpec[]): boolean {
    return branchHasError(fields, this.getErrors());
  }

  setValue = (name: string, value: FormValue): void => {
    const base = this.getValues();
    const next: FormValues = { ...base, [name]: value };
    if (!this.isControlled) this.internalValues = next;
    this.props.onChange?.(next);
    this.emit();
  };

  submit = (): void => {
    this.attempted = true;
    const merged = this.getEffectiveValues();
    const errs = validateForm(this.props.spec.fields, merged);
    const invalidNames = Object.keys(errs).filter((n) => errs[n]);
    if (invalidNames.length > 0) {
      const firstInvalid = collectValidatableFields(this.props.spec.fields, merged).find(
        (f) => errs[f.name],
      );
      this.emit();
      if (firstInvalid) {
        for (const listener of this.pendingFocusListeners) listener(firstInvalid.name);
      }
      return;
    }
    this.emit();
    this.props.onSubmit?.({ formName: this.props.spec.formName, values: merged });
  };

  reset = (): void => {
    this.attempted = false;
    const seeded = initialFormValues(this.props.spec.fields);
    if (!this.isControlled) this.internalValues = seeded;
    this.props.onChange?.(seeded);
    this.emit();
  };
}

// ─── Hooks ──────────────────────────────────────────────────────────────────

export function useSchemaFormMeta(store: SchemaFormStore): SchemaFormMeta {
  const getSnapshot = useCallback(() => store.getMeta(), [store]);
  return useSyncExternalStore(store.subscribe, getSnapshot);
}

export function useFieldSnapshot(store: SchemaFormStore, name: string): FieldSnapshot {
  const getSnapshot = useCallback(() => store.getFieldSnapshot(name), [store, name]);
  return useSyncExternalStore(store.subscribe, getSnapshot);
}

export function useEffectiveValues(store: SchemaFormStore): FormValues {
  const getSnapshot = useCallback(() => store.getEffectiveValues(), [store]);
  return useSyncExternalStore(store.subscribe, getSnapshot);
}

export function useVisibleFieldNames(store: SchemaFormStore, fields: FieldSpec[]): string[] {
  const getSnapshot = useCallback(() => store.getVisibleNames(fields), [store, fields]);
  return useSyncExternalStore(store.subscribe, getSnapshot);
}

export function useBranchHasError(store: SchemaFormStore, fields: FieldSpec[]): boolean {
  const getSnapshot = useCallback(() => store.getBranchHasError(fields), [store, fields]);
  return useSyncExternalStore(store.subscribe, getSnapshot);
}
