import { useId } from "react";
import type { Node } from "@elabs-ai/components-flow";
import { Text } from "@elabs-ai/components-ui";
import { useCatalogEntry } from "../catalog/catalog-service";
import { catalogNameOfNode, resolveNodeDetails } from "./node-details";
import { CardBody } from "./details-card";
export function ReadonlyNodeDetails({ node }: { node: Node }) {
  const id = useId();
  const entry = useCatalogEntry(catalogNameOfNode(node));
  const iconEntry = useCatalogEntry(entry?.part ? entry.icon : undefined);
  const details = resolveNodeDetails(node, entry, iconEntry);
  return (
    <div className="flex flex-col gap-2" data-slot="readonly-node-details">
      {details ? (
        <CardBody details={details} titleId={id} />
      ) : (
        <Text>{String(node.data.title ?? node.id)}</Text>
      )}
    </div>
  );
}
