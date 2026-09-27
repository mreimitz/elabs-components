/** Issue shape and codes. Compatible with ui SpecPlaygroundError { path, code, message }. React-free. */
import type { SourceRange } from "./source-map";

// P4: library gap — ui SpecIssueSeverity has no "info"; this app widens it (zone-endpoint).
export type ArchIssueSeverity = "error" | "warning" | "info";

export const ISSUE_SEVERITY = {
  "yaml-syntax": "error",
  "yaml-duplicate-key": "error",
  "yaml-warning": "warning",
  "not-a-diagram": "error",
  "unsupported-version": "error",
  "unknown-prop": "warning",
  "wrong-type": "error",
  "not-in-enum": "error",
  "missing-prop": "error",
  "out-of-range": "error",
  "bad-id": "error",
  "ambiguous-entry": "error",
  "parent-conflict": "error",
  "bad-flow": "error",
  "duplicate-id": "error",
  "unknown-parent": "error",
  "parent-not-zone": "error",
  "parent-cycle": "error",
  "external-in-zone": "warning",
  "missing-owner": "warning",
  "position-without-manual": "error",
  "unknown-endpoint": "error",
  "zone-endpoint": "info",
  "duplicate-step": "warning",
  "unknown-class": "warning",
  "unknown-icon": "warning",
  "unknown-provider": "warning",
  "unknown-note-target": "error",
} as const satisfies Record<string, ArchIssueSeverity>;

export type ArchIssueCode = keyof typeof ISSUE_SEVERITY;

/** Codes whose range is the mapping key, not the value. */
export const KEY_ANCHORED: ReadonlySet<ArchIssueCode> = new Set([
  "unknown-prop",
  "position-without-manual",
]);

export interface ArchIssue {
  path: string;
  code: ArchIssueCode;
  message: string;
  severity: ArchIssueSeverity;
  range?: SourceRange;
}

export function issue(code: ArchIssueCode, path: string, message: string): ArchIssue {
  return { path, code, message, severity: ISSUE_SEVERITY[code] };
}

export function isArchIssueCode(code: string): code is ArchIssueCode {
  return Object.hasOwn(ISSUE_SEVERITY, code);
}
