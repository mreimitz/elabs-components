import { isMap, isScalar, parseDocument } from "yaml";
import schemaJson from "../../schema/arch-diagram.v1.schema.json";
import type { YamlPath } from "./yaml-context";

export type Schema = {
  $ref?: string;
  properties?: Record<string, Schema>;
  items?: Schema;
  anyOf?: Schema[];
  oneOf?: Schema[];
  enum?: (string | number | boolean)[];
  type?: string;
  description?: string;
  additionalProperties?: Schema | boolean;
  $defs?: Record<string, Schema>;
  then?: Schema;
  else?: Schema;
  patternProperties?: Record<string, Schema>;
};
const ROOT = schemaJson as Schema;
function variants(schema: Schema): Schema[] {
  if (schema.$ref) return variants(ROOT.$defs?.[schema.$ref.split("/").at(-1)!] ?? {});
  return [schema, ...(schema.anyOf ?? schema.oneOf ?? []).flatMap(variants)];
}
export function schemasAt(path: YamlPath, text = ""): Schema[] {
  const root = parseDocument(text).contents;
  const layout: unknown = isMap(root) ? root.get("layout", true) : undefined;
  const branch = isScalar(layout) && layout.value === "manual" ? ROOT.then : ROOT.else;
  let found = variants({ ...ROOT, properties: { ...ROOT.properties, ...branch?.properties } });
  for (const part of path)
    found = found.flatMap((schema) => {
      const next =
        typeof part === "number"
          ? schema.items
          : (schema.properties?.[part] ??
            Object.entries(schema.patternProperties ?? {}).find(([pattern]) =>
              new RegExp(pattern).test(part),
            )?.[1] ??
            (typeof schema.additionalProperties === "object"
              ? schema.additionalProperties
              : undefined));
      return next ? variants(next) : [];
    });
  return found;
}
