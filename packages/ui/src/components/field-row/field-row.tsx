import {
  cloneElement,
  forwardRef,
  useId,
  type HTMLAttributes,
  type ReactElement,
  type ReactNode,
} from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "../../lib/cn";
import { hasRenderableContent } from "../../lib/has-renderable-content";
import { Label } from "../label";

export interface FieldRowProps extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  /** Field label — rendered as a real `<label>`, click-to-focus associated with the control. */
  label: ReactNode;
  /**
   * Optional help/description text, always visible (not gated by an error).
   * Renders nothing — and contributes no id to `aria-describedby` — when
   * `description` is falsy (`false`/`0`/`""`/`null`/`undefined`), an empty
   * array, or an array containing only falsy values (`{list.map(...)}` on an
   * empty list; `[a && "x", b && "y"]` with both false).
   *
   * **Known limit:** a value that is itself a COMPONENT that renders nothing
   * (returns `null`/an empty fragment) is not knowable before render, so it
   * still produces an empty paragraph that `aria-describedby` points at.
   * `FieldDescription` and the wider React ecosystem share this limit — pass
   * a falsy value instead of a component that may render nothing, e.g.
   * `description={hasHint ? hintText : undefined}`, never
   * `description={<MaybeRendersNull />}`.
   */
  description?: ReactNode;
  /**
   * Validation error text. When present: sets `aria-invalid` on the control,
   * is appended to `aria-describedby`, and is announced via `role="alert"`.
   * Renders nothing — and leaves `aria-invalid="false"` — when `error` is
   * falsy (`false`/`0`/`""`/`null`/`undefined`), an empty array, or an array
   * containing only falsy values (`{errors.map(...)}` on an empty list — the
   * idiomatic "no errors" shape).
   *
   * **Known limit:** a value that is itself a COMPONENT that renders nothing
   * (returns `null`/an empty fragment) is not knowable before render, so it
   * still produces an empty `role="alert"` element that `aria-describedby`
   * points at. `FieldError` and the wider React ecosystem share this limit —
   * pass a falsy value instead of a component that may render nothing, e.g.
   * `error={hasError ? message : undefined}`, never
   * `error={<MaybeRendersNull />}`.
   */
  error?: ReactNode;
  /**
   * The single field control (`Input`, `Textarea`, `Select`, …). Receives
   * `id`/`aria-describedby`/`aria-invalid` via a Radix `Slot` — must be a
   * single element that forwards those props to a real form control.
   */
  children: ReactElement;
}

/**
 * Label/description/error/`aria-describedby` wiring for a field OUTSIDE a
 * `react-hook-form` tree — the same anatomy as `FormItem`/`FormLabel`/
 * `FormControl`/`FormDescription`/`FormMessage` (`../form`), but driven by
 * plain props (`label`/`description`/`error`) instead of RHF field state, so
 * a single `useState`-controlled field doesn't need a full `<Form>` +
 * `<FormField>` + `Controller` just to get correct label/error association.
 *
 * Reach for `Form`/`FormField`/… instead when the field already lives inside
 * a `react-hook-form` `<FormProvider>` — this component does not replace that
 * family, it covers the gap outside it (#354).
 */
export const FieldRow = forwardRef<HTMLDivElement, FieldRowProps>(function FieldRow(
  { label, description, error, children, className, ...props },
  ref,
) {
  const id = useId();
  const descriptionId = `${id}-description`;
  const errorId = `${id}-error`;

  // Radix `Slot` merges CHILD props OVER slot props, so a control that carries
  // its own `id` / `aria-describedby` (a perfectly ordinary `<Input id="email">`)
  // silently wins — the `<Label htmlFor>` would then point at nothing and the
  // description/error would never be announced, defeating the one thing this
  // component exists to guarantee. So compose with the child's own values
  // instead of assuming they are absent, and clone the child with the composed
  // result so "child wins" resolves to the composed value either way.
  const control = children as ReactElement<{
    id?: string;
    "aria-describedby"?: string;
  }>;
  const childProps = control.props;
  const controlId = childProps.id ?? `${id}-control`;

  // Same predicate `FieldDescription`/`FieldError` use (`../field/field.tsx`)
  // — bare truthiness (`description ? … : null`) treats an empty/all-falsy
  // ARRAY as content, since every array is truthy in JS. `errors.map(...)`
  // on an empty list is the idiomatic "no errors" shape, so that gap is a
  // real defect here, not a hypothetical (#93).
  const hasDescription = hasRenderableContent(description);
  const hasError = hasRenderableContent(error);

  const describedBy =
    [
      childProps["aria-describedby"] ?? null,
      hasDescription ? descriptionId : null,
      hasError ? errorId : null,
    ]
      .filter(Boolean)
      .join(" ") || undefined;

  return (
    <div ref={ref} data-slot="field-row" className={cn("space-y-2", className)} {...props}>
      <Label
        htmlFor={controlId}
        data-slot="field-row-label"
        className={cn(
          "transition-colors duration-fast ease-standard",
          error && "text-destructive-text",
        )}
      >
        {label}
      </Label>
      <Slot
        id={controlId}
        aria-describedby={describedBy}
        // `FieldRoot.invalid` (`../field/field.tsx`) is intentionally
        // INDEPENDENT of whether a `FieldError` with content is mounted — a
        // caller can mark the control invalid before its message settles.
        // `FieldRow` has no such prop: `error` is its only invalidity
        // signal, so "no error content" must mean "not invalid" — deriving
        // this from raw `!!error` marked `error={[]}` invalid with nothing
        // to explain why (#93).
        aria-invalid={hasError}
        data-slot="field-row-control"
      >
        {cloneElement(control, { id: controlId, "aria-describedby": describedBy })}
      </Slot>
      {hasDescription ? (
        <p
          id={descriptionId}
          data-slot="field-row-description"
          className="text-body text-muted-foreground"
        >
          {description}
        </p>
      ) : null}
      {hasError ? (
        <p
          id={errorId}
          role="alert"
          data-slot="field-row-error"
          className="text-body font-medium text-destructive-text"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
});
