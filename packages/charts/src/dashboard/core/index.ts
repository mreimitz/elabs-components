/**
 * Dashboard core — framework-free (ADR 0037 §3): no React, no react-dom, no `@dnd-kit/*`, no
 * `@elabs-ai/components-*` import. `zustand/vanilla` is allowed. Enforced by
 * `pnpm check --rule dashboard-reuse`.
 *
 * Each later item appends its export block under its own reserved marker below.
 */

// spec/validate/layout/expression — RM-070
export type * from "./spec";
export * from "./layout";
export * from "./validate";
export * from "./expression";

// store/history/selection — RM-071
export * from "./selection";
export * from "./history";
export * from "./local-selection-driver";
export * from "./store";

// interaction graph — RM-082
export * from "./interactions";

// URL/bookmark state codec — RM-083
export * from "./url";

// autoLayout/schema — RM-086
export * from "./auto-layout";
export * from "./schema";

// Presentation/Theme/Workbook — RM-087

export {};
