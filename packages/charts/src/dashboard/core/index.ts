/**
 * Dashboard core — framework-free (ADR 0037 §3): no React, no react-dom, no `@dnd-kit/*`, no
 * `@elabs-ai/components-*` import. `zustand/vanilla` is allowed. Enforced by
 * `pnpm check --rule dashboard-reuse`.
 *
 * Each later item appends its export block under its own reserved marker below.
 */

// spec/validate/layout/expression — RM-070

// store/history/selection — RM-071

// autoLayout/schema — RM-086

// Presentation/Theme/Workbook — RM-087

export {};
