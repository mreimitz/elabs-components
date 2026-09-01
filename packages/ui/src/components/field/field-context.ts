import { createContext, use } from "react";

/**
 * Shared, lifted state for the `Field*` compound anatomy (`FieldRoot` +
 * `FieldLabel`/`FieldControl`/`FieldDescription`/`FieldError`). `FieldRoot`
 * is the only place this state is produced; every part reads the INTERFACE
 * below rather than receiving positional props, so parts can be composed in
 * any order/layout (compound-component + lifted-state convention — see
 * `.claude/rules/component-api.md` "Composition patterns").
 */
export interface FieldContextValue {
  /**
   * The id `FieldLabel`'s `htmlFor` points to — the FIRST `FieldControl`
   * mounted under this `FieldRoot`, by JSX order (self-registered; see
   * `registerControl`). `undefined` until a control has registered.
   */
  labelFor: string | undefined;
  /** Registers a `FieldControl`'s resolved id (called while it is mounted). */
  registerControl: (id: string) => void;
  /** Unregisters a `FieldControl`'s id (called on unmount / when its id changes). */
  unregisterControl: (id: string) => void;
  /** Fixed id `FieldDescription` renders at. */
  descriptionId: string;
  /** Fixed id `FieldError` renders at. */
  errorId: string;
  /** `FieldRoot`'s `invalid` prop — drives `aria-invalid` on every `FieldControl` and error styling on `FieldLabel`. */
  invalid: boolean;
  /** `FieldRoot`'s `required` prop — drives `aria-required` on every `FieldControl`. */
  required: boolean;
  /**
   * The composed `aria-describedby` value from whichever of `FieldDescription`/
   * `FieldError` are actually mounted WITH content, in that fixed order.
   * `undefined` when neither is present.
   */
  describedBy: string | undefined;
  /** Registers a descriptive part's id (called by `FieldDescription`/`FieldError` while they have content). Idempotent. */
  registerDescribedBy: (id: string) => void;
  /** Unregisters a descriptive part's id (called on unmount / when content is cleared). */
  unregisterDescribedBy: (id: string) => void;
}

export const FieldContext = createContext<FieldContextValue | null>(null);

/** Reads the shared `Field*` context; throws with the calling component's name when used outside a `FieldRoot`. */
export function useFieldContext(component: string): FieldContextValue {
  const ctx = use(FieldContext);
  if (!ctx) {
    throw new Error(`<${component}> must be rendered inside a <FieldRoot>.`);
  }
  return ctx;
}
