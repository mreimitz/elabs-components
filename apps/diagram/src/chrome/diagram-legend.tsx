import { useId, useMemo, useState } from "react";
// P4: library gap — flow does not re-export `useNodes`/`useEdges` (only
// `useNodesState`/`useEdgesState`); both are read straight from the engine, which the app
// already depends on directly (verified-apis.md → flow, "Not re-exported by flow").
import { useEdges, useNodes } from "@xyflow/react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { MarkerType, Panel } from "@elabs-ai/components-flow";
import { ServiceLogo } from "@elabs-ai/components-icons";
import {
  Badge,
  Button,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  Text,
  cn,
} from "@elabs-ai/components-ui";
import { buildLegend, type LegendMode } from "./build-legend";
import { CLUSTER_CLASS } from "../edges/edge-label-size";
import type { FlowKind, FlowSecure } from "../edges/data-flow-edge-data";
import {
  KIND_GLYPH,
  KIND_LABEL,
  KIND_STROKE,
  KIND_STROKE_WIDTH,
  MARKER_TYPE,
  SECURE_GLYPH,
  SECURE_WORDS,
  resolveDash,
  resolveLineStyle,
} from "../edges/edge-style";
import { ICON_INDEX } from "../icons/register-packs";
import { OWNER_LABEL } from "../nodes/zone-node";
import { zoneBodyVariants, zoneFill, zoneVariants } from "../nodes/zone-variants";
import type { ZoneOwner } from "../nodes/zone-data";

export interface DiagramLegendProps {
  mode: LegendMode;
  interactive?: boolean;
}

/**
 * The floating-surface look (flow's own `Legend` shape), one rung lighter since DG-20
 * (defect 12): `shadow-ring-xs` and `p-2.5`.
 */
const FLOATING_SURFACE =
  "rounded-lg bg-surface-elevated/90 p-2.5 text-meta shadow-ring-xs backdrop-blur";

/** DG-20: above this many rows the legend starts closed (unless the session kept a choice). */
const MAX_OPEN_ENTRIES = 8;

/** Every fixed UI string in one place (`conventions/i18n-strings`). */
const LABELS = {
  trigger: "Legend",
  owners: "Owners",
  edges: "Edges",
  providers: "Providers",
  numberedStep: "Numbered step",
} as const;

/**
 * `ICON_INDEX`'s label is generated from the vendor pack's own file name (`aws/aws` →
 * "Aws", `k8s/k8s` → "K8s") — right for most vendors, wrong for the two that are
 * initialisms/proper nouns the generator cannot know. `docs/findings/DG-08-legend.md`
 * records this as the index's gap, not this component's.
 */
const PROVIDER_LABEL_OVERRIDE: Record<string, string> = {
  aws: "AWS",
  k8s: "Kubernetes",
};

/** Wave-2 review M1: the user's own open/closed choice, kept for the browser session. */
const OPEN_KEY = "diagram-legend-open";
/** Tailwind's `xl` breakpoint (80rem). */
const WIDE_QUERY = "(min-width: 80rem)";

/** The user's open/closed choice this session, or `null` if they made none. */
function keptOpen(): boolean | null {
  try {
    const kept = sessionStorage.getItem(OPEN_KEY);
    if (kept !== null) return kept === "true";
  } catch {
    // Storage blocked: no kept choice.
  }
  return null;
}

function keepOpen(open: boolean) {
  try {
    sessionStorage.setItem(OPEN_KEY, String(open));
  } catch {
    // Storage blocked: the choice lasts until the legend remounts.
  }
}

function providerLabel(provider: string): string {
  const override = PROVIDER_LABEL_OVERRIDE[provider];
  if (override) return override;
  return ICON_INDEX[`${provider}/${provider}`]?.label ?? provider;
}

/**
 * A 16 px owner swatch: the zone frame (`zoneVariants`) with a top-level zone's fill rung
 * (`zoneFill`, DG-20) around a body carrying the SaaS hatch.
 */
