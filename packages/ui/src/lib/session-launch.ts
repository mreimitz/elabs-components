/**
 * The session-launch vocabulary behind `SessionHeader`
 * (`@elabs-ai/components-ai`, #110) and the terminal CLI look-alike family's
 * own launch banner (issue #117, T7 — the "Empty" and "First-run" states).
 *
 * Promoted here (not duplicated) because `@elabs-ai/components-ai` and
 * `@elabs-ai/components-terminal` are layer-2 DAG SIBLINGS and may not import
 * each other — `ui` is upstream of both
 * (docs/decisions/2026-09-01-brainless-adoption-architecture.md § 4). Pure
 * item types, no behaviour.
 */
import type { ReactNode } from "react";

export interface SessionCapability {
  /** Short capability name, e.g. "Web search". */
  label: string;
  /** One-line detail rendered under the label. */
  description?: string;
  /** Decorative leading glyph — a Lucide icon element. */
  icon?: ReactNode;
}

export interface SessionWhatsNewItem {
  /** What changed, e.g. "Faster file search". */
  label: string;
  /** Optional link to release notes / a changelog entry. */
  href?: string;
}

export interface SessionQuickAction {
  /** Visible label, e.g. "New chat". */
  label: string;
  /** Shortcut hint, rendered with the `Kbd` primitive (e.g. "⌘N"). */
  keyHint?: string;
  /** Invoked when the action is chosen. */
  onSelect?: () => void;
}
