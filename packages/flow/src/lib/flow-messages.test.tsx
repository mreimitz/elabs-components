import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { DEFAULT_MESSAGES, LocaleProvider } from "@elabs-ai/components-ui";
import { FLOW_DEFAULT_MESSAGES, formatFlowMessage, useFlowMessage } from "./flow-messages";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Flow source files (no tests, stories or contract probes). */
function sourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "__contract__") sourceFiles(full, acc);
    } else if (/\.tsx?$/.test(entry.name) && !/\.(test|stories)\.tsx?$/.test(entry.name)) {
      acc.push(full);
    }
  }
  return acc;
}

describe("formatFlowMessage", () => {
  it("interpolates {name} placeholders", () => {
    expect(formatFlowMessage("flow.groupNode.expand", { title: "Approvals" })).toBe(
      "Expand group Approvals",
    );
  });

  it("picks the plural form from vars.count", () => {
    expect(formatFlowMessage("flow.groupNode.childCount", { count: 1 })).toBe("1 node");
    expect(formatFlowMessage("flow.groupNode.childCount", { count: 3 })).toBe("3 nodes");
  });
});

describe("useFlowMessage", () => {
  it("falls back to flow's English defaults with no provider", () => {
    const { result } = renderHook(() => useFlowMessage());
    expect(result.current("flow.zoomControls.zoomIn")).toBe("Zoom in");
  });

  it("lets a LocaleProvider's messages override a flow default", () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <LocaleProvider locale="de-DE" messages={{ "flow.zoomControls.zoomIn": "Vergrößern" }}>
        {children}
      </LocaleProvider>
    );
    const { result } = renderHook(() => useFlowMessage(), { wrapper });
    expect(result.current("flow.zoomControls.zoomIn")).toBe("Vergrößern");
    // A key the provider does not override still resolves to the English default.
    expect(result.current("flow.zoomControls.zoomOut")).toBe("Zoom out");
  });

  it("lets a translate resolver answer first", () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <LocaleProvider translate={(key) => (key === "flow.buttonEdge.insert" ? "Einfügen" : null)}>
        {children}
      </LocaleProvider>
    );
    const { result } = renderHook(() => useFlowMessage(), { wrapper });
    expect(result.current("flow.buttonEdge.insert")).toBe("Einfügen");
  });
});

describe("FLOW_DEFAULT_MESSAGES", () => {
  it("holds no key the shared catalogue already ships — move it there, then delete it here", () => {
    const duplicated = Object.keys(FLOW_DEFAULT_MESSAGES).filter((key) => key in DEFAULT_MESSAGES);
    expect(duplicated).toEqual([]);
  });

  it("covers every flow.* key a flow source file passes to msg()", () => {
    const used = new Set<string>();
    for (const file of sourceFiles(SRC)) {
      const text = readFileSync(file, "utf8");
      for (const match of text.matchAll(/\bmsg\(\s*["'](flow\.[\w.]+)["']/g)) used.add(match[1]!);
    }
    const missing = [...used].filter((key) => !(key in FLOW_DEFAULT_MESSAGES));
    expect(missing).toEqual([]);
  });
});