function OwnerSwatch({ owner }: { owner: ZoneOwner }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        zoneVariants({ owner, kind: "generic", ...zoneFill(0, owner) }),
        "inline-block size-4 shrink-0",
      )}
    >
      <span className={cn("block h-full w-full", zoneBodyVariants({ owner }))} />
    </span>
  );
}

/**
 * A 28×12 edge sample: the kind's stroke + dash + arrowhead, exactly as `DataFlowEdge`
 * paints it — including its stroke WIDTH rung (`KIND_STROKE_WIDTH`, DG-20; m6).
 */
function EdgeKindSwatch({ kind }: { kind: FlowKind }) {
  const stroke = KIND_STROKE[kind];
  const dash = resolveDash(resolveLineStyle(kind, undefined), false);
  const marker = MARKER_TYPE[kind];
  return (
    <svg aria-hidden="true" className="shrink-0" height={12} overflow="visible" width={28}>
      <line
        stroke={stroke}
        strokeDasharray={dash}
        strokeLinecap="round"
        strokeWidth={KIND_STROKE_WIDTH[kind]}
        x1={2}
        x2={20}
        y1={6}
        y2={6}
      />
      {marker === MarkerType.ArrowClosed ? (
        <path d="M 19 2 L 26 6 L 19 10 Z" fill={stroke} />
      ) : marker === MarkerType.Arrow ? (
        <path
          d="M 19 2 L 26 6 L 19 10"
          fill="none"
          stroke={stroke}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
        />
      ) : null}
    </svg>
  );
}

function OwnersSection({ owners }: { owners: ZoneOwner[] }) {
  const headingId = useId();
  return (
    <div data-slot="diagram-legend-owners">
      <Text as="div" id={headingId} tone="muted" variant="eyebrow">
        {LABELS.owners}
      </Text>
      <ul aria-labelledby={headingId} className="mt-1 flex flex-col gap-0.5">
        {owners.map((owner) => (
          <li key={owner} className="flex items-center gap-2 text-muted-foreground">
            <OwnerSwatch owner={owner} />
            {OWNER_LABEL[owner]}
          </li>
        ))}
      </ul>
    </div>
  );
}

function EdgesSection({
  edgeKinds,
  secure,
  hasSteps,
}: {
  edgeKinds: FlowKind[];
  secure: Exclude<FlowSecure, "none">[];
  hasSteps: boolean;
}) {
  const headingId = useId();
  return (
    <div data-slot="diagram-legend-edges">
      <Text as="div" id={headingId} tone="muted" variant="eyebrow">
        {LABELS.edges}
      </Text>
      <ul aria-labelledby={headingId} className="mt-1 flex flex-col gap-0.5">
        {edgeKinds.map((kind) => {
          const KindGlyph = KIND_GLYPH[kind];
          return (
            <li key={kind} className="flex items-center gap-2 text-muted-foreground">
              <EdgeKindSwatch kind={kind} />
              {KindGlyph ? <KindGlyph aria-hidden="true" className="shrink-0" size={12} /> : null}
              <span>{KIND_LABEL[kind]}</span>
            </li>
          );
        })}
        {secure.map((value) => {
          const SecureGlyph = SECURE_GLYPH[value];
          return (
            <li key={value} className="flex items-center gap-2 text-muted-foreground">
              <SecureGlyph aria-hidden="true" className="shrink-0" size={12} />
              <span>{SECURE_WORDS[value]}</span>
            </li>
          );
        })}
        {hasSteps ? (
          <li className="flex items-center gap-2 text-muted-foreground">
            <Badge variant="outline" className={CLUSTER_CLASS.step}>
              1
            </Badge>
            <span>{LABELS.numberedStep}</span>
          </li>
        ) : null}
      </ul>
    </div>
  );
}

