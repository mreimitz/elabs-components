import type { CSSProperties } from "react";
import type { StyleProfile } from "./types";
/** Fixed-profile colors are scoped to a lens, including its portaled chrome. */
export function profileVariables(profile: StyleProfile): CSSProperties {
  if (profile.ground.followTheme) return {};
  return {
    "--canvas": profile.ground.fill,
    "--background": profile.ground.fill,
    "--foreground": profile.typography.text,
    "--muted-foreground": profile.typography.muted,
    "--card": profile.roles.zone.fill,
    "--card-foreground": profile.typography.text,
    "--surface-muted": profile.roles.other.fill,
    "--surface-elevated": profile.roles.zone.fill,
    "--muted": profile.roles.zone.fill,
    "--flow-minimap-node": profile.typography.muted,
    "--flow-minimap-mask": `color-mix(in srgb, ${profile.ground.fill} 65%, transparent)`,
    "--popover": profile.roles.zone.fill,
    "--popover-foreground": profile.typography.text,
    "--accent": profile.roles.other.fill,
    "--accent-foreground": profile.roles.other.text,
    color: profile.typography.text,
    fontFamily: profile.typography.family === "inherit" ? undefined : "Inter, var(--font-sans)",
  } as CSSProperties;
}
