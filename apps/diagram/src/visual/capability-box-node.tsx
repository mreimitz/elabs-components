import { Handle, Position, type NodeProps } from "@elabs-ai/components-flow";
import { HoverCard, HoverCardContent, HoverCardTrigger, Badge, cn } from "@elabs-ai/components-ui";
import { useDiagramStyle } from "../style/react-style";
import { useState } from "react";
import { createPortal } from "react-dom";
import { Network } from "lucide-react";
import { ArchMark } from "../nodes/arch-mark";
import { OWNER_LABEL, type ZoneOwner } from "../nodes/zone-data";
import { zoneBodyVariants, zoneFill, zoneVariants } from "../nodes/zone-variants";
import { lensActions, useLens } from "../shell/lens-store";
import type { CapabilityBoxNodeType } from "./visual-node-data";

/** The box's strings, in one place (`conventions/i18n-strings`). */
const BOX_LABELS = {
  contains: (titles: string[]) => `Contains: ${titles.join(", ")}`,
  drillHint: "Option/Alt-click or Alt+Enter: show in the technical view",
  aside: "Network & Access",
  /** A box outside every zone (a bare SaaS/actor node, e.g. Salesforce or Okta) is not
   * "Customer managed" — mapping it there was the bug this word replaces. It borrows `hosted`'s
   * canvas fill and dotted strong border, so it needs its OWN word rather than none at all: a
   * sighted user cannot tell it from a real hosted box by the border alone (both dotted), and a
   * screen reader must not say "Hosted" for a box that is not, nor stay silent where a hosted
   * box would speak. */
  unowned: "Owner not set",
};

const UNOWNED_STYLE_AS: ZoneOwner = "hosted";

