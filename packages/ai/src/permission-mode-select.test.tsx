import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PermissionModeSelect, type PermissionMode } from "./permission-mode-select";

const modes: PermissionMode[] = [
  {
    id: "ask",
    label: "Ask each time",
    consequence: "Waits for your approval before every command and file edit.",
  },
  {
    id: "auto",
    label: "Auto-approve safe actions",
    consequence:
      "Approves reads and edits in this project automatically; shell commands still ask.",
  },
  {
    id: "full",
    label: "Unrestricted",
    consequence: "Runs every action immediately — nothing is held back for approval.",
  },
];

describe("PermissionModeSelect", () => {
  it("renders every mode's consequence sentence", () => {
    render(<PermissionModeSelect currentId="ask" modes={modes} />);

    for (const mode of modes) {
      expect(screen.getByText(mode.consequence)).toBeInTheDocument();
    }
  });

  it("links each consequence sentence to its radio as an accessible DESCRIPTION", () => {
    // Rendering the sentence is not the same as delivering it. A screen-reader
    // user arrowing through the modes hears the radio's name and its
    // description — nothing else in the option's box. Without the
    // `aria-describedby` link they hear "Unrestricted" and never hear what
    // unrestricted costs them, which is the exact failure this component's
    // required `consequence` field exists to prevent. Asserting the text is
    // merely present would pass on that broken markup, so assert the LINK.
    render(<PermissionModeSelect currentId="ask" modes={modes} />);

    for (const mode of modes) {
      const radio = screen.getByRole("radio", { name: new RegExp(mode.label) });
      const describedBy = radio.getAttribute("aria-describedby");

      expect(describedBy).toBeTruthy();
      expect(document.getElementById(describedBy as string)).toHaveTextContent(mode.consequence);
    }
  });

  it("marks the in-force mode in the ACCESSIBLE NAME, not only via a class or data-* attribute", () => {
    render(<PermissionModeSelect currentId="auto" modes={modes} />);

    // The load-bearing assertion: querying by accessible NAME is the only way
    // to prove the marker reaches a screen reader. Two class strings differing,
    // or a bare `data-current` attribute, would pass a naive test while an AT
    // user hears nothing — that is exactly the gap this test closes.
    expect(
      screen.getByRole("radio", { name: /auto-approve safe actions.*current/i }),
    ).toBeInTheDocument();

    // The other modes' accessible names carry no such marker.
    expect(screen.getByRole("radio", { name: "Ask each time" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Unrestricted" })).toBeInTheDocument();
  });

  it("selecting a different mode reports its id without mutating currentId", async () => {
    const onValueChange = vi.fn();
    render(<PermissionModeSelect currentId="ask" modes={modes} onValueChange={onValueChange} />);

    await userEvent.click(screen.getByRole("radio", { name: "Unrestricted" }));

    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenCalledWith("full");

    // The newly-highlighted radio is checked…
    expect(screen.getByRole("radio", { name: "Unrestricted" })).toBeChecked();
    // …but `currentId` — an app-controlled prop the component never writes to
    // — still names "Ask each time": the marker has not moved to the
    // selection, and "Unrestricted" carries no "current" marker of its own.
    expect(screen.getByRole("radio", { name: /ask each time.*current/i })).toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: /unrestricted.*current/i })).not.toBeInTheDocument();
  });

  it("does not hardcode any mode vocabulary — every label/consequence comes from props", () => {
    const customModes: PermissionMode[] = [
      {
        id: "x",
        label: "Read-only sandbox",
        consequence: "Nothing outside memory is ever touched.",
      },
    ];
    render(<PermissionModeSelect currentId="x" modes={customModes} />);

    expect(screen.getByRole("radio", { name: /read-only sandbox.*current/i })).toBeInTheDocument();
    expect(screen.getByText("Nothing outside memory is ever touched.")).toBeInTheDocument();
  });
});
