import { useId, useRef } from "react";
import type { Node } from "@elabs-ai/components-flow";
import {
  Badge,
  Button,
  Heading,
  Popover,
  PopoverAnchor,
  PopoverContent,
  Text,
} from "@elabs-ai/components-ui";
import { ExternalLink } from "lucide-react";
import { ArchMark } from "../nodes/arch-mark";
import {
  ARCH_KIND_DEFAULT_ICON,
  ARCH_KIND_LABEL,
  ARCH_NODE_TYPE,
  type ArchMarkedKind,
  type ArchNodeData,
} from "../nodes/arch-node-data";
import { focusCanvasElement } from "../panes/focus-canvas";
import { interactionActions, useInteraction, type InteractionState } from "./interaction-store";

/** The card's strings, in one place (`conventions/i18n-strings`). */
const CARD_LABELS = {
  open: "Open",
  newTab: "(opens in a new tab)",
} as const;

/** Every kind but `note` (a note shows its whole text on the canvas). */
const MARKED_KINDS = Object.keys(ARCH_KIND_LABEL) as ArchMarkedKind[];

/** The node's kind when it is one the card describes; zones and notes have no card. */
export function detailKind(node: Node): ArchMarkedKind | undefined {
  return MARKED_KINDS.find((kind) => ARCH_NODE_TYPE[kind] === node.type);
}

/** `href` only when it is an absolute http(s) URL: the text is untrusted (a shared link). */
function safeHref(href: unknown): string | undefined {
  if (typeof href !== "string") return undefined;
  try {
    const url = new URL(href);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : undefined;
  } catch {
    return undefined;
  }
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
 * DG-18 — a node's details (plan D9: `description`, `href`, badges) beside the node.
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
  const kind = node ? detailKind(node) : undefined;
  const data = node?.data as ArchNodeData | undefined;
  const href = safeHref(data?.href);

  return (
    <Popover
      open={Boolean(node && kind)}
      onOpenChange={(open) => {
        if (!open) interactionActions.closeCard();
      }}
    >
      <PopoverAnchor virtualRef={anchor} />
      {node && kind && data ? (
        <PopoverContent
          ref={content}
          side="right"
          align="start"
          collisionPadding={8}
          updatePositionStrategy="always"
          aria-labelledby={titleId}
          data-slot="details-card"
          data-diagram-export="exclude"
          className="flex flex-col gap-2"
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
          <div className="flex items-start gap-3">
            <ArchMark icon={data.icon ?? ARCH_KIND_DEFAULT_ICON[kind]} size={24} />
            <div className="flex min-w-0 flex-col">
              <Text variant="eyebrow" tone="muted" as="span">
                {ARCH_KIND_LABEL[kind]}
              </Text>
              <Heading level={2} size="subtitle" id={titleId} className="break-words">
                {data.title}
              </Heading>
              {data.subtitle ? (
                <Text variant="meta" tone="muted" as="span">
                  {data.subtitle}
                </Text>
              ) : null}
            </div>
          </div>
          {data.description ? <Text className="break-words">{data.description}</Text> : null}
          {data.badges?.length ? (
            <div className="flex flex-wrap gap-1">
              {data.badges.map((badge) => (
                <Badge key={badge} variant="outline">
                  {badge}
                </Badge>
              ))}
            </div>
          ) : null}
          {href ? (
            <Button asChild variant="link" size="sm" className="self-start px-0">
              <a href={href} target="_blank" rel="noopener noreferrer">
                <ExternalLink aria-hidden="true" />
                {CARD_LABELS.open}
                <span className="sr-only">{CARD_LABELS.newTab}</span>
              </a>
            </Button>
          ) : null}
        </PopoverContent>
      ) : null}
    </Popover>
  );
}