function ProvidersSection({ providers }: { providers: string[] }) {
  const headingId = useId();
  return (
    <div data-slot="diagram-legend-providers">
      <Text as="div" id={headingId} tone="muted" variant="eyebrow">
        {LABELS.providers}
      </Text>
      <ul aria-labelledby={headingId} className="mt-1 flex flex-col gap-0.5">
        {providers.map((provider) => (
          <li key={provider} className="flex items-center gap-2 text-muted-foreground">
            <ServiceLogo decorative name={`${provider}/${provider}`} size={16} />
            <span>{providerLabel(provider)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * DG-08 — the spec-driven legend: owners (DG-06's `zoneVariants`), providers
 * (`ServiceLogo`/`ICON_INDEX`) and edge kinds (DG-07's `edge-style.ts`), read live off the
 * canvas via `buildLegend`. D9: a React Flow `Panel`, not app chrome, so it is inside the
 * exported picture.
 *
 * **Verified limitation** (`docs/verified-apis.md` → flow, `docs/findings/DG-08-legend.md`):
 * flow's own `Legend` only draws a colour dot per item (`items: {label,color}[]`); owners
 * are told apart by border STYLE and edge kinds by marker/dash, which a colour swatch
 * cannot show, so this component builds its rows from `ui` parts instead of `Legend`.
 */
export function DiagramLegend({ mode, interactive = true }: DiagramLegendProps) {
  const nodes = useNodes();
  const edges = useEdges();
  // Every example load remounts the canvas and this legend; the session keeps the choice.
  const [choice, setChoice] = useState(keptOpen);
  const [wide] = useState(() => window.matchMedia(WIDE_QUERY).matches);
  const onOpenChange = (next: boolean) => {
    setChoice(next);
    keepOpen(next);
  };
  const spec = useMemo(() => buildLegend(nodes, edges, mode), [nodes, edges, mode]);

  if (!spec) return null;
  const hasOwners = spec.owners.length > 0;
  const hasProviders = spec.providers.length > 0;
  const hasEdges = spec.edgeKinds.length > 0 || spec.secure.length > 0 || spec.hasSteps;
  if (!hasOwners && !hasEdges && !hasProviders) return null;
  // Open at first only on an `xl` window (below it the legend costs the fit zoom most) and
  // only when it is short (DG-20); the session's own choice always wins. Derived, no effect.
  const entries =
    spec.owners.length +
    spec.edgeKinds.length +
    spec.secure.length +
    (spec.hasSteps ? 1 : 0) +
    spec.providers.length;
  const open = choice ?? (wide && entries <= MAX_OPEN_ENTRIES);

  if (!interactive)
    return (
      <Panel data-slot="diagram-legend" position="bottom-left" className={FLOATING_SURFACE}>
        <Text variant="meta" className="font-medium">
          {LABELS.trigger}
        </Text>
        <div className="mt-2 flex flex-col gap-3">
          {hasOwners ? <OwnersSection owners={spec.owners} /> : null}
          {hasEdges ? (
            <EdgesSection
              edgeKinds={spec.edgeKinds}
              hasSteps={spec.hasSteps}
              secure={spec.secure}
            />
          ) : null}
          {hasProviders ? <ProvidersSection providers={spec.providers} /> : null}
        </div>
      </Panel>
    );
  return (
    <Panel
      data-slot="diagram-legend"
      position="bottom-left"
      className={cn("pointer-events-auto", FLOATING_SURFACE)}
    >
      <Collapsible open={open} onOpenChange={onOpenChange}>
        <CollapsibleTrigger asChild>
          <Button
            className="-m-1 h-auto gap-1.5 px-1.5 py-1 text-meta font-medium text-foreground hover:bg-accent"
            data-slot="diagram-legend-trigger"
            size="sm"
            variant="ghost"
          >
            {open ? (
              <ChevronDown aria-hidden="true" size={14} />
            ) : (
              <ChevronRight aria-hidden="true" size={14} />
            )}
            {LABELS.trigger}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-2 flex flex-col gap-3">
          {hasOwners ? <OwnersSection owners={spec.owners} /> : null}
          {hasEdges ? (
            <EdgesSection
              edgeKinds={spec.edgeKinds}
              hasSteps={spec.hasSteps}
              secure={spec.secure}
            />
          ) : null}
          {hasProviders ? <ProvidersSection providers={spec.providers} /> : null}
        </CollapsibleContent>
      </Collapsible>
    </Panel>
  );
}
