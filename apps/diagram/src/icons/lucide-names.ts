/**
 * DG-35 — the `lucide/<name>` names as plain strings, React-free, so the dev server (the MCP
 * tools, through `server/spec-bridge.mjs`) can check `icon:` values without loading
 * `lucide-react`. `lucide-map.ts` maps each name to its glyph and is typed against this list
 * (`satisfies Record<LucideIconName, LucideIcon>`), so the two cannot drift.
 */
export const LUCIDE_NAMES = [
  "server",
  "database",
  "hard-drive",
  "cloud",
  "users",
  "user",
  "globe",
  "lock",
  "shield",
  "key",
  "network",
  "router",
  "mail",
  "message-square",
  "file",
  "folder",
  "cpu",
  "layers",
  "box",
  "workflow",
  "git-branch",
  "terminal",
  "monitor",
  "smartphone",
  "building",
  "factory",
  "warehouse",
  "plug",
  "cable",
  "radio",
  "activity",
  "bar-chart",
  "table",
  "brain",
  "bot",
  "webhook",
  "timer",
  "calendar",
  "alert-triangle",
  "check",
] as const;

export type LucideIconName = (typeof LUCIDE_NAMES)[number];
