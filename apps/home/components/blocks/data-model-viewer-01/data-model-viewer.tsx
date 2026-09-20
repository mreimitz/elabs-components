// registry: data-model-viewer-01 — copied 2026-09-20
/**
 * Data model viewer (copy-owned block).
 *
 * An entity-relationship view of a database: every table is a custom canvas node
 * (`table-node.tsx`), every foreign key a custom edge with crow’s-foot end marks
 * (`relation-edge.tsx`). Around the canvas: a table list grouped by schema with search and
 * per-schema visibility, a detail switch (all columns, keys only, names only), auto-layout,
 * and an inspector for the table or relation in focus — columns, relations you can follow,
 * indexes and a readable `CREATE TABLE`.
 *
 * It renders a `DataModel` (`model.ts`) and nothing else: no connection, no introspection.
 * Map your catalogue, dbt manifest or ORM schema to that shape and pass it as `model`.
 *
 * Remember to `import "@xyflow/react/dist/style.css"` once at the app root.
 */
"use client";

import { useCallback, useMemo, useState } from "react";
import { ArrowRight, Eye, EyeOff, LayoutGrid, Maximize, ShieldAlert } from "lucide-react";
import { SearchInput } from "@elabs-ai/components-data";
import {
  CanvasShell,
  ConnectionMode,
  FlowMiniMap,
  InspectorPanel,
  layoutFlow,
  ReactFlowProvider,
  useNodesState,
  useReactFlow,
  ZoomControls,
  type EdgeChange,
  type NodeChange,
  type OnSelectionChangeParams,
} from "@elabs-ai/components-flow";
import { useReducedMotion } from "@elabs-ai/components-tokens";
import {
  Badge,
  Button,
  cn,
  CopyableValue,
  Descriptions,
  DescriptionsItem,
  IconButton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  ToggleGroup,
  ToggleGroupItem,
} from "@elabs-ai/components-ui";
import { ORDER_TO_CASH, ORDER_TO_CASH_POSITIONS } from "./data/order-to-cash";
import {
  describeRelation,
  formatRows,
  neighbourhood,
  relationsOf,
  toDdl,
  type DataModel,
  type ModelRelation,
  type ModelTable,
} from "./model";
import { RelationEdge, type RelationFlowEdge } from "./relation-edge";
import { TableNode, tableHandleId, type TableDetail, type TableFlowNode } from "./table-node";

const nodeTypes = { table: TableNode };
const edgeTypes = { relation: RelationEdge };

/** Schema rails cycle through the categorical chart tokens; the schema name is always written too. */
const SCHEMA_ACCENTS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-11)",
  "var(--chart-7)",
];

/** The painted width of `TableNode` (`w-64`) and its row metrics, for the first layout pass. */
const NODE_WIDTH = 256;
const estimateHeight = (table: ModelTable, detail: TableDetail) => {
  const rows =
    detail === "columns"
      ? table.columns.length
      : detail === "keys"
        ? table.columns.filter((column) => column.keys?.length).length + 1
        : 1;
  return 60 + rows * 26;
};

type Focus = { kind: "table"; id: string } | { kind: "relation"; id: string } | null;

export interface DataModelViewerProps {
  /** The model to draw. Defaults to the order-to-cash sample. */
  model?: DataModel;
  /** How much of each table the canvas shows at first. */
  defaultDetail?: TableDetail;
  /** A table id to open in the inspector at first. */
  defaultSelectedTable?: string;
  /** Hand-placed positions by table id. Tables without one are laid out automatically. */
  positions?: Record<string, { x: number; y: number }>;
  className?: string;
}

export function DataModelViewer(props: DataModelViewerProps) {
  // The rail, the toolbar and the inspector all drive the canvas, so the flow's store
  // has to be above all of them — not just around the canvas.
  return (
    <ReactFlowProvider>
      <Viewer {...props} />
    </ReactFlowProvider>
  );
}

