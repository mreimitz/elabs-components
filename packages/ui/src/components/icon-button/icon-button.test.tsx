import { createRef } from "react";
import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RefreshCw } from "lucide-react";
import { IconButton } from "./icon-button";

describe("IconButton", () => {
  it("has exactly one accessible name and no title attribute anywhere in the output", () => {
    render(<IconButton label="Refresh" icon={<RefreshCw aria-hidden="true" />} />);
    const button = screen.getByRole("button", { name: "Refresh" });
    expect(button).not.toHaveAttribute("title");
    expect(document.querySelector("[title]")).toBeNull();
  });

  it("opens the tooltip on keyboard focus alone (no pointer interaction)", async () => {
    render(<IconButton label="Refresh" icon={<RefreshCw aria-hidden="true" />} />);
    await userEvent.tab();
    expect(screen.getByRole("button", { name: "Refresh" })).toHaveFocus();
    const tooltip = await screen.findByText("Refresh", { selector: "[data-side]" });
    await waitFor(() => expect(tooltip).toBeVisible());
  });

  it("exposes disabledReason via aria-describedby on an always-present element, even while pointer-events-none", () => {
    render(
      <IconButton
        label="Delete"
        icon={<RefreshCw aria-hidden="true" />}
        disabled
        disabledReason="You don't have permission"
      />,
    );
    const button = screen.getByRole("button", { name: "Delete" });
    expect(button).toBeDisabled();
    const describedBy = button.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    const node = describedBy ? document.getElementById(describedBy) : null;
    expect(node).not.toBeNull();
    expect(node).toHaveTextContent("You don't have permission");
  });

  it("does not render a description node (or aria-describedby) when no disabledReason is given", () => {
    render(<IconButton label="Refresh" icon={<RefreshCw aria-hidden="true" />} />);
    const button = screen.getByRole("button", { name: "Refresh" });
    expect(button).not.toHaveAttribute("aria-describedby");
  });

  // While disabled, the wrapper span — not the button — is the tab stop, so it
  // must carry the tokened focus ring; without it the browser's own hardcoded
  // blue outline shows through, identically in every theme.
  it("gives the disabled-state tab stop the tokened focus ring", async () => {
    render(
      <IconButton
        label="Delete"
        icon={<RefreshCw aria-hidden="true" />}
        disabled
        disabledReason="No permission"
      />,
    );
    const wrapper = document.querySelector('[data-slot="icon-button"]')!;
    expect(wrapper).toHaveAttribute("tabindex", "0");
    expect(wrapper.className).toContain("focus-ring");
    await userEvent.tab();
    expect(wrapper).toHaveFocus();
  });

  it("does not put the wrapper in the tab order when enabled (no phantom stop)", async () => {
    render(<IconButton label="Refresh" icon={<RefreshCw aria-hidden="true" />} />);
    const wrapper = document.querySelector('[data-slot="icon-button"]')!;
    expect(wrapper).not.toHaveAttribute("tabindex");
    await userEvent.tab();
    expect(screen.getByRole("button", { name: "Refresh" })).toHaveFocus();
  });

  it("forwards the ref to the underlying <button>", () => {
    const ref = createRef<HTMLButtonElement>();
    render(<IconButton ref={ref} label="Refresh" icon={<RefreshCw aria-hidden="true" />} />);
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
    expect(ref.current).toBe(screen.getByRole("button", { name: "Refresh" }));
  });

  it("cannot have its computed aria-label overridden by a stray prop (single source of truth)", () => {
    // TypeScript's JSX checker special-cases aria-*/data-* attribute names on
    // ANY element regardless of the declared prop type, so `aria-label` is
    // syntactically accepted here even though `IconButtonProps` omits it —
    // this test locks the RUNTIME guarantee that it can never win.
    render(
      <IconButton label="Refresh" icon={<RefreshCw aria-hidden="true" />} aria-label="Wrong" />,
    );
    expect(screen.getByRole("button", { name: "Refresh" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Wrong" })).not.toBeInTheDocument();
  });
});
