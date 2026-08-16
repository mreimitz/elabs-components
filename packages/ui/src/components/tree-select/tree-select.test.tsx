import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { TreeSelect } from "./tree-select";
import type { TreeNode } from "../tree";

const nodes: TreeNode[] = [
  {
    id: "fruits",
    label: "Fruits",
    children: [
      { id: "apple", label: "Apple" },
      { id: "banana", label: "Banana" },
    ],
  },
  { id: "veggies", label: "Vegetables", children: [{ id: "carrot", label: "Carrot" }] },
];

describe("TreeSelect", () => {
  it("renders the placeholder on the trigger when nothing is selected", () => {
    render(<TreeSelect nodes={nodes} placeholder="Pick a node" />);
    expect(screen.getByText("Pick a node")).toBeInTheDocument();
    expect(screen.getByRole("combobox")).toHaveAttribute("aria-expanded", "false");
  });

  it("shows the selected label for a controlled single value", () => {
    render(<TreeSelect nodes={nodes} value="apple" />);
    expect(screen.getByText("Apple")).toBeInTheDocument();
  });

  it("renders a badge per selected node in multiple mode", () => {
    render(<TreeSelect nodes={nodes} multiple value={["apple", "carrot"]} />);
    expect(screen.getByText("Apple")).toBeInTheDocument();
    expect(screen.getByText("Carrot")).toBeInTheDocument();
  });

  it("collapses overflow badges into a +N counter", () => {
    render(<TreeSelect nodes={nodes} multiple value={["apple", "banana", "carrot"]} />);
    expect(screen.getByText("+1")).toBeInTheDocument();
  });
});
