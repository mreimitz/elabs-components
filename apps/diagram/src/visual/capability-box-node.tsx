import type { NodeProps } from "@elabs-ai/components-flow";
import { HoverCard, HoverCardContent, HoverCardTrigger, cn } from "@elabs-ai/components-ui";
import { Network } from "lucide-react";
import { ArchMark } from "../nodes/arch-mark";
import { OWNER_LABEL } from "../nodes/zone-data";
import { zoneVariants } from "../nodes/zone-variants";
import { lensActions } from "../shell/lens-store";
import type { CapabilityBoxNodeType } from "./visual-node-data";

/** The box's strings, in one place (`conventions/i18n-strings`). */
const BOX_LABELS = {
  contains: (titles: string[]) => `Contains: ${titles.join(", ")}`,
  drillHint: "Option/Alt-click: show in the technical view",
  aside: "Network & Access",
};

/**
 * A capability box (`docs/2026-09-27-visual-lens-concept.md` §3 rule 2/6): one or more
 * technical nodes grouped by lane, kind and parent zone. Owner colouring reuses the
 * technical lens's own zone/owner tokens (`zoneVariants`, conventions "existing zone/owner
 * tokens") — no new colour, no hero (S1/S3). Never interactive as a canvas element (no
 * handles, not draggable, not connectable, not selectable): the one thing it does is the
 * orientation gesture the maintainer asked for — hover/focus names its members, and an
 * Option/Alt-click (or Enter/Space held with Alt) switches to the technical lens framed on
 * them (`docs/2026-09-27-visual-lens-concept.md` §5).
 */
export function CapabilityBoxNode({ data }: NodeProps<CapabilityBoxNodeType>) {
  const owner = data.owner === "unowned" ? "customer" : data.owner;
  const titles = data.members.map((m) => m.title);
  const label = data.aside
    ? `${data.title} — ${BOX_LABELS.contains(titles)}`
    : `${data.title}${titles.length > 1 || titles[0] !== data.title ? ` — ${BOX_LABELS.contains(titles)}` : ""}`;

  return (
    <HoverCard openDelay={150}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          aria-label={`${label}. ${BOX_LABELS.drillHint}`}
          data-slot={data.aside ? "capability-box-aside" : "capability-box"}
          onClick={(event) => {
            if (!event.altKey) return;
            lensActions.setLens("technical", { frameNodeIds: data.members.map((m) => m.id) });
          }}
          className={cn(
            "focus-ring flex h-full w-full flex-col gap-2 p-3 text-start shadow-xs",
            zoneVariants({ owner, kind: "generic", fill: data.aside ? "muted" : "raised" }),
          )}
        >
          <span
            data-slot="capability-box-title"
            className="text-caption flex items-center gap-1.5 truncate font-medium"
          >
            {data.aside ? <Network aria-hidden="true" className="size-3.5 shrink-0" /> : null}
            <span className="truncate">{data.title}</span>
          </span>
          <span aria-hidden="true" className="flex flex-wrap items-center gap-2">
            {data.members.map((member) => (
              <ArchMark key={member.id} icon={member.icon} size={18} variant="mono" />
            ))}
          </span>
        </button>
      </HoverCardTrigger>
      <HoverCardContent aria-hidden="true" className="w-64 text-caption">
        <p className="font-medium">{data.title}</p>
        <p className="text-muted-foreground">{BOX_LABELS.contains(titles)}</p>
        <p className="text-meta text-muted-foreground mt-1">{OWNER_LABEL[owner]}</p>
      </HoverCardContent>
    </HoverCard>
  );
}
