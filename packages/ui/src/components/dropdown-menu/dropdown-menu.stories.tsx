import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, waitFor, within } from "storybook/test";
import { useState } from "react";
import { ThemeProvider } from "@elabs-ai/components-tokens";
import { Button } from "../button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "./dropdown-menu";

const meta = {
  title: "Overlays/DropdownMenu",
  component: DropdownMenu,
  tags: ["autodocs"],
} satisfies Meta<typeof DropdownMenu>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">Open menu</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel>Account</DropdownMenuLabel>
        <DropdownMenuItem>Profile</DropdownMenuItem>
        <DropdownMenuItem>Billing</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem>Sign out</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
  // Opening the menu sets the trigger aria-expanded and mounts the menu items
  // into the Radix portal (on document.body, outside the canvas).
  play: async ({ canvas, canvasElement, userEvent }) => {
    const trigger = canvas.getByRole("button", { name: /open menu/i });
    await userEvent.click(trigger);
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    const body = within(canvasElement.ownerDocument.body);
    const profile = await body.findByRole("menuitem", { name: "Profile" });
    // waitFor rides out the entrance animation (opacity starts at 0).
    await waitFor(() => expect(profile).toBeVisible());
  },
};

/**
 * The submenu / radio-group / checkbox-item parts (`DropdownMenuSub` +
 * `DropdownMenuSubTrigger` + `DropdownMenuSubContent`, `DropdownMenuRadioGroup` +
 * `DropdownMenuRadioItem`, `DropdownMenuCheckboxItem`) — the same building blocks
 * `ContextMenu` already ships, mirrored here so `DropdownMenu` has them too (the
 * iteration node-menu's "Change layout" submenu renders into either surface from
 * one shared item list).
 */
export const SubmenuRadioAndCheckbox: Story = {
  name: "Submenu, radio group and checkbox item",
  render: function SubmenuStory() {
    const [bold, setBold] = useState(false);
    const [align, setAlign] = useState("left");
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline">Format</Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuCheckboxItem checked={bold} onCheckedChange={setBold}>
            Bold
          </DropdownMenuCheckboxItem>
          <DropdownMenuSeparator />
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>Align</DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuRadioGroup value={align} onValueChange={setAlign}>
                <DropdownMenuRadioItem value="left">Left</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="center">Center</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="right">Right</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  },
  // Opens the menu, toggles the checkbox item, reopens (selecting an item
  // closes the menu by default), then hovers into the submenu (Radix's pointer
  // path — the same precedent as the iteration node-menu's "Change layout"
  // story) and picks a radio option.
  play: async ({ canvas, canvasElement, userEvent }) => {
    const trigger = canvas.getByRole("button", { name: /format/i });
    const body = within(canvasElement.ownerDocument.body);

    await userEvent.click(trigger);
    const boldItem = await body.findByRole("menuitemcheckbox", { name: "Bold" });
    await waitFor(() => expect(boldItem).toBeVisible());
    await userEvent.click(boldItem);
    // Selecting a checkbox item closes the menu (Radix default).
    await waitFor(() => expect(body.queryByRole("menu")).toBeNull());

    await userEvent.click(trigger);
    const boldItem2 = await body.findByRole("menuitemcheckbox", { name: "Bold" });
    await waitFor(() => expect(boldItem2).toHaveAttribute("aria-checked", "true"));

    await userEvent.hover(body.getByText("Align"));
    const centerOption = await body.findByRole(
      "menuitemradio",
      { name: "Center" },
      { timeout: 8000 },
    );
    await waitFor(() => expect(centerOption).toBeVisible());
    await userEvent.click(centerOption);
    await waitFor(() => expect(body.queryByRole("menu")).toBeNull());

    // Reopen once more to confirm the radio selection persisted.
    await userEvent.click(trigger);
    await userEvent.hover(body.getByText("Align"));
    const centerOption2 = await body.findByRole(
      "menuitemradio",
      { name: "Center" },
      { timeout: 8000 },
    );
    await waitFor(() => expect(centerOption2).toHaveAttribute("aria-checked", "true"));

    // Escape dismisses the whole menu — a real behavioural assertion AND the
    // reason this story is green (#386). A Radix MODAL menu marks the rest of
    // the document `aria-hidden` while it is open; leaving it open meant axe
    // saw focusable content inside an `aria-hidden` subtree
    // (`aria-hidden-focus`), and the marker survived into the next story in
    // this file, breaking its `queryByRole` lookups. Every menu story must
    // hand the document back unmarked.
    await userEvent.keyboard("{Escape}"); // submenu
    await userEvent.keyboard("{Escape}"); // root menu
    await waitFor(() => expect(body.queryByRole("menu")).toBeNull());
    await waitFor(() =>
      expect(canvasElement.ownerDocument.querySelector('[data-aria-hidden="true"]')).toBeNull(),
    );
  },
};

/**
 * Three-theme sweep (a durable, `test-storybook`-run artifact rather than a
 * one-off manual `preview.tsx` toggle). `<ThemeProvider>` (not a plain
 * `data-theme` wrapper `<div>`) because it writes the attribute onto the
 * DOCUMENT ROOT — this menu's Radix `Portal` mounts its content on
 * `document.body`, outside any local wrapper, so only a document-level
 * attribute actually themes it. `storageKey={null}` keeps the override from
 * persisting to localStorage across runs.
 */
export const SubmenuRadioAndCheckboxDark: Story = {
  name: "Submenu, radio group and checkbox item — dark",
  decorators: [
    (Story) => (
      <ThemeProvider defaultTheme="dark" storageKey={null}>
        <Story />
      </ThemeProvider>
    ),
  ],
  render: SubmenuRadioAndCheckbox.render,
  play: SubmenuRadioAndCheckbox.play,
};

export const SubmenuRadioAndCheckboxHighDecoration: Story = {
  name: "Submenu, radio group and checkbox item — high decoration",
  globals: { decoration: "10" },
  render: SubmenuRadioAndCheckbox.render,
  play: SubmenuRadioAndCheckbox.play,
};