function initialNodes(
  model: DataModel,
  detail: TableDetail,
  positions: DataModelViewerProps["positions"],
  selected?: string,
): TableFlowNode[] {
  const schemas = [...new Set(model.tables.map((table) => table.schema))];
  const bare = model.tables.map(
    (table): TableFlowNode => ({
      id: table.id,
      type: "table",
      position: positions?.[table.id] ?? { x: 0, y: 0 },
      selected: table.id === selected,
      data: {
        table,
        detail,
        accent: SCHEMA_ACCENTS[schemas.indexOf(table.schema) % SCHEMA_ACCENTS.length]!,
        linkedColumns: model.relations.flatMap((relation) => [
          ...(relation.from.table === table.id ? [relation.from.column] : []),
          ...(relation.to.table === table.id ? [relation.to.column] : []),
        ]),
      },
    }),
  );
  if (positions && model.tables.every((table) => positions[table.id])) return bare;
  // First pass on ESTIMATED sizes (nothing is measured yet); "Tidy up" re-runs it on real ones.
  const sized = bare.map((node) => ({
    ...node,
    width: NODE_WIDTH,
    height: estimateHeight(node.data.table, detail),
  }));
  const edges = model.relations.map((relation) => ({
    id: relation.id,
    source: relation.from.table,
    target: relation.to.table,
  }));
  const laidOut = layoutFlow(sized, edges, { direction: "LR", nodeSpacing: 40, rankSpacing: 120 });
  return bare.map((node, index) => ({
    ...node,
    position: positions?.[node.id] ?? laidOut.nodes[index]!.position,
  }));
}

