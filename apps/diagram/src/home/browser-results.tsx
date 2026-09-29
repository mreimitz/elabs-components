import {
  Button,
  Card,
  Image,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Text,
} from "@elabs-ai/components-ui";
import type { MouseEvent } from "react";
import { toHash } from "../routes/use-hash";
import { splitCopySuffix } from "./templates";
import { Boxes, Eye, FileBox, LayoutTemplate } from "lucide-react";
import { ArchMark } from "../nodes/arch-mark";
import { NoPreview } from "./no-preview";
import type { BrowseItem, BrowserResults } from "./browser-model";

const LABELS = {
  name: "Name",
  type: "Type",
  locationVendor: "Location / vendor",
  actions: "Actions",
} as const;

export const kindLabel = (item: BrowseItem) =>
  item.kind === "catalog"
    ? item.catalog.part
      ? "Part"
      : "Product"
    : item.kind === "component"
      ? "Component"
      : item.kind === "template"
        ? "Template"
        : "Diagram";
const ItemIcon = ({ item }: { item: BrowseItem }) =>
  item.kind === "component" ? (
    <Boxes aria-hidden="true" className="size-4" />
  ) : item.kind === "template" ? (
    <LayoutTemplate aria-hidden="true" className="size-4" />
  ) : (
    <FileBox aria-hidden="true" className="size-4" />
  );
const location = (item: BrowseItem) =>
  item.source === "catalog" ? item.vendor : item.folder || "Workspace";
const dateLabel = (value: number | null | undefined) =>
  value
    ? new Intl.DateTimeFormat(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      }).format(value)
    : "—";
type Result = BrowserResults["items"][number];

function ItemTitle({
  item,
  onOpen,
  card = false,
}: {
  item: BrowseItem;
  onOpen: (item: BrowseItem) => void;
  card?: boolean;
}) {
  const { base, marker } = splitCopySuffix(item.title);
  const className = `focus-ring min-w-0 max-w-full rounded-sm text-start text-body font-medium text-foreground ${card ? "after:absolute after:inset-0 after:rounded-lg" : ""}`;
  const children = (
    <>
      <span className="line-clamp-2 break-words">{base}</span>
      {marker ? <span className="block text-meta">{marker}</span> : null}
    </>
  );
  if (item.kind === "template")
    return (
      <button type="button" className={className} title={item.title} onClick={() => onOpen(item)}>
        {children}
      </button>
    );
  const href =
    item.source === "catalog"
      ? toHash({ kind: "catalog", vendor: item.vendor, entry: item.catalog.slug })
      : toHash({ kind: "doc", path: item.path });
  const activate = (event: MouseEvent<HTMLAnchorElement>) => {
    if (
      !event.metaKey &&
      !event.ctrlKey &&
      !event.shiftKey &&
      !event.altKey &&
      event.button === 0
    ) {
      event.preventDefault();
      onOpen(item);
    }
  };
  return (
    <a href={href} title={item.title} className={className} onClick={activate}>
      {children}
    </a>
  );
}

function Match({ result }: { result: Result }) {
  if (!result.match) return null;
  const reasons = [...(result.match.reasons ?? [])];
  // Title-only matches need a visible excerpt too when the full title is clamped on a phone.
  if (result.match.titleRanges?.length)
    reasons.unshift({ field: "title", text: result.item.title, ranges: result.match.titleRanges });
  return (
    <div className="flex flex-col gap-1">
      {reasons.map((reason) => (
        <Text
          key={`${reason.field}:${reason.text}`}
          variant="meta"
          tone="muted"
          className="break-words"
        >
          {reason.field}:{" "}
          {reason.ranges.map((range, ri) => {
            const start = Math.max(0, range.start - 18);
            const end = Math.min(reason.text.length, range.end + 28);
            return (
              <span key={range.start}>
                {ri ? " · " : ""}
                {start ? "…" : ""}
                {reason.text.slice(start, range.start)}
                <mark className="rounded-sm bg-accent text-accent-foreground">
                  {reason.text.slice(range.start, range.end)}
                </mark>
                {reason.text.slice(range.end, end)}
                {end < reason.text.length ? "…" : ""}
              </span>
            );
          })}
        </Text>
      ))}
    </div>
  );
}

export interface BrowserResultsViewProps {
  results: BrowserResults["items"];
  layout: "grid" | "table";
  recent: boolean;
  onOpen: (item: BrowseItem) => void;
  onPreview: (item: BrowseItem) => void;
}

