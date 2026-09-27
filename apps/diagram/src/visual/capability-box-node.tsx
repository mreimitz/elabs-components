import { Handle, Position, type NodeProps } from "@elabs-ai/components-flow";
import { HoverCard, HoverCardContent, HoverCardTrigger, cn } from "@elabs-ai/components-ui";
import { Network } from "lucide-react";
import { ArchMark } from "../nodes/arch-mark";
import { OWNER_LABEL, type ZoneOwner } from "../nodes/zone-data";
import { zoneBodyVariants, zoneFill, zoneVariants } from "../nodes/zone-variants";
import { lensActions } from "../shell/lens-store";
import type { CapabilityBoxNodeType } from "./visual-node-data";

/** The box's strings, in one place (`conventions/i18n-strings`). */
const BOX_LABELS = {
  contains: (titles: string[]) => `Contains: ${titles.join(", ")}`,
  drillHint: "Option/Alt-click: show in the technical view",
  aside: "Network & Access",
};

/**
 * maintainer 2026-09-27 (review round, F8/F10): a box outside every zone (a bare SaaS/actor
 * node, e.g. Salesforce or Okta) is not "Customer managed" — mapping it there was the bug.
 * It borrows `hosted`'s canvas fill + dotted strong border (a real second channel, not a new
 * colour) but never claims the word "Hosted": `ownerLabel` below renders no owner line for it
 * at all, exactly the review's "render no owner line for unowned".
 */
const UNOWNED_STYLE_AS: ZoneOwner = "hosted";

/**
 * A capability box (`docs/2026-09-27-visual-lens-concept.md` §3 rule 2/6): one or more
 * technical nodes grouped by lane, kind and parent zone. Owner colouring reuses the
 * technical lens's own zone/owner tokens (`zoneVariants`/`zoneBodyVariants`, conventions
 * "existing zone/owner tokens") — no new colour, no hero (S1/S3): customer sits on the muted
 * fill rung, SaaS on the raised rung under its hairline hatch (a texture, not a colour — the
 * second channel WCAG 1.4.1 asks for), hosted and partner stay on the canvas rung under their
 * own dotted/dashed strong border (`zoneVariants`'s own owner axis already carries that).
 * Never interactive as a canvas element (no handles, not draggable, not connectable, not
 * selectable): the one thing it does is the orientation gesture the maintainer asked for —
 * hover/focus names its members, and an Option/Alt-click (or Enter/Space held with Alt)
 * switches to the technical lens framed on them (`docs/2026-09-27-visual-lens-concept.md` §5).
 */
export function CapabilityBoxNode({ data }: NodeProps<CapabilityBoxNodeType>) {
  const owner = data.owner === "unowned" ? UNOWNED_STYLE_AS : data.owner;
  const fill = data.aside ? "muted" : zoneFill(0, owner).fill;
  const ownerLabel = data.owner === "unowned" ? null : OWNER_LABEL[data.owner];
  const titles = data.members.map((m) => m.title);
  const contains = BOX_LABELS.contains(titles);
  const label = data.aside
    ? `${data.title} — ${contains}`
    : `${data.title}${titles.length > 1 || titles[0] !== data.title ? ` — ${contains}` : ""}`;
  const accessibleName = ownerLabel ? `${label}. ${ownerLabel}.` : label;

  // React Flow's own edge-position lookup needs a handle on both ends to place an edge at
  // all (its internal `getEdgePosition`, xyflow error #008) even though `VisualFlowEdge`
  // ignores that lookup entirely and draws from a precomputed rect (`build-visual-graph.ts`):
  // without these, every flow into or out of this box silently fails to render. Zero-size and
  // `isConnectable={false}` — belt and braces beside the canvas-wide `nodesConnectable={false}`
  // (`visual-canvas-pane.tsx`) — because this box has no ports to offer, only a border a
  // precomputed line touches.
  const noHandle = "!h-0 !w-0 !min-w-0 !border-0 !bg-transparent opacity-0";
  return (
    <HoverCard openDelay={150}>
      <Handle type="target" position={Position.Left} isConnectable={false} className={noHandle} />
      <Handle type="source" position={Position.Right} isConnectable={false} className={noHandle} />
      <HoverCardTrigger asChild>
        <button
          type="button"
          aria-label={`${accessibleName} ${BOX_LABELS.drillHint}`}
          // maintainer 2026-09-27 (review round, F26): one `data-slot` name for the component;
          // "aside or not" is state, so it is its own `data-aside` attribute (`conventions.md`
          // `data-slot` rule — a slot name does not vary by state).
          data-slot="capability-box"
          data-aside={data.aside || undefined}
          onClick={(event) => {
            if (!event.altKey) return;
            lensActions.setLens("technical", { frameNodeIds: data.members.map((m) => m.id) });
          }}
          className={cn(
            // maintainer 2026-09-27 (review round, F11): `zoneVariants` FIRST — its own base
            // class is `shadow-none` (a zone is a region, not a raised card), so it must lose
            // to this button's own resting `shadow-xs` (a box IS a raised card) when `cn()`
            // (tailwind-merge) resolves the conflict by keeping whichever comes LAST.
            zoneVariants({ owner, kind: "generic", fill, capped: data.aside }),
            zoneBodyVariants({ owner }),
            // maintainer 2026-09-27 (review round, F4): the node is deliberately not
            // selectable/draggable/connectable, so React Flow's own node wrapper
            // (`.react-flow__node`) sets itself `pointer-events: none` — with no ancestor
            // opting back in, a mouse could never hover or click this button at all (only
            // keyboard focus reached it, since focus does not need pointer events). This is
            // the one opt-in: the button, not the wrapper, so drag/connect/select stay off.
            "focus-ring pointer-events-auto flex h-full w-full flex-col gap-2 p-3 text-start shadow-xs",
          )}
        >
          <span
            data-slot="capability-box-title"
            className="text-caption flex min-w-0 items-center gap-1.5 truncate font-medium"
          >
            {data.aside ? <Network aria-hidden="true" className="size-3.5 shrink-0" /> : null}
            <span className="min-w-0 truncate">{data.title}</span>
          </span>
          {/* maintainer 2026-09-27 (review round, F12): one row per member — `lane-layout.ts`
              already reserves `BOX_MEMBER_ROW_HEIGHT` per member; a single wrapped row of
              icons left the box half-empty and the members unnamed without a hover. */}
          <span aria-hidden="true" className="flex min-h-0 flex-1 flex-col gap-1 overflow-hidden">
            {data.members.map((member) => (
              <span key={member.id} className="flex min-w-0 items-center gap-1.5">
                <ArchMark icon={member.icon} size={16} variant="mono" className="shrink-0" />
                <span className="text-meta min-w-0 truncate">{member.title}</span>
              </span>
            ))}
          </span>
        </button>
      </HoverCardTrigger>
      <HoverCardContent aria-hidden="true" className="w-64 text-caption">
        <p className="font-medium">{data.title}</p>
        <p className="text-muted-foreground">{contains}</p>
        {ownerLabel ? <p className="text-meta text-muted-foreground mt-1">{ownerLabel}</p> : null}
      </HoverCardContent>
    </HoverCard>
  );
}