function Viewer({
  model = ORDER_TO_CASH,
  defaultDetail = "columns",
  defaultSelectedTable,
  positions = model === ORDER_TO_CASH ? ORDER_TO_CASH_POSITIONS : undefined,
  className,
}: DataModelViewerProps) {
  const flow = useReactFlow<TableFlowNode, RelationFlowEdge>();
  const reducedMotion = useReducedMotion();
  const [detail, setDetail] = useState<TableDetail>(defaultDetail);
  const [query, setQuery] = useState("");
  const [hiddenSchemas, setHiddenSchemas] = useState<string[]>([]);
  const [focus, setFocus] = useState<Focus>(
    defaultSelectedTable ? { kind: "table", id: defaultSelectedTable } : null,
  );
  const [nodes, setNodes, onNodesChange] = useNodesState<TableFlowNode>(
    initialNodes(model, defaultDetail, positions, defaultSelectedTable),
  );

  const tableById = useMemo(
    () => new Map(model.tables.map((table) => [table.id, table])),
    [model.tables],
  );
  const schemas = useMemo(
    () => [...new Set(model.tables.map((table) => table.schema))],
    [model.tables],
  );

  /* ---- What is in focus, and what steps back because of it. ---- */

  const needle = query.trim().toLowerCase();
  const matches = useMemo(() => {
    if (!needle) return null;
    return new Set(
      model.tables
        .filter(
          (table) =>
            table.name.toLowerCase().includes(needle) ||
            table.schema.toLowerCase().includes(needle) ||
            table.columns.some((column) => column.name.toLowerCase().includes(needle)),
        )
        .map((table) => table.id),
    );
  }, [model.tables, needle]);

  const focusRelation =
    focus?.kind === "relation" ? model.relations.find((item) => item.id === focus.id) : undefined;
  const lit = useMemo(() => {
    if (focus?.kind === "table") return neighbourhood(model, focus.id);
    if (focusRelation) return new Set([focusRelation.from.table, focusRelation.to.table]);
    return null;
  }, [focus, focusRelation, model]);

  const displayNodes = useMemo(
    () =>
      nodes.map((node): TableFlowNode => {
        const touching =
          focus?.kind === "table"
            ? relationsOf(model, focus.id)
            : focusRelation
              ? [focusRelation]
              : [];
        const highlightedColumns = touching.flatMap((relation) => [
          ...(relation.from.table === node.id ? [relation.from.column] : []),
          ...(relation.to.table === node.id ? [relation.to.column] : []),
        ]);
        return {
          ...node,
          hidden: hiddenSchemas.includes(node.data.table.schema),
          data: {
            ...node.data,
            detail,
            highlightedColumns,
            dimmed:
              (lit !== null && !lit.has(node.id)) || (matches !== null && !matches.has(node.id)),
            lit: lit !== null && lit.has(node.id),
          },
        };
      }),
    [nodes, hiddenSchemas, detail, lit, matches, focus, focusRelation, model],
  );

  /* ---- Relations → edges. Each end picks the side of its table that faces the other. ---- */

  const edges = useMemo(() => {
    const byId = new Map(nodes.map((node) => [node.id, node]));
    const centre = (node: TableFlowNode) =>
      node.position.x + (node.measured?.width ?? NODE_WIDTH) / 2;
    return model.relations.flatMap((relation): RelationFlowEdge[] => {
      const source = byId.get(relation.from.table);
      const target = byId.get(relation.to.table);
      const from = tableById.get(relation.from.table);
      const to = tableById.get(relation.to.table);
      if (!source || !target || !from || !to) return [];
      const delta = centre(target) - centre(source);
      // Stacked tables: leave and arrive on the same side, as a bracket.
      const stacked = Math.abs(delta) < NODE_WIDTH * 0.6;
      const sourceSide = stacked || delta > 0 ? "right" : "left";
      const targetSide = stacked ? "right" : delta > 0 ? "left" : "right";
      const isFocus = focus?.kind === "relation" && focus.id === relation.id;
      const touchesFocus =
        focus?.kind === "table" &&
        (relation.from.table === focus.id || relation.to.table === focus.id);
      return [
        {
          id: relation.id,
          type: "relation",
          source: source.id,
          target: target.id,
          sourceHandle: tableHandleId(relation.from.column, sourceSide),
          targetHandle: tableHandleId(relation.to.column, targetSide),
          selected: isFocus,
          zIndex: isFocus || touchesFocus ? 1 : 0,
          ariaLabel: `${from.name}.${relation.from.column} references ${to.name}.${relation.to.column}, ${describeRelation(relation)}`,
          data: {
            relation,
            highlighted: isFocus || touchesFocus,
            dimmed: focus !== null && !isFocus && !touchesFocus,
            label: isFocus ? `${relation.from.column} → ${relation.to.column}` : undefined,
          },
        },
      ];
    });
  }, [nodes, model.relations, tableById, focus]);

  /* ---- Selection: the canvas and the rail write the same `focus`. ---- */

  const focusTable = useCallback(
    (id: string, reveal = true) => {
      setFocus({ kind: "table", id });
      setNodes((current) => current.map((node) => ({ ...node, selected: node.id === id })));
      if (reveal) {
        void flow.fitView({
          nodes: [...neighbourhood(model, id)].map((tableId) => ({ id: tableId })),
          padding: 0.25,
          maxZoom: 1,
          duration: reducedMotion ? 0 : 300,
        });
      }
    },
    [flow, model, reducedMotion, setNodes],
  );

  const handleNodesChange = useCallback(
    (changes: NodeChange<TableFlowNode>[]) => onNodesChange(changes),
    [onNodesChange],
  );

  const handleSelectionChange = useCallback(({ nodes: picked }: OnSelectionChangeParams) => {
    const first = picked[0];
    if (first) setFocus({ kind: "table", id: first.id });
  }, []);

  // Edges are derived, not state — a keyboard "select" on one arrives here as a change.
  const handleEdgesChange = useCallback((changes: EdgeChange<RelationFlowEdge>[]) => {
    for (const change of changes) {
      if (change.type === "select" && change.selected) {
        setFocus({ kind: "relation", id: change.id });
      }
    }
  }, []);

  const clearFocus = useCallback(() => {
    setFocus(null);
    setNodes((current) => current.map((node) => ({ ...node, selected: false })));
  }, [setNodes]);

  const tidy = () => {
    const visible = flow.getNodes().filter((node) => !node.hidden);
    const result = layoutFlow(
      visible,
      edges.filter((edge) => !edge.hidden),
      { direction: "LR", nodeSpacing: 32, rankSpacing: 80 },
    );
    const placed = new Map(result.nodes.map((node) => [node.id, node.position]));
    setNodes((current) =>
      current.map((node) => ({ ...node, position: placed.get(node.id) ?? node.position })),
    );
    requestAnimationFrame(() => void flow.fitView({ padding: 0.12 }));
  };

  const focusedTable = focus?.kind === "table" ? tableById.get(focus.id) : undefined;
  const piiCount = model.tables.reduce(
    (sum, table) => sum + table.columns.filter((column) => column.pii).length,
    0,
  );

  return (
    <div
      className={cn(
        "flex h-[720px] w-full flex-col overflow-hidden rounded-lg border bg-card text-foreground",
        className,
      )}
      data-slot="data-model-viewer"
    >
      {/* ---- Header: what this is, and the controls that act on the whole canvas. ---- */}
      {/* header-band-exempt: a block toolbar that wraps its controls when narrow; it sits under a shell’s top bar, never beside another band */}
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b px-4 py-2.5">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="truncate text-subtitle font-semibold">{model.name}</h2>
            <Badge variant="secondary">{model.dialect}</Badge>
          </div>
          <p className="truncate text-caption text-muted-foreground">
            {model.tables.length} tables · {model.relations.length} relations · {schemas.length}{" "}
            {schemas.length === 1 ? "schema" : "schemas"} · {piiCount} personal-data columns
          </p>
        </div>
        <ToggleGroup
          aria-label="Table detail"
          onValueChange={(value) => value && setDetail(value as TableDetail)}
          size="sm"
          type="single"
          value={detail}
          variant="segmented"
        >
          <ToggleGroupItem value="columns">All columns</ToggleGroupItem>
          <ToggleGroupItem value="keys">Keys only</ToggleGroupItem>
          <ToggleGroupItem value="names">Names only</ToggleGroupItem>
        </ToggleGroup>
        <div className="flex items-center gap-1">
          <Button onClick={tidy} size="sm" variant="outline">
            <LayoutGrid aria-hidden="true" />
            Tidy up
          </Button>
          <IconButton
            icon={<Maximize aria-hidden="true" />}
            label="Fit the whole model"
            onClick={() => void flow.fitView({ padding: 0.12 })}
            size="icon-sm"
            variant="ghost"
          />
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* ---- Rail: every table, by schema. ---- */}
        <nav
          aria-label="Tables"
          className="flex w-60 shrink-0 flex-col gap-3 overflow-y-auto border-e bg-background p-3"
        >
          <SearchInput
            label="Search tables and columns"
            onValueChange={setQuery}
            placeholder="Search tables, columns…"
            value={query}
          />
          {schemas.map((schema, index) => {
            const hidden = hiddenSchemas.includes(schema);
            const tables = model.tables.filter(
              (table) => table.schema === schema && (matches === null || matches.has(table.id)),
            );
            return (
              <section aria-labelledby={`dmv-schema-${schema}`} key={schema}>
                <div className="flex items-center gap-2 px-1 pb-1">
                  <span
                    aria-hidden="true"
                    className="size-2 shrink-0 rounded-full"
                    style={{ backgroundColor: SCHEMA_ACCENTS[index % SCHEMA_ACCENTS.length] }}
                  />
                  <h3
                    className="flex-1 truncate text-eyebrow text-muted-foreground"
                    id={`dmv-schema-${schema}`}
                  >
                    {schema}
                  </h3>
                  <IconButton
                    aria-pressed={!hidden}
                    icon={hidden ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                    label={hidden ? `Show the ${schema} schema` : `Hide the ${schema} schema`}
                    onClick={() =>
                      setHiddenSchemas((current) =>
                        hidden ? current.filter((item) => item !== schema) : [...current, schema],
                      )
                    }
                    size="icon-sm"
                    variant="ghost"
                  />
                </div>
                <ul className="flex flex-col gap-0.5">
                  {tables.map((table) => (
                    <li key={table.id}>
                      <button
                        aria-current={focusedTable?.id === table.id ? "true" : undefined}
                        className={cn(
                          "flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-start text-body focus-ring",
                          "hover:bg-accent hover:text-accent-foreground",
                          "aria-[current]:bg-accent aria-[current]:font-medium aria-[current]:text-accent-foreground",
                          hidden && "text-muted-foreground",
                        )}
                        disabled={hidden}
                        onClick={() => focusTable(table.id)}
                        type="button"
                      >
                        <span className="min-w-0 truncate font-mono text-caption">
                          {table.name}
                        </span>
                        <span className="shrink-0 text-meta text-muted-foreground tabular-nums">
                          {formatRows(table.rows)}
                        </span>
                      </button>
                    </li>
                  ))}
                  {tables.length === 0 ? (
                    <li className="px-2 py-1 text-caption text-muted-foreground">No match</li>
                  ) : null}
                </ul>
              </section>
            );
          })}
        </nav>

        {/* ---- Canvas ---- */}
        <div className="relative min-w-0 flex-1">
          <CanvasShell<TableFlowNode, RelationFlowEdge>
            connectionMode={ConnectionMode.Loose}
            edgeTypes={edgeTypes}
            edges={edges}
            fitViewOptions={{ padding: 0.12 }}
            minZoom={0.25}
            nodeTypes={nodeTypes}
            nodes={displayNodes}
            nodesConnectable={false}
            onEdgeClick={(_, edge) => {
              setFocus({ kind: "relation", id: edge.id });
              setNodes((current) => current.map((node) => ({ ...node, selected: false })));
            }}
            onEdgesChange={handleEdgesChange}
            onNodesChange={handleNodesChange}
            onPaneClick={clearFocus}
            onSelectionChange={handleSelectionChange}
          >
            <FlowMiniMap
              pannable
              position="bottom-left"
              style={{ width: 132, height: 88 }}
              zoomable
            />
            <ZoomControls />
          </CanvasShell>
        </div>

        {/* ---- Inspector ---- */}
        <InspectorPanel
          emptyMessage="Select a table or a relation to see its details."
          hasSelection={Boolean(focusedTable ?? focusRelation)}
          // Summoned by a selection, gone with it: the canvas keeps the room otherwise.
          open={Boolean(focusedTable ?? focusRelation)}
          onClose={focus ? clearFocus : undefined}
          selectionKey={focus?.id}
          title={
            focusedTable
              ? `${focusedTable.schema}.${focusedTable.name}`
              : focusRelation
                ? "Relation"
                : "Details"
          }
          width="22rem"
        >
          {focusedTable ? (
            <TableDetails model={model} onOpenTable={focusTable} table={focusedTable} />
          ) : focusRelation ? (
            <RelationDetails
              onOpenTable={focusTable}
              relation={focusRelation}
              tableById={tableById}
            />
          ) : null}
        </InspectorPanel>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Inspector bodies                                                            */
/* -------------------------------------------------------------------------- */

function RelationRow({
  relation,
  tableById,
  perspective,
  onOpenTable,
}: {
  relation: ModelRelation;
  tableById: Map<string, ModelTable>;
  /** The table the list belongs to; the row links to the OTHER end. */
  perspective: string;
  onOpenTable: (id: string) => void;
}) {
  const outgoing = relation.from.table === perspective;
  const other = tableById.get(outgoing ? relation.to.table : relation.from.table);
  if (!other) return null;
  return (
    <li>
      <button
        className="flex w-full flex-col gap-0.5 rounded-md border border-border px-3 py-2 text-start hover:bg-accent hover:text-accent-foreground focus-ring"
        onClick={() => onOpenTable(other.id)}
        type="button"
      >
        <span className="flex items-center gap-1.5 font-mono text-caption">
          {outgoing ? relation.from.column : relation.to.column}
          <ArrowRight
            aria-hidden="true"
            className={cn("size-3 shrink-0", !outgoing && "rotate-180")}
          />
          <span className="sr-only">{outgoing ? "references" : "is referenced by"}</span>
          <span className="truncate font-semibold">
            {other.name}.{outgoing ? relation.to.column : relation.from.column}
          </span>
        </span>
        <span className="text-meta text-muted-foreground">
          {outgoing ? describeRelation(relation) : `referenced by many`}
          {relation.onDelete ? ` · on delete ${relation.onDelete}` : ""}
        </span>
      </button>
    </li>
  );
}

function TableDetails({
  model,
  table,
  onOpenTable,
}: {
  model: DataModel;
  table: ModelTable;
  onOpenTable: (id: string) => void;
}) {
  const relations = relationsOf(model, table.id);
  const tableById = new Map(model.tables.map((item) => [item.id, item]));
  const ddl = toDdl(model, table);
  return (
    <div className="flex flex-col gap-4">
      <p className="text-body text-muted-foreground">{table.description}</p>
      <Descriptions columns={2}>
        <DescriptionsItem label="Kind">{table.kind}</DescriptionsItem>
        <DescriptionsItem label="Rows">{formatRows(table.rows)}</DescriptionsItem>
        <DescriptionsItem label="Owner">{table.owner}</DescriptionsItem>
        <DescriptionsItem label="Columns">{table.columns.length}</DescriptionsItem>
      </Descriptions>
      <Tabs defaultValue="columns">
        <TabsList className="w-full">
          <TabsTrigger className="flex-1" value="columns">
            Columns
          </TabsTrigger>
          <TabsTrigger className="flex-1" value="relations">
            Relations ({relations.length})
          </TabsTrigger>
          <TabsTrigger className="flex-1" value="ddl">
            DDL
          </TabsTrigger>
        </TabsList>
        <TabsContent value="columns">
          <ul className="flex flex-col divide-y divide-border-strong">
            {table.columns.map((column) => (
              <li className="flex flex-col gap-0.5 py-2" key={column.name}>
                <span className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate font-mono text-caption font-medium">
                    {column.name}
                  </span>
                  <span className="shrink-0 font-mono text-meta text-muted-foreground">
                    {column.type}
                  </span>
                </span>
                <span className="flex flex-wrap items-center gap-1">
                  {column.keys?.map((key) => (
                    <Badge key={key} variant={key === "pk" ? "default" : "secondary"}>
                      {key === "pk" ? "primary key" : key === "fk" ? "foreign key" : "unique"}
                    </Badge>
                  ))}
                  <Badge variant="outline">{column.nullable ? "nullable" : "not null"}</Badge>
                  {column.pii ? (
                    <Badge variant="destructive">
                      <ShieldAlert aria-hidden="true" className="size-3" />
                      personal data
                    </Badge>
                  ) : null}
                </span>
                {column.description ? (
                  <span className="text-meta text-muted-foreground">{column.description}</span>
                ) : null}
              </li>
            ))}
          </ul>
          {table.indexes?.length ? (
            <section aria-label="Indexes" className="mt-3 flex flex-col gap-1.5">
              <h4 className="text-eyebrow text-muted-foreground">Indexes</h4>
              <ul className="flex flex-col gap-1">
                {table.indexes.map((index) => (
                  <li className="font-mono text-meta" key={index.name}>
                    {index.name}{" "}
                    <span className="text-muted-foreground">
                      ({index.columns.join(", ")}){index.unique ? " unique" : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </TabsContent>
        <TabsContent value="relations">
          {relations.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {relations.map((relation) => (
                <RelationRow
                  key={relation.id}
                  onOpenTable={onOpenTable}
                  perspective={table.id}
                  relation={relation}
                  tableById={tableById}
                />
              ))}
            </ul>
          ) : (
            <p className="text-body text-muted-foreground">This table stands alone.</p>
          )}
        </TabsContent>
        <TabsContent className="flex flex-col gap-2" value="ddl">
          <pre
            className="focus-ring overflow-x-auto rounded-md bg-surface-muted p-3 font-mono text-meta leading-relaxed"
            tabIndex={0}
          >
            {ddl}
          </pre>
          <CopyableValue className="self-start" value={ddl}>
            Copy statement
          </CopyableValue>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function RelationDetails({
  relation,
  tableById,
  onOpenTable,
}: {
  relation: ModelRelation;
  tableById: Map<string, ModelTable>;
  onOpenTable: (id: string) => void;
}) {
  const from = tableById.get(relation.from.table);
  const to = tableById.get(relation.to.table);
  if (!from || !to) return null;
  return (
    <div className="flex flex-col gap-4">
      <p className="text-body">
        Every row of <span className="font-mono font-medium">{from.name}</span> points at{" "}
        {relation.optional ? "at most one row" : "exactly one row"} of{" "}
        <span className="font-mono font-medium">{to.name}</span>
        {relation.cardinality === "one-to-one"
          ? ", and no two rows point at the same one."
          : "; many rows may share it."}
      </p>
      <Descriptions columns={1} layout="horizontal">
        <DescriptionsItem label="Foreign key">
          <span className="font-mono text-caption">
            {from.schema}.{from.name}.{relation.from.column}
          </span>
        </DescriptionsItem>
        <DescriptionsItem label="References">
          <span className="font-mono text-caption">
            {to.schema}.{to.name}.{relation.to.column}
          </span>
        </DescriptionsItem>
        <DescriptionsItem label="Cardinality">{describeRelation(relation)}</DescriptionsItem>
        <DescriptionsItem label="On delete">{relation.onDelete ?? "no action"}</DescriptionsItem>
      </Descriptions>
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => onOpenTable(from.id)} size="sm" variant="outline">
          Open {from.name}
        </Button>
        <Button onClick={() => onOpenTable(to.id)} size="sm" variant="outline">
          Open {to.name}
        </Button>
      </div>
    </div>
  );
}
