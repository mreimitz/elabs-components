import {
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
 * `FieldDescription` placed before the control. Reuses the same accessibility
 * wiring `FieldRow` (`../field-row`) already validated (id/`aria-describedby`/
 * `aria-invalid`/`role="alert"`); `FieldRow` remains the convenience wrapper
 * for the common single-control case and is unaffected by this addition (#43).
 *
 * @example
 * ```tsx
 * <FieldRoot invalid={!!error} required>
 *   <FieldLabel>API key</FieldLabel>
 *   <FieldControl><Input /></FieldControl>
 *   <FieldDescription>Found in your account settings.</FieldDescription>
 *   <FieldError>{error}</FieldError>
 * </FieldRoot>
 * ```
 */
export const FieldRoot = forwardRef<HTMLDivElement, FieldRootProps>(function FieldRoot(
  { invalid = false, required = false, className, children, ...props },
  ref,
) {
  const id = useId();
  const descriptionId = `${id}-description`;
  const errorId = `${id}-error`;

  const [mounted, setMounted] = useState<ReadonlySet<string>>(() => new Set());

  const registerDescribedBy = useCallback((descId: string) => {
    setMounted((prev) => (prev.has(descId) ? prev : new Set(prev).add(descId)));
  }, []);
  const unregisterDescribedBy = useCallback((descId: string) => {
    setMounted((prev) => {
      if (!prev.has(descId)) return prev;
      const next = new Set(prev);
      next.delete(descId);
      return next;
    });
  }, []);

  // Fixed [description, error] order regardless of DOM order or registration
  // order, so "description placed before the control" reorders the VISIBLE
  // layout without reordering the announced description.
  const describedBy = useMemo(() => {
    const ids = [descriptionId, errorId].filter((candidate) => mounted.has(candidate));
    return ids.length > 0 ? ids.join(" ") : undefined;
  }, [mounted, descriptionId, errorId]);

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
      descriptionId,
      errorId,
      invalid,
      required,
      describedBy,
      registerDescribedBy,
      unregisterDescribedBy,
    }),
    [
      labelFor,
      registerControl,
      unregisterControl,
      descriptionId,
      errorId,
      invalid,
      required,
      describedBy,
      registerDescribedBy,
      unregisterDescribedBy,
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

export const FieldDescription = forwardRef<
  HTMLParagraphElement,
  HTMLAttributes<HTMLParagraphElement>
>(function FieldDescription({ className, children, ...props }, ref) {
  const { descriptionId, registerDescribedBy, unregisterDescribedBy } =
    useFieldContext("FieldDescription");
  const hasContent = children !== undefined && children !== null && children !== "";

  useLayoutEffect(() => {
    if (!hasContent) return undefined;
    registerDescribedBy(descriptionId);
    return () => unregisterDescribedBy(descriptionId);
  }, [hasContent, descriptionId, registerDescribedBy, unregisterDescribedBy]);

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

export const FieldError = forwardRef<HTMLParagraphElement, HTMLAttributes<HTMLParagraphElement>>(
  function FieldError({ className, children, ...props }, ref) {
    const { errorId, registerDescribedBy, unregisterDescribedBy } = useFieldContext("FieldError");
    const hasContent = children !== undefined && children !== null && children !== "";

    useLayoutEffect(() => {
      if (!hasContent) return undefined;
      registerDescribedBy(errorId);
      return () => unregisterDescribedBy(errorId);
    }, [hasContent, errorId, registerDescribedBy, unregisterDescribedBy]);

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
