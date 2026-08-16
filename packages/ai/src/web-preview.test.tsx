import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  WebPreview,
  WebPreviewBody,
  WebPreviewNavigation,
  WebPreviewNavigationButton,
  WebPreviewUrl,
} from "./web-preview";

describe("WebPreview", () => {
  it("renders the navigation bar and the iframe body", () => {
    const { container, getByDisplayValue } = render(
      <WebPreview defaultUrl="about:blank">
        <WebPreviewNavigation>
          <WebPreviewUrl />
        </WebPreviewNavigation>
        <WebPreviewBody />
      </WebPreview>,
    );
    expect(container.querySelector("iframe")).not.toBeNull();
    expect(getByDisplayValue("about:blank")).toBeInTheDocument();
  });
});

describe("WebPreviewBody loading (#269, loading-states.md)", () => {
  it("renders nothing extra by default", () => {
    const { container } = render(
      <WebPreview>
        <WebPreviewBody />
      </WebPreview>,
    );
    expect(container.querySelector(".animate-pulse")).toBeNull();
    expect(container.querySelector('[role="status"]')).toBeNull();
  });

  it("renders a layout-shaped skeleton filling the iframe box when loading is true", () => {
    const { container } = render(
      <WebPreview>
        <WebPreviewBody loading />
      </WebPreview>,
    );
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
    const statuses = container.querySelectorAll('[role="status"]');
    expect(statuses).toHaveLength(1);
    expect(statuses[0]).toHaveAttribute("aria-live", "polite");
    // The iframe itself keeps rendering underneath the placeholder.
    expect(container.querySelector("iframe")).not.toBeNull();
  });

  it("renders a caller-supplied placeholder node instead of the default skeleton", () => {
    const { container, getByText } = render(
      <WebPreview>
        <WebPreviewBody loading={<div>Booting sandbox…</div>} />
      </WebPreview>,
    );
    expect(getByText("Booting sandbox…")).toBeInTheDocument();
    expect(container.querySelector(".animate-pulse")).toBeNull();
  });
});

// #386 — `WebPreviewNavigationButton` is icon-only. Its `tooltip` only becomes
// an `aria-describedby` while the Radix tooltip is OPEN, so at rest the button
// had no accessible name at all and axe's `button-name` reds every story that
// mounts one. The tooltip text is the name (the `MessageAction` precedent in
// message.tsx), and an explicit `aria-label` still wins.
describe("WebPreviewNavigationButton accessible name (#386)", () => {
  it("names an icon-only navigation button from its tooltip", () => {
    render(
      <WebPreview>
        <WebPreviewNavigation>
          <WebPreviewNavigationButton tooltip="Reload">
            <svg aria-hidden="true" />
          </WebPreviewNavigationButton>
        </WebPreviewNavigation>
      </WebPreview>,
    );
    expect(screen.getByRole("button", { name: "Reload" })).toBeInTheDocument();
  });

  it("still names a disabled navigation button", () => {
    render(
      <WebPreview>
        <WebPreviewNavigation>
          <WebPreviewNavigationButton disabled tooltip="Reload">
            <svg aria-hidden="true" />
          </WebPreviewNavigationButton>
        </WebPreviewNavigation>
      </WebPreview>,
    );
    expect(screen.getByRole("button", { name: "Reload" })).toBeDisabled();
  });

  it("lets an explicit aria-label override the tooltip-derived name", () => {
    render(
      <WebPreview>
        <WebPreviewNavigation>
          <WebPreviewNavigationButton aria-label="Reload preview" tooltip="Reload">
            <svg aria-hidden="true" />
          </WebPreviewNavigationButton>
        </WebPreviewNavigation>
      </WebPreview>,
    );
    expect(screen.getByRole("button", { name: "Reload preview" })).toBeInTheDocument();
  });

  it("keeps a text-labelled navigation button's own content as its name", () => {
    render(
      <WebPreview>
        <WebPreviewNavigation>
          <WebPreviewNavigationButton>Back</WebPreviewNavigationButton>
        </WebPreviewNavigation>
      </WebPreview>,
    );
    expect(screen.getByRole("button", { name: "Back" })).toBeInTheDocument();
  });
});
