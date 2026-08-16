import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "./dropdown-menu";

describe("DropdownMenu", () => {
  it("opens content on trigger click and fires onSelect", async () => {
    const onSelect = vi.fn();
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Open</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onSelect={onSelect}>Profile</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );
    await userEvent.click(screen.getByText("Open"));
    const item = await screen.findByText("Profile");
    await userEvent.click(item);
    expect(onSelect).toHaveBeenCalled();
  });

  it("toggles a checkbox item's checked state (DropdownMenuCheckboxItem)", async () => {
    function Harness() {
      const [checked, setChecked] = useState(false);
      return (
        <DropdownMenu>
          <DropdownMenuTrigger>Open</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuCheckboxItem checked={checked} onCheckedChange={setChecked}>
              Bold
            </DropdownMenuCheckboxItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    }
    render(<Harness />);

    await userEvent.click(screen.getByText("Open"));
    const item = await screen.findByRole("menuitemcheckbox", { name: "Bold" });
    expect(item).toHaveAttribute("aria-checked", "false");

    await userEvent.click(item);
    // Selecting an item closes the menu (Radix default) — reopen to observe state.
    await userEvent.click(screen.getByText("Open"));
    const reopened = await screen.findByRole("menuitemcheckbox", { name: "Bold" });
    expect(reopened).toHaveAttribute("aria-checked", "true");
  });

  it("a radio group (DropdownMenuRadioGroup + DropdownMenuRadioItem) selects one option", async () => {
    function Harness() {
      const [value, setValue] = useState("left");
      return (
        <DropdownMenu>
          <DropdownMenuTrigger>Open</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuRadioGroup value={value} onValueChange={setValue}>
              <DropdownMenuRadioItem value="left">Left</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="center">Center</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    }
    render(<Harness />);

    await userEvent.click(screen.getByText("Open"));
    const centerOption = await screen.findByRole("menuitemradio", { name: "Center" });
    expect(centerOption).toHaveAttribute("aria-checked", "false");
    await userEvent.click(centerOption);

    await userEvent.click(screen.getByText("Open"));
    const reopened = await screen.findByRole("menuitemradio", { name: "Center" });
    expect(reopened).toHaveAttribute("aria-checked", "true");
  });

  it("a submenu (DropdownMenuSub + DropdownMenuSubTrigger + DropdownMenuSubContent) opens on hover", async () => {
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Open</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>More</DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem>Nested action</DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    await userEvent.click(screen.getByText("Open"));
    const subTrigger = await screen.findByText("More");
    await userEvent.hover(subTrigger);
    expect(await screen.findByText("Nested action")).toBeInTheDocument();
  });
});
