export type StyleLens = "technical" | "visual";
export type StyleColor = string;
export interface StylePaint {
  fill: StyleColor;
  text: StyleColor;
  stroke: StyleColor;
}
export interface StyleFlow {
  stroke: StyleColor;
  width: number;
  dash: "none" | "6 4" | "6 5";
  marker: "arrow" | "none";
}
/** Serializable, validated drawing preferences. No executable CSS or remote assets. */
export interface StyleProfile {
  profile: string;
  schemaVersion: 1;
  lens: StyleLens;
  title: string;
  extends?: string;
  vendor?: string;
  fidelity: "verified" | "approximate" | "unverified";
  source: string;
  ground: { fill: StyleColor; followTheme: boolean };
  typography: {
    text: StyleColor;
    muted: StyleColor;
    family: "inherit" | "Inter";
    emphasis: "weight";
  };
  roles: Record<"hero" | "other" | "generic" | "sub" | "zone", StylePaint>;
  owners: Record<"customer" | "saas" | "hosted" | "partner" | "unowned", StylePaint>;
  zones: {
    radius: number;
    accentHeight: number;
    accents: Record<
      "vendor-cloud" | "sources" | "customer-managed" | "customer-vpc" | "targets",
      StyleColor
    >;
  };
  boxes: {
    anatomy: "capability-list";
    title: { weight: 400 | 500 | 600 | 700; align: "left" | "center" };
    items: { icon: "mono" | "brand" | "semantic"; bullet: "ring" | "none" };
  };
  pills: {
    enabled: boolean;
    fill: StyleColor;
    text: StyleColor;
    vocabulary: readonly string[];
    fromTags: Readonly<Record<string, string>>;
  };
  flows: {
    data: StyleFlow;
    control: StyleFlow;
    routing: "orthogonal";
    arrowheads: "target-only" | "both-when-bidirectional" | "none";
  };
  layout: { direction: "LR" | "TB"; controlPlane: "top"; lanes: readonly string[]; grid: number };
  forbid: readonly (
    | "per-node-colour"
    | "accent-as-fill"
    | "diagonal-edges"
    | "coloured-arrows"
    | "new-pill-labels"
  )[];
}
export interface StyleSelection {
  technical?: "inherit" | "atlas-clean";
  visual?: "inherit" | "qlik-marketecture";
}
export interface WorkspaceStyleConfig {
  styles?: StyleSelection;
}
export interface StyleIssue {
  code: string;
  message: string;
  path: readonly (string | number)[];
  source?: string;
}
export interface ThemeBinding {
  family: string;
  hero: string | null;
  profiles: { technical: string; visual: string };
  followTheme: boolean;
}
export interface StyleProvenance {
  level: "theme" | "workspace" | "diagram";
  profile: string;
  theme: string;
  inherited: readonly string[];
}
export interface ResolvedStyle {
  technical: StyleProfile;
  visual: StyleProfile;
  hero: string | null;
  provenance: Record<StyleLens, StyleProvenance>;
  issues: readonly StyleIssue[];
}
