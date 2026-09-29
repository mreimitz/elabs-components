import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
  Badge,
  Button,
  Heading,
  StatePanel,
  Text,
  toast,
  useCopyToClipboard,
} from "@elabs-ai/components-ui";
import { Copy, ExternalLink, FilePlus } from "lucide-react";
import { ArchMark } from "../nodes/arch-mark";
import { entrySnippet } from "../catalog/entry-snippet";
import { currentCatalog } from "../catalog/catalog-bundle";
import { CompiledPreview } from "../interaction/component-preview";
import { compileText, type CompiledDiagram } from "../state/compile-text";
import { currentComponentFiles } from "../state/component-files";
import { preloadComponents } from "../workspace/component-loader";
import { activateSearchIndex, indexStore } from "../workspace/search-index";
import { topLevelDescription } from "./yaml-field";
import { componentStem } from "./component-usage";
import { toHash } from "../routes/use-hash";
import { readFile } from "../workspace/client";
import { openDoc } from "../shell/mode-store";
import { useWorkspace } from "../workspace/workspace-store";
import { createAndOpen, copyTemplate } from "./start-from";
import type { BrowseItem } from "./browser-model";

const LABELS = {
  alsoKnownAs: "Also known as",
  newTab: "(opens in a new tab)",
  usage: "Used in",
  noUsage: "Not used in any indexed diagrams.",
  usageLoading: "Finding component usage…",
  usagePartial: "Some files could not be read; this list may be incomplete.",
  noProductIcon: "No product icon",
  copyReference: "Copy reference",
  openDocs: "Open docs",
  documentationLinkHasNotBeenVerified: "Documentation link has not been verified.",
  useInADiagram: "Use in a diagram",
  copyYaml: "Copy YAML",
  createFromTemplate: "Create from template",
  openDiagram: "Open diagram",
  loadingPreview: "Loading preview…",
  previewUnavailable: "Preview unavailable",
  yamlSnippet: "YAML snippet",
} as const;

function CopyAction({ text, children }: { text: string; children: string }) {
  const { copied, copy } = useCopyToClipboard();
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() =>
        void copy(text).then((ok) => {
          if (!ok)
            toast.error("Could not copy", {
              description: "Select the reference or YAML below and copy it manually.",
            });
        })
      }
    >
      <Copy aria-hidden="true" />
      {copied ? "Copied" : children}
    </Button>
  );
}

/** A single live canvas, mounted only after a deliberate preview action. */
function DocumentPreview({ item }: { item: Extract<BrowseItem, { source: "workspace" }> }) {
  const [result, setResult] = useState<{
    compiled: CompiledDiagram | null;
    description?: string;
    error?: string;
  } | null>(null);
  useEffect(() => {
    let cancelled = false;
    setResult(null);
    void readFile(item.path)
      .then(async ({ text }) => {
        if (cancelled) return;
        const files = await preloadComponents(text, () => !cancelled, currentComponentFiles());
        if (cancelled || !files) return;
        const compiled = compileText(text, {
          files,
          catalog: currentCatalog(),
        });
        setResult({
          compiled,
          description:
            topLevelDescription(text, ["component", "description"]) ||
            topLevelDescription(text, ["description"]),
        });
      })
      .catch((error) => {
        if (!cancelled)
          setResult({
            compiled: null,
            error: error instanceof Error ? error.message : "The file could not be read.",
          });
      });
    return () => {
      cancelled = true;
    };
  }, [item.path, item.mtime]);
  if (!result)
    return <StatePanel kind="loading" title={LABELS.loadingPreview} className="min-h-44" />;
  if (result.error)
    return <StatePanel kind="error" title={LABELS.previewUnavailable} description={result.error} />;
  return (
    <>
      <CompiledPreview
        compiled={result.compiled}
        title={item.title}
        identity={`${item.id}:${item.mtime}`}
      />
      {result.description && !item.description ? (
        <Text className="whitespace-pre-wrap break-words">{result.description}</Text>
      ) : null}
    </>
  );
}

function ComponentUsage({ path }: { path: string }) {
  const index = useSyncExternalStore(indexStore.subscribe, indexStore.get);
  useEffect(() => {
    activateSearchIndex();
  }, []);
  const reference = `ws/components/${componentStem(path)}`;
  const usage = index.entries.filter(
    (entry) =>
      entry.path !== path &&
      entry.boxes.some(
        (box) => (box.ref ?? box.component ?? "").replace(/\.ya?ml$/i, "") === reference,
      ),
  );
  return (
    <section className="flex flex-col gap-3">
      <Heading level={3} size="subtitle">
        {LABELS.usage}
        {index.ready ? ` ${usage.length} ${usage.length === 1 ? "diagram" : "diagrams"}` : ""}
      </Heading>
      {!index.ready ? (
        <Text role="status" variant="caption" tone="muted">
          {LABELS.usageLoading}
        </Text>
      ) : usage.length === 0 ? (
        <Text variant="caption" tone="muted">
          {LABELS.noUsage}
        </Text>
      ) : (
        <ul className="flex flex-col gap-2">
          {usage.map((entry) => (
            <li key={entry.path}>
              <a
                href={toHash({ kind: "doc", path: entry.path })}
                onClick={(event) => {
                  if (!event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
                    event.preventDefault();
                    openDoc(entry.path, { mode: "view" });
                  }
                }}
                className="focus-ring block rounded-sm text-body underline underline-offset-4"
              >
                {entry.title}
              </a>
              <Text variant="meta" tone="muted">
                {entry.folder || "Workspace"}
              </Text>
            </li>
          ))}
        </ul>
      )}
      {index.errors.length > 0 ? (
        <Text variant="caption" tone="muted">
          {LABELS.usagePartial}
        </Text>
      ) : null}
    </section>
  );
}

