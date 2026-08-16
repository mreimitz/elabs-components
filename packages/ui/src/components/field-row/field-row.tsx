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
import { Label } from "../label";

export interface FieldRowProps extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  /** Field label — rendered as a real `<label>`, click-to-focus associated with the control. */
  label: ReactNode;
  /** Optional help/description text, always visible (not gated by an error). */
  description?: ReactNode;
  /**
   * Validation error text. When present: sets `aria-invalid` on the control,
   * is appended to `aria-describedby`, and is announced via `role="alert"`.
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

  const describedBy =
    [
      childProps["aria-describedby"] ?? null,
      description ? descriptionId : null,
      error ? errorId : null,
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
        aria-invalid={!!error}
        data-slot="field-row-control"
      >
        {cloneElement(control, { id: controlId, "aria-describedby": describedBy })}
      </Slot>
      {description ? (
        <p
          id={descriptionId}
          data-slot="field-row-description"
          className="text-body text-muted-foreground"
        >
          {description}
        </p>
      ) : null}
      {error ? (
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
