// registry: agent-designer-01 — copied 2026-09-20
/**
 * Agent designer (copy-owned block).
 *
 * A canvas for designing business agents: what starts the work, which agents handle it,
 * what each agent is EQUIPPED with — a model, skills, MCP servers and the tools it may use
 * on them, knowledge, memory — and where guardrails, routers and human approvals sit
 * before anything is written to another system.
 *
 * Two kinds of connection, drawn differently on purpose:
 *   - flow (solid, arrow, round handles): work moving from step to step, left to right;
 *   - equipment (dashed, square ports under an agent): what that agent can use.
 *
 * Around the canvas: a searchable palette (drag, or click — a capability clicked while an
 * agent is selected attaches to it), an inspector with one form per node kind (per-tool
 * switches and "ask first" on MCP servers, autonomy and budget on agents, branches on
 * routers), design checks that point at the node they are about, a simulated test run that
 * pauses at approvals, undo/redo and auto-layout.
 *
 * It is a presentation layer. Nothing here calls a model or an MCP server: the design is
 * plain data (`types.ts`), the checks are pure functions (`validate.ts`) and the test run is
 * a timer-driven stand-in (`use-test-run.ts`) you replace with your runtime’s events.
 *
 * Remember to `import "@xyflow/react/dist/style.css"` once at the app root.
 */
"use client";

