import type {
  ResolvedStyle,
  StyleIssue,
  StyleLens,
  StyleProfile,
  StyleProvenance,
  StyleSelection,
  ThemeBinding,
  WorkspaceStyleConfig,
} from "./types";
export function themeBindingFor(themeName: string): ThemeBinding {
  const qlik = /^qlik(?:-|$)/i.test(themeName);
  return {
    family: qlik ? "qlik" : "neutral",
    hero: qlik ? "qlik" : null,
    profiles: { technical: "atlas-clean", visual: "qlik-marketecture" },
    followTheme: !qlik,
  };
}
export function selectionIssues(
  value: unknown,
  path: readonly (string | number)[] = [],
): StyleIssue[] {
  const issue = (suffix: string[], message: string): StyleIssue => ({
    code: "style-selection",
    path: [...path, ...suffix],
    message,
  });
  if (!value || typeof value !== "object" || Array.isArray(value))
    return [issue([], "Style selection must be an object.")];
  const allowed = { technical: "atlas-clean", visual: "qlik-marketecture" };
  return Object.entries(value).flatMap(([key, value]) =>
    !Object.hasOwn(allowed, key)
      ? [issue([key], "Unknown style lens.")]
      : value !== "inherit" && value !== allowed[key as StyleLens]
        ? [issue([key], `Use inherit or ${allowed[key as StyleLens]} for this lens.`)]
        : [],
  );
}
export function resolveStyle(context: {
  theme: ThemeBinding;
  workspace?: WorkspaceStyleConfig;
  diagram?: StyleSelection;
  profiles: ReadonlyMap<string, StyleProfile>;
}): ResolvedStyle {
  const { theme, workspace, diagram, profiles } = context;
  const issues: StyleIssue[] = [];
  if (workspace?.styles) issues.push(...selectionIssues(workspace.styles, ["workspace", "styles"]));
  if (diagram) issues.push(...selectionIssues(diagram, ["style"]));
  const provenance = {} as Record<StyleLens, StyleProvenance>;
  const resolve = (lens: StyleLens): StyleProfile => {
    let id = theme.profiles[lens];
    let level: StyleProvenance["level"] = "theme";
    const inherited: string[] = [];
    for (const [source, selection] of [
      ["workspace", workspace?.styles],
      ["diagram", diagram],
    ] as const) {
      const next = selection?.[lens];
      if (!next || next === "inherit") {
        inherited.push(source);
        continue;
      }
      if (selectionIssues({ [lens]: next }).length) continue;
      id = next;
      level = source;
    }
    let profile = profiles.get(id);
    if (!profile || profile.lens !== lens) {
      issues.push({
        code: "style-profile-missing",
        path: [level, lens],
        message: `Profile “${id}” is unavailable for ${lens}.`,
      });
      id = lens === "technical" ? "atlas-clean" : "qlik-marketecture";
      profile = profiles.get(id);
    }
    if (!profile || profile.lens !== lens)
      throw new Error(`Required built-in style profile “${id}” is unavailable.`);
    provenance[lens] = { level, profile: id, theme: theme.family, inherited };
    return theme.followTheme && lens === "visual"
      ? { ...profile, ground: { ...profile.ground, followTheme: true } }
      : profile;
  };
  return {
    technical: resolve("technical"),
    visual: resolve("visual"),
    hero: theme.hero,
    provenance,
    issues,
  };
}
