import {
  Children,
  cloneElement,
  forwardRef,
  useCallback,
  useId,
  useLayoutEffect,
  useMemo,
  useState,
  type ComponentPropsWithoutRef,
  type ElementRef,
  type HTMLAttributes,
  type ReactElement,
} from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "../../lib/cn";
import { Label } from "../label";
import { FieldContext, useFieldContext, type FieldContextValue } from "./field-context";

// ── FieldRoot ─────────────────────────────────────────────────────────────

export interface FieldRootProps extends HTMLAttributes<HTMLDivElement> {
  /**
   * Whether the field is currently invalid. Drives `aria-invalid` on every
   * `FieldControl` and error styling on `FieldLabel` — independent of
   * whether a `FieldError` with content is actually mounted, so a caller can
   * mark the control invalid before its message has settled.
   */
  invalid?: boolean;
  /** Whether the field is required. Drives `aria-required` on every `FieldControl`. */
  required?: boolean;
}

/**
 * Compound-anatomy field: `FieldRoot` owns id generation and `aria-describedby`
 * composition; `FieldLabel`/`FieldControl`/`FieldDescription`/`FieldError` read
 * that state from context and can be composed in ANY order/layout — including
 * more than one `FieldControl` in one row (e.g. first/last name) or a
 * `FieldDescription` placed before the control. Mirrors the same accessibility
 * wiring `FieldRow` (`../field-row`) already validated (id/`aria-describedby`/
 * `aria-invalid`/`role="alert"`), adapted to a shared lifted-state context so
 * it holds across independently-composed parts; `FieldRow` remains the
 * convenience wrapper for the common single-control case and is unaffected by
 * this addition (#43).
 *
 * @example
 * ```tsx
 * <FieldRoot invalid={!!error} required>
 *   <FieldLabel>{label}</FieldLabel>
 *   <FieldControl><Input /></FieldControl>
 *   <FieldDescription>{helpText}</FieldDescription>
 *   <FieldError>{error}</FieldError>
 * </FieldRoot>
 * ```
 */
export const FieldRoot = forwardRef<HTMLDivElement, FieldRootProps>(function FieldRoot(
  { invalid = false, required = false, className, children, ...props },
  ref,
) {
  // Each `FieldDescription`/`FieldError` INSTANCE generates and registers its
  // own id (see below) — two lists, not one shared slot per part type, so
  // more than one of either part under one `FieldRoot` gets distinct ids
  // instead of colliding, and unmounting one instance only ever removes that
  // instance's own id from its own list (never a sibling's).
  const [descriptionIds, setDescriptionIds] = useState<readonly string[]>([]);
  const registerDescription = useCallback((descId: string) => {
    setDescriptionIds((prev) => (prev.includes(descId) ? prev : [...prev, descId]));
  }, []);
  const unregisterDescription = useCallback((descId: string) => {
    setDescriptionIds((prev) => (prev.includes(descId) ? prev.filter((x) => x !== descId) : prev));
  }, []);

  const [errorIds, setErrorIds] = useState<readonly string[]>([]);
  const registerError = useCallback((errId: string) => {
    setErrorIds((prev) => (prev.includes(errId) ? prev : [...prev, errId]));
  }, []);
  const unregisterError = useCallback((errId: string) => {
    setErrorIds((prev) => (prev.includes(errId) ? prev.filter((x) => x !== errId) : prev));
  }, []);

  // Fixed semantic order — every description before every error — regardless
  // of DOM order or registration order, so "description placed before the
  // control" reorders the VISIBLE layout without reordering the announced
  // description, and a second description/error is appended rather than
  // replacing the first.
  const describedBy = useMemo(() => {
    const ids = [...descriptionIds, ...errorIds];
    return ids.length > 0 ? ids.join(" ") : undefined;
  }, [descriptionIds, errorIds]);

  // `FieldLabel`'s `htmlFor` can only point to ONE control, so it binds to
  // whichever `FieldControl` registers FIRST (JSX/mount order) — the common
  // single-control case gets this for free; a multi-control row (e.g.
  // first/last name) still labels the first field, and every additional
  // control needs its own explicit `id` the same way any two form controls
  // would (no new coordination prop invented for this).
  const [controlOrder, setControlOrder] = useState<readonly string[]>([]);
  const registerControl = useCallback((controlId: string) => {
    setControlOrder((prev) => (prev.includes(controlId) ? prev : [...prev, controlId]));
  }, []);
  const unregisterControl = useCallback((controlId: string) => {
    setControlOrder((prev) =>
      prev.includes(controlId) ? prev.filter((x) => x !== controlId) : prev,
    );
  }, []);
  const labelFor = controlOrder[0];

  const value = useMemo<FieldContextValue>(
    () => ({
      labelFor,
      registerControl,
      unregisterControl,
      invalid,
      required,
      describedBy,
      registerDescription,
      unregisterDescription,
      registerError,
      unregisterError,
    }),
    [
      labelFor,
      registerControl,
      unregisterControl,
      invalid,
      required,
      describedBy,
      registerDescription,
      unregisterDescription,
      registerError,
      unregisterError,
    ],
  );

  return (
    <FieldContext.Provider value={value}>
      <div ref={ref} data-slot="field" className={cn("space-y-2", className)} {...props}>
        {children}
      </div>
    </FieldContext.Provider>
  );
});

