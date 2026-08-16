import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { DashboardIcon } from "./dashboard";
import { ChatIcon } from "./chat";
import { TableIcon } from "./table";
import { FlowIcon } from "./flow";
import { SparklesIcon } from "./sparkles";
import { SearchIcon } from "./search";

const SAMPLE_ICONS = [
  { name: "DashboardIcon", Component: DashboardIcon },
  { name: "ChatIcon", Component: ChatIcon },
  { name: "TableIcon", Component: TableIcon },
  { name: "FlowIcon", Component: FlowIcon },
  { name: "SparklesIcon", Component: SparklesIcon },
  { name: "SearchIcon", Component: SearchIcon },
];

describe("Sample icons", () => {
  for (const { name, Component } of SAMPLE_ICONS) {
    it(`${name} renders a decorative svg`, () => {
      const { container } = render(<Component />);
      const svg = container.querySelector("svg");
      expect(svg).not.toBeNull();
      // Without a title, each icon is decorative
      expect(svg?.getAttribute("role")).toBe("presentation");
      expect(svg?.getAttribute("aria-hidden")).toBe("true");
    });

    it(`${name} renders as role=img when given a title`, () => {
      const { container } = render(<Component title={name} />);
      const svg = container.querySelector("svg");
      expect(svg?.getAttribute("role")).toBe("img");
      expect(svg?.getAttribute("aria-label")).toBe(name);
    });
  }
});
