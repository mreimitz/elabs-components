// registry: data-model-viewer-01 — copied 2026-09-20
/**
 * The shape the viewer reads. Bring your own: introspect `information_schema`, parse a
 * dbt manifest or a Prisma schema, and map it to this. Nothing here knows about a database.
 */

export type ColumnKey = "pk" | "fk" | "unique";

export interface ModelColumn {
  name: string;
  /** The type as your dialect spells it: `uuid`, `numeric(12,2)`, `timestamptz`. */
  type: string;
  keys?: ColumnKey[];
  nullable?: boolean;
  /** Personal data. Shown as a word and a glyph, never colour alone. */
  pii?: boolean;
  description?: string;
}

export interface ModelIndex {
  name: string;
  columns: string[];
  unique?: boolean;
}

export interface ModelTable {
  /** Stable id, `schema.name` by convention. */
  id: string;
  schema: string;
  name: string;
  kind: "table" | "view" | "fact" | "dimension";
  description: string;
  /** Approximate row count, for scale. */
  rows: number;
  owner: string;
  columns: ModelColumn[];
  indexes?: ModelIndex[];
}

export interface ModelRelation {
  id: string;
  /** The referencing side — the foreign key, the "many" end. */
  from: { table: string; column: string };
  /** The referenced side — the key it points at, the "one" end. */
  to: { table: string; column: string };
  /** `many-to-one` is an ordinary foreign key; `one-to-one` is a foreign key that is also unique. */
  cardinality: "many-to-one" | "one-to-one";
  /** The foreign key is nullable: the row may point at nothing. */
  optional?: boolean;
  onDelete?: "cascade" | "restrict" | "set null";
}

export interface DataModel {
  name: string;
  dialect: string;
  description: string;
  tables: ModelTable[];
  relations: ModelRelation[];
}

const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });

export const formatRows = (rows: number) => compact.format(rows);

export const relationsOf = (model: DataModel, tableId: string) =>
  model.relations.filter(
    (relation) => relation.from.table === tableId || relation.to.table === tableId,
  );

/** Tables one relation away from `tableId`, plus the table itself. */
export function neighbourhood(model: DataModel, tableId: string): Set<string> {
  const ids = new Set<string>([tableId]);
  for (const relation of relationsOf(model, tableId)) {
    ids.add(relation.from.table);
    ids.add(relation.to.table);
  }
  return ids;
}

export const describeRelation = (relation: ModelRelation) =>
  relation.cardinality === "one-to-one"
    ? `one ${relation.optional ? "optional " : ""}to one`
    : `many to ${relation.optional ? "zero or one" : "one"}`;

/** A readable `CREATE TABLE`, for the inspector. Illustrative, not a migration. */
export function toDdl(model: DataModel, table: ModelTable): string {
  const width = Math.max(...table.columns.map((column) => column.name.length));
  const lines = table.columns.map((column) => {
    const parts = [column.name.padEnd(width), column.type];
    if (column.keys?.includes("pk")) parts.push("PRIMARY KEY");
    else if (!column.nullable) parts.push("NOT NULL");
    if (column.keys?.includes("unique")) parts.push("UNIQUE");
    return `  ${parts.join(" ")}`;
  });
  for (const relation of model.relations.filter((item) => item.from.table === table.id)) {
    const target = model.tables.find((item) => item.id === relation.to.table);
    if (!target) continue;
    lines.push(
      `  FOREIGN KEY (${relation.from.column}) REFERENCES ${target.schema}.${target.name} (${relation.to.column})` +
        (relation.onDelete ? ` ON DELETE ${relation.onDelete.toUpperCase()}` : ""),
    );
  }
  const noun = table.kind === "view" ? "VIEW" : "TABLE";
  return `CREATE ${noun} ${table.schema}.${table.name} (\n${lines.join(",\n")}\n);`;
}