/** Read-only capability list; Alt-activation frames its members in the technical lens. */
export function CapabilityBoxNode({ data }: NodeProps<CapabilityBoxNodeType>) {
  const { visual: profile, hero } = useDiagramStyle();
  const fixed = !profile.ground.followTheme;
  const paint =
    profile.roles[hero && data.provider === hero ? "hero" : data.aside ? "generic" : "other"];
  const [hoverOpen, setHoverOpen] = useState(false);
  const settled = useLens((s) => s.position === 1 && s.target === "visual" && !s.animating);
  const owner = data.owner === "unowned" ? UNOWNED_STYLE_AS : data.owner;
  // A box sits INSIDE its lane panel, which is itself `bg-surface-muted` (`lane-panel-node.tsx`)
  // — `zoneFill(0, owner)` treated the box as if it sat directly on `--canvas`, the same root a
  // top-level ZONE nests into, so a customer box (whose root rung is "muted") landed on the
  // exact same fill as its lane. Depth 1, not 0, prices the lane panel itself in as the implicit
  // root the box nests one level below.
  const { fill: ownedFill } = zoneFill(1, owner);
  const fill = data.aside ? "muted" : ownedFill;
  // Measured against both themes' actual token values, no fill rung this box can land on
  // separates it from its `bg-surface-muted` lane at 3:1 — `bg-card` (the "raised" rung a
  // customer box reaches) is only 1.10–1.12:1 against `bg-surface-muted`, no better than the
  // muted rung itself. A capability box, unlike a general nested zone, is always a leaf sitting
  // directly on that one lane fill, so its border is always the real separating cue, never the
  // fill: always ask `zoneVariants` for its `capped` (border-strong) treatment, regardless of
  // what `zoneFill` reports. (`--border-strong` itself still measures 2.88:1 against
  // `bg-surface-muted` in both themes, short of 3:1 — a token-ladder gap in `packages/tokens`
  // this app-level component cannot close; the extra border weight below is the mitigation
  // available from here.)
  const capped = true;
  const ownerLabel = data.owner === "unowned" ? BOX_LABELS.unowned : OWNER_LABEL[data.owner];
  const titles = data.members.map((m) => m.title);
  const contains = BOX_LABELS.contains(titles);
  // A single-member box whose title IS that member's title (derive-visual's rule 2: a group of
  // exactly one node keeps its own title) would otherwise print that title twice — once in the
  // header, once again as the lone row in the member list below. The header carries the
  // member's own icon instead, and the (otherwise identical) member-list row is skipped.
  const onlyMember = data.members.length === 1 ? data.members[0] : undefined;
  const soleMember =
    !data.aside && onlyMember !== undefined && onlyMember.title === data.title ? onlyMember : null;
  const label = data.aside
    ? `${data.title} — ${contains}`
    : `${data.title}${titles.length > 1 || titles[0] !== data.title ? ` — ${contains}` : ""}`;
  // The lane joins the name — a screen-reader user has no other way to tell a box's lane, since
  // lane panels are not tab stops (`visual-canvas-pane.tsx`).
  const accessibleName = `${label}${ownerLabel ? `. ${ownerLabel}` : ""}. ${data.laneTitle}.${data.processes?.length ? ` Processes: ${data.processes.join(", ")}.` : ""}`;

  // React Flow's own edge-position lookup needs a handle on both ends to place an edge at
  // all (its internal `getEdgePosition`, xyflow error #008) even though `VisualFlowEdge`
  // ignores that lookup entirely and draws from a precomputed rect (`build-visual-graph.ts`):
  // without these, every flow into or out of this box silently fails to render. Zero-size and
  // `isConnectable={false}` — belt and braces beside the canvas-wide `nodesConnectable={false}`
  // (`visual-canvas-pane.tsx`) — because this box has no ports to offer, only a border a
  // precomputed line touches.
  const noHandle = "!h-0 !w-0 !min-w-0 !border-0 !bg-transparent opacity-0";
  return (
    <HoverCard
      openDelay={150}
      closeDelay={100}
      open={settled && hoverOpen}
      onOpenChange={setHoverOpen}
    >
      <Handle type="target" position={Position.Left} isConnectable={false} className={noHandle} />
      <Handle type="source" position={Position.Right} isConnectable={false} className={noHandle} />
      <HoverCardTrigger asChild>
        <button
          type="button"
          aria-label={accessibleName}
          aria-description={BOX_LABELS.drillHint}
          aria-keyshortcuts="Alt+Enter Alt+Space"
          onKeyDown={(event) => {
            if (event.altKey && (event.key === "Enter" || event.key === " ")) {
              event.preventDefault();
              lensActions.setLens("technical", { frameNodeIds: data.members.map((m) => m.id) });
            }
          }}
          // One `data-slot` name for the component; "aside or not" is state, so it is its own
          // `data-aside` attribute (`conventions.md` `data-slot` rule — a slot name does not
          // vary by state).
          data-slot="capability-box"
          data-aside={data.aside || undefined}
          data-profile={profile.profile}
          data-hero={fixed && hero && data.provider === hero ? true : undefined}
          style={
            fixed
              ? {
                  backgroundColor: paint.fill,
                  backgroundImage: "none",
                  color: paint.text,
                  borderColor: paint.stroke,
                  borderStyle: "solid",
                }
              : undefined
          }
          onClick={(event) => {
            if (!event.altKey) return;
            lensActions.setLens("technical", { frameNodeIds: data.members.map((m) => m.id) });
          }}
          className={cn(
            // `zoneVariants` FIRST — its own base class is `shadow-none` (a zone is a region,
            // not a raised card), so it must lose to this button's own resting `shadow-xs` (a
            // box IS a raised card) when `cn()` (tailwind-merge) resolves the conflict by
            // keeping whichever comes LAST.
            !fixed && zoneVariants({ owner, kind: "generic", fill, capped }),
            !fixed && zoneBodyVariants({ owner }),
            // The node is deliberately not selectable/draggable/connectable, so React Flow's
            // own node wrapper (`.react-flow__node`) sets itself `pointer-events: none` — with
            // no ancestor opting back in, a mouse could never hover or click this button at all
            // (only keyboard focus reached it, since focus does not need pointer events). This
            // is the one opt-in: the button, not the wrapper, so drag/connect/select stay off.
            // `border-2`: `capped` above is always true for this component, so this box's
            // border-strong line is always the one thing separating it from its lane — a
            // hairline reads visibly fainter than its own token colour at that weight (the same
            // problem `zoneVariants`'s `trust-boundary` kind solves with `border-2` for the
            // same reason).
            "border-muted-foreground focus-ring pointer-events-auto flex h-full w-full flex-col gap-2 border-2 p-3 text-start shadow-xs",
          )}
        >
          <span
            data-slot="capability-box-title"
            data-member-id={soleMember?.id}
            style={
              fixed
                ? {
                    fontWeight: profile.boxes.title.weight,
                    justifyContent: profile.boxes.title.align === "center" ? "center" : "start",
                    width: "100%",
                  }
                : undefined
            }
            className="text-caption flex min-w-0 items-center gap-1.5 truncate font-medium"
          >
            {data.aside ? <Network aria-hidden="true" className="size-3.5 shrink-0" /> : null}
            {soleMember ? (
              // `data-member-id`: the morph overlay's ghost for this member flies to THIS row
              // (`lens-morph-overlay.tsx`'s `capturePlan`), not a synthetic estimate — a sole
              // member is named in the header, not the list below, so its row is here. A plain
              // `<span>`, not `display: contents` — the overlay reads its real, laid-out rect,
              // which a contents box never has (it generates none of its own).
              <span className="shrink-0">
                <ArchMark
                  icon={soleMember.icon}
                  size={14}
                  variant={fixed ? profile.boxes.items.icon : "mono"}
                />
              </span>
            ) : null}
            <span className="min-w-0 truncate">{data.title}</span>
          </span>
          {profile.pills.enabled && data.processes?.length ? (
            <span data-slot="visual-processes" className="grid grid-cols-2 gap-1">
              {data.processes.map((process) => (
                <Badge
                  key={process}
                  variant="outline"
                  className="justify-center truncate"
                  style={
                    fixed
                      ? {
                          backgroundColor: profile.pills.fill,
                          color: profile.pills.text,
                          borderColor: "transparent",
                        }
                      : undefined
                  }
                >
                  {process}
                </Badge>
              ))}
            </span>
          ) : null}
          {data.owner === "unowned" ? (
            <span className={cn("text-meta", !fixed && "text-muted-foreground")}>
              {BOX_LABELS.unowned}
            </span>
          ) : null}
          {/* One row per member — `lane-layout.ts` reserves `BOX_MEMBER_ROW_HEIGHT` per member
              so each is named without a hover, not folded into a single wrapped row of icons.
              A `soleMember` box already named and iconed itself in the header above; the list
              would only repeat it. */}
          {soleMember ? null : (
            <span aria-hidden="true" className="flex min-h-0 flex-1 flex-col gap-1 overflow-hidden">
              {data.members.map((member) => (
                // `data-member-id`: see the header's own note above — the morph overlay reads
                // this row's real, on-screen rect as the member ghost's landing spot.
                <span
                  key={member.id}
                  data-member-id={member.id}
                  style={
                    fixed && data.sub?.includes(member.id)
                      ? {
                          borderColor: profile.roles.sub.stroke,
                          color: profile.roles.sub.text,
                          backgroundColor:
                            profile.roles.sub.fill === "none"
                              ? "transparent"
                              : profile.roles.sub.fill,
                        }
                      : undefined
                  }
                  className={cn(
                    "flex min-w-0 items-center gap-1.5",
                    data.sub?.includes(member.id) && "rounded-sm border border-current px-1",
                  )}
                >
                  {fixed && profile.boxes.items.bullet === "ring" ? (
                    <span
                      aria-hidden="true"
                      className="size-1.5 shrink-0 rounded-full border border-current"
                    />
                  ) : null}
                  <ArchMark
                    icon={member.icon}
                    size={16}
                    variant={fixed ? profile.boxes.items.icon : "mono"}
                    className="shrink-0"
                  />
                  <span className="text-meta min-w-0 truncate">{member.title}</span>
                </span>
              ))}
            </span>
          )}
        </button>
      </HoverCardTrigger>
      {createPortal(
        <div className="pointer-events-none">
          <HoverCardContent
            aria-hidden="true"
            collisionPadding={12}
            className="pointer-events-none w-64 text-caption"
          >
            <p className="font-medium">{data.title}</p>
            <p className="text-muted-foreground">{contains}</p>
            {ownerLabel ? (
              <p className="text-meta text-muted-foreground mt-1">{ownerLabel}</p>
            ) : null}
          </HoverCardContent>
        </div>,
        document.body,
      )}
    </HoverCard>
  );
}
