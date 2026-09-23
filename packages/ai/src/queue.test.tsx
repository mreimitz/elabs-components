import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { QueueItemImage } from "./queue";

afterEach(cleanup);

describe("QueueItemImage", () => {
  it("renders the ui Image as a 32 px decorative thumbnail with its own slot", () => {
    const { container } = render(<QueueItemImage src="/thumb.png" />);
    const img = container.firstElementChild;
    expect(img?.tagName).toBe("IMG");
    expect(img).toHaveAttribute("data-slot", "queue-item-image");
    expect(img).toHaveAttribute("alt", "");
    expect(img).toHaveAttribute("width", "32");
    expect(img).toHaveClass("object-cover");
  });

  it("keeps a caller's alt and settles into a fallback on a load error", () => {
    const { container, getByRole } = render(<QueueItemImage src="/thumb.png" alt="Screenshot" />);
    fireEvent.error(getByRole("img", { name: "Screenshot" }));
    expect(container.querySelector("img")).toBeNull();
    expect(getByRole("img", { name: "Screenshot" })).toBeInTheDocument();
  });
});
