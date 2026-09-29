import { CAN_NAVIGATE_CATALOG } from "../viewer/capabilities";
import { useId, useLayoutEffect, useRef, useState } from "react";
import type { Node } from "@elabs-ai/components-flow";
import {
  Badge,
  Button,
  Heading,
  Popover,
  PopoverAnchor,
  PopoverContent,
  Text,
  StatusBadge,
  cn,
  type CustomStatus,
} from "@elabs-ai/components-ui";
import { CircleCheck, CircleDashed, CircleX, ExternalLink, TriangleAlert } from "lucide-react";
import { ArchMark } from "../nodes/arch-mark";
import type { ArchNodeStatus } from "../nodes/arch-node-data";
import { useCatalogEntry } from "../catalog/catalog-service";
import { ComponentPreview } from "./component-preview";
import { openDoc } from "../shell/mode-store";
import { toHash } from "../routes/use-hash";
import { catalogNameOfNode, resolveNodeDetails, type NodeDetails } from "./node-details";
import { focusCanvasElement } from "../panes/focus-canvas";
import { interactionActions, useInteraction, type InteractionState } from "./interaction-store";

/** The card's strings, in one place (`conventions/i18n-strings`). */
const CARD_LABELS = {
  docs: "Open docs",
  catalog: "View in catalog",
  diagram: "Open diagram",
  unverified: "Link not checked yet",
  more: "More",
  less: "Less",
  newTab: "(opens in a new tab)",
} as const;

const STATUS_BADGE: Record<ArchNodeStatus, CustomStatus> = {
  ok: { label: "Healthy", tone: "success", icon: CircleCheck },
  degraded: { label: "Degraded", tone: "warning", icon: TriangleAlert },
  down: { label: "Down", tone: "destructive", icon: CircleX },
  planned: { label: "Planned", tone: "neutral", icon: CircleDashed },
};

