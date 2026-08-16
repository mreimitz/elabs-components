import { Button } from "@qlik-coe-emea/qlabs-components-ui";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, userEvent, within } from "storybook/test";

import { IterationTemplateDialog } from "./template-dialog";

const meta = {
  title: "Editor/Iteration/TemplateDialog",
  component: IterationTemplateDialog,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "The #223 template modal — author a `:::iterate` / `:::pivot` per-cell template in a " +
          "focused `Dialog` embedding the full `MarkdownWorkspace` (source / split / preview-edit). " +
          "Controlled (`open` / `onOpenChange`), seeded with `template`, returning the edit via " +
          "`onSave`. Wire it to the node-view `⋯` re-edit with `IterationTemplateProvider`.",
      },
    },
  },
} satisfies Meta<typeof IterationTemplateDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { open: false, onOpenChange: () => {}, template: "", onSave: () => {} },
  render: function DialogStory() {
    const [open, setOpen] = useState(false);
    const [saved, setSaved] = useState(
      `:::card{title="{{item.name}}"}\n**{{item.role}}** · {{item.commits}} commits\n:::`,
    );
    return (
      <div className="flex flex-col items-center gap-3">
        <Button onClick={() => setOpen(true)}>Edit iteration template…</Button>
        <pre className="max-w-md rounded-md bg-surface-muted p-3 text-caption text-muted-foreground">
          {saved}
        </pre>
        <IterationTemplateDialog
          open={open}
          onOpenChange={setOpen}
          template={saved}
          onSave={setSaved}
        />
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: /Edit iteration template/i }));
    // The dialog portals to the body — assert on a control unique to it.
    await expect(
      await within(document.body).findByRole(
        "button",
        { name: "Save template" },
        { timeout: 12000 },
      ),
    ).toBeInTheDocument();
  },
};
