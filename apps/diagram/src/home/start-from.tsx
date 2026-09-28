/**
 * DG-23 — "New diagram" and "New from template" (R1 scope box: start-from templates, kept).
 * A new diagram is never an overwrite: `workspaceActions.create`/`createUniqueFile` always pick
 * a free name. Templates are every diagram under `workspace/templates/` (DG-67 ships two);
 * dialect v1 now compiles (DG-26 landed), so a copy renders like any other diagram once opened.
 *
 * Writing and opening are two separate steps (R1 review): a copy is written first and is never
 * lost even when the currently open tab has unsaved edits that failed to save — opening then
 * goes through the normal hash route (`openDoc`), which already has one correctly-worded toast
 * for "not opened" (`app.tsx`'s `UnsavedEditsError` handling) instead of a second one here that
 * would wrongly say the file was never created.
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
import { NoPreview } from "./no-preview";
import { fileStem, templateDescription, templateFiles } from "./templates";
import { thumbSrc } from "./thumbnail";
import { TreeErrorPanel } from "./tree-error-panel";
import { focusDocTab } from "../shell/focus";
import { fileTitle, openDoc } from "../shell/mode-store";
import {
  createUniqueFile,
  readFile,
  type WorkspaceFile,
  type WorkspaceTree,
} from "../workspace/client";
import { UnsavedEditsError, workspaceActions } from "../workspace/workspace-store";

/** The flow's strings, in one place (`conventions/i18n-strings`). */
export const START_LABELS = {
  newDiagram: "New diagram",
  untitled: "Untitled diagram",
  newFromTemplate: "New from template",
  templatePickerTitle: "Start from a template",
  templatePickerDescription: "A copy goes into workspace/customers/ and opens for editing.",
  createFailed: "Could not create the diagram",
  createdNotOpened: "Created, but not opened",
  noTemplates: "No templates yet",
  noTemplatesHint: "A diagram saved under templates/ shows up here.",
} as const;

/** New copies land here (DECISIONS 2026-09-28), created on first write if it does not exist. */
const CUSTOMERS_FOLDER = "customers";

/**
 * Create (or copy), then open in edit mode and focus its tab. A write failure toasts "could not
 * create". `workspaceActions.create` (plain "New diagram") also opens the file as its last step
 * and can refuse to (the currently open tab has unsaved edits that did not reach disk); the file
 * still exists then, so that case toasts a distinct, honest message instead — `UnsavedEditsError`
 * already names both documents in its own message. `copyTemplate` never opens internally (R1
 * review), so it cannot raise this case; `openDoc` itself is synchronous and never throws.
 */
async function createAndOpen(create: () => Promise<string>): Promise<void> {
  let path: string;
  try {
    path = await create();
  } catch (error) {
    if (error instanceof UnsavedEditsError) {
      toast.error(START_LABELS.createdNotOpened, { description: error.message });
      return;
    }
    toast.error(START_LABELS.createFailed, {
      description: error instanceof Error ? error.message : String(error),
    });
    return;
  }
  openDoc(path, { mode: "edit" });
  focusDocTab(path);
}

export interface TemplateEntry {
  file: WorkspaceFile;
  label: string;
  description: string;
  /** Already read while building the description; `null` when that read failed. */
  text: string | null;
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
          .catch(() => null);
        return {
          file,
          label: file.title?.trim() || fileTitle(file.path),
          description: text === null ? "" : templateDescription(text),
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

/**
 * A copy of `entry`'s template under `workspace/customers/`, never overwriting a file. Opening
 * it is `createAndOpen`'s job (via the hash route), not this function's — so a write that
 * succeeds is never reported as "could not create" just because the tab it would open in was
 * busy with someone else's unsaved edits.
 */
async function copyTemplate(entry: TemplateEntry): Promise<string> {
  const text = entry.text ?? (await readFile(entry.file.path)).text;
  const path = await createUniqueFile(CUSTOMERS_FOLDER, `${fileStem(entry.file.path)}.yaml`, text);
  void workspaceActions.refreshTree().catch(() => undefined); // n12: the tree's own error state already reports it
  return path;
}

/** "New diagram" — always at the workspace root, never an overwrite (`createUniqueFile`). */
export function NewDiagramButton() {
  const [pending, setPending] = useState(false);
  const onClick = () => {
    // `aria-disabled`, not `disabled`: a guard against a double activation firing two creates
    // (the same pattern as `TreeErrorPanel`'s Retry), not a state the button stays in for long.
    if (pending) return;
    setPending(true);
    void createAndOpen(() => workspaceActions.create("", START_LABELS.untitled)).finally(() =>
      setPending(false),
    );
  };
  return (
    <Button aria-disabled={pending} onClick={onClick}>
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
  /** The workspace tree: which diagrams under `templates/` exist, and their thumbnails. */
  tree: WorkspaceTree | null;
  /** Set when `tree` is null because the fetch failed, so the picker can tell that apart from
   *  "still loading" and from "templates/ is genuinely empty" (R1 review). */
  treeError: string | null;
}

/** "New from template" — a dialog of every diagram under `templates/`; picking one copies it. */
export function TemplatePicker({ tree, treeError }: TemplatePickerProps) {
  const [open, setOpen] = useState(false);
  const { loading, entries } = useTemplateEntries(tree?.files, open);
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
        {tree === null && treeError !== null ? (
          <TreeErrorPanel message={treeError} />
        ) : tree === null || loading ? (
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
