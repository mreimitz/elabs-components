import type { Tool } from "ai";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AgentTool, AgentTools } from "./agent";

const staticTool: Tool = {
  description: "Search the web for a query.",
  inputSchema: { type: "object" } as never,
};

// ai@7 widened `Tool.description` to `string | ((options) => string)` (a
// per-call dynamic description). `AgentTool` renders a static list with no
// call context to invoke that function with.
const dynamicTool: Tool = {
  description: () => "computed at call time",
  inputSchema: { type: "object" } as never,
};

describe("AgentTool description (#30, ai@7 Tool.description can be a function)", () => {
  it("renders a string description", () => {
    render(
      <AgentTools type="single" collapsible>
        <AgentTool tool={staticTool} value="search" />
      </AgentTools>,
    );
    expect(screen.getByText("Search the web for a query.")).toBeInTheDocument();
  });

  it("falls back to the empty-description copy instead of rendering a function as a node", () => {
    render(
      <AgentTools type="single" collapsible>
        <AgentTool tool={dynamicTool} value="dynamic" />
      </AgentTools>,
    );
    expect(screen.getByText("No description")).toBeInTheDocument();
  });

  it("falls back to the empty-description copy when there is no description at all", () => {
    const bareTool: Tool = { inputSchema: { type: "object" } as never };
    render(
      <AgentTools type="single" collapsible>
        <AgentTool tool={bareTool} value="bare" />
      </AgentTools>,
    );
    expect(screen.getByText("No description")).toBeInTheDocument();
  });
});
