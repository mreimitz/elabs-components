import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StreamingSuggestions, Suggestion, SuggestionLoading } from "./suggestion";

describe("Suggestion", () => {
  it("renders the suggestion text and fires onClick with it", async () => {
    const onClick = vi.fn();
    render(<Suggestion suggestion="Summarize the deploy log" onClick={onClick} />);

    const button = screen.getByRole("button", { name: "Summarize the deploy log" });
    expect(button).toBeInTheDocument();

    await userEvent.click(button);
    expect(onClick).toHaveBeenCalledWith("Summarize the deploy log");
  });

  // #194 (research 02 §3a BTN-2): the default is the soft tinted pill —
  // borderless `bg-secondary` + `rounded-full` — never the strong `--input`
  // outline. A caller-supplied variant still wins.
  it("defaults to the borderless secondary pill", () => {
    render(<Suggestion suggestion="Soft pill" />);
    const button = screen.getByRole("button", { name: "Soft pill" });
    const classes = button.className.split(" ");
    expect(classes).toContain("bg-secondary");
    expect(classes).toContain("rounded-full");
    expect(classes).not.toContain("border");
    expect(classes).not.toContain("border-input");
  });
});

describe("SuggestionLoading", () => {
  it("renders a status chip with the shimmering label", () => {
    render(<SuggestionLoading />);
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Thinking…");
  });

  it("accepts a custom label", () => {
    render(<SuggestionLoading label="Generating…" />);
    expect(screen.getByRole("status")).toHaveTextContent("Generating…");
  });
});

describe("StreamingSuggestions", () => {
  it("renders chips and a trailing loader while loading", () => {
    render(
      <StreamingSuggestions
        suggestions={["First", "Second"]}
        loading
        onSuggestionClick={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: "First" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Second" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Thinking…");
  });

  it("hides the trailing loader once the set settles", () => {
    render(<StreamingSuggestions suggestions={["First", "Second"]} loading={false} />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("fires onSuggestionClick with the chosen suggestion", async () => {
    const onSuggestionClick = vi.fn();
    render(
      <StreamingSuggestions suggestions={["Pick me"]} onSuggestionClick={onSuggestionClick} />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Pick me" }));
    expect(onSuggestionClick).toHaveBeenCalledWith("Pick me");
  });
});