import { useCallback, useMemo, useRef, useState, type DragEvent, type KeyboardEvent } from "react";
import {
  ChevronDown,
  CircleAlert,
  CircleCheck,
  GripVertical,
  LayoutGrid,
  ListChecks,
  Play,
  Redo2,
  RotateCcw,
  TriangleAlert,
  Undo2,
  UploadCloud,
  X,
} from "lucide-react";
import { SearchInput } from "@elabs-ai/components-data";
import {
  addEdge,
  CanvasShell,
  FlowMiniMap,
  InspectorPanel,
  layoutFlow,
  MarkerType,
  Panel,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  ZoomControls,
  type Connection,
} from "@elabs-ai/components-flow";
import { useReducedMotion } from "@elabs-ai/components-tokens";
import {
  Badge,
  Button,
  cn,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  IconButton,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  StatusBadge,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@elabs-ai/components-ui";
import { useUndoRedo } from "../flow-builder/use-undo-redo";
import { CATALOG, CATALOG_GROUPS, type CatalogItem } from "./data/catalog";
import { AGENT_WIDTH, placeEquipment, SCENARIOS, TEST_PATH } from "./data/scenarios";
import { designerEdgeTypes } from "./edges";
import { NodeInspector } from "./inspector";
import { designerNodeTypes } from "./nodes";
import {
  isCapability,
  nodeTitle,
  nodeTypeFor,
  type CapabilityData,
  type CapabilityKind,
  type DesignerData,
  type DesignerEdge,
  type DesignerNode,
  type DesignerScenario,
} from "./types";
import { useTestRun } from "./use-test-run";
import { checkDesign } from "./validate";

const DRAG_TYPE = "application/x-agent-designer-item";

export interface AgentDesignerProps {
  /** The designs the picker offers. Defaults to the three samples. */
  scenarios?: DesignerScenario[];
  /** Which one opens first. */
  defaultScenarioId?: string;
  /** Hide the picker when the host decides which design is open. */
  showScenarioPicker?: boolean;
  /** A node to open in the inspector at first. */
  defaultSelectedNodeId?: string;
  /** Open the bottom panel at first. */
  defaultPanel?: "checks" | "run";
  /** `"card"` is a bordered box with its own height; `"fill"` takes the box you give it. */
  frame?: "card" | "fill";
  className?: string;
}

export function AgentDesigner({
  scenarios = SCENARIOS,
  defaultScenarioId,
  ...props
}: AgentDesignerProps) {
  const [scenarioId, setScenarioId] = useState(defaultScenarioId ?? scenarios[0]?.id);
  const scenario = scenarios.find((item) => item.id === scenarioId) ?? scenarios[0];
  if (!scenario) return null;
  return (
    // The palette, the toolbar and the inspector all drive the canvas, so the flow’s store
    // sits above all of them. Keyed by design: switching designs starts from a clean slate
    // (nodes, selection, undo history, test run).
    <ReactFlowProvider key={scenario.id}>
      <Designer
        {...props}
        onScenarioChange={setScenarioId}
        scenario={scenario}
        scenarios={scenarios}
      />
    </ReactFlowProvider>
  );
}

/* -------------------------------------------------------------------------- */

const isFlowData = (data: DesignerData) => !isCapability(data) && data.kind !== "note";

function Designer({
  scenario,
  scenarios,
  onScenarioChange,
  showScenarioPicker = true,
  defaultSelectedNodeId,
  defaultPanel,
  frame = "card",
  className,
}: Omit<AgentDesignerProps, "defaultScenarioId"> & {
  scenario: DesignerScenario;
  scenarios: DesignerScenario[];
  onScenarioChange: (id: string) => void;
}) {
  const flow = useReactFlow<DesignerNode, DesignerEdge>();
  const reducedMotion = useReducedMotion();
  const canvasRef = useRef<HTMLDivElement>(null);
  const idRef = useRef(0);
  const lastEdit = useRef<{ nodeId: string; at: number } | null>(null);

  const [nodes, setNodes, onNodesChange] = useNodesState<DesignerNode>(
    structuredClone(scenario.nodes).map((node) => ({
      ...node,
      selected: node.id === defaultSelectedNodeId,
    })),
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState<DesignerEdge>(
    structuredClone(scenario.edges),
  );
  const [panel, setPanel] = useState<"checks" | "run" | null>(defaultPanel ?? null);
  const [query, setQuery] = useState("");
  const [published, setPublished] = useState(false);

  const history = useUndoRedo<DesignerNode, DesignerEdge>({ nodes, edges, setNodes, setEdges });
  const run = useTestRun({ nodes, edges, path: TEST_PATH[scenario.id], reducedMotion });
  const issues = useMemo(() => checkDesign(nodes, edges), [nodes, edges]);
  const errors = issues.filter((issue) => issue.severity === "error");

  const selected = nodes.find((node) => node.selected);
  const equipmentOf = useCallback(
    (agentId: string) =>
      edges
        .filter((edge) => edge.data?.link === "attach" && edge.source === agentId)
        .map((edge) => nodes.find((node) => node.id === edge.target))
        .filter((node): node is DesignerNode => Boolean(node)),
    [edges, nodes],
  );

  /* ---- What the canvas draws: the design, plus what checks and the test run say. ---- */

  const displayNodes = useMemo(
    () =>
      nodes.map((node): DesignerNode => {
        const nodeIssues = issues.filter((issue) => issue.nodeId === node.id);
        const equipment: Partial<Record<CapabilityKind, number>> = {};
        if (node.data.kind === "agent") {
          for (const item of equipmentOf(node.id)) {
            const kind = item.data.kind as CapabilityKind;
            equipment[kind] = (equipment[kind] ?? 0) + 1;
          }
        }
        return {
          ...node,
          data: {
            ...node.data,
            runStatus: run.statuses[node.id],
            issue: nodeIssues.some((issue) => issue.severity === "error")
              ? "error"
              : nodeIssues.length > 0
                ? "warning"
                : undefined,
            equipment,
          },
        } as DesignerNode;
      }),
    [nodes, issues, run.statuses, equipmentOf],
  );

  const displayEdges = useMemo(
    () =>
      edges.map((edge): DesignerEdge => {
        if (edge.data?.link === "attach") return edge;
        const travelled = run.travelled.includes(edge.id);
        return {
          ...edge,
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: travelled ? "var(--flow-edge-strong)" : "var(--flow-edge)",
          },
          data: {
            ...edge.data,
            link: "flow",
            travelled,
            progress: run.transit?.edgeId === edge.id ? run.transit.progress : undefined,
          },
        };
      }),
    [edges, run.travelled, run.transit],
  );

  /* ---- Connecting: a port only takes its own kind; flow only meets flow. ---- */

  const isValidConnection = useCallback(
    (connection: Connection | DesignerEdge) => {
      const source = nodes.find((node) => node.id === connection.source);
      const target = nodes.find((node) => node.id === connection.target);
      if (!source || !target || source.id === target.id) return false;
      if (connection.sourceHandle?.startsWith("port:")) {
        return target.data.kind === connection.sourceHandle.slice(5);
      }
      return isFlowData(target.data) && target.data.kind !== "trigger";
    },
    [nodes],
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      history.takeSnapshot();
      const attach = Boolean(connection.sourceHandle?.startsWith("port:"));
      const outcome =
        connection.sourceHandle === "approved" || connection.sourceHandle === "rejected"
          ? connection.sourceHandle
          : undefined;
      setEdges((current) =>
        addEdge<DesignerEdge>(
          {
            ...connection,
            type: attach ? "attach" : "flow",
            data: { link: attach ? "attach" : "flow", label: outcome },
          },
          current,
        ),
      );
    },
    [history, setEdges],
  );

  /* ---- Adding from the palette ---- */

  const viewportCentre = () => {
    const box = canvasRef.current?.getBoundingClientRect();
    return flow.screenToFlowPosition(
      box ? { x: box.left + box.width / 2, y: box.top + box.height / 3 } : { x: 0, y: 0 },
    );
  };

  /** Re-seat an agent’s equipment in tidy columns beneath it, optionally with one more. */
  const seatEquipment = (
    current: DesignerNode[],
    agent: DesignerNode,
    attached: DesignerNode[],
  ): DesignerNode[] => {
    const seats = placeEquipment(
      agent.position,
      attached.map((node) => node.data as CapabilityData),
    );
    const seatById = new Map<string, { x: number; y: number }>();
    // `placeEquipment` groups by kind; walk the same order to hand each node its seat.
    const queue = [...attached];
    for (const seat of seats) {
      const index = queue.findIndex((node) => node.data === seat.data);
      const [node] = queue.splice(index, 1);
      if (node) seatById.set(node.id, seat.position);
    }
    return current.map((node) =>
      seatById.has(node.id) ? { ...node, position: seatById.get(node.id)! } : node,
    );
  };

  const addItem = (item: CatalogItem, dropPosition?: { x: number; y: number }) => {
    history.takeSnapshot();
    setPublished(false);
    const data = item.create();
    const id = `${data.kind}-${Date.now().toString(36)}-${++idRef.current}`;
    const fresh = (position: { x: number; y: number }) =>
      ({ id, type: nodeTypeFor(data), position, data, selected: true }) as DesignerNode;
    const deselected = nodes.map((node) => ({ ...node, selected: false }));

    // A capability clicked while an agent (or one of its parts) is selected attaches to it.
    if (isCapability(data) && !dropPosition) {
      const owner =
        selected?.data.kind === "agent"
          ? selected
          : selected && isCapability(selected.data)
            ? nodes.find((node) =>
                edges.some((edge) => edge.target === selected.id && edge.source === node.id),
              )
            : nodes.filter((node) => node.data.kind === "agent").length === 1
              ? nodes.find((node) => node.data.kind === "agent")
              : undefined;
      if (owner) {
        const node = fresh(owner.position);
        const attached = [...equipmentOf(owner.id), node];
        setNodes(
          seatEquipment([...deselected, node], owner, attached).map((item) =>
            // Keep the agent selected: the next click usually equips it further.
            item.id === owner.id
              ? { ...item, selected: true }
              : item.id === id
                ? { ...item, selected: false }
                : item,
          ),
        );
        setEdges((current) => [
          ...current,
          {
            id: `${owner.id}⇢${id}`,
            type: "attach",
            source: owner.id,
            target: id,
            sourceHandle: `port:${data.kind}`,
            targetHandle: "attach",
            data: { link: "attach" },
          },
        ]);
        return;
      }
    }

    // A step clicked while a step with a free exit is selected continues the flow from it.
    if (isFlowData(data) && !dropPosition && selected && isFlowData(selected.data)) {
      const exit =
        selected.data.kind === "router" || selected.data.kind === "approval" ? null : "out";
      const free =
        exit && !edges.some((edge) => edge.source === selected.id && edge.sourceHandle === exit);
      if (free && data.kind !== "trigger") {
        const width = selected.measured?.width ?? AGENT_WIDTH;
        setNodes([
          ...deselected,
          fresh({ x: selected.position.x + width + 100, y: selected.position.y }),
        ]);
        setEdges((current) => [
          ...current,
          {
            id: `${selected.id}→${id}`,
            type: "flow",
            source: selected.id,
            target: id,
            sourceHandle: "out",
            targetHandle: "in",
            data: { link: "flow" },
          },
        ]);
        return;
      }
    }

    setNodes([...deselected, fresh(dropPosition ?? viewportCentre())]);
  };

  const onDrop = (event: DragEvent) => {
    const item = CATALOG.find((entry) => entry.id === event.dataTransfer.getData(DRAG_TYPE));
    if (!item) return;
    event.preventDefault();
    addItem(item, flow.screenToFlowPosition({ x: event.clientX, y: event.clientY }));
  };

  /* ---- Editing, detaching, removing ---- */

  const updateSelected = (patch: Partial<DesignerData>) => {
    if (!selected) return;
    // One undo step per burst of typing in one node, not one per keystroke.
    const now = Date.now();
    if (lastEdit.current?.nodeId !== selected.id || now - lastEdit.current.at > 1500) {
      history.takeSnapshot();
    }
    lastEdit.current = { nodeId: selected.id, at: now };
    setPublished(false);
    setNodes((current) =>
      current.map((node) =>
        node.id === selected.id
          ? ({ ...node, data: { ...node.data, ...patch } } as DesignerNode)
          : node,
      ),
    );
  };

  const select = (nodeId: string, reveal = true) => {
    setNodes((current) => current.map((node) => ({ ...node, selected: node.id === nodeId })));
    if (reveal) {
      void flow.fitView({
        nodes: [{ id: nodeId }],
        maxZoom: 1,
        minZoom: 0.6,
        padding: 0.6,
        duration: reducedMotion ? 0 : 300,
      });
    }
  };

  const removeNodes = (ids: string[]) => {
    history.takeSnapshot();
    setPublished(false);
    setNodes((current) => current.filter((node) => !ids.includes(node.id)));
    setEdges((current) =>
      current.filter((edge) => !ids.includes(edge.source) && !ids.includes(edge.target)),
    );
  };

  const removeSelected = () => {
    if (!selected) return;
    // An agent takes the equipment only it uses with it.
    const own =
      selected.data.kind === "agent"
        ? equipmentOf(selected.id)
            .filter((item) => edges.filter((edge) => edge.target === item.id).length === 1)
            .map((item) => item.id)
        : [];
    removeNodes([selected.id, ...own]);
  };

  /* ---- Auto-layout: the flow left to right, each agent’s equipment beneath it. ---- */

  const tidy = () => {
    history.takeSnapshot();
    const live = flow.getNodes();
    const flowNodes = live.filter((node) => isFlowData(node.data));
    // Lay out the FLOW only, but give every agent the footprint of agent + equipment, so
    // dagre leaves room for what hangs beneath it.
    const footprints = flowNodes.map((node) => {
      const equipment = node.data.kind === "agent" ? equipmentOf(node.id) : [];
      const seats = placeEquipment(
        { x: 0, y: 0 },
        equipment.map((item) => item.data as CapabilityData),
      );
      const left = Math.min(0, ...seats.map((seat) => seat.position.x));
      const right = Math.max(AGENT_WIDTH, ...seats.map((seat) => seat.position.x + 184));
      const bottom = Math.max(0, ...seats.map((seat) => seat.position.y + 64));
      return {
        ...node,
        measured: {
          width: equipment.length ? right - left : (node.measured?.width ?? 240),
          height: Math.max(node.measured?.height ?? 80, bottom),
        },
        inset: equipment.length ? -left : 0,
      };
    });
    const result = layoutFlow(
      footprints,
      edges.filter((edge) => edge.data?.link !== "attach"),
      { direction: "LR", nodeSpacing: 56, rankSpacing: 96 },
    );
    const placed = new Map(
      result.nodes.map((node, index) => [
        node.id,
        { x: node.position.x + footprints[index]!.inset, y: node.position.y },
      ]),
    );
    let next = live.map((node) =>
      placed.has(node.id) ? { ...node, position: placed.get(node.id)! } : node,
    );
    for (const agent of next.filter((node) => node.data.kind === "agent")) {
      next = seatEquipment(next, agent, equipmentOf(agent.id));
    }
    setNodes(next);
    requestAnimationFrame(() => void flow.fitView({ padding: 0.08, minZoom: 0.45 }));
  };

  /* ---- Keyboard: undo/redo while focus is inside the designer, never page-wide. ---- */

  const onKeyDown = (event: KeyboardEvent) => {
    if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "z") return;
    const target = event.target as HTMLElement;
    if (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
    event.preventDefault();
    if (event.shiftKey) history.redo();
    else history.undo();
  };

  /* ---- The summary line ---- */

  const count = (kind: DesignerData["kind"]) =>
    nodes.filter((node) => node.data.kind === kind).length;
  const toolsOn = nodes.flatMap((node) =>
    node.data.kind === "mcp" ? node.data.tools.filter((tool) => tool.enabled) : [],
  );
  const budget = nodes.reduce(
    (sum, node) => sum + (node.data.kind === "agent" ? node.data.budgetUsd : 0),
    0,
  );
  const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
  const runCost = run.log.reduce((sum, entry) => sum + (entry.usd ?? 0), 0);
  const trigger = nodes.find((node) => node.data.kind === "trigger");
  const needle = query.trim().toLowerCase();

  return (
    // The key handler is for undo/redo shortcuts while focus is inside; it is not a control.
    <div
      className={cn(
        "flex w-full flex-col overflow-hidden bg-card text-foreground",
        frame === "card" ? "h-[820px] rounded-lg border" : "h-full",
        className,
      )}
      data-slot="agent-designer"
      onKeyDown={onKeyDown}
    >
      {/* ---- Header ---- */}
      {/* header-band-exempt: a block toolbar that wraps its controls when narrow; it sits under a shell’s top bar, never beside another band */}
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b px-4 py-2.5">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          {showScenarioPicker && scenarios.length > 1 ? (
            <Select onValueChange={onScenarioChange} value={scenario.id}>
              <SelectTrigger aria-label="Design" className="w-auto min-w-52 font-semibold">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {scenarios.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <h2 className="truncate text-subtitle font-semibold">{scenario.name}</h2>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Badge variant="secondary">
                {published ? "published just now" : scenario.version}
              </Badge>
              <span className="truncate text-caption text-muted-foreground">{scenario.owner}</span>
            </div>
            <p className="truncate text-meta text-muted-foreground tabular-nums">
              {plural(count("agent"), "agent")} · {plural(count("skill"), "skill")} ·{" "}
              {plural(count("mcp"), "MCP server")} · {toolsOn.length} tools on (
              {toolsOn.filter((tool) => tool.access === "write").length} write) · up to $
              {budget.toFixed(2)} a run
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <IconButton
            disabled={!history.canUndo}
            icon={<Undo2 aria-hidden="true" />}
            label="Undo"
            onClick={history.undo}
            size="icon-sm"
            variant="ghost"
          />
          <IconButton
            disabled={!history.canRedo}
            icon={<Redo2 aria-hidden="true" />}
            label="Redo"
            onClick={history.redo}
            size="icon-sm"
            variant="ghost"
          />
          <IconButton
            icon={<LayoutGrid aria-hidden="true" />}
            label="Tidy up the layout"
            onClick={tidy}
            size="icon-sm"
            variant="ghost"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button
            aria-expanded={panel === "checks"}
            onClick={() => setPanel(panel === "checks" ? null : "checks")}
            size="sm"
            variant="outline"
          >
            {errors.length > 0 ? (
              <CircleAlert aria-hidden="true" className="text-destructive" />
            ) : issues.length > 0 ? (
              <TriangleAlert aria-hidden="true" className="text-warning" />
            ) : (
              <CircleCheck aria-hidden="true" className="text-success" />
            )}
            {issues.length === 0 ? "No issues" : plural(issues.length, "issue")}
          </Button>
          <Button
            disabled={!trigger || run.phase === "running"}
            onClick={() => {
              setPanel("run");
              run.start();
            }}
            size="sm"
            variant="secondary"
          >
            <Play aria-hidden="true" />
            Test run
          </Button>
          <Button
            disabled={errors.length > 0 || published}
            onClick={() => setPublished(true)}
            size="sm"
          >
            <UploadCloud aria-hidden="true" />
            Publish
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* ---- Palette ---- */}
        <nav
          aria-label="Palette"
          className="flex w-60 shrink-0 flex-col gap-2 overflow-y-auto border-e bg-background p-3"
        >
          <SearchInput
            label="Search the palette"
            onValueChange={setQuery}
            placeholder="Search skills, servers, steps…"
            value={query}
          />
          <p className="px-1 text-meta text-muted-foreground">
            {selected?.data.kind === "agent"
              ? `Click a model, skill, server or source to equip ${selected.data.name}.`
              : "Drag onto the canvas, or click to add."}
          </p>
          {CATALOG_GROUPS.map((group) => {
            const items = CATALOG.filter(
              (item) =>
                item.group === group &&
                (!needle ||
                  item.label.toLowerCase().includes(needle) ||
                  item.description.toLowerCase().includes(needle)),
            );
            if (items.length === 0) return null;
            return (
              <Collapsible
                defaultOpen={group !== "Knowledge and memory" && group !== "Actions"}
                key={group}
                // While searching every group with a match is open.
                open={needle ? true : undefined}
              >
                <CollapsibleTrigger className="group flex w-full items-center justify-between rounded-md px-1 py-1 text-eyebrow text-muted-foreground focus-ring hover:text-foreground">
                  <span>
                    {group} <span className="tabular-nums">({items.length})</span>
                  </span>
                  <ChevronDown
                    aria-hidden="true"
                    className="size-3.5 transition-transform duration-fast group-data-[state=closed]:-rotate-90"
                  />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <ul className="flex flex-col gap-1 pb-1 pt-0.5">
                    {items.map((item) => (
                      <li key={item.id}>
                        <button
                          className={cn(
                            "flex w-full items-start gap-1.5 rounded-md border border-border bg-card px-2 py-1.5 text-start shadow-xs",
                            "cursor-grab hover:border-border-strong hover:bg-accent hover:text-accent-foreground focus-ring active:cursor-grabbing",
                          )}
                          draggable
                          onClick={() => addItem(item)}
                          onDragStart={(event) => {
                            event.dataTransfer.setData(DRAG_TYPE, item.id);
                            event.dataTransfer.effectAllowed = "copy";
                          }}
                          type="button"
                        >
                          <GripVertical
                            aria-hidden="true"
                            className="mt-0.5 size-3.5 shrink-0 text-muted-foreground"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-caption font-medium">
                              {item.label}
                            </span>
                            <span className="block truncate text-meta text-muted-foreground">
                              {item.description}
                            </span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </CollapsibleContent>
              </Collapsible>
            );
          })}
        </nav>

        {/* ---- Canvas + bottom panel ---- */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div
            className="relative min-h-0 flex-1"
            onDragOver={(event) => {
              if (event.dataTransfer.types.includes(DRAG_TYPE)) event.preventDefault();
            }}
            onDrop={onDrop}
            ref={canvasRef}
          >
            <CanvasShell<DesignerNode, DesignerEdge>
              edgeTypes={designerEdgeTypes}
              edges={displayEdges}
              // Designs run wide. Open on the START of the flow at a readable size rather
              // than on the whole thing at a size nobody can read.
              // React Flow’s own one-shot fit is switched off: it centres, and at mount it
              // lands after the keyed fit below and undoes its anchoring.
              fitView={false}
              fitViewAnchorNodeIds={trigger ? [trigger.id] : undefined}
              fitViewKey={scenario.id}
              fitViewKeyOptions={{ minZoom: 0.6, maxZoom: 1, padding: 0.06 }}
              isValidConnection={isValidConnection}
              minZoom={0.2}
              nodeTypes={designerNodeTypes}
              nodes={displayNodes}
              onBeforeDelete={async () => {
                history.takeSnapshot();
                return true;
              }}
              onConnect={onConnect}
              onEdgesChange={onEdgesChange}
              onNodeDragStart={history.takeSnapshot}
              onNodesChange={onNodesChange}
            >
              <Panel position="top-left">
                <ul className="flex gap-3 rounded-md bg-surface-elevated/90 px-2.5 py-1.5 text-meta text-muted-foreground shadow-ring-sm backdrop-blur">
                  <li className="flex items-center gap-1.5">
                    <svg aria-hidden="true" height="6" width="22">
                      <line
                        stroke="var(--flow-edge)"
                        strokeWidth="1.5"
                        x1="0"
                        x2="22"
                        y1="3"
                        y2="3"
                      />
                    </svg>
                    work moves
                  </li>
                  <li className="flex items-center gap-1.5">
                    <svg aria-hidden="true" height="6" width="22">
                      <line
                        stroke="var(--flow-edge)"
                        strokeDasharray="3 4"
                        strokeWidth="1.5"
                        x1="0"
                        x2="22"
                        y1="3"
                        y2="3"
                      />
                    </svg>
                    equipment
                  </li>
                </ul>
              </Panel>
              <FlowMiniMap
                pannable
                position="bottom-left"
                style={{ width: 148, height: 92 }}
                zoomable
              />
              <ZoomControls />
            </CanvasShell>
          </div>

          {panel ? (
            <Tabs
              className="flex h-60 shrink-0 flex-col border-t"
              onValueChange={(value) => setPanel(value as "checks" | "run")}
              value={panel}
            >
              <div className="flex items-center justify-between gap-2 px-3 pt-2">
                <TabsList>
                  <TabsTrigger value="checks">
                    <ListChecks aria-hidden="true" />
                    Design checks ({issues.length})
                  </TabsTrigger>
                  <TabsTrigger value="run">
                    <Play aria-hidden="true" />
                    Test run
                  </TabsTrigger>
                </TabsList>
                <IconButton
                  icon={<X aria-hidden="true" />}
                  label="Close the panel"
                  onClick={() => setPanel(null)}
                  size="icon-sm"
                  variant="ghost"
                />
              </div>

              <TabsContent className="min-h-0 flex-1 overflow-y-auto px-3 pb-3" value="checks">
                {issues.length === 0 ? (
                  <p className="flex items-center gap-2 py-4 text-body text-muted-foreground">
                    <CircleCheck aria-hidden="true" className="size-4 text-success" />
                    Nothing to fix. Every agent has a model, every server is connected and no
                    sensitive action runs unattended.
                  </p>
                ) : (
                  <ul className="flex flex-col gap-1.5">
                    {issues.map((issue) => (
                      <li key={issue.id}>
                        <button
                          className="flex w-full items-start gap-2 rounded-md border border-border px-3 py-2 text-start hover:bg-accent hover:text-accent-foreground focus-ring"
                          onClick={() => select(issue.nodeId)}
                          type="button"
                        >
                          {issue.severity === "error" ? (
                            <CircleAlert
                              aria-hidden="true"
                              className="mt-0.5 size-4 shrink-0 text-destructive"
                            />
                          ) : (
                            <TriangleAlert
                              aria-hidden="true"
                              className="mt-0.5 size-4 shrink-0 text-warning"
                            />
                          )}
                          <span className="min-w-0 flex-1">
                            <span className="block text-caption font-medium">
                              <span className="sr-only">
                                {issue.severity === "error" ? "Error: " : "Warning: "}
                              </span>
                              {issue.title}
                            </span>
                            <span className="block text-meta text-muted-foreground">
                              {issue.detail}
                            </span>
                          </span>
                          <Badge variant={issue.severity === "error" ? "destructive" : "warning"}>
                            {issue.severity}
                          </Badge>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </TabsContent>

              <TabsContent className="min-h-0 flex-1 overflow-y-auto px-3 pb-3" value="run">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2">
                  <p
                    aria-live="polite"
                    className="text-caption text-muted-foreground"
                    role="status"
                  >
                    {run.phase === "idle"
                      ? "A dry run with a sample event. Nothing is written anywhere."
                      : run.phase === "running"
                        ? "Running…"
                        : run.phase === "awaiting-approval"
                          ? "Paused: waiting for a person."
                          : `Finished · ${run.log.length} steps · ${(run.log.reduce((sum, entry) => sum + (entry.ms ?? 0), 0) / 1000).toFixed(1)} s · $${runCost.toFixed(2)}`}
                  </p>
                  <div className="flex gap-2">
                    {run.phase !== "idle" ? (
                      <Button onClick={run.reset} size="sm" variant="ghost">
                        <RotateCcw aria-hidden="true" />
                        Clear
                      </Button>
                    ) : null}
                    <Button
                      disabled={!trigger || run.phase === "running"}
                      onClick={run.start}
                      size="sm"
                      variant="outline"
                    >
                      <Play aria-hidden="true" />
                      {run.phase === "idle" ? "Start" : "Run again"}
                    </Button>
                  </div>
                </div>
                <ol className="flex flex-col divide-y divide-border-strong">
                  {run.log.map((entry) => (
                    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2" key={entry.id}>
                      <StatusBadge size="sm" status={entry.status} />
                      <button
                        className="rounded-sm text-caption font-medium focus-ring hover:underline"
                        onClick={() => select(entry.nodeId)}
                        type="button"
                      >
                        {entry.title}
                      </button>
                      <span className="min-w-0 flex-1 truncate text-meta text-muted-foreground">
                        {entry.detail}
                      </span>
                      {entry.status === "awaiting-approval" ? (
                        <span className="flex gap-1.5">
                          <Button onClick={() => run.decide(true)} size="sm">
                            Approve
                          </Button>
                          <Button onClick={() => run.decide(false)} size="sm" variant="outline">
                            Reject
                          </Button>
                        </span>
                      ) : (
                        <span className="text-meta text-muted-foreground tabular-nums">
                          {entry.ms ? `${(entry.ms / 1000).toFixed(1)} s` : ""}
                          {entry.usd ? ` · $${entry.usd.toFixed(2)}` : ""}
                        </span>
                      )}
                    </li>
                  ))}
                </ol>
              </TabsContent>
            </Tabs>
          ) : null}
        </div>

        {/* ---- Inspector ---- */}
        <InspectorPanel
          emptyMessage="Select a node to edit it."
          hasSelection={Boolean(selected)}
          onClose={
            selected
              ? () => setNodes((current) => current.map((node) => ({ ...node, selected: false })))
              : undefined
          }
          open={Boolean(selected)}
          selectionKey={selected?.id}
          title={selected ? nodeTitle(selected.data) : "Details"}
          width="23rem"
        >
          {selected ? (
            <NodeInspector
              equipment={selected.data.kind === "agent" ? equipmentOf(selected.id) : []}
              node={selected}
              onChange={updateSelected}
              onDelete={removeSelected}
              onDetach={(nodeId) => removeNodes([nodeId])}
              onSelect={select}
              usedBy={nodes.filter((node) =>
                edges.some(
                  (edge) =>
                    edge.data?.link === "attach" &&
                    edge.target === selected.id &&
                    edge.source === node.id,
                ),
              )}
            />
          ) : null}
        </InspectorPanel>
      </div>
    </div>
  );
}