// ── FieldLabel ────────────────────────────────────────────────────────────

export const FieldLabel = forwardRef<
  ElementRef<typeof Label>,
  ComponentPropsWithoutRef<typeof Label>
>(function FieldLabel({ className, ...props }, ref) {
  const { labelFor, invalid } = useFieldContext("FieldLabel");
  return (
    <Label
      ref={ref}
      htmlFor={labelFor}
      data-slot="field-label"
      className={cn(
        "transition-colors duration-fast ease-standard",
        invalid && "text-destructive-text",
        className,
      )}
      {...props}
    />
  );
});

// ── FieldControl ──────────────────────────────────────────────────────────

export interface FieldControlProps {
  /**
   * The single field control (`Input`, `Textarea`, `Select`, …). Receives
   * `id`/`aria-describedby`/`aria-invalid`/`aria-required` via a Radix
   * `Slot` — must be a single element that forwards those props to a real
   * form control. Compose more than one `FieldControl` inside one
   * `FieldRoot` for a multi-control row (each gets its own independent id;
   * give every control but the first its own explicit `id`, the same way
   * you would for any two form controls that must not collide). `FieldLabel`
   * can only associate with ONE control (the first to mount), so give every
   * OTHER control in the row its own `aria-label` — a shared visual label
   * plus a placeholder is not a real accessible name for the rest.
   */
  children: ReactElement<{
    id?: string;
    "aria-describedby"?: string;
  }>;
}

export const FieldControl = forwardRef<ElementRef<typeof Slot>, FieldControlProps>(
  function FieldControl({ children }, ref) {
    const { invalid, required, describedBy, registerControl, unregisterControl } =
      useFieldContext("FieldControl");
    // Independent per-instance fallback id — guarantees uniqueness with no
    // coordination needed when more than one `FieldControl` shares a
    // `FieldRoot` (e.g. a first/last-name row).
    const generatedId = useId();

    // Same "child wins, but COMPOSE rather than discard" merge FieldRow uses:
    // Radix `Slot` merges child props OVER slot props, so a control that
    // already carries its own `id`/`aria-describedby` must not silently lose
    // the label association / description-error wiring.
    const control = children;
    const childProps = control.props;
    const id = childProps.id ?? generatedId;
    const composedDescribedBy =
      [childProps["aria-describedby"] ?? null, describedBy ?? null].filter(Boolean).join(" ") ||
      undefined;

    useLayoutEffect(() => {
      registerControl(id);
      return () => unregisterControl(id);
    }, [id, registerControl, unregisterControl]);

    return (
      <Slot
        ref={ref}
        id={id}
        aria-describedby={composedDescribedBy}
        aria-invalid={invalid}
        aria-required={required || undefined}
        data-slot="field-control"
      >
        {cloneElement(control, { id, "aria-describedby": composedDescribedBy })}
      </Slot>
    );
  },
);

// ── FieldDescription ──────────────────────────────────────────────────────

/**
 * Optional field help text. Renders nothing — and registers no
 * `aria-describedby` reference — when `children` is falsy (`false`/`0`/`""`/
 * `null`/`undefined`), an empty array, or an array containing only falsy
 * values (`{list.map(...)}` on an empty list; `[a && "x", b && "y"]` with
 * both false) — matching `FieldRow`'s `description ? … : null` convention:
 * `{hint && <FieldDescription>{hint}</FieldDescription>}` is the supported
 * way to express "no description".
 *
 * **Known limit:** a child that is itself a COMPONENT that renders nothing
 * (returns `null`/an empty fragment) is not knowable from the element
 * before render, so it still produces an empty paragraph that
 * `aria-describedby` points at. `FieldRow` and the wider React ecosystem
 * share this limit — pass a falsy child instead of a component that may
 * render nothing.
 */
