import { badgeVariants, buttonVariants, cn } from "@elabs-ai/components-ui";
import type { Node } from "@elabs-ai/components-flow";
import { OWNER_LABEL, ZONE_MIN_WIDTH, isZoneNode, type ZoneData } from "../nodes/zone-data";
import { zoneVariants } from "../nodes/zone-variants";
import { measureProbe, type ProbeSpec } from "./measure-probe";

/**
 * The zone header's classes, shared by `ZoneNode` (which renders them) and
 * `zoneHeaderMinWidth` (which measures a probe of the same header for ELK and auto-fit).
 */
export const ZONE_HEADER_CLASS = {
  band: "flex h-11 shrink-0 items-center gap-2 ps-1 pe-2",
  /**
   * DG-20 — the corner label chip: mark, title, subtitle and owner word on one raised
   * `bg-card` chip set over the zone's top-left corner (`-mt-1.5`: it rises 5 px above the
   * line). Not a full straddle: ELK routes edges 10 px off a zone (`spacing.edgeNode`
   * default) and does not know about the chip, so a 14 px rise sat on passing lines
   * (findings §2). Width priority: the owner
   * word never shrinks (it is the owner's greyscale channel), the subtitle gives way first
   * (`shrink-[100]`), the title truncates last. `me-auto` pushes the count and toggle to the
   * end (no spacer element: it would add a second band gap the probe must mirror).
   */
  chip: "-mt-1.5 me-auto flex min-w-0 items-center gap-2 self-start rounded-md border border-border bg-card px-1.5 py-1 shadow-xs",
  title: "min-w-0 truncate text-caption font-medium",
  subtitle: "min-w-0 shrink-[100] truncate text-meta text-muted-foreground",
  owner: "shrink-0 px-1.5 py-0 text-meta uppercase",
  count: "flex shrink-0 items-center gap-1 text-meta tabular-nums text-muted-foreground",
} as const;

/**
 * Wave-2 review M5: the widest a header minimum may ask for, in flow px. A zone title longer
 * than this still truncates (the full title stays in the node's `title` attribute and its
 * accessible name) rather than stretching the whole diagram.
 */
export const ZONE_HEADER_MAX_WIDTH = 460;

/**
 * Sub-pixel rounding between the probe and the live header (text widths are fractional and
 * the zone's own box is rounded by React Flow): 4 px keeps the title from truncating by a
 * hair at exactly the minimum width.
 */
const FLEX_SLACK = 4;

/** What decides a header's content: the owner word shows where ownership changes. */
export interface ZoneHeaderContent {
  data: ZoneData;
  showOwner: boolean;
  collapsed: boolean;
  /** The collapsed chip's visible child count. */
  count?: number;
}

/** A 16 px mark (provider logo or kind glyph) and a 12 px count glyph, as boxes. */
const MARK: ProbeSpec = { className: "block size-4 shrink-0" };
const COUNT_GLYPH: ProbeSpec = { className: "block size-3 shrink-0" };

/**
 * The width a zone header needs to show every part untruncated — mark, title, subtitle
 * (expanded only), owner badge, count (collapsed only) and the collapse toggle, with the
 * band's `px-3` and `gap-2` and the zone's border — measured on an offscreen copy of the header
 * (`measure-probe.ts`), clamped to `[ZONE_MIN_WIDTH, ZONE_HEADER_MAX_WIDTH]`. Without a DOM
 * (tests) it is `ZONE_MIN_WIDTH`, the old flat minimum.
 */
export function zoneHeaderMinWidth({ data, showOwner, collapsed, count }: ZoneHeaderContent) {
  const subtitle = !collapsed && data.subtitle ? data.subtitle : undefined;
  const owner = showOwner ? data.owner : undefined;
  // DG-20: the corner label chip holds mark, title, subtitle and owner word; the band holds
  // the chip, the count (collapsed only) and the toggle — the live header's structure.
  const chipParts: ProbeSpec[] = [MARK];
  // A trust boundary that names a provider shows the provider mark AND the Shield.
  if (data.provider && data.kind === "trust-boundary") chipParts.push(MARK);
  chipParts.push({
    className: cn(ZONE_HEADER_CLASS.title, "overflow-visible"),
    children: [data.title],
  });
  if (subtitle) {
    chipParts.push({
      className: cn(ZONE_HEADER_CLASS.subtitle, "overflow-visible"),
      children: [subtitle],
    });
  }
  if (owner) {
    chipParts.push({
      className: cn(badgeVariants({ variant: "outline" }), ZONE_HEADER_CLASS.owner),
      children: [OWNER_LABEL[owner]],
    });
  }
  const parts: ProbeSpec[] = [{ className: ZONE_HEADER_CLASS.chip, children: chipParts }];
  if (collapsed) {
    parts.push({ className: ZONE_HEADER_CLASS.count, children: [COUNT_GLYPH, String(count ?? 0)] });
  }
  parts.push({ className: cn(buttonVariants({ variant: "ghost", size: "icon-sm" }), "shrink-0") });
  const band: ProbeSpec = { className: ZONE_HEADER_CLASS.band, children: parts };
  // Inside the zone's own frame: its border (1 px a side, 2 for a trust boundary) is part of
  // the width.
  const frame: ProbeSpec = {
    className: cn("flex", zoneVariants({ owner: data.owner, kind: data.kind })),
    children: [band],
  };
  const key = JSON.stringify([
    data.title,
    subtitle,
    owner,
    data.kind,
    Boolean(data.provider),
    collapsed,
    count,
  ]);
  const width = measureProbe(`zone-header:${key}`, frame)?.width ?? 0;
  return Math.min(ZONE_HEADER_MAX_WIDTH, Math.max(ZONE_MIN_WIDTH, Math.ceil(width) + FLEX_SLACK));
}

/** Whether `zone`'s header shows its owner word: top level, or its owner differs from its parent zone's. */
export function showsOwner(zone: Node, byId: ReadonlyMap<string, Node>): boolean {
  if (!isZoneNode(zone)) return false;
  const parent = zone.parentId === undefined ? undefined : byId.get(zone.parentId);
  return !(parent && isZoneNode(parent) && parent.data.owner === zone.data.owner);
}