function CardDescription({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const [long, setLong] = useState(false);
  const body = useRef<HTMLParagraphElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const id = useId();
  useLayoutEffect(() => {
    const element = body.current;
    if (!element) return;
    const measure = () => {
      const lineHeight = Number.parseFloat(getComputedStyle(element).lineHeight);
      const overflowing = element.scrollHeight > lineHeight * 3 + 1;
      // A live catalog update may remove More while it owns keyboard focus.
      if (!overflowing && document.activeElement === toggle.current) {
        element.focus({ preventScroll: true });
      }
      setLong(overflowing);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [text]);
  return (
    <div className="flex flex-col items-start gap-1" data-slot="details-card-description">
      <Text
        ref={body}
        tabIndex={-1}
        id={id}
        className={cn("break-words whitespace-pre-line focus-ring", !expanded && "line-clamp-3")}
      >
        {text}
      </Text>
      {long ? (
        <Button
          ref={toggle}
          variant="link"
          size="sm"
          className="px-0"
          aria-expanded={expanded}
          aria-controls={id}
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? CARD_LABELS.less : CARD_LABELS.more}
        </Button>
      ) : null}
    </div>
  );
}

export function CardBody({ details, titleId }: { details: NodeDetails; titleId: string }) {
  return (
    <>
      <div className="flex items-start gap-3">
        <ArchMark icon={details.icon} size={24} />
        <div className="flex min-w-0 flex-col">
          <Text variant="eyebrow" tone="muted" as="span">
            {details.eyebrow}
          </Text>
          <Heading level={2} size="subtitle" id={titleId} className="break-words">
            {details.name}
          </Heading>
          {details.product || details.subtitle ? (
            <Text variant="meta" tone="muted" as="span" className="break-words">
              {details.product ?? details.subtitle}
            </Text>
          ) : null}
        </div>
      </div>
      {details.description ? <CardDescription text={details.description} /> : null}
      {details.componentPath ? (
        <ComponentPreview
          key={details.componentPath}
          path={details.componentPath}
          title={details.name}
        />
      ) : null}
      {details.status ? (
        <StatusBadge status={STATUS_BADGE[details.status]} size="sm" className="self-start" />
      ) : null}
      {details.badges.length ? (
        <div className="flex flex-wrap gap-1">
          {details.badges.map((badge) => (
            <Badge key={badge} variant="outline">
              {badge}
            </Badge>
          ))}
        </div>
      ) : null}
      {details.docs ? (
        <div className="flex flex-col items-start">
          <Button asChild variant="link" size="sm" className="px-0">
            <a href={details.docs} target="_blank" rel="noopener noreferrer">
              <ExternalLink aria-hidden="true" />
              {CARD_LABELS.docs}
              <span className="sr-only">{CARD_LABELS.newTab}</span>
            </a>
          </Button>
          {details.docsUnverified ? (
            <Text variant="meta" tone="muted">
              {CARD_LABELS.unverified}
            </Text>
          ) : null}
        </div>
      ) : null}
      {details.catalog && CAN_NAVIGATE_CATALOG ? (
        <Button asChild variant="link" size="sm" className="self-start px-0">
          <a href={toHash({ kind: "catalog", ...details.catalog })}>{CARD_LABELS.catalog}</a>
        </Button>
      ) : null}
      {details.componentPath ? (
        <Button asChild variant="link" size="sm" className="self-start px-0">
          <a
            href={toHash({ kind: "doc", path: details.componentPath })}
            onClick={(event) => {
              if (!event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
                event.preventDefault();
                openDoc(details.componentPath!, { mode: "view" });
              }
            }}
          >
            {CARD_LABELS.diagram}
          </a>
        </Button>
      ) : null}
    </>
  );
}

function nodeRect(id: string | undefined): DOMRect {
  const element =
    id === undefined
      ? null
      : document.querySelector(`.react-flow__node[data-id="${CSS.escape(id)}"]`);
  return element?.getBoundingClientRect() ?? new DOMRect();
}

export interface DetailsCardProps {
  /** The canvas's nodes (DiagramCanvas's state). */
  nodes: readonly Node[];
}

/**
 * A node's live details beside the node, with node overrides ahead of catalog metadata.
 * A ui `Popover`, not `HoverCard`: HoverCard opens on its trigger's pointer and focus only
 * and has no anchor part, and the card must open from the canvas's own hover (React Flow
 * `onNodeMouseEnter`) and from `?` on a focused node. The anchor is virtual — the node's
 * live box — and `updatePositionStrategy="always"` keeps the card on the node while the
 * canvas pans or zooms. Portaled out of the canvas, so the export never contains it.
 * P4: library gap — ui `HoverCard` has no anchor part and no portal; flow has no node details
 * card. docs/findings/DG-18-interactive-layer.md §1.
 */
export function DetailsCard({ nodes }: DetailsCardProps) {
  const card = useInteraction((s) => s.card);
  const titleId = useId();
  // The card being closed: `onCloseAutoFocus` runs after the store already says `null`.
  const shown = useRef<InteractionState["card"]>(null);
  if (card) shown.current = card;
  const anchor = useRef({ getBoundingClientRect: () => nodeRect(shown.current?.id) });
  const content = useRef<HTMLDivElement>(null);

  const node = card ? nodes.find((n) => n.id === card.id && !n.hidden) : undefined;
  const entry = useCatalogEntry(catalogNameOfNode(node));
  const iconEntry = useCatalogEntry(entry?.part ? entry.icon : undefined);
  const details = node ? resolveNodeDetails(node, entry, iconEntry) : undefined;

  return (
    <Popover
      open={Boolean(node && details)}
      onOpenChange={(open) => {
        if (!open) interactionActions.closeCard();
      }}
    >
      <PopoverAnchor virtualRef={anchor} />
      {node && details ? (
        <PopoverContent
          ref={content}
          side="right"
          align="start"
          collisionPadding={8}
          updatePositionStrategy="always"
          aria-labelledby={titleId}
          data-slot="details-card"
          data-diagram-export="exclude"
          className="flex max-h-[var(--radix-popover-content-available-height)] w-80 max-w-[min(calc(100vw-1rem),var(--radix-popover-content-available-width))] flex-col gap-2 overflow-y-auto"
          // Mouse events, not pointer events: React Flow's `onNodeMouseLeave` is a mouse event,
          // and a pointer event fires before it — the card would keep itself open, then close.
          onMouseEnter={interactionActions.keepCard}
          onMouseLeave={interactionActions.leave}
          // A pointer card must not take focus from the canvas; a keyboard card does, so Tab
          // reaches its link and Esc closes it.
          onOpenAutoFocus={(event) => {
            if (card?.by !== "keyboard") event.preventDefault();
          }}
          // P4: library gap — no Radix trigger, so Radix would return focus to whatever held
          // it before (or `<body>`). A keyboard card hands focus back to its node, unless the
          // person already moved it elsewhere (Tab out of the card).
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            const closed = shown.current;
            const active = document.activeElement;
            const lost =
              active === null || active === document.body || content.current?.contains(active);
            if (closed?.by === "keyboard" && lost) focusCanvasElement(closed.id);
          }}
        >
          <CardBody key={node.id} details={details} titleId={titleId} />
        </PopoverContent>
      ) : null}
    </Popover>
  );
}
