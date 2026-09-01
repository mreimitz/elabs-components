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
  /** `FieldRoot`'s `invalid` prop — drives `aria-invalid` on every `FieldControl` and error styling on `FieldLabel`. */
  invalid: boolean;
  /** `FieldRoot`'s `required` prop — drives `aria-required` on every `FieldControl`. */
  required: boolean;
  /**
   * The composed `aria-describedby` value from every mounted `FieldDescription`/
   * `FieldError` instance WITH content, descriptions first (in mount order),
   * then errors (in mount order) — a fixed semantic order regardless of DOM
   * position, so more than one of either part (or reordering them relative to
   * `FieldControl`) never scrambles the announced order. `undefined` when
   * nothing is registered.
   */
  describedBy: string | undefined;
  /**
   * Registers one `FieldDescription` INSTANCE's own id (called while it has
   * content). Each instance generates and registers its own id — this is not
   * a single shared slot, so more than one `FieldDescription` under one
   * `FieldRoot` is supported without id collisions.
   */
  registerDescription: (id: string) => void;
  /** Unregisters one `FieldDescription` instance's id (on unmount / when content is cleared). Removes only that instance's id. */
  unregisterDescription: (id: string) => void;
  /** Registers one `FieldError` instance's own id (called while it has content). Same per-instance contract as `registerDescription`. */
  registerError: (id: string) => void;
  /** Unregisters one `FieldError` instance's id (on unmount / when content is cleared). Removes only that instance's id. */
  unregisterError: (id: string) => void;
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