export function BrowserResultsView({
  results,
  layout,
  recent,
  onOpen,
  onPreview,
}: BrowserResultsViewProps) {
  const catalogOnly =
    results.length > 0 && results.every((result) => result.item.source === "catalog");
  if (layout === "table")
    return (
      <div className="rounded-lg border border-border bg-card [&>[data-slot=table-scroll-region]]:overflow-visible">
        <Table className="table-fixed">
          <TableHeader className="sticky top-0 z-10 bg-background">
            <TableRow>
              <TableHead className="w-3/5 sm:w-2/5">{LABELS.name}</TableHead>
              <TableHead>{LABELS.type}</TableHead>
              <TableHead className="hidden md:table-cell">{LABELS.locationVendor}</TableHead>
              <TableHead className="hidden lg:table-cell">
                {recent ? "Last opened" : catalogOnly ? "Capability" : "Modified"}
              </TableHead>
              <TableHead className="w-12">
                <span className="sr-only">{LABELS.actions}</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {results.map((result) => {
              const { item } = result;
              return (
                <TableRow key={item.id} data-slot="browser-result" data-resource-id={item.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <span className="hidden shrink-0 sm:flex">
                        {item.source === "catalog" ? (
                          <ArchMark icon={item.icon} size={28} />
                        ) : (
                          <ItemIcon item={item} />
                        )}
                      </span>
                      <div className="min-w-0">
                        <ItemTitle item={item} onOpen={onOpen} />
                        <Match result={result} />
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Text variant="meta" tone="muted">
                      {kindLabel(item)}
                    </Text>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <Text variant="meta" tone="muted" className="truncate" title={location(item)}>
                      {location(item)}
                    </Text>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <Text variant="meta" tone="muted">
                      {!recent && catalogOnly && item.source === "catalog"
                        ? item.capability || item.catalog.kind || "—"
                        : dateLabel(
                            recent
                              ? result.openedAt
                              : item.source === "workspace"
                                ? item.mtime
                                : null,
                          )}
                    </Text>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Preview ${item.title}`}
                      onClick={() => onPreview(item)}
                    >
                      <Eye aria-hidden="true" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    );
  return (
    <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,13rem),1fr))] gap-3">
      {results.map((result) => {
        const { item } = result;
        return (
          <li key={item.id} className="min-w-0">
            <Card
              data-slot="browser-result"
              data-resource-id={item.id}
              className="relative flex h-full min-w-0 flex-col overflow-hidden"
            >
              {item.source === "workspace" ? (
                <div className="h-32 overflow-hidden bg-surface-muted">
                  <Image
                    src={item.thumbnail}
                    alt=""
                    fit="contain"
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full"
                    fallback={
                      <NoPreview
                        icon={
                          item.kind === "component"
                            ? Boxes
                            : item.kind === "template"
                              ? LayoutTemplate
                              : FileBox
                        }
                      />
                    }
                  />
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3 px-4 pt-4">
                  <div className="flex size-10 items-center justify-center rounded-lg bg-surface-muted">
                    <ArchMark icon={item.icon} size={28} />
                  </div>
                  <Text variant="meta" tone="muted">
                    {kindLabel(item)}
                  </Text>
                </div>
              )}
              <div className="flex min-w-0 flex-1 flex-col gap-2 p-4">
                <div className="flex items-start justify-between gap-2">
                  <ItemTitle item={item} onOpen={onOpen} card />
                  <Button
                    className="relative shrink-0"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Preview ${item.title}`}
                    onClick={() => onPreview(item)}
                  >
                    <Eye aria-hidden="true" />
                  </Button>
                </div>
                {item.source === "catalog" ? (
                  <Text
                    variant="caption"
                    tone="muted"
                    className="line-clamp-2 min-h-10 break-words"
                  >
                    {item.description || item.capability || item.catalog.name}
                  </Text>
                ) : null}
                <Match result={result} />
                <div className="mt-auto flex min-w-0 items-center justify-between gap-2 pt-2">
                  <Text variant="meta" tone="muted" className="truncate" title={location(item)}>
                    {location(item)}
                  </Text>
                  {item.source === "workspace" ? (
                    <Text variant="meta" tone="muted" className="shrink-0">
                      {kindLabel(item)}
                    </Text>
                  ) : null}
                </div>
              </div>
            </Card>
          </li>
        );
      })}
    </ul>
  );
}