export function BrowserPreview({ item }: { item: BrowseItem }) {
  const tree = useWorkspace((state) => state.tree);
  const [pending, setPending] = useState(false);
  const catalog = item.source === "catalog" ? item.catalog : null;
  const snippet = useMemo(() => (catalog ? entrySnippet(catalog) : ""), [catalog]);
  const useTemplate = () => {
    if (pending || item.source !== "workspace") return;
    const file = tree?.files.find((file) => file.path === item.path);
    if (!file) {
      toast.error("Template is no longer available");
      return;
    }
    setPending(true);
    void createAndOpen(() =>
      copyTemplate({ file, label: item.title, description: item.description, text: null }),
    ).finally(() => setPending(false));
  };
  return (
    <div data-slot="entry-view" className="flex min-w-0 flex-col gap-6">
      {catalog ? (
        <div className="flex items-center gap-4 rounded-lg bg-surface-muted p-6">
          <ArchMark icon={catalog.icon} size={64} />
          <div className="min-w-0">
            <Text variant="caption" tone="muted">
              {catalog.vendor}
            </Text>
            <Text className="break-words">
              {catalog.capability ||
                catalog.kind ||
                (catalog.part ? "Reusable part" : "Catalog product")}
            </Text>
          </div>
        </div>
      ) : (
        <DocumentPreview item={item as Extract<BrowseItem, { source: "workspace" }>} />
      )}
      <div className="flex flex-wrap gap-2">
        <Badge variant="secondary">
          {catalog
            ? catalog.part
              ? "Part"
              : "Product"
            : item.kind === "template"
              ? "Template"
              : item.kind === "component"
                ? "Component"
                : "Diagram"}
        </Badge>
        {catalog?.kind ? <Badge variant="outline">{catalog.kind}</Badge> : null}
        {catalog?.generic ? <Badge variant="outline">{LABELS.noProductIcon}</Badge> : null}
      </div>
      {item.description ? (
        <Text className="whitespace-pre-wrap break-words">{item.description}</Text>
      ) : null}
      <div className="flex flex-col gap-2">
        <Text variant="meta" tone="muted">
          {catalog ? "Reference" : "Location"}
        </Text>
        <Text variant="code" className="break-all" translate="no">
          {catalog?.name ?? (item.source === "workspace" ? item.path : "")}
        </Text>
      </div>
      {item.source === "workspace" && item.kind === "component" ? (
        <ComponentUsage path={item.path} />
      ) : null}
      {catalog ? (
        <>
          {catalog.tags.length ? (
            <div className="flex flex-wrap gap-1.5">
              {catalog.tags.map((tag) => (
                <Badge key={tag} variant="outline">
                  {tag}
                </Badge>
              ))}
            </div>
          ) : null}
          {catalog.aliases.length ? (
            <Text variant="caption" tone="muted">
              {LABELS.alsoKnownAs} {catalog.aliases.join(", ")}
            </Text>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <CopyAction text={catalog.name}>{LABELS.copyReference}</CopyAction>
            {catalog.docs?.startsWith("https://") ? (
              <Button asChild variant="outline" size="sm">
                <a href={catalog.docs} target="_blank" rel="noopener noreferrer">
                  {LABELS.openDocs}
                  <ExternalLink aria-hidden="true" />
                  <span className="sr-only"> {LABELS.newTab}</span>
                </a>
              </Button>
            ) : null}
          </div>
          {catalog.docsUnverified ? (
            <Text variant="caption" tone="muted">
              {LABELS.documentationLinkHasNotBeenVerified}
            </Text>
          ) : null}
          <section className="flex min-w-0 flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <Heading level={3} size="subtitle">
                {LABELS.useInADiagram}
              </Heading>
              <CopyAction text={snippet}>{LABELS.copyYaml}</CopyAction>
            </div>
            <pre
              tabIndex={0}
              aria-label={LABELS.yamlSnippet}
              className="focus-ring overflow-x-auto rounded-md bg-surface-muted p-4 text-code font-mono"
            >
              {snippet}
            </pre>
          </section>
        </>
      ) : (
        <Button
          onClick={
            item.kind === "template"
              ? useTemplate
              : () => {
                  if (item.source === "workspace") openDoc(item.path, { mode: "view" });
                }
          }
          aria-disabled={pending}
        >
          {item.kind === "template" ? (
            <>
              <FilePlus aria-hidden="true" />
              {LABELS.createFromTemplate}
            </>
          ) : (
            <>
              {LABELS.openDiagram}
              <ExternalLink aria-hidden="true" />
            </>
          )}
        </Button>
      )}
    </div>
  );
}
