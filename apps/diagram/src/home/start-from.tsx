/**
 * DG-23 — "New diagram" and "New from template" (R1 scope box: start-from templates, kept).
 * A new diagram is never an overwrite: `workspaceActions.create`/`createUniqueFile` always pick
 * a free name. Templates are every diagram under `workspace/templates/` (DG-67 ships two); the
 * app cannot compile dialect v1 until DG-26 lands, so a copy opens with a "not supported yet"
 * banner in the editor — expected, and unrelated to this flow, which only has to create the file
 * and open it.
 */
import { useEffect, useState } from "react";
import {
  Button,
  Card,
  CardMedia,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
  Heading,
  Image,
  StatePanel,
  Text,
  toast,
} from "@elabs-ai/components-ui";
import { FilePlus, LayoutTemplate } from "lucide-react";
import { parseDocument } from "yaml";
import { NoPreview } from "./no-preview";
import { thumbSrc } from "./thumbnail";
import { focusDocTab } from "../shell/focus";
import { fileTitle, openDoc } from "../shell/mode-store";
import { createUniqueFile, readFile, type WorkspaceFile } from "../workspace/client";
import { workspaceActions } from "../workspace/workspace-store";

/** The flow's strings, in one place (`conventions/i18n-strings`). */
export const START_LABELS = {
  newDiagram: "New diagram",
  untitled: "Untitled diagram",
  newFromTemplate: "New from template",
  templatePickerTitle: "Start from a template",
  templatePickerDescription: "A copy goes into workspace/customers/ and opens for editing.",
  createFailed: "Could not create the diagram",
  noTemplates: "No templates yet",
  noTemplatesHint: "A diagram saved under templates/ shows up here.",
} as const;

/** New copies land here (DECISIONS 2026-09-28), created on first write if it does not exist. */
const CUSTOMERS_FOLDER = "customers";

/** Every template lives directly under this folder (DECISIONS 2026-09-28). */
const TEMPLATES_FOLDER = "templates";

/** A path's file name without its extension: `templates/foo.yaml` → `foo`. */
function fileStem(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1).replace(/\.ya?ml$/i, "");
}

/** The top-level `description:`, read as plain YAML (dialect v1 does not compile until DG-26). */
function templateDescription(text: string): string {
  try {
    const raw = parseDocument(text).toJS() as { description?: unknown } | null;
    const description = raw?.description;
    return typeof description === "string" ? description.trim() : "";
  } catch {
    return "";
  }
}

/** Create (or copy), then open in edit mode and focus its tab; a failure toasts. */
async function createAndOpen(create: () => Promise<string>): Promise<void> {
  try {
    const path = await create();
    openDoc(path, { mode: "edit" });
    focusDocTab(path);
  } catch (error) {
    toast.error(START_LABELS.createFailed, {
      description: error instanceof Error ? error.message : String(error),
    });
  }
}

export interface TemplateEntry {
  file: WorkspaceFile;
  label: string;
  description: string;
  /** Already read while building the description; `copyTemplate` reuses it. */
  text: string;
}

function templateFiles(files: readonly WorkspaceFile[] | undefined): WorkspaceFile[] {
  return (files ?? []).filter(
    (file) => file.kind === "diagram" && file.path.startsWith(`${TEMPLATES_FOLDER}/`),
  );
}

/** Reads every template's text (for its label and description) while the picker is open. */
function useTemplateEntries(
  files: readonly WorkspaceFile[] | undefined,
  active: boolean,
): { loading: boolean; entries: TemplateEntry[] } {
  const list = templateFiles(files);
  const key = list.map((file) => `${file.path}@${file.mtime}`).join("|");
  const [state, setState] = useState<{ loading: boolean; entries: TemplateEntry[] }>({
    loading: true,
    entries: [],
  });
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    setState({ loading: true, entries: [] });
    void Promise.all(
      list.map(async (file) => {
        const text = await readFile(file.path)
          .then((r) => r.text)
          .catch(() => "");
        return {
          file,
          label: file.title?.trim() || fileTitle(file.path),
          description: templateDescription(text),
          text,
        };
      }),
    ).then((entries) => {
      if (!cancelled) setState({ loading: false, entries });
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` stands in for `list`'s identity
  }, [active, key]);
  return state;
}

/** A copy of `entry`'s template under `workspace/customers/`, never overwriting a file. */
async function copyTemplate(entry: TemplateEntry): Promise<string> {
  const path = await createUniqueFile(
    CUSTOMERS_FOLDER,
    `${fileStem(entry.file.path)}.yaml`,
    entry.text,
  );
  await workspaceActions.open(path);
  void workspaceActions.refreshTree().catch(() => undefined); // n12: the tree's own error state already reports it
  return path;
}

/** "New diagram" — always at the workspace root, never an overwrite (`createUniqueFile`). */
export function NewDiagramButton() {
  return (
    <Button
      onClick={() => void createAndOpen(() => workspaceActions.create("", START_LABELS.untitled))}
    >
      <FilePlus aria-hidden="true" />
      {START_LABELS.newDiagram}
    </Button>
  );
}

interface TemplateCardProps {
  entry: TemplateEntry;
  onPick: () => void;
}

function TemplateCard({ entry, onPick }: TemplateCardProps) {
  const { file, label, description } = entry;
  const thumb = thumbSrc(file.path, file.hasThumb, file.mtime);
  return (
    <Card interactive className="relative flex w-full min-w-0 flex-col">
      <CardMedia
        ground="dots"
        className="block min-h-0 overflow-hidden rounded-t-lg border-b border-border p-0"
      >
        <Image
          src={thumb}
          alt=""
          aspectRatio={16 / 9}
          fit="contain"
          loading="lazy"
          decoding="async"
          fallback={<NoPreview />}
        />
      </CardMedia>
      <div className="flex min-w-0 flex-col gap-1 p-4">
        <Heading level={3} size="subtitle">
          <button
            type="button"
            onClick={onPick}
            className="text-start after:absolute after:inset-0 after:rounded-lg focus-visible:outline-none focus-visible:after:focus-ring-static"
          >
            {label}
          </button>
        </Heading>
        {description !== "" ? (
          <Text variant="caption" tone="muted" className="line-clamp-3">
            {description}
          </Text>
        ) : null}
      </div>
    </Card>
  );
}

export interface TemplatePickerProps {
  /** The workspace tree's files: which diagrams under `templates/` exist, and their thumbnails. */
  files: readonly WorkspaceFile[] | undefined;
}

/** "New from template" — a dialog of every diagram under `templates/`; picking one copies it. */
export function TemplatePicker({ files }: TemplatePickerProps) {
  const [open, setOpen] = useState(false);
  const { loading, entries } = useTemplateEntries(files, open);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <LayoutTemplate aria-hidden="true" />
          {START_LABELS.newFromTemplate}
        </Button>
      </DialogTrigger>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{START_LABELS.templatePickerTitle}</DialogTitle>
          <DialogDescription>{START_LABELS.templatePickerDescription}</DialogDescription>
        </DialogHeader>
        {loading ? (
          <StatePanel kind="loading" titleAs="h3" />
        ) : entries.length === 0 ? (
          <StatePanel
            kind="empty"
            titleAs="h3"
            title={START_LABELS.noTemplates}
            description={START_LABELS.noTemplatesHint}
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {entries.map((entry) => (
              <TemplateCard
                key={entry.file.path}
                entry={entry}
                onPick={() => {
                  setOpen(false);
                  void createAndOpen(() => copyTemplate(entry));
                }}
              />
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
