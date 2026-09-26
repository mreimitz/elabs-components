import type { FlowEmphasis, FlowTone } from "@elabs-ai/components-flow";
import {
  ARCH_NODE_TYPE,
  type ArchMarkedKind,
  type ArchNode,
  type ArchNodeData,
  type ArchNodeVariant,
} from "../nodes/arch-node-data";

/**
 * DG-05 — the `#nodes` gallery: every marked kind × D5 variant × tone, one `featured`
 * column and one `selected` column, plus two notes. Positions are laid out here in code
 * (no ELK), rows = kind × variant, columns = tone. Column and row labels are notes too
 * (placed LAST in the array, and not focusable, so Tab starts on the first real node).
 */

const KINDS: readonly ArchMarkedKind[] = ["service", "actor", "datastore", "queue", "external"];
const VARIANTS: readonly ArchNodeVariant[] = ["icon", "card"];

interface GalleryColumn {
  key: string;
  label: string;
  tone: FlowTone;
  emphasis?: FlowEmphasis;
  selected?: boolean;
}

const COLUMNS: readonly GalleryColumn[] = [
  { key: "neutral", label: "tone: neutral", tone: "neutral" },
  { key: "info", label: "tone: info", tone: "info" },
  { key: "success", label: "tone: success", tone: "success" },
  { key: "warning", label: "tone: warning", tone: "warning" },
  { key: "destructive", label: "tone: destructive", tone: "destructive" },
  { key: "featured", label: "emphasis: featured", tone: "neutral", emphasis: "featured" },
  { key: "selected", label: "selected", tone: "neutral", selected: true },
];

type Sample = Pick<ArchNodeData, "title" | "subtitle" | "icon" | "badges" | "provider">;

/** Realistic content per kind and look; the provider marks are DG-04's vendored icons. */
const SAMPLES: Record<ArchMarkedKind, Record<ArchNodeVariant, Sample>> = {
  service: {
    icon: { title: "Order API", subtitle: "AWS Lambda", icon: "aws/lambda", badges: ["prod"] },
    card: {
      title: "Qlik Cloud Analytics",
      subtitle: "EU tenant",
      icon: "qlik/cloud",
      provider: "Qlik",
      badges: ["prod", "sso"],
    },
  },
  // No icon: the actor falls back to `lucide/user`.
  actor: {
    icon: { title: "Business users", subtitle: "Entra ID" },
    card: { title: "Data engineer", subtitle: "Owns the pipelines" },
  },
  datastore: {
    icon: {
      title: "ANALYTICS_WH",
      subtitle: "Snowflake",
      icon: "snowflake/snowflake",
      badges: ["pii"],
    },
    card: {
      title: "Orders DB",
      subtitle: "PostgreSQL 16",
      icon: "lucide/database",
      badges: ["pii", "eu"],
    },
  },
  queue: {
    icon: { title: "Order events", subtitle: "SQS FIFO", icon: "aws/simple-queue-service" },
    // No icon: the queue falls back to `lucide/layers`.
    card: { title: "Change stream", subtitle: "CDC topic", provider: "Kafka" },
  },
  external: {
    // No icon: the external system falls back to `lucide/globe`.
    icon: { title: "Payment provider", subtitle: "Partner API" },
    card: {
      title: "Qlik Cloud tenant",
      subtitle: "Customer-owned",
      icon: "qlik/cloud",
      provider: "Partner",
    },
  },
};

const COL_PITCH = 280; // a 240 px card + 40 px gutter
const ICON_INSET = 56; // centres the 128 px `icon` look in a card-wide column
const ROW_PITCH = 170;
const BLOCK_GAP = 60; // between the `icon` rows and the `card` rows
const HEADER_Y = 0;
const FIRST_ROW_Y = 80;
const LABEL_X = -280;

const rowY = (variantIndex: number, kindIndex: number) =>
  FIRST_ROW_Y + (variantIndex * KINDS.length + kindIndex) * ROW_PITCH + variantIndex * BLOCK_GAP;

function galleryNodes(): ArchNode[] {
  const nodes: ArchNode[] = [];
  const labels: ArchNode[] = [];
  const label = (id: string, title: string, x: number, y: number): ArchNode => ({
    id,
    type: ARCH_NODE_TYPE.note,
    position: { x, y },
    focusable: false,
    selectable: false,
    draggable: false,
    data: { title },
  });

  COLUMNS.forEach((column, c) =>
    labels.push(label(`label-col-${column.key}`, column.label, c * COL_PITCH, HEADER_Y)),
  );

  VARIANTS.forEach((variant, v) =>
    KINDS.forEach((kind, k) => {
      const y = rowY(v, k);
      labels.push(label(`label-row-${kind}-${variant}`, `${kind} · ${variant}`, LABEL_X, y));
      COLUMNS.forEach((column, c) => {
        const data: ArchNodeData = { ...SAMPLES[kind][variant], variant, tone: column.tone };
        if (column.emphasis) data.emphasis = column.emphasis;
        nodes.push({
          id: `${kind}-${variant}-${column.key}`,
          type: ARCH_NODE_TYPE[kind],
          position: { x: c * COL_PITCH + (variant === "icon" ? ICON_INSET : 0), y },
          ...(column.selected ? { selected: true } : {}),
          data,
        });
      });
    }),
  );

  const notesY = rowY(VARIANTS.length, 0);
  labels.push(label("label-row-note", "note", LABEL_X, notesY));
  nodes.push(
    {
      id: "note-neutral",
      type: ARCH_NODE_TYPE.note,
      position: { x: 0, y: notesY },
      data: {
        title: "Gateway note",
        text: "No inbound ports; the gateway dials out to Qlik Cloud. Drag across this text to select it.",
      },
    },
    {
      id: "note-selected",
      type: ARCH_NODE_TYPE.note,
      position: { x: (COLUMNS.length - 1) * COL_PITCH, y: notesY },
      selected: true,
      data: { title: "A note with only a title — the body falls back to it." },
    },
  );

  return [...nodes, ...labels];
}

export const GALLERY_NODES: ArchNode[] = galleryNodes();

/** Structural equality over JSON values — key sets must match, so an `undefined` field fails. */
function jsonDeepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every(
    (key) =>
      Object.prototype.hasOwnProperty.call(b, key) &&
      jsonDeepEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]),
  );
}

/**
 * The ids of every node whose `data` does NOT survive `JSON.parse(JSON.stringify(…))`
 * unchanged — a `ReactNode`, a function, a `Date`, `NaN` or an `undefined` field. The
 * dialect compiles into this data, so it must be plain JSON (DG-05 step 9).
 */
export function findNonJsonNodeData(nodes: readonly ArchNode[]): string[] {
  return nodes
    .filter((node) => !jsonDeepEqual(JSON.parse(JSON.stringify(node.data)), node.data))
    .map((node) => node.id);
}
