/**
 * DG-24 — one catalog entry (`#catalog/<vendor>/<slug>`): the mark, the product name, what it
 * is, its docs, kind and tags, and a node to copy into a diagram. Read-only (R1): an icon's
 * entry is corrected and checked in `catalog/<vendor>.yaml`, a part in
 * `catalog/parts/<vendor>.yaml`, by hand.
 */
import {
  Badge,
  Button,
  Heading,
  StatePanel,
  Text,
  useCopyToClipboard,
} from "@elabs-ai/components-ui";
import { ArchMark } from "../nodes/arch-mark";
import { toHash } from "../routes/use-hash";
import { catalogService, useCatalog, useCatalogEntry, type CatalogEntry } from "./catalog-service";
import { entrySnippet } from "./entry-snippet";

export const ENTRY_LABELS = {
  loading: "Loading the entry…",
  notFound: (name: string) => `No catalog entry “${name}”`,
  didYouMean: (name: string) => `Did you mean ${name}?`,
  backToCatalog: "Back to the catalog",
  noDescription: "No description yet.",
  docs: "Open docs",
  newTab: "(opens in a new tab)",
  docsUnverified: "Docs link not verified",
  curated: "Checked",
  notCurated: "Not checked yet",
  part: "Part",
  snippetHeading: "Use it in a diagram",
  copy: "Copy YAML",
  copied: "Copied",
  aliases: "Also known as",
  tags: "Tags",
  fileHint: (vendor: string) =>
    `To correct this entry or mark it checked, edit catalog/${vendor}.yaml and set curated: true there.`,
  partHint: (vendor: string) =>
    `To correct this part or mark it checked, edit catalog/parts/${vendor}.yaml and set curated: true there.`,
} as const;

/** Only a public https page opens from the catalog (a hand-edited file may hold anything). */
function safeDocs(docs: string | undefined): string | undefined {
  return docs?.startsWith("https://") ? docs : undefined;
}

/** `aws/dynamodb` → the entry page's hash. */
function entryHash(name: string): string {
  const [vendor, entry] = name.split("/");
  return toHash({ kind: "catalog", vendor, entry });
}

export interface EntryViewProps {
  /** `vendor/slug`. */
  name: string;
}

export function EntryView({ name }: EntryViewProps) {
  const entry = useCatalogEntry(name);
  const { loaded } = useCatalog();

  if (!loaded) return <StatePanel kind="loading" title={ENTRY_LABELS.loading} className="flex-1" />;
  if (!entry) {
    const near = catalogService.suggest(name);
    return (
      <StatePanel
        kind="empty"
        titleAs="h2"
        title={ENTRY_LABELS.notFound(name)}
        description={near ? ENTRY_LABELS.didYouMean(near) : undefined}
        actions={
          <Button asChild variant="outline" size="sm">
            <a href={near ? entryHash(near) : toHash({ kind: "catalog" })}>
              {near ?? ENTRY_LABELS.backToCatalog}
            </a>
          </Button>
        }
        className="flex-1"
      />
    );
  }

  const docs = safeDocs(entry.docs);
  return (
    // catalog crumbs (maintainer 2026-09-27): the location (Catalog › vendor › entry id) now
    // reads once, in the top bar (`shell/top-bar.tsx` `TitleCrumbs`) — no in-page breadcrumb.
    <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto p-6" data-slot="entry-view">
      <header className="flex items-start gap-4">
        <ArchMark icon={entry.icon} size={64} />
        <div className="flex min-w-0 flex-col gap-1">
          <Heading level={2} size="title">
            {entry.label}
          </Heading>
          <Text variant="code" tone="muted">
            {entry.name}
          </Text>
          {/* Every badge is text: colour is never the only channel (N11). */}
          <div className="flex flex-wrap gap-2 pt-1">
            {entry.part ? <Badge variant="secondary">{ENTRY_LABELS.part}</Badge> : null}
            {entry.kind ? <Badge variant="outline">{entry.kind}</Badge> : null}
            <Badge variant={entry.curated ? "success" : "outline"}>
              {entry.curated ? ENTRY_LABELS.curated : ENTRY_LABELS.notCurated}
            </Badge>
            {entry.docsUnverified ? (
              <Badge variant="warning">{ENTRY_LABELS.docsUnverified}</Badge>
            ) : null}
          </div>
        </div>
      </header>

      <section className="flex max-w-prose flex-col gap-3">
        <Text>{entry.description ?? ENTRY_LABELS.noDescription}</Text>
        {docs ? (
          <a
            href={docs}
            target="_blank"
            rel="noopener noreferrer"
            className="focus-ring self-start rounded-sm text-primary-text underline underline-offset-4"
          >
            {ENTRY_LABELS.docs}
            {/* The visible new-tab cue (demo script: "Open docs ↗"); the words are for AT. */}
            <span aria-hidden="true"> ↗</span>
            <span className="sr-only"> {ENTRY_LABELS.newTab}</span>
          </a>
        ) : null}
        {entry.tags.length > 0 ? (
          <Text variant="caption" tone="muted">
            {ENTRY_LABELS.tags}: {entry.tags.join(", ")}
          </Text>
        ) : null}
        {entry.aliases.length > 0 ? (
          <Text variant="caption" tone="muted">
            {ENTRY_LABELS.aliases}: {entry.aliases.join(", ")}
          </Text>
        ) : null}
        <Text variant="caption" tone="muted">
          {entry.part ? ENTRY_LABELS.partHint(entry.vendor) : ENTRY_LABELS.fileHint(entry.vendor)}
        </Text>
      </section>

      <Snippet entry={entry} />

      {/* "Used in" waits for DG-23 (R1 cut its search index; the source is decided when DG-23
          is re-hardened — a scan of the workspace tree is enough). DG-24 step 7.4, Deferred. */}
    </div>
  );
}

function Snippet({ entry }: { entry: CatalogEntry }) {
  const { copied, copy } = useCopyToClipboard();
  const text = entrySnippet(entry);
  return (
    <section aria-labelledby="entry-snippet" className="flex max-w-prose flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <Heading id="entry-snippet" level={3} size="subtitle">
          {ENTRY_LABELS.snippetHeading}
        </Heading>
        <Button type="button" variant="outline" size="sm" onClick={() => void copy(text)}>
          {copied ? ENTRY_LABELS.copied : ENTRY_LABELS.copy}
        </Button>
      </div>
      <pre className="overflow-x-auto rounded-md bg-muted p-3 text-code font-mono">{text}</pre>
    </section>
  );
}
