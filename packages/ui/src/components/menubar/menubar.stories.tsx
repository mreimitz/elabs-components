import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, waitFor, within } from "storybook/test";
import {
  Menubar,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarSeparator,
  MenubarShortcut,
  MenubarTrigger,
} from "./menubar";
const meta = {
  title: "Navigation/Menubar",
  component: Menubar,
  tags: ["autodocs"],
  argTypes: {
    loop: {
      description: "Whether keyboard navigation wraps from the last menu back to the first.",
      control: "boolean",
      table: { category: "Behaviour" },
    },
    dir: {
      description: "Reading direction for the menubar.",
      control: { type: "select" },
      options: ["ltr", "rtl"],
      table: { category: "Behaviour" },
    },
    className: {
      description: "Additional CSS classes applied to the menubar root.",
      control: "text",
      table: { category: "Styling" },
    },
  },
} satisfies Meta<typeof Menubar>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {
  render: () => (
    <Menubar>
      <MenubarMenu>
        <MenubarTrigger>File</MenubarTrigger>
        <MenubarContent>
          <MenubarItem>
            New <MenubarShortcut>⌘N</MenubarShortcut>
          </MenubarItem>
          <MenubarItem>Open</MenubarItem>
          <MenubarSeparator />
          <MenubarItem>Quit</MenubarItem>
        </MenubarContent>
      </MenubarMenu>
    </Menubar>
  ),
  // Clicks the "File" trigger to open the portalled menubar content and
  // confirms the menu items are visible, then presses Escape to close it.
  play: async ({ canvas, canvasElement, userEvent }) => {
    await userEvent.click(canvas.getByRole("menuitem", { name: /file/i }));
    const body = within(canvasElement.ownerDocument.body);
    const menu = await body.findByRole("menu");
    await waitFor(() =>
      expect(within(menu).getByRole("menuitem", { name: /open/i })).toBeVisible(),
    );
    await waitFor(() =>
      expect(within(menu).getByRole("menuitem", { name: /quit/i })).toBeVisible(),
    );
    await userEvent.keyboard("{Escape}");
  },
};