export const FieldDescription = forwardRef<
  HTMLParagraphElement,
  HTMLAttributes<HTMLParagraphElement>
>(function FieldDescription({ className, children, ...props }, ref) {
  const { registerDescription, unregisterDescription } = useFieldContext("FieldDescription");
  // Own id per INSTANCE — two `FieldDescription`s under one `FieldRoot` (a hint
  // above the control and a hint below it) must not collide on one shared id.
  const instanceId = useId();
  const descriptionId = `${instanceId}-description`;
  // Same falsy-content convention `FieldRow` uses (`description ? … : null`):
  // `{condition && "message"}` is the ordinary React idiom for optional
  // content, and `condition === false` must render nothing — a `false`/`0`/
  // `""`/`null`/`undefined` child is "no content", not an empty paragraph.
  // `Boolean(children)` alone is not enough: an array is always truthy, so
  // `{errors.map(...)}` on an empty list (or `[a && "x", b && "y"]` with both
  // false) would still count as content. `Children.toArray` drops `null`/
  // `undefined`/booleans from an array but KEEPS `""` (and `0`), so an array
  // like `["", ""]` would still slip through as "content" without the
  // trailing `.filter(Boolean)` — filtering after `toArray` is what makes
  // this match the scalar check above for every array shape, not just the
  // ones `toArray` already prunes.
  const hasContent = Boolean(children) && Children.toArray(children).filter(Boolean).length > 0;

  useLayoutEffect(() => {
    if (!hasContent) return undefined;
    registerDescription(descriptionId);
    return () => unregisterDescription(descriptionId);
  }, [hasContent, descriptionId, registerDescription, unregisterDescription]);

  if (!hasContent) return null;

  return (
    <p
      ref={ref}
      id={descriptionId}
      data-slot="field-description"
      className={cn("text-body text-muted-foreground", className)}
      {...props}
    >
      {children}
    </p>
  );
});

// ── FieldError ────────────────────────────────────────────────────────────

/**
 * Validation error text, announced via `role="alert"`. Renders nothing —
 * and registers no `aria-describedby` reference — when `children` is falsy
 * (`false`/`0`/`""`/`null`/`undefined`), an empty array, or an array
 * containing only falsy values (`{errors.map(...)}` on an empty array is
 * exactly how a real form renders "no errors") — matching `FieldRow`'s
 * `error ? … : null` convention: `{error && <FieldError>{error}</FieldError>}`
 * is the supported way to express "no error".
 *
 * **Known limit:** a child that is itself a COMPONENT that renders nothing
 * (returns `null`/an empty fragment) is not knowable from the element
 * before render, so it still produces an empty `role="alert"` element that
 * `aria-describedby` points at (a screen reader announces an empty alert).
 * `FieldRow` and the wider React ecosystem share this limit — pass a falsy
 * child instead of a component that may render nothing.
 */
export const FieldError = forwardRef<HTMLParagraphElement, HTMLAttributes<HTMLParagraphElement>>(
  function FieldError({ className, children, ...props }, ref) {
    const { registerError, unregisterError } = useFieldContext("FieldError");
    // Own id per INSTANCE — same reasoning as `FieldDescription`.
    const instanceId = useId();
    const errorId = `${instanceId}-error`;
    // Same falsy-content convention as `FieldDescription`/`FieldRow`'s
    // `error ? … : null` — `{condition && "message"}` with `condition` false
    // must render no alert at all, not an empty one a screen reader announces.
    // `Boolean(children)` alone can't see an empty/all-falsy ARRAY (arrays are
    // always truthy), and `Children.toArray` alone still keeps `""`/`0` inside
    // one — see `FieldDescription` for the full rationale on the trailing
    // `.filter(Boolean)`.
    const hasContent = Boolean(children) && Children.toArray(children).filter(Boolean).length > 0;

    useLayoutEffect(() => {
      if (!hasContent) return undefined;
      registerError(errorId);
      return () => unregisterError(errorId);
    }, [hasContent, errorId, registerError, unregisterError]);

    if (!hasContent) return null;

    return (
      <p
        ref={ref}
        id={errorId}
        role="alert"
        data-slot="field-error"
        className={cn("text-body font-medium text-destructive-text", className)}
        {...props}
      >
        {children}
      </p>
    );
  },
);
