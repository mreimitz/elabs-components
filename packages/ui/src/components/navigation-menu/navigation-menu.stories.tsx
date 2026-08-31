import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, waitFor } from "storybook/test";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "./navigation-menu";
const meta = {
  title: "Navigation/NavigationMenu",
  component: NavigationMenu,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  argTypes: {
    value: {
      description: "Controlled value of the currently active item.",
      control: "text",
      table: { category: "State" },
    },
    defaultValue: {
      description: "Uncontrolled initial active item value.",
      control: "text",
      table: { category: "State" },
    },
    onValueChange: {
      description: "Callback when the active item changes.",
      control: false,
      table: { category: "Events" },
    },
    delayDuration: {
      description: "Milliseconds to delay before content opens on pointer enter.",
      control: "number",
      table: { category: "Behaviour" },
    },
    skipDelayDuration: {
      description: "Milliseconds before the close delay resets after leaving a trigger.",
      control: "number",
      table: { category: "Behaviour" },
    },
    dir: {
      description: "Reading direction for the navigation menu.",
      control: { type: "select" },
      options: ["ltr", "rtl"],
      table: { category: "Behaviour" },
    },
    className: {
      description: "Additional CSS classes applied to the navigation menu root.",
      control: "text",
      table: { category: "Styling" },
    },
  },
} satisfies Meta<typeof NavigationMenu>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {
  render: () => (
    <NavigationMenu>
      <NavigationMenuList>
        <NavigationMenuItem>
          <NavigationMenuTrigger>Products</NavigationMenuTrigger>
          <NavigationMenuContent>
            <ul className="grid w-56 gap-1 p-2">
              <li>
                <NavigationMenuLink className="block rounded-md p-2 text-body hover:bg-accent">
                  Analytics
                </NavigationMenuLink>
              </li>
              <li>
                <NavigationMenuLink className="block rounded-md p-2 text-body hover:bg-accent">
                  Data Integration
                </NavigationMenuLink>
              </li>
            </ul>
          </NavigationMenuContent>
        </NavigationMenuItem>
      </NavigationMenuList>
    </NavigationMenu>
  ),
  // Clicks the "Products" trigger, confirms the dropdown content appears in the
  // viewport (NavigationMenu renders inline, not portalled), then presses Escape.
  play: async ({ canvas, userEvent }) => {
    const trigger = canvas.getByRole("button", { name: /products/i });
    await userEvent.click(trigger);
    const analytics = await canvas.findByText("Analytics");
    await waitFor(() => expect(analytics).toBeVisible());
    await waitFor(() => expect(canvas.getByText("Data Integration")).toBeVisible());
    // Escape dismisses the open panel
    await userEvent.keyboard("{Escape}");
    // Wait for close transition to complete
    await waitFor(() => expect(canvas.queryByText("Analytics")).not.toBeInTheDocument());
  },
};
