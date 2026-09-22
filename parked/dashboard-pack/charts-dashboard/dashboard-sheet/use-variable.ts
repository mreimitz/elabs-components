"use client";

import type { VariableValue } from "../core/spec";
import { useDashboard, useDashboardActions } from "./use-dashboard";

/** A variable's value and its setter, like `useState`. */
export function useVariable(
  name: string,
): [VariableValue | undefined, (value: VariableValue) => void] {
  const value = useDashboard((state) => state.variables[name]);
  const actions = useDashboardActions();
  return [value, (next) => actions.setVariable(name, next)];
}
