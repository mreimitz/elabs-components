/**
 * DG-23 — "New diagram" and "New from template" (R1 scope box: start-from templates, kept).
 * A new diagram is never an overwrite: `workspaceActions.create`/`createUniqueFile` always pick
 * a free name. Templates are DG-67's two dialect-v1 files in `workspace/templates/`; the app
 * cannot compile dialect v1 until DG-26 lands, so a copy opens with a "not supported yet" banner
 * in the editor — expected, and unrelated to this flow, which only has to create the file and
 * open it.
 */
import { useState } from "react";
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
  Text,
  toast,
} from "@elabs-ai/components-ui";
import { FilePlus, LayoutTemplate, Workflow } from "lucide-react";
import { openDoc } from "../shell/mode-store";
import { createUniqueFile, readFile, type WorkspaceFile } from "../workspace/client";
import { workspaceActions } from "../workspace/workspace-store";
import { thumbSrc } from "./thumbnail";

/** The flow's strings, in one place (`conventions/i18n-strings`). */
export const START_LABELS = {
  newDiagram: "New diagram",
  untitled: "Untitled diagram",
  newFromTemplate: "New from template",
  templatePickerTitle: "Start from a template",
  templatePickerDescription: "A copy goes into workspace/customers/ and opens for editing.",
  createFailed: "Could not create the diagram",
  noPreview: "No preview yet",
} as const;

/** New copies land here (DECISIONS 2026-09-28), created on first write if it does not exist. */
const CUSTOMERS_FOLDER = "customers";

export interface HomeTemplate {
  /** Stable id; also the stem of the copy's file name. */
  id: string;
  /** The template's path in the workspace (`workspace/templates/…`). */
  path: string;
  label: string;
  description: string;
}

/** DG-67's two wedge templates (`workspace/templates/`). */
export const HOME_TEMPLATES: readonly HomeTemplate[] = [
  {
    id: "qlik-cloud-customer-landscape",
    path: "templates/qlik-cloud-customer-landscape.yaml",
    label: "Qlik Cloud and the customer landscape",
    description:
      "How the customer’s data center reaches the Qlik Cloud tenant through a Data Gateway in Azure, and Salesforce feeds it directly.",
  },
  {
    id: "qlik-talend-cloud-pipeline",
    path: "templates/qlik-talend-cloud-pipeline.yaml",
    label: "Qlik Talend Cloud pipeline",
    description:
      "How Qlik Replicate moves on-premises change data into S3 and the Open Lakehouse cluster turns it into Iceberg tables.",
  },
];

/** Create (or copy), then open in edit mode; a failure toasts and leaves Home as it was. */
async function createAndOpen(create: () => Promise<string>): Promise<void> {
  try {
    const path = await create();
    openDoc(path, { mode: "edit" });
  } catch (error) {
    toast.error(START_LABELS.createFailed, {
      description: error instanceof Error ? error.message : String(error),
    });
  }
}

/** A copy of `template` under `workspace/customers/`, never overwriting an existing file. */
async function copyTemplate(template: HomeTemplate): Promise<string> {
  const { text } = await readFile(template.path);
  const path = await createUniqueFile(CUSTOMERS_FOLDER, `${template.id}.yaml`, text);
  await workspaceActions.open(path);
  void workspaceActions.refreshTree().catch(() => undefined);
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
  template: HomeTemplate;
  file: WorkspaceFile | undefined;
  onPick: () => void;
}

function TemplateCard({ template, file, onPick }: TemplateCardProps) {
  const thumb = file ? thumbSrc(file.path, file.hasThumb, file.mtime) : undefined;
  return (
    <Card interactive className="relative flex min-w-0 flex-col">
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
          fallback={
            <span className="flex size-full flex-col items-center justify-center gap-1 text-muted-foreground">
              <Workflow aria-hidden="true" className="size-6" />
              <Text variant="meta" tone="muted" as="span">
                {START_LABELS.noPreview}
              </Text>
            </span>
          }
        />
      </CardMedia>
      <div className="flex min-w-0 flex-col gap-1 p-4">
        <Heading level={3} size="subtitle">
          <button
            type="button"
            onClick={onPick}
            className="text-start after:absolute after:inset-0 after:rounded-lg focus-visible:outline-none focus-visible:after:focus-ring-static"
          >
            {template.label}
          </button>
        </Heading>
        <Text variant="caption" tone="muted" className="line-clamp-3">
          {template.description}
        </Text>
      </div>
    </Card>
  );
}

export interface TemplatePickerProps {
  /** The workspace tree's files, to show a real thumbnail once one exists (no edit needed). */
  files: readonly WorkspaceFile[] | undefined;
}

/** "New from template" — a dialog of DG-67's two templates; picking one copies and opens it. */
export function TemplatePicker({ files }: TemplatePickerProps) {
  const [open, setOpen] = useState(false);
  const fileAt = (path: string) => files?.find((file) => file.path === path);
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {HOME_TEMPLATES.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              file={fileAt(template.path)}
              onPick={() => {
                setOpen(false);
                void createAndOpen(() => copyTemplate(template));
              }}
            />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
