import type { Meta, StoryObj } from "@storybook/react-vite";
import { Pin } from "lucide-react";
import { useState } from "react";

import { DocumentOutline, useMarkdownOutline } from "./document-outline";

const DOC = `# Reporting migration plan

## Phase overview

### Discovery

### Dual-run

## Timeline

## Risks and mitigations
`;

const meta = {
  title: "Editor/DocumentOutline",
  component: DocumentOutline,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
} satisfies Meta<typeof DocumentOutline>;

export default meta;
type Story = StoryObj<typeof meta>;

function Demo() {
  const items = useMarkdownOutline(DOC);
  const [active, setActive] = useState(items[0]?.id);
  return (
    <div className="max-w-56">
      <DocumentOutline items={items} activeId={active} onSelect={(i) => setActive(i.id)} />
    </div>
  );
}

export const Default: Story = {
  args: { items: [] },
  render: () => <Demo />,
};

export const Empty: Story = {
  args: { items: [] },
};

/** Per-entry hover affordances via `itemActions` (e.g. pin a section). */
function ItemActionsDemo() {
  const items = useMarkdownOutline(DOC);
  const [pinned, setPinned] = useState<string | null>("timeline");
  return (
    <div className="max-w-56">
      <DocumentOutline
        items={items}
        itemActions={(item) => (
          <button
            type="button"
            aria-label={`Pin section “${item.text}”`}
            aria-pressed={pinned === item.id}
            onClick={() => setPinned((p) => (p === item.id ? null : item.id))}
            className="rounded-sm p-0.5 text-muted-foreground hover:text-foreground focus-ring"
          >
            <Pin className="size-3" aria-hidden="true" />
          </button>
        )}
      />
    </div>
  );
}

export const ItemActions: Story = {
  args: { items: [] },
  render: () => <ItemActionsDemo />,
};
